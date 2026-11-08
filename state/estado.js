'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const estados = new Map();

function getEstadoPath(instanceId) {
    return path.join(DATA_DIR, `estado_${instanceId}.json`);
}

function getDefaultEstado() {
    return {
        listo: false, numeroWhatsApp: '', enviando: false, pausado: false, campanaFinalizada: false,
        contactosCargados: [], actual: 0, total: 0, enviadosOk: 0, fallidos: [],
        mensajesGuardados: [], imagenGuardada: null, rubro: '', usuario: '', nombreInstancia: '',
        respuestaInfo: '', tipoCampana: '', respuestasInfoPorTipo: {}, linkPreviewActivo: false,
        conversaciones: [], enviadosHoy: 0, respuestasHoy: 0, bajasHoy: 0,
        campanasGuardadasPorTipo: {}, // <-- Plantillas por tipo
        fechaCreacion: new Date().toISOString(), ultimaActualizacion: new Date().toISOString()
    };
}

function getEstadoInstancia(instanceId) {
    if (!instanceId) return null;
    if (estados.has(instanceId)) return estados.get(instanceId);
    const estado = cargarEstado(instanceId);
    estados.set(instanceId, estado);
    return estado;
}

function setEstadoInstancia(instanceId, nuevoEstado) {
    if (!instanceId) return null;
    const estado = { ...getDefaultEstado(), ...(nuevoEstado || {}), ultimaActualizacion: new Date().toISOString() };
    estados.set(instanceId, estado);
    guardarEstadoSeguro(instanceId);
    return estado;
}

function actualizarEstado(instanceId, cambios = {}) {
    const estado = getEstadoInstancia(instanceId);
    if (!estado) return null;
    Object.assign(estado, cambios);
    estado.ultimaActualizacion = new Date().toISOString();
    guardarEstadoSeguro(instanceId);
    return estado;
}

function existeEstado(instanceId) { return estados.has(instanceId); }
function eliminarEstadoMemoria(instanceId) { estados.delete(instanceId); }
function getEstados() { return estados; }
function getImagen(instanceId) { return getEstadoInstancia(instanceId)?.imagenGuardada || null; }

function guardarEstado(estado, instanceId) {
    if (!instanceId || !estado) return false;
    estado.ultimaActualizacion = new Date().toISOString();
    estados.set(instanceId, estado);
    return persistirEstado(instanceId, estado);
}

function guardarEstadoSeguro(instanceId) {
    const estado = estados.get(instanceId);
    if (!estado) return false;
    estado.ultimaActualizacion = new Date().toISOString();
    return persistirEstado(instanceId, estado);
}

function persistirEstado(instanceId, estado) {
    try {
        fs.writeFileSync(getEstadoPath(instanceId), JSON.stringify(estado, null, 4), 'utf8');
        return true;
    } catch (err) {
        console.error(`❌ Error guardando estado (${instanceId})`, err);
        return false;
    }
}

function cargarEstado(instanceId) {
    const archivo = getEstadoPath(instanceId);
    if (!fs.existsSync(archivo)) return getDefaultEstado();
    try {
        const json = JSON.parse(fs.readFileSync(archivo, 'utf8'));
        const conversacionesEnDisco = Array.isArray(json.conversaciones) ? json.conversaciones : [];
        
        if (json.imagenGuardada) {
            const nombreImagen = typeof json.imagenGuardada === 'string' ? json.imagenGuardada : json.imagenGuardada.archivo;
            const rutaImagen = path.join(__dirname, '..', 'uploads', nombreImagen);
            if (!fs.existsSync(rutaImagen)) json.imagenGuardada = null;
        }
        
        return { ...getDefaultEstado(), ...json, conversaciones: conversacionesEnDisco };
    } catch (err) {
        console.error(`⚠ Estado corrupto (${instanceId})`, err);
        return getDefaultEstado();
    }
}

function existeEstadoEnDisco(instanceId) { return fs.existsSync(getEstadoPath(instanceId)); }

function guardarMensajes(instanceId, mensajes) {
    const estado = getEstadoInstancia(instanceId);
    estado.mensajesGuardados = Array.isArray(mensajes) ? mensajes.filter(Boolean) : [];
    guardarEstadoSeguro(instanceId);
    return estado;
}

function guardarImagen(instanceId, nombreArchivo) {
    const estado = getEstadoInstancia(instanceId);
    if (!nombreArchivo || typeof nombreArchivo !== 'string') {
        estado.imagenGuardada = null;
        guardarEstadoSeguro(instanceId);
        return estado;
    }
    const archivo = path.join(__dirname, '..', 'uploads', nombreArchivo);
    if (!fs.existsSync(archivo)) {
        estado.imagenGuardada = null;
        guardarEstadoSeguro(instanceId);
        return estado;
    }
    estado.imagenGuardada = nombreArchivo;
    guardarEstadoSeguro(instanceId);
    return estado;
}

function eliminarImagen(instanceId) {
    const estado = getEstadoInstancia(instanceId);
    estado.imagenGuardada = null;
    guardarEstadoSeguro(instanceId);
    return estado;
}

function limpiarCampania(instanceId) {
    const estado = getEstadoInstancia(instanceId);
    const conversacionesExistentes = Array.isArray(estado.conversaciones) ? estado.conversaciones : [];
    estado.contactosCargados = []; estado.actual = 0; estado.total = 0; estado.enviadosOk = 0; estado.fallidos = [];
    estado.enviando = false; estado.pausado = false; estado.campanaFinalizada = false;
    estado.mensajesGuardados = []; estado.imagenGuardada = null;
    estado.conversaciones = conversacionesExistentes; // No se borran
    guardarEstadoSeguro(instanceId);
    return estado;
}

function resetearContadores(instanceId) {
    const estado = getEstadoInstancia(instanceId);
    estado.actual = 0; estado.total = estado.contactosCargados.length;
    estado.enviadosOk = 0; estado.fallidos = [];
    estado.enviando = false; estado.pausado = false; estado.campanaFinalizada = false;
    guardarEstadoSeguro(instanceId);
    return estado;
}

// ==========================================
// PLANTILLAS POR TIPO DE CAMPAÑA
// ==========================================
function guardarCampanaPorTipo(instanceId, tipo, datos) {
    if (!tipo || !datos) return;
    const estado = getEstadoInstancia(instanceId);
    if (!estado.campanasGuardadasPorTipo) estado.campanasGuardadasPorTipo = {};
    estado.campanasGuardadasPorTipo[tipo] = datos;
    guardarEstadoSeguro(instanceId);
}

function obtenerCampanaPorTipo(instanceId, tipo) {
    const estado = getEstadoInstancia(instanceId);
    if (estado && estado.campanasGuardadasPorTipo && estado.campanasGuardadasPorTipo[tipo]) {
        return estado.campanasGuardadasPorTipo[tipo];
    }
    return null;
}

module.exports = {
    getDefaultEstado, getEstadoInstancia, setEstadoInstancia, actualizarEstado,
    existeEstado, eliminarEstadoMemoria, getEstados, getImagen,
    guardarEstado, guardarEstadoSeguro, cargarEstado, existeEstadoEnDisco,
    limpiarCampania, resetearContadores, guardarMensajes, guardarImagen, eliminarImagen,
    guardarCampanaPorTipo, obtenerCampanaPorTipo // <-- EXPORTADAS CORRECTAMENTE
};