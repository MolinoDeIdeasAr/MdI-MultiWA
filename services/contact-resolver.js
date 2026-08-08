'use strict';

const {
    normalizarNumero
} = require('../utils/phone-utils');

// v1.1.0 — ver CHANGELOG en contact-resolver.js (soporte @lid)

// v1.1.0
//
// CHANGELOG v1.1.0:
//  • FIX CRÍTICO: solo se resolvía el contacto cuando WhatsApp
//    mandaba el chat en formato "@c.us" (número real). Pero
//    WhatsApp ahora usa "@lid" (linked ID) para bastantes chats
//    — un identificador opaco que no es el número real, por
//    privacidad. Con "@lid" el código caía directo a
//    "Desconocido" con ese ID como número, sin siquiera intentar
//    matchear contra los contactos cargados. Ahora, cuando el
//    chat viene en "@lid", se le pide a WhatsApp que resuelva el
//    contacto real (msg.getContact() — mismo mecanismo que usa
//    WhatsApp Web para mostrar nombre/número reales).
//  • La función ahora es async y recibe "msg" en vez de solo
//    "rawFrom" (necesita msg.getContact() para el caso @lid).

/**
 * Busca un contacto dentro de la campaña activa.
 */

async function resolverContacto(msg, contactos = []) {

    const rawFrom = msg.from;

    //------------------------------------------------------
    // Buscar por chatId
    //------------------------------------------------------

    const porChatId = contactos.find(c =>
        c.chatIdEnviado === rawFrom
    );

    if (porChatId) {
        return porChatId;
    }

    //------------------------------------------------------
    // Buscar por número (WhatsApp expone el número real)
    //------------------------------------------------------

    if (rawFrom.includes('@c.us')) {

        const numero = normalizarNumero(
            rawFrom.replace('@c.us', '')
        );

        const encontrado = contactos.find(c =>
            normalizarNumero(
                c.NUMERO ||
                c.numero ||
                ''
            ) === numero
        );

        if (encontrado) {
            return encontrado;
        }

    }

    //------------------------------------------------------
    // WhatsApp oculta el número real detrás de un "lid" —
    // pedirle a WhatsApp que resuelva el contacto real
    //------------------------------------------------------

    if (rawFrom.includes('@lid')) {

        try {

            const contactoWA = await msg.getContact();

            const numeroReal = normalizarNumero(
                contactoWA.number || ''
            );

            if (numeroReal) {

                const encontrado = contactos.find(c =>
                    normalizarNumero(
                        c.NUMERO ||
                        c.numero ||
                        ''
                    ) === numeroReal
                );

                if (encontrado) {
                    return encontrado;
                }

            }

            // No está en la lista cargada, pero WhatsApp sí nos
            // dio nombre/número reales — mejor eso que "Desconocido"
            const nombreReal =
                contactoWA.pushname ||
                contactoWA.name ||
                'Desconocido';

            return {

                NOMBRE: nombreReal,

                NUMERO: contactoWA.number || rawFrom.replace(/@.*$/, ''),

                nombre: nombreReal,

                numero: contactoWA.number || rawFrom.replace(/@.*$/, ''),

                _esDesconocido: !contactoWA.number

            };

        }

        catch (err) {

            console.warn(

                '⚠ No se pudo resolver contacto @lid:',

                err.message

            );

            // sigue al fallback de abajo

        }

    }

    //------------------------------------------------------
    // Contacto desconocido
    //------------------------------------------------------

    return {

        NOMBRE: 'Desconocido',

        NUMERO: rawFrom.replace(/@.*$/, ''),

        nombre: 'Desconocido',

        numero: rawFrom.replace(/@.*$/, ''),

        _esDesconocido: true

    };

}

module.exports = {

    resolverContacto

};