'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-runner.js
 *
 * Runner de campañas
 *
 * v1.2.0
 *
 * RESPONSABILIDAD:
 *   - Procesar un único contacto por ejecución.
 *   - Enviar mensaje.
 *   - Actualizar estado.
 *   - Devolver resultado.
 *
 * CHANGELOG v1.2.0:
 *  • FIX CRÍTICO: {NOMBRE} en el mensaje nunca se reemplazaba
 *    por el nombre real del contacto — procesarSpintax() lo
 *    trataba como spintax de una sola opción y devolvía el
 *    texto literal "NOMBRE". Ya existía obtenerNombre(contacto)
 *    en este archivo pero no se llamaba desde ningún lado. Se
 *    agregó reemplazarVariables() (NOMBRE y NUMERO) y se aplica
 *    ANTES de procesarSpintax en el envío de campaña.
 *
 * CHANGELOG v1.1.0:
 *  • FIX CRÍTICO: run() usaba la variable "client" en el chequeo
 *    "¿cliente listo?" ANTES de la línea que la declaraba
 *    (const client = sessionManager.getClient(instanceId), 50
 *    líneas más abajo). Por la zona muerta temporal de const/let
 *    en JS, esto tiraba "ReferenceError: Cannot access 'client'
 *    before initialization" en cada ejecución — el runner nunca
 *    llegaba a enviar un mensaje. Se movió el chequeo a después
 *    de obtener el cliente real.
 * =============================================================
 */

//==============================================================
// DEPENDENCIAS
//==============================================================

const sessionManager = require('./session-manager');

const fs = require('fs');

const path = require('path');

const {

    MessageMedia

} = require('whatsapp-web.js');

const antiBan = require('../config/anti-baneo');

const { esBaja } = require('./bajas');

const {

    formatearNumeroWhatsApp,

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

    OK: "OK",

    PAUSA: "PAUSA",

    BAJA: "BAJA",

    FINALIZADA: "FINALIZADA",

    ERROR: "ERROR"

};

//==============================================================
// RUN
//==============================================================

