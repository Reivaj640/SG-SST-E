// =====================================================================
// 📦1038 — Tests del panel de operador de los anexos
// Ejecutar: node --test main/test-anexos-1038.js
//
// QUE PROTEGE ESTE ARCHIVO
// ------------------------
//
// La vista del operador (`modules/gestion-humana/firma-operador/`) es por donde
// K+AIR lleva el Anexo de Encargo de una Empresa desde la suscripcion hasta la
// contrafirma. Si esta vista se rompe, el operador no puede cumplir el Anexo
// y la Empresa queda bloqueada.
//
// Los guards no son "el texto existe": son invariantes con cota y motivo
// (PROMPT.md §7.1). Cada uno protege algo que, si se rompe, deja al operador
// sin poder hacer su trabajo o le muestra un estado que no es el real:
//
//   - El panel tiene las TRES acciones del Anexo de Encargo. Sin verificar al
//     representante, el service no deja contrafirmar.
//   - El panel NO guarda el codigo de contrafirma en ningun lado. El codigo
//     sale al buzon de K+AIR: si quedara en el disco de la maquina, el control
//     "K+AIR es quien contrafirma" seria de mentira.
//   - El panel distingue "suscrito" de "ejecutado": en el service, FIRMADA
//     significa que la EMPRESA suscribio, no que el instrumento este ejecutado.
//   - El shell monta la vista en su propio caso y `index.html` la carga con su
//     `?v=` (sin el, el navegador sirve la version vieja).
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const MOD_OPERADOR = path.join(__dirname, '..', 'modules', 'gestion-humana', 'firma-operador', 'index.js');
const CSS_OPERADOR = path.join(__dirname, '..', 'modules', 'gestion-humana', 'firma-operador', 'index.css');
const HOME_JS = path.join(__dirname, '..', 'modules', 'gestion-humana', 'gestion-humana-home.js');
const INDEX_HTML = path.join(__dirname, '..', 'index.html');

const srcOperador = fs.readFileSync(MOD_OPERADOR, 'utf8');
const cssOperador = fs.readFileSync(CSS_OPERADOR, 'utf8');
const srcHome = fs.readFileSync(HOME_JS, 'utf8');
const srcIndexHtml = fs.readFileSync(INDEX_HTML, 'utf8');

test('vistas · la vista del operador existe y monta el componente', function () {
  assert.ok(srcOperador.length > 1000, 'el archivo del modulo no esta vacio');
  assert.match(srcOperador, /FirmaOperadorComponent/,
    'el componente tiene que llamarse FirmaOperadorComponent: es el nombre que monta el shell');
  assert.match(srcOperador, /window\[COMPONENT_NAME\]\s*=\s*FirmaOperadorComponent/,
    'y tiene que quedar expuesto en window para que el shell lo monte');
});

test('vistas · la vista del operador tiene las TRES acciones del Anexo de Encargo', function () {
  // Sin estas tres, el operador no puede llevar el Anexo a su fin: sin
  // verificar al representante el service no deja contrafirmar.
  assert.match(srcOperador, /data-fo-accion="verificar"/, 'falta verificar al representante');
  assert.match(srcOperador, /data-fo-accion="pedir-codigo"/, 'falta pedir el codigo de contrafirma');
  assert.match(srcOperador, /data-fo-accion="contrafirmar"/, 'falta contrafirmar');
});

test('vistas · la vista del operador NO guarda el codigo de contrafirma en ningun lado', function () {
  // El codigo sale al buzon de K+AIR. Si la vista lo guardara en el disco
  // del cliente, el control "K+AIR es quien contrafirma" seria de mentira.
  assert.equal(srcOperador.indexOf('localStorage'), -1,
    'la vista del operador no escribe en localStorage: el codigo no se guarda');
  assert.equal(srcOperador.indexOf('sessionStorage'), -1,
    'la vista del operador no escribe en sessionStorage');
  assert.equal(srcOperador.indexOf('writeFile'), -1,
    'la vista del operador no escribe archivos');
});

test('vistas · la vista del operador explica que la admin key es del operador', function () {
  // Si la admin key llegara al equipo de un cliente, ese cliente podria
  // contrafirmar su propio Anexo. La vista lo dice en voz alta.
  assert.match(srcOperador, /no se comparte/,
    'la vista tiene que decir que la admin key no se comparte');
});

test('vistas · la vista del operador distingue suscrito de ejecutado', function () {
  // "FIRMADA" en el service significa que la EMPRESA suscribio. Si la vista
  // lo pintara como "firmado", el operador creeria que el Anexo esta listo
  // cuando la Empresa sigue bloqueada.
  assert.match(srcOperador, /ejecutado/);
  assert.match(srcOperador, /falta contrafirma/,
    'tiene que decir que falta la contrafirma de K+AIR');
  assert.match(srcOperador, /suscrito/);
});

