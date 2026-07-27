/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-scheduler.js
 *
 * Scheduler central de campañas
 *
 * Versión : v4.0.0
 * Fecha    : 2026-07-25
 *
 * CHANGELOG
 * -------------------------------------------------------------
 * v4.0.0
 * - Scheduler persistente.
 * - Recuperación automática al reiniciar.
 * - Soporte para PAUSA / CONTINUAR.
 * - Shutdown seguro.
 * - Scheduler desacoplado del Runner.
 * =============================================================
 */

'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const runner =
    require('./campaign-runner');

const sessionManager =
    require('./session-manager');

const {

    getScheduler,
    guardarScheduler

} = require('../state/scheduler-state');

const {

    guardarEstadoSeguro

} = require('../state/estado');

//==============================================================
// SOCKET.IO
//==============================================================

let io = null;

//==============================================================
// TIMERS ACTIVOS
//==============================================================

const timers =
    new Map();

//==============================================================
// INIT
//==============================================================

function init(socketIO) {

    io = socketIO;

    console.log(
        '🗓️ Campaign Scheduler inicializado'
    );

}

//==============================================================
// GET IO
//==============================================================

function getIO() {

    return io;

}

//==============================================================
// INICIAR CAMPAÑA
//==============================================================

async function iniciar(instanceId) {

    const scheduler =
        getScheduler(instanceId);

    if (scheduler.running) {

        return false;

    }

    scheduler.running = true;

    scheduler.stopRequested = false;

    scheduler.nextRun = Date.now();

    guardarScheduler(instanceId);

    ejecutar(instanceId);

    return true;

}

//==============================================================
// EJECUTAR
//==============================================================

async function ejecutar(instanceId) {

    const scheduler =
        getScheduler(instanceId);

    //----------------------------------------------------------
    // STOP SOLICITADO
    //----------------------------------------------------------

    if (scheduler.stopRequested) {

        scheduler.running = false;

        guardarScheduler(instanceId);

        if (timers.has(instanceId)) {

            clearTimeout(
                timers.get(instanceId)
            );

            timers.delete(instanceId);

        }

        return;

    }

    try {

        //------------------------------------------------------
        // EJECUTAR RUNNER
        //------------------------------------------------------

        const resultado =
            await runner.run(instanceId);

        //------------------------------------------------------
        // FINALIZADA
        //------------------------------------------------------

        if (
            resultado.tipo ===
            runner.RESULTADO.FINALIZADA
        ) {

            scheduler.running = false;

            scheduler.nextRun = null;

            guardarScheduler(instanceId);

            timers.delete(instanceId);

            console.log(
                `✅ Campaña finalizada (${instanceId})`
            );

            return;

        }

        //------------------------------------------------------
        // ERROR FATAL
        //------------------------------------------------------

        if (
            resultado.tipo ===
            runner.RESULTADO.ERROR
        ) {

            scheduler.running = false;

            scheduler.nextRun = null;

            guardarScheduler(instanceId);

            timers.delete(instanceId);

            console.error(
                `❌ Scheduler detenido (${instanceId})`
            );

            return;

        }

        //------------------------------------------------------
        // PAUSA
        //------------------------------------------------------

        if (
            resultado.tipo ===
            runner.RESULTADO.PAUSA
        ) {

            scheduler.nextRun =
                Date.now() + resultado.pausa;

            guardarScheduler(instanceId);

            programar(
                instanceId,
                resultado.pausa
            );

            return;

        }

        //------------------------------------------------------
        // CONTINUAR
        //------------------------------------------------------

        if (
            resultado.tipo ===
            runner.RESULTADO.CONTINUAR
        ) {

            scheduler.nextRun =
                Date.now() + 100;

            guardarScheduler(instanceId);

            guardarEstadoSeguro(instanceId);

            programar(
                instanceId,
                100
            );

            return;

        }

        //------------------------------------------------------
        // OK
        //------------------------------------------------------

        if (
            resultado.tipo ===
            runner.RESULTADO.OK
        ) {

            scheduler.nextRun =
                Date.now() + resultado.pausa;

            guardarScheduler(instanceId);

            guardarEstadoSeguro(instanceId);

            programar(
                instanceId,
                resultado.pausa
            );

            return;

        }

        //------------------------------------------------------
        // BAJA
        //------------------------------------------------------

        if (
            resultado.tipo ===
            runner.RESULTADO.BAJA
        ) {

            scheduler.nextRun =
                Date.now() + 100;

            guardarScheduler(instanceId);

            guardarEstadoSeguro(instanceId);

            programar(
                instanceId,
                100
            );

            return;

        }

        //------------------------------------------------------
        // RESULTADO DESCONOCIDO
        //------------------------------------------------------

        console.warn(
            `⚠️ Resultado desconocido del runner (${instanceId})`
        );

        scheduler.running = false;

        scheduler.nextRun = null;

        guardarScheduler(instanceId);

        timers.delete(instanceId);

    }

    catch (err) {

        console.error(
            `❌ Error Scheduler ${instanceId}:`,
            err.message
        );

        scheduler.running = false;

        scheduler.nextRun = null;

        guardarScheduler(instanceId);

        timers.delete(instanceId);

    }

}

//==============================================================
// PROGRAMAR PRÓXIMA EJECUCIÓN
//==============================================================

function programar(
    instanceId,
    delay
) {

    if (timers.has(instanceId)) {

        clearTimeout(
            timers.get(instanceId)
        );

    }

    const timer = setTimeout(

        () => {

            timers.delete(instanceId);

            ejecutar(instanceId);

        },

        Math.max(100, delay)

    );

    timers.set(
        instanceId,
        timer
    );

}

//==============================================================
// DETENER
//==============================================================

function detener(instanceId) {

    const scheduler =
        getScheduler(instanceId);

    scheduler.stopRequested = true;

    scheduler.running = false;

    scheduler.nextRun = null;

    guardarScheduler(instanceId);

    if (timers.has(instanceId)) {

        clearTimeout(
            timers.get(instanceId)
        );

        timers.delete(instanceId);

    }

    console.log(
        `🛑 Campaña detenida (${instanceId})`
    );

}

//==============================================================
// RESTAURAR CAMPAÑAS
//==============================================================

function restaurarCampañas() {

    const instanceIds =
        sessionManager.getInstanceIds();

    if (!instanceIds.length) {

        console.log(
            '📭 No hay instancias para restaurar campañas'
        );

        return;

    }

   
    //----------------------------------------------------------

    for (const instanceId of instanceIds) {

        const scheduler =
            getScheduler(instanceId);

        if (!scheduler.running) {

            continue;

        }

        const delay = Math.max(

            100,

            (scheduler.nextRun || Date.now()) -

            Date.now()

        );

        console.log(

            `🔄 Restaurando campaña ${instanceId} en ${Math.round(delay / 1000)}s`

        );

        programar(

            instanceId,

            delay

        );

    }

}

//==============================================================
// SHUTDOWN
//==============================================================

async function shutdown() {

    for (const timer of timers.values()) {

        clearTimeout(timer);

    }

    timers.clear();

    console.log(

        '🛑 Campaign Scheduler detenido'

    );

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