'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { guardarEstado, cargarEstado } = require('../state/estado');
const sessionManager = require('../services/session-manager');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

//----------------------------------------------------------
// Limpiar archivos viejos automáticamente
//----------------------------------------------------------
function limpiarArchivosViejos() {
    try {
        const files = fs.readdirSync(UPLOADS_DIR);
        const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
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
    } catch (e) {}
}

setInterval(limpiarArchivosViejos, 60 * 60 * 1000);
limpiarArchivosViejos();

//----------------------------------------------------------
// Guardar mensajes
//----------------------------------------------------------
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

//----------------------------------------------------------
// Guardar imagen
//----------------------------------------------------------
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

//----------------------------------------------------------
// Eliminar imagen
//----------------------------------------------------------
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

//----------------------------------------------------------
// ELIMINAR CONVERSACIÓN INDIVIDUAL (NUEVO)
//----------------------------------------------------------
router.post('/eliminar-conversacion', async (req, res) => {
    try {
        const userId = req.session.userId;
        const instanceId = sessionManager.getActiveInstanceId(userId);
        const { conversacionId, numero } = req.body;

        if (!instanceId || !conversacionId) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        let estado = cargarEstado(instanceId);
        if (!estado) {
            return res.status(404).json({ error: 'Estado no encontrado' });
        }

        // Eliminar del estado de la instancia
        if (Array.isArray(estado.conversaciones)) {
            estado.conversaciones = estado.conversaciones.filter(
                conv => conv.id !== conversacionId
            );
            guardarEstado(estado, instanceId);
        }

        // Eliminar del CRM si hay número
        if (numero) {
            try {
                const crm = require('../services/crm-manager');
                const cliente = crm.buscarCliente(numero);
                if (cliente && Array.isArray(cliente.conversaciones)) {
                    cliente.conversaciones = cliente.conversaciones.filter(
                        conv => conv.id !== conversacionId
                    );
                    crm.marcarDirty();
                    crm.flush();
                }
            } catch (err) {
                console.warn('⚠️ No se pudo eliminar del CRM:', err.message);
            }
        }

        // Actualizar en memoria
        const userSession = sessionManager.getUserSession(userId);
        if (userSession) {
            const instancia = userSession.instances.get(instanceId);
            if (instancia) {
                instancia.estado = estado;
                sessionManager.guardarInstancia(userId, instanceId, instancia);
            }
        }

        console.log(`🗑️ Conversación eliminada: ${conversacionId} (${numero || 'sin número'})`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando conversación:', error);
        res.status(500).json({ error: error.message });
    }
});

//----------------------------------------------------------
// LIMPIAR SESIONES VIEJAS (NUEVO)
//----------------------------------------------------------
router.post('/limpiar-sesiones', async (req, res) => {
    try {
        const { limpiarTodo } = require('../services/session-cleanup');
        const resultado = limpiarTodo();
        res.json({ success: true, ...resultado });
    } catch (error) {
        console.error('Error en limpieza:', error);
        res.status(500).json({ error: error.message });
    }
});

//----------------------------------------------------------
// Estado
//----------------------------------------------------------
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