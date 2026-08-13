'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * index.js
 *
 * Bootstrap principal
 *
 * Versión : v5.2.0
 * Fecha   : 2026-08-07
 *
 * CHANGELOG v5.2.0:
 *  • FIX: se agregó app.set('io', io) — routes/views.js usa
 *    req.app.get('io') en varios lugares y nunca se había seteado,
 *    devolvía undefined en silencio.
 *  • FIX: se reemplazó el io.on('connection', ...) propio (que
 *    convivía sin saberlo con sockets/conversations.js, nunca
 *    conectado) por setupSockets(io) — un solo punto de entrada
 *    de sockets, con salas por usuario. El código viejo además
 *    llamaba unregisterSocket(socket) pasando el socket entero en
 *    vez del userId, así que nunca desregistraba nada al
 *    desconectar.
 *
 * =============================================================
 */

 //==============================================================
 // DEPENDENCIAS
 //==============================================================

const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');

const { Server } = require('socket.io');

const sessionManager =
    require('./services/session-manager');

const scheduler =
    require('./services/campaign-scheduler');

const { setupSockets } =
    require('./sockets/conversations');

// ============================================================
// MANEJO GLOBAL DE ERRORES (Previene crashes por EBUSY en Windows)
// ============================================================
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('EBUSY')) {
        // Esto es normal en Windows cuando whatsapp-web.js intenta borrar la sesión
        // mientras Chromium aún está cerrando. Lo ignoramos para que no rompa el proceso.
        console.warn('⚠️ [Global] Ignorado error EBUSY de LocalAuth (Windows lock en sesión)');
        return;
    }
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    if (err.message && err.message.includes('EBUSY')) {
        console.warn('⚠️ [Global] Ignorado error EBUSY de LocalAuth (Windows lock en sesión)');
        return;
    }
    console.error('❌ Uncaught Exception:', err);
});

//==============================================================
// RUTAS
//==============================================================

const {

    router: authRoutes

} = require('./routes/auth');

const viewsRoutes =
    require('./routes/views');

const apiCargaRoutes =
    require('./routes/api-carga');

const apiEnvioRoutes =
    require('./routes/api-envio');

const apiMensajesRoutes =
    require('./routes/api-mensajes');

const apiMonitorRoutes =
    require('./routes/api-monitor');


//==============================================================
// EXPRESS
//==============================================================

const app = express();

const server =
    http.createServer(app);

const io =
    new Server(server);

// Para que las rutas puedan acceder a io vía req.app.get('io')
// (routes/views.js lo usa en iniciarSiNecesario, entre otros).
// Faltaba — req.app.get('io') devolvía undefined en silencio.
app.set('io', io);


//==============================================================
// CONFIG EXPRESS
//==============================================================

app.set(

    'view engine',

    'ejs'

);

app.set(

    'views',

    path.join(__dirname, 'views')

);


//==============================================================
// MIDDLEWARES
//==============================================================

app.use(

    express.json({

        limit: '20mb'

    })

);

app.use(

    express.urlencoded({

        extended: true,

        limit: '20mb'

    })

);

app.use(

    express.static(

        path.join(__dirname, 'public')

    )

);

// Servir las imágenes/archivos subidos (uploads/) — no existía
// NINGUNA ruta que sirviera esta carpeta. Por eso el <img
// src="/uploads/..."> de la imagen persistida siempre daba 404
// al cargar la página, y solo se veía la vista previa cuando se
// volvía a seleccionar el archivo a mano (esa es local, lee el
// disco del navegador, nunca pasa por el servidor).
app.use(

    '/uploads',

    express.static(

        path.join(__dirname, 'uploads')

    )

);


//==============================================================
// SESSION
//==============================================================

app.use(

    session({

        secret: process.env.SESSION_SECRET || 'mdi-multiwa',

        resave: false,

        saveUninitialized: false,

        cookie: {

            maxAge: 1000 * 60 * 60 * 24

        }

    })

);

