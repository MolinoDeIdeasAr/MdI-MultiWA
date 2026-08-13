'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * routes/api-envio.js
 *
 * v3.1.0
 *
 * API DE ENVÍOS
 *
 * RESPONSABILIDAD
 *
 * • Guardar mensajes
 * • Guardar imagen
 * • Iniciar campaña
 * • Pausar campaña
 * • Reanudar campaña
 * • Detener campaña
 *
 * NO envía mensajes.
 * NO ejecuta timers.
 * NO contiene lógica antiban.
 *
 * CHANGELOG v3.1.0:
 *  • Se eliminó toda referencia a audio (ya no se usa esa
 *    función): rutas POST /audio y DELETE /audio, e imports de
 *    guardarAudio/eliminarAudio de state/estado.js.
 * =============================================================
 */

const express = require('express');
const router = express.Router();

const path = require('path');

const fs = require('fs');
const multer = require('multer');

const sessionManager =
    require('../services/session-manager');

const scheduler =
    require('../services/campaign-scheduler');

const {

    getScheduler,

    reiniciarScheduler

} = require('../state/scheduler-state');

const {

    getEstadoInstancia,

    actualizarEstado,

    guardarEstadoSeguro,

    guardarMensajes,

    guardarImagen,

    eliminarImagen,

    resetearContadores

} = require('../state/estado');

//==============================================================
// MULTER
//==============================================================

const storage = multer.diskStorage({

    destination(req,file,cb){

        cb(

            null,

            path.join(

                __dirname,

                '..',

                'uploads'

            )

        );

    },

    filename(req,file,cb){

        cb(

            null,

            `${Date.now()}_${file.originalname}`

        );

    }

});

const upload = multer({

    storage,

    limits:{

        fileSize:50*1024*1024

    }

});

//==============================================================
// GUARDAR MENSAJES
//==============================================================

