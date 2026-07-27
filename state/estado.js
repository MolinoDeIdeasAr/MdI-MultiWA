/**
 * =============================================================
 *  MdI MultiWA — state/estado.js
 *  Versión : v1.37.0
 *  Fecha   : 2026-07-04
 * =============================================================
 *  CHANGELOG
 *  ---------
 *  v1.37.0 — Convertido en gestor central del estado.
 *             Agrega StateManager con Map en memoria como
 *             fuente de verdad. El JSON es solo backup/restore.
 *             Nuevas funciones: getEstadoInstancia(),
 *             actualizarEstado(), guardarEstadoSeguro().
 *             Checkpoint automático cada 30s durante campaña.
 *  v1.0    — Persistencia básica en JSON.
 * =============================================================
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR   = path.join(__dirname, '..', 'data');
const ESTADO_DIR = path.join(DATA_DIR, 'estados');

if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
if (!fs.existsSync(ESTADO_DIR)) fs.mkdirSync(ESTADO_DIR, { recursive: true });

// ─────────────────────────────────────────────
//  FUENTE DE VERDAD EN MEMORIA
//  instanceId → objeto estado (misma referencia siempre)
// ─────────────────────────────────────────────
const _estadosEnMemoria = new Map();

// ─────────────────────────────────────────────
//  ESTADO DEFAULT
// ─────────────────────────────────────────────
function getDefaultEstado() {
    return {
        listo            : false,
        contactosCargados: [],
        actual           : 0,
        total            : 0,
        enviadosOk       : 0,
        fallidos         : [],
        enviando         : false,
        pausado          : false,
        rubro            : '',
        mensajesGuardados: ['', '', ''],
        imagenGuardada   : null,
        audioGuardado    : null,
        conversaciones   : [],
        campanaFinalizada: false,
        numeroWhatsApp   : null
    };
}

// ─────────────────────────────────────────────
//  getEstadoInstancia
//  Devuelve SIEMPRE la misma referencia en memoria.
//  Si no existe, la crea (carga del disco o default).
//  → Esta es la fuente de verdad para todo el sistema.
// ─────────────────────────────────────────────
function getEstadoInstancia(instanceId) {
    if (!instanceId) return null;

    if (_estadosEnMemoria.has(instanceId)) {
        return _estadosEnMemoria.get(instanceId);
    }

    // Primera vez: cargar del disco o crear default
    const delDisco = _cargarDelDisco(instanceId);
    const estado   = delDisco || getDefaultEstado();
    _estadosEnMemoria.set(instanceId, estado);
    return estado;
}

// ─────────────────────────────────────────────
//  actualizarEstado
//  Modifica propiedades del estado en memoria
//  SIN reemplazar la referencia.
//  Esto garantiza que api-envio, monitor e inbound
//  siempre vean el mismo objeto.
// ─────────────────────────────────────────────
function actualizarEstado(instanceId, cambios) {
    const estado = getEstadoInstancia(instanceId);
    if (!estado) return;
    Object.assign(estado, cambios);
}

// ─────────────────────────────────────────────
//  guardarEstadoSeguro
//  Persiste el estado actual al disco.
//  Nunca reemplaza el objeto en memoria.
// ─────────────────────────────────────────────
function guardarEstadoSeguro(instanceId) {
    if (!instanceId) return;
    const estado = _estadosEnMemoria.get(instanceId);
    if (!estado) return;
    _persistirEnDisco(estado, instanceId);
}

// ─────────────────────────────────────────────
//  guardarEstado (compatibilidad hacia atrás)
//  Acepta el objeto de estado como primer arg.
//  Si ya existe en memoria, actualiza propiedades.
//  Si no existe, lo registra.
// ─────────────────────────────────────────────
function guardarEstado(estado, instanceId) {
    if (!instanceId || !estado) return;

    if (_estadosEnMemoria.has(instanceId)) {
        // Actualizar en-place para no romper referencias
        const enMemoria = _estadosEnMemoria.get(instanceId);
        Object.assign(enMemoria, estado);
        _persistirEnDisco(enMemoria, instanceId);
    } else {
        _estadosEnMemoria.set(instanceId, estado);
        _persistirEnDisco(estado, instanceId);
    }
}

// ─────────────────────────────────────────────
//  cargarEstado (compatibilidad hacia atrás)
//  Retorna el estado en memoria si existe,
//  sino lo carga del disco.
// ─────────────────────────────────────────────
function cargarEstado(instanceId) {
    if (!instanceId) return null;
    if (_estadosEnMemoria.has(instanceId)) {
        return _estadosEnMemoria.get(instanceId);
    }
    const delDisco = _cargarDelDisco(instanceId);
    if (delDisco) {
        _estadosEnMemoria.set(instanceId, delDisco);
    }
    return delDisco;
}

// ─────────────────────────────────────────────
//  PRIVADAS
// ─────────────────────────────────────────────
function _persistirEnDisco(estado, instanceId) {
    try {
        const filePath = path.join(ESTADO_DIR, `${instanceId}.json`);
        const completo = { ...getDefaultEstado(), ...estado };
        fs.writeFileSync(filePath, JSON.stringify(completo, null, 2), 'utf8');
    } catch (err) {
        console.error(`❌ Error persistiendo estado ${instanceId}:`, err.message);
    }
}

function _cargarDelDisco(instanceId) {
    try {
        const filePath = path.join(ESTADO_DIR, `${instanceId}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (err) {
        console.error(`❌ Error cargando estado ${instanceId}:`, err.message);
    }
    return null;
}

// ─────────────────────────────────────────────
//  CHECKPOINT AUTOMÁTICO
//  Persiste todos los estados activos cada 30s.
//  Evita pérdida de datos si el proceso muere.
// ─────────────────────────────────────────────
setInterval(() => {
    for (const [instanceId, estado] of _estadosEnMemoria) {
        if (estado.enviando) {
            _persistirEnDisco(estado, instanceId);
        }
    }
}, 30000);

// ─────────────────────────────────────────────
//  HELPERS (compatibilidad con código existente)
// ─────────────────────────────────────────────
function guardarMensajes(instanceId, mensajes) {
    try {
        actualizarEstado(instanceId, { mensajesGuardados: mensajes });
        guardarEstadoSeguro(instanceId);
        return true;
    } catch (err) {
        console.error('❌ Error al guardar mensajes:', err.message);
        return false;
    }
}

function guardarImagen(instanceId, nombreArchivo) {
    try {
        actualizarEstado(instanceId, { imagenGuardada: nombreArchivo });
        guardarEstadoSeguro(instanceId);
        return true;
    } catch (err) {
        console.error('❌ Error al guardar imagen:', err.message);
        return false;
    }
}

function guardarAudio(instanceId, nombreArchivo) {
    try {
        actualizarEstado(instanceId, { audioGuardado: nombreArchivo });
        guardarEstadoSeguro(instanceId);
        return true;
    } catch (err) {
        console.error('❌ Error al guardar audio:', err.message);
        return false;
    }
}

function eliminarImagen(instanceId) {
    try {
        const estado = getEstadoInstancia(instanceId);
        if (estado && estado.imagenGuardada) {
            const filePath = path.join(__dirname, '..', 'uploads', estado.imagenGuardada);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            actualizarEstado(instanceId, { imagenGuardada: null });
            guardarEstadoSeguro(instanceId);
        }
        return true;
    } catch (err) {
        console.error('❌ Error al eliminar imagen:', err.message);
        return false;
    }
}

function eliminarAudio(instanceId) {
    try {
        const estado = getEstadoInstancia(instanceId);
        if (estado && estado.audioGuardado) {
            const filePath = path.join(__dirname, '..', 'uploads', estado.audioGuardado);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            actualizarEstado(instanceId, { audioGuardado: null });
            guardarEstadoSeguro(instanceId);
        }
        return true;
    } catch (err) {
        console.error('❌ Error al eliminar audio:', err.message);
        return false;
    }
}

module.exports = {
    // Nuevas (v1.37.0)
    getEstadoInstancia,
    actualizarEstado,
    guardarEstadoSeguro,
    // Compatibilidad (v1.0)
    getDefaultEstado,
    guardarEstado,
    cargarEstado,
    guardarMensajes,
    guardarImagen,
    guardarAudio,
    eliminarImagen,
    eliminarAudio
};
