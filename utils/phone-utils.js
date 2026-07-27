'use strict';

/**
 * Normaliza un número de teléfono argentino.
 *
 * Ejemplos:
 *
 * +54 9 351 5551234
 * 5493515551234
 * 3515551234
 * 03515551234
 *
 * →
 *
 * 3515551234
 */

function normalizarNumero(numero) {

    let n = String(numero || '');

    n = n.replace(/\D/g, '');

    if (n.startsWith('549')) {
        n = n.substring(3);
    }
    else if (n.startsWith('54')) {
        n = n.substring(2);
    }

    if (n.startsWith('0')) {
        n = n.substring(1);
    }

    return n.slice(-10);

}

/**
 * Convierte un número al formato WhatsApp.
 *
 * 3515551234
 *
 * →
 *
 * 5493515551234@c.us
 */

function numeroAChatId(numero) {

    const n = normalizarNumero(numero);

    return `549${n}@c.us`;

}

/**
 * Extrae el número desde un chatId.
 *
 * 5493515551234@c.us
 *
 * →
 *
 * 3515551234
 */

function chatIdANumero(chatId) {

    return normalizarNumero(
        String(chatId || '').replace(/@.*$/, '')
    );

}

module.exports = {

    normalizarNumero,

    numeroAChatId,

    chatIdANumero

};