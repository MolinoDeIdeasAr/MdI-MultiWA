'use strict';

const fs = require('fs');
const path = require('path');

//====================================================
// CONFIGURACIÓN
//====================================================

const DATA_DIR = path.join(__dirname, '..', 'data');
const CRM_FILE = path.join(DATA_DIR, 'crm-clientes.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

//====================================================
// CACHE EN MEMORIA
//====================================================

let crmCache = null;
let cacheDirty = false;

//====================================================
// HELPERS
//====================================================

function generarId() {

    return (

        Date.now().toString(36) +

        Math.random()
            .toString(36)
            .substring(2, 10)

    );

}

//----------------------------------------------------

function normalizarNumero(numero) {

    let n = String(numero || '');

    n = n.replace(/\D/g, '');

    if (n.startsWith('549'))
        n = n.substring(3);

    else if (n.startsWith('54'))
        n = n.substring(2);

    if (n.startsWith('0'))
        n = n.substring(1);

    return n.slice(-10);

}

//----------------------------------------------------

function touchCliente(cliente) {

    cliente.ultimaActividad =
        new Date().toISOString();

}

//====================================================
// PERSISTENCIA
//====================================================

function cargarCRM() {

    if (crmCache)
        return crmCache;

    try {

        if (!fs.existsSync(CRM_FILE)) {

            fs.writeFileSync(

                CRM_FILE,

                '[]',

                'utf8'

            );

        }

        const contenido =
            fs.readFileSync(
                CRM_FILE,
                'utf8'
            );

        crmCache = JSON.parse(contenido);

        if (!Array.isArray(crmCache))
            crmCache = [];

        return crmCache;

    }
    catch (err) {

        console.error(

            '[CRM] Error cargando CRM:',

            err.message

        );

        crmCache = [];

        return crmCache;

    }

}

//----------------------------------------------------

function guardarCRM(clientes = crmCache) {

    try {

        crmCache = clientes;

        fs.writeFileSync(

            CRM_FILE,

            JSON.stringify(
                crmCache,
                null,
                2
            ),

            'utf8'

        );

        cacheDirty = false;

        return true;

    }
    catch (err) {

        console.error(

            '[CRM] Error guardando CRM:',

            err.message

        );

        return false;

    }

}

//----------------------------------------------------

function marcarDirty() {

    cacheDirty = true;

}

//----------------------------------------------------

function flush() {

    if (!cacheDirty)
        return true;

    return guardarCRM();

}

//====================================================
// BÚSQUEDAS INTERNAS
//====================================================

function obtenerClienteInterno(numero) {

    const clientes = cargarCRM();

    const normalizado =
        normalizarNumero(numero);

    return clientes.find(cliente => {

        return (

            normalizarNumero(cliente.numero) === normalizado ||

            normalizarNumero(cliente.numeroWhatsApp) === normalizado ||

            normalizarNumero(cliente.lid) === normalizado

        );

    });

}

//----------------------------------------------------

function buscarCliente(numero) {

    return obtenerClienteInterno(numero);

}

//----------------------------------------------------

function obtenerTodosInterno() {

    return cargarCRM();

}

//====================================================
// OBTENER O CREAR CLIENTE
//====================================================

function obtenerOCrearCliente(datos = {}) {

    const numero = normalizarNumero(

        datos.numero ||

        datos.numeroWhatsApp ||

        datos.lid ||

        ''

    );

    let cliente = obtenerClienteInterno(numero);

    //------------------------------------------------
    // Ya existe
    //------------------------------------------------

    if (cliente) {

        actualizarDatos(numero, datos);

        return obtenerClienteInterno(numero);

    }

    //------------------------------------------------
    // Crear nuevo
    //------------------------------------------------

    cliente = {

        id: generarId(),

        nombre:
            datos.nombre ||
            'Desconocido',

        numero,

        numeroWhatsApp:
            datos.numeroWhatsApp ||
            numero,

        lid:
            datos.lid || '',

        chatId:
            datos.chatId || '',

        empresa:
            datos.empresa || '',

        email:
            datos.email || '',

        rubro:
            datos.rubro || '',

        origen:
            datos.origen || 'WhatsApp',

        campania:
            datos.campania || 'General',

        estado:
            datos.estado || 'nuevo',

        etiqueta:
            datos.etiqueta || 'sin_clasificar',

        responsable:
            datos.responsable || '',

        prioridad:
            datos.prioridad || 'normal',

        ultimoEstadoIA: '',

        ultimaIntencionIA: '',

        ultimoMensaje: '',

        fechaAlta:
            new Date().toISOString(),

        ultimaActividad:
            new Date().toISOString(),

        conversaciones: [],

        eventos: [],

        notas: [],

        historial: [],

        historialCampanias: []

    };

    cliente.historialCampanias.push({

        fecha: new Date().toISOString(),

        campania: cliente.campania

    });

    cargarCRM().push(cliente);

    marcarDirty();

    flush();

    return cliente;

}

//====================================================
// COMPATIBILIDAD
//====================================================

const obtenerOCrearContacto =
    obtenerOCrearCliente;

//====================================================
// ACTUALIZAR DATOS
//====================================================

function actualizarDatos(numero, datos = {}) {

    const cliente =
        obtenerClienteInterno(numero);

    if (!cliente)
        return false;

    //------------------------------------------------
    // Campos protegidos
    //------------------------------------------------

    const protegidos = [

        'id',

        'fechaAlta',

        'conversaciones',

        'eventos',

        'notas',

        'historial',

        'historialCampanias'

    ];

    Object.entries(datos).forEach(

        ([campo, valor]) => {

            if (

                protegidos.includes(campo)

            )
                return;

            if (
                valor === undefined ||
                valor === null
            )
                return;

            if (
                typeof valor === 'string' &&
                valor.trim() === ''
            )
                return;

            cliente[campo] = valor;

        }

    );

    touchCliente(cliente);

    marcarDirty();

    flush();

    return cliente;

}

//====================================================
// ALIAS COMPATIBILIDAD
//====================================================

const actualizarCliente =
    actualizarDatos;

//====================================================
// CAMBIAR ESTADO
//====================================================

function cambiarEstado(numero, estado) {

    return actualizarDatos(

        numero,

        {

            estado

        }

    );

}

//====================================================
// CAMBIAR ETIQUETA
//====================================================

function cambiarEtiqueta(numero, etiqueta) {

    return actualizarDatos(

        numero,

        {

            etiqueta

        }

    );

}

//====================================================
// CAMBIAR CAMPAÑA
//====================================================

function cambiarCampania(numero, campania) {

    const cliente =
        obtenerClienteInterno(numero);

    if (!cliente)
        return false;

    cliente.campania = campania;

    if (!Array.isArray(cliente.historialCampanias))
        cliente.historialCampanias = [];

    const existe = cliente.historialCampanias.find(

        h => h.campania === campania

    );

    if (!existe) {

        cliente.historialCampanias.unshift({

            fecha: new Date().toISOString(),

            campania

        });

    }

    touchCliente(cliente);

    marcarDirty();

    flush();

    return cliente;

}

//====================================================
// COMPATIBILIDAD
//====================================================

const agregarCampania =
    cambiarCampania;

const agregarCampaña =
    cambiarCampania;

//====================================================
// AGREGAR CONVERSACIÓN
//====================================================

function agregarConversacion(numero, conversacion = {}) {

    const cliente = obtenerClienteInterno(numero);

    if (!cliente)
        return false;

    if (!Array.isArray(cliente.conversaciones))
        cliente.conversaciones = [];

    const registro = {

        id:
            conversacion.id ||
            generarId(),

        fecha:
            conversacion.fecha ||
            new Date().toISOString(),

        direccion:
            conversacion.direccion ||

            (
                conversacion.tipo === 'enviado'
                    ? 'OUT'
                    : 'IN'
            ),

        autor:
            conversacion.autor ||

            (
                conversacion.tipo === 'enviado'
                    ? 'IA'
                    : 'CLIENTE'
            ),

        tipo:
            conversacion.tipoMensaje ||

            conversacion.tipo ||

            'texto',

        mensaje:
            conversacion.mensaje || '',

        respuesta:
            conversacion.respuesta || '',

        estadoIA:
            conversacion.estadoIA || '',

        intencionIA:
            conversacion.intencionIA || '',

        instanceId:
            conversacion.instanceId ||

            conversacion.instancia ||

            '',

        campaignId:
            conversacion.campaignId ||

            conversacion.campania ||

            conversacion.campaña ||

            '',

        chatId:
            conversacion.chatId || '',

        messageId:
            conversacion.messageId || '',

        modeloIA:
            conversacion.modeloIA || '',

        metadata:
            conversacion.metadata || {}

    };

    cliente.conversaciones.unshift(registro);

    if (cliente.conversaciones.length > 1000) {

        cliente.conversaciones =
            cliente.conversaciones.slice(0, 1000);

    }

    cliente.ultimoMensaje =
        registro.mensaje;

    touchCliente(cliente);

    marcarDirty();

    flush();

    return registro;

}

//====================================================
// AGREGAR EVENTO
//====================================================

function agregarEvento(numero, evento = {}) {

    const cliente = obtenerClienteInterno(numero);

    if (!cliente)
        return false;

    if (!Array.isArray(cliente.eventos))
        cliente.eventos = [];

    const registro = {

        id:
            evento.id ||
            generarId(),

        fecha:
            evento.fecha ||
            new Date().toISOString(),

        tipo:
            evento.tipo ||
            'evento',

        descripcion:
            evento.descripcion ||

            evento.detalle ||

            '',

        usuario:
            evento.usuario || '',

        metadata:
            evento.metadata || {}

    };

    cliente.eventos.unshift(registro);

    if (cliente.eventos.length > 1000) {

        cliente.eventos =
            cliente.eventos.slice(0, 1000);

    }

    touchCliente(cliente);

    marcarDirty();

    flush();

    return registro;

}

//====================================================
// HISTORIAL (COMPATIBILIDAD)
//====================================================

function agregarHistorial(numero, accion, datos = {}) {

    const cliente = obtenerClienteInterno(numero);

    if (!cliente)
        return false;

    if (!Array.isArray(cliente.historial))
        cliente.historial = [];

    const registro = {

        id: generarId(),

        fecha: new Date().toISOString(),

        accion,

        datos

    };

    cliente.historial.unshift(registro);

    if (cliente.historial.length > 1000) {

        cliente.historial =
            cliente.historial.slice(0, 1000);

    }

    //--------------------------------------------------
    // También registrar como evento
    //--------------------------------------------------

    agregarEvento(numero, {

        tipo: accion,

        descripcion: accion,

        metadata: datos

    });

    touchCliente(cliente);

    marcarDirty();

    flush();

    return registro;

}

//====================================================
// AGREGAR NOTA
//====================================================

function agregarNota(numero, nota) {

    const cliente = obtenerClienteInterno(numero);

    if (!cliente)
        return false;

    if (!Array.isArray(cliente.notas))
        cliente.notas = [];

    const registro = {

        id: generarId(),

        fecha: new Date().toISOString(),

        autor:

            typeof nota === 'object'

                ? nota.autor || 'Sistema'

                : 'Sistema',

        texto:

            typeof nota === 'object'

                ? nota.texto || ''

                : String(nota || '')

    };

    cliente.notas.unshift(registro);

    if (cliente.notas.length > 500) {

        cliente.notas =
            cliente.notas.slice(0, 500);

    }

    touchCliente(cliente);

    marcarDirty();

    flush();

    return registro;

}

//====================================================
// OBTENER CLIENTES
//====================================================

function obtenerClientes() {

    return cargarCRM()

        .sort(

            (a, b) =>

                new Date(

                    b.ultimaActividad ||

                    b.fechaAlta ||

                    0

                )

                -

                new Date(

                    a.ultimaActividad ||

                    a.fechaAlta ||

                    0

                )

        );

}

//====================================================
// OBTENER CLIENTE POR ID
//====================================================

function obtenerClientePorId(id) {

    return cargarCRM().find(

        cliente => cliente.id === id

    ) || null;

}

//====================================================
// BUSCAR CLIENTES
//====================================================

function buscarClientes(texto = '') {

    texto =

        String(texto)

            .toLowerCase()

            .trim();

    if (!texto)
        return obtenerClientes();

    return cargarCRM().filter(cliente => {

        return (

            (cliente.nombre || '')
                .toLowerCase()
                .includes(texto)

            ||

            (cliente.numero || '')
                .includes(texto)

            ||

            (cliente.numeroWhatsApp || '')
                .includes(texto)

            ||

            (cliente.empresa || '')
                .toLowerCase()
                .includes(texto)

            ||

            (cliente.email || '')
                .toLowerCase()
                .includes(texto)

            ||

            (cliente.rubro || '')
                .toLowerCase()
                .includes(texto)

            ||

            (cliente.estado || '')
                .toLowerCase()
                .includes(texto)

            ||

            (cliente.etiqueta || '')
                .toLowerCase()
                .includes(texto)

            ||

            (cliente.campania || '')
                .toLowerCase()
                .includes(texto)

        );

    });

}

//====================================================
// ELIMINAR CLIENTE
//====================================================

function eliminarCliente(numero) {

    const clientes = cargarCRM();

    const normalizado =
        normalizarNumero(numero);

    const indice = clientes.findIndex(c =>

        normalizarNumero(c.numero) === normalizado ||

        normalizarNumero(c.numeroWhatsApp) === normalizado ||

        normalizarNumero(c.lid) === normalizado

    );

    if (indice === -1)
        return false;

    clientes.splice(indice, 1);

    marcarDirty();

    flush();

    return true;

}

//====================================================
// ESTADÍSTICAS
//====================================================

function estadisticasCRM() {

    const clientes = cargarCRM();

    return {

        total: clientes.length,

        nuevos:

            clientes.filter(

                c => c.estado === 'nuevo'

            ).length,

        interesados:

            clientes.filter(

                c =>

                    c.estado === 'interesado' ||

                    c.estado === 'interesado_calido'

            ).length,

        clientes:

            clientes.filter(

                c =>

                    c.estado === 'cliente'

            ).length,

        seguimiento:

            clientes.filter(

                c =>

                    c.estado === 'seguimiento'

            ).length,

        bajas:

            clientes.filter(

                c =>

                    c.estado === 'BAJA'

            ).length,

        perdidos:

            clientes.filter(

                c =>

                    c.estado === 'cerrado_perdido'

            ).length

    };

}

//====================================================
// EXPORTS
//====================================================

module.exports = {

    // Persistencia

    cargarCRM,

    guardarCRM,

    flush,

    // Utilidades

    normalizarNumero,

    generarId,

    // Consultas

    buscarCliente,

    obtenerClientes,

    obtenerClientePorId,

    buscarClientes,

    // CRUD

    obtenerOCrearCliente,

    obtenerOCrearContacto,

    actualizarDatos,

    actualizarCliente,

    eliminarCliente,

    // Conversaciones

    agregarConversacion,

    agregarEvento,

    agregarHistorial,

    agregarNota,

    // Estado

    cambiarEstado,

    cambiarEtiqueta,

    cambiarCampania,

    agregarCampania,

    agregarCampaña,

    // Reportes

    estadisticasCRM

};