'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/session-manager.js
 *
 * v3.4.0
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
 *
 * CHANGELOG v3.4.0:
 *  • FIX CRÍTICO: getUserInstances() solo devolvía instancias
 *    en memoria. Una instancia que quedaba afuera del tope de
 *    auto-restauración (MAX_INSTANCIAS_AUTO_RESTAURADAS, v3.3.0)
 *    era invisible para la UI aunque tuviera sesión de WhatsApp
 *    válida guardada — routes/views.js la contaba como
 *    "sinInstancias" y terminaba creando una instancia nueva de
 *    cero en vez de usar la existente. Ahora getUserInstances
 *    combina memoria + persistencia; las pendientes se marcan
 *    con iniciada:false.
 *  • FIX: se eliminó una definición duplicada de getUserInstances
 *    (código muerto, quedó de un merge anterior).
 *  • NUEVO: iniciarSiNecesario(userId, io, instanceId) — arranca
 *    una instancia persistida solo si no está corriendo en
 *    memoria, sin crear una nueva. Para usar en routes/views.js
 *    cuando el usuario elige/cae en una instancia "pendiente".
 *
 * CHANGELOG v3.3.0:
 *  • FIX: se agregó MAX_INSTANCIAS_AUTO_RESTAURADAS (default 2)
 *    en restaurarSesiones. Con RAM limitada (8GB), auto-restaurar
 *    todas las instancias guardadas (aunque el usuario solo use
 *    2 en la práctica) revienta la máquina: cada instancia que
 *    termina de inicializar se queda corriendo en memoria, así
 *    que el límite de concurrencia de arranque no alcanza para
 *    evitar el problema en estado estable. Ahora, al llegar al
 *    tope, las instancias sobrantes NO se auto-inician — quedan
 *    disponibles para iniciarlas a mano desde la interfaz.
 *    Ajustar la constante según la RAM de la máquina.
 *  • FIX: se agregaron flags de Puppeteer para desactivar el
 *    crash-reporter de Chrome (--disable-crash-reporter,
 *    --disable-breakpad, --no-crash-upload), que era la causa
 *    de los errores "EBUSY: resource busy or locked, unlink
 *    ...CrashpadMetrics-active.pma" al correr varios Chrome en
 *    simultáneo en Windows.
 *
 * CHANGELOG v3.2.0:
 *  • FIX: se agregó un límite de inicializaciones concurrentes
 *    (MAX_INIT_CONCURRENTES = 2). Con muchas instancias
 *    arrancando Chrome al mismo tiempo (restauración al boot +
 *    instancias nuevas desde la UI) la máquina se quedaba sin
 *    RAM/CPU y Chrome se cerraba a mitad de la inicialización
 *    (TargetCloseError: Target closed). Ahora initialize() se
 *    encola y solo corren 2 en simultáneo; el resto espera su
 *    turno. Se puede subir MAX_INIT_CONCURRENTES si la máquina
 *    tiene recursos de sobra.
 *
 * CHANGELOG v3.1.0:
 *  • FIX CRÍTICO: se agregó shutdown() (no existía). index.js
 *    lo llama en SIGINT/SIGTERM pero, al no existir, los
 *    clientes de WhatsApp (y sus procesos de Chrome) nunca se
 *    cerraban limpio. Chrome deja un archivo SingletonLock en
 *    la carpeta de sesión mientras corre y solo lo borra al
 *    cerrar limpio. Sin ese cierre, el lock queda huérfano y
 *    en el próximo arranque Puppeteer se cuelga para siempre
 *    esperando poder tomarlo — sin error, sin timeout. Esto es
 *    lo que causaba que la app se quedara "esperando el QR"
 *    indefinidamente.
 *  • FIX: limpiarLocksSesion() borra SingletonLock/Cookie/Socket
 *    huérfanos ANTES de crear cada cliente, para autorepararse
 *    aunque ya haya quedado un lock viejo de antes de este fix.
 *  • FIX: se agregó timeout/protocolTimeout a Puppeteer como
 *    red de seguridad — si algo se cuelga igual, tira error en
 *    vez de esperar para siempre.
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
// LÍMITE DE INICIALIZACIONES CONCURRENTES
//==============================================================
//
// Cada instancia abre su propio Chrome headless. Inicializar
// muchas al mismo tiempo (restauración al arrancar + instancias
// nuevas creadas desde la UI) puede agotar RAM/CPU y hacer que
// Chrome se cierre a mitad de camino (TargetCloseError: Target
// closed). Se limita cuántos initialize() corren en simultáneo;
// el resto espera su turno en una cola simple FIFO.
//==============================================================

