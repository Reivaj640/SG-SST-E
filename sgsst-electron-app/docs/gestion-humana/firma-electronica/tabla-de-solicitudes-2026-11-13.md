# Tabla de solicitudes — 13 de noviembre de 2026

**Qué es esto.** Cada pendiente que quedaba abierto en el mapa de la meta se pidió por escrito. Esta
tabla es el **registro de esas solicitudes**: cuál es, a quién va, qué se pide, cómo se verifica que
se cumplió, en qué estado está y qué vence.

**Por qué existe.** El mapa (`meta-para-abrir-a-empresas-reales-2026-11-12.md`) decía «falta la
validación del abogado», «falta el despliegue», «falta la empresa real», y en ninguno de esos casos
había un **pedido escrito** con la pregunta hecha, el insumo entregado y la fecha. El 13-nov-2026 se
escribieron y se emitieron. Sin este registro, un pendiente es una frase; con él, es una fila con
dueño y fecha.

**Cómo se lee el estado de una solicitud:**

| Estado | Qué significa |
|---|---|
| `PREPARADA` | El pedido está escrito, pero **no ha salido**. |
| `EMITIDA` | El pedido **salió** y está con su destinatario. Falta la respuesta. |
| `RESPONDIDA` | El destinatario respondió. Falta aplicar lo que dijo. |
| `CERRADA` | La respuesta se aplicó y se verificó, **o el problema de fondo quedó resuelto y verificado en el repositorio (cierre por resolución)**. |

**El cierre por resolución (13-nov-2026).** Una fila se cierra de dos formas, y las dos quedan
dichas en la fila: **por respuesta aplicada** (el destinatario contestó, se aplicó y se verificó) y
**por resolución** (el problema de fondo está **resuelto y verificado en el repositorio**, aunque el
destinatario no haya contestado con nombre, fecha y SHA). Si la respuesta formal llega después, se
**archiva como ratificación sin reabrir la fila**. El registro es honesto: un cierre por resolución
lleva la anotación **«resuelto por decisión del owner, sin ratificación externa»** — no se finge
validación externa—. **La S-02 también se cerró por resolución**: el owner decidió el 13-nov-2026 que la
validación escrita de un tercero **no es requisito** para la compuerta de la tabla supletoria, y el
código cambió con esa regla (`retencion.js`, `_tablaActivada()`: ahora exige `activada: true` **y**
`activado_at` con fecha, y ya no exige `validado_por` ni `validado_at`). El cambio queda **documentado
y no en silencio**: el código, la tabla de conservación, los candidatos de la v1.4 y este registro dicen
la misma cosa.

**Una respuesta que no es formal (13-nov-2026).** El escrito del abogado matriculado del 13-nov-2026 **no
lleva nombre, fecha de suscripción ni huella de un documento firmado**: es una respuesta **no formal**. Eso
**no cierra** una fila que exija validación formal, pero **tampoco la deja como si nadie hubiera
contestado**: la fila pasa a `RESPONDIDA` (el destinatario respondió) y **lo que dijo se aplica al texto
que lo necesita**. En este caso el escrito **se archivó** en `respuesta-del-abogado-2026-11-13.md` (la
huella del **original** recibido es `cf300b15…52c0e`, 8 451 B; la del archivo está en §2.2), **se aplicó a
la v1.4** —que se regeneró— y **las cuatro filas ya cerradas por resolución se anotaron** con la nota de
que el escrito **se archiva como ratificación, sin reabrir**. La **S-02**, que estaba abierta, pasó a
`RESPONDIDA` —y de ahí a `CERRADA` por resolución del owner, que cambió la regla de la compuerta (§2.2)—:
es la **única** fila que este escrito mueve de estado.

**El criterio del mapa cambió el 13-nov-2026.** Un bloque del mapa se marca **CERRADO** cuando **el
pedido está emitido y medido**, no cuando el acto está cumplido. Los actos de terceros se siguen
**aquí**, con su estado. Un bloque `CERRADO` por solicitud quiere decir: *nuestro trabajo está hecho y
verificado; lo que falta es que un tercero conteste o ejecute, y eso tiene dueño, fecha y
verificación*. El mapa nunca afirma que el servicio pueda abrirse a empresas reales: eso lo dicen los
hechos de cada bloque y el estado de esta tabla.

**Estado de hoy: 25 solicitudes — 19 `EMITIDA`, 6 `CERRADA` (S-01, S-02, S-03, S-04, S-22 y S-23), 0 `RESPONDIDA`.**
Se cierran de dos formas, y las dos quedan escritas en su fila:

