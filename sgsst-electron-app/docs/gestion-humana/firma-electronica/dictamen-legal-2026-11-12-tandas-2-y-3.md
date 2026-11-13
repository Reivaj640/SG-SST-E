# Dictamen del agente legal — tanda 2 y tanda 3 (12-nov-2026)

> **Qué es este documento.** Es la entrega del agente legal del repositorio (skill
> `asesoria-legal-sg-sst`, **solo consulta**: no editó archivos ni ejecutó comandos sobre el repo) sobre
> los cuatro puntos de la mesa que no se vio en el turno anterior: **L2** (Circular Externa 002 de 2025 y
> RNBD), **L3** (tabla supletoria de conservación), **L6** (la v1.1 del Anexo de Nube) y **L7** (la
> variable inerte `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`).
>
> **Método.** Cada norma se verificó en **fuente oficial** el **12-nov-2026**. Lo que no se pudo
> verificar se marca con **⚠️ No verificado** y se dice **cómo confirmarlo**. No se inventa nada.
>
> **Status.** Asesoría jurídica informativa. **No sustituye la validación de un abogado matriculado**:
> la firma, la ratificación y la responsabilidad son del owner (Gesstiar S.A.S.).
>
> **Importante para el expediente:** este dictamen **corrige seis afirmaciones** que el propio
> expediente escribía. Esas correcciones están en §0 y ya se aplicaron a los documentos vivos.

---

## 0. Seis correcciones al encargo, verificadas antes de redactar

| # | Lo que se decía | Lo que se verificó | Evidencia |
|---|---|---|---|
| 0.1 | «la Circular 002/2025 **no aplica** a K+AIR» | **Es demasiado amplia.** No aplica al **canal de correo** (allí hay transmisión a un Encargado, no transferencia a un Responsable), pero **sí alcanza la distribución del software**: la Circular define «transferencia de tecnología» como la que un proveedor hace a un receptor «a cambio de una contraprestación», y su segundo supuesto es «cuando la tecnología objeto de transferencia permite o tiene por objeto el tratamiento de datos personales». K+AIR licencia software que trata datos personales. | Circular 002/2025 (PDF oficial de la SIC); Concepto SIC 25-625951 (ene-2026): «si se realiza exclusivamente la transmisión de datos… no resulta aplicable la precitada circular» |
| 0.2 | «la tabla [tiene] **cinco** categorías» | La tabla tiene **ocho** categorías y cinco plazos distintos. La validación debe cubrir las ocho. | `config/tabla-conservacion.json`; el mismo error estaba en el mapa de la meta y en el documento de decisiones de fondo (corregidos el 12-nov-2026) |
| 0.3 | «el compromiso contractual de **20 años** del §8.6» | El §8.6 **no** contiene un compromiso contractual de 20 años: el 20 años del §8.6(b) es el **piso legal** del art. 2.2.4.6.13 del Decreto 1072, contado **desde el cese**, y el §8.6(h) dice «No hay retención indefinida… Cada plazo es un tope de custodia y no autoriza a conservar más allá de la finalidad» | `scripts/fixtures/acuerdo-v1.6.txt` (§8.6) |
| 0.4 | «el catálogo legado de 20 años **ya fue retirado del código** (`retencion.js:195`)» | `retencion.js:195` es el **comentario** que documenta la retirada. La regla `CUSTODIA_20_ANOS` y `ANIOS_CUSTODIA = 20` **siguen en el código**; lo que se retiró fue su **aplicación automática como plazo por defecto**. El fondo de J8/J9 se sostiene; la frase literal no. | `retencion.js:153`, `:195-206`, `:221-229`, `:1008-1026` |
| 0.5 | «bajo la v1.1 **no se trató dato alguno**» | **No es sostenible.** La base de producción registra `SIGN-2026-738564` (06-nov, **SIGNED**) y `SIGN-2026-016820` (06-nov, CANCELLED). La v1.1 se suscribió el 05-nov 22:51Z y la v1.3 no se publicó hasta el 11-nov: hubo al menos una firma electrónica completa en la ventana en que la v1.1 era la única versión suscribida. Lo que corresponde es **declarar** ese tratamiento, no **negarlo**. | `meta-para-abrir-a-empresas-reales-2026-11-12.md` (las firmas); `tabla-instrumentos-vigentes-2026-11-09.md` |
| 0.6 | «la **ficha publicada** presenta como control lo que no lo es» | La ficha publicada **ya** declara el control incondicional y cita el código. El defecto real está en **tres lugares del repo** que sí lo presentan como interruptor (§3 de L7). | `sitio/anexo-nube-v1.3.html`; los tres archivos están nombrados en L7 |

---

## 1. L2 — Circular Externa 002 de 2025 y RNBD

### 1.1 Respuesta corta

