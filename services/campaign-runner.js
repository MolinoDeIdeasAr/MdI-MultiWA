/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-runner.js
 *
 * Runner de campañas
 * v3.0.0
 * =============================================================
 */

'use strict';

//==============================================================
// DEPENDENCIAS
//==============================================================

const sessionManager =

    require('./session-manager');

const {

    getEstadoInstancia,
    guardarEstadoSeguro

} = require('../state/estado');

const antiBan =

    require('../config/anti-baneo');

const {

    esBaja

} = require('./bajas');

const {

    procesarSpintax,
    simularEscrituraHumana

} = require('./formateo');


//==============================================================
// RESULTADOS
//==============================================================

const RESULTADO = {

    OK: 'OK',

    ERROR: 'ERROR',

    FINALIZADA: 'FINALIZADA',

    PAUSA: 'PAUSA',

    BAJA: 'BAJA'

};


//==============================================================
// RUN
//==============================================================

async function run(

    instanceId

) {

    const estado =

        getEstadoInstancia(

            instanceId

        );

    if (!estado) {

        return {

            tipo:

                RESULTADO.ERROR,

            motivo:

                'Estado inexistente'

        };

    }

    const client =

        sessionManager.getClient(

            instanceId

        );

    if (!client) {

        return {

            tipo:

                RESULTADO.ERROR,

            motivo:

                'Cliente no conectado'

        };

    }

    //----------------------------------------------------------
    // FIN DE CAMPAÑA
    //----------------------------------------------------------

    if (

        estado.actual >=

        estado.total

    ) {

        estado.enviando = false;

        estado.campanaFinalizada = true;

        guardarEstadoSeguro(

            instanceId

        );

        return {

            tipo:

                RESULTADO.FINALIZADA

        };

    }

    //----------------------------------------------------------
    // CONTACTO
    //----------------------------------------------------------

    const contacto =

        estado.contactosCargados[

            estado.actual

        ];

    if (!contacto) {

        return {

            tipo:

                RESULTADO.ERROR,

            motivo:

                'Contacto inexistente'

        };

    }

    //----------------------------------------------------------
    // EJECUTAR
    //----------------------------------------------------------

    return await ejecutarContacto(

        instanceId,

        client,

        estado,

        contacto

    );

}

//==============================================================
// EJECUTAR CONTACTO
//==============================================================

async function ejecutarContacto(

    instanceId,

    client,

    estado,

    contacto

) {

    //----------------------------------------------------------
    // BAJA
    //----------------------------------------------------------

    if (

        esBaja(

            contacto.numero

        )

    ) {

        estado.actual++;

        guardarEstadoSeguro(

            instanceId

        );

        return {

            tipo:

                RESULTADO.BAJA

        };

    }

    //----------------------------------------------------------
    // HORARIO
    //----------------------------------------------------------

    if (

        !antiBan.esHorarioValido()

    ) {

        return {

            tipo:

                RESULTADO.PAUSA,

            motivo:

                antiBan.obtenerMotivoPausa(

                    instanceId

                ),

            pausa:

                antiBan.obtenerTiempoRestante(

                    instanceId

                ) * 1000

        };

    }

    //----------------------------------------------------------
    // LÍMITES ANTIBAN
    //----------------------------------------------------------

    if (

        !antiBan.puedeEnviarMas(

            instanceId

        )

    ) {

        return {

            tipo:

                RESULTADO.PAUSA,

            motivo:

                antiBan.obtenerMotivoPausa(

                    instanceId

                ),

            pausa:

                antiBan.obtenerTiempoRestante(

                    instanceId

                ) * 1000

        };

    }

    //----------------------------------------------------------
    // CLIENTE SIGUE CONECTADO
    //----------------------------------------------------------

    try {

        const estadoCliente =

            await client.getState();

        if (

            estadoCliente !==

            'CONNECTED'

        ) {

            return {

                tipo:

                    RESULTADO.ERROR,

                motivo:

                    `WhatsApp ${estadoCliente}`

            };

        }

    }

    catch (err) {

        return {

            tipo:

                RESULTADO.ERROR,

            motivo:

                err.message

        };

    }

    //----------------------------------------------------------
    // CONTINUAR ENVÍO
    //----------------------------------------------------------

    return await enviarMensaje(

        instanceId,

        client,

        estado,

        contacto

    );

}

