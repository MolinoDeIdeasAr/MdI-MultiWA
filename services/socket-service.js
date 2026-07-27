'use strict';

//==============================================================
// SOCKET SERVICE
//==============================================================

class SocketService {

    //----------------------------------------------------------
    // EMITIR NUEVA CONVERSACIÓN
    //----------------------------------------------------------

    emitir(context, userSockets) {

        if (!context)
            return;

        if (!userSockets)
            return;

        if (!userSockets.has(context.userId))
            return;

        if (

            typeof context.toEstadoTemporal !== 'function'

        )

            return;

        const conversacion =

            context.toEstadoTemporal();

        const sockets =

            userSockets.get(

                context.userId

            );

        if (!sockets)
            return;

        for (const socket of sockets) {

            socket.emit(

                'nueva_respuesta',

                conversacion

            );

        }

    }

    //----------------------------------------------------------
    // EMITIR EVENTO PERSONALIZADO
    //----------------------------------------------------------

    emitirEvento(userSockets, userId, evento, datos) {

        if (!userSockets)
            return;

        if (!userSockets.has(userId))
            return;

        const sockets =

            userSockets.get(userId);

        if (!sockets)
            return;

        for (const socket of sockets) {

            socket.emit(

                evento,

                datos

            );

        }

    }

    //----------------------------------------------------------
    // EMITIR ERROR
    //----------------------------------------------------------

    emitirError(userSockets, userId, mensaje) {

        this.emitirEvento(

            userSockets,

            userId,

            'error',

            {

                mensaje,

                fecha:

                    new Date().toISOString()

            }

        );

    }

    //----------------------------------------------------------
    // BROADCAST
    //----------------------------------------------------------

    broadcast(io, evento, datos) {

        if (!io)
            return;

        io.emit(

            evento,

            datos

        );

    }

    //----------------------------------------------------------
    // EMITIR A UN SOCKET ESPECÍFICO
    //----------------------------------------------------------

    emitirASocket(socket, evento, datos) {

        if (!socket)
            return;

        socket.emit(

            evento,

            datos

        );

    }

    //----------------------------------------------------------
    // EMITIR A TODOS LOS SOCKETS DE UN USUARIO
    //----------------------------------------------------------

    emitirATodos(userSockets, userId, evento, datos) {

        this.emitirEvento(

            userSockets,

            userId,

            evento,

            datos

        );

    }

    //----------------------------------------------------------
    // DESCONECTAR SOCKETS DE UN USUARIO
    //----------------------------------------------------------

    desconectarUsuario(userSockets, userId) {

        if (!userSockets)
            return;

        if (!userSockets.has(userId))
            return;

        const sockets =

            userSockets.get(userId);

        if (!sockets)
            return;

        for (const socket of sockets) {

            try {

                socket.disconnect(true);

            }

            catch (err) {

                console.error(

                    'Error desconectando socket:',

                    err.message

                );

            }

        }

        userSockets.delete(userId);

    }

}

module.exports = new SocketService();