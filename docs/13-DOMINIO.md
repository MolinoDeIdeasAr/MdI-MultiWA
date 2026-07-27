# MdI MultiWA

# 13 - DOMINIO

Versión 1.0

---

# Objetivo

Este documento define el lenguaje oficial del proyecto.

Cada palabra utilizada dentro del código deberá representar exactamente el mismo concepto.

No deberán existir sinónimos para una misma entidad.

Ejemplo:

✔ cliente

✘ usuario

✘ persona

✘ lead

✘ contacto (cuando ya es cliente)

---

# Dominio General

MdI MultiWA es un CRM orientado a conversaciones comerciales.

El dominio principal está compuesto por:

Empresa

↓

Instancias WhatsApp

↓

Campañas

↓

Clientes

↓

Conversaciones

↓

Eventos

↓

Asesores

↓

Automatizaciones

---

# Empresa

Representa la organización propietaria de una o más instancias.

Ejemplo

Molino de Ideas

Cliente X

Cliente Y

Una empresa puede administrar múltiples instancias.

---

# Instancia

Una instancia representa una cuenta individual de WhatsApp.

Ejemplos

+54 351 1111111

+54 351 2222222

Cada instancia posee:

- Session
- LocalAuth
- Chrome Profile
- Configuración
- Estado
- Campañas

---

# Sesión

Representa la autenticación técnica de una instancia.

Una sesión nunca representa un cliente.

Una sesión nunca representa una conversación.

Responsabilidad:

Mantener conectada una instancia.

---

# Cliente

Representa una persona o empresa con la cual existe una relación comercial.

El cliente es permanente.

Nunca desaparece automáticamente.

Se identifica únicamente por:

numeroWhatsApp

No por el nombre.

---

# Contacto

Un contacto es información obtenida desde:

agenda

Excel

Google

CRM externo

El contacto todavía puede no haber interactuado.

Cuando existe conversación pasa a convertirse en Cliente.

---

# Conversación

Representa el historial cronológico de mensajes.

Contiene únicamente mensajes.

Nunca acciones administrativas.

Puede contener mensajes:

Cliente

IA

Asesor

Sistema

---

# Mensaje

Unidad mínima de comunicación.

Un mensaje posee:

contenido

autor

fecha

tipo

dirección

metadata

---

# Evento

Representa una acción importante del negocio.

Ejemplos

Cliente creado

Estado cambiado

Etiqueta agregada

Campaña asignada

Cliente dado de baja

Notificación enviada

Los eventos permiten reconstruir la historia comercial.

---

# Nota

Comentario manual realizado por un asesor.

Nunca generado automáticamente.

Nunca enviado al cliente.

---

# Campaña

Conjunto de acciones comerciales dirigidas a múltiples clientes.

Una campaña posee:

nombre

fecha

estado

objetivo

clientes

Una conversación puede pertenecer a una campaña.

Un cliente puede participar en muchas campañas.

---

# Estado

Representa la situación comercial actual del cliente.

Ejemplo

Nuevo

En conversación

Interesado

Seguimiento

Cliente

No interesado

Baja

El estado siempre representa el presente.

---

# Etiqueta

Clasificación auxiliar.

Puede haber múltiples.

Ejemplos

VIP

Arquitecto

Constructora

Google

Instagram

Compra realizada

Las etiquetas no representan estados.

---

# Asesor

Usuario humano que interviene comercialmente.

Puede:

Responder.

Agregar notas.

Cambiar estados.

Asignar etiquetas.

Nunca administra sesiones.

---

# IA

Motor de Inteligencia Artificial.

Responsabilidades

Analizar.

Clasificar.

Responder.

Sugerir.

Nunca modifica directamente el CRM.

Toda modificación pasa por CRMFlow.

---

# CRM

Representa el historial permanente.

Es la memoria del sistema.

Nunca representa el estado temporal.

---

# StateManager

Representa únicamente información operativa.

Puede reiniciarse.

Puede vaciarse.

Puede reconstruirse.

Nunca reemplaza al CRM.

---

# ConversationContext

Representa una conversación en proceso.

No es persistente.

Existe únicamente mientras se procesa un mensaje.

---

# CRMFlow

Representa el flujo de negocio.

No representa almacenamiento.

No representa WhatsApp.

Representa decisiones comerciales.

---

# CRMManager

Representa la persistencia.

Nunca contiene lógica comercial.

---

# SessionManager

Representa la administración de instancias WhatsApp.

Nunca conoce el CRM.

---

# Socket

Representa comunicación con la interfaz.

Nunca modifica información.

---

# Frontend

Representa únicamente visualización.

Nunca implementa lógica comercial.

---

# Relaciones del dominio

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

Mensajes

↓

Eventos

↓

Notas

---

# Reglas del lenguaje

Una palabra debe tener un único significado.

Ejemplo

Cliente

Siempre significa Cliente.

Nunca Lead.

Nunca Usuario.

Nunca Persona.

---

Una entidad debe tener un único responsable.

Ejemplo

CRMManager

Persistencia.

CRMFlow

Negocio.

SessionManager

WhatsApp.

---

No utilizar nombres ambiguos.

Evitar:

data

info

obj

tmp

user

contact

lead

persona

Usar nombres del dominio.

cliente

campania

instancia

conversacion

evento

nota

asesor

---

# Lenguaje oficial

A partir de este documento, todas las clases, servicios, rutas y modelos deberán utilizar este vocabulario.

Si aparece un nuevo concepto del negocio, deberá agregarse primero aquí y luego implementarse en el código.

El dominio es la fuente oficial del lenguaje del proyecto.