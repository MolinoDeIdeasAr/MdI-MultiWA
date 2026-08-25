'use strict';

/**
=============================================================
MdI MultiWA
services/session-manager.js
v3.5.0

Session Manager ÚNICO

Responsabilidades
• Crear clientes WhatsApp.
• Restaurar sesiones.
• Manejar eventos.
• Exponer getClient().
• Exponer getEstado().
• Persistir instancias.

NO maneja campañas.
NO maneja scheduler.
NO envía mensajes.

CHANGELOG v3.5.0:
• NUEVO: handler de evento 'auth_failure' — si la autenticación
  de WhatsApp falla (sesión guardada inválida/corrupta), se marca
  la instancia como no lista, se persiste el estado y se notifica
  al frontend. Antes este evento no se escuchaba y el cliente
  quedaba en un estado indefinido sin avisar nada.
• NUEVO: reanudación automática de campañas al conectar. Si la
  instancia tenía una campaña activa cuando el servidor se
  apagó/reinició (estado.enviando === true, no finalizada y no
  pausada manualmente), apenas WhatsApp emite 'ready' se reanuda
  sola la campaña desde el contacto donde quedó. El require del
  scheduler es lazy (dentro del handler) para evitar dependencia
  circular de módulos.
• LIMPIEZA: se eliminaron los logs temporales de debug marcados
  con "TEMPORAL INI/FIN" en la sección INITIALIZE.
• FIX: se corrigió guardarInstanciaSesion() que llamaba a
  guardarInstanciaPersistencia() (función inexistente). Ahora
  llama a guardarInstancia() que es la importada de
  instancias-persistencia.
=============================================================
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
    guardarEstadoSeguro,
    eliminarEstadoMemoria
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
const socketNotifier =
    require('./socket-notifier');

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
// START SESSION
//==============================================================

const inicializacionesEnCurso = new Map();

async function startSession(
    userId,
    io,
    instanceId
) {
    if (
        inicializacionesEnCurso.has(instanceId)
    ) {
        console.log(
            `⏳ startSession(${instanceId}) ya en curso — esperando esa misma inicialización`
        );
        return inicializacionesEnCurso.get(instanceId);
    }

    const promesa =
        startSessionInterno(
            userId,
            io,
            instanceId
        ).finally(() => {
            inicializacionesEnCurso.delete(
                instanceId
            );
        });

    inicializacionesEnCurso.set(
        instanceId,
        promesa
    );

    return promesa;
}

async function startSessionInterno(
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

    //----------------------------------------------------------
    // Resetear "listo" del estado
    //----------------------------------------------------------

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
    // Limpiar locks huérfanos
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
                    `⚠ Máximo de QR alcanzado (${instanceId}) — cerrando cliente para liberar recursos`
                );
                try {
                    await gracefulDestroy(
                        client
                    );
                }
                catch (err) {
                    console.warn(
                        `⚠ Error cerrando cliente tras máximo de QR (${instanceId}):`,
                        err.message
                    );
                }
                clients.delete(
                    instanceId
                );
                emitInstancesUpdate(
                    userId,
                    io
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
                },
                io
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
    // AUTH_FAILURE (NUEVO v3.5.0)
    //----------------------------------------------------------

    client.once(
        'auth_failure',
        (mensaje) => {
            console.log(
                `❌ ${instanceId} auth_failure: ${mensaje || 'sin detalle'}`
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
                userId,
                io
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
            // Marcar presencia online
            //--------------------------------------------------

            try {
                await client.sendPresenceAvailable();
            }
            catch (err) {
                console.warn(
                    "⚠ No se pudo marcar presencia disponible:",
                    err.message
                );
            }

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
                },
                io
            );

            emitInstancesUpdate(
                userId,
                io
            );

            //--------------------------------------------------
            // REANUDACIÓN AUTOMÁTICA DE CAMPAÑAS (NUEVO v3.5.0)
            //--------------------------------------------------

            try {
                const estadoCampana =
                    getEstadoInstancia(instanceId);

                if (
                    estadoCampana &&
                    estadoCampana.enviando === true &&
                    !estadoCampana.campanaFinalizada &&
                    !estadoCampana.pausado
                ) {
                    console.log(
                        `🔄 Campaña activa detectada (${instanceId}) — se reanudará automáticamente`
                    );

                    setTimeout(async () => {
                        try {
                            const scheduler =
                                require('./campaign-scheduler');

                            console.log(
                                `▶ Reanudando campaña automáticamente (${instanceId}) ` +
                                `desde contacto ${estadoCampana.actual}/${estadoCampana.total}`
                            );

                            await scheduler.iniciar(instanceId);

                            console.log(
                                `✅ Campaña reanudada automáticamente (${instanceId})`
                            );
                        }
                        catch (err) {
                            console.error(
                                `❌ Error reanudando campaña automáticamente (${instanceId}):`,
                                err.message
                            );
                        }
                    }, 5000);
                }
            }
            catch (err) {
                console.warn(
                    `⚠ No se pudo verificar/reanudar campaña (${instanceId}):`,
                    err.message
                );
            }
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

//----------------------------------------------------------
// DESCONECTADO
//----------------------------------------------------------

client.once(
    'disconnected',
    reason => {
        console.log(
            `⚠ ${instanceId} desconectado (${reason})`
        );

        //------------------------------------------------------
        // Marcar como desconectado (siempre)
        //------------------------------------------------------
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

        //------------------------------------------------------
        // CLASIFICAR LA DESCONEXIÓN (NUEVO v3.7.0)
        //------------------------------------------------------
        // Definitivas: el usuario o WhatsApp cerraron la sesión
        // de forma permanente. La próxima vez hay que escanear
        // QR de nuevo, así que borramos la sesión guardada para
        // no acumular carpetas huérfanas.
        //
        // Temporales: corte de red, timeout, crash momentáneo.
        // La sesión sigue válida en el celular, así que se
        // conserva la carpeta de sesión para poder reconectar
        // sin pedir QR.
        //------------------------------------------------------
        const DESCONECTADAS_DEFINITIVAS = [
            'LOGOUT',           // Cerró sesión manualmente
            'UNPAIRED',         // Desvincularon el dispositivo
            'UNPAIRED_IDLE',    // Desvinculado por inactividad
            'CONFLICT'          // Otra sesión abrió la cuenta
        ];

        const esDefinitiva =
            DESCONECTADAS_DEFINITIVAS.includes(reason);

        if (esDefinitiva) {
            console.log(
                `🗑 Desconexión DEFINITIVA (${reason}) - borrando sesión guardada (${instanceId})`
            );

            //--------------------------------------------------
            // 1. Borrar carpeta de sesión del disco
            //--------------------------------------------------
            try {
                const rutaSesion =
                    path.join(
                        SESSIONS_DIR,
                        `session-${instanceId}`
                    );
                if (fs.existsSync(rutaSesion)) {
                    fs.rmSync(
                        rutaSesion,
                        {
                            recursive: true,
                            force: true
                        }
                    );
                    console.log(
                        `🗑 Sesión guardada eliminada (${instanceId})`
                    );
                }
            }
            catch (err) {
                console.warn(
                    `⚠ No se pudo borrar la sesión (${instanceId}):`,
                    err.message
                );
            }

            //--------------------------------------------------
            // 2. Quitar del registro de instancias persistidas
            //--------------------------------------------------
            try {
                eliminarInstancia(
                    userId,
                    instanceId
                );
            }
            catch (err) {
                console.warn(
                    `⚠ No se pudo quitar del registro (${instanceId}):`,
                    err.message
                );
            }

            //--------------------------------------------------
            // 3. Quitar de memoria
            //--------------------------------------------------
            if (userSession.instances.has(instanceId)) {
                userSession.instances.delete(instanceId);
                if (userSession.activeId === instanceId) {
                    const restantes =
                        [...userSession.instances.keys()];
                    userSession.activeId =
                        restantes.length
                            ? restantes[0]
                            : null;
                }
            }

            eliminarEstadoMemoria(
                instanceId
            );
        }
        else {
            console.log(
                `🔄 Desconexión TEMPORAL (${reason}) - conservando sesión guardada para reconectar (${instanceId})`
            );
        }

        //------------------------------------------------------
        // Quitar cliente de memoria (siempre)
        //------------------------------------------------------
        clients.delete(
            instanceId
        );

        //------------------------------------------------------
        // Notificar al frontend
        //------------------------------------------------------
        emitInstancesUpdate(
            userId,
            io
        );
    }
);

    //----------------------------------------------------------
    // INITIALIZE
    //----------------------------------------------------------

    await adquirirTurnoInit();

    try {
        await client.initialize();
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

    //----------------------------------------------------------
    // Limpiar archivos en disco
    //----------------------------------------------------------

    try {
        const estado =
            getEstadoInstancia(
                instanceId
            );
        if (
            estado?.imagenGuardada
        ) {
            const rutaImagen =
                path.join(
                    __dirname,
                    '..',
                    'uploads',
                    estado.imagenGuardada
                );
            if (
                fs.existsSync(rutaImagen)
            ) {
                fs.unlinkSync(
                    rutaImagen
                );
            }
        }
    }
    catch (err) {
        console.warn(
            `⚠ No se pudo borrar la imagen de campaña (${instanceId}):`,
            err.message
        );
    }

    try {
        const rutaEstado =
            path.join(
                __dirname,
                '..',
                'data',
                `estado_${instanceId}.json`
            );
        if (
            fs.existsSync(rutaEstado)
        ) {
            fs.unlinkSync(
                rutaEstado
            );
        }
    }
    catch (err) {
        console.warn(
            `⚠ No se pudo borrar estado_${instanceId}.json:`,
            err.message
        );
    }

    try {
        const rutaSesion =
            path.join(
                SESSIONS_DIR,
                `session-${instanceId}`
            );
        if (
            fs.existsSync(rutaSesion)
        ) {
            fs.rmSync(
                rutaSesion,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }
    catch (err) {
        console.warn(
            `⚠ No se pudo borrar la carpeta de sesión (${instanceId}):`,
            err.message
        );
    }

    eliminarInstancia(
        userId,
        instanceId
    );

    eliminarEstadoMemoria(
        instanceId
    );
}

//==============================================================
// RESTAURAR SESIONES
//==============================================================

const MAX_INSTANCIAS_AUTO_RESTAURADAS = 6;

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
                clients.has(instancia.id)
            ) {
                console.log(
                    `↪ "${instancia.id}" ya está corriendo — se salta en la restauración`
                );
                continue;
            }

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
    payload,
    io
) {
    socketNotifier.emitQr(
        io,
        userId,
        payload
    );
}

function emitReady(
    userId,
    payload,
    io
) {
    socketNotifier.emitReady(
        io,
        userId,
        payload
    );
}

function emitInstancesUpdate(
    userId,
    io
) {
    socketNotifier.emitInstancesUpdate(
        io,
        userId,
        getUserInstancesResumen(userId)
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

//==============================================================
// RESUMEN DE INSTANCIAS (PARA SOCKET.IO)
//==============================================================

function getUserInstancesResumen(userId){
    return getUserInstances(userId).map(
        i => ({
            id: i.id,
            numero: i.numero || '',
            listo: !!i.listo,
            iniciada: i.iniciada !== false
        })
    );
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

//==============================================================
// GUARDAR INSTANCIA EN SESIÓN
//==============================================================

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

    // FIX: guardarInstancia() es la función importada de
    // instancias-persistencia. Antes llamaba a
    // guardarInstanciaPersistencia() que no existe.
    guardarInstancia(
        userId,
        instanceId,
        actual
    );

    return true;
}

//==============================================================
// SHUTDOWN
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
    getUserInstancesResumen,
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