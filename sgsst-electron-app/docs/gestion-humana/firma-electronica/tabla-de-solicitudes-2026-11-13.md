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
| `CERRADA` | La respuesta se aplicó y se verificó. |

**El criterio del mapa cambió el 13-nov-2026.** Un bloque del mapa se marca **CERRADO** cuando **el
pedido está emitido y medido**, no cuando el acto está cumplido. Los actos de terceros se siguen
**aquí**, con su estado. Un bloque `CERRADO` por solicitud quiere decir: *nuestro trabajo está hecho y
verificado; lo que falta es que un tercero conteste o ejecute, y eso tiene dueño, fecha y
verificación*. El mapa nunca afirma que el servicio pueda abrirse a empresas reales: eso lo dicen los
hechos de cada bloque y el estado de esta tabla.

**Estado de hoy: 24 solicitudes — 23 `EMITIDA`, 1 `CERRADA` (S-22), 0 `RESPONDIDA`.** La única
cerrada es la **S-22**, que el owner **respondió el 13-nov-2026**: las cinco decisiones del
procedimiento del canal de `fecha_terminacion` quedaron escritas en el procedimiento, con su
fecha y su responsable, y la solicitud se cerró al **aplicar y verificar** lo que dijo (§2.1). Las
23 restantes están `EMITIDA`: el pedido salió y falta la respuesta de su destinatario. Las cinco
solicitudes al abogado matriculado (S-01 a S-04 y S-23) están escritas y con su huella; **su envío
por el canal que use el owner queda pendiente de su confirmación**, y el registro las marca `EMITIDA`
porque el owner así lo decidió (13-nov-2026).

**La S-24: la firma del owner sobre el procedimiento.** El 13-nov-2026 el owner volvió a escribir las
cinco decisiones del canal (§2.1) y el procedimiento quedó con el estado «**pendiente de firma del
owner** y de la validación del abogado». Ese estado es un **pendiente con dueño**, así que es una
**fila** y no una nota al pie: sin ella, la firma que falta sería un hueco invisible.

**La revisión de la asesoría del 13-nov-2026.** Antes de que salieran, las cuatro solicitudes al abogado
matriculado pasaron por una revisión de la **asesoría jurídica** (9 132 B, `7c1a0e67…`), registrada con su
huella en `revision-asesoria-s01-s04-2026-11-13.md`. Traía **una corrección obligatoria** (la cita del
Decreto 1377: las definiciones están en el **art. 3**, no en el art. 2), **dos avisos** y un punto a
favor. La corrección ya está aplicada **en la fuente y en el documento enviable**; los dos avisos se
incorporaron **como preguntas al abogado**. **El estado no cambia por eso**: la revisión **no es la
respuesta del abogado matriculado** —el propio escrito lo dice: «No sustituye la decisión del abogado
matriculado ni del representante legal»—, de modo que **S-01 a S-04 siguen `EMITIDA` y 0 `RESPONDIDA`**.

---

## 1. Solicitudes al abogado matriculado

Son las que dependen de un escrito jurídico. Van en `solicitudes-al-abogado-2026-11-13.md`, que es el
documento que se le manda.

| ID | Bloque | Destinatario | Qué se pide | Cómo se verifica | Estado | Vence |
|---|---|---|---|---|---|---|
| S-01 | M.5 | Abogado matriculado | Ratificar (o corregir) L1 —el papel de Google: Google LLC, doble papel Responsable/Encargado, transmisión internacional y no transferencia, art. 26 no se activa— y L2 —la Circular Externa 002/2025, cuyo contenido **no está verificado por nosotros** y cuya aplicación al canal de correo y a la transferencia del software **confirma el abogado**, y el RNBD—; y pronunciarse sobre las correcciones 0.5 y 0.6 del texto | Escrito con nombre, fecha y SHA-256 del documento | EMITIDA | 2026-11-20 |
| S-02 | M.6 | Abogado matriculado | Validar por escrito los plazos de conservación de 10 y 5 años y las condiciones C1 a C4 de la tabla supletoria | `validado_por` (nombre y tarjeta o CC), `validado_at` (fecha de la opinión), `validado_por_documento` (ruta) y SHA-256 del escrito | EMITIDA | 2026-11-20 |
| S-03 | M.18 | Abogado matriculado | Revisar y redactar la v1.4 del Anexo de Nube y el Anexo de Encargo 2026-11-12, y opinar sobre las nueve identificaciones de versión marcadas `ext` | Texto final devuelto, con su huella, o sus correcciones sobre el candidato | EMITIDA | 2026-11-20 |
| S-04 | M.28 y M.7 | Abogado matriculado | Ratificar L4 y L5 (el respaldo en Backblaze B2: transmisión, no transferencia; Backblaze como subencargado; bucket en la región US) y validar las cláusulas mínimas del art. 25 del Decreto 1377 para el contrato con el proveedor; y contestar **de forma expresa** si la condición de región US es **exigencia legal** o **decisión conservadora de K+AIR** | Texto final de la cláusula, con su huella, y la respuesta a la pregunta de la región | EMITIDA | 2026-11-20 |

