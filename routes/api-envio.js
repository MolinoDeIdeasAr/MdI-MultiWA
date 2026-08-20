'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const sessionManager = require('../services/session-manager');
const scheduler = require('../services/campaign-scheduler');
const { getScheduler, reiniciarScheduler } = require('../state/scheduler-state');
const {
    getEstadoInstancia,
    actualizarEstado,
    guardarEstadoSeguro,
    guardarMensajes,
    guardarImagen,
    eliminarImagen,
    resetearContadores
} = require('../state/estado');

//==============================================================
// MULTER
//==============================================================
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename(req, file, cb) {
        // FIX: sanitizar nombre para evitar espacios y caracteres raros
        const nombreLimpio = file.originalname
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, `${Date.now()}_${nombreLimpio}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }
});

//==============================================================
// GUARDAR MENSAJES
//==============================================================
router.post('/mensajes', async (req, res) => {
    try {
        const { 
            instanceId, 
            mensajes, 
            respuestaInfo,
            tipoCampana,
            respuestasInfoPorTipo,
            linkPreviewActivo
        } = req.body;

        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }
        if (!Array.isArray(mensajes)) {
            return res.status(400).json({ ok: false, error: 'mensajes inválidos' });
        }

        const lista = mensajes.map(m => String(m || '').trim()).filter(Boolean);
        if (lista.length === 0) {
            return res.status(400).json({ ok: false, error: 'Debe ingresar al menos un mensaje' });
        }

        const client = sessionManager.getClient(instanceId);
        if (!client) {
            return res.status(400).json({ ok: false, error: 'Cliente no conectado' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(400).json({ ok: false, error: 'Estado inexistente' });
        }

        // Guardar respuesta a INFO
        if (typeof respuestaInfo === 'string') {
            estado.respuestaInfo = respuestaInfo.trim();
        }

        // NUEVO: Guardar tipo de campaña
        if (tipoCampana !== undefined) {
            estado.tipoCampana = (tipoCampana || '').trim();
        }

        // NUEVO: Guardar respuestas a INFO por tipo
        if (respuestasInfoPorTipo && typeof respuestasInfoPorTipo === 'object') {
            estado.respuestasInfoPorTipo = respuestasInfoPorTipo;
        }

        // NUEVO: Guardar linkPreview toggle
        if (linkPreviewActivo !== undefined) {
            estado.linkPreviewActivo = linkPreviewActivo !== false;
            console.log(`🖼️ LinkPreview: ${estado.linkPreviewActivo ? 'ON' : 'OFF'}`);
        }

        guardarMensajes(instanceId, lista);

        console.log(`💾 ${lista.length} mensajes guardados (${instanceId})`);
        if (estado.tipoCampana) {
            console.log(`🏷️ Tipo de campaña: "${estado.tipoCampana}"`);
        }

        return res.json({ ok: true, total: lista.length });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// SUBIR IMAGEN
//==============================================================
router.post('/imagen', upload.single('imagen'), async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No se recibió ninguna imagen' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(400).json({ ok: false, error: 'Estado inexistente' });
        }

        if (estado.imagenGuardada && estado.imagenGuardada !== req.file.filename) {
            const anterior = path.join(__dirname, '..', 'uploads', estado.imagenGuardada);
            try {
                if (fs.existsSync(anterior)) fs.unlinkSync(anterior);
            } catch (err) {
                console.warn(`⚠ No se pudo borrar imagen anterior (${instanceId}):`, err.message);
            }
        }

        guardarImagen(instanceId, req.file.filename);
        console.log(`🖼 Imagen guardada (${instanceId}) -> ${req.file.filename}`);

        return res.json({ ok: true, archivo: req.file.filename });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// ELIMINAR IMAGEN
//==============================================================
router.delete('/imagen', async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }
        eliminarImagen(instanceId);
        console.log(`🗑 Imagen eliminada (${instanceId})`);
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// INICIAR CAMPAÑA
//==============================================================
router.post('/iniciar', async (req, res) => {
    try {
        const { instanceId } = req.body;

        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }

        const client = sessionManager.getClient(instanceId);
        if (!client) {
            return res.status(400).json({ ok: false, error: 'Cliente no conectado' });
        }

        if (!client.info || !client.info.wid) {
            return res.status(400).json({ ok: false, error: 'WhatsApp aún se está iniciando' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(400).json({ ok: false, error: 'Estado inexistente' });
        }

        if (!Array.isArray(estado.contactosCargados) || estado.contactosCargados.length === 0) {
            return res.status(400).json({ ok: false, error: 'No hay contactos cargados' });
        }

        const mensajes = (estado.mensajesGuardados || []).filter(Boolean);
        if (mensajes.length === 0) {
            return res.status(400).json({ ok: false, error: 'No hay mensajes cargados' });
        }

        resetearContadores(instanceId);

        actualizarEstado(instanceId, {
            enviando: true,
            pausado: false,
            campanaFinalizada: false
        });

        guardarEstadoSeguro(instanceId);
        reiniciarScheduler(instanceId);

        const iniciado = await scheduler.iniciar(instanceId);
        if (!iniciado) {
            return res.status(500).json({ ok: false, error: 'No se pudo iniciar el Scheduler' });
        }

        const sch = getScheduler(instanceId);

        console.log('');
        console.log('==============================');
        console.log('[ENVIAR]');
        console.log('instanceId:', instanceId);
        console.log('cliente:', !!client);
        console.log('ready:', !!client.info);
        console.log('mensajes:', mensajes.length);
        console.log('contactos:', estado.contactosCargados.length);
        console.log('tipoCampana:', estado.tipoCampana || '(sin definir)');
        console.log('scheduler:', sch.status);
        console.log('==============================');
        console.log('');

        return res.json({
            ok: true,
            total: estado.contactosCargados.length,
            monitor: `/monitor?instanceId=${instanceId}`
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// PAUSAR CAMPAÑA
//==============================================================
router.post('/pausar', async (req, res) => {
    try {
        const { instanceId } = req.body;

        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(400).json({ ok: false, error: 'Estado inexistente' });
        }

        actualizarEstado(instanceId, { enviando: false, pausado: true });
        scheduler.detener(instanceId);

        console.log(`⏸ Campaña pausada (${instanceId})`);
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// REANUDAR CAMPAÑA
//==============================================================
router.post('/reanudar', async (req, res) => {
    try {
        const { instanceId } = req.body;

        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }

        const client = sessionManager.getClient(instanceId);
        if (!client) {
            return res.status(400).json({ ok: false, error: 'Cliente no conectado' });
        }

        if (!client.info || !client.info.wid) {
            return res.status(400).json({ ok: false, error: 'WhatsApp aún no está listo' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(400).json({ ok: false, error: 'Estado inexistente' });
        }

        actualizarEstado(instanceId, { enviando: true, pausado: false });
        reiniciarScheduler(instanceId);

        const iniciado = await scheduler.iniciar(instanceId);
        if (!iniciado) {
            return res.status(500).json({ ok: false, error: 'No se pudo reanudar la campaña' });
        }

        console.log(`▶ Campaña reanudada (${instanceId})`);
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// DETENER CAMPAÑA
//==============================================================
router.post('/detener', async (req, res) => {
    try {
        const { instanceId } = req.body;

        if (!instanceId) {
            return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        }

        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(400).json({ ok: false, error: 'Estado inexistente' });
        }

        actualizarEstado(instanceId, {
            enviando: false,
            pausado: false,
            campanaFinalizada: true
        });

        guardarEstadoSeguro(instanceId);
        scheduler.detener(instanceId);

        console.log(`⏹ Campaña detenida (${instanceId})`);
        console.log(`Enviados: ${estado.enviadosOk}`);
        console.log(`Procesados: ${estado.actual}/${estado.total}`);

        return res.json({
            ok: true,
            enviados: estado.enviadosOk,
            procesados: estado.actual,
            total: estado.total
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// ESTADO DE CAMPAÑA
//==============================================================
router.get('/estado/:instanceId', (req, res) => {
    try {
        const { instanceId } = req.params;
        const estado = getEstadoInstancia(instanceId);
        if (!estado) {
            return res.status(404).json({ ok: false, error: 'Estado inexistente' });
        }
        const schedulerInfo = getScheduler(instanceId);
        return res.json({ ok: true, estado, scheduler: schedulerInfo });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//==============================================================
// EXPORT
//==============================================================
module.exports = router;