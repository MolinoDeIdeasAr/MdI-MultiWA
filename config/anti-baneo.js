'use strict';

// config/anti-baneo.js v2.0.0
// 10 funciones antiban extra configurables

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config-antibaneo.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

//==============================================================
// CONFIGURACIÓN POR DEFECTO
//==============================================================

const CONFIG_DEFAULT = {
    // EXISTENTES
    HORA_INICIO: 9,
    HORA_FIN: 18,
    MAX_MENSAJES_HORA: 5,
    MAX_MENSAJES_DIA: 40,
    PAUSA_BASE: 120000,
    PAUSA_MAX: 180000,

    // 1. Pausa larga cada X mensajes
    PAUSA_LARGA_ACTIVADA: true,
    PAUSA_LARGA_CADA: 10,
    PAUSA_LARGA_MIN: 900000,
    PAUSA_LARGA_MAX: 1800000,

    // 2. Límite semanal
    LIMITE_SEMANAL_ACTIVADO: true,
    MAX_MENSAJES_SEMANA: 150,

    // 3. Evitar mensaje repetido
    EVITAR_MENSAJE_REPETIDO: true,

    // 4. Cooldown tras respuesta
    COOLDOWN_TRAS_RESPUESTA_ACTIVADO: true,
    COOLDOWN_TRAS_RESPUESTA: 1800000,

    // 5. No reenviar a respondidos
    NO_REENVIAR_RESPONDIDOS: true,

    // 6. Pausa en almuerzo
    PAUSA_ALMUERZO_ACTIVADA: true,
    ALMUERZO_INICIO: 12,
    ALMUERZO_FIN: 14,

    // 7. Variación de longitud
    VARIACION_LONGITUD: true,

    // 8. Pausa tras errores consecutivos
    MAX_ERRORES_CONSECUTIVOS: 3,
    PAUSA_TRAS_ERRORES: 600000,

    // 9. Rotación de mensajes
    ROTACION_MENSAJES: true,

    // 10. Límite por franja horaria
    LIMITE_FRANJA_ACTIVADO: true,
    MAX_MENSAJES_FRANJA: 15,
};

//==============================================================
// CARGAR / GUARDAR CONFIG
//==============================================================

function cargarConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const guardada = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            return { ...CONFIG_DEFAULT, ...guardada };
        }
    } catch (e) {
        console.error('❌ Error cargando config-antibaneo.json, usando default:', e.message);
    }
    return { ...CONFIG_DEFAULT };
}

function esBool(v) {
    return v === true || v === 'true' || v === 'on' || v === '1';
}

