# MdI MultiWA

# 14 - ESTRUCTURA DEL PROYECTO

Versión 1.0

---

# Objetivo

Este documento define la estructura oficial de carpetas del proyecto.

Toda nueva funcionalidad deberá respetar esta organización.

Ningún archivo deberá ubicarse en una carpeta incorrecta.

---

# Estructura General

```
MdI MultiWA/

│
├── docs/
├── data/
├── services/
├── routes/
├── views/
├── public/
├── state/
├── utils/
├── middleware/
├── config/
├── logs/
├── sessions/
├── chrome-profiles/
├── uploads/
├── backups/
├── scripts/
├── tests/
│
├── index.js
├── package.json
└── README.md
```

---

# docs/

Documentación oficial.

Nunca contiene código.

Ejemplos

Arquitectura

CRM

Roadmap

ADR

---

# data/

Persistencia.

Actualmente JSON.

Ejemplo

crm-clientes.json

campañas.json

config.json

estadisticas.json

No contiene lógica.

---

# services/

Contiene toda la lógica del negocio.

Ejemplos

session-manager

crm-manager

crm-flow

gemini-service

notification-service

campaign-service

conversation-context

Los servicios pueden comunicarse entre sí únicamente cuando exista una dependencia de negocio claramente definida.

---

# routes/

API REST.

Cada archivo representa un conjunto de endpoints.

Nunca contiene lógica comercial.

Debe delegar inmediatamente en servicios.

---

# state/

Estado temporal.

No persistente.

Nunca almacenar historial.

---

# views/

Interfaz EJS.

No contiene lógica del negocio.

No accede a JSON.

No administra sesiones.

---

# public/

Archivos públicos.

CSS

JavaScript

Imágenes

Fuentes

---

# middleware/

Middleware Express.

Ejemplos

Autenticación

Logs

Errores

Validaciones

---

# utils/

Funciones auxiliares.

No contienen lógica comercial.

Ejemplos

Fechas

UUID

Normalización

Helpers

---

# config/

Configuración del sistema.

Nunca lógica.

---

# logs/

Archivos de log.

Nunca código.

---

# sessions/

LocalAuth.

No editar manualmente.

---

# chrome-profiles/

Perfiles de Chrome.

No compartir con LocalAuth.

---

# uploads/

Archivos cargados.

Excel

CSV

Imágenes

Temporales

---

# backups/

Respaldos automáticos.

CRM

Configuración

Campañas

---

# scripts/

Herramientas administrativas.

Migraciones

Importadores

Conversores

No forman parte del sistema principal.

---

# tests/

Pruebas.

Unitarias.

Integración.

Carga.

---

# Reglas

Cada carpeta posee una única responsabilidad.

Nunca mezclar responsabilidades.

---

# Archivos

Reglas generales

Un archivo.

↓

Una responsabilidad.

---

# Ejemplo

Incorrecto

crm-manager.js

↓

persistencia

↓

socket

↓

gemini

↓

campañas

Correcto

crm-manager

persistencia

crm-flow

negocio

socket-service

socket

---

# Dependencias

Views

↓

Routes

↓

Services

↓

Managers

↓

Persistencia

Nunca al revés.

---

# Futuro

La estructura fue diseñada para permitir agregar nuevos módulos sin reorganizar el proyecto.

Ejemplos

Telegram

Instagram

Email

Dashboard

Facturación

Calendario

API Pública

Cada uno deberá incorporarse respetando esta organización.

---

# Regla Final

Si un archivo nuevo no tiene una carpeta claramente definida, primero deberá revisarse la arquitectura antes de incorporarlo.