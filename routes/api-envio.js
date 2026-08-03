'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * routes/api-envio.js
 *
 * Versión : v5.0.0
 *
 * API de inicio de campañas.
 *
 * Esta ruta:
 *
 * ✔ valida la instancia
 * ✔ prepara el estado
 * ✔ inicia el scheduler
 * ✔ responde al frontend
 *
 * NO envía mensajes.
 * =============================================================
 */

//==============================================================
// DEPENDENCIAS
//==============================================================

const express =

    require('express');

const router =

    express.Router();

const sessionManager =

    require('../services/session-manager');

const scheduler =

    require('../services/campaign-scheduler');

const {

    getEstadoInstancia,

    guardarEstadoSeguro

} = require(

    '../state/estado'

);

const {

    reiniciarScheduler,

    getScheduler

} = require(

    '../state/scheduler-state'

);

//==============================================================
// POST /api/enviar
//==============================================================

router.post(

    '/enviar',

    async (

        req,

        res

    ) => {

        try{

            //--------------------------------------------------
            // INSTANCE ID
            //--------------------------------------------------

            const instanceId =

                req.body.instanceId;

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'InstanceId inexistente'

                });

            }

            //--------------------------------------------------
            // CLIENTE
            //--------------------------------------------------

            const client =

                sessionManager.getClient(

                    instanceId

                );

            if(

                !client

            ){

                return res.status(400).json({

                    ok:false,

                    error:'Cliente no conectado'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(

                !estado

            ){

                return res.status(400).json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // VALIDAR CONTACTOS
            //--------------------------------------------------

            if(

                !estado.contactosCargados ||

                estado.contactosCargados.length===0

            ){

                return res.status(400).json({

                    ok:false,

                    error:'No hay contactos cargados'

                });

            }

            //--------------------------------------------------
            // VALIDAR MENSAJES
            //--------------------------------------------------

            const mensajes =

                (estado.mensajesGuardados || [])

                .filter(Boolean);

            if(

                mensajes.length===0

            ){

                return res.status(400).json({

                    ok:false,

                    error:'No hay mensajes cargados'

                });

            }

            //--------------------------------------------------
            // REINICIAR CAMPAÑA
            //--------------------------------------------------

            estado.actual = 0;

            estado.total =

                estado.contactosCargados.length;

            estado.enviadosOk = 0;

            estado.fallidos = [];

            estado.enviando = true;

            estado.pausado = false;

            estado.campanaFinalizada = false;

            //--------------------------------------------------
            // GUARDAR ESTADO
            //--------------------------------------------------

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // REINICIAR SCHEDULER
            //--------------------------------------------------

            reiniciarScheduler(

                instanceId

            );

            const sch =

                getScheduler(

                    instanceId

                );

            console.log('');

            console.log(

                '=============================='

            );

            console.log(

                '[ENVIAR]'

            );

            console.log(

                'instanceId:',

                instanceId

            );

            console.log(

                'cliente:',

                !!client

            );

            console.log(

                'estado:',

                !!estado

            );

            console.log(

                'mensajes:',

                mensajes.length

            );

            console.log(

                'contactos:',

                estado.total

            );

            console.log(

                'scheduler:',

                sch.status

            );

            console.log(

                '=============================='

            );

            //--------------------------------------------------
            // INICIAR SCHEDULER
            //--------------------------------------------------

            const iniciado =

                await scheduler.iniciar(

                    instanceId

                );

            if(

                !iniciado

            ){

                return res.status(409).json({

                    ok:false,

                    error:'La campaña ya está en ejecución'

                });

            }

            //--------------------------------------------------
            // RESPUESTA
            //--------------------------------------------------

            return res.json({

                ok:true,

                mensaje:'Campaña iniciada correctamente.',

                instanceId,

                monitor:

                        `/monitor?instanceId=${instanceId}`

            });

        }

        //------------------------------------------------------
        // ERROR GENERAL
        //------------------------------------------------------

        catch(err){

            console.error('');

            console.error(

                '====================================='

            );

            console.error(

                '❌ ERROR API ENVÍO'

            );

            console.error(

                '====================================='

            );

            console.error(err);

            console.error('');

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST /api/pausar
//==============================================================

router.post(

    '/pausar',

    async(

        req,

        res

    )=>{

        try{

            const {

                instanceId

            } = req.body;

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'InstanceId inexistente'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(

                !estado

            ){

                return res.status(404).json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // PAUSAR CAMPAÑA
            //--------------------------------------------------

            estado.enviando = false;

            estado.pausado = true;

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // DETENER SCHEDULER
            //--------------------------------------------------

            scheduler.detener(

                instanceId

            );

            console.log(

                `⏸ Campaña pausada (${instanceId})`

            );

            return res.json({

                ok:true,

                mensaje:'Campaña pausada correctamente.'

            });

        }

        catch(err){

            console.error(

                '❌ Error pausando campaña'

            );

            console.error(err);

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST /api/pausar
//==============================================================

router.post(

    '/pausar',

    async(

        req,

        res

    )=>{

        try{

            const {

                instanceId

            } = req.body;

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'InstanceId inexistente'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(

                !estado

            ){

                return res.status(404).json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // PAUSAR CAMPAÑA
            //--------------------------------------------------

            estado.enviando = false;

            estado.pausado = true;

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // DETENER SCHEDULER
            //--------------------------------------------------

            scheduler.detener(

                instanceId

            );

            console.log(

                `⏸ Campaña pausada (${instanceId})`

            );

            return res.json({

                ok:true,

                mensaje:'Campaña pausada correctamente.'

            });

        }

        catch(err){

            console.error(

                '❌ Error pausando campaña'

            );

            console.error(err);

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST /api/continuar
//==============================================================

router.post(

    '/continuar',

    async(

        req,

        res

    )=>{

        try{

            const {

                instanceId

            } = req.body;

            //--------------------------------------------------
            // VALIDAR
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'InstanceId inexistente'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(

                !estado

            ){

                return res.status(404).json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // YA FINALIZÓ
            //--------------------------------------------------

            if(

                estado.campanaFinalizada

            ){

                return res.status(400).json({

                    ok:false,

                    error:'La campaña ya finalizó'

                });

            }

            //--------------------------------------------------
            // REANUDAR
            //--------------------------------------------------

            estado.enviando = true;

            estado.pausado = false;

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // REINICIAR SCHEDULER
            //--------------------------------------------------

            reiniciarScheduler(

                instanceId

            );

            const iniciado =

                await scheduler.iniciar(

                    instanceId

                );

            if(

                !iniciado

            ){

                return res.status(409).json({

                    ok:false,

                    error:'No fue posible reiniciar el scheduler'

                });

            }

            console.log(

                `▶ Campaña reanudada (${instanceId})`

            );

            return res.json({

                ok:true,

                mensaje:'Campaña reanudada correctamente.'

            });

        }

        catch(err){

            console.error(

                '❌ Error reanudando campaña'

            );

            console.error(err);

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST /api/detener
//==============================================================

router.post(

    '/detener',

    async(

        req,

        res

    )=>{

        try{

            const {

                instanceId

            } = req.body;

            //--------------------------------------------------
            // VALIDAR
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'InstanceId inexistente'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(

                !estado

            ){

                return res.status(404).json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // DETENER CAMPAÑA
            //--------------------------------------------------

            estado.enviando = false;

            estado.pausado = false;

            estado.campanaFinalizada = true;

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // DETENER SCHEDULER
            //--------------------------------------------------

            scheduler.detener(

                instanceId

            );

            console.log(

                `🛑 Campaña detenida (${instanceId})`

            );

            return res.json({

                ok:true,

                mensaje:'Campaña detenida correctamente.'

            });

        }

        catch(err){

            console.error(

                '❌ Error deteniendo campaña'

            );

            console.error(err);

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// GET ESTADO
//==============================================================

router.get(

    '/estado/:instanceId',

    (

        req,

        res

    )=>{

        try{

            const instanceId =

                req.params.instanceId;

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            const schedulerState =

                getScheduler(

                    instanceId

                );

            return res.json({

                ok:true,

                estado,

                scheduler:schedulerState

            });

        }

        catch(err){

            console.error(

                '❌ Error obteniendo estado'

            );

            console.error(err);

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// EXPORTS
//==============================================================

module.exports = router;