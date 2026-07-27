'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const crmFlow = require('./crm-flow');

const aiEngine = require('../core/ai/ai-engine');

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

                        context.estadoTemporal?.rubro || ''

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