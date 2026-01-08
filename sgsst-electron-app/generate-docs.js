#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lista de archivos JS principales para documentar
const filesToDocument = [
  './main.js',
  './renderer.js',
  './preload.js',
  './normativa-utils.js'
];

// Directorio de componentes
const componentDir = './components';
if (fs.existsSync(componentDir)) {
  fs.readdirSync(componentDir).forEach(file => {
    if (file.endsWith('.js')) {
      filesToDocument.push(`${componentDir}/${file}`);
    }
  });
}

// Directorio de utilidades
const utilsDir = './utils';
if (fs.existsSync(utilsDir)) {
  fs.readdirSync(utilsDir).forEach(file => {
    if (file.endsWith('.js')) {
      filesToDocument.push(`${utilsDir}/${file}`);
    }
  });
}

// Directorio raíz para archivos JS específicos
const rootFiles = [
  'afiliacion-component.js',
  'afiliacion-viewer.js',
  'capacitacion-copasst.js',
  'capacitacion-copasst-viewer.js',
  'comite-convivencia.js',
  'comite-convivencia-viewer.js',
  'copasst.js',
  'copasst-viewer.js',
  'curso-50-horas.js',
  'curso-virtual-component.js',
  'curso-virtual-viewer.js',
  'evaluaciones-component.js',
  'evaluaciones-medicas.js',
  'evaluaciones-viewer.js',
  'gestion-amenazas-home.js',
  'gestion-integral-home.js',
  'gestion-peligros-home.js',
  'gestion-salud-home.js',
  'investigacion-accidente.js',
  'investigacion-accidentes.js',
  'investigaciones-viewer.js',
  'medicion-ausentismo.js',
  'mejoramiento-home.js',
  'politica-component.js',
  'politica-viewer.js',
  'presupuesto-gestion.js',
  'reportes-accidentes.js',
  'reportes-accidentes-viewer.js',
  'responsable-sg.js',
  'responsable-sg-viewer.js',
  'restricciones-component.js',
  'restricciones-medicas.js',
  'restricciones-viewer.js',
  'roles-responsabilidades-component.js',
  'roles-responsabilidades-viewer.js',
  'sociodemografica-component.js',
  'sociodemografica-viewer.js',
  'test-module-cards.js',
  'trabajo-alto-riesgo.js',
  'trabajo-alto-riesgo-viewer.js',
  'ver-ausentismo.js',
  'verificacion-home.js'
];

rootFiles.forEach(file => {
  if (fs.existsSync(file)) {
    filesToDocument.push(`./${file}`);
  }
});

console.log(`Encontrados ${filesToDocument.length} archivos para documentar`);

// Crear directorio de documentación si no existe
const docsDir = './docs/api';
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Ejecutar JSDoc con los archivos encontrados
try {
  const cmd = `npx jsdoc ${filesToDocument.join(' ')} -d ${docsDir}`;
  console.log('Ejecutando:', cmd);
  execSync(cmd, { stdio: 'inherit' });
  console.log('Documentación generada exitosamente en', docsDir);
} catch (error) {
  console.error('Error al generar la documentación:', error.message);
}