# PRINCIPIOS FUNDAMENTALES

## Constitución Técnica de MdI MultiWA

Versión 1.0

---

# Introducción

Este documento define los principios inalterables sobre los cuales se construye MdI MultiWA.

No describe una implementación específica.

Describe la filosofía de diseño que deberá respetarse durante toda la vida del proyecto.

Si alguna modificación entra en conflicto con estos principios, deberá justificarse mediante un ADR (Architecture Decision Record) antes de ser implementada.

---

# PRINCIPIO 1

## Una responsabilidad por módulo

Cada módulo debe tener una única responsabilidad claramente definida.

Un archivo que realiza múltiples tareas termina siendo difícil de mantener.

Ejemplos:

✔ session-manager administra sesiones.

✔ crm-manager administra persistencia.

✔ inbound-message-handler orquesta mensajes.

✘ Un módulo nunca debe administrar sesiones, CRM e IA al mismo tiempo.

---

# PRINCIPIO 2

## El flujo siempre debe ser explícito

Toda la información debe recorrer el sistema siguiendo un flujo claro.

Nunca deben existir modificaciones ocultas.

Flujo esperado:

WhatsApp

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

---

# PRINCIPIO 3

## El CRM nunca pierde información

Toda conversación debe poder recuperarse.

Nunca eliminar automáticamente:

- clientes
- conversaciones
- campañas
- eventos
- notas

La información histórica tiene prioridad sobre el ahorro de espacio.

---

# PRINCIPIO 4

## El StateManager es temporal

El StateManager representa únicamente el estado operativo actual.

Puede reiniciarse.

Puede vaciarse.

Puede reconstruirse.

Nunca debe utilizarse como historial permanente.

---

# PRINCIPIO 5

## El CRM es la única fuente histórica

Toda información permanente pertenece al CRM.

No debe existir otra copia histórica distribuida en distintos módulos.

---

# PRINCIPIO 6

## Desacoplamiento

Los módulos deben conocer únicamente aquello que necesitan.

Ejemplos:

CRMManager no conoce WhatsApp.

ConversationContext no conoce JSON.

SessionManager no conoce IA.

Views no conocen persistencia.

Socket.IO no conoce el CRM.

---

# PRINCIPIO 7

## Las dependencias siempre apuntan hacia abajo

Nunca deben existir dependencias circulares.

La dirección correcta es:

Interfaz

↓

Servicios

↓

Managers

↓

Persistencia

Nunca al revés.

---

# PRINCIPIO 8

## Persistencia centralizada

Toda escritura debe pasar por un manager.

Ejemplos:

crm-manager

config-manager

session-manager

Nunca escribir archivos directamente desde rutas, vistas o servicios.

---

# PRINCIPIO 9

## Ningún módulo debe conocer detalles innecesarios

CRMFlow no conoce WhatsApp.

CRMManager no conoce Socket.IO.

Gemini no conoce campañas.

SessionManager no conoce CRM.

Cada módulo trabaja únicamente con su dominio.

---

# PRINCIPIO 10

## Toda modificación importante debe documentarse

Antes de modificar la arquitectura:

1. Analizar.

2. Documentar.

3. Aprobar.

4. Implementar.

Nunca al revés.

---

# PRINCIPIO 11

## La simplicidad tiene prioridad

Una solución sencilla siempre será preferible a una solución compleja.

La arquitectura debe poder explicarse fácilmente.

Si una implementación necesita demasiadas excepciones, probablemente deba rediseñarse.

---

# PRINCIPIO 12

## Todo debe ser reemplazable

Ningún componente debe impedir futuras migraciones.

Ejemplos:

JSON → SQLite

Gemini → OpenAI

WhatsApp → Telegram

Bootstrap → React

El resto del sistema debería requerir cambios mínimos.

---

# PRINCIPIO 13

## El código debe expresar intención

El nombre de módulos, clases y funciones debe describir claramente su propósito.

Se prioriza la legibilidad sobre la brevedad.

---

# PRINCIPIO 14

## Eventos antes que efectos secundarios

Cuando ocurra una acción importante, el sistema debe registrarla como un evento de negocio.

Ejemplos:

Cliente creado.

Mensaje recibido.

Respuesta enviada.

Estado cambiado.

Campaña asignada.

Cliente dado de baja.

Los eventos permiten auditoría, métricas y reconstrucción del historial.

---

# PRINCIPIO 15

## Arquitectura antes que funcionalidad

Agregar una funcionalidad rápidamente nunca debe comprometer la arquitectura.

Es preferible invertir más tiempo en diseñar correctamente que incorporar deuda técnica.

---

# Regla Final

Toda nueva funcionalidad deberá responder afirmativamente estas preguntas:

• ¿Respeta los principios del proyecto?

• ¿Tiene una única responsabilidad?

• ¿Está desacoplada?

• ¿Es escalable?

• ¿Es mantenible?

• ¿Está documentada?

Si alguna respuesta es negativa, la implementación debe replantearse antes de incorporarse al sistema.

---

"La arquitectura es una inversión. El código cambia todos los días; la arquitectura permanece durante años."