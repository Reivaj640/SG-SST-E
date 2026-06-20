# Spec: Pantalla de Carga Animada K+AIR

**Fecha:** 2026-04-22  
**Estado:** Aprobado  
**Versión:** 1.0

---

## Contexto

K+AIR actualmente lanza la ventana principal (`index.html`, 1200×700) directamente desde `app.whenReady()` sin ninguna pantalla de carga. El usuario ve la ventana vacía o parcialmente cargada durante el arranque. Este spec describe la implementación de una pantalla de carga animada profesional que se muestra antes que la ventana principal, siguiendo el sistema visual oficial de K+AIR.

---

## Objetivo

Implementar `KairLoadingController` — una pantalla de carga animada en una `BrowserWindow` separada (500×600, sin borde, centrada) que:
1. Se muestra inmediatamente al lanzar la app
2. Corre una simulación progresiva de ~6.9 segundos
3. Se cierra automáticamente al completar, momento en que aparece la ventana principal
4. El usuario nunca ve la ventana principal vacía

---

## Archivos a crear / modificar

| Archivo | Acción | Descripción |
|---|---|---|
| `loading/loading.html` | CREAR | Animación completa autocontenida (HTML + CSS + JS embebido) |
| `loading/preload-loading.js` | CREAR | Puente IPC mínimo exclusivo para la ventana de carga |
| `main.js` | MODIFICAR | Agregar `createLoadingWindow()` y ajustar `app.whenReady()` |

`preload.js`, `renderer.js`, `styles.css`, `index.html` y todos los módulos: **no se tocan**.

---

## Arquitectura

```
app.whenReady()
    ↓
createLoadingWindow()   ← ventana 500×600, frameless, centrada, show: true
    ↓ (paralelo)
createWindow()          ← ventana principal 1200×700, show: false
    ↓
loading.html ejecuta KairLoadingController.startSimulation()
    ↓ (~6.9s)
window.dispatchEvent('kair-loading-complete')
    ↓
preload-loading.js → ipcRenderer.send('loading-complete')
    ↓
ipcMain.on('loading-complete') → loadingWindow.close() + mainWindow.show()
```

---

## Clase KairLoadingController (spec exacta del usuario)

### Constructor
- Recibe `messages` (array de objetos `{main, sub}`)
- Inicializa: `progress = 0`, `messageIndex = 0`, `isComplete = false`
- Cachea refs DOM: `.progress-fill`, `.message-primary`, `.message-secondary`
- Llama `startSimulation()` automáticamente

### Métodos

| Método | Firma | Comportamiento |
|---|---|---|
| `setProgress(value)` | `value: Number (0-100)` | Clamp 0-100, actualiza `width` de `.progress-fill`, llama `updateProgress()` |
| `advanceMessage()` | — | Incrementa `messageIndex` (circular), llama `updateMessage()` |
| `updateMessage()` | — | Fade out (opacity 0) → 200ms → cambia texto → fade in (opacity 1) |
| `setMessage(main, sub)` | `main: String, sub: String` | setTimeout 200ms → asigna texto → opacity 1 |
| `complete()` | — | Guard `isComplete`, opacity 0 + scale(0.98) en `.loading-container`, dispatch `kair-loading-complete` |
| `showError(msg)` | `msg?: String` | Color rojo, pausa `.spinner-ring` / `.accent-dot` / `.particle`, barra roja |
| `reset()` | — | Restaura todos los valores iniciales y opacity/transform del contenedor |

### startSimulation() — pasos exactos

```javascript
const steps = [
  { delay: 400,  target: 15 },
  { delay: 800,  target: 30 },
  { delay: 600,  target: 42 },
  { delay: 1000, target: 55 },
  { delay: 700,  target: 65 },
  { delay: 900,  target: 78 },
  { delay: 500,  target: 88 },
  { delay: 1200, target: 95 },
  { delay: 800,  target: 100 },
];
// cumulativeDelay total = 6900ms
// complete() se llama a cumulativeDelay + 500 = 7400ms
```

