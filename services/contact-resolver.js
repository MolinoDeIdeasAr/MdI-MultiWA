'use strict';

/**
 * MdI MultiWA
 * services/contact-resolver.js
 * v2.1.0 - Blindado contra celdas vacías o undefined en la planilla de Google Sheets
 */

function normalizarNumero(numero) {
    if (!numero) return '';
    return String(numero).replace(/[^0-9]/g, '');
}

async function resolverContacto(msg, contactosCargados) {
    try {
        if (!msg || !msg.key || !msg.key.remoteJid) {
            return null;
        }

        const rawFrom = msg.key.remoteJid;
        // En mensajes de grupo, el remitente real está en participant. En chats directos, en remoteJid.
        const remitente = msg.key.participant || rawFrom;
        
        // Extraer solo dígitos (ej: "5493513043371@s.whatsapp.net" -> "5493513043371")
        const numeroExtraido = remitente.split('@')[0].replace(/[^0-9]/g, '');

        if (!contactosCargados || !Array.isArray(contactosCargados)) {
            return {
                numero: numeroExtraido,
                NOMBRE: 'Cliente',
                RUBRO: 'Sin rubro',
                encontrado: false
            };
        }

        // Buscar en la planilla de forma BLINDADA (evita el error de undefined.includes)
        const contactoEncontrado = contactosCargados.find(c => {
            if (!c) return false;
            
            // Obtener el número de la planilla probando varios nombres de columna comunes
            const numPlanillaRaw = c.NUMERO || c.numero || c.Numero || c.Telefono || c.telefono || c.WhatsApp || c.whatsapp;
            const numeroPlanilla = normalizarNumero(numPlanillaRaw);
            
            // Si la fila no tiene número, la ignoramos para evitar que el sistema colapse
            if (!numeroPlanilla) return false;

            // Lógica de coincidencia flexible:
            // 1. Coincidencia exacta
            // 2. El número de la planilla está al final del extraído (ej: planilla="3513043371", extraido="5493513043371")
            // 3. El número extraído está al final del de la planilla (caso inverso)
            return numeroPlanilla === numeroExtraido || 
                   numeroExtraido.endsWith(numeroPlanilla) || 
                   numeroPlanilla.endsWith(numeroExtraido);
        });

        if (contactoEncontrado) {
            return {
                numero: normalizarNumero(contactoEncontrado.NUMERO || contactoEncontrado.numero || contactoEncontrado.Telefono),
                NOMBRE: contactoEncontrado.NOMBRE || contactoEncontrado.nombre || contactoEncontrado.Nombre || 'Cliente',
                RUBRO: contactoEncontrado.RUBRO || contactoEncontrado.rubro || contactoEncontrado.Rubro || 'Sin rubro',
                encontrado: true
            };
        }

        // Fallback si no se encuentra en la planilla (pero el sistema sigue funcionando)
        return {
            numero: numeroExtraido,
            NOMBRE: 'Cliente Nuevo',
            RUBRO: 'Sin rubro',
            encontrado: false
        };

    } catch (error) {
        console.error('❌ Error interno en resolverContacto:', error.message);
        return null;
    }
}

module.exports = { resolverContacto, normalizarNumero };