function guardarConfig(nuevaConfig) {
    try {
        const validada = {
            HORA_INICIO: Math.max(0, Math.min(23, parseInt(nuevaConfig.HORA_INICIO) || CONFIG_DEFAULT.HORA_INICIO)),
            HORA_FIN: Math.max(0, Math.min(23, parseInt(nuevaConfig.HORA_FIN) || CONFIG_DEFAULT.HORA_FIN)),
            MAX_MENSAJES_HORA: Math.max(1, parseInt(nuevaConfig.MAX_MENSAJES_HORA) || CONFIG_DEFAULT.MAX_MENSAJES_HORA),
            MAX_MENSAJES_DIA: Math.max(1, parseInt(nuevaConfig.MAX_MENSAJES_DIA) || CONFIG_DEFAULT.MAX_MENSAJES_DIA),
            PAUSA_BASE: Math.max(5000, parseInt(nuevaConfig.PAUSA_BASE) || CONFIG_DEFAULT.PAUSA_BASE),
            PAUSA_MAX: Math.max(5000, parseInt(nuevaConfig.PAUSA_MAX) || CONFIG_DEFAULT.PAUSA_MAX),

            PAUSA_LARGA_ACTIVADA: esBool(nuevaConfig.PAUSA_LARGA_ACTIVADA),
            PAUSA_LARGA_CADA: Math.max(1, parseInt(nuevaConfig.PAUSA_LARGA_CADA) || CONFIG_DEFAULT.PAUSA_LARGA_CADA),
            PAUSA_LARGA_MIN: Math.max(60000, parseInt(nuevaConfig.PAUSA_LARGA_MIN) || CONFIG_DEFAULT.PAUSA_LARGA_MIN),
            PAUSA_LARGA_MAX: Math.max(60000, parseInt(nuevaConfig.PAUSA_LARGA_MAX) || CONFIG_DEFAULT.PAUSA_LARGA_MAX),

            LIMITE_SEMANAL_ACTIVADO: esBool(nuevaConfig.LIMITE_SEMANAL_ACTIVADO),
            MAX_MENSAJES_SEMANA: Math.max(1, parseInt(nuevaConfig.MAX_MENSAJES_SEMANA) || CONFIG_DEFAULT.MAX_MENSAJES_SEMANA),

            EVITAR_MENSAJE_REPETIDO: esBool(nuevaConfig.EVITAR_MENSAJE_REPETIDO),

            COOLDOWN_TRAS_RESPUESTA_ACTIVADO: esBool(nuevaConfig.COOLDOWN_TRAS_RESPUESTA_ACTIVADO),
            COOLDOWN_TRAS_RESPUESTA: Math.max(60000, parseInt(nuevaConfig.COOLDOWN_TRAS_RESPUESTA) || CONFIG_DEFAULT.COOLDOWN_TRAS_RESPUESTA),

            NO_REENVIAR_RESPONDIDOS: esBool(nuevaConfig.NO_REENVIAR_RESPONDIDOS),

            PAUSA_ALMUERZO_ACTIVADA: esBool(nuevaConfig.PAUSA_ALMUERZO_ACTIVADA),
            ALMUERZO_INICIO: Math.max(0, Math.min(23, parseInt(nuevaConfig.ALMUERZO_INICIO) || CONFIG_DEFAULT.ALMUERZO_INICIO)),
            ALMUERZO_FIN: Math.max(0, Math.min(23, parseInt(nuevaConfig.ALMUERZO_FIN) || CONFIG_DEFAULT.ALMUERZO_FIN)),

            VARIACION_LONGITUD: esBool(nuevaConfig.VARIACION_LONGITUD),

            MAX_ERRORES_CONSECUTIVOS: Math.max(1, parseInt(nuevaConfig.MAX_ERRORES_CONSECUTIVOS) || CONFIG_DEFAULT.MAX_ERRORES_CONSECUTIVOS),
            PAUSA_TRAS_ERRORES: Math.max(60000, parseInt(nuevaConfig.PAUSA_TRAS_ERRORES) || CONFIG_DEFAULT.PAUSA_TRAS_ERRORES),

            ROTACION_MENSAJES: esBool(nuevaConfig.ROTACION_MENSAJES),

            LIMITE_FRANJA_ACTIVADO: esBool(nuevaConfig.LIMITE_FRANJA_ACTIVADO),
            MAX_MENSAJES_FRANJA: Math.max(1, parseInt(nuevaConfig.MAX_MENSAJES_FRANJA) || CONFIG_DEFAULT.MAX_MENSAJES_FRANJA),
        };

        if (validada.PAUSA_MAX < validada.PAUSA_BASE) validada.PAUSA_MAX = validada.PAUSA_BASE;
        if (validada.PAUSA_LARGA_MAX < validada.PAUSA_LARGA_MIN) validada.PAUSA_LARGA_MAX = validada.PAUSA_LARGA_MIN;
        if (validada.ALMUERZO_FIN <= validada.ALMUERZO_INICIO) validada.ALMUERZO_FIN = validada.ALMUERZO_INICIO + 1;

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(validada, null, 2), 'utf8');
        Object.assign(CONFIG, validada);
        console.log('⚙️ Configuración anti-baneo actualizada');
        return validada;
    } catch (e) {
        console.error('❌ Error guardando config-antibaneo.json:', e.message);
        return null;
    }
}

const CONFIG = cargarConfig();

//==============================================================
// CONTADORES POR INSTANCIA
//==============================================================

const contadores = new Map();
const contadorLote = new Map();

//==============================================================
// PERSISTENCIA DE CONTADORES (NUEVO v2.1.0)
//==============================================================
const CONTADORES_FILE = path.join(DATA_DIR, 'contadores-antibaneo.json');