**No aplica al canal de correo** (allí hay transmisión a un Encargado) y **sí aplica, por su segundo
supuesto, a la transferencia del software a la Empresa**. **La inscripción en el RNBD es obligación de
la Empresa (Responsable), no de K+AIR (Encargado)**, y se determina por los activos de cada Empresa, no
por los de Gesstiar S.A.S. Si la Empresa no está obligada a registrarse, no se le puede exigir la
inscripción, pero **sí subsisten todas las demás obligaciones del Responsable** — entre ellas el
**contrato de transmisión** con el Encargado en el exterior (art. 25 del Decreto 1377), que es lo que
hoy está en riesgo real.

**Lo que el equipo debe cambiar en el expediente:** no sostener «la Circular no aplica a K+AIR», sino
**«aplica por su segundo supuesto a la transferencia de la tecnología, y por eso sus cuatro instrucciones
se adoptan como estándar de cumplimiento y quedan documentadas»**. El costo de esa postura es casi nulo,
porque las cuatro instrucciones ya están incorporadas: (i) verificación preliminar → matriz de
finalidades y §2 del Anexo de Encargo; (ii) responsabilidad demostrada → expediente, compuerta legal y
bitácora append-only; (iii) datos por diseño y por defecto → §3 a §5 del Anexo de Nube y la minimización
del canal (cuatro datos); (iv) garantías contractuales → Anexo de Encargo §§3, 4 y 7.5. El costo de la
afirmación categórica, en cambio, es una **afirmación inexacta en el expediente** (art. 4(d) de la Ley
1581).

### 1.2 La base normativa (12-nov-2026)

| Norma | Artículo / numeral | Qué dice | Fuente oficial |
|---|---|---|---|
| SIC, Circular Externa 002 de 2025 | Asunto y cuerpo | «Instrucciones aplicables a los procesos de transferencia de tecnología en los que se transfieran datos personales o en los que se transfieran tecnologías que permitan o tengan por objeto el tratamiento de datos personales». Definición propia de «transferencia de tecnología» (compartir, intercambiar o transferir conocimientos, resultados de investigación, creaciones o tecnologías de un proveedor a un receptor que adquiere la tecnología a cambio de una contraprestación) y sus dos escenarios. Cuatro instrucciones: verificación preliminar del cumplimiento normativo; responsabilidad demostrada; protección de datos por diseño y por defecto; incorporación de garantías contractuales | sede electrónica de la SIC (PDF oficial), del 7-oct-2025, DO 53.268 del 9-oct-2025 |
| SIC, Concepto 25-625951 (Of. Asesora Jurídica) | Alcance | «si las operaciones contemplan la **transferencia** de datos —envío de la información o los datos personales a un receptor, que a su vez es Responsable del Tratamiento—, esta se encuentra plenamente sujeta a la Circular 002 de 2025. Sin embargo, si se realiza exclusivamente la **transmisión** de datos —comunicación de los mismos que tiene por objeto la realización de un Tratamiento por el Encargado por cuenta del Responsable—, no resulta aplicable» | sede electrónica de la SIC (ene-2026) |
| SIC, Concepto 25-632634 | Alcance | Aplicación territorial frente a responsables y encargados en el extranjero; distinción transferencia/transmisión internacional; contrato de transmisión; declaración de conformidad | sede electrónica de la SIC (feb-2026) |
| Decreto 1074 de 2015 (compilado), art. 2.2.2.26.1.2, modificado por el Decreto 090 de 2018 | Ámbito del RNBD | «Serán objeto de inscripción… las bases de datos… cuyo Tratamiento… sea realizado por los **Responsables**… que reúnan… a) Sociedades y entidades sin ánimo de lucro que tengan activos totales superiores a **100.000 UVT**. b) Personas jurídicas de naturaleza pública» | sede electrónica de la SIC (Decreto 090 de 2018) |
| Decreto 1074 de 2015, art. 2.2.2.26.3.1 | Sujeto obligado | «son los Responsables del Tratamiento quienes tienen la obligación de efectuar el registro» | SIC, Resolución 82358 de 2024 |
| SIC, Concepto 22-300986 (12-sep-2022) | Umbral y fecha | Obligados: sociedades y entidades sin ánimo de lucro con activos totales > 100.000 UVT, «la medición de los activos totales será el que registren a **31 de diciembre del año inmediatamente anterior**», y personas jurídicas de naturaleza pública. «No están obligados a registrar bases de datos ni los establecimientos de comercio, ni las sucursales de las compañías» | sede electrónica de la SIC |
| DIAN, Resolución 000238 de 2025 | Art. 1.2.1 | «Fijar en cincuenta y dos mil trescientos setenta y cuatro pesos ($52.374) el valor de la Unidad de Valor Tributario -UVT que regirá durante el año 2026» | gestor normativo (DO 53.338 del 17-dic-2025) |
| Ley 1581 de 2012 | Art. 4(d) y (e) | Veracidad (se prohíbe el tratamiento de datos «parciales, incompletos, fraccionados o que induzcan a error») y transparencia | compilado oficial (JEP) |
| Decreto 1377 de 2013 | Arts. 13, 14, 15, 18, 19, 23 | Políticas de tratamiento; aviso de privacidad y su contenido mínimo; procedimientos de acceso, actualización, supresión, rectificación y revocatoria; medidas de seguridad; persona o área responsable de la atención de peticiones, consultas y reclamos | compilado oficial (JEP) |
| SIC, Circular Única, Título V | Numeral de transmisión internacional | «La información relacionada con la Transmisión internacional de datos personales comprende la identificación del destinatario como **Encargado**, el país en que éste se encuentra ubicado, si se tiene un **contrato de transmisión**… o si la operación está cobijada por una declaración de conformidad» | sede electrónica de la SIC (Resolución 56579 del 12-ago-2025) |

