# Verificacion de cierre — Secciones 1 y 2 (firma electronica K+AIR)

**Verificado el 12 de noviembre de 2026, 13:30-13:40 (hora de Colombia), contra el repositorio
`SG-SST-E` (rama `Dev`, HEAD `264d08df`) y contra el servidor de produccion por SSH en modo de
solo lectura.**

**Que se verifico y como.** (1) Se leyo el cuadro canonico
`sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md`
(secciones 1 y 2) y el texto integro de cada requisito. (2) Se contrasto cada uno contra el codigo y
los documentos del expediente, nunca de memoria. (3) Se midio en el servidor: hash del manifiesto en
disco, filas de `gh_firma_acuerdo_versiones`, `gh_firma_aprobaciones_publicacion`,
`gh_firma_anexo_nube_suscripciones`, `gh_firma_anexo_encargo_suscripciones` y
`gh_firma_empresas`, y los dos gates de `readinessLegal.js`. (4) Se hizo un barrido de marcadores
sobre los cuatro textos que hoy gobiernan la relacion (Acuerdo v1.6, Anexo de Nube v1.3, Anexo de
Encargo 2026-11-11 y Constancia v1.6).

**Lo que NO se hizo (limites respetados).** No se modifico nada del repositorio, del servidor ni de
la base de datos. No se corrio la suite de pruebas del firma-service. No se hizo commit ni push. Las
mediciones remotas fueron consultas de solo lectura (`sqlite3` en modo `ro` y scripts de medicion ya
existentes en el servidor que abren la base con `readonly: true`).

**Advertencia previa a la tabla.** El cuadro canonico es del 30-oct-2026 y su tabla de estados quedo
desactualizada: **9 de los 10 requisitos de esta seccion ya no estan como estaban**. El cambio mayor
es que el 11-nov se publico el Acuerdo **v1.6** (sustituye a la v1.4 que el cuadro menciona) y el
12-nov se ejecuto en produccion el P8 (suscripcion y contrafirma de los dos anexos vigentes por
ASEPLUS CARIBE S.A.S.). Todo lo que sigue se afirma con evidencia de hoy.

---

### 1.2 - Resolver la discrepancia entre la copia recibida y el manifiesto anterior — PENDIENTE

**Que se verifico.** Se busco en todo el expediente de la firma cualquier registro de la medicion de
la copia fisica del Acuerdo que el owner recibio en la ronda del 30-oct (tamano en bytes y SHA-256).
Se comparo con el texto vigente de hoy.

**Evidencia.** `sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md:279-298`
— el requisito ofrece cuatro casos (71 555 B = v1.3, 72 132 B = conversion a CRLF, 57 187 B = v1.1,
69 748 B = v1.2, 73 208 B = v1.4) y pide al owner el tamano y el hash de su copia. Una busqueda de
`copia recibida|72 132|57 187|69 748|discrepancia entre la copia` en
`sgsst-electron-app/docs/gestion-humana/firma-electronica/` **solo devuelve el propio cuadro y su
copia en el paquete (`paquete-abogado-2026-10-30/09-respuesta-al-checklist-de-cierre.md:279`)**: no
hay ninguna medicion registrada. El texto vigente de hoy es otro:
`sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt` (75 961 B, SHA-256
`08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e`), de modo que **ninguna de las
cuatro cifras del cuadro corresponde hoy al texto vigente**.

**Que falta.** Que el owner mida la copia que tiene en la mano y mande **bytes + SHA-256**; con eso
la pregunta se cierra en un paso. Sin esa medicion, la discrepancia de aquella ronda no queda
explicada en el expediente. Opcionalmente conviene registrar que el caso ya es historico: el
Acuerdo vigente es la v1.6 y el manifiesto declara esa huella
(`sgsst-electron-app/firma-service/legal-readiness.json:7-10`).

**Quien lo tiene.** Owner (medir y enviar la cifra). No requiere codigo.

---

### 1.7 - Identificar la version y documentar la decision del owner — CERRADO

**Que se verifico.** La identificacion de la version (que texto se somete y con que huella) y el
registro de la decision del owner (acta interna, Constancia de version y autorizacion, y el registro
append-only de aprobaciones de publicacion en la base de produccion).