function guardarContadores() {
    try {
        const obj = Object.fromEntries(contadores);
        fs.writeFileSync(
            CONTADORES_FILE,
            JSON.stringify(obj, null, 2),
            'utf8'
        );
    } catch (err) {
        console.warn('⚠ No se pudieron persistir contadores anti-ban:', err.message);
    }
}

function cargarContadores() {
    try {
        if (!fs.existsSync(CONTADORES_FILE)) return;
        const saved = JSON.parse(fs.readFileSync(CONTADORES_FILE, 'utf8'));
        for (const [instanceId, data] of Object.entries(saved || {})) {
            contadores.set(instanceId, {
                mensajesHoy: 0,
                mensajesEstaHora: 0,
                mensajesEstaSemana: 0,
                mensajesEstaFranja: 0,
                ultimaHora: new Date().getHours(),
                ultimaFranja: getFranjaActual(),
                ultimoResetDia: new Date().toDateString(),
                ultimoResetSemana: getInicioSemana().toDateString(),
                ultimoEnvio: 0,
                enviadosDesdePausaLarga: 0,
                ultimoMensajeEnviado: '',
                indiceRotacion: 0,
                erroresConsecutivos: 0,
                pausaPorErroresHasta: 0,
                ultimasLongitudes: [],
                ...data
            });
        }
        console.log('🧮 Contadores anti-ban restaurados desde disco');
    } catch (err) {
        console.warn('⚠ No se pudieron cargar contadores anti-ban:', err.message);
    }
}

function getInicioSemana() {
    const ahora = new Date();
    const dia = ahora.getDay();
    const diff = dia === 0 ? 6 : dia - 1;
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() - diff);
    lunes.setHours(0, 0, 0, 0);
    return lunes;
}

function getFranjaActual() {
    const hora = new Date().getHours();
    if (hora >= 6 && hora < 9) return 0;
    if (hora >= 9 && hora < 12) return 1;
    if (hora >= 12 && hora < 15) return 2;
    if (hora >= 15 && hora < 18) return 3;
    if (hora >= 18 && hora < 21) return 4;
    return 5;
}

function obtenerContador(instanceId) {
    if (!contadores.has(instanceId)) {
        contadores.set(instanceId, {
            mensajesHoy: 0,
            mensajesEstaHora: 0,
            mensajesEstaSemana: 0,
            mensajesEstaFranja: 0,
            ultimaHora: new Date().getHours(),
            ultimaFranja: getFranjaActual(),
            ultimoResetDia: new Date().toDateString(),
            ultimoResetSemana: getInicioSemana().toDateString(),
            ultimoEnvio: 0,
            enviadosDesdePausaLarga: 0,
            ultimoMensajeEnviado: '',
            indiceRotacion: 0,
            erroresConsecutivos: 0,
            pausaPorErroresHasta: 0,
            ultimasLongitudes: []
        });
        guardarContadores();
    }
    return contadores.get(instanceId);
}

//==============================================================
// ACTUALIZAR CONTADORES (resets automáticos)
//==============================================================

function actualizarContadores(instanceId) {
    const c = obtenerContador(instanceId);
    const ahora = new Date();

    if (ahora.getHours() !== c.ultimaHora) {
        c.mensajesEstaHora = 0;
        c.ultimaHora = ahora.getHours();
    }

    if (ahora.toDateString() !== c.ultimoResetDia) {
        c.mensajesHoy = 0;
        c.ultimoResetDia = ahora.toDateString();
    }

    const inicioSemana = getInicioSemana();
    if (inicioSemana.toDateString() !== c.ultimoResetSemana) {
        c.mensajesEstaSemana = 0;
        c.ultimoResetSemana = inicioSemana.toDateString();
    }

    const franjaActual = getFranjaActual();
    if (franjaActual !== c.ultimaFranja) {
        c.mensajesEstaFranja = 0;
        c.ultimaFranja = franjaActual;
    }
}

//==============================================================
// INCREMENTAR CONTADORES
//==============================================================

function incrementarMensajesHoy(instanceId) {
    actualizarContadores(instanceId);
    obtenerContador(instanceId).mensajesHoy++;
}

function incrementarMensajesHora(instanceId) {
    actualizarContadores(instanceId);
    obtenerContador(instanceId).mensajesEstaHora++;
}

