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

        this.debeNotificarAsesor =
            this.intencionIA === 'solicitud_info' ||
            this.intencionIA === 'solicitud_humano';

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