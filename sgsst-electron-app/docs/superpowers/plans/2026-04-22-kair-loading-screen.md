# K+AIR Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar una pantalla de carga animada (BrowserWindow separada, 500×600, sin borde) que se muestra antes de la ventana principal de K+AIR, con la clase `KairLoadingController` y simulación progresiva de ~7.4 segundos.

**Architecture:** Se crea una segunda `BrowserWindow` (loadingWindow) que aparece inmediatamente al lanzar la app. La ventana principal se crea en paralelo con `show: false`. Cuando `KairLoadingController.complete()` dispara el evento `kair-loading-complete`, un handler IPC cierra la loadingWindow y hace visible la mainWindow. Un timeout de seguridad de 10 segundos garantiza que la app nunca quede bloqueada.

**Tech Stack:** Electron (BrowserWindow, ipcMain/ipcRenderer, contextBridge), HTML/CSS/JS vanilla embebido en loading.html.

---

## File Map

| Acción | Archivo | Responsabilidad |
|---|---|---|
| CREAR | `loading/loading.html` | Animación completa autocontenida (HTML + CSS + JS) |
| CREAR | `loading/preload-loading.js` | Puente IPC mínimo exclusivo para loadingWindow |
| MODIFICAR | `main.js` línea 209 | Declarar `loadingWindow`, agregar `createLoadingWindow()`, ajustar `app.whenReady()` y `createWindow()` |

`preload.js`, `renderer.js`, `styles.css`, `index.html`, todos los módulos: **NO SE TOCAN**.

---

## Task 1: Crear `loading/preload-loading.js`

**Files:**
- Create: `loading/preload-loading.js`

- [ ] **Step 1: Crear la carpeta `loading/` y el archivo**

```bash
mkdir loading
```

- [ ] **Step 2: Escribir `loading/preload-loading.js`**

Contenido exacto del archivo:

```javascript
// loading/preload-loading.js
// Puente IPC exclusivo para la ventana de carga. NO modifica preload.js existente.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  updateProgress:  (percent) => ipcRenderer.send('loading-progress', percent),
  loadingComplete: ()        => ipcRenderer.send('loading-complete'),
  loadingError:    (message) => ipcRenderer.send('loading-error', message),
  getAppVersion:   ()        => ipcRenderer.invoke('get-app-version'),
});
```

- [ ] **Step 3: Verificar que el archivo existe**

```bash
ls loading/preload-loading.js
```

Resultado esperado: el archivo listado sin errores.

- [ ] **Step 4: Commit**

```bash
git add loading/preload-loading.js
git commit -m "feat: add preload-loading.js for loading window IPC bridge"
```

---

## Task 2: Crear `loading/loading.html`

**Files:**
- Create: `loading/loading.html`

Este archivo es autocontenido: HTML + CSS + JS en un solo documento. Implementa exactamente la clase `KairLoadingController` con todos sus métodos según la spec.

