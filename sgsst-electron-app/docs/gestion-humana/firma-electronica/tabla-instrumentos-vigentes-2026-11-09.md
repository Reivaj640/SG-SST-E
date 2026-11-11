# Tabla única de instrumentos vigentes — 9 de noviembre de 2026

> Esta es la tabla que el plan del punto 3 pide: **documento → versión → hash → fecha →
> suscripción → evidencia**. Una sola, con las huellas calculadas sobre los bytes reales de los
> archivos, no declaradas a mano.
>
> **Cómo se recalcula:** las huellas salen de `Get-FileHash` (o de `sha256sum`) sobre los archivos
> del repositorio. Las de los anexos también las declara el manifiesto `legal-readiness.json`, que es
> la salida de `scripts/actualizar-manifiesto-1047.js`; si una huella de esta tabla no coincide con
> la del manifiesto, el manifiesto está viejo y hay que correr ese script.
>
> **Qué significa "suscripción".** Los dos instrumentos son **bilaterales**: el de Nube (v1.2, §10) lo
> suscribe la Empresa y lo contrafirma K+AIR, y el de Encargo (2026-11-09, §12) tiene los mismos dos
> actos. En los dos, el instrumento solo queda **ejecutado** cuando las dos partes firman. El código
> registra los dos actos: desde el 9-nov-2026 el Anexo de Nube tiene su segunda mitad (la
> contrafirma), con su migración, sus dos rutas administrativas y su acta propia.

## 1. Los instrumentos

| Instrumento | Versión | SHA-256 | Bytes | Fecha del texto | Suscripción | Evidencia |
|---|---|---|---|---|---|---|
| **Anexo de Nube** (vigente) | 1.2 | `242037b3a98f2152b7c1db1f5c562fbe1f9f3e3be4422c03bfcf404e581f7245` | 84 062 | 9-nov-2026 | **NO suscrito** (ni suscrito ni contrafirmado) | Manifiesto `anexo_nube.firmado = false` y `anexo_nube.contrafirmado = false`. Suspende los ítems `firmado_nube` y `contrafirma_nube` del gate. |
| Anexo de Nube (histórico) | 1.1 | `e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482` | 62 198 | 5-nov-2026 | **Suscrito** por ASEPLUS CARIBE S.A.S. (NIT 900 829 731) el 2026-11-05T22:51:34.349Z, IP 181.63.26.145 | Manifiesto `anexo_nube.versiones_firmadas[0]`. Rastro: SUSCRIPCION_CREADA, ENLACE_ABIERTO, CODIGO_ENVIADO ×2, SUSCRIPCION_FIRMADA. |
| Anexo de Nube (modelo histórico) | 1.0 | `aec7c40132979990cddbad669a8d4690d8439ddc447059d069cd8d19c83214ca` | 59 857 | 30-oct-2026 | **Nunca fue susceptible de suscripción** (su propio texto lo prohibía) | Manifiesto, bloque `anexo_nube.modelo.nota`. |
| **Anexo de Encargo** (vigente) | 2026-11-09 | `0cd6c05f0574bbcdbb8277306a9084784a48815edd862cd31e97eb5435c22a1e` | 93 860 | 9-nov-2026 | **NO suscrito** | Manifiesto `anexo_encargo.estado = "no_firmado"`. Suspende el ítem `estado_encargo` del gate. |
| Anexo de Encargo (histórico, **ejecutado**) | 2026-11-06 | `5cc7a34603ea2e300e6c82ed695454eb705363345a3165ae2e75b5733960aa72` | 87 202 | 6-nov-2026 | **Ejecutado**: suscripción de ASEPLUS el 2026-11-07T19:30:14.503Z y contrafirma de K+AIR el 2026-11-07T20:33:22.748Z | Manifiesto `anexo_encargo.versiones_firmadas[0]`. Actas: `acta-1-anexo-encargo.pdf` (SHA-256 `f4a96bee…bdf3`) y `acta-1-contrafirma-anexo-encargo.pdf` (SHA-256 `b1ec9fa2…513c`). |
| **CDPA de Google** (instrumento del proveedor) | texto **Current** (la página **no declara fecha** ⚠️) | `0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1` | 97 831 | capturado 10-nov-2026 (`fecha_declarada_por_google: null`) | **Aceptado por la cuenta el 10-nov-2026** (P1 cerrado) | Manifiesto `subencargados.mail_provider.aceptacion`: `aceptada = true`, modo `aceptado_por_administrador`, `fecha = 2026-11-10`, `fecha_efectividad_addendum = null` (la consola no la muestra). La consola declara «Aceptado por kair@gesstiar.com el Nov 10, 2026». Captura: `scripts/fixtures/captura-consola-cdpa-i-accept-2026-11-10.png`, 96 520 bytes, SHA-256 `9d989067baf9f7908d144dcdb86c04f9b62efa6e34e4714f7dd3132e5d825560`, `verificado_localmente: true`. URL canónica: <https://admin.google.com/terms/apps/8/1/en/dpa_terms.html>. Acta: `scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json` → `node scripts/actualizar-manifiesto-aceptacion-cdpa.js --aplicar` (10-nov-2026). |
| **Acuerdo** (manifestación de voluntad) | v1.5 | `952592f078eb3e8ca6a913361beb6a5eb7c32f22bba2c9fa30d17ab09825be28` | 73 177 | 5-nov-2026 | Publicada en la base (`publicado: true`), **sin aprobación operativa** | Manifiesto, bloque `acuerdo`. El texto está en `scripts/fixtures/acuerdo-v1.5.txt`, fuera del árbol versionado. |

