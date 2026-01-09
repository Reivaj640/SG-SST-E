// debug-full.js - Script para diagnosticar problemas completos en la ejecución
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Redirigir console.log a un archivo para mejor depuración
const logFile = path.join(__dirname, 'debug-full.log');
const originalLog = console.log;
console.log = function(...args) {
  const message = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  fs.appendFileSync(logFile, message);
  originalLog.apply(console, args);
};

console.log('=== INICIO DE DIAGNÓSTICO COMPLETO ===');

// Cargar el main.js original y ejecutarlo paso a paso
try {
  console.log('Cargando main.js...');
  
  // Simular el entorno de Electron
  global.__dirname = __dirname;
  global.__filename = __filename;
  
  // Cargar el main.js como texto para analizarlo
  const mainJsPath = path.join(__dirname, 'main.js');
  const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  
  console.log(`main.js cargado (${mainJsContent.length} caracteres)`);
  
  // Evaluar el contenido (esto es peligroso en producción, pero útil para depuración)
  console.log('Evaluando main.js...');
  eval(mainJsContent);
  
  console.log('main.js evaluado exitosamente');
  
} catch (err) {
  console.log('Error durante la evaluación de main.js:');
  console.log('Nombre:', err.name);
  console.log('Mensaje:', err.message);
  console.log('Stack:', err.stack);
}

console.log('=== FIN DE DIAGNÓSTICO COMPLETO ===');