- [ ] **Step 1: Crear `loading/loading.html` con el contenido completo**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:;">
  <title>K+AIR</title>
  <style>
    /* ===== VARIABLES CSS ===== */
    :root {
      --kair-bg-start:       #0a1929;
      --kair-bg-end:         #174ea6;
      --kair-primary:        #174ea6;
      --kair-accent:         #4d9fff;
      --kair-text-primary:   #ffffff;
      --kair-text-secondary: rgba(255,255,255,0.75);
      --kair-text-muted:     rgba(255,255,255,0.45);
      --kair-card-bg:        rgba(255,255,255,0.06);
      --kair-card-border:    rgba(255,255,255,0.10);
      --kair-progress-track: rgba(255,255,255,0.12);
    }

    /* ===== RESET ===== */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }

    body {
      font-family: 'Segoe UI', Roboto, -apple-system, sans-serif;
      background: linear-gradient(165deg, var(--kair-bg-start) 0%, var(--kair-bg-end) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      -webkit-user-select: none;
      -webkit-app-region: drag;
    }

    /* ===== KEYFRAMES ===== */
    @keyframes containerEntry {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes logoEntry {
      from { opacity: 0; transform: translateX(-10px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes spinnerEntry {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes textEntry {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes progressEntry {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spinMain    { to { transform: rotate(360deg); } }
    @keyframes spinReverse { to { transform: rotate(-360deg); } }
    @keyframes spinSlow    { to { transform: rotate(360deg); } }
    @keyframes centerPulse {
      0%, 100% { transform: scale(1.0); opacity: 0.8; }
      50%       { transform: scale(1.3); opacity: 1; }
    }
    @keyframes particleOrbit {
      0%   { transform: rotate(0deg)   translateX(28px) scale(0.6); opacity: 0; }
      20%  { opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: rotate(360deg) translateX(28px) scale(0.6); opacity: 0; }
    }
    @keyframes logoShimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes progressShimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
    @keyframes orbFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33%       { transform: translate(15px, -20px) scale(1.05); }
      66%       { transform: translate(-10px, 10px) scale(0.95); }
    }
    @keyframes dotBounce {
      0%, 100% { transform: scale(0.6); opacity: 0.4; }
      50%       { transform: scale(1.0); opacity: 1; }
    }

    /* ===== ORBS DECORATIVOS ===== */
    .orb {
      position: fixed;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(77,159,255,0.12), transparent 70%);
      pointer-events: none;
      animation: orbFloat ease-in-out infinite;
    }
    .orb-1 { width: 300px; height: 300px; top: -80px;   left: -80px;  animation-duration: 10s; }
    .orb-2 { width: 250px; height: 250px; bottom: -60px; right: -60px; animation-duration: 14s; animation-delay: -4s; }
    .orb-3 { width: 180px; height: 180px; top: 40%;     right: 15%;   animation-duration:  9s; animation-delay: -7s; }

    /* ===== CONTENEDOR ===== */
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      animation: containerEntry 0.8s cubic-bezier(0.4,0,0.2,1) forwards;
    }

    /* ===== CARD ===== */
    .loading-card {
      background: var(--kair-card-bg);
      border: 1px solid var(--kair-card-border);
      border-radius: 20px;
      padding: 2.5rem 2rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      width: 340px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 8px 40px rgba(0,0,0,0.35);
    }

    /* ===== SPINNER ===== */
    .spinner-section {
      position: relative;
      width: 90px;
      height: 90px;
      animation: spinnerEntry 0.6s cubic-bezier(0.4,0,0.2,1) 0.4s both;
    }
    .spinner-ring {
      position: absolute;
      border-radius: 50%;
      border: 2.5px solid transparent;
    }
    .ring-1 {
      inset: 0;
      border-top-color: var(--kair-accent);
      border-right-color: rgba(77,159,255,0.3);
      animation: spinMain 1.2s cubic-bezier(0.5,0,0.5,1) infinite;
    }
    .ring-2 {
      inset: 10px;
      border-top-color: rgba(255,255,255,0.8);
      border-left-color: rgba(255,255,255,0.2);
      animation: spinReverse 0.9s cubic-bezier(0.5,0,0.5,1) infinite;
    }
    .ring-3 {
      inset: 22px;
      border-top-color: rgba(77,159,255,0.5);
      animation: spinSlow 6s linear infinite;
    }
    .center-pulse {
      position: absolute;
      inset: 33px;
      background: radial-gradient(circle, var(--kair-accent) 0%, var(--kair-primary) 100%);
      border-radius: 50%;
      animation: centerPulse 1.5s ease-in-out infinite;
    }
    .particles { position: absolute; inset: 0; pointer-events: none; }
    .particle {
      position: absolute;
      width: 5px; height: 5px;
      background: var(--kair-accent);
      border-radius: 50%;
      top: 50%; left: 50%;
      margin: -2.5px 0 0 -2.5px;
      animation: particleOrbit linear infinite;
    }
    .particle:nth-child(1) { animation-duration: 2.6s; animation-delay:  0.0s; }
    .particle:nth-child(2) { animation-duration: 3.1s; animation-delay: -0.8s; background: rgba(255,255,255,0.7); }
    .particle:nth-child(3) { animation-duration: 2.9s; animation-delay: -1.5s; }
    .particle:nth-child(4) { animation-duration: 3.8s; animation-delay: -0.3s; background: rgba(255,255,255,0.5); }
    .particle:nth-child(5) { animation-duration: 3.3s; animation-delay: -2.1s; }
    .particle:nth-child(6) { animation-duration: 2.7s; animation-delay: -1.0s; background: rgba(255,255,255,0.6); }

    /* ===== LOGO ===== */
    .logo-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: logoEntry 0.6s cubic-bezier(0.4,0,0.2,1) 0.2s both;
    }
    .logo-icon {
      width: 52px; height: 52px;
      border-radius: 14px;
      object-fit: contain;
      background: rgba(255,255,255,0.08);
      padding: 6px;
    }
    .logo-text { display: flex; flex-direction: column; }
    .logo-text__title {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: linear-gradient(90deg, #ffffff 20%, #4d9fff 50%, #ffffff 80%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: logoShimmer 3s ease-in-out infinite;
    }
    .logo-text__subtitle {
      font-size: 0.7rem;
      color: var(--kair-text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    /* ===== MENSAJES ===== */
    .message-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      min-height: 44px;
      animation: textEntry 0.6s cubic-bezier(0.4,0,0.2,1) 0.6s both;
    }
    .message-primary {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--kair-text-primary);
      text-align: center;
      transition: opacity 0.2s ease;
    }
    .message-secondary {
      font-size: 0.75rem;
      color: var(--kair-text-secondary);
      text-align: center;
      transition: opacity 0.2s ease;
    }

    /* ===== PROGRESO ===== */
    .progress-section {
      width: 220px;
      animation: progressEntry 0.6s cubic-bezier(0.4,0,0.2,1) 0.8s both;
    }
    .progress-bar {
      width: 100%; height: 5px;
      background: var(--kair-progress-track);
      border-radius: 100px;
      overflow: hidden;
      position: relative;
    }
    .progress-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, var(--kair-primary) 0%, var(--kair-accent) 100%);
      border-radius: 100px;
      transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
      position: relative;
      overflow: hidden;
    }
    .progress-fill::after {
      content: '';
      position: absolute;
      top: 0; bottom: 0; width: 40px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
      animation: progressShimmer 1.5s ease-in-out infinite;
    }

    /* ===== ACCENT DOTS ===== */
    .accent-dots {
      display: flex; gap: 0.5rem;
      animation: textEntry 0.6s cubic-bezier(0.4,0,0.2,1) 1.0s both;
    }
    .accent-dot {
      width: 6px; height: 6px;
      background: var(--kair-accent);
      border-radius: 50%;
      animation: dotBounce 1.4s ease-in-out infinite;
    }
    .accent-dot:nth-child(1) { animation-delay: 0.0s; }
    .accent-dot:nth-child(2) { animation-delay: 0.2s; }
    .accent-dot:nth-child(3) { animation-delay: 0.4s; }

    /* ===== FOOTER ===== */
    .loading-footer {
      font-size: 0.65rem;
      color: var(--kair-text-muted);
      letter-spacing: 0.04em;
      animation: textEntry 0.6s cubic-bezier(0.4,0,0.2,1) 1.2s both;
    }

    /* ===== DARK MODE ===== */
    body.dark-mode {
      --kair-bg-start:       #0d1b2a;
      --kair-bg-end:         #1b2838;
      --kair-text-primary:   #e8edf2;
      --kair-text-secondary: #8da0b5;
      --kair-text-muted:     #5a6f82;
      background: linear-gradient(165deg, var(--kair-bg-start) 0%, var(--kair-bg-end) 100%);
    }
    body.dark-mode .loading-card {
      background: rgba(255,255,255,0.04);
      border-color: rgba(255,255,255,0.06);
      box-shadow: 0 4px 30px rgba(0,0,0,0.3);
    }
    body.dark-mode .progress-bar { background: rgba(255,255,255,0.06); }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 480px) {
      .loading-card        { margin: 1rem; padding: 2rem 1.5rem 1.5rem; }
      .logo-icon           { width: 44px; height: 44px; border-radius: 12px; }
      .logo-text__title    { font-size: 1.25rem; }
      .progress-section    { width: 180px; }
    }
  </style>
</head>
<body>

  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <div class="loading-container">
    <div class="loading-card">

      <div class="spinner-section">
        <div class="spinner-ring ring-1"></div>
        <div class="spinner-ring ring-2"></div>
        <div class="spinner-ring ring-3"></div>
        <div class="center-pulse"></div>
        <div class="particles">
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
          <div class="particle"></div>
        </div>
      </div>

      <div class="logo-section">
        <img class="logo-icon" src="../assets/KIAR256.ico" alt="K+AIR" onerror="this.style.display='none'">
        <div class="logo-text">
          <span class="logo-text__title">K+AIR</span>
          <span class="logo-text__subtitle">Sistema de Gestión SST</span>
        </div>
      </div>

      <div class="message-section">
        <div class="message-primary">Iniciando K+AIR...</div>
        <div class="message-secondary">Cargando núcleo de la aplicación</div>
      </div>

      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>

      <div class="accent-dots">
        <div class="accent-dot"></div>
        <div class="accent-dot"></div>
        <div class="accent-dot"></div>
      </div>

      <div class="loading-footer">
        K+AIR v<span id="app-ver">—</span> · SG-SST Colombia
      </div>

    </div>
  </div>

  <script>
    'use strict';

    const MESSAGES = [
      { main: 'Iniciando K+AIR...',             sub: 'Cargando núcleo de la aplicación'  },
      { main: 'Conectando base de datos...',     sub: 'Verificando integridad de datos'   },
      { main: 'Cargando módulos SG-SST...',      sub: 'Preparando entorno de trabajo'     },
      { main: 'Verificando configuración...',    sub: 'Ajustando preferencias del sistema'},
      { main: 'Comprobando actualizaciones...', sub: 'Revisando versión más reciente'    },
      { main: 'Listo',                           sub: 'Bienvenido a K+AIR'               },
    ];

    class KairLoadingController {
      constructor(messages) {
        this.messages     = messages;
        this.progress     = 0;
        this.messageIndex = 0;
        this.isComplete   = false;
        this.progressFill = document.querySelector('.progress-fill');
        this.messageEl    = document.querySelector('.message-primary');
        this.submessageEl = document.querySelector('.message-secondary');
        this.startSimulation();
      }

      setProgress(value) {
        this.progress = Math.max(0, Math.min(100, value));
        this.progressFill.style.width = `${this.progress}%`;
      }

      advanceMessage() {
        this.messageIndex = (this.messageIndex + 1) % this.messages.length;
        this.updateMessage();
      }

      updateMessage() {
        const { main, sub } = this.messages[this.messageIndex];
        this.messageEl.style.opacity    = '0';
        this.submessageEl.style.opacity = '0';
        setTimeout(() => {
          this.messageEl.textContent      = main;
          this.submessageEl.textContent   = sub;
          this.messageEl.style.opacity    = '1';
          this.submessageEl.style.opacity = '1';
        }, 200);
      }

      setMessage(main, sub) {
        setTimeout(() => {
          this.messageEl.textContent      = main;
          this.submessageEl.textContent   = sub;
          this.messageEl.style.opacity    = '1';
          this.submessageEl.style.opacity = '1';
        }, 200);
      }

      complete() {
        if (this.isComplete) return;
        this.isComplete = true;
        const container = document.querySelector('.loading-container');
        container.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        container.style.opacity    = '0';
        container.style.transform  = 'scale(0.98)';
        window.dispatchEvent(new CustomEvent('kair-loading-complete'));
      }

      showError(message = 'Error al cargar. Inténtelo de nuevo.') {
        this.messageEl.textContent    = message;
        this.messageEl.style.color    = '#dc3545';
        this.submessageEl.textContent = '';
        document.querySelectorAll('.spinner-ring').forEach(el => {
          el.style.animationPlayState = 'paused';
        });
        document.querySelectorAll('.accent-dot').forEach(el => {
          el.style.animationPlayState = 'paused';
        });
        document.querySelectorAll('.particle').forEach(el => {
          el.style.animationPlayState = 'paused';
        });
        this.progressFill.style.background = '#dc3545';
      }

      reset() {
        this.progress     = 0;
        this.messageIndex = 0;
        this.isComplete   = false;
        this.setProgress(0);
        this.updateMessage();
        const container = document.querySelector('.loading-container');
        container.style.opacity   = '1';
        container.style.transform = 'scale(1)';
      }

      startSimulation() {
        this.updateMessage();
        const steps = [
          { delay:  400, target:  15 },
          { delay:  800, target:  30 },
          { delay:  600, target:  42 },
          { delay: 1000, target:  55 },
          { delay:  700, target:  65 },
          { delay:  900, target:  78 },
          { delay:  500, target:  88 },
          { delay: 1200, target:  95 },
          { delay:  800, target: 100 },
        ];
        let cumulativeDelay = 0;
        steps.forEach(step => {
          cumulativeDelay += step.delay;
          setTimeout(() => {
            this.setProgress(step.target);
            this.advanceMessage();
          }, cumulativeDelay);
        });
        setTimeout(() => this.complete(), cumulativeDelay + 500);
      }
    }

    window.kairLoading = new KairLoadingController(MESSAGES);

    window.addEventListener('kair-loading-complete', () => {
      if (window.electronAPI && window.electronAPI.loadingComplete) {
        window.electronAPI.loadingComplete();
      }
    });

    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion()
        .then(v => {
          const el = document.getElementById('app-ver');
          if (el) el.textContent = v;
        })
        .catch(() => {});
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Verificar que el archivo existe**

```bash
ls loading/loading.html
```

Resultado esperado: el archivo listado.

- [ ] **Step 3: Commit**

```bash
git add loading/loading.html
git commit -m "feat: add KairLoadingController and full loading screen animation"
```

---

## Task 3: Modificar `main.js`

**Files:**
- Modify: `main.js` (líneas 208-209, 559-598, 6207-6248)

Se hacen **3 cambios quirúrgicos** en `main.js`. Ninguno altera lógica existente.

### Cambio A — Declarar `loadingWindow` (línea 209)

- [ ] **Step 1: Agregar variable `loadingWindow` en línea 210**

Localizar este bloque en `main.js`:

```javascript
let mainWindow;
let isWindowCreated = false; // Variable para rastrear si la ventana ya ha sido creada
```

Reemplazarlo por:

```javascript
let mainWindow;
let loadingWindow = null;
let isWindowCreated = false; // Variable para rastrear si la ventana ya ha sido creada
```

### Cambio B — Agregar `createLoadingWindow()` y `show: false` en `createWindow()`

- [ ] **Step 2: Agregar función `createLoadingWindow()` antes de `createWindow()`**

Localizar este comentario en `main.js` (aproximadamente línea 559):

```javascript
// Función para crear la ventana principal
const createWindow = () => {
```

Insertar el bloque completo **ANTES** de esa línea:

```javascript
// Función para crear la ventana de carga (splash screen)
const createLoadingWindow = () => {
  loadingWindow = new BrowserWindow({
    width: 500,
    height: 600,
    frame: false,
    resizable: false,
    center: true,
    icon: path.join(__dirname, 'assets', 'KIAR256.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'loading', 'preload-loading.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  loadingWindow.loadFile(path.join(__dirname, 'loading', 'loading.html'));
  loadingWindow.on('closed', () => { loadingWindow = null; });

  // Fallback: si el IPC nunca llega, mostrar mainWindow a los 10 segundos
  setTimeout(() => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  }, 10000);
};

```

- [ ] **Step 3: Agregar `show: false` en la BrowserWindow de `createWindow()`**

Localizar este bloque dentro de `createWindow()`:

```javascript
  mainWindow = new BrowserWindow({
    width: 1200, // Ancho inicial 1200 para mejor visualización en 1366px y 1920px
    height: 700, // Alto inicial 700 para que quepa en 768px con margen para barra de título
    minWidth: 1024, // Mínimo razonable para UI funcional
    minHeight: 650, // Permite uso en pantallas 1366x768
    icon: path.join(__dirname, 'assets', 'KIAR256.ico'),
    webPreferences: {
```

Reemplazarlo por:

```javascript
  mainWindow = new BrowserWindow({
    width: 1200, // Ancho inicial 1200 para mejor visualización en 1366px y 1920px
    height: 700, // Alto inicial 700 para que quepa en 768px con margen para barra de título
    minWidth: 1024, // Mínimo razonable para UI funcional
    minHeight: 650, // Permite uso en pantallas 1366x768
    show: false, // Oculta hasta que loading screen complete
    icon: path.join(__dirname, 'assets', 'KIAR256.ico'),
    webPreferences: {
```

### Cambio C — Ajustar `app.whenReady()` y agregar handler IPC

- [ ] **Step 4: Llamar `createLoadingWindow()` al inicio de `app.whenReady()`**

Localizar este bloque (aproximadamente línea 6207):

```javascript
app.whenReady().then(() => {
  // Solo crear ventana si no ha sido creada antes
  if (!isWindowCreated) {
    createWindow();
  }
```

Reemplazarlo por:

```javascript
app.whenReady().then(() => {
  // Mostrar pantalla de carga inmediatamente
  createLoadingWindow();

  // Crear ventana principal en paralelo (oculta hasta que carga termine)
  if (!isWindowCreated) {
    createWindow();
  }
```

- [ ] **Step 5: Agregar handler IPC `loading-complete`**

Inmediatamente **después** del bloque `app.whenReady().then(() => {` (antes del cierre `});`), agregar:

```javascript
  // Handler: la pantalla de carga terminó → cerrar loading, mostrar app
  ipcMain.on('loading-complete', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
```

El bloque `app.whenReady().then()` resultante debe quedar así:

```javascript
app.whenReady().then(() => {
  // Mostrar pantalla de carga inmediatamente
  createLoadingWindow();

  // Crear ventana principal en paralelo (oculta hasta que carga termine)
  if (!isWindowCreated) {
    createWindow();
  }

  // Handler: la pantalla de carga terminó → cerrar loading, mostrar app
  ipcMain.on('loading-complete', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.close();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Registrar handlers de Archivo y Retención Documental (Submódulo 2.5.1)
  try {
    registerArchivoRetencionHandlers(app);
    // ... resto del código existente sin cambios ...
```

- [ ] **Step 6: Commit de los cambios en main.js**

```bash
git add main.js
git commit -m "feat: add loading window to app startup flow, hide mainWindow until load complete"
```

---

## Task 4: Verificación end-to-end

- [ ] **Step 1: Lanzar la aplicación**

```bash
npm start
```

Resultado esperado:
1. Aparece inmediatamente una ventana **500×600, sin borde, centrada** con fondo degradado azul oscuro
2. Se ve el spinner animado (3 anillos), logo K+AIR, barra de progreso
3. Los mensajes cambian con fade: "Iniciando K+AIR..." → "Conectando base de datos..." → etc.
4. La barra de progreso avanza de forma no uniforme durante ~6.9 segundos
5. La ventana de carga desaparece con fade out + scale
6. La ventana principal de K+AIR aparece completamente cargada
7. La ventana principal **nunca fue visible** durante la carga

- [ ] **Step 2: Verificar que los módulos existentes funcionan**

Navegar por al menos 3 módulos de la app (ej: Gestión Salud, módulo 2.5.1, módulo 3.3.1) y confirmar que funcionan exactamente igual que antes.

- [ ] **Step 3: Verificar fallback de seguridad**

En DevTools del proceso principal, verificar que si se comenta temporalmente el `window.addEventListener('kair-loading-complete', ...)` en `loading.html`, la ventana principal aparece a los 10 segundos (fallback). Revertir el comentario después.

- [ ] **Step 4: Commit final de verificación**

```bash
git add -A
git commit -m "feat: kair-loading-screen complete and verified"
```

---

## Resumen de contratos

| Contrato | Tipo | Dirección | Impacto en código existente |
|---|---|---|---|
| `loading-complete` | ipcMain.on | renderer → main | Ninguno — nombre nuevo |
| `loading-progress` | ipcMain.on | renderer → main | Ninguno — nombre nuevo |
| `loading-error` | ipcMain.on | renderer → main | Ninguno — nombre nuevo |
| `get-app-version` | ipcMain.handle | renderer → main | Ya existe, reutilizado |

Todos los 100+ handlers existentes permanecen inalterados.
