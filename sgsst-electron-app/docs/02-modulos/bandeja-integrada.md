# Bandeja Integrada — Módulo de Correo Electrónico

**Versión:** 0.1.120
**Commit:** `📦563` (`aef69d9`)
**Última actualización:** 18 de julio de 2026

---

## 📋 Descripción

La **Bandeja Integrada** es el cliente de correo profesional integrado en K+AIR, basado en Gmail API con cache local SQLite. Permite leer, enviar, responder y organizar correos electrónicos desde la propia aplicación, sin necesidad de abrir Gmail en el navegador.

### Características Principales

- ✅ **OAuth con Google**: Conexión segura con scopes `gmail.readonly` + `gmail.send` + `gmail.compose`
- ✅ **Cache SQLite local**: Lectura instantánea de correos sin llamar a la API cada vez
- ✅ **Gmail-look UI**: Avatares circulares, dots de no-leído, hover actions, body limpio
- ✅ **Thread grouping**: Mensajes del mismo hilo agrupados con colapsado/expandido estilo Gmail
- ✅ **Búsqueda con operadores**: `from:javier`, `to:user@x.com`, `subject:prueba`, `has:attachment`, `after:2026-01-01`, `before:2026-12-31`
- ✅ **Adjuntos reales**: Descarga desde Gmail con iconos por tipo (PDF, Excel, imagen, etc.)
- ✅ **Firma automática**: Configurable desde la Bandeja Integrada, se aplica al enviar (no a forwards)
- ✅ **Sync bidireccional**: Marcar leído/archivar refleja cambios en Gmail real
- ✅ **Auto-refresh**: Sincroniza cada 5 minutos en background (pausa si la pestaña no está visible)
- ✅ **3 formas de salir**: Toggle desde el header, FAB "← Volver", tecla ESC
- ✅ **Coexistencia con K+AIR Calendar**: No reemplaza al calendario existente, convive con él
- ✅ **Cache-bust dinámico**: El iframe recarga automáticamente cuando hay cambios (v=576 → 613)

---

## 🏗️ Arquitectura

### Estructura de Archivos

```
sgsst-electron-app/
├── shared/
│   ├── google-auth.js          # 276 líneas — OAuth2 + PKCE
│   ├── google-tokens.js        # 86 líneas — refresh_token persistence
│   └── google-gmail.js         # 485 líneas — wrapper Gmail API
├── main/
│   ├── email-schema-sql.js     # 136 líneas — schema de 5 tablas
│   ├── email-db.js             # 422 líneas — CRUD SQLite
│   ├── email-sync.js           # 414 líneas — sync desde Gmail
│   ├── db-instance.js          # 21 líneas — singleton de kair.db
│   └── main.js                 # +422 líneas — 9 IPC handlers nuevos
├── preload.js                  # +49 líneas — APIs emailCache + googleGmail
├── renderer/
│   ├── renderer.js             # +388 líneas — iframe + cache-bust
│   ├── bandeja-integrada/
│   │   ├── index.html          # 182 líneas — UI principal
│   │   ├── app.js              # 3,438 líneas — toda la lógica
│   │   ├── styles.css          # 3,298 líneas — BEM Gmail-style
│   │   ├── data.js             # 317 líneas — fallback mocks
│   │   └── README.md           # doc interna del módulo
│   └── index.html              # +14 líneas — botón "Bandeja Integrada"
├── components/
│   └── config/
│       └── config-viewer.html  # +329 líneas — sección Gmail
└── package.json                # +1 línea — googleapis ^173.0.0
```

### 5 Tablas SQLite (kair.db)

