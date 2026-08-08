'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const ConversationContext = require('./conversation-context');

const {

    resolverContacto

} = require('./contact-resolver');

const crmFlow = require('./crm-flow');

const aiFlow = require('./ai-flow');

const logger = require('../core/logger/logger');

const {

    actualizarEstado,

    getEstadoInstancia

} = require('../state/estado');

const socketNotifier =
    require('./socket-notifier');

// v1.1.0
//
// CHANGELOG v1.1.0:
//  • FIX CRÍTICO: nunca se escribía en estado.conversaciones —
//    la pantalla /conversaciones estaba condenada a mostrarse
//    vacía para siempre, sin importar cuántos mensajes llegaran.
//    Ahora cada mensaje entrante se agrega al array (requiere
//    state/estado.js v3.1.0+, que cambia conversaciones de {} a []).
//  • FIX: el broadcast por socket usaba io.emit() global — le
//    llegaba a TODOS los usuarios conectados, no solo al dueño
//    de la instancia (fuga de datos entre cuentas). Ahora usa
//    socketNotifier, que emite solo a la sala del usuario
//    (user_${userId}).
//  • FIX: se emite 'nueva_respuesta' (lo que escucha
//    conversaciones.ejs) además de 'estado_actualizado' — antes
//    no se emitía nada con ese nombre.

//==============================================================
// HANDLER PRINCIPAL
//==============================================================

async function handleInboundMessage({

    msg,

    client,

    userId,

    instanceId,

    numeroInstancia,

    sessions,

    io,

    userSockets

}) {

    try {

        //------------------------------------------------------
        // VALIDACIONES
        //------------------------------------------------------

        if (!msg)
            return;

        if (msg.fromMe)
            return;

        if (

            msg.type &&

            msg.type !== 'chat'

        ) {

            logger.debug(

                `Mensaje ignorado (${msg.type})`

            );

            return;

        }

        //------------------------------------------------------
        // ESTADO DE LA INSTANCIA
        //------------------------------------------------------

        const estado = getEstadoInstancia(

            instanceId

        );

        if (!estado) {

            logger.warn(

                `Estado inexistente (${instanceId})`

            );

            return;

        }

        //------------------------------------------------------
        // CONTACTO
        //------------------------------------------------------

        const contacto = await resolverContacto(

            msg,

            estado.contactosCargados || []

        );

        //------------------------------------------------------
        // CONTEXTO
        //------------------------------------------------------

        const context = new ConversationContext({

            msg,

            client,

            userId,

            instanceId,

            numeroInstancia,

            estado

        });

        context

            .setContacto(

                contacto

            )

            .setCampania(

                estado.campania ||

                estado.nombreCampania ||

                ''

            );

        logger.whatsapp(

            `${context.nombre} (${context.numero})`

        );

        //------------------------------------------------------
        // CRM
        //------------------------------------------------------

        crmFlow.procesarMensajeEntrante(

            context

        );

        //------------------------------------------------------
        // IA
        //------------------------------------------------------

        await aiFlow.procesar(

            context

        );

        //------------------------------------------------------
        // ACTUALIZAR ESTADO TEMPORAL
        //------------------------------------------------------

        if (

            !Array.isArray(estado.conversaciones)

        ) {

            estado.conversaciones = [];

        }

        const conv = {

            id:

                `${instanceId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,

            nombre:

                context.nombre,

            numero:

                context.numero,

            origenNumero:

                numeroInstancia || '',

            fecha:

                context.fecha.toLocaleString('es-AR'),

            mensaje:

                context.texto,

            estado:

                context.estadoIA || 'pendiente',

            respuesta:

                context.respuestaIA || ''

        };

        estado.conversaciones.unshift(

            conv

        );

        actualizarEstado(

            instanceId,

            {

                conversaciones:

                    estado.conversaciones,

                ultimoMensaje:

                    context.texto,

                ultimoContacto:

                    context.nombre,

                ultimoNumero:

                    context.numero,

                ultimoEstadoIA:

                    context.estadoIA,

                ultimaIntencionIA:

                    context.intencionIA,

                ultimaActividad:

                    new Date().toISOString()

            }

        );

        logger.state(

            `Estado actualizado (${instanceId})`

        );

        //------------------------------------------------------
        // NOTIFICAR AL ASESOR
        //------------------------------------------------------

        if (

            context.debeNotificarAsesor

        ) {

            crmFlow.registrarNotificacion(

                context

            );

            logger.crm(

                `Notificación generada para ${context.nombre}`

            );

        }

        //------------------------------------------------------
        // SINCRONIZAR SESIÓN
        //------------------------------------------------------

        if (

            sessions &&

            sessions.has(userId)

        ) {

            const session =

                sessions.get(

                    userId

                );

            const instancia =

                session.instances.get(

                    instanceId

                );

            if (

                instancia

            ) {

                instancia.estado =

                    getEstadoInstancia(

                        instanceId

                    );

            }

        }

        //------------------------------------------------------
        // SOCKETS
        //------------------------------------------------------

        if (

            io

        ) {

            socketNotifier.emitEstadoActualizado(

                io,

                userId,

                instanceId,

                getEstadoInstancia(

                    instanceId

                )

            );

            socketNotifier.emitNuevaConversacion(

                io,

                userId,

                conv

            );

        }

    }

    //----------------------------------------------------------
    // ERROR GENERAL
    //----------------------------------------------------------

    catch (err) {

        logger.error(

            'Error en inbound-message-handler',

            err

        );

    }

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    handleInboundMessage

};