const MAX_INIT_CONCURRENTES = 2;

let initEnCurso = 0;

const colaInit = [];

function adquirirTurnoInit() {

    return new Promise(resolve => {

        const intentar = () => {

            if (

                initEnCurso < MAX_INIT_CONCURRENTES

            ) {

                initEnCurso++;

                resolve();

            }

            else {

                colaInit.push(intentar);

            }

        };

        intentar();

    });

}

function liberarTurnoInit() {

    initEnCurso--;

    const siguiente =

        colaInit.shift();

    if (siguiente) {

        siguiente();

    }

}

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
// LIMPIAR LOCKS DE CHROME (SESIONES HUÉRFANAS)
//==============================================================
//
// Si el proceso se cierra sin llamar a client.destroy() (ej:
// Ctrl+C sin shutdown limpio, crash, kill del proceso), Chrome
// deja un SingletonLock en la carpeta de perfil y nunca lo
// borra. En el próximo arranque, Puppeteer intenta abrir Chrome
// en esa misma carpeta, ve el lock, y se queda esperando para
// siempre sin tirar error ni timeout — initialize() nunca
// resuelve. Se limpian esos archivos ANTES de crear el cliente.
//==============================================================

function limpiarLocksSesion(instanceId) {

    const sessionDir =

        path.join(

            SESSIONS_DIR,

            `session-${instanceId}`

        );

    if (

        !fs.existsSync(sessionDir)

    ) {

        return;

    }

    const archivosLock = [

        'SingletonLock',

        'SingletonCookie',

        'SingletonSocket'

    ];

    for (const nombre of archivosLock) {

        const ruta =

            path.join(

                sessionDir,

                nombre

            );

        try {

            if (

                fs.existsSync(ruta)

            ) {

                fs.rmSync(

                    ruta,

                    {

                        force: true

                    }

                );

                console.log(

                    `🧹 Lock huérfano eliminado: ${nombre} (${instanceId})`

                );

            }

        }

        catch (err) {

            console.warn(

                `⚠ No se pudo limpiar ${nombre} (${instanceId}):`,

                err.message

            );

        }

    }

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

console.log("================================");
console.log("CREANDO INSTANCIA EN MEMORIA");
console.log("Usuario:", userId);
console.log("Instancia:", instanceId);
console.log("================================");

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

console.log(
    "Instancias en memoria:",
    [...userSession.instances.keys()]
);

    }

