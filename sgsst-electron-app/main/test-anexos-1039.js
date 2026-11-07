// =====================================================================
// 📦1039 — Tests del panel de estado del Anexo que ve el cliente
// Ejecutar: node --test main/test-anexos-1039.js
//
// QUE PROTEGE ESTE ARCHIVO
// ------------------------
//
// La tarjeta nueva de `modules/gestion-humana/firma-electronica/index.js` le
// dice a la Empresa en que estado esta su Anexo de Encargo. Los guards son
// invariantes con cota y motivo (PROMPT.md §7.1), y protegen tres cosas:
//
//   - La tarjeta consulta el canal del CLIENTE (`firma:empresa:anexos`), que
//     va con la API key DE LA EMPRESA: el cliente solo puede ver lo suyo.
//   - La tarjeta MUESTRA el mensaje del service, no lo reescribe. Ese mensaje
//     es lo que distingue "suscribio pero K+AIR no ha contrafirmado" de "no
//     tiene Anexo": si la vista lo reescribiera, volveria a mentir.
//   - La tarjeta NO inventa un canal de admin. Si usara uno, el cliente podria
//     leer los anexos de las demas empresas.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const MOD_CLIENTE = path.join(__dirname, '..', 'modules', 'gestion-humana', 'firma-electronica', 'index.js');
const INDEX_HTML = path.join(__dirname, '..', 'index.html');

const srcCliente = fs.readFileSync(MOD_CLIENTE, 'utf8');
const srcIndexHtml = fs.readFileSync(INDEX_HTML, 'utf8');

test('vistas · la tarjeta del cliente consulta el estado con el canal del cliente', function () {
  assert.match(srcCliente, /fe-anexo-estado/,
    'la tarjeta del estado del Anexo tiene que existir en la vista del cliente');
  assert.match(srcCliente, /firmaEmpresaAnexos/,
    'y tiene que consultar el canal del cliente (firma:empresa:anexos)');
  assert.match(srcCliente, /_renderEstadoAnexo/,
    'con una funcion propia que la pinte');
});

test('vistas · la tarjeta del cliente MUESTRA el mensaje del service, no lo reescribe', function () {
  // El mensaje del service distingue "suscribio pero K+AIR no ha contrafirmado"
  // de "no tiene Anexo". Si la vista lo reescribiera, volveria a mentir.
  assert.match(srcCliente, /hab\.mensaje/,
    'la tarjeta tiene que mostrar el mensaje del service tal cual');
});

test('vistas · la tarjeta del cliente no se inventa un endpoint de admin', function () {
  // El cliente ve SU estado. Si la vista usara un canal admin, el cliente
  // podria leer los anexos de las demas empresas.
  var bloque = srcCliente.slice(srcCliente.indexOf('_renderEstadoAnexo'));
  var largo = Math.min(bloque.length, 4000);
  var recorte = bloque.slice(0, largo);
  assert.equal(recorte.indexOf('firmaAnexoEstado'), -1,
    'la vista del cliente no usa el canal admin del detalle');
  assert.equal(recorte.indexOf('firmaAnexoEmpresas'), -1,
    'la vista del cliente no lista las empresas');
});

test('vistas · el ?v= del CSS y del JS de la vista se sube con la tarjeta', function () {
  // La trampa 10 y la 12 del PROMPT.md: tocar un CSS o un JS obliga a subir
  // su `?v=` en el index.html. Sin esto, Electron sirve la version vieja de
  // la hoja y el cliente ve la tarjeta a medias: el HTML nuevo con el CSS
  // viejo. Es la clase de bug que se persigue como si fuera de estilos.
  //
  // La cota: los dos `?v=` tienen que ser EL MISMO token (si no, la pagina
  // carga dos versiones distintas de la vista) y tiene que ser DISTINTO del
  // que estaba antes de esta tanda.
  var css = (srcIndexHtml.match(/firma-electronica\/index\.css\?v=([^\s"']+)/) || [])[1];
  var js = (srcIndexHtml.match(/firma-electronica\/index\.js\?v=([^\s"']+)/) || [])[1];

  assert.ok(css, 'el CSS de la vista del cliente se carga con su ?v=');
  assert.ok(js, 'el JS de la vista del cliente se carga con su ?v=');
  assert.equal(css, js,
    'el CSS y el JS de la misma vista comparten el token: si no, la pagina carga dos versiones');
  assert.notEqual(css, 'GH-20261021-firma-dual-card',
    'el token del CSS tiene que haber subido: la hoja cambio');
  assert.notEqual(js, 'GH-20261022-retencion-codigo',
    'el token del JS tiene que haber subido: el script cambio');
});
