'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-scheduler.js
 *
 * Versión : v7.0.0
 *
 * Scheduler completamente reescrito.
 *
 * RESPONSABILIDADES
 * -----------------
 * • Ejecutar campaign-runner.
 * • Programar la siguiente ejecución.
 * • Mantener el estado del scheduler.
 * • No envía mensajes.
 * • No modifica campañas.
 * =============================================================
 */

//==============================================================
// DEPENDENCIAS
//==============================================================

const runner =
    require('./campaign-runner');

const {

    STATUS,

    getScheduler,

    actualizarScheduler

} = require(

    '../state/scheduler-state'

);

//==============================================================
// VARIABLES
//==============================================================

let io = null;

const timers = new Map();

//==============================================================
// INIT
//==============================================================

function init(socketIO){

    io = socketIO;

    console.log(

        '🗓 Campaign Scheduler inicializado'

    );

}

function getIO(){

    return io;

}

//==============================================================
// INICIAR
//==============================================================

async function iniciar(

    instanceId

){

    const scheduler =

        getScheduler(

            instanceId

        );

    //----------------------------------------------------------
    // YA CORRIENDO
    //----------------------------------------------------------

    if(

        scheduler.status===STATUS.RUNNING

    ){

        console.log(

            `⚠ Scheduler ya iniciado (${instanceId})`

        );

        return false;

    }

    //----------------------------------------------------------
    // LIMPIAR TIMER ANTERIOR
    //----------------------------------------------------------

    if(

        timers.has(instanceId)

    ){

        clearTimeout(

            timers.get(instanceId)

        );

        timers.delete(instanceId);

    }

    //----------------------------------------------------------
    // ESTADO
    //----------------------------------------------------------

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.RUNNING,

            iniciado:Date.now(),

            finalizado:null,

            motivo:'',

            pausaHasta:null,

            proximoEnvio:Date.now()

        }

    );

    //----------------------------------------------------------
    // COMENZAR
    //----------------------------------------------------------

    ejecutar(

        instanceId

    );

    return true;

}

//==============================================================
// PROGRAMAR
//==============================================================

function programar(

    instanceId,

    demora

){

    //----------------------------------------------------------
    // CANCELAR TIMER ANTERIOR
    //----------------------------------------------------------

    if(

        timers.has(instanceId)

    ){

        clearTimeout(

            timers.get(instanceId)

        );

    }

    //----------------------------------------------------------
    // NUEVO TIMER
    //----------------------------------------------------------

    const timer =

        setTimeout(

            ()=>{

                ejecutar(

                    instanceId

                );

            },

            demora

        );

    timers.set(

        instanceId,

        timer

    );

}

//==============================================================
// EJECUTAR
//==============================================================

async function ejecutar(

    instanceId

){

    const scheduler =

        getScheduler(

            instanceId

        );

    //----------------------------------------------------------
    // DETENIDO
    //----------------------------------------------------------

    if(

        scheduler.status!==STATUS.RUNNING &&

        scheduler.status!==STATUS.WAITING_TIME

    ){

        timers.delete(

            instanceId

        );

        return;

    }

    //----------------------------------------------------------
    // VOLVER A RUNNING
    //----------------------------------------------------------

    if(

        scheduler.status===STATUS.WAITING_TIME

    ){

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.RUNNING,

                pausaHasta:null

            }

        );

    }

    //----------------------------------------------------------
    // EJECUTAR RUNNER
    //----------------------------------------------------------

    let resultado;

    try{

        resultado =

            await runner.run(

                instanceId

            );

    }

    catch(err){

        console.error(

            `❌ Error Runner (${instanceId})`

        );

        console.error(err);

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.ERROR,

                motivo:err.message,

                finalizado:Date.now(),

                proximoEnvio:null

            }

        );

        timers.delete(

            instanceId

        );

        return;

    }

    //----------------------------------------------------------
    // PROCESAR RESULTADO
    //----------------------------------------------------------

    procesarResultado(

        instanceId,

        resultado

    );

}

//==============================================================
// PROCESAR RESULTADO
//==============================================================