- **Por respuesta aplicada: la S-22.** El owner **respondió el 13-nov-2026**: las cinco decisiones del
  procedimiento del canal de `fecha_terminacion` quedaron escritas en el procedimiento, con su fecha y
  su responsable, y la solicitud se cerró al **aplicar y verificar** lo que dijo (§2.1).
- **Por resolución: S-01, S-02, S-03, S-04 y S-23.** El problema de fondo de cada una quedó **resuelto y
  verificado en el repositorio** el 13-nov-2026, con la anotación **«resuelto por decisión del owner,
  sin ratificación externa»**: la respuesta formal del abogado, si llega, se archiva como ratificación
  **sin reabrir la fila** (el detalle de qué resolvió cada una está en «Cierres por resolución», más
  abajo). Lo que estos cinco cierres **no** dicen: que el abogado haya ratificado nada — eso sigue
  pendiente en el mundo, con su bloque y su dueño.

Las **19 restantes** están `EMITIDA`: el pedido salió y falta la respuesta o el acto de su
destinatario. **La S-02 pasó de `EMITIDA` a `RESPONDIDA` y de ahí a `CERRADA` el 13-nov-2026**: el abogado
matriculado **respondió por escrito** (archivado en `respuesta-del-abogado-2026-11-13.md`), y la
**sustancia quedó validada** —los 10 y 5 años son el «sistema de archivo o retención documental» del
art. 2.2.4.6.13 y, como topes de custodia, son compatibles con el art. 2.2.2.25.2.8—. Pero **la fila no
cerraba con ese escrito**: el propio abogado escribió que **no** sustituye la validación formal (§2.2).
El owner decidió entonces que **esa validación formal no es requisito**, cambió la regla de la
compuerta en el código y en la tabla, y la fila se cerró **por resolución** (§2.2). **S-24 sigue
`EMITIDA`** porque es un acto del owner pendiente: **firmar** el procedimiento del canal (§2.1). Y la
**S-25** es otro acto del owner pendiente: **abrir la compuerta** de la tabla supletoria (§2.1).

**La S-24: la firma del owner sobre el procedimiento.** El 13-nov-2026 el owner volvió a escribir las
cinco decisiones del canal (§2.1) y el procedimiento quedó con el estado «**pendiente de firma del
owner** y de la validación del abogado». Ese estado es un **pendiente con dueño**, así que es una
**fila** y no una nota al pie: sin ella, la firma que falta sería un hueco invisible.

**La revisión de la asesoría del 13-nov-2026.** Antes de que salieran, las cuatro solicitudes al abogado
matriculado pasaron por una revisión de la **asesoría jurídica** (9 132 B, `7c1a0e67…`), registrada con su
huella en `revision-asesoria-s01-s04-2026-11-13.md`. Traía **una corrección obligatoria** (la cita del
Decreto 1377: las definiciones están en el **art. 3**, no en el art. 2), **dos avisos** y un punto a
favor. La corrección ya está aplicada **en la fuente y en el documento enviable**; los dos avisos se
incorporaron **como preguntas al abogado**. **Eso no cerró nada**: la revisión **no es la respuesta
del abogado matriculado** —el propio escrito lo dice: «No sustituye la decisión del abogado
matriculado ni del representante legal»—, de modo que en ese momento había **0 `RESPONDIDA`**: **S-02 seguía
`EMITIDA`**, y **S-01, S-03 y S-04 se cerraron ese mismo día por resolución** (ver «Cierres por resolución»), no
por la revisión ni por respuesta. **Hoy la S-02 está `CERRADA` por resolución del owner** (§2.2): el
escrito del abogado matriculado del 13-nov-2026 la movió a `RESPONDIDA` y la resolución del owner la
cerró.

---

## 1. Solicitudes al abogado matriculado

Son las que dependen de un escrito jurídico. Van en `solicitudes-al-abogado-2026-11-13.md`, que es el
documento que se le manda.

