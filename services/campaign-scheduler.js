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
const antiBan = require('../config/anti-baneo');

const runner = require('./campaign-runner');

const { generarDelayHumano } = require('./formateo');

const {
    STATUS,
    getScheduler,
    actualizarScheduler,
    reiniciarScheduler
} = require('../state/scheduler-state');

const {
    guardarEstadoSeguro,
    getEstadoInstancia
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
// GET STATUS
//==============================================================
//
// FIX: routes/api-monitor.js llama a scheduler.getStatus(id) para
// armar la sección "scheduler" del monitor — esta función no
// existía (el archivo solo exportaba init/getIO/iniciar/detener/
// restaurarCampañas/shutdown), así que el monitor siempre recibía
// "{}" acá y todo salía en blanco (estado, próximo envío, etc.).
// Combina el estado real del scheduler (state/scheduler-state.js)
// con el progreso de la campaña (state/estado.js) — son fuentes
// separadas, el monitor necesita las dos juntas.
//==============================================================

function getStatus(instanceId) {

    const sch = getScheduler(instanceId);

    const estado = getEstadoInstancia(instanceId);

    const contactoActual =

        estado?.contactosCargados?.[estado.actual]?.nombre || '';

    return {

        status: sch?.status || STATUS.IDLE,

        actual: estado?.actual ?? 0,

        total: estado?.total ?? 0,

        mensajeActual: '',

        contactoActual,

        // el objeto del scheduler usa "proximoEnvio" — el
        // monitor espera "nextRun", se mapea acá
        nextRun: sch?.proximoEnvio || null,

        motivo: sch?.motivo || '',

        pausaHasta: sch?.pausaHasta || null,

        finalizado: sch?.finalizado || null

    };

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
    //
    // FIX CRÍTICO: antes chequeaba "!== STATUS.RUNNING" — pero
    // cuando el runner pausa por límite de antiban, ESTA MISMA
    // función pone status: WAITING_TIME antes de programar el
    // reintento (más abajo). Cuando el timer dispara y vuelve a
    // llamar a ejecutar(), este chequeo veía WAITING_TIME (no
    // RUNNING) y cancelaba el timer sin hacer nada — el
    // scheduler nunca retomaba después de una pausa por antiban,
    // ni una vez. Solo se debe frenar en estados realmente
    // terminales (detenido/finalizado/error) — RUNNING y
    // WAITING_TIME son ambos estados válidos para seguir.

    const ESTADOS_DETENIDOS = [

        STATUS.STOPPED,
        STATUS.FINISHED,
        STATUS.ERROR,
        STATUS.IDLE

    ];

    if (ESTADOS_DETENIDOS.includes(scheduler.status)) {

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

        // FIX: usar la pausa que viene del runner (antiBan.getPausaAleatoria)
        // que respeta PAUSA_BASE y PAUSA_MAX de la configuración antiban.
        // resultado.pausa ya incluye: CONFIG.PAUSA_BASE + ruido aleatorio + pausa por lote
        const pausa = resultado.pausa || CONFIG.PAUSA_BASE;

        console.log('⏱️ Próximo envío en ' + Math.floor(pausa / 1000) + 's (' + Math.floor(pausa / 60000) + ' min)');
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

    getStatus,

    iniciar,

    detener,

    restaurarCampañas,

    shutdown

};