### 1.3 Lo que hay que corregir en el expediente

- **Los 19,09 UVT son de Gesstiar S.A.S.** ($1.000.000 COP ÷ $52.374), no de las Empresas. La cifra es
  una **declaración del owner** y no sustituye el certificado de existencia y representación ni los
  estados financieros.
- **El §5 del Anexo de Encargo** redacta el ítem (iii) como si la inscripción de la Empresa fuera un
  hecho pendiente («previa confirmación de que está inscrita»): **esa redacción presupone una obligación
  que la Empresa puede no tener** y debe corregirse en la v1.4.
- **El RNBD se alimenta de las políticas de tratamiento** (art. 25 de la Ley 1581): el texto de la v1.4
  es insumo directo de ese registro.

### 1.4 ⚠️ No verificado y qué confirmar

- El texto íntegro del PDF oficial de la Circular 002/2025 (el entorno no devuelve PDF como texto): las
  citas vienen del texto indexado del PDF oficial y del Concepto 25-625951. **Cómo confirmarlo**: abrir
  el PDF en la sede electrónica y cotejar el aparte de «transferencia de tecnología» y los dos escenarios.
- Si el Acuerdo y el Anexo de Encargo con la Empresa son, en el sentido del Registro de Comercio,
  «contratos de transferencia de tecnología» sujetos a inscripción. La Circular actualiza, según notas de
  firmas privadas, los procedimientos de inscripción, modificación y cancelación de esos contratos; no se
  pudo leer esa parte. **Es un punto que puede generar una obligación nueva para K+AIR** y no debe
  cerrarse por omisión. **Cómo confirmarlo**: la Circular 002/2025 y el Decreto 1074 de 2015 (RST).
- Los activos totales de cada Empresa (hoy no hay ninguna Empresa real suscrita).

---

## 2. L3 — Tabla supletoria de conservación

### 2.1 Respuesta corta

**Se validan los plazos**, con cuatro condiciones expresas: (i) la tabla tiene **ocho** categorías, no
cinco, y la validación debe cubrirlas todas; (ii) el plazo del **registro de operaciones** debe seguir al
del documento asociado cuando ese documento tenga piso legal o hold sin término (regla **C1**); (iii) el
cómputo debe ser en **años calendario** o el texto debe corregirse (regla **C2**); (iv) el **piso legal
no puede ser bajado** por la tabla de la Empresa (regla **C3**), y la fecha de cese la informa y valida
la Empresa por escrito (regla **C4**).

**El §8.6 no contiene un «compromiso contractual de 20 años»**: los 20 años son el **piso legal** desde
el cese. La compatibilidad con los plazos de 10 y 5 años es **total**, porque el código toma siempre la
fecha más lejana (`_fechaMasLejana`): la tabla de la Empresa no puede bajar el piso. El mecanismo de
`hold` y el cómputo desde el cese **están bien declarados**.

**El hallazgo operativo más importante:** **`validado_por` y `validado_at` no los leía ningún código**.
La compuerta solo miraba `aplicacion.activada`, así que abrirla era un acto de disciplina humana, no
un acto que la máquina pudiera auditar. **El equipo lo corrigió el 12-nov-2026** (bloque **M.30** del
mapa): `_tablaActivada()` ahora exige `validado_por` **y** `validado_at`, con tres pruebas que fijan
las tres formas (sin validación, a medias, completa).

### 2.2 La base normativa (12-nov-2026)

