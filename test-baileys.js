'use strict';
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

// Carpeta exclusiva para la sesión de prueba de Baileys (no interfiere con whatsapp-web.js)
const AUTH_DIR = './baileys_auth_test';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) // Silenciamos los logs internos ruidosos de Baileys
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Escaneá este QR con el celular de la agencia:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexión cerrada. Motivo:', lastDisconnect.error?.output?.statusCode);
            if (shouldReconnect) {
                console.log('🔄 Reconectando...');
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n✅ ¡Conexión exitosa con Baileys!');
            console.log('Número conectado:', sock.user?.id?.split(':')[0]);
            
            // Esperamos 2 segundos y ejecutamos la prueba de envío
            setTimeout(() => probarEnvio(sock), 2000);
        }
    });
}

async function probarEnvio(sock) {
    // ⚠️ CAMBIÁ ESTE NÚMERO por uno de tu planilla que te esté dando problemas
    const numeroPrueba = '5493517460660'; 
    
    // Baileys requiere estrictamente el formato: numero@s.whatsapp.net
    const jid = `${numeroPrueba}@s.whatsapp.net`;
    const mensaje = `Hola, este es un mensaje de prueba desde la nueva librería Baileys. ¿Me recibís?`;

    console.log(`\n📤 Intentando enviar a: ${numeroPrueba}...`);

    try {
        await sock.sendMessage(jid, { text: mensaje });
        console.log('✅ ¡MENSAJE ENVIADO CON ÉXITO! Baileys manejó el ID correctamente.');
    } catch (err) {
        console.error('❌ Error al enviar con Baileys:', err.message);
    }

    console.log('\n💡 Prueba finalizada. Podés cerrar la consola con Ctrl + C.');
}

// Iniciar
console.log('🚀 Iniciando prueba de Baileys...');
connectToWhatsApp();