# Verificación de cierre — Secciones 3 y 5 (firma electrónica K+AIR)

**Verificado el 12 de noviembre de 2026, 13:40-14:30 (hora de Colombia), contra el repositorio
`SG-SST-E` (rama `Dev`, HEAD `264d08df`) y contra el servidor de producción por SSH en modo de
solo lectura.**

**Qué se verificó y cómo.** (1) Se leyó el cuadro canónico
`sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md`
(secciones 3 y 5) y el texto íntegro de los cinco requisitos. (2) Se contrastó cada uno contra el
código y los documentos del expediente, nunca de memoria. (3) Se midió en el servidor: estado del
servicio, hash del manifiesto en disco, contenido de `config/tabla-conservacion.json`, los dos
gates de `readinessLegal.js` y la distribución de `plazo_conservacion_fuente` en la base de
producción (en modo `ro`). (4) Se hizo un barrido de marcadores de secreto sobre los archivos
versionados del repositorio.

**Lo que NO se hizo (límites respetados).** No se modificó nada del repositorio, del servidor ni de
la base de datos. No se corrió la suite de pruebas del `firma-service`. No se hizo commit ni push.
Las mediciones remotas fueron consultas de solo lectura. **No se leyó ni se imprimió el valor de
ninguna credencial**: del `SMTP_PASS` solo se midieron presencia, permisos y propietario.

**Advertencia previa a la tabla.** El cuadro canónico es del 30-oct-2026 y **su tabla de estados
quedó desactualizada en dos de los cinco requisitos de esta entrega**. El caso más grave es el
5.1: el cuadro afirma que la cuenta remitente "no viaja en los documentos", y hoy **viaja
exactamente en los dos anexos que ya están suscritos y contrafirmados**, con el DNS publicado y
un envío real con `dkim=pass; spf=pass; dmarc=pass`. El caso de 3.2 es el inverso: el cuadro
describe un comportamiento legado (veinte años desde la firma, fuente `catalogo_sistema`) que
**ya no existe en el código**. Todo lo que sigue se afirma con evidencia de hoy.

---

### 3.1 - Se valida jurídicamente la tabla supletoria de conservación - PENDIENTE

**Qué se verificó.** Si la tabla supletoria de conservación está escrita y es de verdad la fuente
única del plazo por defecto, y si existe en el expediente la validación jurídica **escrita** que el
propio archivo declara como condición para abrir su compuerta de activación.

**Evidencia.**
- `sgsst-electron-app/firma-service/config/tabla-conservacion.json:1-12` — el archivo existe y
  lleva su propia compuerta: `estado` = `"PROPUESTA. Los plazos de diez (10) y cinco (5) años NO se
  activan en produccion hasta que el abogado los valide..."` (`:4`), y dentro de `aplicacion`:
  `activada: false` (`:6`), `estado: "PROPUESTA"` (`:7`), `validado_por: null` (`:8`),
  `validado_at: null` (`:9`). La nota del mismo bloque (`:10`) dice, literalmente, que cambiar
  `activada` a `true` "es un acto expreso del owner, con la validacion escrita del abogado sobre
  los plazos de diez (10) y cinco (5) anos: ni el codigo ni una actualizacion automatica lo hacen".
- **La fuente única es real y se verificó en código, no por afirmación.** `src/services/retencion.js:414`
  la declara "fuente ÚNICA", `:469` fija la ruta del archivo, `:518` la carga
  (`tablaConservacion()`), `:560` y `:938` la consultan al calcular cada firma; el respaldo
  congelado en código también arranca cerrado (`:474-487`, con `activada: false` en `:483`). La
  sección 8 del Anexo de Encargo se genera del mismo archivo:
  `scripts/generar-anexo-encargo.js:16` ("`config/tabla-conservacion.json` -> la tabla de
  conservacion (E2)"), `:62` (`CONFIG_TABLA_REL`) y `:664-679` (el generador **falla** si la
  tabla no trae sus categorías). Es decir: el Anexo y el código no pueden desincronizarse en los
  plazos, como afirma el cuadro.