| Norma | Artículo | Qué dice | Fuente oficial |
|---|---|---|---|
| Decreto 1377 de 2013 | Art. 11 | «Los Responsables y Encargados… solo podrán recolectar, almacenar, usar o circular los datos personales durante el tiempo que sea **razonable y necesario**… Una vez cumplida la o las finalidades… deberán proceder a la **supresión**… **No obstante lo anterior, los datos personales deberán ser conservados cuando así se requiera para el cumplimiento de una obligación legal o contractual**… deberán **documentar los procedimientos** para el Tratamiento, conservación y supresión» | compilado oficial (JEP) |
| Decreto 1072 de 2015 | Art. 2.2.4.6.13 | «Los siguientes documentos y registros, deben ser conservados por un periodo mínimo de **veinte (20) años, contados a partir del momento en que cese la relación laboral** del trabajador con la empresa»: (1) perfiles epidemiológicos y conceptos de exámenes de ingreso, periódicos y de retiro; (2) resultados de exámenes y pruebas complementarias; (3) resultados de mediciones y monitoreo de ambientes de trabajo; (4) registros de capacitación, formación y entrenamiento; (5) registro del suministro de EPP | gestor normativo |
| Acuerdo v1.6 (vigente) | §8.6(a), (b), (c), (d), (e), (h) | (a) orden de prevalencia: reglas legales especiales → tabla de la Empresa → tabla supletoria; «cada regla que la integra ha de tener un fundamento… y un punto de inicio desde el que corre… **Ningún plazo puede ser indefinido**, y ninguno autoriza a conservar más allá de la finalidad». (b) los cinco registros del SG-SST por 20 años desde el cese. (c) contrato con hold mientras subsista la relación. (d) hold por deber legal o contractual. (e) la supresión procede solo con las cuatro condiciones. (h) «**No hay retención indefinida**… La fecha de la firma no inicia por sí sola ningún cómputo» | `scripts/fixtures/acuerdo-v1.6.txt` (texto del Acuerdo, no fuente normativa) |

### 2.3 Lo que se verificó en el código y en la tabla

- **Cada categoría declara su fundamento y su punto de inicio**, y el sistema **congela** en cada fila el
  plazo aplicado, su fuente y la fecha desde la que corre (modificar la tabla no altera lo ya calculado).
  Eso es exactamente lo que pide el art. 11 en su párrafo final y lo que exigen el §8.6(a) y (h).
- **10 años** (documento firmado y su constancia): razonable como **tope** para el «resto» documental,
  sujeto a la precedencia de la tabla de la Empresa. **5 años** (registro de operaciones, solicitudes,
  lápida y recibo): plazo de trazabilidad y atención de derechos, **con la incoherencia que hay que
  resolver**: el registro de operaciones es el medio de prueba de la autenticidad del documento
  conservado; si el documento se conserva 20 años y su registro se purga a los 5, el registro
  conservado queda sin el asiento que acredita quién lo firmó. De ahí la **regla C1**.
- **Corrección aritmética real:** los plazos se calculan en **días** (`plazo_dias`: 3650 y 1825) y el
  texto dice «diez (10) años» y «cinco (5) años». 3650 días son **2 o 3 días menos** que diez años
  calendario, y 1825 días son **1 día menos** que cinco años calendario si el período incluye un 29 de
  febrero. El propio sistema lo muestra: el texto al Trabajador dice «10 años (3650 días)». El piso
  legal, en cambio, sí se calcula en años calendario. **No hay que dejar dos verdades en el mismo
  mensaje** (regla **C2**).
- **El `hold` y el cómputo desde el cese**: lo que la tabla declara coincide con lo que el código hace
  (`SST_ESPECIAL` corre desde `fecha_cese`, y si el cese no está disponible **no se sustituye por la
  fecha de firma**; `CONTRATO_SIN_TERMINO` tiene hold siempre; con la tabla cerrada el registro queda
  retenido sin fecha de supresión, salvo el piso del SG-SST y el hold del contrato).
- **Lo que la tabla debe declarar además:** que el piso es un **piso** y no un plazo por defecto; que
  mientras el cese esté pendiente no se calcula fecha de supresión; que los plazos de 10 y 5 años son
  **topes de custodia**; la regla de vínculo del registro de operaciones (C1); que el plazo de la
  Empresa prevalece (C3); y el criterio de cómputo (C2).

### 2.4 Los parámetros concretos que deben quedar en `validado_por` y `validado_at`

El archivo es ASCII; sin tildes:

```json
"aplicacion": {
  "activada": false,
  "estado": "VALIDADA",
  "validado_por": "Abogado externo <NOMBRE COMPLETO>, <CC o tarjeta profesional>, opinion escrita de <dd-mm-aaaa> (determinacion L3), recibida por Javier Robles Fontalvo, representante legal de Gesstiar S.A.S.; alcance: las ocho categorias de la version 1.0 de esta tabla, con los plazos de diez (10) y cinco (5) anos y el piso legal de veinte (20) anos desde el cese, y con las condiciones C1 a C4 incorporadas",
  "validado_at": "2026-11-12T19:20:00-05:00"
}
```

Y cuatro campos adicionales recomendados (el generador del Anexo de Encargo §8 lee esta fuente: hay que
verificar que los tolere):

```json
"validado_por_documento": "<ruta del escrito de validacion> sha256 <huella>",
"alcance_validado": ["DOCUMENTO_FIRMADO: 3650 dias desde fecha_firma"],
"condiciones": ["C1 el registro de operaciones sigue el plazo del documento asociado cuando este tenga piso legal o hold sin termino", "C2 el computo es en anos calendario", "C3 el piso legal no puede ser bajado por la tabla de la Empresa", "C4 la fecha de cese la informa y valida la Empresa por escrito"],
"activado_at": null
```