```sql
-- email_connections: conexiones OAuth por empresa
CREATE TABLE email_connections (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry_date INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- email_threads: hilos (conversaciones)
CREATE TABLE email_threads (
  id TEXT PRIMARY KEY,
  connection_id TEXT,
  subject TEXT,
  snippet TEXT,
  folder TEXT,  -- 'INBOX', 'SENT', 'DRAFT', etc.
  participants TEXT,  -- JSON
  last_sender_name TEXT,
  last_sender_email TEXT,
  last_message_date INTEGER,
  message_count INTEGER,
  has_unread INTEGER,
  has_attachment INTEGER,
  is_starred INTEGER,
  label_ids TEXT,  -- JSON array
  created_at INTEGER,
  updated_at INTEGER
);

-- email_messages: mensajes individuales
CREATE TABLE email_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  connection_id TEXT,
  from_name TEXT,
  from_email TEXT,
  to_list TEXT,  -- JSON
  cc_list TEXT,
  bcc_list TEXT,
  subject TEXT,
  snippet TEXT,
  body_plain TEXT,
  body_html TEXT,
  date INTEGER,
  references_header TEXT,  -- 'references' es reserved word
  label_ids TEXT,
  is_draft INTEGER,
  is_sent INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- email_labels: etiquetas de Gmail
CREATE TABLE email_labels (
  id TEXT PRIMARY KEY,
  connection_id TEXT,
  name TEXT,
  type TEXT,  -- 'user' o 'system'
  color_background TEXT,
  color_text TEXT,
  message_count INTEGER,
  unread_count INTEGER
);

-- email_attachments: adjuntos
CREATE TABLE email_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT,
  filename TEXT,
  mime_type TEXT,
  size INTEGER,
  attachment_id TEXT,
  created_at INTEGER
);
```

### 9 IPC Handlers Nuevos

| Handler | Descripción |
|---------|-------------|
| `email-cache:sync-inbox` | Sincroniza desde Gmail al cache local |
| `email-cache:get-threads` | Lee threads del cache (instantáneo) |
| `email-cache:get-thread` | Lee un thread completo con sus mensajes |
| `email-cache:get-stats` | Estadísticas (totales para footer) |
| `email-cache:get-labels` | Labels cacheados |
| `email-cache:get-attachments` | Adjuntos de un mensaje |
| `google-gmail:send-message` | Envía correo (Reply/Forward/Nuevo) |
| `google-gmail:list-labels` | Lista labels reales desde Gmail |
| `google-gmail:download-attachment` | Descarga un attachment |
| `google-gmail:mark-read` | Marca mensaje como leído/no leído |
| `google-gmail:archive-thread` | Archiva un thread (remueve INBOX) |

---

## 🎨 UI — BEM Refactor 4 Componentes

### Tokens CSS (en `:root`)

```css
--email-bg: #ffffff;          /* fondo unread */
--email-bg-read: #f2f6fc;     /* fondo leído (Gmail) */
--email-border: #e0e0e0;
--email-text-primary: #202124;
--email-text-secondary: #5f6368;
--email-accent: #1a73e8;      /* azul Gmail */
--email-row-height-min: 48px;
--email-row-padding-v: 12px;
--email-quote-border: #cccccc;
```

### Componente 1 — `.email-row` (fila de bandeja)

Grid 5 columnas: `24px 40px 1fr 90px 24px` (check/dot, avatar, content, date, star).

**Estados:**
- `data-unread="true"`: fondo blanco + sender font-weight 700
- `data-unread="false"`: fondo `#f2f6fc` + sender font-weight 400
- `data-selected="true"`: fondo `#c2dbff` + `inset 3px 0 0 var(--email-accent)`
- `:hover`: shadow + z-index 1 + iconos de acción (archivar, leído, eliminar)

**Backward compat:** mantiene `.kair-mail-row` legacy (no se elimina).

### Componente 2 — `.thread-header` (encabezado de hilo)

Avatar 52x52 + sender name + email + recipients colapsables (con `<details>`/`<summary>` arrow) + meta column con date + action icons.

**REGLA CRÍTICA:** De/Para/Asunto NUNCA como texto suelto en el body. Es header, no body.