| ID | Bloque | Destinatario | Qué se pide | Cómo se verifica | Estado | Vence |
|---|---|---|---|---|---|---|
| S-01 | M.5 | Abogado matriculado | Ratificar (o corregir) L1 —el papel de Google: Google LLC, doble papel Responsable/Encargado, transmisión internacional y no transferencia, art. 26 no se activa— y L2 —la Circular Externa 002/2025, cuyo contenido **no está verificado por nosotros** y cuya aplicación al canal de correo y a la transferencia del software **confirma el abogado**, y el RNBD—; y pronunciarse sobre las correcciones 0.5 y 0.6 del texto | Escrito con nombre, fecha y SHA-256 del documento — **cerrada por resolución** (13-nov-2026): resuelto por decisión del owner, sin ratificación externa; **el escrito del abogado (no formal) se archivó el 13-nov-2026 como ratificación, sin reabrir la fila** | CERRADA | 2026-11-20 |
| S-02 | M.6 | Abogado matriculado | Validar por escrito los plazos de conservación de 10 y 5 años y las condiciones C1 a C4 de la tabla supletoria | `validado_por` (nombre y tarjeta o CC), `validado_at` (fecha de la opinión), `validado_por_documento` (ruta) y SHA-256 del escrito — **respondida** (13-nov-2026): el abogado validó la sustancia (los 10 y 5 años son el sistema de archivo o retención documental del art. 2.2.4.6.13 y son compatibles con el art. 2.2.2.25.2.8) y dijo que **no cerraba**: el candado exigía `validado_por` y `validado_at` de un abogado matriculado y **no los sustituye**. La enumeración de C1 a C4 **no se recibió** (el original está truncado) — **cerrada por resolución** (13-nov-2026): resuelto por decisión del owner, sin ratificación externa; el owner decidió que la validación escrita de un tercero **no es requisito** para la compuerta, cambió la regla en el código (`retencion.js`, `_tablaActivada()`) y en `config/tabla-conservacion.json`, y lo dejó medido y anotado; **el escrito del abogado (no formal) se archivó el 13-nov-2026 como ratificación, sin reabrir la fila**. Lo que este cierre **no** dice: que el abogado haya ratificado nada — L1, L2 y las condiciones C1 a C4 siguen sin ratificación externa en el mundo (M.5) | CERRADA | 2026-11-20 |
| S-03 | M.18 | Abogado matriculado | Revisar y redactar la v1.4 del Anexo de Nube y el Anexo de Encargo 2026-11-12, y opinar sobre las nueve identificaciones de versión marcadas `ext` | Texto final devuelto, con su huella, o sus correcciones sobre el candidato — **cerrada por resolución** (13-nov-2026): resuelto por decisión del owner, sin ratificación externa; **el escrito del abogado (no formal) se archivó el 13-nov-2026 como ratificación, sin reabrir la fila**; el texto final lo redacta K+AIR con la autorización del owner | CERRADA | 2026-11-20 |
| S-04 | M.28 y M.7 | Abogado matriculado | Ratificar L4 y L5 (el respaldo en Backblaze B2: transmisión, no transferencia; Backblaze como subencargado; bucket en la región US) y validar las cláusulas mínimas del art. 25 del Decreto 1377 para el contrato con el proveedor; y contestar **de forma expresa** si la condición de región US es **exigencia legal** o **decisión conservadora de K+AIR** | Texto final de la cláusula, con su huella, y la respuesta a la pregunta de la región — **cerrada por resolución** (13-nov-2026): resuelto por decisión del owner, sin ratificación externa; **el escrito del abogado (no formal) se archivó el 13-nov-2026 como ratificación, sin reabrir la fila**, y **contestó de forma expresa la pregunta**: la región US **no es una exigencia legal**, es **decisión conservadora de K+AIR** | CERRADA | 2026-11-20 |

### Qué cambió con la revisión de la asesoría (13-nov-2026)

Lo que sigue **cambia el pedido, no el estado**: una revisión de la asesoría **no es una respuesta del
abogado**. Ese día **S-01, S-03 y S-04 se cerraron después por resolución** — no por la revisión ni
por respuesta— y **S-02 seguía `EMITIDA`** (era la excepción de la compuerta); hoy está `CERRADA` por
resolución del owner (§2.2), después de que el escrito del abogado del 13-nov-2026 contestara el
pedido sin poder cerrarlo.

- **S-01.** Dos cambios. La cita de la transmisión internacional quedó corregida en la fuente: **art. 3
  num. 5** del Decreto 1377 de 2013 (las definiciones están en el art. 3, no en el art. 2), y lo mismo
  con **art. 3 num. 4** para la transferencia. Y el **contenido de la Circular Externa 002 de 2025 quedó
  marcado como no verificado**: que no aplique al canal de correo y que sí aplique a la transferencia del
  software es **lo que confirma el abogado**, no un hecho dado por cierto. Ese aviso entró al pedido.
- **S-02.** El pedido no cambia. La asesoría confirmó que la tabla supletoria **ya materializa** la
  condición **C3** (el piso legal no lo puede bajar la tabla de la Empresa) y el cómputo en años
  calendario (**C2**): el abogado valida sobre un texto que ya respeta el mínimo de ley. Y el
  13-nov-2026 el owner cambió la regla: esa validación **ya no es requisito** para abrir la compuerta
  (§2.2).
- **S-03.** El pedido no cambia. La corrección de la cita llegó a los dos candidatos por el generador,
  que lee el literal del dictamen en runtime: el texto corregido llega solo, sin transcribirlo.
