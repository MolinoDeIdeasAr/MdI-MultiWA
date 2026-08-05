'use strict';

//==============================================================
// MdI MultiWA
// routes/api-monitor.js
//==============================================================

const express = require('express');

const router = express.Router();

const {

    getEstadoInstancia,
    guardarEstadoSeguro

} = require('../state/estado');

const antiBan =
    require('../config/anti-baneo');

const scheduler =
    require('../services/campaign-scheduler');

//==============================================================
// GET /progreso
//==============================================================

router.get(

    '/progreso',

    (req,res)=>{

        try{

            //--------------------------------------------------
            // INSTANCE
            //--------------------------------------------------

            const instanceId =

                req.query.instanceId ||

                req.session.instanceId;

            if(!instanceId){

                return res.json({

                    ok:false,

                    error:'Sin instanceId'

                });

            }

            //--------------------------------------------------
            // ESTADO
            //--------------------------------------------------

            const estado =

                getEstadoInstancia(instanceId);

            if(!estado){

                return res.json({

                    ok:false,

                    error:'Estado inexistente'

                });

            }

            //--------------------------------------------------
            // PROGRESO
            //--------------------------------------------------

            const total =

                estado.total ||

                estado.contactosCargados?.length ||

                0;

            const actual =

                estado.actual || 0;

            const enviados =

                estado.enviadosOk || 0;

            const pendientes =

                Math.max(

                    total-actual,

                    0

                );

            const fallidos =

                Array.isArray(estado.fallidos)

                    ? estado.fallidos.length

                    : 0;

            const bajas =

                estado.bajas || 0;

            const porcentaje =

                total>0

                    ?

                    Math.round(

                        actual*100/total

                    )

                    :

                    0;

            //--------------------------------------------------
            // SCHEDULER
            //--------------------------------------------------

            const sch =

                scheduler.getStatus

                    ? scheduler.getStatus(instanceId)

                    : {};

            //--------------------------------------------------
            // ANTIBAN
            //--------------------------------------------------

            const ab =

                antiBan.getEstado

                    ? antiBan.getEstado(instanceId)

                    : {};

            //--------------------------------------------------
            // RESPUESTA
            //--------------------------------------------------

            return res.json({

                ok:true,

                enviando:

                    !!estado.enviando,

                campanaFinalizada:

                    !!estado.campanaFinalizada,

                progreso:{

                    total,

                    actual,

                    enviados,

                    pendientes,

                    fallidos,

                    bajas,

                    porcentaje

                },

                scheduler:{

                    status:

                        sch.status ||

                        'IDLE',

                    actual:

                        sch.actual ||

                        actual,

                    total:

                        sch.total ||

                        total,

                    mensajeActual:

                        sch.mensajeActual ||

                        '',

                    contactoActual:

                        sch.contactoActual ||

                        '',

                    nextRun:

                        sch.nextRun ||

                        null

                },

                antiban:{

                    mensajesHoy:

                        ab.mensajesHoy ||

                        0,

                    mensajesHora:

                        ab.mensajesHora ||

                        0,

                    motivo:

                        ab.motivo ||

                        '-',

                    tiempoRestante:

                        ab.tiempoRestante ||

                        0

                },

                contactos:

                    estado.contactosCargados ||

                    [],

                fallidos:

                    estado.fallidos ||

                    []

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
// POST /pausar
//==============================================================

router.post('/pausar', (req, res) => {

    try {

        const instanceId =

            req.body.instanceId ||
            req.query.instanceId;

        if (!instanceId) {

            return res.status(400).json({

                ok: false,

                error: 'instanceId requerido'

            });

        }

        const estado =

            getEstadoInstancia(instanceId);

        if (!estado) {

            return res.status(404).json({

                ok: false,

                error: 'Instancia inexistente'

            });

        }

        estado.enviando = false;

        guardarEstadoSeguro(instanceId);

        return res.json({

            ok: true,

            mensaje: 'Campaña pausada'

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});


//==============================================================
// POST /detener
//==============================================================

router.post('/detener', (req, res) => {

    try {

        const instanceId =

            req.body.instanceId ||
            req.query.instanceId;

        if (!instanceId) {

            return res.status(400).json({

                ok: false,

                error: 'instanceId requerido'

            });

        }

        const estado =

            getEstadoInstancia(instanceId);

        if (!estado) {

            return res.status(404).json({

                ok: false,

                error: 'Instancia inexistente'

            });

        }

        estado.enviando = false;

        estado.campanaFinalizada = true;

        guardarEstadoSeguro(instanceId);

        return res.json({

            ok: true,

            mensaje: 'Campaña detenida'

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            ok: false,

            error: err.message

        });

    }

});


//==============================================================
// EXPORT
//==============================================================

module.exports = router;