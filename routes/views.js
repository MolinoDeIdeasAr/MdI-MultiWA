const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const sessionManager = require('../services/session-manager');
const { cargarEstado, guardarEstado, getEstadoInstancia } = require('../state/estado');
const scheduler = require('../services/campaign-scheduler');
const { isAuthenticated } = require('./auth');

router.use(isAuthenticated);

function mapearInstancias(instanciasRaw) {
    return instanciasRaw.map(inst => ({ ...inst, id: inst.instanceId, listo: inst.ready }));
}

function obtenerEstadoCompleto(activeId) {
    if (!activeId) return null;
    const estadoDisco = getEstadoInstancia(activeId) || cargarEstado(activeId) || {};
    const infoInst = sessionManager.getEstado(activeId);
    return {
        ...estadoDisco,
        listo: infoInst ? infoInst.ready : false,
        numeroWhatsApp: infoInst ? infoInst.phoneNumber : (estadoDisco.numeroWhatsApp || '')
    };
}

router.get('/', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanciasRaw = sessionManager.getUserInstances(userId);
        const instancias = mapearInstancias(instanciasRaw);
        let activeId = sessionManager.getActiveInstanceId(userId);

        if (!activeId && instancias.length > 0) {
            const conectada = instancias.find(i => i.listo) || instancias[0];
            sessionManager.setActiveInstance(userId, conectada.id);
            activeId = conectada.id;
        }

        const estado = obtenerEstadoCompleto(activeId);
        res.render('index', { estado: estado || null, instancias, activeId: activeId || null, sinInstancias: instancias.length === 0, userId });
    } catch (error) {
        console.error('Error en GET /:', error);
        res.status(500).send('Error interno');
    }
});

router.get('/qr', (req, res) => {
    try {
        const userId = req.session.userId;
        const activeId = sessionManager.getActiveInstanceId(userId);
        const instanciasRaw = sessionManager.getUserInstances(userId);
        const instancias = mapearInstancias(instanciasRaw);
        const hayPendiente = instancias.some(i => !i.listo);
        const activaConectada = instancias.find(i => i.id === activeId && i.listo);
        if (activaConectada && !hayPendiente) return res.redirect('/');
        res.render('qr', { listo: false, userId, activeId });
    } catch (error) {
        res.status(500).send('Error interno');
    }
});

router.get('/monitor', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanciasRaw = sessionManager.getUserInstances(userId);
        const instancias = mapearInstancias(instanciasRaw);
        const idsPropios = new Set(instancias.map(i => i.id));
        const activeId = (req.query.instanceId && idsPropios.has(req.query.instanceId)) ? req.query.instanceId : sessionManager.getActiveInstanceId(userId);
        res.render('monitor', { estado: obtenerEstadoCompleto(activeId) || null, instancias, activeId: activeId || null });
    } catch (error) {
        res.status(500).send('Error interno');
    }
});

router.get('/cargar', async (req, res) => {
    try {
        const activeId = sessionManager.getActiveInstanceId(req.session.userId);
        res.render('cargar', { estado: obtenerEstadoCompleto(activeId) || null, activeId });
    } catch (error) {
        res.status(500).send('Error interno');
    }
});

router.post('/seleccionar-instancia', (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) return res.redirect('/');
        sessionManager.setActiveInstance(req.session.userId, instanceId);
        res.redirect((req.headers.referer || '/').includes('monitor') ? '/monitor' : '/');
    } catch (error) {
        res.status(500).send('Error');
    }
});

router.post('/nueva-instancia', async (req, res) => {
    try {
        const userId = req.session.userId;
        const uniqueId = `inst_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        sessionManager.startSession(uniqueId, userId).catch(e => console.error('Error:', e.message));
        await new Promise(r => setTimeout(r, 500));
        sessionManager.setActiveInstance(userId, uniqueId);
        res.redirect('/qr');
    } catch (error) {
        res.status(500).send('Error');
    }
});

router.get('/conversaciones', async (req, res) => {
    try {
        const userId = req.session.userId;
        let conversaciones = [];
        for (const inst of sessionManager.getUserInstances(userId)) {
            const convs = getEstadoInstancia(inst.instanceId)?.conversaciones || [];
            conversaciones = conversaciones.concat(convs);
        }
        conversaciones.sort((a, b) => (new Date(b.fecha).getTime() || 0) - (new Date(a.fecha).getTime() || 0));
        res.render('conversaciones', { conversaciones });
    } catch (error) {
        res.status(500).send('Error');
    }
});

router.post('/borrar-todas-conversaciones', async (req, res) => {
    try {
        for (const inst of sessionManager.getUserInstances(req.session.userId)) {
            const estado = getEstadoInstancia(inst.instanceId);
            if (estado) {
                estado.conversaciones = [];
                guardarEstado(estado, inst.instanceId);
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config-antibaneo', (req, res) => {
    try {
        res.render('config-antibaneo', { config: require('../config/anti-baneo').cargarConfig(), guardado: false });
    } catch (error) {
        res.status(500).send('Error');
    }
});

router.post('/config-antibaneo', (req, res) => {
    try {
        const nuevaConfig = require('../config/anti-baneo').guardarConfig(req.body);
        if (!nuevaConfig) return res.status(500).json({ error: 'No se pudo guardar' });
        res.json({ success: true, config: nuevaConfig });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/bajas', (req, res) => {
    try {
        res.render('bajas', { bajas: require('../services/bajas').obtenerBajas() });
    } catch (error) {
        res.status(500).send('Error');
    }
});

router.post('/desconectar-instancia', async (req, res) => {
    try {
        if (!req.body.instanceId) return res.redirect('/');
        await sessionManager.disconnectSession(req.body.instanceId);
        res.redirect('/');
    } catch (error) {
        res.status(500).send('Error');
    }
});

router.post('/forzar-desconexion', async (req, res) => {
    try {
        const { instanceId } = req.body;
        const userId = req.session.userId;
        if (!instanceId) return res.json({ error: 'Sin instanceId' });

        await sessionManager.disconnectSession(instanceId);
        const sessionDir = path.join(__dirname, '..', 'baileys_sessions', instanceId);
        if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });

        const INSTANCIAS_FILE = path.join(__dirname, '..', 'data', 'instancias.json');
        if (fs.existsSync(INSTANCIAS_FILE)) {
            const data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
            if (data[userId]) {
                data[userId] = data[userId].filter(i => i.id !== instanceId && i.instanceId !== instanceId);
                if (data[userId].length === 0) delete data[userId];
                fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2));
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

//----------------------------------------------------------
// ENDPOINT DE PAUSAR (Corregido y Finalizado)
//----------------------------------------------------------
router.post('/pausar', (req, res) => {
    try {
        const instanceId = req.body.instanceId || req.query.instanceId || sessionManager.getActiveInstanceId(req.session.userId);
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        
        const estado = getEstadoInstancia(instanceId);
        if (!estado) return res.status(404).json({ ok: false, error: 'Instancia inexistente' });
        
        estado.enviando = false;
        estado.pausado = true; // Forzamos el estado de pausa
        
        // Guardamos el cambio de estado en el disco/memoria
        guardarEstado(estado, instanceId);
        
        // Si tienes un scheduler activo para campañas, lo pausamos también
        if (scheduler && typeof scheduler.pauseCampaign === 'function') {
            scheduler.pauseCampaign(instanceId);
        }

        res.json({ ok: true, message: 'Instancia pausada con éxito', estado });
    } catch (error) {
        console.error('Error al pausar instancia:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;
