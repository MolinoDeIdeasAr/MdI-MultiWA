function formatearNumeroWhatsApp(numero) {
    let num = String(numero).replace(/\D/g, '');
    if (!num || num.length < 8) return null;

    // Si ya tiene prefijo internacional conocido, devolver como está
    const prefijos = ['52','51','56','57','58','1','34','55','44','33','39','49'];
    if (prefijos.some(p => num.startsWith(p) && num.length >= 10)) return num;

    // Quitar 0 inicial si lo tiene
    if (num.startsWith('0')) num = num.substring(1);

    // Agregar prefijo Argentina si no lo tiene
    if (!num.startsWith('54')) num = '54' + num;

    // Asegurar formato 549XXXXXXXXX (móvil argentino)
    if (num.startsWith('54') && !num.startsWith('549') && num.length > 4) {
        num = '549' + num.substring(2);
    }

    return num.length >= 11 ? num : null;
}

function procesarSpintax(texto) {
    if (!texto) return texto;
    let resultado = texto;
    let iteraciones = 0;
    while (resultado.includes('{') && resultado.includes('}') && iteraciones < 10) {
        resultado = resultado.replace(/{([^{}]+)}/g, (_, op) => {
            const opciones = op.split('|');
            return opciones[Math.floor(Math.random() * opciones.length)];
        });
        iteraciones++;
    }
    return resultado;
}

function extraerIdGoogleSheets(url) {
    // FIX: manejar múltiples formatos de URL de Google Sheets
    // https://docs.google.com/spreadsheets/d/ID/edit?usp=sharing
    // https://docs.google.com/spreadsheets/d/ID/edit#gid=0
    // https://docs.google.com/spreadsheets/d/ID
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
}

function getTiempoEscritura(mensaje) {
    const base = mensaje.length * (40 + Math.random() * 30);
    return Math.min(Math.max(base, 3000), 10000);
}

// FIX v1.34.7: simularEscrituraHumana robusta que no bloquea el envío si falla
async function simularEscrituraHumana(client, chatId, mensaje) {
    const tiempoEspera = getTiempoEscritura(mensaje);
    try {
        // Intentar obtener el chat y enviar estado de escritura
        const chat = await Promise.race([
            client.getChatById(chatId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (chat && typeof chat.sendStateTyping === 'function') {
            await chat.sendStateTyping();
            await new Promise(r => setTimeout(r, tiempoEspera));
            // clearState puede no existir en v1.34.7, ignorar si falla
            try { await chat.clearState(); } catch (_) {}
        } else {
            await new Promise(r => setTimeout(r, tiempoEspera));
        }
    } catch (e) {
        // FIX: si falla getChatById (frecuente en v1.34.7), solo esperar el tiempo
        // NO lanzar error — esto no debe bloquear el envío del mensaje
        await new Promise(r => setTimeout(r, Math.min(tiempoEspera, 5000)));
    }
}

module.exports = {
    formatearNumeroWhatsApp,
    procesarSpintax,
    extraerIdGoogleSheets,
    simularEscrituraHumana
};
