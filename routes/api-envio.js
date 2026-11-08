'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const sessionManager = require('../services/session-manager');
const scheduler = require('../services/campaign-scheduler'); // <-- ¡IMPORTADO!

const { 
    getEstadoInstancia, 
    guardarMensajes, 
    guardarImagen, 
    guardarCampanaPorTipo,
    obtenerCampanaPorTipo,
    guardarEstadoSeguro
} = require('../state/estado');

// Configuración de multer para subir imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ============================================================
// 1. GUARDAR MENSAJES Y CONFIGURACIÓN
// ============================================================
router.post('/mensajes', async (req, res) => {
    try {
        const { instanceId, mensajes, respuestaInfo, linkPreviewActivo, tipoCampana, respuestasInfoPorTipo } = req.body;
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        
        const estado = getEstadoInstancia(instanceId);
        if (!estado) return res.status(400).json({ ok: false, error: 'Estado inexistente' });

        if (tipoCampana !== undefined) estado.tipoCampana = (tipoCampana || '').trim();
        if (respuestasInfoPorTipo && typeof respuestasInfoPorTipo === 'object') {
            estado.respuestasInfoPorTipo = respuestasInfoPorTipo;
        }
        estado.linkPreviewActivo = linkPreviewActivo !== false;
        
        guardarMensajes(instanceId, mensajes);

        if (estado.tipoCampana && estado.tipoCampana.trim() !== '') {
            guardarCampanaPorTipo(instanceId, estado.tipoCampana.trim(), {
                mensajes: mensajes,
                linkPreviewActivo: estado.linkPreviewActivo,
                imagenGuardada: estado.imagenGuardada
            });
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error('❌ Error en /api/envio/mensajes:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
// 2. CARGAR PLANTILLA POR TIPO DE CAMPAÑA
// ============================================================
router.post('/cargar-tipo-campana', async (req, res) => {
    try {
        const { instanceId, tipo } = req.body;
        if (!instanceId || !tipo) return res.status(400).json({ ok: false, error: 'Faltan datos' });

        const plantilla = obtenerCampanaPorTipo(instanceId, tipo.trim());
        if (plantilla) {
            return res.json({ ok: true, datos: plantilla });
        } else {
            return res.json({ ok: true, datos: null });
        }
    } catch (err) {
        console.error('❌ Error en /api/envio/cargar-tipo-campana:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
// 3. SUBIR IMAGEN
// ============================================================
router.post('/imagen', upload.single('imagen'), async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });
        if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo' });

        guardarImagen(instanceId, req.file.filename);
        
        const estado = getEstadoInstancia(instanceId);
        if (estado && estado.tipoCampana && estado.tipoCampana.trim() !== '') {
            guardarCampanaPorTipo(instanceId, estado.tipoCampana.trim(), {
                mensajes: estado.mensajesGuardados || [],
                linkPreviewActivo: estado.linkPreviewActivo !== false,
                imagenGuardada: req.file.filename
            });
        }

        return res.json({ ok: true, archivo: req.file.filename });
    } catch (err) {
        console.error('❌ Error en /api/envio/imagen:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// ============================================================
// 4. INICIAR CAMPAÑA (¡CON EL DISPARADOR DEL SCHEDULER!)
// ============================================================
router.post('/iniciar', async (req, res) => {
    try {
        const { instanceId } = req.body;
        if (!instanceId) return res.status(400).json({ ok: false, error: 'instanceId requerido' });

        const estado = getEstadoInstancia(instanceId);
        if (!estado) return res.status(400).json({ ok: false, error: 'Estado inexistente' });

        if (!estado.contactosCargados || estado.contactosCargados.length === 0) {
            return res.status(400).json({ ok: false, error: 'No hay contactos cargados' });
        }
        if (!estado.mensajesGuardados || !estado.mensajesGuardados[0]) {
            return res.status(400).json({ ok: false, error: 'Falta el Mensaje 1' });
        }

        // 1. Marcamos el estado como enviando
        estado.enviando = true;
        estado.pausado = false;
        estado.campanaFinalizada = false;
        guardarEstadoSeguro(instanceId);
        
        // 2. ¡AQUÍ ESTÁ LA MAGIA! Le damos la orden al Scheduler de arrancar
        console.log(`⚙️ Activando Scheduler para instancia: ${instanceId}`);
        await scheduler.iniciar(instanceId);
        
        console.log(`🚀 Campaña iniciada y Scheduler activado correctamente para: ${instanceId}`);
        
        // 3. Devolvemos JSON válido SIEMPRE
        return res.json({ 
            ok: true, 
            message: 'Campaña iniciada correctamente',
            monitor: `/monitor?instanceId=${instanceId}`
        });

    } catch (err) {
        console.error('❌ Error en /api/envio/iniciar:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;