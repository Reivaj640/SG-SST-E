# Verificacion de cierre - Seccion 8 "Constancia y cierre formal"

**Que se verifico.** Los seis requisitos de la seccion 8 del cuadro canonico
(`sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md`,
seccion 8, lineas 1271-1331) contrastados contra el codigo, los documentos del expediente y el
servidor de produccion. El cuadro es del 30-oct-2026 y su tabla de estados quedo desactualizada: hoy
el conteo real del documento da seccion 8 con 4 cerrados y 6 pendientes (los seis de esta seccion),
medido con `node scripts/contar-estados-checklist.js` en modo solo lectura (sin `--escribir`), que
sale con codigo 0: el documento cuadra consigo mismo, pero describe el 30-oct.

**Fecha de la medicion.** 12-nov-2026, 13:30 a 14:40 (hora de Colombia). Mediciones por SSH en modo
solo lectura contra `kair-server` (`javier@192.168.1.11`). Ninguna llamada modifico la base, el
manifiesto, los textos ni el servicio.

**Salvedad sobre como se midio la compuerta.** La cuenta `javier` no puede abrir la base de
produccion en modo escritura (el `-wal` y el `-shm` son de `kairfirma`), y el `.env` real (600 root)
tiene `INTERNAL_API_KEY`, `ADMIN_API_KEY` y las variables SMTP que `src/config.js` exige al cargar.
Por eso la medicion se hizo sobre una **copia** de `firma.sqlite` en `/tmp` y con valores de
entorno **de mentira** para SMTP y para las dos llaves. Ninguna de esas variables participa en el
calculo de la compuerta: `readinessLegal.js` solo lee el manifiesto y la base (su unico acceso es
`db.prepare(...)` con `.all()`/`.get()`, sin `INSERT`, `UPDATE` ni `DELETE`). La copia quedo con
permisos `700`; su limpieza quedo pendiente porque la sesion tiene el borrado bloqueado.

**Regla de estado aplicada.** `PROMPT.md:997-1022` (regla 5.30): el estado es la palabra clave del
encabezado y tiene que ser una de `CERRADO`, `PENDIENTE`, `PARCIALMENTE`, `No aplica`. `PARCIALMENTE`
cuenta como pendiente: no esta cerrado, algo falta.

---

### 8.1 - El owner registra sus decisiones sobre el contenido - CERRADO

**Que se verifico.** La seccion E del acta interna de decisiones del owner
(`paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md`) tiene las 14
filas de J1 a J14, y cada una trae decision o estado pendiente explicito, fundamento y fecha. Se
verifico ademas que el archivo esta en el repositorio y versionado, y que la fila de la seccion E
sobre "Autorizacion operativa independiente" sigue vacia.

**Evidencia.**
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103` (J1) a `:116` (J14) — las 14 filas del acta, cada una con decision, fundamento o evidencia y fecha (30-oct, 11-nov).
- `:109` (J7, pendiente), `:110` (J8, pendiente), `:111` (J9, pendiente) — tres puntos que el owner dejo **expresamente** pendientes, con su responsable. Es decir: registrados, no resueltos.
- `:124-125` — el bloque de firma del acta ("Nombre y cargo", "Firma", "Fecha") esta **en blanco**.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-cierre-abogado-2026-10-31.txt:105` — el criterio del propio plan para «aprobado para produccion» es "Seccion E **firmada**, con version y hash de A1-A4".
- `git log -- 11-checklist-definitivo-revision-juridica-y-cierre.md` — ultimo commit `91214c55` (P8): el acta esta versionada, no es un borrador local.

**Que falta.** Solo el acto: la firma del acta (lineas 124-125 en blanco). El contenido de las 14
decisiones esta completo y fechado. En el fondo siguen abiertos tres puntos que el owner registro
como pendientes, cada uno con su responsable: J7 (certificado societario y estados financieros para
la Circular Externa 002 de 2025 y el RNBD), J8 (validacion escrita de los plazos de 10 y 5 anos) y
J9 (validacion del procedimiento de la fecha de cese y del alcance del `hold`).

**Quien lo tiene.** Owner (la firma del acta) y abogado externo (J7, J8, J9).

---

### 8.3 - El owner define fecha de vigencia y alcance de uso - CERRADO

