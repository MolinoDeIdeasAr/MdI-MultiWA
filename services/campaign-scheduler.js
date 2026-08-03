'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-scheduler.js
 *
 * Scheduler central de campañas
 *
 * Versión : v8.0.0
 * =============================================================
 */

const runner =
    require('./campaign-runner');

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

function init(socketIO){

    io = socketIO;

    console.log(

        '🗓️ Campaign Scheduler inicializado'

    );

}

function getIO(){

    return io;

}

//==============================================================
// PROGRAMAR
//==============================================================

function programar(

    instanceId,

    demora

){

    //----------------------------------------------------------
    // Eliminar timer anterior
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
    // Nuevo timer
    //----------------------------------------------------------

    const timer = setTimeout(

        ()=>{

            timers.delete(

                instanceId

            );

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
// INICIAR
//==============================================================

async function iniciar(

    instanceId

){

    //----------------------------------------------------------
    // VALIDAR
    //----------------------------------------------------------

    if(

        !instanceId

    ){

        console.error(

            '❌ iniciar(): instanceId inválido'

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
    // REINICIAR SCHEDULER
    //----------------------------------------------------------

    reiniciarScheduler(

        instanceId

    );

    //----------------------------------------------------------
    // PASAR A RUNNING
    //----------------------------------------------------------

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.RUNNING,

            iniciado:Date.now(),

            finalizado:null,

            pausaHasta:null,

            proximoEnvio:Date.now(),

            motivo:''

        }

    );

    console.log(

        `▶ Scheduler iniciado (${instanceId})`

    );

    //----------------------------------------------------------
    // PRIMERA EJECUCIÓN
    //----------------------------------------------------------

    setImmediate(

        ()=>{

            ejecutar(

                instanceId

            );

        }

    );

    return true;

}

//==============================================================
// EJECUTAR
//==============================================================

async function ejecutar(

    instanceId

){

    //----------------------------------------------------------
    // OBTENER SCHEDULER
    //----------------------------------------------------------

    const scheduler =

        getScheduler(

            instanceId

        );

    if(

        !scheduler

    ){

        console.error(

            `❌ Scheduler inexistente (${instanceId})`

        );

        return;

    }

    //----------------------------------------------------------
    // ¿SIGUE CORRIENDO?
    //----------------------------------------------------------

    if(

        scheduler.status !== STATUS.RUNNING

    ){

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

        return;

    }

    //----------------------------------------------------------
    // EJECUTAR RUNNER
    //----------------------------------------------------------

    console.log(

        `🚀 Runner (${instanceId})`

    );

    let resultado = null;

    try{

        resultado =

            await runner.run(

                instanceId

            );

    }

    catch(err){

        console.error(

            `❌ Excepción Runner (${instanceId})`

        );

        console.error(err);

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.ERROR,

                motivo:err.message,

                finalizado:Date.now(),

                proximoEnvio:null,

                pausaHasta:null

            }

        );

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

        return;

    }

    //----------------------------------------------------------
    // RESULTADO INVÁLIDO
    //----------------------------------------------------------

    if(

        !resultado ||

        !resultado.tipo

    ){

        console.error(

            `❌ Runner devolvió resultado inválido (${instanceId})`

        );

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.ERROR,

                motivo:'Resultado inválido del Runner',

                finalizado:Date.now(),

                proximoEnvio:null,

                pausaHasta:null

            }

        );

        return;

    }

        //----------------------------------------------------------
    // ERROR
    //----------------------------------------------------------

    if(

        resultado.tipo === runner.RESULTADO.ERROR

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

        return;

    }

    //----------------------------------------------------------
    // PAUSA ANTIBAN
    //----------------------------------------------------------

    if(

        resultado.tipo === runner.RESULTADO.PAUSA

    ){

        const pausa =

            resultado.pausa || 60000;

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.WAITING_TIME,

                pausaHasta:Date.now() + pausa,

                proximoEnvio:Date.now() + pausa,

                motivo:resultado.motivo || ''

            }

        );

        programar(

            instanceId,

            pausa

        );

        return;

    }

    //----------------------------------------------------------
    // CONTACTO DADO DE BAJA
    //----------------------------------------------------------

    if(

        resultado.tipo === runner.RESULTADO.BAJA

    ){

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.RUNNING,

                pausaHasta:null,

                proximoEnvio:Date.now() + 100,

                motivo:''

            }

        );

        programar(

            instanceId,

            100

        );

        return;

    }

    //----------------------------------------------------------
    // MENSAJE ENVIADO OK
    //----------------------------------------------------------

    if(

        resultado.tipo === runner.RESULTADO.OK

    ){

        const pausa =

            resultado.pausa || 1000;

        guardarEstadoSeguro(

            instanceId

        );

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.RUNNING,

                pausaHasta:null,

                proximoEnvio:Date.now() + pausa,

                motivo:''

            }

        );

        programar(

            instanceId,

            pausa

        );

        return;

    }

        //----------------------------------------------------------
    // CAMPAÑA FINALIZADA
    //----------------------------------------------------------

    if(

        resultado.tipo === runner.RESULTADO.FINALIZADA

    ){

        guardarEstadoSeguro(

            instanceId

        );

        actualizarScheduler(

            instanceId,

            {

                status:STATUS.FINISHED,

                finalizado:Date.now(),

                pausaHasta:null,

                proximoEnvio:null,

                motivo:''

            }

        );

        if(

            timers.has(

                instanceId

            )

        ){

            clearTimeout(

                timers.get(

                    instanceId

                )

            );

            timers.delete(

                instanceId

            );

        }

        console.log(

            `✅ Campaña finalizada (${instanceId})`

        );

        return;

    }

    //----------------------------------------------------------
    // RESULTADO DESCONOCIDO
    //----------------------------------------------------------

    console.warn(

        `⚠ Resultado desconocido (${instanceId})`

    );

    console.warn(

        resultado

    );

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.ERROR,

            motivo:'Resultado desconocido',

            finalizado:Date.now(),

            pausaHasta:null,

            proximoEnvio:null

        }

    );

    if(

        timers.has(

            instanceId

        )

    ){

        clearTimeout(

            timers.get(

                instanceId

            )

        );

        timers.delete(

            instanceId

        );

    }

}