//==============================================================
// ENVIAR MENSAJE
//==============================================================

async function enviarMensaje(

    instanceId,

    client,

    estado,

    contacto

) {

    try {

        //------------------------------------------------------
        // VALIDAR MENSAJES
        //------------------------------------------------------

        const mensajes =

            (estado.mensajesGuardados || [])

                .filter(Boolean);

        if (

            mensajes.length === 0

        ) {

            return {

                tipo:

                    RESULTADO.ERROR,

                motivo:

                    'No hay mensajes cargados'

            };

        }

        //------------------------------------------------------
        // OBTENER CHAT
        //------------------------------------------------------

        const chat =

            await client.getNumberId(

                contacto.numero

            );

        if (!chat) {

            estado.actual++;

            estado.fallidos.push({

                nombre:

                    contacto.nombre,

                numero:

                    contacto.numero,

                motivo:

                    'Número inexistente'

            });

            guardarEstadoSeguro(

                instanceId

            );

            return {

                tipo:

                    RESULTADO.ERROR,

                motivo:

                    'Número inexistente'

            };

        }

        const destino =

            chat._serialized ||

            `${chat.user}@${chat.server}`;

        //------------------------------------------------------
        // MENSAJE
        //------------------------------------------------------

        const texto =

            procesarSpintax(

                mensajes[

                    Math.floor(

                        Math.random() *

                        mensajes.length

                    )

                ]

            );

        //------------------------------------------------------
        // ESCRITURA HUMANA
        //------------------------------------------------------

        await simularEscrituraHumana(

            client,

            destino,

            texto

        );

        //------------------------------------------------------
        // IMAGEN
        //------------------------------------------------------

        if (

            estado.imagenGuardada

        ) {

            const {

                MessageMedia

            } = require(

                'whatsapp-web.js'

            );

            const path =

                require('path');

            const fs =

                require('fs');

            const archivo =

                path.join(

                    __dirname,

                    '..',

                    'uploads',

                    estado.imagenGuardada

                );

            if (

                fs.existsSync(

                    archivo

                )

            ) {

                const media =

                    MessageMedia.fromFilePath(

                        archivo

                    );

                await client.sendMessage(

                    destino,

                    media,

                    {

                        caption:

                            texto

                    }

                );

            }

            else {

                await client.sendMessage(

                    destino,

                    texto

                );

            }

        }

        //------------------------------------------------------
        // SOLO TEXTO
        //------------------------------------------------------

        else {

            await client.sendMessage(

                destino,

                texto

            );

        }

        //------------------------------------------------------
        // AUDIO
        //------------------------------------------------------

        if (

            estado.audioGuardado

        ) {

            const {

                MessageMedia

            } = require(

                'whatsapp-web.js'

            );

            const path =

                require('path');

            const fs =

                require('fs');

            const archivo =

                path.join(

                    __dirname,

                    '..',

                    'uploads',

                    estado.audioGuardado

                );

            if (

                fs.existsSync(

                    archivo

                )

            ) {

                const media =

                    MessageMedia.fromFilePath(

                        archivo

                    );

                await client.sendMessage(

                    destino,

                    media,

                    {

                        sendAudioAsVoice: true

                    }

                );

            }

        }

        //------------------------------------------------------
        // ACTUALIZAR CONTADORES
        //------------------------------------------------------

        estado.actual++;

        estado.enviadosOk++;

        antiBan.incrementarMensajesHoy(

            instanceId

        );

        antiBan.actualizarUltimoEnvio(

            instanceId

        );

        guardarEstadoSeguro(

            instanceId

        );

        //------------------------------------------------------
        // RESULTADO
        //------------------------------------------------------

        return {

            tipo:

                RESULTADO.OK,

            contacto,

            pausa:

                antiBan.getPausaAleatoria(

                    instanceId

                )

        };

    }

    catch (err) {

        //------------------------------------------------------
        // ERROR
        //------------------------------------------------------

        estado.actual++;

        estado.fallidos.push({

            nombre:

                contacto.nombre,

            numero:

                contacto.numero,

            motivo:

                err.message

        });

        guardarEstadoSeguro(

            instanceId

        );

        return {

            tipo:

                RESULTADO.ERROR,

            motivo:

                err.message,

            contacto

        };

    }

}


//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    run,

    RESULTADO

};