function incrementarMensajesSemana(instanceId) {
    actualizarContadores(instanceId);
    obtenerContador(instanceId).mensajesEstaSemana++;
}

function incrementarMensajesFranja(instanceId) {
    actualizarContadores(instanceId);
    obtenerContador(instanceId).mensajesEstaFranja++;
}

//==============================================================
// VERIFICACIONES DE HORARIO
//==============================================================

function esHorarioValido() {
    const hora = new Date().getHours();
    return hora >= CONFIG.HORA_INICIO && hora < CONFIG.HORA_FIN;
}

function esHorarioAlmuerzo() {
    if (!CONFIG.PAUSA_ALMUERZO_ACTIVADA) return false;
    const hora = new Date().getHours();
    return hora >= CONFIG.ALMUERZO_INICIO && hora < CONFIG.ALMUERZO_FIN;
}

//==============================================================
// VERIFICACIONES DE LÍMITES
//==============================================================

function puedeEnviarSemana(instanceId) {
    if (!CONFIG.LIMITE_SEMANAL_ACTIVADO) return true;
    actualizarContadores(instanceId);
    return obtenerContador(instanceId).mensajesEstaSemana < CONFIG.MAX_MENSAJES_SEMANA;
}

function puedeEnviarFranja(instanceId) {
    if (!CONFIG.LIMITE_FRANJA_ACTIVADO) return true;
    actualizarContadores(instanceId);
    return obtenerContador(instanceId).mensajesEstaFranja < CONFIG.MAX_MENSAJES_FRANJA;
}

function debePausarPorErrores(instanceId) {
    return Date.now() < obtenerContador(instanceId).pausaPorErroresHasta;
}

function tiempoRestantePausaErrores(instanceId) {
    return Math.max(0, obtenerContador(instanceId).pausaPorErroresHasta - Date.now());
}

function registrarErrorConsecutivo(instanceId) {
    const c = obtenerContador(instanceId);
    c.erroresConsecutivos++;
    if (c.erroresConsecutivos >= CONFIG.MAX_ERRORES_CONSECUTIVOS) {
        c.pausaPorErroresHasta = Date.now() + CONFIG.PAUSA_TRAS_ERRORES;
        c.erroresConsecutivos = 0;
        console.log(`⚠️ ${CONFIG.MAX_ERRORES_CONSECUTIVOS} errores consecutivos — pausando ${Math.round(CONFIG.PAUSA_TRAS_ERRORES / 60000)} min`);
    }
    guardarContadores();
}
function resetearErroresConsecutivos(instanceId) {
    const c = obtenerContador(instanceId);
    c.erroresConsecutivos = 0;
    guardarContadores();
}

//==============================================================
// REGISTRO CENTRAL DE ENVÍO (NUEVO v2.1.0)
//==============================================================
function registrarEnvio(instanceId) {
    actualizarContadores(instanceId);
    const c = obtenerContador(instanceId);
    c.mensajesEstaHora++;
    c.mensajesHoy++;
    c.mensajesEstaSemana++;
    c.mensajesEstaFranja++;
    c.ultimoEnvio = Date.now();
    c.erroresConsecutivos = 0;
    guardarContadores();
}
//==============================================================
// VERIFICACIÓN PRINCIPAL: ¿PUEDE ENVIAR?
//==============================================================

function puedeEnviarMas(instanceId) {
    actualizarContadores(instanceId);
    if (!esHorarioValido()) return false;
    if (esHorarioAlmuerzo()) return false;
    if (debePausarPorErrores(instanceId)) return false;
    if (!puedeEnviarSemana(instanceId)) return false;
    if (!puedeEnviarFranja(instanceId)) return false;

    const c = obtenerContador(instanceId);
    return (
        c.mensajesEstaHora < CONFIG.MAX_MENSAJES_HORA &&
        c.mensajesHoy < CONFIG.MAX_MENSAJES_DIA
    );
}

//==============================================================
// CONTACTOS QUE YA RESPONDIERON
//==============================================================

