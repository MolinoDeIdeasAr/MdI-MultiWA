'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const {

    limpiarNumeroTelefono

} = require('./ai-utils');

//==============================================================
// RESPUESTAS PREDEFINIDAS
//==============================================================

const RESPUESTAS = {

    diagnostico:

`¡Gracias por tu confianza! 😊

Vamos a comenzar con el Diagnóstico de Presencia Digital SIN CARGO.

Para hacerlo necesito solamente:

1️⃣ Nombre del negocio.

2️⃣ El enlace de alguna red social (Instagram, Facebook o sitio web).

Con eso preparo el diagnóstico y te envío el informe.`,

    info:

`Te cuento brevemente cómo trabajamos 😊

📊 Realizamos un Diagnóstico de Presencia Digital SIN CARGO.

Analizamos cómo aparece tu negocio en Google, Google Maps y redes sociales.

Luego te mostramos oportunidades concretas para conseguir más consultas y mejorar tu presencia digital.

Trabajamos principalmente en:

✅ Posicionamiento en Google
✅ Google Business
✅ Redes Sociales
✅ Diseño Web
✅ WhatsApp Marketing

El servicio de posicionamiento tiene un único pago de $40.000.

Si querés comenzar con el diagnóstico gratuito, enviame el enlace de alguna de tus redes sociales 👍`,

    humano:

`Perfecto 😊

Ya le aviso a un asesor para que continúe la conversación con vos.

En breve se va a comunicar personalmente.`,

    baja:

`Entiendo.

Muchas gracias por tu tiempo 😊

Que tengas un excelente día.`,

    generica:

`¡Gracias por tu mensaje!

Un asesor continuará la conversación con vos a la brevedad.`

};

//==============================================================
// ANALIZAR REGLAS
//==============================================================

// v1.1.0
//
// CHANGELOG v1.1.0:
//  • FIX: la respuesta a "INFO" estaba hardcodeada y era la
//    misma para TODAS las campañas/instancias. Ahora
//    analizarReglas() acepta un contexto.respuestaInfoPersonalizada
//    opcional — si la campaña definió su propia respuesta, se usa
//    esa; si no, se cae al texto genérico de siempre (RESPUESTAS.info)
//    para no romper campañas que nunca configuraron una propia.

function analizarReglas(

    mensaje,

    contexto = {}

) {

    const texto =

        (mensaje || '')

            .trim()

            .toUpperCase();

    const numero =

        limpiarNumeroTelefono(

            contexto.numero || ''

        );

    //----------------------------------------------------------
    // MENSAJE VACÍO
    //----------------------------------------------------------

    if (

        texto.length === 0

    ) {

        return null;

    }

    //----------------------------------------------------------
    // RESPUESTAS AFIRMATIVAS
    //----------------------------------------------------------

    const respuestasAfirmativas = [

        'SI',

        'SÍ',

        'OK',

        'DALE',

        'GENIAL',

        'PERFECTO',

        'ME INTERESA',

        'DE ACUERDO',

        'BUENO'

    ];

    if (

        respuestasAfirmativas.includes(

            texto

        ) &&

        texto.length <= 20

    ) {

        return {

            estado: 'interesado_calido',

            sentimiento: 'positivo',

            intencion: 'solicitud_info',

            motivo_cierre: '',

            proxima_accion_tipo: 'mensaje_followup',

            proxima_accion_dias: 3,

            respuesta_sugerida:

                RESPUESTAS.diagnostico,

            notificarHumano: false,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // INFO
    //----------------------------------------------------------

    if (

        texto === 'INFO' ||

        texto.includes('INFORMACION') ||

        texto.includes('INFORMACIÓN') ||

        texto.includes('QUIERO INFO') ||

        texto.includes('MAS INFO') ||

        texto.includes('MÁS INFO')

    ) {

        return {

            estado: 'interesado_calido',

            sentimiento: 'positivo',

            intencion: 'solicitud_info',

            motivo_cierre: '',

            proxima_accion_tipo: 'mensaje_followup',

            proxima_accion_dias: 3,

            respuesta_sugerida:

                contexto.respuestaInfoPersonalizada ||

                RESPUESTAS.info,

            notificarHumano: false,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // DIAGNÓSTICO
    //----------------------------------------------------------

    if (

        texto.includes('DIAGNOSTICO') ||

        texto.includes('DIAGNÓSTICO')

    ) {

        return {

            estado: 'interesado_calido',

            sentimiento: 'positivo',

            intencion: 'solicitud_diagnostico',

            motivo_cierre: '',

            proxima_accion_tipo: 'mensaje_followup',

            proxima_accion_dias: 3,

            respuesta_sugerida:

                RESPUESTAS.diagnostico,

            notificarHumano: false,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // QUIERE HABLAR CON UNA PERSONA
    //----------------------------------------------------------

    if (

        texto.includes('ASESOR') ||

        texto.includes('PERSONA') ||

        texto.includes('HUMANO') ||

        texto.includes('LLAMAME') ||

        texto.includes('LLÁMAME') ||

        texto.includes('QUIERO HABLAR') ||

        texto.includes('ME PODES LLAMAR') ||

        texto.includes('ME PODÉS LLAMAR')

    ) {

        return {

            estado: 'derivar_humano',

            sentimiento: 'positivo',

            intencion: 'hablar_humano',

            motivo_cierre: '',

            proxima_accion_tipo: 'accion_humana',

            proxima_accion_dias: 0,

            respuesta_sugerida:

                RESPUESTAS.humano,

            notificarHumano: true,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // NO INTERESADO
    //----------------------------------------------------------

    if (

        texto.includes('NO ME INTERESA') ||

        texto === 'NO' ||

        texto.includes('NO QUIERO') ||

        texto.includes('NO GRACIAS') ||

        texto.includes('BAJA') ||

        texto.includes('ELIMINAR') ||

        texto.includes('BORRAR') ||

        texto.includes('DEJEN DE ESCRIBIR')

    ) {

        return {

            estado: 'baja',

            sentimiento: 'negativo',

            intencion: 'rechazo',

            motivo_cierre: 'No interesado',

            proxima_accion_tipo: 'cerrar',

            proxima_accion_dias: 0,

            respuesta_sugerida:

                RESPUESTAS.baja,

            notificarHumano: false,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // AGRADECIMIENTO
    //----------------------------------------------------------

    if (

        texto === 'GRACIAS' ||

        texto === 'MUCHAS GRACIAS' ||

        texto === 'GENIAL, GRACIAS'

    ) {

        return {

            estado: 'conversacion_normal',

            sentimiento: 'positivo',

            intencion: 'agradecimiento',

            motivo_cierre: '',

            proxima_accion_tipo: 'esperar',

            proxima_accion_dias: 1,

            respuesta_sugerida: '',

            notificarHumano: false,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // DESPEDIDAS
    //----------------------------------------------------------

    if (

        texto === 'CHAU' ||

        texto === 'HASTA LUEGO' ||

        texto === 'NOS VEMOS' ||

        texto === 'SALUDOS'

    ) {

        return {

            estado: 'conversacion_finalizada',

            sentimiento: 'positivo',

            intencion: 'despedida',

            motivo_cierre: '',

            proxima_accion_tipo: 'ninguna',

            proxima_accion_dias: 0,

            respuesta_sugerida: '',

            notificarHumano: false,

            numeroLimpio: numero

        };

    }

    //----------------------------------------------------------
    // SIN REGLA
    //----------------------------------------------------------

    return null;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    analizarReglas,

    RESPUESTAS

};