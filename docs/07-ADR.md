# MdI MultiWA

# 07 - Architecture Decision Records (ADR)

Versión 1.0

---

# ¿Qué es un ADR?

Un Architecture Decision Record (ADR) documenta una decisión importante de arquitectura.

No explica cómo funciona el sistema.

Explica por qué se tomó una decisión.

Cada ADR contiene:

- Problema
- Contexto
- Alternativas evaluadas
- Decisión
- Consecuencias

---

# Estado de un ADR

Un ADR puede encontrarse en uno de los siguientes estados.

Propuesto

Aceptado

Reemplazado

Obsoleto

---

# Plantilla

Cada nuevo ADR deberá utilizar el siguiente formato.

---

## ADR-XXX

Estado:

Fecha:

Autor:

### Problema

...

### Alternativas

...

### Decisión

...

### Consecuencias

...

---

# ADR-001

## Centralizar la creación de Client()

Estado

Aceptado

Fecha

Julio 2026

---

### Problema

Inicialmente existían distintos lugares capaces de crear un nuevo Client() de whatsapp-web.js.

Esto generaba riesgo de sesiones duplicadas, comportamientos inconsistentes y dificultad para restaurar instancias.

---

### Alternativas

Crear Client() desde cualquier servicio.

Crear una fábrica global.

Centralizar la creación.

---

### Decisión

Toda instancia de WhatsApp será creada exclusivamente desde:

services/session-manager.js

Ningún otro módulo podrá ejecutar:

new Client()

---

### Consecuencias

✔ Restauración consistente.

✔ Control de sesiones.

✔ Mejor mantenimiento.

✔ Menor acoplamiento.

---

# ADR-002

## Separar LocalAuth de Chrome Profile

Estado

Aceptado

Fecha

Julio 2026

---

### Problema

LocalAuth y el perfil de Chrome compartían la misma carpeta.

Esto provocaba bloqueos, corrupción de perfiles y errores durante la restauración.

---

### Decisión

Separar completamente ambos directorios.

sessions/

chrome-profiles/

---

### Consecuencias

✔ Restauraciones más estables.

✔ Menor corrupción.

✔ Eliminación segura de instancias.

---

# ADR-003

## CRM Permanente

Estado

Aceptado

Fecha

Julio 2026

---

### Problema

El historial dependía del StateManager.

Al finalizar una campaña toda la información desaparecía.

---

### Decisión

Crear un CRM permanente.

services/crm-manager.js

data/crm-clientes.json

El CRM conserva toda la historia del cliente.

---

### Consecuencias

✔ Historial permanente.

✔ Conversaciones recuperables.

✔ Métricas históricas.

✔ Base para CRM Web.

---

# ADR-004

## StateManager Temporal

Estado

Aceptado

Fecha

Julio 2026

---

### Problema

El StateManager mezclaba estado temporal e historial.

---

### Decisión

Separar responsabilidades.

StateManager

↓

Estado operativo.

CRM

↓

Historial permanente.

---

### Consecuencias

El sistema puede reiniciarse sin perder clientes.

---

# ADR-005

## Introducción de ConversationContext

Estado

Propuesto

---

### Problema

InboundMessageHandler concentra demasiadas variables de trabajo.

Cada nueva funcionalidad incrementa el acoplamiento.

---

### Decisión

Crear un objeto ConversationContext que represente toda la conversación en proceso.

El contexto contendrá:

- cliente

- contacto

- mensaje

- campaña

- IA

- respuesta

- timestamps

- metadata

---

### Consecuencias

✔ Menor acoplamiento.

✔ Reutilización.

✔ Mejor testing.

✔ Preparación para nuevos canales.

---

# ADR-006

## Introducción de CRMFlow

Estado

Propuesto

---

### Problema

InboundMessageHandler conoce demasiados detalles del CRM.

---

### Decisión

Crear una capa CRMFlow.

Será responsable de:

- crear clientes

- registrar conversaciones

- registrar eventos

- actualizar estados

- registrar campañas

---

### Consecuencias

El Handler dejará de conocer la implementación del CRM.

---

# ADR-007

## CRMManager como única puerta de acceso

Estado

Aceptado

---

### Problema

Cualquier módulo podría modificar crm-clientes.json.

---

### Decisión

Toda lectura y escritura del CRM deberá pasar por:

crm-manager.js

---

### Consecuencias

✔ Persistencia centralizada.

✔ Validaciones únicas.

✔ Migración futura a SQLite sin modificar el resto del sistema.

---

# ADR-008

## Arquitectura por capas

Estado

Aceptado

---

### Decisión

Toda funcionalidad deberá pertenecer a una de las siguientes capas.

Presentación

↓

API

↓

Servicios

↓

Managers

↓

Persistencia

Las dependencias siempre apuntarán hacia abajo.

Nunca existirán dependencias circulares.

---

# ADR-009

## Persistencia desacoplada

Estado

Propuesto

---

### Problema

Actualmente el almacenamiento utiliza JSON.

---

### Decisión

Toda la lógica del negocio deberá desconocer el mecanismo de persistencia.

Esto permitirá migrar posteriormente a:

SQLite

MySQL

PostgreSQL

sin modificar los servicios.

---

### Consecuencias

Mayor escalabilidad.

Mayor mantenibilidad.

---

# Reglas

Todo cambio importante deberá generar un nuevo ADR.

Nunca eliminar un ADR.

Si una decisión cambia:

crear un nuevo ADR.

Nunca modificar el anterior.

Los ADR representan la historia arquitectónica del proyecto.

---

"La arquitectura no solo consiste en tomar buenas decisiones.

También consiste en recordar por qué fueron tomadas."