**Que se verifico.** Que la fecha de vigencia la declaro el owner y no se invento ni se confundo con
la fecha de registro de la autorizacion; que el texto publicado y la base de produccion coinciden
con esa fecha; y que el alcance de uso es el del texto que el owner aprobo con version y huella.

**Evidencia.**
- `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt:5` — "Fecha de vigencia: 11 de noviembre de 2026." (el texto publicado, no una nota al pie).
- `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt:7-11` — la clausula "Alcance": regula el uso del mecanismo de firma electronica de K+AIR y aplica a todos los documentos que una Empresa envie a firma de sus trabajadores por esa via.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103` — decision del owner del 11-nov-2026: aprueba la v1.6 con huella `08e1eb8b...f13e`, 75 961 B y "fecha de vigencia 11-nov-2026".
- `sgsst-electron-app/firma-service/legal-readiness.json:8-10` — `version: "v1.6"`, `fecha: "2026-11-11"`, `publicado: true`.
- SSH, 12-nov: `SELECT fecha_vigencia_inicio FROM gh_firma_acuerdo_versiones` (version activa) → `2026-11-11T19:51:42.036Z`. **Coincide** con la fecha declarada: no hay desalineacion entre el texto y la base, que era la trampa de `plan-cierre-abogado-2026-10-31.txt:101` (decision D, "fecha cierta, anterior a la publicacion").
- SSH, 12-nov: `gh_firma_aprobaciones_publicacion` id 4 → `fecha_creacion = 2026-11-11T19:46:11.639Z`, es decir la autorizacion operativa quedo registrada **5 minutos antes** de la activacion, que es el orden que exige la barrera de publicacion.
- El anexo contractual por su lado: `legal-readiness.json:114-129` (`anexo_encargo.estado = "firmado"`, 2026-11-12T16:14:31.105Z, huella `6308b1f7...b8948`) y `:141-151` (`anexo_nube.firmado = true`, v1.3, contrafirmado 2026-11-12T16:13:54.106Z). Las dos partes suscribieron, que es lo que el propio requisito pedia.

**Que falta.** Nada del requisito. Aclaracion de alcance: el "alcance de uso" declarado por el owner
es el **contractual**, el de la clausula "Alcance" del Acuerdo v1.6 (aplica a toda Empresa que lo
suscriba, documento por documento). El alcance **operativo** (a que empresas reales y desde cuando
se abre el servicio) no esta declarado por el owner y no se maneja en este requisito: se maneja en la
decision C del plan de cierre (`plan-cierre-abogado-2026-10-31.txt:89` y `:100`), que sigue abierta
y se reporta en 8.5 y en la conclusion.

**Quien lo tiene.** Owner (ya ejecuto el 11-nov-2026); las partes, en las suscripciones de los
anexos.

---

### 8.5 - Se completan las verificaciones técnicas de publicación - PARCIALMENTE

**Qué se verificó.** La compuerta `publicacion` medida contra el codigo desplegado en el servidor; el
estado de las migraciones en la base de produccion; la salud del servicio; las huellas de los tres
textos en disco; y el cruce con la lista de verificaciones tecnicas T1 a T9 y la compuerta G4 del
plan de cierre. La tabla de la seccion 7 del cuadro canonico (30-oct) esta desactualizada: lo que
manda es el estado medido.

**Evidencia.**
- SSH, 12-nov 18:33Z: `node scripts/auditar-readiness-legal.js --gate=publicacion` contra el codigo de `/opt/kair-firma/app` → "Gate: publicacion — LISTO · Items: 42 · OK: 40 · Pendientes: 0 · Avisos: 1 · N/A: 1", con `bloqueantes_pendientes: 0`. El JSON del reporte: `resumen = {"total_items":42,"ok":40,"pendientes":0,"avisos":1,"no_aplica":1,"bloqueantes":20,"bloqueantes_pendientes":0}`.
- El mismo reporte, item "Aprobacion operativa de la version vigente": **OK** — "La version v1.6 tiene autorizacion operativa (aprobada por Javier Robles Fontalvo, owner de K+AIR el 2026-11-11)". El gate `primera_firma` da el mismo resumen (42 · 40 ok · 0 pendientes · 0 bloqueantes).
- SSH, 12-nov: `SELECT COUNT(*), MAX(version) FROM gh_firma_schema_migrations` → `61 | 062_encargado_poderes_append_only`. Las migraciones 060, 061 y 062 (las del P8) estan aplicadas.
- SSH, 12-nov: `systemctl is-active kair-firma` → `active`; `is-enabled` → `enabled`; `GET http://127.0.0.1:3001/health` → `{"status":"ok","db":"ok","smtp":"configured","uptime_seconds":14629}`.
- SSH, 12-nov: `sha256sum` en disco → `acuerdo-v1.6.txt` `08e1eb8b...f13e`, `legal/anexo-nube-v1.3.html` `fdd10551...b585d`, `legal/anexo-encargo.html` `6308b1f7...b8948`. Coinciden con `legal-readiness.json:7`, `:145` y `:129`.
- SSH, 12-nov: `sha256sum /opt/kair-firma/app/legal-readiness.json` → `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`, byte a byte igual al del repositorio (medido tambien en el PC). `sha256sum /opt/kair-firma/legal/constancia-aprobacion-acuerdo.html` → `aaf68b4e7df5e2757d5885840056218d97a0cbb1c9fa624bf7861962c8d0b413`.
- Suite, registrada en el expediente: `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §7 (12-nov por la tarde: **2 667 pruebas, 2 665 verdes, 0 rojas, 2 omitidas**; el 12-nov por la manana, sobre el commit `e4dd5f31`, 2 665 / 2 663) y `verificacion-cierre/t1-corrida-desde-clon-limpio.md` (tres corridas desde clon limpio, 0 fallos).

**Que falta.** Cuatro cosas, todas con dueño, y ninguna es un problema del texto publicado. **Lo que se
resolvio el 12-nov-2026** esta al final; lo que sigue abierto, antes:

1. **T6, el E2E con el caso real de buzon corporativo rechazado.** El camino esta probado por la suite, pero **el caso real no ha ocurrido**: la base de produccion tiene **0** eventos `OTP_MEDIO_CORPORATIVO` (`Historial.md:8729-8733`). El requisito de T6 es "E2E controlado con el caso... limpieza del rastro y acta" (`paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:135`).
2. **T7, la reversion probada, no descrita.** Los programas existen; la prueba y su evidencia no (`10-informe-correcciones-para-asesor-juridico.md:136`). Sigue en la cola del 12-nov (`Historial.md:8783-8784`).
3. **T1, la corrida reproducible desde clon limpio ligada a un commit candidato.** Sigue pendiente en el informe del 30-oct/11-nov (`10-informe-correcciones-para-asesor-juridico.md:130`), y la suite completa **nunca se ha corrido en el servidor** (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1121-1122`).
4. **El respaldo que cubra los actos del P8.** El ultimo respaldo es del 11-nov 22:00 (`/opt/kair-firma/backups`, medido por SSH el 12-nov 13:40), o sea que **los cuatro actos del 12-nov todavia no estan en ningun respaldo**; el de hoy 22:00 los incluye. El respaldo off-site sigue pendiente (`Historial.md:8788-8790`).

