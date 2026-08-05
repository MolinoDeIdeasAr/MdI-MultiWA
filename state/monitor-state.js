'use strict';

//==============================================================
// MdI MultiWA
// monitor-state.js
// Estado central del Monitor
//==============================================================

const monitores = new Map();

//==============================================================
// ESTADO BASE
//==============================================================

function crearEstado(instanceId) {

    return {

        instanceId,

        //------------------------------------------------------
        // Estado general
        //------------------------------------------------------

        status: 'IDLE',

        enviando: false,

        pausado: false,

        campanaFinalizada: false,

        ultimaActualizacion: new Date().toISOString(),

        //------------------------------------------------------
        // Progreso
        //------------------------------------------------------

        total: 0,

        actual: 0,

        enviados: 0,

        pendientes: 0,

        fallidos: 0,

        bajas: 0,

        porcentaje: 0,

        //------------------------------------------------------
        // Contacto actual
        //------------------------------------------------------

        contactoActual: null,

        mensajeActual: null,

        fechaUltimoEnvio: null,

        //------------------------------------------------------
        // Scheduler
        //------------------------------------------------------

        scheduler: {

            status: 'IDLE',

            actual: 0,

            total: 0,

            nextRun: null,

            pausaActual: 0

        },

        //------------------------------------------------------
        // AntiBan
        //------------------------------------------------------

        antiban: {

            mensajesHoy: 0,

            mensajesHora: 0,

            motivo: '-',

            tiempoRestante: 0

        },

        //------------------------------------------------------
        // Listados
        //------------------------------------------------------

        contactos: [],

        errores: [],

        logs: []

    };

}

//==============================================================
// OBTENER MONITOR
//==============================================================

function getMonitor(instanceId) {

    if (!instanceId) {

        throw new Error(
            'instanceId requerido'
        );

    }

    if (!monitores.has(instanceId)) {

        monitores.set(

            instanceId,

            crearEstado(instanceId)

        );

    }

    return monitores.get(instanceId);

}

//==============================================================
// EXISTE
//==============================================================

function existeMonitor(instanceId) {

    return monitores.has(instanceId);

}

//==============================================================
// RESETEAR
//==============================================================

function resetMonitor(instanceId) {

    const estado = crearEstado(instanceId);

    monitores.set(

        instanceId,

        estado

    );

    return estado;

}

//==============================================================
// ELIMINAR
//==============================================================

function eliminarMonitor(instanceId) {

    return monitores.delete(

        instanceId

    );

}

//==============================================================
// LISTAR
//==============================================================

function getMonitores() {

    return Array.from(

        monitores.values()

    );

}

//==============================================================
// ACTUALIZAR TIMESTAMP
//==============================================================

function touch(instanceId) {

    const estado = getMonitor(

        instanceId

    );

    estado.ultimaActualizacion =

        new Date().toISOString();

}

//==============================================================
// EXPORTS (PARCIALES)
//==============================================================

module.exports = {

    getMonitor,

    existeMonitor,

    resetMonitor,

    eliminarMonitor,

    getMonitores,

    touch

};

//==============================================================
// PROGRESO
//==============================================================

function setProgreso(

    instanceId,

    progreso = {}

) {

    const estado = getMonitor(

        instanceId

    );

    estado.progreso = {

        ...estado.progreso,

        ...progreso

    };

    touch(

        instanceId

    );

    return estado.progreso;

}

//==============================================================
// SCHEDULER
//==============================================================

function setScheduler(

    instanceId,

    scheduler = {}

) {

    const estado = getMonitor(

        instanceId

    );

    estado.scheduler = {

        ...estado.scheduler,

        ...scheduler

    };

    touch(

        instanceId

    );

    return estado.scheduler;

}

//==============================================================
// ANTIBAN
//==============================================================

function setAntiban(

    instanceId,

    antiban = {}

) {

    const estado = getMonitor(

        instanceId

    );

    estado.antiban = {

        ...estado.antiban,

        ...antiban

    };

    touch(

        instanceId

    );

    return estado.antiban;

}

//==============================================================
// CONTACTO ACTUAL
//==============================================================

function setContactoActual(

    instanceId,

    contacto

) {

    const estado = getMonitor(

        instanceId

    );

    estado.contactoActual =

        contacto || null;

    touch(

        instanceId

    );

    return estado.contactoActual;

}

//==============================================================
// MENSAJE ACTUAL
//==============================================================

function setMensajeActual(

    instanceId,

    mensaje

) {

    const estado = getMonitor(

        instanceId

    );

    estado.mensajeActual =

        mensaje || '';

    touch(

        instanceId

    );

    return estado.mensajeActual;

}

//==============================================================
// GET /progreso
// Devuelve el estado completo del monitor
//==============================================================

router.get('/progreso', (req, res) => {

    try{

        const userId = req.session.userId;

        if(!userId){

            return res.json({

                ok:false,

                error:'Sin sesión'

            });

        }

        const instanceId =

            req.query.instanceId ||

            sessionManager.getEstado(userId)?.activeInstanceId;

        if(!instanceId){

            return res.json({

                ok:false,

                error:'Sin instancia activa'

            });

        }

        const estado =

            sessionManager.getEstado(

                userId,

                instanceId

            );

        if(!estado){

            return res.json({

                ok:false,

                error:'Estado inexistente'

            });

        }

        //--------------------------------------------------
        // CALCULAR PROGRESO
        //--------------------------------------------------

        const total =

            estado.total ||

            estado.contactos?.length ||

            0;

        const actual =

            estado.actual ||

            0;

        const enviados =

            estado.enviadosOk ||

            0;

        const fallidos =

            estado.enviadosError ||

            0;

        const bajas =

            estado.bajas ||

            0;

        const pendientes =

            Math.max(

                total-actual,

                0

            );

        const porcentaje =

            total

                ? Math.round(

                    actual*100/total

                )

                :0;

        //--------------------------------------------------
        // RESPUESTA
        //--------------------------------------------------

        res.json({

            ok:true,

            enviando:

                estado.enviando===true,

            campanaFinalizada:

                estado.campanaFinalizada===true,

            progreso:{

                total,

                actual,

                enviados,

                pendientes,

                fallidos,

                bajas,

                porcentaje

            },

            scheduler:

                estado.scheduler || {},

            antiban:

                estado.antiban || {},

            contactos:

                estado.contactos || []

        });

    }

    catch(err){

        console.error(

            err

        );

        res.json({

            ok:false,

            error:err.message

        });

    }

});