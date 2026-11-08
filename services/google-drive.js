'use strict';
const axios = require('axios');

function extraerIdGoogleSheets(url) {
    if (!url) return null;
    const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

async function descargarGoogleSheets(url) {
    const sheetId = extraerIdGoogleSheets(url);
    if (!sheetId) {
        throw new Error('URL de Google Sheets no válida. Asegurate de copiar el enlace completo del archivo.');
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    console.log(`📂 [DRIVE] Descargando desde: ${exportUrl}`);
    
    try {
        const response = await axios({
            method: 'get',
            url: exportUrl,
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const buffer = response.data;
        if (buffer.length < 2000) {
            const text = buffer.toString('utf8');
            if (text.includes('Sign in') || text.includes('Inicia sesión') || text.includes('403')) {
                throw new Error('Error 403: La hoja de cálculo no es pública. Cambiá los permisos a "Cualquier persona con el enlace puede ver".');
            }
        }
        return buffer;
    } catch (error) {
        console.error('❌ Error descargando Google Sheets:', error.message);
        if (error.message.includes('403') || error.message.includes('401')) {
            throw new Error('Error de permisos: La hoja de cálculo no es pública. Cambiá los permisos a "Cualquier persona con el enlace puede ver".');
        }
        throw new Error(`No se pudo descargar la hoja: ${error.message}`);
    }
}

module.exports = { descargarGoogleSheets, extraerIdGoogleSheets };