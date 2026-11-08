'use strict';

function esClienteBaileys(client) {
    return !!(client && client.ev && typeof client.sendPresenceUpdate === 'function');
}

function normalizarJidParaCliente(client, destino) {
    const raw = String(destino || '').trim();
    if (!raw) return '';
    if (raw.includes('@lid') || raw.includes('@g.us') || raw.includes('@broadcast') || raw.includes('@newsletter')) {
        return raw;
    }
    const digits = raw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (!digits) return raw;
    if (esClienteBaileys(client)) return `${digits}@s.whatsapp.net`;
    return `${digits}@c.us`;
}

async function enviarTexto(client, destino, texto) {
    const body = String(texto || '');
    const jid = normalizarJidParaCliente(client, destino);
    if (!client || typeof client.sendMessage !== 'function' || !jid || !body) return;

    if (esClienteBaileys(client)) {
        await client.sendMessage(jid, { text: body });
        return;
    }
    await client.sendMessage(jid, body);
}

module.exports = {
    esClienteBaileys,
    normalizarJidParaCliente,
    enviarTexto
};
