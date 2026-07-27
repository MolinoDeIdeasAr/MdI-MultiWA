# MdI MultiWA

# 01 - ARQUITECTURA

Versión 1.0

---

# Objetivo

Este documento define la arquitectura oficial de MdI MultiWA.

Toda nueva funcionalidad deberá integrarse respetando esta arquitectura.

Ningún módulo podrá romper las dependencias aquí definidas.

---

# Arquitectura General

MdI MultiWA está construido mediante una arquitectura en capas.

Cada capa posee una responsabilidad específica.

```

                Usuario
                    │
                    ▼
              Interfaz Web
         (EJS + Bootstrap + JS)
                    │
                    ▼
             Express / Socket.IO
                    │
                    ▼
              Controladores (Routes)
                    │
                    ▼
                 Servicios
                    │
                    ▼
                 Managers
                    │
                    ▼
             Persistencia (JSON)

```

Las dependencias siempre apuntan hacia abajo.

Nunca al revés.

---

# Capas del sistema

## 1. Presentación

Responsable de mostrar información.

Incluye:

- Views
- Bootstrap
- JavaScript
- Socket.IO cliente

No contiene lógica de negocio.

No escribe archivos.

No administra sesiones.

---

## 2. API

Responsable de recibir solicitudes HTTP.

Incluye:

routes/

Cada ruta debe:

- validar parámetros
- llamar servicios
- devolver respuestas

Nunca acceder directamente al JSON.

Nunca contener lógica comercial.

---

## 3. Servicios

Representan la lógica del negocio.

Ejemplos:

- inbound-message-handler
- gemini-service
- crm-flow (nuevo)
- notification-service

Los servicios orquestan procesos.

No administran persistencia.

---

## 4. Managers

Administran recursos permanentes.

Ejemplos:

- session-manager
- crm-manager
- config-manager (futuro)

Los managers son los únicos autorizados a escribir información persistente.

---

## 5. Persistencia

Actualmente:

```

data/

```

Ejemplos:

- crm-clientes.json
- campañas.json
- configuración.json

En el futuro podrá migrarse a SQLite o PostgreSQL sin modificar la capa de servicios.

---

# Componentes principales

## index.js

Responsabilidad:

Inicializar la aplicación.

Debe contener únicamente:

- Express
- Socket.IO
- Middleware
- Rutas
- Restauración automática
- Inicio del servidor

Nunca debe contener lógica comercial.

---

## session-manager.js

Responsabilidad:

Administrar instancias de WhatsApp.

Único lugar autorizado para crear:

new Client()

Responsabilidades:

- LocalAuth
- Chrome Profiles
- Restauración
- Inicio
- Destrucción segura

Nunca debe conocer CRM.

---

## inbound-message-handler.js

Responsabilidad:

Orquestar un mensaje entrante.

Debe:

- validar mensajes
- resolver contacto
- invocar IA
- actualizar estado temporal
- emitir eventos

No debe conocer persistencia.

---

## conversation-context.js (Nuevo)

Representa una conversación en proceso.

Contiene únicamente datos.

No contiene lógica.

Ejemplo:

- cliente
- campaña
- mensaje
- análisis IA
- respuesta
- timestamps

---

## crm-flow.js (Nuevo)

Representa el flujo comercial.

Responsabilidades:

- crear cliente
- actualizar cliente
- guardar conversación
- registrar eventos
- registrar campañas
- registrar bajas

Nunca conoce WhatsApp.

---

## crm-manager.js

Responsabilidad:

Persistencia del CRM.

Debe ser el único módulo que administra:

crm-clientes.json

No conoce Socket.IO.

No conoce IA.

No conoce Express.

---

## state-manager

Responsabilidad:

Estado temporal.

Puede reiniciarse.

No representa el historial.

---

# Flujo de un mensaje

```

WhatsApp

↓

whatsapp-web.js

↓

SessionManager

↓

InboundMessageHandler

↓

ConversationContext

↓

CRMFlow

↓

CRMManager

↓

Persistencia

↓

StateManager

↓

Socket.IO

↓

Frontend

```

---

# Dependencias permitidas

## index.js

Puede importar:

- routes
- session-manager
- Socket.IO

---

## routes

Pueden importar:

- services

Nunca managers directamente.

---

## services

Pueden importar:

- managers

Nunca views.

---

## managers

Pueden importar:

- utilidades
- persistencia

Nunca services.

---

## views

Nunca importan código Node.

---

# Dependencias prohibidas

SessionManager

↓

CRMManager

✘

---

Views

↓

Persistencia

✘

---

Socket.IO

↓

CRM

✘

---

Gemini

↓

Express

✘

---

Routes

↓

JSON

✘

---

# Comunicación entre módulos

Toda comunicación debe realizarse mediante interfaces públicas.

Nunca modificar propiedades internas de otro módulo.

Ejemplo:

Correcto

crm.actualizarDatos()

Incorrecto

crm.clientes[id].estado = ...

---

# Persistencia

Toda escritura debe centralizarse.

Actualmente:

crm-manager

En el futuro:

database-manager

La capa superior nunca debe conocer el mecanismo de almacenamiento.

---

# Objetivo de la arquitectura

Esta arquitectura permite:

- múltiples cuentas
- múltiples usuarios
- CRM permanente
- campañas
- IA
- dashboard
- auditoría
- API REST
- nuevos canales

sin necesidad de reescribir el sistema.

---

# Regla de evolución

Toda nueva funcionalidad deberá responder:

¿En qué capa pertenece?

Si una funcionalidad no tiene una capa claramente definida, la arquitectura deberá revisarse antes de implementarla.

---

# Arquitectura objetivo (v2)

```

                 Frontend
                     │
          Express + Socket.IO
                     │
             Controllers / Routes
                     │
          Conversation Context
                     │
               Business Flows
                     │
      CRM │ IA │ Campañas │ Notificaciones
                     │
                Managers
                     │
          JSON / SQLite / PostgreSQL

```

Esta arquitectura permitirá que MdI MultiWA evolucione hacia un CRM omnicanal sin modificar la estructura general del sistema.