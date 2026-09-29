// Temp: smoke test del modal con datos reales del worker ABAD SMITH
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(process.env.APPDATA || '', 'sgsst-electron-app', 'kair.db');

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const cols = db.exec("PRAGMA table_info(base_personal)")[0].values;
  const colNames = cols.map(c => c[1]);

  const worker = db.exec("SELECT * FROM base_personal WHERE cedula LIKE '%1042421436%' LIMIT 1")[0].values[0];
  const p = {};
  colNames.forEach((n, i) => { p[n] = worker[i]; });

  // Simulate the field() helper
  function field(label, name, value, fmt) {
    var raw = (value === '' || value === null || value === undefined) ? '' : String(value);
    var isEmpty = !raw || raw === '0';
    var displayVal = isEmpty ? '—' : (fmt === 'date' ? _fmtDateDisplay(raw) : raw);
    return '  ' + label + ': ' + displayVal;
  }

  function _fmtDateDisplay(val) {
    if (val == null || val === '') return '—';
    var s = String(val).trim();
    var m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return m1[3] + '/' + m1[2] + '/' + m1[1];
    var m2 = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m2) return m2[3] + '/' + m2[2] + '/' + m2[1];
    return s;
  }

  function _calcEdad(fn) {
    if (!fn) return null;
    var s = String(fn).trim();
    var m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var m2 = s.match(/^(\d{4})(\d{2})(\d{2})/);
    var y, mo, d;
    if (m1) { y = +m1[1]; mo = +m1[2] - 1; d = +m1[3]; }
    else if (m2) { y = +m2[1]; mo = +m2[2] - 1; d = +m2[3]; }
    else return null;
    var fn2 = new Date(y, mo, d);
    var hoy = new Date();
    var edad = hoy.getFullYear() - fn2.getFullYear();
    var m = hoy.getMonth() - fn2.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fn2.getDate())) edad--;
    return edad >= 0 ? edad : null;
  }

  function _calcAntiguedad(fi) {
    if (!fi) return '0 día(s) en la empresa';
    var s = String(fi).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '0 día(s) en la empresa';
    var fi2 = new Date(+m[1], +m[2] - 1, +m[3]);
    var hoy = new Date();
    var years = hoy.getFullYear() - fi2.getFullYear();
    var mm = hoy.getMonth() - fi2.getMonth();
    if (mm < 0 || (mm === 0 && hoy.getDate() < fi2.getDate())) years--;
    if (years < 0) years = 0;
    if (years === 0) {
      var days = Math.floor((hoy - fi2) / (1000 * 60 * 60 * 24));
      if (days <= 0) return 'hoy';
      if (days === 1) return '1 día en la empresa';
      return days + ' días en la empresa';
    }
    if (years === 1) return '1 año en la empresa';
    return years + ' años en la empresa';
  }

  console.log('=== MODAL SIMULADO · ABAD SMITH OSPINO CASTRO ===\n');

  // Chips del header
  console.log('--- HEADER CHIPS ---');
  console.log('  Cargo:', p.cargo);
  console.log('  Sede:', p.sede_id);
  console.log('  CC ' + p.cedula);
  console.log('  Edad:', _calcEdad(p.fecha_nacimiento), 'años');
  console.log('  Antigüedad:', _calcAntiguedad(p.fecha_ingreso));
  console.log('  (NOTA: ya NO se concatena "en la empresa")\n');

  console.log('--- TAB: INFORMACIÓN PERSONAL ---');
  console.log(field('Nombres', 'nombres', p.nombres));
  console.log(field('Apellidos', 'apellidos', p.apellidos));
  console.log(field('Tipo de Documento', 'tipoDocumento', p.tipo_documento));
  console.log(field('Cédula', 'cedula', p.cedula));
  console.log(field('Fecha de Expedición Cédula', 'fechaExpCedula', p.fecha_exp_cedula, 'date'));
  console.log(field('Lugar de Expedición Cédula', 'lugarExpCedula', p.lugar_exp_cedula));
  console.log(field('Fecha de Nacimiento', 'fechaNacimiento', p.fecha_nacimiento, 'date'));
  console.log(field('Lugar de Nacimiento', 'lugarNacimiento', p.lugar_nacimiento));
  console.log(field('Teléfono', 'telefono', p.telefono));
  console.log(field('Celular', 'celular', p.celular));
  console.log(field('Email', 'email', p.email));
  console.log(field('Estado Civil', 'estadoCivil', p.estado_civil));
  console.log(field('Nivel Educativo', 'nivelEducativo', p.nivel_educativo));
  console.log(field('Dirección', 'direccion', p.direccion));
  console.log(field('Barrio', 'barrio', p.barrio));
  console.log(field('Ciudad', 'ciudad', p.ciudad));

  console.log('\n--- TAB: DATOS LABORALES ---');
  console.log(field('Cargo', 'cargo', p.cargo));
  console.log(field('Salario', 'salario', p.salario));
  console.log(field('Tipo de Contrato', 'tipoContrato', p.tipo_contrato));
  console.log(field('Fecha de Ingreso', 'fechaIngreso', p.fecha_ingreso, 'date'));
  console.log(field('Fecha de Retiro', 'fechaRetiro', p.fecha_retiro, 'date'));
  console.log(field('Empresa Usuaria', 'empresaUsuaria', p.empresa_usuaria));
  console.log(field('Sede', 'sedeId', p.sede_id));
  console.log('  (Centro de Costo: ELIMINADO — no estaba en schema)');
  console.log(field('Estado', 'estado', p.estado));
  console.log(field('Banco', 'banco', p.banco));
  console.log(field('Número de Cuenta', 'numeroCuenta', p.numero_cuenta));
  console.log(field('S400', 'activoS400', p.activo_s400));

  console.log('\n--- TAB: AFILIACIONES ---');
  console.log(field('EPS', 'eps', p.eps));
  console.log(field('Pensión', 'pension', p.pension));
  console.log(field('ARL', 'arl', p.arl));
  console.log(field('Caja de Compensación', 'cajaCompensacion', p.caja_compensacion));

  db.close();
})();