guardarInstancia(

    userId,

    instanceId,

    {

        numero: '',

        listo: false,

        estado: getEstadoInstancia(instanceId)

    }

);

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
    // Limpiar locks huérfanos antes de crear el cliente
    //----------------------------------------------------------

    limpiarLocksSesion(instanceId);

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

            timeout: 60000,

            protocolTimeout: 60000,

            args: [

                '--no-sandbox',

                '--disable-setuid-sandbox',

                '--disable-dev-shm-usage',

                '--disable-gpu',

                '--disable-crash-reporter',

                '--disable-breakpad',

                '--no-crash-upload'

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

            guardarInstancia(

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

    await adquirirTurnoInit();

    try {

    //TEMPORAL INI

    console.log("1 - Antes initialize");

const p = client.initialize();

console.log("2 - initialize() llamado");

await p;

console.log("3 - initialize() terminó");

    //TEMPORAL FIN

    }

    catch (err) {

        console.error(

            `❌ Error inicializando ${instanceId}`

        );

        console.error(err);

        clients.delete(instanceId);

        throw err;

    }

    finally {

        liberarTurnoInit();

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

//==============================================================
// TOPE DE INSTANCIAS AUTO-RESTAURADAS AL ARRANCAR
//==============================================================
//
// Con RAM limitada, restaurar TODAS las instancias guardadas
// (aunque sean 8) revienta la máquina aunque se limite la
// concurrencia de arranque (MAX_INIT_CONCURRENTES), porque cada
// una que termina de inicializar se queda corriendo en memoria.
// Se pone un techo al total de instancias que se auto-restauran
// al boot; las que sobran quedan sin arrancar (el usuario las
// puede iniciar a mano desde la UI cuando las necesite).
// Ajustar según la RAM disponible de la máquina.
//==============================================================

const MAX_INSTANCIAS_AUTO_RESTAURADAS = 2;

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

            if (

                clients.size >= MAX_INSTANCIAS_AUTO_RESTAURADAS

            ) {

                console.log(

                    `⏸ Tope de instancias auto-restauradas (${MAX_INSTANCIAS_AUTO_RESTAURADAS}) alcanzado. ` +

                    `"${instancia.id}" no se inicia automáticamente — iniciala desde la interfaz si la necesitás.`

                );

                continue;

            }

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
// INICIAR INSTANCIA SI HACE FALTA
//==============================================================
//
// Arranca una instancia existente (persistida) SOLO si todavía
// no está corriendo en memoria. No crea nada nuevo — para eso ya
// existe /nueva-instancia. Pensado para cuando el usuario elige
// o cae en una instancia que quedó "pendiente" por el tope de
// auto-restauración (ver getUserInstances). Respeta la cola de
// concurrencia (adquirirTurnoInit) como cualquier otro arranque.
//==============================================================

async function iniciarSiNecesario(userId, io, instanceId){

    if(

        clients.has(instanceId)

    ){

        return false;

    }

    await startSession(

        userId,

        io,

        instanceId

    );

    return true;

}

//==============================================================
// OBTENER INSTANCIAS DEL USUARIO
//==============================================================

//==============================================================
// OBTENER INSTANCIAS DEL USUARIO
//==============================================================
//
// Combina lo que está corriendo en memoria con lo persistido en
// disco. Antes solo devolvía lo que estaba en memoria: si una
// instancia quedaba afuera del tope de auto-restauración
// (MAX_INSTANCIAS_AUTO_RESTAURADAS), era invisible para la UI
// aunque tuviera una sesión de WhatsApp válida guardada — la
// vista pensaba "este usuario no tiene instancias" y terminaba
// creando una nueva de cero (routes/views.js: sinInstancias).
// Ahora las pendientes se listan igual, marcadas con
// iniciada:false, para que la UI pueda arrancarlas en vez de
// duplicarlas.
//==============================================================

function getUserInstances(userId){

    const session =

        sessions.get(userId);

    const enMemoria =

        session

            ? [...session.instances.values()]

            : [];

    const idsEnMemoria =

        new Set(

            enMemoria.map(i => i.id)

        );

    const persistidas =

        obtenerInstanciasPorUsuario(userId);

    const pendientes =

        persistidas

            .filter(

                p => !idsEnMemoria.has(p.id)

            )

            .map(p => ({

                id: p.id,

                numero: p.numero || '',

                listo: p.listo || false,

                estado: null,

                iniciada: false

            }));

    return [

        ...enMemoria.map(

            i => ({

                ...i,

                iniciada: true

            })

        ),

        ...pendientes

    ];

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
// SHUTDOWN
//==============================================================
//
// index.js llama a sessionManager.shutdown() al recibir
// SIGINT/SIGTERM, pero esta función no existía — por eso los
// clientes de WhatsApp (y sus procesos de Chrome) nunca se
// cerraban limpio, dejando locks huérfanos que colgaban el
// próximo arranque (ver limpiarLocksSesion).
//==============================================================

async function shutdown() {

    console.log(

        `🛑 Cerrando ${clients.size} cliente(s) de WhatsApp...`

    );

    const destrucciones =

        [...clients.entries()].map(

            async ([instanceId, client]) => {

                try {

                    await gracefulDestroy(client);

                    console.log(

                        `✅ Cliente cerrado: ${instanceId}`

                    );

                }

                catch (err) {

                    console.warn(

                        `⚠ Error cerrando ${instanceId}:`,

                        err.message

                    );

                }

            }

        );

    await Promise.allSettled(

        destrucciones

    );

    clients.clear();

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

    iniciarSiNecesario,

    registerSocket,

    unregisterSocket,

    emitQr,

    emitReady,

    emitInstancesUpdate,

    shutdown

};