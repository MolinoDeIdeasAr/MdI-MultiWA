'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { guardarEstado, cargarEstado } = require('../state/estado');
const sessionManager = require('../services/session-manager');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

router.post('/guardar-mensajes', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        if (!instanceId) return res.status(400).json({ error: 'No hay instancia activa' });
        
        const { mensaje1, mensaje2, mensaje3, respuestaInfo, tipoCampana, respuestasInfoPorTipo, linkPreviewActivo } = req.body;
        const mensajes = [mensaje1 || '', mensaje2 || '', mensaje3 || ''].filter(Boolean);
        
        let estado = cargarEstado(instanceId) || {};
        estado.mensajesGuardados = mensajes;
        if (respuestaInfo !== undefined) estado.respuestaInfo = respuestaInfo;
        if (tipoCampana !== undefined) estado.tipoCampana = tipoCampana;
        if (respuestasInfoPorTipo !== undefined) estado.respuestasInfoPorTipo = respuestasInfoPorTipo;
        if (linkPreviewActivo !== undefined) estado.linkPreviewActivo = linkPreviewActivo;
        
        guardarEstado(estado, instanceId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/guardar-imagen', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        if (!instanceId) return res.status(400).json({ error: 'No hay instancia activa' });
        if (!req.files || !req.files.imagen) return res.status(400).json({ error: 'No se envió imagen' });
        
        const imagen = req.files.imagen;
        const nombreArchivo = `${Date.now()}_${imagen.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const rutaArchivo = path.join(UPLOADS_DIR, nombreArchivo);
        await imagen.mv(rutaArchivo);
        
        let estado = cargarEstado(instanceId) || {};
        estado.imagenGuardada = nombreArchivo;
        guardarEstado(estado, instanceId);
        
        res.json({ success: true, archivo: nombreArchivo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/borrar-imagen', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        if (!instanceId) return res.status(400).json({ error: 'No hay instancia activa' });
        
        let estado = cargarEstado(instanceId);
        if (estado && estado.imagenGuardada) {
            const ruta = path.join(UPLOADS_DIR, estado.imagenGuardada);
            if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
            estado.imagenGuardada = null;
            guardarEstado(estado, instanceId);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/eliminar-conversacion', async (req, res) => {
    try {
        const userId = req.session.userId;
        const { conversacionId } = req.body;
        if (!conversacionId) return res.status(400).json({ error: 'Datos incompletos' });
        
        const instancias = sessionManager.getUserInstances(userId);
        let eliminado = false;
        
        for (const inst of instancias) {
            let estado = cargarEstado(inst.instanceId);
            if (estado && Array.isArray(estado.conversaciones)) {
                const longitudAntes = estado.conversaciones.length;
                estado.conversaciones = estado.conversaciones.filter(c => c.id !== conversacionId);
                
                if (estado.conversaciones.length < longitudAntes) {
                    guardarEstado(estado, inst.instanceId);
                    eliminado = true;
                    break;
                }
            }
        }
        
        if (eliminado) res.json({ success: true });
        else res.status(404).json({ success: false, error: 'No encontrada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/estado', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        if (!instanceId) return res.json({ error: 'No hay instancia activa' });
        const estado = cargarEstado(instanceId);
        res.json(estado || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;