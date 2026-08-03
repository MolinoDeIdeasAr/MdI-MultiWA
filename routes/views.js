const express = require('express');
const router = express.Router();
const sessionManager = require('../services/session-manager');
const { cargarEstado } = require('../state/estado');
const { isAuthenticated } = require('./auth');

router.use(isAuthenticated);

// ─────────────────────────────────────────────
//  GET / — Panel principal
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instancias = sessionManager.getUserInstances(userId);
        let activeId = sessionManager.getActiveInstanceId(userId);

        // FIX: si no hay instancia activa pero sí hay instancias, auto-seleccionar la primera conectada
        if (!activeId && instancias.length > 0) {
            const conectada = instancias.find(i => i.listo) || instancias[0];
            sessionManager.setActiveInstance(userId, conectada.id);
            activeId = conectada.id;
        }

        let estado = sessionManager.getEstado(userId);

        // Si getEstado devuelve null, intentar cargar desde disco
        if (!estado && activeId) {
            estado = cargarEstado(activeId);
            if (estado) {
                const s = sessionManager.getUserSession(userId);
                if (s) {
                    const inst = s.instances.get(activeId);
                    if (inst) {
                        inst.estado = estado;
                        if (inst.numero) estado.numeroWhatsApp = inst.numero;
                        estado.listo = inst.listo;
                    }
                }
            }
        }

        res.render('index', {
            estado: estado || null,
            instancias,
            activeId: activeId || null,
            sinInstancias: instancias.length === 0,
            userId: userId  // FIX: pasar userId para el socket del cliente
        });
    } catch (error) {
        console.error('Error en GET /:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ─────────────────────────────────────────────
//  GET /qr
// ─────────────────────────────────────────────
router.get('/qr', (req, res) => {
    try {
        const userId = req.session.userId;
        const activeId = sessionManager.getActiveInstanceId(userId);
        const instancias = sessionManager.getUserInstances(userId);

        // FIX: solo redirigir si la instancia activa ya está conectada
        // Y no hay ninguna instancia pendiente de escaneo (listo=false)
        const hayPendiente = instancias.some(i => !i.listo);
        const activaConectada = instancias.find(i => i.id === activeId && i.listo);

        if (activaConectada && !hayPendiente) {
            return res.redirect('/');
        }

        res.render('qr', {
            listo: false,
            userId: userId
        });
    } catch (error) {
        console.error('Error en GET /qr:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ─────────────────────────────────────────────
//  GET /monitor
// ─────────────────────────────────────────────
router.get('/monitor', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instancias = sessionManager.getUserInstances(userId);
        // FIX: la variable se llama activeId en toda la app, no activeInstanceId
        const activeId = sessionManager.getActiveInstanceId(userId);

        let estado = sessionManager.getEstado(userId);

        if (!estado && activeId) {
            estado = cargarEstado(activeId);
            if (estado) {
                const s = sessionManager.getUserSession(userId);
                if (s) {
                    const inst = s.instances.get(activeId);
                    if (inst) {
                        inst.estado = estado;
                        if (inst.numero) estado.numeroWhatsApp = inst.numero;
                        estado.listo = inst.listo;
                    }
                }
            }
        }

        // Asegurar que el número y el listo estén siempre sincronizados
        if (estado && activeId) {
            const s = sessionManager.getUserSession(userId);
            if (s) {
                const inst = s.instances.get(activeId);
                if (inst) {
                    if (inst.numero) estado.numeroWhatsApp = inst.numero;
                    estado.listo = inst.listo;
                }
            }
        }

        res.render('monitor', {
            estado: estado || null,
            instancias,
            // FIX: pasar como activeId (el EJS usa inst.id === activeId)
            activeId: activeId || null
        });
    } catch (error) {
        console.error('Error en GET /monitor:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ─────────────────────────────────────────────
//  GET /cargar
// ─────────────────────────────────────────────
router.get('/cargar', async (req, res) => {
    try {
        const userId = req.session.userId;
        const estado = sessionManager.getEstado(userId);
        res.render('cargar', { estado: estado || null });
    } catch (error) {
        console.error('Error en GET /cargar:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ─────────────────────────────────────────────
//  POST /seleccionar-instancia
// ─────────────────────────────────────────────
router.post('/seleccionar-instancia', (req, res) => {
    try {
        const { instanceId } = req.body;
        const userId = req.session.userId;
        if (!instanceId) return res.redirect('/');
        sessionManager.setActiveInstance(userId, instanceId);
        // FIX: redirigir a la página desde donde vino si está disponible
        const referer = req.headers.referer || '/';
        res.redirect(referer.includes('monitor') ? '/monitor' : '/');
    } catch (error) {
        console.error('Error en POST /seleccionar-instancia:', error);
        res.status(500).send('Error al seleccionar instancia');
    }
});

// ─────────────────────────────────────────────
//  POST /nueva-instancia
// ─────────────────────────────────────────────
router.post('/nueva-instancia', async (req, res) => {
    try {
        const userId = req.session.userId;
        const io = req.app.get('io');
        const uniqueId = `inst_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // FIX: iniciar en background y setear como activa para que /qr muestre su QR
        sessionManager.startSession(userId, io, uniqueId).catch(e => {
            console.error('Error iniciando sesión:', e.message);
        });

        // Pequeña espera para que la instancia quede registrada en memoria
        await new Promise(r => setTimeout(r, 300));
        sessionManager.setActiveInstance(userId, uniqueId);

        res.redirect('/qr');
    } catch (error) {
        console.error('Error en POST /nueva-instancia:', error);
        res.status(500).send('Error al crear instancia');
    }
});

// ─────────────────────────────────────────────
//  GET /conversaciones
// ─────────────────────────────────────────────
router.get('/conversaciones', async (req, res) => {
    try {
        const userId = req.session.userId;
        const activeId = sessionManager.getActiveInstanceId(userId);
        let conversaciones = [];

        // Leer conversaciones del estado de la instancia activa
        if (activeId) {
            const s = sessionManager.getUserSession(userId);
            if (s) {
                const inst = s.instances.get(activeId);
                if (inst && inst.estado && inst.estado.conversaciones) {
                    conversaciones = inst.estado.conversaciones;
                } else {
                    // Intentar cargar desde disco
                    const estadoDisco = cargarEstado(activeId);
                    if (estadoDisco && estadoDisco.conversaciones) {
                        conversaciones = estadoDisco.conversaciones;
                    }
                }
            }
        }

        res.render('conversaciones', { conversaciones });
    } catch (error) {
        console.error('Error en GET /conversaciones:', error);
        res.status(500).send('Error interno del servidor');
    }
});

// ─────────────────────────────────────────────
//  POST /borrar-todas-conversaciones
// ─────────────────────────────────────────────
router.post('/borrar-todas-conversaciones', async (req, res) => {
    try {
        const userId = req.session.userId;
        const s = sessionManager.getUserSession(userId);
        if (s) {
            for (const [instanceId, inst] of s.instances) {
                if (inst.estado) {
                    inst.estado.conversaciones = [];
                    const { guardarEstado } = require('../state/estado');
                    guardarEstado(inst.estado, instanceId);
                }
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error borrando conversaciones:', error);
        res.status(500).json({ error: error.message });
    }
});


// ─────────────────────────────────────────────
//  GET /bajas
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
//  GET /config-antibaneo
// ─────────────────────────────────────────────
router.get('/config-antibaneo', (req, res) => {
    try {
        const { cargarConfig } = require('../config/anti-baneo');
        const config = cargarConfig();
        res.render('config-antibaneo', { config, guardado: false });
    } catch (error) {
        console.error('Error en GET /config-antibaneo:', error);
        res.status(500).send('Error interno');
    }
});

// ─────────────────────────────────────────────
//  POST /config-antibaneo
// ─────────────────────────────────────────────
router.post('/config-antibaneo', (req, res) => {
    try {
        const { guardarConfig, cargarConfig } = require('../config/anti-baneo');
        const nuevaConfig = guardarConfig(req.body);
        if (!nuevaConfig) {
            return res.status(500).json({ error: 'No se pudo guardar la configuración' });
        }
        res.json({ success: true, config: nuevaConfig });
    } catch (error) {
        console.error('Error en POST /config-antibaneo:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/bajas', (req, res) => {
    try {
        const { obtenerBajas } = require('../services/bajas');
        const bajas = obtenerBajas();
        res.render('bajas', { bajas });
    } catch (error) {
        console.error('Error en GET /bajas:', error);
        res.status(500).send('Error interno');
    }
});

router.post('/desconectar-instancia', async (req, res) => {
    try {
        const { instanceId } = req.body;
        const userId = req.session.userId;
        if (!instanceId) return res.redirect('/');
        await sessionManager.removeInstance(userId, instanceId);
        res.redirect('/');
    } catch (error) {
        console.error('Error en POST /desconectar-instancia:', error);
        res.status(500).send('Error al eliminar instancia');
    }
});

// ─────────────────────────────────────────────
//  POST /forzar-desconexion
//  Limpieza forzada sin depender del cliente WA
// ─────────────────────────────────────────────
router.post('/forzar-desconexion', async (req, res) => {
    try {
        const { instanceId } = req.body;
        const userId = req.session.userId;
        if (!instanceId) return res.json({ error: 'Sin instanceId' });

        const fs = require('fs');
        const path = require('path');
        const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
        const INSTANCIAS_FILE = path.join(__dirname, '..', 'data', 'instancias.json');

        console.log(`🔧 Forzando desconexión de ${instanceId}...`);

        // 1. Intentar destroy del cliente si existe (ignorar errores)
        try {
            const client = sessionManager.getClient(instanceId);
            if (client) {
                await Promise.race([
                    client.destroy(),
                    new Promise(r => setTimeout(r, 3000)) // max 3s
                ]);
            }
        } catch (e) {
            console.warn(`⚠️ Error en destroy (ignorado): ${e.message}`);
        }

        // 2. Eliminar de memoria
        const s = sessionManager.getUserSession(userId);
        if (s) {
            s.instances.delete(instanceId);
            if (s.activeId === instanceId) {
                const restantes = [...s.instances.keys()];
                s.activeId = restantes.length > 0 ? restantes[0] : null;
            }
        }

        // 3. Borrar carpeta de sesión de Puppeteer
        const sessionDir = path.join(SESSIONS_DIR, `session-${instanceId}`);
        if (fs.existsSync(sessionDir)) {
            try {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                console.log(`🗑️ Carpeta de sesión eliminada: ${sessionDir}`);
            } catch (e) {
                console.warn(`⚠️ No se pudo borrar carpeta (puede estar bloqueada): ${e.message}`);
                // Intentar borrar archivo por archivo
                try {
                    const archivos = fs.readdirSync(sessionDir);
                    for (const a of archivos) {
                        try { fs.unlinkSync(path.join(sessionDir, a)); } catch (_) {}
                    }
                    fs.rmdirSync(sessionDir);
                } catch (_) {}
            }
        }

        // 4. Eliminar del instancias.json
        if (fs.existsSync(INSTANCIAS_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
                if (data[userId]) {
                    data[userId] = data[userId].filter(i => i.id !== instanceId);
                    if (data[userId].length === 0) delete data[userId];
                    fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2));
                }
            } catch (e) {
                console.warn(`⚠️ Error limpiando instancias.json: ${e.message}`);
            }
        }

        console.log(`✅ Desconexión forzada completada: ${instanceId}`);
        res.json({ success: true });

    } catch (error) {
        console.error('Error en forzar-desconexion:', error);
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
