'use strict';

//==============================================================
// MdI MultiWA
// routes/api-envio.js
// v4.0
//
// La ruta solamente:
//
// • inicia campañas
// • las detiene
// • consulta estado
//
// Toda la lógica de envío quedó en:
//
// services/campaign-runner.js
// services/campaign-scheduler.js
//==============================================================

const express = require('express');

const router = express.Router();

//==============================================================
// DEPENDENCIAS
//==============================================================

const sessionManager =
    require('../services/session-manager');

const scheduler =
    require('../services/campaign-scheduler');

const {

    getEstadoInstancia,

    guardarEstadoSeguro

} = require('../state/estado');

const {

    getScheduler

} = require('../state/scheduler-state');

const {

    guardarMensajes

} = require('../state/estado');

const antiBan =
    require('../config/anti-baneo');

const {

    esBaja

} = require('../services/bajas');

//==============================================================
// POST /ENVIAR
//==============================================================

router.post(

    '/enviar',

    async (req, res) => {

        try {

            //--------------------------------------------------
            // DATOS
            //--------------------------------------------------

            const {

                instanceId

            } = req.body;

            if (!instanceId) {

                return res.status(400).json({

                    ok: false,

                    error: 'InstanceId inexistente'

                });

            }

            //--------------------------------------------------
            // CLIENTE
            //--------------------------------------------------

            const client =

                sessionManager.getClient(

                    instanceId

                );

            if (!client) {

                return res.status(400).json({

                    ok: false,

                    error: 'WhatsApp desconectado'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if (!estado) {

                return res.status(400).json({

                    ok: false,

                    error: 'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // MENSAJES
            //--------------------------------------------------

            const mensajes =

                (estado.mensajesGuardados || [])

                    .filter(Boolean);

            if (

                mensajes.length === 0

            ) {

                return res.status(400).json({

                    ok: false,

                    error: 'No hay mensajes cargados'

                });

            }

            //--------------------------------------------------
            // CONTACTOS
            //--------------------------------------------------

            const contactos =

                estado.contactosCargados || [];

            if (

                contactos.length === 0

            ) {

                return res.status(400).json({

                    ok: false,

                    error: 'No hay contactos'

                });

            }

            //--------------------------------------------------
            // FILTRAR BAJAS
            //--------------------------------------------------

            estado.contactosCargados =

                contactos.filter(

                    c => !esBaja(

                        c.numero

                    )

                );

            estado.total =

                estado.contactosCargados.length;

            estado.actual = 0;

            estado.enviadosOk = 0;

            estado.fallidos = [];

            estado.enviando = true;

            estado.pausado = false;

            estado.campanaFinalizada = false;

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // INICIAR SCHEDULER
            //--------------------------------------------------

            await scheduler.iniciar(

                instanceId

            );

            //--------------------------------------------------
            // RESPUESTA
            //--------------------------------------------------

            return res.json({

                ok: true,

                total: estado.total,

                mensajes: mensajes.length,

                antiban: {

                    horario:

                        `${antiBan.CONFIG.HORA_INICIO}:00 - ${antiBan.CONFIG.HORA_FIN}:00`,

                    limiteHora:

                        antiBan.CONFIG.MAX_MENSAJES_HORA,

                    limiteDia:

                        antiBan.CONFIG.MAX_MENSAJES_DIA

                }

            });

        }

        catch (err) {

            console.error(

                err

            );

            return res.status(500).json({

                ok: false,

                error: err.message

            });

        }

    }

);

//==============================================================
// POST /DETENER
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

                    ok: false,

                    error: 'InstanceId inexistente'

                });

            }

            scheduler.detener(

                instanceId

            );

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            if (estado) {

                estado.enviando = false;

                estado.pausado = true;

                guardarEstadoSeguro(

                    instanceId

                );

            }

            console.log(

                `⏹ Campaña detenida: ${instanceId}`

            );

            return res.json({

                ok: true

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
// GET /ESTADO
//==============================================================

router.get(

    '/estado/:instanceId',

    (req, res) => {

        try {

            const

                instanceId =

                req.params.instanceId;

            const estado =

                getEstadoInstancia(

                    instanceId

                );

            const sched =

                getScheduler(

                    instanceId

                );

            if (!estado) {

                return res.json({

                    ok:false

                });

            }

            return res.json({

                ok:true,

                enviando:

                    estado.enviando,

                pausado:

                    estado.pausado,

                actual:

                    estado.actual,

                total:

                    estado.total,

                enviados:

                    estado.enviadosOk,

                fallidos:

                    estado.fallidos.length,

                scheduler:{

                    running:

                        sched.running,

                    nextRun:

                        sched.nextRun,

                    stopRequested:

                        sched.stopRequested

                }

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
// GET /MONITOR
//==============================================================

router.get(

    '/monitor/:instanceId',

    (req,res)=>{

        try{

            const

                instanceId=

                req.params.instanceId;

            const estado=

                getEstadoInstancia(

                    instanceId

                );

            const sched=

                getScheduler(

                    instanceId

                );

            if(!estado){

                return res.json({

                    ok:false

                });

            }

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

                        estado.total-

                        estado.actual,

                    porcentaje:

                        estado.total===0

                        ?0

                        :Math.round(

                            estado.actual*100/

                            estado.total

                        )

                },

                scheduler:sched,

                antiban:{

                    mensajesHoy:

                        antiBan.getMensajesHoy(

                            instanceId

                        ),

                    mensajesHora:

                        antiBan.getMensajesEstaHora(

                            instanceId

                        ),

                    motivo:

                        antiBan.obtenerMotivoPausa(

                            instanceId

                        ),

                    tiempoRestante:

                        antiBan.obtenerTiempoRestante(

                            instanceId

                        )

                }

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
// POST /GUARDAR-MENSAJES
//==============================================================

router.post(

    '/guardar-mensajes',

    (req, res) => {

        try {

            const {

                instanceId,

                mensajes

            } = req.body;

            if (

                !instanceId

            ) {

                return res.status(400).json({

                    ok: false,

                    error:

                        'InstanceId inexistente'

                });

            }

            if (

                !Array.isArray(

                    mensajes

                )

            ) {

                return res.status(400).json({

                    ok: false,

                    error:

                        'Mensajes inválidos'

                });

            }

            guardarMensajes(

                instanceId,

                mensajes

            );

            return res.json({

                ok: true

            });

        }

        catch (err) {

            console.error(

                err

            );

            return res.status(500).json({

                ok: false,

                error:

                    err.message

            });

        }

    }

);


//==============================================================
// GET /SCHEDULER
//==============================================================

router.get(

    '/scheduler/:instanceId',

    (req, res) => {

        try {

            const schedulerState =

                getScheduler(

                    req.params.instanceId

                );

            return res.json({

                ok: true,

                scheduler:

                    schedulerState

            });

        }

        catch (err) {

            console.error(err);

            return res.status(500).json({

                ok: false,

                error:

                    err.message

            });

        }

    }

);


//==============================================================
// EXPORTS
//==============================================================

module.exports =

    router;