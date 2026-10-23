# Plan de cierre del Acuerdo de uso — Capítulos VI a XII (fase de auditoría, sin ejecutar)

**Fecha**: 2026-10-19
**Estado**: **plan para revisión del owner. No se ejecutó nada de este plan.**
**Alcance**: los siete capítulos que quedaban abiertos (VI, VII, VIII, IX, X, XI, XII) más cuatro hallazgos transversales que los atraviesan.
**Lo que este documento NO es**: no es un commit, no es una promesa de que el texto sirve, y no cambia una sola línea de código. Es el mapa de lo que hay que hacer para que el Acuerdo y la aplicación digan lo mismo, y para que lo digan bien.

---

## 0. Cómo se hizo esta revisión

- **Texto legal**: `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.0.txt` (los Capítulos I a XII completos).
- **Norma**: compilación jurídica oficial del SENA (`normograma.sena.edu.co/compilacion`), descargada con Node y extraída artículo por artículo **en local**, porque `web_fetch` trunca las páginas grandes. Cada artículo citado abajo se leyó en su texto literal, con sus notas de vigencia.
- **Código**: `sgsst-electron-app/firma-service` (backend Node/Express + mini-app `web/firma/`), en el **estado del disco** (incluye los cambios sin commit de la Fase 6 y del Capítulo V).
- **Publicados**: `sitio/terminos.html`, `sitio/privacidad.html`, `sitio/anexo-encargo.html`.

**Fuentes oficiales usadas** (todas de la compilación del SENA, salvo donde se dice):

| Norma | Dónde se leyó |
|---|---|
| Decreto 1072 de 2015 (arts. 2.2.1.1.9 a .15) | `decreto_1072_2015_pr001.htm` |
| Decreto 1074 de 2015, Cap. 47 (firma electrónica) | `decreto_1074_2015_pr038.htm` |
| Decreto 1074 de 2015, Cap. 43 (cámaras de comercio) | `decreto_1074_2015_pr035.htm` |
| Decreto 1074 de 2015, Cap. 25 (Ley 1581) | `decreto_1074_2015_pr026.htm` y `pr027.htm` |
| Ley 1581 de 2012 (arts. 3, 6, 7, 8, 9, 15) | `ley_1581_2012.htm` |
| Ley 527 de 1999 (arts. 15, 28) | `ley_0527_1999.htm` |
| Ley 1564 de 2012 (arts. 243, 244) | `ley_1564_2012_pr008.htm` |
| Ley 1562 de 2012 | compilación del Senado |
| Resolución 0312 de 2019 | compilaciones oficiales MINTIC e ICFES (el PDF del Ministerio es imagen escaneada, sin capa de texto) |

---

## 1. Tablero: estado de los siete capítulos

Leyenda: **✓** cumple · **⚠** parcial · **✗** no cumple · **—** no aplica al software.

| Capítulo | Contra la norma | Contra el código | Veredicto |
|---|---|---|---|
| **VI. Reglas de uso** | 1 error de forma (6.1 d) es un parágrafo) + 1 imprecisión (6.2) + desalineación de alcance | el hash autoritativo es mutable y el token es recuperable | ⚠ |
| **VII. Firma autográfica y no barrera** | las frases 2 y 3 del 7.3 no están en el decreto (son garantía contractual) | **el derecho no existe fuera del texto**: ni en la mini-app ni en el correo | ✗ |
| **VIII. Copias y conservación** | el 8.1-8.4 amplían a "cualquier documento" lo que la ley regula para el contrato individual | **no se registra la autorización de medios**; **no hay copia permanente**; la comunicación del 8.6 es optativa | ✗ |
| **IX. Manifestación y versionamiento** | el 9.2 dice "versión vigente"; el sistema muestra la versión de la solicitud | casilla ✓, huella **no se muestra**, y el 9.5 no tiene la vía positiva (callejón 409) | ⚠ |
| **X. Datos personales** | el 10.7(c) atribuye al artículo equivocado e invierte el sentido; el 10.7(f) y el 10.4(a) tampoco tienen respaldo | **la purga borra la prueba y conserva el dato**; el token es reversible; **no existe mecánica de dato sensible**; `metadata` es un canal libre | ✗ |
| **XI. Notificaciones** | ✓ | el destinatario del correo de invitación es libre | ⚠ |
| **XII. Ley aplicable y finales** | el 12.7 atribuye a un artículo de datos; el 12.3 usa mal el nombre oficial de la Resolución 0312 | el registro que prueba la aceptación es el que la purga borra | ⚠ |

**Transversales (no son de un solo capítulo):**

| ID | Hallazgo | Severidad |
|---|---|---|
| **T1** | Los T&C, la Política de Privacidad y el Anexo de Encargo están escritos para la **app de escritorio local** ("K+AIR no transmite esa información a ningún servidor de Gesstiar S.A.S.", "K+AIR es un software local", "copias de trabajo"). El `firma-service` es un servicio **en la nube de Gesstiar S.A.S.**: los datos sí transitan a sus servidores, sus respaldos son suyos y su disponibilidad depende de su infraestructura. **El Capítulo X (10.1) remite a un Anexo de Encargo que describe otra operación.** | 🔴 crítico |
| **T2** | El seed de DESARROLLO carga `acuerdo-dev-v1.0.txt`, un stub de 2 KB que **no contiene el Capítulo VII ni el Capítulo X**: en dev, el trabajador nunca ve el derecho a firma en papel. | 🟠 alto |
| **T3** | `LEGAL.md` §4.4 propone validar el consentimiento contra el "art. 28 Ley 527/1999": ese artículo es de **firma digital**, y K+AIR usa **firma electrónica**. La base correcta es la Ley 527 art. 15 (manifestación de voluntad), el Decreto 1074 arts. 2.2.2.47.3 y 47.7, y el Decreto 1377 arts. 3 y 7. | 🟡 medio |
| **T4** | La cita que la mini-app sí hace (`2.2.2.47.7` + Ley 1581) es **correcta**. No hay que "arreglar" nada ahí. | ℹ️ informativo |
| **T5** 🟡 | **Falta la base legal que el propio Acuerdo es.** El parágrafo del **2.2.1.1.9** del Decreto 1072 (añadido por el Decreto 526 de 2021) dice: "Para la celebración del contrato de trabajo firmado electrónicamente, **el acuerdo sobre el uso del mecanismo de firma electrónica previsto en el Artículo 2.2.2.47.7 del Decreto Único Reglamentario 1074 de 2015, se regirá por lo señalado en el Artículo 2.2.1.1.13 del presente decreto y por las disposiciones adicionales que las partes encuentren procedente convenir en el contrato mismo**." Ese artículo es el que **valida el Acuerdo como el "acuerdo sobre el uso del mecanismo"** y le da gobernanza (el 2.2.1.1.13 + lo que las partes convengan). El Acuerdo no lo cita en ningún punto: está operando sin la norma que lo legitimiza. **Debe ser la primera cita del documento** (y también sustenta el 6.2, porque es ahí donde está authorized la ampliación contractual a "cualquier documento"). | 2.2.1.1.9, parágrafo (compilación SENA) | texto |

---

## 2. Los hallazgos, uno por uno

### 2.1 Capítulo VI — Reglas de uso

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H1** | El **6.1 d)** presenta como literal lo que en el 2.2.1.1.13 del Decreto 1072 es el **parágrafo** del artículo (el artículo tiene 3 numerales + 1 parágrafo). Y el **6.2** remite a "las reglas del numeral anterior", que ya no es un numeral. | Compilación SENA, `decreto_1072_2015_pr001.htm` | texto |
| **H2** | El hash autoritativo de la firma (`document_hash_firmado`) se escribe con un `UPDATE` ordinario: **cualquiera con acceso a la base lo puede reescribir sin dejar evento**. Los eventos sí son append-only (triggers de la migración 020), pero la fila que los ancla no. Además el PDF firmado no lleva firma criptográfica: `pdfGen.js` no genera ByteRange ni PAdES. | `publicFlow.js:1076-1093`, `020_eventos_append_only.sql:239-271`, `pdfGen.js:347-396` | código |
| **H3** | El **6.2** no deja rastro: la API admite cualquier categoría de documento (10 valores en `TIPOS_IDENTIFICACION`) y nada registra que ese documento se remitió bajo la extensión contractual del 6.2. Cuando haya un incumplimiento, no hay evidencia de bajo qué título contractual se remitió. | `schemas/index.js:134`, `signRequest.js:374-385, 643-656` | código |

### 2.2 Capítulo VII — Firma autográfica y no barrera

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H4** 🔴 | El derecho del 7.2 (firma en papel, en cualquier momento y sin costo) y la no-barrera del 7.3 **no existen en ningún canal**. En la mini-app no hay una sola mención a "papel", "autográfica" o "barrera"; en el correo de invitación tampoco. Lo único que el trabajador ve al no firmar es un aviso de que **"no podrás cambiarla después"**. El derecho vive únicamente dentro del texto contractual que el trabajador acepta, sin ninguna forma de ejercerlo. | `web/firma/index.html` (pantalla final y de rechazo), `app.js:1031`, `mailer.js:172-219` | código |
| **H5** | El 7.3 tiene dos frases (no iniciar procedimiento disciplinario; no es causa de terminación) que **no están** en el 2.2.1.1.11: son garantía contractual propia y deben presentarse como tal, no como exegesis del decreto. | Compilación SENA | texto |
| **H6** | El 7.3 amplía "un contrato individual de trabajo" (texto oficial) a "un documento". Es legítimo (es la razón del 6.2 y del 12.3), pero el texto debe **marcar el salto**: "de conformidad con el artículo X **respecto del contrato individual de trabajo**, y **por ampliación contractual** (6.2) respecto de los demás documentos". Afecta también al 6.1, el 7.1 y el 8.1-8.4. | Compilación SENA | texto |