**Lo que se resolvio el 12-nov-2026 (medicion de esta misma ronda).**
- **T4**: cerrado con `acta-comprobacion-servidor-2026-11-12.md` y `acta-despliegue-2026-11-12.md`.
- **T7**: **probada de verdad** — 58 OK, 3 avisos, 0 fallas, exit 0, con el volcado canonico de la base restaurada identico al de origen y produccion intacta. La prueba **encontro un defecto real** (el borrado por rango de `gh_consentimientos_firma` sin borrar antes sus eventos, que la FK bloqueaba), **corregido y medido con un A/B**: el programa desplegado aborta con `FOREIGN KEY constraint failed` y exit 3; el corregido borra con exit 0. Falta **desplegar la correccion** y la **restauracion cifrada real** (root). Acta: `verificacion-cierre/t7-reversion-probada.md`.
- **T1**: **tres corridas desde un clon limpio** (`npm ci` desde cero, Node 22, sin `.env`): 2 624/2 622/0/2, 2 630/2 628/0/2 y 2 650/2 648/0/2. Los conjuntos de nombres de prueba coinciden **exactamente** con las corridas del arbol del owner, y el clon final quedo byte a byte identico (4 780 de 4 780 archivos). Falta la corrida **sobre el commit** (T3 lo tiene el owner) y la suite **en el servidor** (`/opt/kair-firma/app/tests` no existe). Acta: `verificacion-cierre/t1-corrida-desde-clon-limpio.md`.
- **T6**: con la evidencia registrada (`verificacion-cierre/t6-caso-buzon-corporativo.md` y `scripts/probar-t6-medio-corporativo.js`), con la salvedad de que el caso real **no ha ocurrido en produccion**.

