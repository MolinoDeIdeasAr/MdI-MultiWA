'use strict';

class ConversationContext {

    constructor({
        msg,
        client,
        userId,
        instanceId,
        numeroInstancia,
        estado
    }) {

        //======================================================
        // CONTEXTO TÉCNICO
        //======================================================

        this.msg = msg;
        this.client = client;

        this.userId = userId;

        this.instanceId = instanceId;
        this.numeroInstancia = numeroInstancia;

        this.estadoTemporal = estado;

        //======================================================
        // DATOS DEL MENSAJE
        //======================================================

        this.chatId = msg?.from || '';

        this.messageId =
            msg?.id?._serialized ||
            msg?.id ||
            '';

        this.tipoMensaje =
            msg?.type ||
            'chat';

        this.texto =
            (msg?.body || '').trim();

        this.fecha = new Date();

        //======================================================
        // CLIENTE
        //======================================================

        this.contacto = null;

        this.numero = '';

        this.numeroWhatsApp = '';

        this.nombre = 'Desconocido';

        this.empresa = '';

        this.email = '';

        this.rubro = '';

        //======================================================
        // CAMPAÑA
        //======================================================

        this.campania = '';

        //======================================================
        // IA
        //======================================================

        this.analisisIA = null;

        this.estadoIA = '';

        this.intencionIA = '';

        this.respuestaIA = '';

        //======================================================
        // CRM
        //======================================================

        this.clienteCRM = null;

        //======================================================
        // RESULTADOS
        //======================================================

        this.debeResponderIA = false;

        this.debeNotificarAsesor = false;

        this.debeRegistrarBaja = false;

    }

    //----------------------------------------------------------
    // CONTACTO
    //----------------------------------------------------------

    setContacto(contacto) {

        this.contacto = contacto;

        this.nombre =
            contacto?.NOMBRE ||
            contacto?.nombre ||
            'Desconocido';

        this.numero =
            String(
                contacto?.NUMERO ||
                contacto?.numero ||
                ''
            );

        this.empresa =
            contacto?.EMPRESA ||
            contacto?.empresa ||
            '';

        return this;
    }

    //----------------------------------------------------------
    // CAMPAÑA
    //----------------------------------------------------------

    setCampania(nombreCampania) {

        this.campania = nombreCampania || '';

        return this;

    }

    //----------------------------------------------------------
    // IA
    //----------------------------------------------------------

    setAnalisisIA(analisis) {

        this.analisisIA = analisis;

        this.estadoIA =
            analisis?.estado || '';

        this.intencionIA =
            analisis?.intencion || '';

        this.respuestaIA =
            analisis?.respuesta_sugerida || '';

        this.debeResponderIA =
            Boolean(this.respuestaIA);

        // FIX CRÍTICO: esto comparaba this.intencionIA contra
        // 'solicitud_humano', pero la regla que deriva a un
        // humano (ai-rules.js) en realidad devuelve intencion:
        // 'hablar_humano' — nunca coincidían, así que pedir
        // hablar con un asesor ("ASESOR", "HUMANO", "LLAMAME",
        // etc.) NUNCA disparaba la notificación push, aunque
        // ai-rules.js sí lo marca explícitamente con
        // notificarHumano:true en el análisis.
        //
        // También comparaba contra 'solicitud_info', pero
        // ai-rules.js marca esa intención con notificarHumano:
        // false a propósito (el bot ya contesta solo con la
        // info, no hace falta avisarle a nadie) — mantener esa
        // comparación habría notificado de más.
        //
        // Tanto ai-rules.js como el camino de Gemini
        // (ai-engine.js) ya calculan y exponen el flag
        // notificarHumano — hay que usarlo directo en vez de
        // reinventar la condición acá con strings sueltos que
        // terminan desincronizados de las reglas reales.
        this.debeNotificarAsesor =
            Boolean(analisis?.notificarHumano);

        this.debeRegistrarBaja =
            this.estadoIA === 'cerrado_perdido' ||
            this.intencionIA === 'rechazo_firme';

        return this;

    }

    //----------------------------------------------------------
    // OBJETO PARA STATE MANAGER
    //----------------------------------------------------------

    toEstadoTemporal() {

        return {

            id:
                this.chatId.replace(/@.*$/, '') +
                '_' +
                Date.now(),

            nombre: this.nombre,

            numero: this.numero,

            numeroWhatsApp:
                this.chatId.replace(/@.*$/, ''),

            origenNumero:
                this.numeroInstancia ||
                this.instanceId,

            mensaje: this.texto,

            respuesta: this.respuestaIA,

            estado: this.estadoIA,

            intencion: this.intencionIA,

            fecha:
                new Date().toLocaleString('es-AR')

        };

    }

}

module.exports = ConversationContext;