## 2. Las copias publicadas

Cada anexo vive en dos sitios, y las dos copias tienen que ser **byte a byte** iguales: el
manifiesto declara una sola huella y dos textos distintos no caben bajo una huella.

| Archivo | Copia en `legal/` | Copia en `sitio/` | Iguales |
|---|---|---|---|
| Anexo de Nube v1.2 | `sgsst-electron-app/legal/anexo-nube-v1.2.html` | `sitio/anexo-nube-v1.2.html` | Sí |
| Anexo de Nube v1.1 | `sgsst-electron-app/legal/anexo-nube-v1.1.html` | `sitio/anexo-nube-v1.1.html` | Sí |
| Anexo de Nube v1.0 | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | `sitio/anexo-nube-v1.0.html` | Sí |
| Anexo de Encargo 2026-11-09 | `sgsst-electron-app/legal/anexo-encargo.html` | `sitio/anexo-encargo.html` | Sí |
| Anexo de Encargo 2026-11-06 (archivado) | `sgsst-electron-app/legal/anexo-encargo-2026-11-06.html` | `sitio/anexo-encargo-2026-11-06.html` | Sí |

El Encargo 2026-11-06 se archivó el 9-nov-2026 **antes** de que el 2026-11-09 lo sustituyera: es el
texto que ASEPLUS firmó, con su huella propia, y no se edita jamás. Un texto suscrito no se
toca; sus enlaces describen el estado del día en que se firmó.

## 3. Lo que bloquea el cierre

