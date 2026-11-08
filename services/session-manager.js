'use strict';
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, isJidBroadcast, isJidStatusBroadcast } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { handleInboundMessage } = require('./inbound-message-handler');
const { extraerTextoMensaje } = require('./conversation-context');

// ✅ IMPORTACIONES CRÍTICAS
const { guardarInstancia, eliminarInstancia } = require('./instancias-persistencia');
const { getEstadoInstancia, guardarEstadoSeguro } = require('../state/estado');
const { resolverContacto } = require('./contact-resolver');

const BAILEYS_SESSIONS_DIR = path.join(__dirname, '..', 'baileys_sessions');
if (!fs.existsSync(BAILEYS_SESSIONS_DIR)) fs.mkdirSync(BAILEYS_SESSIONS_DIR, { recursive: true });

const instances = {};
const userSockets = new Map();
const activeInstances = new Map();
let io = null;

function setIO(socketIO) { io = socketIO; }

function emitToUser(userId, event, data) {
    if (!io) return;
    const uid = String(userId);
    const payload = data || {};
    const rooms = [`user_${uid}`, uid];
    if (payload.instanceId) rooms.push(String(payload.instanceId), `user_${payload.instanceId}`);
    const seen = new Set();
    for (const room of rooms) {
        if (seen.has(room)) continue;
        seen.add(room);
        io.to(room).emit(event, payload);
    }
}

function registerSocket(userId, socketId) {
    const uid = String(userId);
    if (!userSockets.has(uid)) userSockets.set(uid, new Set());
    userSockets.get(uid).add(socketId);
}

function unregisterSocket(userId, socketId) {
    const uid = String(userId);
    if (userSockets.has(uid)) {
        userSockets.get(uid).delete(socketId);
        if (userSockets.get(uid).size === 0) userSockets.delete(uid);
    }
}

function setActiveInstance(userId, instanceId) { activeInstances.set(String(userId), instanceId); }
function getActiveInstance(userId) { return activeInstances.get(String(userId)) || null; }