async function run(instanceId){

    //----------------------------------------------------------
    // Estado
    //----------------------------------------------------------

    const estado = getEstadoInstancia(instanceId);

console.log("====================================");
console.log("RUNNER");
console.log("instance:", instanceId);
console.log("actual:", estado.actual);
console.log("total:", estado.total);
console.log("contactos:", estado.contactosCargados?.length);

if (estado.contactosCargados?.length) {
    console.log("primer contacto:");
    console.log(estado.contactosCargados[0]);
}

console.log("====================================");

    if(!estado){

        return {

            tipo: RESULTADO.ERROR,

            motivo: "Estado inexistente"

        };

    }

    //----------------------------------------------------------
    // Cliente
    //----------------------------------------------------------

    const client = sessionManager.getClient(instanceId);

    if(!client){

        return {

            tipo: RESULTADO.ERROR,

            motivo: "Cliente no conectado"

        };

    }

    //----------------------------------------------------------
    // Cliente listo (terminó de autenticar)
    //----------------------------------------------------------

    if (!client.info || !client.info.wid) {

        console.log("⏳ Cliente aún no terminó de iniciar.");

        return {

            tipo: RESULTADO.PAUSA,

            pausa: 3000

        };

    }

    //----------------------------------------------------------
    // Lista vacía
    //----------------------------------------------------------

    if(

        !Array.isArray(estado.contactosCargados)

        ||

        estado.contactosCargados.length===0

    ){

        return {

            tipo: RESULTADO.ERROR,

            motivo:"No hay contactos"

        };

    }

    //----------------------------------------------------------
    // Campaña finalizada
    //----------------------------------------------------------

    if(

        estado.actual >= estado.contactosCargados.length

    ){

        estado.enviando = false;

        estado.campanaFinalizada = true;

        guardarEstadoSeguro(instanceId);

        return {

            tipo: RESULTADO.FINALIZADA

        };

    }

    //----------------------------------------------------------
    // Contacto actual
    //----------------------------------------------------------

    const contacto =

        estado.contactosCargados[estado.actual];

console.log("Índice:", estado.actual);
console.log("Contacto:", estado.contactosCargados[estado.actual]);

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

){

    console.log("=== procesarContacto ===");

    //----------------------------------------------------------
    // Validar contacto
    //----------------------------------------------------------

    if(!contacto){

        console.log("❌ contacto null");

        return {

            tipo: RESULTADO.ERROR,

            motivo: "Contacto inexistente"

        };

    }

    console.log("✅ contacto OK");

    //----------------------------------------------------------
    // Número
    //----------------------------------------------------------

    // FIX CRÍTICO: acá solo se limpiaban los caracteres no
    // numéricos, pero nunca se aplicaba formatearNumeroWhatsApp()
    // (que agrega 549 y saca el 0 inicial + el "15" de marcación
    // móvil local). Un número cargado en formato local, ej.
    // "0351152074696", se pasaba tal cual a client.getNumberId()
    // más abajo, que necesita el formato internacional puro.
    // WhatsApp no lo reconocía y TODOS los envíos con números en
    // formato local caían como "Número inexistente" / fallido,
    // aunque el número fuera válido.
    const numero = formatearNumeroWhatsApp(

        contacto.numero ||

        contacto.NUMERO ||

        ""

    );

    console.log("Número:", numero);

    if(!numero){

        console.log("❌ número inválido");

        return marcarError(

            instanceId,

            estado,

            contacto,

            "Número inválido"

        );

    }

    console.log("✅ número válido");

    //----------------------------------------------------------
    // Baja
    //----------------------------------------------------------

    console.log("Chequeando baja...");

    if(esBaja(numero)){

        console.log("⚠ Está en bajas");

        contacto.estadoEnvio = "baja";

        contacto.fechaEnvio =

            new Date().toISOString();

        estado.actual++;

        guardarEstadoSeguro(instanceId);

        return {

            tipo: RESULTADO.BAJA

        };

    }

    console.log("✅ No está en bajas");

    //----------------------------------------------------------
    // Horario permitido
    //----------------------------------------------------------

    console.log("Chequeando horario...");

    const horarioOK = antiBan.esHorarioValido();

    console.log("Horario:", horarioOK,
        "| Hora que ve Node:", new Date().getHours() + "hs",
        "| Fecha/hora completa:", new Date().toString());

    if(!horarioOK){

        console.log("⏸ Bloqueado por horario");

        return {

            tipo: RESULTADO.PAUSA,

            motivo:

                antiBan.obtenerMotivoPausa(instanceId),

            pausa:

                antiBan.obtenerTiempoRestante(instanceId) * 1000

        };

    }

    console.log("✅ Horario permitido");

    //----------------------------------------------------------
    // Límites antiban
    //----------------------------------------------------------

    console.log("Chequeando límites...");

    const puedeEnviar = antiBan.puedeEnviarMas(instanceId);

    console.log("puedeEnviar =", puedeEnviar,
        "| MAX_MENSAJES_HORA:", antiBan.CONFIG.MAX_MENSAJES_HORA,
        "| MAX_MENSAJES_DIA:", antiBan.CONFIG.MAX_MENSAJES_DIA);

    if(!puedeEnviar){

        console.log("⏸ Límite antiban alcanzado:", antiBan.obtenerMotivoPausa(instanceId));

        return {

            tipo: RESULTADO.PAUSA,

            motivo:

                antiBan.obtenerMotivoPausa(instanceId),

            pausa:

                antiBan.obtenerTiempoRestante(instanceId) * 1000

        };

    }

    console.log("✅ Límite OK");

    //----------------------------------------------------------
    // Cliente conectado
    //----------------------------------------------------------

    console.log("ANTES getState");

    try{

        console.log("typeof getState =", typeof client.getState);

        if(typeof client.getState==="function"){

            const estadoWA = await client.getState();

            console.log("Estado WA =", estadoWA);

            if(

                estadoWA==="UNPAIRED" ||

                estadoWA==="UNPAIRED_IDLE" ||

                estadoWA==="CONFLICT"

            ){

                console.log("❌ Estado WA inválido");

                return {

                    tipo: RESULTADO.ERROR,

                    motivo:`WhatsApp ${estadoWA}`

                };

            }

        }else{

            console.log("⚠ client.getState NO existe");

        }

    }

    catch(err){

        console.log("⚠ Error getState");

        console.log(err);

    }

    console.log("DESPUÉS getState");

    //----------------------------------------------------------
    // Enviar
    //----------------------------------------------------------

    console.log("➡ Llamando enviarMensaje()");

    return await enviarMensaje(

        instanceId,

        client,

        estado,

        contacto,

        numero

    );

}

