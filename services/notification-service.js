'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const fs = require('fs');
const path = require('path');

const crmFlow = require('./crm-flow');

//==============================================================
// NOTIFICATION SERVICE
//==============================================================

class NotificationService {

    //----------------------------------------------------------
    // NOTIFICAR
    //----------------------------------------------------------

    async notificar(context) {

        if (!context.debeNotificarAsesor)
            return;

        //----------------------------------------------
        // Buscar usuario
        //----------------------------------------------

        const usersFile = path.join(

            __dirname,

            '..',

            'users.json'

        );

        if (!fs.existsSync(usersFile))
            return;

        const users = JSON.parse(

            fs.readFileSync(

                usersFile,

                'utf8'

            )

        );

        const usuario = users.find(

            u => u.id === context.userId

        );

        if (!usuario)
            return;

        //----------------------------------------------
        // Número destino
        //----------------------------------------------

        const telefono =

            String(

                usuario.notificacion || ''

            ).replace(/\D/g, '');

        if (!telefono)
            return;

        let destino =

            `${telefono}@c.us`;

        try {

            const chat =

                await context.client.getNumberId(

                    telefono

                );

            if (chat) {

                destino =

                    chat._serialized ||

                    chat;

            }

        }
        catch (err) {

            console.log(

                'No se pudo resolver chatId del asesor.'

            );

        }

        //----------------------------------------------
        // Enviar mensaje
        //----------------------------------------------

        await this.enviarAviso(

            context,

            destino

        );

    }

    //----------------------------------------------------------
    // ENVIAR AVISO
    //----------------------------------------------------------

    async enviarAviso(context, destino) {

        const mensaje =

`📩 *Nuevo mensaje recibido*

👤 ${context.nombre}

📱 ${context.numero}

💬 "${context.texto}"

🧠 Estado IA:
${context.estadoIA}

🎯 Intención:
${context.intencionIA}
`;

        try {

            await context.client.sendMessage(

                destino,

                mensaje

            );

            console.log(

                `🔔 Asesor notificado (${context.numero})`

            );

            //------------------------------------------
            // Registrar evento en CRM
            //------------------------------------------

            if (typeof crmFlow.registrarEvento === 'function') {

                crmFlow.registrarEvento(

                    context.numero,

                    {

                        tipo: 'NOTIFICACION',

                        descripcion: 'Se notificó al asesor.',

                        fecha: new Date().toISOString()

                    }

                );

            }

        }
        catch (err) {

            console.error(

                'Error notificando al asesor:',

                err.message

            );

            //------------------------------------------
            // Registrar error en CRM
            //------------------------------------------

            if (typeof crmFlow.registrarEvento === 'function') {

                crmFlow.registrarEvento(

                    context.numero,

                    {

                        tipo: 'ERROR_NOTIFICACION',

                        descripcion: err.message,

                        fecha: new Date().toISOString()

                    }

                );

            }

        }

    }

}

module.exports = new NotificationService();

