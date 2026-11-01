'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sessionManager = require('../services/session-manager');
const scheduler = require('../services/campaign-scheduler');
const { getScheduler, reiniciarScheduler } = require('../state/scheduler-state');
const { getEstadoInstancia, actualizarEstado, guardarEstadoSeguro, guardarMensajes, guardarImagen, eliminarImagen, resetearContadores } = require('../state/estado');

const storage = multer.diskStorage({
    destination(req, file, cb) { cb(null, path.join(__dirname, '..', 'uploads')); },
    filename(req, file, cb) { cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`); }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/mensajes', async (req, res) => {
    try {
        const { instanceId, mensajes, respuestaInfo, tipoCampana, respuestasInfoPorTipo, linkPreviewActivo } = req.body;
        if (!instanceId || !Array.isArray(mensajes)) return res.status(400).json({ ok: false, error: 'Datos inválidos' });
        const lista = mensajes.map(m => String(m || '').trim()).filter(Boolean);
        if (lista.length === 0) return res.status(400).json({ ok: false, error: 'Debe ingresar al menos un mensaje' });
        if (!sessionManager.getClient(instanceId)) return res.status(400).json({ ok: false, error: 'Cliente no conectado' });

        const estado = getEstadoInstancia(instanceId);
        if (!estado) return res.status(400).json({ ok: false, error: 'Estado inexistente' });

        if (typeof respuestaInfo === 'string') estado.respuestaInfo = respuestaInfo.trim();
        if (tipoCampana !== undefined) estado.tipoCampana = (tipoCampana || '').trim();
        if (respuestasInfoPorTipo && typeof respuestasInfoPorTipo === 'object') estado.respuestasInfoPorTipo = respuestasInfoPorTipo;
        if (linkPreviewActivo !== undefined) estado.linkPreviewActivo = linkPreviewActivo !== false;

        guardarMensajes(instanceId, lista);
        return res.json({ ok: true, total: lista.length });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/imagen', upload.single('imagen'), async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId || !req.file) return res.status(400).json({ ok: false, error: 'Datos inválidos' });
        const estado = getEstadoInstancia(instanceId);
        if (!estado) return res.status(400).json({ ok: false, error: 'Estado inexistente' });

        if (estado.imagenGuardada && estado.imagenGuardada !== req.file.filename) {
            const anterior = path.join(__dirname, '..', 'uploads', estado.imagenGuardada);
            try { if (fs.existsSync(anterior)) fs.unlinkSync(anterior); } catch (err) {}
        }
        guardarImagen(instanceId, req.file.filename);
        return res.json({ ok: true, archivo: req.file.filename });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

router.delete('/imagen', async (req, res) => {
    try {
        if (!req.body.instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        eliminarImagen(req.body.instanceId);
        return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/iniciar', async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });

        const client = sessionManager.getClient(instanceId);
        if (!client) return res.status(400).json({ ok: false, error: 'Cliente no conectado' });

        const estadoInstancia = sessionManager.getEstado(instanceId);
        if (!estadoInstancia || !estadoInstancia.ready) {
            return res.status(400).json({ ok: false, error: 'WhatsApp aún se está iniciando' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado || !Array.isArray(estado.contactosCargados) || estado.contactosCargados.length === 0) {
            return res.status(400).json({ ok: false, error: 'No hay contactos cargados' });
        }
        const mensajes = (estado.mensajesGuardados || []).filter(Boolean);
        if (mensajes.length === 0) return res.status(400).json({ ok: false, error: 'No hay mensajes cargados' });

        resetearContadores(instanceId);
        actualizarEstado(instanceId, { enviando: true, pausado: false, campanaFinalizada: false });
        guardarEstadoSeguro(instanceId);
        reiniciarScheduler(instanceId);

        if (!(await scheduler.iniciar(instanceId))) return res.status(500).json({ ok: false, error: 'No se pudo iniciar' });

        return res.json({ ok: true, total: estado.contactosCargados.length, monitor: `/monitor?instanceId=${instanceId}` });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/pausar', async (req, res) => {
    try {
        if (!req.body.instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        actualizarEstado(req.body.instanceId, { enviando: false, pausado: true });
        scheduler.detener(req.body.instanceId);
        return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/reanudar', async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        
        const estadoInstancia = sessionManager.getEstado(instanceId);
        if (!estadoInstancia || !estadoInstancia.ready) return res.status(400).json({ ok: false, error: 'WhatsApp aún no está listo' });

        actualizarEstado(instanceId, { enviando: true, pausado: false });
        reiniciarScheduler(instanceId);
        await scheduler.iniciar(instanceId);
        return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/detener', async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        actualizarEstado(instanceId, { enviando: false, pausado: false, campanaFinalizada: true });
        guardarEstadoSeguro(instanceId);
        scheduler.detener(instanceId);
        return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;