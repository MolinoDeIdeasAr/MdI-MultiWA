'use strict';

//==============================================================
// bot-detector.js v2.0
//
// Detección robusta de auto-responders/bots.
// Si score >= umbral, se omite IA y notificación al usuario.
//==============================================================

// Frases típicas de auto-responders (en español)
const PATRONES_BOT = [
    // Saludos corporativos genéricos
    /gracias por (?:comunicarte|contactarnos|escribirnos|tu mensaje)/i,
    /gracias por tu confianza/i,
    /hemos recibido (?:tu|su) mensaje/i,
    /su mensaje fue recibido/i,
    /recibimos (?:tu|su) (?:mensaje|consulta)/i,

    // Promesas de contacto futuro (típico de bots)
    /un asesor (?:se comunicará|lo contactará|te contactará|se pondrá en contacto)/i,
    /(?:te|le|lo) (?:contactaremos|responderemos) a la brevedad/i,
    /en breve (?:te|le|lo|un asesor)/i,
    /nos comunicaremos (?:con (?:usted|vos|ti)|pronto)/i,
    /(?:un|el) (?:representante|agente|operador|asesor) (?:lo|te|le)/i,

    // Fuera de horario
    /(?:no estamos|nos encontramos) (?:disponibles|en horario|en oficina)/i,
    /fuera (?:de|del) (?:horario|hora) (?:laboral|de atención|de oficina)/i,
    /(?:nuestro|el) horario (?:de atención )?es/i,
    /horario de atenci[oó]n/i,

    // Saludos automáticos con nombre de empresa
    /hola.*somos/i,
    /hola.*estás hablando con/i,
    /estás hablando con/i,
    /bienvenido a/i,
    /te comunicaste con/i,

    // Deja tu consulta
    /por favor (?:deje|dejá|indique|escriba)/i,
    /dejanos tu (?:consulta|mensaje|duda)/i,

    // Mensajes automáticos explícitos
    /mensaje (?:autom[aá]tico|autom[aá]tica)/i,
    /respuesta (?:autom[aá]tica|automatizada)/i,
    /(?:auto[- ]?respuesta|auto[- ]?reply)/i,
    /este es un mensaje/i,

    // Marketing genérico de auto-responder
    /(?:suscr[ií]bite|suscr[ií]base) a (?:nuestro|nuestra)/i,
    /visita (?:nuestro|nuestra|el|la) (?:sitio|web|página|pagina)/i,
    /seguinos en (?:nuestras )?(?:redes|instagram|facebook)/i,

    // Patrones detectados en producción
    /gracias por comunicarte con/i,
];

// Con 1 sola coincidencia ya se marca como sospechoso
const UMBRAL_BOT = 1;

function detectarBot(mensaje) {
    const texto = (mensaje || '').toString().trim();
    if (!texto) return { esBot: false, score: 0, señales: [] };

    const señales = [];
    let score = 0;

    for (const patron of PATRONES_BOT) {
        if (patron.test(texto)) {
            score++;
            señales.push(patron.source.substring(0, 50));
        }
    }

    const esBot = score >= UMBRAL_BOT;

    if (esBot) {
        console.log(`   🤖 BotDetector: score=${score}, señales=[${señales.join(' | ')}]`);
    }

    return { esBot, score, señales };
}

module.exports = { detectarBot };