La compuerta G4 del plan (`plan-cierre-abogado-2026-10-31.txt:82`) exige T4, T6 y T7 con evidencia
registrada y T8 firmada: **T4, T6 y T7 tienen evidencia registrada; T8 no esta firmada** (y es un acto
de voluntad que solo el owner puede hacer).

**Quien lo tiene.** Equipo (desplegar la correccion de T7, la fila T7 del informe, T1 sobre el commit);
owner (T8 firmada, el respaldo off-site, la decision de abrir).

---

### 8.6 - El representante legal firma la autorización operativa - PARCIALMENTE

**Que se verifico.** Tres cosas: (a) la autorizacion operativa de la publicacion de la v1.6, que esta
registrada en el servicio; (b) el documento A4 (la Constancia de version y autorizacion de
publicacion), que es donde el propio requisito dice que debe quedar; y (c) lo que el expediente
decidio sobre donde vive esa autorizacion.

**Evidencia.**
- SSH, 12-nov: `gh_firma_aprobaciones_publicacion` id 4 → `tipo = OPERATIVA`, `version = v1.6`, `hash = 08e1eb8b...f13e`, `aprobado_por = "Javier Robles Fontalvo, owner de K+AIR"`, `fecha = 2026-11-11`, `fecha_creacion = 2026-11-11T19:46:11.639Z`, con `garantia`, `resultado_verificaciones` y `responsable_despliegue` diligenciados. Registro append-only: no se reescribe.
- `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:143-172` — la seccion 5, "Constancia de la autorizacion operativa", tiene **las cinco celdas de valor vacias** (`<td></td>` en las lineas 153, 157, 161, 165 y 169): version y huella autorizadas, garantia tecnica verificada, persona que autoriza, fecha y observaciones.
- `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:174-189` — la seccion 6, "Firma del representante legal", tiene la fila de decision con nombre, firma y fecha **vacios**.
- `sgsst-electron-app/firma-service/legal-readiness.json:17` — `constancia.estado = "no_firmada"`. `:20` — la nota que declara que la autorizacion operativa "no se documenta en este documento sino en el registro append-only de aprobaciones de publicacion del servicio (`gh_firma_aprobaciones_publicacion`, tipo OPERATIVA)" y que quedo registrada el 11-nov-2026.
- `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1062-1065` — el mismo criterio escrito en el plan de despliegue: la seccion 5 y la seccion 6 "siguen vacias **por diseno**: la autorizacion vive en el registro de aprobaciones del servicio, no en el documento".
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-cierre-abogado-2026-10-31.txt:80` — T8: "Autorizacion operativa independiente del owner... **Documento firmado**, distinto de la Constancia. ESTE si es un acto de voluntad: la firma es la prueba". `:82` — compuerta G4: "T8 firmada, porque es un acto de voluntad y no una constancia". `:109` — "T8 firmada por el owner, separada de la aprobacion juridica" es criterio de «aprobado para produccion».
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:137` — T8 sigue como "Pendiente".
- `Historial.md:8783-8784` — la cola del 12-nov deja T8 abierto.

**Que falta.** El **documento firmado**. El registro del servicio tiene toda la sustancia que T8
pide (version, huella, garantia, resultados de las verificaciones, responsable del despliegue) y es
append-only, pero una fila en la base no es el acto de voluntad firmado que el plan exige para T8 ni
lo que el requisito pide ("firma"). La Constancia esta publicada en `kair.fyi` con las secciones 5 y
6 vacias, y el manifiesto lo declara (`no_firmada`). Aparte, y como acto distinto: no existe
autorizacion operativa para la **apertura** del servicio a empresas reales (la decision C, ver
8.5 y la conclusion); la autorizacion del 11-nov es solo de publicacion y su propia nota dice que
"la compuerta `FIRMA_EXIGIR_ANEXO_NUBE` sigue APAGADA por decision escrita del owner".

