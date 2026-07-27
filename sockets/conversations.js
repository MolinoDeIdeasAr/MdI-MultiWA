/**
 * =============================================================
 *  MdI MultiWA — sockets/conversations.js
 *  Versión : v1.37.0
 *  Fecha   : 2026-07-04
 * =============================================================
 *  CHANGELOG
 *  ---------
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

function setupSockets(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket conectado: ${socket.id}`);

        // ── Usuario se une a su sala privada ──
        socket.on('join', (userId) => {
            if (!userId) return;
            socket.userId = userId;

            // Sala privada por usuario — evita que un usuario vea datos de otro
            socket.join(`user_${userId}`);
            console.log(`👤 [${userId.slice(-6)}] → socket ${socket.id}`);

            sessionManager.addSocket(userId, socket);

            // Enviar estado actual de instancias al conectar
            const instancias = sessionManager.getUserInstances(userId);
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
            const instancias = sessionManager.getUserInstances(uid);
            socket.emit('instances_update', { instancias });
            console.log(`🔄 Estado reenviado a ${uid} por reconexión`);
        });

        // ── Desconexión ──
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket desconectado: ${socket.id} — ${reason}`);
            if (socket.userId) {
                sessionManager.removeSocket(socket.userId, socket);
            }
        });

        // ── Error ──
        socket.on('error', (err) => {
            console.error(`❌ Error socket ${socket.id}:`, err);
        });
    });
}

module.exports = { setupSockets };
