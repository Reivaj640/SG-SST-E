# Solicitud al abogado matriculado — validación del procedimiento del canal de `fecha_terminacion` — 13 de noviembre de 2026

**Asunto:** firma electrónica K+AIR — un escrito: validar el procedimiento del canal de comunicación de la fecha de terminación
**Expediente:** firma electrónica K+AIR — Gesstiar S.A.S.
**Fecha:** 13 de noviembre de 2026
**De:** Javier Robles Fontalvo, Representante Legal — Gesstiar S.A.S.

---

Estimado asesor:

Este es **un solo escrito**, separado del de las cuatro solicitudes del 13-nov-2026 (S-01 a S-04). No lo
mezclamos con esos porque es de otra naturaleza: aquellos le piden **determinaciones**; este le pide una
**validación** sobre un documento que ya existe y que le mandamos para que lo lea.

## Qué le pedimos

El **punto 1.3 de su propio plan de cierre del 31-oct-2026**:

> «Documentar en una página: quién recibe la novedad, quién la registra, con qué soporte, en qué plazo y qué
> pasa si la fecha no llega».

Ese procedimiento se redactó el 31-oct-2026 (`procedimiento-canal-fecha-terminacion-2026-10-31.md`). Desde
entonces pasó lo que no depende de usted: **el owner escribió las cinco decisiones operativas que el
propio procedimiento pedía** (quién opera, cuál es el origen de la llamada, qué evidencia se acepta, el
plazo máximo de espera y la frecuencia de la revisión periódica), el 13-nov-2026, con su fecha y su
responsable.

Lo que falta es **lo único que depende de usted**: que valide ese procedimiento **como evidencia del canal
del §6 del Anexo de Encargo**. Es decir: si el procedimiento, tal como quedó escrito, sirve para demostrar
que el Encargado registra la fecha de terminación de la relación laboral **con la evidencia de la
comunicación** y **recalcula el plazo de las filas afectadas**, dejando registro de la operación.

## Por qué le importa, y por qué importa al expediente

El §6 del Anexo de Encargo (texto literal, ya suscrito) dice:

> «Comunicar al Encargado la fecha de terminación de la relación laboral de cada trabajador respecto de
> quien se firmen documentos de las categorías del literal (b) del numeral 8.6 del Acuerdo, por el canal
> que el Encargado habilite en el servicio, con el fin de iniciar el cómputo del plazo legal. El Encargado
> registra la fecha con la evidencia de la comunicación y recalcula el plazo de las filas afectadas,
> dejando registro de la operación. Mientras la fecha no se reciba, la fila permanece retenida, no se
> calcula fecha de supresión y se revisa periódicamente.»

Y la regla que usted validó como **J9** (30-oct-2026), que el Anexo de Nube repite: **la fecha de firma NO
sustituye la fecha de cese**.

El **código existe y está probado**: `src/services/fechaTerminacion.js`, las migraciones 052 y 053 (la
bitácora de solo agregar, con disparadores que bloquean `UPDATE` y `DELETE`), las tres rutas de administración
interna y `tests/fecha-terminacion-canal.test.js` (16 pruebas en verde). La ruta **ya está desplegada** en
producción, medida por SSH el 13-nov-2026, solo lectura.

Pero el canal **nunca se ha usado**: **0 comunicaciones**, **0 eventos** y **0 filas** con el hold
`fecha_cese_pendiente`. Es decir: la lógica está desplegada y probada, y no hay ninguna operación en
producción. El papel es lo que falta, y de eso nos servimos de su criterio.

## Qué recibe

| Documento | Ruta | Bytes | SHA-256 |
|---|---|---|---|
| El procedimiento que debe validar | `docs/gestion-humana/firma-electronica/procedimiento-canal-fecha-terminacion-2026-10-31.md` | 16 872 | `5a817b38b504aa1f14cb63e41ff87607d8873587a45235704d318e529131e04e` |

El procedimiento trae, en su §1, el **literal del §6 del Anexo de Encargo** y la regla J9; en sus §3 a §5,
las cinco decisiones del owner con su *por qué* y su *consecuencia*; en su §6, lo que el código hace
cuando la fecha no llega; en su §9, lo que falta; y en su **Anexo A**, la guía de aceptación de la
evidencia con un ejemplo que se acepta y uno que no.

Su estado es, en su encabezado, «**Decisiones 1-5 tomadas el 2026-11-13; pendiente de firma del owner y
de la validación del abogado**». Se lo mandamos con las cinco decisiones ya escritas: lo que falta de
nuestra parte es **nuestra firma**, y lo que falta de la suya es **su validación**.

## Qué necesitamos de vuelta

Un escrito con:

1. Su **nombre** y la **fecha**.
2. El **SHA-256** del documento que firma, si lo firma en archivo.
3. Su pronunciamiento sobre el **§9.2 del procedimiento** (el punto 1.3 de su plan): si valida el
   procedimiento como evidencia del canal, **dígalo**; si lo corrige, **dígalo con la redacción exacta**,
   porque el texto se aplica por su literal, sin reescritura.

Si necesita ver el código, la ruta o el Anexo de Encargo entero, dígamelo y se lo mando en el acto.

## Qué desbloquea

El bloque **M.31** del mapa de apertura a empresas reales, y con él los dos puntos que dependen de su
dictamen: la evidencia del canal del §6 del Anexo de Encargo (**T5**) y la regla de que la fecha de firma
no sustituye la fecha de cese (**J9**). El código ya está; lo que falta es su validación.

## Vencimiento

**27 de noviembre de 2026 (2026-11-27)**. Si esa fecha no es alcanzable, díganos cuál sí y la movemos. Lo que no podemos
hacer es dejar el canal sin validar sin que haya una fecha.

Atentamente,

**Javier Robles Fontalvo**
Representante Legal — Gesstiar S.A.S.
