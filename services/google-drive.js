const axios = require('axios');
const { extraerIdGoogleSheets } = require('./formateo');

async function descargarGoogleSheets(url) {
    const sheetId = extraerIdGoogleSheets(url);
    if (!sheetId) throw new Error('URL de Google Sheets no válida');

    // Opción 1: Exportación directa (funciona solo para hojas públicas)
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
        return response.data;
    } catch (error) {
        console.error('❌ Error descargando Google Sheets:', error.message);
        if (error.response && error.response.status === 401) {
            throw new Error('Error 401: La hoja de cálculo no es pública o requiere autenticación. Verificá que el archivo sea público (cualquiera con el enlace puede ver).');
        }
        throw new Error(`No se pudo descargar la hoja: ${error.message}`);
    }
}

module.exports = { descargarGoogleSheets };