| Pendiente | Qué falta | Responsable | Efecto en el gate |
|---|---|---|---|
| ~~**P1**~~ | **CERRADO 10-nov-2026**: el superadministrador aceptó el CDPA en la consola (Cuenta → Configuración de la cuenta → Cumplimiento legal → Seguridad y privacidad → Términos adicionales) y la consola declara «Aceptado por kair@gesstiar.com el Nov 10, 2026». Se llenó el acta `scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json` (modo `aceptado_por_administrador`) con su captura (`captura-consola-cdpa-i-accept-2026-11-10.png`, SHA-256 `9d989067…560`, 96 520 bytes) y se corrió `node scripts/actualizar-manifiesto-aceptacion-cdpa.js --aplicar --hoy=2026-11-10` | — | `mail_provider_dpa` → **ok** (gate: 6 → **5** pendientes) |
| **Expiración del token `kair-release-pc`** | Editar en la UI de GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → `kair-release-pc` → Edit → Expiration: 90 days → Update token* (vencimiento objetivo **2027-02-08**). No existe ruta de API (404 verificados) | Owner | — (control de seguridad, no bloquea el gate). Paso a paso: `token-fine-grained-kair-release-pc-2026-11-10.md` |
| ~~**P2**~~ | **CERRADO 10-nov-2026**: `kair@gesstiar.com` activa, con verificación en dos pasos y autenticación por app password | — | Condición de P5 **cumplida** |
| **P3** | Verificar los alias de derechos, PQRS e incidentes en la consola | Owner | Los tres canales quedan con `excepcion_documentada` |
| ~~**P4**~~ | **CERRADO 10-nov-2026**: SPF `v=spf1 include:_spf.google.com ~all`, DKIM `google._domainkey` y DMARC `v=DMARC1; p=none; rua=mailto:kair@gesstiar.com` (TTL 14400, un solo registro) publicados y visibles en el autoritativo y en 8.8.8.8 / 1.1.1.1 / 9.9.9.9 | — | Condición de P5 **cumplida** |
| ~~**P5**~~ | **CERRADO 10-nov-2026**: envío real desde `kair@gesstiar.com` con Message-ID `<5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` y `Authentication-Results: dkim=pass; spf=pass; dmarc=pass` | — | El remitente efectivo es `kair@gesstiar.com` |
| **P6** | Revocar las app passwords antiguas de `adminkair@gmail.com` | Owner | — |
| **P7** | **RESPONDIDO 10-nov-2026** (la parte que decide el P8): la contrafirma del Anexo de Nube v1.2 **va dentro** del servicio, con el mecanismo de firma electrónica ya implementado, y la recomendación del abogado es mantener exactamente esa arquitectura. **De las cuatro preguntas del §8 del plan, solo quedó respondida esa**: siguen sin responder (a) la versión nueva del Anexo de Encargo u otrosí, (c) qué canales entran en este cierre y (d) el papel de Google sobre los datos de cuenta y la telemetría | Owner + abogado | Compuerta de P8: la condición de la acreditación de la facultad de quien contrafirma por Gesstiar ya está **implementada** (migraciones 061/062, `services/poderesEncargado.js`, cuatro rutas administrativas, el acta, la evidencia, el manifiesto y el gate). Ver `acreditacion-facultad-contrafirmante.md` |
| **Decisión del texto** (10-nov-2026) | **DECIDIDA: opción A · control interno.** La acreditación de la facultad se queda en el expediente (registro de poderes + acta + evidencia + manifiesto + gate) y **el texto vigente NO cambia**: no hay v1.3, la huella `242037b3…1f7245` de la v1.2 no se mueve, no hay republicación en `legal/` ni en `sitio/`, y **P8 sigue siendo la suscripción de la v1.2 por ASEPLUS**. Tamnto el Anexo de Encargo 2026-11-09 | Owner | **Cerrada.** Si más adelante el abogado quiere que la condición quede también en el texto, eso es una v1.3 y hay que hacerla **antes** de que ASEPLUS firme |
| **P8** | Suscribir la v1.2 y el Encargo 2026-11-09 por ASEPLUS, por el canal administrativo y con motivo; contrafirmar el Anexo de Nube (`POST /internal/admin/empresas/:id_empresa/anexo-nube/contrafirmar/codigo` y `…/anexo-nube/contrafirmar`, con `X-Admin-Actor` y `X-Admin-Motivo`). **Antes de contrafirmar**: `FIRMA_ADMIN_ACTOR` con un nombre de persona — **ya definido: Javier Robles Fontalvo**, representante legal de Gesstiar (decisión del owner, 10-nov-2026), así que **no hay que registrar ningún poder**; y el despliegue del servidor tiene que tener las migraciones 060, 061 y 062 aplicadas | Owner | `firmado_nube`, `contrafirma_nube` y `estado_encargo`. El paso a paso del segundo acto está en `contrafirma-anexo-nube-v1-2.md`; la acreditación de la facultad, en `acreditacion-facultad-contrafirmante.md` |
| **P9** | Publicar en `sitio/` y regenerar `gh-pages`; verificar URLs y hashes | Owner | — |
| **P10** | Desplegar en ventana de mantenimiento, con P8 cerrado | Owner | — |
| **P11** | **Revocar en Google las 5 app passwords de clientes** (4 buzones: `tempoactivaestsas@gmail.com` con 2 claves, `temposumestsas@gmail.com`, `asepluscaribesas@gmail.com`, `asel.contratacion@gmail.com`) | Owner | — |
| ~~**P12**~~ | **CERRADO 10-nov-2026**: el token clásico `ghp_` ("Nuevo token Marzo 2026") **fue borrado** en GitHub. El `.bat` ya no lo tiene (3 ocurrencias sustituidas) y el acceso por la credencial de Windows (`gho_`, OAuth) sigue funcionando | — | — |