### 2.3 Capítulo VIII — Suministro de copias y conservación

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H7** 🔴 | **No se registra la autorización de medios electrónicos** que el 8.2 da por hecha, y **no existe ninguna vía** (pública ni interna) para que el trabajador la modifique. La tabla de consentimientos no tiene campo de medios; los tres endpoints de consentimiento son internos. En una inspección, "¿dónde consta la autorización de medios?" no tiene respuesta en el sistema. | `001_initial.sql:31-51`, `routes/consent.js:40,126,201` | código |
| **H8** 🔴 | **No hay forma permanente de obtener copia del documento firmado.** El único camino es `GET /api/sign/:token/signed-document.pdf`, que resuelve el token **con expiración**: al vencer el enlace (24 h presencial / 72 h remoto) responde 410. Lo que queda es el correo que llegó al firmar en el momento de la firma (envío *best-effort*) y un canal humano. El 8.5 dice "en cualquier momento y sin costo". | `publicFlow.js:100-125, 1531-1553`, `schemas/index.js:100-107` | código |
| **H9** | **No hay consulta pública del documento**: `GET /api/sign/:token/verify` devuelve metadatos y hash, no el PDF ni la constancia; y no existe una página `/v/:token`. El 8.3 ("disponibles para posterior consulta") y el 8.4 (suministro a autoridades) asumen un tercero que no tiene el token. | `routes/public.js:445-456` y mapa completo de `src/routes/*.js` | código |
| **H10** | La comunicación del **8.6 es optativa**: si la Empresa no declara plazo ni canal, el correo sale sin esas líneas y la mini-app los muestra como "pendientes". Además el **texto mostrado** y el **plazo computable** son dos campos independientes sin validación cruzada: si solo hay texto, no hay fecha de conservación y nunca hay purga; si solo hay días, no se le comunica nada. Y lo que ve el trabajador viene de la **fila viva** de la Empresa, mientras el plazo exigible quedó congelado al crear la solicitud: si la Empresa edita su política después, **lo comunicado puede no ser el aplicable**. | `mailer.js:200-217`, `empresa.js:88,130-152,223-236`, `conservacion.js:110-142` | código |
| **H11** | El **8.5** ("reconocerá el término copia") **no tiene base** en el 2.2.1.1.12: es garantía contractual propia (coherente con el art. 8 de la Ley 527 y con el 5.4 y el 7.2 del propio Acuerdo). | Compilación SENA | texto |

### 2.4 Capítulo IX — Manifestación de voluntad y versionamiento

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H12** | **El 9.5 tiene solo la mitad negativa.** Se bloquea correctamente la firma con versión vencida (409), pero **no hay camino para leer y aceptar la versión nueva**: la solicitud queda congelada en su versión de creación y el trabajador que llega tarde recibe un 409 sin salida. La obligación ("el Trabajador debe leer y aceptar esa versión nueva en el momento mismo de la firma") **no se cumple**. | `publicFlow.js:162-176, 195-210` | código |
| **H13** | El **9.3 no se cumple**: el SHA-256 del texto del Acuerdo se guarda en `data-hash` (atributo DOM invisible) y **no se muestra junto al texto**. La versión sí se muestra. El patrón ya existe para otro dato (la huella de la identificación de la Empresa), así que es trabajo de una línea de plantilla. | `app.js:548-554`, `index.html:182-193` | código |
| **H14** | El **9.2 dice "el sistema muestra la versión vigente en el momento mismo de la firma"** y el sistema muestra la **versión de la solicitud**. Es coherente con el "sin efectos retroactivos" del 9.5, pero la redacción es más fuerte que la implementación: o se corrige el texto o se corrige el código (y el 9.2 es el lugar natural para meter la vía del H12). | `publicFlow.js:181-210` | texto/código |
| **H15** | "Leído en su totalidad" es una **comprobación geométrica** (que el scroll llegó al final), sin permanencia mínima. Es un proxy razonable, pero conviene dejarlo escrito o endurecerlo. | `app.js:556-573` | bajo |
| **H16** | La constancia imprime el hash del Acuerdo **truncado** (24+…+24): sirve de referencia, no de prueba recalculable por un tercero. El hash completo está en la base y en el evento. | `pdfGen.js:85-89, 659-662` | bajo |

### 2.5 Capítulo X — Tratamiento de datos personales

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H17** 🔴 | **La purga hace lo contrario de lo que ordena el 10.6.** `conservacion.js:503` borra **solo el registro de auditoría**; sobreviven la fila (correo en claro, huellas, vínculo al consentimiento), el PDF original, el PDF firmado y la constancia en disco. El propio script lo dice: *"HASTA QUE EXISTA LA 5B, ESTA OPERACIÓN NO CUMPLE EL 8.6"*. Peor: la verificación pública responde con `skipExpirationCheck` **indefinidamente**, así que el sistema sigue afirmaendo "firma válida / documento íntegro" después de que venció el plazo. | `conservacion.js:495-520`, `scripts/purga-ventana.js:99-113`, `publicFlow.js:2110-2113` | código |
| **H18** 🔴 | **El token de acceso se conserva de forma reversible**, contra el 3.6(e) y el 10.5(b) ("únicamente en forma de huella digital con sal **y nunca en texto claro**"). Además de `token_hash` (HMAC), se guarda una copia cifrada con AES-256-GCM en `metadata._server_metadata.token_encrypted`, y existe `GET /internal/sign-requests/:id/link` que **devuelve el token en claro**. El propio código lo reconoce en `crypto/token.js:10-14`. | `signRequest.js:44-55, 522-542`, `routes/signRequest.js:710-719` | código / texto |
| **H19** 🔴 | **El 10.8 es incumplible: no existe la mecánica.** Ni la API puede marcar un documento como sensible, ni la mini-app tiene aviso previo ni consentimiento expreso. El 2.2.2.25.2.3 exige "informar al titular de forma explícita y previa... cuáles de los datos serán objeto de tratamiento son sensibles... y obtener su consentimiento expreso", y que "ninguna actividad podrá condicionarse a que el Titular suministre datos personales sensibles". | grep sin resultados en `src/` y `web/firma/`; `schemas/index.js:82-149` | código |
| **H20** 🟠 | **`metadata` es un canal libre para meter datos del Titular fuera de la lista del 10.2**: JSON de hasta 8192 caracteres, persistido **verbatim** (salvo sustituir `id_trabajador`). La última frase del 10.2 dice que el numeral "no autoriza a la Empresa a enviar al servicio datos distintos de los aquí relacionados", y hoy no hay ninguna barrera técnica. | `schemas/index.js:61-75`, `routes/signRequest.js:167-169` | código |
| **H21** 🟠 | **La API no rechaza campos no previstos**: el esquema no es `.strict()`, así que un campo inesperado no da 400: **se ignora en silencio** (lo dice el propio código). Un documento con un campo mal escrito pasa como si fuera correcto. | `schemas/index.js:82-149`, `routes/signRequest.js:154-156` | código |
| **H22** 🟠 | **El candado por Anexo de Encargo firmado no existe.** La columna `anexo_encargo_firmado_at` y el endpoint para marcarla están; la migración 017 dice textualmente que "NO bloquea la creación de sign requests por ausencia del anexo. Ese candado se activa por separado". Hoy K+AIR trata datos de una empresa sin Anexo firmado. | `017_firma_empresas.sql:41-43`, `empresa.js:396-429` | código |
| **H23** 🟠 | **El número de documento del representante legal queda en texto claro** en `representante_legal_snapshot`, mientras el del trabajador sí se guarda solo como huella. El 10.5(a) habla "del número del documento de identidad" sin distinguir de quién. | `schemas/index.js:141-147`, `signRequest.js:630` | código |
| **H24** 🟠 | **12.7 y 10.6 se contradicen en el mismo punto**: el registro que prueba la aceptación (el evento `CONSENT_ACCEPTED`, que lleva versión, hash, fecha/hora e id de solicitud) es **justo el que la purga borra**. La fila de consentimiento no tiene columna `id_solicitud`. Y la atribución a `2.2.2.25.2.5` es parcialmente impropia: ese artículo ("PRUEBA DE LA AUTORIZACIÓN") obliga a conservar prueba de la **autorización de tratamiento de datos**, no de la aceptación de un Acuerdo. | `publicFlow.js:1875-1882`, `001_initial.sql:31-50`, `conservacion.js:503` | código / texto |
| **H25** 🟡 | **El 10.7(c) atribuye mal la fuente e invierte el sentido.** La frase "al menos una vez al mes calendario" es del **Decreto 1377 de 2013, artículo 21**, compilado en el **2.2.2.25.4.2** del Decreto 1074, **no** de los artículos 8 y 15 de la Ley 1581 que el numeral cita. Y la norma dice que el Titular **puede consultar de forma gratuita** al menos una vez al mes calendario **y por encima de esa frecuencia el responsable puede cobrar** envío, reproducción y certificación: el Acuerdo no menciona ese párrafo y su redacción hace parecer que lo gratuito se limita a una vez al mes. | `2.2.2.25.4.2` (Decreto 1377 art. 21) | texto |
| **H26** 🟡 | **El 10.7(f), primera frase**, ("La solicitud de copia constituye un derecho de acceso y no implica por sí misma un derecho de supresión") **no tiene respaldo en el artículo citado**: la palabra "copia" no aparece en el Decreto 1377 ni en su compilación. **Texto oficial verificado** del 2.2.2.25.2.6 (= Decreto 1377 art. 9): "Los Titulares podrán en todo momento solicitar al responsable o encargado la supresión de sus datos personales y/o revocar la autorización otorgada... La solicitud de supresión de la información y la revocatoria de la autorización no procederán cuando el Titular tenga un deber legal o contractual de permanecer en la base de datos. El responsable y el encargado deben poner a disposición del Titular mecanismos gratuitos y de fácil acceso para presentar la solicitud de supresión de datos o la revocatoria de la autorización otorgada." **Corrección: la primera frase debe apoyarse en el art. 8(f) de la Ley 1581 (acceso gratuito) y en el 2.2.2.25.4.2 (derecho de acceso), y no en el 9; la segunda frase sí es casi literal del 9.** | Compilación SENA | texto |
| **H27** 🟡 | **El 10.4(a) cita tres normas reales que, sin embargo, no sostienen lo que la frase les hace sostener.** El 2.2.2.47.7 ("FIRMA ELECTRÓNICA PACTADA MEDIANTE ACUERDO") no es un deber de conservar evidencia: regula la **presunción de validez** de la firma pactada. **Pero su parágrafo sí impone un deber a K+AIR**: "La parte que mediante acuerdo provee los métodos de firma electrónica deberá asegurarse de que sus mecanismos son técnicamente seguros y confiables para el propósito de los mismos. A dicha parte le corresponderá probar estos requisitos en caso de que sea necesario." El 2.2.1.1.12 obliga a conservar **los contratos de trabajo**; y el 2.2.1.1.13 remite al deber del empleador de garantizar que el mecanismo cumple el 47.4. La **última frase** del 10.4(a) ("el deber del Responsable de conservar prueba de la autorización otorgada por el Titular") es exactamente el **2.2.2.25.2.5**, lo que hace coherente el 10.4(a) con el 12.7. **Corrección: partir la frase y atribuir cada parte a su norma**, en vez de eliminar las citas. | Compilación SENA | texto |
| **H28** 🟡 | El **10.7(e)** ("sólo procede acudir a la SIC una vez agotado el reclamo interno") atribuye al art. 15 de la Ley 1581 algo que el artículo no dice. **Texto oficial verificado** del art. 15 ("RECLAMOS"): el reclamo se formula ante el Responsable o el Encargado; si está incompleto se requieren las fallas en 5 días; "el término máximo para atender el reclamo será de quince (15) días hábiles"; y si quien recibe el reclamo no es competente, "dará traslado a quien corresponda en un término máximo de dos (2) días hábiles e informará de la situación al interesado". El artículo **fija el procedimiento interno**, pero **no habilita** a acudir a la SIC ni dice que el agotamiento sea requisito. El fundamento de la actuación de la SIC es el **art. 22** ("una vez establecido el incumplimiento"). **Corrección: citar los arts. 15 y 22, o atribuir la preclusión a doctrina.** | Compilación SENA | texto |
| **H29** 🟡 | El **nombre del trabajador se persiste en claro** (`nombre_trabajador` y `nombre_empresa` dentro de `metadata`). El 10.2 no lo lista; cabe discutible en "datos de identificación laboral", y eso lo decide el abogado. | `routes/signRequest.js:165-166` | código |
| **H30** 🟡 | El **2.2.2.25.4.4** ("MEDIOS PARA EL EJERCICIO DE LOS DERECHOS") obliga a que "**todo Responsable y Encargado** designe a una persona o área" y el 2.2.2.25.4.2 a que "los responsables **y encargados**... establezcan mecanismos sencillos y ágiles que se encuentren permanentemente disponibles a los Titulares". El 10.7 dice que los derechos se ejercen **ante la Empresa**; como K+AIR es el Encargado, también le corresponde un mecanismo propio. La mini-app solo muestra el canal de la Empresa. | Compilación SENA | texto/código |
| **H31** 🟡 | El **10.8(a)** dice "de que el dato es sensible"; la norma exige informar **cuáles** de los datos que serán objeto de tratamiento son sensibles y la finalidad. Detalle de redacción para cuando exista la mecánica del H19. | Compilación SENA | texto |

