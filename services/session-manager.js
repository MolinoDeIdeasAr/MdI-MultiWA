'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/session-manager.js
 *
 * v3.0.0
 *
 * Session Manager ÚNICO
 *
 * Responsabilidades
 * -----------------
 * • Crear clientes WhatsApp.
 * • Restaurar sesiones.
 * • Manejar eventos.
 * • Exponer getClient().
 * • Exponer getEstado().
 * • Persistir instancias.
 *
 * NO maneja campañas.
 * NO maneja scheduler.
 * NO envía mensajes.
 * =============================================================
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const {
    Client,
    LocalAuth
} = require('whatsapp-web.js');

const {

    getEstadoInstancia,
    actualizarEstado,
    guardarEstadoSeguro

} = require('../state/estado');

const {

    handleInboundMessage

} = require('./inbound-message-handler');

const {

    obtenerInstanciasPorUsuario,
    obtenerTodosLosUsuarios,
    guardarInstancia,
    eliminarInstancia

} = require('./instancias-persistencia');


//==============================================================
// CONSTANTES
//==============================================================

const MAX_QR_ATTEMPTS = 5;

const sessions = new Map();

const clients = new Map();

const userSockets = new Map();

const SESSIONS_DIR =
    path.join(__dirname, '..', 'sessions');


fs.mkdirSync(SESSIONS_DIR, {
    recursive: true
});

//==============================================================
// CHROME
//==============================================================

function findChromePath() {

    const posibles = [

        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',

        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',

        path.join(

            process.env.LOCALAPPDATA || '',

            'Google',

            'Chrome',

            'Application',

            'chrome.exe'

        )

    ];

    return posibles.find(

        p => fs.existsSync(p)

    );

}

//==============================================================
// QR
//==============================================================

async function generarQrImagen(qr) {

    try {

        if (

            typeof qr === 'string' &&

            qr.startsWith('data:image')

        ) {

            return qr;

        }

        return await QRCode.toDataURL(

            qr,

            {

                errorCorrectionLevel: 'H',

                margin: 2,

                width: 300

            }

        );

    }

    catch (err) {

        console.error(err);

        return qr;

    }

}

//==============================================================
// DESTROY
//==============================================================

async function gracefulDestroy(client) {

    if (!client)
        return;

    try {

        client.removeAllListeners();

    }

    catch {}

    try {

        if (client.pupBrowser) {

            await client.pupBrowser.close();

        }

        else if (client.browser) {

            await client.browser.close();

        }

    }

    catch {}

    try {

        await client.destroy();

    }

    catch {}

}

//==============================================================
// GETTERS
//==============================================================

function getUserSession(userId) {

    return sessions.get(userId) || null;

}

function getClient(instanceId) {

    return clients.get(instanceId) || null;

}

function getActiveInstanceId(userId) {

    return sessions.get(userId)?.activeId || null;

}

function getQrCode() {

    return null;

}

function getEstado(userId) {

    const session = sessions.get(userId);

    if (!session)
        return null;

    if (!session.activeId)
        return null;

    return getEstadoInstancia(

        session.activeId

    );

}

//==============================================================
// SOCKET HELPERS
//==============================================================

function emitQr(userId, qr) {

    const socket = userSockets.get(userId);

    if (!socket)
        return;

    socket.emit(

        'qr',

        qr

    );

}

function emitReady(userId, data) {

    const socket = userSockets.get(userId);

    if (!socket)
        return;

    socket.emit(

        'whatsapp_ready',

        data

    );

}

function emitInstancesUpdate(userId) {

    const socket = userSockets.get(userId);

    if (!socket)
        return;

    const session = sessions.get(userId);

    if (!session)
        return;

    socket.emit(

        'instances_updated',

        [...session.instances.values()]

    );

}

//==============================================================
// START SESSION
//==============================================================

