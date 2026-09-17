// test-bridge.js - Probar que el Bridge carga correctamente
const onlyoffice = require('./modules/gestion-integral/politica/onlyoffice-bridge.js');

console.log('=== PRUEBA DEL BRIDGE ===');
console.log('Bridge cargado correctamente');
console.log('Rutas disponibles:');

// Filtrar las rutas del middleware
const routes = [];
function printRoutes(layer) {
    if (layer.route) {
        routes.push(Object.keys(layer.route.methods).join(' ').toUpperCase() + ' ' + layer.route.path);
    } else if (layer.name === 'router' && layer.handle.stack) {
        layer.handle.stack.forEach(printRoutes);
    }
}
onlyoffice.app._router.stack.forEach(printRoutes);

routes.forEach(r => console.log('  -', r));

console.log('');
console.log('Puerto configurado:', onlyoffice.PORT);
console.log('Servidor OnlyOffice:', 'http://localhost:8080');
console.log('');
console.log('=== PRUEBA COMPLETA ===');
