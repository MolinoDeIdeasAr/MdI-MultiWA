'use strict';

const fs = require('fs');

//==============================================================
// NUEVO MOTOR IA
//==============================================================

const aiEngine = require('./ai/ai-engine');

//==============================================================
// CONTEXTO DEL NEGOCIO
//==============================================================

const contextoNegocio = fs.existsSync('./contexto_negocio.json')
    ? JSON.parse(
        fs.readFileSync(
            './contexto_negocio.json',
            'utf8'
        )
    )
    : null;

//==============================================================
// CONFIGURACIÓN
//==============================================================

const TELEFONO_PERSONAL = '5493513588244';

const historialCompleto = {};

//==============================================================
// UTILIDADES
//==============================================================

function limpiarNumeroTelefono(numero) {

    if (numero === undefined || numero === null)
        return '';

    return String(numero)
        .replace(/@c\.us/g, '')
        .replace(/@lid/g, '')
        .replace(/@g\.us/g, '')
        .replace(/\D/g, '');

}

function formatearNumeroLegible(numero) {

    const limpio = limpiarNumeroTelefono(numero);

    if (

        limpio.startsWith('549') &&
        limpio.length >= 11

    ) {

        return `+54 9 ${limpio.slice(3,6)} ${limpio.slice(6,10)}-${limpio.slice(10)}`;

    }

    if (

        limpio.startsWith('54') &&
        limpio.length >= 10

    ) {

        return `+54 ${limpio.slice(2,5)} ${limpio.slice(5,9)}-${limpio.slice(9)}`;

    }

    return `+${limpio}`;

}

function guardarEnHistorial(

    numero,
    rol,
    mensaje

) {

    const numeroLimpio = limpiarNumeroTelefono(numero);

    if (!historialCompleto[numeroLimpio]) {

        historialCompleto[numeroLimpio] = [];

    }

    const ultimo =

        historialCompleto[numeroLimpio][
            historialCompleto[numeroLimpio].length - 1
        ];

    if (

        ultimo &&
        ultimo.rol === rol &&
        ultimo.mensaje === mensaje

    ) {

        return;

    }

    historialCompleto[numeroLimpio].push({

        rol,

        mensaje,

        fecha: new Date().toLocaleString('es-AR')

    });

}

function generarVCardString(

    nombre,
    telefono,
    empresa = ''

) {

    const tel = limpiarNumeroTelefono(telefono);

    return `BEGIN:VCARD
VERSION:3.0
FN:${nombre} (Lead MdI)
TEL;TYPE=CELL:+${tel}
ORG:${empresa || 'Lead Molino de Ideas'}
NOTE:Lead que solicitó hablar con un asesor
END:VCARD`;

}

//==============================================================
// ANALIZAR RESPUESTA CON IA
//==============================================================

async function analizarRespuestaConIA(

    mensajeCliente,
    contexto = {}

) {

    const numeroCliente =
        contexto.numero || '';

    const numeroLimpio =
        limpiarNumeroTelefono(numeroCliente);

    //----------------------------------------------------------
    // Guardar mensaje del cliente
    //----------------------------------------------------------

    guardarEnHistorial(

        numeroLimpio,
        'cliente',
        mensajeCliente

    );

    //----------------------------------------------------------
    // Ejecutar nuevo motor IA
    //----------------------------------------------------------

    const resultado = await aiEngine.analizar(

        mensajeCliente,

        {

            numero: numeroLimpio,

            nombre:
                contexto.nombre || '',

            empresa:
                contexto.empresa || '',

            rubro:
                contexto.rubro || '',

            contextoNegocio

        }

    );

    //----------------------------------------------------------
    // Guardar respuesta generada
    //----------------------------------------------------------

    if (

        resultado.respuesta_sugerida

    ) {

        guardarEnHistorial(

            numeroLimpio,

            'app',

            resultado.respuesta_sugerida

        );

    }

    //----------------------------------------------------------
    // Compatibilidad hacia atrás
    //----------------------------------------------------------

    return {

        estado:

            resultado.estado ||

            'sin_estado',

        sentimiento:

            resultado.sentimiento ||

            'neutro',

        intencion:

            resultado.intencion ||

            'desconocida',

        motivo_cierre:

            resultado.motivo_cierre ||

            '',

        proxima_accion_tipo:

            resultado.proxima_accion_tipo ||

            'esperar',

        proxima_accion_dias:

            resultado.proxima_accion_dias ||

            1,

        respuesta_sugerida:

            resultado.respuesta_sugerida ||

            '',

        notificarHumano:

            Boolean(

                resultado.notificarHumano

            ),

        numeroLimpio

    };

}

//==============================================================
// FORMATEAR HISTORIAL PARA WHATSAPP
//==============================================================

function formatearHistorialParaWhatsApp(

    numero,
    nombreCliente,
    datosAdicionales = {}

) {

    const numeroLimpio =
        limpiarNumeroTelefono(numero);

    const numeroLegible =
        formatearNumeroLegible(numero);

    const historial =
        historialCompleto[numeroLimpio] || [];

    let mensaje = '';

    //----------------------------------------------------------
    // Encabezado
    //----------------------------------------------------------

    mensaje += '🚨 *ALERTA DE CLIENTE*\n\n';

    mensaje += '📇 *FICHA DE CONTACTO*\n';

    mensaje += `👤 *Nombre:* ${nombreCliente || 'Desconocido'}\n`;

    mensaje += `📱 *Teléfono:* ${numeroLegible}\n`;

    mensaje += `📋 *WhatsApp:* +${numeroLimpio}\n`;

    if (

        datosAdicionales.empresa &&
        datosAdicionales.empresa !== nombreCliente

    ) {

        mensaje += `🏢 *Empresa:* ${datosAdicionales.empresa}\n`;

    }

    if (

        datosAdicionales.rubro

    ) {

        mensaje += `🏷️ *Rubro:* ${datosAdicionales.rubro}\n`;

    }

    mensaje += '\n──────────────────\n\n';

    //----------------------------------------------------------
    // Historial
    //----------------------------------------------------------

    mensaje += '💬 *HISTORIAL COMPLETO*\n';
    mensaje += '──────────────────\n';

    if (

        historial.length === 0

    ) {

        mensaje += '(No hay mensajes previos)\n';

    }

    else {

        historial.forEach(entry => {

            const emoji =
                entry.rol === 'cliente'
                    ? '🧑‍💼'
                    : '🤖';

            mensaje += `\n${emoji} *${entry.rol === 'cliente' ? 'Cliente' : 'App (IA)'}* (${entry.fecha}):\n`;

            mensaje += `${entry.mensaje}\n`;

        });

    }

    //----------------------------------------------------------
    // Pie
    //----------------------------------------------------------

    mensaje += '\n──────────────────\n';

    mensaje += '✋ *El cliente quiere hablar con una persona.*\n';

    mensaje += `📞 *Contactalo directamente:* +${numeroLimpio}`;

    return mensaje;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    analizarRespuestaConIA,

    formatearHistorialParaWhatsApp,

    guardarEnHistorial,

    generarVCardString,

    limpiarNumeroTelefono,

    TELEFONO_PERSONAL

};
