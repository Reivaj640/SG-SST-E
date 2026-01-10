#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ruta al archivo package.json
const packagePath = path.join(__dirname, '..', 'package.json');

// Leer el archivo package.json
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Actualizar el nombre del producto
packageJson.build.productName = 'K+AIR';

// Actualizar el nombre de la aplicación
packageJson.name = 'kair-electron-app';

// Actualizar el appId
packageJson.build.appId = 'com.jrfsoluciones.kair';

// Actualizar el copyright
packageJson.build.copyright = 'Copyright © 2025 Javier Robles F. Prof. SG-SST - Esp. Gerencia de Proyectos.';

// Actualizar las rutas del icono
packageJson.build.win.icon = 'assets/KIAR256.ico';
packageJson.build.mac.icon = 'assets/KIAR256.ico';
packageJson.build.linux.icon = 'assets/KIAR256.ico';

// Actualizar el nombre del repositorio en publish
if (packageJson.build.publish && packageJson.build.publish[0]) {
    packageJson.build.publish[0].repo = 'K-AIR';
}

// Escribir el archivo package.json actualizado
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

console.log('✅ Actualización del nombre de la aplicación y rutas de icono completada');
console.log('📝 Nombre del producto actualizado a: K+AIR');
console.log('📝 Nombre de la aplicación actualizado a: kair-electron-app');
console.log('📝 App ID actualizado a: com.jrfsoluciones.kair');
console.log('📝 Rutas de icono actualizadas para Windows, Mac y Linux');
console.log('📝 Repositorio de publicación actualizado a: K-AIR');