function debeSaltarContactoRespondido(estado, numero, chatId) {
    if (!CONFIG.NO_REENVIAR_RESPONDIDOS && !CONFIG.COOLDOWN_TRAS_RESPUESTA_ACTIVADO) {
        return false;
    }

    const conversaciones = estado?.conversaciones || [];
    const conv = conversaciones.find(c =>
        (numero && c.numero === numero) ||
        (chatId && c.chatId === chatId)
    );

    if (!conv) return false;

    if (CONFIG.NO_REENVIAR_RESPONDIDOS) return true;

    if (CONFIG.COOLDOWN_TRAS_RESPUESTA_ACTIVADO) {
        const ultimaRespuesta = new Date(conv.fecha || conv.fechaEnvio || 0).getTime();
        if (Date.now() - ultimaRespuesta < CONFIG.COOLDOWN_TRAS_RESPUESTA) return true;
    }

    return false;
}

//==============================================================
// SELECCIÓN DE MENSAJE (rotación, anti-repetición, variación)
//==============================================================

function seleccionarMensaje(instanceId, mensajes) {
    if (!mensajes || mensajes.length === 0) return '';
    if (mensajes.length === 1) {
        const c = obtenerContador(instanceId);
        c.ultimoMensajeEnviado = mensajes[0];
        return mensajes[0];
    }

    const c = obtenerContador(instanceId);
    let indice;

    if (CONFIG.ROTACION_MENSAJES) {
        indice = c.indiceRotacion % mensajes.length;
        c.indiceRotacion++;
    } else {
        indice = Math.floor(Math.random() * mensajes.length);
    }

    if (CONFIG.EVITAR_MENSAJE_REPETIDO && mensajes[indice] === c.ultimoMensajeEnviado) {
        indice = (indice + 1) % mensajes.length;
    }

    if (CONFIG.VARIACION_LONGITUD && c.ultimasLongitudes.length >= 2) {
        const longActual = mensajes[indice].length;
        const ultimas = c.ultimasLongitudes.slice(-2);
        const todasSimilares = ultimas.every(l => {
            const maxLen = Math.max(l, longActual);
            return maxLen > 0 && Math.abs(l - longActual) / maxLen < 0.2;
        });
        if (todasSimilares) {
            for (let i = 1; i < mensajes.length; i++) {
                const idx = (indice + i) % mensajes.length;
                const longCandidato = mensajes[idx].length;
                const esDiferente = ultimas.some(l => {
                    const maxLen = Math.max(l, longCandidato);
                    return maxLen > 0 && Math.abs(l - longCandidato) / maxLen >= 0.2;
                });
                if (esDiferente) {
                    indice = idx;
                    break;
                }
            }
        }
    }

    c.ultimoMensajeEnviado = mensajes[indice];
    c.ultimasLongitudes.push(mensajes[indice].length);
    if (c.ultimasLongitudes.length > 5) c.ultimasLongitudes.shift();

    return mensajes[indice];
}

//==============================================================
// PAUSA ALEATORIA (con pausa larga cada X mensajes)
//==============================================================

function getPausaAleatoria(instanceId) {
    let extra = 0;
    if (!contadorLote.has(instanceId)) contadorLote.set(instanceId, 0);
    const enviadosLote = contadorLote.get(instanceId);
    if (enviadosLote >= 3) {
        extra = 60000;
        contadorLote.set(instanceId, 0);
    } else {
        contadorLote.set(instanceId, enviadosLote + 1);
    }

    const ruido = Math.random() * 30000;
    let pausa = CONFIG.PAUSA_BASE + ruido + extra;

    if (CONFIG.PAUSA_LARGA_ACTIVADA) {
        const c = obtenerContador(instanceId);
        c.enviadosDesdePausaLarga++;
        if (c.enviadosDesdePausaLarga >= CONFIG.PAUSA_LARGA_CADA) {
            c.enviadosDesdePausaLarga = 0;
            const pausaLarga = CONFIG.PAUSA_LARGA_MIN +
                Math.random() * (CONFIG.PAUSA_LARGA_MAX - CONFIG.PAUSA_LARGA_MIN);
            console.log(`🛌 Pausa larga programada: ${Math.round(pausaLarga / 60000)} min`);
            return pausaLarga;
        }
    }

    return pausa;
}

//==============================================================
// TIEMPOS RESTANTES
//==============================================================

