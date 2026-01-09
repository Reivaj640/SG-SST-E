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
  'modules/gestion-salud/evaluaciones-medicas/evaluaciones-component.js',
  'modules/gestion-salud/evaluaciones-medicas/evaluaciones-medicas-logic.js',
  'modules/gestion-salud/evaluaciones-medicas/evaluaciones-viewer.js',
  'gestion-amenazas-home.js',
  'gestion-integral-home.js',
  'gestion-peligros-home.js',
  'gestion-salud-home.js',
  'modules/gestion-salud/investigacion-accidentes/investigacion-accidente-logic.js',
  'modules/gestion-salud/investigacion-accidentes/investigacion-accidentes-logic.js',
  'modules/gestion-salud/investigacion-accidentes/investigaciones-viewer.js',
  'medicion-ausentismo.js',
  'mejoramiento-home.js',
  'politica-component.js',
  'politica-viewer.js',
  'presupuesto-gestion.js',
  'modules/gestion-salud/reportes-accidentes/reportes-accidentes-logic.js',
  'modules/gestion-salud/reportes-accidentes/reportes-accidentes-viewer.js',
  'modules/recursos/responsable-sg/responsable-sg-logic.js',
  'modules/recursos/responsable-sg/responsable-sg-viewer.js',
  'modules/recursos/roles-responsabilidades/roles-responsabilidades-logic.js',
  'modules/recursos/roles-responsabilidades/roles-responsabilidades-viewer.js',
  'modules/recursos/afiliacion/afiliacion-logic.js',
  'modules/recursos/afiliacion/afiliacion-viewer.js',
  'modules/recursos/copasst/copasst-logic.js',
  'modules/recursos/copasst/copasst-viewer.js',
  'modules/recursos/capacitacion-copasst/capacitacion-copasst-logic.js',
  'modules/recursos/capacitacion-copasst/capacitacion-copasst-viewer.js',
  'modules/recursos/comite-convivencia/comite-convivencia-logic.js',
  'modules/recursos/comite-convivencia/comite-convivencia-viewer.js',
  'modules/recursos/curso-virtual/curso-virtual-logic.js',
  'modules/recursos/curso-virtual/curso-virtual-viewer.js',
  'modules/gestion-salud/restricciones-medicas/restricciones-component.js',
  'modules/recursos/presupuesto/presupuesto-logic.js',
  'modules/gestion-salud/restricciones-medicas/restricciones-medicas-logic.js',
  'modules/gestion-integral/politica/politica-logic.js',
  'modules/gestion-integral/politica/politica-viewer.js',
  'modules/recursos/trabajo-alto-riesgo/trabajo-alto-riesgo-logic.js',
  'modules/recursos/trabajo-alto-riesgo/trabajo-alto-riesgo-viewer.js',
  'modules/gestion-salud/restricciones-medicas/restricciones-viewer.js',
  'modules/gestion-salud/sociodemografica/sociodemografica-component.js',
  'modules/gestion-salud/sociodemografica/sociodemografica-viewer.js',
  'test-module-cards.js',
  'trabajo-alto-riesgo.js',
  'trabajo-alto-riesgo-viewer.js',
  'modules/gestion-salud/ausentismo/ver-ausentismo-logic.js',
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