//==============================================================
// ENVIAR MENSAJE
//==============================================================

async function enviarMensaje(

    instanceId,

    client,

    estado,

    contacto,

    numero

){

    try{

        //------------------------------------------------------
        // Obtener Chat
        //------------------------------------------------------

        console.log(`📤 Enviando a ${numero}...`);

        const chat = await client.getNumberId(numero);

        if(!chat){

            return marcarError(

                instanceId,

                estado,

                contacto,

                "Número inexistente"

            );

        }

        const destino =

            chat._serialized ||

            `${chat.user}@${chat.server}`;

        console.log(`✅ Chat ID: ${destino}`);

        //------------------------------------------------------
        // Seleccionar mensaje
        //------------------------------------------------------

        const mensajes =

            (estado.mensajesGuardados || [])

            .filter(Boolean);

        if(mensajes.length===0){

            return {

                tipo: RESULTADO.ERROR,

                motivo:"No hay mensajes cargados"

            };

        }

        const texto = procesarSpintax(

            reemplazarVariables(

                mensajes[

                    Math.floor(

                        Math.random() *

                        mensajes.length

                    )

                ],

                contacto

            )

        );

        //------------------------------------------------------
        // Simular escritura
        //------------------------------------------------------

        await simularEscrituraHumana(

            client,

            destino,

            texto

        );

        //------------------------------------------------------
        // Imagen
        //------------------------------------------------------

        //------------------------------------------------------
        // Opciones de envío: vista previa de enlaces
        //------------------------------------------------------
        // estado.linkPreviewActivo viene del checkbox de la interfaz.
        // Si está en false, WhatsApp manda el link SIN tarjeta
        // (sin imagen, sin título, sin descripción) — esto reduce
        // mucho el riesgo de ban cuando el mensaje lleva URLs.
        // Por defecto (si el flag no existe) dejamos preview ON
        // para no cambiar el comportamiento histórico.
        //------------------------------------------------------
        const opcionesEnvio = {
            linkPreview: false
        };

        if(estado.imagenGuardada){
            const archivo = path.join(
                __dirname, "..", "uploads",
                estado.imagenGuardada
            );
            if(fs.existsSync(archivo)){
                const media = MessageMedia.fromFilePath(archivo);
                // Si hay imagen, la preview del caption también se controla
                await client.sendMessage(destino, media, {
                    caption: texto,
                    linkPreview: opcionesEnvio.linkPreview
                });
            } else {
                await client.sendMessage(destino, texto, opcionesEnvio);
            }
        } else {
            await client.sendMessage(destino, texto, opcionesEnvio);
        }

        //------------------------------------------------------
        // OK
        //------------------------------------------------------

        return marcarExito(

            instanceId,

            estado,

            contacto,

            destino

        );

    }

    catch(err){

        return marcarError(

            instanceId,

            estado,

            contacto,

            err.message

        );

    }

}

//==============================================================
// MARCAR ÉXITO
//==============================================================