> **P11 y P12 aparecieron el 9-nov-2026**, al escanear el historial completo del repositorio (25 105
> blobs). Los dos secretos están en commits antiguos, **no** en el árbol de trabajo: desde el 📦931 las
> app passwords salen del `.env`, y el token estaba en un documento que el 📦580 eliminó. Pero el
> commit que introduce el token está en `origin/Dev` y **el repositorio es público**
> (`api.github.com/repos/Reivaj640/SG-SST-E` → `"private": false`): cualquiera que sepa leer un
> historial los recupera. El propio código del repo lo reconocía: «este repo es público y estas app
> passwords de Gmail quedaron en el historial de git».
>
> **Sacarlos del código no los saca del historial, y purgar el historial sin revocar no sirve de nada**:
> las copias quedan en los clones, en los forks y en las cachés. Y purgarlo rompe las huellas de los
> anexos que viven en el historial, así que es una decisión del owner. En los documentos de este repo el
> token se escribe por su prefijo y su ubicación, nunca por su valor: publicar el secreto en el
> documento que lo denuncia lo publica otra vez.
>
> **P11 son CINCO claves, no cuatro** (el 📦1047 lo midió): TEMPOACTIVA y COOTRACOM usan **el mismo
> buzón** (`tempoactivaestsas@gmail.com`) con **claves distintas**. Las cinco siguen **vivas** y son
> las mismas que están en el historial. Lo que cierra P11 es la **revocación** en Google (acción del
> owner, paso a paso en `rotacion-app-passwords-p11-2026-11-10.md`), no la creación de claves nuevas.
> El repo ya tiene la guarda que evita que se repita: `main/_detector-secretos.js` +
> `main/test-secretos-1047.js`, que **corta el build** si un secreto vuelve a un archivo versionado.

## 4. Lo que se midió

| Control | Resultado |
|---|---|
| `node scripts/actualizar-manifiesto-1047.js --check` | 0 — el manifiesto está al día |
| `node scripts/actualizar-manifiesto-anexo-nube.js --check` | 0 — el estado real de la suscripción (y de la contrafirma) coincide con el manifiesto |
| `node scripts/generar-anexo-encargo.js --check` | 0 — el Anexo de Encargo es reproducible desde sus dos fuentes |
| Suite completa del `firma-service` | 2 502 tests · 2 500 verdes · 0 rojos · 2 omitidos |
| Tests de la lectura del operador (`tests/routes/admin-empresas*.test.js`) | 27 · 27 verdes — incluyen los **tres estados** del Anexo de Nube en el listado y la fase 2 leída de la fila |
| Tests de la vista del operador (`main/test-anexos-1038.js`, `main/test-anexos-1042.js`) | 26 · 26 verdes — el badge del Anexo de Nube no se pinta verde con solo la suscripción, y la vista no ofrece un botón sin canal IPC |
| Preflight del Anexo de Nube | Aborta con **exit 5** y el motivo real: "no hay ninguna Empresa activa con el Anexo de Nube suscrito sobre el texto vigente". Distingue los dos motivos: "nadie lo ha suscrito" y "lo suscribieron pero no lo contrafirmaron" |
| Gate `primera_firma` | 7 bloqueantes: `acuerdo_v1_1` (×2), `d03` (solo en la base de pruebas: la migración 036 no se aplica en test), `firmado_nube`, **`contrafirma_nube`** (el segundo acto, nuevo), `mail_provider_dpa`, `estado_encargo` |
| Barrido de secretos del paquete 📦1047 | Limpio (10 coincidencias, todas del patrón flojo de "app password" contra frases en español, revisadas a mano) |
| Barrido de secretos del historial completo | 25 105 blobs revisados. **Dos hallazgos materiales**: el token de GitHub de **P12** y las **cinco** app passwords de **P11**, los dos solo en commits antiguos |

## 4.1 Lo que se midió el 10-nov-2026

| Control | Resultado |
|---|---|
| Suite completa del `firma-service` (Node 24, `better-sqlite3` recompilado) | 2 502 tests · 2 500 verdes · **0 rojos** · 2 omitidos (159 s) |
| Gate `publicacion` (BD local) | 42 ítems · 32 OK · 6 pendientes · **2 bloqueantes pendientes**: `publicado` y `aprobacion_operativa_vigente` — **los dos son artefacto de la base local vacía**; hay que medir en la VM |
| Gate `primera_firma` (BD local) | **4 bloqueantes reales**: `firmado_nube`, `contrafirma_nube`, `mail_provider_dpa` (P1) y `estado_encargo`; más los 2 artefactos de la BD local |
| Envío real desde el **servicio** (`kair@gesstiar.com`) | Message-ID `<5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` · `Authentication-Results: dkim=pass; spf=pass; dmarc=pass` · SPF/DKIM/DMARC = PASS en la UI de Gmail |
| Envío real desde la **app** (5 clientes) | **5/5 OK** con Message-ID propio: TEMPOACTIVA, TEMPOSUM, ASEPLUS, ASEL, COOTRACOM |
| `node main/test-email-env-931.js` | **33/33 OK** — ahora **carga** el cargador y el sender (no solo los lee) |
| `node main/test-secretos-1047.js` (nuevo) | **16/16 OK** — 3 841 archivos versionados barridos, **0 secretos** |
| `node main/_verificar-credenciales-build.js` | Pasa: credenciales de Google, 5 contraseñas de correo y cargador del `.env` cargan |
| Claves de cliente en archivos versionados | **0** (las 5 del `.env` aparecen en 7–8 commits cada una del historial, ninguna en el árbol) |