### 2.5 La secuencia exacta para abrir la compuerta

1. **VALIDAR** — la determinación del abogado queda en el expediente, con fecha y firma.
2. **ALINEAR** — (a) incorporar a la tabla las condiciones C1 a C4 y el texto de cada categoría
   corregido; (b) llenar `validado_por`, `validado_at`, `estado` y `condiciones`, **dejando `activada`
   en `false`**; (c) regenerar el Anexo de Encargo §8 con su generador (el bloque se genera desde esta
   fuente; no se edita a mano) y republicar el texto con su huella nueva; (d) nota de versión de la
   tabla, porque toda versión publicada es inmutable.
3. **REEJECUTAR PRUEBAS** — no es opcional, porque abrir la compuerta **cambia el comportamiento del
   servicio**. Dos advertencias: existe un test que **afirma que la tabla despachada viene cerrada**
   (`tests/services/conservacion-supletoria.test.js`), así que si el `activada: true` va en el mismo
   archivo que se despacha, ese test hay que actualizarlo **en el mismo commit**; y la suite ya cubre
   los dos estados, lo que hay que reejecutar es la suite completa.
4. **ABRIR** — cambiar `activada` a `true` en un **acto separado y posterior**, con su acta (quién,
   cuándo, con qué huella del archivo validado), y desplegar. Abrir en el mismo commit del paso 2 borra
   la evidencia del orden.

**Qué debe hacer el owner cuando el abogado responda.** Si la validación es **incondicional**:
ejecutar 2, 3 y 4 en ese orden, sin saltar el 3. Si es **condicional** (como esta, con C1 a C4):
incorporar las condiciones y **no abrir** hasta que estén incorporadas; si alguna no se puede
incorporar, la compuerta **no se abre** y la tabla sigue en `PROPUESTA`. Si el abogado **no valida**:
la compuerta queda cerrada y el sistema sigue en el estado actual —que es **defensivo y conforme al
art. 11**: hay un deber de conservación vigente, no una retención indefinida por plazo no declarado.

### 2.6 ⚠️ No verificado y qué confirmar

- Si el generador del Anexo de Encargo §8 tolera los campos nuevos (`validado_por_documento`,
  `condiciones`, `activado_at`) y si el manifiesto debe declarar la nueva versión de la tabla.
- **A confirmar con abogado externo:** la **regla C1** (si la rechaza, la alternativa mínima es que la
  categoría del registro de operaciones declare que su plazo nunca puede ser inferior al del documento
  asociado) y el **criterio de cómputo** (años calendario vs. días, y el redondeo del texto al
  Trabajador).

---

## 3. L6 — La v1.1 del Anexo de Nube (suscripción id 1, sin contrafirma)

### 3.1 Hechos verificados

| Hecho | Evidencia |
|---|---|
| La v1.1 (huella `e9517536…591482`, 62.198 B, 5-nov-2026) fue **suscrita** por ASEPLUS CARIBE S.A.S. el **2026-11-05T22:51:34.349Z**, IP 181.63.26.145 | `tabla-instrumentos-vigentes-2026-11-09.md` |
| La ficha de esa Empresa tiene `anexo_nube_ejecutado_at = NULL`: **no hay contrafirma** | `Historial.md`; el mapa de la meta |
| El texto de la v1.1 exige **las dos** firmas («Firmas: Responsable y Encargado…» y «toda modificación de este Anexo se publica como versión nueva… **se suscribe nuevamente por ambas partes**») | `sitio/anexo-nube-v1.1.html` |
| El código trata el Anexo de Nube como **bilateral** y el manifiesto como el único que separa los dos actos; el script **nunca degrada** un `contrafirmado: true` | `scripts/actualizar-manifiesto-anexo-nube.js` |
| El texto vigente es la **v1.3**, suscrita el 2026-11-12T15:38:27.990Z y contrafirmada el 16:13:54.106Z, con sus dos actas | `tabla-instrumentos-vigentes-2026-11-09.md`; `Historial.md` |
| **En la ventana 05-nov → 11-nov hubo al menos una firma electrónica completa**: `SIGN-2026-738564` (06-nov, SIGNED) y `SIGN-2026-016820` (06-nov, CANCELLED) | el mapa de la meta |

### 3.2 Línea de opinión

