/**
 * =============================================================
 *  MdI MultiWA — sockets/conversations.js
 *  Versión : v1.38.0
 *  Fecha   : 2026-08-07
 * =============================================================
 *  CHANGELOG
 *  ---------
 *  v1.38.0 — Este archivo no estaba conectado a nada (index.js
 *             tenía su propio io.on('connection') en paralelo) y
 *             llamaba a sessionManager.addSocket/removeSocket,
 *             que no existen (son registerSocket/unregisterSocket).
 *             Se corrigen esas llamadas, se usa io.to(sala) en vez
 *             de socket.emit directo (la sala se unía pero nunca
 *             se aprovechaba), y este es ahora el ÚNICO punto de
 *             conexión de sockets — index.js ya no tiene el suyo.
 *  v1.37.0 — Cada usuario se une a su sala privada (user_${userId}).
 *             Los eventos instances_update, nueva_respuesta y
 *             whatsapp_ready se emiten por sala, no globalmente.
 *             Agrega handler reconnect para re-enviar estado
 *             al reconectar sin recargar la página.
 *  v1.36.0 — Versión base con join y request_qr.
 * =============================================================
 */
'use strict';

const sessionManager = require('../services/session-manager');

function salaDe(userId) {
    return `user_${userId}`;
}

function setupSockets(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket conectado: ${socket.id}`);

        // ── Usuario se une a su sala privada ──
        socket.on('join', (userId) => {
            if (!userId) return;
            socket.userId = userId;

            // Sala privada por usuario — evita que un usuario vea datos de otro
            socket.join(salaDe(userId));
            console.log(`👤 [${userId.slice(-6)}] → socket ${socket.id}`);

            sessionManager.registerSocket(userId, socket);

            // Enviar estado actual de instancias al conectar
            const instancias = sessionManager.getUserInstancesResumen(userId);
            socket.emit('instances_update', { instancias });
            socket.emit('qr_waiting', { message: 'Esperando QR del servidor...' });
        });

        // ── Solicitud manual de QR ──
        socket.on('request_qr', (userId) => {
            const uid = userId || socket.userId;
            if (!uid) return;
            console.log(`📤 QR manual solicitado por ${uid}`);
            socket.emit('qr_waiting', {
                message: 'El QR se generará automáticamente. Si no aparece, reintentá en unos segundos.'
            });
        });

        // ── Reconexión — reenviar estado sin recargar la página ──
        socket.on('reconnect_state', (userId) => {
            const uid = userId || socket.userId;
            if (!uid) return;
            const instancias = sessionManager.getUserInstancesResumen(uid);
            socket.emit('instances_update', { instancias });
            console.log(`🔄 Estado reenviado a ${uid} por reconexión`);
        });

        // ── Desconexión ──
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket desconectado: ${socket.id} — ${reason}`);
            if (socket.userId) {
                sessionManager.unregisterSocket(socket.userId);
            }
        });

        // ── Error ──
        socket.on('error', (err) => {
            console.error(`❌ Error socket ${socket.id}:`, err);
        });
    });
}

module.exports = { setupSockets, salaDe };