### Componente 3 — `.quoted-thread` + `.message-block` (hilos multi-mensaje)

- `.message-block` collapsed (default): avatar 32x32 + name + snippet 1-line ellipsis
- `.message-block--expanded` (solo el último): muestra `.message-block__full` con body completo
- Quoted text indentado: `<blockquote>` con `border-left: 2px solid var(--email-quote-border)`
- **Patrón:** solo el ÚLTIMO mensaje expandido por default, todos los anteriores colapsados

### Componente 4 — `.compose-panel` (modal compose minimizable)

- Bloque `.kair-compose-*` → `.compose-panel*` (full migration, NO backward compat)
- Estructura: `.compose-panel-overlay` > `.compose-panel` > `__titlebar`, `__body`, `__toolbar`, `__footer`
- Titlebar oscuro (`#404040`) con texto blanco, estilo Gmail
- Botones `__btn--minimize`, `__btn--maximize` (toggle), `__btn--close`
- Estado minimizado: `position: fixed; bottom: 0; right: 24px; width: 320px; max-height: 48px`
- ESC inteligente: si minimizado restaura, segundo ESC cierra
- Al minimizar: `document.activeElement.blur()` (no dejar foco invisible)
- Al restaurar: `setTimeout(() => bodyEl.focus(), 100)` (devolver foco al body)
- Soporte nativo de múltiples paneles apilados horizontalmente

---

## 🔌 Flujo de Datos

### Lectura de correos (Bandeja → UI)

```
1. User abre Bandeja Integrada
2. bandeja-integrada/app.js llama api.emailCache.getThreads({ folder: 'INBOX' })
3. main.js → emailDb.getThreadsFromCache() → SQLite
4. Resultado: array de threads mapeados a "mail" objects (threadToMail)
5. UI renderiza la lista con .email-row
6. Auto-refresh cada 5 min: syncInboxInBackground()
7. Si hay nuevos → actualiza state.mails + re-render
```

### Lectura de un correo (open detail)

```
1. User hace click en un .email-row
2. selectMail(mailId) → state.selectedMailId = mailId
3. loadMailBodyFromCache(mail) → api.emailCache.getThread(threadId)
4. emailDb.getMessagesFromCache(threadId) + getAttachmentsByMessage(messageId) por cada mensaje
5. mail.messages = [...] + mail.attachments per msg
6. renderMailDetail(container) → muestra el thread con todos los mensajes
```

### Envío de correo (Reply / Forward / New)

```
1. User click en "Responder" o "Redactar"
2. openComposeModal('reply', mail) → genera HTML del modal
3. Quote del mensaje original se renderiza como bloque visual (NO texto plano)
4. User escribe + click "Enviar"
5. sendComposedMail({ to, cc, subject, body, replyToMail, isReply, isForward, threadId })
6. bodyWithQuote = body + "\n\n" + quotedLines.map('> ' + line).join('\n')
7. bodyWithQuoteAndSignature = bodyWithQuote + (signature ? "\n\n--\n" + signature : "")
8. api.googleGmail.sendMessage({ to, cc, subject, body, threadId })
9. Gmail API: gmail.users.messages.send con raw MIME + base64url
10. Refresh cache INBOX para mostrar el nuevo correo enviado
```

---

## 🔒 Seguridad

- **OAuth con PKCE**: No requiere client_secret en producción
- **Scopes mínimos**: `gmail.readonly` + `gmail.send` + `gmail.compose` (no se pide `gmail.modify` ni full access)
- **Refresh token persistente**: Guardado en `kair.db` (cifrado en producción)
- **Tokens nunca se loguean**: En consola solo aparece `[google-gmail] Error en X: ...`, nunca el token
- **IPC seguro**: `contextBridge` + `contextIsolation` + `nodeIntegration: false` (preload.js)
- **HTML escaping en body**: `renderMailBodyHtml` escapa `<` `>` para evitar XSS en emails maliciosos

---

## 🧪 Tests