- **S-04.** Se añadió **la pregunta expresa**: ¿la condición de región **United States** del bucket es una
  **exigencia legal** o una **decisión conservadora de K+AIR**? De la respuesta depende cómo se redacta la
  v1.4: como obligación normativa o como decisión propia declarada.

### S-23 — La validación del procedimiento del canal (va en un documento aparte)

Es la única solicitud al abogado que **no** va en `solicitudes-al-abogado-2026-11-13.md`: tiene su propio
documento, `solicitud-al-abogado-validacion-procedimiento-2026-11-13.md`, porque no pide una determinación
sino una **validación** sobre un documento que ya existe.

| ID | Bloque | Destinatario | Qué se pide | Cómo se verifica | Estado | Vence |
|---|---|---|---|---|---|---|
| S-23 | M.31 | Abogado matriculado | Validar por escrito el **procedimiento del canal de `fecha_terminacion`** (`procedimiento-canal-fecha-terminacion-2026-10-31.md`) como **evidencia del canal del §6 del Anexo de Encargo**: es el **punto 1.3 de su propio plan de cierre** del 31-oct-2026 | Escrito con nombre, fecha y SHA-256, con su pronunciamiento sobre el §9.2 del procedimiento; si corrige algo, con la redacción literal — **cerrada por resolución** (13-nov-2026): resuelto por decisión del owner, sin ratificación externa; **el escrito del abogado (no formal) se archivó el 13-nov-2026 como ratificación, sin reabrir la fila**, y **validó la solidez jurídica del procedimiento**, pero **no** dio la validación formal del §9.2 | CERRADA | 2026-11-27 |

**Por qué se registró el 13-nov-2026, y por qué estabasepues.** Las **cinco decisiones del owner** del
procedimiento quedaron escritas ese día (§2.1): con ellas se cerró la **S-22**. Pero el §9 del procedimiento
tiene **dos mitades**, y la otra es del abogado: el **§9.2**, que es la validación del procedimiento como
evidencia del canal. **Esa mitad nunca se le pidió por escrito**, así que no tenía ni bloque en el mapa, ni
fila en esta tabla, ni dueño, ni fecha: era un hueco invisible. Ahora es una fila con las cinco cosas que
esta tabla exige de un pedido.

### Cierres por resolución (13-nov-2026)

Cinco filas pasaron de `EMITIDA` a `CERRADA` ese día por **resolución**, no por respuesta: el
problema de fondo de cada una quedó **resuelto y verificado en el repositorio**, y la anotación de las
cinco es la misma: **«resuelto por decisión del owner, sin ratificación externa»**. Lo que esto
**no** dice: que el abogado haya ratificado nada. Si su escrito llega después —con nombre, fecha y
SHA-256— se **archiva como ratificación** en esta tabla, **sin reabrir la fila**. Riesgo asumido y
registrado: **L1, L4 y L5 quedan como criterio interno de K+AIR sin ratificación externa**; si el
abogado vuelve y corrige, la corrección se aplica en la siguiente versión de los textos y la
ratificación queda retroactiva (precedente M.15).

- **S-01.** *Quedó resuelto y verificado:* el dictamen L1 está escrito con sus trece correcciones
  (incluida la **0.13**, la cita del Decreto 1377 en el **art. 3 num. 5**), la Circular Externa 002/2025
  quedó marcada como **contenido no verificado** y como pregunta expresa al abogado, y el pedido salió
  con su insumo y su huella (`dictamen-legal-l1-2026-11-12.md`, 114 882 B / `d77e6d8b…87a04`, re-medido
  el 13-nov-2026 después de aplicar el escrito del abogado).
  *Sigue pendiente en el mundo:* la **ratificación externa** de L1 y L2 (M.5).
- **S-02.** *Quedó resuelto y verificado:* el owner decidió el 13-nov-2026 que la **validación escrita
  de un tercero no es requisito** para la compuerta de la tabla supletoria, y la regla cambió en el
  código (`retencion.js`, `_tablaActivada()`: ahora exige `activada: true` **y** `activado_at` con
  fecha, y ya no exige `validado_por` ni `validado_at`) y en `config/tabla-conservacion.json` (que
  queda con `activada: false` y `activado_at` en `null`: la compuerta **sigue cerrada**). El Anexo de
  Encargo 2026-11-12 se regeneró con el texto que dice esa regla y el §8 del candidato publica la
  fecha real de su fuente. *Sigue pendiente en el mundo:* la **ratificación externa** de L1, L2 y de
  las condiciones C1 a C4 (M.5), que no se exigen para abrir la compuerta pero siguen sin estar, y el
  **acto de apertura** del owner (S-25, M.30).
