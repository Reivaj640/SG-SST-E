// test-ausentismo-busqueda-cedula.js
// 📦1099 (2026-11-25) — La búsqueda de cédula va a la base de Gestión Humana
// (`base_personal`, SQLite) y NO al Excel del Drive. Sin respaldo Excel: si la
// cédula no está en la base, se dice "Empleado no encontrado" y se limpian los
// campos.
//
// 📦1100 — Si la cédula no está en la empresa del usuario, se busca en las
// bases de las OTRAS empresas y se avisa en cuál está (modal "Empresa
// Diferente" en el formulario, aviso en el modal de nueva gestante).
//
// Cubre los 3 puntos que antes leían el Excel:
//   1. Formulario de Registro (medicion-ausentismo.js, blur de #cedula-input)
//   2. Gestación · modal nueva gestante (gestacion-seguimiento-home.js)
//   3. Gestación · antesala (gestacion-antesala.js)
// Más el cache-bust de los 3 archivos en sus HTML.
//
// Patrón del repo: los métodos se EXTRAEr del archivo real con new Function
// (como test-ausentismo-vistas.js) y se ejecutan con un puente simulado; el
// blur del Formulario es un arrow anónimo adentro de un addEventListener, así
// que ese se chequea sobre el FUENTE (como test-ausentismo-estructura-985.js).
//
// Ejecución: node main/test-ausentismo-busqueda-cedula.js
// (no usa better-sqlite3 ni electron: solo lee archivos y corre funciones)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUTA_MEDICION = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'medicion-ausentismo.js');
const RUTA_SEGUIMIENTO = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'gestacion-seguimiento-home.js');
const RUTA_ANTESALA = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'gestacion-antesala.js');
const RUTA_INDEX = path.join(ROOT, 'index.html');
const RUTA_HTML_SEG = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'gestacion-seguimiento-home.html');
const RUTA_HTML_ANT = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo', 'gestacion-antesala.html');

const srcMedicion = fs.readFileSync(RUTA_MEDICION, 'utf8');
const srcSeguimiento = fs.readFileSync(RUTA_SEGUIMIENTO, 'utf8');
const srcAntesala = fs.readFileSync(RUTA_ANTESALA, 'utf8');
const htmlIndex = fs.readFileSync(RUTA_INDEX, 'utf8');
const htmlSeg = fs.readFileSync(RUTA_HTML_SEG, 'utf8');
const htmlAnt = fs.readFileSync(RUTA_HTML_ANT, 'utf8');

const checks = [];
function ok(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra == null ? '' : String(extra) });
}

// ══════════════════════════════════════════════════════════════════
// Helpers: extraer un metodo del archivo real (copiado de
// test-ausentismo-vistas.js para que el test no pase contra una copia)
// ══════════════════════════════════════════════════════════════════
function extraerMetodo(fuente, nombre) {
  // Acepta las dos formas del repo: metodo de clase ("    metodo(args) {")
  // y funcion suelta de un IIFE ("    async function metodo(args) {").
  const re = new RegExp('^    (?:async\\s+)?(?:function\\s+)?' + nombre + '\\s*\\(', 'm');
  const m = re.exec(fuente);
  if (!m) return null;
  const inicio = m.index;
  const llaveAbierta = fuente.indexOf('{', inicio);
  if (llaveAbierta < 0) return null;
  let nivel = 0;
  let enTexto = false;
  let esc = false;
  let enComentario = false;
  for (let i = llaveAbierta; i < fuente.length; i++) {
    const c = fuente[i];
    if (enComentario) {
      if (c === '\n') enComentario = false;
      continue;
    }
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '/' && fuente[i + 1] === '/') { enComentario = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { enTexto = !enTexto; continue; }
    if (enTexto) continue;
    if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) return fuente.slice(inicio, i + 1);
    }
  }
  return null;
}

