'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-runner.js
 *
 * v4.0.0
 *
 * Runner único de campañas
 *
 * RESPONSABILIDAD:
 *  • Procesar UN SOLO contacto por ejecución.
 *  • No maneja timers.
 *  • No maneja scheduler.
 *  • No maneja monitor.
 *  • No inicia campañas.
 *  • No detiene campañas.
 * =============================================================
 */

//==============================================================
// DEPENDENCIAS
//==============================================================

const sessionManager =
    require('./session-manager');

const antiBan =
    require('../config/anti-baneo');

const {

    esBaja

} = require('./bajas');

const {

    procesarSpintax,
    simularEscrituraHumana

} = require('./formateo');

const {

    getEstadoInstancia,
    guardarEstadoSeguro

} = require('../state/estado');

//==============================================================
// RESULTADOS
//==============================================================

const RESULTADO = {

    OK: 'OK',

    PAUSA: 'PAUSA',

    BAJA: 'BAJA',

    FINALIZADA: 'FINALIZADA',

    ERROR: 'ERROR'

};

//==============================================================
// RUN
//==============================================================

async function run(instanceId) {

    //----------------------------------------------------------
    // ESTADO
    //----------------------------------------------------------

    const estado =
        getEstadoInstancia(instanceId);

    if (!estado) {

        return {

            tipo: RESULTADO.ERROR,

            motivo: 'Estado inexistente'

        };

    }

    //----------------------------------------------------------
    // CLIENTE
    //----------------------------------------------------------

    const client =
        sessionManager.getClient(instanceId);

    if (!client) {

        return {

            tipo: RESULTADO.ERROR,

            motivo: 'Cliente WhatsApp no conectado'

        };

    }

    //----------------------------------------------------------
    // CAMPAÑA FINALIZADA
    //----------------------------------------------------------

    if (

        estado.actual >= estado.total

    ) {

        estado.enviando = false;

        estado.campanaFinalizada = true;

        guardarEstadoSeguro(instanceId);

        return {

            tipo: RESULTADO.FINALIZADA

        };

    }

    //----------------------------------------------------------
    // CONTACTO ACTUAL
    //----------------------------------------------------------

    const contacto =

        estado.contactosCargados[

            estado.actual

        ];

    if (!contacto) {

        return {

            tipo: RESULTADO.ERROR,

            motivo: 'Contacto inexistente'

        };

    }

    //----------------------------------------------------------
    // PROCESAR CONTACTO
    //----------------------------------------------------------

    return await procesarContacto(

        instanceId,

        client,

        estado,

        contacto

    );

}

//==============================================================
// PROCESAR CONTACTO
//==============================================================