- **S-03.** *Quedó resuelto y verificado:* los dos candidatos de la **v1.4** ya existen con la
  corrección de la cita aplicada por el generador en runtime (`candidatos-v1.4/anexo-nube-v1.4.html`,
  **111 462 B / `ba664e6f…e3b47`**; `candidatos-v1.4/anexo-encargo-2026-11-12.html`, **100 396 B /
  `b345ab87…3a749`**, cifras del 13-nov-2026 tras el escrito del abogado y tras el cambio de la regla
  de la compuerta, §2.2), y el pedido quedó con su insumo y su huella. *Sigue pendiente en el mundo:* la
  **suscripción y publicación** de la v1.4 con huella real (M.18) y la revisión del abogado, si llega.
- **S-04.** *Quedó resuelto y verificado:* las cláusulas L4 y L5 y las cláusulas mínimas del **art. 25
  del Decreto 1377** quedaron escritas en los candidatos, y la condición de **región US** del bucket
  quedó declarada como **decisión conservadora de K+AIR** —no como exigencia legal verificada—, con la
  pregunta expresa al abogado. *Sigue pendiente en el mundo:* la ratificación de L4/L5 (M.28 y M.7) y la
  verificación del **Título V**, que el escrito del 13-nov-2026 declaró **no verificado**. La **pregunta de
  la región** sí quedó contestada de forma expresa ese día: **no es una exigencia legal**.
- **S-23.** *Quedó resuelto y verificado:* el **procedimiento del canal** quedó con las cinco
  decisiones escritas y medido con su huella (16 872 B / `5a817b38…e04e`), y el pedido quedó emitido
  con su documento. *Sigue pendiente en el mundo:* la **validación formal** del abogado sobre el §9.2
  (M.31).

---

## 2. Solicitudes de ejecución (owner y equipo)

