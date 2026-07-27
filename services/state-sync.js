'use strict';

//==============================================================
// STATE MANAGER
//==============================================================

const {

    guardarEstadoSeguro

} = require('../state/estado');

//==============================================================
// STATE SYNC
//==============================================================

class StateSync {

    //----------------------------------------------------------
    // SINCRONIZAR ESTADO TEMPORAL
    //----------------------------------------------------------

    actualizar(context) {

        const estado = context.estadoTemporal;

        if (!estado) {
            return;
        }

        //----------------------------------------------
        // Crear colección si no existe
        //----------------------------------------------

        if (!Array.isArray(estado.conversaciones)) {

            estado.conversaciones = [];

        }

        //----------------------------------------------
        // Convertir contexto
        //----------------------------------------------

        const conversacion =

            context.toEstadoTemporal();

        //----------------------------------------------
        // Insertar al comienzo
        //----------------------------------------------

        estado.conversaciones.unshift(

            conversacion

        );

        //----------------------------------------------
        // Limitar historial temporal
        //----------------------------------------------

        if (

            estado.conversaciones.length >

            500

        ) {

            estado.conversaciones =

                estado.conversaciones.slice(

                    0,

                    500

                );

        }

        //----------------------------------------------
        // Persistir
        //----------------------------------------------

        guardarEstadoSeguro(

            context.instanceId

        );

    }

    //----------------------------------------------------------
    // AGREGAR CONVERSACIÓN MANUALMENTE
    //----------------------------------------------------------

    agregarConversacion(estado, conversacion) {

        if (!estado)
            return;

        if (!Array.isArray(estado.conversaciones)) {

            estado.conversaciones = [];

        }

        estado.conversaciones.unshift(

            conversacion

        );

        if (estado.conversaciones.length > 500) {

            estado.conversaciones =

                estado.conversaciones.slice(0, 500);

        }

    }

    //----------------------------------------------------------
    // LIMPIAR HISTORIAL TEMPORAL
    //----------------------------------------------------------

    limpiarConversaciones(estado) {

        if (!estado)
            return;

        estado.conversaciones = [];

    }

    //----------------------------------------------------------
    // OBTENER CANTIDAD
    //----------------------------------------------------------

    obtenerCantidadConversaciones(estado) {

        if (!estado)
            return 0;

        if (!Array.isArray(estado.conversaciones))
            return 0;

        return estado.conversaciones.length;

    }

    //----------------------------------------------------------
    // EXISTE CONVERSACIÓN
    //----------------------------------------------------------

    existeConversacion(estado, id) {

        if (!estado)
            return false;

        if (!Array.isArray(estado.conversaciones))
            return false;

        return estado.conversaciones.some(

            c => c.id === id

        );

    }

}

module.exports = new StateSync();