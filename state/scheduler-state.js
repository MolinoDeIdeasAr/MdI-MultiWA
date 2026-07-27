/**
 * =============================================================
 * MdI MultiWA
 * state/scheduler-state.js
 *
 * Scheduler State Manager
 *
 * v2.0.0
 * =============================================================
 *
 * Fuente única del estado del Scheduler.
 *
 * NO envía mensajes.
 * NO aplica reglas anti-baneo.
 *
 * Solamente administra el estado de ejecución.
 *
 * =============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEDULER_DIR = path.join(DATA_DIR, 'scheduler');

if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(SCHEDULER_DIR))
    fs.mkdirSync(SCHEDULER_DIR, { recursive: true });


//==============================================================
// ESTADOS POSIBLES
//==============================================================

const STATUS = {

    IDLE: 'IDLE',

    RUNNING: 'RUNNING',

    PAUSED: 'PAUSED',

    WAITING_TIME: 'WAITING_TIME',

    WAITING_HOUR: 'WAITING_HOUR',

    WAITING_DAY: 'WAITING_DAY',

    STOPPED: 'STOPPED',

    FINISHED: 'FINISHED',

    ERROR: 'ERROR'

};


//==============================================================
// MAP EN MEMORIA
//==============================================================

const schedulerMap = new Map();


//==============================================================
// ESTADO DEFAULT
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

//==============================================================
// CARGAR DESDE DISCO
//==============================================================

function cargarDesdeDisco(instanceId) {

    try {

        const file = path.join(

            SCHEDULER_DIR,

            `${instanceId}.json`

        );

        if (!fs.existsSync(file))
            return null;

        return JSON.parse(

            fs.readFileSync(file, 'utf8')

        );

    } catch (err) {

        console.error(

            `❌ Error cargando scheduler ${instanceId}:`,

            err.message

        );

        return null;

    }

}


//==============================================================
// GUARDAR EN DISCO
//==============================================================

function guardarEnDisco(

    instanceId,

    scheduler

) {

    try {

        const file = path.join(

            SCHEDULER_DIR,

            `${instanceId}.json`

        );

        fs.writeFileSync(

            file,

            JSON.stringify(

                scheduler,

                null,

                2

            ),

            'utf8'

        );

    } catch (err) {

        console.error(

            `❌ Error guardando scheduler ${instanceId}:`,

            err.message

        );

    }

}


//==============================================================
// GET SCHEDULER
//==============================================================

function getScheduler(instanceId) {

    if (!instanceId)
        return null;

    if (

        schedulerMap.has(instanceId)

    ) {

        return schedulerMap.get(instanceId);

    }

    const delDisco =

        cargarDesdeDisco(instanceId);

    const scheduler =

        delDisco ||

        getDefaultScheduler();

    scheduler.instanceId = instanceId;

    schedulerMap.set(

        instanceId,

        scheduler

    );

    return scheduler;

}

//==============================================================
// ACTUALIZAR SCHEDULER
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

    return scheduler;

}


//==============================================================
// GUARDAR SCHEDULER
//==============================================================

function guardarScheduler(

    instanceId

) {

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
// REINICIAR SCHEDULER
//==============================================================

function reiniciarScheduler(

    instanceId

) {

    const scheduler =

        getDefaultScheduler();

    scheduler.instanceId =

        instanceId;

    schedulerMap.set(

        instanceId,

        scheduler

    );

    guardarEnDisco(

        instanceId,

        scheduler

    );

    return scheduler;

}


//==============================================================
// ELIMINAR SCHEDULER
//==============================================================

function eliminarScheduler(

    instanceId

) {

    schedulerMap.delete(

        instanceId

    );

    try {

        const file = path.join(

            SCHEDULER_DIR,

            `${instanceId}.json`

        );

        if (

            fs.existsSync(file)

        ) {

            fs.unlinkSync(file);

        }

    } catch (err) {

        console.error(

            `❌ Error eliminando scheduler ${instanceId}:`,

            err.message

        );

    }

}

//==============================================================
// CHECKPOINT AUTOMÁTICO
//==============================================================

setInterval(() => {

    for (

        const [instanceId, scheduler]

        of schedulerMap

    ) {

        if (

            scheduler.status === STATUS.RUNNING ||

            scheduler.status === STATUS.WAITING_TIME ||

            scheduler.status === STATUS.WAITING_HOUR ||

            scheduler.status === STATUS.WAITING_DAY ||

            scheduler.status === STATUS.PAUSED

        ) {

            guardarEnDisco(

                instanceId,

                scheduler

            );

        }

    }

},30000);


//==============================================================
// LISTAR TODOS
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