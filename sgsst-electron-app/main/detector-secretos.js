/* 📦1047 — Detector de secretos en el árbol versionado.
 *
 * Por qué existe (10-nov-2026): dos veces este repo publicó un secreto vivo en
 * su historial público:
 *
 *   - P11: las app passwords de Gmail de los cinco clientes de remisiones
 *     médicas (4 buzones, 5 claves), que quedaron escritas en `utils/emailSender.js`
 *     y duplicadas en `Portear/src/`. Estuvieron en 7–8 commits alcanzables desde
 *     `origin/Dev`, `origin/Dev-Pc` y `origin/HEAD`.
 *   - P12: el token personal clásico de GitHub (`ghp_…`), que estaba en
 *     `build-and-publish.bat` y en un documento borrado en el 📦580.
 *
 * Los dos se quitaron del código, pero "quitarlos del código" no es lo mismo
 * que "que no vuelvan": hace falta una guarda que se ejecute sola.
 *
 * QUÉ HACE
 *   Escanea SOLO los archivos versionados (`git ls-files`) y reporta, por regla,
 *   archivo y línea. NUNCA imprime el valor encontrado: el que lo lee tiene que
 *   poder corregir sin que el secreto quede en el log de otra parte.
 *
 * QUÉ NO HACE
 *   No escanea el historial (eso lo hace el barrido completo, que es una
 *   operación aparte y mas pesada), no toca los `.env` locales (no están
 *   versionados: ahí es donde DEBEN vivir los valores) y no bloquea por
 *   "parecido": una regla que marca de más se apaga y no protege a nadie.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP, '..');

/* Los dos archivos que contienen los patrones: se autoexcluyen del barrido.
 * Se excluyen SOLO ellos, y el test lo verifica (si alguien agranda la lista,
 * el test se cae). */
const AUTOEXCLUIDOS = [
  'sgsst-electron-app/main/detector-secretos.js',
  'sgsst-electron-app/main/test-secretos-1047.js',
];

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB: por encima de esto no hay secretos que leer

/* Un placeholder NO es un secreto. El repo usa "xxxx xxxx xxxx xxxx" como
 * ejemplo en la guardia de build y en la documentación: ese texto se puede
 * escribir en un archivo versionado, es lo que se le muestra al operador. */
function esPlaceholder(valor) {
  const v = String(valor || '').trim().toLowerCase();
  if (!v) return true;
  if (/^x{4}(\s+x{4}){3}$/.test(v)) return true;      // xxxx xxxx xxxx xxxx
  if (/^tu[_-]?token/i.test(v)) return true;            // TU_TOKEN_AQUI
  if (/^<.*>$/.test(v)) return true;                    // <TU_TOKEN>
  if (/^(changeme|cambiar|pendiente|placeholder|ejemplo|example)$/i.test(v)) return true;
  return false;
}

/* Palabras de 4 letras que aparecen en prosa (castellano e ingles). Una app
 * password de Google son 16 letras al azar en 4 grupos: la probabilidad de que
 * un grupo sea una palabra corriente es baja, pero no nula. Por eso el filtro
 * no exige que NINGUN grupo sea palabra: exige que DOS O MAS lo sean, que es
 * la firma de una frase ("cada html sean byte") y no la de un secreto.
 *
 * Sin este filtro la regla marca el texto del repo que habla de app passwords
 * y el informe deja de servir: una regla que marca de mas se apaga y no
 * protege a nadie. */
const PALABRAS_CORRIENTES = new Set([
  'cada', 'html', 'sean', 'byte', 'esta', 'este', 'esto', 'para', 'como',
  'mas', 'pero', 'todo', 'otra', 'otro', 'nada', 'algo', 'pues', 'segun', 'entre',
  'sobre', 'hacia', 'desde', 'hasta', 'caso', 'casos', 'nuevo', 'mismo', 'forma',
  'parte', 'tema', 'temas', 'dato', 'datos', 'base', 'tipo', 'tipos', 'area',
  'aqui', 'alli', 'asi', 'aun', 'tan', 'sin', 'con', 'por', 'que',
  'los', 'las', 'del', 'uno', 'dos', 'tres', 'casi', 'hace', 'muy', 'tambien',
  'donde', 'cuando', 'porque', 'puede', 'debe', 'tiene', 'hay', 'ser', 'ver',
  'info', 'site', 'webs', 'apps', 'file', 'files', 'data', 'user', 'users',
  'name', 'code', 'load', 'read', 'save', 'open', 'edit', 'view', 'page', 'link',
  'next', 'last', 'back', 'home', 'true', 'null', 'void', 'case', 'else', 'then',
  'some', 'many', 'more', 'most', 'less', 'than', 'when', 'what', 'your', 'them',
  'will', 'with', 'from', 'have', 'here', 'does', 'help', 'keep', 'look',
  'solo', 'capa', 'deja', 'pasa', 'sino', 'haya', 'sea', 'sido', 'sido',
  'bajo', 'tras', 'vez', 'van', 'son', 'fue', 'era', 'tal', 'cual', 'cuan',
]);

/** ¿El grupo de 4 letras parece una palabra corriente? */
function esPalabraCorriente(grupo) {
  return PALABRAS_CORRIENTES.has(String(grupo || '').toLowerCase());
}

/** Un valor de 4 grupos es prosa cuando DOS O MAS grupos son palabras. */
function pareceFrase(valor) {
  const grupos = String(valor || '').trim().split(/\s+/);
  if (grupos.length !== 4) return false;
  return grupos.filter(esPalabraCorriente).length >= 2;
}