- **Medición SSH del 12-nov-2026 (13:50 h. Colombia)** sobre
  `/opt/kair-firma/app/config/tabla-conservacion.json`: `activada=False`, `estado=PROPUESTA`,
  `validado_por=None`, y `DOCUMENTO_FIRMADO=3650` días. El archivo del servidor es el mismo del
  repositorio (hash idéntico).
- **Lo que sí existe del lado del abogado** es una validación **condicionada**, no la validación
  final que el archivo exige:
  `paquete-abogado-2026-10-30/00-revision-juridica-del-abogado-2026-10-30.txt:125-138` — J8 marca
  la casilla "Validar con condiciones" (`:126`), razona que "Valido 10 y 5 años como topes de
  custodia, no como plazos legales" (`:128`), y en `:132` pone el orden de cuatro pasos y la
  evidencia que exige: "Evidencia: tabla de la Empresa por escrito; pruebas de cómputo desde el
  cese, de la categoría no clasificada, del hold, de la copia pendiente y de la lápida; evidencia
  de purga de respaldos; **confirmación escrita de la alineación del catálogo legado**" (`:138`).
- **Pero el acta interna del owner del 11-nov sigue marcando J8 como PENDIENTE:**
  `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:110` — "Los
  plazos de **diez (10)** y **cinco (5)** años siguen sin validarse:
  `config/tabla-conservacion.json` está en estado `PROPUESTA` y `aplicacion.activada` es `false`,
  así que **no se activan en producción** hasta que el asesor los valide por escrito". La fila T9
  (`:95`) exige verificar `aplicacion.activada` en `false` "hasta completar decisiones y
  evidencias", y el plan del 31-oct lo repite.
- La ratificación externa que el expediente pide sobre J8 sigue abierta:
  `docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md:215-218`
  (J6, J8 y J9 pendientes de ratificación externa).
- **Esto no bloquea la apertura técnica.** El gate `readinessLegal.js` no tiene ningún ítem que
  mida la compuerta: el control del grupo n86 mide el texto y el código del piso de veinte años
  (`src/services/readinessLegal.js:1562-1601`, ítems `codigo_20` en `:1564` y `texto_20` en
  `:1587`), y `_codigoRetencion` (`:508-529`) es un control **textual** sobre `retencion.js`
  (expresiones regulares: `ANIOS_CUSTODIA = 20`, `2.2.4.6.13`, `hold: true`) que **no lee**
  `aplicacion.activada`. Medición SSH del 12-nov con copia consistente de la base (los tres
  archivos `.sqlite`, `-wal` y `-shm`): gate `publicacion` → `listo=true`, 42 ítems, 40 ok, 0
  pendientes, 0 bloqueantes pendientes; gate `primera_firma` → idéntico.

**Qué falta.** (1) La **validación escrita del abogado** sobre los plazos de diez (10) y cinco (5)
años que la propia nota del archivo exige, con la evidencia que el mismo J8 enumera (`:138`): la
tabla de retención documental de la Empresa, las pruebas de cómputo desde el cese, la categoría no
clasificada, el hold, la copia pendiente, la lápida y la purga de respaldos. (2) El **acto expreso
del owner** que pone `aplicacion.activada` en `true` y llena `validado_por` y `validado_at` con
datos reales (hoy los dos son `null`). (3) La **ratificación externa** de J8/J9. Ninguno de los
tres es un desarrollo: son actos y documentos.

**Quién lo tiene.** Owner (el acto expreso sobre la compuerta y la gestión de la validación
externa) y abogado externo (la validación escrita y la ratificación). El equipo solo puede
acompañar con la evidencia técnica ya reunida.

---

### 3.2 - Se aprueban o modifican los plazos generales de 10 y 5 años - PARCIALMENTE

**Qué se verificó.** Si los plazos generales de diez (10) y cinco (5) años están escritos en la
tabla, si el abogado los validó, y si el **orden de cuatro pasos que fijó J8** está cumplido. Y en
particular: si el comportamiento legado de veinte (20) años desde la firma que el cuadro describe
como vigente **sigue existiendo en el código**.