function getInstanceDir(instanceId) {
    const dir = path.join(BAILEYS_SESSIONS_DIR, instanceId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function parsePhoneNumberFromJid(jid) {
    if (!jid) return null;
    const match = jid.match(/^(\d+):?/);
    return match ? match[1] : null;
}

function extractUserId(userIdInput) {
    if (typeof userIdInput === 'object' && userIdInput !== null) {
        const id = userIdInput.id || userIdInput._id || userIdInput.userId || userIdInput.numero;
        if (id) return String(id);
    }
    return String(userIdInput || 'unknown');
}

function normalizarNumero(num) {
    if (!num) return '';
    let n = String(num).replace(/\D/g, '');
    if (n.startsWith('549')) n = n.substring(3);
    else if (n.startsWith('54')) n = n.substring(2);
    else if (n.startsWith('0')) n = n.substring(1);
    return n;
}

async function startSession(instanceId, userIdInput) {
    const userId = extractUserId(userIdInput);
    console.log(`\n================================\nCREANDO INSTANCIA BAILYS\nUsuario: ${userId}\nInstancia: ${instanceId}\n================================`);
    
    if (instances[instanceId]) {
        console.log(`⚠️ Instancia ${instanceId} ya existe. Desconectando...`);
        await disconnectSession(instanceId);
    }

    const authDir = getInstanceDir(instanceId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    let version;
    try { version = (await fetchLatestBaileysVersion()).version; } 
    catch (err) { version = [2, 3000, 1015901307]; }

    const sock = makeWASocket({
        auth: state, version, logger: pino({ level: 'silent' }),
        browser: ['MdI MultiWA', 'Chrome', '120.0.0.0'],
        generateHighQualityLinkPreview: false, syncFullHistory: false, markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);
    instances[instanceId] = { sock, userId, qr: null, ready: false, phoneNumber: null, reconnectAttempts: 0 };

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (!instances[instanceId]) return;

        if (qr) {
            instances[instanceId].qr = qr;
            instances[instanceId].ready = false;
            emitToUser(userId, 'qr', { instanceId, qr });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom)?.output?.statusCode;
            const reason = lastDisconnect?.error?.output?.payload?.message || 'Desconocido';
            console.log(`❌ Conexión cerrada: ${reason} (${statusCode})`);
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                try { fs.rmSync(authDir, { recursive: true, force: true }); } catch (e) {}
                eliminarInstancia(userId, instanceId);
                instances[instanceId].ready = false;
                instances[instanceId].qr = null;
                emitToUser(userId, 'disconnected', { instanceId, reason: 'logged_out' });
                emitToUser(userId, 'whatsapp_disconnected', { instanceId, reason: 'logged_out' });
                emitToUser(userId, 'instances_update', { instanceId, instancias: getUserInstancesResumen(userId) });
                delete instances[instanceId];
                return;
            }

            instances[instanceId].ready = false;
            instances[instanceId].reconnectAttempts++;
            if (instances[instanceId].reconnectAttempts < 10) {
                const delay = Math.min(5000 * instances[instanceId].reconnectAttempts, 60000);
                setTimeout(() => { if (instances[instanceId]) startSession(instanceId, userId); }, delay);
            }
        }

        if (connection === 'open') {
            const phoneNumber = parsePhoneNumberFromJid(sock.user?.id);
            instances[instanceId].ready = true;
            instances[instanceId].qr = null;
            instances[instanceId].phoneNumber = phoneNumber;
            instances[instanceId].reconnectAttempts = 0;
            console.log(`\n✅ WHATSAPP READY\nNúmero: ${phoneNumber}\n`);
            guardarInstancia(userId, instanceId, {
                numero: phoneNumber,
                listo: true,
                fechaCreacion: new Date().toISOString()
            });
            emitToUser(userId, 'ready', { instanceId, phoneNumber, numero: phoneNumber });
            emitToUser(userId, 'whatsapp_ready', { instanceId, phoneNumber, numero: phoneNumber });
            emitToUser(userId, 'instances_update', { instanceId, instancias: getUserInstancesResumen(userId) });
        }
    });

    // ✅ MANEJO DE MENSAJES ENTRANTES (Delegado al pipeline completo)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe || msg.message.protocolMessage) return;

        const rawFrom = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
        
        try {
            console.log(`💬 Mensaje recibido de ${rawFrom}: "${String(text || '').substring(0, 50)}"`);
            emitToUser(userId, 'message_received', { instanceId, from: rawFrom, text, timestamp: msg.messageTimestamp });

            // Delegar al pipeline central (Contact Resolver con soporte @lid, CRM, IA/Reglas, Sockets, Notificación)
            await handleInboundMessage({
                msg,
                client: sock,
                userId,
                instanceId,
                numeroInstancia: instances[instanceId] && instances[instanceId].phoneNumber,
                sessions: null,
                io
            });
        } catch (error) {
            console.error('❌ Error crítico procesando mensaje entrante:', error);
        }
    });

    return sock;
}

async function disconnectSession(instanceId) {
    const inst = instances[instanceId];
    if (!inst) return;
    console.log(`🔧 Desconectando ${instanceId}...`);
    try {
        if (inst.sock && typeof inst.sock.logout === 'function') await inst.sock.logout();
        else if (inst.sock && typeof inst.sock.end === 'function') await inst.sock.end(new Error('Manual'));
    } catch (err) { console.log(`⚠️ Error al cerrar socket ${instanceId}: ${err.message}`); }
    delete instances[instanceId];
    console.log(`✅ Desconexión completada: ${instanceId}`);
}

async function disconnectAll() {
    for (const id of Object.keys(instances)) { try { await disconnectSession(id); } catch (err) {} }
}

