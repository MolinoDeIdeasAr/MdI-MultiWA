'use strict';

// v1.1.0
//
// CHANGELOG v1.1.0:
//  • FIX CRÍTICO: notification-service.js existía completo y
//    funcional, pero nunca se llamaba desde ningún lado — el
//    aviso al celular del usuario logueado nunca se disparaba,
//    aunque context.debeNotificarAsesor estuviera en true (ej:
//    alguien responde "INFO"). Se agregó notificarAsesor(),
//    llamado en procesar() después de enviarRespuesta().

//==============================================================
// DEPENDENCIAS
//==============================================================

const crmFlow = require('./crm-flow');

const aiEngine = require('../core/ai/ai-engine');

const notificationService = require('./notification-service');

const logger = require('../core/logger/logger');

const {

    simularEscrituraHumana

} = require('./formateo');

const {

    registrarBaja

} = require('./bajas');

//==============================================================
// AI FLOW
//==============================================================

class AIFlow {

    //----------------------------------------------------------
    // PROCESAR MENSAJE
    //----------------------------------------------------------

    async procesar(

        context

    ) {

        //------------------------------------------------------
        // Analizar mensaje
        //------------------------------------------------------

        const analisis =

            await aiEngine.analizar(

                context.texto,

                {

                    numero:

                        context.numero,

                    nombre:

                        context.nombre,

                    rubro:

                        context.estadoTemporal?.rubro || '',

                    // Respuesta a "INFO" propia de esta campaña —
                    // si no se configuró ninguna, ai-rules.js cae
                    // al texto genérico por defecto.
                    respuestaInfoPersonalizada:

                        context.estadoTemporal?.respuestaInfo || ''

                }

            );

        //------------------------------------------------------
        // Guardar análisis
        //------------------------------------------------------

        context.setAnalisisIA(

            analisis

        );

        logger.ai(

            `${context.estadoIA} | ${context.intencionIA}`

        );

        //------------------------------------------------------
        // Responder automáticamente
        //------------------------------------------------------

        if (

            context.debeResponderIA

        ) {

            await this.enviarRespuesta(

                context

            );

        }

        //------------------------------------------------------
        // Notificar al asesor (celular del usuario logueado)
        //------------------------------------------------------
        //
        // FIX: notificationService.notificar() existía y estaba
        // completo, pero nunca se llamaba desde ningún lado —
        // por eso el aviso nunca llegaba aunque
        // context.debeNotificarAsesor estuviera en true. El
        // propio servicio ya chequea internamente
        // debeNotificarAsesor, así que es seguro llamarlo
        // siempre acá; si no corresponde notificar, no hace nada.

        await this.notificarAsesor(

            context

        );

        //------------------------------------------------------
        // Registrar baja
        //------------------------------------------------------

        if (

            context.debeRegistrarBaja

        ) {

            await this.registrarBaja(

                context

            );

        }

        return context;

    }

    //----------------------------------------------------------
    // NOTIFICAR ASESOR
    //----------------------------------------------------------

    async notificarAsesor(

        context

    ) {

        try {

            await notificationService.notificar(

                context

            );

        }

        catch (err) {

            logger.error(

                'Error notificando al asesor',

                err

            );

        }

    }

    //----------------------------------------------------------
    // RESPUESTA IA
    //----------------------------------------------------------

    async enviarRespuesta(

        context

    ) {

        try {

            //--------------------------------------------------
            // Simular escritura
            //--------------------------------------------------

            await simularEscrituraHumana(

                context.client,

                context.chatId,

                context.respuestaIA

            );

            //--------------------------------------------------
            // Enviar mensaje
            //--------------------------------------------------

            await context.client.sendMessage(

                context.chatId,

                context.respuestaIA

            );

            logger.whatsapp(

                `Respuesta IA enviada a ${context.numero}`

            );

            //--------------------------------------------------
            // Registrar en CRM
            //--------------------------------------------------

            crmFlow.registrarRespuestaIA(

                context

            );

        }

        catch (err) {

            logger.error(

                'Error enviando respuesta IA',

                err

            );

            crmFlow.registrarEvento?.(

                context.numero,

                {

                    tipo: 'ERROR_IA',

                    descripcion: err.message,

                    fecha: new Date().toISOString()

                }

            );

        }

    }

    //----------------------------------------------------------
    // BAJA AUTOMÁTICA
    //----------------------------------------------------------

    async registrarBaja(

        context

    ) {

        try {

            registrarBaja(

                context.numero,

                context.nombre

            );

            logger.crm(

                `Baja registrada: ${context.numero}`

            );

        }

        catch (err) {

            logger.error(

                'Error registrando baja',

                err

            );

        }

        //------------------------------------------------------
        // Registrar en CRM
        //------------------------------------------------------

        crmFlow.registrarBaja(

            context

        );

    }

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = new AIFlow();