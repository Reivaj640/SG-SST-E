// debug-app.js - Script de diagnóstico para identificar fallos en la app
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('=== DIAGNÓSTICO DE LA APLICACIÓN ===');
console.log('Directorio actual:', __dirname);
console.log('Directorio de la aplicación:', app.getAppPath());

// Verificar existencia de archivos críticos
const criticalFiles = [
  'index.html',
  'preload.js',
  'renderer.js'
];

console.log('\n=== VERIFICACIÓN DE ARCHIVOS CRÍTICOS ===');
criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`${file}: ${exists ? '✓ ENCONTRADO' : '✗ NO ENCONTRADO'} (${filePath})`);
});

// Verificar estructura de directorios
console.log('\n=== ESTRUCTURA DE DIRECTORIOS ===');
try {
  const files = fs.readdirSync(__dirname);
  console.log('Archivos en el directorio raíz:');
  files.forEach(file => console.log(`  - ${file}`));
} catch (err) {
  console.log('Error al leer directorio:', err.message);
}

// Verificar la ruta del archivo index.html
const indexPath = path.join(__dirname, 'index.html');
console.log(`\n=== VERIFICACIÓN DE index.html ===`);
if (fs.existsSync(indexPath)) {
  const stats = fs.statSync(indexPath);
  console.log(`Tamaño: ${stats.size} bytes`);
  console.log(`Última modificación: ${stats.mtime}`);
  
  // Leer las primeras líneas del archivo
  try {
    const content = fs.readFileSync(indexPath, 'utf8');
    const lines = content.split('\n').slice(0, 5);
    console.log('Primeras 5 líneas:');
    lines.forEach((line, i) => console.log(`  ${i+1}: ${line}`));
  } catch (err) {
    console.log('Error al leer index.html:', err.message);
  }
} else {
  console.log('index.html NO ENCONTRADO');
}

app.whenReady().then(() => {
  console.log('\n=== CREANDO VENTANA DE PRUEBA ===');
  try {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    console.log('Ventana creada exitosamente');
    
    win.loadFile(indexPath)
      .then(() => {
        console.log('index.html cargado exitosamente');
      })
      .catch(err => {
        console.log('Error al cargar index.html:', err.message);
      });
      
  } catch (err) {
    console.log('Error al crear ventana:', err.message);
  }
});

app.on('window-all-closed', () => {
  console.log('Todas las ventanas cerradas');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});