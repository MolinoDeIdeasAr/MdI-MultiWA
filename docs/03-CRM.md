# MdI MultiWA

# 03 - CRM

Versión 1.0

---

# Objetivo

El CRM representa la memoria permanente del sistema.

Toda interacción con un cliente debe quedar registrada.

Nunca debe perderse información.

El CRM es independiente de:

- campañas
- WhatsApp
- IA
- interfaz
- almacenamiento

Su única responsabilidad es representar la historia comercial del cliente.

---

# Filosofía

Un cliente existe una sola vez.

No importa cuántas campañas reciba.

No importa cuántas veces escriba.

No importa cuántas instancias de WhatsApp lo contacten.

Siempre será el mismo cliente.

---

# Entidad Principal

## Cliente

Cada cliente posee un identificador único.

```text
Cliente

↓

Conversaciones

↓

Eventos

↓

Notas

↓

Campañas

↓

Etiquetas

↓

Estados
```

---

# Modelo Cliente

```javascript
{
    id,

    nombre,

    numero,

    numeroWhatsApp,

    empresa,

    email,

    rubro,

    origen,

    estado,

    etiqueta,

    asesor,

    fechaAlta,

    ultimaActividad,

    conversaciones: [],

    eventos: [],

    notas: [],

    historialCampanias: [],

    metadata: {}
}
```

---

# Identidad

Un cliente se identifica por:

```
numeroWhatsApp
```

Nunca por el nombre.

Nunca por la empresa.

Nunca por el chat.

Nunca por la campaña.

---

# Conversaciones

Representan mensajes.

Nunca acciones.

Modelo

```javascript
{
    id,

    fecha,

    direccion,

    autor,

    tipo,

    mensaje,

    modeloIA,

    intencion,

    estadoIA,

    instanceId,

    campaignId,

    chatId,

    messageId,

    metadata
}
```

---

Dirección

Puede ser:

```text
IN

OUT
```

---

Autor

Puede ser:

```text
CLIENTE

IA

ASESOR

SISTEMA
```

---

Tipo

Puede ser

```text
texto

imagen

audio

video

documento

ubicacion

contacto
```

---

# Eventos

Representan acciones del negocio.

Nunca mensajes.

Modelo

```javascript
{
    id,

    fecha,

    tipo,

    descripcion,

    usuario,

    metadata
}
```

---

Tipos

```text
CLIENTE_CREADO

CLIENTE_ACTUALIZADO

MENSAJE_RECIBIDO

MENSAJE_ENVIADO

IA_RESPONDIO

ASESOR_RESPONDIO

ESTADO_CAMBIADO

ETIQUETA_AGREGADA

ETIQUETA_QUITADA

CAMPAÑA_ASIGNADA

CAMPAÑA_FINALIZADA

CLIENTE_BAJA

NOTIFICACION
```

---

# Notas

Notas manuales.

Nunca generadas automáticamente.

Modelo

```javascript
{
    id,

    fecha,

    autor,

    texto
}
```

---

# Campañas

Cada participación debe registrarse.

Nunca reemplazarse.

Modelo

```javascript
{
    id,

    nombre,

    fechaIngreso,

    fechaSalida,

    resultado,

    observaciones
}
```

---

# Estados

Representan la situación comercial.

Ejemplo

```text
Nuevo

En conversación

Interesado

Esperando respuesta

Seguimiento

Cliente

No interesado

Baja
```

---

# Etiquetas

Las etiquetas clasifican.

Un cliente puede tener múltiples.

Ejemplo

```text
Constructora

Arquitecto

Electricista

Cliente VIP

Google

Instagram

Referido

Campaña Julio

Compra realizada
```

---

# Conversación completa

```text
Cliente

↓

Mensaje recibido

↓

IA analiza

↓

Respuesta enviada

↓

Cliente responde

↓

Asesor interviene

↓

Seguimiento

↓

Venta
```

Todo queda registrado.

---

# Historial

Nunca se elimina.

Nunca se sobrescribe.

Siempre se agrega.

Esto permite:

- auditoría

- métricas

- estadísticas

- reconstrucción completa

---

# Búsquedas

El CRM deberá permitir buscar por:

Nombre

Número

Empresa

Email

Estado

Etiqueta

Campaña

Asesor

Texto contenido en conversaciones

---

# Estadísticas

El CRM deberá poder responder:

Cantidad de clientes.

Clientes nuevos.

Clientes activos.

Clientes por estado.

Clientes por campaña.

Tiempo promedio de respuesta.

Cantidad de mensajes.

Cantidad de conversaciones.

Clientes por origen.

Clientes por asesor.

---

# Reglas

Nunca eliminar conversaciones.

Nunca eliminar eventos.

Nunca eliminar campañas.

Nunca eliminar notas.

Si un cliente solicita eliminación, deberá implementarse mediante un proceso específico de anonimización o borrado controlado.

---

# Futuro

El modelo fue diseñado para soportar:

WhatsApp

Telegram

Instagram

Facebook Messenger

WebChat

Email

Todos compartirán exactamente el mismo historial comercial.

La única diferencia será el canal de comunicación.