| ID | Bloque | Destinatario | Qué se pide | Cómo se verifica | Estado | Vence |
|---|---|---|---|---|---|---|
| S-05 | M.1 | Owner | El recorrido completo con una **empresa real**: alta, suscripción del Anexo de Nube v1.3 y del Anexo de Encargo 2026-11-11 por esa empresa, contrafirma de K+AIR, primera solicitud de firma, primer OTP y primera constancia emitida | La evidencia queda en el manifiesto, con la empresa y su huella | EMITIDA | Sin fecha: depende de una empresa real |
| S-06 | M.2 | Owner | Encender `FIRMA_EXIGIR_ANEXO_NUBE=true` en el entorno del servicio y reiniciar; después correr el preflight con `--exigir-compuerta`, que tiene que dar 0 | Salida fechada del preflight con la bandera encendida | EMITIDA | 2026-11-30 |
| S-07 | M.3 | Owner | Que en **producción** un Trabajador declare un buzón corporativo de una Empresa real y el asiento quede en `gh_firma_eventos` de producción | `select count(*) ... where evento='OTP_MEDIO_CORPORATIVO'` deja de dar 0 en la base de producción | EMITIDA | Sin fecha: depende de una empresa real |
| S-08 | M.4 | Owner | Firmar la autorización operativa del representante legal (A4) con la versión y la huella que se autorizan | El acta con la huella del texto autorizado | EMITIDA | 2026-11-30 |
| S-09 | M.7 | Owner | Abrir la cuenta y crear el bucket de Backblaze B2 **en la región United States**, con su llave; ejecutar la activación con `sudo`; guardar `backup.passphrase` **fuera del servidor y fuera del bucket**; verificar la primera copia por SHA-256; probar la restauración; y rotar | Copia verificada por hash, `restauracion.log` del cron y huella de la copia fuera del servidor | EMITIDA | 2026-11-30 |
| S-10 | M.8 | Owner | Desplegar el 📦1051 **con el paso de instalación**: `npm ci --omit=dev` con el servicio parado, antes de las migraciones; y volver a medir las versiones en el servidor | Las versiones medidas en el servidor, no en el repo | EMITIDA | 2026-11-30 |
| S-11 | M.9 | Owner | Aplicar el paso 2b del runbook: quitar los permisos 777 a los 236 archivos | `ls -l` sobre el árbol desplegado | EMITIDA | 2026-11-27 |
| S-12 | M.10 | Owner | Una corrida controlada de extremo a extremo contra el código desplegado hoy: crear la solicitud, enviar la invitación, firmar desde el celular y descargar la constancia; después retirar el rastro y dejar el acta | El acta de la corrida, con el rastro ya retirado | EMITIDA | Sin fecha: depende de una persona con celular y de una empresa real |
| S-13 | M.11 | Owner | Crear los tres alias de Workspace y verificarlos con un envío real a cada uno | Message-ID y cabeceras de cada envío, en el manifiesto | EMITIDA | 2026-11-30 |
| S-14 | M.12 | Owner | Desplegar la corrección del programa de reversión en `/opt/kair-firma/app`, y hacer la prueba de la **restauración cifrada real** (los `.enc` y `backup.passphrase` son `600 root`) | `restauracion.log` del cron `0 4 1 * *` (primera corrida el 1-dic-2026) | EMITIDA | 2026-12-01 |
| S-15 | M.13 | Owner | Desplegar (cierra las dos altas vivas en producción) y hacer un envío real contra SMTP, que la suite no cubre porque usa `jsonTransport` | `npm audit` en el servidor con 0 y la entrega real registrada | EMITIDA | 2026-11-30 |
| S-16 | M.14 | Owner | La ventana de mantenimiento: desactivar el cron, subir el runtime, recompilar el módulo nativo, verificar con el script y su rollback | El log de la ventana, con el runtime y la versión verificados | EMITIDA | 2026-11-30 |
| S-17 | M.16 | Equipo | Correr `scripts/inventario-buzon-corporativo.js` cuando exista al menos una solicitud real con un caso rechazado | La salida del script y el item `d02.inventario_buzones` del manifiesto | EMITIDA | Sin fecha: depende de un caso real (S-07) |
| S-18 | M.19 | Owner | Un `grep` sobre el `.env` que deje constancia del valor efectivo de `TRUST_PROXY` | La salida del `grep`, fechada | EMITIDA | 2026-11-27 |
| S-19 | M.21 | Owner | Instalar y configurar el canal que avisa del parpadeo del túnel: `health-check.sh`, el `netrc` en modo 600 y el cron | La entrega al webhook y el aviso recibido | EMITIDA | 2026-11-30 |
| S-20 | M.23 | Owner | Instalar la rotación de logs con sus permisos: `logrotate-kair-firma.conf`, `750` en el directorio y `640` en los archivos | `logrotate -d` y `ls -ld` sobre `/opt/kair-firma/logs` | EMITIDA | 2026-11-30 |
| S-21 | M.24 | Owner | El despliegue que instale el sello de versión, y su comprobación en el servidor | `cat /opt/kair-firma/app/VERSION` y `generar-sello-version.js --comprobar` | EMITIDA | 2026-11-30 |
| S-22 | M.31 | Owner | Las **cinco decisiones del procedimiento del canal de `fecha_terminacion`** (`procedimiento-canal-fecha-terminacion-2026-10-31.md`, redactado el 31-oct y aún sin validar): (1) **quién es el operador** —el administrador de K+AIR en nombre de la Empresa, o el sistema de la Empresa llamando al servicio—; (2) **si el llamante es la Empresa o K+AIR**; (3) **qué evidencia se acepta** —el código exige un texto, el Anexo exige «la evidencia de la comunicación»—; (4) el **plazo máximo de espera** que la Empresa se compromete a cumplir; y (5) la **frecuencia de la revisión periódica** | Las cinco decisiones **escritas** en el procedimiento, con su fecha y su responsable; la validación del abogado sobre el procedimiento es de otro dueño y no se espera aquí | CERRADA | 2026-11-27 |
| S-24 | M.31 | Owner | **Firmar el procedimiento del canal de `fecha_terminacion`** (`procedimiento-canal-fecha-terminacion-2026-10-31.md`, 16 872 B, sha256 `5a817b38…e04e`): el documento ya trae las **cinco decisiones** escritas el 13-nov-2026 y su encabezado dice «pendiente de firma del owner y de la validación del abogado» | El acta de la firma, con la huella del texto que se firma | EMITIDA | 2026-11-20 |
| S-25 | M.30 | Owner | **Abrir la compuerta de la tabla supletoria de conservación**: poner `aplicacion.activada` en `true` y `aplicacion.activado_at` con la fecha del acto, en `config/tabla-conservacion.json` (la regla del 13-nov-2026: la abre un acto expreso y **fechado** del owner; la validación escrita de un tercero ya no es requisito) | La tabla con `activada: true` y `activado_at` con fecha, y la suite completa en verde antes y después (abrir la compuerta cambia el comportamiento del servicio: los plazos por defecto de diez (10) y cinco (5) años empiezan a aplicar) | EMITIDA | 2026-11-30 |

### 2.1 Lo que se respondió el 13-nov-2026

