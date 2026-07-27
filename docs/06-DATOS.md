# MdI MultiWA

# 06 - DICCIONARIO DE DATOS

Versión 1.0

---

# Objetivo

Este documento define todos los modelos utilizados por el sistema.

Es la referencia oficial para:

- Persistencia
- API
- CRM
- Frontend
- IA

Toda modificación de un modelo deberá reflejarse primero aquí.

---

# Reglas generales

Todos los modelos deberán cumplir:

- Identificador único.
- Fecha de creación.
- Fecha de modificación.
- Metadata opcional.
- Compatible con JSON y SQL.

---

# CLIENTE

Representa una persona o empresa con la cual existe una relación comercial.

## Tabla de campos

| Campo | Tipo | Obligatorio | Editable | Descripción |
|--------|------|-------------|----------|-------------|
| id | UUID | Sí | No | Identificador único |
| nombre | String | Sí | Sí | Nombre visible del cliente |
| numero | String | Sí | No | Número normalizado |
| numeroWhatsApp | String | Sí | No | Identificador comercial |
| empresa | String | No | Sí | Empresa del cliente |
| email | String | No | Sí | Correo electrónico |
| rubro | String | No | Sí | Rubro comercial |
| origen | String | Sí | Sí | Canal de adquisición |
| estado | Enum | Sí | Sí | Estado comercial |
| etiquetas | Array | No | Sí | Clasificación |
| asesor | String | No | Sí | Responsable asignado |
| fechaAlta | Date | Sí | No | Alta del cliente |
| ultimaActividad | Date | Sí | No | Última interacción |
| conversaciones | Array | Sí | No | Historial completo |
| eventos | Array | Sí | No | Eventos del CRM |
| notas | Array | Sí | Sí | Notas manuales |
| historialCampanias | Array | Sí | No | Campañas históricas |
| metadata | Object | No | Sí | Datos adicionales |

---

# CONVERSACIÓN

Representa un mensaje del historial.

## Modelo

| Campo | Tipo | Obligatorio | Descripción |
|--------|------|-------------|-------------|
| id | UUID | Sí | Identificador |
| fecha | Date | Sí | Fecha del mensaje |
| direccion | Enum | Sí | IN / OUT |
| autor | Enum | Sí | Cliente / IA / Asesor / Sistema |
| tipo | Enum | Sí | Texto, imagen, audio... |
| mensaje | String | Sí | Contenido |
| instanceId | String | Sí | Instancia WhatsApp |
| campaignId | String | No | Campaña origen |
| chatId | String | Sí | Chat WhatsApp |
| messageId | String | Sí | ID WhatsApp |
| modeloIA | String | No | Modelo utilizado |
| intencion | String | No | Intención detectada |
| estadoIA | String | No | Resultado IA |
| metadata | Object | No | Información adicional |

---

# EVENTO

Representa una acción del negocio.

| Campo | Tipo | Obligatorio |
|--------|------|-------------|
| id | UUID | Sí |
| fecha | Date | Sí |
| tipo | Enum | Sí |
| descripcion | String | Sí |
| usuario | String | No |
| metadata | Object | No |

---

# NOTA

Representa una observación manual.

| Campo | Tipo |
|--------|------|
| id | UUID |
| fecha | Date |
| autor | String |
| texto | String |

---

# CAMPAÑA

Representa una participación del cliente.

| Campo | Tipo |
|--------|------|
| id | UUID |
| nombre | String |
| fechaIngreso | Date |
| fechaSalida | Date |
| resultado | String |
| observaciones | String |

---

# ESTADOS

Valores permitidos.

```text
NUEVO

EN_CONVERSACION

INTERESADO

SEGUIMIENTO

CLIENTE

NO_INTERESADO

PAUSADO

BAJA
```

---

# ETIQUETAS

Las etiquetas son dinámicas.

Ejemplos

```text
VIP

Google

Instagram

Arquitecto

Constructora

Electricista

Compra

Seguimiento

Referido
```

---

# ORÍGENES

```text
WhatsApp

Campaña

Google

Instagram

Facebook

Manual

Importación

API

Referido
```

---

# TIPOS DE MENSAJE

```text
texto

imagen

audio

video

documento

sticker

ubicacion

contacto

reaccion

encuesta

desconocido
```

---

# AUTORES

```text
CLIENTE

IA

ASESOR

SISTEMA
```

---

# DIRECCIONES

```text
IN

OUT
```

---

# RELACIONES

```text
Empresa

↓

Instancias

↓

Campañas

↓

Clientes

↓

Conversaciones

↓

Eventos

↓

Notas
```

---

# Índices recomendados (SQLite/PostgreSQL)

Cuando el CRM migre a SQL, se recomienda indexar:

## Cliente

- numeroWhatsApp (UNIQUE)
- estado
- empresa
- asesor
- ultimaActividad
- fechaAlta

## Conversaciones

- clienteId
- fecha
- campaignId
- instanceId
- messageId

## Eventos

- clienteId
- tipo
- fecha

---

# Convenciones

Fechas

ISO 8601

Ejemplo

2026-07-20T15:42:18.000Z

---

UUID

Versión 4

---

Strings

UTF-8

---

Números

Siempre normalizados

Ejemplo

5493515551234

Nunca

+54 351 555-1234

---

# Compatibilidad

Este modelo fue diseñado para ser compatible con:

✔ JSON

✔ SQLite

✔ PostgreSQL

✔ MySQL

✔ MongoDB

sin modificar la lógica del negocio.

---

# Regla Final

Este documento es el contrato entre:

- CRMFlow
- CRMManager
- API
- Frontend
- Persistencia

Ningún modelo podrá modificarse sin actualizar previamente este documento.