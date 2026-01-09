// debug-main.js - Script para diagnosticar problemas específicos en main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

console.log('=== DIAGNÓSTICO DEL ARCHIVO main.js ===');

// Verificar existencia y contenido del main.js
const mainPath = path.join(__dirname, 'main.js');
console.log('Verificando main.js:', mainPath);

if (fs.existsSync(mainPath)) {
  const stats = fs.statSync(mainPath);
  console.log(`Tamaño: ${stats.size} bytes`);
  console.log(`Última modificación: ${stats.mtime}`);
  
  // Leer las primeras líneas del archivo
  try {
    const content = fs.readFileSync(mainPath, 'utf8');
    const lines = content.split('\n').slice(0, 20);
    console.log('Primeras 20 líneas de main.js:');
    lines.forEach((line, i) => console.log(`  ${i+1}: ${line}`));
  } catch (err) {
    console.log('Error al leer main.js:', err.message);
  }
} else {
  console.log('main.js NO ENCONTRADO');
  process.exit(1);
}

// Intentar cargar el main.js como módulo para ver si hay errores de sintaxis
try {
  console.log('\n=== INTENTANDO CARGAR main.js COMO MÓDULO ===');
  // Esto nos ayudará a identificar errores de sintaxis
  require('./main.js');
  console.log('main.js cargado exitosamente como módulo');
} catch (err) {
  console.log('Error al cargar main.js como módulo:');
  console.log('Nombre del error:', err.name);
  console.log('Mensaje de error:', err.message);
  console.log('Stack trace:', err.stack);
  process.exit(1);
}

console.log('\n=== SI LLEGASTE HASTA AQUÍ, main.js ESTÁ CORRECTO ===');
console.log('El problema puede estar en tiempo de ejecución');