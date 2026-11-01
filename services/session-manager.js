'use strict';
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, isJidBroadcast, isJidStatusBroadcast } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
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
    io.to(uid).emit(event, data);
    if (uid === '1788780543868') io.to('543868').emit(event, data);
    if (data && data.instanceId) io.to(data.instanceId).emit(event, data);
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

// ✅ FUNCIÓN CRÍTICA: Normaliza cualquier número a su forma base (sin 54, 9, 0, ni espacios)
function normalizarNumero(num) {
    if (!num) return '';
    let n = String(num).replace(/\D/g, ''); // Solo dígitos
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
                instances[instanceId].ready = false;
                instances[instanceId].qr = null;
                emitToUser(userId, 'disconnected', { instanceId, reason: 'logged_out' });
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
            emitToUser(userId, 'ready', { instanceId, phoneNumber });
        }
    });

    // ✅ MANEJO DE MENSAJES ENTRANTES Y RESPUESTA A INFO
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe || msg.message.protocolMessage) return;

        try {
            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
            const textoLimpio = text.toLowerCase().trim();

            console.log(`💬 Mensaje recibido de ${from}: "${text.substring(0, 50)}"`);
            emitToUser(userId, 'message_received', { instanceId, from, text, timestamp: msg.messageTimestamp });

            // 1. OBTENER ESTADO DE FORMA SEGURA
            let estado = {};
            try {
                if (typeof getEstadoInstancia === 'function') estado = getEstadoInstancia(instanceId) || {};
                else if (typeof getEstado === 'function') estado = getEstado(instanceId) || {};
            } catch (e) {
                console.warn('⚠️ No se pudo obtener el estado:', e.message);
            }

            // 2. RESOLVER CONTACTO (Usando el módulo blindado, CERO .includes() directos)
            let contacto = { numero: from.split('@')[0].replace(/[^0-9]/g, ''), NOMBRE: 'Cliente', RUBRO: 'Sin rubro' };
            try {
                if (typeof resolverContacto === 'function') {
                    const res = await resolverContacto(msg, estado.contactosCargados || []);
                    if (res && res.numero) contacto = res;
                }
            } catch (e) {
                console.warn('⚠️ Error en resolverContacto:', e.message);
            }

            const numeroReal = contacto.numero;
            const nombreReal = contacto.NOMBRE || 'Cliente';
            const rubroReal = contacto.RUBRO || 'Sin rubro';

            console.log(`✅ Contacto resuelto: ${nombreReal} (${numeroReal})`);

            // 3. DETECCIÓN DE INFO
            const esInfo = textoLimpio === 'info' || textoLimpio === 'info!' || 
                           textoLimpio.includes('quiero info') || textoLimpio.includes('más info') || 
                           textoLimpio.includes('mas info') || textoLimpio.includes('información') || 
                           textoLimpio.includes('informacion');

            if (esInfo) {
                console.log(`🔔 Detectado INFO de ${numeroReal}`);
                
                let respuestaAuto = '';
                if (estado?.respuestasInfoPorTipo && estado.tipoCampana && estado.respuestasInfoPorTipo[estado.tipoCampana]) {
                    respuestaAuto = estado.respuestasInfoPorTipo[estado.tipoCampana];
                } else if (estado?.respuestaInfo) {
                    respuestaAuto = estado.respuestaInfo;
                }

                if (respuestaAuto) {
                    const respuestaFinal = respuestaAuto
                        .replace(/\{\{\s*NOMBRE\s*\}\}/gi, nombreReal)
                        .replace(/\{\s*NOMBRE\s*\}/gi, nombreReal)
                        .replace(/\bNOMBRE\b/gi, nombreReal)
                        .replace(/\{\{\s*RUBRO\s*\}\}/gi, rubroReal)
                        .replace(/\{\s*RUBRO\s*\}/gi, rubroReal)
                        .replace(/\bRUBRO\b/gi, rubroReal);

                    try {
                        await sock.sendPresenceUpdate('composing', from);
                        await new Promise(r => setTimeout(r, 1500));
                        await sock.sendPresenceUpdate('paused', from);
                    } catch (e) { /* ignorar error de presencia */ }

                    await sock.sendMessage(from, { text: respuestaFinal });
                    console.log(`✅ Respuesta enviada a ${numeroReal}`);
                }

                // 4. NOTIFICACIÓN AL ADMIN
                const numeroAdmin = '5493513043371';
                const jidAdmin = `${numeroAdmin}@s.whatsapp.net`;
                const notif = `🔔 *NUEVA RESPUESTA INFO*\n\n👤 *Contacto:* ${nombreReal}\n📞 *Número:* +${numeroReal}\n🏷️ *Rubro:* ${rubroReal}\n💬 *Mensaje:* "${text}"\n⏰ ${new Date().toLocaleString('es-AR')}`;
                
                try {
                    await sock.sendMessage(jidAdmin, { text: notif });
                    console.log(`✅ Notificación enviada al admin`);
                } catch (e) {
                    console.error('❌ Error enviando notificación:', e.message);
                }
            }
        } catch (error) {
            console.error('❌ Error crítico en messages.upsert:', error);
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
    if (!fs.existsSync(BAILEYS_SESSIONS_DIR)) return;
    const folders = fs.readdirSync(BAILEYS_SESSIONS_DIR).filter(f => fs.statSync(path.join(BAILEYS_SESSIONS_DIR, f)).isDirectory());
    for (const folder of folders) {
        const instanceId = folder;
        const authDir = path.join(BAILEYS_SESSIONS_DIR, folder);
        const hasCreds = fs.readdirSync(authDir).some(f => f.includes('creds'));
        if (!hasCreds) continue;
        try {
            const userIdMatch = instanceId.match(/inst_(\d+)_/);
            await startSession(instanceId, userIdMatch ? userIdMatch[1] : 'unknown');
        } catch (err) { console.error(`❌ Error restaurando ${instanceId}:`, err.message); }
    }
}

module.exports = { setIO, startSession, disconnectSession, disconnectAll, getClient, isInstanceReady, getInstancePhone, getAllInstances, getUserInstances, getUserInstancesResumen, getActiveInstanceId, getActiveInstance, setActiveInstance, getEstado, getPendingQr, restoreAllSessions, registerSocket, unregisterSocket };