test('vistas · la vista del operador avisa que el enlace sale UNA sola vez', function () {
  // La base solo guarda el HMAC del token: si el operador pierde el
  // enlace, hay que anular y abrir otra.
  assert.match(srcOperador, /una sola vez|una unica vez/,
    'la vista tiene que avisar que el enlace no se puede recuperar');
});

test('vistas · la vista del operador pide el motivo en los tres actos', function () {
  var motivos = srcOperador.match(/fo-(ver|ctr|anu)-motivo/g) || [];
  assert.ok(motivos.length >= 3,
    'los tres actos con motivo (verificar, contrafirmar, anular) tienen su campo: hay ' + motivos.length);
});

test('vistas · 📦1042 · los anexos NO viven en Gestion Humana', function () {
  // Los anexos (Anexo de Encargo y de Nube) son una gestion de K+AIR: usan
  // la credencial ADMINISTRATIVA y se gestionan por empresa desde
  // Configuracion. Meterlos en el modulo de personal era un error de
  // categoria: no le compete a Gestion Humana.
  assert.doesNotMatch(srcHome, /id:\s*'firma-operador'/,
    'la pestana del operador NO tiene que estar en el nav de Gestion Humana');
  assert.doesNotMatch(srcHome, /case 'firma-operador':/,
    'ni el switch de montaje tiene que tener su caso');
  assert.doesNotMatch(srcHome, /view:\s*'firma-operador'/,
    'ni la tarjeta del resumen del modulo');
});

test('vistas · 📦1042 · index.html ya NO carga la vista del operador', function () {
  // La ventana principal ya no la carga: vive en el iframe de Configuracion.
  assert.doesNotMatch(srcIndexHtml, /firma-operador\/index\.css/,
    'la hoja del panel no se carga en la ventana principal');
  assert.doesNotMatch(srcIndexHtml, /firma-operador\/index\.js/,
    'el script del panel no se carga en la ventana principal');
});

test('vistas · 📦1042 · Configuracion carga el panel con su ?v=', function () {
  // La regla del repo: tocar un archivo propio obliga a bumpear su ?v=.
  // Sin esto el navegador sirve la version vieja.
  const srcConfig = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'config', 'config-viewer.html'), 'utf8');
  assert.match(srcConfig, /firma-operador\/index\.css\?v=[^\s"']+/,
    'la hoja del panel se carga en Configuracion con su ?v=');
  assert.match(srcConfig, /firma-operador\/index\.js\?v=[^\s"']+/,
    'el script del panel se carga en Configuracion con su ?v=');
});