**Evidencia.**
- `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:59-76` — la Constancia identifica la
  **v1.6**, su SHA-256 `08e1eb8b...`, el responsable del registro (Javier Robles Fontalvo,
  Representante Legal de Gesstiar S.A.S.) y la fecha **2026-11-11**.
- `sgsst-electron-app/firma-service/legal-readiness.json:15-18` — bloque `constancia`: v1.6, huella
  `aaf68b4e...`, `estado: "no_firmada"`.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103`
  (fila **J1**: «RESUELTO, con cambio de version») y `:115` (fila **J13**: «RESUELTO»).
- Medicion SSH del 12-nov-2026 (13:34 h. Colombia), tabla `gh_firma_aprobaciones_publicacion`:
  **4 filas**, y la id 4 es `v1.6` / `08e1eb8b...` / tipo `OPERATIVA` / «Javier Robles Fontalvo,
  owner de K+AIR» / fecha `2026-11-11`. La tabla es **append-only** (disparadores `no_update` y
  `no_delete` en el esquema), o sea el registro no se puede reescribir.

**Que falta.** Nada: queda cerrado. Dos precisiones para que no se lea mal: (a) las secciones 5 y 6
de la Constancia **siguen vacias por diseno** — la autorizacion operativa vive en
`gh_firma_aprobaciones_publicacion`, no en el documento (misma practica que la Constancia de la
v1.4); (b) esto **no es** aprobacion juridica del abogado: el expediente lo dice de forma expresa en
la Constancia y en el propio encabezado del acta (`:99`).

**Quien lo tiene.** Nadie (cierre del owner). Lo que sigue abierto en el expediente es la ratificacion
externa del abogado, que ya no es de este requisito.

---

### 1.9 - Confirmar que no quedan marcadores de borrador, campos juridicos sin resolver ni textos contradictorios — PARCIALMENTE

**Que se verifico.** Barrido de marcadores (TODO, TBD, FIXME, XXX, PLACEHOLDER, `[PENDIENTE]`,
`[nombre`, `[fecha`, `[...]`) sobre los cuatro textos que hoy gobiernan la relacion; lectura de los
bloques de pendientes de los dos anexos vigentes; y contraste de cada afirmacion de estado del texto
contra la base de produccion y el manifiesto.

**Evidencia.**
- Barrido de hoy sobre los cuatro archivos: **cero marcadores de borrador**. Los unicos aciertos del
  filtro fueron la palabra legal «todo/todos» y la palabra «M&Eacute;TODO DE FIRMA ELECTR&Oacute;NICA
  PACTADO» (Acuerdo v1.6, lineas 75 y 77). La Constancia v1.6 no tiene ni una coincidencia.
- `sgsst-electron-app/legal/anexo-nube-v1.3.html:133-136` — los tres campos `[nombre de la Empresa]`,
  `[NIT de la Empresa]`, `[representante legal de la Empresa]` son **de diligenciamiento por cada
  Empresa** en la copia que firma (el propio texto lo dice), no marcadores sin resolver.
- **Pero hay afirmaciones del texto vigente que hoy son falsas.** `anexo-nube-v1.3.html:809` («su
  suscripcion por ASEPLUS CARIBE S.A.S. es un acto pendiente del owner (P8)») y `:844-846` («Los dos
  actos de esta version 1.3 estan pendientes»); `sgsst-electron-app/legal/anexo-encargo.html:535-536`
  (paso «(ix) la suscripcion de esta version 2026-11-11 ... y su contrafirma») y `:572-574` («esa
  version 1.3 no esta todavia suscrito ni contrafirmado»). La base dice lo contrario: suscripcion
  Nube v1.3 FIRMADA el `2026-11-12T15:38:27.990Z` y contrafirmada el `16:13:54.106Z`; Encargo
  2026-11-11 FIRMADA el `15:40:06.992Z` y contrafirmado el `16:14:31.105Z` (medicion SSH del 12-nov).
- **Y el Anexo de Nube se contradice consigo mismo:** su lead-in de la ficha tecnica
  (`anexo-nube-v1.3.html:565-568`) dice que «los apartados que dependen del estado de la cuenta de
  Google Workspace y de la credencial del servidor ya estan verificados (P2 y P5, cerrados el 10 de
  noviembre de 2026)» y que «los que siguen pendientes se declaran como tales (P6)», pero las filas
  de esa misma ficha dicen «El metodo de autenticacion esta pendiente de decision y de verificacion
  por el owner (P2)» (`:617-618`) y «Estado de la verificacion en dos pasos de la cuenta de correo de
  salida: pendiente de verificacion por el owner (P2) ... no esta verificado» (`:636-640`).
- Documental divergente en el expediente:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/tabla-instrumentos-vigentes-2026-11-09.md:28`
  y `:32` siguen diciendo «**NO suscrito**» para el Anexo de Nube v1.3 y el Anexo de Encargo
  2026-11-11, mientras la fila P8 de esa misma tabla (corregida en el commit `91214c55`) y la base
  dicen que los dos quedaron suscritos y contrafirmados el 12-nov.

**Que falta.** (1) Una **version nueva** de los dos anexos que corrija las afirmaciones caducadas
(«los dos actos estan pendientes», «P2 pendiente de verificacion»): la v1.4 del Anexo de Nube y una
version nueva del Anexo de Encargo. **Un texto ya suscrito no se toca** (regla que el propio
proyecto aplico el 11-nov con la errata: el control de alteracion es posterior a la firma, D. 1074
art. 2.2.2.47.4 num. 2), asi que la via correcta es version nueva con huella propia y firma de
nuevo. (2) Corregir las filas §1 de `tabla-instrumentos-vigentes-2026-11-09.md`, que hoy contradicen
la base. (3) No queda ningun marcador de borrador ni campo juridico sin resolver de fondo: lo que
queda son afirmaciones de estado que quedaron viejas.

**Quien lo tiene.** Equipo (los scripts que generan los textos:
`scripts/corregir-anexo-nube-v1.3.js` y `scripts/corregir-anexo-encargo-2026-11-11.js` son los
duenos del texto) y owner (autorizar la version nueva y volver a suscribir/contrafirmar).

---

### 2.1 - El owner decide si adopta el Acuerdo v1.4 — CERRADO

**Que se verifico.** Si la version que hoy esta aprobada es la que el cuadro evaluo, si quedo
publicada y si existe la autorizacion operativa que la exige la compuerta.

**Evidencia.**
- La v1.4 quedo **historica**: la version vigente es la **v1.6** (`sgsst-electron-app/firma-service/
  legal-readiness.json:7-10`; `scripts/fixtures/acuerdo-v1.6.txt`, 75 961 B, `08e1eb8b...`), publicada
  el 11-nov-2026 con `publicado: true`.
- `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103` — fila **J1**:
  el owner aprueba la v1.6 y deja la v1.3, la v1.4 y la v1.5 como historico sin publicar.
- Medicion SSH del 12-nov-2026 (13:34 h. Colombia), tabla `gh_firma_acuerdo_versiones`:
  `v1.6` = **activa** (hash `08e1eb8b...`, `fecha_vigencia_inicio` `2026-11-11T19:51:42.036Z`,
  `creado_por` «Javier Robles Fontalvo, owner de K+AIR»); `v1.5`, `v1.4` y `v1.0` = inactivas. En
  `gh_firma_aprobaciones_publicacion`, la id 4 es la autorizacion operativa de la v1.6 (11-nov-2026).
- Gate `publicacion` medido hoy: **`listo: true`**, 42 items, 40 `ok`, **0 bloqueantes pendientes**,
  1 `aviso` (`empresas_nube`), 1 `no_aplica` (`google_dpa`).

**Que falta.** Nada: queda cerrado. La adopcion esta hecha, publicada y con su autorizacion operativa
registrada (que es lo que el sistema exige para activar una version).

**Quien lo tiene.** Nadie.

---

### 2.2 - El owner decide si adopta el Anexo de Encargo — CERRADO

**Que se verifico.** Si existe la decision del owner, y si el instrumento quedo adoptado de verdad:
suscrito por la Empresa y contrafirmado por K+AIR, sobre el texto vigente.

**Evidencia.**
- `sgsst-electron-app/firma-service/legal-readiness.json:115-116` — `anexo_encargo.estado:
  "firmado"`, `fecha: "2026-11-12T16:14:31.105Z"`; `:128-129` — `version: "2026-11-11"`, hash
  `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948`.
- Medicion SSH del 12-nov-2026: `gh_firma_anexo_encargo_suscripciones` **id 2** = `900829731`,
  version `2026-11-11`, hash `6308b1f7...` (identico al hash del archivo medido hoy),
  `estado FIRMADA`, `firmado_at 2026-11-12T15:40:06.992Z`, `contrafirmado_at
  2026-11-12T16:14:31.105Z`; ficha de la empresa `anexo_encargo_firmado_at = 2026-11-12T16:14:31.105Z`.
  La suscripcion vieja (id 1, version 2026-11-06) queda **intacta**, como exige el expediente.
- `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:114` — fila
  **J12** con las tres versiones y la ejecucion del 12-nov.
- La suscripcion y la contrafirma son exigidas por el codigo antes de pedir firmas:
  `sgsst-electron-app/firma-service/src/services/empresa.js:1578` (exige `anexo_encargo_firmado_at`).

**Que falta.** Nada para el requisito: la adopcion del texto y su ejecucion estan hechas. Lo que
queda abierto no es de este requisito, sino el alta de **cada nueva Empresa**: sin su Anexo de
Encargo suscrito y contrafirmado, el codigo no le habilita pedir firmas
(`empresa.js:1578`, `:1613`), y ademas su canal de atencion (`canal_pqrs`) y su tabla de retencion
documental (que el codigo **no** puede verificar: es un documento que entrega la Empresa).

**Quien lo tiene.** Nadie para el requisito; para el onboarding de cada Empresa, la Empresa misma
(por la via publica del servicio) y K+AIR (la contrafirma).

---

### 2.3 - El owner decide si adopta el Anexo de Nube — CERRADO

**Que se verifico.** Lo mismo que en 2.2, para el Anexo de Nube: decision, suscripcion y
contrafirma sobre el texto vigente (v1.3).

**Evidencia.**
- `sgsst-electron-app/firma-service/legal-readiness.json:142-147` — `firmado: true`, `fecha:
  "2026-11-12T15:38:27.990Z"`, `version: "1.3"`, hash `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d`,
  `contrafirmado: true`; `:171-175` — la v1.1 suscrita el 5-nov queda como historica, sin contrafirma.
- Medicion SSH del 12-nov-2026: `gh_firma_anexo_nube_suscripciones` **id 2** = version `1.3`, hash
  `fdd10551...` (identico al del archivo medido hoy), `FIRMADA` el `2026-11-12T15:38:27.990Z`,
  contrafirmada el `16:13:54.106Z`, con acta `050f223a3665cf7d...`; ficha de la empresa
  `anexo_nube_ejecutado_at = 2026-11-12T16:13:54.106Z`.
- `sgsst-electron-app/firma-service/legal-readiness.json:210` — `canales.transaccional.estado:
  "migrado"`.

**Que falta.** Nada para el requisito. Advertencia operativa: el codigo solo exige el Anexo de Nube
**con la compuerta encendida** (`config.exigirAnexoNube`, `sgsst-electron-app/firma-service/src/config.js:202-203`,
y la condicion en `empresa.js:1599-1612`). En produccion esa bandera sigue **apagada** —no se puede
leer su valor porque `/opt/kair-firma/.env` es `600 root:root` y `sudo` pide contrasena-, y por eso
el item `empresas_nube` sale como `aviso` y no bloqueante
(`sgsst-electron-app/firma-service/src/services/readinessLegal.js:1960-1968`). Es decir: **hoy el
servicio permitiria pedir firmas a una Empresa sin el Anexo de Nube**, y eso choca con el propio
Anexo de Encargo, que obliga a suscribirlo junto con el Encargo (J12).

**Quien lo tiene.** Owner (encender `FIRMA_EXIGIR_ANEXO_NUBE` cuando abra a empresas reales, con el
riesgo de que las empresas que no lo tengan susceptibility quedan sin poder firmar) y cada Empresa
(la suscripcion del texto vigente).

---

### 2.5 - El owner decide sobre el tratamiento y las finalidades del numeral 10.3 — CERRADO

**Que se verifico.** Que la matriz de finalidades (ocho finalidades, dos grupos) este escrita con sus
bases juridicas, y que exista **la decision documentada del owner** sobre ella, que es lo que el
cuadro pedia.

**Evidencia.**
- `sgsst-electron-app/firma-service/config/matriz-finalidades.json` — fuente unica: Grupo A
  (10.3(a) a (g)) con la misma condicion de habilitacion en las ocho filas
  (`:43, :56, :69, :82, :95, :108, :121`) y 10.3(h) en Grupo B con
  `estado_habilitacion: "No habilitada - pendiente de entrega de informacion por la Empresa"`
  (`:134`).
- `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:106` — fila **J4**:
  el owner registra la decision («APLICADO EN EL TEXTO») y las bases las valido el abogado el 30-oct.
- El texto que la contiene quedo adoptado: `sgsst-electron-app/legal/anexo-encargo.html:168-174`
  (Grupo A y Grupo B, con el estado de habilitacion) y `:281-292` (las ocho filas de la matriz
  generada), instrumento que quedo suscrito y contrafirmado (ver 2.2).

**Que falta.** Nada en cuanto a la decision del owner: esta tomada, documentada y el texto que la
lleva quedo adoptado y suscrito. Lo que queda abierto **no es de este requisito**, y conviene no
confundirlo: (a) la **ratificacion escrita del abogado** sobre J4 (y sobre J2, J3, J10 y J11), que el
propio acta marca «PENDIENTE la firma del asesor»; (b) los **datos de cada Empresa** (tabla de
retencion documental, instruccion documentada y datos), que la matriz exige para habilitar el Grupo A
y que la finalidad 10.3(h) sigue esperando; (c) la **tabla supletoria** de conservacion
(`config/tabla-conservacion.json`, `aplicacion.activada: false`), que es J8, no 2.5.

**Quien lo tiene.** Para lo que queda: el abogado (ratificacion escrita) y cada Empresa (sus datos);
el owner, para la parte de su propia acta.

---

### 2.7 - Se documenta la decision sobre Google LLC y la cuenta Gmail de consumo — PARCIALMENTE

**Que se verifico.** Los tres puntos que el cuadro dejo pendientes para el owner: (a) el registro de
las decisiones J1-J14 en la seccion E, (b) las evidencias que J6 exige por Empresa, y (c) la
decision escrita y fechada de la fecha limite de migracion a una cuenta empresarial con acuerdo de
encargo. Ademas, el estado real del canal de correo (Workspace + CDPA) y lo que el texto vigente
afirma sobre el.

**Evidencia.**
- (a) La seccion E del acta esta completa: `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103-116`
  (J1 a J14 resueltos o aplicados) y `:117-122` (D7, P3, P11, C-1, P7). La fila **J6** (`:108`) dice
  «RESUELTO, y CORREGIDO en sus dos afirmaciones previas» y delimita el papel de Google en dos planos.
- (c) La migracion **esta ejecutada y fechada**: el CDPA fue aceptado el 10-nov-2026 y la cuenta
  empresarial esta activa y verificada
  (`sgsst-electron-app/docs/gestion-humana/firma-electronica/decision-regularizacion-correo-2026-11-09.md:31-35`,
  P1/P2/P5 cerrados) y `sgsst-electron-app/firma-service/legal-readiness.json:77-99`
  (`aceptacion` del CDPA: modo `aceptado_por_administrador`, fecha `2026-11-10`, evidencia con hash
  `9d989067...`), `:210` (`canales.transaccional.estado: "migrado"`).
- El Acuerdo vigente ya no dice lo que decia la v1.5: `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt:322`
  (CDPA aceptado el 10-nov), `:359-365` (§10.1 y el papel de Google en dos planos), `:452` y `:456`
  (§10.5(f), sin atribuirle garantias no demostradas).
- (b) **Lo que falta, por Empresa**, esta escrito: `sgsst-electron-app/legal/anexo-encargo.html:524-537`
  enumera lo pendiente con nombre y responsable, entre ello (ii) la evidencia que el regimen de
  transferencias internacionales exija a la Empresa como Responsable, (iii) la declaracion de la
  transferencia en el RNBD a cargo de la Empresa, y (iv) la politica de tratamiento de la Empresa
  que informa al Titular.
- **Pendientes del owner en consolas, a hoy:** P3 (los tres alias `privacidad@`, `soporte@`,
  `incidentes@` de `gesstiar.com`; `decision-regularizacion-correo-2026-11-09.md:378` y
  `tabla-instrumentos-vigentes-2026-11-09.md:95`) y P6 (revocar las app passwords de
  `adminkair@gmail.com`; `decision-regularizacion-correo-2026-11-09.md:381`,
  `tabla-instrumentos-vigentes-2026-11-09.md:98`, y declarado dentro del propio texto en
  `anexo-nube-v1.3.html:627` y `:738`).
- La propia fila J6 (`:108`) anota dos cosas sin cerrar: el articulado del CDPA **no esta en el
  repo** (solo su SHA-256, la captura y la constancia de aceptacion) y `fecha_efectividad_addendum`
  del manifiesto es `null`; y la **ratificacion externa del abogado queda a cargo de Gesstiar**.

**Que falta.** (1) La **ratificacion externa del abogado** sobre J6 (y las demas preguntas
respondidas por el dictamen del 11-nov): owner + abogado. (2) Las **evidencias por Empresa**
(acknowledgment firmado, politica de la Empresa con la transferencia y ficha del RNBD): cada Empresa,
mas el owner en la parte registral (ver 2.9). (3) **P3 y P6**: owner, en la consola de Google.
(4) El texto vigente del Anexo de Nube v1.3 todavia afirma que el metodo de autenticacion y la
verificacion en dos pasos de la cuenta de salida «estan pendientes (P2)»
(`anexo-nube-v1.3.html:617-618` y `:636-640`), cuando P2 se cerro el 10-nov: se corrige con la
version nueva que pide 1.9.

**Quien lo tiene.** Owner (P3, P6, y manages la ratificacion externa), abogado (ratificacion de
J6/J8/J9 y de las preguntas del 11-nov), cada Empresa (sus evidencias).

---

### 2.8 - Se verifica el alcance de la Circular Externa 002 de 2025 y la conclusion sobre transferencias internacionales — PARCIALMENTE

**Que se verifico.** Si el alcance de la Circular 002/2025 quedo verificado y la conclusion escrita en
los textos vigentes, y si existe el documento que J7 condiciono.

**Evidencia.**
- La verificacion esta hecha **en fuente oficial** y escrita: la conclusion juridica esta en
  `sgsst-electron-app/legal/anexo-nube-v1.3.html:396-412` («Conclusion juridica: la Circular Externa
  002 de 2025 no aplica a este canal, porque su ambito son los procesos de transferencia de
  tecnologia y el uso de una cuenta de correo para enviar un codigo OTP no es una transferencia de
  tecnologia»), con la misma condicion en
  `sgsst-electron-app/legal/anexo-encargo.html:528-530`.
- La fila **J7** del informe al asesor lo declara sin cerrar:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:109`
  («**PENDIENTE:** si K+AIR se presenta como proveedor de una tecnologia que permite el tratamiento de
  datos personales, debe documentar el cumplimiento de la Circular 002 de 2025; y el estado de
  inscripcion de Gesstiar en el RNBD lo verifica el owner»). En el acta del owner:
  `11-checklist-definitivo-revision-juridica-y-cierre.md:109`, **J7 = PENDIENTE**.
- **El documento que falta no existe.** Una busqueda de
  `responsabilidad demostrada|caracterizaci[oó]n de las funcionalidades|protecci[oó]n desde el dise[ñn]o|garant[ií]as contractuales`
  en todo `sgsst-electron-app` solo devuelve el propio cuadro (`respuesta-checklist-cierre-2026-10-30.md:602-605`)
  y las evaluaciones de canal de correo; **ningun documento reune las caracterizaciones** que la
  Circular exige (1.1, 1.2, 1.3, 2.1-2.4, 3.1-3.3, 4.1-4.4).
- El Anexo de Encargo lo dice con nombre y responsable:
  `sgsst-electron-app/legal/anexo-encargo.html:526-527` — pendiente (i), «el documento que demuestra las
  medidas de seguridad del canal de correo, que es la responsabilidad demostrada del parrafo primero
  del Titulo V».

**Que falta.** (1) **La decision del owner** sobre si K+AIR se presenta ante sus Empresas como
proveedor de una tecnologia que permite el tratamiento de datos personales: de esa decision depende
que la Circular 002/2025 entre o no en el ambito. (2) Si la respuesta es si, **el documento que reuna
las caracterizaciones** (el "documento que lo reuna" que el propio Anexo de Nube nombra) y el
**documento de seguridad del canal** que demuestra la responsabilidad demostrada del Titulo V.
(3) Lo que el RNBD exija (2.9). Con lo que hay hoy, la compuerta tecnica no bloquea: el gate
`publicacion` dio `listo: true` con 0 bloqueantes.

**Quien lo tiene.** Owner (la decision de encuadre y la orden de redactar); abogado (el contenido
juridico del documento); equipo (redaccion). No bloquea la apertura tecnica, pero es la exposicion
juridica mas grande que queda viva en la seccion.

---

### 2.9 - Se determina la obligacion de inscripcion en el RNBD o la excepcion aplicable — PENDIENTE

**Que se verifico.** La tabla registral del Anexo de Nube v1.3 (los cuatro puntos que el cuadro
dejo pendientes) y su estado real hoy.

**Evidencia.**
- `sgsst-electron-app/legal/anexo-nube-v1.3.html:414-481` — la tabla del RNBD. Punto 1 (naturaleza
  juridica): «el certificado de existencia y representacion de la Camara de Comercio de Barranquilla
  ... **sigue sin estar adjunto**» (`:430-434`). Punto 2 (activos totales): «Evidencia documental
  pendiente: el balance del primer ejercicio, que aun no existe» (`:444-445`); la cifra de
  $1.000.000 COP (19,09 UVT) es «una declaracion del owner y no sustituye los estados financieros»
  (`:457`). Punto 4 (estado del registro): «Evidencia documental pendiente: la consulta al portal de
  la SIC que confirme la ausencia de inscripcion, que el owner debe adjuntar» (`:470-471`).
- `:475-481` — «**Estado del registro en el RNBD: pendiente de verificacion por el owner.** Este Anexo
  no afirma que una transferencia este declarada en el RNBD ni que la declaracion sea o no exigible».
- `11-checklist-definitivo-revision-juridica-y-cierre.md:109` — fila **J7 = PENDIENTE**: «falta el
  certificado societario y los estados financieros».
- El criterio esta escrito y es favorable si se confirma: con la UVT 2026 de $52.374, el umbral de
  100.000 UVT del art. 2.2.2.26.1.2 del Decreto 1074 equivale a $5.237.400.000 COP y los activos
  declarados quedan «5.237 veces por debajo» (`anexo-nube-v1.3.html:452-459`).

**Que falta.** Tres documentos, todos del owner: (1) el **certificado de existencia y representacion**
de la Camara de Comercio de Barranquilla; (2) los **estados financieros / balance** del primer
ejercicio con sus notas, a la fecha de corte; (3) la **consulta al portal de la SIC** que confirme el
estado del registro en el RNBD. Con (1) y (2) se cierra la excepcion por umbral; si el owner decide
inscribirse, la **declaracion de la transferencia internacional** es de la **Empresa** como
Responsable, no de K+AIR.

**Quien lo tiene.** Owner (los tres documentos y la decision de memoria). El abogado, para la
calificacion final del umbral. La Empresa, la declaracion de la transferencia, si aplica.

---

## Resumen de los diez requisitos

| ID | Estado | Que falta en una linea |
|---|---|---|
| 1.2 | PENDIENTE | El owner debe enviar el tamano en bytes y el SHA-256 de su copia del Acuerdo (la pregunta ya es historica: el vigente es la v1.6). |
| 1.7 | CERRADO | Nada: la v1.6 esta identificada y la decision del owner esta en la Constancia, en el acta y en el registro append-only de aprobaciones. |
| 1.9 | PARCIALMENTE | Sin marcadores, pero los dos anexos vigentes afirman que sus propios actos y P2 «estan pendientes»: hace falta una version nueva (un texto suscrito no se toca) y corregir la tabla de instrumentos. |
| 2.1 | CERRADO | Nada: la v1.6 quedo publicada con autorizacion operativa registrada (id 4) y es la version activa. |
| 2.2 | CERRADO | Nada: el Anexo de Encargo 2026-11-11 quedo suscrito y contrafirmado en produccion el 12-nov. |
| 2.3 | CERRADO | Nada: el Anexo de Nube v1.3 quedo suscrito y contrafirmado en produccion el 12-nov. |
| 2.5 | CERRADO | Nada en la decision del owner; queda la ratificacion escrita del abogado y los datos de cada Empresa (no es de este requisito). |
| 2.7 | PARCIALMENTE | El canal ya esta regularizado y J6 esta resuelto; faltan la ratificacion externa del abogado, las evidencias por Empresa, P3 (alias) y P6 (revocar app passwords). |
| 2.8 | PARCIALMENTE | El alcance y la conclusion estan escritos; falta la decision del owner sobre el encuadre y, si aplica, el documento que reuna las caracterizaciones de la Circular 002. |
| 2.9 | PENDIENTE | El owner debe adjuntar certificado de existencia y representacion, estados financieros del primer ejercicio y la consulta al portal de la SIC. |

**Conteo:** 5 CERRADO, 3 PARCIALMENTE, 2 PENDIENTE. Ninguno de los diez es «No aplica».

## Conclusion de la seccion

**Lo que de verdad bloquea la apertura a empresas reales: una sola cosa, y es una decision del owner,
no un hueco de codigo.** El nucleo documental del servicio esta cerrado y verificado: el Acuerdo
vigente (v1.6) esta publicado con su autorizacion operativa, y los dos anexos que gobiernan la
relacion con la Empresa (Nube v1.3 y Encargo 2026-11-11) **estan suscritos y contrafirmados en
produccion**, medido hoy sobre la base y sobre las actas. Los dos gates dan `listo: true` con **0
bloqueantes**. El unico pendiente que impide abrir de verdad es **encender
`FIRMA_EXIGIR_ANEXO_NUBE`**: hoy la bandera sigue apagada, el item `empresas_nube` es un `aviso` y no
bloquea, y `empresa.js:1599-1612` no exige el Anexo de Nube — o sea que el sistema permitiria pedir
firmas a una Empresa que no lo ha suscrito, en contra de lo que el propio Anexo de Encargo obliga
(que se suscriban juntos). Encenderla tiene un costo conocido: las Empresas que no lo tengan
suscrito quedan sin poder pedir firmas. Ese es el acto de apertura, con su lista de-Empresas por
regularizar.

**Lo que no bloquea pero sigue vivo, en orden de riesgo:** (a) **2.9 (RNBD)**: tres documentos que
solo el owner tiene (certificado, balance, consulta SIC). La conclusion del expediente es favorable
—con los activos declarados, 5.237 veces por debajo del umbral—, pero hoy es una declaracion del
owner sin documento que la respalde; (b) **2.8 (Circular 002/2025)**: la conclusion esta escrita y
es favorable (no aplica a este canal), pero depende de una decision de encuadre del owner y del
documento que reuna las caracterizaciones si K+AIR se presenta como proveedor de tecnologia; (c) la
**ratificacion externa del abogado**, que el expediente pide en J6/J8/J9 y que nadie ha firmado: los
textos estan aplicados, pero el abogado no ha ratificado por escrito; y (d) **P3 y P6**, dos actos
del owner en la consola de Google (los alias y la revocacion de las app passwords de la cuenta
anterior).

**Lo que hay que corregir antes de que esto sesignature otra vez:** los dos anexos vigentes, ya
suscritos, afirman que sus propios actos «estan pendientes» y que el metodo de autenticacion del
canal «esta pendiente (P2)», cosas que el 12-nov y el 10-nov ya no eran ciertas. Un texto suscrito no
se toca, asi que la via es una **version nueva** (Nube v1.4 y una nueva version del Encargo) con
huella propia, firma de nuevo y manifiesto al dia. Mientras tanto, la
`tabla-instrumentos-vigentes-2026-11-09.md` (filas §1) sigue diciendo «NO suscrito» y contradice a
la base: esa correccion es de un minuto y es la que mas puede confundir a un lector.

**Y un dato de contexto que no es mio pero condiciona la foto:** el servidor de produccion corre
**Node v20.20.2**, no el Node 22 que el repo exige, y `better-sqlite3` esta compilado para el ABI
del Node 20; el `npm audit` quedo en **2 vulnerabilidades altas** (nodemailer y zod) que exigen salto
mayor de version. Ninguna de las dos cosas es de las secciones 1 y 2, pero las dos condicionan la
apertura.

---

*Verificacion realizada el 12-nov-2026 por el worker de las secciones 1 y 2. Todas las mediciones
remotas fueron de solo lectura. No se modifico ningun archivo del repositorio, del servidor ni de la
base de datos; este es el unico archivo escrito.*
