# K+AIR — Historial de trabajo

> **Para qué existe este archivo:** que cualquier modelo o persona que retome el desarrollo
> sepa **exactamente dónde quedó todo**, sin tener que leer 4 800 líneas de bitácora.
>
> No reemplaza a ningún otro documento, se suma:
>
> | Archivo | Responde a… |
> |---|---|
> | `PROMPT.md` | ¿Cómo se trabaja aquí? |
> | `CHANGELOG.md` | ¿Qué cambió en cada versión publicada? |
> | `BITACORA.md` | ¿Por qué el código es como es? (bitácora de bugs) |
> | `CONTEXT.md` | ¿De qué va el proyecto? |
> | **`Historial.md`** | **¿Dónde quedó el trabajo y qué falta?** ← este |

---

## 🚦 ESTADO AL CIERRE

> **Este bloque se actualiza en CADA cierre de trabajo, sin excepción.**
> Es lo primero que debe leer quien retome. Si está desactualizado, el archivo perdió su razón de ser.

| Campo | Valor |
|---|---|
| **Fecha de cierre** | 2026-10-28 (📦986: el guard que detecta un Python sin `pandas` **al arrancar**, no a mitad de uso; 📦985: el listado de incapacidades de Tempoactiva, que salía vacío desde que el mapeo del 📦866 dejó de guardar la lista de archivos). Antes: 2026-10-27 (📦980: la **v1.2 del Acuerdo armada y verificada**, que espera la aprobación del abogado; 📦979: los tres anexos con la salida B del canal de correo, publicados en `gh-pages`; 📦978: los ocho controles técnicos que el texto prometía y el código no cumplía, con la suite en **1892 · 1890 · 0 · 2**; — 📦977: la autorización operativa de la v1.0 registrada en producción — `id 1`, tipo OPERATIVA, huella `52a490a4…10c04`; — 📦976: las seis decisiones del abogado aplicadas al código y a los tres documentos — la cuenta de envío propia de la Empresa con el **OTP siempre desde K+AIR**, el medio personal que el Trabajador **confirma** en la pantalla de firma, y la **barrera de publicación** que separa la aprobación jurídica de la autorización operativa; — 📦975: la pregunta del medio personal del OTP añadida al paquete del abogado; — 📦973: el tablero de los 15 puntos con el estado medido; — 📦971: el correo post-firma sin adjuntos y los nueve documentos alineados con la operación real). Antes: 2026-10-26 (📦967 a 📦972: el despliegue en kair-server, la primera firma real, el D-03 cerrado con el motivo verdadero y el paquete del abogado rehecho).
| **Rama** | **Portátil, 28-oct-2026:** rama `Dev-Pc` en `0e90a42d` (📦986), **nivelada con `origin/Dev-Pc`** — los dos commits de la jornada (📦985 `7534ac8d` y 📦986 `0e90a42d`) quedaron **pusheados**. Árbol de trabajo limpio y 0 commits sin pushear. La mañana del 28-oct `Dev-Pc` estaba **59 commits atrás** de `origin/Dev` y se niveló con un fast-forward limpio (`9fa06732`, 📦984); el escritorio **todavía no tiene el 📦985 ni el 📦986** (no los ha descargado). Antes: `Dev`, **nivelada con `origin/Dev`** (la 971 y las anteriores; el 976 quedó commiteado y pusheado en esta jornada, con su hash en `git log`, no dentro del propio commit). **Los cinco commits de la jornada quedaron pusheados a `origin/Dev`**: 📦978 (`5534aca7`, el código), 📦979 (`f445bb1c`, los tres anexos), 📦980 (`43fedd4a`, el JSON de cambios de la v1.2), 📦981 (`26398205`) y 📦982 (`a908ca48`, este estado al cierre). La rama `gh-pages` quedó pusheada con los tres anexos (`04c5e762`). El **working tree está limpio**: lo único que queda sin commitear es el texto armado `acuerdo-v1.2.txt`, que está en `.gitignore` porque es la versión que se firma y no se commitea antes de que el abogado la apruebe. La rama `gh-pages` quedó **pusheada** con los tres anexos (`04c5e762`, 3 archivos, +304/-123): **el sitio público ya los tiene**. **El servidor `kair-server` corre el código del 📦976** (tar `bc18fbb6…9990b8`, 603 709 B, 177 entradas; migraciones 042, 043 y 044 aplicadas; `/health` responde `ok`). La **autorización operativa de la v1.0** quedó registrada en producción (`gh_firma_aprobaciones_publicacion`, `id 1`, tipo OPERATIVA, huella `52a490a4…10c04`). La excepción de habilitación 4 está **cerrada** (26-oct, con el motivo verdadero), así que hoy ninguna Empresa puede pedir firmas sin una excepción nueva.
| **Último commit de código** | 📦 **986** — el guard del Python sin dependencias: `main/python-deps.js` (nuevo, `pythonTieneDependencias`), los tres bucles de `findPython()` y el check de arranque (`hasDependencies`). Antes: 📦 **985** — el listado de incapacidades de Tempoactiva, que salía vacío desde que el 📦866 dejó de guardar `files[]`: `main/structure-files.js` (nuevo) + los cuatro handlers de ausentismo + los filtros del renderer en las tres ramas de error. Antes: 📦 **980** — la v1.2 del Acuerdo (empalmada desde la v1.0 sellada, con las once correcciones del abogado; el texto armado queda fuera del commit porque es la versión que se firma). Antes: 📦 **979** — los tres anexos con la salida B del canal de correo. Antes: 📦 **978** — los ocho controles técnicos que el texto prometía y el código no cumplían: el buzón corporativo se rechaza **siempre** (y el caso queda en el registro append-only), la confirmación del medio es obligatoria para **cualquier** destino, el bloqueo del OTP es **duro** (la salida es una nueva solicitud) y la caducidad alcanza a las filas heredadas; más la Constancia con los anexos y su huella, la declaración expresa de datos sensibles por documento, y los respaldos cifrados con purga a nivel de registro. Antes: 📦 **976** — las seis decisiones 1.a a 1.f aplicadas: el remitente del enlace (cuenta propia de la Empresa, con el OTP exceptuado), la confirmación del medio personal y la barrera de publicación (`createVersion` con `activa: true` devuelve 409 sin autorización operativa registrada para ese texto). Módulo nuevo `constancia-aprobacion-acuerdo.html`. Antes: 📦 **975** (la pregunta 1.a al paquete del abogado) — 📦 **974** (dos erratas en la nota) — 📦 **973** (el tablero de los 15 puntos) — 📦 **972** (el paquete del abogado rehecho) — 📦 **971** (el correo post-firma sin adjuntos, el endpoint público de la Constancia y los nueve documentos alineados) |
| **CAPÍTULO I: CERRADO** | Cerrado **en texto y en código**. Numerales 1.1 a 1.5. El 1.5 (Identificación del Operador) se agregó hoy: el 1.4 nombra a Gesstiar S.A.S. y el 1.5 dice dónde están su domicilio y sus canales, explicando que no van en el texto porque son volátiles y el Acuerdo no se modifica una vez publicado. Verificado que **el Decreto 1074 no prescribe el contenido del acuerdo** (el 2.2.2.47.2 es neutralidad tecnológica), así que el domicilio tampoco era obligatorio. **Ningún pendiente del Capítulo I depende del NIT.** |
| **Pendiente del Capítulo I** | El **NIT de Gesstiar S.A.S. (`900987987`)** ya está en el manifiesto y en los
seis documentos legales: el ítem `nit_encargado` del readiness está en `ok`. Lo que
falta del Capítulo I es el **nombre del representante legal** (`null` en el
manifiesto) y la **referencia del acta de designación** (`null`): ambos bloquean
`partes_encargado` y el banner del Anexo de Nube. El domicilio ya está
diligenciado en los seis documentos legales. Además, **cargar los datos de la
empresa cliente en el servidor** (`POST /internal/admin/empresas`): es un `curl`,
el endpoint ya existe; el 18 el servidor no respondía al SSH. El puente de 📦927
ya empuja desde cada PC los datos de una empresa **ya registrada**; el alta
inicial y el Anexo siguen siendo administrativos. |

| **NO es deuda: publicar la v1.2** | **No se registra como pendiente mientras siga la revisión por capítulos.** No se puede publicar un texto que todavía se está auditando. Publicar no es una tarea atrasada: es la consecuencia de terminar la auditoría. |
| **CAPÍTULO II: CERRADO** | Las tres citas (2.2.2.47.1 num. 1, 2.2.2.47.7, parágrafo del 2.2.1.1.9 y 2.2.1.1.13) están **verificadas y son correctas**. La redacción se aplicó el 19: el **2.2** ahora desarrolla los tres requisitos del 2.2.1.1.13 que importaba sin enumerar (a) vigencia de la firma igual a la del contrato y **declaración expresa de que el mecanismo no elimina el documento firmado ni la Constancia** ni por el tiempo ni por el fin de la relación, (b) costo cero para el Trabajador a cargo de la Empresa, (c) uso exclusivo para la relación laboral sin perder fuerza probatoria; y el **2.3** aclara que la copia firmada conserva íntegro el contenido, que solo se le agrega una página de sello y metadatos verificables, y que las huellas del original y de la copia firmada quedan registradas y son distintas. |
| **CAPÍTULO III: AUDITADO E IMPLEMENTADO (19)** | **El texto no se toca: sus tres citas legales son exactas.** Y el diagnóstico que estaba escrito aquí era **falso**: el plan y este archivo decían que "el texto promete HMAC-SHA256 con clave secreta en 3.4(d), 3.4(e) y 3.6(e)". El texto nunca lo dijo: siempre dijo **«huella digital con sal»** (`grep -r hmac` da cero en todo el service). La brecha real era de implementación: **la sal estaba en la misma fila que la huella** (equivale a un hash plano) y la **cédula se guardaba en texto claro**, en contra del propio 10.5(a). **Corregido el 19** con las migraciones **019** (columnas de algoritmo + HMAC) y **020** (`gh_firma_eventos` append-only con triggers), la capa `src/crypto/{keys,hmac}.js` y el seudónimo de `id_trabajador`. La llave maestra se deriva por HKDF de `TOKEN_ENCRYPTION_KEY` y vive **fuera** de la BD. Filas heredadas: se reescriben solas con el HMAC la primera vez que se usan. Efecto colateral que cierra una fuga: la mini-app exponía la cédula en claro en `GET /s/:token`; ahora expone el seudónimo. **Pendiente: solo el Anexo de Encargo (3.8) y la cláusula de custodia, que necesitan abogado.** El 19 se completó la **Fase 1 del carril de código** (📦 907): **clave HMAC por empresa** (ámbito = `id_empresa`), **versión de llave por fila** (marcador `hmac-sha256.v2.k1`) y **anillo de llaves** (`FIRMA_HMAC_KEYRING`), con la migración **022**. Rotar la llave dejó de invalidar la evidencia anterior. Corrección que salió de esa fase: **la búsqueda solo probaba la versión vigente**, así que al rotar las filas viejas se volvían invisibles; ahora prueba todas las del anillo. |
| **CAPÍTULO IV: AUDITADO (19)** | **Sus cinco citas, verificadas una por una contra la compilación oficial.** El **4.3** (parágrafo 2 del 2.2.1.1.10 del Decreto 1072) y el **4.5** (numeral 3 del 2.2.1.1.13) son **fieles**. El **4.2** es una paráfrasis: el 47.3 dice "incluido **cualquier acuerdo aplicable**" y el Acuerdo dice "incluido este Acuerdo" (la sustancia no cambia: este Acuerdo es un acuerdo aplicable). El **4.1** cita un artículo que el 47.5 no nombra: el oficial remite al **2.2.2.43.3**, y el 43.3 vigente es "PRESUPUESTO ANUAL" de las Cámaras de Comercio, o sea que **la remisión del propio decreto está caduca**, heredada de la numeración anterior a la compilación de 2015. El **4.4** tampoco es transcripción: el artículo 244 de la Ley 1564 ("DOCUMENTO AUTÉNTICO") presume auténticos los documentos públicos y privados "mientras no hayan sido tachados de falso o desconocidos", y la frase "en forma de mensaje de datos" es del 243. **Hallazgo de fondo: el Acuerdo no cita el 2.2.2.47.4 (CONFIABILIDAD)** en ningún punto, y es el artículo que trae los dos requisitos materiales (los datos de creación son exclusivamente del firmante; se puede detectar la alteración no autorizada), al que apuntan el 2.2.1.1.11 y el parágrafo del 2.2.1.1.13. **El texto no se tocó**: las propuestas quedaron en `docs/gestion-humana/firma-electronica/auditoria-capitulo-iv-citas-normativas-2026-10-19.md`. |
| **CAPÍTULO V: AUDITADO E IMPLEMENTADO (19)** | **Verificado el 2.2.2.47.6 contra la compilación oficial y auditado numeral por numeral (5.1 a 5.5).** El texto del Capítulo V tiene **dos hallazgos** que van al abogado y **no se tocaron**: el preámbulo del 5.1 dice que a), b) y c) son los deberes del 47.6 y no lo son (falta el deber 2, el deber 3 quedó reducido a "a la Empresa y a K+AIR" y el literal a) no está en el artículo), y el 5.1(a) obliga al Firmante a cumplir unas políticas de seguridad que nunca ve. El código tenía **dos roto**: el 5.1(c) no era cumplible (no había ningún canal de K+AIR en la mini-app) y el 5.3 no tenía apoyo en pantalla (el backend mandaba `tipo_identificacion` e `id_documento`, pero la mini-app no los pintaba, y el comentario que decía lo contrario era falso). **Corregidos el 19**: el canal de incidentes de K+AIR vive en las dos capas (valor por defecto en el HTML, para que exista también en la pantalla de error donde no hay contexto, y configurable con `FIRMA_CANAL_INCIDENCIAS`; un test exige que no divergan) en un pie fuera de las pantallas, y el bloque `#documento-identidad` muestra qué documento se firma ("Estás firmando un contrato. Referencia: ..."). **Decisión del owner (2026-10-20)**: la API **sí** rechaza el buzón corporativo para el OTP (el D-02, 📦921): el código va a un medio personal, y el rechazo quedaba **apagado** hasta que existiera la 9A y se publicara la v1.1. **Actualizado el 27-oct-2026 (📦978):** el rechazo del buzón corporativo es ya **incondicional** y `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` quedó **sin efecto**, así que ya no depende ni de la 9A ni de la publicación. Detalle en `auditoria-capitulo-v-acuerdo-uso-2026-10-19.md` y en `plan-cierre-tc-y-decisiones-2026-10-20.md`. |
| **Deuda técnica global** | Suite del **app** (portátil, 28-oct-2026, con el 📦985 y el 📦986 puestos): **146 tests · 140 verdes · 6 rojos**, y los 6 son **los mismos de antes** (`bandeja-premium-v2` 47/48, `cfg-tabs-scroll-883` 15/19, `firma-constancia-consolidada` 81/83, `firma-constancia-p0-p1` 32/33, `firma-deploy-kit` 36/37, `firma-tunnel-kit` 23/25): **ninguno es del 📦985 ni del 📦986**. Los dos "nuevos" son tests viejos: el 📦959 volvió la retención del respaldo configurable (`mtime +$RETENCION_DIAS`, 30 días) y `test-firma-deploy-kit` sigue buscando el literal `mtime +14`; y el escritorio bumpeó el token de cache-bust del iframe a `?v=20261022-datos-firma-sync927` y `test-cfg-tabs-scroll-883` sigue esperando `cfg-tabs883`. Suite del `firma-service`: **1892 tests · 1890 verdes · 0 rojos · 2 omitidos** (suite completa del 27-oct-2026, después del 📦978). Barrido de caracteres no latinos limpio en los 62 archivos del paquete; la **v1.2** empalmada da **66 681 B** (`97da2c14…7977`), 0 huecos y 0 marcadores, con empalme determinista (dos corridas, mismo hash); la v1.1 nunca llegó a publicarse. Gate legal medido en producción el 27-oct-2026 (con la autorización operativa de la v1.0 ya registrada): **40 ítems · 26 ok · 13 pendientes · 1 aviso · 0 N/A**; el gate de `publicacion` deja **6 bloqueantes**. **Ese gate hay que volverlo a medir:** esas cifras son del código anterior al 📦978, que cambió el ítem de Google y el del flag. **Pendiente de decisión administrativa:** la **autorización operativa de la v1.2** (la de la v1.0 ya quedó registrada en producción el 27-oct-2026; la de la v1.2 espera la aprobación del abogado y su propia huella) · la **cuenta de envío de cada Empresa** (hay que configurar la de ASEPLUS y probarla) · **el flag `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`**, que desde el 📦978 **ya no hace nada**: el rechazo del buzón corporativo es **incondicional** en el código (la variable queda en la configuración por compatibilidad, pero no cambia ningún comportamiento, y el gate de readiness ya no bloquea por ella) · **desplegar el 📦978 en kair-server** (el tar ya está armado y verificado desde el commit: 650 495 B, sha256 `fba78da6…fedeb`; pero **exige crear antes `/opt/kair-firma/backup.passphrase`** (600, root:root) o el script de respaldos aborta y los respaldos dejan de correr, y las migraciones 045 y 046 hay que aplicarlas antes de encender el cron de purga) · **rotar las 5 app passwords** (el repo es público y quedaron en el historial) · **Node 20 en EOL**: el servidor corre Node 20.20.2 y su EOL fue el 2026-04-30; decisión 2026-10-25: se aplaza como sugerencia no restrictiva; plan en `docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md` |
### 🛠️ Pendientes abiertos (al 2026-10-15, cierre 20:00 — actualizado con la sesion de migracion a kair-server)

1. **🔴 La app INSTALADA sigue sin Python, y los dos fixes de hoy no llegan a ella.** El
   📦985 y el 📦986 arreglan el código, pero `C:\Program Files\K+AIR\resources\` tiene
   `python-scripts` (los 19 `.py`) y **no tiene `python-embed`**: el runtime no viaja en el
   instalador. La causa: `Portear/python-embed/` esta en `.gitignore` (`.gitignore:46`) y
   `extraResources` de `package.json` lo copia desde ahi; si la carpeta no existe —que es lo
   que pasa en cualquier checkout limpio— electron-builder no copia nada y **no avisa**. El
   `Portear/README.md` dice que desde v0.1.80 el Python va empaquetado con el installer: **en
   esta instalacion no va**. Para que vaya hay que correr `scripts\prepare-python-embed.bat` en
   la maquina que compila, ANTES de `npm run build:win`, o hacer que el build **falle** cuando
   la carpeta no esta. En el entorno de DESARROLLO si quedo completo (embeddable 3.11.9 de
   python.org, con `python311._pth` apuntando a `Lib\site-packages`).
2. **🔴 Las cuatro llaves de la firma siguen dando 401** (admin + las tres empresas) contra
   `https://firma.kair.fyi`. La `ADMIN_API_KEY` vigente solo existe en el servidor
   (`/opt/kair-firma/admin-key.txt`), y desde el portatil no hay SSH: `192.168.1.11` esta en
   otra red fisica que reutiliza el mismo rango `192.168.1.0/24` (ARP `Unreachable`). El
   escritorio regenero `ADMIN_API_KEY`/`INTERNAL_API_KEY` en el despliegue de octubre (📦925).
   Mientras tanto **no se puede firmar desde el portatil**.
3. **🟠 `main.js:12243` sigue leyendo `caso.origen_dx1`**, un campo que no existe (el Python
   escribe `origenDX1`), asi que la columna del Excel exportado sigue saliendo vacia.
4. **🟠 Las tablas SQLite de Incidencia (3.3.5) y Prevalencia (3.3.4)** siguen sin crearse
   (bloqueante #13, cola #7): las dos leen de `Indicadores*.xlsx` en una carpeta del Drive que
   esta vacia, y con `meta=0` el sello dice **CUMPLE**.
5. **🟠 `tkinter` no se puede instalar en el Python embebido** (el embeddable no incluye
   Tcl/Tk), asi que `Invest_APP_V_3.py` y `Remisiones_v1.0.py` —las dos GUI de remisiones— no
   pueden correr con el. La app no los invoca, pero el usuario los abre como programas aparte.
6. **🟡 `comtypes` y `docx2pdf` no estan en `Portear/requirements.txt`**: solo se usan como
   metodo alternativo de conversion a PDF (el principal es pywin32, que si funciona), asi que no
   bloquean nada, pero el `requirements.txt` esta incompleto.
7. **🟡 Los dos tests que quedaron viejos** (no son bugs del producto, pero siguen rojos y
   hacen ruido): `test-firma-deploy-kit` sigue buscando el literal `mtime +14` cuando el 📦959
   volvio la retencion configurable (`mtime +$RETENCION_DIAS`, 30 dias), y
   `test-cfg-tabs-scroll-883` sigue esperando el token `cfg-tabs883` cuando el escritorio lo
   bumpeo a `?v=20261022-datos-firma-sync927`.

#### De la sesion del 2026-10-28 (portatil: el listado de ausentismo y el Python del portatil)


1. **🔴 Ningun equipo cliente le habla todavia al servidor.** El servicio esta desplegado y
   respondiendo en `https://firma.kair.fyi`, pero **no hay ninguna empresa registrada en el backend**,
   asi que todavia no se puede firmar de punta a punta. Falta, en cada equipo que firme, la secuencia
   `firma:config:set-url` -> `firma:config:set-admin-key` -> `firma:empresa:create` ->
   `firma:empresa:set-api-key`. El admin key esta en `/opt/kair-firma/admin-key.txt`. **No usar
   `firma:config:set-api-key`**: esta deprecado (`main/firma-bridge.js:647`), guarda en
   `empresas["__default__"]` por compatibilidad legacy y el propio codigo pide migrar al per-empresa,
   que exige K+AIR v0.1.192 o superior.
2. **🔴 No se ha probado una firma real de extremo a extremo.** Los 973 tests usaban `jsonTransport`,
   que no envia correo. Se confirmo que el envio funciona (`messageId` de Gmail), pero **nadie ha
   creado un sign request, recibido la invitacion, firmado desde el celular ni descargado la
   constancia**.
3. **🟡 La tarea `KairFirmaTunnel` del portatil quedo deshabilitada pero no borrada, y esta MUERTA.**
   El script corre `cloudflared tunnel run kair-firma`, que lee `~/.cloudflared/config.yml`, y ese
   directorio ya no existe en ninguna maquina (verificado en `C:\Users\Usuario\.cloudflared`,
   `ProgramData` y `systemprofile`: ninguno existe). Ademas `scripts/firma-tunnel/` describe una
   arquitectura que ya no es la vigente: conviene decidir si se borra o se archiva.
4. **🟡 No hay backup automatico.** `/opt/kair-firma/backups` existe y hay una copia manual
   (`firma-20261016-0250.sqlite`), pero no hay cron. La guia vieja (`deploy/README-DESPLIEGUE.md`,
   paso 9) tiene el script que nunca se instalo.
5. **🟡 No hay monitorizacion.** Nada avisa si el servidor se cae o si el tunnel se desconecta. El panel
   de Cloudflare muestra el estado, pero no hay alerta activa.
6. **🟡 6 vulnerabilidades de `npm audit`** sin revisar, reportadas al desplegar. No se corrio
   `npm audit fix` a proposito.
7. **🟡 Dos tests fallan en el servidor, ninguno por bug de codigo.** `idempotency-isolation` caso 2
   falla porque su propio helper genera un PDF nuevo por llamada y pdf-lib escribe `CreationDate`,
   asi que los dos requests llevan SHA-256 distinto y el `409` del servidor es lo correcto. El otro,
   `pdfValidator` §6.2, mide un timeout de 200 ms y tarda 326 ms con 973 tests en serie sobre 2 vCPU;
   el test busca detectar un hang (que seria >5 s). Ver `docs/MIGRACION-SERVIDOR-FIRMA.md` seccion 7.
8. **🟡 `origin/Dev-Pc` quedo 4 commits atras** (`875e58d2`, 📦897). Falta
   `git push origin Dev:Dev-Pc`; no existe rama local `Dev-Pc`.

#### Del 2026-10-13 (siguen abiertos)

1. **🔴 El gate de consentimiento re-pregunta por el motivo equivocado.** `consent:estado` compara
   contra `app.getVersion()`, así que **cada bump de versión le repite el consentimiento a todos**,
   aunque el texto legal no haya cambiado. Y al revés: editar la política **no** vuelve a preguntar,
   porque `version_terminos` y `version_privacidad` se guardan pero **nadie los vuelve a leer** (solo
   aparecen en el CREATE y en el INSERT). `config.consentDocumentVersion` se lee en dos lugares y
   **nadie lo escribe**, así que siempre vale `'v1'`. El `texto_hash` tampoco protege nada: no se
   compara contra nada. *Evidencia viva: el 2026-10-07 se aceptó dos veces con el mismo
   `texto_hash` (`8bf9b25d43a1`), solo porque entre una y otra hubo un bump de versión.*

2. **🔴 El consentimiento es por EQUIPO, no por persona.** La consulta es
   `SELECT ... ORDER BY aceptado_en DESC LIMIT 1` **sin `WHERE email = ?`**: toma la aceptación más
   reciente de quien sea. En un equipo compartido el primero que acepta silencia el gate para los
   demás. Y hay un problema de fondo que **no se arregla con código**: quien marca las casillas es el
   admin del SG-SST, y los datos que se registran son de sus subordinados, que nunca ven esa pantalla.
   El registro prueba que *alguien* aceptó, no que lo aceptó el titular. **Esto necesita asesoría
   jurídica**, no un parche.

3. **🟡 Los Términos y Condiciones de USO ya existen** (`sitio/terminos.html`, 13 secciones,
   publicados y verificados 200 el 2026-10-07, commit 📦877). Se/arregló el defecto de fondo: el gate
   hacía aceptar unos Términos que no existían en ningún lado. Sigue pendiente, y **es trabajo del
   asesor, no del código**: (a) la **base legal real**, que para seguimiento de incapacidades es
   **obligación legal** (Decreto 1072 / Res 0312), NO consentimiento — el gate hoy dice "lícito
   **únicamente** con su autorización", que es incorrecto a la luz del art. 7 de la Ley 1581;
   (b) el gate dice que la autorización es "facultativa y revocable", lo que **contradice** el
   carácter obligatorio del tratamiento en el SG-SST: si es facultaria, el administrador puede
   renunciarla y el sistema deja de cumplir. **Ninguno de los dos textos se tocaron a propósito**;
   cambiarlos es decisión del owner con asesoría. 🔴 **Tensión entre los dos documentos**: `privacidad.html`
   §1 declara a **JRFSoluciones** responsable del tratamiento "de los datos personales descrito en este
   documento", mientras `terminos.html` §4 declara responsable a **la empresa que usa K+AIR**. Se
   pueden conciliar si se précise que son responsables de cosas distintas (los correos y la web, una;
   los datos laborales que la empresa registra, la otra), pero hoy el lector lo va a leer como una
   contradicción. Armonizarlo también es del asesor |

4. **🟡 El gate pide autorización de "datos sensibles de salud" y el módulo sí los guarda.** La tabla
   `seguimiento_incapacidad_caso` tiene CIE-10 (`codigo_cie10`, `cie10_dx2/3`), porcentajes de PCL,
   resultados de examen médico y dictámenes medicolegales, junto con identificación completa del
   trabajador. **Hoy tiene 0 filas**, pero el esquema dice lo que hará. Definir con el asesor si el
   consentimiento es el instrumento correcto o si debe ser aviso de privacidad.

5. **🟡 Validación visual del gate por CDP.** Se validó por evidencia en disco (creó
   `auth-credentials.enc` cifrado de verdad, y el gate no reapareció porque correspondía), pero **no
   quedaron capturas** del overlay ni del chequeo de Escape. El driver quedó en
   `%TEMP%\validar-consent-cdp.js` y `playwright-core` ya se desinstaló.

6. **🟡 `test-firma-constancia-consolidada.js`** — el único test que queda en rojo en el escritorio:
   83/83 estáticos verdes, y el bloque runtime muere con el mensaje literal
   `FAIL runtime: Variable de entorno requerida: INTERNAL_API_KEY`. El test no menciona esa variable en
   su código, pero al cargar `firma-service/src/config.js` es `required()` sin fallback. Se resuelve con
   el `.env` del PC viejo (aquí existe `.env` pero solo trae las credenciales de Google OAuth). **No se
   pide esa clave por chat.**

7. **🟢 `Update-EnvPublicUrl`** ya se borró (código muerto tras el túnel con URL fija). Los checks
   que dependían de él se invirtieron. Los 3 CJK de `firma-service/tests/logger.test.js` y
   `tests/notificaciones-toast-e2e.js` también están fuera.

8. **🟡 Falta volver a medir la suite en el portátil**, después de traer 📦876 y 📦877. Se espera que
   `test-google-oauth-868.js` pase a **57/57** (el guardia ya está commiteado; se probó por mutación
   que sin él da 54/57, que es exactamente el rojo que veía). **No se afirma que esté verde: hay que
   medirlo.** Este es el único punto donde el escritorio y el portátil tenían bloqueos distintos del
   mismo test, y por eso conviene volver a medir en ambos lados |

9. **🟡 Falta validar a ojo el popup del calendario grande (📦878).** Los 26 checks de
   `test-calendar-chip-hover-878.js` comprueban el cableado y que la función respete el `hint`,
   ejecutándola en una VM; **no comprueban dónde queda el popup en pantalla**. El calendario
   grande es mucho más ancho que el minicalendario, y el popup se ancla a la derecha del
   elemento con volteo automático si no cabe. Es lo único de 📦878 que no se puede verificar
   sin que alguien lo mire.

10. **🔴 13 tests no arrancan en el escritorio por el ABI de `better-sqlite3`, y no es cosa de un
    rebuild.** El binario `node_modules/better-sqlite3/build/Release/better_sqlite3.node` está
    compilado para **Electron 37**, y el `node` pelado de la línea de comandos corre **v26.10.0**, así
    que los 13 tests que abren la base de datos mueren en `ERR_DLOPEN_FAILED`. *Se intentó arreglar el
    2026-10-07 y falló por dos capas:* `prebuild-install` dice `No prebuilt binaries found
    (target=26.10.0)` — no hay binario para esa versión — y al caer al compilado, `node-gyp` no puede
    ni hacer `clean`: `EPERM ... unlink 'better_sqlite3.node'`, porque el archivo lo tiene abierto un
    proceso vivo. *Lo que NO se hizo y es lo importante:* **no se cerraron los procesos `electron`, a
    propósito**, porque uno de ellos es la sesión de MCode y otro puede ser la app del owner abierta.
    Matar procesos del usuario sin permiso no se hace solo. **Y aunque se cerraran, el rebuild solo
    cambiaría el problema de lugar:** un binario sirve para un runtime o para el otro, y
    `package.json` **no tiene `electron-rebuild`**, así que no hay forma de tener los dos. La
    solución de verdad son **dos copias del binario** según el contexto, que es un cambio de
    arquitectura del proyecto y merece su propia tarea, no un comando suelto.

11. **🟡 Barrido en la Bandeja: 10 selectores más con el mismo desborde que el de 📦880, y NO se
    tocaron.** El patrón que se arregló en 📦880 es `width: 100%` + `padding` sin
    `box-sizing: border-box`. Salió en `premium.css`: `.tipos__i`, `.tipos__volver`, `.tuday__i`,
    `.kair-mail-folders-menu__item`; y en `styles.css`: `.kair-legend__item`, `.compose-panel__chip`,
    `.compose-panel__input`, `.compose-panel__textarea`, `.kair-mail-search__chip`. **Que el patrón
    esté no significa que se vean mal**: con `overflow: hidden` en el padre el desborde no se nota, y
    en los inputs el ancho extra es inofensivo. Se dejan así a propósito hasta que alguien los vea feos
    en pantalla, porque cambiarlos a ciegas es cambiar cosas que quizá el owner quiere así.

12. **🟠 El degradado del chip del mes se probó y se quitó, para que conste.** Durante 📦880 se
    implementó `mask-image` sobre el texto de la pastilla (en vez del `text-overflow: ellipsis`),
    con degradado a `calc(100% - 44px)` que terminaba en `transparent calc(100% - 10px)`. El owner
    lo vio en pantalla y dijo que no lo quería: **se leía como que el título se estaba apagando, no
    como "hay más"**, y se volvió al "...". Queda escrito para que nadie lo reintente creyendo que es
    mejor. El `box-sizing` de la misma tanda **sí se quedó**, porque ese era un bug de verdad.

13. **🟢 Iniciativa Hermes: la instalación YA ESTÁ COMPLETA (verificada el 2026-10-11). Lo que
    sigue son decisiones y trabajo nuevo.** Empezó el 2026-10-11. **No toca K+AIR todavía: no hay
    ni un commit de esta iniciativa**, y todo lo que sigue son decisiones, no código.

    *Servidor.* `kair-server` = Ubuntu 24.04.5 LTS, 2 núcleos **AMD C-70**, **3,5 GB de RAM**, 96 GB
    libres, **sin GPU**. Panel: Cockpit en `http://192.168.1.11:9090` — **HTTP plano, sin cifrar**;
    entrar ahí manda usuario y contraseña sin proteger. SSH abierto en el 22.

    *✅ Instalado y funcionando.* `bash ~/hermes-install.sh --non-interactive --skip-browser`.
    Python 3.14.7, uv 0.12.3, el comando en `~/.local/bin/hermes` y el PATH parcheado en `.bashrc`.
    Herramientas activas: `file`, `terminal`, `memory`, `skills`, `cronjob`, `code_execution`,
    `todo`, `web search`, entre otras 18.

    *✅ Ya es un servicio, no una terminal.* `sudo loginctl enable-linger $USER` dado y
    **confirmado** (`Linger=yes`), `hermes gateway install` + `start`. `hermes-gateway.service`
    instalado como user service de systemd, `enabled` y `active (running)`. Logs:
    `journalctl --user -u hermes-gateway -f`. **Por eso no sigue el patrón de K+AIR**: en la app
    todo servicio local nace hijo y `cleanupProcesses()` lo mata con `taskkill` al cerrar; Hermes
    está en otra máquina y sobrevive a que la app esté cerrada.

    *✅ Telegram, restringido al owner.* Bot creado con `@BotFather`; el token se pegó
    **directamente en el servidor y nunca debe compartirse por chat**. `TELEGRAM_ALLOWED_USERS`
    quedó con el ID del owner. El error inicial `Chat not found` se resolvió cuando el owner
    mandó `/start`; después Hermes avisó solo: *"Gateway online — Hermes is back and ready."*

    *✅ Modelo elegido.* `nvidia/nemotron-3.5-lightning:free` vía **OpenRouter**, reasoning
    `medium`. La API key se cargó en el servidor, no en el repo. El owner confirmó que el bot
    respondió una pregunta real. **Ojo con por qué no es local**: 3,5 GB de RAM no alcanzan para
    un 2B con el contexto de 64K que Hermes exige —el KV cache solo de 64K se come la memoria—, y
    🔴 **el propio repo ya lo dejó demostrado con logs del 2026-09-24**: en `llm_server.py` está
    escrito que el modelo chico copia la plantilla literal, repite las mismas causas en los 5
    niveles, genera "6, 10 o hasta 36 porqués" y que **el feedback no lo mueve**. La solución que
    implementaron fue **sustituir la causa ellos mismos y dejarle al modelo un solo nivel**. Ese
    es el diseño a seguir: mecánica determinista en Python, modelo solo donde hay texto libre o
    juicio.

    *Decisiones tomadas, para no volver a discutirlas:*
    - **Un número de WhatsApp por empresa (BYON)**, no uno central. Coherente con el art. 25 del 📦881
      (la empresa es responsable, K+AIR encargado), evita perder el número de todos los clientes por
      un error de uno, y el trabajador recibe del número de su propia empresa. El precio: cada cliente
      verifica su negocio ante Meta y registra sus plantillas a su nombre.
    - **El modelo razona en la nube y los datos sensibles no salen**: el script hace la mecánica y
      Hermes solo recibe datos anonimizados.
    - **El mensaje de WhatsApp NO debe hablar de la incapacidad**: texto genérico, y el detalle por
      otro canal. Es el precio de no depender de una GPU.

    *Números, según el owner (2026-10-13):* administra el sistema para **4 empresas** y hoy hace
    los seguimientos **a mano desde su cuenta personal**. De esas empresas, **2 tienen número de
    teléfono propio** y 🔴 **los números ya están en la app de WhatsApp Business** (confirmado el
    2026-10-13), que es requisito de Coexistence. Ver el **pendiente 15**, que tiene el estado
    final de esa decisión.

    *🔴 Hallazgos de la investigación del 2026-10-13 — verificados contra la documentación de Meta,
    no de memoria. Cambian el orden del plan:*
    - **El WhatsApp Business Tools MCP NO se puede instalar en Hermes.** Meta lo-annunció el
      2026-09-15 en `https://mcp.facebook.com/whatsapp_business_tools` (Streamable HTTP + OAuth),
      pero **solo está disponible en Claude, Codex y ChatGPT**. Es un cliente lo que se conecta, no
      algo que se clone al servidor. **El MCP se usa desde el escritorio, en Claude Code.**
    - **El MCP tampoco entrega el token de producción.** Lo dice la propia referencia de Meta: el
      token lo genera el System User en Business Settings, a mano. El MCP acelera crear la WABA,
      verificar el número y redactar plantillas; **el envío real es la Cloud API**.
    - 🔴 **El webhook es el bloqueo de infraestructura, no el código.** Meta tiene que llamar a
      `kair-server` para entregar "enviado / entregado / leído" y recibir respuestas. El servidor
      está en `192.168.1.11`, en la LAN y **sin IP pública: Meta no puede alcanzarlo**. ✅ **Ya
      está resuelto una vez en este repo y es el molde**: `scripts/firma-tunnel/start-firma-tunnel.ps1`
      arranca un túnel **nominado** de cloudflared (`kair-firma`) con URL fija, y
      `main/test-firma-tunnel-kit.js` lo vigila.
    - 🔴 **JRFSoluciones NO puede verificar su negocio ante Meta todavía.** `sitio/privacidad.html:56`
      sigue con el aviso de que **la razón social, el NIT y el domicilio están pendientes de
      legalizar**, y Meta exige certificado de existencia y representación legal + RUT, con que el
      **nombre legal, el domicilio y el dominio coincidan entre sí**. Para los clientes con RUT es
      trámite rutinario; para el owner es un bloqueo.
    - **Nivel sin verificar de negocio: 250 destinatarios únicos por 24 horas.** Para un SG-SST de
      ~100-110 empleados por empresa alcanza de sobra y sirve para arrancar sin legalizar.
    - **Meta ya no cobra solo plantillas.** Desde el **2026-10-01** también cobra las respuestas
      libres dentro de la ventana de 24 horas (esto pasó hace dos semanas).
    - **Ventana de 24 horas**: fuera de ella **solo salen plantillas aprobadas por Meta**, que se
      revisan una por una, **hasta 24 h cada una, y pueden rechazarse**.
    - La **On-Premises API expiró el 2025-10-23**: la única vía es Cloud API.
    - 🔴 **UN número NO puede autenticarse en DOS empresas.** Un teléfono pertenece a **una sola
      WABA**, en **un solo portafolio de negocio**. No es recomendación, es restricción, y trae
      errores propios: `3441030` ("ya registrado en WhatsApp Business Platform"), `2655093` ("la
      empresa ya está compartiendo esta cuenta con un partner") y el "este número está registrado en
      una cuenta existente: desconéctelo primero". Braze lo dice literal: **"Un número de teléfono
      no se puede compartir entre varias WABA."**
    - ✅ **Un número SÍ puede mandar a trabajadores de empresas distintas.** La plataforma no valida
      a quién le mandás: el destinatario solo tiene que haber dado su opt-in. Eso es lo que hace
      viable "un número, 4 empresas" en la práctica — **pero solo en el envío, no en la cuenta.**

    *🔴 Coexistence: qué exige de verdad (investigado el 2026-10-13). NO es el registro de número
    de siempre:*
    - 🔴 **La vía directa de Meta NO permite Coexistence. Hay que pasar por un BSP** (YCloud,
      360Dialog, Twilio, Woztell…), que es un tercero. Y es un BSP que **no tiene API propia para
      esta operación**: se conecta a mano por su plataforma. **Esto decide el camino entero.**
    - El número tiene que estar en la **app de WhatsApp Business**, no en la personal.
      Coexistence solo aplica a la app de empresas. ✅ **Cumplido**: los números ya están ahí.
    - App **v2.24.17 o superior**, y el número **usado activamente al menos 7 días**.
    - **Keep-alive**: hay que abrir la app **al menos una vez cada 13 días**. Si se pasa, la
      coexistencia se cae.
    - **Colombia NO está en la lista de países no soportados** (Australia, Japón, Nigeria, Filipinas,
      Rusia, Corea del Sur, Sudáfrica, Turquía). Es lo único que sale bien de todo esto.
    - Limitaciones: **5 mensajes por segundo** fijos (irrelevante acá), sin insignia azul, no se
      puede migrar entre WABAs, **la Calling API no funciona**, y quedan fuera Edit/Undo, mensajes
      efímeros, confirmaciones de lectura y ubicación en tiempo real.
    - Al hacer el alta **se desconectan los dispositivos vinculados** y hay que revincular los
      soportados; los que no lo son dejan de disparar webhook.
    - **Los mensajes enviados desde la app siguen siendo gratis**; los de la API se cobran normal.
    - **El precio de fondo: por Coexistence paga un tercero con los mensajes.** Como el mensaje de
      WhatsApp no habla de la incapacidad, ese tercero vería "un recordatorio a este número", no un
      diagnóstico — pero **la protección depende de que el texto siga siendo genérico**.

    *🔴 Números físicos: la eSIM sí sirve, y por qué* (investigado el 2026-10-13).*
    - La lista de números que WhatsApp **no** soporta es: **VoIP, toll-free (0800), premium,
      centrales (UAN) y "personal numbers"**. Una **eSIM de operador móvil NO es ninguno de esos**:
      es una SIM real con numeración móvil normal, y debería pasar el registro.
    - ⚠️ La trampa: existen "números virtuales" por internet (Hushed, TextNow y similares). **Esos
      SÍ son VoIP y Meta los rechaza** salvo que estén en la lista que mantiene el BSP. Si comprás
      de **Claro, Tigo, Movistar o WOM**, es otra cosa.
    - **Precios verificados en las páginas de los operadores (oct-2026):** la eSIM de **Claro es
      gratis de activar**, pero **solo para pospago** y **se activa presencial** en un CAV, con
      cédula y el celular. Pospago desde **$42.900/mes** (60 GB). **Tigo** vende la eSIM **directo
      en la web**: prepago desde **$3.000** y pospago desde **$45.900/mes** (60 GB) o $69.900
      (ilimitado). Un celular moderno admite varias eSIM a la vez: no hace falta un equipo por línea.
    - 🔴 **El prepago se RECICLA.** Un número prepago sin recargas devuelve su numeración al pool y
      se la reasignan. Si ese número ya estaba registrado en una WABA, **la cuenta queda apuntando
      a un número que ya no es tuyo**, y no se nota hasta que otro recibe tus mensajes. **Por eso
      pospago**: un plan pospago no se recicla porque la línea está activa.
    - ✅ **Con eSIM nueva + vía directa se CAEN cuatro cosas**: Coexistence, el BSP entero, los 7
      días de actividad y el keep-alive de 13 días. Queda solo verificación de negocio (documentos
      que las empresas ya tienen), registro del número por SMS, display name y plantillas.

    *Plantillas: dónde se redactan.* En el **WhatsApp Manager** de `business.facebook.com`, o por
    API. Cada una lleva nombre interno (que el trabajador nunca ve), **categoría** (Utilidad,
    Marketing o Autenticación), idioma `es-CO`, cuerpo con variables `{{1}}` y opcionalmente
    encabezado, pie y botones. Se envían a revisión desde ahí mismo, y la página muestra los
    errores de formato al instante. **El MCP de Meta sí sirve para redactar y editar plantillas:**
    eso es lo útil del MCP para el owner. La aprobación sigue siendo de Meta.
    🔴 **La trampa de la categoría:** si la plantilla dice Utilidad y el texto es promocional, **Meta
    la reclasifica a Marketing** y te cobra distinto. Un recordatorio de trámite de SG-SST es
    Utilidad porque continúa una gestión que el trabajador ya inició — pero eso lo define el asesor
    jurídico con el texto, no el owner solo.

    *🔴 El orden correcto, y por qué NO se compra la línea primero:*
    - **Paso 0, hoy y gratis:** crear el portafolio de negocio y una app en `developers.facebook.com`
      con el producto WhatsApp. **Meta crea automáticamente una WABA y un número de prueba**, y da un
      token temporal de 24 h.
    - **Paso 1, hoy y gratis:** mandar la plantilla `hello_world` ya aprobada al propio celular. Con
      los activos de prueba **no se paga nada**. Queda probado el token, la plantilla y la entrega.
      (El número de prueba solo deja escribir a **5 destinatarios verificados**: sirve para probar el
      flujo, no para un piloto real.)
    - **Paso 2, gratis:** redactar las plantillas reales y meterlas a revisión.
    - **Paso 3, recién acá:** comprar **una** eSIM, registrar el número real y cambiar el token
      temporal por el de System User.
    - **Por qué este orden:** **las plantillas son lo que puede fallar, y ninguna SIM lo arregla.**
      Así, cuando se llega a la tienda ya se sabe que el canal funciona, y el costo de aprender pasa
      de "una línea por mes mientras se descubre qué falla" a "cero".
    - 🔴 **Comprar 1 eSIM, probarla, y solo después la segunda.** El registro no cuesta nada; si el
      rango del operador no pasa, con una sola se pierde una y no cuatro. Con prepago, confirmar
      saldo para **recibir** SMS: sin saldo a veces se rechaza la verificación en silencio y Meta
      marca el número como no verificado.

    *Lo que falta, en orden — y el orden importa:*
    - 🔴 **Decidir el remitente** (pendiente 15). Es lo único que bloquea todo lo demás de WhatsApp,
      y es una decisión del owner, no de código.
    - 🔴 **Túnel HTTPS público para el webhook.** No depende de Meta: se puede montar ya.
    - 🔴 **El puente K+AIR → Hermes** (webhook firmado, mecánica determinista). **Tampoco depende de
      Meta, y es el trabajo de fondo real.** La razón de empezar por acá y no por el MCP: si se arma
      el puente contra el MCP y después Meta dice que producción va por la Cloud API —que es lo que
      va a pasar—, se tocó todo dos veces.
    - Alta de la WABA y del número **desde Claude Code con el MCP**, con **número de prueba**.
    - System User + token permanente, y el webhook de estados.
    - Plantillas: las redacta el asesor jurídico, las aprueba Meta.
    - 🔴 **Acceso al servidor desde el escritorio.** SSH da `Permission denied (publickey,password)`
      porque acá no hay clave privada, solo el rastro en `known_hosts`. Hay que generar un par de
      claves o pegar salidas a mano. **La contraseña no se pide ni se manda por chat**, nunca.

    *Lo que ya está resuelto del lado de K+AIR, para cuando llegue el momento:*
    - El submódulo de seguimiento es **`seguimiento-incapacidades`** (📦701): `main/seguimiento-incapacidad-bridge.js`
      (968 líneas) y las tablas `seguimiento_incapacidad_caso` y `seguimiento_incapacidad_registro`.
      El `_registro` ya es el histórico de seguimientos múltiples: es donde Hermes escribiría.
    - `utils/whatsappSender.js` **NO es la API de WhatsApp Business**: abre `web.whatsapp.com/send`
      con el mensaje copiado y el usuario tiene que hacer clic. Es el patrón "relay", no envío
      automático. Lo que se quiere (envío programático) es trabajo nuevo.
    - La app ya tiene el patrón app↔servidor por HTTP (`llm_server.py` en el 5555), pero **todo
      servicio local nace hijo de la app y `cleanupProcesses()` lo mata con `taskkill` al cerrar**.
      Hermes en el servidor **no debe seguir ese patrón**, y de hecho no lo sigue: al estar en otra
      máquina, no depende de que la app esté abierta.
    - Para avisar, se eligio **Telegram**; para hablar con Hermes, se eligió el **gateway de
      mensajería**, no la app.

14. **🔴 REVISIÓN PENDIENTE: 📦881 y 📦882 no se han visto en la app instalada. Es lo único
    que falta de esta tanda, y es trabajo de una persona, no de un test.**
    De 882 se revisó el artefacto `%TEMP%\preview-consent-882.html`, que reproduce el gate, el
    scroll y el revelado de las casillas, y el owner lo aprobó. **Pero el artefacto lleva los
    documentos incrustados y no ejecuta el IPC real**: no prueba que `consent:documento` entregue
    los cuatro desde `legal/` en el build empaquetado, ni que el CSS llegue sin cache.

    - **Por qué el gate no aparece hoy en la app del owner:** ya existe una fila en
      `consent_acceptance` con `document_version` en `v1` y `app_version` igual a la actual, así
      que `consent:estado` devuelve `requiere: false`. Para verlo hay que **borrar esa fila** o
      subir `consentDocumentVersion` en `config.json`. **No se hizo ninguna de las dos**: tocar
      `consentDocumentVersion` tiene el efecto colateral de que el texto legal cambie de verdad,
      y eso es decisión del owner junto con el asesor.
    - **Lo que hay que mirar, en orden:** (1) que los cuatro documentos aparezcan completos y en
      ese orden; (2) que la barra llegue al final y las dos casillas aparezcan; (3) que *No
      acepto* siga disponible en todo momento; (4) que los links entre documentos salten dentro
      de la pantalla y que *Soporte* abra el navegador y no una ventana en blanco.
    - **Ojo con el redimensionado:** el revelado depende de medir `scrollHeight` después de
      inyectar, y se hace con doble `requestAnimationFrame`. En una pantalla muy alta el
      contenido puede caber entero, y en ese caso las casillas deben aparecer **de una**, sin
      scroll. Es la rama que el código toma (`recorrido <= 4`), pero conviene confirmarla con la
      ventana maximizada.
    - **Y sigue en pie lo de 881:** el texto exacto que el consentimiento muestra en pantalla, el
      rol de responsable y encargado, y los dos documentos nuevos de `sitio/`. Que estén bien
      escritos en el repo no significa que se vean bien en pantalla.

15. **🟡 DECISIÓN DEL OWNER EN PAUSA (2026-10-13): "lo dejamos para otro momento, ahora estoy
    investigando y procesando la información". No hay nada que ejecutar hasta que la retome.**
    Lo de abajo quedó investigado y documentado para no volver a tropezar con ello. Lo que sigue
    NO es una tarea: es el estado del asunto.

    *Lo que se sabe hoy, en corto:*
    - El owner administra **4 empresas**, hoy hace los seguimientos **a mano desde su cuenta
      personal**, **2 empresas ya tienen número** y **los números están en WhatsApp Business**.
    - **Un número no puede estar en dos empresas** (una sola WABA por teléfono). En cambio **un
      número sí puede mandar a trabajadores de varias empresas**, porque la plataforma no valida el
      destinatario, solo que haya opt-in.
    - 🔴 **La contradicción que hay que resolver cuando se retome:** si el número queda bajo
      **JRFSoluciones**, las plantillas quedan a nombre de Javier y **JRFSoluciones trata esos datos
      por cuenta propia**. Eso es **justo lo contrario de lo que firmaste en 📦881**, donde el Anexo
      de Encargo dice que **la empresa cliente es responsable** y JRFSoluciones es encargado. Un
      mensaje a un trabajador de la empresa B desde una cuenta de JRFSoluciones es a Javier tratando
      datos de un tercero por su cuenta.
    - **Y JRFSoluciones además no puede verificar su negocio ante Meta**, porque `privacidad.html:56`
      sigue diciendo que la razón social, el NIT y el domicilio están **pendientes de legalizar**.

    *Las dos salidas, que son excluyentes:*
    1. **Legalizar JRFSoluciones** y quedarse con el rol de responsable del canal. Si el número es
       suyo y las plantillas suyas, **los documentos legales de 📦881 hay que rehacerlos**, porque
       hoy dicen lo contrario. Es trabajo del asesor, no de código.
    2. **Cada empresa con su propio número** en su propio portafolio. Cada una responsable de lo
       suyo, **los Anexos de Encargo de 📦881 se sostienen sin cambios**, y el mensaje sale "de la
       empresa". Cuesta un trámite y una línea por empresa — y el owner ya tiene 2 de las 4.

    *Lo que sobrevivió de la discusión anterior y sigue valiendo:*
    - **Coexistence = un BSP de por medio**, porque la vía directa de Meta no lo permite. Con eSIM
      nueva y vía directa **se cae el BSP entero** y con él los 7 días de actividad y el keep-alive.
    - **Un solo número concentra el riesgo**: si Meta degrada la calidad del número porque alguien
      bloquea un mensaje, caen los cuatro canales de golpe. Con números separados, el daño queda en
      una empresa.
    - **El display name es uno solo**: no podés poner "Empresa A" en un mensaje y "Empresa B" en
      otro. Se resuelve escribiendo la empresa en el texto de la plantilla, que es el punto que ya
      estaba pendiente desde 📦881 y que le toca al asesor jurídico.
    - **Lo que sí sobrevivió de la idea de "usar mi número personal":** es legítimo y es como
      trabaja mucha consultoría SG-SST, pero es un **producto distinto**, con su propia figura legal,
      y no encaja con los Anexos de Encargo firmados. No es descartado: vive en otro carril.

    **Lo que NO está en discusión y no se vuelve a preguntar:** los números de las 2 empresas con
    línea propia se registran después, uno por uno, cada empresa verificando su negocio. No es un
    trámite único de K+AIR: es un trámite por empresa, porque el responsable es cada una.

16. **🔴 PENDIENTE 16 (2026-10-14): validar 📦883 en la app, y el barrido del mismo bug en el resto
    del repo.**
    - **Qué falta:** entrar a Configuración y confirmar que la barrita del extremo derecho de las
      tabs ya no está. El fix está razonado sobre la especificación de CSS y cubierto por un test,
      **pero un test puede comprobar la regla y no comprobar la pantalla.** Es exactamente lo que
      le pasó a 📦880: el `box-sizing` estaba bien en el código y la pastilla se seguía viendo mal.
    - 🟡 **Barrido preventivo, todavía NO hecho.** Al buscar la causa apareció que el patrón
      `overflow-x: auto` sin declarar `overflow-y` está en **más de 100 reglas del repo**. Casi
      ninguna muestra barra porque no desbordan, pero **cuatro son barras de tabs**, con el mismo
      riesgo de que aparezca en cuanto la ventana se ponga angosta:
      - `modules/verificacion/definicion-indicadores/definicion-indicadores.css:839` — `.kair-ind-tabs`
      - `modules/recursos/roles-responsabilidades/roles-responsabilidades-view.css:142` — `.kair-rr-tabs`
      - `modules/recursos/inducciones/inducciones-view.css:360` — `.kair-tabs`
      - `modules/gestion-salud/medicina-preventiva/sve/sve.css:705` — `.sve-tabs`
      No se tocaron porque el owner pidió solo el de Configuración. **Cada una necesita `overflow-y:
      hidden`, no basta con una regla global**, porque las cuatro tienen su propio contexto.
17. **✅ RESUELTO (2026-10-14): el Panel de Control ya sigue el tema elegido** (📦885).
    - **Causa:** `shared/kair-premium.css` no tenía ni una regla de tema. Arreglado con un bloque
      `[data-theme^="dark"]` aditivo al final del archivo.
    - **Lo que queda:** **validarlo en la app instalada.** El owner aprobó el artefacto, que usa el CSS
      real leído del disco, pero no corre el `renderer.js`. Entrá al Panel de Control en Sistema y en
      Oscuro y confirmá que las tarjetas quedan oscuras.
    - **Nota para el futuro:** `.kair-premium` como clase wrapper solo la usa `renderer.js:4766`. Si
      algún día otro módulo la necesita, el bloque oscuro le sirve sin tocar nada.


### ▶️ Retomar desde acá — siguiente paso concreto

0. **✅ TERMINADO: plan de 5 fases para que "Mapeando Estructura de Documentos" termine**
   (760+ s por corrida y fallaba siempre: el SHA-256 sobre 1,73 GB era ≈99,6 % del tiempo, y el
   JSON de ~2,98 MB se pasaba del tope de 1 MiB del `stdout` de `execFile`, así que `JSON.parse`
   reventaba al final). **Commiteado en `33d40d90` y pusheado.** Detalle completo en `AGENTS.md`,
   sección "Mapeando Estructura de Documentos".
   - ✅ **Fase 0 (📦863) HECHA**: `main/test-mapeo-estructura-863.js`
     (36/36, corrida real de Python + fallback), docs §5.8 actualizados, versión 0.1.242,
     `renderer.js?v=20261006-mapeo-fase0`.
   - ✅ **Fase 1 (📦864) HECHA**: `main.js:4311` con
     `maxBuffer: 64 MB` + `timeout: 30 min` en `execFilePromise`; `node --check` OK,
     test de Fase 0 **36/36**, suite **121 · 103 verdes · 18 preexistentes (0 regresiones)**,
     docs §5.8 actualizados, versión 0.1.243, `renderer.js?v=20261006-mapeo-fase1`.
   - ✅ **Fase 2 (📦865) HECHA**: `Portear/src/map_directory.py`
     sin `hashlib`/`_calculate_checksum`/`checksum`, recorrido con `os.scandir` en un solo pase,
     `scan_date` real, errores reportados, semántica de symlink conservada; `py_compile` OK,
     test de Fase 0 **36/36**, test nuevo `main/test-mapeo-estructura-865.js` **15/15** con
     prueba de mordida (los 6 checks de cambio fallan contra el código viejo), suite
     **122 · 104 verdes · 18 preexistentes (0 regresiones)**, docs §5.8 actualizados,
     versión 0.1.244, `renderer.js?v=20261006-mapeo-fase2`.
   - ✅ **Fase 3 (📦866) HECHA**: `Portear/src/map_directory.py`
     sin `files[]`, sin `file_count`/`dir_count`, sin `indent=2` y con los errores de lectura
     saliendo por `file=sys.stderr` (el stdout queda **solo** JSON); los totales `total_files`/
     `total_folders` **se conservan** porque los consumen `renderer.js:7158/7160` y
     `main.js:4337/4338` (ahora se llenan con el contador global `_contador`); `py_compile` OK,
     tests **863 36/36 + 865 15/15 + 866 20/20**; medición con fixture de 2000 archivos:
     **934.437 bytes / 19.219 líneas / 2.941 ms → 20.877 bytes / 1 línea / 162 ms (−97,8 %)**;
     suite **123 · 105 verdes · 18 preexistentes (0 regresiones)**, docs §5.8 actualizados,
     versión 0.1.245, `renderer.js?v=20261006-mapeo-fase3`.
    - ✅ **Fase 4 (📦867) HECHA**: progreso real de punta a punta.
      `Portear/src/map_directory.py` suma `_avisar_progreso()` (stderr, amortiguado a 250 ms con
      `time.monotonic()`, forzado al arrancar y al cerrar); `main.js` envuelve `execFilePromise`
      para que cuelgue `.child` (la de `promisify` no expone el proceso), engancha `child.stderr`
      y reenvía `mapeo-progreso` con guard de `isDestroyed()`; `preload.js` expone
      `onMapDirectoryProgress(cb)` con su baja; `config-viewer.html` pinta el contador real,
      suelta el listener en los **tres** caminos de salida y desaparece el "10-60 segundos"
      (`:3128`). `py_compile` + `node --check` OK, test nuevo
      `main/test-mapeo-estructura-867.js` **44/44** con **11 mutaciones que muerden**, tests
      **863 36/36 + 865 15/15 + 866 20/20**, suite **124 · 106 verdes · 18 preexistentes
      (0 regresiones)**, docs §5.8 actualizados, versión 0.1.246,
      `renderer.js?v=20261006-mapeo-fase4`.
      Además, una **prueba de integración fuera del repo** ejecutó el wrapper y la regex reales
      de `main.js` contra un fixture de 2.500 archivos (15/15): el progreso llegó a los 81 ms y
      114 ms, antes de que el proceso terminara (125 ms), o sea en vivo y no bufferizado.
      **Queda consultado al owner:** ¿esa prueba entra al repo como test?
    - ✅ **El plan de 5 fases está completo.**
    - 🔴 **📦868 — Conectar Gmail: ARREGLADO DE FONDO. Las credenciales son de la APP, no
      del usuario.**
      **El bug real:** las credenciales vivían solo en un `.env`, que **no viaja con el
      instalador**. Por eso el portátil del owner funcionaba y cualquier otra máquina no —
      la app no tenía correo para sus clientes, y el único síntoma era un error de Google
      ("Missing required parameter: client_id") que no menciona K+AIR, más un flow de
      autorización que quedaba colgado.
      **El arreglo:** que la app traiga las credenciales encima. El `client_id` de una app
      instalada es un identificador público. El `client_secret` también viaja embebido,
      pero no porque sea secreto: K+AIR es un binario que cualquiera puede abrir y el mismo
      Google lo entrega aparte en su `client_secret_*.json` de escritorio. Ahora viven en
      `shared/google-oauth-config.js`, que se versiona; el `.env` quedó como override de
      desarrollo. **El usuario final no tiene que hacer nada:** cada persona y cada cliente
      autoriza su PROPIA cuenta con el mismo `client_id`, como cualquier botón "iniciar
      sesión con Google".
      **El `client_id` y el `client_secret` ya están cargados y la conexión funciona**
      (proyecto "KAIR Calendar Sync", credencial de escritorio). **Probado de punta a punta
      contra Google:** el owner autorizó con su cuenta real y la bandeja conectó.
      🚨 **La creencia que casi pierde el paquete: "el `client_secret` es opcional".**
      Se concluyó leyendo `google-auth-library`: tiene `ClientAuthentication.None`, que hace
      que la librería NO mande el secreto. Todo cuadraba en el código — **pero leer la
      librería no es verificar el servicio.** Al probarlo de verdad, Google aceptó los 5
      permisos y el canje devolvió `client_secret is missing`. El síntoma era el peor: el
      navegador decía "Autorización exitosa" y la conexión se perdía igual. Media
      conexión. Un enum que existe en el código no significa que el endpoint lo acepte.
      🚨 **Y lo que lo dejó invisible:** los handlers de OAuth usaban `console.error`,
      que no escribe en `main.log`, así que el fallo no dejaba rastro en ningún lado —
      hubo que reproducir la petición a mano con un código falso para verlo. Ahora los tres
      escriben en `sendLog` y hay un check que lo vigila.
      🚨 **Y el repo es PÚBLICO, así que el secret tampoco puede ir en el config
      versionado.** Al commitear, GitHub rechazó el push: `GH013 — Push cannot contain
      secrets`. Hacerlo privado NO era la salida: `package.json` declara
      `publish: {provider: "github"}` y electron-updater pega a la API de releases de GitHub
      **sin token**, así que en un repo privado esa API devuelve 404 y **todos los clientes
      dejarían de recibir actualizaciones**. Repo público ⇒ el secret no puede estar en el
      historial. Solución: `shared/google-oauth-config.js` se versiona **vacío** y las
      credenciales viven en `sgsst-electron-app/.env` (en `.gitignore`). Verificado que
      electron-builder **no excluye `.env`** de los archivos del app: un `.env` en la máquina
      que compila **viaja dentro del instalador** y le llega al cliente sin que configure nada.
      **NUEVO** `main/_verificar-credenciales-build.js` como hook `prebuild`/`prebuild:win`/
      `prebuild:mac`/`prebuild:linux`: si faltan las dos credenciales **corta el build con
      exit 1**. Mejor que el build falle ahí a que salga un instalador donde el correo no
      conecta — que es exactamente el bug que costó la jornada.
      **Trampa del día:** el owner pegó el `client_id` **sin** el sufijo
      `.apps.googleusercontent.com` (creyó que era decorativo). Google devuelve 400 igual,
      así que el síntoma se habría repetido en la app. Al pegar una credencial hay que
      validar el **formato entero**, no que no esté vacía.
      **Pendiente:** el proyecto sigue en modo "Testing", así que la autorización vence a
      los 7 días y el cliente reconecta cada semana. Pasarlo a "Production" exige una **URL
      de política de privacidad pública**, que todavía no existe. Los 5 scopes ya están
      declarados en Google y coinciden con los que pide el código.

1. **Owner tiene que validar visualmente 📦858**: en la pestaña Correo, el mini debe dejar ir a
   septiembre con las flechas, y al elegir el **14 de septiembre tiene que mostrar los 12 correos**
   (no "sin correos ese día": de los 131 de la carpeta, solo 25 están en memoria, y ese día no está
   cargado). También: que funcione con Enviados y con No leídos, que al pasar a Agenda se limpie el
   filtro, y que la fila con la X se vea bien con el sidebar plegado. **Es la validación más
   valiosa que queda abierta**, porque 📦858 nunca se ha mirado en la app.
2. **Owner tiene que confirmar 📦861 en pantalla**: en el 1.1.1, que el botón **Subir** ya
   sale azul como la barra superior, que el **PDF** se abre con el visor de K+AIR (barra
   clara, no la oscura del navegador) y que **"Ver completo"** aparece en el PDF. Y que
   arrastrar un archivo al **centro** de la pantalla lo suba a la carpeta que está viendo.
   Ojo: estos módulos **no llevan token de caché**, así que si no cambia hay que cerrar y
   abrir la app.
3. **Owner tiene que validar el estado de error de 📦861**: borrar o renombrar la carpeta
   base desde el Explorador de Windows con la app abierta y hacer clic en otra carpeta.
   Antes quedaban bloques grises para siempre; ahora debe salir "No se pudo leer esta
   carpeta" con botón **Reintentar**, y "Carpeta vacía" solo cuando la carpeta está
   realmente vacía.
> ~~**Decisión pendiente del owner**: el mini congelado en el mes real~~ — **CERRADO 2026-10-04
> por 📦858**. En Agenda sigue congelado (📦844 intacto); en Correo navegó con estado propio, y al
> cambiar de pestaña vuelve al mes presente. Las dos behaviors quedan aisladas, que es lo que se
> pidió. (Va sin número a propósito: estaba como "3." duplicado y partía la serie.)
4. **Owner tiene que validar visualmente 📦856/857**: en vista Mes, "Tipos de evento" debe contar
   **octubre** (no el año) y **sin las seis filas en 0**. Al hacer clic en un día del mini, la
   sección debe pasar a ese día y salir el botón "Ver el mes completo". Y **"Tu día" debe seguir
   visible** abajo con la lista larga. Todo probado con tests, **nunca mirado en la app**.
7. **Owner tiene que validar visualmente 📦855**: que la bandeja abra **en blanco** (sin correo
   abierto), que al hacer clic abra y marque leído, y que al cambiar de filtro con un correo
   abierto que no está en la lista nueva, el panel se limpie.
8. **Owner tiene que validar visualmente 📦853/854**: el pillón rojo de novedad en la esquina de la
   fila "Correos no leídos", el tinte rojo de la fila, el filtro "No leídos" en la barra y el clic
   que baja el 99+. Ojo: hay que **cerrar y reabrir** la app primero, para que se siembre la línea
   base con el estado actual. En la captura de 📦855 el aviso rojo **no aparecía**, y era lo
   correcto: la línea base se había sembrado con lo que ya había y no había llegado nada nuevo.
9. **Cerrar el bypass de `gh:update-personal`** (bloqueante #2). Es el único de severidad crítica
   que sigue abierto, y lleva desde v0.1.212.
10. **Decidir sobre los borrados que necesitan autorización**: los 4 `.bak-*` (bloqueante #5) y los
   12 JS huérfanos de la Bandeja (bloqueante #4). Editar código que no se carga es trabajo perdido.
11. **Arreglar los tokens faltantes de `styles.css`** (bloqueante #1), o decidir que el panel de
   pendientes se queda así y no se le toca.

### 🔴 Bloqueantes y deudas conocidas

| # | Qué | Dónde | Impacto |
|---|---|---|---|
| 1 | **`styles.css` usa 6 tokens premium que nadie define** en el shell; 4 sin respaldo quedan sin estilo | `styles.css:6159-6470` (`.kair-pendientes-popover*`) | El panel de pendientes del dashboard se ve con bordes y colores inválidos |
| 2 | **El bridge acepta campos que el módulo declara protegidos.** `PROTECTED_FIELDS` en el renderer marca `estado`, `fechaIngreso` y `fechaRetiro` como no editables, pero el `fieldMap` de `_handlerUpdatePersonal` **sí los acepta**. Llamar el handler con `{estado:"retirado"}` los escribe. | `main/gestion-humana-bridge.js` (`_handlerUpdatePersonal`) vs `modules/gestion-humana/base-personal/index.js` | La protección es solo de UI. Cualquiera que llegue al handler la salta. Marcado como pendiente desde v0.1.212 y sigue abierto |
| 3 | `no such column: actualizado_en` en el sync | `sync-serializer.js:138,302,391,734` | BDs instaladas **antes** de la migración no sincronizan esos dominios. El schema sí declara la columna: falta una migración, no es un typo |
| 4 | **12 archivos JS huérfanos** en la Bandeja | `renderer/bandeja-integrada/` | No se cargan. Editarlos es trabajo perdido. `compose-modal.js` además tiene lógica duplicada viva en `app.js` |
| 5 | 4 archivos `.bak-*` en la raíz del app | `main.js.bak-*`, `renderer.js.bak-*`, `preload.js.bak-*`, `index.html.bak-*` | Ruido. Candidatos a borrar, **pero no sin autorización** |
| 6 | 30 tests en `tests/` que el runner no ejecuta | `sgsst-electron-app/tests/` (en subdirectorios por módulo) | Cobertura que parece existir y no corre. El runner solo mira `main/` |
| 7 | `CHANGELOG.md` afirma 22/22 mutaciones en `test-swapview-841.js`, pero ese archivo no tiene array `MUT` | `CHANGELOG.md` | O el mutation se perdió en un refactor, o el CHANGELOG describe un estado intermedio |
| 8 | ~~2 validaciones visuales abiertas~~ — **CERRADO 2026-10-03** | `CONTEXT.md` v0.1.214 (confetti del splash) y v0.1.215 (home de Capacitaciones) | El owner las revisó en la app y no registró observaciones. Ya no bloquean. Las dos referencias en `CONTEXT.md` quedaron actualizadas |
| 9 | 📦850 y 📦851 implementados y probados, pero nunca vistos en la app — **CERRADO 2026-10-03** | Botón del borde y encabezado sin etiqueta de fecha | El owner los revisó |
| 10 | 🔴 **La bandeja solo tiene 25 correos en memoria de los 131 de INBOX** (`PAGE_SIZE = 25`), y se agrandan con scroll infinito. Cualquier filtro que mire `state.mails` da "vacío" en **25 días que sí tienen correo** (el 14 de septiembre tiene 12 y ninguno está cargado) | `app.js` `PAGE_SIZE`, `loadMailsFromCache` | 📦858 lo resolvió con un rango de fechas en la caché local. **El mismo riesgo queda para cualquier filtro nuevo que se escriba sin eso** |
| 11 | 🔴 **Ningún test del repo abre la base de datos.** 📦860 tenía 34 checks en verde y el feature podía no dibujar nada en pantalla, según qué tipo devolviera la BD para `last_message_date` | `main/test-*.js` | Verificado a mano contra la BD real (`Temp/verif-fecha-bd-860.js`: 150 filas, 0 sin fecha, `INTEGER` y llega como `number`). **La brecha sigue abierta**: todo feature de datos necesita ese paso a mano hasta que la suite tenga un juego de datos de prueba |
| 12 | 🔴 **Los 15 exploradores de archivos NO comparten la arquitectura del preview.** Hay **4 variantes** de `_loadPDF` y **3 formas** de enrutar el PDF en el archivo de conexión; 3 módulos no tienen archivo de conexión | `modules/**/*-viewer.js`, `*-logic.js` | 📦861 arregló el PDF **solo en el 1.1.1**. Replicar sin abrir la app sería cambiar 15 módulos a ciegas, y el PDF es lo que más se nota si se rompe. **Pendiente: Owner valida el 1.1.1 y se replican los otros 14** |
| 13 | 🔴 **Incidencia (3.3.5) y Prevalencia (3.3.4) no tienen de dónde leer datos.** Esperan un Excel `Indicadores*.xlsx` dentro de la carpeta del submódulo, y esa carpeta está **vacía (0 elementos)** en las 4 empresas de Drive. Sin archivo, el backend **no avisa**: devuelve `success:true` con 12 meses en cero y `meta:0`, así que la pantalla pinta una tabla inventada que parece real, y la edición manual revienta con "Ruta de INDICADORES no configurada" | `main/excel-bridge.js:191,226,890-906,981-985` | La sección no muestra datos reales **ni permite cargarlos**. El owner decidió dejarlo así: hay que **crear las tablas en SQLite** y conectarlas, como ya se hizo con Ausentismo en `main/medprev-sve-datos-bridge.js` |

### 📋 Cola de trabajo acordada

| Orden | Tema | Estado |
|---|---|---|
| 1 | 📦828 · Matriz de requisitos legales 2.7.1 | Pendiente |
| 2 | 📦841 fase 2 · Tabs del dashboard | Pendiente |
| 3 | 🔴 Cerrar el bypass de `gh:update-personal` (bloqueante #2) | Pendiente, abierto desde v0.1.212 |
| 4 | Arreglar los tokens faltantes de `styles.css` (bloqueante #1) | Pendiente, sin autorizar |
| 5 | Migración de `actualizado_en` para BDs previas (bloqueante #3) | Pendiente |
| 6 | Limpiar código muerto de la Bandeja (bloqueantes #4 y #5) | Pendiente, esperando autorización de borrado |
| 7 | 🔴 **Crear las tablas SQLite de Incidencia (3.3.5) y Prevalencia (3.3.4)** para que la sección consulte la BD y deje de depender del Excel (bloqueante #13) | Pendiente. **Decidido por el owner el 2026-10-16**: se deja así por ahora, se anota y se sigue |

### 🧠 Lo que la regla de cero presunciones evitó hoy

Se agregó al `PROMPT.md` (§5.9) después de encontrar **reglas "OBLIGATORIAS" que no existen**:

- `KairUI.esc()` y `KairHelpers.formatDate()` — **0 archivos** en todo el repo. Un modelo que las
  hubiera seguido habría escrito una llamada inexistente y la vista se habría caído.
- `kair-canonical.css` — referenciado en `AGENTS.md` como fuente de las clases BEM. **No existe.**
- "el último paquete es `📦579`" — van 850+.
- "`var`, no `let`/`const`" — `main.js` tiene 2 608 `const`.

Y la misma regla, aplicada al propio trabajo: al medir este documento, **2 de mis propias cifras
en `PROMPT.md` estaban mal** (27 bridges en vez de 30, y un conteo de `tests/` mal hecho por no
bajar a los subdirectorios). Las dos quedaron corregidas con el número medido.

### 🧠 Reglas que se aprendieron en esta sesión

Se guardan como comentarios `📦n` en el código, como lecciones al final de `AGENTS.md`, y acá
solo va el resumen de las que **cambian cómo se trabaja mañana**:

- Un **check que matchea su propio comentario** no guarda nada. Leer solo código con `soloCodigo()`.
- Una **mutación que no cambia nada siempre "pasa"**. Normalizar a LF antes de mutar y contar los
  mutantes vacíos por separado, o se pierde la señal.
- Un **regex con rango fijo** (`{0,300}`) se rompe al agregar un comentario. Acotar a la misma llave.
- Un check de "este texto tiene que estar" **solo vale si además dice dónde**.
- Cuando se borra algo, **invertir los checks que lo afirman**, y si son varios, todos.
- Un botón que **pliega la columna que lo contiene** no puede vivir dentro de ella.
- Un **ancla de reemplazo** tiene que llevar el contexto que la rodea, no solo la primera línea. Al
  insertar "antes de X", el texto nuevo debe **reponer X completo**. Si X es un encabezado de
  sección, perderlo no es perder una línea: deja huérfano todo lo que venía después.
- **"El script dijo OK" no es verificación.** Un script que hace `replace` y reporta éxito puede
  haber matcheado 0 veces y dejado el archivo intacto. El guard que salva es exigir exactamente
  1 coincidencia, y después comprobar por estructura dónde cayó cada cosa.
- Un script que **escribe archivo por archivo no es atómico**: si el CHANGELOG sale bien y el README
  falla, quedan estados mezclados. **Respaldar antes de correr.**
- Un verificador de "inglés colado" con listas largas produce falsos positivos tan molestos como los
  typos que busca. Listar solo lo que es **inequívocamente** error en ese documento.
- Los documentos nuevos viven en la **raíz del repo**, junto a `PRODUCT.md`; los de la app, en
  `sgsst-electron-app/`. Un script que los agrupe mal marca "FALTA" sobre archivos que sí existen.

### 2026-10-24 · 📦944 · La v1.1 deja de estar bloqueada: los campos del sistema, el sello de version y los datos del owner

**Qué se hizo**

| Paquete | Qué |
|---|---|
| 📦944 | La guarda de texto legal separa los huecos de los campos que registra el sistema: `[registrada por el sistema]` no bloquea la publicación, pero se sigue listando |
| 📦944 | El conteo quedo partido en `huecos` (bloquean) y `sistema` (no bloquean) en la guarda, el readiness, el script de publicacion y el empalme |
| 📦944 | El empalme dejo de llevar su propia copia del patron de placeholders: importa la regla del modulo compartido |
| 📦944 | El sello de version: el encabezado ("Version del Acuerdo: vX") y el bloque de Manifestacion de Voluntad pasan a la version que se esta armando, con reglas estrictas (exactamente una mencion de cada lado, y las dos diciendo lo mismo) |
| 📦944 | El JSON de cambios declara su `version`, y el empalme se niega si se arma una version distinta de la que dice el JSON |
| 📦944 | Los cinco datos del owner van en su propio archivo (`scripts/fixtures/acuerdo-v1.1-datos.json`), NO en el mapa de cambios: ese mapa es el texto del abogado copiado integro y tiene una garantia probada (cada texto aparece literal en la respuesta 11A) |
| 📦944 | El empalme sustituye los datos con las mismas reglas estrictas: cada placeholder exactamente una vez, el valor sin corchetes, y al final ni un hueco |
| 📦944 | El canal de proteccion de datos quedo en un solo lugar: `.env` (local y servidor), `config.js`, `.env.example`, manifiesto y el texto del 10.7(b) |
| 📦944 | El texto armado de la v1.1 (`scripts/fixtures/acuerdo-v1.1.txt`) esta en `.gitignore` hasta que el abogado lo apruebe |
| 📦943 | Correccion de la documentacion: el hold de la fila de prueba venia de la regla `CONTRATO_ELECTRONICO`, no de la ficha de la Empresa |

**El segundo bloqueo, y el que mas se coughs: el texto seguia diciendo "v1.0".** El Acuerdo nombra su
version en DOS lugares (el encabezado "Version del Acuerdo: vX" y el bloque de Manifestacion de
Voluntad "…K+AIR, version vX…"), y el empalme los dejaba como estaban. Con los cinco datos puestos, el
readiness rechazaba el texto con `faltan: [{id: "version"}]`: el check ya existia desde el 📦941 y
mordia; lo que faltaba era correr la cadena COMPLETA (empalme → guarda → readiness) y no las partes.
El sello no va en el mapa de cambios (ese mapa es el texto del abogado, copiado integro): es una
propiedad de la version, y lo aplica el script tomandola del campo `version` del JSON. El sello se
niega a seguir si no encuentra exactamente una mencion de cada lado, si las dos no dicen lo mismo,
o si el JSON no declara la version. **Durante la implementacion el sello produjo "vv1.1" y el propio
check lo caza**: un sello que no se verifica es un sello que miente.

**Por qué** — la v1.1 no se podia publicar ni con los cinco datos del abogado listos: la guarda contaba
nueve corchetes, y cuatro de ellos (`[registrada por el sistema]`, del bloque de Manifestacion de
Voluntad) los llena el sistema al firmar. La v1.0, ya publicada y sellada y viva en produccion, los
usa desde hace semanas: la regla del codigo era mas estricta que el texto legal.

**Decisiones del owner** — "que el detector reconozca `[registrada por el sistema]` como campo del
sistema", de entre dos opciones (la otra era que el abogado reescribiera esas cuatro lineas sin
corchetes). La eleccion del owner es la que no depende del abogado y deja el texto igual que el
que ya esta en produccion.

**Los cinco datos** (owner, 24-oct-2026) — URL `https://kair.fyi/anexo-encargo.html` (1.5) · ciudad y
pais `Barranquilla, Colombia` (10.1) · respaldos, monitoreo y soporte "a cargo de Gesstiar S.A.S.,
de forma interna, sin proveedor externo" (10.1) · canal `privacidad.kair@gmail.com` (10.7(b)) ·
responsable "Cargo Representante Legal de Gesstiar" (10.7(b)). Y el dominio del sitio legal:
`kair.fyi` apuntando a GitHub Pages (el CNAME quedo preparado y staged en la rama `gh-pages`).

**Tests** — 28 nuevos: 11 en `tests/utils/textoLegal.test.js` (el modulo compartido, con la v1.0
real como fixture), 3 en `tests/guarda-texto-legal.test.js` y 14 en
`tests/scripts/empalmar-acuerdo-v1.1.test.js` (cuatro del sello: el texto con la version nueva en el
encabezado y en la Manifestacion, y sus tres negativas — sin version en el texto, con el
encabezado y la Manifestacion en desacuerdo, y con la version del JSON distinta de la que se arma;
y siete de los datos: los cinco huecos reales llenados, cada placeholder apareciendo una sola vez, y
sus cuatro negativas — placeholder inexistente, placeholder repetido, valor con corchetes y huecos
que quedan sin llenar; mas el caso real con los datos del owner).
Suite completa: **1705 tests · 1703 verdes · 0 rojos · 2 omitidos**. `node --check` en los 5
archivos de codigo.

**El resultado** — con los cinco datos del owner, el empalme escribe el archivo (codigo 0), la guarda
lo deja pasar y el readiness del texto dice `ok: true`, `faltan: []`: la primera vez que el texto de
la v1.1 queda armable y publicable. Sin los datos, el empalme sale con codigo 2 y no escribe nada.
El readiness del gate de publicacion paso de **4 ok / 31 pendientes / 19 bloqueantes** a
**9 ok / 26 pendientes / 13 bloqueantes** (`texto_v1_1`, `hash_v1_1` y `canal_datos`). El texto
armado tiene SHA-256 `a88e41af5a5d5c7c5c6d89bc2eeac19a758b47945f37c9aaccd144052e0b7bc5` y 38 969
bytes; queda en `.gitignore` hasta que el abogado lo apruebe.

**Bugs encontrados** — el empalme llevaba su propio `RE_PLACEHOLDER`: arreglando solo el modulo
compartido, el script salia con codigo 0 mientras su reporte seguia diciendo "9 placeholders". Un
check que no muerde y un reporte mintiendo. Por eso el empalme ahora importa la regla y compara
las dos cuentas (todas las ocurrencias y los huecos).

**Archivos tocados** — `src/utils/textoLegal.js`, `src/services/agreement.js`,
`src/services/readinessLegal.js`, `scripts/publicar-acuerdo-legal.js`,
`scripts/empalmar-acuerdo-v1.1.js`, `tests/utils/textoLegal.test.js`,
`tests/guarda-texto-legal.test.js`, `tests/scripts/empalmar-acuerdo-v1.1.test.js`,
`docs/gestion-humana/firma-electronica/API.md`, `BITACORA.md`, `PROMPT.md`, `Historial.md`.

**Commits** — `973a155a` (📦️943), `f26f8bc1` (📦️944, que lleva el 📦️945 adentro) y,
en la rama `gh-pages`, `cf723393` (el NIT publicado y el `CNAME` de `kair.fyi`). Los
tres pusheados: `origin/Dev` quedó en `f26f8bc1` y `origin/gh-pages` en `cf723393`.

### 2026-10-24 · 📦945 · El readiness leía el HTML crudo: cuatro cláusulas del Anexo de Nube que el documento sí tiene

**Qué se hizo**

| Paquete | Qué |
|---|---|
| 📦945 | El checker de cláusulas y de corchetes lee el texto RENDERIZADO (sin etiquetas, con las entidades resueltas): el documento legal es el que se firma, no el marcado |
| 📦945 | El aviso "NO FIRMAR HASTA COMPLETAR LOS DATOS" es un marcador (`NO_FIRMAR`) y deja de ser una cláusula requerida permanente |
| 📦945 | La regla del aviso queda coherente en los dos sentidos: con datos pendientes tiene que advertir; sin datos pendientes no puede llevar el aviso |
| 📦945 | El patrón de la frase vive UNA vez, en `src/utils/textoLegal.js`, y el readiness lo pide con `reDeMarcador()` |

**El bug.** `analizarAnexoNube` y `analizarAnexoEncargo` corrían sus checks sobre el
archivo HTML crudo. Los anexos están escritos con entidades (`d&iacute;as h&aacute;biles`,
`Auditor&iacute;a`, `supresi&oacute;n`, `Devoluci&oacute;n`, `20 a&ntilde;os`), y los
patrones buscan la letra: `"dos (2) d&iacute;as h&aacute;biles"` no matchea
`/dos\s*\(2\)\s*días\s+hábiles/`. El Anexo de Nube reportaba **6 cláusulas faltantes** y
**cuatro de ellas el documento sí las tiene**. No faltaba la cláusula: el check miraba el
marcado.

**El segundo bug, peor.** El aviso "no firmar" estaba como cláusula **requerida** y ninguna
marca lo reconocía. Las dos cosas juntas: (a) un documento que decía "no firmar" podía
quedar `ok: true` —un check que no muerde en la dirección peligrosa— y (b) como el
requisito era permanente, el ítem `documento_nube` bloqueaba la primera firma **para
siempre**, porque el archivo del repo es el modelo y siempre tiene huecos. Un check que
nunca puede pasar es un check que no muerde: el problema era del requisito.

**Medido** — Anexo de Nube real: cláusulas faltantes **6 → 0**, `clausulasOk` false →
true, huecos **53 → 53** (no se perdió ninguno) y el hash del archivo **igual**
(`f50ed32c…19628`, después `5a2413b3…23f866` en el 📦️954: la huella identifica el documento, y el documento cambió a propósito): la huella identifica el documento, no su forma de marcado. El Anexo
de Encargo sigue con 5 cláusulas faltantes, y esas cinco **son reales** (le faltan la
remisión al Anexo de Nube, la de otrosí, el art. 2.2.4.6.13, los veinte años y el
servicio en nube).

**La regla del aviso, en los dos sentidos.** Con datos pendientes, el documento tiene que
advertirlo (el aviso o cualquier marca de borrador): si no, alguien lo diligencia a mano y
se lleva un documento con huecos sin advertencia → el check reporta `aviso_sin_datos`. Sin
datos pendientes, no puede llevar el aviso: no se firma un documento que dice "no firmar" →
lo bloquea el marcador `NO_FIRMAR`. El patrón vive una vez, en el módulo legal; el
readiness lo pide con `reDeMarcador('NO_FIRMAR')`, nunca con una copia del regex.

**Tests** — 12 nuevos: 10 en `tests/readiness-documentos-html.test.js` (las entidades no
esconden la cláusula; el HTML y el texto plano dan el MISMO resultado; el check muerde
cuando la cláusula falta; la frase del aviso es una sola fuente; la regla del aviso en los
dos sentidos; un documento que dice "no firmar" no se publica; el hash sigue siendo del
archivo; los corchetes no se pierden) y 2 en `tests/readiness-legal.test.js`. Suite completa:
**1717 tests · 1715 verdes · 0 rojos · 2 omitidos**. `node --check` en los tres archivos.
Barrido de caracteres no latina limpio.

**Lo que este paquete NO decide.** El ítem `documento_nube` sigue en `pendiente`, y con
razón: el modelo tiene 53 huecos. Pero uno es una decisión de fondo que no es del código:
si el archivo del repo es el MODELO (con los huecos por Empresa) o el DOCUMENTO FINAL
(diligenciado). Hoy nadie diligencia el Anexo de Nube —el servicio nunca lo lee— y los
tres huecos por-Empresa (`[EMPRESA]`, su NIT y su representante) no tienen dueño. Eso es
el punto 7, y lo tiene que decidir el owner con el abogado.

**Archivos tocados** — `src/utils/textoLegal.js`, `src/services/readinessLegal.js`,
`tests/readiness-documentos-html.test.js`, `tests/readiness-legal.test.js`,
`BITACORA.md`, `PROMPT.md` (trampa 77), `Historial.md`.

**Commits** — ninguno todavía: los tres paquetes (📦943, 📦944 y 📦945) están escritos y
verificados, esperando la palabra del owner.

### 2026-10-24 · 📦947 · El check pedía una migración que ya estaba aplicada

**Lo que pasó.** El despliegue del `f26f8bc1` al servidor quedó bien: los tres hashes
en disco coincidieron con los del commit, el servicio arrancó y el journal mostró
`"No hay migraciones pendientes","total":40`. Pero el readiness del servidor sacaba
**doce bloqueantes**, y uno decía que faltaba la tabla de solicitudes del Titular con
la acción "Aplicar las migraciones 028/029" — que el journal del mismo arranque
decía que **ya estaban aplicadas**.

**La causa.** El readiness buscaba `gh_firma_solicitudes_titular`; la migración 028 crea
`gh_solicitudes_titular`, **sin el prefijo `firma_`**, a propósito: esa tabla no cuelga
de ninguna firma y por eso la 5B no la alcanza. El nombre que buscó el código no lo
crea ninguna migración, así que el check no podía pasar nunca. Los otros cuatro
nombres del bloque sí coincidían con sus migraciones (032 y 035).

**El arreglo.** El nombre real en el check, y dos acciones que mandaban al operador a
hacer algo inútil: la de la huella de la v1.1 decía "registrarlo en
legal-readiness.json" cuando la huella **ya estaba** en el manifiesto (lo que faltaba
era el archivo aprobado, que no entra al servidor hasta que el abogado apruebe el
texto).

**La prueba.** Dos tests nuevos: uno aplica el **SQL real** de la migración 028 en una
base en memoria y exige que el check vea la tabla; el otro exige que la acción no
mande a registrar una huella que ya está puesta. Con el nombre viejo el primero
**falla** (mutación comprobada): un test que no se rompe cuando el código se rompe
no está probando nada. Suite completa: **1719 tests · 1717 verdes · 0 rojos · 2
omitidos**.

**Archivos tocados** — `src/services/readinessLegal.js`,
`tests/readiness-legal.test.js`, `BITACORA.md`, `PROMPT.md` (trampa 78), `Historial.md`.

**Commits** — ninguno todavía: el 📦947 queda esperando la palabra del owner.

### 2026-10-24 · 📦️948 · El Anexo de Encargo del servicio en la nube y las URLs del punto 3

**El encargo.** Cerrar por completo el punto 3 (las URLs del Anexo y de la política) sin
preguntarle nada al owner.

**Lo que había.** La parte (a) ya estaba hecha (DNS, `CNAME`, certificado). Faltaban (b) publicar
los documentos y (c) declarar las URLs. Al medir (b) apareció que el Anexo de Encargo del repo era
el de la **app de escritorio** (base local en los equipos del cliente, cuenta de Windows, Google
Calendar, jsDelivr) y que el Anexo de Nube no estaba en `sitio/`: los dos describían un producto
que ya no es el que se firma.

**Los tres documentos.** El Anexo de Encargo nuevo (servicio en la nube, con las cinco cláusulas que
el check exige y la cláusula de **sustitución**, que es la decisión (b) del 24-oct), el Anexo de
Nube publicado por fin, y la **Política de tratamiento del Encargado** (nueva).

**El nudo.** El `url_politica` se iba a llenar con `https://kair.fyi/privacidad.html`, que era la decisión
escrita. Esa página es la política de la **app de escritorio**: sellarla como política del Encargado
del servicio de firma habría sido un sello falso. El texto aprobado (1.2 y 10.7) remiten a la política de
la **Empresa** (Responsable), no a la del Encargado.

**La prueba.** 3 tests nuevos (la redacción de sustitución pasa; el Anexo real del repo trae las cinco
cláusulas; cada URL declarada apunta a un archivo que existe en `sitio/`). Las tres URLs se verificaron
por HTTP **antes** de sellarlas. Suite completa: **1722 tests · 1720 verdes · 0 rojos · 2 omitidos**.

**Lo que NO cierra.** El documento conserva la marca de revisión profesional pendiente (lo redactó el
modelo, no un abogado), así que el ítem `documento_encargo` sigue bloqueando la primera firma. Los puntos 7
(diligenciar el Anexo de Nube) y 11 (la firma del Anexo nuevo) siguen abiertos.

**Archivos tocados** — `legal/anexo-encargo.html`, `legal/politica-firma.html`, `sitio/` (7 archivos),
`firma-service/legal-readiness.json`, `firma-service/src/services/readinessLegal.js`,
`firma-service/tests/readiness-legal.test.js`, `BITACORA.md`, `PROMPT.md` (trampa 79), `Historial.md`.

**Commits** — el 📦️947 (el check que pedía una migración ya aplicada) y este 📦️948 van en dos
commits; los hashes quedan anotados en la entrada siguiente.

### 2026-10-24 · 📦️949 · El acta de designación no era una obligación legal

**El encargo.** "ok perfecto ahora quiero que resuelvas el punto 5, si no es obligación crear un acta del responsable
quitemos esa referencia para que no nos genere un bloqueo".

**Lo que pedía el check.** El ítem `responsable_datos` exigía la persona o área responsable **y** la referencia del
acta de designación. Con el responsable ya declarado (el cargo del Representante Legal de Gesstiar) el ítem
seguía en `pendiente` y bloqueaba la primera firma. El origen de esa segunda condición era la línea 67 de la
respuesta 11A del abogado: "persona o área (con acta de designación)".

**Lo que dice la norma.** El art. 2.2.2.25.4.4 del Decreto 1074 de 2015 (que reproduce el art. 23 del Decreto 1377 de
2013) exige **designar una persona o área**: nada más. Para responder si el acta hacía parte de ese "designar" se
leyó la Resolución 384 de 2026 de la Secretaría Jurídica Distrital, que cita a la SIC: "la Superintendencia de
Industria y Comercio ha precisado que la Ley Estatutaria 1581 de 2012 y sus normas reglamentarias no establecen un
procedimiento específico para la designación, ni determinan una profesión, tipo de vinculación o dependencia
particular". Esa misma resolución designa con una **Resolución**, no con un acta. Y el texto aprobado del Acuerdo
(10.7(b) final) tampoco pide acta: dice "designa una persona o área" y "la persona o área responsable es [nombre o cargo]".

**La decisión.** Se quitó el acta del requisito bloqueante: el campo `acta_designacion` desaparece del manifiesto y
el ítem depende ya solo de la designación. La designación se documenta en los **documentos públicos** (el
Anexo de Encargo y la política), que es la forma que la ley deja a la organización y que un tercero puede verificar
sin pedirle nada a nadie. Un acta interna no se le puede pedir a un tercero; una declaración publicada, sí.

**Los cuatro documentos.** `legal/anexo-encargo.html` y `sitio/anexo-encargo.html` (19 381 B): el párrafo en el
capítulo 1, el dato en el capítulo 11 y el art. 23 del Decreto 1377 de 2013 en la lista de normas.
`legal/politica-firma.html` y `sitio/politica-firma.html` (10 366 B): el párrafo en el capítulo 1 y la cita de las dos
normas en el capítulo 7 (derechos del titular), que es donde el art. 23 aplica de verdad. Los dos pares quedaron
**idénticos** (mismo SHA-256).

**La prueba.** 2 tests nuevos: uno afirma que con solo la designación el ítem queda `ok` (y que **sin**
designación sigue en `pendiente`), y otro ata el manifiesto real (si alguien vuelve a meter `acta_designacion` en
`legal-readiness.json`, el test falla). **Mutación comprobada por los dos lados**: reintroducir el acta en el código
rompe el primero, y reintroducir el campo en el manifiesto rompe el segundo. Suite completa: **1724 tests · 1722
verdes · 0 rojos · 2 omitidos** (antes 1722/1720/0/2).

**Lo que NO cierra.** Sigue faltando el **nombre** del representante legal de Gesstiar: con el cargo la designación
legal está hecha; con el nombre, además, se enciende `partes_encargado` (punto 2 y el banner del Anexo de Nube,
punto 7). Ese nombre es del owner.

**Archivos tocados** — `firma-service/legal-readiness.json`, `firma-service/src/services/readinessLegal.js`,
`firma-service/scripts/fixtures/acuerdo-v1.1-datos.json`, `firma-service/tests/readiness-legal.test.js`,
`legal/anexo-encargo.html`, `legal/politica-firma.html`, `sitio/anexo-encargo.html`, `sitio/politica-firma.html`,
`BITACORA.md`, `PROMPT.md` (trampa 80), `Historial.md`.

**Commits** — `9152f7ab` (📦️949) en `Dev`, pusheado; `cf310e10` en `gh-pages`, pusheado.

### 2026-10-25 · La deuda de seguridad aplazada como sugerencia, no como bloqueo (📦953)

**La decisión.** El owner decidió aplazar la migración de **Node 20 a Node 24**, el
`npm audit fix` y el cierre **A/B/C** del `SECURITY.md`. No es un gate: **la primera firma
con la v1.0 puede seguir** y el servicio sigue funcionando como hoy. El plan queda en
[`docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md`](sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md),
marcado como **sugerencia no restrictiva**.

**Por qué.** No hay firmas reales todavía, la app funciona y el salto de runtime tiene riesgo
de despliegue. La prioridad inmediata es la primera firma; la higiene de seguridad se retoma
en una ventana tranquila. No se encontró un fallo funcional que obligue a hacerlo hoy.

**Lo que se acepta por escrito (al 2026-10-25).** Node **20.20.2** (última versión de la rama
20, publicada el 2026-03-24; EOL **2026-04-30**); `npm audit --omit=dev` con **7
vulnerabilidades** (1 crítica, 4 altas, 2 moderadas); `SECURITY.md` §7 con **39 casillas y 0
marcadas**; backups manuales, sin cron. **Nada de eso se presenta como resuelto.**

**Lo que no cambia.** La validez de la firma no depende de la versión de Node: depende de la
identidad, la integridad, la trazabilidad y la constancia. Node 24 es continuidad y seguridad
operativa, no un requisito formal del mecanismo.

**Cuándo se retoma.** Antes de una auditoría, un DPA o un cliente nuevo; antes de un
redespliegue que obligue a reinstalar dependencias; si aparece un CVE crítico; o, a más tardar,
el **2027-01-31**.

**Archivos tocados** — `docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md`
(nuevo), `SECURITY.md` (nota de estado y avisos en §1.3 y §7), `docs/MIGRACION-SERVIDOR-FIRMA.md`
(§8.1), `Historial.md`.

### 2026-10-24 · 📦️950 · El nombre del representante legal y el canal único de PQRS

**Los datos.** El owner respondió lo que faltaba del punto 2 y del punto 6 el 24-oct-2026 (18:57):
el representante legal de Gesstiar es **Javier Robles Fontalvo**, el canal único de PQRS es
**adminkair@gmail.com** y el responsable de PQRS es **Javier Robles Fontalvo**.

**Lo que cambió.** El manifiesto (`legal-readiness.json`) declara los cuatro campos que estaban vacíos:
`encargado.representante_legal`, `encargado.responsable_datos` (que ahora lleva el nombre y no solo el cargo),
`pqrs.canal` y `pqrs.responsable`. Los cuatro documentos públicos (el Anexo de Encargo y la Política del
Encargado, en `legal/` y en `sitio/`) nombran al representante legal y **publican el canal único de PQRS** con
su responsable.

**Por qué el canal se publica y no solo se declara.** Un canal único que solo existe en un JSON interno no es
verificable: el titular no lo ve. Por eso se publica en los tres documentos del sitio y un test ata el valor del
manifiesto a los archivos que lo contienen.

**La aclaración que evitó una trampa.** `asepluscaribesas@gmail.com` (la ficha que se había anotado en el
tablero) es el correo de **ASEPLUS**, la empresa que remite las remisiones médicas en `Portear/`: **no** es un
canal de PQRS de K+AIR. Confirmarlo evitó declarar dos canales.

**La prueba.** 3 tests nuevos: el manifiesto real declara los cuatro campos; con ellos los ítems
`partes_encargado` y `canal_pqrs` quedan `ok`; y el canal declarado aparece en los tres documentos publicados.
**Mutación comprobada por los tres lados**: sin representante legal, con otro canal o sin responsable de PQRS,
los tests se rompen. Suite completa: **1727 tests · 1725 verdes · 0 rojos · 2 omitidos** (antes 1724/1722/0/2).

**El efecto medido.** Tres ítems pasaron de `pendiente` a `ok`: `responsable_datos` (con el nombre),
`partes_encargado` ("NIT, representante y domicilio declarados") y `canal_pqrs` ("Canal y responsable declarados").

**Lo que NO cierra.** (1) El texto de la v1.1 que va al abogado sigue diciendo **"Cargo Representante Legal de
Gesstiar"**, no el nombre: la designación por cargo cumple la norma y cambiarlo obliga a re-empalmar y a
re-sellar la huella, así que el owner decide si lo quiere así. (2) El Anexo de Nube sigue siendo el modelo con
sus 53 huecos (punto 7). (3) Falta el despliegue en el servidor: el paquete está commiteado y pusheado (`8031c573`), pero el tar del despliegue se arma después del commit.

**Archivos tocados** — `firma-service/legal-readiness.json`, `firma-service/tests/readiness-legal.test.js`,
`legal/anexo-encargo.html`, `legal/politica-firma.html`, `sitio/anexo-encargo.html`, `sitio/politica-firma.html`,
`BITACORA.md`, `PROMPT.md` (trampa 81), `Historial.md`.

**Commits** — `8031c573` (📦️950) en `Dev`, pusheado; `15bc2c7d` en `gh-pages`, pusheado.

### 2026-10-25 · 📦️954 · El Anexo de Nube: el modelo diligenciado y el check que ya no pide lo imposible

**El encargo.** "quiero que trabajes en Anexo de Nube U0001F7E1 Publicado y medido; falta la decisión de fondo.
De 6 cláusulas faltantes a 0, 53 huecos intactos… Sigue la pregunta de fondo: ¿modelo o documento final?
Hoy nadie lo diligencia — ciéralo que falta para cerrarlo sin romper nada".

**La decisión de fondo: es el MODELO.** No es una preferencia: lo dice el texto que escribió el abogado
("este documento es un modelo del Anexo de Nube… se diligencia por cada Empresa que firme") y lo soporta el
código: los tres campos de la parte responsable cambian en cada copia, el aviso de "no firmar hasta completar",
y el `anexo_nube_firmado_at` que es **por Empresa**. Lo que se firma es la copia diligenciada que cada
Empresa recibe del modelo; el archivo del repo es la plantilla.

**El bug que se cerró con esa decisión.** El ítem `documento_nube` pedía "sin placeholders" (cero
corchetes) y le decía al operador "quitar todos los corchetes". En una plantilla por-Empresa eso **nunca puede
pasar**: los tres campos de la Empresa son huecos por diseño. Era un bloqueo permanente en el primer gate, y
el pendiente era **imposible** de cerrar. La solución: en `textoLegal.js` hay ahora una **tercera clase** de
placeholder (junto a los que registra el sistema): los que **diligencia la Empresa** en la copia que firma.
Se listan (nada queda escondido) pero no bloquean, y la excepción es de **contenido exacto**:
`NIT de la Empresa` sí; `NIT de la Empresa cliente` no, y sigue bloqueando. La aplica **solo el Anexo de Nube**,
así que la v1.1 y el Anexo de Encargo no cambian de comportamiento. Y el análisis distingue dos estados:
`ok` ("este archivo sirve tal cual como el documento que se firma", cero marcadores) y `modeloOk` ("este archivo
sirve como modelo": todas las cláusulas y ningún dato del Encargado pendiente). El aviso de "no firmar" es
parte de la naturaleza de un modelo y no lo penaliza.

**El modelo, diligenciado.** De **53 huecos (20 distintos) a 10 (10 distintos)**: el NIT (900987987), el
representante legal (Javier Robles Fontalvo), la ciudad/país (Barranquilla, Colombia), los responsables de
respaldos/monitoreo/soporte, la seguridad física, el canal (privacidad.kair@gmail.com), el responsable, los
plazos, la vigencia y la versión. Las 3 filas de ejemplo de subencargados se fueron porque esos servicios
los presta el Encargado con su propio personal: no hay proveedor externo, luego no hay subencargado. El aviso
final pasó de "entra como otrosí" a "**sustituye**", coherente con el Anexo de Encargo nuevo.

**Cloudflare: el DPA verificado en la fuente oficial.** El bloque `subencargados.cloudflare` estaba en
`false`/`null` (punto 8). Se llenó con lo que dice el Data Processing Addendum v6.4 del 3-abr-2026: el DPA
**forma parte del acuerdo de suscripción y aplica a enterprise y a self-serve** (no hay que migrar de plan),
el apartado **3.i** obliga a devolver o eliminar los datos al terminar el acuerdo o el servicio, el **5.2**
habilita la auditoría con un informe de un auditor externo de no más de trece (13) meses, y el Anexo 2
declara ISO/IEC 27001, ISO/IEC 27701, PCI DSS L1 y SOC 2 Tipo II. → `cloudflare_dpa` en **ok**.

**La divergencia que nadie detectaba.** `legal/anexo-nube-v1.0.html` y `sitio/anexo-nube-v1.0.html` **no eran el
mismo archivo** (11 040 B contra 11 115 B): la versión de `legal/` no tenía el enlace a la Política en el
menú. Los demás documentos sí se mantenían idénticos byte a byte. Ahora hay un test que lo comprueba.

**La prueba.** 7 tests nuevos (5 del documento y 2 del manifiesto) y **mutación comprobada por los tres
lados**: cambiar el texto de la excepción rompe 2 tests, volver `dpa: false` rompe 2, borrar
`seguridad_fisica` rompe 1. Suite completa: **1735 tests · 1733 verdes · 0 rojos · 2 omitidos** (antes 1727/1725/0/2). El pendiente ahora es accionable ("Faltan 7 datos del
owner: [RTO en horas] [RPO en horas] [plan de continuidad] [tipo de cuenta de Google]…"), no "quitar todos los
corchetes".

**Lo que NO cierra.** Siete huecos en cuatro datos del owner (tipo de cuenta de Google, RTO/RPO, plan de
continuidad y plazo de supresión) y el bloqueo que ningún dato quita: `firmado_nube`, que lo firma la
Empresa. El respaldo es **manual**: sin el cron diario no se puede declarar un RPO menor que el intervalo
entre copias, y esa es una decisión del owner, no del modelo.

**Archivos tocados** — `firma-service/src/utils/textoLegal.js`, `firma-service/src/services/readinessLegal.js`,
`firma-service/legal-readiness.json`, `firma-service/tests/readiness-legal.test.js`,
`firma-service/tests/readiness-documentos-html.test.js`, `legal/anexo-nube-v1.0.html`,
`sitio/anexo-nube-v1.0.html`, `BITACORA.md`, `PROMPT.md` (trampa 82), `Historial.md`.

**Commits** — `359fe7a1` (📦954), pusheado a `origin/Dev`.

### 2026-10-26 · 📦️955 · El paquete de despliegue no llevaba los documentos: el servidor reportaba huecos que no existían

**El hallazgo.** Al re-armar el tar de despliegue del 📦954 se encontró que `git archive` solo metía el service
(`src`, `web`, `scripts`, `package.json`, `package-lock.json`, `legal-readiness.json`). Pero el readiness no lee
los documentos legales de ahí: `readinessLegal.js` calcula `REPO_ROOT` como **un nivel arriba** del directorio del
service (`path.resolve(SERVICE_ROOT, '..')`) y de ahí lee el Anexo de Nube y el Anexo de Encargo. En el PC eso es
`sgsst-electron-app/legal/`; en el servidor, `/opt/kair-firma/legal/`: **hermano** de `app/`, no hijo. El tar se
extraía en `/opt/kair-firma/app`, así que ese directorio nunca existió allá.

**El efecto era un resultado falso, no un error.** En el servidor el readiness reportaba:
`"El documento no está disponible. Faltan cláusulas: Remisión al Anexo de Nube; Sustitución del Anexo anterior o
cláusula de otrosí; Art. 2.2.4.6.13; Veinte (20) años; Servicio en nube / firma-service"` — cinco cláusulas que
**no faltaban**: están en `legal/anexo-encargo.html` (19 568 B, sha256 `932ec4e7…b3ad8`). El que leía el reporte se
llevaba una conclusión falsa sobre un documento completo, y el pendiente mandaba a "reparar" algo que estaba bien.

**La medición, aislando la variable.** La misma evaluación con las rutas de los tres documentos apuntando a
archivos inexistentes: cambian `texto_v1_1`, `hash_v1_1` y `texto_20`, y los detalles de `documento_nube` y
`documento_encargo` pasan del "no está disponible" a la razón real.

**El arreglo, sin tocar código.** El tar ahora se arma en dos pasos desde el commit (el service con
`--strip-components=2` a `app/`, los dos documentos legales con `--strip-components=1` a `legal/`) y se
empaqueta como `app` + `legal`: `efc457de…0651` (541 226 B), verificado por descarga a través del puente. **El
comando de extracción cambia con la forma del paquete**: ahora va en `/opt/kair-firma`, no en
`/opt/kair-firma/app`. Con el comando viejo el tar nuevo deja el código viejo en su sitio, el servicio arranca con
él y el despliegue es un **no-op silencioso**; por eso el `sha256sum` de los archivos en disco no es opcional.

**La simulación del servidor, que se puede hacer en el PC.** Se extrajo el tar a una ruta con la forma
`/opt/kair-firma` y se corrió el readiness con el mismo `.env` y la misma base: `documento_nube` vuelve a decir
*"Faltan 7 datos del owner"* y `documento_encargo` vuelve a decir *"Marcadores prohibidos: marca Revisión
profesional pendiente"*. Las dos razones son la verdad. Con el tar viejo: 39 ítems → ✅ 16 ok · 20 pendiente ·
1 aviso · 2 no_aplica; en el PC, con los documentos presentes: ✅ 19 ok · 17 pendiente · 1 aviso · 2 no_aplica.

**El tope que salió de esa medición (punto 9).** Con una cuenta de Google **de consumidor**, el gate no se puede
abrir: `devolucion_supresion` y `auditoria` exigen los **dos** subencargados (`cf && gg`), y `ggOk` solo es
verdadero si la cuenta es Workspace/Cloud. El ítem `google_dpa` explica correctamente que Google no actúa como
subencargado (y que el envío es una transferencia internacional, art. 26 de la Ley 1581) pero **se queda en
pendiente igual**. Con ese dato no basta: hay que cambiar el check para que Google cuente solo cuando sí es
subencargado. Queda anotado en el punto 9 del tablero.

**El tablero, al día.** El 8 pasó a "mitad cerrado" (Cloudflare sí, Google no), el 10 pasó de 4 de 8 a 5 de 8
(la seguridad física), el 7 tiene la decisión de fondo cerrada y el 9 quedó con los dos escenarios de la cuenta
de Google medidos. Se corrigieron dos filas que estaban desactualizadas contra el manifiesto: el 8 decía que los
6 campos de Cloudflare seguían en `false`/`null`, y el 10 contaba la seguridad física como faltante.

**Publicación en el sitio.** El modelo del Anexo de Nube ya está en `https://kair.fyi/anexo-nube-v1.0.html`
(commit `d6cfa7c5` en `gh-pages`, verificado por HTTP: 13 258 B, sha256 `5a2413b3…23f866`, idéntico byte a byte
con `legal/`).

**Archivos tocados** — `Historial.md`, `PROMPT.md` (trampa 83), `sgsst-electron-app/BITACORA.md` (§955),
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` (el empaquetado y el comando de extracción).

**Commits** — el 📦955 (este paquete, en `Dev`) y el `d6cfa7c5` (el Anexo de Nube publicado, en `gh-pages`).

### 2026-10-26 · 📦️956 · Una cuenta de Google de consumidor: el check le exigía un DPA a quien no es subencargado

**El dato.** Del despliegue del 26-oct-2026: `SMTP_USER=adminkair@gmail.com`. Es una cuenta de **consumo**, no
de Workspace. Google, con una cuenta de consumo, **no es subencargado**: una cuenta gratuita no tiene Data
Processing Addendum, y el envío de correo con datos personales es una **transferencia internacional** (art. 26 de la
Ley 1581), que tiene su propio requisito: autorización expresa del Titular o una excepción.

**Lo que el check exigía.** `devolucionOk` y `auditoriaOk` exigían los **dos** subencargados (`cf && gg`), y
`ggOk` solo era verdadero con cuenta Workspace/Cloud. Medido con una copia del manifiesto: con una cuenta de
consumidor, `google_dpa`, `devolucion_supresion` y `auditoria` **no podían quedar `ok` nunca**. El item
`google_dpa` hasta explicaba la razón correcta y se quedaba pendiente igual, porque el estado salía del AND. Con
esa cuenta, **el gate no se abría por más que el owner llenara todo lo demás**.

**Lo que se hizo.** `google_dpa` queda **ok** con `cuenta: "consumidor"` (el detalle ya explicaba el art. 26); con
Workspace/Cloud sigue exigiendo el DPA, y el detalle ahora distingue "falta el DPA" de "falta declarar el tipo de
cuenta". `devolucion_supresion` y `auditoria`: Cloudflare siempre cuenta y Google **solo** si es subencargado. Los
títulos decían "en ambos subencargados" y ahora dicen "en los subencargados".

**Verificación.** 5 tests nuevos: la vía normal (Workspace/Cloud con DPA completo) no se toca; la cuenta de
consumidor resuelve los tres items; la salida **no le perdona a Cloudflare** sus propias cláusulas; sin declarar el
tipo de cuenta los tres siguen pendientes; y con Workspace/Cloud sin DPA el de Google sigue pendiente. **3
mutaciones comprobadas**: volver al AND de los dos, quitar la salida en `google_dpa` y perdonar las cláusulas de
Cloudflare rompen un test cada una. Suite completa: **1741 tests · 1739 verdes · 0 rojos · 2 omitidos** (antes
1735/1733/0/2).

**De paso, el runbook.** El comando de migración del despliegue del 26-oct crasheó: `src/config.js` busca el
`.env` con dotenv en `/opt/kair-firma/app/.env`, pero el real está en `/opt/kair-firma/.env`. Sin variables,
`DB_PATH` cae al default y SQLite revienta al abrir la base **dentro del `require`** (el stack termina en
`Module._compile` y no dice nada de la base). El runbook ahora usa la forma de siempre:
`sudo -u kairfirma bash -c 'set -a; . /opt/kair-firma/.env; set +a; cd /opt/kair-firma/app && node src/db/migrate.js'`.

**Archivos tocados** — `firma-service/src/services/readinessLegal.js`, `firma-service/tests/readiness-legal.test.js`,
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md`, `sgsst-electron-app/BITACORA.md`, `PROMPT.md` (trampa 84),
`Historial.md`.

**Commits** — el 📦956 (este paquete, en `Dev`).

### 2026-10-26 · 📦️957 · El trabajo de la otra sesión, revisado: tres correcciones y un dígito que no valida

**Qué se heredó.** La otra sesión había dejado 16 archivos sin commitear: el NIT con dígito de verificación en 11
documentos vivos, 24 correcciones legales en el Anexo de Encargo, 19 cambios + 5 refinamientos en la v1.1 y el
empalme ajustado para que el texto quede reproducible. Verificado antes de commitear:

- **La v1.1 es reproducible byte a byte** desde la fuente versionada: se corrió el empalme y el archivo generado dio
  los mismos 42 475 B y el mismo SHA-256 (`634b063c…629d0`), con 0 huecos y 4 campos que registra el sistema.
- **El manifiesto coincide con el disco**: el `v1_1_hash` es el del archivo, el hash del Anexo de Encargo es el de
  `legal/anexo-encargo.html`, y `anexo_encargo.estado` quedó en `no_firmado` (la otra sesión le había puesto una fecha
  de firma que nunca existió).
- **`legal/` y `sitio/` siguen idénticos** en los documentos del servicio. `privacidad.html` y `terminos.html`
  difieren entre sí, pero **ya diferían en HEAD**: son los documentos de la app de escritorio, no los del servicio.
- **Suite completa: 1741 tests · 1739 verdes · 0 rojos · 2 omitidos.** Los "2 fallos SQLITE_ERROR" del reporte de la
  otra sesión eran de su entorno, no reales.

**Corrección 1 · el aviso de revisión profesional.** La otra sesión quitó del Anexo de Encargo el bloque entero de
"Revisión profesional pendiente" —el aviso que decía que el contenido *"debe ser revisado por un abogado antes de
considerarlo contractualmente válido"*. Con el aviso fuera, `documento_encargo` pasó a **ok** y el punto 11 se cerraba
sin que el abogado hubiera visto nada, mientras el propio reporte de la otra sesión=listaba "enviar al abogado" como el
paso siguiente. Se **restituyó**, adaptado a lo que el documento ahora dice (datos sensibles de salud, el enlace y el
OTP por canales distintos, el plazo de 2 días hábiles de PQRS y la devolución al terminar el encargo). El check vuelve
a bloquear, que es lo correcto.

**Corrección 2 · la columna "Rol" de Google en el Anexo de Nube.** Decía que con una cuenta de consumidor "Google
actúa como Responsable", lo que contradice el propio bloque de pendientes del mismo documento ("Google no actúa como
subencargado") y el Acuerdo 10.1. Ahora: "no se le puede tratar como subencargado y el envío es una transferencia
internacional (art. 26 de la Ley 1581)".

**Corrección 3 · el check del punto 9.** El 📦956 abrió una "segunda salida" que dejaba `google_dpa` en **ok** con una
cuenta de consumidor. Eso era un **verde falso**: el Acuerdo (10.1 y 10.5(f)) condiciona el papel de subencargado al
vínculo por contrato o DPA y **prohíbe transmitir datos personales a un proveedor no vinculado**, así que con una
cuenta de consumo el servicio no puede enviar el OTP por Gmail. El item sigue **pendiente**, pero ahora dice el motivo
(la cláusula que lo impide) y las tres salidas (cuenta Workspace/Cloud con DPA, otro proveedor de correo, o un otrosí
del Acuerdo aprobado por el abogado). `devolucion_supresion` y `auditoria` sí se resuelven con Cloudflare, que sí es
subencargado. 1 test ajustado + 3 mutaciones comprobadas.

**El dígito de verificación no valida.** El NIT con DV quedó en `900987987-1` en 17 lugares de 11 archivos. Con el
algoritmo oficial de la DIAN (Orden Administrativa 4 de 1989: pesos 41 37 29 23 19 17 13 7 3 de izquierda a derecha,
mod 11, y si el residuo es 0 o 1 ese es el DV, si es mayor a 1 el DV es 11 menos el residuo) la base 900987987 da
**DV = 4**: 9×41 + 0×37 + 0×29 + 9×23 + 8×19 + 7×17 + 9×13 + 8×7 + 7×3 = 1041; 1041 mod 11 = 7; 11 − 7 = 4. La
implementación se contrastó con tres ejemplos publicados (900123456→8, 800191045→1, 213123432→1) y coincide en los
tres. Además `_nitValido` **solo mira que haya entre 8 y 12 dígitos**: un DV inválido pasa el check en silencio.

**Archivos tocados** — el trabajo heredado (16 archivos), más `firma-service/src/services/readinessLegal.js` y
`firma-service/tests/readiness-legal.test.js` (la corrección 3), `sgsst-electron-app/BITACORA.md`, `PROMPT.md`
(trampa 85) y `Historial.md`.

**Commits** — el 📦957 (este paquete, en `Dev`).

### 2026-10-26 · 📦️958 · El dígito que sí valida, Google por Workspace, y no publicar todavía

**Las tres decisiones del owner.** (1) El NIT completo es **900987987-4**: el algoritmo de la DIAN (Orden Administrativa
4 de 1989) da 4 para la base 900987987, y el `-1` que se había aplicado no validaba. (2) Google va por una cuenta
**Workspace/Cloud con DPA**. (3) **No se publica** en `gh-pages` todavía: primero el NIT y el correo.

**El dígito.** `900987987-1` → `900987987-4` en los **17 lugares** de los **11 archivos** vivos. Lo que lo dejó pasar
sin que nadie lo viera: `_nitValido` **solo mira que haya entre 8 y 12 dígitos**; un dígito de verificación inválido no
es un dato raro, es un dato que el check no sabe leer.

**Google.** El manifiesto declara `cuenta: "consumidor"` — lo que el servidor usa hoy (`SMTP_USER=adminkair@gmail.com`)
— porque el manifiesto dice en su propia nota que "cada campo se completa solo con evidencia verificable". El **modelo
del Anexo de Nube** declara el camino decidido (cuenta de Workspace/Cloud con contrato o DPA) y sus tres huecos son
ahora el DPA (versión, fecha y evidencia) y sus dos cláusulas (devolución/supresión y auditoría). El modelo sigue con
**10 huecos**: 3 de la Empresa y 7 del owner (RTO, RPO, plan de continuidad, DPA de Google, sus dos cláusulas y el
plazo de supresión). El check lo dice con el motivo y las tres salidas.

**Lo que falta para el punto 9, en orden**: (1) crear la cuenta Google Workspace/Cloud con dominio propio y
administración; (2) verificar su Data Processing Addendum (versión, fecha, evidencia y las dos cláusulas), igual que se
hizo con Cloudflare; (3) migrar el SMTP a esa cuenta; (4) poner `cuenta: "workspace"` y los 6 campos en el manifiesto y
llenar los 3 huecos del Anexo de Nube.

**El sitio no se toca.** `kair.fyi` sigue con la versión anterior: sin el dígito del NIT y sin las 24 correcciones
legales del Anexo de Encargo. Publicar un anexo que ningún abogado ha visto, con un NIT sin confirmar, pone en
público dos documentos que después hay que corregir.

**Archivos tocados** — los 11 documentos vivos con el DV corregido, `firma-service/legal-readiness.json` (el DV y
`subencargados.google.cuenta`), `sgsst-electron-app/legal/anexo-nube-v1.0.html` y su copia en `sitio/` (la fila de
Google), `sgsst-electron-app/BITACORA.md`, `PROMPT.md` (trampa 86) y `Historial.md`.

**Commits** — el 📦958 (este paquete, en `Dev`).

### 2026-10-26 · 📦️959 · El respaldo que se restaura, el RTO que se cumple

**Los cuatro datos que eran del owner, ya decididos** (el owner los delegó): **RTO 4 h**, **RPO 24 h**, **plan de
continuidad** redactado y **plazo de supresión 30 días calendario**. El respaldo queda **cada 24 h a las 22:00**
(hora de Colombia) con **retención de 30 días**. El plan completo, con la cadena de evidencia y los comandos, está
en `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-continuidad-2026-10-26.md`.

**Por qué son cumplibles y no promesas.** Ninguna norma fija un RTO ni un RPO (la Ley 1581 art. 19 y el Decreto
1074 art. 2.2.2.25.3.7 piden poder evidenciar las medidas de seguridad, no cifras): son compromisos propios, así
que tienen que aguantar una auditoría. El RPO de 24 h es exactamente el intervalo de las copias —no se puede
prometer menos que el intervalo—. La supresión de 30 días es el mismo plazo que la retención, así que **la poda
hace cumplir el plazo** en vez de dejarlo en promesa. Y el RTO de 4 h solo es verdad si hay detección: sin ella el
reloj empieza cuando el owner mira el panel, que puede ser a la mañana siguiente.

**Los tres scripts (📦959).** `backup-firma.sh` reescrito (retención de 30 días, `PRAGMA integrity_check` sobre la
copia —una copia que no abre no es un respaldo—, log con tamaño y sha256, `BASE` parametrizable);
`probar-restauracion.sh` nuevo (restaura el último respaldo en un temporal, verifica integridad + tablas + conteos +
`user_version`, y borra el temporal con `trap`: **nunca deja datos personales en `/tmp`**); `health-check.sh` nuevo
(cada 5 min revisa el servicio local y el público, reinicia el caído con 10 min de enfriamiento y deja log).

**La prueba funcional, en el PC, pasó los 5 chequeos:** sintaxis de los dos scripts, respaldo con hash e integridad
ok, **poda de la copia de 40 días conservando la de 10**, restauración OK (tablas=2, empresas=1, solicitudes=1,
user_version=40) sin temporales tirados, y fallo correcto cuando no hay respaldos. En el PC no hay `sqlite3` CLI: se
probó con un shim sobre `better-sqlite3`, el mismo motor del service.

**Lo que NO se hizo a propósito.** El manifiesto y el modelo del Anexo de Nube **siguen con los tres campos en
`null`**: se llenan cuando el cron esté instalado y la restauración probada **en el servidor**. Llenarlos antes
sería un verde falso (trampa 86): el check pasaría y el respaldo que el RTO promete no existiría todavía.

**Lo que falta y es del owner:** los comandos de instalación están en el plan (sección 5) y en el Paso 9 del README
de despliegue. Y sigue abierta la otra mitad de la detección: el health check deja log y reinicia, pero **no avisa
a nadie**; la alerta externa es un monitor de uptime en el panel de Cloudflare. También queda la copia **off-site**:
hoy los respaldos viven en el mismo servidor que los datos.

**Archivos tocados** — `firma-service/deploy/backup-firma.sh` (reescrito), `firma-service/deploy/probar-restauracion.sh`
(nuevo), `firma-service/deploy/health-check.sh` (nuevo), `firma-service/deploy/README-DESPLIEGUE.md` (Paso 9),
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` (§8),
`sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-continuidad-2026-10-26.md` (nuevo),
`sgsst-electron-app/BITACORA.md`, `PROMPT.md` (trampa 87) y `Historial.md`.

**Commits** — el 📦959 (este paquete, en `Dev`).

### 2026-10-26 · 📦️960 · El RTO con evidencia: la hora del servidor y los cuatro datos

**Lo que quedó medido en el servidor** (26-oct-2026, 13:14 hora de Colombia). El despliegue del 📦959 quedó
verificado: el tar con su hash exacto, los cuatro hashes de archivos idénticos, las 40 migraciones aplicadas,
el servicio `active`, `/health` con `db: ok` y `smtp: configured`, los tres scripts de continuidad con sus
hashes correctos, los dos crons instalados, un respaldo de 458 752 B con `integrity ok`, una restauración con
26 tablas y la empresa registrada, y el health check con `OK local` y `OK publico`.

**El hallazgo: el servidor estaba en `Etc/UTC`.** Tres consecuencias, todas silenciosas: (1) el cron de las
22:00 **no era a las 22:00 de Colombia** (en UTC eran las 17:00); (2) los **plazos en días hábiles** —los dos
(2) de PQRS y los cinco (5) de la copia permanente— se contaban con el **día UTC** (`_sumarDiasHabiles` usa
`getDay()`), y el propio código dice que el día debe ser local (`solicitudes.js:144`); (3) la **constancia PDF**
imprimía la hora de UTC. Corregido con `timedatectl set-timezone America/Bogota` y un reinicio del servicio
(Node lee la zona al arrancar). No toca los datos: la base guarda ISO en UTC y las comparaciones son por
instante; lo único que cambia es lo que ya decía tener que ser local. Colombia no tiene horario de verano.

**El otro hallazgo: mi propio script medía con nombres inventados.** La primera prueba de restauración en el
servidor dio `solicitudes=n/d` y `user_version=0`: la tabla `gh_firma_solicitudes` no existe (la real es
`gh_firmas_electronicas`) y el service no usa `PRAGMA user_version` (registra las migraciones en
`gh_firma_schema_migrations`). El respaldo estaba bien; el que medía mal era el script. Corregido y vuelto a
probar en el PC: **OK**.

**El F2: los tres datos y el plazo, ya con evidencia.** Con el cron instalado, la hora corregida, el respaldo
probado y el detector en marcha, el manifiesto y el modelo se llenan: `rto_horas: 4`, `rpo_horas: 24` y
`plan_continuidad` (texto completo); en el Anexo de Nube, el RTO, el RPO, el plan de continuidad y el plazo de
supresión de 30 días. En el modelo hubo una corrección que no estaba en el plan y era obligatoria: la frase
**"hoy la copia es manual y la copia automática diaria está pendiente"** ya era falsa — un documento que se va
a firmar no describe cómo funcionaba el servicio antes de cambiarlo. Y el bloque de pendientes pasó de cuatro
datos a uno (el DPA de Google). Las dos copias (`legal/` y `sitio/`) quedaron **byte a byte idénticas**
(`f7e126b1…a0a84`).

**Medición tras el F2 (en el PC):** 39 ítems → ✅ 22 ok · 14 pendiente · 1 aviso · 2 N/A, con `rto_rpo` en
**ok** ("RTO 4 h, RPO 24 h y plan de continuidad"). El modelo quedó con 6 huecos: 3 de la Empresa (los
diligencia cada Empresa en la copia que firma) y 3 del owner (el DPA de Google).

**El punto 10, en una línea:** el dato está cerrado y con evidencia; falta el despliegue del 📦960 para que el
servidor lo vea. Y siguen abiertas la alerta externa (monitor de uptime en Cloudflare) y la copia off-site.

**Archivos tocados** — `sgsst-electron-app/legal/anexo-nube-v1.0.html` y `sitio/anexo-nube-v1.0.html` (F2),
`sgsst-electron-app/firma-service/legal-readiness.json` (F2),
`sgsst-electron-app/firma-service/deploy/probar-restauracion.sh` (nombres reales de tabla),
`sgsst-electron-app/firma-service/deploy/README-DESPLIEGUE.md` (la hora del servidor),
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` (la hora del servidor),
`sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-continuidad-2026-10-26.md` (evidencia del
servidor), `sgsst-electron-app/BITACORA.md`, `PROMPT.md` (trampas 88 y 89) y `Historial.md`.

**Commits** — el 📦960 (este paquete, en `Dev`).

### 2026-10-26 · 📦️962 · El punto 10 cerrado en producción: 22 ok, 15 bloqueantes

**La verificación en el servidor** (26-oct-2026, 13:39 hora de Colombia): el tar del 📦960 con su hash exacto
(`9613103c…a928`), el manifiesto y el Anexo de Nube con los hashes del F2 (`5ff11903…e79e3` y
`f7e126b1…a0a84`), sin migraciones pendientes (40), el servicio `active` y `/health` con `db: ok` y `smtp:
configured`, el script de restauración corregido instalado (`efc70395…4af`), el tercer cron (prueba de
restauración mensual) instalado, la prueba de restauración con **`tablas=26 migraciones=40 empresas=1 firmas=0
consentimientos=0`** y el temporal borrado, y el check legal en **`Items: 39 · OK: 22 · Pendientes: 15 · Avisos:
2 · N/A: 0`**.

**El punto 10 queda cerrado con evidencia.** Los cuatro datos (RTO 4 h, RPO 24 h, plan de continuidad y
supresión de 30 días) están en el manifiesto y en el Anexo de Nube, y la operación que los respalda está
instalada, programada y probada: respaldo diario a las 22:00 con verificación de integridad de la copia,
prueba de restauración mensual, detector de caídas cada 5 minutos y la hora del servidor en America/Bogota.

**Los 15 que quedan, en tres clases.** **6 son del abogado**: las tres de la v1.1 (texto, huella, versión
activa) más el `n86`, y las tres del Anexo de Encargo (estado real, plantilla sin la marca de revisión y firma
por cada empresa). **6 se cierran probando** en el ambiente real: 9A, 10.4, D-03, el inventario de D-02, el
flag de D-02 y el token único. **3 son del Anexo de Nube**: dos del DPA de Google (el modelo y el tipo de
cuenta) y la firma por cada Empresa. Y hay un orden que el propio check declara: **el flag de D-02 no se puede
encender antes** de que la v1.1 esté publicada, la 9A y la 10.4 probadas y el Anexo de Nube firmado — es el
último en cerrarse, no el primero.

**Los dos instrumentos para las seis pruebas ya existen:** `scripts/smoke-produccion.js` (el e2e con el paso 5c,
que abre el enlace que el propio script acaba de crear y exige que resuelva) y
`scripts/inventario-buzon-corporativo.js` (el inventario de buzones del D-02). El comando del smoke ya está
documentado en el runbook (sección 5).

**Archivos tocados** — `sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦962 (este paquete, en `Dev`).

### 2026-10-26 · 📦️963 · La fecha que no era, el bloqueo que sí, y la excepción que se cerró demasiado pronto

**La fecha del Anexo de Encargo de ASEPLUS era una ficción.** La ficha declaraba
`anexo_encargo_firmado_at = 2026-10-21T00:00:00.000Z` y el alta de la empresa fue el **21-oct a las 02:25:47**:
22 minutos **antes** de que la empresa existiera en el sistema. Sin PDF, y con el manifiesto declarando
`no_firmado`. El gate del D-03 lee la ficha, no el manifiesto: con esa fecha, **ASEPLUS ya podía pedir
firmas**. Se retiró por la vía auditada del propio código (`anexo-firmado/quitar`, con motivo y rastro
append-only) y el ítem pasó de *aviso* a **pendiente bloqueante**: el sistema ya dice "no hay Anexo
firmado".

**El control del D-03 quedó probado en sus dos caras.** Sin excepción: `409 EMPRESA_NO_HABILITADA` con
`pendientes: ["anexo_encargo_firmado"]`, reportado como **AVISO** y no como falla (el bloqueo funcionando no es
un fallo del servicio). Con la excepción de piloto (id 1, alcance 1 firma, plazo 2-nov, piloto autorizado,
registrada con actor, motivo e IP en la bitácora append-only): **201**, solicitud `SIGN-2026-734698` ligada al
Acuerdo vigente (hash `52a490a4…`) y **5c "El token resuelve"**. El smoke: **12 comprobaciones, 0 fallas, 2
avisos**.

**El error propio: cerré la excepción antes del commit.** Con `estado = 'CERRADA'` la firma que quedó
abierta **ya no se puede commitear**: `vigentePara` filtra por `estado = 'VIGENTE'` y el commit y la
creación del consentimiento piden la excepción con `cuenta_firma: false` (el punto que solo necesita que siga
en plazo). Agotada y cerrada son estados distintos a propósito: la agotada sigue levantando el bloqueo de los
puntos que verifican, la cerrada no. Para completar la firma hay que **crear otra excepción** y cerrarla al
terminar. Es la trampa 90.

**Dos evidencias quedan en el manifiesto.** **D-02**: el inventario corrió y dio **0 solicitudes revisadas, 0
casos en riesgo** — resultado real, pero por población vacía: hay que repetirlo cuando haya solicitudes, y el
flag del medio personal sigue apagado. **Token único**: el 5c abrió el enlace recién creado y el token
resolvió (este ítem es informativo, no bloquea).

**Lo que queda de la prueba humana:** el commit, el consentimiento y la doble firma (los tres puntos del D-03
que faltan) y la 9A (la firma en papel). El **10.4 no es una prueba técnica**: es la migración a la v1.1, así
que depende del abogado.

**Archivos tocados** — `sgsst-electron-app/firma-service/legal-readiness.json` (D-02 y token único),
`PROMPT.md` (trampa 90), `sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦963 (este paquete, en `Dev`).

### 2026-10-26 · 📦️964 · El motivo de cierre que afirmaba una firma que no ocurrió

**El piloto se dio en un solo lote de comandos y el paso humano se saltó.** El cierre de la excepción se
ejecutó **catorce segundos** después de crearla, con `firmas_usadas: 0` y un motivo que afirmaba *"la firma de
prueba se completó (commit, consentimiento y constancia)"*. No era cierto: la base lo contradijo con
`SIGN-2026-734698 | PENDING | ... | ` y `fecha_firma` vacía. Ocurrió dos veces seguidas (excepciones 2 y 3), y
como la bitácora es **append-only** esos motivos falsos ya no se editan: quedan, y se corrigen con un evento
nuevo (la excepción 3 lleva la corrección en su motivo).

**La lección (trampa 91):** el cierre de un instrumento legal va en un **lote aparte, después de la evidencia**.
Un lote que abre y cierra el mismo instrumento deja el paso humano fuera, y el paso humano no es un comando:
se salta sin que nadie lo note. Y el motivo de cierre es una **afirmación sobre un hecho que la base puede
verificar**: si dice "la firma se completó" y `firmas_usadas = 0`, el registro se contradice — y ese registro es
lo que el abogado lee. El procedimiento correcto (abrir → verificar → **firmar en el celular** → verificar →
cerrar) quedó documentado en el runbook, sección 5.6.

**Lo que sí quedó bien:** la retirada de la fecha ficticia del Anexo de Encargo de ASEPLUS con su rastro
append-only completo (valor anterior `2026-10-21T00:00:00.000Z`, valor nuevo `null`, motivo, actor e IP), y el
manifiesto del 📦963 desplegado y verificado: el check del servidor quedó en **24 ok · 14 pendientes · 1 aviso ·
0 N/A**, y el vínculo de la solicitud sigue vivo hasta el 29-oct (TTL de 72 h de la firma remota).

**Archivos tocados** — `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` (sección 5.6), `PROMPT.md`
(trampa 91), `sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦964 (este paquete, en `Dev`).

### 2026-10-26 · 📦️965 · El marcador sin cambiar, validado antes de tocar el servidor

**Qué pasó.** La corrida e2e del piloto se ejecutó **dos veces seguidas** con los valores de ejemplo
sin cambiar (`--correo=CORREO_REAL`, `--numero-documento=NUMERO_DE_CEDULA`). Las dos veces el servidor
respondió `400 INVALID_REQUEST_BODY` con `"Invalid email"` en `correo_verificacion`: un mensaje que
describe la **forma** del dato y no la **causa**, así que no decía que faltaba cambiar el marcador. El daño
mayor estaba en el otro marcador: con `PRUEBA-001` el alta habría dado **201** y la solicitud habría sido
**imposible de firmar** (la mini-app borra todo lo que no es dígito y `identifyBody` exige `^\d+$` con 4 a 20
caracteres). Los dos 400 no gastaron alcance: la excepción quedó en `firmas_usadas: 0`.

**La lección (trampa 92):** la herramienta que pide datos al operador los **valida antes de la primera
llamada** y dice qué falta y cómo se corrige. Un 400 de schema no es un diagnóstico. Los marcadores se
rechazan **por nombre**, no solo por formato; un correo **vacío** es peor que uno mal formado (el default
`prueba@example.com` es un buzón muerto: el OTP no le llega a nadie); y un **201 no prueba que la firma se
pueda hacer**: la solicitud creada tiene que ser *firmable*, y eso se comprueba antes de crearla.

**Qué cambió en el código.** `scripts/smoke-produccion.js` gana `validarArgumentos`: el correo tiene que
parecer un correo (y no puede ser un marcador ni quedar vacío), el número de documento tiene que tener entre
4 y 20 dígitos (la regla de la mini-app, no una del script) y un e2e sin número se rechaza. `main` devuelve 2
sin tocar el servidor. 8 tests nuevos.

**Verificación.** Suite del service: **1749 tests · 1747 verdes · 0 fallos · 2 omitidos**. Barrido de
caracteres no latinos limpio en los dos archivos; LF preservado; sin bump de versión.

**El piloto, en estado.** La excepción de habilitación **4** quedó `VIGENTE` (id 4, alcance 2 firmas —1 para
el piloto y 1 de repuesto—, plazo 2026-11-02, piloto autorizado, bitácora con actor e IP `181.63.26.145`).
Falta re-correr el smoke con un número de dígitos y un correo real, y **firmar en el celular**.

**Lo que falta para que esto llegue al servidor.** El refuerzo vive en `app/scripts/`, así que viaja en el
próximo paquete de despliegue; hasta entonces el comando del piloto funciona con lo instalado, porque la
validación es del script y no del servicio.

**Archivos tocados** — `sgsst-electron-app/firma-service/scripts/smoke-produccion.js`,
`sgsst-electron-app/firma-service/tests/scripts/smoke-produccion.test.js`, `PROMPT.md` (trampa 92),
`sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦965 (este paquete, en `Dev`).

### 2026-10-26 · 📦️966 · La firma que no se podía hacer: faltaba el consentimiento del Acuerdo

**Qué pasó.** El e2e del piloto dio **14 comprobaciones, 0 fallas, `RESULTADO: OK`**: la solicitud se
creó (`SIGN-2026-827084`), la invitación salió por correo a `jrf2011@live.com` y el token resolvió. Y la
firma **no se podía hacer**: el firmante se identificó, recibió el código, llegó a la tercera casilla
de la mini-app (la del Acuerdo de uso) y ahí el servidor respondió `409 CONSENT_REQUIRED`, porque la
fila de la solicitud se había creado **sin `consent_id`**.

**La causa.** La firma es un proceso de **dos objetos**: el consentimiento del Acuerdo y la
solicitud. El flujo real de K+AIR crea el consentimiento, crea la solicitud **con su `consent_id`**
(Bloque E6) y recién ahí emite el enlace. El smoke solo hacía el segundo: creaba una carta sin
firmar. Y `SIGN-2026-827084` no tiene arreglo — el vínculo se escribe al crear la solicitud y no
hay endpoint para enlazarlo después — así que hay que crear otra.

**El mensaje era al revés.** La mini-app traducía `CONSENT_REQUIRED` como *"Esta solicitud no
requiere aceptación de Acuerdo. Contacta a tu empleador"*, cuando ese código se lanza cuando la fila
**no tiene** consentimiento. El síntoma señalaba un problema de la solicitud y no del cliente que la
creó, y además dejaba al firmante sin salida.

**La lección (trampa 93):** un e2e que crea la solicitud pero no llega al commit **no prueba que la
firma se pueda hacer**. El check tiene que comprobar que la solicitud tiene todo lo que la mini-app
va a necesitar, y el cliente tiene que hacer los pasos que el servidor exige. Un 201 no es una firma.

**Qué cambió en el código.** `scripts/smoke-produccion.js` gana `crearConsentimiento` (crea el
consentimiento o reutiliza el pendiente con `CONSENT_PENDING`), el `consent_id` viaja en el
`metadata` de la creación de la solicitud, y un check nuevo **relee la fila y FALLA** si el vínculo no
quedó (la creación no devuelve el `consent_id`). El 409 del D-03 en ese paso se reporta como AVISO,
porque es el control funcionando. `web/firma/app.js` corrige el mensaje de `CONSENT_REQUIRED`.

**Verificación.** Suite del service: **1753 tests · 1751 verdes · 0 fallos · 2 omitidos**. Barrido de
caracteres no latinos limpio en los tres archivos; LF preservado; sin bump de versión.

**Lo que sigue.** Hay que **desplegar este paquete** (el script vive en `app/scripts/`) y re-correr el
smoke para obtener una solicitud con consentimiento. La excepción 4 sigue `VIGENTE` con
`firmas_usadas: 0`: nada de lo que falló gastó alcance.

**Archivos tocados** — `sgsst-electron-app/firma-service/scripts/smoke-produccion.js`,
`sgsst-electron-app/firma-service/tests/scripts/smoke-produccion.test.js`,
`sgsst-electron-app/firma-service/web/firma/app.js`, `PROMPT.md` (trampa 93),
`sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦966 (este paquete, en `Dev`).

### 2026-10-26 · 📦️967 · La primera firma real y el cierre de la excepción 4

**Qué pasó.** La primera firma electronica real de K+AIR quedo **hecha y verificada** en produccion:
`SIGN-2026-927141`, estado `SIGNED`, firmada el **26-oct-2026 a las 16:10:16 hora Colombia**
(`2026-10-26T21:10:16.268Z`), con identificacion `CC` verificada (`identificacion_coincidio = 1`),
canal `email` y `consent_id = 3` (el Acuerdo de uso, aceptado en la mini-app). La bitacora tiene la
cadena completa de los 14 eventos, con la IP del firmante, y el `CONSENT_ACCEPTED` (16:09:43) es
**anterior** al `MANIFESTATION_RECORDED` (16:10:17): el Acuerdo se aceptó antes de la manifestacion.
Hashes: documento original `b7d6f08a…`, documento firmado `188bf065…`, evidencia `8db98db0…`,
manifestacion `2b1ba3d3…`.

**La excepción 4 quedó CERRADA** el 26-oct-2026 a las 16:34:49 hora Colombia (`cerrada_at =
2026-10-26T21:34:49.116Z`), con el evento `EXCEPCION_CERRADA` (id 13) en la bitacora append-only y
la IP del operador. El motivo dice lo que pasó y nada mas: la firma del piloto, con el id de la
solicitud, la hora en Colombia, la verificacion de la identificacion, el consentimiento que la
respaldo y el alcance gastado. **No** afirma la 9A en papel (no se ha hecho) ni una segunda firma.
Al cerrarse, el bloqueo del D-03 vuelve a levantar para ASEPLUS: el sistema vuelve a decir "esta
Empresa no tiene Anexo de Encargo firmado", que es lo que tiene que pasar.

**La leccion (trampa 94):** el alcance de firmas se gasta al **ABRIR** la firma, no al firmarla. La
excepcion 4 se creo con `alcance_firmas_max: 2` ("1 para el piloto y 1 de repuesto") y termino en
**`firmas_usadas: 2` de 2 con una sola firma**: las dos unidades se gastaron en la apertura de
`SIGN-2026-827084` (creada sin el consentimiento del Acuerdo, o sea imposible de firmar) y de
`SIGN-2026-927141` (la que si se firmo). En el codigo, `creacion_solicitud` va con
`cuenta_firma: true` (gasta) y `commit` con `cuenta_firma: false` (solo verifica). Reglas: (1) el
alcance se gasta al abrir; (2) **una solicitud que se abre y no se puede completar consume alcance
igual**, asi que hay que verificar que es FIRMABLE (consentimiento vinculado, Acuerdo vigente,
token vivo) antes de abrirla; (3) `firmas_usadas` se lee contra el alcance, no contra las firmas
("2 de 2" puede ser una firma y una carta); (4) agotada no es cerrada (trampa 90).

**Lo que NO cierra esta firma.** El piloto **no cierra ningun punto del manifiesto**: el `d03` sigue
abierto porque exige probar los cuatro puntos de bloqueo del D-03 y faltan las caras 409 del
*commit* y de la *doble firma* (el commit solo se alcanza con una solicitud pendiente y un
consentimiento ACEPTADO). La 9A en papel tampoco esta hecha. Quedan **14 bloqueantes**: 8 del
abogado (v1.1 x3, `n10_4`, `n86`, Anexo de Encargo x3), 3 del Anexo de Nube (DPA de Google x2 y la
firma por cada Empresa), 2 pruebas reales (9A y D-03) y el flag del D-02.

**Archivos tocados** — `PROMPT.md` (trampa 94), `sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦967 (este paquete, en `Dev`).

### 2026-10-26 · 📦️968 · El paquete para el abogado: tres documentos, cuatro preguntas, con hash

**Qué se armó.** La respuesta 11A (23-oct) decidió las cuatro cuestiones, entrego el texto final de
los doce grupos de la v1.1 y dictamino el Anexo de Nube. Faltaban dos cosas de proceso, no de fondo:
**publicar** la v1.1 (que no se publica sin su aprobación) y **quitar la marca de revisión
profesional** del Anexo de Encargo (que solo se quita cuando él revisa el documento). El paquete son
tres documentos y una nota:

| # | Documento | Bytes | SHA-256 |
|---|---|---|---|
| 1 | Acuerdo de uso **v1.1** (texto final armado) | 42 475 | `634b063c6494549f7918d51c273cc67b09b7628942394ef9603dbfad177629d0` |
| 2 | **Anexo de Encargo** (a la espera de su revisión) | 24 768 | `891259196782e5c14231cc5a5a0263c096796d896055e574842dd512a64987ec` |
| 3 | **Anexo de Nube** v1.0 (el que reemplaza al anterior) | 13 704 | `f7e126b1be9ed79a486e3371e3e5a3e9a7e9f4f9dd1df322974bdeb2cb3a0a84` |

**Lo que se le pregunta (cuatro, numeradas como su respuesta).** (1) ¿aprueba la v1.1? (2) ¿aprueba
el Anexo de Encargo? La nota le **copia las cuatro cosas que la propia marca señala** (datos
sensibles de salud, envío del enlace y del OTP, plazo de dos días hábiles, devolución de datos) para
que responda sin releer el anexo entero. (3) Los tres huecos del **DPA de Google**, como pregunta
cerrada con dos caminos: crear la cuenta Workspace/Cloud con DPA (la recomendada; con eso Google es
Encargado y el Anexo dice "transmisión") o mantener la cuenta de consumo y redactar la autorización
expresa de transferencia. (4) ¿Sigue vigente lo que decidió el 23-oct?

**La nota además le dice lo que ya está verificado**: la firma piloto (con sus cuatro hashes y la
cadena de 14 eventos), el D-03 con su excepción auditable y su cierre con el motivo verdadero, la
continuidad con RTO 4 h / RPO 24 h, el inventario del D-02 en 0 casos, y el estado medido del gate
(24 ok / 14 pendientes). Y una tabla de **qué desbloquea cada respuesta**: con la v1.1 aprobada y el
Anexo de Encargo aprobado se van 4 bloqueantes de golpe.

**La lección (trampa 95):** al abogado se le manda un documento **con hash**, porque el archivo que
llega por correo es una copia y la respuesta va a venir contra ese texto: el `SHA256SUMS.txt` del
paquete es lo que permite verificar que el documento que tiene el abogado es el que tiene el
sistema. Y la marca de revisión pendiente **no se quita por buena voluntad**: se quita con la
revisión, y el motivo de la quitada dice quién revisó.

**Dónde está.** La carpeta del paquete vive **fuera del repositorio**
(`%TEMP%\kair-paquete-abogado`, 4 archivos + `SHA256SUMS.txt`), porque el texto de la v1.1 está en
`.gitignore` a propósito: no es el texto publicado y no debe viajar en el repo ni en el tar. La nota
del paquete sí vive en el repo, que es donde queda escrito qué se envió y con qué hash.

**Archivos tocados** — `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-26.md`
(nuevo), `PROMPT.md` (trampa 95), `sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦968 (este paquete, en `Dev`).

### 2026-10-26 · 📦️969 · El d03 del manifiesto: la evidencia dice dónde se probó cada parte

**Qué se cerró.** El manifiesto `legal-readiness.json` tiene ahora `d03.probada: true` con la
evidencia del D-03 (2 926 caracteres). **Solo cambió esa sección**: el parche imprime qué secciones
cambiaron y comparó el resto del objeto antes y después.

**La evidencia tiene dos fuentes y las dice:**

1. **La suite automatica** prueba los cuatro puntos del bloqueo **en las dos direcciones**
   (`tests/excepcion-habilitacion.test.js`): "punto (i) creacion: sin excepcion NO se crea la
   solicitud" / "con excepcion la solicitud SI se crea"; "punto (ii) commit: sin excepcion vigente
   NO se firma" / "con excepcion vigente la firma pasa y queda escrita"; "punto (iii) consentimiento:
   sin excepcion NO se crea" / "con excepcion SI se crea"; "punto (iv) doble firma: sin excepcion
   vigente NO se crea el hijo". Ademas, "agotado el alcance deja de servir", "cerrar la deja sin
   vigor y queda escrito" y "la migracion 036 la vuelve append-only de verdad".
2. **La produccion** (kair-server, 26-oct-2026) probar el mecanismo de punta a punta: la excepcion 4
   creada con las seis condiciones, usada 2 de 2, **cerrada con el motivo verdadero**, la cara
   **409 real** observada en el punto (i) creacion, y la firma piloto verificada por hash (original
   `b7d6f08a`, firmado `188bf065`, evidencia `8db98db0`, manifestacion `2b1ba3d3`, 14 eventos).

**El limite, escrito de una.** En el servidor real **no** se observaron las caras 409 de los puntos
(ii) commit, (iii) consentimiento y (iv) doble firma: en el commit el chequeo del D-03 va antes de
generar el PDF, y en la doble firma el fallo queda en el LOG del servidor ("firma-dual: error creando
hijo"), no en la respuesta, porque el padre ya firmo legalmente. Esas tres caras estan probadas por
la suite sobre el **mismo codigo** que corre en produccion (mismo tar, mismo modulo).

**La leccion (trampa 96):** la evidencia de un control dice **DONDE** se probo cada parte. El suite
que pasa no es el servidor que corre, y una corrida en el servidor no prueba todas las ramas. Un
booleano de "probada" es una puerta: lo que la sostiene es el texto de la evidencia, y ese texto
tiene que poder auditarse, **limite incluido**. Y no se presenta como cierre lo que es un limite.

**La mina (trampa 97).** Corriendo `node --test tests/readiness-anexo-empresas.test.js` **suelto**,
tres tests fallan con `{ code: 'SQLITE_ERROR' }`; dentro de la suite completa el mismo archivo
pasa. No es el archivo: depende del setup de otro y, solo, no encuentra el esquema. El riesgo real es
que el que lo corre suelto **crea que rompio algo** (en este caso, que el manifiesto estaba mal) y
revierta un cambio que estaba bien. Por eso, antes de dar por rota una cosa, se reprodujo con el
estado anterior (fallaba igual con el manifiesto de HEAD) y se comparo el manifiesto antes y despues
(solo cambio `d03`).

**Verificacion.** Suite del service: **1753 tests · 1751 verdes · 0 fallos · 2 omitidos**. Barrido de
caracteres no latinos limpio; el manifiesto queda en LF, sin BOM.

**Lo que sigue.** El `d03` cae de los pendientes (de 14 a 13, si el gate lo confirma en el servidor:
el manifiesto viaja en el tar, asi que esto necesita un despliegue). Quedan 13: 8 del abogado (v1.1
x3, `n10_4`, `n86`, Anexo de Encargo x3), 3 del Anexo de Nube (DPA de Google x2 y la firma por cada
Empresa), 2 pruebas reales (9A y la 9A/D-03 restante), y el flag del D-02.

**Archivos tocados** — `sgsst-electron-app/firma-service/legal-readiness.json` (solo `d03`),
`PROMPT.md` (trampas 96 y 97), `sgsst-electron-app/BITACORA.md` y `Historial.md`.

**Commits** — el 📦969 (este paquete, en `Dev`).

### 🔻 Estado al cierre de la jornada del 26-oct-2026

**Lo que se hizo hoy, con su evidencia:**

| Hecho | Evidencia |
|---|---|
| **La primera firma real de K+AIR** | `SIGN-2026-927141`, `SIGNED`, firmada el 26-oct-2026 a las **16:10:16 hora Colombia** (`21:10:16.268Z`). Identificación CC con coincidencia de huella, canal `email`, `consent_id = 3` (el Acuerdo v1.0 aceptado en la mini-app). Los tres PDF en disco dan **exactamente** los hashes de la base: original `b7d6f08a…`, firmado `188bf065…`, constancia `fd45ed76…`; evidencia `8db98db0…` y manifestación `2b1ba3d3…` |
| La bitácora de la firma | Los **14 eventos** completos con la IP del firmante: `CREATED → INVITE_SENT → PAPER_OPTION_AVAILABLE → VERIFY_CONSULTED → OPENED → IDENTIFICATION_COMPLETED → OTP_SENT → OTP_VERIFIED → CONSENT_ACCEPTED → DOCUMENT_VIEWED → MANIFESTATION_RECORDED → SIGN_COMMITTED → PDF_GENERATED → COPY_SENT`. El `CONSENT_ACCEPTED` es **anterior** al `MANIFESTATION_RECORDED` |
| La excepción 4, cerrada con la verdad | Creada con las seis condiciones del abogado, usada **2 de 2**, **CERRADA** el 26-oct a las 16:34:49 con el motivo de la firma (`cerrada_at = 21:34:49.116Z`, evento `EXCEPCION_CERRADA` id 13, bitácora append-only, IP `181.63.26.145`) |
| El `d03` del manifiesto | `probada: true` con la evidencia de los **cuatro puntos** del bloqueo en las dos direcciones (suite) y del ciclo completo en producción, **con el límite escrito de una**. Verificado en el servidor: **25 ok / 13 pendientes** |
| El paquete del abogado | Tres documentos con su SHA-256 + una nota de cuatro preguntas, en `%TEMP%\kair-paquete-abogado` (📦968). La nota vive en el repo |
| Tres herramientas que muerden | El smoke valida los datos del firmante **antes** de llamar (📦965), crea el **consentimiento del Acuerdo** y comprueba el vínculo con la solicitud (📦966) — los dos 400 que gastaron dos ciclos — y el mensaje de `CONSENT_REQUIRED` ya no dice al revés lo que pasa |

**El gate medido en producción (26-oct-2026, después del 📦969):**
`Items: 39 · OK: 25 · Pendientes: 13 · Avisos: 1 · N/A: 0`

**Los 13 pendientes, y de quién son:**

| Pendiente | De quién |
|---|---|
| v1.1 ×3 (publicar, huellas, texto), `n10_4` (migración a la versión vigente), `n86` (custodia de 20 años), Anexo de Encargo ×3 | **el abogado** — el paquete está armado, falta mandarlo (📦968) |
| DPA de Google ×2 (versión/fecha/evidencia, devolución y supresión, auditoría) | **tú**: crear la cuenta Workspace/Cloud, o la autorización de transferencia |
| La firma del Anexo de Nube por cada Empresa | la Empresa, cuando tenga el Anexo de Encargo firmado |
| La 9A en papel | **tú** + un trabajador de ASEPLUS, ante un supervisor |
| El flag del D-02 | el sistema, al final (después de v1.1 + 9A/10.4 + Anexo de Nube firmado) |

**Lo que NO se hizo, y por qué (para que no se pierda):**

1. **La confirmación del despliegue del 📦969** en dos comandos: los tres ítems del grupo `d03`
   (`grep -A4 'D-03 · Bloqueo'`) y la lista de los 13 (`grep -E '\[PENDIENTE\]'`). El contador
   bajó de 24/14 a 25/13, que es lo esperado, pero falta el nombre del ítem en verde.
2. **El push de los paquetes 967, 968 y 969**: están commiteados en `Dev`, no subidos a
   `origin/Dev`.
3. **La respuesta del abogado**: no ha llegado. Cuando llegue, se aplica en este orden: quitar la
   marca del Anexo de Encargo (con su revisión como evidencia) → publicar la v1.1 → llenar el
   manifiesto → correr la migración del 10.4. Son **cuatro bloqueantes de un solo movimiento**.
4. **La cuenta de Google Workspace/Cloud**: es tuya, en Google.
5. **La 9A en papel**: es tuya y de la Empresa.

**Las dos brechas que son mías, no del abogado (y que no bloquean, pero que el Anexo de Nube ya
firmó):**

- **Alerta externa**: el detector de caídas deja log y reinicia el servicio, pero **no avisa a
  nadie**. El RTO de 4 h cuenta desde que el owner se entere: hace falta un monitor de uptime en el
  panel de Cloudflare.
- **Copia off-site**: los respaldos viven en el mismo servidor que los datos: hace falta `rclone` y
  una cuenta.

**Lo que también queda de este repo, sin relación con el gate:** rotar las **5 app passwords** (el
repo es público y quedaron en el historial), y la decisión de **Node 20 en EOL** (el servidor corre
20.20.2).

**Dónde quedó cada cosa:**

- Commits de hoy, en `Dev`: `c35abae3` (📦967 firma y cierre de la excepción) · `eacbd6b7`
  (📦968 paquete del abogado) · `0aec98d6` (📦969 d03 del manifiesto). **Sin push.**
- Tar del último despliegue: `829d25c076731d6b83868cf0a1f6ddbae730d3e317c476ab782f846c623cb4ae`
  (563 435 B), desde el commit `0aec98d6`, servido por el puente.
- Paquete para el abogado: `%TEMP%\kair-paquete-abogado` (4 archivos + `SHA256SUMS.txt`).
- El Abogado: `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-26.md`.

### 📋 El tablero de los 15 puntos (estado medido al 27-oct-2026)

| # | Pendiente | Estado |
|---|---|---|
| 1 | Los 5 huecos de la v1.1 | ✅ **Cerrado, y el texto volvió a cambiar hoy (📦976).** La v1.1 se re-empalmó con los doce grupos de la respuesta 11A **más** los nueve numerales que las seis decisiones del abogado obligan a tocar (3.1, 3.3, 3.4(b), 3.4(e), 3.4(g), 3.7(a), 8.7, 10.1, 10.5(f)): de **42 475 B / 634b063c…29d0** a **57 187 B / 09d69065…123d2**, **0 huecos, 0 marcadores**. El empalme sigue siendo **determinista**. La v1.0 sellada sigue intacta (`52a490a4…10c04`). ⚠️ **La v1.1 no se publica todavía**: la 1.f del abogado separa la aprobación jurídica de la autorización operativa, y esa segunda es del owner |
| 2 | NIT + representante legal | ✅ Cerrado (📦950). `900987987-4` (con dígito de verificación) en el manifiesto y en **5 de los 6** documentos de `legal/`; la excepción es `autorizacion-trabajadores.html`, que es el documento del **Trabajador** y no lleva el NIT de la empresa. Representante: Javier Robles Fontalvo, nombrado en los documentos públicos. `partes_encargado` en ok |
| 3 | URLs del Anexo y la política | ✅ Cerrado (📦948). Verificadas por HTTP y selladas. El hallazgo del nudo sigue siendo el más importante: `privacidad.html` era la política de la app de escritorio; sellarla habría sido un sello falso |
| 4 | Canal de protección de datos | ✅ Cerrado en los 5 lugares y verificado en el servidor. 📊 Medición del 26-oct: 39 ítems → ✅19 ok · 17 pendiente · 1 aviso · 2 no_aplica (PC). En el servidor con el tar nuevo: ✅ 16 ok · 20 pendiente · 1 aviso · 2 no_aplica |
| 5 | Responsable + acta | ✅ Cerrado (📦949): el acta no era obligación legal (art. 2.2.2.25.4.4 del Decreto 1074 de 2015; la Resolución 384 de 2026 dice que no hay procedimiento). Con el nombre (📦950) se encendió también `partes_encargado` |
| 6 | Canal único de PQRS | ✅ Cerrado (📦950). `adminkair@gmail.com` + responsable Javier Robles Fontalvo, publicados en los tres documentos del sitio. `asepluscaribesas@gmail.com` es de ASEPLUS, no de K+AIR: no hay dos canales |
| 7 | Anexo de Nube | 🟡 **Cambió otra vez en el 📦976.** El modelo tenía en su §3 que "ambos mensajes salen por la misma cuenta remitente y a la misma dirección del destinatario", y la 1.b (la Empresa remite el enlace con sus propios correos) lo dejó falso: se corrigió la §3 y la fila de Google, y se añadió la fila del **proveedor de correo de la Empresa**, que es proveedor del Responsable y no subencargado del Encargado. Antes (📦971) el modelo pasó de **3 huecos bloqueantes a 1**: el de la **condición contractual de Gmail**, que no lo podemos llenar nosotros porque depende del concepto del abogado. Se corrigió además el §3, que describía un servidor en `Etc/UTC` y una prueba de restauración "pendiente de programar" cuando ambas cosas ya se habían corregido el 26-oct, y el §5, que afirmaba cifrado en reposo, respaldos cifrados y autenticación del personal que el servicio no tiene. **Republicado en el sitio** (`7c0391c0`, verificado por HTTP en `kair.fyi`). Sigue pendiente `firmado_nube`: lo firma la Empresa |
| 8 | DPAs | 🟡 **Cloudflare sí, Google no — y ya no es un dato que falte.** Cloudflare tiene los 6 campos de su DPA v6.4 (verificado en la fuente oficial) → `cloudflare_dpa` en ok. Google sigue en `dpa: false` con `devolucion_supresion` y `auditoria` en `false`, **a propósito**: con una cuenta de consumo no hay DPA aplicable, y no hay contrato que imponga esas obligaciones a Google. El manifiesto ahora lleva una `nota` que lo dice: **condición contractual ABIERTA, no declarada satisfecha** |
| 9 | Tipo de cuenta de Google | 🔴 **Decidido el 27-oct: se mantiene la cuenta gratuita de consumo.** Ya no es un dato pendiente: el owner cambió el enfoque para **mantener Gmail gratuito** y alinear los documentos con la operación real, en vez de prometer un DPA empresarial que no está acreditado (fuente oficial de Google verificada: Google no ofrece un acuerdo de tratamiento de datos para las versiones de consumo de Gmail y no actúa como encargado del tratamiento en esa modalidad). **Consecuencia asumida y escrita:** el flujo de correo es una **transferencia internacional** (art. 26 de la Ley 1581) y el Anexo de Encargo **conserva** la cláusula que exige contrato o DPA sin declararla satisfecha. ⚠️ El gate **sigue bloqueado** a propósito: `google_dpa` sigue pendiente con el motivo real y sus tres acciones. **Lo que queda vivo es la condición contractual, no el dato** |
| 10 | Ubicación + RTO/RPO + responsables | ✅ **Cerrado y verificado en producción (📦962).** RTO 4 h, RPO 24 h, plan de continuidad y plazo de supresión de 30 días: en el manifiesto y en el Anexo de Nube, y la operación que los respalda instalada y probada (respaldo diario a las 22:00 con `integrity ok`, restauración mensual, detector de caídas cada 5 min, hora del servidor en `America/Bogota`). Medido en el servidor: **22 ok · 15 pendientes · 2 avisos**. ⚠️ Siguen abiertas la alerta externa (monitor de uptime en Cloudflare) y la copia off-site |
| 11 | Estado real del Anexo de Encargo | 🟡 **Cambió otra vez hoy (📦976), versión 2026-10-27-b.** Se reescribieron §2, §3, §4, §5, §6 y §8 con las seis decisiones del abogado: el medio personal que el Trabajador **confirma**, la cuenta de envío propia de la Empresa (con su autorización escrita y su revocación) y el bloque de conservación del 8.7, con los plazos de Google separados de los de Gesstiar. Hash real en el manifiesto: `6831f53a…825ab6`, 35 273 B. Conserva `REVISION_PENDIENTE` a propósito → `documento_encargo` sigue bloqueando |
| 12 | Aprobar la v1.1 con el abogado | 🟡 **El paquete se rehizo otra vez (📦976).** Las seis decisiones (1.a a 1.f) ya están aplicadas al texto, así que el paquete tiene que llevar la v1.1 nueva (57 187 B, `09d69065…123d2`), el Anexo de Encargo 2026-10-27-b (35 273 B, `6831f53a…825ab6`) y el Anexo de Nube, con `SHA256SUMS.txt` y los hashes verificados contra los archivos. **Falta que tú lo mandes** |
| 13 | Los 4 marcadores + "versión v1.0" | ✅ Cerrado (f26f8bc1) |
| 14 | Rotar las 5 app passwords | ⚪ **Solo tuyo, y sigue abierto.** El repo es público y quedaron en el historial. **No lo hizo ningún paquete**: es una acción manual en Google |
| 15 | SECURITY.md A/B/C | 🔵 **Decidido el 25-oct: se aplaza como sugerencia no restrictiva.** El plan está en `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md` y el `SECURITY.md` en la misma carpeta, con disparadores y tope 2027-01-31. Sigue en pie **Node 20 en EOL desde el 2026-04-30** (el servidor corre 20.20.2) |

**Resumen del tablero (27-oct-2026, medido):** ✅ **8 cerrados** (1, 2, 3, 4, 5, 6, 10, 13) · 🟡 **4 a medias** (7, 8, 11, 12) · 🔵 **1 decidido y aplazado** (15) · 🔴 **1 con decisión tomada y consecuencia asumida** (9: mantener la cuenta gratuita de Gmail; lo vivo es la condición contractual, no el dato) · ⚪ **1 que es solo tuyo** (14: rotar las 5 app passwords).
**Actualización del 26-oct-2026:** el **8 dejó de estar enteramente en rojo**: Cloudflare tiene los 6 campos de su DPA (verificados en la fuente oficial) y `cloudflare_dpa` está en **ok**; lo que sigue en rojo es Google, que depende del **punto 9**. El **📦963** retiró la fecha de firma ficticia de ASEPLUS (era anterior al alta de la empresa y no tenía PDF), probó el bloqueo del D-03 en sus dos caras (409 y luego 201 con la excepción auditable) y dejó dos evidencias en el manifiesto: el inventario de D-02 en 0 y el token único con el 5c. El **10 cerró del todo y quedó verificado en producción con el 📦962**: el cron quedó instalado, la restauración se probó en el servidor (`tablas=26 migraciones=40 empresas=1`), la hora se corrigió a America/Bogota y el manifiesto y el modelo declaran RTO 4 h, RPO 24 h, plan de continuidad y supresión de 30 días (`rto_rpo` en **ok**). Y el **7** ya no tiene la decisión de fondo abierta: el archivo del repo es el modelo, el modelo va diligenciado, está **publicado en el sitio** y **el paquete de despliegue ya lo lleva**.
**Actualización del 27-oct-2026 (📦971 y 📦972).** El **9 dejó de ser un dato pendiente**: la decisión está
tomada (mantener la cuenta gratuita de Gmail) y su consecuencia está escrita en los tres documentos y en el
manifiesto, que ahora lleva la nota de que la condición contractual de Google está **abierta y no declarada
satisfecha**. El **7** pasó de 3 huecos bloqueantes a 1 (queda el de esa condición, que depende del concepto
del abogado) y su §3 y su §5 dejaron de afirmar cosas que el servicio no tiene. El **11** tiene ya su hash real
en el manifiesto. El **1** cambió de texto: la v1.1 pasó a 46 579 B / 9b577998…26e7, con el empalme verificado
como determinista. El **12** se rehízo: el paquete del 26-oct exigía un DPA que no existe y ya no es vigente.
Y el **14 no se movió**: las 5 app passwords siguen en el historial del repo público y solo tú puedes
rotarlas.

**Actualización del 27-oct-2026 (📦976).** Las seis decisiones del abogado (1.a a 1.f) quedaron aplicadas **al código y a los tres documentos**, porque tres de ellas mueven el papel de un actor: el remitente del enlace (1.b), el medio personal que el Trabajador confirma (1.a) y lo que hace falta para publicar una versión (1.f). La v1.1 pasó a **57 187 B / 09d69065…123d2** con nueve numerales reescritos; el Anexo de Encargo a la versión **2026-10-27-b** (35 273 B, `6831f53a…825ab6`); y el Anexo de Nube a un §3 y una tabla de proveedores que ya no dicen que el enlace y el OTP salen de la misma cuenta. El **1** y el **12** cambiaron de cifras; el **7** y el **11** cambiaron de texto. Lo que **no** se movió: el flag del medio personal sigue apagado (depende de la 9A), la condición contractual de Google sigue abierta, y la **autorización operativa de la v1.1 es del owner**.
Los **7 cerrados**: el 1 (los 5 huecos de la v1.1), el 2 (NIT y representante legal), el 3 (las URLs del Anexo
y de la política), el 4 (el canal de protección de datos), el 5 (el acta de designación, que no era obligación legal),
el 6 (el canal único de PQRS) y el 13 (los 4 marcadores y el sello de versión). Los que siguen **bloqueando la
primera firma** son los que dependen de evidencia del ambiente real (9A, 10.4, D-03), de los **datos que solo
tienes tú** (tipo de cuenta de Google, RTO, RPO, plan de continuidad, plazo de supresión), de la **firma del
Anexo de Nube** por la Empresa (7), de la **revisión del abogado** del Anexo de Encargo (11) y del **envío de la
v1.1** y del Anexo de Encargo al abogado (12).

**El despliegue del `f26f8bc1` ya está hecho** (los tres hashes en disco coincidieron con los del commit, el
arranque quedó limpio, `/health` da 200). **Falta el redespliegue**: el tar final `efc457de…0651` (541 226 B) lleva el
`359fe7a1` (📦954) **y los dos documentos legales** (`legal/anexo-nube-v1.0.html` y `legal/anexo-encargo.html`), y
ya está servido por el puente (verificado por descarga). **El número de bloqueantes del servidor se mide en el
despliegue, no se estima aquí**: el tar se arma desde el commit, nunca desde el working tree.

**⚠️ El paquete cambió de forma (📦955) y con él el comando de extracción.** El tar ahora lleva `app/` y `legal/`
en la raíz, porque `readinessLegal.js` busca los documentos en `REPO_ROOT/legal/` —**un nivel arriba** del directorio
de la app— y en el servidor eso es `/opt/kair-firma/legal/`. Antes de esto el tar solo traía el service: el servidor
leía un documento **que no existía** y reportaba "Faltan cláusulas: Remisión al Anexo de Nube; Sustitución del
Anexo anterior o cláusula de otrosí; Art. 2.2.4.6.13; Veinte (20) años; Servicio en nube / firma-service" —cinco
cláusulas que **no faltaban**. Por eso el comando de despliegue ahora extrae en `/opt/kair-firma` y **no** en
`/opt/kair-firma/app`: con el comando viejo el despliegue sería un no-op silencioso (el servicio arrancaría con el
código viejo). Ver la BITACORA 📦955 y el runbook.

**Los paquetes escritos, verificados y pusheados:** el 📦️947 es el check que pedía una migración ya aplicada
(el readiness buscaba `gh_firma_solicitudes_titular` y la 028 crea `gh_solicitudes_titular`); el 📦️948 es el cierre del
punto 3 (el Anexo de Encargo nuevo, el Anexo de Nube publicado y la política del Encargado, con las URLs selladas
**después** de verificarlas por HTTP); el 📦️949 cierra el punto 5 (el acta de designación no era una obligación legal);
el 📦️950 cierra los puntos 2 y 6 (el nombre del representante legal y el canal único de PQRS con su responsable); el
📦️954 cierra la decisión de fondo del punto 7 (el Anexo de Nube como modelo diligenciado, con el check corregido y
el DPA de Cloudflare verificado). **Commits** — `d8c35ee3` (📦️947-948) · `9152f7ab` (📦️949) · `8031c573` (📦️950) ·
`359fe7a1` (📦️954), en `Dev`; en `gh-pages`, `60c1a421` · `cf310e10` · `15bc2c7d` · `d6cfa7c5` (el Anexo de Nube
publicado). Los dos remotos quedaron nivelados.

**El Anexo de Encargo nuevo conserva la marca de revisión profesional pendiente**: lo redactó el modelo, no un abogado.
Por eso el ítem `documento_encargo` sigue en pendiente y **bloqueando la primera firma**. El documento ya tiene las
cinco cláusulas y la remisión al Anexo de Nube: lo único que falta es la revisión del abogado (punto 12).

---

### 2026-10-23 · 📦934 · El texto legal en el codigo: la ficha, la copia, el recibo y el OTP

**El encargo.** "Verifica el estado actual y continua con la tarea, realiza la investigacion de todo el
proceso para validar que exactamente hace falta, crea un plan de accion para cerrar estas brechas y
queden alineadas con lo actualmente construido alrededor del proceso de firma electronica, una vez tengas
el plan procede a implementarlo, por cada etapa entrega un resumen de lo realizado y checklists de lo que
falta hasta terminar, valida que entre etapas no se rompa nada del proceso de firma." Siete etapas, de la 0
(investigacion) a la 6 (verificacion).

**La investigacion (etapa 0) cambio la foto.** Tres exploraciones en paralelo: el mapa del proceso de
firma, las brechas entre el texto y el codigo, y el estado operativo con sus banderas. El hallazgo de
fondo: **la v1.0 vigente (publicada, sellada `52a490a4...`) NO contradice el codigo nuevo**. Su 8.6 no
fija plazo y su 3.4(c) si dice "token de un solo uso", que hoy se cumple. El texto que trae las
exigencias nuevas es la **v1.1**, y lo que hay que entregarle al abogado es el texto; lo que hay que
cumplir en el codigo es lo que ya esta en vigor. Por eso la M1 (el OTP que expira) se implemento: es una
brecha contra la v1.0 **vigente**, no solo contra la v1.1.

**B1 — el rastro auditable de la ficha de la Empresa.** El override del `canal_pqrs` no dejaba rastro: un
campo de la ficha de la Empresa podia cambiar sin que nadie supiera quien lo cambio ni por que. Ahora hay
tabla (`037`), triggers append-only (`038`, probados contra el archivo real), y un servicio que escribe
**un renglón por campo que REALMENTE cambio**: un guardado que no cambia nada no deja renglón, porque no
es un cambio. El documento del representante no se copia en claro al rastro: va enmascarado (`****` mas
los ultimos cuatro), igual que en el resto del sistema. El actor y el motivo llegan por headers
(`X-Admin-Actor`, `X-Admin-Motivo`) porque el `PUT` es un reemplazo completo de la ficha y el body no se
contamina con metadatos de auditoria. 17 tests.

**El 8.5 y el 8.6(e)(iii): la copia permanente.** El texto final aprobado pide que la Empresa entregue la
copia en cinco dias habiles, y que **no se suprima con una solicitud de copia pendiente**. Son DOS relojes
distintos y no se mezclan: `plazoTramiteDias` (2, cuando K+AIR trasmite) y `plazoCopiaDias` (5, cuando
la Empresa entrega). El freno se chequea **dos veces**: al armar el lote y otra vez en la capa de datos,
para el caso de que la copia llegue mientras la operacion corre. 15 tests.

**El 3.6(g) y el 10.6: el recibo de supresion.** El texto exige una lapida que identifique la solicitud,
la fecha y hora, las categorias suprimidas y el fundamento del plazo, "y a un recibo que la Empresa
entrega al Trabajador si lo solicita". La lapida guardaba el `firma_id` (un entero interno) y no el
identificador que el Trabajador y la Empresa conocen; y como la supresion borra la fila de la firma
entera, ese dato se perdia para siempre. La migracion `040` lo arregla, y la `041` le da al recibo de
purgas las dos columnas que faltaban (la solicitud y el fundamento del plazo), para que la purga de
auditoria del 10.5(d) tambien deje un recibo completo. Y se creo la **via de entrega**: dos endpoints
per-empresa (la Empresa es la Responsable del dato y la que se lo entrega al Trabajador, 10.7(e)), con
`404` silencioso entre Empresas y sin datos personales en la respuesta. 19 tests.

**La M1: el OTP expira a los 600 segundos.** El 3.4(e) de la v1.0 **vigente** dice "expira a los seiscientos
(600) segundos contados desde su envio". El codigo no lo cumplia. El rechazo es `410 OTP_EXPIRADO`, con
codigo propio y no el 410 generico: el 410 generico diria "el enlace expiro", y el enlace **sigue
vivo**. No consume intento y no cambia el estado, para que el reenvio siga disponible. La mini-app
maneja el caso antes del 410 generico y ofrece el boton de pedir un codigo nuevo. 8 tests.

**Lo que quedo debiendo, sin esconderlo.** La ventana entre el registro y la trasmision con `id_empresa =
NULL`; la granularidad de la copia es por Empresa y no por Titular; `copia_atendida` es una declaracion de
la Empresa y no una verificacion; el `PUT` de la ficha es reemplazo completo, asi que el rastro es un
diff y no un historial por version; y el actor llega por header, no por una identidad real del admin.

### 2026-10-23 · 📦935 · La purga en dos capas: la supresion de datos no se ejecutaba nunca

**El bug que aparecio al escribir los tests del recibo.** `scripts/purga-ventana.js` es el ejecutor de la
supresion de datos vencidos. Su guion dice, textualmente:

> "Capa 1: el registro de auditoria."
> "Capa 2: la fila y los archivos. Se hace dentro de la misma ventana y sobre el mismo lote, y vuelve a
> comprobar el hold de cada firma."

Pero la capa 1 (`conservacion.purgar()`) **cerraba la ventana de purga y vaciaba el lote** al terminar. La
capa 2 (`supresion.suprimir()`) exige una ventana vigente y un lote armado: `ventanaVigente()` devolvia
null y la operacion moria con "No hay ventana de purga abierta", exit code 3.

**Que significaba eso.** La capa 2 es la que borra el documento, la constancia y los archivos, y la que
escribe la LAPIDA (`gh_firma_purgadas`) con la que un enlace ya suprimido responde 410
CONSERVACION_VENCIDA. O sea: **la capa 2 nunca se ejecuto en produccion**. Las firmas vencidas
seguirian con su PDF original, su PDF firmado y su constancia en el disco, y la tabla de lapidas estaba
vacia. No era un detalle del texto de la v1.1: era un incumplimiento del 8.6 y del 10.6 de la **v1.0
vigente**, la que ya esta publicada y sellada.

**La precision que hay que hacer.** En produccion hay **0 firmas**, asi que el bug no dejo ningun dato
violando. El incumplimiento es real y hay que corregirlo antes de la primera expiracion, pero decir "se
filtraron datos" seria falso.

**El arreglo.** La ventana la cierra el **orquestador**, no la capa 1: `conservacion.purgar()` acepta
`{ cerrar: false }` (el default sigue siendo cerrar, y el test que mira la secuencia del log sigue
viendo `VENTANA_CERRADA`), y el script cierra al final, despues de las dos capas. Si algo falla, la
ventana se cierra igual en el `catch`: no se deja una ventana abierta con un lote a medias, que
habilitaria una purga que el operador no pidio.

**El segundo defecto del mismo script: la simulacion mentia.** Decia "Simulacion de la capa de datos: 0
firmas, 0 archivos" y un segundo despues suprimia una firma y tres archivos. La simulacion leia el
**lote**, y el lote existe solo cuando ya se abrio la ventana: antes de abrirla estaba vacio. Ahora
simula sobre las **mismas firmas** que el lote va a contener (las vencidas y elegibles), sin que la
ventana tenga que estar abierta. Una simulacion que no dice lo que va a pasar es peor que no tenerla:
hace creer que no hay nada que hacer.

**El test que lo atrapa, escrito como el bug.** El archivo `tests/purga-dos-capas.test.js` tiene la
mutacion como caso: con el comportamiento viejo (la capa 1 cierra la ventana), la capa 2 **no puede
correr** y la fila de la firma sobrevive. 8 tests.

### 2026-10-23 · 📦936 · El empalme mecanico de la v1.1

**Que es.** La v1.1 no se publica todavia, pero para que publicarla sea un trámite y no un proyecto, los
49 numerales que cambian respecto de la v1.0 estan escritos con su texto integro en
`scripts/fixtures/acuerdo-v1.1-cambios.json`, y hay un script que los empalma sobre la v1.0.

**El empalme deja 5 huecos, no 28.** El plan daba 28; la realidad son 5, y son los que solo el owner
puede llenar. Ademas aparecio un hallazgo que no estaba en el plan: la v1.0 deja **4 marcadores
`[registrada por el sistema]`** heredados, y la guarda que exige un texto sin placeholders los rechaza.
Por eso la v1.1 no se publica todavia: no es que falte trabajo tecnico, es que falta una **decision**
(aceptar la excepcion de la guarda o depurar el texto v1.0 en el empalme).

**La regla del script.** Reutiliza `src/utils/textoLegal.js` (la misma validacion que usa la publicacion
real) y **no escribe** `acuerdo-v1.1.txt` si quedan placeholders: sale con codigo 2. Un script que
escribe un texto juridico incompleto es peor que uno que se niega.

**El mapa con los 49 numerales** quedo escrito en
`docs/gestion-humana/firma-electronica/mapa-empalme-v1.1-2026-10-23.md`. 21 tests.

### 2026-10-23 · 📦937 · El endurecimiento del operador

Tres cosas que no son funciones pero que hacen la diferencia entre un servicio que se puede auditar y uno
que no:

**La bandera retirada, documentada como inerte.** `FIRMA_EXIGIR_HABILITACION_EMPRESA` ya no existe: el
D-03 bloquea en los cuatro puntos y su unica salida es la excepcion auditable
(`POST /internal/admin/excepciones-habilitacion`). Borrar la bandera del `.env.example` sin mas habria
dejado un hueco donde alguien podria volver a ponerla creyendo que hace algo. Ahora el bloque dice
expresamente que esta inerte y por donde va la excepcion.

**El comentario obsoleto del 026.** Decia "Los anteriores siguen validos" y "tope 3 tokens vivos", cuando
el 3.4(c) manda el **token unico** (`MAX_TOKENS_VIGENTES = 1`). Un comentario que contradice el codigo es
una trampa esperando a que alguien lo lea como si fuera la regla.

**El 409 del D-03 en el smoke de produccion.** El script de humo tratava el `409
EMPRESA_NO_HABILITADA` como FALLA, cuando el propio mensaje del servicio dice que **no es un fallo del
servicio: es el control del D-03**. Ahora es un AVISO (que dice cual es la salida) y cualquier otro 409
sigue siendo FALLA. 2 tests.

### 2026-10-23 · 📦938 · El cierre de las etapas 0 a 6

**El estado.** Las siete etapas quedaron implementadas y verificadas. El servicio corre **1639 tests ·
1633 verdes · 4 rojos · 2 omitidos**. Los 4 rojos son de la **otra sesion** (`seed-dev-acuerdo.test.js`
contra la guarda `TEXTO_LEGAL_CON_PLACEHOLDERS` de `agreement.js`, que es zona de la otra sesion y no se
toco): lo de esta jornada esta en **1633/1633**.

**La verificacion que si muerde.** `node --check` 24/24 en los archivos tocados. Barrido de caracteres no
latinos limpio en 30 archivos (LF y sin BOM). **5 de 5 mutaciones mordieron**: mutar el codigo pone el
test en rojo, y una de ellas -quitar el `firma_id` del SELECT de la lapida- **no mordia** al principio,
porque el test no comprobaba los tres campos que esa mutacion degrada. Ese es el punto: un check que no
muerde no es un check, y un fallo silencioso es peor que uno ruidoso. Arranque en frio del service con el
router nuevo montado.

**El fallo silencioso que casi se va.** Al revisar mi propio codigo del recibo encontre que el SELECT de la
lapida no traia el `firma_id`, y que se usaba como parametro de bind. La primera caracterizacion fue
"reventaba la consulta": **falsa**. `better-sqlite3` liga un `undefined` como NULL, no lanza. El
`WHERE firma_id = NULL` no encontraba la fila del recibo de purgas y el recibo salia **sin la ventana, sin
la comprobacion del hold y sin el recuento de eventos**: un fallo silencioso, con el recibo aparentemente
completo. La caracterizacion correcta quedo escrita en el codigo y en el test, porque un diagnostico
equivocado escrito en un comentario es la forma mas larga de propagar un error.

**Lo que sigue, en orden.** (1) Desplegar en `kair-server`: las migraciones 034 a 041 y las etapas 1 a 5,
siguen sin desplegar; el servidor corre el codigo viejo. (2) Rotar las 5 app passwords: el repo es publico
y quedaron en el historial. (3) El D-02: correr el inventario del buzon sobre una **copia** de la BD (abre
con escritura) para decidir `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`. (4) Las decisiones del owner: los 4
marcadores heredados de la v1.0, el `respuesta-11A-2026-10-23.md` contradictorio y sin origen verificable,
la regresion de `seed-dev-acuerdo.test.js` y el cierre de `SECURITY.md`. (5) Los datos que solo tiene el
owner para la v1.1: NIT y representante de Gesstiar, persona y canal del 10.7(b), URL de la politica de
datos, URL del Anexo de Encargo, los 5 datos del Anexo de Nube, ubicacion fisica del servidor, DPAs de
Cloudflare y Google, tipo de cuenta de Google, y el responsable de respaldos, monitoreo y soporte con su
RTO y su RPO.

### 2026-10-23 · 📦941 · El reporte que dice qué falta, sin inventar nada

**Que se hizo**

| Paquete | Que |
|---|---|
| 📦941 | `firma-service/legal-readiness.json`: el manifiesto de evidencias legales. Cada campo se llena solo con fecha, archivo o huella; lo que no tiene evidencia queda en `null` |
| 📦941 | `src/services/readinessLegal.js`: el servicio que cruza manifiesto, documentos reales, codigo y base, y devuelve los items con su estado, su detalle y la accion que lo resolveria. No escribe en la base |
| 📦941 | `scripts/auditar-readiness-legal.js` (CLI) y `GET /internal/admin/readiness-legal` (endpoint admin): los dos llaman al mismo servicio |
| 📦941 | La guarda de texto legal: desde la v1.1, un texto con corchetes o marcas de borrador no se publica. Chequea en el servicio y en el script de publicacion |

**Por que** — La pregunta "ya se puede publicar la v1.1 y aceptar la primera firma real?" vivia solo en la cabeza del operador, con la respuesta repartida en archivos sueltos y en datos que solo tiene el owner. El riesgo no era que faltara informacion: era rellenar el hueco con un valor plausible.

**El reporte, en corto.** Hoy el gate de publicacion **NO esta listo**, y lo dice sin suavizar: faltan el texto de la v1.1 y su huella en el manifiesto, la URL del Anexo de Encargo, la URL de la politica de tratamiento, la persona y el canal de proteccion de datos, el responsable y su acta, y el NIT del Encargado. El Anexo de Nube tiene 53 placeholders y una marca prohibida; el Anexo de Encargo, una. Faltan las pruebas en el ambiente real de la 9A, la 10.4 y el D-03, y las tablas de excepciones (migraciones 035 y 036) no estan en esta base. En total: 38 items, 4 ok, 31 pendientes, 1 aviso, 2 que no aplican, 19 bloqueantes para el gate de publicacion.

**Como se usa**

```bash
# En el servidor (o en local, con la base de desarrollo):
node scripts/auditar-readiness-legal.js --gate=publicacion
node scripts/auditar-readiness-legal.js --gate=primera_firma --json
node scripts/auditar-readiness-legal.js --estricto   # sale con 1 si el gate no esta listo
```

O por HTTP, con la key de operador: `GET /internal/admin/readiness-legal?gate=publicacion`.

**Tests** — `tests/guarda-texto-legal.test.js` (9), `tests/readiness-legal.test.js` y `tests/routes/admin-readiness.test.js`. Suite completa: **1658 tests · 1656 verdes · 0 rojos · 2 omitidos**. Barrido de caracteres no latinos limpio en los 10 archivos; `node --check` 9/9. La forma del JSON documentada en `API.md` §6.19 se copio de la salida real del servicio, no de memoria.

**Ademas** — El owner decidio commitear este trabajo, que hasta aqui habia quedado sin commitear en el arbol de trabajo de la otra sesion. Los 10 archivos entraron con este paquete y con su propia verificacion: el servicio de readiness no tiene un solo INSERT, UPDATE ni DELETE (es de solo lectura, como dice), y no hay secretos, tokens ni correos en ninguno.

**Archivos tocados** — `firma-service/legal-readiness.json`, `firma-service/src/services/readinessLegal.js`, `firma-service/src/utils/textoLegal.js`, `firma-service/scripts/auditar-readiness-legal.js`, `firma-service/scripts/publicar-acuerdo-legal.js`, `firma-service/src/routes/admin.js`, `firma-service/src/services/agreement.js`, `firma-service/tests/guarda-texto-legal.test.js`, `firma-service/tests/readiness-legal.test.js`, `firma-service/tests/routes/admin-readiness.test.js`, `API.md` (§6.19), `BITACORA.md` (seccion 📦941), `PROMPT.md` (trampa 72), `Historial.md`.

**Commits** — 📦941 (pendiente de commit y push).

### 2026-10-23 · 📦940 · La guarda que se comió al seed y la salida que no abre la puerta de par en par

**Que se hizo**

| Paquete | Que |
|---|---|
| 📦940 | `seed-dev-acuerdo.js` siembra su texto de DEV en una version posterior a la v1.0 sin relajar la guarda de texto legal del servicio |
| 📦940 | La salida se abre SOLO en una base de desarrollo: toda version de la base tiene que ser una semilla DEV (`metadata.dev_seed = true`) |
| 📦940 | Con un Acuerdo legal en la base, el seed se niega y sale con codigo 1 |
| 📦940 | `main()` devuelve codigo de salida en vez de dejar escapar el `AppError` |

**Por que** — Del otro lado del repo, sin commitear, aparecio la guarda de publicacion: desde la v1.1 un texto con corchetes o con marcas de borrador ("ACUERDO DEV") no se publica. La guarda es correcta y no se toco. El seed DEV es correcto tambien: siembra, por definicion, un texto marcado para que nadie lo confunda con el legal. Faltaba el punto de encuentro, y por eso cuatro pruebas del seed quedaron rojas.

**La salida.** El seed escribe la fila el mismo (mismo hash, misma transaccion atomica de la activa) cuando se cumplen las dos condiciones: (1) el ambiente no es produccion —el bloque duro de arriba ya lo impide— y (2) **TODA version de la base es una semilla DEV**. La segunda se comprueba contra las filas, no contra una suposicion: con la v1.0 real y sellada del servidor, la condicion no se cumple, no hay salida, y el seed dice por que. La fila queda marcada con `metadata.dev_seed = true`, que es lo que permite distinguirla de un Acuerdo real y hace que la condicion sea comprobable.

**Lo que NO se relajo.** El camino legal sigue duro: `agreementService.createVersion()` con un texto marcado y version posterior a la v1.0 sigue tirando `TEXTO_LEGAL_CON_PLACEHOLDERS`, y hay un test que lo comprueba.

**Tests** — `tests/scripts/seed-dev-acuerdo.test.js`: 32 pruebas, todas verdes (6 nuevas). Las dos que cierran la puerta: una siembra una v1.0 legal y verifica que el seed se niegue y que no quede ninguna fila nueva; la otra mete una semilla DEV **y** un Acuerdo legal para verificar que una sola version legal cierra la salida. Suite completa: **1658 tests · 1652 verdes · 0 rojos · 2 omitidos**. Ya no hay rojos de la otra sesion: los 4 de `seed-dev-acuerdo.test.js` los arreglo este paquete, sin tocar los archivos del otro trabajo.

**Ademas** — El owner decidio borrar del disco `respuesta-11A-2026-10-23.md` (71 KB): contradecía al `.txt` oficial del abogado en lo decisivo (80 vs 20 anos, tres tokens vivos vs uno) y no tiene origen verificable. No se uso como fuente en ningun momento. Quedo en la papelera (recuperable), nunca estuvo en el repo.

**Archivos tocados** — `scripts/seed-dev-acuerdo.js`, `tests/scripts/seed-dev-acuerdo.test.js`, `BITACORA.md` (seccion 📦940), `PROMPT.md` (trampa 71), `Historial.md`.

**Commits** — 📦940 (pendiente de commit y push).

### 2026-10-23 · 📦939 · El humo que miraba el token viejo y el hold que no se podia limpiar

**Que se hizo**

| Paquete | Que |
|---|---|
| 📦939 | El smoke de produccion manda el token de la creacion a `notify-remote`: el 5c comprueba el enlace que el firmante recibe, no un token que el propio script dejo muerto |
| 📦939 | `limpiar-rastro-prueba.js --forzar-hold`: borra la fila de prueba que el hold automatico bloqueaba (el de la regla `CONTRATO_ELECTRONICO`, el del 2.2.1.1.12), y solo abre para filas que nunca se firmaron con el hold automatico |
| 📦939 | El script borra tambien el historial de holds: no queda rastro huerfano |
| 📦939 | Un aserto que no moria (el bind `undefined` ligado como `NULL`) corregido |

**Por que** — El despliegue de las etapas 0 a 6 quedo bien, pero el humo de produccion dio `RESULTADO: FALLA` en el paso 5c y el rastro de prueba (id=12, `SIGN-2026-427494`) no se podia limpiar. Los dos eran del script, no del servicio.

**El 5c fallaba por el motivo equivocado.** El 3.4(c) es "cada reemision se registra y deja sin efecto el token anterior" (un solo token vigente por solicitud). El smoke creaba la solicitud (token A), mandaba `notify-remote` **sin** token → el servicio emitia el token B y el A quedaba muerto → el 5c abria el A y recibia 404 `TOKEN_NOT_FOUND`. El correo llevaba el token B, que si servia. La valvula ya existia: `notify-remote` acepta `token` en el body, verifica que sea de esa solicitud (`tokenPerteneceA`) y lo reutiliza sin rotar. El humo no la usaba. **Antes de declarar "fallo del despliegue", comprobar que la cosa que el check mira siga siendo la cosa que el servicio produjo.**

**El hold que no se podia limpiar.** La fila de prueba quedo con hold. **Correccion del 24-oct-2026**: el hold NO venia de la ficha de la Empresa (esa tiene `conservacion_por_deber_legal = 0`, verificado con `panel-firmas.js --json` en el servidor). Venia de la **regla de retencion**: el smoke crea la solicitud con `tipo_identificacion: 'OTROSI'`, el catalogo la resuelve a `CONTRATO_TRABAJO` y la regla `CONTRATO_ELECTRONICO` le levanta el hold del **2.2.1.1.12** (el contrato electronico se conserva sin termino). O sea: el hold mas fuerte de todos, no una bandera de la Empresa. No era una disputa sobre esa firma: era el deber legal del contrato electronico aplicado a una fila que nunca se firmo. `--forzar-hold` solo se abre para filas que cumplen **dos** condiciones: (1) que nunca haya habido un acto (no esta en SIGNED, DUAL_FIRMADO, REJECTED, REVOKED ni CANCELLED, y no tiene documento firmado, hash de evidencia, constancia ni PDF firmado) y (2) que el hold sea el automatico (motivo `deber_legal_*`, actor `sistema`, sin un hold vigente declarado por una persona). Si una sola fila del rango falla alguna de las dos, **no se borra nada** (codigo 4): no hay limpieza a medias. El forzamiento queda escrito en el recibo append-only, con quien lo hizo y por que.

**Tests** — `tests/scripts/smoke-produccion.test.js` (28) y `tests/scripts/limpiar-rastro-prueba.test.js` (23). Suite completa: **1652 tests · 1646 verdes · 4 rojos · 2 omitidos**. Los 4 rojos son de la **otra sesion** (`seed-dev-acuerdo.test.js` contra la guarda `TEXTO_LEGAL_CON_PLACEHOLDERS` de `agreement.js`, que es zona de la otra sesion y no se toco): lo de esta jornada esta en **1646/1646**. Barrido de caracteres no latinos limpio en los 6 archivos; `node --check` 4/4.

**Bugs encontrados**

- El 5c miraba un token que la propia notificacion habia rotado: una FALLA por el motivo equivocado, con el despliegue sano.
- El script de limpieza no borraba `gh_firma_holds`: al borrar la firma, el historial del hold quedaba apuntando a una fila que ya no existia. Las tablas que cuelgan de una fila hay que **enumerarlas del esquema**, no de la memoria.
- El aserto de "los tokens tambien estan borrados" usaba `firma.id`, que es `undefined` (el helper devuelve `{signRequest, token, url_publica}`): `better-sqlite3` lo ligaba como `NULL`, el conteo daba 0 y el test pasaba **sin comprobar nada**.

**Archivos tocados** — `scripts/smoke-produccion.js`, `scripts/limpiar-rastro-prueba.js`, `tests/scripts/smoke-produccion.test.js`, `tests/scripts/limpiar-rastro-prueba.test.js`, `BITACORA.md` (seccion 📦939), `PROMPT.md` (trampas 69 y 70), `Historial.md`.

**Commits** — 📦939 (pendiente de commit y push).

### 2026-10-23 · 📦933 · Las tres condiciones de código que el abogado puso antes de la v1.1

**El paquete que llegó.** El owner pegó la respuesta 11A del abogado: 41 128 bytes, copiados
byte a byte a `docs/gestion-humana/firma-electronica/respuesta-11A-2026-10-23.txt`. Trae
las cuatro decisiones, el texto final de los doce grupos, el modelo del Anexo de Nube y la
tabla de lo que bloquea la publicación y lo que bloquea la primera firma.

**El hallazgo que hubo que resolver antes de tocar código.** En el repo coexistían DOS
respuestas del abogado: el `.txt` de arriba (41 128 bytes, CRLF, copiado a las 8:59 del
23-oct del asset que el owner pegó) y un `respuesta-11A-2026-10-23.md` de 71 367 bytes
creado a las 3:33 AM que **no aparece en ningún snapshot de sesión, ni en `assets/`, ni en
los logs del runtime**: no tiene origen verificable. Y se contradicen en lo decisivo: el
`.md` dice «80 años por defecto» y «efecto en el código: ninguno»; el `.txt` dice
«Recomiendo bajarlo a 20 años como máximo por defecto» y «cambia una constante:
ANIOS_CUSTODIA de 80 a 20 (retencion.js)». También difieren en el 3.4(c) (el `.md`
deja convivir tres tokens vivos; el `.txt` exige «no hay más de un token vigente por
solicitud») y en el plazo máximo del Anexo (5 días hábiles contra 30). **Manda el
`.txt`**: es el asset que el owner entregó, es posterior en el tiempo, y el `.md` no
tiene rastro. El `.md` queda señalado como contradictorio y **no se usó como fuente**.

**A · La custodia de 20 años** (`src/services/retencion.js`). `ANIOS_CUSTODIA` baja de 80
a 20: es el plazo de reserva del 8.6(h) («si la Empresa no declara un plazo, se aplica el
mínimo legal que corresponda y, en su defecto, veinte (20) años contados desde la firma.
Ese plazo es un máximo de custodia»). Conservar 80 exigiría decir «techo técnico de
custodia» y asumir el riesgo de sobre-retención frente al 2.2.2.25.2.8 del Decreto 1074.
Lo que NO cambia: el hold sin término del contrato electrónico, el piso de 20 años desde
el cese de los cinco grupos SST y el deber legal declarado por la Empresa.

- **Migración 034**: traduce el id persistido `CUSTODIA_80_ANOS` → `CUSTODIA_20_ANOS`
  en la columna `regla_retencion`. Sin eso la fila guardaría un id que el código ya no
  reconoce y su `regla_retencion` mentiría. **No** recalcula `fecha_conservacion`: la
  fecha ya calculada se le comunicó al Trabajador y recortarla sería supresión indebida.
- **`REGLAS_LEGACY`** traduce el id viejo en la lectura, para que una base donde la 034
  no corrió no quede reinterpretada.
- El texto de `HISTORIA_LABORAL` ya no afirma el rango de 80 a 100 años del Concepto
  AGN 2-2017-01654 (sería falso con 20): el Concepto orienta el plazo, no lo fija.

**B · El token único** (`src/services/signRequest.js`). El 3.4(c) es explícito: «cada
reemisión se registra y deja sin efecto el token anterior. No hay más de un token vigente
por solicitud», con la condición de código textual: «si el sistema mantiene válidos los
tokens anteriores, se cambia el código antes de publicar». Antes la reemisión **no**
revocaba y el tope eran 3 tokens vivos, decididos por un parámetro que el cliente de
escritorio nunca mandaba. Ahora la reemisión revoca **siempre**, `MAX_TOKENS_VIGENTES = 1`
y la invariancia se **verifica después de emitir** (si quedara algún token vigente, sale un
`500 TOKEN_INVARIANTE_ROTA` dentro de la transacción, sin dejar nada escrito). El campo
`revocar_anteriores` de la API queda obsoleto: se acepta para no romper clientes, ya no
decide, y su valor queda en el registro de auditoría.

**C · El D-03 que sí bloquea** (decisión B.3). El abogado decía «hoy empresa.js exige
anexo_encargo_firmado_at y canal_pqrs, pero avisa». **Eso era inexacto**: con el default
el bloqueo ya lanzaba 409 `EMPRESA_NO_HABILITADA`, pero **solo en la creación de la
solicitud**. Los otros tres puntos no comprobaban nada.

- **Los cuatro puntos** ordenados por el abogado, los cuatro implementados: creación de la
  solicitud (`signRequest.create`), commit (`publicFlow.commit`, antes de generar el PDF
  y la constancia), creación del consentimiento (`consent.create` y
  `consent.ensureRepConsent`) y doble firma (`signRequest.createForCompany`).
- **La excepción auditable** (`src/services/excepcionHabilitacion.js`, migraciones 035 y
  036): es la **única** salida del bloqueo y no es un `if` silencioso. Se validan las seis
  condiciones del abogado: autorización escrita (quién, fecha y referencia), alcance de
  una Empresa y un número máximo de firmas, ruta en papel operativa el mismo día, fecha
  cierta con **máximo 30 días**, bitácora inmutable (triggers append-only) y el límite de
  que una Empresa sin ningún Anexo solo entra como **piloto autorizado**. Rutas admin:
  `POST /internal/admin/excepciones-habilitacion` y `.../:id/cerrar`.
- **El alcance cuenta FIRMAS, no usos**: la gasta el punto que abre una firma (creación y
  doble firma); el commit y el consentimiento solo la aplican y levantan el bloqueo. Sin
  esa distinción, una firma consumía tres unidades de alcance y el «número máximo de
  firmas» del abogado no sería un número de firmas.
- **La bandera `FIRMA_EXIGIR_HABILITACION_EMPRESA` se RETIRÓ**: era exactamente el «if
  silencioso» que el abogado no quiere. El bloqueo ahora es incondicional y la única
  salida es la excepción, que deja rastro de quién la pidió y de cada firma que la usó.

**E · Los dos documentos que faltaban.** `legal/anexo-nube-v1.0.html`: el modelo del
Anexo de Nube en la misma familia visual del Anexo de Encargo actual, con el bloque
«PENDIENTE DE COMPLETAR ANTES DE FIRMAR» y los cinco datos sin los cuales no se firma.
`docs/gestion-humana/firma-electronica/mapa-empalme-v1.1-2026-10-23.md`: los 49
numerales que cambian, con el texto final citado íntegro del `.txt`, los huecos que
faltan y la tabla de lo que bloquea la publicación y lo que bloquea la primera firma.

**Verificación.** Suite del service: **1521 tests · 1519 verdes · 0 fallos · 2 omitidos**.
Mutaciones: **14/14 detectadas** (`%TEMP%\kair-mutar-933.js`), incluidas las que
apagan cada uno de los cuatro puntos del bloqueo, la que devuelve la custodia a 80 años,
la que hace que la reemisión no revoque y la que desactiva el trigger append-only de la
bitácora. Barrido de caracteres no latinos limpio en los 39 archivos tocados.

**Lo que NO se hizo, y por qué.** **La v1.1 no se publica todavía.** El texto final trae
**28 huecos** que solo el owner puede llenar (NIT y representante de Gesstiar, ciudad y
país del servidor, los DPAs de Cloudflare y Google, el tipo de cuenta de Google, el
responsable de respaldos/monitoreo/soporte con su RTO/RPO, la persona o área y el canal
del 10.7(b), la URL de la política de datos, y el estado real del Anexo de Encargo). El
abogado dice que **sin la v1.1 no hay primera firma** y el orden es: cerrar 9A, 10.4 y
D-03 → ajustar el 8.6 en el código → publicar la v1.1 → encender el D-02 → firmar el
Anexo de Nube → primera firma real. Los tres primeros ya están.
### 2026-10-23 · 📦932 · La solicitud 11A al abogado

**Para que era.** El plan del 20-oct (📦921-923) dejo el paquete del abogado escrito, pero
no era una solicitud: era un insumo de trabajo. Y el 22-oct la situacion cambio lo
suficiente como para que el insumo quedara desactualizado.

**Lo que se escribio.** `docs/gestion-humana/firma-electronica/solicitud-11A-al-abogado-2026-10-23.md`:
que tiene que revisar el abogado (los doce grupos de numerales con el texto propuesto en el
anexo A, cuatro decisiones concretas, y el Anexo de Nube), que NO se le pide (concepto
sobre la v1.0, que ya esta publicada y sellada; ni la ruta en papel, que ya esta resuelta),
el indice de los seis anexos que se entregan, y los tres caminos posibles con su
recomendacion.

**Lo que cambio desde el 20-oct (y era lo que mas pesaba).**

- **De los siete bloqueantes del plan, cinco estan cerrados**: la 10.4 (publicada con su
  huella), la 9A (papel, medios autorizados, copia permanente, consulta a autoridades), el
  `conservacion_por_deber_legal` (campo explicito + hold + custodia de 80 anos), el
  rechazo de la firma visual PNG, y la semilla DEV (resuelta en produccion: la v1.0 legal
  quedo con id 2).
- **Hay CERO firmas de trabajadores reales.** Entonces no hay "parar la maquina": hay
  ventana para dejar el texto bien antes de la primera firma. Eso cambia el Camino B
  (publicar la v1.1 con los textos de nube y firmar el Anexo de Nube) de "urgente" a
  "gratis".
- **La Compuerta 0.6 quedo contestada**, que era el hueco que el plan dejo marcado como
  "no verificado": el servidor es un Ubuntu en la red local, pero el tunel es de
  **Cloudflare** y el correo sale por **smtp.gmail.com**. O sea: dos subencargados
  (Cloudflare y Google) que el Anexo **no nombra**, y dos transmisiones internacionales.
  Al abogado se le pregunta si es transmision (art. 24 del Decreto 1377) o transferencia
  (art. 26 de la Ley 1581), y si esos terceros van en el Anexo o en el Acuerdo.

**Lo que sigue esperando una decision del owner:** las cuatro decisiones de la solicitud,
la opcion de cierre del `SECURITY.md` (A/B/C), de donde sale el `canal_pqrs` de la Empresa
(formulario de escritorio o via administrativa), y los datos administrativos que el Anexo
necesita (NIT de Gesstiar, URL real de la politica de datos, persona responsable de datos).
### 2026-10-23 · 📦931 · Las contrasenas de correo que viajaban con el instalador

**Lo que habia.** Las app passwords de Gmail de las cinco cuentas de remisiones medicas
estaban escritas en `utils/emailSender.js` **y duplicadas** en `Portear/src/remision_utils.py`
y `Portear/src/Remisiones_v1.0.py`. El repo es PUBLICO: esas contrasenas quedaron en el
historial de git. Y peor: los dos archivos Python van en `extraResources`, o sea que las
contrasenas **se repartian con el instalador a cada cliente final**.

**Lo que se hizo.**

- **Las contrasenas salieron del codigo.** Ahora `utils/emailSender.js` tiene solo las
  DIRECCIONES (que no son un secreto: ya estaban en el repo) y lee la contrasena del
  entorno. Los dos Python leen `os.environ`.
- **El cargador del `.env` vive en `shared/`, no en `utils/`.** `package.json` mete
  `**/utils/**` en `asarUnpack`, y ahi el `.env` NO esta (viaja dentro de `app.asar`). Un
  cargador en `utils/` habria funcionado en desarrollo y habria fallado **solo en el
  instalador**: el peor sintoma posible, porque en la PC del owner todo anda bien.
- **Se re-lee en cada envio.** La app crea un `EmailSender` por invocacion, asi que una
  contrasena rotada aplica al siguiente envio sin reiniciar la app.
- **La guardia de build ahora exige las cinco.** Sin eso se podia compilar en una maquina
  sin el `.env` y salir un instalador con "Enviar por correo" muerto, cuyo unico sintoma
  seria un error de Gmail que no menciona K+AIR.
- **El mensaje del usuario no habla de variables.** El detalle tecnico (que variable
  falta) va en `error.detalle` y lo escribe el log del main; el renderer recibe un
  mensaje limpio. Es el mismo patron que ya usa el flujo de Google OAuth.

**Dos huecos que aparecieron de paso.**

1. El `.gitignore` cubria `.env` y `.env.local`, pero **no** `.env.production` ni
   `.env.staging`: un `.env.staging` se commitearia. Ahora cubre `.env.*` con las
   excepciones `!.env.example` y `!.env.*.example`.
2. `build.files` empieza con `**/*` y no excluia el `.env` del `firma-service`, que tiene
   las llaves de produccion (`TOKEN_ENCRYPTION_KEY`, `ADMIN_API_KEY`,
   `INTERNAL_API_KEY`, `FIRMA_HMAC_KEYRING`). **Las llaves de produccion se estaban
   empaquetando en el instalador.** Ahora quedan excluidas. (Ojo: el comentario del
   `main.js` que decia que el `firma-service` no viaja en el instalador **no era cierto**:
   `**/*` si lo incluye.)

**Verificacion.** Test nuevo `main/test-email-env-931.js` con **31 checks** y **10
mutaciones verificadas** (volver la contrasena al codigo en el JS y en el Python, mudar el
cargador a `utils/`, destapar el `.gitignore`, quitar las contrasenas de la guardia,
mencionar el `.env` en el mensaje del usuario, quitar el `detalle` del log, devolver el
`.env` del `firma-service` al instalador, cambiar la API publica, y dos mas): **las diez
tienen que caerse y caen**. Los tests vecinos siguen verdes (`test-google-oauth-868`:
57/57; `test-remisiones-v2`: 77/77).

**LO QUE FALTA, y es del owner: ROTAR.** Sacar la contrasena del codigo **no la invalida**:
el repo es publico y quedo en el historial. La rotacion (Google Account > Seguridad >
Contrasenas de aplicacion, cinco cuentas nuevas) es la parte que si las invalida. Las
nuevas van al `.env` de la maquina que compila; las viejas se invalidan.

### 2026-10-22 · 📦930 · El PDF huérfano que quedó en producción y el script que no miraba donde debía

**Lo que había quedado.** La purga del rastro de prueba (📦929) dejó en producción un PDF
huérfano: `storage/pdfs/originales/SIGN-2026-020330.pdf`, un sobreviviente del 21-oct cuya
fila no apuntaba a él. La base ya estaba limpia (9 firmas, 57 eventos, 6 sesiones, 15 tokens
y 15 archivos fuera); ese archivo era lo único que quedaba en el árbol de PDFs.

**La herramienta existía y no servía.** `scripts/cleanup-orphan-pdfs.js` (que mueve, nunca
borra, y deja manifiesto con el SHA-256) tenía las rutas fijas al layout local: la base y el
storage como hijos de `app/`. En `kair-server` son **hermanos** (`/opt/kair-firma/data/` y
`/opt/kair-firma/storage/`), así que el script salía con «BD no encontrada» (exit 2). Peor:
el hard-block de producción exigía `--yes` para el dry-run, y `--yes` **mueve**: en
producción no había forma de *ver* qué se iba a mover sin hacerlo. Un «nada que mover» que
en realidad significa «no miré donde debía» es peor que un error: **se lee como una buena
noticia**.

**Qué se cambió.**

- **Rutas del entorno** (`DB_PATH`, `PDF_STORAGE_PATH`), resueltas contra la raíz del
  servicio como en `src/config.js`; el archivo queda como hermano del árbol de PDFs
  (`/opt/kair-firma/storage/pdf-archive`).
- **El dry-run se permite en producción** porque no escribe nada (ni crea el directorio de
  archivo, ni el manifiesto, ni mueve un byte). Lo que exige `--yes` es **mover**.
- **El aviso que no puede faltar**: si hay huérfanos **fuera** de la lista objetivo, el
  script los nombra. «Nada que mover» ya no puede leerse como «el storage está limpio».
- **El manifiesto del día acumula** entre ejecuciones (antes se pisaba) y lleva el SHA-256
  de cada archivo movido.
- **Los cuatro árboles de PDF**: `originales`, `firmados`, `constancias` y `papel` (el 9A),
  con los sufijos de cada uno (`-constancia`, `-firmado`, `-registro`).
- **`main(argv)` devuelve el código de salida** (testeable sin spawns) y `--json` imprime
  solo JSON.
- **El blindaje de root**: si la base no abre en solo lectura (WAL sin `-shm`), como root el
  script **se niega** a abrirla en modo escritura —dejaría `-wal`/`-shm` de root en el
  directorio de datos y el servicio (que corre como `kairfirma`) dejaría de poder escribir
  en ellos—. Pide correrlo como el usuario del servicio.

**Verificación.** **23 tests** nuevos (`tests/scripts/cleanup-orphan-pdfs.test.js`) y **13
mutaciones verificadas**: degradar las rutas al layout local, quitar el aviso, hacer que el
dry-run mueva de verdad, quitar el `readonly`, hacer que el dry-run cree el directorio de
archivo, hacer que el manifiesto se pise, invertir la detección de huérfanos, romper
`--ids=`, dejar de escanear `papel/` — **las trece tienen que caerse y caen**. Suite
completa del service: **1495 pruebas · 1493 verdes · 0 fallos · 2 omitidas**.

**Lo que pasó en el servidor.** Instalado con el hash verificado (`5a2ef98f…`), el dry-run
resolvió las rutas del entorno (`BD: /opt/kair-firma/data/firma.sqlite`, `Storage:
/opt/kair-firma/storage/pdfs`), encontró **1 candidato, 1 huérfano confirmado, 1 a mover** y
no escribió nada. Con `--yes`: **1 archivo movido** y manifiesto en
`/opt/kair-firma/storage/pdf-archive/2026-10-23/manifest.json` (fechado en UTC: el servidor
ya iba en el 23). Corrió como `sudo -u kairfirma`, no como root.

**Verificado en el servidor.** El archivo quedó en
`pdf-archive/2026-10-23/originales/SIGN-2026-020330.pdf` (174 898 bytes, con su **fecha
original** —el 17-oct—: el `rename` la conserva, y la evidencia conserva su cronología),
con el SHA-256 `54e831a1…` en el manifiesto (`total_orphans=1`, `moved=1`, `errors=0`). Todo
**con dueño `kairfirma`**, incluido el manifiesto: el directorio de archivo hereda el dueño
del storage. Y los cuatro árboles del storage principal quedaron **vacíos**: `originales`,
`firmados`, `constancias` y `papel` dan `total 0`. El storage está limpio, y ahora se puede
decir porque está verificado, y no porque el script lo dijera.

**Y el servicio no se reinició.** `/health` da `db: ok` y `smtp: configured`, con
`uptime_seconds` de más de 5 horas (el mismo proceso de antes): ni la base ni el proceso se
tocaron, y el túnel público responde igual.

**De paso, el panel se reinstaló.** En el servidor seguía la versión **anterior** (la que
no tenía el fix del ESC), así que se volvió a instalar con el hash verificado
`c12dd0e4…`. Corriendo, el tablero general da: 1 empresa (`ASEPLUS CARIBE S.A.S.`, activa),
`firmas=0 eventos=0 tokens=0 vivos=0 sesiones=0` y **1 consentimiento**: el de prueba que
sigue vivo (id=2). Y el **Esc ya vuelve al tablero general**: el fix del 📦929 quedó
verificado en el servidor con esta versión.

**Lo que queda.** (1) El **consentimiento de prueba (id=2)** sigue vivo: `--solo-firmas` no lo
borra y `--solo-consentimientos` todavía no existe. **Decisión del owner (23-oct): se deja la
fila.** La fila es la aceptación de `SIGN-2026-492341` (una de las 9 firmas de prueba que la
purga del 22-oct borró con recibo), apunta a la **v1.0 viva** (`52a490a4…`, no una referencia
rota) y guarda el correo y la IP del propio owner; el `otp_hash` no está (no quedó la
credencial del OTP). **El modo no se implementa por ahora.**

**La deuda que deja esa decisión (anotada, no resuelta).** Ni la lápida (`gh_firma_purgadas`)
ni el recibo de la purga de prueba (`gh_firma_purga_registro`) guardan el `id_solicitud`:
guardan un `firma_id` numérico y un HMAC del token. Y el plan de `--solo-firmas` **ni siquiera
trae el `id_solicitud` del consentimiento** (la migración 024 lo agregó a la tabla y el script
no lo usa), así que filtró por fecha y dejó esta fila. Las dos consecuencias: (a) un
consentimiento huérfano **no se puede clasificar desde la base**: "no hay firma viva" NO
significa "es de prueba", porque es exactamente la forma que deja la 5B cuando suprime una
firma vencida (la 5B **sí** escribe lápida; la purga de prueba **no**); (b) los recibos son
ilegibles para un humano: no dicen qué firma se suprimió.

**Lo que quedaría hecho (📦931, pospuesto).** Una migración 034 que agregue el
`id_solicitud` a las dos tablas (y lo escriba en `supresion.js` y en el script de purga); un
modo `--solo-consentimientos` con lista explícita, la verificación de "sin firma viva y sin
lápida", el borrado de sus `gh_consentimientos_eventos` (la FK los bloquea) y un recibo sin
datos personales; y el arreglo de `--solo-firmas` para que borre los consentimientos de las
firmas que él borre, para que esto no se repita.

(2) El **11A con el abogado**, que es lo que enciende el D-02 y mide el inventario del buzón.

### 2026-10-22 · 📦929 · El panel de firmas: ver el proceso completo sin escribir en la base

**El pedido.** "Necesito ver en tiempo real cómo van las firmas, por empresa: el estado, los
tokens, todo." Con el servicio ya en producción, esa pregunta se respondía con `sqlite3` a
mano: un comando por tabla, copiado y pegado. Con nueve firmas ya había que ejecutar cuatro
consultas para saber si algo seguía vivo, qué tokens quedaban y cuándo se había movido algo
por última vez.

**Qué se construyó.** `firma-service/scripts/panel-firmas.js`: un tablero de **solo
lectura** con tres vistas navegables (tablero general → panel de empresa → detalle de
firma), **sin una dependencia nueva** (solo `readline` y secuencias ANSI de Node).

- **Tablero general**: todas las empresas con su resumen, y las firmas que NO están en
  estado terminal (las que siguen vivas), con sus tokens y si alguien abrió el enlace.
- **Panel de empresa**: la ficha (Anexo, plazo, canal de PQRS, política de datos), el
  resumen de conteos y la tabla de firmas.
- **Detalle de firma**: estado, tokens (`VIVO` / `VENCIDO` / `REVOCADO`), sesión,
  consentimiento y la **traza completa** de `gh_firma_eventos`, que es la tabla donde vive
  el comportamiento de cada firma.

**El candado: esto no puede romper nada.** La base se abre con `better-sqlite3` en modo
`readonly: true`; si el motor no deja (una base en WAL a la que no se le puede crear el
`-shm`), cae a una conexión normal **avisando**. Nunca imprime el `token_hash` (es la
credencial del enlace), ni el pseudónimo completo del trabajador, ni la `metadata` cruda de
los eventos: la IP sale enmascarada (`192.168.x.x`) y los hashes, truncados.

**La trampa que sólo apareció corriendo el script.** Instalado en el servidor, el owner
probó que **`Esc` no lo devolvía**: el panel se quedaba quieto. No era el script: era **el
parser de Node**. `readline.emitKeypressEvents` **no emite ningún `keypress` cuando lo que
llega es una ESC sola** (el parser espera a ver si lo que sigue es una secuencia ANSI).
Reproducido en Node v26: `ESC sola -> NINGUN keypress`; la flecha (`ESC [ A`) sí llega como
`up`. O sea, la tecla "volver" era **inalcanzable**, y el test que la cubría miraba
`key.name === 'escape'`, un valor que el runtime jamás produce: el test pasaba con la tecla
inexistente. Se reescribió el lector de teclas (`crearLectorTeclado`, decodificación byte a
byte: ESC sola tras 50 ms = ESC; ESC + `[` u `O` = secuencia) y la navegación se movió a
`aplicarTecla()`, una función **pura** (no dibuja, no lee la base) para poder probarla sin
terminal.

**El segundo bug, del mismo molde.** El despacho de `--empresa` comparaba `opts.vista` donde
debía comparar `datos.vista`: la vista de empresa caía al tablero general. **Ningún test lo
cubría** (la función se probaba por partes, no de punta a punta); salió de **correr** el
script. Ahora hay un test de despacho para cada modo.

**Verificación.** **40 tests** nuevos (`tests/scripts/panel-firmas.test.js`) y **6 mutaciones
verificadas**: degradar el enmascarado de la IP, imprimir el `token_hash`, meter un
`UPDATE` en el script, romper el despacho de `--empresa`, romper la emisión de `escape` y
romper el "volver" de la firma a la empresa — **las seis tienen que caerse y caen**. Suite
completa del service: **1474 pruebas · 1472 verdes · 0 fallos · 2 omitidas**.

**Lo que se encontró de paso.** `empresaService.update()` es un **reemplazo completo** de
la ficha, no un parche: lo que no se manda queda en `NULL`, y `razon_social` es `NOT NULL`
(mandar solo `canal_pqrs` revienta con `SQLITE_CONSTRAINT_NOTNULL`, un 500 y no un 400). El
puente del escritorio lo hace bien (GET + merge + PUT), pero es la trampa #60 del
`PROMPT.md` para el override auditado de `canal_pqrs` del D-02.

**La purga de producción: HECHA.** El 22-oct a las 19:33 COT (00:33Z del 23) corrió en
`kair-server` con `--hasta=2026-10-22 --solo-firmas`, actor `Javier Robles Fontalvo`, motivo
"Rastro de prueba del e2e del 21 y 22-oct, antes de produccion real". El corte del 22 era el
correcto: las firmas del 21-oct por la tarde quedan con fecha **UTC** del 22 y con `--hasta=2026-10-21`
el script se negaba a tocar nada. Resultado: **9 firmas, 57 eventos, 6 sesiones, 15 tokens y 15
archivos** fuera; **0 consentimientos** borrados (este modo no borra consentimientos); la **v1.0
sin tocar** (`hash=52a490a4f4ce`, `activa=1`); `integrity_check: ok` y los triggers append-only
repostos. Recibo: **9 filas** en `gh_firma_purga_registro` y **2** en `gh_firma_purga_log`. La base
quedó en `firmas=0 eventos=0 tokens=0 sesiones=0 consent=1 versiones=1 activa=1`: el production
arranca sin rastro del ensayo.

**Lo que la purga NO se llevó: un PDF huérfano del 21-oct.** El `ls` de los tres directorios de
PDF dejó uno: `originales/SIGN-2026-020330.pdf`. No estaba en el plan de la purga (los 15 que sí
salieron son los `SIGN-2026-211245`, `-873182`, `-381270`, `-492341`, `-217085`, `-823423`,
`-952767`, `-614813` y `-313464`): es un sobreviviente de la **purga del 21-oct**, cuya firma se
retiró entonces (2 firmas, 27 eventos, 4 archivos) pero cuyo original quedó en disco porque su
fila no apuntaba a él. Es un huérfano confirmado: en la base no hay ninguna firma con ese
`id_solicitud` (la tabla tiene 0 filas).

**Y la herramienta que existe para eso no sirve en producción tal cual.**
`scripts/cleanup-orphan-pdfs.js` (que **mueve**, nunca borra, y deja manifiesto con el SHA-256)
tiene las rutas fijas al layout local: `DEV_DB_PATH = <app>/data/firma.sqlite` y
`STORAGE_ROOT = <app>/storage/pdfs`. En `kair-server` la base está en
`/opt/kair-firma/data/` y el storage en `/opt/kair-firma/storage/`: son **hermanos** de `app/`,
no hijos. Con el despliegue actual el script sale con "BD no encontrada" (exit 2), y además
**el hard-block de producción** impide siquiera el dry-run (`NODE_ENV=production` exige
`--yes`). La salida es que ese script sirve para el portátil y **no para el servidor**:
habría que leer `DB_PATH` y `PDF_STORAGE_PATH` del entorno, como hace el resto del servicio.

**Lo que queda.** (1) El **consentimiento de prueba (id=2)** sigue vivo: `--solo-firmas` no lo
borra y `--solo-consentimientos` todavía no existe. Falta la decisión del owner. (2) Se corrigen
aquí las **dos frases falsas** que quedaban de la entrada del 📦925: el 422 vs 500 **se detectó**
en el 📦925 (trampa #54) pero **se arregló** en el 📦927-928, y la falta de ruta de actualización
de Empresa **ya no es cierta** (la agregó el 📦927-928).

### 2026-10-22 · 📦928 · El catálogo de retención por documento: el plazo que fija el código, no la persona

**El síntoma.** El plazo de conservación era **uno solo por Empresa** (`plazo_retencion_dias`) y se contaba
desde la **firma**. Eso no puede representar lo que la ley fija por documento: los cinco grupos de registros
del SG-SST se conservan **20 años desde el cese** (art. 2.2.4.6.13 del Decreto 1072), el **contrato
electrónico se conserva sin término** (art. 2.2.1.1.12) y la **historia laboral** entre 80 y 100 años desde
el retiro (T-470/2019; Concepto AGN 2-2017-01654). Con un solo número, esos plazos no existían. Y como la
habilitación exigía que la Empresa declarara el plazo, una empresa que no lo declaraba **no podía firmar
nada**: el 409 `EMPRESA_NO_HABILITADA` bloqueaba la inducción de Aseplus.

**La causa raíz, en una frase.** El plazo era un dato **de la Empresa**; tenía que ser una regla **del
código**. Mientras fuera un dato, alguien lo tenía que cargar — y el que lo cargaba era una persona
eligiendo en una pantalla, que es exactamente lo que no puede pasar.

**Qué se cambió.**

- **Catálogo** (`firma-service/src/services/retencion.js`): 9 categorías y 4 reglas. La regla del sistema es
  la **custodia de 80 años** contados desde la firma (`ANIOS_CUSTODIA`), que cubre el mínimo de 20 años
  desde el cese de los cinco grupos del SG-SST y el rango de 80 a 100 años de la historia laboral. Si la
  Empresa declaró un plazo en su tabla, ese manda (el 8.6); el piso legal de los grupos SST nunca se puede
  bajar. El contrato queda con **hold**, sin término. El **deber legal sin término** de la Empresa gana
  sobre cualquier plazo.
- **Migración 033**: cuatro columnas (`categoria_retencion`, `regla_retencion`, `fecha_terminacion`,
  `plazo_retencion_aplicable`) y un índice. **Aditiva**: no reescribe filas, no hay backfill, las
  solicitudes viejas quedan en `NULL` y conservan el comportamiento anterior.
- **La clasificación es del sistema**: el cliente de K+AIR deriva la categoría del **tipo del documento**
  (`gh_documentos.tipo`: `contrato`, `induccion`, `autorizacion_hojas_vida`...) y la manda en el
  metadata. La API también acepta la categoría explícita y la derivación por tipo + subtipo.
- **La interfaz no muestra nada de esto.** Se quitó el selector de "tipo de documento para la conservación"
  y el campo "fecha de cese de la relación laboral" que se habían agregado al modal de firma (el owner los
  vio en la pantalla y los mandó sacar: "no debemos dejarle nada al usuario para que haga algo"). El
  operador no elige el plazo, no elige la categoría y no completa ninguna fecha.
- **La habilitación ya no exige el plazo**: `verificarHabilitacionFirma` pide solo el **Anexo de Encargo**
  y el **canal de atención**. Una empresa sin plazo declarado firma, y su custodia es la de 80 años.
- **Lo que ve el Trabajador**: la mini-app, el correo de invitación y la constancia comunican el plazo
  **aplicado y congelado en la fila**, no el de la Empresa en vivo.
- **Firma dual**: el hijo hereda categoría, regla, fecha de terminación, texto, fecha de conservación y
  hold del padre: es el mismo documento.
- **Script de humo**: `--categoria-retencion=` / `--fecha-terminacion=` para verificar en el servidor que
  la 033 quedó aplicada.
- **Documentación**: API §6.13.6 (reescrita), DATA_MODEL, el runbook del servidor (§5.1.1) y el plan de
  despliegue (el conteo de migraciones pasa de 14 a 15).

**Decisiones del owner.** (1) El alcance es el **catálogo completo**, no solo los datos de Aseplus.
(2) **Nada de esto se le pregunta al operador**: el plazo vive en el código y el sistema clasifica solo.
(3) El **deber legal sin término de la Empresa gana siempre** sobre el plazo del documento: un plazo más
corto no puede recortar un deber sin término, y hacerlo sería una supresión indebida. (4) El **Anexo de
Encargo** y el **canal de atención** siguen exigiéndose: el código solo reemplaza el plazo declarado.
(5) La fecha de cese **no se le pide a nadie**: se usa solo si el sistema ya la conoce.

**Verificación.** Suite nueva `tests/retencion-por-documento.test.js` (**19/19**: custodia de 80 años,
la tabla de la Empresa cuando declara, el piso de 20 años de los grupos SST, el hold del contrato, la
historia laboral, el deber legal, la migración, el alta sin plazo declarado, la clasificación automática,
la mini-app, el correo y la herencia de la firma dual). Se actualizaron `tests/d03-habilitacion-empresa.test.js`
y `tests/plazo-retencion.test.js` a la regla nueva (antes fijaban "sin plazo declarado no se firma").
Suite completa del service: **1434 pruebas, 1432 verdes, 0 fallos, 2 omitidas** (los omitidos y los 3
checks rojos de `main/` son preexistentes: son regex sobre código de paquetes anteriores). `node --check`
limpio en los archivos tocados.

**El despliegue (2026-10-22, en el servidor).** El código llegó a `kair-server` y la **033 se
aplicó en producción** (`"Aplicando migración","version":"033_retencion_por_documento"`, `"total":32`), con el
servicio reiniciado y el `uptime` del proceso en segundos. **La trampa que costó dos intentos:** el zip armado con
`Compress-Archive` de PowerShell guarda las rutas con `\` y en Linux ese `\` es parte del nombre del archivo,
así que la extracción "funcionaba" sin error y dejaba archivos planos llamados `src\server.js`: el servicio
reiniciaba con el código viejo y la migración seguía diciendo `total:31`. Se resolvió extrayendo con `python3`
normalizando el separador, y quedó documentado en el runbook (§5.1, "Empaquetar en Windows") junto con la
verificación de 10 segundos que lo habría atrapado antes de arrancar.

**Lo que queda.** (1) El **Anexo de Encargo** de Aseplus sigue sin resolverse: la base dice que está
firmado (2026-10-21) y el documento de onboarding dice que no. (2) La **URL real de la política de
datos** sigue sin confirmar (en `null`: el bloque público muestra "no publicada"). (3) **El servidor ya está actualizado** (2026-10-22): la prueba manual quedó a un clic de la app.
(4) D-02 sigue apagado y no se publicó v1.1.

### 2026-10-21 · 📦927 · Datos para firma electrónica: guardar local, releer y publicar en el servidor

**El síntoma.** El formulario «Datos para firma electrónica» de Configuración de Empresa no sobrevivía al cierre: al reabrir la empresa volvía vacío. El bloque «Empresa que solicita tu firma» seguía mostrando los datos que un administrador había cargado a mano, y no había forma de que el PC publicara los suyos.

**La causa raíz, en tres piezas.** (1) El puente local no quedaba registrado: el nombre exportado no coincidía con el que se importaba y el chequeo de autenticación usaba una propiedad que `validateSession()` no devuelve. (2) El renderer no exponía ninguna función para publicar, y el firma-service no tenía un canal para que el PC empujara la identidad. (3) Los nombres de campo del formulario no eran los del servidor, y el `update()` del service no hace merge: todo campo omitido se guarda como `null`.

**Qué se cambió.**

- `main/empresa-datos-firma-bridge.js`: registro idempotente (`register...` + alias `.register`), autenticación suave como la del puente del representante legal y upsert local.
- `main/empresa-datos-firma-sync.js`: merge puro que conserva lo que el formulario no edita (`razon_social`, plazo de retención, canal de solicitud de copia, conservación por deber legal y norma) y no manda `dominios_corporativos`, para que el service los preserve.
- `main/firma-client.js`: `adminGetEmpresa`, `adminUpdateEmpresa` y `adminCreateEmpresa` con `X-Admin-API-Key`.
- `main/firma-bridge.js`: canal `firma:empresa:datos:sync` con GET → merge → PUT. Si la empresa no existe devuelve `EMPRESA_NO_REGISTRADA`; **no la crea sola**, porque el alta exige decisión administrativa y Anexo de Encargo firmado. Si no está configurada en `secrets.enc`, devuelve `skipped`.
- `preload.js` y `config-viewer.html`: guardado local honesto (si falla, no se cierra el modal ni se dice «guardado»), validación inline de correo y URL, recarga al reabrir, aviso si la publicación falla y protección contra respuestas viejas al cambiar de empresa.
- `renderer.js`: cache-bust del iframe (`20261022-datos-firma-sync927`).

**Verificación.** 182 tests verdes de las cuatro suites (`test-empresa-datos-firma`, `test-empresa-datos-firma-sync`, `test-firma-bridge`, `test-firma-client`), 8/8 del endpoint admin, arnés real de la vista (guardar → cerrar → reabrir → publicar) y una prueba de integración HTTP create → GET → merge → PUT → `publicViewFor` que confirmó que los datos del formulario cambian y los campos que no edita se conservan. Todo con datos sintéticos y la base de tests.

**Lo que queda.** La empresa debe existir en el servidor y tener el Anexo firmado; el alta inicial sigue siendo administrativa. Sin `adminApiKey`, el guardado local funciona pero la publicación queda pendiente y la UI lo avisa. D-02 sigue apagado y no se publicó v1.1.

### 2026-10-21 · 📦926 · El enlace que no resolvía: la causa raíz, el check que faltaba y la limpieza que el candado bloqueaba

**El síntoma.** En producción ningún token de enlace resolvía: `404 TOKEN_NOT_FOUND` en
`/api/sign/<token>/verify`, `/acuerdo.txt`, `/medios` e `/identify`. El único 200 era el HTML
estático de la mini-app, y por eso el firmante veía una pantalla en vez de un error. El alta
daba 201, el correo salía y el Acuerdo estaba publicado y sellado: todo en verde menos lo
único que importa, que el firmante pueda abrir su enlace.

**La causa raíz, en una frase.** El proceso que servía no era el del código copiado: acuñaba
los tokens con el esquema viejo (`SHA-256(token)` pelado, sin HMAC — el `app.bak` del
despliegue todavía lo tenía así) y el lector del código nuevo no reconocía esas filas.
Reiniciar el servicio cargó el código desplegado y el token nuevo resolvió al primer intento:
`200`, con la fila completa (`id_solicitud`, `id_trabajador` seudonimizado, `identificacion_tipo`).

**Cómo se llegó hasta ahí: cinco diagnósticos que descartaron una causa cada vez.**

1. **No hay dos `.env`.** `app/.env` no existe y `config.js:8` (dotenv sobre un archivo
   inexistente) es inofensivo. Quedó descartada la hipótesis de la llave duplicada.
2. **El que escribe y el que lee son la misma función.** `hashTokenHmac` es el primer
   candidato de `tokenHashCandidates`, y `getByTokenHash` los prueba todos. No hay bug de
   búsqueda ni de ámbito.
3. **Una sola llave, un solo proceso, sin llave de desarrollo.** `NODE_ENV=production`, la
   llave del proceso idéntica a la del `.env` (misma huella), `hex64=true`, sin
   `FIRMA_HMAC_KEYRING`, sin `.dev-master-key` en disco. Quedaron descartadas la rotación de
   llave, el `NODE_ENV` mal puesto y el proceso paralelo.
4. **El `mtime` NO prueba qué código tiene el proceso en memoria.** Los archivos del servidor
   tenían fecha del 19 y del 20 de octubre, anteriores al arranque, y eso parecía prueba de que
   el proceso cargó esos archivos. Falso: **`tar` conserva las fechas originales**, así que un
   archivo copiado a las 02:25 conserva la de hace semanas. La prueba real es el
   `uptime_seconds` del `/health` (chico después de un reinicio) y el hash de lo que quedó
   corriendo.
5. **El token que probábamos estaba mal transcrito.** Al leerlo de una foto de terminal se coló
   un `O` por un `0`. El `journalctl` conserva la ruta exacta que llegó al servidor, y al
   compararla se vio la diferencia. Un `404 TOKEN_NOT_FOUND` dice lo mismo en los cinco casos:
   no sirve para culpar a nadie sin leer el log.

**Qué se cambió (📦925).** Dos fixes del e2e que el ensayo contra el servicio real
atrapó: que llame a `/notify-remote` (el correo nunca salía y el script declaraba haberlo
mandado) y que mande la huella de identificación (`identify()` exige `identificacion_tipo` +
`identificacion_numero_hash` y respondía 500). El **tercero se detectó pero no se arregló
aquí**: el 422 vs 500 de `MISSING_IDENTIFICATION_DATA` (el mini-app espera 422 y el servidor
mandaba 500) quedó documentado como hallazgo y trampa #54, y **el arreglo entró en el
📦927-928**, con el status corregido a 422 en `publicFlow.js` y su test.

**Qué se cambió (📦926).**

1. **El check que faltaba: el e2e abre el enlace que él mismo crea** (paso 5c de
   `scripts/smoke-produccion.js`). Una corrida de humo que no abre el enlace que creó no
   prueba que el firmante pueda firmar: el alta dio 201, el correo salió y el firmante abrió un
   404. Tres tests nuevos, y el del fallo se verificó con mutación real.
2. **El modo `--solo-firmas` del script de purga.** El candado del texto legal —que hizo bien su
   trabajo— impedía limpiar las filas de prueba una vez que el legal ya estaba publicado: la
   versión vigente ES el legal sellado. El modo nuevo borra firmas, eventos, sesiones, lotes,
   tokens y archivos, **no toca ninguna versión**, deja recibo en las tablas append-only y
   verifica al final que la versión vigente sigue ahí, activa y con su huella. Once tests
   nuevos, con mutación verificada (si el modo degrada para borrar la versión, se caen).
3. **El runbook del despliegue** (`docs/MIGRACION-SERVIDOR-FIRMA.md` §5.1 y §5.2): el orden que
   no se negocia (parar → copiar → verificar el hash en disco → arrancar → verificar que el
   proceso que corre es el nuevo), una tabla con **lo que NO es prueba** (el hash del disco, el
   `mtime`, el `kair_version` del `/health`, que el alta dé 201) y la limpieza con recibo.

**Decisiones del owner.** Autorizó en esta jornada: el **commit y el push** de 📦925 y 📦926,
la **limpieza del rastro de prueba** en producción y el **reinicio del servicio** como paso del
diagnóstico. La secuencia de trabajo sigue la acordada: `Gate 0 → 8A.1 → 8A.2 → 8C → 8B →
10.4 → 9A → 11A → 9B → 10 → 11B`.

**Bugs encontrados (cinco).** (1) El e2e no llamaba a `/notify-remote`: el correo nunca salía.
(2) El e2e no mandaba la huella de identificación: `identify()` respondía 500.
(3) `MISSING_IDENTIFICATION_DATA` con 500 donde el mini-app espera 422. (4) El e2e no comprobaba
que el token resolviera —este costó la jornada y casi costó el despliegue—. (5) El despliegue
dejó el **disco nuevo y el proceso viejo**: el `app.bak` conserva el esquema viejo del token.

**Tests.** 11 nuevos del script de purga (con la base sembrada como la de producción: la versión
vigente con la huella sellada) y 3 nuevos del check del token; los 22 del script de humo, con el
e2e ahora haciendo dos llamadas (crear y verificar el token). Suite completa antes de commitear.
Las dos mutaciones se verificaron con cambios reales de código, no de palabra.

**Archivos tocados.** `scripts/smoke-produccion.js`, `scripts/limpiar-rastro-prueba.js`,
`tests/scripts/smoke-produccion.test.js`, `tests/scripts/limpiar-rastro-prueba.test.js` (nuevo),
`docs/MIGRACION-SERVIDOR-FIRMA.md`, `Historial.md`, `PROMPT.md` (trampas #55 a #58) y
`sgsst-electron-app/BITACORA.md`.

**Commits.** Dos: 📦925 (los siete archivos que ya estaban stageados: los tres fixes del e2e, los
dos scripts de operación y la documentación) y 📦926 (el check del token, el modo
`--solo-firmas` con sus tests, el runbook y la documentación). El hash no se escribe dentro del
propio commit: un `--amend` lo cambiaría y la referencia quedaría apuntando a un commit
fantasma. Los dos van pusheados a `origin/Dev` en la misma tanda.

### 2026-10-20 · 📦925 · El despliegue a producción: 16 migraciones, el Acuerdo legal vigente y la prueba de humo

**Qué se hizo** — el despliegue de verdad, con el owner ejecutando los comandos en la terminal web de kair-server (Cockpit, `https://192.168.1.11:9090`), porque el acceso por SSH está denegado (`Permission denied (publickey,password)`):

- **El despliegue**: el código de `b5c04f93` (📦912-923) y `a69720ff` (📦924) quedó en `/opt/kair-firma/app` y aplicó **16 migraciones** (019 → 032). El log del servicio lo dice: `"Migraciones completadas","nuevas":16,"total":31`. No hubo cambios de dependencias: el `package.json` del servidor ya tenía las mismas nueve.
- **El rastro de prueba eliminado**: 2 firmas, 27 eventos, 1 sesión, 1 consentimiento, 4 archivos y la v1.0 borrador (`37d755982b78`, 30.311 chars). Con recibo en `gh_firma_purga_log` y `gh_firma_purga_registro`, triggers append-only repuestos desde el archivo de la migración 020, e `integrity_check: ok`.
- **El texto legal publicado como v1.0** (`52a490a4f4ce`, 32.907 chars) y verificado por el sello: `archivar-acuerdo.js --verificar` → **exit 0**.
- **La Empresa 900829731** registrada con Anexo firmado, plazo de 1825 días y canal PQRS.
- **Tres scripts nuevos**: `scripts/limpiar-rastro-prueba.js`, `scripts/publicar-acuerdo-legal.js` y `scripts/smoke-produccion.js` (con 17 tests).

**Por qué** — el owner pidió validar el repo y el Acuerdo, cambiarlos en producción y hacer una prueba.

**Lo que la prueba comprobó, en vivo**

| Qué | Evidencia |
|---|---|
| El código nuevo corre | `POST /api/solicitudes` → **201** (antes 404) |
| El Acuerdo vigente es el legal | `52a490a4f4ce`, y el texto que se sirve al firmante son los 32.907 chars del legal |
| El sello cuadra con lo publicado | `exit_archivar=0` |
| La base quedó íntegra | `integrity_check: ok` |
| No hay ninguna Empresa registrada (Gate 0.5) | `{"items":[]}` |
| El control de habilitación se puede probar en las dos direcciones | empresa registrada sin Anexo → **409**; con Anexo → **201** |
| El e2e crea la solicitud de verdad | `SIGN-2026-211245`, ligada al Acuerdo vigente (`agreement_hash=52a490a4f4ce`) |
| Al firmante le llega el correo | **NO**: el e2e solo creó la solicitud. La invitación la manda otro endpoint (`/notify-remote`) y el script no lo llamaba |
| El script instalado es el del repo | `sha256` del servidor = `8095f8a6...` = el del repo, byte a byte |

**Decisiones del owner** — commitear sin push; las 2 firmas y el consentimiento del 17 de octubre eran **pruebas suyas**: el servicio nunca operó con clientes reales. Eso autorizó a limpiar el rastro y a publicar el legal como v1.0 (no como v1.1), porque la v1.0 publicada era un borrador.

**Hallazgos que quedan**

1. **`/health` miente**: la versión está fija en el código (`routes/health.js:45`). La prueba de despliegue es `POST /api/solicitudes`, no el health.
2. **`Idempotency-Key` es incompatible con la llave interna** (400 `IDEMPOTENCY_LEGACY_NOT_SUPPORTED`): el K+AIR de escritorio no puede usar idempotencia hasta migrar a la llave por empresa (I-010).
3. **El alta de Empresa no tenía ruta de actualización** (cierto el 20-oct, **ya no lo es**): se creaba y ya, sin `PUT`/`PATCH`. El 📦927-928 agregó `PUT /internal/admin/empresas/:id_empresa` (+ `POST /:id/anexo-firmado` y `POST /:id/estado`), y el puente del escritorio ya lo usa. Lo que **queda** para el D-02 es el **override auditado** de `canal_pqrs`: la ruta existe, pero el cambio no deja rastro en una tabla append-only (solo un log) y `update()` es un reemplazo completo de la ficha (trampa #60).
4. El `id_trabajador` se **pseudonimiza** al guardarse (`psn1_<hash>`), no queda en claro en la fila.
5. El `.env` de producción tiene un valor con espacio sin comillas (`SMTP_FROM_NAME`): systemd lo tolera, pero `source` en bash no (`Firma: command not found`).

6. **El servidor puede quedar corriendo código que NO está en el repo.** El `scripts/smoke-produccion.js` que corría en producción no coincidía con ninguna versión del repo: ni con `HEAD` ni con el working tree, ni aunque se contaran todas las variantes de EOL y BOM. El tar que se descargó en el servidor **sí** era el correcto (sha256 verificado) y su contenido **sí** llevaba el fix, pero la extracción no surtió efecto — el bloque de comandos pegado en la terminal web se ejecutó a medias — y el 400 volvió a salir con el mismo texto. **La prueba de un despliegue no es "el comando no dio error": es el hash del archivo que quedó.**

Resuelto así: el archivo se reinstaló con `install` (no con `tar`) y el hash del servidor pasó a coincidir con el del repo. El `.bak` dejó la evidencia: guardó la versión fantasma (`23c626fa...`), lo que prueba que el `cp` sí corrió y el `tar -xzf` nunca llegó a aplicarse — el bloque de cuatro comandos pegado en la terminal web se ejecutó a medias.

7. **Crear la solicitud de firma NO manda ningún correo: el primer contacto con el firmante es otro endpoint.** `POST /internal/sign-requests` crea la fila, devuelve el token y la URL y no envía nada (`src/routes/signRequest.js:320`); la invitación la manda `POST /internal/sign-requests/:id/notify-remote`, que es el que llama a `mailer.sendInvite()`. El script de humo solo hacía lo primero, así que su "e2e" daba **OK con 12 comprobaciones sin haber probado el correo**: la invitación nunca salió y el firmante nunca supo de la solicitud. Dos cosas se falsearon en el camino y conviene que queden escritas: **(a)** el aviso del script "Se mando un correo real a ..." era el script imprimiendo su propio argumento, no la confirmación del servidor — un aviso que dice una cosa y prueba otra; **(b)** `smtp: configured` no prueba la entrega, pero tampoco era el problema: el SMTP de producción está bien (Gmail acepta con `250 2.0.0 OK`, `accepted=[adminkair@gmail.com]`, `rejected=[]`) y un correo de prueba enviado a mano **sí llegó** a la bandeja. El bug era nuestro: no llamáamos al endpoint que envía. **Un check que no muerde no es un check**: el e2e daba verde sin haber tocado el correo, y eso es justo lo que un check tiene que impedir.

8. **El e2e tampoco probaba la identificación: `identify()` exige `identificacion_tipo` y `identificacion_numero_hash` en la fila.** Si faltan, responde `500 MISSING_IDENTIFICATION_DATA` y el firmante no puede avanzar. El script mandaba la solicitud sin esos dos campos, así que el recorrido se cortaba en el paso 3 de 5 (abrir el enlace, ver el Acuerdo, aceptar, identificarse, ver el documento, firmar). El cliente (K+AIR) manda el SHA-256 del número, nunca el número en claro; el servicio lo convierte en un HMAC con su llave maestra. Sin sal (que es lo que hace el script), el hash previo es `sha256(numero)`: por eso el firmante tiene que escribir **exactamente** el mismo número que el script usó para calcular la huella. El script ahora lo calcula, lo manda y **te dice en la salida qué número escribir**, con dos tests nuevos (ambos verificados con mutación real).

9. **El mini-app espera un 422 y el servidor manda un 500 para el mismo caso.** Cuando a la solicitud le faltan los datos de identificación, `publicFlow.identify()` lanza `AppError(500, 'MISSING_IDENTIFICATION_DATA')`; el mini-app, en cambio, ramifica con `err.status === 422 && err.code === 'MISSING_IDENTIFICATION_DATA'` (`web/firma/app.js`). Los dos no coinciden, así que el firmante ve el error genérico en vez del mensaje claro que el frontend sabe mostrar. El código del error es el mismo, pero el status no: un `catch` por código sin el status se rompe en el momento en que uno de los dos lados cambia. **El contrato entre cliente y servidor es el mismo contrato**: si uno dice 422, el otro tiene que decir 422.

**Tests** — suite completa: **1399 tests · 1397 verdes · 0 fallos · 2 omitidos**. Los tres candados del script de limpieza (firma más nueva que el corte, versión con la huella del legal sellado, firma con hold legal) **abortan sin tocar nada**, y eso está probado.

**Bugs encontrados** — dos 400 míos que el **ensayo local contra el servicio real** atrapó antes de tocar producción: el multipart de `POST /internal/sign-requests` lleva un campo `metadata` con un JSON **string** (no campos sueltos) y su `metadata` anidado también es string (no objeto); y `tipo_identificacion: 'OTRO'` no existe (el valor es `OTROSI`).

El fix del `metadata` llegó a producción a mano (paquete por HTTP + `install`), no por el despliegue: el tar se descargó bien pero la extracción no se aplicó. Lo detectó el propio script de humo, en el primer paso que escribe.

**Archivos tocados**

| Archivo | Qué |
|---|---|
| `firma-service/scripts/limpiar-rastro-prueba.js` | nuevo — la limpieza del rastro de prueba, con recibo |
| `firma-service/scripts/publicar-acuerdo-legal.js` | nuevo — publica el texto legal desde el archivo sellado |
| `firma-service/scripts/smoke-produccion.js` | nuevo — la prueba de humo (22 tests) |
| `firma-service/tests/scripts/smoke-produccion.test.js` | nuevo — 22 tests |
| `PROMPT.md` | las trampas #50 a #53 |
| `sgsst-electron-app/BITACORA.md` | la lección de los dos 400 y la del e2e que daba verde |

**Commits** — 📦925 en `Dev`, pusheado a `origin/Dev` junto con 📦926.

---

### 2026-10-20 · 📦924 · El carril de producción: el plan de despliegue, la prueba de humo y los tres hallazgos que pararían el despliegue

**Qué se hizo** — todo lo que se puede hacer sin entrar al servidor:

- **El plan de despliegue** (`docs/gestion-humana/firma-electronica/PLAN-DESPLIEGUE-PRODUCCION-2026-10-20.md`): las cinco fases con los comandos exactos (copia verificada, `.env`, despliegue, verificación, prueba), la resolución del choque de versiones del Acuerdo, el rollback y lo que el despliegue NO enciende.
- **La prueba de humo** (`firma-service/scripts/smoke-produccion.js`): por omisión solo lee (health, Acuerdo vigente comparado contra el manifiesto sellado, ruta interna); escribe únicamente si se le pide (`--canal-datos`, y `--e2e` exige además `--confirmar-e2e`).
- **Dos ensayos de migración** sobre copias de bases con evidencia real: las 14 migraciones (019 → 032) aplican en modo producción, con los triggers append-only incluidos (las directivas `@skip-when-env test` NO se saltan), sin tocar filas y con `integrity_check: ok`.
- **El fix de un hangul (U+B3CC)** que se había colado en `comparacion-mercado-firma-2026-10-20.md`.

**Por qué** — el owner pidió validar el estado del repo y del Acuerdo para cambiarlo en producción y hacer una prueba. El acceso por SSH está denegado (`javier@192.168.1.11` → `Permission denied (publickey,password)`), así que la Fase 0 (la copia verificada de la base) la ejecuta el owner por la terminal web del servidor.

**Los tres hallazgos que pararían el despliegue** — verificados contra el código, no supuestos:

1. **El servicio NO arranca en producción sin `TOKEN_ENCRYPTION_KEY`.** `src/crypto/keys.js:108-113` la exige, y es **nueva** de `ab78ca92` (📦906-911): el código que hoy corre en producción no la usaba — el token era un SHA-256 pelado. Sin esa variable en `/opt/kair-firma/.env` el proceso muere al arrancar y `firma.kair.fyi` deja de responder. **Es el riesgo #1.**
2. **`/health` no sirve como prueba de despliegue.** `src/routes/health.js:45` devuelve `'compatible-' + (env === 'production' ? '0.1.189' : 'dev')`: **la versión está fija en el código**, así que el health dice lo mismo antes y después del despliegue. La prueba real de que corrió el código nuevo es `POST /api/solicitudes` (el 1.3), que **hoy da 404** — verificado en vivo contra `https://firma.kair.fyi`.
3. **`canal_pqrs` ya es requisito de habilitación** (`src/services/empresa.js:753`, nuevo de `b5c04f93`) y `FIRMA_EXIGIR_HABILITACION_EMPRESA` viene en `true` (`src/config.js:166-167`): al desplegar, una empresa registrada sin Anexo firmado, sin plazo declarado o sin canal PQRS recibe `409 EMPRESA_NO_HABILITADA` y no puede pedir firmas. Hay que correr `scripts/inventario-empresas-no-habilitadas.js` sobre la copia ANTES de desplegar.

**Decisiones del owner** — commitear sin push; actualizar `Historial.md`, `PROMPT.md` y `BITACORA.md`; el acceso al servidor es por la terminal web de la plataforma (`https://192.168.1.11:9090`), no por SSH.

**Tests** — `tests/scripts/smoke-produccion.test.js`, 12 tests nuevos. Las tres mutaciones (quitar el candado `--confirmar-e2e`, escribir siempre, imprimir la llave) **las detecta todas**. Suite completa del estado con los archivos nuevos: **1389 tests · 1387 verdes · 0 fallos · 2 omitidos**.

**Bugs encontrados** — un test que parchea `process.stdout.write` **se come la salida del reporter de node:test**: en modo `--test` el runner solo veía 2 de 11 tests, y todos pasaban. El arreglo: que el script **inyecte** su sumidero de salida en vez de parchear la consola global. Es la trampa #49.

**Archivos tocados**

| Archivo | Qué |
|---|---|
| `docs/gestion-humana/firma-electronica/PLAN-DESPLIEGUE-PRODUCCION-2026-10-20.md` | nuevo — el plan de despliegue |
| `firma-service/scripts/smoke-produccion.js` | nuevo — la prueba de humo |
| `firma-service/tests/scripts/smoke-produccion.test.js` | nuevo — 12 tests |
| `docs/gestion-humana/firma-electronica/comparacion-mercado-firma-2026-10-20.md` | el hangul (U+B3CC) corregido |
| `PROMPT.md` | las trampas #47, #48 y #49 |
| `sgsst-electron-app/BITACORA.md` | la lección del despliegue |

**Commits** — 📦924 en `Dev`, sin push. El hash no se escribe dentro del propio commit.

### 2026-10-20 · 📦923 · La documentación del cierre: las auditorías, el plan y las tres consultas

**Lo que se escribió (todo en `docs/gestion-humana/firma-electronica/`).**

- `revision-tc-capitulos-2-12-2026-10-20.md`: la revisión de los Capítulos II a XII, numeral por numeral, con **19 hallazgos** (H-TC-01 a H-TC-19). Cada uno dice qué dice el texto, qué hace el código y qué hay que hacer.
- `plan-cierre-tc-y-decisiones-2026-10-20.md`: el plan de cierre con las cinco decisiones abiertas, **la secuencia de publicación** (código → 9A → 11A → encender el rechazo) y el registro de lo que se hizo el 20.
- `propuestas-texto-11A-2026-10-20.md`: los textos numerados para el abogado, con el fundamento de cada uno. Incluye la **redacción del 3.7(a) del owner** (2026-10-20) y la **pregunta afinada que se manda acompañada del texto** (no se espera la respuesta: el código es el mismo bajo las dos respuestas).
- `consulta-legal-firma-en-papel-interfaz-2026-10-20.md`: la consulta sobre si la norma exige que el Acuerdo mencione la vía en papel o que exista un botón. **Respuesta: ninguna de las dos.** El 2.2.1.1.11 es una prohibición de condicionamiento, no una exigencia de interfaz; el botón es la evidencia de que el derecho es ejercitable.
- `comparacion-mercado-firma-2026-10-20.md`: cómo lo hacen **Buk** (que no tiene vía en papel: su modal solo ofrece Cancelar/Rechazar/Firmar, y su propio artículo admite que sin el rechazo el documento se quedaba pendiente para siempre) y el mercado global (que resuelve el problema cambiando el dato de entrada, no separando los canales).

### 2026-10-20 · 📦922 · La 9A: la firma en papel, los medios autorizados y el suministro a autoridades

**Lo que promete el Acuerdo y no existía: el Capítulo VII (7.1-7.3) y el 8.2.**

1. **La firma en papel (7.1-7.3).** La vía la abre la **Empresa** (el Trabajador le pide el papel por el canal de atención de la Empresa y la Empresa lo registra desde K+AIR). El sistema guarda el PDF con su huella, genera el **Registro de firma autográfica** (los hechos del acto, con la pareja de huellas: el documento original y el firmado a mano), le entrega la copia al Trabajador por un medio autorizado y **cierra la vía electrónica** (nada de doble firma).
   - **La mini-app NO menciona el papel** (decisión del owner, 2026-10-20): el 7.2 es un deber de la **Empresa**, y si la pantalla dice «tu empresa te la va a entregar», K+AIR está prometiendo en nombre de la Empresa algo que no puede garantizar (veracidad, Ley 1581 art. 4(d)(e); D.1377 art. 4). La oferta viaja en el **correo de invitación** (lo manda la Empresa) y queda asentada con la huella del cuerpo enviado (`PAPER_OPTION_AVAILABLE`).
2. **Los medios autorizados (8.2).** Registro real (`gh_firma_medios_trabajador`) con tres estados: lo declarado nace `PENDIENTE` y se activa cuando el Trabajador demuestra que controla el buzón. El Trabajador los ve y los cambia desde la mini-app («Mis medios autorizados»); la Empresa los ve por la API interna, que es por dónde le entrega las copias.
3. **El suministro a autoridades (8.4).** El asiento queda en el registro de eventos (`DOCUMENT_SUPPLIED_TO_AUTHORITY`) con quién lo pidió, a qué autoridad y con qué radicado.
4. **La copia permanente (8.3/8.5).** El documento firmado se consulta por la API interna (también en `DUAL_FIRMADO`, que antes servía el original) y la copia va al medio autorizado, no al buzón de la Empresa.

Migración `032`, servicios `medios.js` / `papel.js` / `pdfGenPapel.js`, 6 endpoints y 12 tests nuevos.

### 2026-10-20 · 📦921 · El D-02: el código de verificación a un medio personal

**El reencuadre.** `correo_verificacion` cumplía dos papeles: a dónde va la invitación (el token) y a dónde va el OTP (el dato de creación). Y la app lo precargaba con el correo del trabajador en la ficha de la Empresa: en la práctica, **el código le llegaba a un buzón que la Empresa puede leer**. El 2.2.2.47.4 num. 1 dice que "los datos de creación de la firma, en el contexto en que son utilizados, corresponden exclusivamente al firmante".

**La decisión (owner, 2026-10-20).** Separar los dos canales:

| Canal | Destino | Quién lo define |
|---|---|---|
| Invitación (el token) y copia firmada | `correo_verificacion` | La Empresa |
| **OTP** (dato de creación) | `correo_otp`: un medio personal que la Empresa no administra | **La Empresa** lo declara al crear la solicitud; si no lo tiene, el Trabajador lo declara en la mini-app |

La alternativa de mover **los dos** canales no es imposible: es **peor** (obliga a la Empresa a conocer un dato nuevo, el trabajador tiene que estar pendiente de su correo personal para una invitación laboral, y la Empresa sabe dónde llegó el código). Eso es lo que va al abogado, no un «imposible».

**Lo que quedó:** migración `031` (`correo_otp` + `dominios_corporativos`), `resolveCorreoOtp` con la regla de los dominios corporativos, `POST /api/sign/:token/medio`, el campo del modal de K+AIR, el inventario (`scripts/inventario-buzon-corporativo.js`) y **el rechazo apagado** (`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`, default false): se enciende **con la v1.1**, no antes.

**El desacople (owner, 2026-10-20):** el inventario decide la bandera, no el texto. El 3.7(a) dice qué es el método; el número dice si el sistema lo exige o solo lo recomienda.

### 2026-10-20 · 📦920 · La 10.4: la versión vigente del Acuerdo y la migración de la solicitud

**El problema que resolvía.** Publicar la v1.1 con solicitudes pendientes dejaba al firmante que llegaba tarde con un **409 sin salida**: su solicitud estaba ligada a la versión anterior, que ya no era la vigente. Eso impedía publicar.

**Cómo funciona ahora:** el firmante ve la **versión vigente** y, al aceptar, la solicitud **migra** a ella (evento `AGREEMENT_VERSION_MIGRATED`). El 409 pasa a ser accionable (`AGREEMENT_VERSION_REACCEPT_REQUIRED` con `details.accion`). Verificado en vivo. 5 tests nuevos.

### 2026-10-20 · 📦919 · Las tres decisiones del owner (1.1, 1.2, 1.3)

1. **1.1 · el deber legal de conservación sin término (2.2.1.1.12)**: se declara **a nivel de EMPRESA** (no por documento), con un **hold legal automático** (actor `sistema`, motivo `deber_legal_<norma>`). "Nunca se purga SOLO". El Trabajador se entera en la mini-app y en el correo. Migración `030`.
2. **1.2 · la firma visual (PNG) se rechaza**: con un **400 explícito** que nombra la clave y la razón (`FIRMA_VISUAL_NO_ADMITIDA`), nunca en silencio.
3. **1.3 · el segundo canal (10.7(b))**: K+AIR recibe, registra y **trasmite** las solicitudes del Titular a la Empresa (que es quien responde), con un **segundo canal** distinto del de incidentes, historial **append-only** y un plazo de trasmisión por configuración. Migraciones `028` y `029`.

### 2026-10-20 · 📦918 · El 8B-C: el snapshot de la Empresa cifrado, y el endpoint que se colgaba

- **El snapshot de la Empresa cifrado** (`enc:v2`, con AAD), la huella corregida (solo las claves presentes) y la **verificación de la huella en la presentación, con fallo cerrado**. El backfill endurecido: deja el evento `CONSENT_SNAPSHOT_RECIFRADO` en la misma transacción.
- **Un bug real de operación:** `POST /internal/admin/empresas` **se colgaba** —el middleware de autenticación se usaba sin invocarlo— y el router no estaba montado en la app de pruebas, así que nadie lo había ejercitado. También se corrigió un `SELECT` después del `WHERE` en el `GET`.
- **El aislamiento de los tests:** el `.env` local ya no filtra la suite y `resetDb()` limpia el directorio de empresas y las tablas de solicitudes.

### 2026-10-20 · 📦917 · Fase 8B: el dato sensible, el `metadata` con lista blanca y el número del representante cifrado

**Los tres textos que mandan.** El 10.8 (aviso previo y consentimiento expreso para el dato sensible), la última frase del 10.2 ("este numeral no autoriza a la Empresa a enviar al servicio datos distintos de los aquí relacionados") y el 10.5(a) (el número del documento de identidad se conserva únicamente como huella, no en texto claro).

**Lo que estaba mal: tres hallazgos, uno por parte.**

1. **H19 · el 10.8 era incumplible porque no existía la mecánica.** Ni la API podía marcar un documento como sensible, ni la mini-app tenía aviso previo ni casilla separada: un acta de salud se firmaba con el mismo consentimiento genérico que un formato de asistencia.
2. **H20 y H21 · `metadata` era un canal libre.** JSON de hasta 8192 caracteres, archivado tal cual; y el esquema no era `.strict()`, así que un campo mal escrito pasaba como si estuviera bien.
3. **H23 · el número del representante legal quedaba en texto claro** en `representante_legal_snapshot`, mientras el del trabajador solo se guardaba como huella.

**Qué se implementó, en tres partes.**

**A. La lista blanca de `metadata` y el `.strict()` del esquema.**

- `src/services/metadata.js` (nuevo): `CLAVES_METADATA_PERMITIDAS` (`subtipo_identificacion`, `nombre_trabajador`, `nombre_empresa`, `correo_empresa`, `correo`) y `filtrarMetadata()`.
- `signRequestBody` y `representante_legal_snapshot` ahora son `.strict()`: lo desconocido se **rechaza con un 400 que nombra la clave**, no se pierde en silencio.
- El servicio vuelve a filtrar antes de escribir la fila: es el último punto y el que no se puede saltar por la vía del service.
- **Bug real que salió de esto:** la app mandaba `correo_empresa` desde hace meses, zod lo eliminaba en silencio, nunca llegó a la base y la constancia salió sin el canal de copia del 8.4. Hoy `correo_empresa` está declarado, se persiste y llega al PDF de la constancia.
- Trampa evitada: la app manda `correo_empresa: ''` siempre. El esquema acepta la cadena vacía; si no, **cada firma del site B caía en 400**.

**B. La mecánica del dato sensible (10.8).**

- Migración `027_datos_sensibles.sql`: `datos_sensibles`, `categorias_sensibles`, `finalidad_sensible`, `base_legal_sensible`, `aviso_sensible_texto/hash/version` en la fila de la firma, y la tabla `gh_consentimientos_sensibles` (sin FK contra la firma, para que sobreviva a la 5B).
- `src/services/sensibles.js` (nuevo): `TIPOS_SENSIBLES_INFERIDOS` (ACTA, CERTIFICADO, CONSENTIMIENTO, AUTORIZACION), `clasificar()` —**la Empresa sube la clasificación, nunca la baja**—, `construirAviso()` y `avisoDe()` (el texto y su huella quedan **fijados al crear**: si el aviso se compusiera en cada visita, un cambio de redacción cambiaría lo que el Titular "aceptó" sin que nadie lo notara).
- `publicFlow`: `exigirConsentimientoSensible()` bloquea `viewDocument` y `getPdfForToken` con `409 SENSIBLE_CONSENT_NOT_ACCEPTED`; `consentirDatoSensible()` registra también la NO autorización, con `via_alternativa: 'firma_en_papel'`.
- Mini-app: el aviso va **antes** del visor (si el documento se viera primero, la información "previa" no lo sería) y la casilla es **separada** de la del Acuerdo.
- Por qué el sistema no lee el PDF para saber si trae datos de salud: escanearlo sería tratar el dato sensible **antes** del consentimiento. La inferencia es por **tipo de documento**, y la Empresa puede corregir al alza.

**C. El número del representante: cifrar, no hashear.**

- El plan (§8.1) decía "hashear o seudonimizar"; el owner lo corrigió: el número del representante es **prueba de la representación** (puede necesitarse en una constancia o en un certificado de existencia y representación) y una huella no se puede presentar como prueba. **Se cifra.**
- `src/crypto/cifrado.js` (nuevo): AES-256-GCM con clave derivada por HKDF (`derivedKey('cifrado-representante', id_empresa)`, con la versión de llave del anillo). El sobre declara su formato y **con qué versión de llave se cifró**: `enc:v1:<version>:<iv>:<tag>:<cifrado>`. GCM es AEAD: un sobre alterado no se abre.
- `src/services/representante.js` (nuevo): el servicio del snapshot — cifra al guardar, abre cuando hace falta, enmascara para mostrar.
- **Lo que se muestra son los últimos 4** (`****3456`), como con el firmante. El número completo queda cifrado en la base y se abre con la llave, que vive fuera de ella.
- **Lo que NO cambia, y por qué:** el bloque «Empresa que solicita tu firma» del 1.2 muestra la identificación del representante legal **completa**, pero esa no viene del snapshot: viene del **registro mercantil** que la Empresa cargó en `gh_firma_empresas`. El 1.2 manda y no lo cambia el código.
- `scripts/recifrar-representante.js` (nuevo): las filas creadas antes de esta fase guardan el número en claro. El script los re-cifra en **simulación por defecto** (`--actor` y `--motivo` obligatorios, nada se escribe sin `--ejecutar`, verifica cifra -> descifra -> compara antes de escribir, y deja un evento `REPRESENTANTE_RECIFRADO` por fila).

**Cómo se validó.** 51 tests nuevos: 9 de la lista blanca (`tests/fase8b-metadata-lista-blanca.test.js`), 14 del dato sensible (`tests/fase8b-dato-sensible.test.js`), 22 del representante cifrado (`tests/fase8b-representante-cifrado.test.js`) y 6 del script (`tests/scripts/recifrar-representante.test.js`), con tests de mutación en los tres bloques. Suite completa: **1278 tests · 1276 verdes · 0 fallos · 2 omitidos**.

**Bugs encontrados que no estaban en el código.**

- El `correo_empresa` que se perdía en silencio (arriba).
- **La firma dual no habría funcionado:** el hijo (firma de la Empresa) se dispara al final del commit del trabajador, y para entonces el snapshot del padre ya está cifrado. Si la huella de identificación se calculara sobre el sobre, el representante **no podría identificarse** en la mini-app. El código descifra antes de calcular.
- Lo mismo con el seudónimo del consentimiento del representante: se calculaba sobre el número en claro; con el snapshot cifrado, se calcularía sobre el sobre y la fila guardaría la huella de un valor que no es el número de nadie.

**Lo que sigue.** La 10.4 (aceptación positiva de la versión nueva, el 9.5), la 9A (firma en papel, copia permanente y medios autorizados), y después la 11A con el abogado. Y dos **migraciones de datos** deliberadamente no aplicadas, que dependen de la Compuerta 0: purgar el `token_encrypted` de las filas anteriores a la 8C, y re-cifrar las filas heredadas del representante.

### 2026-10-19 · 📦916 · Fase 8C: la rotación del token — el enlace se emite, no se recupera

**El texto que manda.** El 3.6(e): el token de acceso "se conserva únicamente en forma de huella digital".

**Lo que estaba mal.** El código guardaba el token **cifrado** en `metadata._server_metadata.token_encrypted` y un endpoint interno (`GET /internal/sign-requests/:id/link`) lo devolvía **en texto claro**. Cifrado sigue siendo reversible con la llave: el token existía en la base en una forma que se podía recuperar. El 3.6(e) no se cumplía, y el endpoint que lo devolvía nunca estuvo documentado en API.md.

**Qué se implementó.**

1. `src/db/schema/026_tokens_rotacion.sql`: la tabla `gh_firma_tokens` — un registro por token emitido (la huella, la emisión, la expiración, la revocación y el origen). Con `ON DELETE CASCADE`: cuando la 5B borra la firma, sus tokens se van con ella.
2. `create()` y `createForCompany()` ya **no** guardan el token cifrado, y el sub-objeto `_server_metadata` desaparece del metadata del cliente.
3. `emitirToken()`: la rotación. Emite un token nuevo, guarda su HMAC-SHA-256 con clave secreta y devuelve el token **una sola vez**. Tope de **3 tokens vivos** por solicitud; al llegar al tope, `409 TOKEN_LIMIT_REACHED` — el sistema **no** revoca por su cuenta, porque revocar es una decisión de quien llama.
4. `POST /internal/sign-requests/:id/link/rotate`: el endpoint nuevo. `GET .../link` queda **deprecado** (`Deprecation`, `Sunset`, `Link` al successor) y solo sigue sirviendo para las solicitudes anteriores a la 8C, que conservan el token cifrado: un token ya emitido sigue siendo válido (vive como huella), lo que dejó de existir es la recuperación de su texto claro.
5. Los tokens anteriores **no se invalidan**: la rotación emite otro acceso al mismo plazo. Un enlace que el trabajador ya tiene en el teléfono no se le rompe a mitad de camino.
6. `notify-remote` acepta un `token` opcional: si viene, se usa ese enlace y no se gasta un cupo de rotación; si no, rota. Si el token es de otra solicitud, `409 TOKEN_MISMATCH`.
7. `resend-otp` interno ya no necesita recuperar el token: solo lo usaba para encontrar la solicitud que ya tenía por id. El núcleo del reenvío se separó (`resendOtpDeSignRequest`).
8. La 5B ahora cubre **todos** los tokens de la firma (columna `token_tombstones`): un enlace rotado responde "no disponible por vencimiento del plazo" (410), no un 404 que dependa de por dónde se entre.

**Cómo se validó.** 12 tests nuevos (`tests/fase8c-rotacion-token.test.js`): el token no queda guardado de forma recuperable (con un test de mutación que comprueba que el detector muerde), el registro de la huella, la emisión y el retorno una sola vez, el token anterior sigue funcionando, la auditoría (`LINK_ROTATED`), el tope de 3, la revocación explícita, la respuesta del endpoint deprecado, la 5B cubriendo el enlace rotado, el `TOKEN_MISMATCH` y el `notify-remote` sin cupo cuando el cliente trae su token. Suite completa: **1227 tests · 1225 verdes · 0 fallos · 2 omitidos**.

**Correcciones de paso.** El flujo de firma dual tomaba el token del metadata cifrado para invitar al representante; ahora usa el token que está en memoria en ese instante. Y los seis tests de los endpoints afectados se actualizaron porque su comportamiento cambió a propósito (no por una falla).

**Lo que sigue.** Queda pendiente la 8B (dato sensible y `metadata` con lista blanca), la 10.4, la 9A, y después la 11A con el abogado. Y queda una **migración de datos** deliberadamente no aplicada: purgar el `token_encrypted` de las filas anteriores a la 8C, que depende de la Compuerta 0 (si hay solicitudes en vuelo, borrarlas rompe a esos clientes).

### 2026-10-19 · 📦915 · Fase 8A.2: la 5B — la supresión de los datos vencidos

**El texto que manda.** El 10.6: "Vencido ese plazo y sin que exista un deber legal o
contractual de conservación, el dato se suprime conforme a la política de la Empresa."

**Lo que estaba mal.** La capa de conservación (migración 020) borraba el **registro de
auditoría** de las firmas vencidas. Eso destruye la prueba y conserva el dato: exactamente
al revés de lo que ordenan el 8.6 y el 10.6. El propio script de purga lo decía en voz
alta: "HASTA QUE EXISTA LA 5B, ESTA OPERACIÓN NO CUMPLE EL 8.6". La 8A.1 (📦914) ya no
afirmaba una vigencia falsa, pero tampoco suprimía: la capa de datos no existía.

**Qué se implementó.**

1. `src/services/supresion.js`: `simular()` (el modo por defecto; no borra nada) y
   `suprimir()` (actor, motivo, ventana y lote obligatorios). Suprime la fila completa
   de la firma y sus tres archivos (PDF original, PDF firmado y constancia), más las filas
   hijas que la llave foránea exige. **Archivos primero, base después**, en transacción:
   el archivo *es* el dato personal, y si la base falla después el reintento es seguro.
   Es idempotente.
2. `src/db/schema/024_purga_datos.sql`: la **lápida** (`gh_firma_purgadas`) — qué se
   suprimió, por qué, por quién y cuándo, sin datos personales — y la columna
   `id_solicitud` en la prueba de aceptación (el 12.7 la exige).
3. `src/db/schema/025_purga_datos_append_only.sql`: los triggers que hacen la lápida
   inalterable. Van en su propia migración con `-- @skip-when-env test`, **el mismo
   mecanismo que la 020**: la garantía se salta solo en el ambiente que la necesita (los
   tests limpian la tabla entre casos) y se prueba aparte contra el archivo real.
4. `src/crypto/token.js`: la lápida **no guarda la credencial**. Guarda
   `HMAC('tombstone-purga', token_hash)` — un hash de un hash, con propósito y llave
   derivados — que no permite autenticarse ni resolver nada. Solo permite responder
   "no disponible por vencimiento del plazo" (`410 CONSERVACION_VENCIDA`) en vez de un
   404 que no dice por qué.
5. `src/services/signRequest.js`: el `id_solicitud` se enlaza al crear la firma. El
   consentimiento se acepta **antes** de que exista la firma (así es en el flujo de la
   Empresa: crea el consentimiento, el trabajador lo acepta y después se emite el
   enlace), así que en la vía OTP no había ningún identificador que escribir. Sin eso, la
   prueba de la aceptación que sobrevive a la supresión quedaba incompleta para el 12.7.
6. `scripts/purga-ventana.js`: ofrece las dos capas y **simula por defecto**. El titular
   pasó de "PURGA DEL REGISTRO DE AUDITORÍA (8.6 / 10.6)" a "SUPRESIÓN DE DATOS
   VENCIDOS (10.6 · el 8.6 es comunicar el plazo)": el 8.6 es comunicar el plazo; el 10.6
   es conservarlo y suprimirlo.

**Lo que sobrevive, y lo que no.** La fila de la firma se borra entera: es la lectura
más fuerte del 10.6 y la única compatible con el esquema (el `CHECK` del estado
impediría inventar un estado nuevo sin rehacer la tabla). La consecuencia es que **el
evento de aceptación no puede sobrevivir** (llave foránea). Lo que sobrevive es la
**prueba de aceptación** en `gh_consentimientos_firma`, que no tiene llave foránea
contra la firma — y que es justo donde el 12.7 la sitúa.

**Cómo se validó.** 16 tests nuevos (`tests/fase8a2-supresion-datos.test.js`): la
simulación no borra nada; la supresión real borra la fila y los archivos; la
idempotencia; el gobierno (actor, motivo, ventana, lote); el hold legal; la lápida sin
credencial; la lápida sin datos personales; la lápida append-only (contra el archivo
real de la 025, en una base aislada, con un test de mutación que demuestra que sin el
trigger sí se podría alterar y borrar); el enlace suprimido responde `410`; y la prueba
de la aceptación con su identificador de solicitud. Suite completa: **1214 tests · 1212
verdes · 0 fallos · 2 omitidos**.

**Bugs encontrados de paso (en la suite, no en el servicio).** Los triggers de la 020 se
saltan en el ambiente de test, y los servicios de conservación y supresión dependen de
las tablas que ella crea. Antes esas tablas existían solo porque
`tests/conservacion-purga.test.js` las creaba en su `before`: un orden de archivos
distinto rompía la suite sin tocar el código de producción. La garantía se movió a
`tests/helpers.js` (`asegurarTablasPurga()`), que la ejecuta en cada `resetDb()`.

**Lo que sigue.** El código está; la operación no. La supresión es irreversible y no se
ejecuta contra producción hasta que la **Compuerta 0** esté en verde. Queda pendiente la
8C (rotación de tokens), la 8B (dato sensible y `metadata`), la 10.4, la 9A, y después
la 11A con el abogado.

### 2026-10-19 · 📦914 · Fase 8A.1: el vencimiento del plazo de conservación (numeral 10.6)

**El texto que manda.** El 10.6 dice: "Los plazos de conservación se determinan por
categoría de dato en la tabla de retención documental de la Empresa [...] Vencido ese
plazo y sin que exista un deber legal o contractual de conservación, el dato se
suprime conforme a la política de la Empresa."

**Lo que estaba mal.** La verificación pública resolvía el token con
`skipExpirationCheck`, una bandera que se saltaba TODAS las comprobaciones de
vencimiento. El efecto era invisible: vencido el plazo que declaró la empresa, el
sistema seguía respondiendo "firma registrada y documento íntegro", recalculaba el
SHA-256 del PDF en disco y pintaba el banner verde. Afirmaba una vigencia que ya no
existía, y todo ello mientras el propio script de purga decía en voz alta que la capa
de datos personales (la 5B) todavía no existía.

**Qué se implementó.**

1. `vencidaPorConservacion(fila)` en `src/services/conservacion.js`: pregunta de
   CONSULTA ("¿venció?"), distinta de `esElegible` (que pregunta "¿se puede borrar?").
   Mira el hold legal, porque el deber legal de conservación prima sobre el
   vencimiento del plazo.
2. `resolveToken` ya no tiene ninguna bandera que salte el vencimiento.
   `permitirHistorico` ignora SOLO la ventana para firmar (consultar lo que ya se
   firmó no puede depender de poder firmar) y NUNCA el plazo de conservación.
3. El estado nuevo es `410 CONSERVACION_VENCIDA` ("No disponible por vencimiento del
   plazo"), y aplica igual en `/verify`, en `/s/:token` y en `/verify-pdf`.
4. El 404 ya no confirma la existencia: la misma respuesta ("No disponible") para un
   token que nunca existió y para uno que ya no se puede mostrar.
5. La mini-app distingue los cuatro casos del enlace y NO ofrece verificación cuando
   el plazo venció: la verificación responde lo mismo, así que ofrecerla sería una
   promesa falsa.

**El detalle que importa: el hold legal prima.** Con deber legal de conservación (una
reclamación, un proceso judicial, un requerimiento de la SIC), el dato NO se suprime:
se conserva. En ese caso la evidencia sigue viva y la verificación debe seguir
confirmando la integridad. Decir "no disponible" sería falso, porque el documento está
ahí y además tiene que estar ahí. Hay un test que lo fija.

**Cómo se validó.** 11 tests nuevos (`tests/fase8a-vencimiento-verificacion.test.js`):
los cuatro estados del verify, el hold, la no-regresión, el 404 que no confirma, y dos
checks de que el backend no se salta el vencimiento. Se actualizaron dos tests
existentes por el cambio de copy: el del 404 del middleware y los checks del enlace
reabierto de la mini-app, que pasaron de 12 a 14 checks con dos mutaciones nuevas
(§7.2: un check que no muerde no es un check). Suite completa: **1198 tests · 1196
verdes · 0 fallos · 2 omitidos**.

**Lo que sigue.** Esta fase NO suprime nada: cambia lo que el sistema afirma. La
supresión real es la **8A.2 (la 5B)**, que es la parte irreversible y por eso lleva la
compuerta más estricta. Y queda comprobada una cosa antes de dar por buena esta fase:
que las migraciones 021 y 023 estén aplicadas en el entorno donde corra esto. Sin
`fecha_conservacion` calculada no hay vencimiento que comprobar, y el sistema no
inventa plazos (el 8.6 dice que el Acuerdo no los fija porque la ley no los fija).

**Aclaración sobre la compuerta 0.** Los 2 tests omitidos de la suite NO son de la
migración 020: son un test de rate limit (720 requests, lento) y uno de esquema zod.
El trigger append-only de la 020 sí tiene cobertura: `tests/conservacion-purga.test.js`
aplica el archivo real de la migración en una base en memoria aislada y ejercita las
cinco condiciones, incluido el hold. La 020 se salta en el entorno de test a
propósito (directiva `-- @skip-when-env test`) porque varios tests limpian la tabla
con DELETE; en staging se aplica de verdad y el trigger queda activo sobre la base
real.

### 2026-10-19 · 📦913 · Capítulo V: el deber de avisar a K+AIR y el deber de saber qué se firma

**El texto que manda.** El Capítulo V del Acuerdo de uso es el de los deberes del
Firmante, y se apoya en el artículo 2.2.2.47.6 del Decreto 1074 de 2015
("OBLIGACIONES DEL FIRMANTE"): mantener control y custodia de los datos de creación;
actuar con diligencia para evitar su utilización no autorizada; y dar aviso oportuno
a cualquier persona que posea, haya recibido o vaya a recibir documentos o mensajes
de datos firmados electrónicamente por el firmante, cuando sepa o sea previsible que
los datos quedaron en entredicho.

**Lo que estaba mal (dos cosas de código y dos de texto).**

El **5.1(c)** obliga al Firmante a "avisar de inmediato a la Empresa y a K+AIR"
cualquier situación que comprometa la seguridad de sus datos de creación. La mini-app
solo mostraba los canales de la **Empresa** (`canal_pqrs`, `canal_incidentes`:
`seguridad@empresa.co`). De K+AIR no había ni un canal en toda la pantalla: el deber
no era cumplible, y el trabajador que sospechara de que le comprometieron el OTP o el
enlace no tenía dónde reportarlo.

El **5.3** obliga a "firmar únicamente documentos cuyo contenido sea exacto, completo
y corresponda a lo que la Empresa le ha informado". El backend ya mandaba en el
contexto `tipo_identificacion` (CONTRATO, ACTA, CERTIFICADO...) e `id_documento` (la
referencia), pero **la mini-app nunca los pintaba**. El comentario del backend lo
afirmaba en contra de lo que el código hacía (`src/routes/public.js:135`: "La mini-app
lo muestra como contexto") y era falso. El Firmante firmaba sobre un PDF sin saber si
era el contrato que esperaba: exactamente lo que el 5.3 le exige verificar.

Del lado del texto, dos cosas van para el abogado **sin tocar el fixture**: el
preámbulo del 5.1 dice que a), b) y c) son los deberes del 47.6, y no lo son (el
literal a) no está en el artículo; el deber 2 del artículo —actuar con diligencia— no
tiene literal propio; y el deber 3 quedó reducido a "a la Empresa y a K+AIR",
perdiendo "cualquier persona que posea, haya recibido o vaya a recibir" el documento
firmado y los criterios de "en entredicho" del parágrafo). Y el 5.1(a) obliga al
Firmante a cumplir "las políticas de seguridad de la Empresa y de K+AIR", que el
Firmante nunca ve: un deber que no se puede conocer no es exigible.

**Qué se implementó.** El canal de incidentes de K+AIR vive en las dos capas: valor
por defecto en el HTML estático (`adminkair@gmail.com`, el mismo que publica el
Anexo de Encargo §9, datos de contacto del Encargado) para que exista también en la
pantalla de error, donde no hay contexto que lo traiga, y configurable por
`FIRMA_CANAL_INCIDENCIAS` en el contexto; un test exige que los dos no diverjan.
Aparece en un pie `<footer class="pie-kair">` **fuera de las pantallas**, para que
esté en todas, incluida la de error. Y el bloque `#documento-identidad` muestra, en
la pantalla del documento, qué se está firmando ("Estás firmando un contrato.
Referencia: ..."), con la categoría traducida a lenguaje llano.

**Y el Capítulo IV, que estaba dado por cerrado y no tenía registro.** Al verificar
las citas del Capítulo V se revisaron las del Capítulo IV, y dos de las cinco no
resisten el cotejo. El **4.3** (parágrafo 2 del 2.2.1.1.10 del Decreto 1072) y el
**4.5** (numeral 3 del 2.2.1.1.13) son **fieles**. El **4.2** es una paráfrasis: el
47.3 dice "incluido **cualquier acuerdo aplicable**" y el Acuerdo dice "incluido este
Acuerdo" (la sustancia no cambia: este Acuerdo es un acuerdo aplicable). El **4.1**
cita un artículo que el 47.5 no nombra: el oficial remite al **2.2.2.43.3**, y el
43.3 vigente es "PRESUPUESTO ANUAL" de las Cámaras de Comercio, o sea que **la
remisión del propio decreto está caduca**, heredada de la numeración anterior a la
compilación de 2015. El **4.4** tampoco es transcripción: el artículo 244 de la Ley
1564 ("DOCUMENTO AUTÉNTICO") presume auténticos los documentos públicos y privados
"mientras no hayan sido tachados de falso o desconocidos", y la frase "en forma de
mensaje de datos" es del 243. Hallazgo de fondo: **el Acuerdo no cita el 2.2.2.47.4
(CONFIABILIDAD)** en ningún punto, y es el artículo que trae los dos requisitos
materiales (los datos de creación son exclusivamente del firmante; se puede detectar
la alteración no autorizada del mensaje de datos), al que apuntan el 2.2.1.1.11 y el
parágrafo del 2.2.1.1.13.

**Cómo se validó.** Cuatro pruebas nuevas
(`tests/capitulo-v-deberes-firmante.test.js`): el markup y el cableado del pie y del
bloque de identidad, doce mutaciones que el evaluador tiene que detectar, la
no-divergencia entre el canal del HTML y el de la configuración, y el contexto HTTP
exponiendo `canal_incidentes_kair`, `tipo_identificacion` e `id_documento`. Suite
completa: **1185 tests · 1183 verdes · 0 fallos · 2 omitidos**. Barrido de caracteres
no latinos limpio y EOL y BOM sin cambios. **El barrido encontró una contaminación
preexistente en `LEGAL.md`**: una letra cirílica (U+043F, la "pe" cirílica) donde iba una
"n" dentro de la palabra "electrónica", en el §3.1, que venía de HEAD. Corregida, porque
el proyecto prohíbe cirílico en documentación.

**Lo que sigue.** El texto legal no se toca sin abogado: quedan las propuestas de
redacción del 5.1 (preámbulo y literal a) y las del 4.1, 4.2 y 4.4, en
`docs/gestion-humana/firma-electronica/auditoria-capitulo-v-acuerdo-uso-2026-10-19.md` y
`auditoria-capitulo-iv-citas-normativas-2026-10-19.md`. Si el abogado cambia el texto
hay que **publicar la v1.1**: el hash archivado en los consentimientos ya aceptados no
se toca. Queda una decisión de política del owner: si la API debe **rechazar** un
`correo_verificacion` cuyo dominio sea el de la Empresa (hoy el OTP va al buzón que
registra la Empresa, y si ese buzón es compartido la Empresa tiene los datos de
creación de la firma, lo que rompe el 5.1(b), el 5.2 y el 47.4) o si la regla queda
solo como onboarding. Y sigue pendiente la **5B** (datos personales) y el
comportamiento post-purga del enlace y del oráculo.

### 2026-10-19 · 📦912 · El orden (g)/(h) y el 5.4: el Firmante acepta el Acuerdo antes de ver el documento, y el enlace le entrega lo que firmó

**El texto que manda.** El Capítulo III del Acuerdo de uso pacta la secuencia del
proceso de firma:

> (g) Superada la verificación, el Trabajador lee en pantalla el presente Acuerdo,
> en la versión vigente, y lo acepta. [...] El Trabajador no puede avanzar en el
> flujo sin leer y aceptar el Acuerdo.
> (h) El Trabajador visualiza y descarga el documento objeto de la firma.

Y el 5.4 del Capítulo V: *"El Firmante puede imprimir o descargar copia de este
Acuerdo y del documento firmado desde el propio enlace de firma, sin costo
alguno."*

**Lo que estaba mal (dos cosas).**

La primera: el código no respetaba el orden. El documento se servía desde
`OTP_VERIFIED` — con el OTP verificado bastaba para pedir el PDF y para registrar
su visualización. La mini-app cargaba el visor de entrada y ponía la casilla del
Acuerdo en la misma pantalla: el Firmante veía el documento y la casilla a la
vez, y podía marcar las otras dos casillas y firmar sin haber aceptado nada.
Quedaba registrada una aceptación de Acuerdo sin que hubiera información previa,
que es justo lo que el (g) prohíbe.

La segunda: el 5.4 no tenía por dónde. El enlace entregaba el PDF **original** y,
después de firmar, no entregaba nada: el documento firmado solo se podía bajar
por el endpoint interno, que es de K+AIR, no del Firmante.

**Qué se implementó.**

El **backend** exige el Acuerdo aceptado antes de servir el documento y antes de
registrar su visualización (`publicFlow.exigirAcuerdoAceptado`), con las mismas
condiciones de empresa y versión que ya exigía el commit. La regla vive en el
servidor, no en la UI. El camino de error es **uno solo**
(`CONSENT_NOT_ACCEPTED`) para todos los casos en que falta la aceptación: el
Firmante solo necesita saber que tiene que leer y aceptar, y la respuesta no
expone ni el id ni el estado del consentimiento. El detalle fino
(`CONSENT_NOT_FOUND`, `CONSENT_WORKER_MISMATCH`, `CONSENT_COMPANY_MISMATCH`,
`CONSENT_VERSION_MISMATCH`) lo sigue dando el commit, donde el dato
inconsistente tiene que ser rastreable.

Del lado de la mini-app, el visor no carga hasta que la aceptación vuelve del
servidor, y aparece un aviso explícito ("Para ver el documento, primero lee y
acepta el Acuerdo de uso"). El contexto expone `acuerdo_aceptado`, para que
quien recargue la página no tenga que volver a aceptar lo que ya aceptó.

Y el 5.4: dos endpoints nuevos. `GET /api/sign/{token}/signed-document.pdf`
entrega el PDF **firmado**, y `GET /api/sign/{token}/acuerdo.txt` entrega el
**texto del Acuerdo** con su `SHA-256` en la cabecera `X-Acuerdo-SHA256`, para
que el Firmante pueda comprobar que la copia es la que aceptó. La pantalla final
ofrece los dos.

**La excepción está acotada.** El enlace es de un solo uso (3.4(c)) y estas
descargas **no reabren el flujo**: identificar, pedir OTP, aceptar el Acuerdo y
firmar siguen cerrados en estado firmado. Lo único que hacen es bajar lo que ya
está firmado, y solo mientras el enlace siga vigente (el TTL no se extiende).
**El token solo no sirve el PDF firmado antes de la identidad**: en cualquier
estado previo a la firma la respuesta es `409 SIGNED_DOCUMENT_NOT_AVAILABLE`.

**Dos defectos que salieron de probarlo en el navegador.**

El primero: el contexto JSON (`GET /s/:token` con `Accept: application/json`) no
llevaba `Cache-Control`, así que el navegador lo guardaba y al volver a abrir el
enlace entregaba **JSON crudo en vez de la mini-app**. Es el mismo síntoma que
corrigió I-LINK-REABIERTO para el enlace ya firmado, y se repetía cada vez que
el Firmante volvía al enlace. Ahora la respuesta lleva `no-store, no-cache,
must-revalidate, private`.

El segundo: `resolveToken` marcaba como `EXPIRED` una solicitud en estado
`DUAL_FIRMADO` (firma doble) que se abría después de su vencimiento. Un enlace
vencido no puede reescribir lo que ya se firmó: `DUAL_FIRMADO` quedó en la
lista de estados excluidos, igual que `SIGNED`.

**Cómo se validó.** Ocho pruebas nuevas
(`tests/fase6-orden-acuerdo-5-4.test.js`): el documento no se sirve ni se
registra su visualización sin aceptación; tras la aceptación sí; el error no
filtra datos internos; la mini-app sabe si el Acuerdo ya está aceptado; el
enlace entrega el documento firmado y no el original; la copia del Acuerdo
hashea al valor archivado; el token solo no sirve el PDF firmado antes de la
identidad; y el enlace firmado no reabre el flujo (firmar y pedir OTP dan
`410`). **Y en el navegador**, contra un servidor local con su propia base:
identificación → OTP → pantalla de documento **sin PDF y con el aviso** →
marcar el Acuerdo (la red muestra `consent/accept` y después `view-document`, y
**ninguna** petición al PDF antes) → el PDF carga → firmar → la pantalla final
con las dos descargas, que responden `200` con el PDF firmado (`%PDF-`,
`attachment`) y con el Acuerdo y su SHA-256.

**Lo que sigue.** La **5B** (datos personales: fila, PDF, constancia, oráculo,
verificador) y el comportamiento post-purga del enlace y del oráculo ("no
disponible por vencimiento del plazo", no "inválido"): el advisor lo asignó a la
5B o a la Fase 6, y la parte del enlace que depende de la supresión de los datos
es 5B. Del lado del texto: falta la v1.1 del Capítulo X del representante y del
bloque de manifestación, hay que mandar al abogado el Anexo §7 revisado contra la
Fase 5, y resolver la contradicción §4/§8 de los T&C.

### 2026-10-19 · 📦911 · La ventana de purga: el 3.6(g) y el 8.6 dejan de contradecirse

**El problema, en dos frases del Acuerdo que no pueden ser ciertas a la vez.**

El **3.6(g)**: *"El registro de auditoría de los eventos del proceso de firma,
que no puede ser alterado ni eliminado una vez registrado."*

El **8.6** y el **10.6**: *"Vencido ese plazo y sin que exista un deber legal o
contractual de conservación, el dato se suprime."*

Si la inalterabilidad es absoluta, el deber de supresión nunca se cumple. Si se
abre una excepción, la promesa del 3.6(g) es falsa. Y la base de datos, que
antes de esta fase **no tenía ninguna protección** sobre `gh_firma_eventos`
—cualquier `DELETE` escrito a mano pasaba desapercibido—, no cumplía ninguna
de las dos.

**La salida no es aflojar la garantía: es una ventana.** Cinco condiciones, y
las cinco las hace cumplir la **base de datos**, no el código de aplicación:

1. Hay una **ventana abierta**, con actor, motivo y fecha de cierre. Se vence
   sola, con tope de 4 horas: si el operador se cae a mitad del procedimiento,
   la ventana se cierra sin que nadie tenga que hacer nada.
2. La ventana **no está vencida**.
3. La firma está en el **lote** habilitado para esa ventana, y el lote solo se
   puede ampliar con la ventana abierta (trigger propio).
4. La firma **venció su plazo** (`fecha_conservacion` en el pasado). Sin plazo
   declarado no hay nada que suprimir.
5. La firma **no tiene deber legal de conservación** (`hold_legal = 0`).

Cada condición aborta con su propio mensaje, para que el operador sepa cuál
falló.

**El hold es la quinta condición, y la impone la base.** Si la comprobación
viviera en el script, bastaría un `UPDATE` manual para esquivarla. El hold lo
declara la **Empresa** (la Responsable del tratamiento) con **actor, motivo,
alcance y fecha**, y se libera con su propio actor y motivo; el historial queda
en `gh_firma_holds`. Es la forma operativa del "sin que exista un deber legal"
del 8.6: una reclamación, un proceso judicial, un requerimiento de la SIC, la
UGPP, el Ministerio de Trabajo, una ARL, una auditoría.

**Las otras dos condiciones del 8.6, y de quién es cada una.** El plazo lo declara la
**Empresa**, que es la Responsable del tratamiento; el 8.6 dice que "este
Acuerdo no fija un plazo propio porque la ley no lo fija", y K+AIR es el
Encargado: no puede inventar plazos. De ahí `plazo_retencion_dias`, en días
(el texto libre `plazo_retencion` de la migración 021 es el que se le
**muestra** al firmante, porque la tabla de retención puede fijar plazos
distintos por categoría de dato). **Sin plazo declarado no hay fecha de
conservación y nada se purga.** Y la retención indefinida tampoco es
cumplimiento: por eso el reporte lo marca como **alerta**, no como un no-op
silencioso, y cada firma de una Empresa sin plazo deja un log
`RETAIN_SIN_PLAZO`.

La fecha se **congela en el momento de crear la firma**, no después: el 8.6
habla del plazo "que le resulta aplicable" al firmante cuando se le pide la
firma, y que la Empresa cambie su política después no mueve lo ya firmado.

**El recibo: la prueba de cumplimiento.** Cada firma purgada deja una fila en
`gh_firma_purga_registro`: qué firma, qué empresa, cuándo, quién, por qué, en
qué ventana, qué categorías se suprimieron y que se comprobó el hold. **Sin
datos personales**: ni correo, ni huellas, ni manifestación, ni IP. El log de
ventanas y purgas (`gh_firma_purga_log`) también es append-only y registra el
conteo del chequeo de hold: si la supresión borrara su propio rastro, no
habría forma de demostrar qué se suprimió.

| Pieza | Qué hace |
|---|---|
| `020_eventos_append_only.sql` (enmendada) | Triggers append-only con la excepción de las cinco condiciones. Tablas de control, lote, log y recibo. Se puede enmendar porque **nunca se aplicó en ninguna base**. |
| `023_conservacion.sql` (nueva) | `fecha_conservacion`, `hold_legal`, `motivo_hold`, `hold_actor`, `hold_alcance`, `hold_fecha`, `hold_liberado_at` en la firma; `plazo_retencion_dias` en la empresa; tabla `gh_firma_holds`. |
| `src/services/conservacion.js` (nuevo) | Fecha, hold, reporte, ventana, lote, purga y recibo. |
| `scripts/reporte-vencimientos.js` (nuevo) | Los cuatro grupos: próximos, vencidos elegibles, vencidos en hold, sin plazo declarado (este último como **alerta**). No borra nada. |
| `scripts/purga-ventana.js` (nuevo) | Ejecutor. Sin `--ejecutar` simula; con `--ejecutar` exige `--actor` y `--motivo`. Avisa del alcance antes de hacer nada. |

**EL ALCANCE, CON TODAS LAS LETRAS.** Esto es la **purga del registro de
auditoría**, NO la purga completa. **No** suprime los datos personales de la
fila (correo, huellas, manifestación de voluntad) ni los archivos (PDF
original, PDF firmado, constancia): eso es la **capa 5B**, un paquete aparte. La
operación completa, en orden, es *chequeo de hold → datos personales → eventos
de auditoría → registro de purga*. Ejecutar solo esta capa deja el estado
**inverso** al deseable: se destruye la prueba y se conservan los datos. **Hasta
que exista la 5B, esta capa no puede presentarse como cumplimiento del 8.6**,
y por eso el script lo dice en voz alta antes de hacer nada.

**Números** — `1173 tests · 1171 verdes · 0 fallos · 2 omitidos`. Los 30 tests
de `tests/conservacion-purga.test.js` prueban el trigger **contra el archivo
real de la migración**, en una base de datos aislada: los triggers se quitan de
la base compartida de tests, porque otros archivos borran eventos entre casos y
abortarían. El 020 **no se prueba en la base compartida** (lleva
`-- @skip-when-env test`): esa es una brecha de cobertura deliberada, y
compensada en CI por el test aislado y en staging por la migración aplicada de
verdad.

**Lo que sigue** — La **Fase 6** (orden (g)/(h) y 5.4) se implemento el 19: ver
📦912. Y la **5B** (datos personales) antes de operar la ventana como
cumplimiento del 8.6.

### 2026-10-19 · 📦910 · Los últimos cuatro dígitos: en memoria, y nunca en la base

**Por qué** — El firmante necesita poder confirmar de un vistazo que el documento que está
firmando es el suyo. La constancia le mostraba la referencia opaca (los primeros caracteres de la
huella), que no le dice nada. La solución obvious —guardar los últimos cuatro dígitos del documento—
choca de frente con el **10.5(a)**: *"del número de documento de identidad del Trabajador se conserva
únicamente esa huella, no el número en texto claro"*. Cuatro dígitos **son** un dato identificable, y
un truncamiento restringe el espacio de búsqueda de 10.000 millones a 10.000.

**El arreglo: el dato viaja en memoria, no vive en la base.** El trabajador escribe su documento
(el servicio lo recibe en claro y lo descarta de inmediato), el servicio aparta **cuatro** dígitos en
un mapa de proceso, y al firmar los usa para la constancia. Después se descartan. No hay columna, no
hay respaldo, no hay consulta posible: no es una base de datos paralela, es un área de trabajo.

| Pieza | Qué hace |
|---|---|
| `src/services/ultimos4.js` | Mapa en memoria `firmaId → {digitos, tipo, expira}`. TTL de 6 h (cubre leer el Acuerdo, ver el documento y leer la constancia), tope de 5.000 entradas, el más antiguo se descarta. `guardar/obtener/olvidar/limpiar`. **No requiere la base de datos**: eso es lo que garantiza que no hay por dónde se escape a la persistencia. |
| `identify()` | Tras la verificación exitosa, aparta los dígitos. Un intento fallido **no** aparta nada. |
| `commit()` | Pasa `identificacion_ultimos4` en la metadata de la constancia. |
| `pdfGen.js` | Campo *"Documento (últimos 4 dígitos)"* + la leyenda que explica que no se almacenan. |
| `pdfGenConsolidado.js` | **No** los lleva: se genera después, desde la base, donde no están. Es la consecuencia asumida de no persistirlos, no un defecto. |

**Degradación, no rotura.** Si el proceso se reinicia entre identificarse y firmar, el mapa se pierde
y la constancia sale con la referencia opaca, que es el comportamiento de siempre. `identify()`
admite la re-identificación hasta el estado `DOCUMENT_VIEWED`, así que volver a escribir el documento
vuelve a dejar los dígitos disponibles. La firma nunca depende de ellos.

**Lo que salió de validar la fase** (esto costó más que la fase):

1. **Un lector de PDF roto en el arnés.** `pdfText()` en `tests/helpers.js` tomaba el hex con la
   coincidencia entera y le quitaba los ángulos con un `replace` que no los quitaba: la clase de
   caracteres solo come un carácter por vez, y `<` no va seguido de `Tj`. El hex quedaba desalineado
   un byte y **todo** el texto salía como basura. Los tests de la constancia fallaban por un motivo que
   no tenía que ver con lo que probaban. Corregido tomándolo con el grupo capturado.
2. **Una constante equivocada en el test.** El documento de prueba era `1234567890` y se esperaba
   `4789`; los últimos cuatro de ese número son `7890`. El código estaba bien, el test mentía.
3. **Un fallo intermitente de la suite, de causa sistémica.** La suite falló una vez con un test
   (`pdfValidation §2.3`) que en aislamiento pasaba 40 de 40. La causa: **ocho archivos de test
   parcheaban `process.stdout.write` a nivel de proceso** para capturar el log. El runner de pruebas
   escribe su reporte TAP por ese mismo stream: si una línea TAP caía dentro de la ventana de captura,
   se perdía, y el runner desalineaba los resultados. Un test no debe robarle la salida al runner.
   **Arreglo:** el logger ahora tiene un *sink* (`_setSink/_resetSink`) que entrega la línea ya
   serializada a quien la pida, sin tocar los streams. Los ocho archivos migrados. Cero parches de
   stdout quedan en el arnés.
4. **pdf-lib mete la hora en el PDF.** `PDFDocument.create()` escribe `/CreationDate` y
   `/ModDate` con el momento actual, así que "el mismo PDF" tiene bytes distintos cada segundo (y
   hasta cambia de tamaño, 576 o 577 bytes). Como el *fingerprint* de idempotencia incluye el
   `pdf_sha256` que calcula el servidor, dos peticiones que el test cree "con el mismo body" y
   caen en segundos distintos se ven como bodies distintos: la segunda recibía **409
   IDEMPOTENCY_KEY_CONFLICT** en vez del REPLAY. Pasaba en ~3% de las corridas, y solo cuando las
   dos peticiones cruzaban la frontera de segundo. **Arreglo:** fecha fija en el PDF de prueba
   (`setCreationDate` / `setModificationDate`), para que sea byte-estable y "mismo body" signifique
   lo mismo que significa. Verificado con 40 corridas seguidas del archivo: 0 fallos (antes fallaba
   ~1 de cada 25).

**Números** — `1143 tests · 1141 verdes · 0 fallos · 2 omitidos` (los 2 omitidos son la migración
020, saltada a propósito en test). **Tres corridas completas seguidas, idénticas**: el rojo
intermitente no volvió. Barrido de caracteres no latinos limpio en los 61 archivos del diff. EOL y BOM
de cada archivo modificado comparados byte a byte contra el blob de HEAD: **ninguno cambió**.

**Lo que sigue** — Fase 5: la ventana de purga privilegiada en el trigger 020 (la 020 nunca se aplicó
en ninguna base, así que se puede enmendar sin DROP/CREATE), fecha de conservación calculada con el
plazo que declara la Empresa, `hold_legal` que bloquea siempre, y el reporte de vencimientos. La base
textual está en el **8.6** y el **10.6**: *"Vencido ese plazo y sin que exista un deber legal o
contractual de conservación, el dato se suprime."* Son dos condiciones, no una.

### 2026-10-19 · 📦909 · Los 47 fallos de la línea base: dos causas raíz, cero rojos

**Por qué** — La línea base de la suite eran 47 fallos que nadie había mirado. "Ya estaban" no es lo
mismo que "está sano": una casa con 47 bombillos fundidos, y nadie sabe cuáles son de adorno y
cuáles están en la puerta de la bodega. Este paquete los clasifica, los arregla, y deja la base
en **cero**.

**El hallazgo de fondo: no eran 47 problemas, eran 2.**

| # | Causa raíz | Tests | Error literal (los 47) |
|---|---|---|---|
| 1 | El arnés de tests pedía el mensaje para personas y no lo solicitaba | 44 | `Cannot read properties of undefined (reading 'code')` |
| 2 | Las validaciones de consentimiento comparaban al trabajador antes que a la empresa, y el test del caso 4 esperaba la cédula donde hoy hay un seudónimo | 3 | el mismo, más dos asserts con el valor viejo |

**Causa raíz 1 — la negociación de contenido.** `src/middleware/errors.js` sirve el error como
**página HTML** en la superficie pública (`/s/*`, `/api/sign/*`) cuando el cliente no pide JSON. La
decisión usaba `req.accepts(['html', 'json'])`, y el ORDEN de esa lista decide: Express devuelve el
primer tipo de la lista que el cliente acepte, desempatando por el orden cuando las calidades son
iguales. Con `html` primero, un `Accept: */*` —lo que mandan `curl` y `fetch` por defecto— se
llevaba HTML. Los tests usaban supertest sin header, recibían una página, `res.body` quedaba `{}` y
la aserción reventaba antes de comparar nada: no estaban probando el contrato que ve el
integrador, estaban probando que un objeto vacío no tiene la propiedad.

Tres arreglos:

- **Producción**: `prefersHtml` ahora resuelve `req.accepts(['json', 'html']) === 'html'`. El
  navegador manda `text/html` con q=1 y sigue recibiendo la página; el comodín y la ausencia de
  header dan JSON; el que pide JSON explícito recibe JSON. Comprobado con una sonda: sin header →
  JSON, `*/*` → JSON, `application/json` → JSON, navegador → HTML.
- **El arnés**: `tests/setup.js` pone `Accept: application/json` por defecto en supertest, en un
  solo lugar, en vez de 44 `.set()` dispersos que se olvidan. Los tests que quieren la página
  mandan su propio header.
- **Las aserciones**: 62 sitios que afirmaban `res.body.error.code` ahora pasan por el helper
  `assertJsonError`, que además **afirma el content-type**. Un test que afirma el sobre sin
  afirmar el tipo puede pasar por el motivo equivocado; y si mañana se rompe la negociación, el
  test falla diciendo la verdad.

**Causa raíz 2 — el orden de las validaciones.** `src/services/consent.js` comparaba **trabajador
antes que empresa**, y eso era peor de lo que parecía:

- El seudónimo del trabajador se deriva con el **ámbito de la empresa** (migración 022). El
  seudónimo de un consentimiento de la empresa AAA y el de un sign request de la empresa BBB son
  valores de **espacios de nombres distintos**: nunca coinciden, ni siendo la misma persona.
  Comparar trabajadores antes de confirmar la empresa es comparar dos marcas que no significan lo
  mismo, y hace que `CONSENT_COMPANY_MISMATCH` fuera **inalcanzable** para el caso que dice
  describir.
- Y en ese orden la respuesta era un **oráculo**: el chequeo de trabajador se resolvía con el
  seudónimo del sign request (ámbito de SU empresa), de modo que una fila heredada que guardaba el
  documento crudo pasaba ese chequeo y el de empresa corría después. La diferencia entre
  `CONSENT_WORKER_MISMATCH` y `CONSENT_COMPANY_MISMATCH` le decía a la empresa que llama si aquel
  `consent_id` era de **su** trabajador en otra empresa: un enlace entre empresas, que es
  exactamente lo que el ámbito del seudónimo existe para impedir.

Se invirtió el orden en los dos sitios (`accept()` y `validateForCommit()`), y con él la razón
quedó escrita en el código, que es donde se lee.

**El aviso público ya no lleva los identificadores de la contraparte.** `validateForCommit()`
metía en el `details` del error el seudónimo del trabajador del consentimiento, el del trabajador
de la solicitud y los NIT de las dos empresas. Esos identificadores no los usa **ningún** cliente
(0 coincidencias en la app y en la mini-app): solo los afirmaba el propio test. El camino de error
también es tratamiento de datos, así que ahora van al **log del servidor** y el error público
lleva solo el código y el `consent_id` que el llamador ya mandó. El test del caso 4 se actualizó
para afirmar el código y la **ausencia** del documento en claro, en vez de "bendecir" la
exposición.

**Resultado**: **1124 tests · 1122 verdes · 0 fallos · 2 omitidos**. Los 47 son historia. La base
de referencia era 47; ahora es 0.

**Lo que NO se hizo, y por qué (queda propuesto)**

- **Validar el consentimiento al CREAR el sign request** (`signRequest.js:622` inserta el
  `consent_id` sin validarlo; hoy la validación es solo en `commit()`, por decisión documentada).
  Es el corte de raíz del oráculo y el cliente no se rompe: K+AIR crea primero el consentimiento
  y después la solicitud (`modules/gestion-humana/firma-electronica/index.js:2473` y `:2509`). No
  se aplicó porque cambiaría el contrato de `POST /internal/sign-requests` (un `consent_id` ajeno
  pasaría a fallar en la creación, no en el commit) y obligaría a reescribir **6 escenarios** del
  bloque E6, que es justamente el bloque que existe para probar la validación en commit.
- **404 silencioso cross-company para el consentimiento** (en vez de `CONSENT_COMPANY_MISMATCH`).
  Cerraría también el bit de "este id existe en alguna empresa", pero cambia un código de error
  documentado en `API.md`. Con el swap, ese bit es lo único que queda: la respuesta ya no
  depende del trabajador.

**Tests** — `tests/middleware/errors.test.js` + 5 (contrato de negociación: comodín, sin header y
el ancla de mutación). Suite: **1124 · 1122 verdes · 0 fallos · 2 omitidos**. EOL y BOM verificados
contra el blob de HEAD archivo por archivo (el BOM de `public.test.js` es **preexistente**, y se
restauró el CRLF que la inserción automática había dejado MIXTO). Barrido de caracteres no latinos
limpio en los 58 archivos con cambios.

**Commits** — **ninguno todavía.** Falta el "dale" del owner (commit) y el "pushea" (push de `Dev`
y de `gh-pages`, que tiene el commit local `9722537f` sin pushear).

### 2026-10-19 · 📦908 · El oráculo de verificación: la Empresa pregunta sin apartar el documento

**Por qué** — El abogado pidió un **canal de verificación** para que la Empresa pueda confirmar que
el documento de identidad que registró es el mismo con el que firmó el trabajador, y lo pidió con
cinco condiciones: **booleano puro**, **API key por empresa**, **rate limit**, **log sin la cédula
en claro** y **respuesta en tiempo constante**.

El problema de fondo: esa pregunta, contestada por email, se resolvía **apartando el documento en
claro** — se lo mandaba al trabajador por correo, se lo pedía por teléfono, o se lo escribía en un
formulario. Ese número terminaba en buzones, en chats y en cuadernos. Y si no se lo apartaba, la
Empresa no podía cumplir el 3.4(d) del Acuerdo (comparar "mediante una comparación de huellas
digitales con sal" la información registrada por la Empresa con la del firmante).

El oráculo resuelve las dos cosas a la vez: la Empresa **no aparta el documento**. Se lo manda al
servicio, que ya tiene la huella archivada, y recibe un sí o un no.

**Qué se hizo**

| Paquete | Qué |
|---|---|
| `src/services/verificacion.js` | La lógica: derivación de candidatos, comparación en tiempo constante, fingerprint de anomalía. |
| `src/routes/verificacion.js` | `POST /internal/verificacion-identidad`. Auth per-empresa, validación estricta del body, 404 silencioso, evento de auditoría. |
| `src/middleware/rateLimit.js` | `oracleLimiter`: 60/h por empresa + 10/min por empresa. |
| `src/server.js` · `tests/helpers.js` | Montaje del router. |
| `src/schemas/admin-clientes.js` | La operación `verificacion:identidad` entra al enum: un cliente que no la tiene recibe 403 sin poder intentarlo. |
| `docs/.../API.md` | Sección 6.12 nueva, y los límites del oráculo en la tabla de rate limiting. |

**Las cinco condiciones del abogado, y cómo se cumplen**

1. **Booleano puro.** La respuesta es `{ ok, id_solicitud, coincide }`. Ni la huella, ni el estado
   de la firma, ni las fechas, ni el nombre. Un canal que devuelve más de lo que pregunta es un
   canal de fuga.
2. **API key por empresa.** `requireEmpresaScopeAndLimit` con la operación `verificacion:identidad`.
   El modo legacy (llave global, sin empresa) se rechaza con `403 EMPRESA_SCOPE_REQUIRED`: sin
   empresa no hay ámbito con el que derivar la huella, y un 404 mentiria.
3. **Rate limit.** El genérico de `/internal/*` es de 720/h por empresa, demasiado generoso para un
   canal que devuelve sí/no sobre documentos. El oráculo tiene el suyo: 60/h y 10/min.
4. **Log sin la cédula en claro.** El log lleva un **fingerprint**: un HMAC del documento con un
   propósito propio, recortado a 16 hex. Permite detectar anomalías (alguien usando el oráculo como
   oráculo de documentos) sin poder recuperar el número. El documento no se persiste en ninguna
   parte: ni en la base, ni en el evento, ni en el log.
5. **Tiempo constante.** La comparación recorre **todos** los candidatos sin salir en la primera
   coincidencia, y el trabajo criptográfico se hace igual cuando la firma no existe. Un test
   intercepta `constantTimeEqual` y cuenta las comparaciones: son las mismas coincida o no.

**El 404 silencioso.** La consulta va filtrada por `id_empresa`, así que una firma de otra empresa
no aparece: mismo 404, mismo cuerpo y mismo status que una que no existe. El test compara los dos
cuerpos (normalizando el eco del id) y además verifica que el 404 no menciona el documento, ni la
empresa dueña de la firma, ni ninguna palabra que delate que la fila existe.

**Decisiones que se tomaron sin consultar (y por qué)**

- **El oráculo deja un evento `IDENTIDAD_VERIFICADA`** en el registro append-only, con el resultado
  y el fingerprint, y **sin el documento**. Sin eso, la Empresa no podría demostrar que consultó, y
  el canal quedaría sin rastro auditable.
- **El fingerprint va en el log y en el evento, pero el documento en ninguno de los dos.** El
  fingerprint es un HMAC con la llave maestra (que vive fuera de la base): no es reversible, pero sí
  permite correlacionar "se consultó el mismo documento dos veces".
- **El tipo de documento también se compara**, aparte de la huella: la huella cubre el NÚMERO, y un
  CC y una CE con el mismo número darían la misma huella. Si la fila no tiene tipo registrado
  (fila heredada), no se impone ninguna restricción: no se puede afirmar una diferencia que el
  registro no contiene.
- **El oráculo no reescribe la fila**, ni siquiera cuando la fila usa un formato heredado. Es una
  consulta, no una migración.

**Tests** — `tests/verificacion-oraculo.test.js` (13, nuevo). Suite completa: **1119 tests · 1070
verdes · 47 fallos = línea base exacta · 0 regresiones**. Barrido de caracteres no latinos limpio en
los 46 archivos tocados; EOL y BOM verificados (LF, sin BOM).

**Pendiente de despliegue** — la operación `verificacion:identidad` hay que **otorgarla** a la
API key de cada empresa que la vaya a usar (`POST /internal/admin/clientes`); sin eso, el endpoint
responde 403. Y el anillo de llaves (📦907) sigue sin activarse en producción: requiere
`FIRMA_HMAC_KEYRING` y `FIRMA_HMAC_KEY_VERSION` en `/opt/kair-firma/.env`, y **no hay acceso SSH
desde esta máquina**.

**Commits** — **ninguno todavía.** Falta el "dale" del owner (commit) y el "pushea" (push de `Dev`
y de `gh-pages`, que tiene el commit local `9722537f` sin pushear).

### 2026-10-19 · 📦907 · La llave deja de ser única: clave por empresa, versión por fila y anillo

**Por qué** — El abogado pidió dos cosas: que la clave HMAC fuera **por empresa** (para que una
empresa no pueda enlazar al mismo trabajador de otra) y que **rotarla no invalidara la evidencia
anterior**. La versión de 📦906 tenía una llave global y sin versión: las huellas no decían con qué
llave se habían hecho, y rotar la llave mataba el 100 % de las firmas previas.

**Qué se hizo**

| Paquete | Qué |
|---|---|
| `src/crypto/keys.js` | **Anillo de llaves**: `FIRMA_HMAC_KEYRING='{"k1":"<hex>","k2":"<hex>"}'` + `FIRMA_HMAC_KEY_VERSION`. Sin ellas, el anillo es `{"k1": TOKEN_ENCRYPTION_KEY}` y el comportamiento no cambia. `getKeyRing()`, `listKeyVersions()`, `getKeyMaterial(v)`. |
| `src/crypto/hmac.js` | `info = kair-firma/v2/<versión>/<ámbito>/<propósito>`. Marcador **`hmac-sha256.v2.k1`** (formato + versión). `hmacHexEnVersiones()` prueba todo el anillo. Se conservan el formato v1 (`hmacV1Hex`) y el pre-hash heredado, para que **ninguna fila quede sin poder verificar**. |
| `src/crypto/otp.js` · `src/crypto/token.js` | OTP con **ámbito de empresa**; el token se queda **global** (es la credencial con la que se resuelve la solicitud). `tokenHashCandidates()` prueba anillo + v1 + sha256. |
| `src/services/trabajador.js` · `src/services/identificacion.js` | Seudónimo y huella con **ámbito = empresa**; `candidatosHuella()` prueba todas las versiones; `verificar()` **reescribe** la fila heredada al formato vigente. |
| `src/db/schema/022_clave_por_empresa.sql` | `correo_alg` en las dos tablas + `identificacion_aceptante_alg` en consentimientos. |
| Servicios | `id_empresa` propagado a `signRequest.create`/`createForCompany`/`list`, `consent.create`/`ensureRepConsent`/`getExisting`/`verifyOtp`, `publicFlow.identify`/`verifyOtp`/`resendOtp`/`resolveToken` y los dos lookups duales, `routes/constancia.js`. |

**Bugs encontrados que NO estaban en el código** (los cazó la suite, no la lectura)

- **La BÚSQUEDA solo probaba la versión vigente.** La verificación probaba el anillo entero, pero
  `candidatosBusqueda()` calculaba el seudónimo únicamente con la llave vigente. El efecto era
  silencioso y grave: **en el momento de rotar la llave, las filas calculadas con la versión
  anterior se volvían invisibles** — no fallaba la verificación, fallaba el
  `SELECT ... WHERE id_trabajador IN (...)` — y las firmas en curso quedaban varadas sin que ningún
  error lo explicara. Ahora `candidatosBusqueda()` y `mismoTrabajador()` calculan el seudónimo con
  **cada versión del anillo**.
- **`resendOtp` escribía el marcador viejo**: guardaba `otp_alg = 'hmac-sha256'` (formato v1) sobre
  un valor que era el HMAC v2. El marcador mentía sobre el formato.
- **`correo_hash` era un SHA-256 con la sal en la misma tabla**, y la migración 022 declaraba
  `correo_alg` sin que nadie lo escribiera. Con la sal en la fila, el atacante tiene (sal, hash) y
  puede probar candidatos: el espacio de correos es pequeño. Ahora es HMAC con ámbito, y la
  columna se escribe.
- **El marcador mentía cuando el valor ya era un seudónimo.** `valorParaGuardar()` deja `alg` en
  NULL en ese caso, en vez de afirmar la versión vigente: una fila con el marcador equivocado
  manda a reponer una llave que no es la que hace falta.
- **`routes/constancia.js` buscaba el seudónimo sin ámbito.** Con el ámbito por empresa, esa
  búsqueda ya no podía encontrar nada. Ahora usa el ámbito de la API key en modo cliente, y el de
  todas las empresas con firmas en modo legacy.
- **Tres tests se quedaron atrás del cambio de contrato**: derivaban el seudónimo sin empresa y
  afirmaban el marcador v1.

**Decisiones del owner** — *"creo que puedes proceder de esta forma que opinas"*: se ejecuta el
carril de código en el orden acordado (clave por empresa → representante → oráculo → últimos 4 →
purga → 5.4 y orden (g)/(h)). Invertirlo haría nacer el oráculo inválido.

**Tests** — `tests/anillo-llaves.test.js` (8, nuevo) · `tests/hmac-identificacion.test.js` (19,
reescrito al API con ámbito). Suite completa: **1106 tests · 1057 verdes · 47 fallos = línea base
exacta · 0 regresiones**. La línea base se midió otra vez en el worktree `%TEMP%\kair-baseline`
(**1054 tests · 1005 verdes · 47 fallos**) y la lista de fallos coincide **una por una**. Barrido de
caracteres no latinos limpio en los 40 archivos tocados; EOL y BOM verificados — el BOM de
`publicFlow.js` es **preexistente** (el blob de HEAD empieza igual, `EF BB BF`).

**Pendiente de despliegue** — el anillo solo se activa si se definen `FIRMA_HMAC_KEYRING` y
`FIRMA_HMAC_KEY_VERSION` en `/opt/kair-firma/.env`. Sin eso el comportamiento es el de siempre (una
sola versión) y todo sigue funcionando, pero la rotación sigue siendo una operación que invalida la
evidencia. **No hay acceso SSH desde esta máquina** para aplicarlo.

**Commits** — **ninguno todavía.** Falta el "dale" del owner (commit) y el "pushea" (push de `Dev`
y de `gh-pages`, que tiene el commit local `9722537f` sin pushear).

---

### 2026-10-19 · 📦906 · Auditoría del Capítulo III: el diagnóstico estaba mal y la implementación, peor

**Por qué** — El owner encendió el servidor y autorizó: *"puedes proceder con las acciones del plan
para resolver los hallazgos, recuerda siempre validar y contrastar después de cada acción
realizada"*. El objeto era cerrar los hallazgos del Capítulo III **antes** de que firme un
trabajador de una empresa real.

**El hallazgo de fondo: el diagnóstico que estaba escrito era FALSO.** El plan y este archivo
afirmaban que *"el texto promete HMAC-SHA256 con clave secreta en 3.4(d), 3.4(e) y 3.6(e)"*.
Verificado contra el texto: **el texto nunca lo dijo**. Siempre dijo **«huella digital con sal»**
(3.4(d), 3.4(e), 3.6(e) y 10.5(a)-(b)), y `grep -r hmac` da **cero** en todo el `firma-service`.
La redacción del Capítulo III es correcta y **no se toca**: sus tres citas legales son exactas.
Lo que estaba mal era la implementación, y era peor de lo que decía el plan:

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| 1 | La **cédula se guardaba en texto claro** en `gh_firmas_electronicas.id_trabajador` y en el JSON de `metadata` (contra el 10.5(a)) | P0 | **Corregido** |
| 2 | Huella de identificación con **la sal en la misma fila** → equivale a un hash plano | P0 | **Corregido** |
| 3 | **OTP con la sal en la misma tabla** → 10⁶ instantáneo | P0 | **Corregido** |
| 4 | Token de acceso sin sal (incumple la letra del 3.6(e); riesgo nulo por entropía) | P1 | **Corregido** |
| 5 | `gh_firma_eventos` sin triggers: el 3.6(g) promete inalterabilidad y la BD no la cumplía | P1 | **Corregido** |
| 6 | La consola rotulaba *"vence en 24 horas"* con `tipo_firma: 'remoto'` (el servidor calcula 72 h) | P1 | **Corregido** |
| 7 | El Anexo de Encargo permite borrar al desinstalar (choca con el 3.8 y el 8.6/8.7) | P1 | **Abierto: necesita abogado** |
| 8 | 8.6/10.6 (comunicar el plazo de retención) sin implementar | P2 | **Corregido** |
| 9 | El orden (g)/(h) no se respeta (`viewDocument` permitido en `OTP_VERIFIED`) | P3 | **Abierto, anotado** |

**Qué se hizo**

| Paquete | Qué |
|---|---|
| `src/crypto/keys.js` | Llave maestra **única**: `TOKEN_ENCRYPTION_KEY`, derivada por HKDF con un propósito por dato (`identificacion`, `otp`, `token`, `trabajador`, `correo`). En dev persiste en `data/.dev-master-key` (0600). Sin dependencia de `config`/`logger` al importar. |
| `src/crypto/hmac.js` | HMAC-SHA256 con HKDF, `info = kair-firma/v1/<propósito>`. |
| `src/services/trabajador.js` | Seudónimo de `id_trabajador` con marcador **`psn1_`**, idempotente. `mismoTrabajador()` compara seudónimo contra documento crudo. |
| `src/services/identificacion.js` | `preHash`/`huella`/`verificar` + `enmascarar()` (la máscara `CC ce3a59…` que ya usaba el sitio). |
| `src/db/schema/019` | Columnas de algoritmo: `identificacion_numero_alg`, `otp_alg`, `id_trabajador_alg`. |
| `src/db/schema/020` | `gh_firma_eventos` **append-only**: triggers `BEFORE UPDATE/DELETE` → `RAISE(ABORT)`. Se salta en test con `@skip-when-env test` y **no** se registra como aplicada. |
| `src/db/schema/021` | `plazo_retencion` y `canal_solicitud_copia` en `gh_firma_empresas` (8.6/10.6). |
| Servicios | `signRequest`, `publicFlow`, `consent`, `constancia`: huella HMAC, OTP y token HMAC, seudónimo en lugar de cédula, **búsqueda dual** `[seudónimo, crudo]` para alcanzar las filas heredadas, y **reescritura automática** de la fila heredada con el HMAC la primera vez que se usa. |
| Artefactos | La constancia y el PDF firmado ya **no muestran un seudónimo como si fuera un nombre ni sacan "dígitos" de un hex**: la referencia legible es la huella enmascarada, la misma convención del sitio. |
| Cliente | Se quitó `ttl_horas: 24` y el rótulo se arma con la `fecha_expiracion` que devuelve el servidor. |
| 8.6/10.6 | La Empresa declara su plazo de conservación y su canal de copia; se archivan en el **snapshot** (con su huella), se muestran en el bloque «Empresa que solicita tu firma» de la mini-app, salen en el **correo de invitación** (que es la comunicación previa a la firma) y quedan en la constancia. Si la Empresa no lo declara, el sistema **no inventa un plazo**. |

**Bugs encontrados que NO estaban en el código** (los cazó la suite, no la lectura)

- **`ensureRepConsent` guardaba un HMAC de un HMAC.** El consentimiento del representante se
  crea con `signRequest.id_trabajador`, que ya es el seudónimo; si `pseudonimo()` no fuera
  idempotente, la fila del rep quedaba con un valor que no coincidía con el del trabajador y
  el commit fallaba con `CONSENT_WORKER_MISMATCH`. **Por eso el seudónimo lleva el marcador
  `psn1_`**: hace la función idempotente y deja la base auto-explicativa.
- **Un `?` de más en el INSERT de `ensureRepConsent`** (23 valores para 22 columnas): 500 en
  toda firma dual.
- **La copia firmada imprimía la cédula completa** en la línea "Firmante" (el `id_trabajador`
  de la época era el documento) y la constancia sacaba los últimos 4 dígitos de ahí. Con el
  seudónimo, eso hubiera pasado a imprimir un token opaco, o peor, **cuatro dígitos del hex
  del HMAC** presentados como si fueran la identificación. Se corrigió en las dos Bandas.
- **La mini-app exponía la cédula en claro** en `GET /s/:token`. Eso era una fuga y quedó
  cerrada por el seudónimo.
- **La línea base de la suite era 47 fallos, no 0.** La suite nunca había corrido (binario
  nativo de otra versión de Node). Los 47 son preexistentes y **no se tocaron**.

**Decisiones del owner**

- *"Ya encendi el servidor, puedes proceder con las acciones del plan para resolver los
  hallazgos, recuerda siempre validar y contrastar después de cada acción realizada"*: se
  ejecutó capa por capa, validando contra la línea base después de cada bloque.
- **El texto del Capítulo III no se toca.** Se verificó que sus tres citas legales son exactas.
- La llave maestra **no se puede rotar**: invalidaría los tokens cifrados y los seudónimos ya
  calculados. Queda documentado como restricción.

**Tests** — `tests/crypto-hmac.test.js` (10) · `tests/hmac-identificacion.test.js` (17) ·
`tests/eventos-append-only.test.js` (5) · `tests/plazo-retencion.test.js` (8). Suite completa:
**1095 tests · 1046 verdes · 47 fallos (línea base) · 0 regresiones**. Barrido de caracteres no
latinos limpio en los 35 archivos tocados; EOL y BOM verificados sin vuelcos.

**Cómo se desbloqueó la suite** — `better-sqlite3` v11 no compila contra Node 26 (MSBuild
falla) y el build del padre es de otro ABI. Se instaló `better-sqlite3@12.11.1` en
`%TEMP%\fs-test-deps` y `%TEMP%\bs3-node26`, y se crearon **junctions** dentro de
`firma-service/node_modules/` para que el service use **su propio** árbol (express 4), no el
del app de escritorio (express 5). La copia recursiva y `Remove-Item` están bloqueados por la
política: se usaron junctions. Worktree de línea base en `%TEMP%\kair-baseline`.

**Commits** — **ninguno todavía.** Falta el "dale" del owner (commit) y el "pushea" (push de
`Dev` y de `gh-pages`, que tiene un commit local `9722537f` sin pushear).

---

### 2026-10-16 · 📦898 · El consentimiento no declaraba lo que la app sí hace

**El hallazgo.** El owner preguntó, antes de publicar los documentos legales, si
**todo lo que la app muestra o envía aparecía ya en las páginas**. La respuesta fue **no**, y
no por un detalle: **dos rutas de salida no estaban declaradas en ningún lado.**

| Ruta | Qué sale | Dónde vive el código | ¿Declarado antes? |
|---|---|---|---|
| **WhatsApp** | nombre, cédula, cargo, fecha de atención y **evaluación ocupacional** | `enviar-remision-v2.js:602` → `whatsappSender.js:41` → `web.whatsapp.com/send?phone=…&text=…` | **No, en ningún documento** |
| **Correo saliente** | destinatario, nombre, fecha y el **documento adjunto**, y sale **sin confirmación** | `main.js:21035` → `emailSender.js:178` (SMTP de Gmail con `user`/`password` guardados) | **A medias**: "Google" sí estaba, pero solo para *leer* el correo, no para *enviar* |

Y lo peor: el modal de consentimiento decía, textualmente, *"Transferencias: solo al conectar su
cuenta de Google o al usar firma electrónica"*. **Esa frase era falsa.**

**Lo que sí estaba bien, verificado (no asumido):** Google, el servidor de firma, GitHub y los CDN
coinciden con lo declarado. Las URLs `firma.kair.fyi` / `firma.k-air.com` que aparecen en el grep
están **solo en archivos de test**, no en código que se distribuye. Y `doc.file-viewer.app` es un
comentario de documentación, no una llamada de red.

**Qué se cambió:**

- `sitio/anexo-encargo.html` §5 — dos filas nuevas en la tabla de subencargos.
- `sitio/privacidad.html` §4 — dos filas nuevas en "Transferencias a terceros".
- `sitio/terminos.html` §7 — dos viñetas nuevas en "Servicios de terceros".
- `sgsst-electron-app/index.html` — corregida la viñeta falsa del modal.
- Fechas de versión de los tres documentos al **2026-10-16**, en las **tres** apariciones de cada
  uno (encabezado, pie y la referencia interna que dice cuál es la vigente).

**🔴 La incoherencia de fondo que destapó esto.** Corregir un texto legal no sirve si la app no
puede avisar que cambió. Y no podía: `consent:estado` comparaba contra
`cfg.consentDocumentVersion`, una clave de `config.json` **que nadie escribía** (siempre `'v1'`),
mientras `version_terminos`, `version_privacidad` y `texto_hash` **se guardaban y no los leía
nadie**. El renderer ya enviaba la versión del documento y un SHA-256 real del texto leído
(`renderer.js:4046-4048`): **la máquina estaba construida y le faltaba un cable.**

El defecto era doble y en direcciones opuestas: editar el texto legal **no** re-preguntaba, y cada
bump de versión de la app **sí** re-preguntaba a todo el mundo. Como el bump solo pasa cuando el
owner lo dice, publicar el texto nuevo no habría llegado a nadie.

**Decisión de diseño: una sola fuente de verdad, no dos.** Se evaluaron dos caminos —
(a) subir un número a mano y (b) comparar el `texto_hash` — y **hacer los dos se pisan**: dos
mecanismos decidiendo lo mismo divergen solos. Se hizo (a) bien, con una constante en `main.js` en
lugar de una clave de config que se puede perder, y (b) quedó aplazado: solo compra detectar
ediciones que no bumpeen la versión, y el test de este commit ya cubre eso con un test rojo en vez
de un reclamo de un cliente.

**Tests** — `main/test-consent-version-898.js`, **22 checks**, con 5 mutaciones internas y
**2 mutaciones reales verificadas**:

| Mutación aplicada | Resultado |
|---|---|
| Renderer desincronizado a `2026-10-17` | 21/22, sale con código 1 |
| Reintroducido `aceptado.app_version !== appV` en `requiere` | 20/22, 2 checks rojos |

`test-consent-gate.js` (existente) queda **48/48**. `node --check` limpio en `main.js` y
`renderer.js`. La suite completa **no se remedió**.

**Lo que NO se arregló, y sigue pendiente:** el gate es **por equipo, no por persona**
(`SELECT … LIMIT 1` sin `WHERE email = ?`): en un equipo compartido el primero que acepta silencia
el gate para todos. Eso **necesita asesoría jurídica**, no un parche de código.

**Decisiones del owner** — "procede" en dos momentos: el primero autorizó **editar, no commitear**;
este autorizó **documentación, commit y push**. La versión **no se bumpea** (sigue `0.1.251`, por
la regla del owner). El CHANGELOG no se toca: registra versiones publicadas y esto no lo está.

**Commits** — uno solo, `898`, desde `Dev-Pc`.

### 2026-10-16 · Publicación de `sitio/` en `gh-pages` (cerrando los 404)

`anexo-encargo.html` y `autorizacion-trabajadores.html` estaban en el repo desde el 9 de octubre y
**nunca se publicaron**. Como `privacidad.html` y `terminos.html` sí estaban publicadas y los
enlazaban, el sitio legal llevaba **8 días** con dos enlaces rotos en producción, y desde hoy
decía además que su versión vigente era la del 16 de octubre. Publicado en `8fe93985`.

**Cómo se hizo, y por qué así:**

- Se usó un **`git worktree` aparte** (`%TEMP%\kair-ghpages`) en vez de cambiar de rama en la
  carpeta de trabajo. Motivo: al hacer `git checkout gh-pages` sobre el árbol real, los 45 743
  archivos sin rastrear (`node_modules`, `Temp/`, `backups/` y **un `.env`**) siguen ahí y un
  `git add -A` los publicaría. El worktree hace que ese error sea **estructuralmente imposible**,
  no solo una regla que hay que recordar.
- Se copiaron los **8 archivos del sitio** y se stagearon **4**, uno por uno. De los 8, solo 4
  cambiaron de verdad: `.nojekyll`, `index.html`, `soporte.html` y `assets/estilo.css` no habían
  derivado desde el 7 de octubre. El diff de los 2 modificados trae **las dos fechas**: el rewrite
  de `881` y las adiciones de hoy.
- **Escaneo de secretos sobre lo publicado**, con 8 patrones (API key de Google, token OAuth,
  refresh token, llave privada, `client_secret`, password con valor, `INTERNAL_API_KEY`, y si
  existía un `.env`): **limpio** en los 8 archivos. Sin BOM, finales de línea LF.

**El detalle que casi se reporta como fallo:** el primer `HEAD` a `anexo-encargo.html` **siguió
dando 404** con el push recién hecho. El commit estaba en `origin/gh-pages` (verificado con
`git ls-tree`), así que era **propagación de la CDN de GitHub Pages**: a los ~2 minutos devolvió
200 y el documento se sirvió **completo y con las filas nuevas**. Se verifica contra producción,
no contra el repositorio.

**Commits** — `8fe93985` en `gh-pages`. No lleva número de 📦: es una rama de despliegue, no un
paquete de producto.

### 2026-10-16 · 📦899 · Asesoría legal de K+AIR como skill portable y agente de OpenCode

**Qué se hizo** — por pedido del owner, tooling para consultar normativa sin salir del entorno de
desarrollo:

- `.opencode/skills/asesoria-legal-sg-sst/SKILL.md` — **fuente única de verdad** del asesor legal:
  alcance (SG-SST Colombia + normativa de software), jerarquía de fuentes, método obligatorio
  (verificar en fuente oficial antes de afirmar; `⚠️ No verificado` antes que inventar), formato de
  respuesta y descargo.
- `.opencode/agents/legal-sg-sst.md` — agente modo `all` que **carga el skill**; sin `edit` ni `shell`
  (`deny`), para que solo asesore.

**Por qué skill y no solo agente.** El formato `SKILL.md` es portable: OpenCode lo descubre en
`.opencode/skills/` y además lee `.claude/skills/` y `.agents/skills/` por compatibilidad; **MiniMax usa
el mismo formato** (`name` debe coincidir con la carpeta, más `description`/`license`/`metadata`). El
agente quedó como envoltorio para no tener dos copias del contenido que se desincronicen.

**Alcance normativo:** Resolución 0312 de 2019 y Decreto 1072 de 2015 (SG-SST); Ley 1581 de 2012 y
Decreto 1377 de 2013 (datos personales); Ley 527 de 1999 (comercio electrónico y firma digital);
Ley 23 de 1982 y Ley 44 de 1993 (derechos de autor de software); Ley 1273 de 2009. Fuentes oficiales:
Gestor Normativo, SUIN-Juriscol, MinTrabajo, MinSalud y SIC.

**Regla dura:** no sustituye asesoría jurídica profesional.

**Documentación:** la skill y el agente se registraron en `sgsst-electron-app/AGENTS.md` (sección
"Skill del proyecto — Asesoría legal SG-SST"). **La versión no se bumpea** (sigue `0.1.251`): es tooling
de desarrollo, no código de producto, así que el CHANGELOG no se toca.

**Commits** — uno solo, `899`, desde `Dev-Pc`.

---

## 📅 Bitácora por jornada

### 2026-10-15 (noche) · El servicio de firmas se mudó del portátil al servidor (📦901)

**Objetivo de la sesión:** que `firma-service` funcione 24/7 sin depender del portátil de trabajo.

**Lo que quedó:** `https://firma.kair.fyi` responde desde `kair-server` (Ubuntu Server 24.04.5, detrás
de NAT, túnel nombrado de Cloudflare). Los dos servicios arrancan solos tras un reinicio de kernel.
El correo sale con `messageId` de Gmail. **La migración está completa.**

#### El commit 📦901

`firma-service` escuchaba en todas las interfaces: `config.js` no leía variable de host y `server.js`
hacía `app.listen(port)` a secas. Con el servidor detrás de NAT no era explotable de inmediato, pero
en cuanto el túnel expusiera el puerto el servicio quedaba alcanzable desde la red local. El arreglo
 mete `HOST=127.0.0.1` con default en `config.js`, lo pasa a `app.listen`, lo imprime en el log de
arranque y lo documenta en `deploy/.env.production.example`. Verificado con
`ss -tulpn | grep 3001`: devuelve `127.0.0.1:3001`, no `*:3001`.

#### Los cinco hallazgos que costaron la tarde

1. **Falta `/etc/cloudflared/config.yml` y el sintoma miente.** El túnel `kair-firma` es
   *locally-managed*: sus rutas viven en el archivo local del servidor, no en Cloudflare. Sin ese
   archivo el túnel conecta, el panel dice "Buen estado" con una réplica activa, `systemctl` dice
   `active`, y `curl` a la URL pública devuelve cuerpo **vacío**. El log lo avisaba desde el primer
   intento (`No ingress rules were defined... will return 503`), y pasó inadvertido. El archivo debe
   terminar en `service: http_status:404`: cloudflared exige un catch-all.
2. **Un token truncado se disfraza de problema de credenciales.** El token es base64, así que **su
   largo siempre es múltiplo de 4**. Una copia a medias daba 180 bytes, que no es múltiplo de 4, y
   el error era `Invalid tunnel secret` — que parece un secret roto en Cloudflare y en realidad era
   transporte. El bueno mide 248 + salto de línea = 249.
3. **`Type=notify` convierte un token invalido en un "timeout".** Con `TimeoutStartSec=15`, un proceso
   que nunca manda `READY=1` produce `Job ... failed because a timeout was exceeded`, que esconde el
   error real. Lo que sirvio fue correr `cloudflared tunnel run --token-file ...` en primer plano: ahi
   si se vio `Unauthorized: Invalid tunnel secret`.
4. **El botón "Rotar token" sí funciona, pero la UI cachea el comando.** El owner lo presionó varias
   veces y el texto no cambiaba, lo que llevó a pensar que la rotación estaba rota. No lo estaba: el
   comando queda cacheado en el DOM de la página. Con `Ctrl+Shift+R` (o saliendo y volviendo a entrar)
   aparece el nuevo. Se rotó al final y el token expuesto quedó invalidado.
5. **`GET /health` no prueba el correo.** En `src/routes/health.js` el check marca `ok` si `SMTP_PASS`
   existe; no abre conexion ni autentica. Por eso `smtp: "configured"` aparecio en verde mientras el
   `.env` todavia tenia el placeholder del ejemplo y `SMTP_HOST=localhost`. La prueba real es un
   `verify()` de nodemailer, y la prueba de fuego un `sendMail()` con `messageId`.

**Dos trampas de shell que tambien costaron tiempo:** `read -rs` en un bloque pegado de varias lineas
se come la linea siguiente como entrada, asi que el archivo terminaba conteniendo un comando de bash
en vez del token; y un `!` en el `node -e` dispara *history expansion* de bash (`!l.trim: event not
found`), que se evita con `set +H`.

**Verificacion de la suite en el servidor:** `npm test` → `tests 973 | pass 969 | fail 2 | skipped 2`.
Para correrla hacen falta dos cosas que no viajan en el despliegue: copiar `tests/` al servidor, y
`npm install --include=dev` porque `supertest` es devDependency. Sin eso fallan ~60 archivos con
`Cannot find module 'supertest'`. Los dos que fallan **no son bugs**: uno es el helper del test que
genera un PDF distinto por llamada (pdf-lib escribe `CreationDate`, y el fingerprint de idempotencia
incluye el SHA-256 del PDF — el `409` del servidor es correcto); el otro mide un timeout de 200 ms
contra 326 ms reales con la CPU saturada, y el objetivo del test es detectar un hang de mas de 5 s.

**Por que los tests corren en el servidor y no en el portatil:** el `better-sqlite3` de alla esta
compilado para Electron 37 (`NODE_MODULE_VERSION 136`) y el Node local es v26 (`147`), asi que no
carga. En el servidor hay Node 20 limpio.

**Documentacion actualizada:** `docs/MIGRACION-SERVIDOR-FIRMA.md` se reescribio completa con la
arquitectura real (la anterior describia una VM de Oracle con Caddy y `sslip.io`, que no se uso).
`CHANGELOG.md` tiene la entrada de 📦901 con los cinco hallazgos. `README-DESPLIEGUE.md` queda
como guia historica y apunta al documento vigente.

### 2026-10-15 (tarde 5) · La barra del scroll arrancaba en el borde superior de la ventana (📦898)

**Qué se hizo** — por pedido del owner: que la barra vertical del costado derecho de la ventana empiece
al mismo alto que la tarjeta "Actividad ID", que está a la derecha. Ese scroll lo llevaba **el
documento entero**, que no tenía `overflow` declarado, así que su barra arrancaba en el borde superior
del visor, muy por encima del contenido.

**El arreglo** es el patrón de app shell: `html` y `body` con `height:100%`, `body` con
`overflow:hidden`, `.kair-page` como columna flex de altura completa con `min-height:0`, cabecera y
pestañas con `flex:0 0 auto`, y un contenedor nuevo `#plan-scroll` con `flex:1 1 auto` y `overflow:auto`.
Las dos vistas quedaron dentro; los modales, que ya estaban fuera, no se movieron.

**ME EQUIVOCÉ DOS VECES ANTES DE ACERTAR, Y LAS DOS IMPORTAN.**

La primera, de código: puse `height:100%` en `html` y **no en `body`**. Sin base definitiva en el padre
directo, el `height:100%` de `.kair-page` cae a `auto`, la columna flex no se acota, el contenedor
crece a la altura del contenido y **nunca scrollea**, mientras `overflow:hidden` recorta. La barra
desapareció. El owner lo reportó como *"quitaste por completo el auto scroll"* — y el auto-scroll
estaba intacto todo el tiempo. **La regla: una cadena de alturas porcentuales no acota nada si le falta
un eslabón.** Y el síntoma que lo delata: un contenedor con `overflow:auto` que no muestra barra no
está roto, no tiene nada que scrollear.

La segunda, de comunicación: "la barra del autoscroll" era ambiguo. Hay **tres** barras scrolleables en
esa pantalla —la del Gantt, la horizontal al pie de la tabla y la del borde de la ventana— y se trabajó
sobre la equivocada dos veces. Cuando se preguntó nombrándolas por posición, la respuesta fue la que
menos se sospechaba. **"La barra de scroll" no identifica una barra cuando hay más de un contenedor
scrolleable en pantalla.**

**Lo que sí quedó verificado**, en navegador real: la barra aparece en el borde derecho con la punta
superior justo debajo de las pestañas, y el pulgar ocupa menos de la mitad del carril, así que hay
contenido real para scrollear. Estructuralmente: 92 pares de `div` balanceados, llaves de CSS en cero,
modales fuera del contenedor y en `position:fixed`. Y el auto-scroll del 895 intacto:
`scrollActIntoView()`, `SCROLL_MARGIN = 24` y `.kair-gantt__scroll{max-height:560px}` sin tocar.

**Lo que no se pudo verificar.** La pestaña Cronograma dentro del contenedor nuevo: el navegador
embebido se colgó dos veces con timeout de 275 s, el mismo síntoma del 891 y del 895. Queda pendiente
que el owner lo confirme en la app instalada.

**Pendiente de decisión.** Quedan ~20 px entre el inicio de la barra y la tarjeta, por el
`margin-top:20px` que ya traían los bloques de contenido. Quitarlo alinea exacto, pero cierra el aire
entre las pestañas y las tarjetas.

**Lección para el repo.** El detalle completo está en `BITACORA.md` § 📦898, y la trampa como fila 36
de la tabla de `PROMPT.md` § 9.

### 2026-10-15 (tarde 4) · AGENTS.md dejó de ser un archivo de 11.000 líneas (📦896, 897)

**Qué se hizo** — por pedido del owner: el archivo que se carga al arrancar cada sesión tenía 10.993
líneas y su propio encabezado avisaba que era "89 % bitácora de bugs". Todo ese peso se pagaba antes de
empezar a trabajar. Se partió en dos **sin reescribir ni resumir**: copiar tal cual, solo mover de archivo.

**El corte** cae en 1125/1127, exactamente donde termina la última sección operativa (el protocolo de
autorización de commits) y arranca la primera entrada de bitácora (Menú nativo de Electron, 📦579).

- `AGENTS.md` → **1.099 líneas**: arranque, tabla de Skills con sus seis subsecciones, convención de
  commits, regla de comunicación y la arquitectura completa del proyecto.
- `BITACORA.md` → **4.797 líneas**: snapshots, playbooks, releases, trampas y las entradas 📦579 a 📦895.

Carga al arrancar: **−90 %** respecto al archivo original.

**El archivo tenía 4.200 líneas duplicadas byte a byte.** No era una impresión: en el mapa de
encabezados, las secciones 0-58 y 59-117 eran el mismo contenido repetido con offset constante de 5.335.
Cada copia se comprobó con SHA-1 antes de borrar nada.

**El duplicado estaba en dos capas, y la segunda se escapaba.** La primera (4.203 líneas) estaba entera
dentro de BITACORA.md y se quitó con un diff línea por línea. La segunda no: **cruza el corte**, así que
una copia quedó en AGENTS.md y la otra en BITACORA.md, donde ningún dedup por rango la ve. Era una segunda
copia completa de "Arquitectura del Proyecto" (909 líneas). Un dedup por rango no la encuentra; hay que
buscar el duplicado **por contenido**.

**Una línea casi se pierde, y la comprobación la salvó.** La fila de la tabla de `test-google-oauth-868.js`
existía en dos variantes. La de la copia duplicada era la versión **reducida**: a la que sobrevive le falta
la cláusula *"y no hay forma de diagnosticarlo"*. El script abortó dos veces antes de dejarme borrar,
y las dos veces tenía razón.

**Dos invariantes que costaron escribir, y las dos importan:**

- En un **dedup**, el conteo de cada línea tiene que BAJAR. La comprobación intuitiva ("nada desapareció")
  aborta siempre. La correcta es `final = original − borrado`.
- Una línea no es "contenido único" solo si no aparece como subcadena. Una versión **reducida** de otra es
  redundante, y la superconjunta que sobrevive la contiene. Sin esa prueba, el borrado se negaba solo.

**Lo que casi se va y no se va.** El arranque decía "no lo leas entero" para un archivo que ahora sí se
lee entero, y quedaban 61 líneas de relato dentro de `AGENTS.md`. De esas 61 se movieron las que
describen un bug con su resolución; **se quedó** la "Lección crítica: reescritura de archivos grandes con
scripts Python" porque es un procedimiento activo de 8 pasos, no un relato. Y al revés: los puntos 2 a 6
de los Gotchas CSS eran reglas generales escondidas en la bitácora, y el owner los promovió a sección
propia `### Reglas CSS generales` en `AGENTS.md`.

**Los 9 punteros.** `PROMPT.md`, `CLAUDE.md`, `PRODUCT.md` e `Historial.md` mandaban a buscar la bitácora
en `AGENTS.md`. Sin arreglarlos la división no servía: el agente iba al archivo reducido y no encontraba
lo que buscaba. Se cambiaron por `BITACORA.md` **sin números de línea escritos a mano** — esos conteos ya
se pudrieron tres veces (4.800 → 10.993 → 9.873 → 5.706) y un número a mano es una mentira que a veces
resulta cierta por accidente.

**Verificación.** Cada paso releyendo del disco, nunca confiado en la memoria del proceso.

| Comprobación | Resultado |
|---|---|
| Corte inicial: diferencia de multiconjuntos, línea por línea | 0 líneas perdidas |
| Dedup interno: SHA-1 de ambas copias antes de borrar | idénticas, 4.203 líneas |
| Dedup cruzado: cada renglón del bloque, normalizado | 0 renglones únicos |
| Invariante global sobre los 4.220 textos distintos del original | 0 desaparecidos |
| Los 18 renglones que no aparecen íntegros | 17 con otro nivel/numeración · 1 con versión mejor sobreviviendo |
| EOL y caracteres prohibidos en los 2 archivos | LF, 0 CR, 0 CJK/cirílico/hangul |

**Lo que sigue abierto.** El bloque de arranque y el `## Protocolo` de `AGENTS.md` no se tocaron más de lo
acordado. Sigue en pie la deuda vieja: el botón "Recursos" encendido en Configuración, y la decisión de
borrar o no `plan-viewer.js` (código muerto, 1.605 líneas).

### 2026-10-15 (tarde 2) · Capacitaciones aplicaba los temas a medias y el menú quedaba muerto (📦894)

**Qué se hizo** — por pedido del owner, que reportó en un mismo mensaje dos cosas: que el submódulo
1.2.1 Programa de Capacitación Anual no aplica bien los temas Sistema y Oscuro, y el `console.warn` de
"Cambio de módulo bloqueado". Su frase textual: *"realmente no se aue ecicion tomar no quiero dañar nada de lo que ya
funciona"*. Esa frase se tomó en serio: **no se tocó una línea** hasta terminar el diagnóstico y
presentarle las opciones con la evidencia medida.

**El diagnóstico** — el del tema resultó ser un solo defecto, no dos. El contenedor de capacitaciones
**nunca recibíA `data-theme`**: el shell lo escribe sobre `<html>` y sobre los iframes, y capacitaciones se monta
**en línea** con `fetch` + `innerHTML`, así que no hay `contentDocument` al que escribirle. En todo el
módulo: **0 `setAttribute`** y **1 `getAttribute`**. De ahí salían tres síntomas que parecían bugs
distintos — el fondo blanco, el texto gris y los gráficos con la paleta de tema claro — y que eran uno.

Lo que lo hacíA confuso es que **las tarjetas sí salíAN oscuras**, porque leen los tokens globales
`--kair-*` de `:root` y esos sí se actualizan. Solo se rompía lo que el módulo declara por su cuenta.
Y la prueba de que era código muerto y no código malo: las **47 reglas `[data-theme="dark"]`** que ya
estaban registradas como deuda. Estaban bien escritas. Nunca pudieron calzar.

**Medido sobre los colores reales de las capturas del owner:**

```
donut "19 actividades"  #14213d sobre #292929 (dark-legacy)   1.10:1   FALLA
donut "19 actividades"  #14213d sobre #384151 (dark)          1.55:1   FALLA
"En tu radar"           #6c757d sobre #384151                 2.19:1   FALLA
```

El **1.10:1** es el número gris lost del centro de la dona. Después del arreglo: **5.78:1** y **13.76:1**.

**El `console.warn`** resultó ser la punta de algo peor. `showSettingsPage()` monta su iframe sobre
`contentArea` y no registraba que habíA tomado el control de la vista, así que el estado seguíA diciendo
"Recursos / 1.2.1" mientras la pantalla ya era Configuración. El candado de `showModuleContent` veíA ese
`currentSubmodule` truthy y se descartaba. El aviso era cosmético: **el clic siguiente en "Recursos" no
hacíA nada**, en silencio. Bajar el `warn` a `info` lo dejaba igual de muerto.

**Lo que se cambió**

- `capacitaciones-view.css`: los 47 selectores a `[data-theme^="dark"]`. Cero literales exactos quedan.
- `capacitaciones-logic.js`: `_syncTheme()` y `_watchTheme()`, la llamada en `render()` y la desconexión en
  `destroy()`; `isDark` pasa a prefijo para reconocer `dark-legacy`.
- `renderer.js`: **dos líneas** en `showSettingsPage()`. No se tocó la lógica de navegación, y el candado
  de `showModuleContent` sigue en su sitio.

**Una tercera, y esta la mostró una imagen.** El prefijo `^="dark"` hace que las 47 reglas apliquen a los
dos temas oscuros, pero el bloque que las declara solo trae los **valores de `dark`**. El owner mandó una
captura del home de Recursos en `dark-legacy` y preguntó si tenía negros: tenía, es el gris neutro
`#121212` / `#292929`. Mi arreglo, sin esa segunda mitad, habríA dejado 1.2.1 **azul dentro de un shell
negro**. Se añadió el bloque `dark-legacy` al final del CSS (misma especificidad, gana por orden), con los
valores **leídos de `kair-design-tokens.css`** y no de una tabla escrita a mano, más las 3 únicas
superficies que el módulo escribe a mano. El test compara módulo contra shell: si la paleta del shell cambia,
el módulo tiene que seguirla. Contraste de la paleta neutra: **5.56:1** a **14.19:1**, cero fallas. El test
pasó de 42 a **63 checks** y de 16 a **22 mutaciones**.

### 2026-10-15 (tarde 3) · La lista del Cronograma sigue a la actividad elegida, sin mover la página (📦895)

**Qué se hizo** — por pedido del owner: el scroll del Cronograma del Plan de Trabajo se quedaba "hasta
arriba del todo" y debería empezar desde la actividad ID seleccionada, con un **techo** marcado justo debajo
de las tabs.

**El hallazgo que habríA costado el trabajo:** `plan-viewer.js` es código muerto. Espera
`#treeContainer` y `#ganttRows`, que **no existen en ninguna parte del repo**, y sus funciones salen en la
primera línea con un `if (!container) return;`: se ejecutan sin error y sin dejar aviso. La pantalla real la
pinta el script **inline de `plan-view.html`**. Parchear el archivo equivocado habríA dado un arreglo que no
hace nada con el test en verde.

**La causa:** `renderGantt()` vacíA `#gantt-table`, que está dentro de `#gantt-scroll`, y eso recorta el
`scrollTop` del contenedor a 0. No habíA ninguna línea que lo devolviera.

**El techo, por construcción.** `scrollIntoView()` recorre todos los ancestros scrolleables, incluido el
documento, y habríA movido la página escondiendo el título y las tabs. Así que lo único que se escribe
es `sc.scrollTop` del contenedor. El test cuenta las escrituras de `scrollTop` de todo el archivo y exige que
sean **una**.

**Un incidente de proceso que conviene saber:** a mitad de trabajo **un proceso externo revirtió
`plan-view.html` a su estado original y borró tres scripts nuevos**, todos sin commitear. Se detectó porque
el test de golpe pasó de 26/26 a 9/28. El 894 no se perdió porque ya estaba commiteado; el 895 sí, y se
reconstruyó. Desde entonces el script de aplicación **verifica el resultado releyéndolo del disco en el
mismo paso**. SeZYó el 894 como red: mientras algo esté sin commitear, está expuesto.

**Tests** — `main/test-plan-scroll-895.js` (**31 checks, 17/17 mutaciones**). Tiene dos mitades: mira el
código, y además **extrae la función real del archivo y la ejecuta con `vm`** contra un DOM simulado, para
comprobar la aritmética y no solo la forma. Un check de texto no demuestra que el scroll calcule bien.

**Sin bump de versión**: sigue en `0.1.251`.


**Dos trampas que casi se caen por el camino**

1. El espejo quedó primero como `initializeCharts()` a secas, y eso **vacía los gráficos**: los colores van
   horneados al crearlos, as­ que hay que recrearlos, pero recrearlos deja las series en cero. El orden
   correcto es `initializeCharts()` **y después** `updateCharts()`. Hay check del orden y mutación que lo invierte.
2. El espejo mal hecho se realimenta: si leyera el atributo del propio contenedor en vez de
   `documentElement`, quedaría en `null` para siempre y el defecto volvería con código nuevo. El test exige
   que lea de `documentElement` **y** que no lea de `this.container` en el mismo método.

**Tests** — `test-capacitaciones-tema-894.js` (**42 checks, 16/16 mutaciones**) y
`test-guard-modulo-894.js` (**27 checks, 13/13 mutaciones**). Batería 884–894 en verde; el 861 sigue en
614/614 con 9/9 mutaciones.

**Verificación visual** — navegador real con el CSS y el HTML del disco: seis paneles, tres temas por
(sin espejo / con espejo). Las columnas "sin espejo" reproducen exactamente las capturas del owner; la columna
**Claro sale idéntica antes y después**. No es la app instalada: sin `electronAPI` ni IPC, y sin gráficos
(Chart.js y datos del Excel). Alcanza para la cascada y el contraste, **no para el shell**.

**Sin bump de versión**: sigue en `0.1.251`.

### 2026-10-15 (tarde) · La pantalla de empresa vuelve al premium y deja de tapar Vanta (📦893)

**Qué se hizo** — por pedido del owner: rediseñar la pantalla con la que arranca la app,
conservando la animación de Vanta y con las tarjetas de borde redondeado. La propuesta se
aprobó y se implementó.

**El diagnóstico de partida.** La pantalla la construía `renderer.js` con doce estilos **en línea**,
los tokens viejos del shell (`--white-color`, `--border-color`, `--secondary-color`) y tres
bloques de tema escritos `[data-theme="dark"]` a secas. Como `dark-legacy` no es alias de `dark`,
en el **oscuro manual** los botones salían con el aspecto del claro. Y el texto blanco sobre
Vanta daba **1.93:1**, que se leía a ojo por el `text-shadow` y que **WCAG no cuenta**: por eso
el texto ahora va dentro de un panel de vidrio, que compuesto da **7.59:1**.

**Lo que encontró el owner mirando la app, y ningún test.** El primer montaje usaba la clase
`kair-premium` en el contenedor para no perder la fuente del premium. Pero esa clase no es de
contenedor: es el **envoltorio de página**, y pinta fondo, fija `height:100%` y `overflow-y:auto`.
Sobre la animación, eso es un bloque opaco. Un `background:transparent` en la regla del 893 lo
cancelaba y dejaba el CSS **correcto** — por eso el test pasaba con la causa presente y con la
ausente, y por eso no cantaba nada. El arreglo fue **dejar de usar la clase** y declarar en el
componente lo que antes tomaba prestado: fuente, `box-sizing` y las bases de la tarjeta, que
viven todas bajo `.kair-premium`. **El diseño no cambió; cambió la dependencia.**

**El centrado se perdió en el camino.** Al quitar los estilos en línea se fue el
`alignItems = 'center'` de la pantalla vieja. Un contenedor sin `align-items` sigue siendo válido
para cualquier test; solo se nota mirando. Va documentado como la tercera trampa del 893.

**Lo que sí se midió.** En navegador real, con los CSS del disco y los tres temas a la vez: el
Vanta se ve detrás, panel y tarjetas centrados, y las tarjetas cambian de superficie en claro
(`#ffffff`), `dark` (`#384151`) y `dark-legacy` (`#292929`). **No es la app instalada**: falta
confirmar con la app abierta.

**Tests** — nuevo `main/test-empresa-893.js`: **72 checks y 26/26 mutaciones**. El contraste se
calcula componiendo los `rgba` sobre el punto más claro de Vanta y leyendo los tokens reales de
`kair-design-tokens.css`, para los tres temas. Al volver autosuficiente el componente, seis
mutaciones quedaron apuntando a selectores que ya no existían y se volvieron **vacías sin avisar**:
se re-anclaron y se exigió `mutaciones vacias: 0`. Se reparó además `test-panel-tema-885.js`,
que exigía el sello `panel885` literal y se rompió solo con este bumpeo; ahora ancla a la **fecha**.
**Batería 884–893 en verde (11 tests).**

**Sin bump de versión**: sigue en `0.1.251`.


### 2026-10-15 (mañana) · 1.1.1 sigue el tema y su visor vuelve a abrir documentos (📦891, 892)

**Qué se hizo** — el submódulo 1.1.1 Responsable del SG-SST, por pedido del owner: primero el tema, después un
error que apareció al hacer clic en un documento.

**📦891 · El tema.** El owner reportó que en modo oscuro seguía viendo "el tema de sistema solapado".
Eran dos defectos distintos:

1. El sincronizador de `responsable-sg-viewer.js` era una copia de la lógica de `scripts/theme-manager.js`, que
   **no está cargado en el shell**. Se notaba en el contrato: leía `event.data.mode`, y `renderer.js:1755`
   manda `theme` y `effectiveTheme`. Con `mode` siempre `undefined` devolvía `null` en modo **sistema** y
   borraba el atributo que `renderer.js:1746` acababa de poner. El `postMessage` es asíncrono: gana el último
   en escribir. Se sustituyó por `shared/kair-iframe-theme.js`, igual que en 889 y 890.
2. `.kair-preview__body:has(flyfish-file-viewer)` y `.kair-pdf-frame` tenían `background: #fff` **sin
   contraparte oscura**. Ese es el panel blanco solapado sobre el oscuro que se veía al abrir un documento.

El CSS de 1.1.1 estaba bien: 58 reglas oscuras, 29 para `dark` y 29 para `dark-legacy`, y 322 usos de tokens.
El fallo era el atributo que dispara esas reglas, no las reglas.

**WCAG 2.1 AA.** Diez sitios tenían `color: #fff` sobre superficies de acento. El botón "Subir" quedaba en
**2.56:1** en oscuro. Se agregaron tres tokens (`--kair-on-accent`, `--kair-on-danger`, `--kair-on-warning`)
con valor por tema: el botón pasó a **6.53:1**. El ícono de advertencia del modal usaba blanco sobre ámbar y
daba **1.63:1 ya en claro** — ilegible antes de este trabajo, no solo en oscuro.

**El `?v=` tiene tres niveles**: el script dentro del iframe, el CSS del iframe y el `iframe.src` en el
padre. Falta cualquiera de los tres y Electron sirve del caché.

**📦892 · La carga de documentos.** El owner hizo clic en un documento y obtuvo
`API function __fileViewerBytes not found`.

El padre rutea el preview del PDF por `__fileViewerBytes` (`responsable-sg-logic.js:69`). Ese nombre **no
es una función de `window.electronAPI`**: es una bandera para llegar al bloque que lee bytes con
`readFileBytes`. El preload expone `readFileBytes`, `getPDFPreview` y `getWordPreview` — no
`__fileViewerBytes`. Y `handleStandardRequest` validaba **antes** de rutear, así que la guarda mataba el
canal y el bloque de ruteo nunca se ejecutaba para el PDF. El bloque que responde "Ruteo del visor de
archivos roto" era la red de seguridad, pero tampoco se alcanzaba. Los dos mecanismos se contradecían, y el
test 861 comprobaba el de abajo sin notar el de arriba.

El segundo defecto explicaba lo extraño del reporte: el panel **no limpiaba el estado anterior**, así que el
error de un archivo quedaba pintado debajo del overlay del siguiente. Con un `.docx` en pantalla y un error
de PDF encima, no había forma de saber cuál fallaba. El mensaje de error ahora nombra el archivo y su
extensión.

**Tests** — `test-responsable-tema-891.js` (58 checks, 20/20 mutaciones) y `test-visor-carga-892.js`
(26 checks, 16/16 mutaciones). Batería 884–892 en verde (10 tests); el 861 sigue en 614/614.

**🔴 Incidente anotado.** Un script mío leyó un CSS como UTF-8 y lo escribió como `latin1`: cada `═══` y
cada `—` pasaron a `P` o `?`, 64 caracteres de reemplazo. **El archivo seguía funcionando**, porque el
navegador ignora los comentarios: el daño era invisible salvo que alguien leyera el archivo. Lo detectó un
test al encontrar 0 tokens. Se restauró desde git y se reaplicó con un script que **aborta si aparece
`U+FFFD` antes de escribir**. Queda como trampa 24 de `PROMPT.md`.

**🔴 Lo que NO se verificó** — ni el 891 ni el 892 se miraron en la app instalada. El arnés HTTP del 891
llegó a una conclusión útil (el iframe no cargaba el módulo compartido) pero se colgó después: el `load`
del iframe no dispara con el bundle del file-viewer montado, y el browser se saturó. Se cambió de método a
análisis de código y test en Node. **El owner tiene que reiniciar Electron y confirmar**: 1.1.1 oscuro en
modo Sistema, y que un PDF y un DOCX abran en el visor.

**Pendientes que no se tocaron** — `--kair-text-muted` queda en 3.09:1 en claro y 3.88:1 en oscuro, bajo el
mínimo en los dos temas: deuda de accesibilidad preexistente, ajena al tema. Y `_printConvertedDocument
manda `get-pdf-preview` por defecto para cualquier extensión desconocida, así que imprimir un `.txt`
intentaría convertirlo con LibreOffice.

**Sin bump de versión** — sigue en `0.1.251`.

---

### 2026-10-14 (tarde) · Recursos: el home, 1.1.2, 1.1.3 y 1.1.5 siguen el tema (📦887, 889, 890)

**Qué se hizo** — los submódulos del módulo Recursos, uno por uno y por pedido explícito del owner.
Tres paquetes, y **cada uno resultó ser una forma distinta del mismo fallo de fondo: el color no tenía
tema.** La app nunca se abrió en esta sesión.

| Paquete | Qué | Forma del fallo |
|---|---|---|
| 📦887 | El home de Recursos | Dos `:root` de módulo se llevaban los tokens del shell por delante |
| 📦889 | 1.1.2 Roles y 1.1.3 Asignación de Recursos | **Son iframes**: el `data-theme` no cruza la frontera |
| 📦890 | 1.1.5 Gestión del COPASST | Cero reglas por tema, un `:root` global y **48 reglas muertas** |

| Qué | Resultado |
|---|---|
| Test nuevo | `test-alcance-tokens-889.js` (37 checks, 21/21 mutaciones) y `test-copasst-tema-890.js` (47 checks, 23/23 mutaciones) |
| Módulo nuevo | `shared/kair-iframe-theme.js`, el sync de tema para iframes |
| Batería | 884–890 completa en verde; integridad OK |
| Versión | Sin bump: sigue en `0.1.251` |

**El detalle que más costó de ver: `dark-legacy`.** El shell manda el tema resuelto por tres vías, y una
trae el **oscuro manual** como `dark-legacy`, que **no** es alias de `dark`. Un código que solo acepta
`'dark'` lo da por claro y **le quita el atributo**: el modo manual queda sin pintar mientras el de sistema
funciona. La mitad de las pruebas pasa y parece que el arreglo funcionó.

**Las tres formas que el shell manda de verdad** (y las que **no** llegan, que son las que el código viejo
esperaba):

1. `get-theme-response` → `{theme: <ya resuelto>}` — `renderer.js:2006`
2. `theme-changed` → `{theme: <preferencia>, effectiveTheme: <resuelto>}` — `renderer.js:1756` y `7445`
3. escritura directa en `iframe.contentDocument.documentElement` — `renderer.js:1746` y `7418`

Las que **no** llegan son las de `scripts/theme-manager.js`, que espera `{theme, mode}`: ese archivo existe
en disco y **no está cargado en el shell**. Cualquier código que dependa de su forma de mensaje está roto,
y no por poco.

🔴 **Tres hallazgos del 📦890 que nadie había reportado, y que eran peores que el síntoma reportado:**

1. **El formulario escribía en el shell entero.** `showRealizarActasInterface()` inyecta un `<style>` que
   abría un `:root` con `--widget-bg-color: #ffffff`. **Un `:root` que no está en el `<head>` sigue siendo
   el `<html>`**, así que ese valor se leía en los 44 lugares de `styles.css` que lo usan y, como la hoja
   entra después, ganaba por orden contra `[data-theme="dark"]` (empate 0,1,0). Mientras el formulario
   estaba abierto, el shell completo se leía con superficies blancas.
2. **El bloque oscuro del formulario era código muerto.** Sus 13 selectores pedían
   `.copasst-actas-container[data-theme="dark"]` y ese atributo vive en el `<html>`, nunca en el contenedor.
   Nunca se ejecutó. Es el mismo error que el 887 encontró en `capacitaciones-view.css` (47 reglas) y
   `objetivos-sst-view.css` (48).
3. **El Repositorio de Actas BORRABA el tema.** `renderer.js:1743-1759` escribe el atributo **ya resuelto**
   en el `contentDocument` y **después** manda `theme-changed`. El sincronizador del visor traducía eso con
   la forma `{theme, mode}` equivocada, así que con `theme:'system'` devolvía `null` y hacía
   `removeAttribute`. Como el `postMessage` es asíncrono, **ganaba siempre el paso que rompía**.

**La lección del arnés, que se aplicó a sí mismo.** La primera versión del arnés mutaba `data-theme` con el
DOM ya montado y medía con `getComputedStyle`: reportaba **16 fallas que no existían**, porque sin un ciclo
de render la lectura devuelve el estilo del estado anterior. Se rehízo para que el tema viaje en el HTML
**desde el parseo**. Antes de eso se persiguió una causa que era el arnés mintiendo: se llegó a leer, en un
mismo elemento y en el mismo instante, la variable de tema ya oscura y el fondo todavía claro. **Eso solo
significa que el que mide está mal, no que el CSS esté mal.**

**Pendiente de decisión del owner:** 1.1.2 y 1.1.3 usan **paletas distintas** entre oscuro de sistema y oscuro
manual. `dark` es azul K+AIR (`--kair-card: #384151`) y `dark-legacy` es gris neutro (`#292929`). 1.1.3 lee
tokens, así que sigue esa diferencia; 1.1.2 usa su propia paleta explícita y sale azul en los dos. Hay que
decidir en qué dirección alinear.

**Lección operativa: `copasst-home.css` es de EOL mixto a propósito** (el bloque legacy es CRLF y el premium
del final es LF). La herramienta de edición lo normalizó a CRLF entero la primera vez y hubo que restaurar
desde git y rehacer el cambio por bytes. El test 890 lo vigila con dos mutaciones que lo normalizan a
propósito.

### 2026-10-06 (madrugada) · El admin quedaba encerrado en "contacta a administración" (📦862)

**Qué se hizo** — un bug de permisos en `renderer.js`, con su test y sus documentos. La app
**no se abrió** en esta sesión: el owner autorizó editar y commitear por separado.

| Qué | Resultado |
|---|---|
| Filtrado de empresas | Se decide **por rol primero**. Antes la rama del admin era código muerto |
| Mensaje de "sin empresas" | Decide por rol: un admin nunca ve "contacta a administración" |
| Test nuevo | `main/test-admin-empresas-862.js`, **17 checks**, con prueba de mutación |
| Versionado | 0.1.240 → **0.1.241**, cache-bust `renderer.js?v=20261006-admin-empresas-2` |
| Documentos | CHANGELOG + README + CONTEXT + release-notes + AGENTS (los 5, §5.8) |

**Por qué** — el owner reportedó que al entrar le decía *"No tienes empresas asignadas. Contacta a
administración"*, y él **es** administración. El mensaje lo hizo creer que era un tema de permisos
y lo tuvo un rato agarrado.

**El bug, en una línea.** `showHomePage` filtraba las empresas así:

```js
if (Array.isArray(overrideCompanies)) { ... }              // SIEMPRE true
else if (assignedCompanies && ... && !checkIsAdmin()) { ... }
else { /* ADMIN: todas las empresas */ }                     // NUNCA se ejecutaba
```

`Array.isArray([])` es **`true`**, y `initializeApp()` se llama en **un solo** sitio
(`renderer.js:3604`) pasando siempre `assignedCompanies`, que es un array. La primera rama ganaba
**siempre**. Verificado con grep: `initializeApp(` aparece una vez en `renderer.js` (el otro hit
es una función homónima dentro de `seguimiento-incapacidades.html`).

Arrastraba tres cosas: el admin sin empresas veía cero empresas y el mensaje de un usuario normal;
el `else` del admin era inalcanzable, así que el fallback `["Tempoactiva","Temposum","Aseplus","Asel"]`
tampoco era código real; y `checkIsAdmin()` **nunca se consultaba**.

**La trampa del arreglo obvio.** Agregar `&& overrideCompanies.length > 0` **abre una escalada de
privilegios**: un no-admin sin empresas caería en el `else`, que carga `config.companyPaths` entero,
y vería **todas**. El bug visible se arregla y se crea uno peor. El arreglo correcto decide por rol
primero, y el test cubre ese caso explícitamente.

**El backend estaba bien.** `validateSession` (`main.js:1021`) reconoce `admin@kair.local` y
devuelve `isAdmin: true`. El diagnóstico por la app daba la pista equivocada porque el mensaje
**parecía** de permisos.

**El primer fix no alcanzó, y el owner lo reportó con una captura.** Arreglé el orden de las
ramas, subí la versión a 0.1.241 y el mensaje **seguía siendo el viejo**. La captura lo dejó
claro: la app corría el código nuevo (el pie decía `v0.1.241`) pero `esAdmin` valía `false`.

Había una segunda causa, más profunda: **`checkIsAdmin()` derivaba el rol solo de
`currentUser.companies`**. Con `companies = []` —el caso del admin global, que por definición no
tiene empresas asignadas— `[].some()` da `false`. El backend ya mandaba `user.isAdmin` resuelto
(`main.js:1628`) y el renderer lo ignoraba. Ahora `checkIsAdmin()` respeta `currentUser.isAdmin`
primero y solo recalcula por `companies` cuando el backend no resolvió el caso global.

Y el admin quedaba **sin salida**: el Inicio oculta el sidebar siempre (`sidebar-hidden`), así que
con cero empresas no había forma de llegar a la configuración. Se agregó un botón **Ir a
Configuración** cuando es admin y la lista está vacía.

**El cache-bust se bumpeó dos veces.** El primer token (`20261006-admin-empresas`) ya lo había
descargado la app en ese arranque, así que la segunda vuelta necesitaba uno nuevo
(`20261006-admin-empresas-2`). Es §5.3: **un token repetido no sirve para nada**.

**Tests** — el nuevo test **extrae el bloque de decisión de `renderer.js` y lo ejecuta** con roles
distintos, en vez de buscar cadenas: cubre los cinco combinatorios de (admin, asignadas, override)
más los dos del mensaje. Lo que le da valor es la **mutación**: reintroduciendo el orden del bug
**sobre el código nuevo** (conservando `const esAdmin`, para que el check estructural siga
pasando) fallan los dos checks de comportamiento — `admin sin empresas recibió []` y
`admin con override recibió ["Solo"]`. Un detector de cadenas habría pasado ese mutante.

**Suite:** 120 tests · 99 verdes · 21 con fallos. Las 21 son **las mismas preexistentes**: cero
regresiones. Repetida justo antes del commit: **120 tests · 102 verdes · 18 con fallos**. De esos
18, los 5 que leen archivos tocados por 📦862 (`auditoria-visual`, `compose-bem`,
`evaluacion-inicial-bootstrap`, `skeleton-encaje`, `auto-download-flow`) **fallan también en HEAD
limpio** — stash, corrida, pop, árbol idéntico al de antes (§7.4) — y los otros 13 no leen ningún
archivo que haya cambiado. Preexistencia probada, no supuesta.

**Una fricción que encontró el suite.** `test-hero-fila-840` tiene el token de cache-bust
**escrito a mano** (`renderer.js?v=20261002-hero-oculto`), así que **se cae con cada bump legítimo**.
Falló al subir el `?v=` de 📦862 y hubo que actualizar el literal. No se rediseñó el check para que
no se rompa: eso es decisión del owner, no un efecto colateral de este paquete.

**Decisiones del owner**

- Autorizó editar ("ok procede"). **No autorizó commit**: 📦862 queda en el working tree.
- Confirmó que el rol lo tenía bien y que el problema era que no le aparecían las opciones.

**Datos: por qué el fix solo no alcanza**

El escritorio tiene la base creada (76 tablas) pero **sin empresas**:

| Fuente | Estado |
|---|---|
| `companies` | 0 filas |
| `user_company_roles` | 0 filas |
| `config.json` → `companyPaths` | **no existe** |
| `roles` | 5 filas (Administrador, SST, Auditoría, Gerencia, RRHH) |
| `users` | 1: `admin@kair.local`, activo, `bandeja_integrada_enabled: 0` |

Con 📦862 el admin ya **no** ve el mensaje equivocado: ve el correcto ("no hay empresas
registradas, crea una en configuración"). Pero **sigue sin ver empresas**, porque no hay ninguna.
Esto no se arregla con código: hay que restaurar el `kair.db` y el `config.json` del portátil.
Y registrar empresas desde la UI ("Vincular Rutas de Archivos por Empresa",
`config-viewer.html:6853`) **exige Python 3.10–3.12**, que esta máquina no tiene (tiene 3.14.8).

**Commits**

| Hash | Qué | Estado |
|---|---|---|
| `e2f6adaf` | docs(entorno): puesta a punto del escritorio | pusheado |
| `📦862` | fix admin empresas + test + los 5 documentos | commiteado y pusheado |

---

### 2026-10-05 (tarde) · Escritorio recién formateado: puesta a punto (sin paquete de código)

**Qué se hizo** — esta sesión **no cambió una línea de la app**. El árbol quedó idéntico a `HEAD`
(`e6a98d98`). Lo que se hizo fue dejar un escritorio recién formateado capaz de correr y probar el
proyecto, y dejar escrito lo aprendido.

| Qué | Resultado |
|---|---|
| Fusionar `Dev-Pc` en `Dev` | El owner lo hizo a mano. `Dev` quedó en `e6a98d98`, que ya contiene 📦861 |
| `node_modules` | 913 paquetes. `npm install` normal **falla y revierte todo**: compila `better-sqlite3` contra Node 26 y revienta |
| Electron 37.10.3 | Extraído a mano. El `install.js` oficial salió con código 0 tres veces sin extraer nada |
| `better-sqlite3` | Compilado para **Electron** (`--runtime=electron --target=37.10.3`), verificado con un `SELECT` real: `OK 37.10.3, sqlite 3.49.2` |
| **`core.autocrlf`** | **El hallazgo grande.** 2277 archivos en CRLF y `git status` diciendo "limpio" |
| `setup-file-viewer.js` | Corrió, pero **borró 2624 archivos versionados**. Revertido: es paso de packaging, no de desarrollo |

**Por qué** — el owner formateó el PC y pidió validar que no le faltara nada para probar la app.

**El problema de fondo: `autocrlf`**

El instalador de Git for Windows dejó `core.autocrlf=true` en `C:\Program Files\Git\etc\gitconfig`.
Es config de **sistema**, así que `git config --global` sale **vacío** y parece que no hay nada
configurado. Ese `true` convierte LF→CRLF en el checkout, y como el repo guarda en LF a propósito
`main.js`, `preload.js`, `index.html`, `main/*-bridge.js`, `shared/*.css` y `premium.css` (los tests
lo verifican uno por uno), el clon dejó **2277 archivos en CRLF**.

Lo peligroso: **`git status` dice que el árbol está limpio**. Miente por dos razones que se refuerzan
— el stat-cache ya registró los tamaños convertidos, y al commitear Git normaliza CRLF→LF. El
archivo está mal en disco y Git no lo ve. El próximo `git add` sube CRLF y aparece el diff de ~7000
líneas.

Cinco tests fallaban con el mismo mensaje (`premium.css sigue en LF [CRLF, esperado LF]`) — un solo
síntoma repetido, que es la firma de un problema de entorno y no de UI.

**El fix que costó encontrar.** `git config --local core.autocrlf false` no alcanza por sí solo:

| Comando | Resultado |
|---|---|
| `git checkout-index -a -f` | 0 cambios. No reescribe |
| `git update-index --really-refresh` | 0 cambios. No reescribe |
| `git read-tree --reset -u HEAD` | 0 cambios. No reescribe |
| **`git reset` + `git checkout -- .`** | **Funciona.** El `reset` rehace el índice sin stat-cache; recién ahí Git ve los 2277 |

Renormalizar **no** uniforma: **restaura**. `main.js` quedó en LF y `app.js` quedó en CRLF, que es lo
que el repo pide. **De 88 a 98 tests en verde sobre 119**; los 10 recuperados eran todos de EOL.

**Segundo problema: `better-sqlite3` se compiló contra el Node equivocado.** La app nunca corre con
Node 26 — corre dentro de Electron 37.10.3, que usa Node 22.21.1 y ABI 136. `npm install` corrió
`node-gyp` contra Node 26 y falló con APIs de V8 eliminadas (`"GetIsolate": no es un miembro de
"v8::Context"`). No faltaba el compilador: `cl.exe` estaba instalado. Al fallar, npm **revirtió el
install entero** (913 paquetes → 2). El orden que funciona está en `PROMPT.md` §5.17 y §9.

**Un tercer defecto del repo, no del entorno:** `CONTEXT.md` tiene separadores **CR CR CR LF** (tres
CR) en 1337 de sus 1354 líneas. Viene así del repo. Cualquiera que lo edite con `Edit` o lo reescriba
con `ReadAllText` rompe el diff entero. Por eso la sección nueva se insertó con un script que **detecta
el separador real** en vez de suponerlo, y se verificó por estructura: 40 adiciones, 0 eliminaciones.

**Tests** — 119 corridos en el escritorio: 98 verdes, 21 con fallos, **no comparables** con los del
portátil (101 verdes). Las 21 se reparten en:

| Grupo | Cuántas | Por qué |
|---|---|---|
| Requieren Electron con ventana | 5 | Hacen `require('electron').app.whenReady()`, que no existe con `ELECTRON_RUN_AS_NODE=1` |
| Requieren `kair.db` | 4 | La BD vive en `%APPDATA%`, fuera del repo. Esta máquina no la tiene |
| Aserciones reales contra el código commiteado | ~12 | `header-zindex`, `compose-bem`, `skeleton-encaje`, `auditoria-visual`. **No se verificó si también fallan en el portátil** — no hay acceso a esa máquina |

**Decisiones del owner**

- Ante el hallazgo del upgrade a Electron 44 sin commitear, eligió **revertir a Electron 37** y dejar
  el escritorio funcionando, en vez de subir `better-sqlite3` a 13.x. El patch quedó en
  `backups/electron44-upgrade-2026-10-05.patch` (10.4 KB, gitignored) por si lo retoma.
- Autorizó commit y push el 2026-10-05.

**Commits**

| Hash | Qué | Pusheado |
|---|---|---|
| `e6a98d98` | `Merge branch 'Dev-Pc' into Dev` (lo hizo el owner) | sí, ya estaba en `origin/Dev` |
| este | Documentación de la puesta a punto + 4 trampas nuevas | sí |

**Lo que sigue pendiente en este escritorio**

1. **Datos:** copiar un backup a `%APPDATA%\sgsst-electron-app\kair.db`. Sin eso la app abre vacía.
2. **Google Calendar:** `Copy-Item .env.example .env` y completar `GOOGLE_OAUTH_CLIENT_ID` /
   `_SECRET`. Credenciales del owner, no inventables.
3. **Python:** está en 3.14.8 y el README pide 3.10–3.12. Afecta 5 Porqués y análisis de accidentes,
   no el arranque (hay fallback al Python del sistema).

---

### 2026-10-03 · Bandeja Integrada (📦844-851) + Prompt operacional v2.0

**Qué se hizo**

| Paquete | Qué |
|---|---|
| 📦844 | El mini-calendar queda fijo en el mes actual y cruza la medianoche sin congelar "hoy" |
| 📦845 | Doble clic lleva al calendario grande a la vista Día del día elegido |
| 📦846 | Popup de categorías al pasar el mouse, agrupado, tope de 8 |
| 📦847 | Se quita el tooltip nativo duplicado y se corrigen las horas que salían `00:00` |
| 📦848 | Se corrige "Todo el día": ahora usa la misma regla que la grilla |
| 📦849 | Los 3 indicadores bajan al sidebar en **"Tu día"**; fuera "Eventos críticos"; el correo gana el alto |
| 📦850 | **Botón en el borde para plegar la columna lateral**, con estado persistente |
| 📦851 | Se va la etiqueta con el mes del encabezado (repetía lo que ya dice el calendario) |
| — | `PROMPT.md` v2.0: auditoría completa del prompt viejo contra el código real |
| — | `PRODUCT.md` corregido (paleta, tipografía, dark mode, "no hay README") |
| — | 3 trampas internas de `AGENTS.md` corregidas (ver abajo) |

**Por qué**

El sidebar de la Bandeja se comía un quinto de la pantalla, y los indicadores vivían arriba
robándole espacio al correo. El owner pidió plegar la columna y bajar los indicadores.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-minical-844.js` | 27/27 | — |
| `test-minical-dblclick-845.js` | 24/24 | — |
| `test-minical-reloj-844.js` | 29/29 | — |
| `test-minical-hover-846.js` | 49/49 | 12/12 |
| `test-minical-hora-847.js` | 23/23 | 2 bugs + 8 guards |
| `test-minical-allday-848.js` | 22/22 | 3/3 + 5 guards |
| `test-bandeja-tudia-849.js` | 47/47 | 3/3 + 10 guards |
| `test-bandeja-sidebar-850.js` | 48/48 | **20/20** |
| `test-bandeja-chip-851.js` | 16/16 | **9/9** + 1 equivalente declarada |

Suite completa: 111 tests, 93 verdes, 18 preexistentes, 0 regresiones.

**Decisiones que el owner confirmó** (no volver a preguntar)

- El botón del borde va **fuera** del `<aside>`, en el borde de la columna.
- El sidebar **empieza abierto** y la app **se acuerda** de cómo se dejó.
- Se **elimina por completo** "Eventos críticos", no se oculta.
- Se borran el texto y el botón de "Integración correo"; los indicadores ocupan ese lugar.
- `PROMPT.md` **referencia** los documentos del repo en vez de duplicar sus valores.
- Va en la **raíz del repo**, versionado junto a `PRODUCT.md`.

**Los 4 bugs que aparecieron durante el trabajo** (importante: ninguno estaba en el código,
todos los encontró el test o la validación)

1. 📦848 — el fix de 📦847 inventó el criterio "si el rango es 00:00–23:59 es todo el día", pero
   **5 generadores en `main.js` crean eventos exactamente así**. La verdad ya existía y la usaba
   la vista Día. El test de 📦847 afirmaba el bug como correcto: se invirtió, no se borró.
2. 📦850 — un handler que borra y reinserta preservaba un campo leyendo la tabla **después** del
   borrado. Resultado real en la BD del owner: el 2026 de Tempoactiva quedó con `0/14` categorías.
3. 📦850 — el popup decía "Todo el día" para todo, y las horas salían `00:00`, porque leía los
   eventos con nombres de campo que no son los reales.
4. Documentación — `PROMPT.md` viejo, `PRODUCT.md` y 3 secciones de `AGENTS.md` describían un
   sistema visual que no existe. Origen probable: `AGENTS.md:235` referenciaba un archivo
   (`kair-canonical.css`) que **nunca estuvo en el repo**.

**Archivos tocados en la jornada**

```
PRODUCT.md                                        (corregido)
PROMPT.md                                         (nuevo)
Historial.md                                      (nuevo)
CLAUDE.md                                         (nuevo)
sgsst-electron-app/AGENTS.md                      (3 trampas corregidas)
sgsst-electron-app/README.md                      (0.1.233)
sgsst-electron-app/CHANGELOG.md                   (0.1.233)
sgsst-electron-app/CONTEXT.md                     (0.1.233)
sgsst-electron-app/release-notes.md               (0.1.233)
sgsst-electron-app/package.json                   (0.1.233)
sgsst-electron-app/renderer/bandeja-integrada/    (index.html, app.js, data.js, premium.css)
sgsst-electron-app/main/test-bandeja-*.js         (nuevos y actualizados)
sgsst-electron-app/main/test-minical-*.js         (nuevos)
```

**Commits de la jornada**

| Hash | Paquete | Push |
|---|---|---|
| `42cce42e` | 📦844-849 | Sí |
| `47779352` | 📦850-851 | Sí |
| `2926b8ea` | 📦852 documentación | Sí |
| (36dcc1eb) | 📦853-854 aviso de correo en "Tu día" | Sí |
| (c953462b) | 📦855 la bandeja abre en blanco | Sí |
| (este commit) | 📦856-857 "Tipos de evento" cuenta lo que se ve | Sí |

---

### 2026-10-03 · "Tipos de evento" cuenta lo que se está mirando (📦856-857)

**El bug reportado (📦856)**

Las seis categorías marcaban 0, siempre. **No faltaban datos**: el panel iteraba sobre
`D.EVENT_CATEGORIES` y comparaba `e.category === cat.id`, pero las dos únicas fuentes de eventos
devuelven `rapido`:

| Fuente | Devuelve | Archivo |
|---|---|---|
| Eventos rápidos | `type: row.tipo \|\| 'rapido'` | `main/eventos-rapidos-bridge.js:101` |
| Google Calendar | `category: kairCategory \|\| 'rapido'` | `shared/google-calendar.js:107` |

**Verificado contra las 75 tablas de la BD real: ninguna guarda las 6 categorías oficiales.** La
única tabla de eventos tiene `tipo='rapido'` y 5 filas de julio-agosto.

Pista extra en la captura: **todos los puntitos del mini eran del mismo azul**, que es
`categoryColor[ev.category] || "#2057B8"` — el color de respaldo de "no reconocí esta categoría".

**No-op silencioso encontrado de paso**

El mini hacía `if (D.FALLBACK_CATEGORIES)`, pero **`D.FALLBACK_CATEGORIES` no existe**: es una `const`
local de `app.js`. El `if` protegía un crash y dejaba el bloque vacío, así que las categorías no
oficiales nunca entraban al mapa de colores.

**Lo que pidió el owner después (📦857)**

Mostrar solo los tipos con eventos, contar el mes en vista Mes, el día al elegirlo en el mini, y que
**las tres secciones existan siempre**.

**El footer del calendario también mentía**: decía "224 evento(s) en el rango visible" y eran 224
del **año entero**. La suma de los contadores daba exactamente 224: panel y footer coincidían, y los
dos estaban mal.

**El alcance ahora sigue a la vista** (`alcanceFechas`, pura): Mes usa las celdas de la grilla
**incluidos los días en gris del mes vecino** (porque están en pantalla); Día y Programar usan el día
seleccionado; Semana usa los 7 días desde el lunes; y un clic en el mini fija ese día aunque la vista
siga en Mes.

**Por qué `alcanceTipos` es un estado aparte de `selectedDate`**

`selectedDate` **siempre** tiene valor (init lo pone en hoy): no distingue "hoy por defecto" de "el
owner eligió este día". Y un clic simple en el mini **no** cambia `calView`, así que sin la bandera
no había forma de saber que señaló un día. Se fija en `seleccionarDiaDelMini` y en el "+N más"; se
suelta al navegar de mes, con "Hoy", al cambiar de vista, o con el botón emergente **"Ver el mes
completo"**.

**"Tu día" desaparecía por dos motivos de layout**

1. `.kair-sidebar` con `overflow: hidden` → la tercera tarjeta se salía **recortada, sin scroll**.
2. Sin `min-height: 0`, un hijo flexible no baja de su altura mínima y el padre se desborda.

Reparto final: `.mini` y `.tuday` con `flex: none` (altura fija), `.tipos` con `flex: 1 1 auto` +
`min-height: 0` y su lista scrolleando por dentro. El `overflow-x: hidden` del sidebar **se conserva**
(📦850: evita el derrame de tarjetas durante los 240ms del plegado); el `overflow-y` pasó a `auto`.

**Bug propio que casi revirtió 📦844**

Metí `buildMonthGrid(state.viewYear, ...)` **dentro** de `renderSidebar`, que es exactamente el
acoplamiento que 844 eliminó (el mini está congelado en el mes real). Lo detectó
`test-minical-844` (26/27) y está en su razón de ser. El cálculo se movió a `celdasDelMesVisible()`,
**fuera** de `renderSidebar`.

**Código muerto que se borró**: `calcularTiposEvento` quedó huérfana al reemplazarla 857. El repo
arrastra 12 JS huérfanos; no se suma otro.

**La lección del paquete: un check que se satisface a sí mismo**

El comentario que explica el arreglo en el CSS dice literalmente `` `overflow-y: auto` ``, y el check
buscaba ese texto sobre el CSS crudo: **se encontraba a sí mismo en la nota al lado** y pasaba
aunque la declaración real estuviera rota. Lo delató una mutación que decía "no muerde". Documentado
en `PROMPT.md` §5.15.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-tipos-evento-857.js` | 37/37 | **14/14** (4 de CSS: el layout es media parte del bug) |
| `test-tipos-evento-856.js` | 32/32 | **10/10** |
| `test-bandeja-sidebar-850.js` | 49/49 | **21/21** (check de overflow invertido) |
| `test-minical-844.js` | 27/27 | — sin cambios |
| Los otros 6 de bandeja | todos verdes | — |

Suite completa: 115 tests, 97 verdes, 18 preexistentes, **0 regresiones**.

---

---

### 2026-10-03 · La bandeja abre en blanco (📦855)

**Qué se hizo**

| Qué | Detalle |
|---|---|
| `init()` | Ya no hace `selectMail(state.mails[0].id)`. Arranca con `selectedMailId = null` |
| Respaldo `"m1"` | Fuera. Era un id de mock: sin correos la app apuntaba a un mensaje inexistente |
| Filtro | El predicado vive en `mailPasaFiltroActual(m)`, en un solo lugar y al nivel correcto |
| Cambio de filtro | `setMailFilter(f)` centraliza los 3 caminos; suelta la selección que quedó fuera |

**Los dos bugs que lo causaban**

1. `init()` elegía el primer correo y `selectMail` lo marcaba como leído: **abrir la app metía un
   correo a leídos sin que nadie lo abriera**, y no era el más reciente sino `mails[0]`.
2. `renderMailDetail` buscaba el seleccionado en `state.mails` **sin mirar el filtro**, mientras la
   lista sí lo miraba. De ahí que el panel mostrara un correo que la lista ya no enseñaba — literal,
   la captura: "Prueba 5" abierta con otros cuatro en la lista.

**La lección — un error de alcance no lo caza `node --check`**

El predicado se declaró primero **dentro** de `renderMailList`, y `setMailFilter` vive en otro
nivel. Sintácticamente válido, se ve bien al leerlo… y al tocar un chip de filtro saltaba un
`ReferenceError` que congelaba la bandeja. Lo detectó el test, al no poder armar su sandbox. Quedó
un check que falla si alguien vuelve a anidarlo.

**La lección — un check que reconoce la redacción de un bug no verifica el comportamiento**

Dos checks de 📦853 buscaban el texto exacto `state.mailFilter = "unread";`. Si alguien
reintrodujera el auto-selección con otra redacción, el check pasaba igual. Se reemplazaron por uno
que pregunta *"¿la selección se deriva alguna vez de `state.mails`?"*, que no depende de cómo esté
escrito.

**Ojo con esto al retomar**: la validación de la selección vive en `setMailFilter`, **no** en
`renderMailDetail`, a propósito. Si se mueve al render, al hacer clic en un no leído —que al
abrirse marca leído— el correo se borra de la pantalla en el mismo clic en que se lo está leyendo.
Hay un check que lo impide.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-bandeja-seleccion-855.js` | 25/25 | **10/10** |
| `test-bandeja-tudia-853.js` | 76/76 | **35/35** |
| `test-bandeja-tudia-849.js` | 50/50 | — (check invertido) |
| `test-bandeja-premium-v2.js` | 48/48 | — |
| `test-bandeja-toolbar-compacta.js` | 51/51 | — |
| `test-bandeja-chip-851.js` | 16/16 | 9/9 |

Suite completa: 113 tests, 95 verdes, 18 preexistentes, **0 regresiones**.

---

### 2026-10-03 · Alertas de "Tu día" (📦853)

**Qué se hizo**

| Qué | Detalle |
|---|---|
| Clic de "Correos no leídos" | Antes solo cambiaba de vista; ahora aplica `setMailFilter("unread")` y marca lo visto |
| Filtro "No leídos" | Subió del menú "Más" a la barra visible: `PRIMARY_FILTERS = ["all","unread","sent"]` |
| Aviso de novedad | **Réplica exacta del 99+** del shell, colgada de la esquina de la fila |
| Al hacer clic | Marca las notificaciones de **correo** como leídas → **baja el pillón y el 99+** |
| "Invitaciones pendientes" | **Retirada** |

**Por qué** — El owner pidió que "Tu día" avisara lo que llega "como se ve arriba en el icono de la
Bandeja Integrada", y al hacer clic en los no leídos se mostrara esa lista y no la bandeja completa.

**📦854 · Lo que cambió cuando el owner mandó a investigar de verdad**

Las dos primeras versiones del aviso se hicieron "a ojo", copiando lo que se veía en la captura. El
owner las rechazó y dijo: *"investigá cómo está construido ese sistema y replicálo"*. Al investigar:

- **El 99+ no es un badge, es un servicio.** `main/notifications-service.js` corre cada 60s;
  `main/notifications-email.js` busca `email_threads WHERE has_unread = 1` e inserta filas en la
  tabla `notificaciones` con `dedupe_key` única; emite `notificaciones:changed`; el `renderer.js`
  pinta el badge y el toast. El número viene de esa tabla, no de Gmail.
- **Lo que yo había hecho era un contador paralelo.** Usaba `localStorage` sobre `state.mails`: no
  tocaba la tabla, no hablaba con el 99+, y mostraba un número distinto al de arriba. Con lo cual
  el aviso de "Tu día" y el del botón **no podían bajar juntos**, porque eran dos cosas sin relación.

**La réplica quedó en tres piezas:**

| Pieza | Qué hace |
|---|---|
| El pillón | Cuelga de la **esquina de la fila** (como el 99+ del botón) con los **9 valores** copiados de `.kair-cal-badge` |
| El clic | `_marcarNotifsCorreoLeidas()` lista con `soloNoLeidas` + `limit: 50` (el mismo payload de `kair-alerts.js:206-212`), filtra `tipo === "correo"` y marca por `notificaciones:marcarLeida` |
| El refresco | `KA.refresh()` después de marcar, para que el 99+ baje ya y no al próximo tick de 60s |

**A propósito NO se usa `marcarTodas`**: taparía también los eventos, y mirar el correo no es lo
mismo que decir "ya vi los eventos". El número grande sigue viniendo de **Gmail**, independiente del
servicio de notificaciones (decisión del owner).

**El bug de fondo que destapó la investigación** — la tabla `notificaciones` tenía:

| | |
|---|---|
| Filas | 78 |
| Sin leer | **77** — de las cuales **61 correos** |
| Marcadas como leídas | **1 en toda la historia** |

**El 99+ no podía bajar nunca**, porque nada marcaba esas filas. Ahora "Tu día" es donde se marcan.

**Corrección de rumbo** — La primera implementación metió un **switch** para encender/apagar las
alertas. El owner lo rechazó: *"no quiero un switch, quiero este tipo de alerta visual"* (con la
captura del pillón 99+). Se quitó el switch completo —botón, `role="switch"`, `aria-checked`, clave
`TUDIA_ALERTAS`, helpers `_alertasTuDiaOn`/`_setAlertasTuDia` y sus reglas CSS— y se puso el pillón.
La **línea base de lo visto** (`kair-bandeja.tuDiaVistos`) sí se conservó: es lo que hace que el
número sea "cuántos son nuevos" y no "cuántos hay en total".

**El pillón se ve igual que el 99+ del shell a propósito.** Copió de `.kair-cal-badge`
(`styles.css:6121`): mismo rojo `#dc3545`, misma proporción de radio, misma sombra
`0 1px 3px rgba(0,0,0,.25)`, mismo número blanco bold, y tope 99+. El owner ya reconoce ese rojo
como "llegó algo"; uno nuevo habría tenido que aprenderlo. Va dentro de un envoltorio con
`position: relative` porque si se anclara a la fila quedaría en la esquina de las 250px del sidebar
en vez de encima del ícono, que es donde el ojo ya está mirando.

**Diagnóstico hecho ANTES de codear** (esto es lo que sostuvo el trabajo)

1. `render-mail-list.js` **ya tenía** un filtro "No leídos" escrito — y **no está cargado** en
   `index.html`. Es uno de los 12 JS huérfanos (bloqueante #4). La lógica buena existía en dos
   lugares: la muerta y la viva.
2. `PRIMARY_FILTERS = ["all", "sent"]` era lo que escondía el filtro. El filtro estaba en
   `filterDefs` y la lista lo respetaba; lo que faltaba era un camino desde la pantalla.
3. **"Invitaciones pendientes" nunca pudo tener dato.** `meetingSuggestion` se lee en 4 lugares y
   **no se escribe en ninguno**: solo existe en los correos de ejemplo de `data.js`.
4. **La BD real no tiene eventos de hoy.** Se consultaron las **76 tablas** de `kair.db`: 0 filas
   con la fecha de hoy. `eventos_rapidos` tiene 5 filas, la última del 12 de agosto. Los eventos
   del calendario vienen de **Google Calendar**.
5. **Bomba armada en `app.js:1286`:** si el adaptador local devuelve 0 eventos, hace
   `return D.EVENTS.slice()` — los **datos de ejemplo de julio** — y nunca llega a consultar
   Google. No se dispara hoy, pero si la BD queda vacía el calendario muestra mails de ejemplo.

**Bugs que salieron de los tests, no de mirar la pantalla**

1. La animación del badge quedó en **420ms**, violando la regla del repo de "<300ms". El check lo
   detectó y se bajó a 240ms.
2. **3 regresiones** al cambiar el contrato: `test-bandeja-tudia-849.js`,
   `test-bandeja-premium-v2.js` y `test-bandeja-toolbar-compacta.js` afirmaban "los 3 indicadores"
   y "solo Recibidos y Enviados". Los 3 se **invirtieron**, no se borraron.
3. `test-bandeja-tudia-849.js` crasheó: corre `calcularIndicadores` en un sandbox y la función pasó
   a depender de 4 helpers nuevos. Se traen los **helpers reales** desde `app.js` en vez de
   stubearlos: un stub que devolviera 0 siempre haría pasar el cálculo de "nuevo" sin comprobarlo.
4. Un check de "detiene la propagación" **no miraba `stopPropagation`**: miraba que
   `_setAlertasTuDia` siguiera a `renderSidebar`. Existía y nunca comprobó lo que decía comprobar.
   Lo detectó la mutación que saca el `stopPropagation`.
5. Un check **constante-falso**: se escribió `\bspill\b` cuando la variable se llama `pill`. Como
   nunca matcheaba, fallaba siempre — y las mutaciones se reportaban como "detectadas" aunque el
   check no comprobaba nada. Se vio porque el test quedó rojo sobre el código **correcto**.

**El bug que solo apareció probando la app** (y que los tests NO cazaron)

El owner lo probó y el pillón **no apareció** al llegar un correo. La causa era de diseño:

- La línea base de "lo visto" **solo se escribía al hacer clic** en el indicador.
- Un owner que nunca hace clic se queda **sin línea base para siempre**.
- Sin línea base, `nuevo` da 0 siempre → el aviso era indistinguible de "no hay nada".
- Los tests estaban en verde porque **todos sembraban el `localStorage` antes de mirar el
  resultado**: probaban el caso fácil y dejaban el difícil sin ver.

**La solución tiene dos partes, y la segunda es la que faltaba:**

1. `init()` siembra la línea base con el número actual, **después** de cargar correos y eventos
   (sembrarla antes leería un `state.mails` vacío y guardaría 0, con lo cual todo lo que el owner
   ya tenía se le contaría como nuevo al abrir).
2. Un **escenario funcional** que arranca de un `localStorage` **vacío**, siembra, simula la
   llegada de un correo y exige que marque 1. Más un check que ata la siembra a `init()`, porque el
   bloque funcional llama a `_sembrarVistos()` a mano y por sí solo no comprueba que nadie la
   invoque en el arranque.

**El segundo bug que solo apareció probando la app** (este NO era lógica, era visual)

El owner volvió a probar y dijo: *"se actualiza correctamente mostrando los nuevos correos, pero no
se refleja lo deseado... muestre el contador 2, 3, 4 y el efecto rojo"*. O sea: el número llega
bien, **pero no se ve**.

- La primera versión tenía **una sola capa de aviso**: el número, a 9.5px, sobre un ícono de fondo
  azul clarito, sin sombra que lo despegara.
- Con una sola capa hace falta que el ojo **ya esté en esa fila**. Y "Tu día" se mira de reojo.
- El badge del shell que el owner señaló como referencia es 18px de alto, con sombra fuerte y
  tipografía pesada. Lo que hace que se note no es el número, es el **peso visual** del bloque.

**Ahora hay tres capas**, y con que se vea una sola ya se nota:

| Capa | Qué hace |
|---|---|
| 1 | La **fila completa** se tiñe de `--kair-red-soft` con una barra roja de 3px a la izquierda |
| 2 | El **ícono** se tiñe más fuerte (`#f8d3d8` con glifo `#a3212f`) |
| 3 | El **pillón**: 22×19px, `font-size: 11px`, `font-weight: 800`, **anillo blanco de 2px** |

El **anillo blanco** fue la pieza que faltaba: un rojo sobre un azul clarito se pierde, y el blanco
es lo que lo despega del fondo. La barra roja va inset (`top/bottom: 4px`) con radio de un solo
lado, porque pegada a los bordes asomaba por las esquinas redondeadas de la fila. Y la fila con
novedad conserva su feedback de hover, que el fondo rojo tapaba.

**La lección**: "el número está bien" y "se ve" son dos cosas distintas, y ningún test de lógica
distingue entre ellas. Un aviso que solo cambia un texto de 9.5px puede ser **correcto y
perceptualmente invisible**. La prueba de un aviso visual es que el owner lo vea, y la primera
prueba manual es la que lo destapó.

**La lección**: un test que siembra el estado antes de arrancar prueba el camino feliz por
construcción. El escenario que hay que probar es el que empieza **sin nada**.

**La segunda corrección del mismo bug: la línea base solo subía**

La primera corrección (sembrarla en `init()`) era necesaria pero no alcanzaba. Quedaba esta: el aviso
marcaba bien mientras el número **subiera**, y se apagaba en cuanto bajaba. La causa era que la
línea base guardada nunca se ajustaba hacia abajo.

| Momento | Sin leídos | Línea base | `nuevo` | Lo que veía el owner |
|---|---|---|---|---|
| Hizo clic | 4 | 4 | 0 | normal |
| Leyó en el celular | 0 | **4** (congelada) | 0 | normal |
| Llegó un correo nuevo | 1 | **4** | `max(0, 1-4)` = **0** | **no avisaba** |

Tenía que juntar **5 sin leídos** para que el aviso volviera a prender. Y despachar el correo
fuera de la app es exactamente como el owner lo hace: no era un caso raro, era el camino de todos
los días. El arreglo son dos líneas: cuando `actual < visto`, la base se reancla a `actual`, porque
si el número actual cayó por debajo de lo visto, ya no hay nada pendiente de su lado.

**Cómo se destapó, que es la parte importante**: el test ya tenía la comprobación *"si baja de la
línea base el aviso es 0, nunca negativo"*, y pasaba. El bug estaba **después** de ese `0`: la
comprobación miraba el valor instantáneo y se detenía ahí, sin preguntar qué pasaba en el paso
siguiente. Un test que afirma una propiedad en un instante no dice nada sobre la transición.

**La lección general**: cuando un contador o un aviso dependa de un valor previo, comprobar `f(x)`
no basta — hay que comprobar `f(x)` **y** `f(lo que viene después de x)`. El valor en sí puede ser
correcto y la transición estar rota. Es el mismo patrón del "mutante vacío": el test verde sobre
un caso que nunca se ejerce.

**Decisiones del owner** (no volver a preguntar)

- El toggle es un **switch que enciende/apaga las alertas**, no un filtro.
  → **CORREGIDO en la revisión siguiente**: el owner rechazó el switch y pidió el pillón.
- **"Invitaciones pendientes" se oculta** hasta que tenga fuente real (parseo del `.ics`).
- El aviso es el **PILLÓN rojo, no un switch**. La primera versión con switch fue rechazada.
- El **número grande sigue viniendo de Gmail**, independiente del servicio de notificaciones
  (*"este es independiente de las notificaciones, es para el correo"*).
- Al hacer clic se **marcan como leídas, y el 99+ también baja**.
- Cuando un aviso **parezca** a otro, hay que **investigar cómo está construido el otro**, no copiar
  lo que se ve. Tres versiones seguidas salieron de "copiar la captura" y las tres quedaron mal; la
  cuarta salió de leer el servicio.
- Se preguntó antes de codear y se procedió a ejecutar después del OK.
- **El aviso es el PILLÓN rojo, no un switch.** La primera versión con switch fue rechazada.

**Tests**

| Archivo | Checks | Mutation |
|---|---|---|
| `test-bandeja-tudia-853.js` | 75/75 | **35/35** |
| `test-bandeja-tudia-849.js` | 49/49 | — (checks invertidos + sandbox con el helper de 📦854) |
| `test-bandeja-premium-v2.js` | 48/48 | — (check invertido) |
| `test-bandeja-toolbar-compacta.js` | 51/51 | — (check invertido) |

Suite completa: 112 tests, 94 verdes, 18 preexistentes, **0 regresiones**.

---

### 2026-10-03 · Documentación (📦852)

**Qué se hizo** — tanda de mantenimiento documental puro. **Cero cambios en la app.**

| Qué | Detalle |
|---|---|
| Auditoría completa | Toda la documentación contrastada contra el código real |
| Reglas falsas eliminadas | `KairUI.esc()`, `KairHelpers.formatDate()`, "var no let/const", "último 📦579" |
| `PROMPT.md` v2.0 | Índice que referencia en vez de duplicar; documenta las 3 islas de paleta |
| `Historial.md` y `CLAUDE.md` | Nuevos, en la raíz del repo |
| `CONTEXT.md` | 68 líneas gigantes → 1 318 legibles, **md5 idéntico**, 0 caracteres perdidos |
| 3 trampas de `AGENTS.md` | Corregidas, incluida la del CSS que nunca existió |
| `PRODUCT.md` | Paleta, tipografía, dark mode y 2 afirmaciones falsas |
| Bump | `0.1.233` → `0.1.234` |

**Por qué** — la documentación era la fuente de verdad y mentía. Un modelo que siguiera sus reglas
al pie de la letra escribía llamadas a funciones inexistentes y la vista se caía.

**Bugs encontrados** — ninguno estaba en el código, todos los encontró la verificación:

1. **Un script de documentación iba a destruir el CHANGELOG.** Reemplazaba el encabezado
   `## [0.1.233]` sin reponerlo: las entradas 📦850 y 📦851 quedaban sin encabezado, absorbidas
   dentro de 0.1.234, y el script reportaba `OK`. Un encabezado no es una línea más — perderlo
   deja huérfano todo lo que viene después.
2. **La afirmación "ese CSS nunca estuvo en el repo" se verificó contra los 1 244 commits** de
   todas las ramas, no solo contra el árbol actual. Sin eso habría sido una presunción.
3. **Mi propio verificador mintió**: marcó "FALTA" a 3 documentos que sí existían, porque los
   buscó en `sgsst-electron-app/` y están en la raíz del repo.
4. **Dos palabras pegadas y dos términos en inglés** que casi van al CHANGELOG público.

**Decisiones del owner** (no volver a preguntar)

- Las **validaciones visuales** de v0.1.214, v0.1.215, 📦850 y 📦851 **ya fueron revisadas** y no
  tienen observaciones registradas. **No queda ninguna abierta.**
- Documentos nuevos en la **raíz del repo**, versionados junto a `PRODUCT.md`.
- "Nada es una regla hasta comprobarlo en el código" — regla de primer orden, no opcional.

**Tests** — ninguno nuevo. Suite sin cambios: 111 tests, 93 verdes, 18 preexistentes.

---

### 2026-10-09 · 📦881 · Bloque legal de la Ley 1581 (sin bump de versión)

**Qué se hizo** — una sola línea de trabajo con dos caras:

| Zona | Qué |
|---|---|
| `sgsst-electron-app/index.html` | El texto del consentimiento decía tratar **"historias clínicas, audiometrías, electrocardiogramas"**. K+AIR no maneja esos datos. Reemplazado por los que sí registra: **seguimientos médicos, consultas y certificados de aptitud médica** |
| `sgsst-electron-app/index.html` | Se separaron las dos autorizaciones del **art. 6**: datos personales → *previa*, expresa e informada; datos sensibles → *expresa e informada*. Antes decía que ambas eran "previas" |
| `sgsst-electron-app/index.html` | Se declaró el **art. 25**: la empresa que usa K+AIR es **responsable**, K+AIR es **encargado** |
| `sgsst-electron-app/styles.css` | Nueva clase `.kair-consent__aviso` (caja ámbar con borde izquierdo) |
| `sitio/anexo-encargo.html` | **Nuevo.** Anexo de Encargo de Tratamiento de Datos Personales (Decreto 1377) |
| `sitio/autorizacion-trabajadores.html` | **Nuevo.** Formato de autorización de trabajadores |
| `sitio/privacidad.html` | +127/-: párrafos de encargado y enlaces a los dos documentos nuevos |
| `sitio/terminos.html` | +85/-: párrafos de encargado y enlaces a los dos documentos nuevos |

**Por qué** — el consentimiento describía una app que atiende historias clínicas y ECG, y K+AIR no es eso. Un texto legal que miente sobre el tratamiento de datos sensibles es peor que uno vago: es el que se puedecuestionar.

**Verificaciones hechas antes de commitear** — ninguna asumida:

1. Los dos documentos nuevos **no están huérfanos**: ambos aparecen en la barra de navegación de `privacidad.html` y `terminos.html` (líneas 25-26) y se enlazan entre sí.
2. `sitio/index.html` **no** los enlaza. Aceptado: el par privacidad/términos actúa de hub, igual que ya pasaba con `soporte.html`.
3. `Dev` y `Dev-Pc` están **idénticas** (`git rev-list --count` da 0 en cada dirección), así que commitear en `Dev-Pc` no genera divergencia.
4. Local y remoto estaban sincronizados **antes** de tocar nada (0 y 0), lo que descarta que estos cambios vinieran de otra máquina.

**🔴 Hallazgo pendiente — CSS muerto.** `.kair-consent__aviso` se define en `styles.css:8961` y **no se referencia en ningún archivo del repo** (`grep` sobre `sgsst-electron-app/` devuelve un solo resultado: su propia definición). La clase parece creada para una caja de aviso en el modal que **nunca se agregó al HTML**. Se decidió **no borrarla ni usarla** en este commit: borrarla sería interpretar una intención que no está escrita, y usarla sería meter UI nueva en un flujo legal sin consultar. **Decisión del owner pendiente:** ¿se agrega el aviso al modal o se quita la clase?

**Tests** — ninguno nuevo. No hay suite que corra sobre `sitio/`, y la app solo cambió texto y una clase CSS sin uso. El estado de la suite sigue siendo el del 2026-10-07: **no se remedido**.

**Decisiones del owner** — la versión **no se bumpea**: `0.1.251` sigue igual, por la regla del 2026-10-07 ("la versión SOLO se bumpea cuando él lo diga"). El CHANGELOG tampoco se tocó: registra **versiones publicadas**, y esto todavía no está publicado — igual que el commit legal anterior `2ace3131`, que solo tocó `sitio/`.

**Commits** — uno solo, en `Dev-Pc`, con este mismo bloque de documentación.
---

### 2026-10-14 · 📦885 · El Panel de Control sigue el tema elegido (sin bump de versión)

**Qué se hizo** — el Panel de Control deja de estar pintado con la paleta clara en los dos modos
oscuros:

| Zona | Qué |
|---|---|
| `shared/kair-premium.css` | Nuevo bloque `[data-theme^="dark"]` al final del archivo. **141 líneas, puramente aditivo** |
| `index.html` | Cache-bust de `shared/kair-premium.css` a `20261014-panel885` |
| `main/test-panel-tema-885.js` | Test nuevo, 54 checks base |

**La causa, medida** — `shared/kair-premium.css` tenía **30 colores literales en 120 lugares y ni una
sola regla de tema**: cero `[data-theme]`, cero `prefers-color-scheme`. Las dos únicas reglas que sí
usaban tokens (`--kair-canvas` y `--kair-ink` en la raíz del bloque) los leían de `:root`, y
`kair-design-tokens.css` define la paleta **solo en `:root`**. El shell de alrededor sí tenía **439
bloques de tema** en `styles.css`: de ahí el marco oscuro rodeando un panel completamente blanco.

**Alcance verificado, no supuesto.** `.kair-premium` como clase wrapper se usa en **un solo sitio** de
todo el repo: `renderer.js:4766`. Los demás resultados del grep son `.kair-premium-strip`, que es otra
clase en módulos que no tienen que ver. El radio de impacto es exactamente el Panel de Control.

**Tres cosas que salieron mal al medirlas y quedaron corregidas.** No se escribió ningún color sin
comprobarlo, y las tres correcciones cambiaron el resultado:

1. **`--widget-bg-color` NO servía para la tarjeta.** En los dos temas oscuros es el **mismo color** que
   `--content-area-bg`, así que la tarjeta se fundía con el fondo. Las superficies se derivan de un velo
   de blanco al 5 % sobre el fondo del tema: da `#384151` en Sistema y `#292929` en Oscuro.
2. **`--text-lighter-color` NO pasa AA**: 3.61 en Sistema y 2.65 en Oscuro. Se dejó de usarlo y se
   redefinio `--kair-faint` por tema.
3. **Los tintes de chip al 18 % no pasaban**: el texto del chip caía a 4.23-4.35. Bajados al **8 %**, el
   peor caso es 4.73.

**El fondo usa el token del shell, `--content-area-bg`**, y no un hex propio: así el panel se pega al
chrome de su tema sin duplicar ningún valor.

**Sin `!important` en ninguna regla del bloque.** `[data-theme^="dark"] .kair-premium .x` es (0,2,1) contra
(0,2,0) de la regla clara, así que gana sola. El test falla si aparece uno.

**El tema claro no se tocó** y el bloque es aditivo: un check lee la parte clara del archivo y falla si
alguna vez declara una regla de tema. **`.kair-hero` tampoco**: su fondo es `#14213D` con texto blanco y
ya funciona en los tres temas.

**Contrastes medidos** (WCAG 2.1 AA, componiendo el `rgba()` antes de medir):

| | Sistema / Oscuro |
|---|---|
| título sobre tarjeta | 8.67 / 11.02 |
| subtítulo sobre tarjeta | 4.95 / 5.56 |
| terciario sobre tarjeta | 4.64 / 5.17 |
| acento sobre tarjeta | 4.02 / 5.43 |
| chip rojo (el peor caso) | 4.73 / 6.53 |

**Tests** — `test-panel-tema-885.js`: **54 checks base**, **15/15 mutaciones**, 0 vacías. El test no
comprueba "existe el bloque": **extrae las 58 clases que declaran color en la parte clara y exige que
cada una tenga contraparte oscura**, porque un check de existencia pasaría aunque se olvidara la mitad
de las tarjetas. Suite completa: **130 tests · 129 verdes · 1 con fallos**, cero regresiones.

**Artefacto** — `preview-panel-885.html` y `preview-panel-885-bajo.html`, generados por un script que lee
los archivos del disco y saca los iconos SVG de `renderer.js`. Cuatro paneles: ANTES (con el CSS de
HEAD), Sistema, Oscuro y Claro. El owner lo aprobó antes de commitear.

**Decisiones del owner** — se llevó el oscuro **completo**: superficies, texto, bordes y también los
tintes de los chips. Y se revisó **con artefacto antes de tocar el repo**, no directo en la app. La
versión **no se bumpea**: `0.1.251` sigue igual.

**Commits** — uno solo, con el código y la documentación juntos, en `Dev`. El hash no se escribe
aquí dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría apuntando a un
commit fantasma.

---

### 2026-10-14 · 📦887 · El módulo Recursos también sigue el tema (sin bump de versión)

**Qué se hizo** — el home de Recursos deja de quedar blanco en los dos modos oscuros, y con
él todo lo que consume los tokens `--kair-*`:

| Zona | Qué |
|---|---|
| `shared/kair-design-tokens.css` | **Dos bloques de tema nuevos**, `[data-theme="dark"]` y `[data-theme="dark-legacy"]`. **32 tokens de color, los dos.** Aditivos: `:root` no cambia |
| `shared/kair-components.css` | **Bloque `[data-theme^="dark"]`** para los once selectores que tenían el color escrito a mano. Ese archivo no tenía ni una regla de tema |
| `modules/recursos/recursos-home.js` | Ocho colores **inline** pasados a token. Un estilo en línea gana a cualquier hoja de estilo, así que por muchos tokens que se definan, esos ocho seguían grises sobre la tarjeta oscura |
| `index.html` | Cache-bust de los tres a `20261014-recursos887` y `RECURSOS-20261014-tema887` |
| `main/test-tokens-tema-887.js` | Test nuevo |

**La causa, medida** — no faltaban estilos oscuros: **el color nunca se definía por tema**.
`shared/kair-design-tokens.css` definía **treinta tokens de color en `:root` y cero
variantes**, y `shared/kair-components.css`, donde viven 25 de las 46 clases del home,
**no tenía ni una regla de tema**. Los dos archivos se cargan en `index.html` en las
líneas 71 y 72, o sea que **el módulo Recursos no carga ni un CSS propio**: lo que se ve
ahí viene entero de la base compartida.

**LA CAUSA DE VERDAD: LA CASCADA (esto es lo que faltó en el primer diagnóstico)**
— el diagnóstico de arriba es cierto pero **no era la razón de que las tarjetas salieran
blancas**. Los tokens oscuros sí se estaban entregando. Lo que pasaba es que **dos CSS de
módulo le ganaban la cascada**:

| Archivo | Qué declara | Se carga en |
|---|---|---|
| `modules/gestion-peligros/inspecciones/inspeccion.css` | `:root { --kair-card:#ffffff; --kair-text:#1a1a2e; --kair-shadow-card:… }` | `index.html:552` |
| `modules/verificacion/revision-alta-direccion/revision-alta-direccion.css` | `:root { --kair-surface:#ffffff; --kair-text:#212529; … }` | `index.html:490` |

`:root` y `[data-theme="dark"]` **empatan en especificidad (0,1,0)** y los dos matchean
`<html>`, así que **gana el que se carga último**. Los tokens del 887 se cargan en la línea
71; esos dos, en la 490 y la 552. Resultado: en los dos modos oscuros `--kair-card`
resolvía a `#ffffff` y `--kair-text` a `#1a1a2e`. Por eso las tarjetas salían blancas
**con el rótulo gris encima**: el `.kair-metric-head` sí tomaba `--kair-faint`, pero
`#9fb0c4` sobre blanco es casi ilegible. Es exactamente lo que se vio en las capturas.

Lo que lo prueba es que el **preview se veía bien y la app no**, y la diferencia estaba en
el preview: la primera versión armaba un bloque oscuro escrito a mano y **no cargaba el
`<style>` que `recursos-home.js` inyecta en runtime**, ni los `:root` tardíos. Era media
app. El artefacto se rehizo para usar los archivos reales en el orden real de `index.html`;
con esa corrección, el panel "antes" reproduce la captura del owner y el "después" ya sale
bien.

**El arreglo** — los dos bloques oscuros de `shared/kair-design-tokens.css` llevan ahora
también `:root[data-theme="dark"]` / `:root[data-theme="dark-legacy"]`, que valen **(0,2,0)**
y ganan contra cualquier `:root` sin importar el orden de carga. Se conserva el selector
pelado por si algún contenedor (y no `<html>`) lleva el atributo. El tema claro no se toca.

> La fuga de scope es de esos dos módulos, no de los tokens: el propio encabezado de
> `inspeccion.css` dice *"Scope en `.kair-app`"* y su bloque oscuro sí está scopado a
> `.kair-app`; lo que se escapa es el `:root` **claro**. Se corrige del lado de los tokens
> porque es el que no depende de ningún módulo.

Del home: 46 clases, **31 sin contraparte oscura**. De esas, **17 leen tokens** — o sea que
definir el token las arregla — y 6 tenían el color escrito a mano.

**El hallazgo más grande, y es de otro submódulo** — `capacitaciones-view.css` tiene **47
reglas de tema que no existen**. Apuntan a `.capacitaciones-container[data-theme="dark"]` y
fallan por partida doble:

1. El atributo `data-theme` se aplica a `document.documentElement` (`renderer.js`
   líneas 756, 762, 812, 820, 1719 y 1726), o sea a **`<html>`**. Nunca al contenedor.
2. La clase `.capacitaciones-container` **no existe** en el HTML de la vista.

O sea que **alguien ya había escrito el arreglo oscuro completo y no aplicaba nada** —
incluidos `--kair-card: #2d3748` y el `.kair-metric-head` que se ve gris sobre blanco. El
mismo error aparece una vez en `objetivos-sst-view.css`. **48 reglas muertas en el repo.**

En cambio **17 viewers sí hacen bien lo de poner el atributo en su contenedor**, y por eso
10 de los 14 CSS de submódulos sí tienen tema y funcionan. Los cuatro que no:
`copasst-home.css`, `comite-convivencia-home.css`, `inducciones-view.css` y
`roles-responsabilidades-view.css` (este último con **147 colores literales y cero
tokens**).

**La paleta, medida** — el thumb, el texto y el terciario se Taking del 📦884 y el 📦885, que
ya los midieron, para que el tema oscuro sea uno solo y no tres paletas parecidas. La
tarjeta usa **el mismo velo de blanco al 5 % que el Panel de Control desde el 885**, así que
el home y el panel se ven iguales. Contra la tarjeta real de cada tema:

| Medida | Sistema | Negro/Gris | Mínimo |
|---|---|---|---|
| Texto principal | 8.67 | 11.02 | 4.5 |
| Texto secundario | 4.95 | 5.56 | 4.5 |
| Texto auxiliar | 4.64 | 5.17 | 4.5 |
| Chip sobre su tinte | 7.34 | 7.34 | 4.5 |
| Acento azul | 3.95 | 6.96 | 3 |

Los bordes quedan por debajo de 3:1 (1.37 y 1.40) **a propósito**: WCAG 1.4.11 pide eso para
componentes de interfaz y estados, y un borde decorativo de tarjeta no es ninguno de los
dos. La separación la hace la propia superficie.

**Sobre 884 y 885** — estos tokens son de alcance general y los dos paquetes anteriores pisan
con selectores **más específicos** (`[data-theme^="dark"] #sidebar` y `[data-theme="dark"]
.kair-premium`). Los dos siguen mandando en su scope. El test lo comprueba.

**Un tropiezo propio, anotado para que no se repita** — al cambiar un color dentro de un
`style="..."` de `recursos-home.js`, un Edit metió el comentario **dentro del string** y
partió la línea de JavaScript en dos. Se detectó leyendo el diff, se restauró con
`git checkout` y se rehizo con el valor solo. **`node --check` sobre el archivo es la
verificación que faltaba** y ahora está en el flujo.

**Un segundo test frágil, este ya venía del repo** — bumpear el token de `recursos-home.js`
tumbó `test-chart-overflow.js` (19/20), porque su check tenía **el literal del token de los
siete homes** escrito a mano. El mismo repo ya había detectado y arreglado ese defecto en el
check vecino de `kair-components.css` — el comentario de las líneas 156-157 lo dice — pero no
lo aplicó al de los homes. Se aplicó el mismo criterio: ahora se pregunta si el token **tiene
forma** `PREFIJO-AAAAMMDD-descripcion`, no si es un valor concreto. Sigue detectando un home
sin versionar, que es lo que importa, y ya no se cae con el próximo paquete que toque uno.

**Tests** — `test-tokens-tema-887.js`: **100 checks base**, **22/22 mutaciones**, 0 vacías.
Contra el código anterior da **30/69**: el test detecta el bug. Cuatro cosas que un check de
"existe el bloque oscuro" no comprobaría:

1. **Cobertura.** Extrae los 32 tokens de color de `:root` y exige que **cada uno** tenga
   variante en los dos temas, y que **sea distinta** del claro. Si no, el bloque "existe" y
   media pantalla sigue blanca. Este check encontró un hueco real: `--kair-mint` se había
   quedado sin definir.
2. **Que el tema claro no se tocara.** Verifica uno por uno los doce valores originales de
   `:root`. Es un bloque aditivo y esto lo blinda.
3. **Que el contraste siga pasando.** Recalculado contra la tarjeta real, componiendo el velo.
4. **La cascada.** Exige que los dos bloques oscuros lleven `:root[data-theme=...]` (o sea,
   (0,2,0)) y que el selector pelado se conserve. Hay dos mutaciones que lo desarman y las dos
   muerden.

**Artefacto** — `preview-recursos-887.html`, generado por un script que lee los archivos del
disco y pone sus huellas SHA-256 en el pie. Cada tema en su propio `iframe` con `srcdoc`
porque el atributo vive en `<html>` y poner dos temas en una página mostraría algo que la app
nunca muestra. El owner lo aprobó antes de que se escribiera nada.

> **El artefacto se rehizo después de ver la app.** La primera versión se veía bien y la app
> no, y la diferencia estaba en el preview: armaba un bloque oscuro a mano y **no cargaba el
> `<style>` que `recursos-home.js` inyecta en runtime**, ni los dos `:root` tardíos. Era media
> app. El generador nuevo carga los archivos reales **en el orden real de `index.html`** y trae
> la hoja inyectada del módulo tal cual (16 506 caracteres leídos del disco). Con eso, el panel
> "antes" reproduce exactamente las capturas del owner y el "después" sale bien. Verificado en
> el navegador.

**Hallazgo colateral que NO se tocó** — en el **tema claro** hay texto que no pasa AA sobre
tarjeta blanca: `--kair-muted` da 3.98:1, `--kair-faint` **2.16:1** y `--kair-text-3`
2.58:1. El breadcrumb usa `--kair-faint`, o sea que hoy es casi ilegible en claro. Es
preexistente y de otro alcance: este paquete solo define las variantes oscuras. En el tema
Negro/Gris la tarjeta queda a **1.29:1** del fondo — es el mismo valor que ya aprobó el 885,
así que se mantiene igual y queda anotado como mejora futura.

**Commits** — uno solo, con el código y la documentación juntos, en `Dev`. El hash no se
escribe aquí dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría
apuntando a un commit fantasma.

---

### 2026-10-14 · 📦886 · Las barras de desplazamiento siguen el tema elegido (sin bump de versión)

**Qué se hizo** — la barra blanca sobre el fondo oscuro desaparece. La barra de
desplazamiento ahora toma su color de tokens que sí tienen variante por tema:

| Zona | Qué |
|---|---|
| `styles.css` | Tokens `--kair-scrollbar-thumb` / `--kair-scrollbar-track` en los tres bloques de tema; la regla global pasa a leerlos; los homes de los cuatro módulos principales dejan el `rgba(0,0,0,0.25)` fijo; y un override para Carpetas. Se **borraron 9** reglas `::-webkit-scrollbar` |
| `development-styles.css` | **7** reglas borradas, incluidas las tres `[data-theme="dark"]` que ya pretendían el oscuro |
| `modules/verificacion/definicion-indicadores/definicion-indicadores.css` | **12** reglas borradas |
| `modules/gestion-humana/carpetas/index.css` | **4** reglas borradas |
| `modules/gestion-humana/dashboard/index.css` | **4** reglas borradas |
| `modules/gestion-peligros/inspecciones/inspeccion.css` | **4** reglas borradas |
| `modules/gestion-peligros/mantenimiento/mantenimiento.css` | **4** reglas borradas |
| `index.html` | Cache-bust de los seis CSS a `20261014-scrollbar886` |
| `main/test-scrollbar-tema-886.js` | Test nuevo |

**La causa, medida** — no faltaba una regla oscura: **faltaba el concepto**. La
regla global de `styles.css` traía el par `#c1c9d0 / #f8f9fa` fijo, sin variante,
y ese par era lo que se veía en los tres temas.

Lo que hace el bug confuso es que **el archivo sí parecía tener el arreglo**:
había **44 reglas `::-webkit-scrollbar`** repartidas en los 7 CSS que `index.html`
carga, tres de ellas con su bloque `[data-theme="dark"]` propio. **Ninguna se
dibujaba.** La razón se comprobó en el navegador y no es de especificidad:
**cuando existe `scrollbar-color`, Chromium ignora todos los pseudo-elementos
`::-webkit-scrollbar`**, sin importar qué tan específico sea el selector. Se
montaron dos cajas idénticas salvo por tener, además del global, un thumb verde y
una pista negra: **se vieron iguales**. El `width: 8px` tampoco se aplicaba.

Por eso el arreglo fue **borrar** esas 44 reglas y no corregirlas: no se dibujaban,
y suhover y su `:active` no podían pasar de 2:1 de contraste.

**La paleta, medida** — el thumb de cada tema oscuro es su `--kair-faint`, el mismo
gris que el 📦885 dejó como texto secundario. Contra la superficie **más clara** de
cada tema, que es lo que importa (WCAG 1.4.11 pide 3:1 en componentes de interfaz):

| Tema | Thumb | Peor superficie | Resto |
|---|---|---|---|
| Oscuro (Sistema) | `#9fb0c4` | **3.40** contra `--border-color` #4a5568 | 4.64 tarjeta #384151 · 5.41 área #2d3748 · 7.37 fondo #1a202c |
| Oscuro (Negro/Gris) | `#9a9a9a` | **3.68** contra `--border-color` #404040 | 5.17 tarjeta #292929 · 5.92 área #1e1e1e · 6.66 fondo #121212 |

Las tarjetas del Panel se miden **componiendo** el velo de blanco al 5 % sobre el
fondo del área; sin componer, el número es falso. La **pista va transparente** en
los dos temas oscuros: así se ve la superficie real en vez de taparla con un
rectángulo de color, y de paso no aparece el problema de una pista casi invisible
contra el fondo. En **tema claro no se cambió nada**: el par sigue siendo
`#c1c9d0 / #f8f9fa`.

**Un detalle de especificidad** — `.carp-scope .carp-wrapper` (Carpetas) trae su
propio `scrollbar-color: #c1c8d0` con especificidad (0,2,0), que le gana al global.
Por eso en `styles.css` hay un bloque `[data-theme^="dark"] .carp-scope .carp-wrapper`
de (0,3,0): solo actúa en oscuro y **no toca el tema claro**, donde sigue mandando
el valor del módulo.

**Lo que NO se tocó, y por qué** — borrar de más rompe páginas enteras. El inventario
se rehízo **sin lista escrita a mano**: se recorren los 82 CSS y los 89 HTML del
proyecto, y cada CSS con `::-webkit-scrollbar` se clasifica según qué documento lo
cargue y si ese documento trae `styles.css`.

- **25 archivos con reglas VIVAS**: son las vistas `*-view.css`. Se abren como
  página aparte (`politica-logic.js` construye la URL y la navega), no se inyectan
  en el shell, así que **no reciben `styles.css`** y ahí sus reglas sí pintan.
- **5 archivos huérfanos**: nadie los carga. Uno de ellos es
  `modules/gestion-humana/documentos/index.css`, y no es un descuido: `index.html`
  lo dice en su propio comentario, 📦810 retiró esa vista y la carpeta se conserva a
  propósito.
- **La bandeja integrada**: ventana propia con su propio CSS. Se verificó que su
  `href="styles.css"` es el de **su** carpeta, no el de la raíz, así que es una isla
  aparte. Además no recibe `data-theme`.
- **El iframe de Configuración**: fuera del alcance por decisión del owner. Ya
  sigue el tema; se anota aparte que sus valores no llegan a 3:1.

**Tests** — `test-scrollbar-tema-886.js`: **88 checks**, **16/16 mutaciones**, 0
vacías. Contra el código previo al paquete da **45/78**: el test detecta el bug.
Tres cosas que el test hace y que un check de existencia no haría:

1. **Recalcula el contraste** desde los tokens del archivo, componiendo el velo del
   Panel. Si alguien sube la superficie más clara y no toca el thumb, se cae solo.
2. **Clasifica los 82 CSS solo**, sin lista escrita a mano, y exige que los que se
   pueden tocar queden en cero **y que los que no, sigan con sus reglas**.
3. **Exige que el thumb oscuro difiera del claro.** Que el contraste pase no basta:
   con el thumb claro `#c1c9d0` el ratio da 4.49, o sea que un test que solo mirara
   el contraste lo daría por bueno — pero el owner seguiría viendo una barra clara.

**Artefacto** — `preview-scrollbar-886.html`, generado por un script que lee los
archivos del disco y pone sus huellas SHA-256 en el pie. Muestra el antes y el
después por tema con cajas de scroll reales, la tabla de contrastes y la lista de lo
que se dejó quieto.

**Decisiones del owner** — alcance limitado al documento principal y borrado de las
reglas anuladas; el iframe de Configuración se deja como está. **Sin bump de
versión**: `0.1.251` sigue igual.
**Commits** — dos, ambos ya pusheados a `Dev` y `Dev-Pc`: `ed59ba80` (📦885) y `e5f95ae4` (📦886).

---

### 2026-10-14 · 📦884 · Los tonos del menú lateral en los dos modos oscuros (sin bump de versión)

**Qué se hizo** — el arreglo del menú lateral, rehecho desde la causa real:

| Zona | Qué |
|---|---|
| `shared/kair-sidebar.css` | Nuevo bloque `[data-theme^="dark"] #sidebar` con los seis tokens que el componente consume, más la jerarquía de peso del estado activo |
| `styles.css` | `--sidebar-text-color` en los dos bloques de tema oscuro. **14 líneas, todo aditivo** |
| `index.html` | Cache-bust de `shared/kair-sidebar.css` a `SIDEBAR-20261014-dark-tokens884` |
| `main/test-sidebar-tonos-884.js` | Test nuevo, 82 checks |

**Por qué el arreglo anterior no se veía** — aplicó el cambio sobre `.k-module-title` y
`.sidebar-module-card`, **dos clases que el menú actual no produce**. El menú se renderiza con
`kair-nav-*` (`renderer.js:4167-4187`) y se estiliza en `shared/kair-sidebar.css`; en
`renderer.js` no hay ni una coincidencia de `k-module-title`, y la clase `active` a secas solo se
**quita** (`renderer.js:4539`), nunca se pone. El CSS estaba bien escrito y no movía nada de lo que
se ve en pantalla. Peor: el preview anterior se construyó con esas mismas clases, así que
**mostraba el arreglo en vez de la app**.

**La causa real** — `shared/kair-design-tokens.css` define la paleta **solo en `:root`**. El bloque
`[data-theme^="dark"]` que documenta `design_system.md:335` **nunca se escribió en el CSS**. Como
`kair-sidebar.css` usa únicamente esos tokens, en los dos temas oscuros el menú se pintaba con los
valores del tema claro, mientras el fondo sí cambiaba (viene de `--sidebar-bg-color`, que sí tiene
bloques de tema). **Dos sistemas de tokens mezclados.**

**La otra mitad del bug, invisible hasta que se miró la pantalla** — `--kair-soft` la usan tanto
`:hover` como `--active`, y en claro es `#f3f6f6`, un casi blanco. Sobre fondo oscuro pintaba un
bloque claro. **Esa era la "tarjeta blanca duplicada"**: no era un elemento duplicado, era el
estado activo. El fix la elimina porque el velo pasa a ser 12 % de blanco.

**Contrastes medidos** — WCAG 2.1 AA, componiendo el `rgba()` sobre su fondo opaco antes de medir:

| | antes Sistema / Oscuro | después Sistema / Oscuro |
|---|---|---|
| título inactivo | 1.02 / 1.24 | **13.62 / 16.53** |
| subtítulo y header de sección | 4.10 / 4.97 | **7.93 / 9.62** |
| título activo | 2.42 / 2.94 | **7.90 / 10.46** |
| icono inactivo | 1.17 / 1.42 | **9.44 / 11.46** |

**Dos decisiones que se apartan de lo acordado, y por qué**

1. **El título inactivo baja a 600 y el activo queda en 700.** `.kair-nav-card__title` ya era 700
   para *todos* los ítems, así que subir solo el activo a 700 no habría marcado nada.
2. **No se apagó el subtítulo activo al 75 %.** Medido: cae a **3.81**, por debajo del 4.5 que AA
   exige a texto de 12 px. Un cambio de estado no puede dejar ilegible el ítem que el usuario
   está mirando. La señal la pasan el peso y la superficie.

**Alcance deliberado: `#sidebar`, no `:root`** — esos tokens se usan 287 veces en 27 archivos y
muchos módulos traen superficie blanca propia; redefinirlos globalmente pondría texto claro
sobre tarjeta blanca. Cuando esos módulos migren a superficie oscura, el bloque puede subir a
`:root` sin más.

**Tests** — `test-sidebar-tonos-884.js`: **82/82**, **15/15 mutaciones**, 0 vacías. Incluye el
check que habría atrapado el error anterior: toda clase que toca el bloque oscuro tiene que
existir en el marcado que produce `renderer.js`. Además se corrrió **contra el código viejo**
(HEAD, sin el arreglo) en un laboratorio aparte y da **37/77**: el test sí muerde.
Suite completa: **129 tests · 128 verdes · 1 con fallos**, cero regresiones; el rojo sigue siendo
`test-firma-constancia-consolidada.js` esperando `INTERNAL_API_KEY`.

**Artefacto** — `preview-tonos-884.html`, generado por un script que **lee los archivos del disco**
y trae sus huellas SHA-256 en el pie. Cuatro paneles: ANTES (con el CSS de HEAD), Sistema,
Oscuro y Claro. El owner lo aprobó.

**Decisiones del owner** — la versión **no se bumpea**: `0.1.251` sigue igual.

**Commits** — **uno solo**, con el código y la documentación juntos, en `Dev`, pusheado a `Dev` y `Dev-Pc`. El hash no se escribe dentro del propio commit: un `--amend` lo cambiaría y la referencia quedaría apuntando a un commit fantasma.


---

## 📝 Plantilla para una entrada nueva

```markdown
### AAAA-MM-DD · <tema> (📦<n>)

**Qué se hizo** — tabla: paquete → qué
**Por qué** — el pedido o el síntoma, en una frase
**Tests** — archivos, checks y mutaciones
**Decisiones del owner** — lo que confirmó, para no volver a preguntar
**Bugs encontrados** — los que no estaban en el código, y cómo los cazó el test
**Archivos tocados**
**Commits** — hash, paquete, y si se pusheó
```

---

### 2026-10-27 · 📦️971 · La alineacion de los documentos con el Gmail gratuito

**El cambio de enfoque**: el owner decidio mantener la **cuenta gratuita de Gmail** y, en vez de prometer
un DPA empresarial de Google que no existe, **alinear los documentos con la operacion real**: que el uso de
Gmail quede declarado de forma transparente, limitado a las notificaciones necesarias, y sin afirmar un
contrato empresarial de tratamiento que no esta acreditado.

**Lo primero fue medir, no redactar.** Tres afirmaciones del Anexo de Nube que el codigo contradijo:

1. El correo post-firma **adjuntaba el PDF firmado y la Constancia** al buzon del firmante. Con eso, la
   cuenta de consumidor recibia el contrato completo: **ningun texto podia decir "notificaciones necesarias"**.
2. La §5 afirmaba "cifrado en reposo", "respaldos cifrados" y "autenticacion del personal". El codigo dice
   lo contrario: `better-sqlite3` sin SQLCipher, respaldo `sqlite3 .backup` + `tar.gz` **sin cifrar**, y
   acceso por `X-Admin-API-Key` sin doble factor.
3. La §3 seguia diciendo que el servidor estaba en `Etc/UTC` y que la prueba mensual de restauracion
   estaba "pendiente de programar", cuando **las dos cosas ya se habian corregido el 26 de octubre**. El
   documento describia un servicio que ya no existia, y nadie lo habia tocado.

**El cambio de codigo que hace cierto el texto**: el correo post-firma paso a ser un **aviso con el
enlace** (`sendCopiaAviso`, sin adjuntos) y se creo `GET /api/sign/:token/constancia.pdf` para que el
firmante baje la Constancia desde el enlace. El boton "VER CONSTANCIA" de la mini-app estaba oculto
porque el trabajador la recibia por correo: ahora se muestra. **El flujo en papel conserva los adjuntos**:
en `registrarFirmaEnPapel` la solicitud queda `CANCELLED` y con ese estado `resolveToken` lanza 410, asi
que sin adjunto el firmante en papel se quedaria **sin su copia**.

**Los nueve documentos** quedaron describiendo la operacion real: Google es **proveedor externo de correo,
no subencargado** (con cuenta de consumo no hay DPA aplicable); el enlace y el OTP **no son dos factores
independientes** (misma cuenta, misma direccion); y la clausula que exige contrato o DPA a los proveedores
que reciben datos **se conservo y se declaro no satisfecha**, con sus dos salidas: migrar a un proveedor con
DPA o la autorizacion expresa y separable del Titular. El gate de primera firma **sigue bloqueado** por
`google_dpa`, con el motivo real y las tres acciones.

**El Acuerdo v1.1** cambio en 3.1, 3.4(b), 3.4(e), 8.7, 10.1 y 10.5(f): de 42 475 B (`634b063c…29d0`) a
**46 579 B (`9b577998…26e7`)**. La **v1.0 sellada no se toco** (`52a490a4…10c04`).

**Cifras**: suite `1770 · 1768 pass · 0 fail · 2 skipped`; barrido limpio en los 27 archivos; Anexo de
Nube de **3 huecos bloqueantes a 1** (queda el de la condicion contractual, que debe quedar); Anexo de
Encargo con 0 huecos y su marca de revision profesional pendiente (la quita el abogado); los 6 pares
`legal/` ≡ `sitio/` **identicos byte a byte**.

**Lo que sigue abierto, sin cambios**: la condicion contractual de Gmail (la resuelve el abogado), la
cuenta con DPA si se decide migrar, la 9A en papel, la 10.4, el D-02, la firma del Anexo de Nube por cada
Empresa, la 9A y el push de los paquetes 967 a 971.


### 2026-10-27 · 📦️976 · Las seis decisiones del abogado, aplicadas al código y a los tres documentos

**Qué se hizo** — el owner trayó las seis decisiones (1.a a 1.f) del abogado y mandó "procede con las implementaciones".

| Decisión | Qué quedó | Dónde |
|---|---|---|
| 1.a | La Empresa obtiene del candidato su correo personal verbalmente en la contratación y lo registra; el Trabajador lo **confirma** en la pantalla de firma con una declaración de texto fijo. El medio tiene **tres orígenes** (TRABAJADOR, TRABAJADOR_CONFIRMADO, EMPRESA) y el servidor **exige** la confirmación (422 `MEDIO_OTP_CONFIRMACION_REQUERIDA`) | `medioPersonal.js`, `medios.js`, `routes/public.js`, `web/firma/` |
| 1.b | La Empresa remite el enlace con **su propia cuenta** (cifrada, con rastro y revocable); el **OTP sale siempre de K+AIR**, porque es el dato de creación y su custodia no puede depender de la Empresa | `cuentaEnvio.js`, `mailer.js`, `admin-empresas.js` |
| 1.c | El 3.4(g) queda con la aceptación por versión: versiones inmutables, sin retroacción, la aceptación previa conserva su huella | Acuerdo v1.1 |
| 1.d | El 8.7 conserva los documentos y separa los plazos: Google no tiene plazo contractual verificado y no se le atribuye | Acuerdo v1.1 y Anexo de Encargo §8 |
| 1.e | El 10.1 y el 10.5(f) reformulados: Google es proveedor que **interviene** en el envío, no subencargado. Se ajustó el 10.5(f)(iv): el código **rechaza** las direcciones inválidas, no las corrige | Acuerdo v1.1, Anexo de Encargo §5 |
| 1.f | **Aprobar el texto y autorizar a publicar son dos decisiones**: la autorización operativa se registra con versión, huella, garantía, resultado y responsable; `createVersion` con `activa: true` devuelve **409** sin ella; el gate tiene un item nuevo | `aprobacionPublicacion.js`, `agreement.js`, `readinessLegal.js`, `legal/constancia-aprobacion-acuerdo.html` |

**Por qué** — el texto solo no alcanzaba: tres de las seis decisiones cambian QUIÉN hace qué, y un documento que no coincide con el sistema vuelve a mentir (trampa 99).

**Tests** — suite completa **1856 · 1854 pass · 0 fail · 2 skipped** (los 2 skipped son pre-existentes), EXIT=0. Nuevos: `cuenta-envio-empresa.test.js`, `admin-empresas-cuenta-envio.test.js`, `aprobacion-publicacion.test.js`, `miniapp-medio-confirmado.test.js`. Barrido limpio en los 51 archivos. La v1.1 re-empalmada: **57 187 B**, `09d69065…123d2`, 0 huecos y 0 marcadores, empalme determinista. Los 7 pares `legal/` ≡ `sitio/` **idénticos byte a byte**.

**Decisiones del owner** — "procede con las implementaciones" de las seis decisiones. Se tomó una decisión técnica que el owner no había especificado y que se le reporta: **el OTP sale siempre de la cuenta de K+AIR**, aunque el enlace salga de la cuenta de la Empresa.

**Bugs encontrados** — (1) el correo de invitación prometía "la firma en papel se pide desde la misma página del enlace" y **la mini-app no tiene ninguna opción de papel**: la vía en papel no tiene ruta pública, el Trabajador le pide el papel a su Empresa por su canal de atención. Texto corregido. (2) El 10.5(f)(iv) del abogado pedía "revisar y corregir las direcciones de destinatario", y el código **rechaza** las inválidas, no las corrige: el numeral quedó con lo que el código hace. (3) El test de mutaciones del Capítulo V mutaba el primer `bloque.hidden = false` del JS, que con la 1.a ya no es el del bloque de identidad: la mutación apuntaba al bloque equivocado y **no la detectaba**. (4) `tests/routes/public.test.js` quedó con 4 líneas LF dentro de un archivo CRLF: normalizado a CRLF, como en HEAD.

**Archivos tocados** — 51. Código: 3 migraciones (042 cuenta de envío de la Empresa, 043 medio confirmado, 044 aprobaciones), `cuentaEnvio.js`, `medioPersonal.js`, `aprobacionPublicacion.js`, `admin-aprobaciones.js`, y los cambios en `mailer.js`, `publicFlow.js`, `medios.js`, `agreement.js`, `readinessLegal.js`, `routes/public.js`, `routes/admin-empresas.js`, `web/firma/`. Documentos: el Acuerdo v1.1 (9 numerales), el Anexo de Encargo (6 secciones), el Anexo de Nube (§3 y tabla), y el documento nuevo `constancia-aprobacion-acuerdo.html`, con sus 7 pares en `sitio/`. Manifiesto recalculado contra los archivos.

### 2026-10-27 · 📦️977 · La autorización operativa de la v1.0, registrada en producción

**Qué se hizo** — el owner autorizó ("2. autorizado") registrar la autorización operativa de la
**versión vigente**, que era el único bloqueante administrativo que el gate pedía. Se registró
por `POST /internal/admin/aprobaciones-publicacion` con tipo `OPERATIVA`.

| Campo | Valor |
|---|---|
| version | `v1.0` |
| hash | `52a490a4f4ce922109d42fa01ac45632cd62d5242bb82bf6e1967ede55710c04` |
| tipo | `OPERATIVA` |
| fecha | `2026-10-27` |
| aprobado_por | Javier Robles Fontalvo, Representante Legal de Gesstiar S.A.S. |
| responsable_despliegue | Javier Robles Fontalvo, Representante Legal de Gesstiar S.A.S. |
| id | `1` (`gh_firma_aprobaciones_publicacion`, append-only) |

**Por qué la v1.0 y no la v1.1** — el item del gate mira la versión **activa** (`activa = 1`), y en
producción esa es la v1.0. La v1.1 no está aprobada por el abogado todavía: registrarle la
autorización operativa sería **pre-autorizar la publicación de un texto que nadie aprueba**
(trampa 100: aprobar y publicar son dos decisiones, y la segunda no se adelanta).

**Qué se corrigió de paso** — el runbook de despliegue usaba `$(cat /opt/kair-firma/admin-key.txt)`
sin `sudo`: con el operador `javier` da `Permission denied` y el `curl` se queda sin la cabecera
(`docs/gestion-humana/firma-electronica/PLAN-DESPLIEGUE-PRODUCCION-2026-10-20.md`).

**Bug encontrado (en los comandos de verificación, no en el dato)** — dos consultas dieron negativo
con el registro sano: (a) `instr(garantia, char(233))` dio 0 porque **233 decimal es la `é` (hex
C3A9), no la `ó`: el código de la `ó` es 243 (C3B3)**, y el texto de la garantía no tiene ninguna `é`;
(b) `grep 'aprobacion_operativa_vigente'` no encontró el item porque el reporte en texto imprime el
**título** ("Aprobación operativa de la versión vigente"), no su id de máquina, y un item que pasa
a OK desaparece de la lista de "Faltan N bloqueante(s)". Reproducido en local antes de corregir;
queda como trampa 101.

**Estado del gate (medido en producción)** — el item `aprobacion_operativa_vigente` pasa a **OK**:
`Items: 40 · OK: 26 · Pendientes: 13 · Avisos: 1 · N/A: 0`, y el reporte lo muestra como
`[OK] Aprobación operativa de la versión vigente`. El gate de `publicacion` deja **6 bloqueantes**
pendientes, y son de dos clases: **tres son el archivo de la v1.1, que no viaja en el tar**
(`Texto completo, sin placeholders ni marcas de borrador`, `Huella del texto registrada en el
manifiesto` y `Texto de la v1.1 con 20 años, hold y cinco categorías` — los tres se resuelven
juntos cuando el archivo llegue al servidor, contra la huella que ya está en el manifiesto), y los
otros tres son `Versión v1.1 activa en la base` (la v1.1 todavía no está aprobada por el abogado),
`Prueba de la 9A en el ambiente real` y `Prueba de la 10.4 en el ambiente real`.

**Commits** — el 📦977 (esta entrada, la trampa 101 y el arreglo del runbook) queda commiteado en `Dev`
(**local, sin push**: el push a `origin/Dev` espera la palabra del owner; su hash se mira en `git log`,
como los anteriores). En la rama `gh-pages`, el commit `f8a86962` con los ocho archivos del sitio
(**también local, sin push**).
## 📦978 · Los ocho controles que el texto promete y el código no cumplía

**Qué llegó.** El abogado devolvió el Acuerdo v1.1 el 27-oct-2026 con **tres críticos, seis problemas de
coherencia, tres de datos personales, dos de conservación y ocho controles técnicos**, y una instrucción
explícita: **no autorizó la publicación**. Su orden fue: (1) corregir las contradicciones internas, (2) resolver
y documentar la evaluación del canal de correo, (3) verificar los controles técnicos, (4) pruebas documentadas de
escenarios normales **y de fallo**, y (5) aprobar la versión jurídica definitiva y, **por separado**, autorizar la
publicación. El 📦978 es el paso (3): el código que hace que las promesas del texto sean ciertas.

**Los ocho controles, verificados contra el código** (no contra el texto): A (HMAC, la clave fuera de la base)
**cumple**; B (caducidad 600 s / 5 intentos) **parcial** — el bloqueo era blando y la caducidad no alcanzaba a
las filas heredadas; C (un token vigente) **cumple**; D (verificación del correo personal) **parcial** — con el flag
apagado solo había un `logger.warn` y el OTP salía igual; E (huellas de bytes exactos) **cumple**; F (Constancia
con los anexos) **parcial: lo prometido no existía**; G (conservación y respaldos) **parcial** — no se cifraban y
la supresión no los alcanzaba; H (correo) **cumple con matiz**. Y el caso I: el 3.4(e) promete que el aviso
`OTP_MEDIO_CORPORATIVO` queda en el registro de operaciones y que no se puede suprimir, y en el código era
**una línea de `logger.warn` a stderr**. Esa es la trampa 99 al revés.

**Los cuatro cambios.** (1) El buzón corporativo se rechaza **siempre**: el control dejó de depender de
`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` y el aviso es un **evento** en `gh_firma_eventos`, que es append-only; el
rechazo se evalúa **antes de escribir nada**, porque resolver el destino después de generar el OTP dejaba la fila
en `OTP_SENT` con un código que nunca salió (una firma fantasma). (2) La confirmación del medio es obligatoria
para **cualquier** destino, y la dirección que se archiva es la que **recibió el código**, no la de la fila: con
eso se cierra la trampa de `registrarConfirmacion`, que devolvía un 400 **después** de que el OTP ya había salido.
(3) El bloqueo del OTP es **duro**: `OTP_LOCKED` ya no permite reenviar y la salida es una **nueva solicitud** (el
3.4(e) decía "un nuevo OTP o una nueva solicitud": en la v1.2 queda "una nueva solicitud"). (4) La caducidad
alcanza a las filas heredadas: sin marca de envío no se puede probar la vigencia del código, y se **falla
cerrado**; el `se_puede_reenviar` del error ahora dice la verdad.

**Además.** La Constancia incluye los anexos que rigen la firma con su versión y su huella SHA-256; hay una
declaración expresa por documento de que **no** contiene datos sensibles de salud (política de prohibición: el
servicio no recibe documentos con datos de salud); y los respaldos van cifrados, con una purga a nivel de registro
que alcanza a las copias y una poda que respeta el `hold_legal`.

**Medido.** Suite completa **1892 · 1890 verdes · 0 rojos · 2 omitidos**. Barrido de caracteres no latinos limpio
en los 62 archivos del paquete. `pdfGen.js` sigue en CRLF puro (898) y `tests/routes/public.test.js` en CRLF con
BOM (976): el EOL de cada archivo lo fija su test y no se movió. La **v1.2** (el texto que el abogado tiene que
aprobar) se está armando aparte, desde la v1.0 sellada: la v1.1 nunca se publicó y sus 53 cambios son borrador.

**Commits** — cuatro, en `Dev` y **pusheados** a `origin/Dev`: 📦978 `5534aca7` (el
código), 📦979 `f445bb1c` (los tres anexos), 📦980 `43fedd4a` (el JSON de cambios de la v1.2) y 📦981
`26398205` (este estado al cierre). La rama `gh-pages` recibió `04c5e762` (los tres anexos). El texto
armado `acuerdo-v1.2.txt` (66 681 B, SHA-256 `97da2c14…7977`) queda en `.gitignore`: es la versión que se
firma. En la rama `gh-pages`, el commit `f8a86962` con los ocho archivos del sitio sigue **local y sin push**.
## 🔻 Regla de cierre (obligatoria)

**Antes de terminar cualquier trabajo o sección, el modelo DEBE preguntar al owner:**

> "¿Querés que actualice los documentos (`Historial.md`, `PROMPT.md`, `CONTEXT.md`) para la próxima jornada?"

**No cerrar la sesión sin haberlo preguntado.** Sin esa pregunta, el próximo modelo arranca sin
saber qué se hizo, qué quedó a medias ni qué está bloqueado — y ese es exactamente el problema
que este archivo existe para evitar.

Al owner le corresponde responder. Si dice que sí, se actualizan:

| Documento | Qué se escribe |
|---|---|
| `Historial.md` | Bloque de estado + entrada de la jornada |
| `PROMPT.md` | Si apareció una regla nueva de proceso o una trampa nueva |
| `CONTEXT.md` | Si cambió el estado del proyecto o el foco |
| `BITACORA.md` | La lección del bug, con su "por qué se rompió" |
| `CHANGELOG.md` + `README.md` + `release-notes.md` | Al commitear, no al cerrar |
