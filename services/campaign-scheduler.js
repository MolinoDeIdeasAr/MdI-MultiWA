'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-scheduler.js
 *
 * Scheduler central de campañas
 *
 * Responsabilidad:
 *  • Iniciar campañas
 *  • Ejecutar runner
 *  • Programar siguiente ejecución
 *  • Manejar pausas antiban
 *  • Finalizar campañas
 * =============================================================
 */

const runner = require('./campaign-runner');

const {
    STATUS,
    getScheduler,
    actualizarScheduler,
    reiniciarScheduler
} = require('../state/scheduler-state');

const {
    guardarEstadoSeguro
} = require('../state/estado');

//==============================================================
// SOCKET
//==============================================================

let io = null;

//==============================================================
// TIMERS
//==============================================================

const timers = new Map();

//==============================================================
// INIT
//==============================================================

function init(socketIO) {

    io = socketIO;

    console.log('🗓️ Campaign Scheduler inicializado');

}

function getIO() {

    return io;

}

//==============================================================
// PROGRAMAR SIGUIENTE EJECUCIÓN
//==============================================================

function programar(instanceId, demora) {

    if (timers.has(instanceId)) {

        clearTimeout(timers.get(instanceId));

        timers.delete(instanceId);

    }

    const timer = setTimeout(async () => {

        timers.delete(instanceId);

        await ejecutar(instanceId);

    }, demora);

    timers.set(instanceId, timer);

}

//==============================================================
// INICIAR CAMPAÑA
//==============================================================

async function iniciar(instanceId) {

    if (!instanceId) {

        console.error('❌ instanceId inválido');

        return false;

    }

    if (timers.has(instanceId)) {

        clearTimeout(timers.get(instanceId));

        timers.delete(instanceId);

    }

    reiniciarScheduler(instanceId);

    actualizarScheduler(instanceId, {

        status: STATUS.RUNNING,
        iniciado: Date.now(),
        finalizado: null,
        pausaHasta: null,
        proximoEnvio: Date.now(),
        motivo: ''

    });

    console.log(`▶ Scheduler iniciado (${instanceId})`);

    setImmediate(() => ejecutar(instanceId));

    return true;

}

//==============================================================
// EJECUTAR
//==============================================================