**Quien lo tiene.** Owner (representante legal de Gesstiar S.A.S.). Es un acto suyo: nadie mas lo
puede firmar.

---

### 8.8 - Se registra quién autorizó, cuándo y bajo qué resultados de pruebas - PARCIALMENTE

**Que se verifico.** El registro append-only de aprobaciones de publicacion (que es donde el
servicio deja esos tres datos), las actas de los cuatro actos del P8, y si existe un acta que fije
los resultados para un commit y un despliegue identificados.

**Evidencia.**
- SSH, 12-nov: `gh_firma_aprobaciones_publicacion` id 4 — **quien**: `aprobado_por = "Javier Robles Fontalvo, owner de K+AIR"`, `responsable_despliegue = "Javier Robles Fontalvo"`; **cuando**: `fecha = 2026-11-11`, `fecha_creacion = 2026-11-11T19:46:11.639Z`; **bajo que resultados**: `resultado_verificaciones` (la huella del texto en el servidor coincide con la del manifiesto y con la archivada; el orden autorizacion → publicacion; las migraciones 060, 061 y 062 aplicadas; con la v1.6 activa el reporte de auditoria legal no reporta bloqueantes) y `garantia` (tope del texto, barrera de publicacion con huella, Constancia `aaf68b4e...d0b413`, suite del 11-nov con 2 577 pruebas / 2 575 verdes / 0 rojas / 2 omitidas, 61 migraciones aplicadas, `/health` en ok, compuerta de publicacion sin bloqueantes).
- Actas de los cuatro actos del P8, en el servidor (`ls /opt/kair-firma/storage/pdfs/actas`, 12-nov): `acta-2-anexo-encargo.pdf` (7 693 B), `acta-2-contrafirma-anexo-nube.pdf` (7 167 B), `acta-2-contrafirma-anexo-encargo.pdf` (7 405 B), con sus SHA-256 en `legal-readiness.json:117`, `:146` y `:151`.

**Que falta.**
1. El despliegue en produccion **no esta al dia**: el bump de dependencias (`dfc403b0`) **no se ha desplegado**, o sea que produccion sigue corriendo el arbol viejo de dependencias (`Historial.md:8781-8783`). Lo que se autorizo el 11-nov no es exactamente lo que corre hoy.
2. **La corrida reproducible desde clon limpio (T1) no existe** (ver 8.5).
3. **El 📦1051 sigue sin desplegarse**, y es lo que separa "el commit que se autorizo" de "el despliegue que corre".

**Lo que se resolvieron el 12-nov-2026 (medicion de esta misma ronda).**
- **Ya hay acta de despliegue**, escrita con el commit, las huellas, las migraciones y los resultados: `verificacion-cierre/acta-despliegue-2026-11-12.md`, con el resumen en `MIGRACION-SERVIDOR-FIRMA.md` §5.1.4.
- **Ya se sabe con certeza que codigo corre**, y no por inferencia: la comparacion por sha256 de los 247 archivos desplegables da **6 diferencias y 0 sobrantes**, y las 6 son `package.json`, `package-lock.json`, dos scripts auxiliares y dos archivos de despliegue. Todo `src/` es byte a byte el de `264d08df`. El control es reproducible: `firma-service/scripts/comparar-despliegue.js`, que sale con codigo 1 nombrando los archivos mientras haya diferencias.
- **Quien y cuando** ya estaban en el registro id 4 (append-only), y **el manifiesto** es byte a byte igual entre el repositorio y produccion.

**Quien lo tiene.** Equipo (acta de despliegue con commit — **hecha** —, corrida limpia, despliegue del `dfc403b0`); owner (la firma y la decision de autorizar).

---

### 8.10 - Se actualiza la documentación del proyecto y el registro de cierre - CERRADO

**Que se verifico.** Los cuatro documentos que el requisito nombra (`Historial.md`, `PROMPT.md`,
`BITACORA.md`, `CONTEXT.md`), el estado del cuadro canonico de 96 requisitos, y si existe el acta de
cierre de este checklist.

**Que se cerro el 12-nov-2026 (esta misma ronda).** Los cuatro huecos que se senalaban estan
cerrados, cada uno con su documento:

