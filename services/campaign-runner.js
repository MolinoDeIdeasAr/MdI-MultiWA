'use strict';
const sessionManager = require('./session-manager');
const fs = require('fs');
const path = require('path');
const antiBan = require('../config/anti-baneo');
const { esBaja } = require('./bajas');
const { formatearNumeroWhatsApp, procesarSpintax } = require('./formateo');
const { getEstadoInstancia, guardarEstadoSeguro } = require('../state/estado');

const RESULTADO = { OK: "OK", PAUSA: "PAUSA", BAJA: "BAJA", FINALIZADA: "FINALIZADA", ERROR: "ERROR" };

// ✅ FIX: Función de reemplazo TRIPLE para garantizar que funcione sin importar el formato
function reemplazarVariables(texto, nombre, rubro, tipo) {
    if (!texto) return '';
    
    const nombreLimpio = (nombre && !/^\d{10,}$/.test(nombre) && nombre !== 'unknown') ? nombre : 'Contacto';
    const rubroLimpio = rubro || '';
    const tipoLimpio = tipo || '';

    return texto
        .replace(/\{\{\s*NOMBRE\s*\}\}/gi, nombreLimpio)
        .replace(/\{\s*NOMBRE\s*\}/gi, nombreLimpio)
        .replace(/\bNOMBRE\b/gi, nombreLimpio)
        .replace(/\{\{\s*RUBRO\s*\}\}/gi, rubroLimpio)
        .replace(/\{\s*RUBRO\s*\}/gi, rubroLimpio)
        .replace(/\bRUBRO\b/gi, rubroLimpio)
        .replace(/\{\{\s*TIPO\s*\}\}/gi, tipoLimpio)
        .replace(/\{\s*TIPO\s*\}/gi, tipoLimpio)
        .replace(/\bTIPO\b/gi, tipoLimpio);
}

async function run(instanceId) {
    try {
        const estado = getEstadoInstancia(instanceId);
        if (!estado) return { tipo: RESULTADO.PAUSA, pausa: 5000 };

        const infoInstancia = sessionManager.getEstado(instanceId);
        if (!infoInstancia || !infoInstancia.ready) return { tipo: RESULTADO.PAUSA, pausa: 5000 };

        const client = sessionManager.getClient(instanceId);
        if (!client) {
            console.warn(`⚠️ El cliente de WhatsApp no está listo o no se encontró para ${instanceId}. Pausando...`);
            return { tipo: RESULTADO.PAUSA, pausa: 5000 };
        }

        if (!Array.isArray(estado.contactosCargados) || estado.contactosCargados.length === 0) {
            return { tipo: RESULTADO.PAUSA, pausa: 5000 };
        }

        if (estado.actual >= estado.contactosCargados.length) {
            estado.enviando = false; estado.campanaFinalizada = true;
            guardarEstadoSeguro(instanceId);
            return { tipo: RESULTADO.FINALIZADA };
        }

        return await procesarContacto(instanceId, client, estado, estado.contactosCargados[estado.actual]);
    } catch (err) {
        console.error("❌ Error crítico en run:", err.message);
        return { tipo: RESULTADO.PAUSA, pausa: 5000 };
    }
}

async function procesarContacto(instanceId, client, estado, contacto) {
    try {
        if (!contacto) return { tipo: RESULTADO.PAUSA, pausa: 5000 };
        const numero = formatearNumeroWhatsApp(contacto.numero || contacto.NUMERO || "");
        if (!numero) return marcarError(instanceId, estado, contacto, "Número inválido");

        if (esBaja(numero)) {
            contacto.estadoEnvio = "baja"; contacto.fechaEnvio = new Date().toISOString();
            estado.actual++; guardarEstadoSeguro(instanceId);
            return { tipo: RESULTADO.BAJA, pausa: 1000 };
        }

        if (antiBan.debeSaltarContactoRespondido && antiBan.debeSaltarContactoRespondido(estado, numero, contacto.chatIdEnviado)) {
            contacto.estadoEnvio = "respondido"; contacto.fechaEnvio = new Date().toISOString();
            estado.actual++; guardarEstadoSeguro(instanceId);
            return { tipo: RESULTADO.OK, pausa: 1000 };
        }

        if (!(antiBan.esHorarioValido ? antiBan.esHorarioValido() : true)) return { tipo: RESULTADO.PAUSA, motivo: "Fuera de horario", pausa: 60000 };
        if (antiBan.puedeEnviarMas && !antiBan.puedeEnviarMas(instanceId)) return { tipo: RESULTADO.PAUSA, motivo: "Límite alcanzado", pausa: 60000 };

        return await enviarMensaje(instanceId, client, estado, contacto, numero);
    } catch (err) {
        console.error("❌ Error en procesarContacto:", err.message);
        return { tipo: RESULTADO.PAUSA, pausa: 5000 };
    }
}