### 2.6 Capítulo XI — Notificaciones

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H32** 🟠 | **La invitación acepta un destinatario libre**: `notifyRemote(signRequest, req.body.correo, ...)` pasa el correo del body tal cual, sin contrastarlo con el correo registrado del trabajador. La Empresa puede redirigir el enlace de firma (y con él el OTP) a un tercero, y el 11.1 exige que toda notificación se haga al correo **registrado**. | `routes/signRequest.js:934-939` | código |

### 2.7 Capítulo XII — Ley aplicable y disposiciones finales

| # | Qué pasa | Evidencia | Tipo |
|---|---|---|---|
| **H33** 🟡 | El **12.1** no nombra el **Decreto 2364 de 2012** (reglamenta la Ley 527 en firma electrónica y es la fuente original de los arts. 2.2.2.47.x del Decreto 1074) ni el **Decreto 526 de 2021** (añadió al Decreto 1072 los arts. **2.2.1.1.8 a 2.2.1.1.15**, ocho artículos, en el bloque de firma electrónica del contrato individual de trabajo). La cláusula final los cubre, pero conviene citarlos por nombre: son la fuente directa de los artículos que el Acuerdo invoca. **El Acuerdo sí dice "Decreto 1072" en el 6.1, el 7.1 y el 8.1 — no hay error de decreto en el texto**; lo que falta es la mención de la norma que los añadió. | Compilación SENA | texto |
| **H34** 🟡 | El **12.3** usa mal el nombre oficial de la Resolución 0312 de 2019: se titula "Por la cual se **definen** los Estándares Mínimos del Sistema de Gestión de la Seguridad y Salud en el Trabajo SG-SST" (Ministerio de Trabajo, 13/02/2019, DO 50.872). Sigue **vigente**: el Decreto 661 de 2026 añadió el art. 2.2.2.1.42 al Decreto 1072 y su texto sigue remitiendo a "la Resolución número 0312 de 2019" (esto se verificó en la **compilación oficial del SENA**, no en el Diario Oficial: sirve como corroboración, no como prueba primaria de vigencia). Y la Ley 1562 de 2012 se titula "…en materia de Salud Ocupacional", no "Ley de SST". | Compilaciones MINTIC/ICFES + compilación SENA del Decreto 1072 | texto |
| **H35** 🟡 | El **6.1**, el **7.1** y el **12.7** deben mentionar la norma que **añadió** los artículos: el art. 1 del Decreto 526 de 2021. Además el parágrafo del 2.2.1.1.13 termina con "o la norma que lo modifique, complemente o sustituya", y el Acuerdo trunca esa frase. | Compilación SENA | texto |

### 2.8 Transversales

| # | Qué pasa | Tipo |
|---|---|---|
| **T1** 🔴 | Los documentos publicados describen **otra operación**: "K+AIR no transmite esa información a ningún servidor de Gesstiar S.A.S." (T&C §4), "K+AIR es un software local... no ofrece un servicio en la nube" (T&C §8), "elimina de sus copias de trabajo" (Anexo §7). El `firma-service` corre en la nube de Gesstiar S.A.S.: los datos **sí** están en sus servidores, sus respaldos son suyos y la disponibilidad depende de su infraestructura. **Esto lo dice el Capítulo X (10.1) al remitir al Anexo de Encargo.** | texto/abogado |
| **T2** 🟠 | El seed de desarrollo carga `acuerdo-dev-v1.0.txt` (stub de 2 KB): **en dev el trabajador no ve el Capítulo VII ni el X**, o sea que ahí no se puede probar lo que se acaba de construir. Es la "Prioridad 6" del plan de onboarding, pendiente desde hace semanas. | código |
| **T3** 🟡 | `LEGAL.md` §4.4 apunta al art. 28 de la Ley 527 (firma **digital**) como base del consentimiento; K+AIR usa firma **electrónica**. La base correcta: Ley 527 art. 15 + Decreto 1074 arts. 2.2.2.47.3 y 47.7 + Decreto 1377 arts. 3 y 7 + Ley 1581 art. 4. | texto |

---

## 3. Lo que ya está bien (no tocar)

Para que el plan no se lea como una lista de pendientes:

- **Cifrado del OTP y del token en BD**: HMAC-SHA256 con llave **fuera** de la base, con sal por solicitud (migración 019 y `022_clave_por_empresa.js`).
- **El número de documento del trabajador**: se seudonimiza; no queda en claro en ninguna columna.
- **El PDF firmado**: el hash se calcula en el servidor sobre el buffer final y la verificación **recalcula** el SHA-256 del archivo en disco y lo compara.
- **Los eventos de auditoría**: append-only por triggers de SQLite (migración 020).
- **El versionado del Acuerdo**: versión única, hash, una sola activa (migración 002), y la firma exige que la versión ligada sea la vigente y que el hash coincida.
- **El 9.2**: la casilla de aceptación está deshabilitada hasta que el texto se lee hasta el final.
- **El 8.6**: el plazo y el canal de copia se comunican en el correo de invitación **y** en la mini-app, antes de firmar.
- **La constancia**: lleva versión del Acuerdo, hash, fecha de aceptación, id de consentimiento, hashes del documento y de la evidencia, y el plazo de conservación.
- **Las citas del Capítulo X al Decreto 1074**: las cuatro son **correctas** (`25.5.2` contrato de transmisión, `25.2.5` prueba de la autorización, `25.2.3` datos sensibles, `25.2.6` revocatoria). La nota editorial "no compilado" de la página del Decreto 1377 en la compilación del SENA es **errónea**; si el abogado la ve, no la siga.
- **La base legal que invoca la mini-app** (`2.2.2.47.7` + Ley 1581) es correcta.

---

## 4. Fases de ejecución propuestas

Cada fase es commiteable, probable y reversible. El orden importa: **primero lo que es un incumplimiento que se produce en silencio**, después los derechos del trabajador, después el cierre técnico, y el texto legal al final (porque el texto se publica una sola vez, como v1.1).