| Archivo | Checks | Estado |
|---------|--------|--------|
| `test-compose-bem.js` | 58 | ✅ OK |
| `test-fixes-loop1.js` | 18 | ✅ OK |
| `test-fixes-loop2.js` | 20 | ✅ OK |
| `test-fixes-loop3.js` | 11 | ✅ OK |
| `test-fixes-loop4.js` | 14 | ✅ OK |
| `test-fixes-loop5.js` | 14 | ✅ OK |
| **Total** | **135** | **✅ OK** |

Los tests están en `main/test-*.js` y están en `.gitignore` (no se commitean).

---

## 📖 Uso

### 1. Conectar Gmail

1. Abrir K+AIR → **Configuración** → **Gestión de Empresas** (o ir directo al módulo Bandeja Integrada)
2. Sección "Conexión Gmail" → Click en **Conectar**
3. Se abre el navegador con OAuth de Google
4. Autorizar con tu cuenta Gmail
5. Regresa a la app → "Conectado como: tu@gmail.com"

### 2. Usar la Bandeja Integrada

1. Click en el botón "Bandeja Integrada" del header (icono de sobre)
2. Espera el primer sync (puede tardar 5-10 segundos la primera vez)
3. Verás los 50 correos más recientes de tu inbox
4. Click en un correo → se abre el detalle con todos los mensajes del hilo
5. Click en "Responder" → se abre el modal compose con el quote del mensaje original
6. Escribí tu respuesta → click "Enviar"
7. El correo se envía a través de Gmail API y se actualiza el cache

### 3. Configurar firma

1. Click en el botón **"Firma"** del header de la Bandeja Integrada
2. Se abre un mini modal con un textarea
3. Escribí tu firma (nombre, cargo, teléfono, etc.)
4. Click en **Guardar** → se guarda en `localStorage["kair.emailSignature"]`
5. La próxima vez que envíes un correo, la firma se agrega automáticamente al final
6. NO se aplica a forwards (estándar de correo)

### 4. Buscar con operadores

Escribí en el buscador de la Bandeja Integrada:
- `from:javier` → filtra por remitente
- `has:attachment` → solo correos con adjuntos
- `subject:prueba from:javier` → combinación (ambos deben matchear)
- `after:2026-07-01 before:2026-07-31` → rango de fechas

Cada operador aparece como un **chip removable** arriba del input. Click en la X del chip → ese filtro se quita.

---

## ⚠️ Pendientes (post-v0.1.120)

- **F3.C — Google Calendar write**: Cuando confirmás una invitación a calendario desde la Bandeja Integrada, que se cree el evento en Google Calendar real (no solo local). El backend OAuth ya está listo, falta la integración con Google Calendar API.
- **Refactor total legacy → BEM puro**: Eliminar las clases `kair-mail-row`, `kair-mail-message`, `kair-attachment-chip` (mantener solo las BEM `.email-row`, `.message-block`, `.attachment-chip`). Riesgo de regresión, por eso se hizo backward compat primero.
- **Drag & drop de archivos al compose**: Adjuntar archivos arrastrándolos al modal compose.
- **Undo de archivo**: Snackbar tipo Gmail con "Deshacer" después de archivar.
- **Snooze de correos**: Posponer la aparición de un correo hasta una fecha/hora.
- **Replicar funciones del K+AIR Calendar viejo**: Gantt, drag&drop de eventos, etc. en la Bandeja Integrada.

---

## 🔗 Referencias

- Commit del módulo: `📦563` (`aef69d9`)
- Feature update: [docs/05-updates/v0.1.120-bandeja-integrada.md](v0.1.120-bandeja-integrada.md)
- Changelog: [docs/CHANGELOG.md](../CHANGELOG.md#0120---2026-07-18)
- README del módulo (interna): `renderer/bandeja-integrada/README.md`
- Gmail API: https://developers.google.com/gmail/api
- Google OAuth: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