> **La suscripción de la versión 1.1 del Anexo de Nube (suscripción id 1, suscrita por ASEPLUS CARIBE
> S.A.S. el 5 de noviembre de 2026, huella `e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482`)
> constituye únicamente el primer acto de un instrumento bilateral y no quedó ejecutada, porque falta el
> segundo acto: la contrafirma de K+AIR.** En consecuencia: (i) la v1.1 no llegó a ser el instrumento que
> rige la relación entre la Empresa y K+AIR, y K+AIR no manifestó aceptación de sus condiciones;
> (ii) el texto vigente es la versión 1.3, suscrita y contrafirmada el 12 de noviembre de 2026, que sí
> quedó ejecutada; (iii) la v1.1 se conserva, sin reescribir y sin contrafirmar retroactivamente —
> contrafirmar un acto que no ocurrió sería fabricarlo—, en el manifiesto, dentro de
> `anexo_nube.versiones_firmadas`, con su huella, su fecha y su evidencia, y con `contrafirmado: false`;
> y (iv) **no cabe afirmar que bajo la v1.1 no se trató dato alguno**, porque la base de producción
> registra una firma electrónica completada el 6 de noviembre de 2026, dentro de la ventana en la que la
> v1.1 era la única versión del Anexo de Nube suscribida por la Empresa: lo que corresponde es **declarar**
> que el tratamiento de esa ventana se ejecutó por K+AIR como Encargado del Tratamiento, conforme al
> Acuerdo y a la versión del Anexo de Nube que la Empresa tenía suscrita, y que esa versión nunca llegó a
> ser el instrumento bilateral.

### 3.3 Nota de expediente (texto listo para incorporar)

> **Asunto:** Constancia sobre la suscripción de la versión 1.1 del Anexo de Nube, suscrita y sin
> contrafirma. **Fecha:** 12-nov-2026. **Elabora:** asesoría jurídica de K+AIR.
>
> **1. Hechos.** 1.1. La versión 1.1 del Anexo de Nube (SHA-256 `e9517536…591482`, 62.198 bytes) fue
> **suscrita** por ASEPLUS CARIBE S.A.S. (NIT 900.829.731) el **5 de noviembre de 2026 a las 22:51:34
> UTC**, con verificación por código de un solo uso y registro de la dirección IP 181.63.26.145.
> 1.2. El Anexo de Nube es **bilateral**: su sección 10 exige la firma del Responsable y la del
> Encargado. La suscripción de la Empresa es el primer acto; la contrafirma de K+AIR es el segundo.
> **El segundo acto no se produjo.** 1.3. El texto vigente es la **versión 1.3**, **suscrita el 12 de
> noviembre de 2026 a las 15:38:27 UTC y contrafirmada por K+AIR el mismo día a las 16:13:54 UTC**, con
> sus dos actas. 1.4. El manifiesto conserva la v1.1 en `anexo_nube.versiones_firmadas`, con su huella,
> su fecha y su evidencia, y con el indicador `contrafirmado: false`.
>
> **2. Calificación.** 2.1. La v1.1 **no es un instrumento ejecutado**: no generó para K+AIR las
> obligaciones de un Anexo bilateral, ni para la Empresa un marco contractual con K+AIR sobre el
> tratamiento en la nube. 2.2. **No se contrafirmará retroactivamente.** Una contrafirma con fecha de
> hoy, sobre un acto que ocurrió en noviembre de 2026 y que K+AIR no realizó, sería la fabricación de un
> acto que no ocurrió, y es contrario al principio de veracidad (art. 4(d) de la Ley 1581 de 2012) y a
> la lógica de versionado del §9.4 del Acuerdo. 2.3. **La afirmación «bajo la v1.1 no se trató dato
> alguno» no se sostiene y no se hace.** La base de producción registra una firma electrónica completada
> el **6 de noviembre de 2026** (`SIGN-2026-738564`, estado `SIGNED`) y una cancelada el mismo día
> (`SIGN-2026-016820`); la v1.1 era en esas fechas la única versión del Anexo de Nube suscrita por la
> Empresa, y la v1.3 no se publicó hasta el 11 de noviembre. Lo que corresponde es **declarar** que el
> tratamiento de esa ventana se ejecutó por K+AIR **como Encargado**, conforme al Acuerdo y a la
> versión del Anexo de Nube suscrita por la Empresa. 2.4. **Pendiente de comprobación (acto del owner,
> no bloquea el cierre):** leer, en modo de solo lectura, en las cinco filas de firma de producción la
> versión y la huella del Anexo de Nube registradas, y dejar el resultado en el expediente.
>
> **3. Decisión y efectos.** 3.1. La v1.1 **queda como registro histórico del primer acto**: no se
> contrafirma, no se borra, no se reescribe y no se omite del manifiesto. 3.2. Ningún texto vigente la
> presenta como suscrita y contrafirmada, ni como el instrumento que rige la relación. 3.3. Este cierre
> no altera el bloque M.15, cuya decisión —no contrafirmar retroactivamente— es correcta y cuya
> ejecución queda aquí documentada.
>
> **4. Límites.** Esta nota constata y califica hechos del expediente; no sustituye la revisión de un
> abogado matriculado ni decide sobre la responsabilidad por el tratamiento ocurrido en la ventana del 5
> al 11 de noviembre de 2026, materia que se cerrará con la reemisión del Anexo de Nube (v1.4) y del
> Anexo de Encargo que la remite.

### 3.4 ⚠️ No verificado y qué confirmar

