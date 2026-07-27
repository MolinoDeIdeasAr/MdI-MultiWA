'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const {

    GoogleGenerativeAI

} = require('@google/generative-ai');

const {

    analizarReglas

} = require('./ai-rules');

const {

    construirPrompt,

    guardarEnHistorial

} = require('./ai-utils');

//==============================================================
// CONFIGURACIÓN GEMINI
//==============================================================

const genAI =

    new GoogleGenerativeAI(

        process.env.GEMINI_API_KEY

    );

//==============================================================
// AI ENGINE
//==============================================================

class AIEngine {

    constructor() {

        this.modelo =

            genAI.getGenerativeModel({

                model: 'gemini-2.5-flash'

            });

    }

    //----------------------------------------------------------
    // ANALIZAR
    //----------------------------------------------------------

    async analizar(

        mensaje,

        contexto = {}

    ) {

        //------------------------------------------------------
        // HISTORIAL CLIENTE
        //------------------------------------------------------

        guardarEnHistorial(

            contexto.numero,

            'cliente',

            mensaje

        );

        //------------------------------------------------------
        // REGLAS
        //------------------------------------------------------

        const resultadoReglas =

            analizarReglas(

                mensaje,

                contexto

            );

        if (

            resultadoReglas

        ) {

            if (

                resultadoReglas.respuesta_sugerida

            ) {

                guardarEnHistorial(

                    contexto.numero,

                    'ia',

                    resultadoReglas.respuesta_sugerida

                );

            }

            return resultadoReglas;

        }

        //------------------------------------------------------
        // GEMINI
        //------------------------------------------------------

        return await this.analizarConGemini(

            mensaje,

            contexto

        );

    }

    //----------------------------------------------------------
    // GEMINI
    //----------------------------------------------------------

    async analizarConGemini(

        mensaje,

        contexto = {}

    ) {

        try {

            const prompt =

                construirPrompt(

                    mensaje,

                    contexto

                );

            const result =

                await this.modelo.generateContent(

                    prompt

                );

            const texto =

                result.response

                    .text()

                    .trim()

                    .replace(/```json/g, '')

                    .replace(/```/g, '')

                    .trim();

            const json =

                JSON.parse(

                    texto

                );

            if (

                json.respuesta_sugerida

            ) {

                guardarEnHistorial(

                    contexto.numero,

                    'ia',

                    json.respuesta_sugerida

                );

            }

            return json;

        }

        catch (err) {

            console.error(

                '❌ Error Gemini:',

                err.message

            );

            return {

                estado: 'accion_humana',

                sentimiento: 'neutro',

                intencion: 'error_ia',

                motivo_cierre: '',

                proxima_accion_tipo: 'accion_humana',

                proxima_accion_dias: 1,

                respuesta_sugerida:

                    'Gracias por tu mensaje 😊 Un asesor continuará la conversación a la brevedad.',

                notificarHumano: true

            };

        }

    }

    //----------------------------------------------------------
    // VALIDAR RESPUESTA
    //----------------------------------------------------------

    validarRespuesta(respuesta = {}) {

        return {

            estado:

                respuesta.estado ||

                'accion_humana',

            sentimiento:

                respuesta.sentimiento ||

                'neutro',

            intencion:

                respuesta.intencion ||

                'no_identificada',

            motivo_cierre:

                respuesta.motivo_cierre ||

                '',

            proxima_accion_tipo:

                respuesta.proxima_accion_tipo ||

                'accion_humana',

            proxima_accion_dias:

                Number.isInteger(

                    respuesta.proxima_accion_dias

                )

                    ? respuesta.proxima_accion_dias

                    : 1,

            respuesta_sugerida:

                respuesta.respuesta_sugerida ||

                '',

            notificarHumano:

                Boolean(

                    respuesta.notificarHumano

                )

        };

    }

}

//==============================================================
// EXPORTS
//==============================================================

module.exports =

    new AIEngine();