/** Convierte el bloque extraido en una funcion suelta. */
function comoFuncion(fuenteMetodo) {
  const esAsync = /^\s*async\s/.test(fuenteMetodo);
  const sinEspacios = fuenteMetodo.replace(/^\s+/, '').replace(/^async\s+/, '');
  const yaEsFunction = /^function\s/.test(sinEspacios);
  const nombre = sinEspacios.match(/^(?:function\s+)?([A-Za-z_][A-Za-z0-9_]*)/)[1];
  // Si el bloque ya dice "function nombre(...)", solo se le pone el "async".
  const cabeza = yaEsFunction
    ? (esAsync ? 'async ' : '')
    : (esAsync ? 'async function ' : 'function ');
  return new Function(cabeza + sinEspacios + '\nreturn ' + nombre + ';')();
}

/** Bloque del blur de #cedula-input (de su addEventListener al próximo paso). */
function bloqueBlur() {
  const inicio = srcMedicion.indexOf("cedulaInput.addEventListener('blur'");
  if (inicio < 0) return '';
  const fin = srcMedicion.indexOf('// 2. Autocompletar descripción CIE-10', inicio);
  return fin > inicio ? srcMedicion.slice(inicio, fin) : srcMedicion.slice(inicio, inicio + 4000);
}

async function main() {

  // ══════════════════════════════════════════════════════════════
  // 1) Formulario de Registro (medicion-ausentismo.js) — fuente
  // ══════════════════════════════════════════════════════════════
  const blur = bloqueBlur();

  ok('1) existe el blur de #cedula-input', blur.length > 0);
  ok('1) el blur llama a ausentismoBuscarEmpleado (canal de la base)',
    /ausentismoBuscarEmpleado\(/.test(blur));
  ok('1) el blur ya NO llama a buscarEmpleadoPorCedula (Excel)',
    !/buscarEmpleadoPorCedula/.test(blur));
  ok('1) manda cedula y empresaId (this.currentCompany)',
    /ausentismoBuscarEmpleado\(\{\s*cedula:\s*cedula\s*,\s*empresaId:\s*this\.currentCompany\s*,?\s*buscarEnTodasLasEmpresas:\s*true\s*\}/.test(blur));
  ok('1) busca en las bases de las demás empresas (buscarEnTodasLasEmpresas)',
    /buscarEnTodasLasEmpresas:\s*true/.test(blur));
  ok('1) mira si la persona es de la empresa del usuario (result.esEmpresaActual)',
    /result\.esEmpresaActual/.test(blur));
  ok('1) si es de OTRA empresa, abre el modal "Empresa Diferente"',
    /showEmpresaMismatchModal\(/.test(blur) &&
    /result\.esEmpresaActual\s*===\s*false/.test(blur));
  ok('1) el modal se abre SOLO cuando NO es la empresa del usuario',
    blur.indexOf('showEmpresaMismatchModal(') > blur.indexOf('result.esEmpresaActual === false'),
    blur.indexOf('showEmpresaMismatchModal(') + ' vs ' + blur.indexOf('result.esEmpresaActual === false'));
  ok('1) el modal dice que los datos se guardan en la BASE (no en "el archivo")',
    /se guardarán en la base/.test(srcMedicion) && !/se guardarán en el archivo/.test(srcMedicion));
  ok('1) lee result.data (la forma del puente), no result.datos',
    /result\.data/.test(blur) && !/result\.datos/.test(blur));

  // Mapeo campo por campo (los mismos 5 que traía el Excel)
  const campos = [
    ['nombre-input', 'nombre'],
    ['cargo-input', 'cargo'],
    ['departamento-input', 'area'],
    ['empresa-usuaria-input', 'empresa_usuaria'],
    ['entidad-input', 'entidad']
  ];
  campos.forEach(([id, campo]) => {
    const re = new RegExp("getElementById\\('" + id + "'\\)\\.value = (result\\.data\\." + campo + ")", '');
    ok('1) ' + id + ' <- data.' + campo, re.test(blur));
  });

  ok('1) 📦1100 — el modal "Empresa Diferente" vuelve a usarse (la búsqueda ya llega a otras empresas)',
    /showEmpresaMismatchModal\(/.test(blur));
  ok('1) si no está en la base avisa "Empleado no encontrado. Diligencie manualmente."',
    /Empleado no encontrado\. Diligencie manualmente\./.test(blur));
  ok('1) si no está, limpia los 5 campos', campos.every(([id]) =>
    new RegExp("getElementById\\('" + id + "'\\)\\.value = ''", '').test(blur)));
  ok('1) guarda defensivo: solo busca si el canal existe',
    /typeof window\.electronAPI\.ausentismoBuscarEmpleado === 'function'/.test(blur));
  ok('1) conserva el spinner "Buscando empleado..."',
    /Buscando empleado\.\.\./.test(blur));

  // ══════════════════════════════════════════════════════════════
  // 2) Gestación · modal nueva gestante (_autollenarDatosPersonal) — ejecutado
  // ══════════════════════════════════════════════════════════════
  const fnSegRaw = extraerMetodo(srcSeguimiento, '_autollenarDatosPersonal');
  ok('2) existe _autollenarDatosPersonal en gestacion-seguimiento-home.js', !!fnSegRaw);

  const CAMPOS_SEG = [
    ['ngNombre', 'nombre'],
    ['ngCargo', 'cargo'],
    ['ngEps', 'entidad'],
    ['ngArl', 'arl'],
    ['ngArea', 'area'],
    ['ngEmpresaNombre', 'empresa'],
    ['ngEmpresaCliente', 'empresa_usuaria']
  ];

  if (fnSegRaw) {
    const llamadas = [];
    const toasts = [];
    const els = {};
    CAMPOS_SEG.forEach(([id]) => { els[id] = { value: 'VIEJO', placeholder: '' }; });

    global.window = {
      electronAPI: {
        ausentismoBuscarEmpleado: async function (params) {
          llamadas.push(params);
          return {
            success: true,
            esEmpresaActual: true,
            empresasEncontradas: [],
            data: {
              nombre: 'MARIA GARCIA', cargo: 'OPERATIVA', entidad: 'SURA', arl: 'POSITIVA',
              area: 'SEDE 1', empresa: 'Tempoactiva', empresa_usuaria: 'CLIENTE SAS'
            }
          };
        },
        buscarEmpleadoPorCedula: async function () {
          llamadas.push('VIEJO-CANAL');
          return { success: true, datos: { nombre: 'DEL EXCEL' } };
        }
      }
    };
    global.document = { getElementById: id => els[id] || null };
    global._state = { empresaId: 'emp-1' };
    global._mostrarToast = (tipo, titulo, msg) => toasts.push({ tipo, titulo, msg });
    // 📦1100 — Aviso inline bajo la cédula (elemento real del modal).
    els.ngCedulaAviso = { textContent: '', style: { display: 'none' } };

    const fnSeg = comoFuncion(fnSegRaw);
    els.ngCedula = { value: ' 1.044.392.755 ', placeholder: '' };
    await fnSeg();

    ok('2) llama a ausentismoBuscarEmpleado y NO al canal del Excel',
      llamadas.length === 1 && llamadas[0] !== 'VIEJO-CANAL' && typeof llamadas[0] === 'object',
      JSON.stringify(llamadas));
    ok('2) manda cedula normalizada y empresaId del contexto',
      llamadas[0] && llamadas[0].cedula === '1.044.392.755' && llamadas[0].empresaId === 'emp-1',
      JSON.stringify(llamadas[0]));
    ok('2) pide buscar en las bases de las demás empresas',
      llamadas[0] && llamadas[0].buscarEnTodasLasEmpresas === true, JSON.stringify(llamadas[0]));
    CAMPOS_SEG.forEach(([id, campo]) => {
      const esperado = {
        nombre: 'MARIA GARCIA', cargo: 'OPERATIVA', entidad: 'SURA', arl: 'POSITIVA',
        area: 'SEDE 1', empresa: 'Tempoactiva', empresa_usuaria: 'CLIENTE SAS'
      }[campo];
      ok('2) ' + id + ' <- data.' + campo, els[id].value === esperado, els[id].value);
    });
    ok('2) toast de éxito con el nombre', toasts.some(t => t.tipo === 'success' && /MARIA GARCIA/.test(t.msg)),
      JSON.stringify(toasts));

    // No encontrada: limpia todo (manteniendo la cédula)
    CAMPOS_SEG.forEach(([id]) => { els[id].value = 'VIEJO'; });
    toasts.length = 0; llamadas.length = 0;
    global.window.electronAPI.ausentismoBuscarEmpleado = async function (params) {
      llamadas.push(params);
      return { success: true, data: null };
    };
    await fnSeg();
    ok('2) si no está en la base, limpia los 7 campos',
      CAMPOS_SEG.every(([id]) => els[id].value === ''),
      JSON.stringify(CAMPOS_SEG.map(([id]) => els[id].value)));
    ok('2) avisa "No encontrada" y pide diligenciar a mano',
      toasts.some(t => t.tipo === 'warning' && /No encontrada/.test(t.titulo) && /manualmente/.test(t.msg)),
      JSON.stringify(toasts));
    ok('2) el placeholder "Buscando..." se restaura al final',
      els.ngNombre.placeholder === 'Nombres y apellidos', els.ngNombre.placeholder);
    ok('2) en el archivo no queda ninguna llamada al canal del Excel',
      !/electronAPI\.buscarEmpleadoPorCedula/.test(srcSeguimiento));

    // 2b) La persona está en OTRA empresa: se avisa pero NO se autollenan
    // los datos (acá se está creando una gestante para la empresa activa).
    CAMPOS_SEG.forEach(([id]) => { els[id].value = 'VIEJO'; });
    toasts.length = 0; llamadas.length = 0;
    global.window.electronAPI.ausentismoBuscarEmpleado = async function (params) {
      llamadas.push(params);
      return {
        success: true,
        esEmpresaActual: false,
        empresasEncontradas: ['Temposum E.S.', 'Aseplus E.S.'],
        data: { nombre: 'MARIA GARCIA', cargo: 'OPERATIVA', entidad: 'SURA', empresa: 'Temposum E.S.' }
      };
    };
    await fnSeg();
    ok('2b) si está en otra empresa, avisa en cuál está',
      toasts.some(t => /otra empresa/i.test(t.titulo) && /Temposum/.test(t.msg)),
      JSON.stringify(toasts));
    ok('2b) si está en otra empresa, NO autollena los datos',
      CAMPOS_SEG.every(([id]) => els[id].value === ''),
      JSON.stringify(CAMPOS_SEG.map(([id]) => els[id].value)));
    ok('2b) si la cédula aparece en varias empresas, lista las otras',
      toasts.some(t => /también aparece en/i.test(t.msg) && /Aseplus/.test(t.msg)),
      JSON.stringify(toasts));
    ok('2b) el aviso inline bajo la cédula dice en qué empresa está',
      els.ngCedulaAviso.style.display === 'block' &&
      /Temposum/.test(els.ngCedulaAviso.textContent),
      JSON.stringify(els.ngCedulaAviso));
    ok('2b) el aviso inline también lista las otras empresas',
      /Aseplus/.test(els.ngCedulaAviso.textContent), els.ngCedulaAviso.textContent);

    // El aviso inline se limpia cuando la búsqueda vuelve a la empresa activa.
    CAMPOS_SEG.forEach(([id]) => { els[id].value = 'VIEJO'; });
    toasts.length = 0; llamadas.length = 0;
    global.window.electronAPI.ausentismoBuscarEmpleado = async function (params) {
      llamadas.push(params);
      return {
        success: true,
        esEmpresaActual: true,
        empresasEncontradas: ['Tempoactiva'],
        data: { nombre: 'MARIA GARCIA', cargo: 'OPERATIVA', entidad: 'SURA', empresa: 'Tempoactiva' }
      };
    };
    await fnSeg();
    ok('2b) el aviso inline se oculta cuando la persona es de la empresa activa',
      els.ngCedulaAviso.style.display === 'none' && els.ngCedulaAviso.textContent === '',
      JSON.stringify(els.ngCedulaAviso));
  }

  // ══════════════════════════════════════════════════════════════
  // 3) Gestación · antesala (_cargarDatos, enriquecimiento) — ejecutado
  // ══════════════════════════════════════════════════════════════
  const fnAntRaw = extraerMetodo(srcAntesala, '_cargarDatos');
  ok('3) existe _cargarDatos en gestacion-antesala.js', !!fnAntRaw);
  ok('3) existe el filtro de datos "_datoUtil" (descarta "0" y vacíos)', !!extraerMetodo(srcAntesala, '_datoUtil'));

  if (fnAntRaw) {
    // El filtro de datos es parte del módulo: se usa el código REAL, no una copia.
    const fnHelperRaw = extraerMetodo(srcAntesala, '_datoUtil');
    global._datoUtil = fnHelperRaw ? comoFuncion(fnHelperRaw) : function (v) { return v == null ? '' : String(v).trim(); };
    ok('3) el enriquecimiento pasa los datos por _datoUtil',
      /_datoUtil\(/.test(fnAntRaw));

    const llamadas = [];
    const renders = [];
    let estadoToast = null;

    function montar(resEmp) {
      global.window = {
        electronAPI: {
          gestacionObtenerGestante: async () => ({
            success: true,
            data: { cedula: '1044392755', clasificacion: 'alto', seguimientos: [] }
          }),
          ausentismoBuscarEmpleado: async function (params) {
            llamadas.push(params);
            if (resEmp instanceof Error) throw resEmp;
            return resEmp;
          },
          buscarEmpleadoPorCedula: async function () {
            llamadas.push('VIEJO-CANAL');
            return { success: true, datos: {} };
          }
        }
      };
      global._state = {
        empresaId: 'emp-1', gestanteId: 'g1', gestante: null,
        seguimientos: [], error: null, loading: false, frecuencia: null
      };
      global._setSyncBadge = () => {};
      global._renderLoading = () => { renders.push('loading'); };
      global._renderError = m => { renders.push('error:' + m); };
      global._renderTodo = () => { renders.push('todo'); };
      global._mostrarToast = (tipo, titulo, msg) => { estadoToast = { tipo, titulo, msg }; };
      global._frecuenciaPorRiesgo = () => 'mensual';
    }

    const fnAnt = comoFuncion(fnAntRaw);

    // 3a) con teléfono y correo en la base
    montar({ success: true, data: { telefono: '3001112233', correo: 'maria@empresa.com' } });
    await fnAnt();
    ok('3) el enriquecimiento llama a ausentismoBuscarEmpleado (no al canal del Excel)',
      llamadas.length === 1 && llamadas[0] !== 'VIEJO-CANAL' && typeof llamadas[0] === 'object',
      JSON.stringify(llamadas));
    ok('3) manda la cédula de la gestante y la empresa',
      llamadas[0] && llamadas[0].cedula === '1044392755' && llamadas[0].empresaId === 'emp-1',
      JSON.stringify(llamadas[0]));
    ok('3) pide buscar en las bases de las demás empresas',
      llamadas[0] && llamadas[0].buscarEnTodasLasEmpresas === true, JSON.stringify(llamadas[0]));
    ok('3) data.telefono llena el teléfono de la gestante',
      global._state.gestante.telefono === '3001112233', global._state.gestante.telefono);
    ok('3) data.correo llena el correo de la gestante',
      global._state.gestante.correo === 'maria@empresa.com', global._state.gestante.correo);
    ok('3) sigue renderizando la vista (no bloquea)', renders.includes('todo'), JSON.stringify(renders));

    // 3b) si el alias trae celular en vez de teléfono
    montar({ success: true, data: { celular: '3114445566' } });
    await fnAnt();
    ok('3) data.celular también sirve como teléfono',
      global._state.gestante.telefono === '3114445566', global._state.gestante.telefono);

    // 3b2) la base guarda "0" cuando la persona NO tiene teléfono: eso no es
    // un teléfono y no se debe mostrar.
    montar({ success: true, data: { telefono: '0', celular: '3114445566' } });
    await fnAnt();
    ok('3) un teléfono "0" no se muestra (usa el celular)',
      global._state.gestante.telefono === '3114445566', global._state.gestante.telefono);

    montar({ success: true, data: { telefono: '0' } });
    await fnAnt();
    ok('3) un teléfono "0" sin celular deja el teléfono vacío',
      !global._state.gestante.telefono,
      JSON.stringify(global._state.gestante.telefono));

    // 3c) no bloqueante: si la búsqueda falla, la vista se renderiza igual
    montar(new Error('sin base'));
    await fnAnt();
    ok('3) si la búsqueda falla, igual renderiza (no bloquea)',
      renders.includes('todo') && !renders.some(r => r.startsWith('error')), JSON.stringify(renders));

    ok('3) en el archivo no queda ninguna llamada al canal del Excel',
      !/electronAPI\.buscarEmpleadoPorCedula/.test(srcAntesala));
  }

  // ══════════════════════════════════════════════════════════════
  // 4) Cero llamadas al Excel en los 3 archivos (el canal viejo queda dormido)
  // ══════════════════════════════════════════════════════════════
  ok('4) medicion-ausentismo.js ya no llama al canal del Excel',
    !/electronAPI\.buscarEmpleadoPorCedula/.test(srcMedicion));
  ok('4) el blur no lee result.datos (forma del Excel)', !/result\.datos/.test(bloqueBlur()));

  // ══════════════════════════════════════════════════════════════
  // 5) Cache-bust: los 3 archivos cambiados tienen ?v= en su HTML
  // ══════════════════════════════════════════════════════════════
  ok('5) index.html versiona medicion-ausentismo.js',
    /medicion-ausentismo\.js\?v=[A-Za-z0-9-]+/.test(htmlIndex));
  ok('5) gestacion-seguimiento-home.html versiona su .js',
    /gestacion-seguimiento-home\.js\?v=[A-Za-z0-9-]+/.test(htmlSeg));
  ok('5) gestacion-antesala.html versiona su .js',
    /gestacion-antesala\.js\?v=[A-Za-z0-9-]+/.test(htmlAnt));

  // ══════════════════════════════════════════════════════════════
  // 6) 📦1100 — El aviso de "otra empresa" nunca se pierde en silencio
  // ══════════════════════════════════════════════════════════════
  ok('6) el modal de nueva gestante tiene un aviso inline bajo la cédula',
    /ngCedulaAviso/.test(srcSeguimiento));
  ok('6) el aviso inline se muestra (display:block) cuando es de otra empresa',
    /avisoEl\.style\.display = 'block'/.test(srcSeguimiento));
  ok('6) el aviso inline se limpia en cada búsqueda',
    /_limpiarAviso\(\)/.test(srcSeguimiento));
  ok('6) el toast tiene respaldo en consola (no se pierde en silencio)',
    /console\.warn\('\[GESTION-SEGUIMIENTO\] Toast sin notificador/.test(srcSeguimiento));

  // ══════════════════════════════════════════════════════════════
  // Resumen
  // ══════════════════════════════════════════════════════════════
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦1099-1100 · Búsqueda de cédula en la base de GH');
  console.log('=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