async function procesarContacto(

    instanceId,

    client,

    estado,

    contacto

) {

    //----------------------------------------------------------
    // BAJA
    //----------------------------------------------------------

    if (

        esBaja(contacto.numero)

    ) {

        contacto.estadoEnvio = 'baja';

        contacto.fechaEnvio =

            new Date().toISOString();

        estado.actual++;

        guardarEstadoSeguro(

            instanceId

        );

        return {

            tipo: RESULTADO.BAJA

        };

    }

    //----------------------------------------------------------
    // HORARIO PERMITIDO
    //----------------------------------------------------------

    if (

        !antiBan.esHorarioValido()

    ) {

        return {

            tipo: RESULTADO.PAUSA,

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

            tipo: RESULTADO.PAUSA,

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
    // ESTADO DEL CLIENTE
    //----------------------------------------------------------

    try {

        const estadoWA =

            await client.getState();

        if (

            estadoWA !== 'CONNECTED'

        ) {

            return {

                tipo: RESULTADO.ERROR,

                motivo:

                    `WhatsApp ${estadoWA}`

            };

        }

    }

    catch(err){

        return {

            tipo: RESULTADO.ERROR,

            motivo: err.message

        };

    }

    //----------------------------------------------------------
    // ENVIAR
    //----------------------------------------------------------

    return await enviarTextoYMultimedia(

        instanceId,

        client,

        estado,

        contacto

    );

}

//==============================================================
// ENVIAR TEXTO + MULTIMEDIA
//==============================================================

async function enviarTextoYMultimedia(

    instanceId,

    client,

    estado,

    contacto

) {

    try {

        //------------------------------------------------------
        // MENSAJES DISPONIBLES
        //------------------------------------------------------

        const mensajes =

            (estado.mensajesGuardados || [])

                .filter(Boolean);

        if (

            mensajes.length === 0

        ) {

            return {

                tipo: RESULTADO.ERROR,

                motivo: 'No hay mensajes cargados'

            };

        }

        //------------------------------------------------------
        // NÚMERO
        //------------------------------------------------------

        const numero =

            String(

                contacto.numero ||

                contacto.NUMERO ||

                ''

            ).replace(/\D/g,'');

        if (!numero) {

            return {

                tipo: RESULTADO.ERROR,

                motivo:'Número inválido'

            };

        }

        console.log(

            `📤 Enviando a ${numero}...`

        );

        //------------------------------------------------------
        // CHAT
        //------------------------------------------------------

        const chat =

            await client.getNumberId(numero);

        if (!chat) {

            return actualizarEstadoError(

                instanceId,

                estado,

                contacto,

                numero,

                'Número inexistente'

            );

        }

        const destino =

            chat._serialized ||

            `${chat.user}@${chat.server}`;

        console.log(

            `✅ Chat ID: ${destino}`

        );

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
        // ENVIAR TEXTO O IMAGEN
        //------------------------------------------------------

        if (

            estado.imagenGuardada

        ) {

            const {

                MessageMedia

            } = require(

                'whatsapp-web.js'

            );

            const fs = require('fs');

            const path = require('path');

            const archivo =

                path.join(

                    __dirname,

                    '..',

                    'uploads',

                    estado.imagenGuardada

                );

            if (

                fs.existsSync(archivo)

            ) {

                const media =

                    MessageMedia.fromFilePath(

                        archivo

                    );

                await client.sendMessage(

                    destino,

                    media,

                    {

                        caption:texto

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

        else {

            await client.sendMessage(

                destino,

                texto

            );

        }

        //------------------------------------------------------
        // AUDIO (SI EXISTE)
        //------------------------------------------------------

        if (

            estado.audioGuardado

        ) {

            const {

                MessageMedia

            } = require(

                'whatsapp-web.js'

            );

            const fs = require('fs');

            const path = require('path');

            const archivo =

                path.join(

                    __dirname,

                    '..',

                    'uploads',

                    estado.audioGuardado

                );

            if (

                fs.existsSync(archivo)

            ) {

                const media =

                    MessageMedia.fromFilePath(

                        archivo

                    );

                await client.sendMessage(

                    destino,

                    media,

                    {

                        sendAudioAsVoice:true

                    }

                );

            }

        }

        //------------------------------------------------------
        // ACTUALIZAR ÉXITO
        //------------------------------------------------------

        return actualizarEstadoExito(

            instanceId,

            estado,

            contacto

        );

    }

    catch(err){

        return actualizarEstadoError(

            instanceId,

            estado,

            contacto,

            contacto.numero,

            err.message

        );

    }

}

//==============================================================
// ACTUALIZAR ESTADO (ÉXITO)
//==============================================================

function actualizarEstadoExito(

    instanceId,

    estado,

    contacto

) {

    //----------------------------------------------------------
    // CONTACTO
    //----------------------------------------------------------

    contacto.estadoEnvio = 'enviado';

    contacto.fechaEnvio =

        new Date().toISOString();

    //----------------------------------------------------------
    // CONTADORES
    //----------------------------------------------------------

    estado.actual++;

    estado.enviadosOk++;

    //----------------------------------------------------------
    // BANDERAS
    //----------------------------------------------------------

    estado.enviando = true;

    estado.campanaFinalizada = false;

    //----------------------------------------------------------
    // ANTIBAN
    //----------------------------------------------------------

    antiBan.incrementarMensajesHoy(

        instanceId

    );

    antiBan.actualizarUltimoEnvio(

        instanceId

    );

    //----------------------------------------------------------
    // GUARDAR
    //----------------------------------------------------------

    guardarEstadoSeguro(

        instanceId

    );

    console.log(

        `✅ Enviado (${estado.actual}/${estado.total}) -> ${contacto.numero}`

    );

    //----------------------------------------------------------
    // RESPUESTA
    //----------------------------------------------------------

    return {

        tipo: RESULTADO.OK,

        pausa:

            antiBan.getPausaAleatoria(

                instanceId

            ),

        contacto

    };

}

//==============================================================
// ACTUALIZAR ESTADO (ERROR)
//==============================================================

function actualizarEstadoError(

    instanceId,

    estado,

    contacto,

    numero,

    motivo

) {

    //----------------------------------------------------------
    // CONTACTO
    //----------------------------------------------------------

    contacto.estadoEnvio = 'fallido';

    contacto.fechaEnvio =

        new Date().toISOString();

    contacto.error = motivo;

    //----------------------------------------------------------
    // LISTA DE FALLIDOS
    //----------------------------------------------------------

    estado.fallidos.push({

        nombre:

            contacto.nombre ||

            contacto.NOMBRE ||

            '',

        numero,

        motivo

    });

    //----------------------------------------------------------
    // CONTADORES
    //----------------------------------------------------------

    estado.actual++;

    //----------------------------------------------------------
    // SI TERMINÓ LA LISTA
    //----------------------------------------------------------

    if (

        estado.actual >= estado.total

    ) {

        estado.enviando = false;

        estado.campanaFinalizada = true;

    }

    //----------------------------------------------------------
    // GUARDAR
    //----------------------------------------------------------

    guardarEstadoSeguro(

        instanceId

    );

    console.error(

        `❌ Error (${estado.actual}/${estado.total}) -> ${numero}`

    );

    console.error(

        motivo

    );

    //----------------------------------------------------------
    // IMPORTANTE:
    // NO DETENER LA CAMPAÑA.
    // CONTINUAR CON EL SIGUIENTE CONTACTO.
    //----------------------------------------------------------

    return {

        tipo: RESULTADO.OK,

        pausa:

            antiBan.getPausaAleatoria(

                instanceId

            )

    };

}

//==============================================================
// HELPERS
//==============================================================

function normalizarNumero(numero) {

    if (

        numero === null ||

        numero === undefined

    ) {

        return '';

    }

    return String(numero)

        .replace(/\D/g, '')

        .trim();

}

//==============================================================
// MARCAR CONTACTO
//==============================================================

function marcarContacto(

    contacto,

    estado,

    motivo = ''

) {

    contacto.estadoEnvio = estado;

    contacto.fechaEnvio =

        new Date().toISOString();

    if (motivo) {

        contacto.error = motivo;

    }

}

//==============================================================
// OBTENER NOMBRE
//==============================================================

function obtenerNombre(contacto) {

    return (

        contacto.nombre ||

        contacto.NOMBRE ||

        contacto.Nombre ||

        ''

    );

}

//==============================================================
// OBTENER NÚMERO
//==============================================================

function obtenerNumero(contacto) {

    return normalizarNumero(

        contacto.numero ||

        contacto.NUMERO ||

        contacto.Numero ||

        ''

    );

}

//==============================================================
// SELECCIONAR MENSAJE ALEATORIO
//==============================================================

function obtenerMensajeAleatorio(

    mensajes

) {

    const lista =

        (mensajes || [])

        .filter(Boolean);

    if (

        lista.length === 0

    ) {

        return '';

    }

    return procesarSpintax(

        lista[

            Math.floor(

                Math.random() *

                lista.length

            )

        ]

    );

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    run,

    RESULTADO,

    // Helpers exportados para testing
    normalizarNumero,

    obtenerNumero,

    obtenerNombre,

    obtenerMensajeAleatorio,

    marcarContacto

};

//==============================================================
// FINALIZAR CAMPAÑA
//==============================================================

function finalizarCampaña(

    instanceId,

    estado

) {

    //----------------------------------------------------------
    // ESTADO
    //----------------------------------------------------------

    estado.enviando = false;

    estado.pausado = false;

    estado.campanaFinalizada = true;

    //----------------------------------------------------------
    // LIMPIAR TEMPORALES
    //----------------------------------------------------------

    estado.contactoActual = null;

    estado.mensajeActual = null;

    //----------------------------------------------------------
    // GUARDAR
    //----------------------------------------------------------

    guardarEstadoSeguro(

        instanceId

    );

    //----------------------------------------------------------
    // LOG
    //----------------------------------------------------------

    console.log('');

    console.log(

        '========================================'

    );

    console.log(

        '✅ CAMPAÑA FINALIZADA'

    );

    console.log(

        `Instancia : ${instanceId}`

    );

    console.log(

        `Total     : ${estado.total}`

    );

    console.log(

        `Enviados  : ${estado.enviadosOk}`

    );

    console.log(

        `Fallidos  : ${estado.fallidos.length}`

    );

    console.log(

        '========================================'

    );

    console.log('');

    //----------------------------------------------------------
    // RESPUESTA
    //----------------------------------------------------------

    return {

        tipo: RESULTADO.FINALIZADA,

        enviados:

            estado.enviadosOk,

        fallidos:

            estado.fallidos.length,

        total:

            estado.total

    };

}

//==============================================================
// OBTENER NÚMERO
//==============================================================

function obtenerNumero(

    contacto

) {

    const numero =

        String(

            contacto.numero ||

            contacto.NUMERO ||

            ''

        )

        .replace(/\D/g, '');

    return numero;

}

//==============================================================
// MARCAR CONTACTO
//==============================================================

function marcarContacto(

    contacto,

    estado

) {

    contacto.estadoEnvio = estado;

    contacto.fechaEnvio =

        new Date().toISOString();

}

//==============================================================
// LIMPIAR CAMPOS TEMPORALES
//==============================================================

function limpiarTemporales(

    contacto

) {

    delete contacto.__chatId;

    delete contacto.__numero;

}

//==============================================================
// LOG ENVÍO
//==============================================================

function logEnvio(

    contacto,

    mensaje

) {

    console.log('');

    console.log(

        '========================================'

    );

    console.log(

        `👤 ${contacto.nombre || contacto.NOMBRE || '-'}`

    );

    console.log(

        `📱 ${contacto.numero || contacto.NUMERO || '-'}`

    );

    console.log(

        `💬 ${mensaje.substring(0,80)}${mensaje.length>80?'...':''}`

    );

    console.log(

        '========================================'

    );

    console.log('');

}

//==============================================================
// LOG ERROR
//==============================================================

function logError(

    contacto,

    motivo

) {

    console.log('');

    console.log(

        '========================================'

    );

    console.error(

        `❌ ${contacto.numero || contacto.NUMERO || '-'}`

    );

    console.error(

        motivo

    );

    console.log(

        '========================================'

    );

    console.log('');

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    //----------------------------------------------------------
    // RUNNER
    //----------------------------------------------------------

    run,

    //----------------------------------------------------------
    // RESULTADOS
    //----------------------------------------------------------

    RESULTADO,

    //----------------------------------------------------------
    // HELPERS
    //----------------------------------------------------------

    obtenerContactoActual,

    validarContacto,

    validarHorario,

    prepararMensaje,

    seleccionarMensajeAleatorio,

    enviarContacto,

    enviarTextoOImagen,

    enviarAudio,

    registrarExito,

    registrarError,

    finalizarCampaña,

    obtenerNumero,

    marcarContacto,

    limpiarTemporales,

    logEnvio,

    logError

};