---

## Mensajes de carga (opción A — técnicos reales)

```javascript
const messages = [
  { main: "Iniciando K+AIR...",            sub: "Cargando núcleo de la aplicación" },
  { main: "Conectando base de datos...",   sub: "Verificando integridad de datos" },
  { main: "Cargando módulos SG-SST...",    sub: "Preparando entorno de trabajo" },
  { main: "Verificando configuración...",  sub: "Ajustando preferencias del sistema" },
  { main: "Comprobando actualizaciones...", sub: "Revisando versión más reciente" },
  { main: "Listo",                         sub: "Bienvenido a K+AIR" },
];
```

---

## Sistema visual

- Fondo: gradiente `#174ea6 → #185abd` (primario oficial)
- Spinner: 3 anillos `.spinner-ring` con rotaciones opuestas (`spinMain` 1.2s, `spinReverse` 0.9s, `spinSlow` 6s)
- Centro del spinner: `.center-pulse` con animación `centerPulse` 1.5s
- Partículas: 6 × `.particle` con `particleOrbit` (2.6–3.8s)
- Puntos de acento: 3 × `.accent-dot` con `dotBounce` 1.4s (delays escalonados)
- Barra de progreso: shimmer animado (`progressShimmer` 1.5s)
- Logo: `assets/KIAR256.ico` (base64 embebido en HTML) + texto "K+AIR"
- Tipografía: Segoe UI / Roboto (consistente con la app)

### Entrada escalonada (animation-delay)

| Componente | Delay |
|---|---|
| Contenedor | 0s |
| Logo | 0.2s |
| Spinner | 0.4s |
| Texto | 0.6s |
| Barra de progreso | 0.8s |
| Puntos de acento | 1.0s |
| Footer | 1.2s |

---

## Contrato IPC (nuevo, sin colisión)

```javascript
// preload-loading.js expone:
window.electronAPI = {
  updateProgress: (pct) => ipcRenderer.send('loading-progress', pct),
  loadingComplete: ()    => ipcRenderer.send('loading-complete'),
  loadingError: (msg)    => ipcRenderer.send('loading-error', msg),
};

// main.js escucha:
ipcMain.on('loading-complete', () => {
  loadingWindow?.close();
  mainWindow?.show();
  mainWindow?.focus();
});
```

No colisiona con ninguno de los 100+ handlers existentes.

---

## Modo oscuro y responsivo (según spec)

- Modo oscuro: clase `dark-mode` en `body` → variables CSS sobrescritas
- Responsive: `@media (max-width: 480px)` reduce card, logo, barra

---

## Modificaciones en main.js

**Solo se agregan** las siguientes piezas — nada se elimina ni renombra:

1. Variable `let loadingWindow = null;` (junto a `mainWindow`)
2. Función `createLoadingWindow()` (500×600, frameless, preload-loading.js)
3. En `createWindow()`: agregar `show: false` a las opciones de BrowserWindow
4. En `app.whenReady()`: llamar `createLoadingWindow()` antes de `createWindow()`
5. Handler `ipcMain.on('loading-complete', ...)` en el bloque de handlers
6. **Fallback de seguridad:** `setTimeout(() => { loadingWindow?.close(); mainWindow?.show(); }, 10000)` — si el IPC nunca llega (edge case), la app se desbloquea a los 10 segundos

---

## API pública expuesta (window.kairLoading)

```javascript
window.kairLoading = {
  setProgress, setMessage, complete, reset, showError
};
```

---

## Verificación

1. `npm start` → se muestra ventana de carga 500×600 centrada inmediatamente
2. Animación corre ~7.4s (simulación 6.9s + 500ms cierre)
3. Ventana de carga se cierra sola → ventana principal aparece
4. Ventana principal nunca fue visible durante la carga
5. Todos los módulos existentes funcionan exactamente igual
6. En caso de error: `window.kairLoading.showError("...")` muestra estado rojo
