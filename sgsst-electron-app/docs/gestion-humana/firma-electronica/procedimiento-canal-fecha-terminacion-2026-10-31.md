# Procedimiento del canal de `fecha_terminacion`

**Fecha:** 31-oct-2026 · **Estado:** redactado, pendiente de firma y de que el owner lo valide
**Fundamento:** Anexo de Encargo §6 · Anexo de Nube §9 (J9) · Acuerdo v1.4 §8.6(b)

Este documento responde al punto 1.3 del plan de cierre del abogado (31-oct-2026, noche):
«Documentar en una página: quién recibe la novedad, quién la registra, con qué soporte, en qué
plazo y qué pasa si la fecha no llega».

Todo lo que sigue está verificado contra el código del `firma-service` y contra el texto firmado.
Lo que **no** está en el texto firmado aparece marcado como **[decisión operativa pendiente]**.

---

## 1. Qué exige el texto

Anexo de Encargo, sección 6 (literal):

> «Comunicar al Encargado la fecha de terminación de la relación laboral de cada trabajador
> respecto de quien se firmen documentos de las categorías del literal (b) del numeral 8.6 del
> Acuerdo, por el canal que el Encargado habilite en el servicio, con el fin de iniciar el
> cómputo del plazo legal. El Encargado registra la fecha con la evidencia de la comunicación y
> recalcula el plazo de las filas afectadas, dejando registro de la operación. Mientras la fecha
> no se reciba, la fila permanece retenida, no se calcula fecha de supresión y se revisa
> periódicamente.»

Y la regla que el abogado validó como J9 (30-oct-2026), y que el Anexo de Nube repite: **la fecha
de firma NO sustituye la fecha de cese**. Un documento firmado no «cierra» la retención: la
retención desde el cese solo se cómputa cuando la Empresa comunica la fecha real.

## 2. Quién recibe la novedad

La novedad la produce **la Empresa** (el cliente), que es quien tiene la fecha de terminación de
la relación laboral. La recibe **el Encargado** (K+AIR), en el servicio de firma, por el canal que
el propio Anexo habilita: las rutas de administración interna del `firma-service`.

Hoy ese canal **son rutas autenticadas de administración**, no un formulario web, no un correo que
se procesa y no una carga masiva. El canal es de una Empresa a la vez y se audita.

## 3. Quién la registra

**El Encargado la registra**, y la registra el operador que ejecuta la operación autenticada de
administración de esa Empresa. Cada operación queda auditada con:

- **actor** — cabecera `X-Admin-Actor`;
- **motivo** — cabecera `X-Admin-Motivo`, que explica por qué se hace la operación administrativa,
  y un `motivo` opcional en el cuerpo, que explica por qué se comunica esa fecha;
- **bitácora propia** — la tabla `gh_firma_fecha_terminacion_eventos`, que es de **solo agregar**
  (migración 053: disparadores que bloquean `UPDATE` y `DELETE`).

**[Decisión operativa pendiente]** Falta fijar por escrito **quién es ese operador**: el
administrador de K+AIR en nombre de la Empresa, o el sistema de la Empresa llamando al servicio.
Hoy no hay autoservicio, y las credenciales de administración solo existen en el servidor.

## 4. Con qué soporte

El cuerpo de la petición exige cuatro cosas, y tres no son negociables:

| Campo | Obligatorio | Límite | Qué es |
|---|---|---|---|
| `id_trabajador` | sí | 64 | El identificador del trabajador **en el ámbito de la Empresa** (el sistema guarda el seudónimo `psn1_…`, nunca el documento crudo) |
| `fecha_terminacion` | sí | 40 | La fecha real de terminación de la relación laboral; se valida como fecha |
| `evidencia` | sí | 1 000 | **La evidencia de la comunicación**: sin ella no hay registro |
| `canal` | sí | 100 | Por dónde llegó la comunicación, para que la bitácora sea la de una comunicación y no la de una instrucción sin origen |
| `motivo` | no | 500 | Complementa al motivo del encabezado |

**[Decisión operativa pendiente]** Falta fijar qué evidencia se acepta. Lo que el código exige es
un texto; lo que el Anexo exige es «la evidencia de la comunicación». Una guía de aceptación —por
ejemplo, el correo con que la Empresa comunica la fecha, con fecha, remitente, asunto e
identificador de mensaje, o el soporte laboral equivalente— es del owner y **no está en el texto
firmado**.

