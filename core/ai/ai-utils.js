'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const fs = require('fs');

const path = require('path');

//==============================================================
// CONTEXTO DEL NEGOCIO
//==============================================================

const contextoNegocio = fs.existsSync(

    path.join(

        process.cwd(),

        'contexto_negocio.json'

    )

)

? JSON.parse(

    fs.readFileSync(

        path.join(

            process.cwd(),

            'contexto_negocio.json'

        ),

        'utf8'

    )

)

: null;

//==============================================================
// CONFIGURACIÓN
//==============================================================

const TELEFONO_PERSONAL =

    '5493513588244';

//==============================================================
// HISTORIAL EN MEMORIA
//==============================================================

const historialCompleto = {};

//==============================================================
// LIMPIAR NÚMERO
//==============================================================

function limpiarNumeroTelefono(numero) {

    if (

        numero === undefined ||

        numero === null

    ) {

        return '';

    }

    return String(numero)

        .replace(/@c\.us/g, '')

        .replace(/@lid/g, '')

        .replace(/@g\.us/g, '')

        .replace(/\D/g, '');

}

//==============================================================
// FORMATO LEGIBLE
//==============================================================

function formatearNumeroLegible(numero) {

    const limpio =

        limpiarNumeroTelefono(

            numero

        );

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

//==============================================================
// GUARDAR EN HISTORIAL
//==============================================================

function guardarEnHistorial(

    numero,

    rol,

    mensaje

) {

    const numeroLimpio =

        limpiarNumeroTelefono(

            numero

        );

    if (

        !historialCompleto[numeroLimpio]

    ) {

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

//==============================================================
// VCARD
//==============================================================

function generarVCardString(

    nombre,

    telefono,

    empresa = ''

) {

    const tel =

        limpiarNumeroTelefono(

            telefono

        );

    return `BEGIN:VCARD
VERSION:3.0
FN:${nombre} (Lead MdI)
TEL;TYPE=CELL:+${tel}
ORG:${empresa || 'Lead Molino de Ideas'}
NOTE:Lead que solicitó hablar con un asesor
END:VCARD`;

}

//==============================================================
// CONSTRUIR PROMPT PARA GEMINI
//==============================================================

function construirPrompt(

    mensaje,

    contexto = {}

) {

    const numero =

        limpiarNumeroTelefono(

            contexto.numero || ''

        );

    const historial =

        historialCompleto[numero] || [];

    const historialTexto =

        historial

            .map(item =>

                `${item.rol.toUpperCase()}: ${item.mensaje}`

            )

            .join('\n');

    return `

CONTEXTO DEL NEGOCIO

${JSON.stringify(contextoNegocio, null, 2)}

----------------------------------------

HISTORIAL

${historialTexto || '(Sin historial)'}

----------------------------------------

CLIENTE

Nombre: ${contexto.nombre || ''}

Número: ${numero}

Rubro: ${contexto.rubro || ''}

----------------------------------------

ÚLTIMO MENSAJE

"${mensaje}"

----------------------------------------

Respondé ÚNICAMENTE con un JSON válido usando este formato:

{
  "estado":"",
  "sentimiento":"",
  "intencion":"",
  "motivo_cierre":"",
  "proxima_accion_tipo":"",
  "proxima_accion_dias":0,
  "respuesta_sugerida":"",
  "notificarHumano":false
}

`;

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

        limpiarNumeroTelefono(

            numero

        );

    const numeroLegible =

        formatearNumeroLegible(

            numero

        );

    const historial =

        historialCompleto[numeroLimpio] || [];

    let mensaje =

`🚨 *ALERTA DE CLIENTE*

📇 *FICHA DEL CONTACTO*

👤 Nombre: ${nombreCliente || 'Desconocido'}
📱 Teléfono: ${numeroLegible}
📋 WhatsApp: +${numeroLimpio}`;

    if (

        datosAdicionales.empresa &&

        datosAdicionales.empresa !== nombreCliente

    ) {

        mensaje += `

🏢 Empresa: ${datosAdicionales.empresa}`;

    }

    if (

        datosAdicionales.rubro

    ) {

        mensaje += `

🏷️ Rubro: ${datosAdicionales.rubro}`;

    }

    mensaje += `

────────────────────────

💬 HISTORIAL DE CONVERSACIÓN
`;

    if (

        historial.length === 0

    ) {

        mensaje += `

(Sin historial previo)`;

    }

    else {

        historial.forEach(

            item => {

                mensaje += `

${item.rol === 'cliente' ? '🧑‍💼 Cliente' : '🤖 IA'}
(${item.fecha})

${item.mensaje}
`;

            }

        );

    }

    mensaje += `

────────────────────────

✋ El cliente solicitó hablar con una persona.

📞 Contactalo directamente:
+${numeroLimpio}
`;

    return mensaje;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    contextoNegocio,

    TELEFONO_PERSONAL,

    historialCompleto,

    limpiarNumeroTelefono,

    formatearNumeroLegible,

    guardarEnHistorial,

    generarVCardString,

    construirPrompt,

    formatearHistorialParaWhatsApp

};