async function enviarMensaje(instanceId, client, estado, contacto, numero) {
    try {
        console.log(`📤 Enviando a ${numero}...`);
        
        // ✅ NUEVO: Verificar si el número existe en WhatsApp antes de enviar
        let existeEnWhatsApp = true;
        try {
            if (typeof client.onWhatsApp === 'function') {
                const resultado = await client.onWhatsApp(`${numero}@s.whatsapp.net`);
                if (resultado && resultado.length > 0) {
                    existeEnWhatsApp = resultado[0].exists;
                    console.log(`✅ Número ${numero} ${existeEnWhatsApp ? 'EXISTE' : 'NO EXISTE'} en WhatsApp`);
                }
            }
        } catch (err) {
            console.warn(`⚠️ No se pudo verificar si ${numero} existe en WhatsApp: ${err.message}`);
        }

        if (!existeEnWhatsApp) {
            return marcarError(instanceId, estado, contacto, "El número no existe en WhatsApp");
        }

        const destino = `${numero}@s.whatsapp.net`;
        
        const mensajes = (estado.mensajesGuardados || []).filter(Boolean);
        if (mensajes.length === 0) return marcarError(instanceId, estado, contacto, "No hay mensajes cargados");

        const mensajeBase = antiBan.seleccionarMensaje ? antiBan.seleccionarMensaje(instanceId, mensajes) : mensajes[0];
        
        const nombre = contacto.nombre || contacto.NOMBRE || "Contacto";
        const rubro = estado?.rubro || estado?.tipoCampana || "";
        const tipoCampana = estado?.tipoCampana || "";
        
        const textoConSpintax = procesarSpintax(mensajeBase);
        const textoFinal = reemplazarVariables(textoConSpintax, nombre, rubro, tipoCampana);

        console.log(`📝 Texto a enviar: "${textoFinal.substring(0, 80)}..."`);

        const opcionesEnvio = { linkPreview: estado.linkPreviewActivo !== false };
        let resultadoEnvio = null;

        if (estado.imagenGuardada) {
            const archivo = path.join(__dirname, "..", "uploads", estado.imagenGuardada);
            if (fs.existsSync(archivo)) {
                console.log(`🖼️ Enviando con imagen: ${estado.imagenGuardada}`);
                resultadoEnvio = await client.sendMessage(destino, { image: { url: archivo }, caption: textoFinal, ...opcionesEnvio });
            } else {
                console.log(`⚠️ Imagen no existe: ${archivo}. Enviando solo texto.`);
                resultadoEnvio = await client.sendMessage(destino, { text: textoFinal, ...opcionesEnvio });
            }
        } else {
            console.log(`📄 Enviando solo texto`);
            resultadoEnvio = await client.sendMessage(destino, { text: textoFinal, ...opcionesEnvio });
        }

        // ✅ NUEVO: Loguear el resultado real de WhatsApp
        if (resultadoEnvio) {
            console.log(`✅ WhatsApp confirmó envío. Message ID: ${resultadoEnvio.key?.id || 'N/A'}`);
        }

        return marcarExito(instanceId, estado, contacto, destino);
    } catch (err) {
        console.error(`❌ Error en enviarMensaje a ${numero}:`, err.message);
        console.error(err.stack);
        return marcarError(instanceId, estado, contacto, err.message);
    }
}

function marcarExito(instanceId, estado, contacto, chatId) {
    contacto.estadoEnvio = "enviado"; contacto.fechaEnvio = new Date().toISOString();
    if (chatId) contacto.chatIdEnviado = chatId;
    estado.actual++; estado.enviadosOk++; estado.enviando = true; estado.campanaFinalizada = false;
    if (antiBan.resetearErroresConsecutivos) antiBan.resetearErroresConsecutivos(instanceId);
    if (antiBan.actualizarUltimoEnvio) antiBan.actualizarUltimoEnvio(instanceId);
    guardarEstadoSeguro(instanceId);
    console.log(`✅ Enviado (${estado.actual}/${estado.contactosCargados.length})`);
    return { tipo: RESULTADO.OK, pausa: Math.max(5000, antiBan.getPausaAleatoria ? antiBan.getPausaAleatoria(instanceId) : 5000), contacto };
}

function marcarError(instanceId, estado, contacto, motivo) {
    contacto.estadoEnvio = "fallido"; contacto.fechaEnvio = new Date().toISOString(); contacto.error = motivo;
    if (!Array.isArray(estado.fallidos)) estado.fallidos = [];
    estado.fallidos.push({ nombre: contacto.nombre || contacto.NOMBRE || "", numero: contacto.numero || contacto.NUMERO || "", motivo });
    estado.actual++;
    if (estado.actual >= estado.contactosCargados.length) { estado.enviando = false; estado.campanaFinalizada = true; }
    
    let pausaSiguiente = 5000;
    if (motivo && (motivo.includes("memoize") || motivo.includes("librería") || motivo.includes("técnico"))) {
        console.log("⏭️ Error técnico ignorado. Pausa de 5s.");
    } else {
        if (antiBan.registrarErrorConsecutivo) antiBan.registrarErrorConsecutivo(instanceId);
        pausaSiguiente = antiBan.getPausaAleatoria ? antiBan.getPausaAleatoria(instanceId) : 5000;
    }
    guardarEstadoSeguro(instanceId);
    console.error(`❌ ${motivo}`);
    return { tipo: RESULTADO.OK, pausa: Math.max(5000, pausaSiguiente), contacto };
}

module.exports = { run, RESULTADO };