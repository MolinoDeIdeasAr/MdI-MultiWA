/**
 * services/bajas.js
 * 
 * Archivo permanente de bajas — NUNCA se borra automáticamente.
 * Persiste entre reinstalaciones si se hace backup de data/bajas.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BAJAS_FILE = path.join(DATA_DIR, 'bajas.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Cargar bajas desde disco
function cargarBajas() {
    try {
        if (fs.existsSync(BAJAS_FILE)) {
            return JSON.parse(fs.readFileSync(BAJAS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('❌ Error cargando bajas.json:', e.message);
    }
    return {};
}

// Guardar bajas en disco
function guardarBajas(bajas) {
    try {
        fs.writeFileSync(BAJAS_FILE, JSON.stringify(bajas, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Error guardando bajas.json:', e.message);
    }
}

// Normalizar número para comparación consistente (últimos 10 dígitos)
function normalizarNumero(numero) {
    let num = String(numero || '').replace(/\D/g, '');
    if (num.startsWith('549')) num = num.slice(3);
    else if (num.startsWith('54')) num = num.slice(2);
    if (num.startsWith('0')) num = num.slice(1);
    return num.slice(-10);
}

// Registrar una baja
function registrarBaja(numero, nombre) {
    const norm = normalizarNumero(numero);
    if (!norm) return;

    const bajas = cargarBajas();

    // Solo agregar si no existe ya
    if (!bajas[norm]) {
        bajas[norm] = {
            numero: String(numero),
            nombre: nombre || 'Desconocido',
            fechaBaja: new Date().toISOString(),
            fechaLegible: new Date().toLocaleString('es-AR')
        };
        guardarBajas(bajas);
        console.log(`🚫 Baja registrada permanentemente: ${nombre} (${numero})`);
    }
}

// Verificar si un número está en la lista de bajas
function esBaja(numero) {
    const norm = normalizarNumero(numero);
    if (!norm) return false;
    const bajas = cargarBajas();
    return !!bajas[norm];
}

// Obtener todas las bajas (para mostrar en UI)
function obtenerBajas() {
    const bajas = cargarBajas();
    return Object.values(bajas).sort((a, b) =>
        new Date(b.fechaBaja) - new Date(a.fechaBaja)
    );
}

// Cantidad de bajas
function cantidadBajas() {
    return Object.keys(cargarBajas()).length;
}

module.exports = {
    registrarBaja,
    esBaja,
    obtenerBajas,
    cantidadBajas,
    normalizarNumero
};