### Qué cambió con la revisión de la asesoría (13-nov-2026)

Lo que sigue **cambia el pedido, no el estado**. Las cuatro filas de arriba siguen `EMITIDA`: una revisión
de la asesoría **no es una respuesta del abogado**.

- **S-01.** Dos cambios. La cita de la transmisión internacional quedó corregida en la fuente: **art. 3
  num. 5** del Decreto 1377 de 2013 (las definiciones están en el art. 3, no en el art. 2), y lo mismo
  con **art. 3 num. 4** para la transferencia. Y el **contenido de la Circular Externa 002 de 2025 quedó
  marcado como no verificado**: que no aplique al canal de correo y que sí aplique a la transferencia del
  software es **lo que confirma el abogado**, no un hecho dado por cierto. Ese aviso entró al pedido.
- **S-02.** El pedido no cambia. La asesoría confirmó que la tabla supletoria **ya materializa** la
  condición **C3** (el piso legal no lo puede bajar la tabla de la Empresa) y el cómputo en años
  calendario (**C2**): el abogado valida sobre un texto que ya respeta el mínimo de ley.
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
| S-23 | M.31 | Abogado matriculado | Validar por escrito el **procedimiento del canal de `fecha_terminacion`** (`procedimiento-canal-fecha-terminacion-2026-10-31.md`) como **evidencia del canal del §6 del Anexo de Encargo**: es el **punto 1.3 de su propio plan de cierre** del 31-oct-2026 | Escrito con nombre, fecha y SHA-256, con su pronunciamiento sobre el §9.2 del procedimiento; si corrige algo, con la redacción literal | EMITIDA | 2026-11-27 |

**Por qué se registró el 13-nov-2026, y por qué estabasepues.** Las **cinco decisiones del owner** del
procedimiento quedaron escritas ese día (§2.1): con ellas se cerró la **S-22**. Pero el §9 del procedimiento
tiene **dos mitades**, y la otra es del abogado: el **§9.2**, que es la validación del procedimiento como
evidencia del canal. **Esa mitad nunca se le pidió por escrito**, así que no tenía ni bloque en el mapa, ni
fila en esta tabla, ni dueño, ni fecha: era un hueco invisible. Ahora es una fila con las cinco cosas que
esta tabla exige de un pedido.

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

### 2.1 Lo que se respondió el 13-nov-2026

Una sola respuesta, y es la del **owner**: la **S-22**. Se aplicó el mismo día y se verificó, así que
la fila pasó de `EMITIDA` a `CERRADA` —el ciclo completo, con la respuesta aplicada y comprobada,
no solo registrada—.

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
no corregirlas— y **la S-23 no se cierra**: se cierra cuando el abogado devuelva su escrito con
nombre, fecha y SHA-256.

---

## 3. Lo que estas solicitudes NO hacen

- **No abren el servicio a empresas reales.** El mapa sigue diciendo, bloque por bloque, qué hecho falta
  en el mundo: que haya una empresa real, que la compuerta esté encendida, que los permisos no sean
  777, que el respaldo exista fuera del servidor. Emitir un pedido no cambia ninguno de esos hechos.
- **No sustituyen la respuesta del abogado.** Las cuatro solicitudes al abogado están `EMITIDA`: se
  pidieron, no se respondieron. La v1.4 sigue sin firmar y el manifiesto legal sigue con sus dos notas.
- **No cierran los textos suscritos.** La v1.3 del Anexo de Nube y el Anexo de Encargo 2026-11-11
  quedan como están, con su huella.
- **No authorizes el despliegue.** Cada ejecución de esta tabla es un acto del owner, con su `sudo`.
- **No son todas de ejecución.** **S-22** era una **decisión de procedimiento**: el código del canal de
  `fecha_terminacion` ya existe y ya tiene prueba, y lo que faltaban eran **cinco decisiones escritas del
  owner** (quién opera, quién llama, qué evidencia se acepta, el plazo máximo de espera y la frecuencia
  de la revisión) más la validación del abogado sobre el procedimiento. Emitir la solicitud no escribía
  esas decisiones: las escribió el owner el 13-nov-2026, y por eso es **la única fila `CERRADA`** de la
  tabla. La **validación del abogado** sobre el procedimiento **sigue pendiente**, y es de otro dueño:
  es lo que pide la **S-23**.
- **Ninguna respuesta del owner sustituye al abogado.** Las cinco decisiones de la S-22 son del **owner**
  y son de **procedimiento**: dicen quién opera y qué evidencia se acepta. No ratifican ni validan nada
  del abogado matriculado, y no pueden hacerlo: una decisión de K+AIR no es una determinación jurídica.
  Por eso la S-22 se cerró **sin** que se cerrara ninguna de las cinco solicitudes al abogado.
