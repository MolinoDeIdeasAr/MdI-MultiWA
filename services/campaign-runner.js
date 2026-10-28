'use strict';

/**
=============================================================
MdI MultiWA
services/campaign-runner.js
v1.4.0

CHANGELOG v1.4.0:
• NUEVO: integración con las 10 funciones antiban extras:
  - No reenviar a contactos que ya respondieron
  - Cooldown tras respuesta
  - Selección inteligente de mensaje (rotación, anti-repetición,
    variación de longitud)
  - Pausa larga cada X mensajes
  - Límite semanal
  - Pausa en horario de almuerzo
  - Pausa tras errores consecutivos
  - Límite por franja horaria

CHANGELOG v1.3.0:
• FIX: detección de "detached Frame"
• FIX: linkPreview hardcodeado a false

CHANGELOG v1.2.0:
• FIX CRÍTICO: {NOMBRE} nunca se reemplazaba
=============================================================
*/

const sessionManager = require('./session-manager');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
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
// HELPER: detectar frame detached
//==============================================================

function esErrorFrameDetached(err) {
    if (!err || !err.message) return false;
    return (
        err.message.includes('detached Frame') ||
        err.message.includes('Target closed') ||
        err.message.includes('Session closed') ||
        err.message.includes('Protocol error') ||
        err.message.includes('Navigation failed')
    );
}

//==============================================================
// RUN
//==============================================================

async function run(instanceId) {
    const estado = getEstadoInstancia(instanceId);

    console.log("====================================");
    console.log("RUNNER");
    console.log("instance:", instanceId);
    console.log("actual:", estado?.actual);
    console.log("total:", estado?.total);
    console.log("contactos:", estado?.contactosCargados?.length);
    console.log("====================================");

    if (!estado) {
        return { tipo: RESULTADO.ERROR, motivo: "Estado inexistente" };
    }

    const client = sessionManager.getClient(instanceId);
    if (!client) {
        return { tipo: RESULTADO.ERROR, motivo: "Cliente no conectado" };
    }

    if (!client.info || !client.info.wid) {
        console.log("⏳ Cliente aún no terminó de iniciar.");
        return { tipo: RESULTADO.PAUSA, pausa: 3000 };
    }

    if (!Array.isArray(estado.contactosCargados) || estado.contactosCargados.length === 0) {
        return { tipo: RESULTADO.ERROR, motivo: "No hay contactos" };
    }

    if (estado.actual >= estado.contactosCargados.length) {
        estado.enviando = false;
        estado.campanaFinalizada = true;
        guardarEstadoSeguro(instanceId);
        return { tipo: RESULTADO.FINALIZADA };
    }

    const contacto = estado.contactosCargados[estado.actual];
    console.log("Índice:", estado.actual);
    console.log("Contacto:", contacto?.nombre || contacto?.NOMBRE || 'Sin nombre');

    return await procesarContacto(instanceId, client, estado, contacto);
}

//==============================================================
// PROCESAR CONTACTO
//==============================================================