function marcarExito(

    instanceId,

    estado,

    contacto,

    chatId

){

    contacto.estadoEnvio = "enviado";

    contacto.fechaEnvio =

        new Date().toISOString();

    // Guardamos el chatId real de WhatsApp (puede ser @c.us o
    // @lid según cómo lo exponga WhatsApp para este contacto)
    // junto al contacto de la planilla. Así, cuando responda —
    // hoy o dentro de 6 meses — resolverContacto() lo reconoce
    // por chatIdEnviado de una, sin depender de que WhatsApp nos
    // devuelva el número real (con @lid a veces ni el propio
    // WhatsApp lo expone, es una limitación de privacidad).
    if(chatId){

        contacto.chatIdEnviado = chatId;

    }

    estado.actual++;

    estado.enviadosOk++;

    estado.enviando = true;

    estado.campanaFinalizada = false;

    antiBan.incrementarMensajesHoy(

        instanceId

    );

    // FIX: faltaba esta llamada — sin ella, el límite de
    // mensajes-por-hora (MAX_MENSAJES_HORA) nunca se aplicaba de
    // verdad, porque puedeEnviarMas() siempre veía el contador
    // horario en 0.
    antiBan.incrementarMensajesHora(

        instanceId

    );

    antiBan.actualizarUltimoEnvio(

        instanceId

    );

    guardarEstadoSeguro(

        instanceId

    );

    console.log(

        `✅ Enviado (${estado.actual}/${estado.contactosCargados.length})`

    );

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
// MARCAR ERROR
//==============================================================

function marcarError(

    instanceId,

    estado,

    contacto,

    motivo

){

    contacto.estadoEnvio = "fallido";

    contacto.fechaEnvio =

        new Date().toISOString();

    contacto.error = motivo;

    if(

        !Array.isArray(

            estado.fallidos

        )

    ){

        estado.fallidos = [];

    }

    estado.fallidos.push({

        nombre:

            contacto.nombre ||

            contacto.NOMBRE ||

            "",

        numero:

            contacto.numero ||

            contacto.NUMERO ||

            "",

        motivo

    });

    estado.actual++;

    if(

        estado.actual >=

        estado.contactosCargados.length

    ){

        estado.enviando = false;

        estado.campanaFinalizada = true;

    }

    guardarEstadoSeguro(

        instanceId

    );

    console.error(

        `❌ ${motivo}`

    );

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

function normalizarNumero(numero){

    if(

        numero === null ||

        numero === undefined

    ){

        return "";

    }

    return String(numero)

        .replace(/\D/g,"")

        .trim();

}

//==============================================================

function obtenerNumero(contacto){

    return normalizarNumero(

        contacto.numero ||

        contacto.NUMERO ||

        contacto.Numero ||

        ""

    );

}

//==============================================================

function obtenerNombre(contacto){

    return (

        contacto.nombre ||

        contacto.NOMBRE ||

        contacto.Nombre ||

        ""

    );

}

//==============================================================
// REEMPLAZAR VARIABLES ({NOMBRE}, {NUMERO}) EN EL MENSAJE
//==============================================================
//
// obtenerNombre() ya existía pero nunca se llamaba desde ningún
// lado — no había ningún paso que reemplazara {NOMBRE} por el
// nombre real del contacto. procesarSpintax() se comía {NOMBRE}
// como si fuera un bloque de spintax de una sola opción y
// devolvía el texto literal "NOMBRE". Por eso hay que reemplazar
// las variables ANTES de procesarSpintax, nunca después.
//==============================================================

function reemplazarVariables(texto, contacto){

    if(!texto){

        return texto;

    }

    const nombre =

        obtenerNombre(contacto) || '';

    const numero =

        contacto.numero ||

        contacto.NUMERO ||

        '';

    return texto

        .replace(

            /\{NOMBRE\}/gi,

            nombre

        )

        .replace(

            /\{NUMERO\}/gi,

            numero

        );

}

//==============================================================

function obtenerMensajeAleatorio(mensajes){

    const lista =

        (mensajes || [])

        .filter(Boolean);

    if(lista.length===0){

        return "";

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

function marcarContacto(

    contacto,

    estado,

    motivo=""

){

    contacto.estadoEnvio = estado;

    contacto.fechaEnvio =

        new Date().toISOString();

    if(motivo){

        contacto.error = motivo;

    }

}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {

    run,

    RESULTADO,

    normalizarNumero,

    obtenerNumero,

    obtenerNombre,

    obtenerMensajeAleatorio,

    marcarContacto

};