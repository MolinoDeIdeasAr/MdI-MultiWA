'use strict';

//==============================================================
// MdI MultiWA - services/formateo.js
// VERSIÓN ANTI-DETECCIÓN
//==============================================================

function formatearNumeroWhatsApp(numero) {
    let num = String(numero || '').replace(/\D/g, '');
    if (!num || num.length < 8) return null;

    const prefijosInternacionales = ['52','51','56','57','58','1','34','55','44','33','39','49'];
    if (prefijosInternacionales.some(prefijo => num.startsWith(prefijo) && num.length >= 10)) {
        return num;
    }

    if (num.startsWith('549')) return num.length >= 13 ? num : null;
    if (num.startsWith('0')) num = num.substring(1);

    const codigosAreaArgentina = [
        '11','220','221','223','224','225','226','227','228','229',
        '230','231','232','233','234','235','236','237','238','239',
        '260','261','262','263','264','265','266','267','280',
        '290','291','292','293','294','295','296','297','298','299',
        '336','341','342','343','344','345','346','347','348','349',
        '351','352','353','354','355','356','357','358','362','364',
        '370','371','372','373','374','375','376','377','378',
        '380','381','382','383','384','385','386','387','388'
    ];

    let codigoAreaEncontrado = null;
    for (const area of codigosAreaArgentina) {
        const patron = area + '15';
        if (num.startsWith(patron) && num.length > patron.length + 5) {
            codigoAreaEncontrado = area;
            break;
        }
    }

    if (codigoAreaEncontrado) {
        num = codigoAreaEncontrado + num.substring(codigoAreaEncontrado.length + 2);
    }

    if (!num.startsWith('54')) num = '54' + num;
    if (num.startsWith('54') && !num.startsWith('549') && num.length > 4) {
        num = '549' + num.substring(2);
    }

    return num.length < 13 ? null : num;
}

function procesarSpintax(texto) {
    if (!texto) return texto;
    let resultado = texto;
    let iteraciones = 0;

    while (resultado.includes('{') && resultado.includes('}') && iteraciones < 10) {
        resultado = resultado.replace(
            /{([^{}]+)}/g,
            (_, opcionesTexto) => {
                const opciones = opcionesTexto.split('|');
                return opciones[Math.floor(Math.random() * opciones.length)];
            }
        );
        iteraciones++;
    }
    return resultado;
}

function extraerIdGoogleSheets(url) {
    if (!url) return null;
    const match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function getTiempoEscritura(mensaje) {
    const texto = String(mensaje || '');
    const base = texto.length * (40 + Math.random() * 30);
    return Math.min(Math.max(base, 3000), 10000);
}

function generarDelayHumano(indiceContacto, totalContactos) {
    if (!totalContactos || totalContactos <= 1) {
        return 45000 + Math.floor(Math.random() * 30000);
    }

    const posicion = indiceContacto / totalContactos;
    const fatiga = 0.5 + 2 * Math.pow(posicion - 0.5, 2);
    const baseMs = 45000;
    const ruido = 0.7 + Math.random() * 0.6;
    let delay = Math.floor(baseMs * fatiga * ruido);

    const intervaloPausa = 7 + Math.floor(Math.random() * 8);
    if (indiceContacto > 0 && indiceContacto % intervaloPausa === 0) {
        delay += Math.floor(Math.random() * 360000) + 120000;
        console.log('☕ Pausa larga simulada: ' + Math.floor(delay / 60000) + 'm');
    }

    delay += Math.floor(Math.random() * 5000) - 2500;
    delay = Math.max(30000, Math.min(300000, delay));
    return delay;
}

async function simularEscrituraHumana(client, chatId, mensaje) {
    const tiempoBase = getTiempoEscritura(mensaje);

    try {
        // Intentamos obtener el chat de forma más robusta
        // con reintentos para lidiar con IDs tipo @lid
        let chat = null;
        let intentos = 0;
        const MAX_INTENTOS = 3;
        
        while (!chat && intentos < MAX_INTENTOS) {
            try {
                chat = await Promise.race([
                    client.getChatById(chatId),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('timeout')), 3000)
                    )
                ]);
            } catch (err) {
                intentos++;
                if (intentos < MAX_INTENTOS) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    throw err;
                }
            }
        }
        if (chat && typeof chat.sendStateTyping === 'function') {
            await chat.sendStateTyping();

            const palabras = mensaje.split(' ');
            let erroresCometidos = 0;
            let tiempoTotalTipeo = 0;

            for (let i = 0; i < palabras.length; i++) {
                const palabra = palabras[i];

                if (palabra.length > 5 && Math.random() < 0.15) {
                    erroresCometidos++;

                    const tiempoError = palabra.length * (80 + Math.random() * 40);
                    tiempoTotalTipeo += tiempoError;
                    await new Promise(resolve => setTimeout(resolve, tiempoError));

                    const tiempoBorrado = 500 + Math.random() * 500;
                    tiempoTotalTipeo += tiempoBorrado;
                    await new Promise(resolve => setTimeout(resolve, tiempoBorrado));

                    const tiempoReescritura = palabra.length * (60 + Math.random() * 30);
                    tiempoTotalTipeo += tiempoReescritura;
                    await new Promise(resolve => setTimeout(resolve, tiempoReescritura));
                } else {
                    const tiempoNormal = palabra.length * (60 + Math.random() * 40);
                    tiempoTotalTipeo += tiempoNormal;
                    await new Promise(resolve => setTimeout(resolve, tiempoNormal));
                }

                if (i < palabras.length - 1) {
                    const tiempoEspacio = 100 + Math.random() * 200;
                    tiempoTotalTipeo += tiempoEspacio;
                    await new Promise(resolve => setTimeout(resolve, tiempoEspacio));
                }
            }

            if (erroresCometidos > 0) {
                console.log('⌨ Escritura con ' + erroresCometidos + ' error(es) corregido(s) -> ' + chatId);
            }

            const tiempoRestante = tiempoBase - tiempoTotalTipeo;
            if (tiempoRestante > 0) {
                await new Promise(resolve => setTimeout(resolve, tiempoRestante));
            }

            try {
                if (typeof chat.clearState === 'function') {
                    await chat.clearState();
                }
            } catch (_) {}

        } else {
            await new Promise(resolve => setTimeout(resolve, tiempoBase));
        }

    } catch (err) {
        console.warn('⚠ simularEscrituraHumana falló para ' + chatId + ': ' + err.message + ' — se continúa con el envío');
        await new Promise(resolve => setTimeout(resolve, Math.min(tiempoBase, 5000)));
    }
}

module.exports = {
    formatearNumeroWhatsApp,
    procesarSpintax,
    extraerIdGoogleSheets,
    simularEscrituraHumana,
    generarDelayHumano
};