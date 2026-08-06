'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * state/estado.js
 *
 * v3.0.0
 *
 * Estado único de cada instancia.
 *
 * RESPONSABILIDAD
 *  • Mantener el estado en memoria.
 *  • Persistir automáticamente en /data.
 *  • No contiene lógica de campañas.
 *  • No depende del scheduler.
 * =============================================================
 */

const fs = require('fs');
const path = require('path');

//==============================================================
// DIRECTORIO
//==============================================================

const DATA_DIR = path.join(

    __dirname,

    '..',

    'data'

);

fs.mkdirSync(

    DATA_DIR,

    {

        recursive: true

    }

);

//==============================================================
// MEMORIA
//==============================================================

const estados = new Map();

//==============================================================
// HELPERS
//==============================================================

function getEstadoPath(instanceId) {

    return path.join(

        DATA_DIR,

        `estado_${instanceId}.json`

    );

}

//==============================================================
// ESTADO POR DEFECTO
//==============================================================

function getDefaultEstado() {

    return {

        //------------------------------------------------------
        // WhatsApp
        //------------------------------------------------------

        listo: false,

        numeroWhatsApp: '',

        //------------------------------------------------------
        // Campaña
        //------------------------------------------------------

        enviando: false,

        pausado: false,

        campanaFinalizada: false,

        //------------------------------------------------------
        // Contactos
        //------------------------------------------------------

        contactosCargados: [],

        actual: 0,

        total: 0,

        enviadosOk: 0,

        fallidos: [],

        //------------------------------------------------------
        // Contenido
        //------------------------------------------------------

        mensajesGuardados: [],

        imagenGuardada: null,

        audioGuardado: null,

        //------------------------------------------------------
        // Información adicional
        //------------------------------------------------------

        rubro: '',

        usuario: '',

        nombreInstancia: '',

        //------------------------------------------------------
        // Conversaciones
        //------------------------------------------------------

        conversaciones: {},

        //------------------------------------------------------
        // Estadísticas
        //------------------------------------------------------

        enviadosHoy: 0,

        respuestasHoy: 0,

        bajasHoy: 0,

        //------------------------------------------------------
        // Fechas
        //------------------------------------------------------

        fechaCreacion: new Date().toISOString(),

        ultimaActualizacion: new Date().toISOString()

    };

}

//==============================================================
// OBTENER ESTADO
//==============================================================

function getEstadoInstancia(instanceId) {

    if (!instanceId) {

        return null;

    }

    //----------------------------------------------------------
    // ¿Ya está en memoria?
    //----------------------------------------------------------

    if (estados.has(instanceId)) {

        return estados.get(instanceId);

    }

    //----------------------------------------------------------
    // Intentar cargar desde disco
    //----------------------------------------------------------

    const estado = cargarEstado(instanceId);

    estados.set(

        instanceId,

        estado

    );

    return estado;

}

//==============================================================
// REEMPLAZAR ESTADO COMPLETO
//==============================================================

function setEstadoInstancia(

    instanceId,

    nuevoEstado

) {

    if (!instanceId) {

        return null;

    }

    const estado = {

        ...getDefaultEstado(),

        ...(nuevoEstado || {}),

        ultimaActualizacion:

            new Date().toISOString()

    };

    estados.set(

        instanceId,

        estado

    );

    guardarEstadoSeguro(instanceId);

    return estado;

}

//==============================================================
// ACTUALIZAR ESTADO
//==============================================================

function actualizarEstado(

    instanceId,

    cambios = {}

) {

    const estado =

        getEstadoInstancia(instanceId);

    if (!estado) {

        return null;

    }

    Object.assign(

        estado,

        cambios

    );

    estado.ultimaActualizacion =

        new Date().toISOString();

    guardarEstadoSeguro(instanceId);

    return estado;

}

//==============================================================
// EXISTE EN MEMORIA
//==============================================================

function existeEstado(

    instanceId

) {

    return estados.has(instanceId);

}

//==============================================================
// ELIMINAR DE MEMORIA
//==============================================================

function eliminarEstadoMemoria(

    instanceId

) {

    estados.delete(instanceId);

}

