'use strict';

//==============================================================
// MONITOR SERVICE
//==============================================================

const monitores = new Map();

//--------------------------------------------------------------
// CREAR
//--------------------------------------------------------------

function iniciar(instanceId, total = 0) {

    monitores.set(instanceId, {

        enviando: false,
        campanaFinalizada: false,

        progreso: {

            total,
            actual: 0,
            enviados: 0,
            pendientes: total,
            fallidos: 0,
            bajas: 0,
            porcentaje: 0

        },

        scheduler: {

            status: "IDLE",
            actual: 0,
            total,
            mensajeActual: "",
            contactoActual: "",
            nextRun: null

        },

        antiban: {

            mensajesHoy: 0,
            mensajesHora: 0,
            motivo: "",
            tiempoRestante: 0

        },

        contactos: [],
        fallidos: []

    });

}

//--------------------------------------------------------------
// OBTENER
//--------------------------------------------------------------

function obtener(instanceId){

    return monitores.get(instanceId);

}

//--------------------------------------------------------------
// EXISTE
//--------------------------------------------------------------

function existe(instanceId){

    return monitores.has(instanceId);

}

//--------------------------------------------------------------
// ACTUALIZAR
//--------------------------------------------------------------

function actualizar(instanceId, datos){

    const estado = monitores.get(instanceId);

    if(!estado) return;

    Object.assign(estado, datos);

}

//--------------------------------------------------------------
// REEMPLAZAR CONTACTOS
//--------------------------------------------------------------

function setContactos(instanceId, contactos){

    const estado = monitores.get(instanceId);

    if(!estado) return;

    estado.contactos = contactos;

}

//--------------------------------------------------------------
// AGREGAR FALLIDO
//--------------------------------------------------------------

function agregarFallido(instanceId, dato){

    const estado = monitores.get(instanceId);

    if(!estado) return;

    estado.fallidos.push(dato);

}

//--------------------------------------------------------------
// EXPORTS
//--------------------------------------------------------------

module.exports={

    iniciar,
    obtener,
    actualizar,
    existe,
    setContactos,
    agregarFallido

};