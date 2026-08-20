'use strict';

//==============================================================
// session-cleanup.js
// Limpieza automática de sesiones e instancias viejas
//==============================================================

const fs = require('fs');
const path = require('path');

const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
const DATA_DIR = path.join(__dirname, '..', 'data');
const INSTANCIAS_FILE = path.join(DATA_DIR, 'instancias.json');
const MAX_AGE_DAYS = 30;

//----------------------------------------------------------
// LIMPIAR SESIONES VIEJAS (carpeta sessions/)
//----------------------------------------------------------
function limpiarSesionesViejas() {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) {
            return 0;
        }

        const ahora = Date.now();
        const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        let borradas = 0;

        const sesiones = fs.readdirSync(SESSIONS_DIR);

        for (const sesion of sesiones) {
            const sesionPath = path.join(SESSIONS_DIR, sesion);
            try {
                const stats = fs.statSync(sesionPath);
                if (ahora - stats.mtimeMs > maxAge) {
                    fs.rmSync(sesionPath, { recursive: true, force: true });
                    borradas++;
                    console.log(`🗑️ Sesión vieja eliminada: ${sesion}`);
                }
            } catch (err) {
                console.warn(`⚠️ No se pudo eliminar sesión ${sesion}: ${err.message}`);
            }
        }

        return borradas;
    } catch (err) {
        console.error('❌ Error limpiando sesiones:', err.message);
        return 0;
    }
}

//----------------------------------------------------------
// LIMPIAR INSTANCIAS VIEJAS (instancias.json)
//----------------------------------------------------------
function limpiarInstanciasViejas() {
    try {
        if (!fs.existsSync(INSTANCIAS_FILE)) {
            return 0;
        }

        const ahora = Date.now();
        const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        let borradas = 0;

        const data = JSON.parse(fs.readFileSync(INSTANCIAS_FILE, 'utf8'));
        let modificado = false;

        for (const userId in data) {
            if (!Array.isArray(data[userId])) continue;

            const antes = data[userId].length;
            data[userId] = data[userId].filter(inst => {
                const fecha = inst.fechaCreacion || inst.ultimaActividad;
                if (!fecha) return true;

                const edad = ahora - new Date(fecha).getTime();
                return edad <= maxAge;
            });

            if (data[userId].length < antes) {
                borradas += (antes - data[userId].length);
                modificado = true;
            }

            if (data[userId].length === 0) {
                delete data[userId];
                modificado = true;
            }
        }

        if (modificado) {
            fs.writeFileSync(INSTANCIAS_FILE, JSON.stringify(data, null, 2), 'utf8');
        }

        return borradas;
    } catch (err) {
        console.error('❌ Error limpiando instancias:', err.message);
        return 0;
    }
}

//----------------------------------------------------------
// LIMPIEZA COMPLETA
//----------------------------------------------------------
function limpiarTodo() {
    console.log('🧹 Iniciando limpieza de sesiones viejas...');

    const sesiones = limpiarSesionesViejas();
    const instancias = limpiarInstanciasViejas();

    console.log(`✅ Limpieza completada: ${sesiones} sesiones, ${instancias} instancias eliminadas`);

    return { sesiones, instancias };
}

//----------------------------------------------------------
// LIMPIEZA AUTOMÁTICA DIARIA
//----------------------------------------------------------
function iniciarLimpiezaAutomatica() {
    // Ejecutar al iniciar (después de 5 segundos)
    setTimeout(limpiarTodo, 5000);

    // Ejecutar cada 24 horas
    setInterval(limpiarTodo, 24 * 60 * 60 * 1000);

    console.log('🕐 Limpieza automática de sesiones programada cada 24hs');
}

module.exports = {
    limpiarSesionesViejas,
    limpiarInstanciasViejas,
    limpiarTodo,
    iniciarLimpiezaAutomatica
};