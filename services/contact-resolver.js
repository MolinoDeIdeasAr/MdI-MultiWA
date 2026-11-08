'use strict';

const fs = require('fs');
const path = require('path');

function normalizarNumero(num) {
    if (!num) return '';
    let n = String(num).replace(/\D/g, '');
    if (n.startsWith('549')) n = n.substring(3);
    else if (n.startsWith('54')) n = n.substring(2);
    else if (n.startsWith('0')) n = n.substring(1);
    return n;
}

function buscarLidEnDisco(lidDigits) {
    try {
        const baseDir = path.join(__dirname, '..', 'baileys_sessions');
        if (!fs.existsSync(baseDir)) return null;
        const subdirs = fs.readdirSync(baseDir);
        const fileName = `lid-mapping-${lidDigits}_reverse.json`;
        for (const dir of subdirs) {
            const filePath = path.join(baseDir, dir, fileName);
            if (fs.existsSync(filePath)) {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (content && typeof content === 'string') {
                    return content.replace(/\D/g, '');
                }
            }
        }
    } catch (_) {}
    return null;
}

async function resolverContacto(msg, contactos = [], client = null) {
    try {
        if (!msg) return { NOMBRE: 'Desconocido', NUMERO: '', nombre: 'Desconocido', numero: '', rubro: 'Sin rubro', encontrado: false };

        // Compatible tanto con Baileys (msg.key) como con whatsapp-web.js (msg.from)
        const jid = msg.key?.participant || msg.key?.remoteJid || msg.from || '';
        if (!jid) return { NOMBRE: 'Desconocido', NUMERO: '', nombre: 'Desconocido', numero: '', rubro: 'Sin rubro', encontrado: false };

        let rawNumber = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        let numeroReal = rawNumber;
        let nombrePush = msg.pushName || '';

        // Resolución de @lid en Baileys
        if (jid.includes('@lid')) {
            if (client && client.signalRepository?.lidMapping?.getPNForLID) {
                try {
                    const pnJid = await client.signalRepository.lidMapping.getPNForLID(jid);
                    if (pnJid) {
                        const digits = String(pnJid).split('@')[0].split(':')[0].replace(/\D/g, '');
                        if (digits) numeroReal = digits;
                    }
                } catch (_) {}
            }
            if (!numeroReal || numeroReal === rawNumber) {
                const encontradoDisco = buscarLidEnDisco(rawNumber);
                if (encontradoDisco) numeroReal = encontradoDisco;
            }
        }

        // Compatibilidad con whatsapp-web.js
        if (typeof msg.getContact === 'function') {
            try {
                const contactoWA = await msg.getContact();
                if (contactoWA?.number) numeroReal = String(contactoWA.number).replace(/\D/g, '');
                if (contactoWA?.pushname || contactoWA?.name) nombrePush = contactoWA.pushname || contactoWA.name;
            } catch (_) {}
        }

        const numeroNormalizado = normalizarNumero(numeroReal);

        if (!contactos || !Array.isArray(contactos)) {
            return {
                numero: numeroNormalizado || rawNumber,
                NUMERO: numeroReal || rawNumber,
                NOMBRE: nombrePush || 'Cliente',
                nombre: nombrePush || 'Cliente',
                RUBRO: 'Sin rubro',
                rubro: 'Sin rubro',
                encontrado: false
            };
        }

        const contactoEncontrado = contactos.find(c => {
            if (!c) return false;
            if (c.chatIdEnviado && (c.chatIdEnviado === jid || (numeroReal && c.chatIdEnviado.includes(numeroReal)))) return true;
            const numPlanillaRaw = c.NUMERO || c.numero || c.Numero || c.Telefono || c.telefono;
            const numPlanilla = normalizarNumero(numPlanillaRaw);
            if (!numPlanilla) return false; // Ignorar filas vacías

            if (numeroNormalizado && numPlanilla === numeroNormalizado) return true;
            if (numPlanilla.length >= 10 && numeroNormalizado.length >= 10) {
                if (numPlanilla.slice(-10) === numeroNormalizado.slice(-10)) return true;
            }
            return false;
        });

        if (contactoEncontrado) {
            const numEncontrado = normalizarNumero(contactoEncontrado.NUMERO || contactoEncontrado.numero);
            const nomEncontrado = contactoEncontrado.NOMBRE || contactoEncontrado.nombre || nombrePush || 'Cliente';
            const rubEncontrado = contactoEncontrado.RUBRO || contactoEncontrado.rubro || 'Sin rubro';
            return {
                numero: numEncontrado,
                NUMERO: numEncontrado,
                NOMBRE: nomEncontrado,
                nombre: nomEncontrado,
                RUBRO: rubEncontrado,
                rubro: rubEncontrado,
                encontrado: true
            };
        }

        return {
            numero: numeroNormalizado || rawNumber,
            NUMERO: numeroReal || rawNumber,
            NOMBRE: nombrePush || 'Cliente Nuevo',
            nombre: nombrePush || 'Cliente Nuevo',
            RUBRO: 'Sin rubro',
            rubro: 'Sin rubro',
            encontrado: false,
            _esDesconocido: !numeroReal || numeroReal === rawNumber
        };
    } catch (error) {
        console.error('❌ Error en resolverContacto:', error.message);
        return { NOMBRE: 'Desconocido', NUMERO: '', nombre: 'Desconocido', numero: '', rubro: 'Sin rubro', encontrado: false };
    }
}

module.exports = { resolverContacto, normalizarNumero };
