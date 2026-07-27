const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

function findChromePath() {
    const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }
    return undefined;
}

function crearCliente(userAgent, clientId) {
    const chromePath = findChromePath();
    const sessionPath = path.join(__dirname, '..', 'sessions', clientId);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const puppeteerConfig = {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
            `--user-data-dir=${sessionPath}`,
            '--timezone=America/Argentina/Buenos_Aires',
            '--lang=es-AR',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-zygote',
            '--disable-extensions',
            '--mute-audio',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ],
        defaultViewport: null,
        timeout: 120000
    };

    if (userAgent) puppeteerConfig.args.push(`--user-agent=${userAgent}`);
    if (chromePath) puppeteerConfig.executablePath = chromePath;

    return new Client({
        authStrategy: new LocalAuth({
            clientId: clientId,
            dataPath: path.join(__dirname, '..', 'sessions')
        }),
        puppeteer: puppeteerConfig
    });
}

async function generarQR(qr) {
    return {
        terminal: () => qrcodeTerminal.generate(qr, { small: true }),
        imagen: () => qrcode.toDataURL(qr)
    };
}

async function verificarNumeroWhatsApp(client, numero) {
    try {
        const numeroId = await client.getNumberId(numero);
        if (!numeroId) return { valido: false, razon: 'No registrado en WhatsApp' };
        return { valido: true, id: numeroId._serialized };
    } catch (e) {
        return { valido: false, razon: e.message };
    }
}

async function esperarHastaHorarioValido(esHorarioValido, CONFIG) {
    while (!esHorarioValido()) {
        const ahora = new Date();
        const horaActual = ahora.getHours();
        let tiempoEspera;
        if (horaActual >= CONFIG.HORA_FIN || horaActual < CONFIG.HORA_INICIO) {
            const proximoInicio = new Date();
            if (horaActual >= CONFIG.HORA_FIN) proximoInicio.setDate(proximoInicio.getDate() + 1);
            proximoInicio.setHours(CONFIG.HORA_INICIO, 0, 0, 0);
            tiempoEspera = proximoInicio - ahora;
        } else {
            tiempoEspera = 60000;
        }
        const horas = Math.floor(tiempoEspera / 3600000);
        const minutos = Math.floor((tiempoEspera % 3600000) / 60000);
        console.log(`⏰ Esperando ${horas}h ${minutos}m hasta horario válido...`);
        await new Promise(r => setTimeout(r, Math.min(tiempoEspera, 3600000)));
    }
}

async function gracefulDestroyClient(client) {
    if (!client) return;
    try {
        if (client.puppeteer && client.puppeteer.browser) {
            await client.puppeteer.browser.close();
            console.log('✅ Navegador cerrado');
        }
    } catch (err) {
        console.warn('⚠️ Error cerrando navegador:', err.message);
    }
    try {
        if (typeof client.destroy === 'function') {
            await client.destroy();
            console.log('✅ Cliente destruido');
        }
    } catch (err) {
        console.warn('⚠️ Error en destroy:', err.message);
    }
}

module.exports = {
    crearCliente,
    generarQR,
    verificarNumeroWhatsApp,
    esperarHastaHorarioValido,
    gracefulDestroyClient
};