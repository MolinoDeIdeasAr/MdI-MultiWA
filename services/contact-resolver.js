'use strict';

const {
    normalizarNumero
} = require('../utils/phone-utils');

/**
 * Busca un contacto dentro de la campaña activa.
 */

function resolverContacto(rawFrom, contactos = []) {

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
    // Buscar por número
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
    // Contacto desconocido
    //------------------------------------------------------

    return {

        NOMBRE: 'Desconocido',

        NUMERO: rawFrom.replace(/@.*$/, ''),

        _esDesconocido: true

    };

}

module.exports = {

    resolverContacto

};