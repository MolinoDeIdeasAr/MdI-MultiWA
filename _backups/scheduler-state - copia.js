'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * state/scheduler-state.js
 *
 * v4.0.0
 *
 * Fuente única del estado del Scheduler.
 * =============================================================
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DIR = path.join(DATA_DIR, 'scheduler');

if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(DIR))
    fs.mkdirSync(DIR, { recursive: true });

const schedulerMap = new Map();

//==============================================================
// STATUS
//==============================================================

const STATUS = {

    IDLE: 'IDLE',

    RUNNING: 'RUNNING',

    WAITING_TIME: 'WAITING_TIME',

    PAUSED: 'PAUSED',

    STOPPED: 'STOPPED',

    FINISHED: 'FINISHED',

    ERROR: 'ERROR'

};

//==============================================================
// DEFAULT
//==============================================================

function getDefaultScheduler() {

    return {

        instanceId: null,

        status: STATUS.IDLE,

        iniciado: null,

        finalizado: null,

        actual: 0,

        total: 0,

        enviados: 0,

        fallidos: 0,

        bajas: 0,

        ultimoEnvio: null,

        proximoEnvio: null,

        pausaHasta: null,

        motivo: '',

        mensajeActual: null,

        contactoActual: null

    };

}

function getFile(instanceId) {

    return path.join(

        DIR,

        `${instanceId}.json`

    );

}

//==============================================================
// GET SCHEDULER
//==============================================================

function getScheduler(instanceId) {

    if (!instanceId)
        return null;

    if (schedulerMap.has(instanceId)) {

        return schedulerMap.get(instanceId);

    }

    const scheduler =
        cargarDesdeDisco(instanceId) ||
        getDefaultScheduler();

    scheduler.instanceId = instanceId;

    schedulerMap.set(
        instanceId,
        scheduler
    );

    return scheduler;

}

//==============================================================
// GUARDAR
//==============================================================

function guardarScheduler(instanceId) {

    const scheduler =
        schedulerMap.get(instanceId);

    if (!scheduler)
        return;

    guardarEnDisco(
        instanceId,
        scheduler
    );

}

//==============================================================
// ACTUALIZAR
//==============================================================

function actualizarScheduler(
    instanceId,
    cambios
) {

    const scheduler =
        getScheduler(instanceId);

    if (!scheduler)
        return null;

    Object.assign(
        scheduler,
        cambios
    );

    guardarScheduler(instanceId);

    return scheduler;

}

//==============================================================
// REINICIAR
//==============================================================

function reiniciarScheduler(instanceId) {

    const scheduler =
        getDefaultScheduler();

    scheduler.instanceId = instanceId;

    schedulerMap.set(
        instanceId,
        scheduler
    );

    guardarScheduler(instanceId);

    return scheduler;

}

//==============================================================
// ELIMINAR
//==============================================================

function eliminarScheduler(instanceId) {

    schedulerMap.delete(instanceId);

    try {

        const file = getFile(instanceId);

        if (fs.existsSync(file)) {

            fs.unlinkSync(file);

        }

    } catch (err) {

        console.error(
            '❌ Error eliminando scheduler:',
            err.message
        );

    }

}

//==============================================================
// REINICIAR
//==============================================================

function reiniciarScheduler(instanceId) {

    const scheduler = getDefaultScheduler();

    scheduler.instanceId = instanceId;

    schedulerMap.set(
        instanceId,
        scheduler
    );

    guardarScheduler(instanceId);

    return scheduler;

}

//==============================================================
// ELIMINAR
//==============================================================

function eliminarScheduler(instanceId) {

    schedulerMap.delete(instanceId);

    try {

        const file = getFile(instanceId);

        if (fs.existsSync(file)) {

            fs.unlinkSync(file);

        }

    }

    catch (err) {

        console.error(
            '❌ Error eliminando scheduler:',
            err.message
        );

    }

}

//==============================================================
// CHECKPOINT
//==============================================================

setInterval(() => {

    for (const [instanceId, scheduler] of schedulerMap) {

        if (

            scheduler.status === STATUS.RUNNING ||
            scheduler.status === STATUS.WAITING_TIME

        ) {

            guardarEnDisco(
                instanceId,
                scheduler
            );

        }

    }

}, 30000);

//==============================================================
// LISTAR
//==============================================================

function getAllSchedulers() {

    return schedulerMap;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    STATUS,

    getDefaultScheduler,

    getScheduler,

    actualizarScheduler,

    guardarScheduler,

    reiniciarScheduler,

    eliminarScheduler,

    getAllSchedulers

};