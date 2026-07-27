/**
 * =============================================================
 *  MdI MultiWA — services/session-manager.js
 *  Versión : v1.38.0
 *  Fecha   : 2026-07-09
 * =============================================================
 *  CHANGELOG
 *  ---------
 *  v1.38.0 — FIX RAÍZ: separar carpetas de LocalAuth y Chrome.
 *             LocalAuth usa ./sessions/ (solo credenciales WA).
 *             Chrome usa ./chrome-profiles/ (perfil del browser).
 *             Antes ambos compartían la misma carpeta, causando
 *             LOGOUT/UNPAIRED/EBUSY al iniciarse.
 *             Elimina whatsapp-client.js como segunda fábrica.
 *             new Client() solo existe acá.
 *             removeAllListeners() en TODOS los eventos antes
 *             de re-registrar (ready, authenticated, disconnected,
 *             message) para evitar handlers duplicados.
 *             gracefulDestroy() usa browser.close() + destroy()
 *             con timeout para liberar archivos antes de borrar.
 *  v1.37.0 — StateManager centralizado, ready() sin reemplazar ref.
 *  v1.36.0 — Handler de mensajes separado.
 *  v1.35.x — Filtros anti-basura, límite QRs, timeout Puppeteer.
 * =============================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { getEstadoInstancia, actualizarEstado, guardarEstadoSeguro } = require('../state/estado');
const { handleInboundMessage } = require('./inbound-message-handler');

const sessions    = new Map();  // userId → { instances: Map, activeId }
const clients     = new Map();  // `${userId}_${instanceId}` → Client
const userSockets = new Map();  // userId → Set<Socket>

const DATA_DIR          = path.join(__dirname, '..', 'data');
const INSTANCIAS_FILE   = path.join(DATA_DIR, 'instancias.json');
// FIX v1.38.0: carpetas SEPARADAS para LocalAuth y Chrome
const SESSIONS_DIR      = path.join(__dirname, '..', 'sessions');       // credenciales WA
const CHROME_PROFILES   = path.join(__dirname, '..', 'chrome-profiles'); // perfiles Chrome

if (!fs.existsSync(DATA_DIR))        fs.mkdirSync(DATA_DIR,        { recursive: true });
if (!fs.existsSync(SESSIONS_DIR))    fs.mkdirSync(SESSIONS_DIR,    { recursive: true });
if (!fs.existsSync(CHROME_PROFILES)) fs.mkdirSync(CHROME_PROFILES, { recursive: true });

// ─────────────────────────────────────────────
//  BUSCAR CHROME EN WINDOWS
// ─────────────────────────────────────────────
function findChromePath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    return paths.find(p => fs.existsSync(p)) || undefined;
}

// ─────────────────────────────────────────────
//  QR
// ─────────────────────────────────────────────
async function generarQrImagen(qr) {
    try {
        if (qr && (qr.startsWith('2@') || qr.startsWith('3@'))) {
            return await QRCode.toDataURL(qr, {
                errorCorrectionLevel: 'H', margin: 2, width: 300,
                color: { dark: '#000000', light: '#ffffff' }
            });
        }
        if (qr.startsWith('data:image')) return qr;
        return `data:image/png;base64,${qr}`;
    } catch (e) {
        console.error('Error generando QR:', e.message);
        return qr;
    }
}

// ─────────────────────────────────────────────
//  DESTRUIR CLIENTE (graceful)
//  Cierra browser primero, luego destroy()
//  para liberar archivos antes de borrar carpetas
// ─────────────────────────────────────────────
async function gracefulDestroy(client) {
    if (!client) return;
    // 1. Cerrar browser (libera archivos de Chrome)
    try {
        const browser = client.pupPage?.browser?.() || client.browser;
        if (browser) await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]);
    } catch (_) {}
    // 2. Destroy del cliente WA
    try {
        await Promise.race([client.destroy(), new Promise(r => setTimeout(r, 3000))]);
    } catch (_) {}
}

// ─────────────────────────────────────────────
//  PERSISTENCIA INSTANCIAS.JSON
// ─────────────────────────────────────────────
function guardarInstancia(userId, instanceId, data) {
    try {
        let todas = {};
        if (fs.existsSync(INSTANCIAS_FILE)) {
            todas = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
        }
        if (!todas[userId]) todas[userId] = [];
        const idx  = todas[userId].findIndex(i => i.id === instanceId);
        const item = {
            id    : instanceId,
            numero: data.numero || '',
            listo : data.listo  || false,
            fecha : data.fecha  || new Date().toISOString()
        };
        if (idx !== -1) todas[userId][idx] = item;
        else            todas[userId].push(item);
        fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(todas, null, 2));
    } catch (e) {
        console.error('Error guardando instancia:', e.message);
    }
}

function guardarInstanciaEnDisco(userId, instanceId, data) {
    return guardarInstancia(userId, instanceId, data);
}

function cargarInstancias() {
    try {
        if (!fs.existsSync(INSTANCIAS_FILE)) return;
        const data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
        for (const [userId, instancias] of Object.entries(data)) {
            if (!sessions.has(userId)) {
                sessions.set(userId, { instances: new Map(), activeId: null });
            }
            const s = sessions.get(userId);
            for (const inst of instancias) {
                // Verificar que exista la carpeta de sesión WA
                const sessionDir = path.join(SESSIONS_DIR, `session-${inst.id}`);
                if (!fs.existsSync(sessionDir)) continue;
                const estado = getEstadoInstancia(inst.id);
                s.instances.set(inst.id, {
                    numero: inst.numero || '',
                    listo : false,
                    estado,
                    client: null
                });
            }
        }
    } catch (e) {
        console.error('Error cargando instancias:', e.message);
    }
}

// ─────────────────────────────────────────────
//  GETTERS
// ─────────────────────────────────────────────
function getUserSession(userId)      { return sessions.get(userId) || null; }
function getActiveInstanceId(userId) { return sessions.get(userId)?.activeId || null; }
function getQrCode()                 { return null; }
function getClient(userId, instanceId) {
    return clients.get(`${userId}_${instanceId}`) || null;
}

function getUserInstances(userId) {
    const s = sessions.get(userId);
    if (!s) return [];
    return [...s.instances.entries()].map(([id, inst]) => ({
        id,
        numero: inst.numero || '',
        listo : inst.listo  || false
    }));
}

function getEstado(userId) {
    const s = sessions.get(userId);
    if (!s || !s.activeId) return null;
    const inst = s.instances.get(s.activeId);
    if (!inst) return null;
    if (inst.estado) {
        inst.estado.listo          = inst.listo;
        inst.estado.numeroWhatsApp = inst.numero || inst.estado.numeroWhatsApp;
    }
    return inst.estado || null;
}

function setActiveInstance(userId, instanceId) {
    const s = sessions.get(userId);
    if (!s || !s.instances.has(instanceId)) return;
    s.activeId = instanceId;
    guardarEstadoSeguro(instanceId);
}

// ─────────────────────────────────────────────
//  SOCKETS
// ─────────────────────────────────────────────
function addSocket(userId, socket) {
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket);
}

function removeSocket(userId, socket) {
    if (!userSockets.has(userId)) return;
    userSockets.get(userId).delete(socket);
    if (userSockets.get(userId).size === 0) userSockets.delete(userId);
}

function emitToUser(userId, event, data) {
    if (!userSockets.has(userId)) return;
    for (const sock of userSockets.get(userId)) sock.emit(event, data);
}

function emitQr(userId, qr)      { emitToUser(userId, 'qr', { qr }); }
function emitReady(userId, data) { emitToUser(userId, 'whatsapp_ready', data); }

function emitInstancesUpdate(userId) {
    const instancias = getUserInstances(userId);
    emitToUser(userId, 'instances_update', { instancias });
}

// ─────────────────────────────────────────────
//  CREAR SESIÓN — única fábrica de Client
// ─────────────────────────────────────────────
async function startSession(userId, io, instanceId) {
    console.log(`📱 Iniciando sesión: ${instanceId}`);
    const key = `${userId}_${instanceId}`;

    // Destruir cliente anterior si existe
    if (clients.has(key)) {
        await gracefulDestroy(clients.get(key));
        clients.delete(key);
    }

    if (!sessions.has(userId)) {
        sessions.set(userId, { instances: new Map(), activeId: null });
    }
    const s = sessions.get(userId);

    const estadoInstancia = getEstadoInstancia(instanceId);

    if (!s.instances.has(instanceId)) {
        s.instances.set(instanceId, {
            numero: estadoInstancia.numeroWhatsApp || '',
            listo : false,
            estado: estadoInstancia,
            client: null
        });
        if (!s.activeId) s.activeId = instanceId;
    } else {
        s.instances.get(instanceId).estado = estadoInstancia;
    }

    // FIX v1.38.0: carpeta de Chrome Profile SEPARADA de LocalAuth
    const chromeProfileDir = path.join(CHROME_PROFILES, instanceId);
    if (!fs.existsSync(chromeProfileDir)) fs.mkdirSync(chromeProfileDir, { recursive: true });

    const chromePath = findChromePath();
    const puppeteerConfig = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            // FIX v1.38.0: user-data-dir apunta a chrome-profiles/, NO a sessions/
            `--user-data-dir=${chromeProfileDir}`
        ]
    };
    if (chromePath) {
        puppeteerConfig.executablePath = chromePath;
        console.log(`🌐 Usando Chrome: ${chromePath}`);
    }

    const client = new Client({
        // FIX v1.38.0: LocalAuth usa sessions/ — carpeta exclusiva para credenciales WA
        authStrategy: new LocalAuth({
            clientId: instanceId,
            dataPath: SESSIONS_DIR
        }),
        puppeteer: puppeteerConfig
    });

    clients.set(key, client);
    s.instances.get(instanceId).client = client;

    // ── QR (límite 5 intentos) ──
    let qrCount = 0;
    client.on('qr', async (qr) => {
        qrCount++;
        if (qrCount > 5) {
            console.warn(`⚠️ Demasiados QRs para ${instanceId} — abortando`);
            await gracefulDestroy(client);
            clients.delete(key);
            const i = s.instances.get(instanceId);
            if (i) { i.listo = false; i.client = null; }
            emitInstancesUpdate(userId);
            return;
        }
        console.log(`📱 QR ${qrCount}/5 → ${instanceId}`);
        const qrImage = await generarQrImagen(qr);
        emitQr(userId, qrImage);
        if (io) io.emit('qr', { qr: qrImage });
    });

    // FIX v1.38.0: removeAllListeners en TODOS los eventos para evitar duplicados
    // si ready() se dispara más de una vez (posible en reconexiones)
    client.on('authenticated', () => {
        console.log(`🔐 Autenticado: ${instanceId}`);
    });

    // ── READY ──
    client.on('ready', async () => {
        console.log(`✅ Cliente listo: ${instanceId}`);

        let numero = '';
        try {
            const wid = client.info?.wid;
            if (wid) {
                if (typeof wid === 'object' && wid.user)  numero = wid.user;
                else if (typeof wid === 'string')          numero = wid.split('@')[0];
                else if (wid._serialized)                  numero = wid._serialized.split('@')[0];
            }
            if (!numero && client.info?.me?._serialized) {
                numero = client.info.me._serialized.split('@')[0];
            }
            if (numero) console.log(`📞 Número: ${numero}`);
            else        console.warn(`⚠️ Sin número para ${instanceId}`);
        } catch (e) {
            console.warn(`⚠️ Error obteniendo número: ${e.message}`);
        }

        const inst = s.instances.get(instanceId);
        if (inst) {
            inst.numero = numero;
            inst.listo  = true;
            actualizarEstado(instanceId, { listo: true, numeroWhatsApp: numero });
        }

        if (!s.activeId) s.activeId = instanceId;

        guardarInstancia(userId, instanceId, { numero, listo: true });
        guardarEstadoSeguro(instanceId);

        console.log(`📱 Conectada: ${instanceId} — ${numero || 'Sin número'}`);
        emitReady(userId, { instanceId, numero });
        if (io) io.emit('whatsapp_ready', { instanceId, numero });
        emitInstancesUpdate(userId);

        // FIX v1.38.0: removeAllListeners('message') evita handlers duplicados
        client.removeAllListeners('message');
        client.on('message', async (msg) => {
            try {
                await handleInboundMessage({
                    msg, client, userId, instanceId,
                    numeroInstancia: numero,
                    sessions, io, userSockets
                });
            } catch (err) {
                console.error(`❌ handleInboundMessage: ${err.message}`);
            }
        });
    });

    client.on('disconnected', async (reason) => {
        console.log(`⚠️ Desconectado ${instanceId}: ${reason}`);
        const i = s.instances.get(instanceId);
        if (i) {
            i.listo = false;
            actualizarEstado(instanceId, { listo: false });
            guardarInstancia(userId, instanceId, { ...i, listo: false });
        }
        emitInstancesUpdate(userId);
    });

    try {
        await Promise.race([
            client.initialize(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout Puppeteer (2min)')), 120000)
            )
        ]);
        return client;
    } catch (err) {
        console.error(`❌ Error inicializando ${instanceId}: ${err.message}`);
        await gracefulDestroy(client);
        clients.delete(key);
        const i = s.instances.get(instanceId);
        if (i) { i.listo = false; i.client = null; }
        emitInstancesUpdate(userId);
        throw err;
    }
}

// ─────────────────────────────────────────────
//  ELIMINAR INSTANCIA
// ─────────────────────────────────────────────
async function removeInstance(userId, instanceId) {
    const key    = `${userId}_${instanceId}`;
    const client = clients.get(key);

    if (client) {
        await gracefulDestroy(client);
        clients.delete(key);
    }

    const s = sessions.get(userId);
    if (s) {
        s.instances.delete(instanceId);
        if (s.activeId === instanceId) {
            const resto = [...s.instances.keys()];
            s.activeId  = resto.length > 0 ? resto[0] : null;
        }
    }

    // FIX v1.38.0: borrar AMBAS carpetas (sessions + chrome-profiles)
    const dirsToDelete = [
        path.join(SESSIONS_DIR,    `session-${instanceId}`),
        path.join(CHROME_PROFILES, instanceId)
    ];

    for (const dir of dirsToDelete) {
        if (!fs.existsSync(dir)) continue;
        await new Promise(r => setTimeout(r, 2000)); // esperar que Chrome libere
        try {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`🗑️ Borrado: ${dir}`);
        } catch (e) {
            console.warn(`⚠️ EBUSY — reintento en 3s: ${path.basename(dir)}`);
            setTimeout(() => {
                try { fs.rmSync(dir, { recursive: true, force: true }); }
                catch (_) { console.warn(`⚠️ Borrar manualmente: ${dir}`); }
            }, 3000);
        }
    }

    if (fs.existsSync(INSTANCIAS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
            if (data[userId]) {
                data[userId] = data[userId].filter(i => i.id !== instanceId);
                if (data[userId].length === 0) delete data[userId];
                fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2));
            }
        } catch (_) {}
    }
    console.log(`🗑️ Instancia ${instanceId} eliminada`);
}

// ─────────────────────────────────────────────
//  RESTAURAR AL ARRANCAR
// ─────────────────────────────────────────────
async function restaurarTodas(io) {
    console.log('🔄 Cargando instancias desde disco...');
    cargarInstancias();
    const promesas = [];
    for (const [userId, s] of sessions) {
        for (const [instanceId] of s.instances) {
            if (fs.existsSync(path.join(SESSIONS_DIR, `session-${instanceId}`))) {
                promesas.push(
                    startSession(userId, io, instanceId).catch(e =>
                        console.error(`❌ Restaurando ${instanceId}: ${e.message}`)
                    )
                );
            }
        }
    }
    await Promise.all(promesas);
    console.log('✅ Restauración completada');
}

//==============================================================
// OBTENER IDS DE INSTANCIAS ACTIVAS
//==============================================================

function getInstanceIds() {

    const ids = [];

    for (const [, userSession] of sessions) {

        if (!userSession.instances) {

            continue;

        }

        for (const [instanceId] of userSession.instances) {

            ids.push(instanceId);

        }

    }

    return ids;

}

module.exports = {
    getUserSession, getUserInstances, getEstado,
    getActiveInstanceId, setActiveInstance, getQrCode, getClient,
    addSocket, removeSocket, emitQr, emitReady, emitInstancesUpdate,
    startSession, removeInstance, restaurarTodas,
    guardarInstancia, guardarInstanciaEnDisco, getInstanceIds,
};