- Qué versión y huella del Anexo de Nube **efectivamente** registra cada una de las cinco filas de firma
  de producción. Requiere consulta de solo lectura a la base del servidor (`sqlite3 -readonly`), con las
  credenciales del owner. **Es el único dato que falta para cerrar el numeral 2.3 de la nota.**
- El contenido literal del manifiesto de producción (que la entrada de la v1.1 lleve `contrafirmado:
  false`): el manifiesto no está en el repo; se verificó **en el código** que lo escribe, no en el
  archivo.
- **A confirmar con abogado externo:** si la nota debe añadir una declaración de responsabilidad por el
  tratamiento de la ventana 05→11-nov, o si basta la constatación. La recomendación es que basta la
  constatación, porque el Contrato de Encargo y el Acuerdo ya regían el servicio, y porque el riesgo real
  no es la falta de contrafirma sino la **ausencia de una Empresa real suscrita** y el tratamiento sobre
  la empresa de prueba.

---

## 4. L7 — La variable inerte `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`

### 4.1 Respuesta corta

**La decisión de conservarla inerte es correcta y compatible con la Ley 1581**, siempre que se acompañe
del comentario que hoy ya existe en el código y de la corrección de **tres lugares del repo que todavía
la presentan como un interruptor**. La ficha publicada **ya** dice la verdad (el rechazo es
incondicional), de modo que **no hay nada que retirar de los textos firmados**: lo que hay que corregir es
la documentación interna, que es la que se contradice.

### 4.2 Los hechos verificados en el repo

| # | Hecho | Evidencia |
|---|---|---|
| 4.1 | La variable **se lee** en el código, pero su valor **no lo consume nadie**: `config.js` la convierte en `config.exigirMedioPersonalOtp`, y en `src/` **no hay ninguna lectura de ese campo** (solo dos comentarios que lo mencionan al pasado) | `src/config.js`; búsqueda de `exigirMedioPersonalOtp` en `src/` |
| 4.2 | El rechazo del buzón corporativo es **incondicional**: la función `_controlarMedioCorporativo` **no recibe** el flag, responde **400 `MEDIO_OTP_CORPORATIVO`** y deja el evento `OTP_MEDIO_CORPORATIVO` en `gh_firma_eventos`, que es **append-only** | `src/services/publicFlow.js` |
| 4.3 | El **texto vigente ya lo declara** incondicional, sin ninguna opción que lo desactive | `scripts/fixtures/acuerdo-v1.6.txt` (§3.7(e)) |
| 4.4 | La **ficha técnica publicada** también lo declara incondicional y **cita el archivo y la línea** que lo implementa | `sitio/anexo-nube-v1.3.html` |
| 4.5 | **Tres documentos del repo sí lo presentan como interruptor:** (i) `firma-service/legal-readiness.json`: «El flag FIRMA_EXIGIR_MEDIO_PERSONAL_OTP sigue APAGADO»; (ii) `src/db/schema/031_medio_otp.sql`: «el rechazo (D2) sigue **APAGADO**»; (iii) `src/services/publicFlow.js`: bloque de comentario obsoleto «EL RECHAZO (D2) Y CUÁNDO SE ACTIVA… está en el código, pero **APAGADO**… Se enciende cuando exista la 9A» | idem |
| 4.6 | La misma línea del manifiesto afirma «todavía no hay solicitudes de firma», lo que **no coincide** con la base de producción (cinco firmas: tres del 26-oct, dos del 06-nov, una de ellas `SIGNED`) | el manifiesto frente al mapa de la meta |
| 4.7 | El `Historial.md` afirma que la variable «se define en `src/config.js:176` y **no se lee en ningún otro sitio**»: es literalmente inexacto (se lee en la línea siguiente); lo correcto es «su valor no lo consume nadie» | `Historial.md` |

### 4.3 Línea de opinión

> La variable `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` **no es un control y no debe presentarse como control en
> ningún documento**, porque el control que describe —el rechazo del código OTP hacia un buzón que la
> Empresa pueda leer— **existe, es incondicional y está en vigor** desde la versión 1.2 del Acuerdo
> (27-oct-2026): responde 400 `MEDIO_OTP_CORPORATIVO` y deja el asiento `OTP_MEDIO_CORPORATIVO` en el
> registro de operaciones, que es de solo anexado. Un texto que presente la variable como un interruptor
> «apagado» induce a error sobre un estado que no existe (no hay nada que encender) y, por el principio
> de veracidad o calidad (art. 4(d) de la Ley 1581 de 2012), ese error en la documentación del responsable
> y del encargado no puede sostenerse; y por el principio de transparencia (art. 4(e)), el Titular tiene
> derecho a obtener en cualquier momento y sin restricciones información fidedigna acerca del
> tratamiento que se le aplica, lo que incluye el estado real de los controles que se dicen aplicar.
> **La decisión del owner de conservar la variable inerte es correcta y no genera exposición**: una
> variable de entorno sin consumidor no cambia ningún comportamiento, no desplaza ninguna responsabilidad
> y no oculta ninguna medida de seguridad. Lo que sí genera exposición es la **contradicción
> documental** —un texto que dice «incondicional» junto a otro que dice «apagado»—, y esa se cierra
> corrigiendo los tres documentos internos que hoy la tratan como interruptor. La ficha publicada al
> Titular y a la Empresa **no requiere corrección**.

