'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const QRCode = require('qrcode');

const {
    handleInboundMessage
} = require('./inbound-message-handler');

const {
    getEstadoInstancia,
    actualizarEstado,
    guardarEstadoSeguro
} = require('../state/estado');

//==============================================================
// HELPERS
//==============================================================

async function generarQrImagen(qr) {

    try {

        if (
            qr &&
            (qr.startsWith('2@') || qr.startsWith('3@'))
        ) {

            return await QRCode.toDataURL(qr, {

                errorCorrectionLevel: 'H',

                margin: 2,

                width: 300,

                color: {

                    dark: '#000000',

                    light: '#ffffff'

                }

            });

        }

        if (qr.startsWith('data:image')) {

            return qr;

        }

        return `data:image/png;base64,${qr}`;

    }
    catch (err) {

        console.error(

            'Error generando QR:',

            err.message

        );

        return qr;

    }

}

//==============================================================
// REGISTRAR EVENTOS
//==============================================================

function registrarEventos({

    client,

    userId,

    instanceId,

    session,

    io,

    sessions,

    userSockets,

    emitQr,

    emitReady,

    emitInstancesUpdate,

    guardarInstancia,

    gracefulDestroy

}) {

    //----------------------------------------------------------
    // Evitar handlers duplicados
    //----------------------------------------------------------

    client.removeAllListeners('qr');
    client.removeAllListeners('authenticated');
    client.removeAllListeners('ready');
    client.removeAllListeners('message');
    client.removeAllListeners('disconnected');

    //----------------------------------------------------------
    // Contador de QR
    //----------------------------------------------------------

    let qrCount = 0;

    //----------------------------------------------------------
    // QR
    //----------------------------------------------------------

    client.on(

        'qr',

        async (qr) => {

            qrCount++;

            if (qrCount > 5) {

                console.warn(

                    `⚠️ Demasiados QR para ${instanceId}`

                );

                await gracefulDestroy(client);

                return;

            }

            console.log(

                `📱 QR ${qrCount}/5 -> ${instanceId}`

            );

            const qrImage = await generarQrImagen(qr);

            emitQr(

                userId,

                qrImage

            );

            if (io) {

                io.emit(

                    'qr',

                    {

                        qr: qrImage

                    }

                );

            }

        }

    );

    //----------------------------------------------------------
    // AUTHENTICATED
    //----------------------------------------------------------

    client.on(

        'authenticated',

        () => {

            console.log(

                `🔐 Autenticado: ${instanceId}`

            );

        }

    );

    //----------------------------------------------------------
    // READY
    //----------------------------------------------------------

    client.on(

        'ready',

        async () => {

            console.log(

                `✅ Cliente listo: ${instanceId}`

            );

            let numero = '';

            try {

                const wid = client.info?.wid;

                if (wid) {

                    if (
                        typeof wid === 'object' &&
                        wid.user
                    ) {

                        numero = wid.user;

                    }
                    else if (
                        typeof wid === 'string'
                    ) {

                        numero =
                            wid.split('@')[0];

                    }
                    else if (
                        wid._serialized
                    ) {

                        numero =
                            wid._serialized
                                .split('@')[0];

                    }

                }

                if (

                    !numero &&

                    client.info?.me?._serialized

                ) {

                    numero =

                        client.info
                            .me
                            ._serialized
                            .split('@')[0];

                }

                if (numero) {

                    console.log(

                        `📞 Número: ${numero}`

                    );

                }
                else {

                    console.warn(

                        `⚠️ Sin número para ${instanceId}`

                    );

                }

            }
            catch (err) {

                console.warn(

                    '⚠️ Error obteniendo número:',

                    err.message

                );

            }

            //--------------------------------------------------
            // Estado
            //--------------------------------------------------

            const instancia =

                session.instances.get(
                    instanceId
                );

            if (instancia) {

                instancia.numero = numero;

                instancia.listo = true;

            }

            actualizarEstado(

                instanceId,

                {

                    listo: true,

                    numeroWhatsApp: numero

                }

            );

            guardarInstancia(

                userId,

                instanceId,

                {

                    numero,

                    listo: true

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // Eventos
            //--------------------------------------------------

            emitReady(

                userId,

                {

                    instanceId,

                    numero

                }

            );

            if (io) {

                io.emit(

                    'whatsapp_ready',

                    {

                        instanceId,

                        numero

                    }

                );

            }

            emitInstancesUpdate(

                userId

            );

            //--------------------------------------------------
            // Guardar para handler MESSAGE
            //--------------------------------------------------

            client.__numeroInstancia = numero;

        }

    );

    //----------------------------------------------------------
    // MESSAGE
    //----------------------------------------------------------

    client.on(

        'message',

        async (msg) => {

            try {

                await handleInboundMessage({

                    msg,

                    client,

                    userId,

                    instanceId,

                    numeroInstancia:

                        client.__numeroInstancia ||

                        '',

                    sessions,

                    io,

                    userSockets

                });

            }
            catch (err) {

                console.error(

                    `❌ Error procesando mensaje (${instanceId}):`,

                    err.message

                );

            }

        }

    );

    //----------------------------------------------------------
    // DISCONNECTED
    //----------------------------------------------------------

    client.on(

        'disconnected',

        async (reason) => {

            console.log(

                `⚠️ Desconectado ${instanceId}: ${reason}`

            );

            const instancia =

                session.instances.get(

                    instanceId

                );

            if (instancia) {

                instancia.listo = false;

            }

            actualizarEstado(

                instanceId,

                {

                    listo: false

                }

            );

            guardarInstancia(

                userId,

                instanceId,

                {

                    numero:

                        instancia?.numero ||

                        '',

                    listo: false

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            emitInstancesUpdate(

                userId

            );

        }

    );

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = registrarEventos;