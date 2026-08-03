'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/session-manager.js
 *
 * Versión : v2.0.0
 *
 * REBUILD TOTAL
 * =============================================================
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const { Client, LocalAuth } =
    require('whatsapp-web.js');

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
    guardarInstancia: guardarInstanciaPersistencia,
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
    path.join(__dirname,'..','sessions');

const CHROME_PROFILES =
    path.join(__dirname,'..','chrome-profiles');

fs.mkdirSync(SESSIONS_DIR,{recursive:true});
fs.mkdirSync(CHROME_PROFILES,{recursive:true});


//==============================================================
// CHROME
//==============================================================

function findChromePath(){

    const posibles=[

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

        p=>fs.existsSync(p)

    );

}


//==============================================================
// QR
//==============================================================

async function generarQrImagen(qr){

    try{

        if(

            typeof qr==='string' &&

            qr.startsWith('data:image')

        ){

            return qr;

        }

        return await QRCode.toDataURL(

            qr,

            {

                errorCorrectionLevel:'H',

                margin:2,

                width:300

            }

        );

    }

    catch(err){

        console.error(err);

        return qr;

    }

}


//==============================================================
// DESTROY
//==============================================================

async function gracefulDestroy(client){

    if(!client)
        return;

    try{

        client.removeAllListeners();

    }

    catch{}

    try{

        if(client.browser){

            await client.browser.close();

        }

    }

    catch{}

    try{

        await client.destroy();

    }

    catch{}

}


//==============================================================
// GETTERS
//==============================================================

function getUserSession(userId){

    return sessions.get(userId) || null;

}

function getClient(instanceId){

    return clients.get(instanceId) || null;

}

function getActiveInstanceId(userId){

    return sessions.get(userId)?.activeId || null;

}

function getQrCode(){

    return null;

}

function getEstado(userId){

    const session = sessions.get(userId);

    if(!session)
        return null;

    if(!session.activeId)
        return null;

    return getEstadoInstancia(

        session.activeId

    );

}

function getUserInstances(userId){

    const session = sessions.get(userId);

    if(!session)
        return [];

    return [...session.instances.entries()].map(

        ([id,inst])=>({

            id,

            numero:inst.numero || '',

            listo:inst.listo || false,

            estado:inst.estado || null

        })

    );

}

function setActiveInstance(

    userId,

    instanceId

){

    const session = sessions.get(userId);

    if(!session)
        return;

    if(!session.instances.has(instanceId))
        return;

    session.activeId = instanceId;

}


//==============================================================
// SOCKETS
//==============================================================

function addSocket(userId,socket){

    if(!userSockets.has(userId)){

        userSockets.set(

            userId,

            new Set()

        );

    }

    userSockets.get(userId).add(socket);

}

function removeSocket(userId,socket){

    const sockets = userSockets.get(userId);

    if(!sockets)
        return;

    sockets.delete(socket);

    if(!sockets.size){

        userSockets.delete(userId);

    }

}

function emitToUser(

    userId,

    event,

    data

){

    const sockets = userSockets.get(userId);

    if(!sockets)
        return;

    for(const socket of sockets){

        try{

            socket.emit(

                event,

                data

            );

        }

        catch{}

    }

}

function emitQr(userId,qr){

    emitToUser(

        userId,

        'qr',

        {qr}

    );

}

function emitReady(userId,data){

    emitToUser(

        userId,

        'whatsapp_ready',

        data

    );

}

function emitInstancesUpdate(userId){

    emitToUser(

        userId,

        'instances_update',

        {

            instancias:

                getUserInstances(userId)

        }

    );

}

//==============================================================
// START SESSION
//==============================================================

async function startSession(userId, io, instanceId) {

    if (clients.has(instanceId)) {

        console.log(`♻️ Reutilizando instancia ${instanceId}`);

        return clients.get(instanceId);

    }

    console.log(`📱 Iniciando sesión ${instanceId}`);

    //----------------------------------------------------------
    // SESIÓN
    //----------------------------------------------------------

    if (!sessions.has(userId)) {

        sessions.set(userId, {

            activeId: instanceId,

            instances: new Map()

        });

    }

    const userSession = sessions.get(userId);

    //----------------------------------------------------------
    // ESTADO
    //----------------------------------------------------------

    const estado = getEstadoInstancia(instanceId);

    if (!userSession.instances.has(instanceId)) {

        userSession.instances.set(

            instanceId,

            {

                numero: estado.numeroWhatsApp || '',

                listo: false,

                estado,

                client: null

            }

        );

    }

    //----------------------------------------------------------
    // CHROME PROFILE
    //----------------------------------------------------------

    const chromeProfile = path.join(

        CHROME_PROFILES,

        instanceId

    );

    fs.mkdirSync(

        chromeProfile,

        {

            recursive: true

        }

    );

    //----------------------------------------------------------
    // CLIENT
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

                `--user-data-dir=${chromeProfile}`

            ]

        }

    });

    clients.set(

        instanceId,

        client

    );

    userSession.instances.get(instanceId).client = client;

    //----------------------------------------------------------
    // QR
    //----------------------------------------------------------

    let qrCount = 0;

    client.on(

        'qr',

        async qr => {

            qrCount++;

            if (qrCount > MAX_QR_ATTEMPTS)

                return;

            const qrImage =

                await generarQrImagen(qr);

            emitQr(

                userId,

                qrImage

            );

            if (io) {

                io.emit(

                    'qr',

                    {

                        instanceId,

                        qr: qrImage

                    }

                );

            }

        }

    );

    //----------------------------------------------------------
    // AUTH
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

            console.log(

                `✅ ${instanceId} listo`

            );

            let numero = '';

            try {

                numero = client.info.wid.user;

            }

            catch {}

            const inst =

                userSession.instances.get(instanceId);

            inst.numero = numero;

            inst.listo = true;

            guardarInstancia(

                userId,

                instanceId,

                {

                    numero,

                    listo: true,

                    estado: inst.estado

                }

            );

            actualizarEstado(

                instanceId,

                {

                    listo: true,

                    numeroWhatsApp: numero

                }

            );

            guardarEstadoSeguro(instanceId);

            emitReady(

                userId,

                {

                    instanceId,

                    numero

                }

            );

            emitInstancesUpdate(userId);

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

                `⚠️ ${instanceId} desconectado (${reason})`

            );

            const inst =

                userSession.instances.get(instanceId);

            if (inst)

                inst.listo = false;

            actualizarEstado(

                instanceId,

                {

                    listo: false

                }

            );

            emitInstancesUpdate(userId);

            clients.delete(instanceId);

        }

    );

    //----------------------------------------------------------
    // INITIALIZE
    //----------------------------------------------------------

    await client.initialize();

    return client;

}