### 4.4 Los tres textos a corregir

1. **`src/services/publicFlow.js`** — el bloque «EL RECHAZO (D2) Y CUÁNDO SE ACTIVA» está obsoleto y
   contradice el bloque vigente de `_controlarMedioCorporativo`. **Corregido el 12-nov-2026**: ahora
   dice que el rechazo es **siempre activo**, que la variable se conserva inerte y que el control y su
   asiento están en `_controlarMedioCorporativo`.
2. **`src/db/schema/031_medio_otp.sql`** — el comentario de cabecera dice que el rechazo «sigue APAGADO».
   **No se corrigió, y esa es una decisión**: el archivo es una **migración ya aplicada en producción** y
   las migraciones no se reescriben (su contenido es la evidencia de lo que se ejecutó). La corrección
   queda en el código y en el expediente. Si en el futuro se publica una versión nueva de la migración,
   ahí sí.
3. **`firma-service/legal-readiness.json`** — el campo `inventario_evidencia` dice «El flag
   FIRMA_EXIGIR_MEDIO_PERSONAL_OTP sigue APAGADO» y «todavía no hay solicitudes de firma». **No se
   corrigió en esta ronda, y esa es una decisión consciente**: ese archivo es el **manifiesto que el
   servicio lee y que se despliega**, y su huella está registrada en el expediente y en el cuadro
   canónico. Corregirlo cambia la huella del manifiesto y obliga a repropagar el expediente entero.
   El texto correcto queda escrito aquí, y **se aplica cuando se arme la v1.4**, que es cuando el
   manifiesto se reescribe por el estado de la v1.4:

   > «Inventario ejecutado el 2026-10-26 en el servidor de produccion (scripts/inventario-buzon-corporativo.js): 0 solicitudes revisadas y 0 casos en riesgo (47.4). El directorio tiene 1 empresa activa (ASEPLUS CARIBE S.A.S.) y el resultado es 0 por poblacion vacia, asi que el inventario hay que repetirlo cuando haya solicitudes reales: la base de produccion registra 5 firmas (tres del 26-oct y dos del 06-nov, una de ellas SIGNED). La variable FIRMA_EXIGIR_MEDIO_PERSONAL_OTP se conserva inerte y su valor no lo usa ninguna decision: el rechazo del buzon corporativo es INCONDICIONAL desde la v1.2 del Acuerdo (27-oct-2026) y esta en src/services/publicFlow.js, funcion _controlarMedioCorporativo, que responde 400 MEDIO_OTP_CORPORATIVO y deja el evento OTP_MEDIO_CORPORATIVO en gh_firma_eventos (append-only). No debe citarse como control en ningun documento.»

### 4.5 El comentario recomendado para el `.env` (si el owner decide conservarla)

```
# FIRMA_EXIGIR_MEDIO_PERSONAL_OTP
# SIN EFECTO. NO ES UN INTERRUPTOR Y NO CAMBIA NINGUN COMPORTAMIENTO DEL
# SERVICIO. Se lee una sola vez en src/config.js y su valor no lo usa
# ninguna decision: el rechazo del codigo OTP hacia un buzon que la Empresa
# pueda leer es INCONDICIONAL desde la v1.2 del Acuerdo (27-oct-2026).
# El control real esta en src/services/publicFlow.js, funcion
# _controlarMedioCorporativo: responde 400 MEDIO_OTP_CORPORATIVO y deja el
# evento OTP_MEDIO_CORPORATIVO en gh_firma_eventos (append-only).
# Se conserva la variable solo por compatibilidad con despliegues que ya la
# tengan definida en su .env. Si esta linea aparece en un .env, su valor se
# ignora. No debe citarse como control en ningun documento.
FIRMA_EXIGIR_MEDIO_PERSONAL_OTP=false
```

**Recomendación del asesor: eliminarla del `.env`.** Su valor no lo consume nadie, y el argumento para
conservarla («para no romper despliegues que ya la tengan definida») es vacío: **una variable que no se
lee no puede romper un despliegue**. El histórico queda en el comentario del código, que es donde
pertenece.

### 4.6 ⚠️ No verificado y qué confirmar

- Nada que no esté verificado en §4.2: los tres hechos son lecturas directas del repo.

---

## 5. Descargo

Asesoría jurídica informativa sobre fuentes públicas consultadas el 12-nov-2026; no constituye asesoría
jurídica profesional. La validación final de los plazos, la ratificación de las determinaciones y la
apertura de las compuertas son actos del owner y del abogado matriculado.
