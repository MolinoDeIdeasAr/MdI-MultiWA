'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * routes/api-envio.js
 *
 * Versión : v5.0.0
 *
 * API de envío de campañas
 *
 * Arquitectura:
 *
 *  • estado.js            -> Fuente única del estado
 *  • scheduler-state.js   -> Estado del scheduler
 *  • campaign-scheduler   -> Orquestador
 *  • campaign-runner      -> Ejecuta un contacto por ciclo
 *
 * =============================================================
 */

const express = require('express');
const router = express.Router();

const scheduler =
    require('../services/campaign-scheduler');

const sessionManager =
    require('../services/session-manager');

const {

    getEstadoInstancia,
    actualizarEstado,
    guardarEstadoSeguro

} = require('../state/estado');

const {

    getScheduler,
    STATUS

} = require('../state/scheduler-state');

            //--------------------------------------------------
            // VALIDAR SCHEDULER
            //--------------------------------------------------

            const sch =

                getScheduler(instanceId);

            if (

                sch.status === STATUS.RUNNING ||

                sch.status === STATUS.WAITING_TIME

            ) {

                return res.status(409).json({

                    ok: false,

                    error: 'Ya existe una campaña en ejecución.'

                });

            }

            //--------------------------------------------------
            // VALIDAR CONTACTOS
            //--------------------------------------------------

            if (

                !Array.isArray(

                    estado.contactosCargados

                ) ||

                estado.contactosCargados.length === 0

            ) {

                return res.status(400).json({

                    ok: false,

                    error: 'No hay contactos cargados.'

                });

            }

            //--------------------------------------------------
            // VALIDAR MENSAJES
            //--------------------------------------------------

            const mensajes =

                (estado.mensajesGuardados || [])

                    .filter(Boolean);

            if (

                mensajes.length === 0

            ) {

                return res.status(400).json({

                    ok: false,

                    error: 'No existen mensajes para enviar.'

                });

            }

            //--------------------------------------------------
            // REINICIAR ESTADO
            //--------------------------------------------------

            actualizarEstado(

                instanceId,

                {

                    actual: 0,

                    total:

                        estado.contactosCargados.length,

                    enviadosOk: 0,

                    fallidos: [],

                    enviando: true,

                    pausado: false,

                    campanaFinalizada: false

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // LOG
            //--------------------------------------------------

            console.log('');

            console.log(

                '========================================'

            );

            console.log(

                '🚀 INICIO DE CAMPAÑA'

            );

            console.log(

                'Instance:',

                instanceId

            );

            console.log(

                'Contactos:',

                estado.contactosCargados.length

            );

            console.log(

                'Mensajes:',

                mensajes.length

            );

            console.log(

                '========================================'

            );

            //--------------------------------------------------
            // INICIAR SCHEDULER
            //--------------------------------------------------

            console.log(

                '▶ Iniciando Campaign Scheduler...'

            );

            const iniciado =

                await scheduler.iniciar(

                    instanceId

                );

            if (!iniciado) {

                console.log(

                    '❌ No fue posible iniciar el scheduler.'

                );

                actualizarEstado(

                    instanceId,

                    {

                        enviando: false

                    }

                );

                guardarEstadoSeguro(

                    instanceId

                );

                return res.status(409).json({

                    ok: false,

                    error: 'El scheduler no pudo iniciarse.'

                });

            }

            console.log(

                '✅ Campaign Scheduler iniciado.'

            );

            //--------------------------------------------------
            // RESPUESTA
            //--------------------------------------------------

            return res.json({

                ok: true,

                instanceId,

                mensaje:

                    'Campaña iniciada correctamente.',

                progreso: {

                    actual: 0,

                    total: estado.contactosCargados.length,

                    enviados: 0,

                    pendientes:

                        estado.contactosCargados.length,

                    porcentaje: 0,

                    fallidos: 0,

                    bajas: 0

                }

            });

        }

        catch (err) {

            console.error(

                '❌ Error iniciando campaña'

            );

            console.error(err);

            return res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);

//==============================================================
// GET
// /api/progreso/:instanceId
//==============================================================

router.get(

    '/progreso/:instanceId',

    (req, res) => {

        try {

            const {

                instanceId

            } = req.params;

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if (!estado) {

                return res.status(404).json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // SCHEDULER
            //--------------------------------------------------

            const sch =

                getScheduler(

                    instanceId

                );

            //--------------------------------------------------
            // RESPUESTA
            //--------------------------------------------------

            return res.json({

                ok:true,

                progreso:{

                    actual:

                        estado.actual,

                    total:

                        estado.total,

                    enviados:

                        estado.enviadosOk,

                    pendientes:

                        Math.max(

                            0,

                            estado.total -

                            estado.actual

                        ),

                    porcentaje:

                        estado.total===0

                        ? 0

                        : Math.round(

                            estado.actual *

                            100 /

                            estado.total

                        ),

                    fallidos:

                        estado.fallidos.length,

                    bajas:

                        (estado.contactosCargados||[])

                        .filter(

                            c=>c.estadoEnvio==='baja'

                        )

                        .length

                },

                scheduler:sch,

                enviando:

                    estado.enviando,

                campanaFinalizada:

                    estado.campanaFinalizada,

                contactos:

                    estado.contactosCargados||[],

                fallidos:

                    estado.fallidos||[]

            });

        }

        catch(err){

            console.error(

                err

            );

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST
// /api/detener
//==============================================================

router.post(

    '/detener',

    (req, res) => {

        try {

            const {

                instanceId

            } = req.body;

            if (!instanceId) {

                return res.status(400).json({

                    ok:false,

                    error:'InstanceId inexistente'

                });

            }

            scheduler.detener(

                instanceId

            );

            actualizarEstado(

                instanceId,

                {

                    enviando:false,

                    pausado:false

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            return res.json({

                ok:true

            });

        }

        catch(err){

            console.error(err);

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST
// /api/pausar
//==============================================================

router.post(

    '/pausar',

    (req,res)=>{

        try{

            const {

                instanceId

            } = req.body;

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(!estado){

                return res.status(404).json({

                    ok:false

                });

            }

            actualizarEstado(

                instanceId,

                {

                    pausado:true,

                    enviando:false

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            scheduler.detener(

                instanceId

            );

            return res.json({

                ok:true

            });

        }

        catch(err){

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// POST
// /api/reanudar
//==============================================================

router.post(

    '/reanudar',

    async(req,res)=>{

        try{

            const {

                instanceId

            } = req.body;

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if(!estado){

                return res.status(404).json({

                    ok:false

                });

            }

            actualizarEstado(

                instanceId,

                {

                    pausado:false,

                    enviando:true

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            await scheduler.iniciar(

                instanceId

            );

            return res.json({

                ok:true

            });

        }

        catch(err){

            return res.status(500).json({

                ok:false,

                error:err.message

            });

        }

    }

);

//==============================================================
// HEALTHCHECK
//==============================================================

router.get(

    '/estado/:instanceId',

    (req, res) => {

        try {

            const { instanceId } = req.params;

            const estado =
                getEstadoInstancia(instanceId);

            const schedulerActual =
                getScheduler(instanceId);

            return res.json({

                ok: true,

                estado,

                scheduler: schedulerActual

            });

        }

        catch (err) {

            console.error(err);

            return res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);

//==============================================================
// EXPORTS
//==============================================================

module.exports = router;