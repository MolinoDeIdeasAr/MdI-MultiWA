'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * scripts/limpiar-huerfanos.js
 *
 * v1.0.0
 *
 * Limpieza de archivos huérfanos en disco: imágenes de campaña
 * que ya nadie referencia, carpetas de sesión de Chrome/WhatsApp
 * de instancias que ya no existen, y estados persistidos de
 * instancias borradas.
 *
 * Por qué hace falta: hasta hoy, borrar una instancia desde la
 * interfaz solo la sacaba de data/instancias.json — la carpeta
 * de sesión (sessions/session-<id>, puede pesar bastante por el
 * perfil de Chrome), el estado (data/estado_<id>.json) y la
 * imagen de campaña asociada quedaban en disco para siempre.
 * Ya se arregló para que esto no vuelva a pasar de acá en
 * adelante (services/session-manager.js, removeInstance) — este
 * script es para lo que ya se acumuló ANTES de ese fix.
 *
 * USO:
 *   node scripts/limpiar-huerfanos.js            → solo lista, no borra nada
 *   node scripts/limpiar-huerfanos.js --borrar    → borra lo que encontró
 *
 * Correrlo con el server PARADO, para evitar borrar algo que
 * justo se está usando en ese momento.
 * =============================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SESSIONS_DIR = path.join(ROOT, 'sessions');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const INSTANCIAS_FILE = path.join(DATA_DIR, 'instancias.json');

const BORRAR = process.argv.includes('--borrar');

function formatoBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tamanioCarpeta(ruta) {
    let total = 0;
    try {
        const items = fs.readdirSync(ruta, { withFileTypes: true });
        for (const item of items) {
            const full = path.join(ruta, item.name);
            if (item.isDirectory()) {
                total += tamanioCarpeta(full);
            } else {
                try {
                    total += fs.statSync(full).size;
                } catch {}
            }
        }
    } catch {}
    return total;
}

//==============================================================
// 1) Cargar instancias conocidas (de TODOS los usuarios)
//==============================================================

function cargarInstanciasConocidas() {
    const idsConocidos = new Set();
    const imagenesUsadas = new Set();

    if (!fs.existsSync(INSTANCIAS_FILE)) {
        console.log('⚠ No existe data/instancias.json — no se puede determinar qué es huérfano. Cancelando.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));

    for (const userId of Object.keys(data)) {
        for (const instancia of data[userId]) {
            idsConocidos.add(instancia.id);
            const img = instancia.estado?.imagenGuardada;
            if (img) imagenesUsadas.add(img);
        }
    }

    return { idsConocidos, imagenesUsadas };
}

//==============================================================
// MAIN
//==============================================================

function main() {
    const { idsConocidos, imagenesUsadas } = cargarInstanciasConocidas();

    console.log(`📋 Instancias conocidas: ${idsConocidos.size}`);
    console.log('');

    let liberado = 0;

    //------------------------------------------------------
    // Carpetas de sesión huérfanas
    //------------------------------------------------------

    console.log('🔍 Revisando sessions/...');

    if (fs.existsSync(SESSIONS_DIR)) {
        const carpetas = fs.readdirSync(SESSIONS_DIR);

        for (const carpeta of carpetas) {
            const match = carpeta.match(/^session-(.+)$/);
            if (!match) continue;

            const instanceId = match[1];

            if (!idsConocidos.has(instanceId)) {
                const ruta = path.join(SESSIONS_DIR, carpeta);
                const tamanio = tamanioCarpeta(ruta);
                liberado += tamanio;

                console.log(`  🗑 ${carpeta} (${formatoBytes(tamanio)}) — instancia inexistente`);

                if (BORRAR) {
                    fs.rmSync(ruta, { recursive: true, force: true });
                }
            }
        }
    }

    //------------------------------------------------------
    // Estados huérfanos
    //------------------------------------------------------

    console.log('');
    console.log('🔍 Revisando data/estado_*.json...');

    if (fs.existsSync(DATA_DIR)) {
        const archivos = fs.readdirSync(DATA_DIR);

        for (const archivo of archivos) {
            const match = archivo.match(/^estado_(.+)\.json$/);
            if (!match) continue;

            const instanceId = match[1];

            if (!idsConocidos.has(instanceId)) {
                const ruta = path.join(DATA_DIR, archivo);
                const tamanio = fs.statSync(ruta).size;
                liberado += tamanio;

                console.log(`  🗑 ${archivo} (${formatoBytes(tamanio)}) — instancia inexistente`);

                if (BORRAR) {
                    fs.unlinkSync(ruta);
                }
            }
        }
    }

    //------------------------------------------------------
    // Imágenes huérfanas en uploads/
    //------------------------------------------------------

    console.log('');
    console.log('🔍 Revisando uploads/...');

    if (fs.existsSync(UPLOADS_DIR)) {
        const archivos = fs.readdirSync(UPLOADS_DIR);

        for (const archivo of archivos) {
            if (!imagenesUsadas.has(archivo)) {
                const ruta = path.join(UPLOADS_DIR, archivo);
                const tamanio = fs.statSync(ruta).size;
                liberado += tamanio;

                console.log(`  🗑 ${archivo} (${formatoBytes(tamanio)}) — ninguna instancia la referencia`);

                if (BORRAR) {
                    fs.unlinkSync(ruta);
                }
            }
        }
    }

    //------------------------------------------------------
    // Resumen
    //------------------------------------------------------

    console.log('');
    console.log('================================');

    if (BORRAR) {
        console.log(`✅ Limpieza terminada — se liberaron ${formatoBytes(liberado)}`);
    } else {
        console.log(`ℹ Modo solo-lectura — se liberarían ${formatoBytes(liberado)} si corrés con --borrar`);
        console.log('   node scripts/limpiar-huerfanos.js --borrar');
    }

    console.log('================================');
}

main();