### Fase 8 — Cerrar el Capítulo X (lo que hoy se incumple solo)

| Acción | Cierra | Riesgo |
|---|---|---|
| **8.1 La 5B**: suprimir de verdad el dato vencido (fila, PDFs, rutas en disco) y no solo los eventos; neutralizar el enlace; dejar la verificación pública diciendo **"no disponible por vencimiento del plazo"**, no "firma válida"; recibo propio con las categorías suprimidas | H17, H24 | Alto: toca la persistencia. Mitigación: primero en modo *dry-run* con recibo, luego activo; el `hold_legal` sigue bloqueando. |
| **8.2 Mecánica de dato sensible**: marca de "documento sensible" en el modelo, aviso explícito previo en la mini-app y casilla de consentimiento expreso adicional; evento propio | H19, H31 | Medio: cambia el flujo de aceptación para un subconjunto de documentos. |
| **8.3 Cerrar `metadata`**: lista blanca de claves y `.strict()` en los esquemas de la API interna (un campo no previsto → 400, no silencio) | H20, H21, H29 | Medio: puede romper clientes que hoy envían campos de más. Mitigación: primero registrar qué claves usa cada cliente en una corrida, luego cerrar. |
| **8.4 Número del representante**: hashear o seudonimizar en el snapshot, igual que se hace en el consentimiento | H23 | Bajo. |
| **8.5 Conservar la prueba de la aceptación**: que la purga no borre el evento de aceptación del Acuerdo (o lo anonimice conservando versión, hash y fecha) | H24 | Bajo. |

### Fase 9 — Cerrar los Capítulos VII y VIII (los derechos del trabajador)

| Acción | Cierra | Riesgo |
|---|---|---|
| **9.1 La firma en papel**: bloque visible en la mini-app (pantalla de aceptación, pantalla final y pantalla de rechazo), línea en el correo de invitación y **reformular el texto del rechazo** para que afirme que la decisión no genera consecuencia disciplinaria | H4, H5 | Bajo, y es el cambio de mayor impacto en la relación con el trabajador. |
| **9.2 Medios autorizados**: registrar los medios en el consentimiento (origen, fecha, evidencia) y abrir una vía para que el trabajador los modifique | H7 | Medio: migración + endpoint + evento. |
| **9.3 Copia permanente**: separar la credencial de "poder firmar" (token con TTL) de la de "poder consultar" (p. ej., token de consulta sin expiración, o copia por OTP al correo del firmante), independiente del estado del enlace | H8 | Medio-alto: toca el modelo de credenciales. Es la decisión de diseño más grande del plan. |
| **9.4 Consulta pública** por identificador de solicitud + código de un solo uso, que sirva la constancia y el PDF firmado con su hash: el canal de remisión a autoridades | H9 | Medio. |
| **9.5 El 8.6 con teeth**: congelar plazo y canal en la solicitud (los dos, no uno), derivar el texto del valor computable, y **bloquear la creación** cuando la Empresa no los haya declarado | H10 | Medio: es una política, ver decisión D3. |

### Fase 10 — Cierre técnico y probatorio (Capítulos VI, IX, XI)

| Acción | Cierra | Riesgo |
|---|---|---|
| **10.1 Token**: rotar en vez de descifrar (el endpoint de re-emisión emite un token nuevo y anula el anterior); dejar de persistir la copia reversible | H18 | Medio-alto: hay un endpoint interno que hoy depende de la recuperación. Alternativa: excepción declarada en el texto (decisión D1). |
| **10.2 Hash inmutable**: trigger que aborte el `UPDATE` de las columnas de evidencia una vez en estado firmado, y ancla HMAC del `evidence_hash` con la llave del servicio | H2 | Medio. |
| **10.3 Origen contractual del documento**: registrar en la solicitud y en el evento `CREATED` si el documento es contrato individual, adición o anexo, u "otro documento bajo la extensión contractual del 6.2" | H3 | Bajo. |
| **10.4 El 9.5 positivo**: camino para que la solicitud migre a la versión vigente y el trabajador lea y acepte esa versión en el momento de la firma | H12 | Medio: toca la lógica de versión y el gate de aceptación. |
| **10.5 Mostrar el SHA-256** del texto del Acuerdo junto al texto | H13 | Bajo. |
| **10.6 Destinatario atado**: la invitación solo puede ir al correo registrado del trabajador | H32 | Bajo. |
| **10.7 Constancia**: hash completo del Acuerdo | H16 | Bajo. |
| **10.8 Fixture de desarrollo**: que el seed cargue el texto legal real (o un marcado equivalente) para que el Capítulo VII y el X se puedan probar | T2 | Bajo. |

### Fase 11 — Cierre legal (texto): la v1.1

Una sola publicación, con el texto que hoy está en cinco sitios (Capítulos IV, V, VI, X, XII) corregido:

| Corrección | Capitulo | Numeral |
|---|---|---|
| Remisión al artículo 43.3 → apoyar en el 47.5 + el parágrafo 2 del 2.2.1.1.10 | IV | 4.1 |
| "cualquier acuerdo aplicable" | IV | 4.2 |
| Condición "mientras no hayan sido tachados de falso o desconocidos" + citar los arts. 243 y 244 | IV | 4.4 |
| Preámbulo: reproducir los tres deberes del 47.6 y añadir el deber propio del Acuerdo | V | 5.1 |
| "Políticas de seguridad" que el Firmante nunca ve | V | 5.1(a) |
| El d) es el parágrafo, no un numeral; "del artículo anterior" | VI | 6.1, 6.2 |
| Marcar el salto de alcance (contrato individual / ampliación contractual) | VI, VII, VIII | 6.1, 7.1, 7.3, 8.1-8.4 |
| "garantía contractual" para el 7.3 (2ª y 3ª frase) y el 8.5 | VII, VIII | 7.3, 8.5 |
| "El sistema muestra la versión vigente" → o se cambia el texto o se implementa el 10.4 | IX | 9.2 |
| Atribución correcta de "mes calendario" + el párrafo de costos | X | 10.7(c) |
| Respaldo del art. 8(f) + el 21 del Decreto 1377 para la "solicitud de copia" | X | 10.7(f) |
| Bases que sí sostienen el deber de conservar evidencia | X | 10.4(a) |
| Artículos 15 y 22 de la Ley 1581 | X | 10.7(e) |
| Puente entre "no puede ser alterado ni eliminarse" (10.5(d), 3.6(g)) y "el dato se suprime" (10.6) | X | 10.5(d), 10.6 |
| Nombrar el Decreto 2364 de 2012 y el Decreto 526 de 2021; nombre oficial de la Resolución 0312 y de la Ley 1562 | XII | 12.1, 12.3 |
| Atribución fina de la prueba de la aceptación | XII | 12.7 |

Además, en la misma fase legal: **el Anexo de Encargo, los T&C y la Política de Privacidad** necesitan la **variante de nube** (T1), porque hoy describen un producto que no es el que se está operando.

**Aviso de versión**: cambiar el texto cambia el hash. Los consentimientos ya aceptados guardan el hash de la v1.0 y **no se tocan**: la v1.1 aplica a las firmas nuevas. Por eso el 9.5 (leer y aceptar la versión nueva) tiene que funcionar antes de que la v1.1 exista: **el orden es Fase 10.4 → Fase 11**.

---

## 5. Decisiones que son tuyas (no las tomo yo)

| ID | Decisión | Opciones | Impacto |
|---|---|---|---|
| **D1** | El token de acceso, ¿se puede recuperar? | (a) **Rotación**: el enlace se re-emite con un token nuevo y el anterior se anula (código, cierra H18). (b) **Excepción declarada**: se mantiene la recuperación cifrada y se escribe en el Acuerdo y en el Anexo que el token se conserva "como huella digital y, en sobre cifrado con llave fuera de la base, para poder re-emitir el enlace" (texto, y el 3.6(e)/10.5(b) secorrigen). | Define si el H18 es un bug o una cláusula mal redactada. **(b) es más honesto con la operación real** (K+AIR sí necesita poder re-emitir el enlace cuando la Empresa pierde la respuesta de creación), pero obliga al abogado a tocar dos numerales. |
| **D2** | El `correo_verificacion` con dominio de la Empresa | (a) **Rechazar** en la API. (b) **Documentar** como regla de onboarding. (c) Avisar sin bloquear. | Si el buzón es compartido, la Empresa tiene los datos de creación de la firma: rompes el 5.1(b), el 5.2 y el 47.4 en silencio. **(c) es el punto medio razonable.** |
| **D3** | ¿Se bloquea la creación de la solicitud si falta el Anexo de Encargo firmado (H22) o si falta el plazo declarado (H10)? | (a) Bloquear con override auditado. (b) Avisar. (c) No tocar. | (a) es lo correcto frente al art. 25 del Decreto 1377; (b) es lo tolerable comercialmente. |
| **D4** | Alcance del 10.8 (H19) | (a) Mecánica completa: marca de sensible + aviso + casilla expresa. (b) Solo un aviso genérico en el Acuerdo + que la Empresa marque el documento fuera del sistema. (c) **Excluir** los documentos con datos sensibles del mecanismo y dejarlos fuera de alcance. | (c) es la más limpia si el producto va a firmar actas y certificados de salud; (a) es la más fiel al texto que ya está escrito. |
| **D5** | ¿Se publica la v1.1 del Acuerdo (Fase 11)? | (a) Sí, después de las Fases 8-10. (b) No, hasta que el abogado revise todo junto. | Publicar la v1.1 cambia el hash y obliga a que el 9.5 funcione (10.4). |
| **D6** | T1: ¿variante de nube de los T&C y del Anexo, o un Anexo nuevo solo para el firma-service? | (a) Un Anexo de Encargo distinto para el servicio en la nube, y los T&C que dicen "software local" se corrigen para el servicio. (b) Un solo juego de documentos que cubra las dos modalidades. | El Anexo en la nube es lo que el Capítulo X (10.1) está promisiendo. |