router.post(

    '/mensajes',

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId,

                mensajes,

                respuestaInfo

            } = req.body;

            //--------------------------------------------------
            // Validaciones
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            if(

                !Array.isArray(mensajes)

            ){

                return res.status(400).json({

                    ok:false,

                    error:'mensajes inválidos'

                });

            }

            const lista =

                mensajes

                .map(

                    m =>

                    String(m || '').trim()

                )

                .filter(Boolean);

            if(

                lista.length===0

            ){

                return res.status(400).json({

                    ok:false,

                    error:'Debe ingresar al menos un mensaje'

                });

            }

            //--------------------------------------------------
            // Cliente
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
            // Estado
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
            // Respuesta a "INFO" propia de esta campaña
            // (opcional — si no viene, no se toca lo que ya
            // había guardado; guardarMensajes() persiste todo
            // junto abajo)
            //--------------------------------------------------

            if(

                typeof respuestaInfo === 'string'

            ){

                estado.respuestaInfo =

                    respuestaInfo.trim();

            }

            //--------------------------------------------------
            // Guardar
            //--------------------------------------------------

            guardarMensajes(

                instanceId,

                lista

            );

            console.log(

                `💾 ${lista.length} mensajes guardados (${instanceId})`

            );

            return res.json({

                ok:true,

                total:lista.length

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
// SUBIR IMAGEN
//==============================================================

router.post(

    '/imagen',

    upload.single('imagen'),

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.body;

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            if(

                !req.file

            ){

                return res.status(400).json({

                    ok:false,

                    error:'No se recibió ninguna imagen'

                });

            }

            //--------------------------------------------------
            // Estado
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
            // Borrar la imagen anterior del disco si había una
            // distinta — si no, cada reemplazo deja un archivo
            // huérfano en uploads/ para siempre (multer siempre
            // genera un nombre nuevo con timestamp).
            //--------------------------------------------------

            if(

                estado.imagenGuardada &&

                estado.imagenGuardada !== req.file.filename

            ){

                const anterior =

                    path.join(

                        __dirname,

                        '..',

                        'uploads',

                        estado.imagenGuardada

                    );

                try{

                    if(

                        fs.existsSync(anterior)

                    ){

                        fs.unlinkSync(

                            anterior

                        );

                    }

                }

                catch(err){

                    console.warn(

                        `⚠ No se pudo borrar imagen anterior (${instanceId}):`,

                        err.message

                    );

                }

            }

            //--------------------------------------------------
            // Guardar imagen
            //--------------------------------------------------

            guardarImagen(

                instanceId,

                req.file.filename

            );

            console.log(

                `🖼 Imagen guardada (${instanceId}) -> ${req.file.filename}`

            );

            return res.json({

                ok:true,

                archivo:req.file.filename

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
// ELIMINAR IMAGEN
//==============================================================

router.delete(

    '/imagen',

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.body;

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            eliminarImagen(

                instanceId

            );

            console.log(

                `🗑 Imagen eliminada (${instanceId})`

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
// INICIAR CAMPAÑA
//==============================================================

router.post(

    '/iniciar',

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.body;

            //--------------------------------------------------
            // Validar instancia
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            //--------------------------------------------------
            // Cliente
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
            // Esperar READY
            //--------------------------------------------------

            if(

                !client.info ||

                !client.info.wid

            ){

                return res.status(400).json({

                    ok:false,

                    error:'WhatsApp aún se está iniciando'

                });

            }

            //--------------------------------------------------
            // Estado
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
            // Contactos
            //--------------------------------------------------

            if(

                !Array.isArray(

                    estado.contactosCargados

                )

                ||

                estado.contactosCargados.length===0

            ){

                return res.status(400).json({

                    ok:false,

                    error:'No hay contactos cargados'

                });

            }

            //--------------------------------------------------
            // Mensajes
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
            // Reiniciar contadores
            //--------------------------------------------------

            resetearContadores(

                instanceId

            );

            //--------------------------------------------------
            // Marcar campaña
            //--------------------------------------------------

            actualizarEstado(

                instanceId,

                {

                    enviando:true,

                    pausado:false,

                    campanaFinalizada:false

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // Reiniciar Scheduler
            //--------------------------------------------------

            reiniciarScheduler(

                instanceId

            );

            //--------------------------------------------------
            // Iniciar Scheduler
            //--------------------------------------------------

            const iniciado =

                await scheduler.iniciar(

                    instanceId

                );

            if(

                !iniciado

            ){

                return res.status(500).json({

                    ok:false,

                    error:'No se pudo iniciar el Scheduler'

                });

            }

            //--------------------------------------------------
            // Log
            //--------------------------------------------------

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

                'ready:',

                !!client.info

            );

            console.log(

                'mensajes:',

                mensajes.length

            );

            console.log(

                'contactos:',

                estado.contactosCargados.length

            );

            console.log(

                'scheduler:',

                sch.status

            );

            console.log(

                '=============================='

            );

            console.log('');

            //--------------------------------------------------
            // OK
            //--------------------------------------------------

            return res.json({

                ok:true,

                total:

                    estado.contactosCargados.length

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
// PAUSAR CAMPAÑA
//==============================================================

router.post(

    '/pausar',

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.body;

            //--------------------------------------------------
            // Validar
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            //--------------------------------------------------
            // Estado
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
            // Actualizar estado
            //--------------------------------------------------

            actualizarEstado(

                instanceId,

                {

                    enviando:false,

                    pausado:true

                }

            );

            //--------------------------------------------------
            // Scheduler
            //--------------------------------------------------

            scheduler.pausar(

                instanceId

            );

            console.log(

                `⏸ Campaña pausada (${instanceId})`

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
// REANUDAR CAMPAÑA
//==============================================================

router.post(

    '/reanudar',

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.body;

            //--------------------------------------------------
            // Validar
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            //--------------------------------------------------
            // Cliente
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

            if(

                !client.info ||

                !client.info.wid

            ){

                return res.status(400).json({

                    ok:false,

                    error:'WhatsApp aún no está listo'

                });

            }

            //--------------------------------------------------
            // Estado
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
            // Actualizar estado
            //--------------------------------------------------

            actualizarEstado(

                instanceId,

                {

                    enviando:true,

                    pausado:false

                }

            );

            //--------------------------------------------------
            // Reiniciar Scheduler
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

                return res.status(500).json({

                    ok:false,

                    error:'No se pudo reanudar la campaña'

                });

            }

            console.log(

                `▶ Campaña reanudada (${instanceId})`

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
// DETENER CAMPAÑA
//==============================================================

router.post(

    '/detener',

    async (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.body;

            //--------------------------------------------------
            // Validar
            //--------------------------------------------------

            if(

                !instanceId

            ){

                return res.status(400).json({

                    ok:false,

                    error:'instanceId requerido'

                });

            }

            //--------------------------------------------------
            // Estado
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
            // Actualizar estado
            //--------------------------------------------------

            actualizarEstado(

                instanceId,

                {

                    enviando:false,

                    pausado:false,

                    campanaFinalizada:true

                }

            );

            guardarEstadoSeguro(

                instanceId

            );

            //--------------------------------------------------
            // Detener Scheduler
            //--------------------------------------------------

            scheduler.detener(

                instanceId

            );

            //--------------------------------------------------
            // Log
            //--------------------------------------------------

            console.log(

                `⏹ Campaña detenida (${instanceId})`

            );

            console.log(

                `Enviados: ${estado.enviadosOk}`

            );

            console.log(

                `Procesados: ${estado.actual}/${estado.total}`

            );

            //--------------------------------------------------
            // Respuesta
            //--------------------------------------------------

            return res.json({

                ok:true,

                enviados:

                    estado.enviadosOk,

                procesados:

                    estado.actual,

                total:

                    estado.total

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
// ESTADO DE CAMPAÑA
//==============================================================

router.get(

    '/estado/:instanceId',

    (

        req,

        res

    ) => {

        try{

            const {

                instanceId

            } = req.params;

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

            const schedulerInfo =

                getScheduler(

                    instanceId

                );

            return res.json({

                ok:true,

                estado,

                scheduler:schedulerInfo

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
// EXPORT
//==============================================================

module.exports = router;