| Hueco | Como quedo |
|---|---|
| (1) El acta de cierre del checklist de 96 requisitos | `verificacion-cierre/acta-cierre-checklist-2026-11-12.md`: el **registro de cierre** del §5 del plan de cierre, con version, hashes, commit, resultados de T1 a T9, decisiones A, B y C, fecha y responsable, y la lista de los 22 pendientes con su dueño |
| (2) Una entrada de `BITACORA.md` con el hito de la v1.6 y del P8 | `BITACORA.md`, entradas del 12-nov-2026: el hito (P8 ejecutado con ASEPLUS, que es **empresa de prueba**; Acuerdo v1.6 publicado; compuerta en `listo: true`), mas los dos hallazgos de la ronda (el preflight que decide si se puede abrir, y la comparacion del arbol desplegado) |
| (3) Actualizar `CONTEXT.md`, que describia un estado que ya no existe | `CONTEXT.md`: bloque de estado al tope con lo que hay hoy, lo que no hay, la meta, los diez bloqueos duros y lo que el owner debe hacer |
| (4) El "registro de cierre" del plan (T1 a T9 y decisiones A, B y C por escrito con su fecha) | El mismo `acta-cierre-checklist-2026-11-12.md`, seccion 3 (T1 a T9 con su evidencia) y seccion 4 (A aplicada, B tomada con la compuerta cerrada, C decidida el 5-nov) |

**Evidencia.**
- `Historial.md` **al dia**: la novena ronda (`Historial.md:8579`) documenta los cuatro actos del P8 con sus horas y huellas (`:8600-8610` el manifiesto `191c08b8...f8a4013f` y la compuerta en `listo: true`), y la decima ronda (`Historial.md:8687`) responde la pregunta de produccion con medidas (`:8694-8699` los dos gates, `:8710-8716` la respuesta honesta, `:8718-8727` los dos interruptores). La onceava ronda empalma el estado de esta ronda.
- `PROMPT.md` **al dia**: la regla 5.30 (`:997-1022`) fija la palabra clave del estado de un requisito y la 5.19 (`:718`) el control que compara contra una constante.
- `sgsst-electron-app/BITACORA.md` — tres entradas del 12-nov-2026: el hito v1.6/P8, el preflight de la compuerta y la comparacion del arbol desplegado. Cada una con su "por que se rompio" y sus reglas. **Ademas se corrigio una filtracion de caracteres CJK que venia de una ronda anterior** (4 caracteres en una entrada vieja): el barrido de caracteres prohibidos ahora da cero en el archivo.
- `sgsst-electron-app/CONTEXT.md` — el bloque de estado del 12-nov-2026 esta al tope.
- El cuadro canonico esta reconciliado con la medicion de hoy: **76 cerrados / 20 pendientes / 96**, con la tabla regenerada por `scripts/contar-estados-checklist.js` y los 34 requisitos medidos actualizados por `scripts/actualizar-cuadro-canonico-2026-11-12.js` (el texto sale literal del informe que lo midio).
- `plan-cierre-abogado-2026-10-31.txt:91` — el "registro de cierre" del plan **no es condicion de produccion**: "Lo que bloquea es que falte la evidencia a la que el registro apunta (T4, T6, T7, T8 y T9)". Por eso el registro se escribe con evidencia registrada y no con firmas.

**Que falta.** Nada del requisito. **Lo que el registro deja abierto es de otros requisitos** (T8, que
es un acto de voluntad del owner, y T1, T6 y T7, que estan en curso o con su salvedad declarada), y
quedan nombrados con su dueño en el propio registro de cierre.

**Quien lo tiene.** Equipo (la documentacion y el registro: hechos). Owner (las decisiones A, B y C
por escrito —las tres estan tomadas— y el acto de voluntad de la T8).

---

## Resumen de los seis requisitos de la seccion 8

