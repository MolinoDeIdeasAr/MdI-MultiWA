'use strict';
const { detectarBot } = require('../core/ai/bot-detector');
const crmFlow = require('./crm-flow');
const aiEngine = require('../core/ai/ai-engine');
const notificationService = require('./notification-service');
const logger = require('../core/logger/logger');
const { simularEscrituraHumana } = require('./formateo');
const { enviarTexto } = require('./whatsapp-send');
const { registrarBaja } = require('./bajas');

class AIFlow {
    async procesar(context) {
        // DETECCIÓN DE BOT
        const analisisBot = detectarBot(context.texto);
        if (analisisBot.esBot) {
            console.log(`🤖 BOT detectado (${analisisBot.score} señales) - ${context.numero}`);
            console.log('   ⏭️ Se omite IA y notificación al usuario');
            context.estadoIA = 'bot_detectado';
            context.intencionIA = 'auto_responder';
            context.debeResponderIA = false;
            context.debeNotificarAsesor = false;
            context.debeRegistrarBaja = false;
            context.respuestaIA = '';
            return context;
        }

        // ANALIZAR MENSAJE
        const analisis = await aiEngine.analizar(context.texto, {
            numero: context.numero,
            nombre: context.nombre,
            rubro: context.rubro || context.estadoTemporal?.rubro || '',
            respuestaInfoPersonalizada: context.estadoTemporal?.respuestaInfo || '',
            tipoCampana: context.estadoTemporal?.tipoCampana || '',
            respuestasInfoPorTipo: context.estadoTemporal?.respuestasInfoPorTipo || {}
        });

        context.setAnalisisIA(analisis);
        logger.ai(`${context.estadoIA} | ${context.intencionIA}`);

        // RESPONDER AUTOMÁTICAMENTE
        if (context.debeResponderIA) {
            await this.enviarRespuesta(context);
        }

        // NOTIFICAR AL ASESOR
        await this.notificarAsesor(context);

        // REGISTRAR BAJA
        if (context.debeRegistrarBaja) {
            await this.registrarBaja(context);
        }

        return context;
    }

    async notificarAsesor(context) {
        try {
            await notificationService.notificar(context);
        } catch (err) {
            logger.error('Error notificando al asesor', err);
        }
    }

    async enviarRespuesta(context) {
    try {
        // ✅ SIMULACIÓN DE ESCRITURA HUMANA (Compatible con Baileys)
        try {
            if (context.client && typeof context.client.sendPresenceUpdate === 'function') {
                // Cliente Baileys: usa sendPresenceUpdate
                await context.client.sendPresenceUpdate('composing', context.chatId);
                const tiempoSimulacion = Math.min(Math.max((context.respuestaIA || '').length * 30, 1500), 4000);
                await new Promise(r => setTimeout(r, tiempoSimulacion));
                await context.client.sendPresenceUpdate('paused', context.chatId);
            } else {
                // Fallback para whatsapp-web.js si aún existe
                await simularEscrituraHumana(context.client, context.chatId, context.respuestaIA);
            }
        } catch (e) {
            console.warn('⚠️ Error simulando escritura:', e.message);
        }

        await enviarTexto(context.client, context.chatId, context.respuestaIA);
        logger.whatsapp(`Respuesta IA enviada a ${context.numero}`);
        crmFlow.registrarRespuestaIA(context);
    } catch (err) {
        logger.error('Error enviando respuesta IA', err);
        crmFlow.registrarEvento?.(context.numero, {
            tipo: 'ERROR_IA',
            descripcion: err.message,
            fecha: new Date().toISOString()
        });
    }
}

    async registrarBaja(context) {
        try {
            registrarBaja(context.numero, context.nombre);
            logger.crm(`Baja registrada: ${context.numero}`);
        } catch (err) {
            logger.error('Error registrando baja', err);
        }
        crmFlow.registrarBaja(context);
    }
}

module.exports = new AIFlow();