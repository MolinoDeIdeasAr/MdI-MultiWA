'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/socket-notifier.js
 *
 * v1.0.0
 *
 * Centraliza todas las emisiones por Socket.IO.
 *
 * Reemplaza las 4 funciones emitQr/emitReady/emitInstancesUpdate
 * (cada una definida DOS VECES, silenciosamente pisadas) que
 * vivían sueltas dentro de session-manager.js.
 *
 * Usa salas por usuario (user_${userId}) — la misma convención
 * que ya define sockets/conversations.js — así el evento le
 * llega a TODAS las pestañas/dispositivos abiertos de ese
 * usuario, no solo al último socket registrado (que era el
 * comportamiento anterior con el Map userSockets de un solo
 * socket por usuario).
 *
 * Nombres de evento: se mantienen los que ya usaba el proyecto
 * ('qr', 'whatsapp_ready') más 'instances_update' (así, sin "d"
 * final — es el que ya emite sockets/conversations.js al
 * conectar/reconectar; session-manager.js emitía antes
 * 'instances_updated' con "d", inconsistencia que se unifica
 * acá). Si el frontend (qr.ejs/index.ejs) escuchaba la variante
 * con "d", hay que revisar esos templates.
 * =============================================================
 */

function salaDe(userId) {

    return `user_${userId}`;

}

function emitQr(io, userId, payload) {

    if (!io)
        return;

    io.to(

        salaDe(userId)

    ).emit(

        'qr',

        payload

    );

}

function emitReady(io, userId, payload) {

    if (!io)
        return;

    io.to(

        salaDe(userId)

    ).emit(

        'whatsapp_ready',

        payload

    );

}

function emitDisconnected(io, userId, instanceId) {

    if (!io)
        return;

    io.to(

        salaDe(userId)

    ).emit(

        'whatsapp_disconnected',

        { instanceId }

    );

}

function emitInstancesUpdate(io, userId, instancias) {

    if (!io)
        return;

    io.to(

        salaDe(userId)

    ).emit(

        'instances_update',

        { instancias }

    );

}

function emitEstadoActualizado(io, userId, instanceId, estado) {

    if (!io)
        return;

    io.to(

        salaDe(userId)

    ).emit(

        'estado_actualizado',

        { instanceId, estado }

    );

}

//==============================================================
// Nueva conversación / respuesta entrante
// (esto era lo que faltaba: inbound-message-handler.js nunca
// emitía nada con este nombre, y conversaciones.ejs escucha
// exactamente 'nueva_respuesta')
//==============================================================

function emitNuevaConversacion(io, userId, conv) {

    if (!io)
        return;

    io.to(

        salaDe(userId)

    ).emit(

        'nueva_respuesta',

        conv

    );

}

module.exports = {

    salaDe,
    emitQr,
    emitReady,
    emitDisconnected,
    emitInstancesUpdate,
    emitEstadoActualizado,
    emitNuevaConversacion

};
