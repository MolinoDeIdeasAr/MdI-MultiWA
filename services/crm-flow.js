'use strict';

const crm = require('./crm-manager');

class CRMFlow {

    /**
     * Procesa un mensaje recibido.
     */
    procesarMensajeEntrante(context) {

        const cliente = crm.obtenerOCrearCliente({

            numero: context.numero,

            nombre: context.nombre,

            empresa: context.empresa

        });

        context.clienteCRM = cliente;

        //--------------------------------------------------
        // Actualizar nombre si era desconocido
        //--------------------------------------------------

        if (
            context.nombre &&
            context.nombre !== 'Desconocido'
        ) {

            crm.actualizarDatos(context.numero, {

                nombre: context.nombre,

                empresa: context.empresa,

                ultimaActividad: new Date().toISOString()

            });

        }

        //--------------------------------------------------
        // Campaña
        //--------------------------------------------------

        if (context.campania) {

            crm.cambiarCampania(

                context.numero,

                context.campania

            );

        }

        //--------------------------------------------------
        // Conversación recibida
        //--------------------------------------------------

        crm.agregarConversacion(

            context.numero,

            {

                direccion: 'IN',

                autor: 'CLIENTE',

                tipo: context.tipoMensaje,

                mensaje: context.texto,

                instanceId: context.instanceId,

                campaignId: context.campania,

                chatId: context.chatId,

                messageId: context.messageId,

                fecha: context.fecha

            }

        );

        //--------------------------------------------------
        // Evento
        //--------------------------------------------------

        crm.agregarEvento(

            context.numero,

            {

                tipo: 'MENSAJE_RECIBIDO',

                descripcion: 'Mensaje recibido.',

                fecha: new Date().toISOString()

            }

        );

    }

    /**
     * Guarda una respuesta enviada.
     */
    registrarRespuestaIA(context) {

        if (!context.respuestaIA)
            return;

        crm.agregarConversacion(

            context.numero,

            {

                direccion: 'OUT',

                autor: 'IA',

                tipo: 'texto',

                mensaje: context.respuestaIA,

                estadoIA: context.estadoIA,

                intencionIA: context.intencionIA,

                instanceId: context.instanceId,

                campaignId: context.campania,

                chatId: context.chatId,

                fecha: new Date()

            }

        );

        crm.agregarEvento(

            context.numero,

            {

                tipo: 'IA_RESPONDIO',

                descripcion: 'Respuesta automática enviada.',

                fecha: new Date().toISOString()

            }

        );

        crm.actualizarDatos(

            context.numero,

            {

                ultimaActividad: new Date().toISOString(),

                ultimoEstado: context.estadoIA,

                ultimaIntencion: context.intencionIA

            }

        );

    }

    /**
     * Marca una baja comercial.
     */
    registrarBaja(context) {

        crm.actualizarDatos(

            context.numero,

            {

                estado: 'BAJA',

                fechaBaja: new Date().toISOString()

            }

        );

        crm.agregarEvento(

            context.numero,

            {

                tipo: 'CLIENTE_BAJA',

                descripcion: 'Cliente dado de baja automáticamente.',

                fecha: new Date().toISOString()

            }

        );

    }

    /**
     * Registra una notificación al asesor.
     */
    registrarNotificacion(context) {

        crm.agregarEvento(

            context.numero,

            {

                tipo: 'NOTIFICACION',

                descripcion: 'Se notificó al asesor.',

                fecha: new Date().toISOString()

            }

        );

    }

}

module.exports = new CRMFlow();