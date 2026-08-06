'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * index.js
 *
 * Bootstrap principal
 *
 * Versión : v5.0.0
 * Fecha   : 2026-07-26
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

console.log(

    '🗓️ Campaign Scheduler inicializado'

);

//==============================================================
// SOCKET.IO
//==============================================================

io.on('connection', socket => {

    console.log('🔌 Socket conectado:', socket.id);

    socket.on('join', userId => {

        console.log('👤 JOIN:', userId);

        sessionManager.registerSocket(userId, socket);

    });

    socket.on('disconnect', () => {

        console.log('❌ Socket desconectado');

        sessionManager.unregisterSocket(socket);

    });

});

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