//==============================================================
// GUARDAR ESTADO
//==============================================================

function guardarEstado(

    estado,

    instanceId

) {

    if (

        !instanceId ||

        !estado

    ) {

        return false;

    }

    estado.ultimaActualizacion =

        new Date().toISOString();

    estados.set(

        instanceId,

        estado

    );

    return persistirEstado(

        instanceId,

        estado

    );

}

//==============================================================
// GUARDAR ESTADO (SEGURO)
//==============================================================

function guardarEstadoSeguro(

    instanceId

) {

    const estado =

        estados.get(instanceId);

    if (!estado) {

        return false;

    }

    estado.ultimaActualizacion =

        new Date().toISOString();

    return persistirEstado(

        instanceId,

        estado

    );

}

//==============================================================
// PERSISTIR EN DISCO
//==============================================================

function persistirEstado(

    instanceId,

    estado

) {

    try {

        fs.writeFileSync(

            getEstadoPath(instanceId),

            JSON.stringify(

                estado,

                null,

                4

            ),

            'utf8'

        );

        return true;

    }

    catch (err) {

        console.error(

            `❌ Error guardando estado (${instanceId})`

        );

        console.error(err);

        return false;

    }

}

//==============================================================
// CARGAR DESDE DISCO
//==============================================================

function cargarEstado(

    instanceId

) {

    const archivo =

        getEstadoPath(instanceId);

    if (

        !fs.existsSync(archivo)

    ) {

        return getDefaultEstado();

    }

    try {

        const json =

            JSON.parse(

                fs.readFileSync(

                    archivo,

                    'utf8'

                )

            );

//------------------------------------------------------
// Verificar imagen
//------------------------------------------------------

if (

    json.imagenGuardada

) {

    const nombreImagen =

        typeof json.imagenGuardada === 'string'

            ? json.imagenGuardada

            : json.imagenGuardada.archivo;

    const rutaImagen = path.join(

        __dirname,

        '..',

        'uploads',

        nombreImagen

    );

    if (

        !fs.existsSync(rutaImagen)

    ) {

        json.imagenGuardada = null;

    }

}

//------------------------------------------------------
// Verificar audio
//------------------------------------------------------

if (

    json.audioGuardado

) {

    const nombreAudio =

        typeof json.audioGuardado === 'string'

            ? json.audioGuardado

            : json.audioGuardado.archivo;

    const rutaAudio = path.join(

        __dirname,

        '..',

        'uploads',

        nombreAudio

    );

    if (

        !fs.existsSync(rutaAudio)

    ) {

        json.audioGuardado = null;

    }

}

        return {

            ...getDefaultEstado(),

            ...json

        };

    }

    catch (err) {

        console.error(

            `⚠ Estado corrupto (${instanceId})`

        );

        console.error(err);

        return getDefaultEstado();

    }

}

//==============================================================
// EXISTE ARCHIVO
//==============================================================

function existeEstadoEnDisco(

    instanceId

) {

    return fs.existsSync(

        getEstadoPath(instanceId)

    );

}

//==============================================================
// GUARDAR MENSAJES
//==============================================================