//==============================================================
// REMOVE INSTANCE
//==============================================================

async function removeInstance(userId, instanceId) {

    const client = clients.get(instanceId);

    if (client) {

        await gracefulDestroy(client);

        clients.delete(instanceId);

    }

    const session = sessions.get(userId);

    if (session) {

        session.instances.delete(instanceId);

        if (session.activeId === instanceId) {

            const restantes =

                [...session.instances.keys()];

            session.activeId =

                restantes.length

                    ? restantes[0]

                    : null;

        }

    }

    //----------------------------------------------------------
    // BORRAR CARPETAS
    //----------------------------------------------------------

    const carpetas = [

        path.join(

            SESSIONS_DIR,

            `session-${instanceId}`

        ),

        path.join(

            CHROME_PROFILES,

            instanceId

        )

    ];

    for (const carpeta of carpetas) {

        try {

            if (fs.existsSync(carpeta)) {

                fs.rmSync(

                    carpeta,

                    {

                        recursive: true,

                        force: true

                    }

                );

            }

        }

        catch (err) {

            console.warn(

                `No pudo eliminarse ${carpeta}`

            );

        }

    }

    //----------------------------------------------------------
    // PERSISTENCIA
    //----------------------------------------------------------

    try {

        eliminarInstancia(

            userId,

            instanceId

        );

    }

    catch (err) {

        console.error(err);

    }

    emitInstancesUpdate(userId);

    console.log(

        `🗑️ Instancia eliminada ${instanceId}`

    );

}


//==============================================================
// RESTAURAR TODAS
//==============================================================

async function restaurarTodas(io) {

    console.log(

        '🔄 Restaurando sesiones...'

    );

    const usuarios =

        obtenerTodosLosUsuarios();

    for (const userId of usuarios) {

        const instancias =

            obtenerInstanciasPorUsuario(userId);

        if (!sessions.has(userId)) {

            sessions.set(

                userId,

                {

                    activeId: null,

                    instances: new Map()

                }

            );

        }

        const session =

            sessions.get(userId);

        for (const instancia of instancias) {

            session.instances.set(

                instancia.id,

                {

                    numero:

                        instancia.numero || '',

                    listo:

                        instancia.listo || false,

                    estado:

                        instancia.estado ||

                        getEstadoInstancia(instancia.id),

                    client:

                        null

                }

            );

            if (!session.activeId) {

                session.activeId =

                    instancia.id;

            }

        }

    }

    //----------------------------------------------------------
    // INICIAR TODAS
    //----------------------------------------------------------

    for (

        const [

            userId,

            session

        ] of sessions

    ) {

        for (

            const instanceId of

            session.instances.keys()

        ) {

            try {

                await startSession(

                    userId,

                    io,

                    instanceId

                );

            }

            catch (err) {

                console.error(

                    `❌ Error restaurando ${instanceId}:`,

                    err.message

                );

            }

        }

    }

    console.log(

        '✅ Restauración finalizada'

    );

}


//==============================================================
// SHUTDOWN
//==============================================================

async function shutdown() {

    console.log(

        '🛑 Cerrando Session Manager...'

    );

    for (

        const client of clients.values()

    ) {

        try {

            await gracefulDestroy(client);

        }

        catch (err) {}

    }

    clients.clear();

    sessions.clear();

    userSockets.clear();

    console.log(

        '✅ Session Manager detenido'

    );

}

//==============================================================
// INSTANCE IDS
//==============================================================

function getInstanceIds() {

    return [...clients.keys()];

}


//==============================================================
// COMPATIBILIDAD
//==============================================================

function guardarInstancia(

    userId,

    instanceId,

    data

) {

    return guardarInstanciaPersistencia(

        userId,

        instanceId,

        data

    );

}


//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    // Sesiones
    getUserSession,
    getUserInstances,
    getEstado,
    getActiveInstanceId,
    setActiveInstance,

    // Clientes
    getClient,
    getQrCode,
    getInstanceIds,

    // Persistencia
    guardarInstancia,
    removeInstance,
    restaurarTodas,

    // Eventos
    addSocket,
    removeSocket,
    emitQr,
    emitReady,
    emitInstancesUpdate,

    // WhatsApp
    startSession,

    // Cierre
    shutdown

};