---

## 6. Lo que este plan NO cubre

- La **5B** se implementa (Fase 8.1), pero el **comportamiento post-purga** del enlace y del oráculo ("no disponible por vencimiento del plazo", no "inválido") va incluido en esa misma acción.
- **La v1.1 del Capítulo X del representante y del bloque de manifestación** (que el plan de onboarding tiene anotado desde antes) se resuelve con la Fase 11 y las acciones 8.1 a 8.5.
- **El puente PC → servidor** (cargar solicitudes desde la app de escritorio) sigue bloqueando producción y **no es parte de este plan**: es un problema de integración, no de cumplimiento del Acuerdo.
- **El contrato de transmisión de datos** con cada Empresa (el documento firmado, no la fecha) es un deber de la Empresa; el sistema solo registra la fecha y, con D3(a), puede exigirla.

---

## 7. Lo que hay que mirar antes de decidir

1. **El Capítulo X es el que más se aparta.** Tres incumplimientos se producirían sin que nadie los note: la purga que no suprime, el token recuperable y el documento de salud firmado con la misma casilla genérica.
2. **El Capítulo VII es el que más duele.** El derecho a la firma en papel existe solo como texto; el trabajador que no puede usar el mecanismo ve una advertencia de irreversibilidad y nada más.
3. **El 8.2 y el 8.5 están incumplidos en el sentido literal**: el sistema no registra la autorización de medios que el Acuerdo da por hecha, y no hay forma permanente de obtener la copia que el 8.5 promete.
4. **El texto legal y el código se contradicen en un punto que no es de redacción, sino de operación**: el token. De ahí la decisión D1.
5. **T1 es el hallazgo que toca menos código y más riesgo**: los documentos que el Capítulo X invoca describen una operación que no es la del `firma-service`.

---

## 8. Decisiones tomadas y secuencia revisada (2026-10-19, revisión del owner)

El owner revisó este plan y tomo las seis decisiones. Se incorporan aquí con su
fundamento para que la sesion siguiente no tenga que reconstruirlas.

| # | Decision | Fundamento del owner | Como queda |
|---|---|---|---|
| **D1** | **Rotacion, no excepcion declarada.** | El 3.6(e)/10.5(b) promete que el token existe unicamente como huella digital; el `token_encrypted` y el endpoint que devuelve el texto claro rompen la letra y el propósito. La necesidad operativa ("la Empresa perdio la respuesta de creacion") se cubre sin excepcion: se genera un token nuevo, se guarda su HMAC y se devuelve una sola vez; los anteriores siguen validos hasta su vencimiento, con **maximo 3 activos por solicitud** *(regla vigente hasta el 23-oct-2026: desde entonces la reemision invalida el anterior y queda un solo token vigente)*; cada emision se registra y se puede revocar. | **Fase 8C, y no al final.** El texto debe decir **HMAC-SHA-256 con clave secreta**, no "sal": la sal es publica, la clave no. |
| **D2** | **Rechazar por defecto.** | Un correo que dice venir del dominio de la Empresa pero lo envia Gesstiar debe identificar al remitente real: si no, es informacion engañosa. | Excepcion solo con: dominio verificado (SPF/DKIM/DMARC), autorizacion escrita de la Empresa, remitente visible "Gesstiar S.A.S. en nombre de [Empresa]", reply-to monitoreado y registro de cada envio. |
| **D3** | **Bloquear, no avisar.** | Sin Anexo firmado no hay contrato de transmision; sin plazo no hay tratamiento temporalmente limitado. Un warning no es control. | Falla con **409 explicable**: "falta Anexo firmado" / "falta plazo declarado". Transicion documentada y comunicada para empresas existentes. **Override por tipo de documento** (un plazo unico es arbitrario para salud, laboral y contable) y **dies a quo definido** ("desde la firma" no es "desde la terminacion de la relacion laboral"). |
| **D4** | **Mecanica completa, con minimizacion y sin condicionar.** | El 10.8 es un hallazgo normativo, no una mejora de redaccion. | Flag de sensibilidad **por tipo de documento, inferido y no solo declarado**; aviso previo con las categorias concretas; **checkbox separado** del consentimiento general; registro de version, texto y consentimiento; control de acceso y cifrado; **minimizacion** (si solo se necesita "aptitud", no el diagnostico); **prohibicion de datos sensibles en correos, notificaciones y logs**; retencion y purga. "Aviso generico" no cumple. Si el producto no quiere asumir salud, **bloquea el documento y deriva a papel** (no se puede procesar sin mecanismo). |
| **D5** | **Esperar al abogado, pero no a "todo junto".** | No publicar una v1.1 sin revision y firma del abogado, pero no esperar a que esten todos los capitulos. | **11A** (correctivo minimo: T1, 10.6, token, 10.8, 10.7(c), 6.1(d)/6.2, 10.7(f)/10.4(a)/10.7(e), Decreto 526 y titulo de la 0312) sale **despues de 10.4** y de la revision del abogado. **11B** (el resto) va en v1.2. Si el servicio **ya esta operando**, T1 es **stop-the-line**: no seguir obteniendo firmas cloud con documentos que dicen "no server"; notificar el cambio y **re-obtener la autorizacion** (el Decreto 1377 art. 5 exige nueva autorizacion cuando cambia la finalidad); si el trabajador no acepta, ofrecer papel. Si es **pre-lanzamiento**, no publicar ni lanzar. No publicar la promesa del oraculo hasta el despliegue. |
| **D6** | **Un juego maestro con dos modalidades.** | No dos juegos paralelos que pueden divergir. | Un solo T&C que distinga **K+AIR desktop local** (procesa localmente; no transmite a Gesstiar salvo que el usuario use el servicio de firma) de **Gesstiar firma-service (nube)** (Gesstiar trata por cuenta de la Empresa, como encargado; el trabajador debe saberlo antes de usar el servicio). El Anexo de Encargo lleva un **schedule cloud** con alcance, instrucciones, seguridad, subencargados, ubicacion, backups, retencion, supresion y auditoria. El Anexo §7 debe decir "**elimina de sistemas y backups en el plazo X, salvo hold legal**", no "copias de trabajo". |

### 8.1 Correcciones del owner incorporadas a esta auditoria

| Correccion | Estado |
|---|---|
| **El Decreto 526 de 2021 es del Decreto 1072**, y el bloque que anadio es el **2.2.1.1.8 a 2.2.1.1.15** (ocho articulos), no ".9 a .15". | **Confirmado** en la compilacion oficial: 8 notas "<Articulo adicionado por el articulo 1 del Decreto 526 de 2021>" en `decreto_1072_2015_pr001.htm`. El **Acuerdo si dice "Decreto 1072"** en el 6.1, el 7.1 y el 8.1: no hay error de decreto en el texto. Corregido el H33 y el H35. |
| **El Decreto 661 de 2026** no se podia verificar. | **Confirmado** en la compilacion oficial del SENA (`decreto_1072_2015_pr006.htm`): el art. 2.2.2.1.42, anadido por el Decreto 661 de 2026, sigue remitiendo a "la Resolucion numero 0312 de 2019". Es corroboracion, **no** prueba primaria de vigencia (esa seria el Diario Oficial). Corregido el H34. |
| **El numero del representante: cifra, no hashees.** | **Cambio de diseno incorporado.** El numero del representante es prueba de la representacion y puede necesitarse en la constancia o en el certificado de existencia y representacion; hashearlo destruye esa prueba. **Cifrar con llave fuera de la base, restringir acceso, mostrar solo los ultimos 4.** El del trabajador si seudonimiza. Reclasificado: no es hallazgo normativo, es decision de diseno probatorio, **a resolver antes de la 8B**. |
| **10.7(f), 10.4(a), 10.7(e) sin verificar.** | **Verificados** con el texto oficial (ver H26, H27, H28). No se eliminan: se **reapuntan** a la norma que sí sostiene cada frase. |
| **El Decreto 526 da base normativa a papel, copia y medios.** | Confirmado: los arts. 2.2.1.1.11 y 2.2.1.1.12 obligan al empleador a proveer los medios, prohíben que la imposibilidad de firmar electrónicamente sea barrera de acceso al empleo, exigen que el contrato se suministre por medio **autorizado por el trabajador** y quede disponible para consulta posterior, y no puede tener costo para el trabajador. El Capitulo VII pasa a ser **hallazgo normativo para contratos de trabajo**, no solo coherencia interna. |
| **El script de purga cita el 8.6; la conservacion es el 10.6.** | Correccion de coherencia: el 8.6 es "comunicar el plazo y donde pedir copia"; el deber de conservar por plazo y suprimir es el **10.6**. El headline del script (`PURGA DEL REGISTRO DE AUDITORIA (8.6 / 10.6)`) y sus comentarios deben decir 10.6. |
| **"Fase 6 sigue pendiente".** | Aclaracion: la **Fase 6 (PDF firmado desde el enlace, orden (g)/(h), 5.4)** esta **implementada y probada** (1181 tests + prueba en navegador). Lo que esta pendiente es el **commit**, no el trabajo. |
| **Nuevo: la base legal que el propio Acuerdo es.** | El paragrafo del **2.2.1.1.9** (Decreto 526 de 2021) dice que "el acuerdo sobre el uso del mecanismo de firma electronica previsto en el Articulo 2.2.2.47.7 del Decreto 1074 de 2015, se regira por lo senalado en el Articulo 2.2.1.1.13 del presente decreto y por las disposiciones adicionales que las partes encuentren procedente convenir". Ese articulo **valida el Acuerdo** y le da gobernanza. El Acuerdo no lo cita: ver **T5**. |

