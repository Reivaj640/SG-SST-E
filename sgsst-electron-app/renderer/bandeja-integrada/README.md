# Bandeja Integrada — Correo + Calendario

**K+AIR · Bandeja Integrada v0.1.119** (📦563)
Estado: F1 — UI vanilla con mocks de datos. Pendiente F2 (IPC real) y F3 (Google APIs).

## Que es

Vista unificada que combina en una sola pantalla:

- **Mini-calendario** (sidebar izquierdo, Julio 2026) con grilla mensual y tipos de evento coloreados.
- **Bandeja de entrada** con filtros Todos / No leidos / Marcados / Reuniones.
- **Detalle de correo** al estilo Gmail (avatar, remitente, adjuntos, reply/reply-all/forward).
- **Calendario mensual / semanal / diario** que se desliza sobre la bandeja como overlay.
- **4 KPI cards** superiores: correos no leidos, reuniones de hoy, invitaciones pendientes, eventos criticos.
- **Drag & drop** correo → fecha del calendario para crear evento rapido.

## Como se accede

Hay un boton nuevo en el header principal de K+AIR (entre el boton de calendario y el de actualizar):

```
[calendario] [📬 Bandeja Integrada] [actualizar] [config] [chat]
```

Click → abre un iframe fullscreen con este modulo. El boton **Volver** del header de Bandeja Integrada
cierra el iframe y restaura la vista principal.

## Coexistencia con el calendario actual

Este modulo es **ADITIVO**, no reemplaza nada:

- El calendario popover del header (`#calendar-button` → `shared/kair-calendar.js`) sigue funcionando igual.
- Bandeja Integrada es una vista aparte que se abre en un iframe fullscreen.
- Si Bandeja Integrada esta cerrada, el calendario original se ve como siempre.
- Si Bandeja Integrada esta abierta, el calendario original queda debajo (no se pierde, solo se oculta).

## Arquitectura

```
renderer/bandeja-integrada/
  index.html   — markup estatico, sin frameworks
  styles.css   — BEM aislado con prefijo kair-* (248 clases, 231 variables)
  app.js       — logica vanilla (IIFE, ~1000 lineas)
  data.js      — mocks de datos (window.KairData). Sera reemplazado por IPC en F2.
```

### Convenciones

- **Prefijo CSS `kair-*`**: evita colision con el `styles.css` global de 192 KB.
- **Tokens en `:root`**: colores, espaciados, radios, sombras centralizados.
- **Sin frameworks**: vanilla JS puro. Cero dependencias externas.
- **Sin emojis en el codigo** (regla del proyecto).
- **IPC pendiente**: en produccion, `KairData` se reemplaza por `window.kairAPI.mail.*` y `window.kairAPI.calendar.*`.

## Proximos pasos (F2 → F4)

- **F2 (📦564)**: Reemplazar `window.KairData` por IPC real (`window.kairAPI`). Agregar handlers en
  main.js: `mail:list`, `mail:markRead`, `calendar:listEvents`, `calendar:createEvent`. Tests.
- **F3 (📦565)**: Conectar Google Calendar + Gmail. OAuth2 (client_id ya configurado en Google Cloud
  project "KAIR Calendar Sync"). Persistir tokens cifrados en `config.json`. Tests.
- **F4 (📦566)**: Polish + actualizacion de CHANGELOG / START_HERE / README. Manual de usuario.

## Restriccion dura

> "no perder las funcionalidades que ya tenemos en el calendario actual"

Cumplido: Bandeja Integrada es aditiva, no toca `shared/kair-calendar.js` ni `shared/kair-calendar-adapter.js`.
El calendario popover original sigue funcionando desde el boton `#calendar-button` del header.
