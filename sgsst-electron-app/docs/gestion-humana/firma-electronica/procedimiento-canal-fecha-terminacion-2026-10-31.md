# Procedimiento del canal de `fecha_terminacion`

**Fecha:** 31-oct-2026 · **Decisiones del owner:** escritas el 13-nov-2026 · **Estado:** redactado, con las **decisiones 1-5 tomadas el 2026-11-13**; **pendiente de firma del owner** (S-24) **y de la validación del abogado matriculado** (S-23)
**Fundamento:** Anexo de Encargo §6 · Anexo de Nube §9 (J9) · Acuerdo v1.4 §8.6(b)

Este documento responde al punto 1.3 del plan de cierre del abogado (31-oct-2026, noche):
«Documentar en una página: quién recibe la novedad, quién la registra, con qué soporte, en qué
plazo y qué pasa si la fecha no llega».

Todo lo que sigue está verificado contra el código del `firma-service` y contra el texto firmado.
Las **decisiones 1-5** —quién opera, cuál es el origen de la llamada, qué evidencia se acepta, el
plazo máximo de espera y la frecuencia de la revisión periódica— fueron **tomadas el 2026-11-13** por
el owner y están **fuera del texto firmado por diseño**: **no lo modifican**. Cada una dice
**[Decisión del owner, escrita el 13-nov-2026]**, con su *por qué* y su *consecuencia*. Lo que
sigue abierto es **la firma del owner** sobre este procedimiento y **la validación del abogado**
(§9.2).

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

### 3.1 Decisión del owner (13-nov-2026): quién es el operador

**Decisión del owner, escrita el 13-nov-2026.** El operador es **una persona administradora de
K+AIR**, identificada de forma individual en la cabecera `X-Admin-Actor`, que ejecuta la operación
**por cuenta de la Empresa y sobre instrucción y evidencia de ella**. **No** es el sistema de la
Empresa llamando al servicio: hoy no hay autoservicio, las credenciales de administración solo
existen en el servidor, y el Anexo §6 pone el registro en manos del Encargado («El Encargado
registra la fecha…»), no en un tercero autenticado.

*Por qué.* Es la única respuesta compatible con el texto firmado y con el estado real del código:
el texto distingue dos actos —comunica la Empresa, registra el Encargado—, y poner al sistema de
la Empresa como operador necesitaría credenciales de administración que no existen y además
repartiría la responsabilidad del registro fuera del Encargado.

*Consecuencia.* El responsable declarado de cada operación es el operador de K+AIR nombrado en
`X-Admin-Actor`; `X-Admin-Motivo` deja el porqué. **Limitación conocida:** si en el futuro se
habilita autoservicio, el operador pasará a ser una persona de la Empresa y la cabecera seguirá
siendo el lugar donde queda el responsable.

### 3.2 Decisión del owner (13-nov-2026): el origen de la llamada

**Decisión del owner, escrita el 13-nov-2026.** El **origen de la novedad es la Empresa**; la
**ejecución de la petición es de K+AIR**. La fecha de cese la tiene y la produce la Empresa (es su
obligación, Anexo §6); la petición HTTP al servicio la ejecuta hoy un operador de K+AIR al recibir
esa comunicación, y el registro lo hace el Encargado. La declaración que queda escrita es:
«**novedad originada en la Empresa, ejecutada y registrada por K+AIR, con la evidencia de la
Empresa como soporte**». El texto firmado fija la **consecuencia** (la fila queda retenida hasta
que la fecha llegue), no el origen del llamado; este procedimiento sí lo declara.

*Por qué.* Separar origen y ejecución evita las dos trampas opuestas: decir «llama la Empresa» —
falso hoy, no hay canal para eso—; y decir «llama K+AIR», que dejaría la impresión de que la fecha
es una instrucción interna sin fuente, que es exactamente lo que el campo `canal` y la evidencia
existen para evitar.

*Consecuencia.* El campo `canal` documenta **por dónde llegó la comunicación de la Empresa** (correo,
acta, soporte laboral), y la bitácora queda como prueba de que hubo una comunicación **con origen
externo**, no una orden interna.

## 4. Con qué soporte

El cuerpo de la petición exige cuatro cosas, y tres no son negociables:

| Campo | Obligatorio | Límite | Qué es |
|---|---|---|---|
| `id_trabajador` | sí | 64 | El identificador del trabajador **en el ámbito de la Empresa** (el sistema guarda el seudónimo `psn1_…`, nunca el documento crudo) |
| `fecha_terminacion` | sí | 40 | La fecha real de terminación de la relación laboral; se valida como fecha |
| `evidencia` | sí | 1 000 | **La evidencia de la comunicación**: sin ella no hay registro |
| `canal` | sí | 100 | Por dónde llegó la comunicación, para que la bitácora sea la de una comunicación y no la de una instrucción sin origen |
| `motivo` | no | 500 | Complementa al motivo del encabezado |

**Decisión del owner, escrita el 13-nov-2026: la guía de aceptación de la evidencia.** Se acepta
como evidencia un **texto de hasta 1 000 caracteres** que contenga **cuatro datos mínimos**:

| # | Dato | Qué lo identifica |
|---|---|---|
| i | **Quién comunica** | nombre y cargo de la persona de la Empresa |
| ii | **Fecha de la comunicación** | la fecha en que la Empresa la hizo |
| iii | **Soporte identificable** | el `Message-ID` del correo, o el número del documento (acta de retiro, carta, constancia de trabajo, liquidación) |
| iv | **La fecha de cese comunicada** | coherente con el soporte |

**No se acepta:** la fecha sin fuente («según el sistema», «según nos informan»), la fecha de firma
como fecha de cese, ni un texto que no identifique al emisor de la Empresa.

*Por qué.* El Anexo exige «la evidencia de la comunicación» y el código solo exige un texto de
1 000 caracteres: la guía es lo que convierte ese texto en evidencia. El límite implica que la
evidencia es **un resumen con identificadores**, no el correo entero: `Message-ID` + remitente +
fecha + fecha de cese entran holgados.

*Consecuencia.* La guía va como **Anexo A** de este procedimiento, con un ejemplo. **No requiere
cambio de código**: `evidencia` y `canal` ya son campos obligatorios. Si la evidencia no cumple los
cuatro datos, el operador **no registra** la comunicación y la fila sigue retenida, que es el estado
que el texto ya determina.

## 5. En qué plazo

Aquí hay que separar dos cosas que el texto sí y no fija:

- **El plazo de conservación** no lo fija este canal: sale de `config/tabla-conservacion.json`, y
  hoy **no está activado** (con la compuerta cerrada, el sistema no aplica el plazo por defecto y
  deja el registro retenido con el hold `tabla_supletoria_pendiente_validacion`).
- **El plazo para comunicar la fecha** no está en el texto firmado. El Anexo fija la
  **consecuencia** de no comunicarla (sección 6), no un plazo para hacerlo.

**Decisión del owner, escrita el 13-nov-2026 (a): el plazo máximo de espera.** **Treinta (30) días
calendario, contados desde la fecha de cese de la relación laboral**, para que la Empresa comunique
esa fecha al Encargado. Para filas retenidas anteriores a la adopción de este procedimiento: **30
días calendario desde el primer aviso** de la lista de pendientes.

Este plazo **no es el de conservación**: ese sale de `config/tabla-conservacion.json` y sigue inactivo
hasta la validación de S-02. Es un **plazo de oportunidad de la comunicación**. Su incumplimiento
**no acorta ni pierde** el plazo legal de 20 años (Decreto 1072 de 2015, art. 2.2.4.6.13): solo
mantiene la fila retenida, que es la consecuencia que el Anexo §6 ya fija.

*Consecuencia.* Es un compromiso operativo de la Empresa, registrado **con fecha y responsable en
este procedimiento** (no en el Anexo: el texto suscrito no se toca). Queda explícito que
incumplirlo **no tiene sanción propia**: el sistema simplemente no calcula fecha de supresión.

**Decisión del owner, escrita el 13-nov-2026 (b): la frecuencia de la revisión periódica.**
**Revisión mensual** de `GET /internal/admin/empresas/:id_empresa/fecha-terminacion/pendientes`,
**el primer día hábil de cada mes**, realizada y documentada por **K+AIR** (quién revisó, la fecha y
el número de filas pendientes). **Aviso a la Empresa** cuando una fila lleve **más de 30 días**
esperando la fecha. **Reporte al representante legal** de las filas con **más de 90 días**
pendientes, en el informe mensual.

La revisión es **de K+AIR** (el Encargado), que es quien tiene la lista; la **respuesta a cada aviso
es de la Empresa**.

