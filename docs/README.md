# MdI MultiWA

> Plataforma CRM Multiusuario y Multiinstancia para WhatsApp con Inteligencia Artificial.

---

# ¿Qué es MdI MultiWA?

MdI MultiWA es una plataforma desarrollada por Molino de Ideas para administrar múltiples cuentas de WhatsApp desde un único servidor.

El sistema combina:

- WhatsApp Multiinstancia
- CRM Permanente
- Automatización Comercial
- Campañas Masivas
- Inteligencia Artificial
- Administración Multiusuario
- Dashboard Operativo

Su objetivo es convertirse en una plataforma CRM especializada en conversaciones comerciales, donde toda interacción con un cliente quede registrada y pueda ser reutilizada en cualquier momento.

---

# Objetivos

MdI MultiWA busca resolver uno de los principales problemas de la comunicación comercial por WhatsApp:

- pérdida del historial
- conversaciones dispersas
- campañas aisladas
- falta de seguimiento
- ausencia de métricas
- automatizaciones limitadas

El sistema transforma cada conversación en información permanente del cliente.

---

# Principios

Toda la arquitectura del proyecto se basa en los siguientes principios.

- Una única responsabilidad por módulo.
- Desacoplamiento entre componentes.
- Persistencia permanente del CRM.
- Escalabilidad.
- Código mantenible.
- Arquitectura documentada.

---

# Arquitectura General

```
WhatsApp
      │
      ▼
whatsapp-web.js
      │
      ▼
Session Manager
      │
      ▼
Inbound Message Handler
      │
      ▼
Conversation Context
      │
      ▼
CRM Flow
      │
      ▼
CRM Manager
      │
      ▼
Persistencia
```

---

# Documentación

Toda la documentación oficial se encuentra en esta carpeta.

| Documento | Descripción |
|------------|-------------|
| 00-VISION | Visión del proyecto |
| 01-ARQUITECTURA | Arquitectura general |
| 02-FLUJOS | Flujos internos |
| 03-CRM | Diseño completo del CRM |
| 04-ESTANDARES | Reglas de programación |
| 05-ROADMAP | Evolución prevista |
| 06-DATOS | Modelos de datos |
| 07-ADR | Decisiones de arquitectura |
| 08-API | API REST y Socket.IO |
| 09-IA | Integración con IA |
| 10-SEGURIDAD | Seguridad |
| 11-NO-HACER | Prácticas prohibidas |
| 12-PRINCIPIOS | Constitución técnica |

---

# Regla de Desarrollo

Antes de implementar una nueva funcionalidad:

1. Definir la arquitectura.
2. Documentarla.
3. Implementarla.
4. Actualizar la documentación.

La documentación representa la fuente oficial de diseño del proyecto.

---

# Estado del Proyecto

Actualmente el proyecto se encuentra en proceso de evolución desde un administrador de múltiples cuentas de WhatsApp hacia un CRM comercial completo con Inteligencia Artificial.

La arquitectura fue diseñada para permitir esta evolución sin necesidad de reescribir el sistema.

---

# Licencia

Desarrollado por Molino de Ideas.

Todos los derechos reservados.