### 8.2 Lo que faltaba en este plan y quedo incorporado

- **Hold legal como quinta condicion en base de datos**: ambito, motivo, autoridad, inicio/fin, creador y referencia. El purge lo consulta **en la base**, no solo en la app. Con hold, no borra y registra. Liberacion autorizada y auditada.
- **Plazo exigido antes de la primera firma**, no solo antes de crear la solicitud.
- **Backups y subencargados dentro del alcance de la purga**: retencion menor o igual al plazo declarado, o crypto-shredding. Si no, el 10.6 no se cumple aunque la fila desaparezca.
- **Re-autorizacion de los trabajadores existentes** por el cambio T1 (D5), con la opcion de papel.
- **Matriz de trazabilidad**: hallazgo -> norma -> codigo -> texto -> prueba -> estado. Debe vivir en el repo, no en una conversacion.
- **Compuertas de despliegue**: migraciones 019-023 en staging, keyring, `verificacion:identidad`, los **2 tests omitidos de la migracion 020**, ubicacion del hosting y proveedor de correo.

---

## 9. Riesgo: que se puede hacer sin riesgo y que no

**Respuesta corta: no. Nada de esto se hace "sin riesgo", y hay una parte que es
irreversible por naturaleza.** Lo que si se puede hacer es que cada paso tenga un
contenedor y una compuerta.

### 9.1 Compuerta 0 — antes de tocar una linea

| # | Compuerta | Por que |
|---|---|---|
| 0.1 | **Saber si el servicio ya opera** (con clientes reales y firmas reales). | Define si T1 es stop-the-line con re-autorizacion (D5) o si es pre-lanzamiento y no se publica nada. Es el dato que mas cambia el orden. |
| 0.2 | **Copia completa verificada** de la base de produccion y del directorio de PDFs, y **restauracion probada** de esa copia. | La 5B borra filas y archivos. No hay "deshacer". |
| 0.3 | **Copia de la base de produccion en staging** y alli correr las migraciones 019-023. | Nunca se aplicaron en ningun sitio fuera de las pruebas, y produccion esta en <=018. El 019 cambia la columna de identificacion, el 021 anade plazo, el 022 anade la llave por empresa, el 023 anade conservacion. Contra una base con filas reales, eso no se ha probado. |
| 0.4 | **Verificar que el trigger append-only de la 020 está activo en el entorno real.** | La 020 lleva `-- @skip-when-env test` a propósito (varios tests limpian la tabla con `DELETE`), así que **en la base de tests el trigger no está instalado**. La cobertura sí existe: `tests/conservacion-purga.test.js` aplica el archivo real de la migración en una base en memoria aislada y ejercita las cinco condiciones, incluido el hold. Lo que hay que confirmar es que en **staging y en producción** la migración se aplique de verdad y el trigger quede activo sobre la base real. *(Aclaración: los 2 tests omitidos de la suite NO son de la 020 — son un test de rate limit y uno de esquema zod.)* |
| 0.5 | **Inventario de que campos usa cada cliente** en el body de la API interna, en una corrida real. | Sin eso, cerrar `metadata` con lista blanca y `.strict()` rompe clientes en produccion. |
| 0.6 | **Ubicacion del hosting y proveedor de correo.** | Sin eso el Anexo de Encargo no se puede cerrar y la transferencia internacional (Ley 1581 art. 26) queda abierta. |

### 9.2 Riesgos por paso, y su contenedor

| Paso | Riesgo real | Contenedor |
|---|---|---|
| **8A.1 (vencimiento)** | Bajo. Cambia un mensaje. | El mas seguro: es el primero y no borra nada. |
| **8A.2 (5B)** | **El mas alto de todo el plan.** Destruye la fila, los PDFs y los archivos. Un error = evidencia de firma perdida e irrecuperable. | Modo *dry-run* con recibo y sin borrar; staging con copia de produccion; **restauracion probada** antes (0.2); purga idempotente y transaccional; **hold legal en base**; el recibo de purga sin datos personales; el evento de aceptacion sobrevive (minimo). |
| **8C (token)** | Rompe `GET /internal/sign-requests/:id/link` y el modelo de credenciales. Los tokens anteriores siguen validos hasta su vencimiento (max 3 activos; regla vigente hasta el 23-oct-2026: desde entonces la reemision invalida el anterior y queda un solo token vigente). | Versionado del endpoint; aviso a los clientes; los tokens previos se invalidan en cada reemision (3.4(c), desde el 23-oct-2026); cada emision auditada y revocable. |
| **8B (sensibles + metadata)** | Un documento sensible se firma con la casilla generica si no se implementa bien; cerrar `metadata` rompe clientes. | Inferir el flag por **tipo de documento**, no solo declararlo; dry-run del inventario (0.5); 409 explicable y derivacion a papel. |
| **10.4 (version positiva)** | Medio: toca la logica de version y el gate de aceptacion. | Debe existir **antes** de la 11A, porque publicar la v1.1 cambia el hash. |
| **9 (derechos)** | Bajo en código, alto en impacto para el trabajador. | Es la fase que más conviene hacer bien la primera vez: el texto de rechazo, la firma en papel, los medios y la copia permanente. |
| **11A / 11B (texto)** | Publicar un texto con la v1.1 es irreversible en cuanto al hash: las firmas nuevas quedan bajo el texto nuevo y los consentimientos viejos no se tocan. | Revision y firma del abogado antes de publicar; matriz de trazabilidad; versionado del Acuerdo ya existente. |
| **T1 (documentos publicados)** | Si el servicio ya opera: seguir firmando con documentos que dicen "no server" es el riesgo que mas dano hace y el que menos cuesta cerrar. | Stop-the-line + re-autorizacion + papel (D5). |

### 9.3 La regla que propongo

> **Nada llega a produccion hasta que haya un "dale" explicito Y el staging este en verde.**
> Ninguna accion destructiva corre contra la base real sin copia verificada y restauracion probada.
> El commit lo hace el owner; esta sesion no commitea.

Con eso, el riesgo se vuelve manejable: no cero, pero acotado, reversible en cada
paso salvo en la 5B, y esa es la unica irreversible y por eso lleva la compuerta mas
estricta.

---

## 10. Secuencia revisada (con las decisiones incorporadas)

```
Compuerta 0 (0.1 a 0.6)
   |
   +-- 8A.1  vencimiento (sin borrar nada)
   +-- 8A.2  5B + hold + plazo + post-vencimiento   <- la de mas riesgo
   +-- 8C    token por rotacion
   +-- 8B    dato sensible + metadata + representante
   +-- 10.4  version positiva del 9.5                 <- habilita la 11A
   +-- 11A   v1.1A (correctivo minimo, con el abogado) <- T1, 10.6, 10.7(c), 6.1(d)...
   +-- 9     papel, medios, copia, consulta, 8.6
   +-- 10    resto (hash inmutable, 6.2, SHA, destinatario, constancia, fixture)
   +-- 11B   v1.2 (el resto de los capitulos)
```

**El token y el T1 no pueden esperar al final**: el token es una promesa de seguridad
que hoy el codigo incumple, y el T1 es el hallazgo que toca menos codigo y mas riesgo.
---

## 11. Fase 8A.1 — ejecutada (2026-10-19, `📦914`)

**Estado: implementada, probada y registrada. Sin commit** (el commit lo hace el
carril de codigo con la palabra del owner).

### Que cambio

El defecto era invisible y por eso era grave: la verificacion publica resolvia el
token con `skipExpirationCheck`, una bandera que se saltaba **todas** las
comprobaciones de vencimiento. Vencido el plazo que declaro la empresa (numeral
10.6), el sistema seguia respondiendo "firma registrada y documento integro",
recalculaba el SHA-256 del PDF en disco y pintaba el banner verde: **afirmaba una
vigencia que ya no existia**, mientras el propio script de purga decía en voz alta
que la capa de datos personales todavia no existia.

| # | Cambio | Archivo |
|---|---|---|
| 1 | `vencidaPorConservacion(fila)`: pregunta de consulta, distinta de `esElegible` (que es de supresion). Mira el hold legal. | `src/services/conservacion.js` |
| 2 | `resolveToken` sin banderas que salten el vencimiento. `permitirHistorico` ignora SOLO la ventana para firmar, nunca el plazo de conservacion. | `src/services/publicFlow.js` |
| 3 | Estado nuevo `410 CONSERVACION_VENCIDA` ("No disponible por vencimiento del plazo") en `/verify`, `/s/:token` y `/verify-pdf`. | `src/routes/public.js`, `src/services/publicFlow.js` |
| 4 | El 404 ya no confirma la existencia: "No disponible" para un token que nunca existio y para uno que ya no se puede mostrar. | `src/services/publicFlow.js`, `src/middleware/errors.js` |
| 5 | La mini-app distingue los cuatro casos del enlace y NO ofrece verificacion cuando el plazo vencio (la verificacion responde lo mismo: ofrecerla seria una promesa falsa). | `web/firma/app.js` |
| 6 | Documentados los endpoints `/verify` y `/verify-pdf`, que eran un hueco de `API.md` (§5.10 y §5.11), con la tabla de estados. | `docs/.../API.md` |

### El detalle que importa

**El hold legal prima sobre el vencimiento.** Con deber legal o contractual de
conservacion (una reclamacion, un proceso judicial, un requerimiento de la SIC), el
dato NO se suprime: se conserva. En ese caso la evidencia sigue viva y la
verificacion debe seguir confirmando la integridad. Decir "no disponible" seria
falso, porque el documento esta ahi y ademas tiene que estar ahi. Hay un test que lo
fija.

### Como se valido