*Por qué.* El Anexo dice «se revisa periódicamente» sin concretarlo. Mensual es la frecuencia
mínima que hace efectivo «periódicamente» sin convertirlo en carga operativa, y encaja con el plazo
de 30 días de (a): cada revisión encuentra los retrasos del mes anterior. El umbral de 90 días
(tres avisos fallidos) es el punto en que la retención deja de ser un retraso administrativo y pasa
a ser un tema para el representante legal.

*Consecuencia.* La ruta `GET …/pendientes` existe y está probada, pero **no hay calendario
automático**: la revisión queda como **acto documentado** del procedimiento, con su registro. Si más
adelante se automatiza con una tarea programada, el registro de la revisión pasa a ser automático y
**el procedimiento no cambia: solo cambia quién lo ejecuta**.

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

1. ~~**Que el owner escriba las dos decisiones de la sección 5** (plazo máximo de espera y
   frecuencia de revisión) y las tres de las secciones 3 y 4 (quién opera, qué evidencia se
   acepta, y si el llamante es la Empresa o K+AIR)~~ → **HECHO el 13-nov-2026**. Las cinco están
   escritas en su sección (§3.1 y §3.2, §4, §5a y §5b), con su *por qué* y su *consecuencia*, y la
   guía de aceptación de la evidencia va como **Anexo A**. La solicitud **S-22** de
   `tabla-de-solicitudes-2026-11-13.md` quedó **CERRADA** ese día. Lo que de este punto queda no es
   una decisión sino un **acto**: la **firma del owner** sobre este procedimiento, que el
   13-nov-2026 quedó registrada como la **S-24** de esa misma tabla.
2. **Que el abogado valide este procedimiento** como evidencia del canal de la sección 6 del Anexo
   de Encargo (es el punto 1.3 de su plan, y el que hoy está en el aire). **Sigue pendiente**, y es
   de otro dueño: el owner no puede sustituirlo.
3. **Que la ruta exista y esté probada en el servidor** con la Empresa piloto: hoy la lógica está
   en código y en pruebas (16 pruebas del canal) y **la ruta sí está desplegada** —medido por SSH el
   13-nov-2026, solo lectura: 11 coincidencias de `fecha-terminacion` en
   `/opt/kair-firma/app/src/routes/admin-empresas.js`—, pero **no hay ninguna operación en
   producción**: 0 comunicaciones en `gh_firma_fecha_terminacion`, 0 eventos en
   `gh_firma_fecha_terminacion_eventos` y 0 filas con el hold `fecha_cese_pendiente`.

Mientras el punto 2 no esté, la retención desde el cese **no tiene la validación del abogado**,
aunque el código esté listo y el procedimiento ya tenga las cinco decisiones: T5 y J9 no cierran.

---

## Anexo A. Guía de aceptación de la evidencia (decisión del owner, 13-nov-2026)

Esta guía es la **decisión operativa** que acompaña a la del §4. No está en el texto firmado: es
papel interno del servicio, y **no modifica** el Anexo de Encargo ni el Acuerdo.

**Los cuatro datos mínimos.** La evidencia es un texto de hasta 1 000 caracteres que tiene:

1. **Quién comunica** — nombre y cargo de la persona de la Empresa.
2. **Fecha de la comunicación** — la fecha en que la Empresa la hizo.
3. **Soporte identificable** — el `Message-ID` del correo, o el número del documento (acta de
   retiro, carta, constancia de trabajo, liquidación).
4. **La fecha de cese comunicada** — coherente con el soporte.

**Lo que no se acepta.** La fecha sin fuente («según el sistema», «según nos informan»), la fecha de
firma como fecha de cese, y cualquier texto que no identifique al emisor de la Empresa.

**Ejemplo (que sí se acepta).**

```
De: Claudia Pérez, Talento Humano, Tempoactiva — Comunicación 2026-11-14 —
Message-ID <CA+7x…@mail.gmail.com> — Cese de Luis Rojas (psn1_…) el 2026-11-10 —
Acta de retiro 2026-11-10.
```

**Ejemplo (que no se acepta).**

```
Según nos informan, el trabajador se fue el 15 de octubre.
```

No dice quién comunica, no dice la fecha de la comunicación, no tiene soporte identificable y la
fecha no viene de ninguna fuente. **El operador no registra la comunicación** y la fila sigue
retenida.

**Cómo se usa.** El operador de K+AIR compara la evidencia con esta guía **antes** de registrar la
comunicación. `canal` va con el valor de por dónde llegó (correo, acta, soporte laboral), y la
bitácora `gh_firma_fecha_terminacion_eventos` deja quién lo hizo, con qué motivo y con qué
evidencia.