| ID | Estado | Que falta en una linea |
|---|---|---|
| 8.1 | CERRADO | Las 14 decisiones estan registradas y fechadas; solo falta la firma del acta (lineas 124-125 en blanco) y siguen abiertos en su fondo J7, J8 y J9. |
| 8.3 | CERRADO | Nada: el owner declaro la vigencia (11-nov-2026) y el alcance esta en el texto publicado; el alcance operativo de empresas reales es otra decision (C). |
| 8.5 | PARCIALMENTE | La compuerta `publicacion` esta en LISTO con 0 bloqueantes, pero faltan T6 (el caso real del buzon corporativo rechazado), T7 (reversion probada), T1 (corrida desde clon limpio) y el respaldo que cubra los actos del P8. |
| 8.6 | PARCIALMENTE | La autorizacion operativa de la v1.6 esta registrada en el servicio (id 4), pero falta el documento firmado: Constancia A4 secciones 5 y 6 vacias, `constancia.estado = no_firmada`, T8 abierto. |
| 8.8 | PARCIALMENTE | Ya hay acta de despliegue con el commit (`264d08df`), las huellas, las migraciones y los resultados, y ya se sabe que codigo corre por comparacion de sha256 (247 archivos, 6 diferencias). Quedan el despliegue del 📦1051 y la corrida limpia (T1). |
| 8.10 | CERRADO | Los cuatro huecos se cerraron el 12-nov: el registro de cierre del checklist (`acta-cierre-checklist-2026-11-12.md`), el hito v1.6/P8 y los dos hallazgos en `BITACORA.md`, y el bloque de estado de `CONTEXT.md`. |

## Conclusion