function tiempoRestanteHora(instanceId) {
    const c = obtenerContador(instanceId);
    if (c.mensajesEstaHora < CONFIG.MAX_MENSAJES_HORA) return 0;
    const ahora = new Date();
    return (60 - ahora.getMinutes()) * 60 + (60 - ahora.getSeconds());
}

function tiempoRestanteDia(instanceId) {
    const c = obtenerContador(instanceId);
    if (c.mensajesHoy < CONFIG.MAX_MENSAJES_DIA) return 0;
    const ahora = new Date();
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    return Math.floor((manana - ahora) / 1000);
}

function tiempoRestanteHorario() {
    if (esHorarioValido()) return 0;
    const ahora = new Date();
    let proximoInicio = new Date(ahora);
    proximoInicio.setHours(CONFIG.HORA_INICIO, 0, 0, 0);
    if (ahora.getHours() >= CONFIG.HORA_FIN) {
        proximoInicio.setDate(proximoInicio.getDate() + 1);
    }
    return Math.floor((proximoInicio - ahora) / 1000);
}

function tiempoRestanteAlmuerzo() {
    if (!esHorarioAlmuerzo()) return 0;
    const ahora = new Date();
    const finAlmuerzo = new Date(ahora);
    finAlmuerzo.setHours(CONFIG.ALMUERZO_FIN, 0, 0, 0);
    return Math.floor((finAlmuerzo - ahora) / 1000);
}

function tiempoRestanteSemana(instanceId) {
    if (!CONFIG.LIMITE_SEMANAL_ACTIVADO) return 0;
    const c = obtenerContador(instanceId);
    if (c.mensajesEstaSemana < CONFIG.MAX_MENSAJES_SEMANA) return 0;
    const inicioSemana = getInicioSemana();
    const proximaSemana = new Date(inicioSemana);
    proximaSemana.setDate(proximaSemana.getDate() + 7);
    return Math.floor((proximaSemana - new Date()) / 1000);
}

function tiempoRestanteFranja(instanceId) {
    if (!CONFIG.LIMITE_FRANJA_ACTIVADO) return 0;
    const c = obtenerContador(instanceId);
    if (c.mensajesEstaFranja < CONFIG.MAX_MENSAJES_FRANJA) return 0;
    const ahora = new Date();
    const franja = getFranjaActual();
    const finFranja = new Date(ahora);
    const horasFin = [9, 12, 15, 18, 21, 6];
    finFranja.setHours(horasFin[franja], 0, 0, 0);
    if (finFranja <= ahora) finFranja.setDate(finFranja.getDate() + 1);
    return Math.floor((finFranja - ahora) / 1000);
}

//==============================================================
// MOTIVO DE PAUSA
//==============================================================

function obtenerMotivoPausa(instanceId) {
    if (!esHorarioValido()) return '📅 Fuera de horario laboral (' + CONFIG.HORA_INICIO + '-' + CONFIG.HORA_FIN + ')';
    if (esHorarioAlmuerzo()) return `🍽️ Horario de almuerzo (${CONFIG.ALMUERZO_INICIO}-${CONFIG.ALMUERZO_FIN})`;
    if (debePausarPorErrores(instanceId)) return '⚠️ Pausa por errores consecutivos';
    if (!puedeEnviarSemana(instanceId)) return `📆 Límite semanal (${CONFIG.MAX_MENSAJES_SEMANA} msgs/semana)`;
    if (!puedeEnviarFranja(instanceId)) return `🕐 Límite por franja (${CONFIG.MAX_MENSAJES_FRANJA} msgs/franja)`;

    const c = obtenerContador(instanceId);
    if (c.mensajesEstaHora >= CONFIG.MAX_MENSAJES_HORA) return `⏱️ Límite por hora (${CONFIG.MAX_MENSAJES_HORA} msgs/hora)`;
    if (c.mensajesHoy >= CONFIG.MAX_MENSAJES_DIA) return `📆 Límite diario (${CONFIG.MAX_MENSAJES_DIA} msgs/día)`;
    return '✅ Sin límites';
}

