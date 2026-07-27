const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { guardarEstado, cargarEstado } = require('../state/estado');
const sessionManager = require('../services/session-manager');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Limpiar archivos viejos automáticamente
function limpiarArchivosViejos() {
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días
        const ahora = Date.now();
        let borrados = 0;
        
        for (const file of files) {
            const filePath = path.join(UPLOADS_DIR, file);
            const stats = fs.statSync(filePath);
            if (ahora - stats.mtimeMs > MAX_AGE) {
                fs.unlinkSync(filePath);
                borrados++;
            }
        }
        if (borrados > 0) console.log(`🧹 Limpiados ${borrados} archivos viejos de uploads`);
    } catch (e) { /* ignorar */ }
}

// Ejecutar limpieza cada hora
setInterval(limpiarArchivosViejos, 60 * 60 * 1000);
limpiarArchivosViejos();

// Guardar mensajes
router.post('/guardar-mensajes', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'No hay instancia activa' });
        }
        
        const { mensaje1, mensaje2, mensaje3 } = req.body;
        const mensajes = [mensaje1 || '', mensaje2 || '', mensaje3 || ''];
        
        let estado = cargarEstado(instanceId) || {};
        estado.mensajesGuardados = mensajes;
        guardarEstado(estado, instanceId);
        
        // Actualizar en memoria
        const userSession = sessionManager.getUserSession(userId);
        if (userSession) {
            const instancia = userSession.instances.get(instanceId);
            if (instancia) {
                instancia.estado = estado;
                sessionManager.guardarInstancia(userId, instanceId, instancia);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando mensajes:', error);
        res.status(500).json({ error: 'Error al guardar mensajes' });
    }
});

// Guardar imagen
router.post('/guardar-imagen', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'No hay instancia activa' });
        }
        
        if (!req.files || !req.files.imagen) {
            return res.status(400).json({ error: 'No se envió ninguna imagen' });
        }
        
        const imagen = req.files.imagen;
        const nombreArchivo = `${Date.now()}_${imagen.name}`;
        const rutaArchivo = path.join(UPLOADS_DIR, nombreArchivo);
        await imagen.mv(rutaArchivo);
        
        let estado = cargarEstado(instanceId) || {};
        estado.imagenGuardada = nombreArchivo;
        guardarEstado(estado, instanceId);
        
        const userSession = sessionManager.getUserSession(userId);
        if (userSession) {
            const instancia = userSession.instances.get(instanceId);
            if (instancia) {
                instancia.estado = estado;
                sessionManager.guardarInstancia(userId, instanceId, instancia);
            }
        }
        
        res.json({ success: true, archivo: nombreArchivo });
    } catch (error) {
        console.error('Error guardando imagen:', error);
        res.status(500).json({ error: 'Error al guardar imagen' });
    }
});

// Guardar audio
router.post('/guardar-audio', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'No hay instancia activa' });
        }
        
        if (!req.files || !req.files.audio) {
            return res.status(400).json({ error: 'No se envió ningún audio' });
        }
        
        const audio = req.files.audio;
        const nombreArchivo = `${Date.now()}_${audio.name}`;
        const rutaArchivo = path.join(UPLOADS_DIR, nombreArchivo);
        await audio.mv(rutaArchivo);
        
        let estado = cargarEstado(instanceId) || {};
        estado.audioGuardado = nombreArchivo;
        guardarEstado(estado, instanceId);
        
        const userSession = sessionManager.getUserSession(userId);
        if (userSession) {
            const instancia = userSession.instances.get(instanceId);
            if (instancia) {
                instancia.estado = estado;
                sessionManager.guardarInstancia(userId, instanceId, instancia);
            }
        }
        
        res.json({ success: true, archivo: nombreArchivo });
    } catch (error) {
        console.error('Error guardando audio:', error);
        res.status(500).json({ error: 'Error al guardar audio' });
    }
});

// Eliminar imagen
router.post('/borrar-imagen', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'No hay instancia activa' });
        }
        
        const userSession = sessionManager.getUserSession(userId);
        if (userSession) {
            const instancia = userSession.instances.get(instanceId);
            if (instancia && instancia.estado && instancia.estado.imagenGuardada) {
                const ruta = path.join(UPLOADS_DIR, instancia.estado.imagenGuardada);
                if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
                instancia.estado.imagenGuardada = null;
                guardarEstado(instancia.estado, instanceId);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar imagen' });
    }
});

// Eliminar audio
router.post('/borrar-audio', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        
        if (!instanceId) {
            return res.status(400).json({ error: 'No hay instancia activa' });
        }
        
        const userSession = sessionManager.getUserSession(userId);
        if (userSession) {
            const instancia = userSession.instances.get(instanceId);
            if (instancia && instancia.estado && instancia.estado.audioGuardado) {
                const ruta = path.join(UPLOADS_DIR, instancia.estado.audioGuardado);
                if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
                instancia.estado.audioGuardado = null;
                guardarEstado(instancia.estado, instanceId);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar audio' });
    }
});

// Estado
router.get('/estado', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        if (!instanceId) return res.json({ error: 'No hay instancia activa' });
        const estado = cargarEstado(instanceId);
        res.json(estado || {});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener estado' });
    }
});

module.exports = router;