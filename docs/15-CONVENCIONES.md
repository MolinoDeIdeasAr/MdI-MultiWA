# MdI MultiWA

# 15 - CONVENCIONES DE DESARROLLO

Versión 1.0

---

# Objetivo

Este documento establece las reglas de programación del proyecto.

Todo nuevo código deberá respetar estas convenciones.

El objetivo es que todo el proyecto parezca escrito por una única persona.

---

# Filosofía

Se prioriza:

- claridad
- simplicidad
- mantenibilidad
- consistencia

sobre:

- código ingenioso
- abreviaturas
- optimizaciones prematuras

---

# Idioma

Toda la lógica del negocio utilizará español.

Ejemplo

cliente

campania

conversacion

evento

estado

etiqueta

asesor

instancia

---

Variables técnicas podrán mantenerse en inglés cuando pertenezcan a librerías.

Ejemplo

client

socket

message

request

response

---

# Archivos

Todos los archivos utilizarán:

kebab-case

Ejemplos

crm-manager.js

session-manager.js

conversation-context.js

campaign-service.js

notification-service.js

---

# Carpetas

Siempre en minúsculas.

Nunca espacios.

Nunca acentos.

---

# Clases

Siempre PascalCase.

Ejemplo

CRMFlow

ConversationContext

CampaignService

NotificationService

---

# Funciones

camelCase

Ejemplo

obtenerCliente()

guardarConversacion()

normalizarNumero()

registrarEvento()

---

# Variables

camelCase

Nunca:

tmp

obj

aux

data

info

test

foo

bar

---

Usar nombres del dominio.

cliente

campania

mensaje

evento

respuestaIA

estado

---

# Constantes

MAYÚSCULAS

Ejemplo

MAX_REINTENTOS

DEFAULT_TIMEOUT

TIPOS_EVENTO

---

# Enumeraciones

Siempre MAYÚSCULAS.

Ejemplo

CLIENTE

IA

ASESOR

SISTEMA

---

# Strings mágicos

Prohibidos.

Nunca escribir:

"NUEVO"

"CLIENTE"

"VIP"

directamente.

Siempre utilizar constantes.

---

# async / await

Siempre utilizar async/await.

No mezclar con then().

Incorrecto

cliente.then()

Correcto

await obtenerCliente()

---

# Promesas

Toda promesa deberá manejar errores.

Nunca ignorar catch.

---

# try/catch

Todo acceso externo deberá estar protegido.

Ejemplos

JSON

WhatsApp

Gemini

Socket

Filesystem

---

# Return

Una función debe devolver un único tipo de dato.

Nunca:

sometimes string

sometimes bool

sometimes object

---

# Eventos Socket

Todos los eventos utilizarán snake_case.

Ejemplo

mensaje_recibido

crm_actualizado

cliente_modificado

estado_actualizado

---

# API REST

GET

Consultar.

POST

Crear.

PUT

Reemplazar.

PATCH

Modificar parcialmente.

DELETE

Eliminar.

---

# Logs

Formato

[NIVEL] [MÓDULO] mensaje

Ejemplo

[INFO][CRM]

Cliente actualizado

---

[ERROR][SESSION]

No fue posible iniciar Chrome

---

# Manejo de errores

Nunca ocultar errores.

Registrar.

Propagar.

Responder.

---

# Comentarios

Comentar únicamente:

decisiones

algoritmos

casos especiales

Nunca comentar código evidente.

Incorrecto

// suma uno

i++

---

# Imports

Orden

Node

↓

Dependencias

↓

Proyecto

↓

Locales

---

# JSON

Nunca acceder directamente.

Siempre utilizar Managers.

Incorrecto

readFileSync()

Correcto

crmManager.obtenerCliente()

---

# UUID

Siempre UUID v4.

Nunca IDs incrementales.

---

# Fechas

Siempre ISO 8601.

Nunca formatos regionales.

---

# Números telefónicos

Siempre normalizados.

Ejemplo

5493515551234

Nunca

+54 351 5551234

0351 5551234

3515551234

---

# IA

La IA nunca modifica directamente:

CRM

StateManager

JSON

Socket

La IA únicamente devuelve análisis.

---

# WhatsApp

new Client()

solo podrá existir en

session-manager.js

---

# Managers

Los Managers nunca conocen:

Express

Views

Socket

Bootstrap

---

# Services

Los Services nunca escriben JSON.

Siempre delegan.

---

# Views

Nunca contienen lógica comercial.

Nunca leen archivos.

Nunca llaman managers.

---

# Regla de Oro

Cuando exista una duda sobre dónde escribir código:

Primero revisar la arquitectura.

Luego implementar.

Nunca al revés.

---

# Objetivo Final

Que cualquier desarrollador pueda abrir cualquier archivo del proyecto y reconocer inmediatamente:

- el estilo
- la estructura
- las responsabilidades
- la arquitectura

sin necesidad de preguntar.