/* Letras que no aparecen en el castellano y casi no en el ingles de cuatro
 * letras. Una app password de Google son 16 letras al azar: la probabilidad de
 * que NO tenga NINGUNA de estas cuatro es de 13 %. Ese filtro separa el
 * secreto de la prosa ("solo esta capa deja") sin diccionario. La regla de
 * ASIGNACION no depende de este filtro: esa es la que atrapa los casos reales
 * (P11 y P12 vivian en asignaciones), y esta es la secundaria, la que revisa
 * texto libre. */
const LETRAS_RARAS = /[kqwz]/;
function tieneLetraRara(valor) {
  return LETRAS_RARAS.test(String(valor || ''));
}

/* Las reglas. Cada una devuelve el valor encontrado (para poder decidir si es
 * placeholder) o null si la línea no tiene nada de esa regla. */
const REGLAS = [
  {
    id: 'token_github_clasico',
    descripcion: 'Token personal clasico de GitHub (ghp_/gho_/ghu_/ghs_/ghr_)',
    re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/,
    valor: function (m) { return m[1]; },
  },
  {
    id: 'token_github_fine_grained',
    descripcion: 'Token fine-grained de GitHub (github_pat_)',
    re: /\bgithub_pat_[A-Za-z0-9_]{30,}/,
    valor: function (m) { return m[0]; },
  },
  {
    id: 'clave_aws',
    descripcion: 'Access key ID de AWS',
    re: /\bAKIA[0-9A-Z]{16}\b/,
    valor: function (m) { return m[0]; },
  },
  {
    id: 'app_password_gmail',
    descripcion: 'App password de Google (16 caracteres en 4 grupos) asignada a una variable de contrasena',
    re: /([A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|APIKEY|API_KEY|CONTRASENA|CONTRASEÑA|CLAVE)[A-Za-z0-9_]*)\s*[:=]\s*["']?([a-z]{4}(?:[ ]+[a-z]{4}){3})/i,
    valor: function (m) { return m[2]; },
  },
  {
    // El valor tiene que estar DELIMITADO (comillas, backticks, igual o fin de
    // linea) y traer AL MENOS UNA letra que no aparece en las palabras
    // corrientes. Sin las dos exigencias la regla marca prosa en espanol:
    // "solo esta capa deja" tiene 16 letras en 4 palabras y no es un secreto.
    // Una regla que marca de mas se apaga y no protege a nadie.
    id: 'app_password_gmail_en_texto',
    descripcion: 'App password de Google escrita entre comillas o backticks',
    re: /(["'`=]\s?)([a-z]{4}(?:[ ]+[a-z]{4}){3})(["'`;,)\]]|$)/,
    exigeLetraRara: true,
    valor: function (m) { return m[2]; },
  },
  {
    id: 'llave_privada',
    descripcion: 'Bloque de llave privada',
    re: new RegExp('-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    valor: function (m) { return 'PRIVATE KEY BLOCK'; },
  },
];

/**
 * Analiza un texto y devuelve los hallazgos: [{regla, linea, valor}]
 * El valor se devuelve para que el llamador pueda decidir, pero NUNCA se imprime.
 */
function detectarEnTexto(texto) {
  const hallazgos = [];
  const lineas = String(texto).split(/\r?\n/);
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea || linea.length > 5000) continue;
    for (const regla of REGLAS) {
      const m = regla.re.exec(linea);
      if (!m) continue;
      if (regla.contexto && !regla.contexto.test(linea)) continue;
      const valor = regla.valor(m);
      if (valor && esPlaceholder(valor)) continue;
      if (valor && pareceFrase(valor)) continue; // frase en prosa, no un secreto
      if (regla.exigeLetraRara && valor && !tieneLetraRara(valor)) continue;
      hallazgos.push({ regla: regla.id, linea: i + 1, valor: valor });
      break; // una linea, un hallazgo: no vale la pena repetir la misma linea
    }
  }
  return hallazgos;
}

/** ¿Es un archivo de texto? (binario = tiene NUL en los primeros 8 KB) */
function esTexto(buf) {
  const corte = Math.min(buf.length, 8192);
  for (let i = 0; i < corte; i++) if (buf[i] === 0) return false;
  return true;
}

/** Lista los archivos versionados. Si git no está, recorre el árbol. */
function archivosVersionados() {
  try {
    const salida = execFileSync('git', ['ls-files', '-z'], {
      cwd: REPO_ROOT,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    });
    return salida.split('\0').filter(Boolean);
  } catch (e) {
    return null; // sin git: no se puede afirmar nada sobre "lo versionado"
  }
}

/**
 * Escanea el árbol versionado.
 * @returns {{disponible: boolean, hallazgos: Array, archivos: number}}
 */
function escanear() {
  const archivos = archivosVersionados();
  if (!archivos) return { disponible: false, hallazgos: [], archivos: 0 };

  const hallazgos = [];
  let leidos = 0;
  for (const rel of archivos) {
    if (AUTOEXCLUIDOS.indexOf(rel) !== -1) continue;
    const abs = path.join(REPO_ROOT, rel);
    let st;
    try { st = fs.statSync(abs); } catch (e) { continue; }
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    let buf;
    try { buf = fs.readFileSync(abs); } catch (e) { continue; }
    if (!esTexto(buf)) continue;
    leidos++;
    const texto = buf.toString('utf8');
    for (const h of detectarEnTexto(texto)) {
      hallazgos.push({ archivo: rel, linea: h.linea, regla: h.regla });
    }
  }
  return { disponible: true, hallazgos, archivos: leidos };
}

module.exports = {
  detectarEnTexto: detectarEnTexto,
  escanear: escanear,
  esPlaceholder: esPlaceholder,
  REGLAS: REGLAS,
  AUTOEXCLUIDOS: AUTOEXCLUIDOS,
  REPO_ROOT: REPO_ROOT,
  APP: APP,
};