//==============================================================
// SOCKET.IO
//==============================================================

scheduler.init(io);

//==============================================================
// SOCKET.IO
//==============================================================
//
// Antes había un io.on('connection', ...) acá mismo, en paralelo
// a sockets/conversations.js (que no estaba conectado a nada).
// Se unifica en un solo lugar: setupSockets ya arma las salas por
// usuario (user_${userId}), maneja join/reconnect/disconnect, y
// registra correctamente el socket (el código viejo acá llamaba
// unregisterSocket(socket) pasando el socket entero en vez del
// userId, así que nunca se desregistraba nada al desconectar).
//==============================================================

setupSockets(io);

//==============================================================
// RUTAS
//==============================================================

app.use(
    '/',
    authRoutes
);

app.use(
    '/api/carga',
    apiCargaRoutes
);

app.use(
    '/api/envio',
    apiEnvioRoutes
);

app.use(
    '/api/mensajes',
    apiMensajesRoutes
);

app.use(
    '/api/monitor',
    apiMonitorRoutes
);

app.use(
    '/',
    viewsRoutes
);

//==============================================================
// RESTAURAR SESIONES Y CAMPAÑAS
//==============================================================

(async () => {

    try {

        console.log(

            '🔄 Restaurando instancias persistentes...'

        );

        await sessionManager.restaurarTodas(io);

        console.log(

            '✅ Instancias restauradas'

        );

        //------------------------------------------------------
        // Esperar que WhatsApp termine de conectar
        //------------------------------------------------------

        setTimeout(

            () => {

                try {

                    scheduler.restaurarCampañas();

                }

                catch (err) {

                    console.error(

                        '❌ Error restaurando campañas:',

                        err.message

                    );

                }

            },

            10000

        );

    }

    catch (err) {

        console.error(

            '❌ Error restaurando instancias:',

            err.message

        );

    }

})();

//==============================================================
// INICIAR SERVIDOR
//==============================================================

const PORT =

    process.env.PORT || 3000;

server.listen(

    PORT,

    () => {

        console.log(

            `🚀 Servidor iniciado en http://localhost:${PORT}`

        );

        console.log(

            '🧠 DeepSeek integrado'

        );

        console.log(

            '💬 Socket.IO activo'

        );

        console.log(

            '👥 Multiusuario habilitado'

        );

    }

);


//==============================================================
// MANEJO DE ERRORES DEL SERVIDOR
//==============================================================

server.on(

    'error',

    err => {

        console.error(

            '❌ Error del servidor:',

            err.message

        );

    }

);


//==============================================================
// MANEJO DE ERRORES NO CONTROLADOS
//==============================================================

process.on(

    'uncaughtException',

    err => {

        console.error(

            '❌ Uncaught Exception'

        );

        console.error(

            err

        );

    }

);

process.on(

    'unhandledRejection',

    err => {

        console.error(

            '❌ Unhandled Rejection'

        );

        console.error(

            err

        );

    }

);

//==============================================================
// CIERRE ORDENADO
//==============================================================

async function shutdown() {

    console.log(

        '\n🛑 Cerrando MdI MultiWA...'

    );

    try {

        await scheduler.shutdown();

    }

    catch (err) {

        console.error(

            '❌ Error cerrando Scheduler:',

            err.message

        );

    }

    try {

        if (

            typeof sessionManager.shutdown === 'function'

        ) {

            await sessionManager.shutdown();

        }

    }

    catch (err) {

        console.error(

            '❌ Error cerrando Session Manager:',

            err.message

        );

    }

    try {

        io.close();

    }

    catch (err) {}

    try {

        server.close(() => {

            console.log(

                '✅ Servidor detenido'

            );

            process.exit(0);

        });

    }

    catch (err) {

        process.exit(0);

    }

}


//==============================================================
// SIGNALS
//==============================================================

process.on(

    'SIGINT',

    shutdown

);

process.on(

    'SIGTERM',

    shutdown

);