**Evidencia.**
- **Los plazos están escritos y el abogado los validó con condiciones.** En
  `config/tabla-conservacion.json`: `DOCUMENTO_FIRMADO` con `plazo_dias: 3650` y `punto_inicio:
  fecha_firma` (`:17-19`), y las tres categorías de cinco (5) años con `plazo_dias: 1825`
  (`:40-42` registro de operaciones, `:51-53` solicitudes y comunicaciones, `:61-65` lápida y
  recibo). El abogado: "Valido 10 y 5 años como topes de custodia, no como plazos legales"
  (`00-revision-juridica-del-abogado-2026-10-30.txt:128`).
- **El paso (ii) del orden de J8 ya está hecho en el código, y el cuadro canónico describe mal la
  situación.** J8 (`:132`) exigía "alinear el catálogo legado al orden de precedencia del 8.6(a)"
  porque, con la compuerta cerrada, se aplicaban veinte (20) años desde la firma a todo, con
  fuente `catalogo_sistema`. Hoy:
  - Búsqueda de `catalogo_sistema` en todo `firma-service/src/`: **0 coincidencias**. El catálogo
    legado de veinte años **ya no existe en el código**.
  - `src/services/retencion.js:1021-1026` — la rama de compuerta cerrada dice literalmente: "La
    tabla supletoria no está activada. Se conserva temporalmente con fecha de supresión nula; **no
    se inventa el fallback histórico de 20 años desde la firma** ni se adelanta la tabla pendiente
    de aprobación", y fija `fuente = 'tabla_supletoria_pendiente'`.
  - El orden de precedencia que J8 pedía está implementado en `retencion.js:963-1008`: (b) piso
    legal → (c) plazo declarado por la Empresa → (d) tabla supletoria; el piso de veinte años del
    SG-SST se cuenta desde el cese (`:986-997`), y el registro sin categoría clasificable queda
    retenido, no con plazo por defecto.
  - **Medición SSH del 12-nov-2026** sobre `/opt/kair-firma/data/firma.sqlite` (sqlite3 en modo
    `ro`): distribución de `plazo_conservacion_fuente` en `gh_firmas_electronicas` =
    `[(None, 4), ('tabla_supletoria_pendiente', 1)]`. **Cero filas con `catalogo_sistema`**: en
    producción no se aplicó nunca el comportamiento que el cuadro describe.
  - Residuo de texto: el comentario de `retencion.js:949-951` todavía afirma que en el camino de
    compuerta cerrada "el plazo corre desde la firma (que es lo que hace el catálogo)", frase que el
    propio `:1023` contradice. Es un comentario, no comportamiento, pero es lo que llevó a escribir
    el texto del cuadro.