//==============================================================
// DETENER
//==============================================================

function detener(

    instanceId

){

    if(

        timers.has(

            instanceId

        )

    ){

        clearTimeout(

            timers.get(

                instanceId

            )

        );

        timers.delete(

            instanceId

        );

    }

    actualizarScheduler(

        instanceId,

        {

            status:STATUS.STOPPED,

            finalizado:Date.now(),

            pausaHasta:null,

            proximoEnvio:null,

            motivo:'Detenido por el usuario'

        }

    );

    console.log(

        `🛑 Scheduler detenido (${instanceId})`

    );

}

//==============================================================
// RESTAURAR CAMPAÑAS
//==============================================================

function restaurarCampañas(){

    console.log(

        '🔄 Restaurando campañas...'

    );

    //----------------------------------------------------------
    // Limpiar timers pendientes
    //----------------------------------------------------------

    for(

        const timer of timers.values()

    ){

        clearTimeout(

            timer

        );

    }

    timers.clear();

    //----------------------------------------------------------
    // En v8 NO se restauran campañas automáticamente.
    // Solamente se restauran las sesiones de WhatsApp.
    //----------------------------------------------------------

    console.log(

        '✅ Scheduler limpio'

    );

}

//==============================================================
// SHUTDOWN
//==============================================================

async function shutdown(){

    console.log(

        '🛑 Cerrando Campaign Scheduler...'

    );

    //----------------------------------------------------------
    // Cancelar timers
    //----------------------------------------------------------

    for(

        const timer of timers.values()

    ){

        clearTimeout(

            timer

        );

    }

    timers.clear();

    console.log(

        '✅ Campaign Scheduler detenido'

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