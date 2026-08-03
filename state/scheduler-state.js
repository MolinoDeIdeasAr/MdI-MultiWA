'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * state/scheduler-state.js
 *
 * Versión : v4.0.0
 *
 * Fuente única del Scheduler.
 *
 * Mantiene exclusivamente el estado del scheduler.
 *
 * =============================================================
 */

const fs   = require('fs');
const path = require('path');

//==============================================================
// DIRECTORIOS
//==============================================================

const DATA_DIR =

    path.join(

        __dirname,

        '..',

        'data'

    );

const DIR =

    path.join(

        DATA_DIR,

        'scheduler'

    );

if(

    !fs.existsSync(DATA_DIR)

){

    fs.mkdirSync(

        DATA_DIR,

        {

            recursive:true

        }

    );

}

if(

    !fs.existsSync(DIR)

){

    fs.mkdirSync(

        DIR,

        {

            recursive:true

        }

    );

}

//==============================================================
// ESTADOS
//==============================================================

const STATUS={

    IDLE:'IDLE',

    RUNNING:'RUNNING',

    WAITING_TIME:'WAITING_TIME',

    STOPPED:'STOPPED',

    FINISHED:'FINISHED',

    ERROR:'ERROR'

};

//==============================================================
// MEMORIA
//==============================================================

const schedulerMap =

    new Map();

//==============================================================
// DEFAULT
//==============================================================

function getDefaultScheduler(){

    return{

        instanceId:null,

        status:STATUS.IDLE,

        iniciado:null,

        finalizado:null,

        motivo:'',

        pausaHasta:null,

        proximoEnvio:null

    };

}

//==============================================================
// ARCHIVO
//==============================================================

function getFile(

    instanceId

){

    return path.join(

        DIR,

        `${instanceId}.json`

    );

}

//==============================================================
// CARGAR DESDE DISCO
//==============================================================

function cargarDesdeDisco(

    instanceId

){

    try{

        const file =

            getFile(

                instanceId

            );

        if(

            !fs.existsSync(file)

        ){

            return null;

        }

        return JSON.parse(

            fs.readFileSync(

                file,

                'utf8'

            )

        );

    }

    catch(err){

        console.error(

            `❌ Error cargando Scheduler (${instanceId})`

        );

        console.error(

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

){

    try{

        fs.writeFileSync(

            getFile(

                instanceId

            ),

            JSON.stringify(

                scheduler,

                null,

                2

            ),

            'utf8'

        );

    }

    catch(err){

        console.error(

            `❌ Error guardando Scheduler (${instanceId})`

        );

        console.error(

            err.message

        );

    }

}

//==============================================================
// GET SCHEDULER
//==============================================================

function getScheduler(

    instanceId

){

    if(

        !instanceId

    ){

        return null;

    }

    //----------------------------------------------------------
    // YA EXISTE EN MEMORIA
    //----------------------------------------------------------

    if(

        schedulerMap.has(

            instanceId

        )

    ){

        return schedulerMap.get(

            instanceId

        );

    }

    //----------------------------------------------------------
    // CARGAR DESDE DISCO
    //----------------------------------------------------------

    const scheduler =

        cargarDesdeDisco(

            instanceId

        ) ||

        getDefaultScheduler();

    scheduler.instanceId =

        instanceId;

    schedulerMap.set(

        instanceId,

        scheduler

    );

    return scheduler;

}

//==============================================================
// GUARDAR SCHEDULER
//==============================================================

function guardarScheduler(

    instanceId

){

    const scheduler =

        schedulerMap.get(

            instanceId

        );

    if(

        !scheduler

    ){

        return;

    }

    guardarEnDisco(

        instanceId,

        scheduler

    );

}

//==============================================================
// ACTUALIZAR SCHEDULER
//==============================================================

function actualizarScheduler(

    instanceId,

    cambios

){

    const scheduler =

        getScheduler(

            instanceId

        );

    if(

        !scheduler

    ){

        return null;

    }

    //----------------------------------------------------------
    // ACTUALIZAR EN MEMORIA
    //----------------------------------------------------------

    Object.assign(

        scheduler,

        cambios

    );

    //----------------------------------------------------------
    // PERSISTIR
    //----------------------------------------------------------

    guardarScheduler(

        instanceId

    );

    return scheduler;

}

//==============================================================
// REINICIAR SCHEDULER
//==============================================================

function reiniciarScheduler(

    instanceId

){

    const scheduler =

        getDefaultScheduler();

    scheduler.instanceId =

        instanceId;

    schedulerMap.set(

        instanceId,

        scheduler

    );

    guardarScheduler(

        instanceId

    );

    return scheduler;

}

//==============================================================
// ELIMINAR SCHEDULER
//==============================================================

function eliminarScheduler(

    instanceId

){

    schedulerMap.delete(

        instanceId

    );

    try{

        const file =

            getFile(

                instanceId

            );

        if(

            fs.existsSync(

                file

            )

        ){

            fs.unlinkSync(

                file

            );

        }

    }

    catch(err){

        console.error(

            `❌ Error eliminando Scheduler (${instanceId})`

        );

        console.error(

            err.message

        );

    }

}

//==============================================================
// CHECKPOINT AUTOMÁTICO
//==============================================================

setInterval(()=>{

    for(

        const [

            instanceId,

            scheduler

        ] of schedulerMap

    ){

        if(

            scheduler.status===STATUS.RUNNING ||

            scheduler.status===STATUS.WAITING_TIME

        ){

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

function getAllSchedulers(){

    return schedulerMap;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports={

    //----------------------------------------------------------
    // ESTADOS
    //----------------------------------------------------------

    STATUS,

    //----------------------------------------------------------
    // DEFAULT
    //----------------------------------------------------------

    getDefaultScheduler,

    //----------------------------------------------------------
    // ACCESO
    //----------------------------------------------------------

    getScheduler,

    getAllSchedulers,

    //----------------------------------------------------------
    // MODIFICACIÓN
    //----------------------------------------------------------

    actualizarScheduler,

    guardarScheduler,

    reiniciarScheduler,

    eliminarScheduler

};