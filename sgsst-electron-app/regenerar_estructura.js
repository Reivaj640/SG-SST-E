/**
 * Script para regenerar la estructura de carpetas de Tempoactiva
 * y actualizar el config.json automáticamente
 *
 * Uso: node regenerar_estructura.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const CONFIG_PATH = path.join(__dirname, 'c:/Users/Javier RF/AppData/Roaming/sgsst-electron-app/config.json');
const PYTHON_SCRIPT = path.join(__dirname, 'Portear', 'src', 'map_directory.py');
const TEMPOACTIVA_ROOT = 'G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\1. Tempoactiva Est SAS';

console.log('============================================');
console.log('Regenerando estructura de Tempoactiva...');
console.log('============================================\n');

// Paso 1: Leer la configuración actual
console.log('1. Leyendo configuración actual...');
let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log('   ✓ Configuración cargada\n');
} catch (error) {
    console.error('   ✗ Error al leer configuración:', error.message);
    process.exit(1);
}

// Paso 2: Verificar que Tempoactiva existe en la configuración
console.log('2. Verificando empresa Tempoactiva...');
if (!config.companyPaths || !config.companyPaths['Tempoactiva']) {
    console.error('   ✗ Empresa Tempoactiva no encontrada en la configuración');
    process.exit(1);
}
console.log('   ✓ Empresa Tempoactiva encontrada\n');

// Paso 3: Ejecutar mapeo de directorio con Python
console.log('3. Ejecutando mapeo de directorio...');
console.log(`   Ruta: ${TEMPOACTIVA_ROOT}`);
try {
    const pythonPath = execSync('where python', { encoding: 'utf8' }).split('\n')[0].trim();
    console.log(`   Python: ${pythonPath}`);

    const stdout = execSync(`python "${PYTHON_SCRIPT}" "${TEMPOACTIVA_ROOT}"`, {
        encoding: 'utf8',
        cwd: path.dirname(PYTHON_SCRIPT)
    });

    const newStructure = JSON.parse(stdout);
    console.log('   ✓ Mapeo completado');
    console.log(`   - Archivos encontrados: ${newStructure.total_files}`);
    console.log(`   - Carpetas encontradas: ${newStructure.total_folders}\n`);

    // Paso 4: Actualizar la configuración
    console.log('4. Actualizando configuración...');
    config.companyPaths['Tempoactiva'].structure = newStructure;
    config.companyPaths['Tempoactiva'].root = TEMPOACTIVA_ROOT;

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('   ✓ Configuración actualizada\n');

    console.log('============================================');
    console.log('Proceso completado exitosamente');
    console.log('============================================\n');
    console.log('La estructura de Tempoactiva ha sido regenerada.');
    console.log('Ahora puedes acceder a todos los módulos incluyendo');
    console.log('"2. Gestión Integral del SG-SST > 2.1.1 Politica del SG-SST"');

} catch (error) {
    console.error('   ✗ Error:', error.message);
    console.log('\nPosibles causas:');
    console.log('1. Python no está en el PATH');
    console.log('2. El directorio de Tempoactiva no existe');
    console.log('3. Error en el script de mapeo\n');
    process.exit(1);
}
