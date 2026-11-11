/**
 * Aplicacion de parches literales sobre un texto, con la regla de que el
 * ancla tiene que ser UNICA.
 *
 * Por que esta regla (PROMPT 5.11 y 5.16): un parche que no se aplica es un
 * parche que no se nota, y un parche que se aplica en dos sitios es un
 * cambio que nadie reviso. El script falla en los dos casos en vez de
 * seguir.
 *
 * COMO BUSCA
 * ----------
 * Si el ancla es un arreglo de lineas, se busca un bloque contiguo cuyas
 * lineas coincidan CON EL TEXTO SIN LA SANGRIA INICIAL. Si el ancla es una
 * sola linea, primero se busca una linea IGUAL; si no hay ninguna, se busca
 * una linea que la CONTENGA y se reemplaza solo ese fragmento.
 *
 * En los dos caminos se conserva la sangria original de cada linea: el
 * parche no depende de quantos espacios tiene el archivo.
 */

/** Una linea sin su indentacion inicial: sirve para comparar. */
function sinSangria(s) {
  return s.replace(/^[ \t]+/, '');
}

/**
 * Reemplaza el ancla por el texto nuevo y devuelve el texto nuevo.
 * Lanza si el ancla no aparece exactamente una vez.
 */
function aplicarBloque(texto, motivo, ancla, nuevo) {
  const lineas = texto.split('\n');

  if (!Array.isArray(ancla)) {
    const nuevoLineas = Array.isArray(nuevo) ? nuevo : [nuevo];

    let iguales = 0;
    let igualIndice = -1;
    for (let i = 0; i < lineas.length; i++) {
      if (sinSangria(lineas[i]) === sinSangria(ancla)) {
        iguales += 1;
        igualIndice = i;
      }
    }
    if (iguales === 1) {
      const original = lineas[igualIndice];
      const prefijo = (original.match(/^[ \t]*/) || [''])[0];
      lineas.splice(
        igualIndice,
        1,
        ...nuevoLineas.map((linea) => (
          sinSangria(linea) === '' ? linea : prefijo + sinSangria(linea)
        ))
      );
      return lineas.join('\n');
    }

    // Fragmento dentro de una linea: tiene que ser unico en todo el archivo.
    let contenidos = 0;
    let contenidoIndice = -1;
    let contenidoPos = -1;
    for (let i = 0; i < lineas.length; i++) {
      const pos = lineas[i].indexOf(ancla);
      if (pos !== -1) {
        contenidos += 1;
        contenidoIndice = i;
        contenidoPos = pos;
      }
    }
    if (contenidos !== 1) {
      throw new Error(
        'Ancla con ' + (iguales === 0 ? contenidos : iguales) +
        ' coincidencias: ' + motivo
      );
    }
    const linea = lineas[contenidoIndice];
    const antes = linea.slice(0, contenidoPos);
    const despues = linea.slice(contenidoPos + ancla.length);
    lineas.splice(contenidoIndice, 1, antes + nuevo + despues);
    return lineas.join('\n');
  }

  const viejo = ancla;
  const nuevoLineas = Array.isArray(nuevo) ? nuevo : [nuevo];

  let encontrado = -1;
  let coincidencias = 0;
  for (let i = 0; i + viejo.length <= lineas.length; i++) {
    let ok = true;
    for (let j = 0; j < viejo.length; j++) {
      if (sinSangria(lineas[i + j]) !== sinSangria(viejo[j])) {
        ok = false;
        break;
      }
    }
    if (ok) {
      coincidencias += 1;
      encontrado = i;
    }
  }
  if (coincidencias !== 1) {
    throw new Error(
      'Ancla con ' + coincidencias + ' coincidencias: ' + motivo
    );
  }

  const salida = nuevoLineas.map((linea, j) => {
    const original = lineas[encontrado + j] || '';
    const prefijo = (original.match(/^[ \t]*/) || [''])[0];
    return sinSangria(linea) === '' ? linea : prefijo + sinSangria(linea);
  });

  lineas.splice(encontrado, viejo.length, ...salida);
  return lineas.join('\n');
}

/**
 * Dice si el texto ya contiene el bloque de lineas dado, comparando sin la
 * sangria inicial. Se usa para que un parche sea idempotente: si el texto
 * nuevo ya esta, no se vuelve a aplicar.
 */
function contieneBloque(texto, lineas) {
  const viejo = Array.isArray(lineas) ? lineas : [lineas];
  const candidatos = texto.split('\n');
  for (let i = 0; i + viejo.length <= candidatos.length; i++) {
    let ok = true;
    for (let j = 0; j < viejo.length; j++) {
      if (sinSangria(candidatos[i + j]) !== sinSangria(viejo[j])) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

module.exports = { aplicarBloque, sinSangria, contieneBloque };