async function ejecutar(instanceId) {

    //----------------------------------------------------------
    // Scheduler
    //----------------------------------------------------------

    const scheduler = getScheduler(instanceId);

    if (!scheduler) {

        console.error(`❌ Scheduler inexistente (${instanceId})`);

        return;

    }

    //----------------------------------------------------------
    // ¿Sigue corriendo?
    //----------------------------------------------------------

    if (scheduler.status !== STATUS.RUNNING) {

        if (timers.has(instanceId)) {

            clearTimeout(timers.get(instanceId));
            timers.delete(instanceId);

        }

        return;

    }

    //----------------------------------------------------------
    // Ejecutar Runner
    //----------------------------------------------------------

    console.log(`🚀 Runner (${instanceId})`);

    let resultado;

    try {

        resultado = await runner.run(instanceId);

    }

    catch (err) {

        console.error("❌ Error ejecutando runner");
        console.error(err);

        actualizarScheduler(instanceId, {

            status: STATUS.ERROR,
            motivo: err.message,
            finalizado: Date.now(),
            proximoEnvio: null,
            pausaHasta: null

        });

        return;

    }

    //----------------------------------------------------------
    // Validar respuesta
    //----------------------------------------------------------

    if (!resultado || !resultado.tipo) {

        actualizarScheduler(instanceId, {

            status: STATUS.ERROR,
            motivo: "Runner devolvió resultado inválido",
            finalizado: Date.now(),
            proximoEnvio: null,
            pausaHasta: null

        });

        return;

    }

    //----------------------------------------------------------
    // ERROR
    //----------------------------------------------------------

    if (resultado.tipo === runner.RESULTADO.ERROR) {

        actualizarScheduler(instanceId, {

            status: STATUS.ERROR,
            motivo: resultado.motivo || "Error",
            finalizado: Date.now(),
            proximoEnvio: null,
            pausaHasta: null

        });

        return;

    }

    //----------------------------------------------------------
    // PAUSA
    //----------------------------------------------------------

    if (resultado.tipo === runner.RESULTADO.PAUSA) {

        const pausa = resultado.pausa || 60000;

        actualizarScheduler(instanceId, {

            status: STATUS.WAITING_TIME,
            pausaHasta: Date.now() + pausa,
            proximoEnvio: Date.now() + pausa,
            motivo: resultado.motivo || ""

        });

        programar(instanceId, pausa);

        return;

    }

    //----------------------------------------------------------
    // BAJA
    //----------------------------------------------------------

    if (resultado.tipo === runner.RESULTADO.BAJA) {

        actualizarScheduler(instanceId, {

            status: STATUS.RUNNING,
            pausaHasta: null,
            proximoEnvio: Date.now() + 100,
            motivo: ""

        });

        programar(instanceId, 100);

        return;

    }

    //----------------------------------------------------------
    // OK
    //----------------------------------------------------------

    if (resultado.tipo === runner.RESULTADO.OK) {

        guardarEstadoSeguro(instanceId);

        const pausa = resultado.pausa || 1000;

        actualizarScheduler(instanceId, {

            status: STATUS.RUNNING,
            pausaHasta: null,
            proximoEnvio: Date.now() + pausa,
            motivo: ""

        });

        programar(instanceId, pausa);

        return;

    }

    //----------------------------------------------------------
    // FINALIZADA
    //----------------------------------------------------------

    if (resultado.tipo === runner.RESULTADO.FINALIZADA) {

        guardarEstadoSeguro(instanceId);

        actualizarScheduler(instanceId, {

            status: STATUS.FINISHED,
            finalizado: Date.now(),
            pausaHasta: null,
            proximoEnvio: null,
            motivo: ""

        });

        if (timers.has(instanceId)) {

            clearTimeout(timers.get(instanceId));
            timers.delete(instanceId);

        }

        console.log(`✅ Campaña finalizada (${instanceId})`);

        return;

    }

    //----------------------------------------------------------
    // Desconocido
    //----------------------------------------------------------

    actualizarScheduler(instanceId, {

        status: STATUS.ERROR,
        motivo: "Resultado desconocido",
        finalizado: Date.now(),
        proximoEnvio: null,
        pausaHasta: null

    });

}

//==============================================================
// DETENER
//==============================================================

function detener(instanceId) {

    if (timers.has(instanceId)) {

        clearTimeout(timers.get(instanceId));

        timers.delete(instanceId);

    }

    actualizarScheduler(instanceId, {

        status: STATUS.STOPPED,
        finalizado: Date.now(),
        pausaHasta: null,
        proximoEnvio: null,
        motivo: "Detenido por el usuario"

    });

    console.log(`🛑 Scheduler detenido (${instanceId})`);

}

//==============================================================
// RESTAURAR CAMPAÑAS
//==============================================================

function restaurarCampañas() {

    console.log("🔄 Restaurando campañas...");

    //----------------------------------------------------------
    // Cancelar cualquier timer pendiente
    //----------------------------------------------------------

    for (const timer of timers.values()) {

        clearTimeout(timer);

    }

    timers.clear();

    //----------------------------------------------------------
    // En la v8 las campañas NO se restauran automáticamente.
    // Solamente se restauran las sesiones de WhatsApp.
    //----------------------------------------------------------

    console.log("✅ Scheduler limpio");

}

//==============================================================
// SHUTDOWN
//==============================================================

async function shutdown() {

    console.log("🛑 Cerrando Campaign Scheduler...");

    //----------------------------------------------------------
    // Cancelar timers
    //----------------------------------------------------------

    for (const timer of timers.values()) {

        clearTimeout(timer);

    }

    timers.clear();

    console.log("✅ Campaign Scheduler detenido");

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    init,

    getIO,

    iniciar,

    detener,

    restaurarCampañas,

    shutdown

};