async function procesarContacto(instanceId, client, estado, contacto) {
    console.log("=== procesarContacto ===");

    if (!contacto) {
        console.log("❌ contacto null");
        return { tipo: RESULTADO.ERROR, motivo: "Contacto inexistente" };
    }

    console.log("✅ contacto OK");

    const numero = formatearNumeroWhatsApp(
        contacto.numero || contacto.NUMERO || ""
    );

    console.log("Número:", numero);

    if (!numero) {
        console.log("❌ número inválido");
        return marcarError(instanceId, estado, contacto, "Número inválido");
    }

    console.log("✅ número válido");

    //----------------------------------------------------------
    // Baja
    //----------------------------------------------------------
    console.log("Chequeando baja...");
    if (esBaja(numero)) {
        console.log("⚠ Está en bajas");
        contacto.estadoEnvio = "baja";
        contacto.fechaEnvio = new Date().toISOString();
        estado.actual++;
        guardarEstadoSeguro(instanceId);
        return { tipo: RESULTADO.BAJA };
    }
    console.log("✅ No está en bajas");

    //----------------------------------------------------------
    // NUEVO: No reenviar a quien ya respondió / Cooldown
    //----------------------------------------------------------
    if (antiBan.debeSaltarContactoRespondido(estado, numero, contacto.chatIdEnviado)) {
        console.log("⏭ Contacto ya respondió — saltando");
        contacto.estadoEnvio = "respondido";
        contacto.fechaEnvio = new Date().toISOString();
        estado.actual++;
        guardarEstadoSeguro(instanceId);
        return { tipo: RESULTADO.OK, pausa: 1000 };
    }

    //----------------------------------------------------------
    // Horario permitido (incluye almuerzo y errores consecutivos)
    //----------------------------------------------------------
    console.log("Chequeando horario...");
    const horarioOK = antiBan.esHorarioValido();
    const almuerzoOK = !antiBan.esHorarioAlmuerzo();
    const erroresOK = !antiBan.debePausarPorErrores(instanceId);
    console.log("Horario:", horarioOK,
        "| Almuerzo OK:", almuerzoOK,
        "| Errores OK:", erroresOK,
        "| Hora que ve Node:", new Date().getHours() + "hs",
        "| Fecha/hora completa:", new Date().toString());

    if (!horarioOK || !almuerzoOK || !erroresOK) {
        console.log("⏸ Bloqueado:", antiBan.obtenerMotivoPausa(instanceId));
        return {
            tipo: RESULTADO.PAUSA,
            motivo: antiBan.obtenerMotivoPausa(instanceId),
            pausa: antiBan.obtenerTiempoRestante(instanceId) * 1000
        };
    }
    console.log("✅ Horario permitido");

    //----------------------------------------------------------
    // Límites antiban (hora, día, semana, franja)
    //----------------------------------------------------------
    console.log("Chequeando límites...");
    const puedeEnviar = antiBan.puedeEnviarMas(instanceId);
    console.log("puedeEnviar =", puedeEnviar,
        "| MAX_MENSAJES_HORA:", antiBan.CONFIG.MAX_MENSAJES_HORA,
        "| MAX_MENSAJES_DIA:", antiBan.CONFIG.MAX_MENSAJES_DIA,
        "| MAX_MENSAJES_SEMANA:", antiBan.CONFIG.MAX_MENSAJES_SEMANA,
        "| MAX_MENSAJES_FRANJA:", antiBan.CONFIG.MAX_MENSAJES_FRANJA);
    if (!puedeEnviar) {
        console.log("⏸ Límite antiban alcanzado:", antiBan.obtenerMotivoPausa(instanceId));
        return {
            tipo: RESULTADO.PAUSA,
            motivo: antiBan.obtenerMotivoPausa(instanceId),
            pausa: antiBan.obtenerTiempoRestante(instanceId) * 1000
        };
    }
    console.log("✅ Límite OK");

    //----------------------------------------------------------
    // Cliente conectado (verificar estado de WhatsApp)
    //----------------------------------------------------------
    console.log("ANTES getState");
    try {
        if (typeof client.getState === "function") {
            const estadoWA = await client.getState();
            console.log("Estado WA =", estadoWA);
            if (['UNPAIRED', 'UNPAIRED_IDLE', 'CONFLICT', 'DISCONNECTED'].includes(estadoWA)) {
                console.log("❌ Estado WA inválido:", estadoWA);
                return {
                    tipo: RESULTADO.ERROR,
                    motivo: `WhatsApp ${estadoWA}. Reconectá la sesión.`
                };
            }
        }
    }
    catch (err) {
        console.log("⚠ Error getState:", err.message);
        if (esErrorFrameDetached(err)) {
            console.log("❌ WhatsApp Web se desconectó (frame detached)");
            estado.enviando = false;
            estado.pausado = true;
            guardarEstadoSeguro(instanceId);
            return {
                tipo: RESULTADO.ERROR,
                motivo: "WhatsApp desconectado (frame detached). Reconectá la sesión y reanudá."
            };
        }
    }
    console.log("DESPUÉS getState");

    //----------------------------------------------------------
    // Enviar
    //----------------------------------------------------------
    console.log("➡ Llamando enviarMensaje()");
    const resultado = await enviarMensaje(instanceId, client, estado, contacto, numero);

    // Reintento único si falló por frame detached
    if (resultado.tipo === RESULTADO.ERROR && resultado._frameDetached) {
        console.log("🔄 Reintentando envío (1/1)...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        const reintento = await enviarMensaje(instanceId, client, estado, contacto, numero);
        if (reintento.tipo !== RESULTADO.ERROR) return reintento;
        return resultado;
    }

    return resultado;
}

//==============================================================
// ENVIAR MENSAJE
//==============================================================

async function enviarMensaje(instanceId, client, estado, contacto, numero) {
    try {
        console.log(`📤 Enviando a ${numero}...`);

        const chat = await client.getNumberId(numero);
        if (!chat) {
            return marcarError(instanceId, estado, contacto, "Número inexistente");
        }

        const destino = chat._serialized || `${chat.user}@${chat.server}`;
        console.log(`✅ Chat ID: ${destino}`);

        const mensajes = (estado.mensajesGuardados || []).filter(Boolean);
        if (mensajes.length === 0) {
            return { tipo: RESULTADO.ERROR, motivo: "No hay mensajes cargados" };
        }

        // NUEVO: usar seleccionarMensaje() que aplica rotación,
        // anti-repetición y variación de longitud según config
        const mensajeBase = antiBan.seleccionarMensaje(instanceId, mensajes);
        const texto = procesarSpintax(
            reemplazarVariables(mensajeBase, contacto)
        );

        await simularEscrituraHumana(client, destino, texto);

        const opcionesEnvio = { linkPreview: false };

        if (estado.imagenGuardada) {
            const archivo = path.join(__dirname, "..", "uploads", estado.imagenGuardada);
            if (fs.existsSync(archivo)) {
                const media = MessageMedia.fromFilePath(archivo);
                await client.sendMessage(destino, media, {
                    caption: texto,
                    linkPreview: false
                });
            } else {
                await client.sendMessage(destino, texto, opcionesEnvio);
            }
        } else {
            await client.sendMessage(destino, texto, opcionesEnvio);
        }

        return marcarExito(instanceId, estado, contacto, destino);
    }
    catch (err) {
        if (esErrorFrameDetached(err)) {
            console.log("❌ Frame detached durante el envío:", err.message);
            return {
                tipo: RESULTADO.ERROR,
                motivo: `WhatsApp desconectado: ${err.message}`,
                _frameDetached: true
            };
        }
        return marcarError(instanceId, estado, contacto, err.message);
    }
}

//==============================================================
// MARCAR ÉXITO
//==============================================================

function marcarExito(instanceId, estado, contacto, chatId) {
    contacto.estadoEnvio = "enviado";
    contacto.fechaEnvio = new Date().toISOString();
    if (chatId) contacto.chatIdEnviado = chatId;
    estado.actual++;
    estado.enviadosOk++;
    estado.enviando = true;
    estado.campanaFinalizada = false;

    //----------------------------------------------------------
    // FIX v1.5.0: los contadores ya se incrementaron en
    // antiBan.controlarTasaEnvio() vía registrarEnvio().
    // Solo reseteamos errores consecutivos y actualizamos
    // timestamp visible.
    //----------------------------------------------------------
    antiBan.resetearErroresConsecutivos(instanceId);
    antiBan.actualizarUltimoEnvio(instanceId);

    guardarEstadoSeguro(instanceId);
    console.log(`✅ Enviado (${estado.actual}/${estado.contactosCargados.length})`);
    return {
        tipo: RESULTADO.OK,
        pausa: antiBan.getPausaAleatoria(instanceId),
        contacto
    };
}
//==============================================================
// MARCAR ERROR
//==============================================================

function marcarError(instanceId, estado, contacto, motivo) {
    contacto.estadoEnvio = "fallido";
    contacto.fechaEnvio = new Date().toISOString();
    contacto.error = motivo;

    if (!Array.isArray(estado.fallidos)) estado.fallidos = [];

    estado.fallidos.push({
        nombre: contacto.nombre || contacto.NOMBRE || "",
        numero: contacto.numero || contacto.NUMERO || "",
        motivo
    });

    estado.actual++;

    if (estado.actual >= estado.contactosCargados.length) {
        estado.enviando = false;
        estado.campanaFinalizada = true;
    }

    // NUEVO: registrar error consecutivo (pausa si llega al límite)
    antiBan.registrarErrorConsecutivo(instanceId);

    guardarEstadoSeguro(instanceId);

    console.error(`❌ ${motivo}`);

    return {
        tipo: RESULTADO.OK,
        pausa: antiBan.getPausaAleatoria(instanceId)
    };
}

//==============================================================
// HELPERS
//==============================================================

function normalizarNumero(numero) {
    if (numero === null || numero === undefined) return "";
    return String(numero).replace(/\D/g, "").trim();
}

function obtenerNumero(contacto) {
    return normalizarNumero(
        contacto.numero || contacto.NUMERO || contacto.Numero || ""
    );
}

function obtenerNombre(contacto) {
    return contacto.nombre || contacto.NOMBRE || contacto.Nombre || "";
}

function reemplazarVariables(texto, contacto) {
    if (!texto) return texto;
    const nombre = obtenerNombre(contacto) || '';
    const numero = contacto.numero || contacto.NUMERO || '';
    return texto
        .replace(/\{NOMBRE\}/gi, nombre)
        .replace(/\{NUMERO\}/gi, numero);
}

function obtenerMensajeAleatorio(mensajes) {
    const lista = (mensajes || []).filter(Boolean);
    if (lista.length === 0) return "";
    return procesarSpintax(lista[Math.floor(Math.random() * lista.length)]);
}

function marcarContacto(contacto, estado, motivo = "") {
    contacto.estadoEnvio = estado;
    contacto.fechaEnvio = new Date().toISOString();
    if (motivo) contacto.error = motivo;
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