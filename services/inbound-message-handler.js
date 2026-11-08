'use strict';

const ConversationContext = require('./conversation-context');
const { extraerTextoMensaje, extraerChatId } = ConversationContext;
const { resolverContacto } = require('./contact-resolver');
const crmFlow = require('./crm-flow');
const aiFlow = require('./ai-flow');
const logger = require('../core/logger/logger');
const { actualizarEstado, getEstadoInstancia } = require('../state/estado');
const socketNotifier = require('./socket-notifier');

async function handleInboundMessage({
    msg,
    client,
    userId,
    instanceId,
    numeroInstancia,
    sessions,
    io
}) {
    try {
        if (!msg) return;

        const fromMe = !!(msg.key && msg.key.fromMe) || !!msg.fromMe;
        if (fromMe) return;

        const chatId = extraerChatId(msg);
        if (!chatId) return;
        if (
            chatId.endsWith('@g.us') ||
            chatId.endsWith('@broadcast') ||
            chatId.endsWith('@newsletter') ||
            chatId === 'status@broadcast'
        ) {
            return;
        }

        if (msg.message && msg.message.protocolMessage) return;

        if (msg.type && msg.type !== 'chat' && !(msg.key && msg.key.remoteJid)) {
            logger.debug(`Mensaje ignorado (${msg.type})`);
            return;
        }

        const texto = extraerTextoMensaje(msg);
        if (!texto) return;

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            logger.warn(`Estado inexistente (${instanceId})`);
            return;
        }

        const contacto = await resolverContacto(msg, estado.contactosCargados || [], client);

        const context = new ConversationContext({
            msg,
            client,
            userId,
            instanceId,
            numeroInstancia,
            estado
        });

        context
            .setContacto(contacto)
            .setCampania(estado.campania || estado.nombreCampania || '');

        logger.whatsapp(`${context.nombre} (${context.numero})`);

        crmFlow.procesarMensajeEntrante(context);
        await aiFlow.procesar(context);

        if (!Array.isArray(estado.conversaciones)) {
            estado.conversaciones = [];
        }

        const conv = {
            id: `${instanceId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            nombre: context.nombre,
            numero: context.numero,
            origenNumero: numeroInstancia || '',
            rubro: context.estadoTemporal?.rubro || context.rubro || '',
            fecha: context.fecha.toLocaleString('es-AR'),
            mensaje: context.texto,
            estado: context.estadoIA || 'pendiente',
            respuesta: context.respuestaIA || ''
        };

        estado.conversaciones.unshift(conv);

        actualizarEstado(instanceId, {
            conversaciones: estado.conversaciones,
            ultimoMensaje: context.texto,
            ultimoContacto: context.nombre,
            ultimoNumero: context.numero,
            ultimoEstadoIA: context.estadoIA,
            ultimaIntencionIA: context.intencionIA,
            ultimaActividad: new Date().toISOString()
        });

        if (context.debeNotificarAsesor) {
            crmFlow.registrarNotificacion(context);
            logger.crm(`Notificación generada para ${context.nombre}`);
        }

        if (sessions && sessions.has(userId)) {
            const session = sessions.get(userId);
            const instancia = session.instances && session.instances.get(instanceId);
            if (instancia) {
                instancia.estado = getEstadoInstancia(instanceId);
            }
        }

        if (io) {
            socketNotifier.emitEstadoActualizado(io, userId, instanceId, getEstadoInstancia(instanceId));
            socketNotifier.emitNuevaConversacion(io, userId, conv);
        }
    } catch (err) {
        logger.error('Error en inbound-message-handler', err);
    }
}

module.exports = { handleInboundMessage };
