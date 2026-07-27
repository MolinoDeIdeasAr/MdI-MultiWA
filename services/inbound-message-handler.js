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

        const contacto = resolverContacto(

            msg.from,

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

        actualizarEstado(

            instanceId,

            {

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

            io.emit(

                'estado_actualizado',

                {

                    instanceId,

                    estado:

                        getEstadoInstancia(

                            instanceId

                        )

                }

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