async function startSession(

    userId,

    io,

    instanceId

) {

    console.log(

        `📱 Iniciando sesión ${instanceId}`

    );

    //----------------------------------------------------------
    // Crear sesión de usuario
    //----------------------------------------------------------

    let userSession = sessions.get(userId);

    if (!userSession) {

        userSession = {

            activeId: instanceId,

            instances: new Map()

        };

        sessions.set(

            userId,

            userSession

        );

    }

    //----------------------------------------------------------
    // Registrar instancia
    //----------------------------------------------------------

    if (!userSession.instances.has(instanceId)) {

        userSession.instances.set(

            instanceId,

            {

                id: instanceId,

                numero: '',

                listo: false,

                estado: getEstadoInstancia(instanceId)

            }

        );

    }

    //----------------------------------------------------------
    // Si ya existe un cliente destruirlo
    //----------------------------------------------------------

    if (clients.has(instanceId)) {

        console.log(

            `♻ Reiniciando cliente ${instanceId}`

        );

        await gracefulDestroy(

            clients.get(instanceId)

        );

        clients.delete(instanceId);

    }

    //----------------------------------------------------------
    // Crear Cliente
    //----------------------------------------------------------

    const client = new Client({

        authStrategy: new LocalAuth({

            clientId: instanceId,

            dataPath: SESSIONS_DIR

        }),

        puppeteer: {

            headless: true,

            executablePath: findChromePath(),

            args: [

                '--no-sandbox',

                '--disable-setuid-sandbox',

                '--disable-dev-shm-usage',

                '--disable-gpu',


            ]

        }

    });

    //----------------------------------------------------------
    // Registrar cliente
    //----------------------------------------------------------

    clients.set(

        instanceId,

        client

    );

    userSession.instances.get(

        instanceId

    ).client = client;

    //----------------------------------------------------------
    // Contador QR
    //----------------------------------------------------------

    let qrCount = 0;

    //----------------------------------------------------------
    // QR
    //----------------------------------------------------------

    client.on(

        'qr',

        async qr => {

            qrCount++;

            if (

                qrCount > MAX_QR_ATTEMPTS

            ) {

                console.log(

                    `⚠ Máximo de QR alcanzado (${instanceId})`

                );

                return;

            }

            const qrImage =

                await generarQrImagen(qr);

            emitQr(

                userId,

                {

                    instanceId,

                    qr: qrImage

                }

            );

        }

    );

    //----------------------------------------------------------
    // AUTHENTICATED
    //----------------------------------------------------------

    client.once(

        'authenticated',

        () => {

            console.log(

                `🔐 ${instanceId} autenticado`

            );

        }

    );

    //----------------------------------------------------------
    // READY
    //----------------------------------------------------------

    client.once(

        'ready',

        async () => {

            console.log("");
            console.log("================================");
            console.log("✅ WHATSAPP READY");
            console.log("Instancia:", instanceId);

            //--------------------------------------------------
            // Obtener número correctamente
            //--------------------------------------------------

            let numeroWhatsApp = '';

            try {

                numeroWhatsApp =

                    client.info?.wid?.user || '';

            }

            catch (err) {

                console.warn(

                    "No se pudo obtener client.info.wid.user"

                );

            }

            console.log(

                "Número:",

                numeroWhatsApp

            );

            //--------------------------------------------------
            // Actualizar instancia
            //--------------------------------------------------

            const inst =

                userSession.instances.get(instanceId);

            if (inst) {

                inst.numero = numeroWhatsApp;

                inst.listo = true;

            }

            //--------------------------------------------------
            // Persistir instancia
            //--------------------------------------------------

            guardarInstanciaPersistencia(

                userId,

                instanceId,

                {

                    numero: numeroWhatsApp,

                    listo: true,

                    estado: inst?.estado

                }

            );

            //--------------------------------------------------
            // Actualizar estado
            //--------------------------------------------------

            actualizarEstado(

                instanceId,

                {

                    listo: true,

                    numeroWhatsApp

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // Notificar frontend
            //--------------------------------------------------

            emitReady(

                userId,

                {

                    instanceId,

                    numero: numeroWhatsApp

                }

            );

            emitInstancesUpdate(

                userId

            );

        }

    );

    //----------------------------------------------------------
    // MESSAGE
    //----------------------------------------------------------

    client.on(

        'message',

        async msg => {

            try {

                await handleInboundMessage({

                    msg,

                    client,

                    userId,

                    instanceId,

                    numeroInstancia:

                        client.info?.wid?.user || '',

                    sessions,

                    io,

                    userSockets

                });

            }

            catch (err) {

                console.error(err);

            }

        }

    );

    //----------------------------------------------------------
    // DESCONECTADO
    //----------------------------------------------------------

    client.once(

        'disconnected',

        reason => {

            console.log(

                `⚠ ${instanceId} desconectado (${reason})`

            );

            const inst =

                userSession.instances.get(instanceId);

            if (inst) {

                inst.listo = false;

            }

            actualizarEstado(

                instanceId,

                {

                    listo: false

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            emitInstancesUpdate(

                userId

            );

            clients.delete(

                instanceId

            );

        }

    );

    //----------------------------------------------------------
    // INITIALIZE
    //----------------------------------------------------------

    try {

        await client.initialize();

        console.log(

            `🚀 initialize() ejecutado (${instanceId})`

        );

    }

    catch (err) {

        console.error(

            `❌ Error inicializando ${instanceId}`

        );

        console.error(err);

        clients.delete(instanceId);

        throw err;

    }

    //----------------------------------------------------------
    // DEVOLVER CLIENTE
    //----------------------------------------------------------

    return client;

}

//==============================================================
// REMOVE INSTANCE
//==============================================================

async function removeInstance(

    userId,

    instanceId

) {

    const client =

        clients.get(instanceId);

    if (client) {

        await gracefulDestroy(client);

        clients.delete(instanceId);

    }

    const session =

        sessions.get(userId);

    if (session) {

        session.instances.delete(instanceId);

        if (

            session.activeId === instanceId

        ) {

            const restantes =

                [...session.instances.keys()];

            session.activeId =

                restantes.length

                    ? restantes[0]

                    : null;

        }

    }

    eliminarInstancia(

        userId,

        instanceId

    );

}

//==============================================================
// RESTAURAR SESIONES
//==============================================================

async function restaurarSesiones(io) {

    console.log(

        "🔄 Restaurando sesiones..."

    );

    const usuarios =

        obtenerTodosLosUsuarios();

    for (const userId of usuarios) {

        const instancias =

            obtenerInstanciasPorUsuario(userId);

        if (!instancias)

            continue;

        for (const instancia of instancias) {

            try {

                await startSession(

                    userId,

                    io,

                    instancia.id

                );

            }

            catch (err) {

                console.error(

                    `❌ Error restaurando ${instancia.id}: ${err.message}`

                );

            }

        }

    }

    console.log(

        "✅ Restauración finalizada"

    );

}

//==============================================================
// EMISORES SOCKET
//==============================================================

function emitQr(

    userId,

    payload

) {

    const socket =

        userSockets.get(userId);

    if (socket) {

        socket.emit(

            'qr',

            payload

        );

    }

}

function emitReady(

    userId,

    payload

) {

    const socket =

        userSockets.get(userId);

    if (socket) {

        socket.emit(

            'whatsapp_ready',

            payload

        );

    }

}

function emitInstancesUpdate(

    userId

) {

    const socket =

        userSockets.get(userId);

    if (!socket)

        return;

    const session =

        sessions.get(userId);

    if (!session)

        return;

    const lista =

        [...session.instances.values()]

            .map(inst => ({

                id: inst.id,

                numero:

                    inst.numero || '',

                listo:

                    !!inst.listo

            }));

    socket.emit(

        'instances_update',

        lista

    );

}

//==============================================================
// SOCKETS
//==============================================================

function registerSocket(

    userId,

    socket

) {

    userSockets.set(

        userId,

        socket

    );

}

function unregisterSocket(

    userId

) {

    userSockets.delete(

        userId

    );

}

//==============================================================
// COMPATIBILIDAD
//==============================================================

async function restaurarTodas(io){

    return restaurarSesiones(io);

}

//==============================================================
// OBTENER INSTANCIAS DEL USUARIO
//==============================================================

function getUserInstances(userId){

    const session = sessions.get(userId);

    if(!session){

        return [];

    }

    return [...session.instances.values()];

}

function getUserInstances(userId){

    const session = sessions.get(userId);

    if(!session){

        return [];

    }

    return [...session.instances.values()];

}

function setActiveInstance(

    userId,

    instanceId

){

    const session =

        sessions.get(userId);

    if(!session){

        return false;

    }

    if(

        !session.instances.has(instanceId)

    ){

        return false;

    }

    session.activeId = instanceId;

    return true;

}

function guardarInstanciaSesion(

    userId,

    instanceId,

    datos

){

    const session =

        sessions.get(userId);

    if(!session){

        return false;

    }

    const actual =

        session.instances.get(instanceId);

    if(!actual){

        return false;

    }

    Object.assign(

        actual,

        datos

    );

    session.instances.set(

        instanceId,

        actual

    );

    guardarInstanciaPersistencia(

        userId,

        instanceId,

        actual

    );

    return true;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    getClient,

    getEstado,

    getQrCode,

    getUserSession,

    getUserInstances,

    getActiveInstanceId,

    setActiveInstance,

    guardarInstancia: guardarInstanciaSesion,

    startSession,

    removeInstance,

    restaurarSesiones,

    restaurarTodas,

    registerSocket,

    unregisterSocket,

    emitQr,

    emitReady,

    emitInstancesUpdate

};