function procesarResultado(

    instanceId,

    resultado

){

    //----------------------------------------------------------
    // ERROR
    //----------------------------------------------------------

    if(

        resultado.tipo===runner.RESULTADO.ERROR

    ){

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.ERROR,

                motivo:resultado.motivo || 'Error desconocido',

                finalizado:Date.now(),

                proximoEnvio:null,

                pausaHasta:null

            }

        );

        timers.delete(instanceId);

        return;

    }

    //----------------------------------------------------------
    // CAMPAÑA FINALIZADA
    //----------------------------------------------------------

    if(

        resultado.tipo===runner.RESULTADO.FINALIZADA

    ){

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.FINISHED,

                finalizado:Date.now(),

                proximoEnvio:null,

                pausaHasta:null,

                motivo:''

            }

        );

        timers.delete(instanceId);

        console.log(

            `✅ Campaña finalizada (${instanceId})`

        );

        return;

    }

    //----------------------------------------------------------
    // PAUSA ANTIBAN
    //----------------------------------------------------------

    if(

        resultado.tipo===runner.RESULTADO.PAUSA

    ){

        const pausa =

            resultado.pausa || 60000;

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.WAITING_TIME,

                motivo:resultado.motivo || '',

                pausaHasta:Date.now()+pausa,

                proximoEnvio:Date.now()+pausa

            }

        );

        programar(

            instanceId,

            pausa

        );

        return;

    }

    //----------------------------------------------------------
    // CONTACTO EN BAJA
    //----------------------------------------------------------

    if(

        resultado.tipo===runner.RESULTADO.BAJA

    ){

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.RUNNING,

                motivo:'',

                proximoEnvio:Date.now()+100

            }

        );

        programar(

            instanceId,

            100

        );

        return;

    }

    //----------------------------------------------------------
    // ENVÍO OK
    //----------------------------------------------------------

    if(

        resultado.tipo===runner.RESULTADO.OK

    ){

        const pausa =

            resultado.pausa || 1000;

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.RUNNING,

                motivo:'',

                proximoEnvio:Date.now()+pausa

            }

        );

        programar(

            instanceId,

            pausa

        );

        return;

    }

    //----------------------------------------------------------
    // RESULTADO DESCONOCIDO
    //----------------------------------------------------------

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.ERROR,

            motivo:'Resultado desconocido',

            finalizado:Date.now(),

            proximoEnvio:null

        }

    );

    timers.delete(instanceId);

}

//==============================================================
// DETENER
//==============================================================

function detener(

    instanceId

){

    //----------------------------------------------------------
    // CANCELAR TIMER
    //----------------------------------------------------------

    if(

        timers.has(instanceId)

    ){

        clearTimeout(

            timers.get(instanceId)

        );

        timers.delete(

            instanceId

        );

    }

    //----------------------------------------------------------
    // ACTUALIZAR ESTADO
    //----------------------------------------------------------

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.STOPPED,

            motivo:'Detenido por el usuario',

            finalizado:Date.now(),

            pausaHasta:null,

            proximoEnvio:null

        }

    );

    console.log(

        `🛑 Scheduler detenido (${instanceId})`

    );

}

//==============================================================
// REINICIAR
//==============================================================

function reiniciar(

    instanceId

){

    //----------------------------------------------------------
    // LIMPIAR TIMER
    //----------------------------------------------------------

    if(

        timers.has(instanceId)

    ){

        clearTimeout(

            timers.get(instanceId)

        );

        timers.delete(

            instanceId

        );

    }

    //----------------------------------------------------------
    // RESETEAR SCHEDULER
    //----------------------------------------------------------

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.IDLE,

            iniciado:null,

            finalizado:null,

            motivo:'',

            pausaHasta:null,

            proximoEnvio:null

        }

    );

    console.log(

        `♻ Scheduler reiniciado (${instanceId})`

    );

}

//==============================================================
// RESTAURAR CAMPAÑAS
//==============================================================

function restaurarCampañas(){

    console.log('');

    console.log(

        '========================================'

    );

    console.log(

        '🔄 Restaurando Scheduler'

    );

    console.log(

        '========================================'

    );

    //----------------------------------------------------------
    // NUEVA FILOSOFÍA
    //----------------------------------------------------------
    // Las campañas NO continúan automáticamente cuando
    // reinicia el servidor.
    //
    // Sólo se restauran las sesiones de WhatsApp.
    // El usuario debe iniciar nuevamente la campaña.
    //----------------------------------------------------------

    console.log(

        'ℹ No se restauran campañas activas.'

    );

    console.log(

        'ℹ Esperando nueva orden de inicio.'

    );

    console.log('');

}

//==============================================================
// SHUTDOWN
//==============================================================

async function shutdown(){

    console.log('');

    console.log(

        '========================================'

    );

    console.log(

        '🛑 Cerrando Campaign Scheduler'

    );

    console.log(

        '========================================'

    );

    //----------------------------------------------------------
    // CANCELAR TODOS LOS TIMERS
    //----------------------------------------------------------

    for(

        const [

            instanceId,

            timer

        ] of timers

    ){

        clearTimeout(

            timer

        );

    }

    timers.clear();

    //----------------------------------------------------------
    // SOCKET
    //----------------------------------------------------------

    io = null;

    console.log(

        '✅ Scheduler detenido correctamente'

    );

    console.log('');

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    //----------------------------------------------------------
    // SOCKET
    //----------------------------------------------------------

    init,

    getIO,

    //----------------------------------------------------------
    // CICLO DE VIDA
    //----------------------------------------------------------

    iniciar,

    detener,

    reiniciar,

    //----------------------------------------------------------
    // EJECUCIÓN
    //----------------------------------------------------------

    ejecutar,

    programar,

    procesarResultado,

    //----------------------------------------------------------
    // SISTEMA
    //----------------------------------------------------------

    restaurarCampañas,

    shutdown

};