test('vistas · 📦1047 · la vista del operador NO pinta el Anexo de Nube como ejecutado sin contrafirma', function () {
  // El Anexo de Nube es BILATERAL (el texto vigente, §10): lo suscribe la
  // Empresa y lo contrafirma K+AIR. Antes la vista pintaba un badge VERDE
  // ("Firmado") con solo la fase 1 (`anexo_nube_firmado_at`): el operador veia
  // un instrumento listo cuando la Empresa seguia sin poder firmar. Es el
  // mismo verde falso que se corrigio en el gate.
  //
  // El guard mira que la vista NO tenga un estado "firmado" en verde para el
  // Anexo de Nube, y que pida los DOS indicadores del listado.
  assert.doesNotMatch(srcOperador, /firmado:\s*\{\s*label:\s*'Firmado'/,
    'el Anexo de Nube no puede tener un estado "Firmado": el instrumento se dice "ejecutado"');
  assert.match(srcOperador, /tiene_anexo_nube_ejecutado/,
    'la vista tiene que mirar el indicador de EJECUCION del Anexo de Nube');
  assert.match(srcOperador, /tiene_anexo_nube_suscrito/,
    'y el de la FASE 1: son dos actos distintos');
});

test('vistas · 📦1047 · el detalle del Anexo de Nube muestra la contrafirma', function () {
  // Sin esto, el operador no ve el segundo acto en ninguna parte de la vista.
  const detalleNube = srcOperador.slice(srcOperador.indexOf('_htmlSuscripcionNube'));
  assert.match(detalleNube, /Contrafirma de K\+AIR/,
    'el detalle del Anexo de Nube tiene que mostrar la contrafirma');
  assert.match(detalleNube, /contrafirmado_at/,
    'y leer la fecha real del segundo acto');
});

test('vistas · 📦1047 · las dos vistas muestran la acreditacion de la facultad de quien contrafirma', function () {
  // 📦1047 · P7 (10-nov-2026). La respuesta del abogado exige que quede
  // acreditada la facultad de quien contrafirma POR GESSTIAR. Si el operador
  // no la ve, la acreditacion existe pero no llega a quien tiene que
  // decidir: el acta dice con que poder se firmo y la pantalla no.
  //
  // La linea tiene que estar en las DOS vistas (Anexo de Nube y Anexo de
  // Encargo): son dos instrumentos y los dos contrafirma K+AIR.
  const detalleNube = srcOperador.slice(srcOperador.indexOf('_htmlSuscripcionNube'));
  const detalleEncargo = srcOperador.slice(srcOperador.indexOf('_htmlSuscripcionEncargo'));

  for (const [nombre, detalle] of [['Nube', detalleNube], ['Encargo', detalleEncargo]]) {
    assert.match(detalle, /Facultad acreditada/,
      'la vista del Anexo de ' + nombre + ' tiene que mostrar la facultad acreditada');
    assert.match(detalle, /contrafirma_evidencia/,
      'y leerla de la EVIDENCIA del acto, que es donde vive el bloque `facultad`');
    assert.match(detalle, /facultad/,
      'y leer el bloque `facultad` de esa evidencia');
  }

  // Y la lectura tiene que distinguir los dos resultados de la comprobacion:
  // el representante legal de Gesstiar y la persona con un poder acreditado.
  assert.match(srcOperador, /REPRESENTANTE_LEGAL_ENCARGADO/,
    'la vista distingue al representante legal de quien actua con un poder acreditado');
});

test('vistas · 📦1082 · la vista del operador SÍ ofrece la contrafirma del Anexo de Nube', function () {
  // 📦1082 · ESTE CHECK INVERTIDO (PROMPT.md §7.3: un check borrado es un
  // hueco; uno invertido sigue protegiendo). Antes exigía que NO hubiera
  // boton de contrafirma del Anexo de Nube, porque NO HABIA CANAL IPC: el
  // service tenia las dos rutas del segundo acto, pero no habia handler en
  // el bridge ni metodo en el preload, y el operador lo hacia por HTTP a
  // mano.
  //
  // 📦1082 · Ahora el canal existe (`firma:anexo:nube-contrafirmar` y
  // `firma:anexo:nube-contrafirma-codigo`, con sus metodos en el preload), y
  // la vista los ofrece. El guard sigue mirando el MISMO bloque: el detalle
  // del Anexo de Nube.
  //
  // Por que esta vez el boton es lo correcto y antes era un error: un boton
  // que no hace nada es peor que un boton que no existe. Con el canal
  // escrito, el boton hace el acto.
  const detalleNube = srcOperador.slice(srcOperador.indexOf('_htmlSuscripcionNube'));
  const finDetalle = detalleNube.indexOf('FirmaOperadorComponent.prototype._htmlEventos');
  const bloque = detalleNube.slice(0, finDetalle > 0 ? finDetalle : detalleNube.length);
  assert.match(bloque, /data-fo-accion="nube-contrafirmar"/,
    'el detalle del Anexo de Nube tiene que ofrecer la contrafirma: el canal IPC existe');
  assert.match(bloque, /data-fo-accion="nube-pedir-codigo"/,
    'y el paso de pedir el codigo de contrafirma del Anexo de Nube');
});

test('vistas · 📦1082 · la vista del Nube NO ofrece el paso de "verificar representante"', function () {
  // El Anexo de Nube NO tiene el paso documental que tiene el Encargo: el
  // cotejo del firmante contra el representante legal de la ficha, y el de la
  // faculty de quien contrafirma por Gesstiar, los hace el propio service
  // (`FIRMANTE_NO_COINCIDE` y `FACULTAD_NO_ACREDITADA`). Un boton de
  // "verificar" para el Nube apuntaria a un paso que no existe.
  const detalleNube = srcOperador.slice(srcOperador.indexOf('_htmlSuscripcionNube'));
  const finDetalle = detalleNube.indexOf('FirmaOperadorComponent.prototype._htmlEventos');
  const bloque = detalleNube.slice(0, finDetalle > 0 ? finDetalle : detalleNube.length);
  assert.doesNotMatch(bloque, /data-fo-accion="nube-verificar"/,
    'el Anexo de Nube no tiene paso de verificar representante: lo hace el service');
});

test('vistas · el CSS de la vista del operador usa los tokens y tiene dark mode', function () {
  assert.match(cssOperador, /var\(--kair-/,
    'el CSS usa los tokens canonicos del design system');
  assert.match(cssOperador, /\[data-theme\^="dark"\]/,
    'y tiene dark mode con el selector unico del design system');
});

test('vistas · el CSS de la vista del operador NO usa clases prohibidas', function () {
  // design_system.md §9.2: estas clases chocan con las del design system.
  ['.k-section-card', '.header-back-btn', '.header-action--ghost'].forEach(function (c) {
    assert.equal(cssOperador.indexOf(c), -1, 'clase prohibida: ' + c);
  });
});