function getClient(instanceId) { return instances[instanceId]?.sock || null; }
function isInstanceReady(instanceId) { return instances[instanceId]?.ready === true; }
function getInstancePhone(instanceId) { return instances[instanceId]?.phoneNumber || null; }
function getAllInstances() { return Object.keys(instances).map(id => ({ instanceId: id, userId: instances[id].userId, ready: instances[id].ready, phoneNumber: instances[id].phoneNumber, hasQr: !!instances[id].qr })); }
function getUserInstances(userId) { const uid = String(userId); return Object.keys(instances).filter(id => instances[id].userId === uid).map(id => ({ instanceId: id, userId: instances[id].userId, ready: instances[id].ready, phoneNumber: instances[id].phoneNumber, hasQr: !!instances[id].qr })); }
function getUserInstancesResumen(userId) { const uid = String(userId); return Object.keys(instances).filter(id => instances[id].userId === uid).map(id => ({ instanceId: id, ready: instances[id].ready, phoneNumber: instances[id].phoneNumber, hasQr: !!instances[id].qr })); }
function getActiveInstanceId(userId) { return getActiveInstance(userId); }
function getEstado(instanceId) { const inst = instances[instanceId]; if (!inst) return { ready: false, hasQr: false, phoneNumber: null, instanceId }; return { ready: inst.ready, hasQr: !!inst.qr, phoneNumber: inst.phoneNumber, instanceId, userId: inst.userId }; }
function getPendingQr(instanceId) { return instances[instanceId]?.qr || null; }

async function restoreAllSessions() {
    console.log(`🔄 Restaurando sesiones Baileys...`);
    const INSTANCIAS_FILE = path.join(__dirname, '..', 'data', 'instancias.json');
    const SESSIONS_DIR = path.join(__dirname, '..', 'baileys_sessions');

    try {
        let data = {};
        if (fs.existsSync(INSTANCIAS_FILE)) {
            try {
                data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
            } catch (_) { data = {}; }
        }

        // Auto-recuperación si instancias.json está vacío pero hay sesiones con creds.json
        if (Object.keys(data).length === 0 && fs.existsSync(SESSIONS_DIR)) {
            const carpetas = fs.readdirSync(SESSIONS_DIR).filter(f => {
                const p = path.join(SESSIONS_DIR, f);
                return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'creds.json'));
            });
            for (const carpeta of carpetas) {
                const match = carpeta.match(/^inst_([^_]+)_/);
                const uid = match ? match[1] : '1788780543868';
                if (!data[uid]) data[uid] = [];
                data[uid].push({ id: carpeta, listo: true, fechaCreacion: new Date().toISOString() });
            }
            if (Object.keys(data).length > 0) {
                try { fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2)); } catch (_) {}
            }
        }

        let instanciasLimpias = 0;
        let instanciasRestauradas = 0;

        for (const userId of Object.keys(data)) {
            const instanciasUsuario = data[userId] || [];
            const instanciasValidas = [];

            for (const inst of instanciasUsuario) {
                const instanceId = inst.id || inst.instanceId;
                const sessionPath = path.join(SESSIONS_DIR, instanceId);

                if (!fs.existsSync(sessionPath)) {
                    console.log(`🗑️ Instancia fantasma detectada y eliminada: ${instanceId}`);
                    instanciasLimpias++;
                    continue;
                }

                const archivosAuth = fs.readdirSync(sessionPath).filter(f => f.includes('app-state') || f.includes('session') || f.includes('creds'));
                if (archivosAuth.length === 0) {
                    console.log(`🗑️ Instancia corrupta eliminada: ${instanceId}`);
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    instanciasLimpias++;
                    continue;
                }

                instanciasValidas.push(inst);
                instanciasRestauradas++;
                try {
                    // Argumentos corregidos: instanceId primero, userId segundo
                    await startSession(instanceId, userId);
                    console.log(`✅ Sesión restaurada: ${instanceId}`);
                } catch (err) {
                    console.error(`❌ Error restaurando ${instanceId}:`, err.message);
                }
            }

            if (instanciasValidas.length > 0) {
                data[userId] = instanciasValidas;
            } else {
                delete data[userId];
            }
        }

        fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Restauración completada: ${instanciasRestauradas} activas, ${instanciasLimpias} eliminadas automáticamente`);
    } catch (error) {
        console.error('❌ Error restaurando sesiones:', error);
    }
}

module.exports = { setIO, startSession, disconnectSession, disconnectAll, getClient, isInstanceReady, getInstancePhone, getAllInstances, getUserInstances, getUserInstancesResumen, getActiveInstanceId, getActiveInstance, setActiveInstance, getEstado, getPendingQr, restoreAllSessions, registerSocket, unregisterSocket };