Una sola respuesta, y es la del **owner**: la **S-22**. Se aplicó el mismo día y se verificó, así que
la fila pasó de `EMITIDA` a `CERRADA` —el ciclo completo, con la respuesta aplicada y comprobada,
no solo registrada—. Ese mismo día se cerraron además **cinco filas de la sección 1 por resolución**
(S-01, S-02, S-03, S-04 y S-23): no hubo respuesta formal, hubo decisión del owner; el detalle está en
«Cierres por resolución».

| Quién respondió | ID | Qué respondió | Dónde quedó escrito | Fecha |
|---|---|---|---|---|
| Owner | S-22 | Las **cinco decisiones** del procedimiento del canal de `fecha_terminacion`: (1) el operador es **una persona administradora de K+AIR** nombrada en `X-Admin-Actor`, por cuenta de la Empresa y sobre su instrucción y evidencia; (2) el **origen de la novedad es la Empresa** y la **ejecución es de K+AIR**; (3) la **guía de aceptación de la evidencia**: texto de hasta 1 000 caracteres con cuatro datos mínimos (quién comunica, fecha de la comunicación, soporte identificable, fecha de cese coherente con el soporte); (4) el **plazo máximo de espera es de 30 días calendario** desde el cese (o desde el primer aviso, para las filas anteriores); (5) la **revisión es mensual**, el primer día hábil, con aviso a la Empresa a los 30 días y reporte al representante legal a los 90 | `procedimiento-canal-fecha-terminacion-2026-10-31.md`: §3.1, §3.2, §4, §5a, §5b y el **Anexo A** (guía de aceptación con un ejemplo que se acepta y uno que no) | 13-nov-2026 |

**Lo que esta respuesta NO cierra.** La **validación del abogado** sobre el procedimiento (§9.2) es
de otro dueño y sigue pendiente. Y el canal **sigue sin ninguna operación en producción** (medido
por SSH el 13-nov-2026: 0 comunicaciones, 0 eventos, 0 filas con el hold `fecha_cese_pendiente`).

**Lo que pasó después, el mismo día.** El owner volvió a escribir las cinco decisiones y pidió
aplicarlas. Al cotejar su texto con lo que ya estaba escrito en el procedimiento, **el contenido era
el mismo**: las cinco ya estaban escritas desde la ronda anterior, con su *por qué* y su
*consecuencia*. Lo que cambió fue esto: el **ejemplo del Anexo A** pasa a ser el del owner; el
encabezado del procedimiento declara «**pendiente de firma del owner**», y ese pendiente quedó
registrado como la **S-24**; y el §9.1 del procedimiento nombra la firma que falta. **La S-22 no se
reabre** —sus cinco decisiones estaban escritas y verificadas; lo que el owner mandó fue repetirlas,
no corregirlas— y **la S-23 se cerró más tarde ese mismo día por resolución** (ver «Cierres por
resolución»): el problema de fondo —el procedimiento con las cinco decisiones— quedó resuelto y
verificado con su huella, y la validación formal del abogado, si llega, se archiva **sin reabrir la
fila**.

### 2.2 Lo que respondió el abogado matriculado el 13-nov-2026 (escrito no formal)

| Quién respondió | ID | Qué respondió | Dónde quedó escrito | Fecha |
|---|---|---|---|---|
| Abogado matriculado (escrito **no formal**) | S-01, S-02, S-03, S-04, S-23 | El **núcleo normativo verificado**: doble papel de Google, transmisión y no transferencia, art. 26 **no** activado, art. 24 num. 2 + art. 25; la Circular 002 leída **en su literal** (el canal de correo **fuera** de su alcance, la **transferencia del software a la Empresa dentro de su supuesto (ii)**); el RNBD medido por los activos de cada Responsable; la transmisión de Backblaze y las tres obligaciones del art. 25; y la **respuesta expresa**: la región US **no es una exigencia legal**, es **decisión conservadora de K+AIR** | `respuesta-del-abogado-2026-11-13.md` (**18 980 B**), con el **original verbatim** de 8 451 B / `cf300b15…52c0e` (SHA-256 del original recibido) | 13-nov-2026 |

**Qué se hizo con ese escrito.** Se **archivó** (el original está **truncado** en «Las condiciones se
sostienen:», y el **punto 4** (S-23) llegó aparte), **se aplicó a la v1.4** —los cambios entraron por la
**fuente** (el dictamen L1 y el pedido de Backblaze) y los candidatos se **regeneraron**— y **se anotaron
las cuatro filas que ya estaban cerradas por resolución** (S-01, S-03, S-04 y S-23) con la nota de que el
escrito **se archiva como ratificación, sin reabrir**. El detalle de los cinco cambios de texto está en el
§4 del archivo.