- **Consecuencia documental:** las afirmaciones del cuadro en
  `respuesta-checklist-cierre-2026-10-30.md:902-905` ("Con la compuerta cerrada, el comportamiento
  legado aplica veinte (20) años desde la firma para categorías generales, con la fuente
  `catalogo_sistema`") y `:976` (el paso (ii) "pendiente") **hoy son falsas**. El 3.6 del mismo
  cuadro repite la misma premisa.
- **Lo que falta del orden de J8:** el paso (iii), reejecutar las pruebas (requisito 6.11), no
  está acreditado en el expediente —en esta verificación no se corrió la suite del `firma-service`,
  por límite de alcance—; y el paso (iv), abrir la compuerta con validación escrita, está
  incumplido por lo que dice 3.1.

**Qué falta.** (1) La **aprobación** de los plazos: el J8 del acta del 11-nov sigue PENDIENTE
(`11-checklist-definitivo...:110`), la compuerta está apagada y no hay acto del owner ni
validación escrita del abogado. (2) La **reejecución de las pruebas** del 6.11 después del cambio
del código de retención, con su registro. (3) La **apertura de la compuerta** con
`validado_por` y `validado_at` reales, que es el paso (iv) y el único que puede hacer que los
plazos 10/5 apliquen. (4) **Corregir el texto del cuadro canónico** (3.2 y 3.6), que describe un
comportamiento que el código ya no tiene: si alguien lo usa como mapa, va a buscar un catálogo
que no existe.

**Quién lo tiene.** Owner (la decisión y el acto de apertura) y abogado externo (la validación
escrita). El equipo, para la reejecución de las pruebas y para corregir el cuadro.

---

### 5.1 - Se identifica la cuenta remitente real - CERRADO

**Qué se verificó.** Cuál es la cuenta remitente real del canal transaccional, si está identificada
en el expediente, si es la que el código y el servidor usan, y si su dominio tiene lo publicado
para que un correo de ella sea autenticable por el receptor.

**Evidencia.**
- **La cuenta es `kair@gesstiar.com`** (Google Workspace), y está escrita en cuatro lugares que
  hoy gobiernan la relación:
  - `sgsst-electron-app/firma-service/legal-readiness.json:204-212` — bloque `canales.transaccional`:
    `cuenta: "kair@gesstiar.com"` (`:206`), `proveedor: "Google Workspace (Gmail),
    smtp.gmail.com:587 con STARTTLS"` (`:207`), `rol: "subencargado"` (`:208`), `estado: "migrado"`
    (`:210`), y la nota (`:211`) que declara P2, P4 y P5 cerrados el 10-nov y deja P11 y P3
    abiertos.
  - `sgsst-electron-app/legal/anexo-nube-v1.3.html:50-54` (el resumen del Anexo), `:159-171`
    (el §3: "el canal de correo del servicio es una **cuenta empresarial de Google Workspace**,
    la `kair@gesstiar.com`"), `:543-549` y `:594-597` ("Remitente declarado para este canal:
    `kair@gesstiar.com`, con el nombre «K+AIR Firma Electrónica»").
  - `sgsst-electron-app/legal/anexo-encargo.html:539-543` (el paso (vi) del §5: "la cuenta
    empresarial está activa... comprobada con un envío real desde `kair@gesstiar.com`, con su
    Message-ID y su `Authentication-Results`").
  - `docs/gestion-humana/firma-electronica/decision-regularizacion-correo-2026-11-09.md:31-34`
    (tabla de estado medido al 10-nov: P2, P4 y P5 cerrados con su evidencia).
- **El manifiesto en el servidor es el mismo del repositorio.** Medición SSH del 12-nov:
  `sha256sum /opt/kair-firma/app/legal-readiness.json` =
  `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`, idéntico al hash local del
  `legal-readiness.json`. En ese manifiesto, `mail_provider.cuenta` = `workspace`, `rol` =
  `subencargado`, `dpa` = `true`, `aceptacion.aceptada` = `true`, `aceptacion.fecha` = `2026-11-10`
  (`legal-readiness.json:70-107`, con la evidencia de la captura en `:86-106`).
- **El código la usa y la publica.** `src/config.js:72-80` lee `SMTP_HOST`, `SMTP_PORT` (587 por
  defecto), `SMTP_SECURE` (`false`, es decir STARTTLS), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`
  y `SMTP_FROM_EMAIL`; `src/services/mailer.js:36` obliga a `requireTLS: true`, de modo que el
  canal no puede degradar a texto claro.
- **El dominio tiene lo publicado y medido desde este equipo (12-nov):** MX de `gesstiar.com` →
  `smtp.google.com`; SPF `v=spf1 include:_spf.google.com ~all`; DKIM `google._domainkey` presente;
  DMARC `v=DMARC1; p=none; rua=mailto:kair@gesstiar.com`.
- **El envío real está probado:** `anexo-nube-v1.3.html:603-606` — remitente `kair@gesstiar.com`,
  `Message-ID <5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` y
  `Authentication-Results: dkim=pass; spf=pass; dmarc=pass`. Y hay envíos reales del 12-nov con la
  credencial nueva: eventos `CODIGO_ENVIADO` (15:38:09 y 15:39:11) y `CONTRAFIRMA_CODIGO_ENVIADO`
  (15:40:32 y 16:12:54) en la base de producción.
- **Medición SSH del 12-nov:** la tabla `gh_firma_empresas_cuenta_envio` tiene **0 filas**; es decir,
  ninguna Empresa ha configurado cuenta propia de envío, y el remitente efectivo de todo el
  servicio es hoy el de K+AIR.
- **Contraste con el cuadro:** `respuesta-checklist-cierre-2026-10-30.md:1117-1121` afirma que la
  cuenta "vive como variable de entorno en el servidor", que "no está en el repositorio ni en
  ninguno de los nueve adjuntos, y no debe ir". **Hoy esa afirmación es falsa**: la cuenta está en
  el manifiesto, en el Anexo de Nube v1.3 y en el Anexo de Encargo, los dos ya suscritos y
  contrafirmados por ASEPLUS CARIBE S.A.S. el 12-nov. Lo que el cuadro quería preservar —que el
  **secreto** no viaje— sí se respeta (ver 5.6).

**Qué falta.** Nada para este requisito: la cuenta remitente real está identificada, documentada
en los instrumentos que la gobiernan, publicada en DNS y verificada con un envío real. Dos
precisiones que **no** son de este requisito, para que no se lea mal: (a) el remitente efectivo de
hoy es el de K+AIR para todos, porque `gh_firma_empresas_cuenta_envio` está vacía; (b) sigue
abierto **P3** (los alias `privacidad@`, `soporte@` e `incidentes@` de `gesstiar.com` no existen:
la medición DNS del 12-nov devuelve NXDOMAIN para `privacidad.gesstiar.com`,
`soporte.gesstiar.com` e `incidentes.gesstiar.com`), con excepción documentada en
`legal-readiness.json:213-232` y en `src/config.js:103-111` y `:127-135`. P3 afecta los canales de
derechos, PQRS e incidentes, no el remitente transaccional.

**Quién lo tiene.** Nadie (cierre del owner). La evidencia es pública y verificable; lo que queda
abierto (P3) es del owner, pero no es de este requisito.

---

### 5.5 - Se acredita la activación de MFA - PENDIENTE

**Qué se verificó.** Si existe **evidencia primaria** (captura de consola y/o acta) de que la
cuenta de salida `kair@gesstiar.com` tiene la verificación en dos pasos activada, y si los
instrumentos suscritos son coherentes entre sí sobre ese punto.

**Evidencia.**
- **No hay evidencia primaria para el MFA.** El expediente tiene captura y acta **solo** para el
  CDPA: `sgsst-electron-app/firma-service/scripts/fixtures/captura-consola-cdpa-i-accept-2026-11-10.png`
  y `.../scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json`, referenciadas en
  `legal-readiness.json:86-106`. Para el 2SV no hay captura ni acta: lo que hay es la **declaración
  del owner recogida en los documentos**, a partir de
  `decision-regularizacion-correo-2026-11-09.md:31` ("P2 | ✅ Cerrado | `kair@gesstiar.com` activa,
  con verificación en dos pasos y autenticación por app password").
- **El Anexo de Nube v1.3 se contradice a sí mismo, y la contradicción está en el instrumento
  firmado.** El §1 (`anexo-nube-v1.3.html:96-109`) declara, entre los pendientes que "no están
  cumplidos", que los demás "están cumplidos y este Anexo los declara con su evidencia", y en
  `:103-104` afirma que "**P2**, `kair@gesstiar.com` está activa, con verificación en dos pasos y
  autenticación por app password". Pero la ficha técnica del §5, en el mismo archivo, dice lo
  contrario:
  - `:635-646` (fila **MFA**): "Estado de la verificación en dos pasos de la cuenta de correo de
    salida: **pendiente de verificación por el owner (P2)**... su estado de verificación en dos
    pasos **no está verificado**: no se afirma ni que esté activa ni que no lo esté".
  - `:547-549` (cuerpo del §5): "El método de autenticación (contraseña de aplicación u OAuth2) y la
    **habilitación de la verificación en dos pasos de esa cuenta están pendientes de verificación
    por el owner (P2)**".
- **La evidencia que el propio §1 promete no existe:** el §1 dice que "P2" está cerrado "con su
  evidencia", y remite a la ficha técnica del §5; la ficha técnica en la fila de MFA dice que no hay
  verificación. La promesa de evidencia no tiene a qué fila apuntar.
- **El parcheo de los textos firmados no tocó esas filas.**
  `sgsst-electron-app/firma-service/scripts/corregir-anexo-nube-v1.3.js` (22 bloques de parche)
  intervino los bloques de estado (`:126`, `:145`, `:163`), pero **ninguno** toca la fila de MFA ni
  la de contraseña de aplicación de la ficha técnica del §5. El resultado es que el Anexo que
  ASEPLUS firmó el 12-nov dice, en dos lugares del mismo documento, que el MFA está cerrado y en
  otro que no está verificado.
- Lo que el propio expediente ya sabía: la fila **T5** del acta del 31-oct
  (`11-checklist-definitivo-revision-juridica-y-cierre.md:91`) ya había dejado uno de los cuatro
  puntos abiertos de la ficha del canal: "la fecha de generación de la contraseña de aplicación".
  Y la fila **J6/J8/J9** sigue pidiendo ratificación externa.

**Qué falta.** (1) La **evidencia primaria del 2SV**: una captura de la consola de Workspace
(Cuenta → Seguridad → Verificación en dos pasos) con su hash, y el acta que la registre, con el
mismo formato que la del CDPA (`aceptacion-cdpa-p1-2026-11-10.json` +
`captura-consola-cdpa-i-accept-2026-11-10.png`). Sin eso, el MFA está declarado, no acreditado.
(2) **Una versión nueva del Anexo de Nube** (v1.4) que corrija las dos filas que hoy contradicen
al §1: el Anexo v1.3 **ya está suscrito y contrafirmado** y un texto suscrito no se toca; eso
arrastra versión nueva del Anexo de Encargo y actualización del manifiesto con las huellas
nuevas. (3) La ratificación externa que el expediente pide para J6/J8/J9.

**Quién lo tiene.** Owner (captura y acta de la consola de Workspace; es un acto suyo, la
consola no es accesible al servicio) y equipo (redacción de la v1.4 del Anexo y su regeneration).

---

### 5.6 - Se acredita el uso de contraseña de aplicación, sin incorporarla a los documentos ni al repositorio - PARCIALMENTE

**Qué se verificó.** Dos cosas por separado: (a) que el **método de autenticación** por contraseña
de aplicación esté acreditado, y (b) que el **secreto no esté** en los documentos ni en el
repositorio. La segunda es una obligación de no hacer; la primera, una de acreditar.

**Evidencia.**
- **El secreto no está en ninguna parte: verificado.**
  - Barrido con el detector del propio repo
    (`sgsst-electron-app/main/detector-secretos.js`, `escanear()` sobre los archivos versionados):
    **3891 archivos leídos, 0 hallazgos**.
  - Medición SSH del 12-nov sobre `/opt/kair-firma/.env`: permisos `-rw-------` y propietario
    `root root` — el usuario de servicio no lo puede leer. Se midió **presencia y longitud** de
    `SMTP_PASS`; **su valor no fue leído ni impreso en ningún momento**, ni en los comandos, ni en
    los logs, ni en este documento.
  - Los dos anexos lo dicen y lo cumplen: `anexo-nube-v1.3.html:614-616` ("Las credenciales no se
    documentan en este Anexo ni en ningún documento del expediente") y `:621-622` ("El secreto no
    se documenta en este Anexo ni en ningún documento del expediente: vive únicamente en el archivo
    de entorno del servidor").
- **El método está declarado, pero en el instrumento firmado se contradice.**
  - `decision-regularizacion-correo-2026-11-09.md:31` — "autenticación por app password
    (`kair-firma-smtp`, creada el 10-nov-2026)".
  - `anexo-nube-v1.3.html:101-104` — "**P2**, `kair@gesstiar.com` está activa, con verificación en
    dos pasos y **autenticación por app password**"; y `:164-165` — "la cuenta está activa, con
    verificación en dos pasos, y hay un envío real con ese remitente".
  - Pero la fila **Contraseña de aplicación** de la ficha técnica del §5
    (`anexo-nube-v1.3.html:613-632`) sigue diciendo: "El método de autenticación **está pendiente de
    decisión y de verificación por el owner (P2)**: si la consola de Workspace tiene habilitadas
    las app passwords y la cuenta tiene verificación en dos pasos, la credencial es una app
    password; si no, la opción es OAuth2, que exige cambio en el código del servicio y variables
    nuevas".
- **La fecha de generación sí consta en el expediente, y el Anexo firmado afirma lo contrario.**
  `anexo-nube-v1.3.html:623-625` dice que "La fecha de generación de la credencial vigente **no
  consta**" y que "el proveedor de correo no expone la fecha de creación de una app password y el
  expediente no la registra". Pero `decision-regularizacion-correo-2026-11-09.md:31` **sí** la
  registra: "creada el 10-nov-2026". La afirmación del Anexo v1.3 es anterior al dato y no se
  actualizó.
- **Faltan el procedimiento de rotación y la revocación de la credencial anterior.**
  `anexo-nube-v1.3.html:628-629` — "Procedimiento y periodicidad de rotación: **aún no hay
  procedimiento definido**, y el owner lo declara pendiente el 31-oct-2026"; y P6/P11 — revocar las
  app passwords de la cuenta de correo anterior (`anexo-nube-v1.3.html:99-101`, `:627-628`;
  `decision-regularizacion-correo-2026-11-09.md:381`;
  `11-checklist-definitivo-revision-juridica-y-cierre.md:119`, fila **P11**: "**PENDIENTE**, y no
  bloquea la firma. Revocar las app passwords de la cuenta de correo anterior del Encargado y
  verificar que no queda ninguna en el archivo de entorno del servidor").
- **Lo que sí se verificó del lado del servidor:** la credencial instalada es la de la cuenta nueva
  (el `.env` tiene `SMTP_PASS` y el servicio está `active`, `NRestarts=0`, activo desde
   2026-11-12 09:30:23 -05) y hubo envíos reales el 12-nov con ella. La **ausencia de
  `gh_firma_empresas_cuenta_envio`** (0 filas) confirma que no hay una segunda credencial de envío
  configurada por Empresa.

**Qué falta.** (1) **Una versión nueva del Anexo de Nube** que alinee las tres afirmaciones que
hoy se contradicen (el §1 da P2 por cerrado; la ficha técnica lo da por pendiente; y la fecha de
generación que el Anexo declara inexistente y el expediente sí tiene) — el texto está suscrito y
no se toca. (2) **El procedimiento de rotación** de la credencial, con su periodicidad, que el
propio Anexo declara inexistente y que el acta del 31-oct ya listaba como pendiente (fila T5).
(3) **P6/P11**: revocar las app passwords de la cuenta anterior (`adminkair@gmail.com`) y
verificar que no queda ninguna en el `.env` del servidor. (4) La **evidencia primaria** del 2SV que
la app password presupone (misma acta y captura que en 5.5), porque la contraseña de aplicación
solo existe si el 2SV está activo.

**Quién lo tiene.** Owner (la revocación en la consola y el procedimiento de rotación), equipo
(redacción de la v1.4 del Anexo de Nube y del Anexo de Encargo que la remite, con huellas nuevas en
el manifiesto). Ningún trabajo de código: el secreto está y debe seguir en el servidor.

---

## Resumen de los cinco requisitos

| ID | Estado | Qué falta en una línea |
|---|---|---|
| 3.1 | PENDIENTE | La validación escrita del abogado sobre los plazos 10/5 que la propia tabla exige, y el acto expreso del owner que abra la compuerta (`validado_por` y `validado_at` siguen en `null`). |
| 3.2 | PARCIALMENTE | Los plazos están escritos y el paso (ii) de J8 ya está hecho en código (el catálogo `catalogo_sistema` no existe): faltan la aprobación, la reejecución de pruebas (6.11), la apertura de la compuerta y corregir el texto del cuadro, que describe un comportamiento retirado. |
| 5.1 | CERRADO | Nada: `kair@gesstiar.com` está identificada en el manifiesto y en los dos anexos suscritos, con DNS publicado y un envío real con `dkim=pass; spf=pass; dmarc=pass`. |
| 5.5 | PENDIENTE | La captura y el acta de la verificación en dos pasos (hoy solo hay declaración del owner), y una versión nueva del Anexo de Nube que resuelva la contradicción interna entre el §1 y la ficha del §5. |
| 5.6 | PARCIALMENTE | El secreto no está en el repo ni en los documentos (verificado, 0 hallazgos): faltan la acreditación primaria del método, el procedimiento de rotación, P6/P11 (revocar la credencial anterior) y el Anexo v1.4 que alinee las filas contradictorias. |

**Conteo:** 1 CERRADO, 2 PARCIALMENTE, 2 PENDIENTE. Ninguno de los cinco es «No aplica».

## Conclusión de la sección

**Lo que cambia respecto del cuadro canónico, en dos de los cinco requisitos.** El 5.1 estaba
listado como pendiente «es del owner y no viaja en los documentos» y **hoy está cerrado**: la
cuenta remitente real es `kair@gesstiar.com`, está escrita en el manifiesto de producción y en los
**dos anexos que ya están suscritos y contrafirmados**, tiene SPF, DKIM y DMARC publicados, y hay
un envío real con `dkim=pass; spf=pass; dmarc=pass` y con el Message-ID `@gesstiar.com`; además
hubo envíos reales el 12-nov con la credencial nueva. El cuadro canónico, al decir que la cuenta
«no debe viajar en los documentos», mezcló dos cosas: la **cuenta** (que sí puede y debe viajar,
es la identidad del canal) y el **secreto** (que no debe viajar en ninguna parte, y no viaja). El
5.1 se cierra; el 5.6 es el que guarda el secreto, y su mitad de «no incorporarla» está cumplida y
verificada.

**El 3.2 está en el mismo caso, pero al revés: el cuadro describe un código que ya no existe.**
El texto afirma que con la compuerta cerrada se aplican veinte (20) años desde la firma con fuente
`catalogo_sistema`. Hoy ese identificador tiene **cero coincidencias** en `firma-service/src/`, la
rama de compuerta cerrada dice literalmente que «no se inventa el fallback histórico de 20 años
desde la firma», el orden de precedencia que J8 exigía está implementado, y la base de producción
no tiene **ninguna** firma con esa fuente. El paso (ii) del orden de J8 está hecho; lo que falta
es el acto (aprobación, pruebas, apertura de la compuerta) y **corregir el cuadro**, que hoy manda
a buscar un catálogo inexistente.

**Lo que de verdad bloquea, y lo que no.** Ninguno de los cinco requisitos bloquea la apertura
técnica: los dos gates (`publicacion` y `primera_firma`) miden `listo=true` con **0
bloqueantes pendientes** sobre 42 ítems, y el gate **no tiene ningún ítem que mida la compuerta de
conservación** (su control del grupo n86 es textual sobre `retencion.js` y no lee
`aplicacion.activada`). Los dos pendientes de esta sección son **deuda jurídica y documental**, no
un hueco de código. En concreto: (a) 3.1 y 3.2 son un acto del owner (abrir la compuerta) más
una validación escrita del abogado que **nadie ha firmado todavía** — la fila J8 del acta del
11-nov sigue en PENDIENTE, y la ratificación externa de J6/J8/J9 que pide el dictamen de
erratas está abierta; (b) 5.5 y 5.6 son un acto del owner en la consola de Google (captura del
2SV, revocación de las app passwords de la cuenta anterior, procedimiento de rotación) más un
problema **de texto**: el Anexo de Nube v1.3, ya suscrito el 12-nov, se contradice a sí mismo en
su §1 y en su ficha técnica del §5 sobre el MFA y sobre el método de autenticación, y su afirmación
de que «la fecha de generación de la credencial no consta» quedó desactualizada por el registro del
expediente del 10-nov. Como un texto suscrito no se toca, la vía es una **versión nueva** (Anexo
de Nube v1.4 y la versión del Encargo que la remite), con huella propia, firma de nuevo y manifiesto
al día.

**Un dato de contexto que condiciona el reloj:** el Anexo de Nube v1.3 se firmó el 12-nov con una
contradicción dentro. Es el mismo mecanismo que ya se corrigió una vez (J14 y la errata del
11-nov), pero esta vez el arreglo llega **después** de la firma, no antes: por eso el 5.5 y el 5.6
no se cierran con una captura, sino con una versión nueva del instrumento.
---

*Verificación realizada el 12-nov-2026 por el worker de las secciones 3 y 5. Todas las
mediciones remotas fueron de solo lectura; no se leyó ni se imprimió el valor de ninguna
credencial. No se modificó ningún archivo del repositorio, del servidor ni de la base de
datos; este es el único archivo escrito.*