11 tests nuevos (`tests/fase8a-vencimiento-verificacion.test.js`): los cuatro estados
del verify, el hold, la no-regresion, el 404 que no confirma, y dos checks de que el
backend no se salta el vencimiento. Se actualizaron dos tests existentes por el
cambio de copy: el del 404 del middleware y los checks del enlace reabierto de la
mini-app, que pasaron de 12 a 14 checks con dos mutaciones nuevas (§7.2: un check que
no muerde no es un check).

**Suite completa: 1198 tests · 1196 verdes · 0 fallos · 2 omitidos.**

### Lo que esta fase NO hace

- **No suprime nada.** Cambia lo que el sistema afirma, no lo que guarda. La
  supresion real es la 8A.2 (la 5B), que es la parte irreversible y lleva la
  compuerta mas estricta.
- **No arregla el 8.5** (no hay copia permanente) ni el **8.2** (medios
  autorizados): son de la 9A.
- **No toca el texto legal.** El texto que describe este comportamiento es el 10.6
  y el 8.6, y no cambian en la 11A.

### La dependencia que hay que cumplir

Sin `fecha_conservacion` calculada no hay vencimiento que comprobar. O sea: esta
fase solo hace algo si las migraciones **021** (plazo declarado por la Empresa) y
**023** (`fecha_conservacion`) estan aplicadas en el entorno donde corra. Si no lo
estan, el sistema no inventa plazos (el 8.6 dice que el Acuerdo no los fija porque la
ley no los fija) y el comportamiento es el de siempre: sin vencimiento, sin purga.

## 12. Fase 8A.2 — ejecutada (2026-10-19, `📦915`)

**Estado: implementada, probada y registrada. Sin commit** (el commit lo hace el
carril de codigo con la palabra del owner).

### Que cambio

