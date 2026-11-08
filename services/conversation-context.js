'use strict';

function extraerTextoMensaje(msg) {
    if (!msg) return '';
    if (typeof msg.body === 'string' && msg.body.trim()) return msg.body.trim();

    const m = msg.message;
    if (!m || typeof m !== 'object') return '';

    const texto =
        m.conversation ||
        (m.extendedTextMessage && m.extendedTextMessage.text) ||
        (m.imageMessage && m.imageMessage.caption) ||
        (m.videoMessage && m.videoMessage.caption) ||
        (m.documentMessage && m.documentMessage.caption) ||
        (m.buttonsResponseMessage && m.buttonsResponseMessage.selectedDisplayText) ||
        (m.listResponseMessage && m.listResponseMessage.title) ||
        (m.templateButtonReplyMessage && m.templateButtonReplyMessage.selectedDisplayText) ||
        '';

    return String(texto || '').trim();
}

function extraerChatId(msg) {
    if (!msg) return '';
    if (msg.key && msg.key.remoteJid) return String(msg.key.remoteJid);
    if (msg.from) return String(msg.from);
    return '';
}

function extraerMessageId(msg) {
    if (!msg) return '';
    if (msg.key && msg.key.id) return String(msg.key.id);
    if (msg.id && msg.id._serialized) return String(msg.id._serialized);
    if (msg.id) return String(msg.id);
    return '';
}

class ConversationContext {
    constructor({
        msg,
        client,
        userId,
        instanceId,
        numeroInstancia,
        estado
    }) {
        this.msg = msg;
        this.client = client;
        this.userId = userId;
        this.instanceId = instanceId;
        this.numeroInstancia = numeroInstancia;
        this.estadoTemporal = estado;

        this.chatId = extraerChatId(msg);
        this.messageId = extraerMessageId(msg);
        this.tipoMensaje = msg?.type || 'chat';
        this.texto = extraerTextoMensaje(msg);
        this.fecha = new Date();

        this.contacto = null;
        this.numero = '';
        this.numeroWhatsApp = '';
        this.nombre = 'Desconocido';
        this.empresa = '';
        this.email = '';
        this.rubro = '';

        this.campania = '';
        this.tipoCampana = estado?.tipoCampana || '';
        this.respuestasInfoPorTipo = estado?.respuestasInfoPorTipo || {};

        this.analisisIA = null;
        this.analisisBot = null;
        this.estadoIA = '';
        this.intencionIA = '';
        this.respuestaIA = '';

        this.clienteCRM = null;

        this.debeResponderIA = false;
        this.debeNotificarAsesor = false;
        this.debeRegistrarBaja = false;
    }

    setContacto(contacto) {
        this.contacto = contacto;
        this.nombre =
            contacto?.NOMBRE ||
            contacto?.nombre ||
            'Desconocido';
        this.numero = String(
            contacto?.NUMERO ||
            contacto?.numero ||
            ''
        );
        this.empresa =
            contacto?.EMPRESA ||
            contacto?.empresa ||
            '';
        this.rubro =
            contacto?.RUBRO ||
            contacto?.rubro ||
            this.rubro ||
            '';
        return this;
    }

    setCampania(nombreCampania) {
        this.campania = nombreCampania || '';
        return this;
    }

    setAnalisisBot(analisis) {
        this.analisisBot = analisis;
        return this;
    }

    setAnalisisIA(analisis) {
        this.analisisIA = analisis;
        this.estadoIA = analisis?.estado || '';
        this.intencionIA = analisis?.intencion || '';
        this.respuestaIA = analisis?.respuesta_sugerida || '';
        this.debeResponderIA = Boolean(this.respuestaIA);
        this.debeNotificarAsesor = Boolean(analisis?.notificarHumano);
        this.debeRegistrarBaja =
            this.estadoIA === 'cerrado_perdido' ||
            this.estadoIA === 'baja' ||
            this.intencionIA === 'rechazo_firme' ||
            this.intencionIA === 'numero_equivocado';
        return this;
    }

    toEstadoTemporal() {
        return {
            id: this.chatId.replace(/@.*$/, '') + '_' + Date.now(),
            nombre: this.nombre,
            numero: this.numero,
            numeroWhatsApp: this.chatId.replace(/@.*$/, ''),
            origenNumero: this.numeroInstancia || this.instanceId,
            mensaje: this.texto,
            respuesta: this.respuestaIA,
            estado: this.estadoIA,
            intencion: this.intencionIA,
            tipoCampana: this.tipoCampana,
            fecha: new Date().toLocaleString('es-AR')
        };
    }
}

module.exports = ConversationContext;
module.exports.extraerTextoMensaje = extraerTextoMensaje;
module.exports.extraerChatId = extraerChatId;
module.exports.extraerMessageId = extraerMessageId;