function guardarMensajes(

    instanceId,

    mensajes

) {

    const estado =

        getEstadoInstancia(instanceId);

    estado.mensajesGuardados =

        Array.isArray(mensajes)

            ? mensajes.filter(Boolean)

            : [];

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// GUARDAR IMAGEN
//==============================================================

function guardarImagen(

    instanceId,

    nombreArchivo

) {

    const estado =

        getEstadoInstancia(instanceId);

    if (

        !nombreArchivo ||

        typeof nombreArchivo !== 'string'

    ) {

        estado.imagenGuardada = null;

        guardarEstadoSeguro(instanceId);

        return estado;

    }

    //----------------------------------------------------------
    // Verificar que exista en uploads
    //----------------------------------------------------------

    const archivo = path.join(

        __dirname,

        '..',

        'uploads',

        nombreArchivo

    );

    if (

        !fs.existsSync(archivo)

    ) {

        console.warn(

            `⚠ Imagen inexistente: ${nombreArchivo}`

        );

        estado.imagenGuardada = null;

        guardarEstadoSeguro(instanceId);

        return estado;

    }

estado.imagenGuardada = {

    archivo: nombreArchivo,

    fecha: Date.now()

};

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// GUARDAR AUDIO
//==============================================================

function guardarAudio(

    instanceId,

    nombreArchivo

) {

    const estado =

        getEstadoInstancia(instanceId);

    if (

        !nombreArchivo ||

        typeof nombreArchivo !== 'string'

    ) {

        estado.audioGuardado = null;

        guardarEstadoSeguro(instanceId);

        return estado;

    }

    //----------------------------------------------------------
    // Verificar que exista en uploads
    //----------------------------------------------------------

    const archivo = path.join(

        __dirname,

        '..',

        'uploads',

        nombreArchivo

    );

    if (

        !fs.existsSync(archivo)

    ) {

        console.warn(

            `⚠ Audio inexistente: ${nombreArchivo}`

        );

        estado.audioGuardado = null;

        guardarEstadoSeguro(instanceId);

        return estado;

    }

estado.audioGuardado = {

    archivo: nombreArchivo,

    fecha: Date.now()

};

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// ELIMINAR IMAGEN
//==============================================================

function eliminarImagen(

    instanceId

) {

    const estado =

        getEstadoInstancia(instanceId);

    estado.imagenGuardada = null;

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// ELIMINAR AUDIO
//==============================================================

function eliminarAudio(

    instanceId

) {

    const estado =

        getEstadoInstancia(instanceId);

    estado.audioGuardado = null;

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// LIMPIAR CAMPAÑA
//==============================================================

function limpiarCampania(

    instanceId

) {

    const estado =

        getEstadoInstancia(instanceId);

    //----------------------------------------------------------
    // Contactos
    //----------------------------------------------------------

    estado.contactosCargados = [];

    estado.actual = 0;

    estado.total = 0;

    estado.enviadosOk = 0;

    estado.fallidos = [];

    //----------------------------------------------------------
    // Estado campaña
    //----------------------------------------------------------

    estado.enviando = false;

    estado.pausado = false;

    estado.campanaFinalizada = false;

    //----------------------------------------------------------
    // Contenido
    //----------------------------------------------------------

    estado.mensajesGuardados = [];

    estado.imagenGuardada = null;

    estado.audioGuardado = null;

    estado.conversaciones = {};

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// RESETEAR CONTADORES
//==============================================================

function resetearContadores(

    instanceId

) {

    const estado =

        getEstadoInstancia(instanceId);

    estado.actual = 0;

    estado.total =

        estado.contactosCargados.length;

    estado.enviadosOk = 0;

    estado.fallidos = [];

    estado.enviando = false;

    estado.pausado = false;

    estado.campanaFinalizada = false;

    guardarEstadoSeguro(

        instanceId

    );

    return estado;

}

//==============================================================
// GET IMAGEN
//==============================================================

function getImagen(instanceId){

    return getEstadoInstancia(

        instanceId

    )?.imagenGuardada || null;

}

//==============================================================
// GET AUDIO
//==============================================================

function getAudio(instanceId){

    return getEstadoInstancia(

        instanceId

    )?.audioGuardado || null;

}

//==============================================================
// LISTAR ESTADOS
//==============================================================

function getEstados() {

    return estados;

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    //----------------------------------------------------------
    // Estado
    //----------------------------------------------------------

    getDefaultEstado,

    getEstadoInstancia,

    setEstadoInstancia,

    actualizarEstado,

    existeEstado,

    eliminarEstadoMemoria,

    getEstados,

    getImagen,

    getAudio,

    //----------------------------------------------------------
    // Persistencia
    //----------------------------------------------------------

    guardarEstado,

    guardarEstadoSeguro,

    cargarEstado,

    existeEstadoEnDisco,

    //----------------------------------------------------------
    // Campaña
    //----------------------------------------------------------

    limpiarCampania,

    resetearContadores,

    //----------------------------------------------------------
    // Contenido
    //----------------------------------------------------------

    guardarMensajes,

    guardarImagen,

    guardarAudio,

    eliminarImagen,

    eliminarAudio

};