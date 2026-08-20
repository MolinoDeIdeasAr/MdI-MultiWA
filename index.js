'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const sessionManager = require('./services/session-manager');
const scheduler = require('./services/campaign-scheduler');
const { setupSockets } = require('./sockets/conversations');

// Limpieza automática (opcional)
let iniciarLimpiezaAutomatica = null;
try {
    const cleanup = require('./services/session-cleanup');
    iniciarLimpiezaAutomatica = cleanup.iniciarLimpiezaAutomatica;
} catch (e) {
    console.warn('⚠️ session-cleanup.js no encontrado');
}

process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('EBUSY')) {
        console.warn('⚠️ [Global] Ignorado error EBUSY de LocalAuth');
        return;
    }
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    if (err.message && err.message.includes('EBUSY')) {
        console.warn('⚠️ [Global] Ignorado error EBUSY de LocalAuth');
        return;
    }
    console.error('❌ Uncaught Exception:', err);
});

const { router: authRoutes } = require('./routes/auth');
const viewsRoutes = require('./routes/views');
const apiCargaRoutes = require('./routes/api-carga');
const apiEnvioRoutes = require('./routes/api-envio');
const apiMensajesRoutes = require('./routes/api-mensajes');
const apiMonitorRoutes = require('./routes/api-monitor');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('io', io);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'mdi-multiwa',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

scheduler.init(io);
setupSockets(io);

if (iniciarLimpiezaAutomatica) iniciarLimpiezaAutomatica();

app.use('/', authRoutes);
app.use('/api/carga', apiCargaRoutes);
app.use('/api/envio', apiEnvioRoutes);
app.use('/api/mensajes', apiMensajesRoutes);
app.use('/api/monitor', apiMonitorRoutes);
app.use('/', viewsRoutes);

(async () => {
    try {
        console.log('🔄 Restaurando instancias persistentes...');
        await sessionManager.restaurarTodas(io);
        console.log('✅ Instancias restauradas');
        setTimeout(() => {
            try { scheduler.restaurarCampañas(); }
            catch (err) { console.error('❌ Error restaurando campañas:', err.message); }
        }, 10000);
    } catch (err) {
        console.error('❌ Error restaurando instancias:', err.message);
    }
})();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
    console.log('🧠 DeepSeek integrado');
    console.log('💬 Socket.IO activo');
    console.log('👥 Multiusuario habilitado');

    const url = `http://localhost:${PORT}`;
    const comando = process.platform === 'win32' ? `start "" "${url}"` :
                    process.platform === 'darwin' ? `open "${url}"` :
                    `xdg-open "${url}"`;

    setTimeout(() => {
        exec(comando, (err) => {
            if (err) {
                console.log('⚠️ No se pudo abrir el navegador. Abrí manualmente:', url);
            } else {
                console.log('🌐 Navegador abierto automáticamente');
            }
        });
    }, 1500);
});

server.on('error', err => {
    console.error('❌ Error del servidor:', err.message);
});

async function shutdown() {
    console.log('\n🛑 Cerrando MdI MultiWA...');
    try { await scheduler.shutdown(); } catch (err) { console.error('❌ Error Scheduler:', err.message); }
    try { if (typeof sessionManager.shutdown === 'function') await sessionManager.shutdown(); }
    catch (err) { console.error('❌ Error Session Manager:', err.message); }
    try { io.close(); } catch (err) {}
    try {
        server.close(() => { console.log('✅ Servidor detenido'); process.exit(0); });
    } catch (err) { process.exit(0); }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);