**Lo que de verdad bloquea que el primer cliente real pueda firmar** son dos cosas, y ninguna es un
documento. La primera es la **compuerta `FIRMA_EXIGIR_ANEXO_NUBE`, que sigue apagada**
(`sgsst-electron-app/firma-service/src/config.js:202-203`; decision C del owner del 5-nov en
`plan-cierre-abogado-2026-10-31.txt:89` y `:100`, con el orden exigido: publicar el Anexo, que la
Empresa lo suscriba, recien entonces encender). Hoy la compuerta apagada no daña porque la unica
Empresa de produccion ya tiene el Anexo de Nube v1.3 suscrito y contrafirmado, pero **desde el
primer cliente real si**: una Empresa nueva podria crear solicitudes sin suscribir el Anexo de
Nube, y el numeral 3.4(h) del Acuerdo vigente dice que sin Anexo de Nube suscrito no se permite
firmar. Es decir: el texto seria falso frente al cliente real. Es una decision del owner y ya tiene
el preflight y la regla escrita. La segunda es que **el camino de alta de un cliente real nunca se
ha recorrido**: la base de produccion tiene **una sola Empresa**, ASEPLUS CARIBE S.A.S.
(`900.829.731-1`), que es **la empresa de prueba** (medido por SSH el 12-nov:
`SELECT COUNT(*) FROM gh_firma_empresas` → 1; y `Historial.md:8714-8716`: "en la base de produccion
hay UNA sola empresa... El alta, la suscripcion de los anexos y la primera solicitud de firma de un
cliente real: ese camino nadie lo ha recorrido"). A eso se suma un riesgo operativo medido: los
cuatro actos del P8 **todavia no estan en ningun respaldo** (el ultimo es del 11-nov 22:00) y el
respaldo off-site sigue pendiente, en un servidor que es una sola maquina.

**Lo que es bookkeeping documental** es el resto de lo que queda abierto en esta seccion: la firma
del acta de la seccion E (8.1), la firma de la Constancia A4 en sus secciones 5 y 6 (8.6), el acta
de despliegue con commit (8.8), el acta de cierre del checklist y la puesta al dia de `BITACORA.md`
y `CONTEXT.md` (8.10), y las dos verificaciones que la propia compuerta G4 exige pero que no se
miden en el flujo de una firma: T6 (el caso real del buzon corporativo rechazado, que la suite
demuestra pero que en produccion no ha ocurrido) y T7 (la reversion probada). Ninguno de esos
bloquea la firma de un documento; todos bloquean la **declaracion** de «aprobado para produccion»
que el propio plan define (`plan-cierre-abogado-2026-10-31.txt:102-113`). La ratificacion externa
del abogado (J7, J8, J9) esta en ese mismo grupo: no detiene la operacion, pero deja el marco
juridico incompleto y, mientras no llegue, la declaracion de produccion no puede ser «incondicional».
La compuerta de conservacion (`sgsst-electron-app/firma-service/config/tabla-conservacion.json:6`,
`aplicacion.activada: false`) **no** es un bloqueante: esta cerrada a proposito y el Acuerdo
vigente no promete los plazos de 10 y 5 anos, asi que el texto y el sistema no se contradicen.

**Estado de las mediciones de esta seccion.** Compuertas medidas hoy por SSH contra el codigo
desplegado: `publicacion` y `primera_firma`, las dos en LISTO, 42 items, 40 ok, 0 pendientes, 0
bloqueantes. Base de produccion: 61 migraciones (maximo `062`), servicio `active`, `/health` en ok,
manifiesto `191c08b8...f8a4013f` —**esa es la medicion de ese momento**: desde la tarde del 12-nov el
repositorio lleva `d9b59699...c9097b`, que difiere en **dos notas** y que **el despliegue alinea**
(los dos actos existen en la base de produccion; lo que se corrige es la prosa)—, tres textos con huella coincidente en
disco, cuatro aprobaciones de publicacion (una por version) y una sola Empresa.

## Novedad de la tarde del 12-nov-2026: las siete decisiones de fondo

El owner delego en el equipo la **toma** de las siete decisiones de fondo del mapa. El equipo las tomo,
las escribio con su fundamento medido y dejo por escrito **que es acto de terceros y de quien**. El
documento es `docs/gestion-humana/firma-electronica/decisiones-de-fondo-2026-11-12.md`. El mapa paso de
**5 cerrados / 22 pendientes** a **7 cerrados / 20 pendientes**: **M.15** y **M.20** cierran; **M.5**,
**M.6**, **M.7**, **M.14** y **M.18** quedan **PARCIALMENTE** porque lo que falta es una firma, una
credencial o la respuesta de un tercero.

Lo que **cambio en el codigo, en el manifiesto y en los documentos**:

- **El manifiesto del repositorio lleva ahora la verdad y el de produccion todavia no.** Se corrigieron
  **exactamente dos notas** (`anexo_nube.modelo.nota` y `anexo_encargo.nota`), que en produccion dicen
  «NO esta suscrito» mientras el propio bloque declara `firmado: true` y `contrafirmado: true` con la
  fecha del 12-nov. Los dos actos **existen en la base de produccion** (suscripcion id 2, `FIRMADA` y
  `CONTRAFIRMADA`, acta `050f223a3665cf7d`): lo que se corrigio fue la prosa. El repositorio queda
  `d9b59699...c9097b` y el despliegue lo alinea.
- **Defecto real corregido en `scripts/actualizar-manifiesto-1047.js`:** empujaba a `versiones_firmadas`
  la firma declarada **sin comprobar si describia el texto vigente**, de modo que la v1.3 (el texto
  vigente, suscrito y contrafirmado) quedaba registrada **dos veces**: una como vigente y otra como si
  fuera una version anterior. Ahora solo pasa a la historia una firma que **no** describe el texto vigente,
  y hay **dos pruebas de regresion** que lo fijan.
- **`src/services/readinessLegal.js`** decia «Acuerdo de uso v1.1» donde el Acuerdo vigente es la **v1.6**.
- **El destino del respaldo fuera del servidor quedo decidido** (bucket S3-compatible de Backblaze B2 con
  `rclone`, retencion de 30 dias) y se corrigio un defecto que hacia inutil el metodo: la rama `rclone`
  comparaba con `rclone hash`, **un comando que no existe** (medido con las dos versiones reales).
- **La ventana de Node 22 quedo escrita con su rollback** y con un verificador de solo lectura
  (`deploy/verificar-runtime-node.sh`) que sale con codigo 1 ante cualquier incoherencia entre el runtime
  y el modulo nativo.
- **Los candidatos de la v1.4 estan armados** (Nube v1.4 y el Encargo que la remite), con 11 de 11 anclas
  casando exactamente una vez, marcados como **no publicados y no firmables**.
- **La variable `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` quedo declarada inerte** y tres documentos que la
  trataban como interruptor se corrigieron (`API.md` dos veces y el 4.7 del cuadro canonico).

**Pendiente de limpieza, sin efecto sobre el servicio.** Por la politica de borrado de esta sesion no
se pudieron eliminar los archivos temporales de la medicion: en el servidor quedan
`/tmp/kair-gate-verify` (copia de la base de produccion, con permisos `700` puestos) y los scripts
`/tmp/kair_q*.sql`, `/tmp/kair_gate*.sh`, `/tmp/kair_srv*.sh`; en el PC quedan los equivalentes en
`%TEMP%`. Ninguno lo lee el servicio. Se pueden borrar sin riesgo.
