'use strict';

const crm = require('./crm-manager');

class CRMFlow {

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
        if (context.nombre && context.nombre !== 'Desconocido') {
            crm.actualizarDatos(context.numero, {
                nombre: context.nombre,
                empresa: context.empresa,
                ultimaActividad: new Date().toISOString()
            });
        }

        //--------------------------------------------------
        // Campaña + Tipo de campaña (NUEVO)
        //--------------------------------------------------
        if (context.campania) {
            crm.cambiarCampania(context.numero, context.campania);
        }

        // Guardar tipo de campaña en CRM si existe
        if (context.tipoCampana) {
            crm.actualizarDatos(context.numero, {
                tipoCampana: context.tipoCampana
            });
        }

        //--------------------------------------------------
        // Conversación recibida
        //--------------------------------------------------
        crm.agregarConversacion(context.numero, {
            direccion: 'IN',
            autor: 'CLIENTE',
            tipo: context.tipoMensaje,
            mensaje: context.texto,
            instanceId: context.instanceId,
            campaignId: context.campania,
            tipoCampana: context.tipoCampana || '',
            chatId: context.chatId,
            messageId: context.messageId,
            fecha: context.fecha
        });

        //--------------------------------------------------
        // Evento
        //--------------------------------------------------
        crm.agregarEvento(context.numero, {
            tipo: 'MENSAJE_RECIBIDO',
            descripcion: 'Mensaje recibido.',
            fecha: new Date().toISOString()
        });
    }

    registrarRespuestaIA(context) {
        if (!context.respuestaIA) return;

        crm.agregarConversacion(context.numero, {
            direccion: 'OUT',
            autor: 'IA',
            tipo: 'texto',
            mensaje: context.respuestaIA,
            estadoIA: context.estadoIA,
            intencionIA: context.intencionIA,
            instanceId: context.instanceId,
            campaignId: context.campania,
            tipoCampana: context.tipoCampana || '',
            chatId: context.chatId,
            fecha: new Date()
        });

        crm.agregarEvento(context.numero, {
            tipo: 'IA_RESPONDIO',
            descripcion: 'Respuesta automática enviada.',
            fecha: new Date().toISOString()
        });

        crm.actualizarDatos(context.numero, {
            ultimaActividad: new Date().toISOString(),
            ultimoEstado: context.estadoIA,
            ultimaIntencion: context.intencionIA
        });
    }

    registrarBaja(context) {
        crm.actualizarDatos(context.numero, {
            estado: 'BAJA',
            fechaBaja: new Date().toISOString()
        });

        crm.agregarEvento(context.numero, {
            tipo: 'CLIENTE_BAJA',
            descripcion: 'Cliente dado de baja automáticamente.',
            fecha: new Date().toISOString()
        });
    }

    registrarNotificacion(context) {
        crm.agregarEvento(context.numero, {
            tipo: 'NOTIFICACION',
            descripcion: `Se notificó al asesor. Campaña: ${context.tipoCampana || context.campania || 'General'}`,
            fecha: new Date().toISOString()
        });
    }
}

module.exports = new CRMFlow();