El defecto era de fondo: la capa de conservacion (migracion 020) borraba el
**registro de auditoria** de las firmas vencidas. Eso destruye la prueba y conserva el
dato, exactamente al reves de lo que ordenan el 8.6 y el 10.6 ("Vencido ese plazo y sin
que exista un deber legal o contractual de conservacion, el dato se suprime"). El
propio script de purga lo decia en voz alta: "HASTA QUE EXISTA LA 5B, ESTA OPERACION
NO CUMPLE EL 8.6".

La 5B suprime la **capa de datos**: la fila completa de la firma y los archivos que la
acompanaban (PDF original, PDF firmado y constancia).

| # | Cambio | Archivo |
|---|---|---|
| 1 | Tabla `gh_firma_purgadas` (la lapida) y columna `id_solicitud` en la prueba de aceptacion. | `src/db/schema/024_purga_datos.sql` |
| 2 | Los triggers append-only de la lapida, en su propia migracion con `@skip-when-env test` (el mismo mecanismo que la 020). | `src/db/schema/025_purga_datos_append_only.sql` |
| 3 | `supresion.js`: `simular()` (simulacion por defecto) y `suprimir()` (actor, motivo, ventana y lote obligatorios; archivos primero, base despues, en transaccion; idempotente). | `src/services/supresion.js` |
| 4 | `PROPOSITO_TUMBA` y `hashTokenTombstone`: la lapida NO guarda la credencial, guarda un HMAC de un hash con proposito propio. | `src/crypto/token.js` |
| 5 | `resolveToken` consulta la lapida: un enlace suprimido responde `410 CONSERVACION_VENCIDA`, no un 404 que no dice por que. | `src/services/publicFlow.js` |
| 6 | El `id_solicitud` se enlaza al crear la firma, para que la prueba de la aceptacion que sobreviva a la supresion cumpla el 12.7 completo. | `src/services/signRequest.js`, `src/services/consent.js` |
| 7 | El script de purga ofrece las dos capas y simula por defecto. | `scripts/purga-ventana.js` |

### Las tres decisiones que importan

1. **Se borra la fila, no se anonimiza.** Es la lectura mas fuerte del 10.6 ("el dato
   se suprime") y ademas la unica compatible con el esquema: el `CHECK` del estado
   impediria inventar un estado nuevo sin rehacer la tabla. La consecuencia es que **el
   evento de aceptacion en `gh_firma_eventos` no puede sobrevivir** (la llave foranea
   lo impide). Lo que sobrevive es la **prueba de aceptacion** en
   `gh_consentimientos_firma`, que no tiene llave foranea contra la firma, y que es
   justamente donde el 12.7 la situa. De ahi la columna `id_solicitud`: sin ella, la
   prueba no llevaba el identificador de la solicitud.
2. **La lapida no guarda la credencial.** Guarda
   `HMAC('tombstone-purga', token_hash)`: un hash de un hash, con proposito y llave
   derivados. No permite autenticarse ni resolver nada. Solo permite que el sistema
   diga "no disponible por vencimiento del plazo" en vez de un 404 mudo.
3. **El dry-run es el modo por defecto** y la simulacion no borra nada: ni la fila, ni
   los archivos, ni una lapida.

### Como se valido

16 tests nuevos (`tests/fase8a2-supresion-datos.test.js`), todos verdes: la simulacion
no borra nada; la supresion real borra la fila y los archivos; la idempotencia; el
gobierno (actor, motivo, ventana, lote); el hold legal; la lapida sin credencial; la
lapida sin datos personales; la lapida append-only; el enlace suprimido responde `410`;
y la prueba de la aceptacion con su identificador de solicitud.

El trigger de la 025 **no se prueba en la base compartida**: lleva
`@skip-when-env test`, como la 020, porque los tests limpian la tabla entre casos. Se
prueba aplicando el **archivo real de la migracion** en una base aislada, con un test
de mutacion que demuestra que sin el trigger la lapida si se podria alterar y borrar.

**Suite completa: 1214 tests · 1212 verdes · 0 fallos · 2 omitidos.**

### Lo que esta fase NO hace

- **No se ejecuta todavia.** La supresion real es irreversible y hasta que la Compuerta
  0 no este en verde no se corre contra produccion. El codigo esta; la operacion no.
- **No suprime los datos personales de la Empresa ni de otros titulares.** El sistema no
  es el responsable de esos datos: su supresion depende de la tabla de retencion
  documental de cada Empresa, que es un proceso del cliente.
- **No toca los backups.** El plazo de eliminacion en sistemas y respaldos va en el
  **Anexo de Encargo** (la 11B).
- **No arregla el 8.5** (copia permanente) ni el **8.2** (medios autorizados): son de la 9A.
- **No toca el texto legal.** El 10.6 y el 8.6 no cambian en la 11A.

### Lo que esta fase si dejo discovering

Al implementarla aparecieron dos cosas que no estaban en el plan:

1. **Los triggers de la 020 se saltan en el ambiente de test**, y los servicios de
   conservacion y supresion dependen de las tablas que ella crea. Antes, esas tablas
   existian solo porque `tests/conservacion-purga.test.js` las creaba en su `before`: un
   orden de archivos distinto rompia la suite sin tocar el codigo de produccion. La
   garantia se movio a `tests/helpers.js` (`asegurarTablasPurga()`), que la ejecuta en
   cada `resetDb()`. Es un bug de la suite, no del servicio, pero era real.
2. **El `id_solicitud` no lo escribia nadie en la via OTP.** El consentimiento se
   acepta *antes* de que exista la firma, asi que en ese momento no hay identificador
   de solicitud que escribir: se enlaza al crear la firma. Sin eso, la prueba de la
   aceptacion que sobrevive a la supresion quedaba incompleta para el 12.7.

## 13. Fase 8C — ejecutada (2026-10-19, `📦916`)

**Estado: implementada, probada y registrada. Sin commit** (el commit lo hace el
carril de codigo con la palabra del owner).

### Que cambio

El 3.6(e) del Acuerdo promete que el token de acceso "se conserva unicamente en
forma de huella digital". El codigo no lo cumplia: ademas de la huella (HMAC con
clave secreta, que es lo correcto), guardaba el token **cifrado** en
`metadata._server_metadata.token_encrypted`, y un endpoint interno lo devolvia en
texto claro. Cifrado sigue siendo reversible con la llave: el token existia en la
base en una forma que se podia recuperar.

La salida no es una excepcion declarada en el texto, sino un mecanismo: la
**rotacion** (decision D1).

| # | Cambio | Archivo |
|---|---|---|
| 1 | Tabla `gh_firma_tokens`: un registro por token emitido (huella, emision, expiracion, revocacion, origen). Llave foranea con `ON DELETE CASCADE`: cuando la 5B borra la firma, sus tokens se van con ella. | `src/db/schema/026_tokens_rotacion.sql` |
| 2 | `create()` y `createForCompany()` ya **no guardan** el token cifrado. Se elimina el sub-objeto `_server_metadata` del metadata del cliente. | `src/services/signRequest.js` |
| 3 | `emitirToken()`, `revocarTokens()`, `tokensDe()`, `tokensActivosDe()`, `tokenPerteneceA()`: la rotacion. | `src/services/signRequest.js` |
| 4 | `getByTokenHash()` busca primero en `gh_firma_tokens` (y respeta la revocacion) y despues en la columna legada. | `src/services/signRequest.js` |
| 5 | `POST /internal/sign-requests/:id/link/rotate`: el endpoint nuevo. `GET .../link` queda deprecado (`Deprecation`, `Sunset`, `Link`). | `src/routes/signRequest.js` |
| 6 | `notify-remote` acepta un `token` opcional: si viene, se usa ese enlace y no se gasta un cupo de rotacion; si no, rota. El token se valida contra la solicitud (`409 TOKEN_MISMATCH`). | `src/routes/signRequest.js`, `src/schemas/index.js` |
| 7 | `resend-otp` interno ya no necesita recuperar el token: el nucleo del reenvio se separo (`resendOtpDeSignRequest`). | `src/services/publicFlow.js`, `src/routes/signRequest.js` |
| 8 | La 5B cubre **todos** los tokens de la firma (columna `token_tombstones`, JSON). | `src/services/supresion.js`, `src/db/schema/024_purga_datos.sql` |

### Las tres decisiones que importan

> **Actualizado el 23-oct-2026 (📦933):** el 3.4(c) de la v1.1 exige que cada
> reemision deje sin efecto el token anterior y que no haya mas de un token
> vigente por solicitud. Antes la reemision no revocaba y el tope eran 3 tokens
> vivos.

1. **La reemision invalida siempre el token anterior.** El 3.4(c) de la v1.1 lo
   ordena: cada reemision se registra y deja sin efecto el token anterior. No hay
   mas de un token vigente por solicitud; la reemision no se bloquea, invalida.
2. **La invariante se verifica despues de emitir.** Despues de emitir el token
   nuevo se cuentan los tokens vigentes; si quedara alguno, es un fallo del
   sistema y sale `500 TOKEN_INVARIANTE_ROTA` dentro de la transaccion, sin
   dejar nada escrito.
3. **La invariante se sostiene sin excepciones.** No se declara una excepcion en
   el texto del Acuerdo: el mecanismo (rotacion) cubre la necesidad operativa
   ("la Empresa perdio la respuesta de creacion") sin que el token vuelva a
   existir de forma recuperable. El campo `revocar_anteriores` del cuerpo de
   `POST /internal/sign-requests/:id/link/rotate` quedo **obsoleto**: se sigue
   aceptando para no romper a los clientes que lo manden, pero ya no decide —un
   `false` explicito no evita la revocacion y queda en la auditoria.

### Como se valido

13 tests (`tests/fase8c-rotacion-token.test.js`): el token NO queda guardado de forma
recuperable en la base, MUTACION: el detector de token recuperable muerde, el token
queda registrado como huella en la tabla de tokens, la rotacion emite un token nuevo
y lo devuelve una vez, el token anterior DEJA de funcionar: la reemision lo invalida,
la emision queda auditada (`LINK_ROTATED`), no hay mas de un token vigente por
solicitud (el 3.4(c)), la reemision deja sin efecto el token anterior y emite uno
nuevo, `revocar_anteriores: false` NO evita la revocacion (el 3.4(c)), la respuesta
del endpoint deprecado, la 5B cubriendo el enlace rotado, el `TOKEN_MISMATCH` y el
`notify-remote` que no gasta cupo si el cliente trae su token.

**Suite completa: 1227 tests · 1225 verdes · 0 fallos · 2 omitidos.**

Ademas se actualizaron 6 tests que cambiaron de comportamiento (los del
endpoint deprecado, los del `notify-remote` y los del `resend-otp`), y se
corrigio el flujo de firma dual, que tomaba el token del metadata cifrado para
invitar al representante.

### Lo que esta fase NO hace

- **No purga el `token_encrypted` de las filas anteriores a la 8C.** Es una
  migracion de datos que depende de la Compuerta 0 (si hay solicitudes en vuelo,
  borrarlas rompe a esos clientes). El codigo nuevo ya no lo escribe; el viejo
  sigue legible por el endpoint deprecado hasta que los clientes migren.
- **No cambia el texto legal.** El 3.6(e) ya decia lo que hay que cumplir. Lo que
  la 8C hace es dejar de incumplirlo.
- **No arregla el 8.5 ni el 8.2** (9A), ni el 10.6 textual (11A).

### Lo que esta fase si dejo discovering

1. **El `resend-otp` interno dependia del token cifrado sin necesitarlo.** Solo
   lo usaba para encontrar la solicitud que ya tenía por id. El nucleo del
   reenvio se separo (`resendOtpDeSignRequest`) y el endpoint ya no depende de
   una credencial recuperable.
2. **La 5B necesitaba cubrir todos los tokens.** Con la rotacion, una firma puede
   tener varios enlaces vivos. Si la lapida solo cubriera el original, un
   enlace rotado responderia "no disponible" (404) en vez de "no disponible por
   vencimiento del plazo" (410): dos respuestas para el mismo hecho, segun por
   donde se entrara. La lapida lleva ahora la lista de marcas de todos los
   tokens de la firma.
3. **La invitacion al representante de la firma dual tambien tomaba el token del
   metadata.** Ahora usa el token que esta en memoria en ese instante: existia
   porque se acababa de generar, y en ningun otro momento.

---

## 14. Fase 8B — ejecutada (2026-10-20, `📦917`)

**Estado: implementada, probada y registrada. Sin commit** (el commit lo hace el
carril de código con la palabra del owner).

### Qué cambió

La 8B cierra tres hallazgos del Capítulo X que **no dependían del texto legal**:
el 10.8 (el dato sensible), el 10.2 y 10.3 (que la Empresa solo pueda mandar lo
que el Acuerdo relaciona) y el 10.5(a) (que el número del documento no quede en
texto claro).

| # | Cambio | Archivo |
|---|---|---|
| 1 | Lista blanca de `metadata`: solo 5 claves. Lo demás se **rechaza con 400 nombrando la clave**, no se pierde en silencio. | `src/services/metadata.js`, `src/schemas/index.js` |
| 2 | `signRequestBody` y `representante_legal_snapshot` con `.strict()`. | `src/schemas/index.js` |
| 3 | Migración 027: columnas del 10.8 en la fila de la firma + `gh_consentimientos_sensibles` (sin FK, para que sobreviva a la 5B). | `src/db/schema/027_datos_sensibles.sql` |
| 4 | `clasificar()`, `construirAviso()`, `avisoDe()`: el aviso y su huella quedan **fijados al crear**. | `src/services/sensibles.js` |
| 5 | `exigirConsentimientoSensible()` bloquea el visor y el PDF (`409 SENSIBLE_CONSENT_NOT_ACCEPTED`). | `src/services/publicFlow.js` |
| 6 | `POST /api/sign/:token/consent/sensible`; en la mini-app, el aviso va **antes** del visor y la casilla es **separada**. | `src/routes/public.js`, `web/firma/` |
| 7 | El número del representante se cifra con AES-256-GCM (clave derivada por HKDF, ámbito por empresa, versión de llave en el sobre). | `src/crypto/cifrado.js`, `src/services/representante.js` |
| 8 | `create()` y `createForCompany()` archivan el snapshot con el número cifrado. | `src/services/signRequest.js` |
| 9 | La constancia consolidada muestra los **últimos 4** del representante. | `src/routes/constancia.js`, `src/services/pdfGenConsolidado.js` |
| 10 | Script de re-cifrado de las filas heredadas (simulación por defecto). | `scripts/recifrar-representante.js` |

### Las tres decisiones que importan

1. **La Empresa sube la clasificación, nunca la baja.** El sistema no puede leer
   el PDF para saber si trae datos de salud: escanearlo sería tratar el dato
   sensible **antes** del consentimiento. La inferencia es por **tipo de
   documento**, y la Empresa puede corregir al alza.
2. **Cifrar, no hashear, el número del representante** (corrección del owner al
   §8.1). Su número es **prueba de la representación**: puede necesitarse en
   una constancia o en un certificado de existencia y representación legal, y
   una huella no se puede presentar como prueba. El número queda cifrado con la
   llave del servicio, que vive fuera de la base; de lo que se muestra son los
   últimos 4, como con el firmante.
3. **El 1.2 no se toca.** El bloque «Empresa que solicita tu firma» muestra la
   identificación del representante legal **completa**, pero esa no viene del
   snapshot: viene del **registro mercantil** que la Empresa cargó en
   `gh_firma_empresas`. Lo que se cifra es el snapshot, que es lo que el
   cliente declaró al pedir la firma. El texto legal aprobado manda y no lo
   cambia el código.

### Cómo se validó

51 tests nuevos: 9 de la lista blanca (`tests/fase8b-metadata-lista-blanca.test.js`),
14 del dato sensible (`tests/fase8b-dato-sensible.test.js`), 22 del representante
cifrado (`tests/fase8b-representante-cifrado.test.js`) y 6 del script
(`tests/scripts/recifrar-representante.test.js`), con tests de mutación en los
tres bloques.

**Suite completa: 1278 tests · 1276 verdes · 0 fallos · 2 omitidos.**

### Lo que esta fase NO hace

- **No re-cifra las filas que ya existen.** Es una migración de datos y depende
  de la Compuerta 0. El script existe y está probado (simulación, `--actor` y
  `--motivo` obligatorios, verificación cifra → descifra → compara antes de
  escribir, evento `REPRESENTANTE_RECIFRADO` por fila), pero no se ejecuta.
- **No cambia el texto legal.** El 10.8 y el 10.5(a) ya decían lo que había que
  cumplir. Lo que la 8B hace es dejar de incumplirlo.
- **No arregla el 8.5 ni el 8.2** (9A), ni el 10.6 textual (11A).

### Lo que esta fase sí dejó discovering

1. **La app mandaba `correo_empresa` desde hace meses y zod lo eliminaba en
   silencio.** Nunca llegó a la base, y la constancia salió sin el canal de
   copia del 8.4. Declarar la clave lo arregla; el `.strict()` es lo que
   impide que vuelva a pasar en silencio.
2. **La firma dual no habría funcionado.** El hijo (firma de la Empresa) se
   dispara al final del commit del trabajador, y para entonces el snapshot del
   padre ya está cifrado. Si la huella de identificación se calculara sobre el
   sobre, el representante **no podría identificarse** en la mini-app. El
   código descifra antes de calcular.
3. **El seudónimo del consentimiento del representante.** Se calculaba sobre el
   número en claro; con el snapshot cifrado, se calcularía sobre el sobre y la
   fila guardaría la huella de un valor que no es el número de nadie.
4. **La app manda `correo_empresa: ''` siempre.** El esquema tiene que aceptar
   la cadena vacía; si no, **cada firma del site B caía en 400**.
