'use strict';

/**
 * =============================================================
 * MdI MultiWA
 * services/campaign-runner.js
 *
 * Runner de campañas
 *
 * RESPONSABILIDAD:
 *   - Procesar un único contacto por ejecución.
 *   - Enviar mensaje.
 *   - Actualizar estado.
 *   - Devolver resultado.
 * =============================================================
 */

//==============================================================
// DEPENDENCIAS
//==============================================================

const sessionManager = require('./session-manager');

const antiBan = require('../config/anti-baneo');

const { esBaja } = require('./bajas');

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
	// CLIENTE LISTO
	//----------------------------------------------------------

	if (!client.info || !client.info.wid) {

   	 console.log("⏳ Cliente aún no terminó de iniciar.");

    		return {

       		 tipo: RESULTADO.PAUSA,

        		pausa: 3000

   	 };

	}
	
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

    const numero = String(

        contacto.numero ||

        contacto.NUMERO ||

        ""

    ).replace(/\D/g,"");

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

    console.log("Horario:", horarioOK);

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

    console.log("puedeEnviar =", puedeEnviar);

    if(!puedeEnviar){

        console.log("⏸ Límite antiban alcanzado");

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

            mensajes[

                Math.floor(

                    Math.random() *

                    mensajes.length

                )

            ]

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

        if(estado.imagenGuardada){

            const fs = require("fs");

            const path = require("path");

            const {

                MessageMedia

            } = require("whatsapp-web.js");

            const archivo = path.join(

                __dirname,

                "..",

                "uploads",

                estado.imagenGuardada

            );

            if(fs.existsSync(archivo)){

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

            else{

                await client.sendMessage(

                    destino,

                    texto

                );

            }

        }

        else{

            await client.sendMessage(

                destino,

                texto

            );

        }

        //------------------------------------------------------
        // Audio opcional
        //------------------------------------------------------

        if(estado.audioGuardado){

            const fs = require("fs");

            const path = require("path");

            const {

                MessageMedia

            } = require("whatsapp-web.js");

            const archivo = path.join(

                __dirname,

                "..",

                "uploads",

                estado.audioGuardado

            );

            if(fs.existsSync(archivo)){

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
        // OK
        //------------------------------------------------------

        return marcarExito(

            instanceId,

            estado,

            contacto

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

    contacto

){

    contacto.estadoEnvio = "enviado";

    contacto.fechaEnvio =

        new Date().toISOString();

    estado.actual++;

    estado.enviadosOk++;

    estado.enviando = true;

    estado.campanaFinalizada = false;

    antiBan.incrementarMensajesHoy(

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