> **Lo que NO se midió:** el gate real (los dos artefactos de la base local) solo se mide
> en la VM, donde hoy corre el código anterior (58 migraciones; falta la `060`). ⚠️ No verificado.

`google_dpa` sigue en `[N/A]`: no es que se cumpla, es que ya no aplica. Un ítem que ya no aplica
no se marca "ok".

## 5. Lo que se corrigió al cerrar (9-nov-2026, tarde)

Cerrar el segundo acto no era solo el gate, el manifiesto y la habilitación. Al verificar
aparecieron **tres huecos donde el estado se MUESTRA y seguía midiéndose con un solo acto**:

| Hueco | Qué era | Cómo quedó |
|---|---|---|
| La lectura del operador | `GET /internal/admin/empresas/:id_empresa/anexos` devolvía `null` en todos los campos de la contrafirma, y su comentario afirmaba "el Anexo de Nube NO es bilateral" | La fase 2 **se lee de la fila**, con lectura tolerante (sin la migración 060 aplicada viene en `null` y no se inventa nada) |
| El panel del operador | La columna del listado usaba `anexo_nube_firmado_at` — la **fase 1** — para pintar un badge **verde** ("Firmado") | Los mismos **tres** estados que el Anexo de Encargo, con `tiene_anexo_nube_suscrito` y `tiene_anexo_nube_ejecutado` en el listado |
| `API.md` §6.22.3 | Listaba dos canales IPC de contrafirma del Anexo de Nube que **nunca se escribieron** en el bridge (la tabla decía trece canales; el título del apartado decía once: el título era el que cuadraba) | El documento dice la verdad: la contrafirma del Anexo de Nube **no tiene canal IPC** y se hace por HTTP contra el servicio |

> **La app muestra el estado de los dos actos, pero no permite ejecutarlos.** No hay botón: un
> botón sin canal IPC es peor que un botón que no existe, porque el operador lo pulsa y no pasa
> nada. El paso a paso por HTTP está en `contrafirma-anexo-nube-v1-2.md` §3.2.

## 6. Lo que se corrigió el 10-nov-2026

| # | Qué era | Cómo quedó |
|---|---|---|
| 1 | 🔴 **El botón "Enviar por correo" estaba muerto en el instalador y en desarrollo.** `shared/env-loader.js` tenía un `*/` accidental dentro de un comentario de bloque (el patrón de archivos `**/utils/**` lo tiene): el comentario se cerraba antes de tiempo y el resto del archivo **se ejecutaba como código** → `ReferenceError: utils is not defined` al importar el módulo, que mataba `utils/emailSender.js`. **2 494 tests en verde no lo cazaban**: el test solo leía el archivo como texto | El `*/` corregido; `main/test-email-env-931.js` ahora **carga** el cargador y el sender (**33/33**); el guard de build **corta** si el cargador no carga. `node --check` no lo ve: no es error de sintaxis |
| 2 | El `.bat` de publicación tenía el token `ghp_` **3 veces** | Sustituido por `github_pat_TU_TOKEN_AQUI`; el `.bat` lee `GH_TOKEN` del entorno. **0 ocurrencias** |
| 3 | No había ninguna guarda que impidiera **volver a publicar un secreto** | `main/_detector-secretos.js` + `main/test-secretos-1047.js` (**16/16**): escanea los 3 841 archivos versionados, **corta el build** si encuentra uno, y **nunca imprime el valor** (solo archivo, línea y regla) |
| 4 | El service corría con código anterior (58 migraciones) | La migración `060_anexo_nube_contrafirma` está escrita y probada; **falta desplegarla en la VM** para medir el gate real |
| 5 | La suite local no se podía correr (`better-sqlite3` compilado para otro ABI de Node) | `better-sqlite3` recompilado para Node 24 (ABI 137) → suite completa **2 502 tests · 0 rojos** |

> **Lo que NO cambia:** el texto de los anexos, sus versiones y sus huellas. El gate
> `primera_firma` sigue con los **mismos 4 bloqueantes reales** (`firmado_nube`,
> `contrafirma_nube`, `mail_provider_dpa`, `estado_encargo`). Lo que se movió fue el
> **canal de correo de la app**, que estaba muerto y ahora **manda correo real** (5/5).
