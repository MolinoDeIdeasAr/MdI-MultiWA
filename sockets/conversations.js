'use strict';
const sessionManager = require('../services/session-manager');

function salaDe(userId) {
    return `user_${userId}`;
}

function setupSockets(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket conectado: ${socket.id}`);

        socket.on('join', (userId) => {
            if (!userId) return;
            socket.userId = userId;
            socket.join(salaDe(userId));
            console.log(`👤 [${userId.slice(-6)}] → socket ${socket.id} (Sala: ${salaDe(userId)})`);
            sessionManager.registerSocket(userId, socket.id);
            
            const instancias = sessionManager.getUserInstancesResumen(userId);
            socket.emit('instances_update', { instancias });
            socket.emit('qr_waiting', { message: 'Esperando QR del servidor...' });
        });

        // ✅ FIX: Ahora sí obtiene el QR pendiente y lo envía
        socket.on('request_qr', (instanceId) => {
            const uid = socket.userId;
            if (!uid || !instanceId) return;
            
            console.log(`📤 QR manual solicitado para instancia: ${instanceId}`);
            const qr = sessionManager.getPendingQr(instanceId);
            
            if (qr) {
                console.log(`✅ Enviando QR pendiente a ${socket.id}`);
                socket.emit('qr', { instanceId, qr });
            } else {
                socket.emit('qr_waiting', {
                    message: 'El QR se generará automáticamente. Si no aparece, reintentá en unos segundos.'
                });
            }
        });

        socket.on('reconnect_state', (userId) => {
            const uid = userId || socket.userId;
            if (!uid) return;
            socket.emit('instances_update', { instancias: sessionManager.getUserInstancesResumen(uid) });
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket desconectado: ${socket.id} — ${reason}`);
            if (socket.userId) sessionManager.unregisterSocket(socket.userId, socket.id);
        });

        socket.on('error', (err) => console.error(`❌ Error socket ${socket.id}:`, err));
    });
}

module.exports = { setupSockets, salaDe };