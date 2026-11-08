'use strict';
//==============================================================
// MdI MultiWA - services/formateo.js
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

// ✅ FIX: Regex corregido con barras escapadas para evitar error de sintaxis
function extraerIdGoogleSheets(url) {
    if (!url) return null;
    const match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function getTiempoEscritura(mensaje) {
    const texto = String(mensaje || '').trim();
    if (!texto) return 2500;
    const palabras = texto.split(/\s+/).length;
    const wpm = 18 + Math.random() * 17;
    let segundos = (palabras / wpm) * 60;
    segundos *= (0.75 + Math.random() * 0.5);
    const ms = segundos * 1000;
    return Math.min(Math.max(ms, 2500), 15000);
}

function generarDelayHumano(mensaje) {
    return getTiempoEscritura(mensaje);
}

async function simularEscrituraHumana(client, chatId, mensaje) {
    const tiempoBase = getTiempoEscritura(mensaje);
    try {
        if (chatId && String(chatId).includes('@lid')) {
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            return;
        }

        if (client && typeof client.sendPresenceUpdate === 'function') {
            try { await client.sendPresenceUpdate('composing', chatId); } catch (_) {}
            await new Promise(resolve => setTimeout(resolve, tiempoBase));
            try { await client.sendPresenceUpdate('paused', chatId); } catch (_) {}
            return;
        }

        if (typeof client.sendStateTyping === 'function') {
            const pausaMental = 800 + Math.random() * 2200;
            await new Promise(resolve => setTimeout(resolve, pausaMental));
            
            try {
                await client.sendStateTyping(chatId);
            } catch (typingErr) {
                // Ignoramos errores de escritura, no deben detener el envío
            }
            
            const palabras = mensaje.split(' ');
            let tiempoTotalTipeo = 0;
            
            for (let i = 0; i < palabras.length; i++) {
                const palabra = palabras[i];
                if (palabra.length > 5 && Math.random() < 0.15) {
                    const tiempoError = palabra.length * (80 + Math.random() * 40);
                    tiempoTotalTipeo += tiempoError;
                    await new Promise(resolve => setTimeout(resolve, tiempoError));
                    
                    const tiempoBorrado = 500 + Math.random() * 500;
                    tiempoTotalTipeo += tiempoBorrado;
                    await new Promise(resolve => setTimeout(resolve, tiempoBorrado));
                } else {
                    const tiempoNormal = palabra.length * (60 + Math.random() * 40);
                    tiempoTotalTipeo += tiempoNormal;
                    await new Promise(resolve => setTimeout(resolve, tiempoNormal));
                }
                
                if (i < palabras.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
                }
            }
            
            const tiempoRestante = tiempoBase - tiempoTotalTipeo;
            if (tiempoRestante > 0) {
                await new Promise(resolve => setTimeout(resolve, tiempoRestante));
            }
            
            try {
                if (typeof client.clearState === 'function') {
                    await client.clearState(chatId);
                }
            } catch (_) {}
        } else {
            await new Promise(resolve => setTimeout(resolve, tiempoBase));
        }
    } catch (err) {
        console.warn('⚠ simularEscrituraHumana falló: ' + err.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

module.exports = {
    formatearNumeroWhatsApp,
    procesarSpintax,
    extraerIdGoogleSheets,
    simularEscrituraHumana,
    getTiempoEscritura,
    generarDelayHumano
};