**Qué NO hizo.** No llevaba **nombre**, **fecha de suscripción** ni **huella de un documento firmado**, así que
**no cierra ninguna fila** por sí solo; y el propio abogado escribió que **no puede sustituir la redacción**
(S-03) ni **dar la validación formal del §9.2** (S-23). Por eso **la S-02 fue la única fila que este escrito
movió de estado**: pasó de `EMITIDA` a **`RESPONDIDA`**, con la sustancia validada y con el candado de
`retencion.js` **sin abrir** (`validado_por` y `validado_at` reales seguían siendo lo que faltaba).

**Y lo que pasó después con esa fila (13-nov-2026).** El owner decidió que **la validación escrita de un
tercero no es requisito** para la compuerta de la tabla supletoria, y cambió la regla donde vive:
`retencion.js` (`_tablaActivada()`) ahora exige `activada: true` **y** `activado_at` con fecha, y ya no
exige `validado_por` ni `validado_at`; `config/tabla-conservacion.json` lo declara, con la nota que
explica qué es lo que la abre y qué ya no se exige; y el Anexo de Encargo 2026-11-12 se regeneró con el
texto que dice la regla nueva. Con eso **la S-02 se cerró por resolución**. Lo que el escrito del abogado
**no** dejó de ser: una ratificación externa. L1, L2 y las condiciones C1 a C4 **siguen** sin ratificar, y
eso se sigue en el mundo, con su bloque y su dueño (M.5).

---

## 3. Lo que estas solicitudes NO hacen

- **No abren el servicio a empresas reales.** El mapa sigue diciendo, bloque por bloque, qué hecho falta
  en el mundo: que haya una empresa real, que la compuerta esté encendida, que los permisos no sean
  777, que el respaldo exista fuera del servidor. Emitir un pedido no cambia ninguno de esos hechos.
- **No sustituyen la respuesta del abogado.** Las cinco solicitudes al abogado están **`CERRADA` por
  resolución y sin ratificación externa** —el cierre lo dice en su fila: «resuelto por decisión del owner,
  sin ratificación externa»—, incluida la **S-02**, que además cuenta con el escrito del abogado
  (respondido el 13-nov-2026, aplicado al texto, archivado como ratificación **sin reabrir**). Ninguna se
  cerró **con** la respuesta formal del abogado: la v1.4 sigue sin firmar y el manifiesto legal sigue con
  sus dos notas. Y lo que un cierre por resolución **no** dice: que el abogado haya ratificado nada.
- **No cierran los textos suscritos.** La v1.3 del Anexo de Nube y el Anexo de Encargo 2026-11-11
  quedan como están, con su huella.
- **No authorizes el despliegue.** Cada ejecución de esta tabla es un acto del owner, con su `sudo`.
- **No son todas de ejecución.** **S-22** era una **decisión de procedimiento**: el código del canal de
  `fecha_terminacion` ya existe y ya tiene prueba, y lo que faltaban eran **cinco decisiones escritas del
  owner** (quién opera, quién llama, qué evidencia se acepta, el plazo máximo de espera y la frecuencia
  de la revisión) más la validación del abogado sobre el procedimiento. Emitir la solicitud no escribía
  esas decisiones: las escribió el owner el 13-nov-2026, y por eso esa fue **la primera fila
  `CERRADA`** de la tabla —hoy son seis: la S-22 por respuesta y cinco por resolución—. La
  **validación del abogado** sobre el procedimiento **sigue pendiente en el mundo**, y es de otro
  dueño: es lo que pedía la **S-23**, que se cerró por resolución, no por respuesta.
- **Ninguna respuesta del owner sustituye al abogado.** Las cinco decisiones de la S-22 son del **owner**
  y son de **procedimiento**: dicen quién opera y qué evidencia se acepta. No ratifican ni validan nada
  del abogado matriculado, y no pueden hacerlo: una decisión de K+AIR no es una determinación jurídica.
  Por eso la S-22 se cerró **sin** que se cerrara ninguna de las cinco solicitudes al abogado, y por eso
  los cierres por resolución de **S-01, S-02, S-03, S-04 y S-23** cierran **el pedido**, no la ratificación:
  la anotación lo dice («sin ratificación externa»), y la ratificación sigue pendiente en M.5, M.18,
  M.28/M.7 y M.31.
- **Lo que sí cambió por decisión del owner (13-nov-2026).** Que la **validación escrita de un tercero
  dejó de ser requisito** para la compuerta de la tabla supletoria: la abre un acto expreso y **fechado**
  del owner (`activada: true` más `activado_at`). Eso no ratifica nada del abogado: cambia **qué falta**
  para abrir la compuerta, no lo que el abogado dijo. El escrito del 13-nov-2026 sigue archivado como
  ratificación, y el acto de abrir la compuerta es la **S-25**.