## 5. En qué plazo

Aquí hay que separar dos cosas que el texto sí y no fija:

- **El plazo de conservación** no lo fija este canal: sale de `config/tabla-conservacion.json`, y
  hoy **no está activado** (con la compuerta cerrada, el sistema no aplica el plazo por defecto y
  deja el registro retenido con el hold `tabla_supletoria_pendiente_validacion`).
- **El plazo para comunicar la fecha** no está en el texto firmado. El Anexo fija la
  **consecuencia** de no comunicarla (sección 6), no un plazo para hacerlo.

**[Decisión operativa pendiente]** Hay que escribir dos cosas antes de usar el canal en
producción: (a) el **plazo máximo de espera** que la Empresa se compromete a cumplir y (b) la
**frecuencia de la revisión periódica** que el Anexo menciona sin concretarla. *Propuesta, no
texto firmado:* revisión mensual de la lista de pendientes, con aviso a la Empresa cuando una fila
lleve más de 30 días esperando.

## 6. Qué pasa si la fecha no llega

Esto sí está determinado, y es lo que el código hace:

1. **La fila permanece retenida.** No se levanta el hold.
2. **No se calcula fecha de supresión.** El registro sigue sin fecha de fin de plazo.
3. **Se revisa periódicamente.** El servicio expone la lista de pendientes para que la Empresa
   la siga.
4. **El servicio no inventa la fecha.** Ni la deduce de la fecha de firma, ni la de la fecha de
   emisión del documento.
5. **El hold del contrato no se levanta.** Es otro motivo, y no es recalculable: levantarlo sería
   levantar una protección que sigue vigente.
6. **El recálculo es acotado.** Cuando la fecha sí llega, solo se recalculan **esas** filas, y solo
   si su motivo de hold es recalculable (`plazo_no_declarado`, `fecha_cese_pendiente`,
   `tabla_supletoria_pendiente_validacion`). Una comunicación no mueve los plazos de nadie más.

## 7. Las tres rutas del canal

| Ruta | Qué hace |
|---|---|
| `POST /internal/admin/empresas/:id_empresa/fecha-terminacion` | Registra la fecha comunicada, la escribe en las filas del trabajador, recalcula el plazo **de esas** filas y deja el registro de la operación |
| `GET /internal/admin/empresas/:id_empresa/fecha-terminacion/pendientes` | La **revisión periódica**: qué filas siguen esperando la fecha y cuáles la tienen con el recálculo pendiente |
| `GET /internal/admin/empresas/:id_empresa/fecha-terminacion` | Las comunicaciones registradas de esa Empresa, con su bitácora |

Las tres exigen la autenticación de administración (`adminApiAuth`). La tabla donde se guarda la
comunicación es `gh_firma_fecha_terminacion` (migración 052); la bitácora, solo agregar, es
`gh_firma_fecha_terminacion_eventos` (migración 053).

## 8. Lo que el canal NO hace

- **No es autoservicio.** No hay formulario para la Empresa: hay rutas de administración.
- **No es masivo.** Una comunicación, un trabajador.
- **No guarda el documento crudo.** Viaja en la petición y no queda en la base.
- **No espía a la Empresa.** El canal es de una Empresa a la vez y se audita con actor y motivo.
- **No libera el hold del contrato**, ni inventa fechas, ni recalcula plazos de otras filas.

## 9. Lo que falta para que este canal pueda sostenerse

1. **Que el owner escriba las dos decisiones de la sección 5** (plazo máximo de espera y
   frecuencia de revisión) y las tres de las secciones 3 y 4 (quién opera, qué evidencia se
   acepta, y si el llamante es la Empresa o K+AIR).
2. **Que el abogado valide este procedimiento** como evidencia del canal de la sección 6 del Anexo
   de Encargo (es el punto 1.3 de su plan, y el que hoy está en el aire).
3. **Que la ruta exista y esté probada en el servidor** con la Empresa piloto: hoy la lógica está
   en código y en pruebas (16 pruebas del canal), pero no hay operación en producción.

Mientras 1 y 2 no estén, la retención desde el cese **no tiene evidencia**, aunque el código
esté listo: T5 y J9 no cierran.