function obtenerTiempoRestante(instanceId) {
    if (!esHorarioValido()) return tiempoRestanteHorario();
    if (esHorarioAlmuerzo()) return tiempoRestanteAlmuerzo();
    if (debePausarPorErrores(instanceId)) return Math.ceil(tiempoRestantePausaErrores(instanceId) / 1000);
    let t = tiempoRestanteSemana(instanceId);
    if (t > 0) return t;
    t = tiempoRestanteFranja(instanceId);
    if (t > 0) return t;
    t = tiempoRestanteHora(instanceId);
    if (t > 0) return t;
    return tiempoRestanteDia(instanceId);
}

//==============================================================
// GETTERS
//==============================================================

function getMensajesHoy(instanceId) {
    actualizarContadores(instanceId);
    return obtenerContador(instanceId).mensajesHoy;
}

function getMensajesEstaHora(instanceId) {
    actualizarContadores(instanceId);
    return obtenerContador(instanceId).mensajesEstaHora;
}

function getMensajesSemana(instanceId) {
    actualizarContadores(instanceId);
    return obtenerContador(instanceId).mensajesEstaSemana;
}

function getMensajesFranja(instanceId) {
    actualizarContadores(instanceId);
    return obtenerContador(instanceId).mensajesEstaFranja;
}

function getEstado(instanceId) {
    actualizarContadores(instanceId);
    return {
        mensajesHoy: getMensajesHoy(instanceId),
        mensajesHora: getMensajesEstaHora(instanceId),
        mensajesSemana: getMensajesSemana(instanceId),
        mensajesFranja: getMensajesFranja(instanceId),
        motivo: obtenerMotivoPausa(instanceId),
        tiempoRestante: obtenerTiempoRestante(instanceId)
    };
}

//==============================================================
// USER AGENT
//==============================================================

function getUserAgent() {
    const agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * User-Agent ESTABLE por instancia.
 * Cada instancia usa siempre el mismo UA (hash del instanceId).
 */
function getUserAgentParaInstancia(instanceId) {
    const agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    const key = String(instanceId || 'default');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash + key.charCodeAt(i)) >>> 0;
    }
    return agents[hash % agents.length];
}

function setNumeroActual(numero) {}
function getNumeroActual() { return null; }

function actualizarUltimoEnvio(instanceId) {
    obtenerContador(instanceId).ultimoEnvio = Date.now();
    guardarContadores();
}

//==============================================================
// INICIALIZACIÓN AL CARGAR EL MÓDULO
//==============================================================
cargarContadores();

async function controlarTasaEnvio(instanceId) {
    actualizarContadores(instanceId);
    while (!puedeEnviarMas(instanceId)) {
        actualizarContadores(instanceId);
        const espera = Math.max(1000, obtenerTiempoRestante(instanceId) * 1000);
        console.log(`⏳ ${obtenerMotivoPausa(instanceId)}. Esperando ${Math.round(espera / 1000)}s...`);
        await new Promise(r => setTimeout(r, espera));
    }
    registrarEnvio(instanceId);
}

//==============================================================
// EXPORTS
//==============================================================

module.exports = {
    CONFIG,
    cargarConfig,
    guardarConfig,
    getMensajesHoy,
    getMensajesEstaHora,
    getMensajesSemana,
    getMensajesFranja,
    incrementarMensajesHoy,
    incrementarMensajesHora,
    incrementarMensajesSemana,
    incrementarMensajesFranja,
    registrarEnvio,
    esHorarioValido,
    esHorarioAlmuerzo,
    puedeEnviarMas,
    puedeEnviarSemana,
    puedeEnviarFranja,
    debePausarPorErrores,
    tiempoRestantePausaErrores,
    registrarErrorConsecutivo,
    resetearErroresConsecutivos,
    debeSaltarContactoRespondido,
    seleccionarMensaje,
    getPausaAleatoria,
    controlarTasaEnvio,
    getUserAgent,
    getUserAgentParaInstancia,
    setNumeroActual,
    getNumeroActual,
    tiempoRestanteHora,
    tiempoRestanteDia,
    tiempoRestanteHorario,
    tiempoRestanteAlmuerzo,
    tiempoRestanteSemana,
    tiempoRestanteFranja,
    obtenerMotivoPausa,
    obtenerTiempoRestante,
    actualizarUltimoEnvio,
    getEstado
};