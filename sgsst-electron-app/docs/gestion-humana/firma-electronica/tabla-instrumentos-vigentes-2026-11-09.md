# Tabla única de instrumentos vigentes — 9 de noviembre de 2026

> **Actualizada el 12-nov-2026.** El archivo conserva el nombre del 9-nov porque así lo citan
> otros documentos del expediente; **no se renombra**. El 11-nov cambiaron las versiones: el
> **Acuerdo v1.6**, el **Anexo de Nube v1.3** y el **Anexo de Encargo 2026-11-11** son los textos
> vigentes (ver §4.3 y `dictamen-legal-textos-2026-11-11.md`). El **12-nov-2026** los dos anexos
> vigentes quedaron **suscritos por ASEPLUS CARIBE S.A.S. y contrafirmados por K+AIR**; esta
> actualización registra ese estado y las huellas reales de la Constancia.
>
> Esta es la tabla que el plan del punto 3 pide: **documento → versión → hash → fecha →
> suscripción → evidencia**. Una sola, con las huellas calculadas sobre los bytes reales de los
> archivos, no declaradas a mano.
>
> **Cómo se recalcula:** las huellas salen de `Get-FileHash` (o de `sha256sum`) sobre los archivos
> del repositorio. Las de los anexos también las declara el manifiesto `legal-readiness.json`, que es
> la salida de `scripts/actualizar-manifiesto-1047.js`; si una huella de esta tabla no coincide con
> la del manifiesto, el manifiesto está viejo y hay que correr ese script.
>
> **Qué significa "suscripción".** Los dos instrumentos son **bilaterales**: el de Nube (v1.3, §10) lo
> suscribe la Empresa y lo contrafirma K+AIR, y el de Encargo (2026-11-11, §12) tiene los mismos dos
> actos. En los dos, el instrumento solo queda **ejecutado** cuando las dos partes firman. El código
> registra los dos actos: desde el 9-nov-2026 el Anexo de Nube tiene su segunda mitad (la
> contrafirma), con su migración, sus dos rutas administrativas y su acta propia.

## 1. Los instrumentos

| Instrumento | Versión | SHA-256 | Bytes | Fecha del texto | Suscripción | Evidencia |
|---|---|---|---|---|---|---|
| **Anexo de Nube** (vigente) | 1.3 | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` | 85 143 | 11-nov-2026 | **SUSCRITO Y CONTRAFIRMADO**: ASEPLUS CARIBE S.A.S. (NIT 900 829 731) lo suscribió el 2026-11-12T15:38:27.990Z y K+AIR lo contrafirmó el 2026-11-12T16:13:54.106Z | Manifiesto `anexo_nube.firmado = true`, `contrafirmado = true`, `fecha = 2026-11-12T15:38:27.990Z`, `hash = fdd10551…b585d`, `evidencia` y `contrafirma_evidencia` con el acta del segundo acto. Los ítems `firmado_nube` y `contrafirma_nube` del gate quedan `ok`. El primer acto no genera acta propia (la evidencia son las columnas y el rastro de la suscripción id 2); el segundo tiene `acta-2-contrafirma-anexo-nube.pdf` (SHA-256 `050f223a…2c74a501`). La v1.3 **no** aparece en `versiones_firmadas`: esa lista es la de las versiones **anteriores**, y la v1.3 es el texto vigente. |
| Anexo de Nube (referencia, **nunca suscrito**) | 1.2 | `242037b3a98f2152b7c1db1f5c562fbe1f9f3e3be4422c03bfcf404e581f7245` | 84 062 | 9-nov-2026 | **Nunca fue suscrito** (queda como referencia) | No aparece en `anexo_nube.versiones_firmadas`. Su huella no se mueve: no se reescribe. Se conserva en el expediente porque el §9.4 del Acuerdo obliga a versionar con huella propia. |
| Anexo de Nube (histórico) | 1.1 | `e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482` | 62 198 | 5-nov-2026 | **Suscrito** por ASEPLUS CARIBE S.A.S. (NIT 900 829 731) el 2026-11-05T22:51:34.349Z, IP 181.63.26.145 | Manifiesto `anexo_nube.versiones_firmadas[0]`. Rastro: SUSCRIPCION_CREADA, ENLACE_ABIERTO, CODIGO_ENVIADO ×2, SUSCRIPCION_FIRMADA. |
| Anexo de Nube (modelo histórico) | 1.0 | `aec7c40132979990cddbad669a8d4690d8439ddc447059d069cd8d19c83214ca` | 59 857 | 30-oct-2026 | **Nunca fue susceptible de suscripción** (su propio texto lo prohibía) | Manifiesto, bloque `anexo_nube.modelo.nota`. |
| **Anexo de Encargo** (vigente) | 2026-11-11 | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` | 94 923 | 11-nov-2026 | **SUSCRITO Y CONTRAFIRMADO**: ASEPLUS CARIBE S.A.S. lo suscribió el 2026-11-12T15:40:06.992Z y K+AIR lo contrafirmó el 2026-11-12T16:14:31.105Z | Manifiesto `anexo_encargo.estado = "firmado"`, `fecha = 2026-11-12T16:14:31.105Z` y `contrafirma_facultad` con la representación legal acreditada. El ítem `estado_encargo` del gate queda `ok`. Actas: `acta-2-anexo-encargo.pdf` (SHA-256 `c0ca4211…6d21f6`) y `acta-2-contrafirma-anexo-encargo.pdf` (SHA-256 `5dcb2149…404b062`). |
| Anexo de Encargo (referencia, **nunca suscrito**) | 2026-11-09 | `0cd6c05f0574bbcdbb8277306a9084784a48815edd862cd31e97eb5435c22a1e` | 93 860 | 9-nov-2026 | **Nunca fue suscrito** (queda como referencia) | No aparece en `anexo_encargo.versiones_firmadas`. Su huella no se mueve: no se reescribe. Queda en el historial de git y en el expediente, por la misma razón del §9.4 del Acuerdo. El archivo `legal/anexo-encargo.html` es hoy el de la versión 2026-11-11 |
| Anexo de Encargo (histórico, **ejecutado**) | 2026-11-06 | `5cc7a34603ea2e300e6c82ed695454eb705363345a3165ae2e75b5733960aa72` | 87 202 | 6-nov-2026 | **Ejecutado**: suscripción de ASEPLUS el 2026-11-07T19:30:14.503Z y contrafirma de K+AIR el 2026-11-07T20:33:22.748Z | Manifiesto `anexo_encargo.versiones_firmadas[0]`. Actas: `acta-1-anexo-encargo.pdf` (SHA-256 `f4a96bee…bdf3`) y `acta-1-contrafirma-anexo-encargo.pdf` (SHA-256 `b1ec9fa2…513c`). |
| **CDPA de Google** (instrumento del proveedor) | texto **Current** (la página **no declara fecha** ⚠️) | `0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1` | 97 831 | capturado 10-nov-2026 (`fecha_declarada_por_google: null`) | **Aceptado por la cuenta el 10-nov-2026** (P1 cerrado) | Manifiesto `subencargados.mail_provider.aceptacion`: `aceptada = true`, modo `aceptado_por_administrador`, `fecha = 2026-11-10`, `fecha_efectividad_addendum = null` (la consola no la muestra). La consola declara «Aceptado por kair@gesstiar.com el Nov 10, 2026». Captura: `scripts/fixtures/captura-consola-cdpa-i-accept-2026-11-10.png`, 96 520 bytes, SHA-256 `9d989067baf9f7908d144dcdb86c04f9b62efa6e34e4714f7dd3132e5d825560`, `verificado_localmente: true`. URL canónica: <https://admin.google.com/terms/apps/8/1/en/dpa_terms.html>. Acta: `scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json` → `node scripts/actualizar-manifiesto-aceptacion-cdpa.js --aplicar` (10-nov-2026). |
| **Acuerdo** (manifestación de voluntad) | v1.6 | `08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e` | 75 961 | 11-nov-2026 | **PUBLICADA** (`publicado: true` en el manifiesto) y **con autorización operativa** (tipo OPERATIVA, aprobada por Javier Robles Fontalvo, owner de K+AIR, el 11-nov-2026; registro id 4). Es la versión **activa en la base de producción** desde el 11-nov-2026, 14:51 hora de Colombia | Manifiesto, bloque `acuerdo`. El texto está en `scripts/fixtures/acuerdo-v1.6.txt`, **versionado en el repo** (no vive en `legal/`, que es donde se publican los anexos). La Constancia de versión y autorización se reemitió contra esta v1.6, se **completó** el 11-nov-2026 con los datos del registro (responsable del registro y fecha; huella `aaf68b4e…d0b413`, 9 794 B) y sus secciones 5 y 6 **siguen vacías**: la autorización vive en el registro de aprobaciones del servicio, no en el documento. |
| Acuerdo (versión **desactivada**, histórica) | v1.5 | `952592f078eb3e8ca6a913361beb6a5eb7c32f22bba2c9fa30d17ab09825be28` | 73 177 | 5-nov-2026 | **Desactivada** el 11-nov-2026 al publicarse la v1.6 (la activación no tiene vuelta atrás por API). Tuvo su autorización operativa (registro id 3, 5-nov-2026) | El texto está en `scripts/fixtures/acuerdo-v1.5.txt`. La firma del 6-nov-2026 se rige por esta v1.5 (§9.5, sin efectos retroactivos); las firmas siguientes requerirán leer y aceptar la v1.6. |

## 2. Las copias publicadas

Cada anexo vive en dos sitios, y las dos copias tienen que ser **byte a byte** iguales: el
manifiesto declara una sola huella y dos textos distintos no caben bajo una huella.

| Archivo | Copia en `legal/` | Copia en `sitio/` | Iguales |
|---|---|---|---|
| Anexo de Nube v1.3 | `sgsst-electron-app/legal/anexo-nube-v1.3.html` | `sitio/anexo-nube-v1.3.html` | Sí |
| Anexo de Nube v1.2 (referencia, nunca suscrito) | `sgsst-electron-app/legal/anexo-nube-v1.2.html` | `sitio/anexo-nube-v1.2.html` | Sí |
| Anexo de Nube v1.1 | `sgsst-electron-app/legal/anexo-nube-v1.1.html` | `sitio/anexo-nube-v1.1.html` | Sí |
| Anexo de Nube v1.0 | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | `sitio/anexo-nube-v1.0.html` | Sí |
| Anexo de Encargo 2026-11-11 | `sgsst-electron-app/legal/anexo-encargo.html` | `sitio/anexo-encargo.html` | Sí |
| Anexo de Encargo 2026-11-06 (archivado) | `sgsst-electron-app/legal/anexo-encargo-2026-11-06.html` | `sitio/anexo-encargo-2026-11-06.html` | Sí |

El Encargo 2026-11-06 se archivó el 9-nov-2026 **antes** de que el 2026-11-09 lo sustituyera: es el
texto que ASEPLUS firmó, con su huella propia, y no se edita jamás. Un texto suscrito no se
toca; sus enlaces describen el estado del día en que se firmó.

El **2026-11-09 tampoco llegó a suscribirse** y el 11-nov-2026 fue sustituido por la versión
**2026-11-11** (`6308b1f7…75b8948`, 94 923 B). Como nunca fue suscrito, su huella
`0cd6c05f…c22a1e` (93 860 B) **no se mueve**: no hay texto firmado que la respalde y no se
reescribe. Queda como referencia en el expediente.

### 2.1 Errata del 11-nov-2026, antes de la firma

Los dos textos que P8 va a firmar se corrigieron ese mismo día, **antes de ser susceptibles de
suscripción y antes de publicarse**:

| Texto | Qué tenía | Qué dice ahora |
|---|---|---|
| **Anexo de Nube v1.3**, §12 | «Esta versión **1.2** remite al Anexo de Encargo version 2026-11-11» | «Esta versión **1.3** remite…». La frase siguiente del mismo párrafo ya decía «Esta versión 1.3 no sustituye ese instrumento»: el párrafo se contradecía a sí mismo |
| **Anexo de Encargo 2026-11-11** | Cuatro puntos (menú, §1 Partes, §5 y §9) remitían al **Anexo de Nube v1.2**, y la §5 decía que esa «versión 1.2» «forma parte integral de este documento» | Los cuatro remiten a la **v1.3**, que es el texto vigente y el que la cláusula de prevalencia de esa misma §5 ya nombraba |

**Por qué no era un detalle de redacción:** la §5 del Anexo de Encargo incorpora por remisión el
Anexo de Nube, y el **art. 44 de la Ley 527 de 1999** determina que lo incorporado es *el texto al
que el vínculo apunta*. Con el vínculo apuntando a la v1.2, el instrumento iba a incorporar un texto
que el propio documento declara superado y cuyo bloque de pendientes está desactualizado.

**Qué NO cambia:** las partes, el objeto, las obligaciones, los precios, la distribución del riesgo,
los plazos y la calificación del papel de Google. Son correcciones de cita.

**Qué cambia:** la huella de cada texto. **Las etiquetas de versión no cambian** —el Anexo de Nube
sigue siendo la **v1.3** y el Anexo de Encargo la **2026-11-11**—, por decisión del owner del
11-nov-2026 (D9 del dictamen de la errata). La huella anterior de cada uno queda **declarada** en la
nota del manifiesto y en el Historial, y las versiones ya suscritas (Nube **v1.1** del 5-nov-2026 y
Encargo **2026-11-06** del 7-nov-2026) **no se tocaron**.

Fundamento y consecuencias: `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md`.

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
| **P7** | **RESPONDIDO 10-nov-2026** (la parte que decide el P8): la contrafirma del Anexo de Nube **va dentro** del servicio, con el mecanismo de firma electrónica ya implementado, y la recomendación del abogado es mantener exactamente esa arquitectura. La respuesta se dio sobre el texto de entonces (la v1.2) y **sigue valiendo** para el texto vigente (la v1.3). **De las cuatro preguntas del §8 del plan, solo quedó respondida esa**: siguen sin responder (a) la versión nueva del Anexo de Encargo u otrosí, (c) qué canales entran en este cierre y (d) el papel de Google sobre los datos de cuenta y la telemetría — las tres quedaron resueltas el 11-nov-2026 en el dictamen legal (ver §3.1) | Owner + abogado | Compuerta de P8: la condición de la acreditación de la facultad de quien contrafirma por Gesstiar ya está **implementada** (migraciones 061/062, `services/poderesEncargado.js`, cuatro rutas administrativas, el acta, la evidencia, el manifiesto y el gate). Ver `acreditacion-facultad-contrafirmante.md` |
| **Decisión del texto** (10-nov-2026) — **registro histórico** | **DECIDIDA: opción A · control interno.** La acreditación de la facultad se queda en el expediente (registro de poderes + acta + evidencia + manifiesto + gate) y **el texto vigente NO cambia**: no hay v1.3, la huella `242037b3…1f7245` de la v1.2 no se mueve, no hay republicación en `legal/` ni en `sitio/`, y **P8 sigue siendo la suscripción de la v1.2 por ASEPLUS**. Tampoco el Anexo de Encargo 2026-11-09. **Lo anterior describe el estado de aquel día (10-nov-2026)**: el registro de la decisión se conserva tal como se tomó y lo que sigue lo revisa | Owner | **Cerrada el 10-nov-2026 y REVISADA el 11-nov-2026** (ver la fila siguiente). Se conservan las dos: lo decidido y lo revisado |
| **Revisión de la decisión del texto** (11-nov-2026) | **REVISADA el 11-nov-2026: el texto sí cambia, por versión nueva en los tres instrumentos.** El fundamento está en `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md`: el Acuerdo v1.5 afirmaba hechos que dejaron de ser ciertos el 10-nov (el canal de correo ya no es una cuenta gratuita de Gmail para consumidores, y el papel de Google no estaba delimitado). Se emitieron el **Acuerdo v1.6** (`08e1eb8b…52f13e`, 75 961 B, 11-nov-2026), el **Anexo de Nube v1.3** (`fdd10551…2b585d`, 85 143 B, 11-nov-2026) y el **Anexo de Encargo 2026-11-11** (`6308b1f7…75b8948`, 94 923 B, 11-nov-2026). El control interno de la acreditación **se mantiene**; lo que cambia es que el texto ya no es el de la v1.2 | Owner | **Cerrada.** La v1.6 **quedó publicada** el 11-nov-2026 (`publicado: true` en el manifiesto), con su autorización operativa registrada (id 4), y es la versión activa en la base de producción |
| **P8** | **Actos pendientes, en este orden.** (1) ~~**publicar la v1.6**~~ → **HECHO el 11-nov-2026**: quedó registrada en la base con su huella `08e1eb8b…52f13e`, su fecha de vigencia 2026-11-11 y su **autorización operativa** (registro id 4); es la versión activa. (2) ~~**firmar la Constancia de versión y autorización**~~ → **HECHO en cuanto al registro**: la Constancia (`sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html`, SHA-256 `aaf68b4e…d0b413`, 9 794 B) se **completó** el 11-nov-2026 con los datos del registro (el responsable del registro y la fecha). Sus secciones 5 y 6 **siguen vacías por diseño** — es el precedente del repo (la Constancia de la v1.4 se emitió así) y la autorización vive en el registro de aprobaciones del servicio, no en el documento. Quedan: (3) **suscribir la v1.3** del Anexo de Nube y el **Encargo 2026-11-11** por ASEPLUS, por el canal administrativo y con motivo; (4) contrafirmar el Anexo de Nube (`POST /internal/admin/empresas/:id_empresa/anexo-nube/contrafirmar/codigo` y `…/anexo-nube/contrafirmar`, con `X-Admin-Actor` y `X-Admin-Motivo`). **La re-suscripción del Encargo 2026-11-11 es por DOS rutas, en este orden**: `POST .../anexo-firmado/quitar` (deshace la contrafirma del 2026-11-06) y después `POST .../anexo-suscrito/quitar` (deshace la suscripción del 2026-11-06). **La segunda ruta se creó el 11-nov-2026 y ya está desplegada**: la función (`desmarcarAnexoSuscrito`) existía, probada y exportada, pero **ninguna ruta HTTP la llamaba**, y sin ella el 409 `SUSCRIPCION_EXISTENTE` hacía imposible la suscripción nueva: era una capacidad prometida y no existente. Verificado por SSH (hash en disco `ae0fff23…7aa2f0`, `active` con `NRestarts=0`, 401 sin llave frente al 404 de una ruta inexistente) y con 8 pruebas en `tests/anexo-encargo-resuscripcion.test.js`. **Los cuatro actos se probaron enteros ese mismo día sobre una COPIA de la base**, en una instancia aislada (puerto 3002, con su propio manifiesto y su propio almacén de actas): los cuatro quedaron ejecutados con sus actas y sus huellas. **La producción no se tocó en ningún momento**: el manifiesto quedó byte a byte igual (`cad606a9…df0d3a`), el servicio sano y los dos actos de ASEPLUS (Nube v1.1 del 5-nov y Encargo 2026-11-06 del 7-nov) intactos. **Antes de contrafirmar**: `FIRMA_ADMIN_ACTOR` con un nombre de persona — **ya definido: Javier Robles Fontalvo**, representante legal de Gesstiar (decisión del owner, 10-nov-2026), así que **no hay que registrar ningún poder**; y el despliegue del servidor tiene que tener las migraciones 060, 061 y 062 aplicadas — **ya aplicadas** (61 migraciones en producción, medidas el 11-nov-2026). **12-nov-2026: el Anexo de Nube tenía el mismo hueco y ya está cerrado.** El Nube también se versiona, y su suscripción pública se rechaza con el mismo `409 SUSCRIPCION_EXISTENTE` mientras la ficha tenga el Anexo de otro texto, pero **no existía ninguna ruta HTTP que deshaciera su fase 1 ni su fase 2**: la única salida era la premarca (`anexo-nube-firmado`), que escribe una fecha de suscripción **antes** de que la suscripción exista (un registro falso en la ficha y un conteo falso en el gate), y `anexo_nube_ejecutado_at` no se validaba contra el texto vigente, así que el operador seguía viendo «ejecutado» un instrumento que ya no existía. **Las dos rutas se crearon el 12-nov-2026**: `POST .../anexo-nube-suscrito/quitar` (fase 1) y `POST .../anexo-nube-ejecutado/quitar` (fase 2), con `X-Admin-Motivo` obligatorio, valor anterior en el rastro append-only, y **sin tocar ninguna fila** de `gh_firma_anexo_nube_suscripciones`. Pruebas: `tests/anexo-nube-resuscripcion.test.js` (13 casos; 11 de ellos fallan con el código viejo, verificado revirtiendo el arreglo). **El orden de los cuatro actos, para P8:** (a) Nube fase 2, (b) Nube fase 1, (c) Encargo fase 2 (`anexo-firmado/quitar`), (d) Encargo fase 1 (`anexo-suscrito/quitar`), y solo entonces las dos suscripciones públicas nuevas | Owner |  **(3)~~**suscribir la v1.3** del Anexo de Nube y el **Encargo 2026-11-11**~~ **HECHO el 12-nov-2026**: en produccion, sobre los textos vigentes. El Anexo de Nube v1.3 (`fdd10551...2b585d`) quedo suscrito por ASEPLUS el 2026-11-12T15:38:27.990Z (suscripcion id 2) y el Anexo de Encargo 2026-11-11 (`6308b1f7...75b8948`) el 2026-11-12T15:40:06.992Z, con su acta `c0ca4211...d21f6`; la verificacion documental de la representante legal (RUT) quedo registrada el 15:40:32.516Z, **antes** de contrafirmar. **(4)~~**contrafirmar**~~ **HECHO el 12-nov-2026**: el Nube el 2026-11-12T16:13:54.106Z (acta `050f223a...4a501`) y el Encargo el 16:14:31.105Z (acta `5dcb2149...4b062`), ambos por Javier Robles Fontalvo con la facultad acreditada `REPRESENTANTE_LEGAL_ENCARGADO`. La compuerta `primera_firma` quedo en `listo: true`, con 40 items `ok`, **0 bloqueantes** y los tres items de esta fila en `ok`. Las dos suscripciones viejas (v1.1 y 2026-11-06) siguen **intactas**. **Lo que NO cambio: `FIRMA_EXIGIR_ANEXO_NUBE` sigue apagada**: el P8 fue un ensayo sobre una empresa de prueba, no la apertura a produccion — los tres items quedaron en `ok`. El paso a paso esta en `MIGRACION-SERVIDOR-FIRMA.md` 8.3. El paso a paso del segundo acto está en `contrafirma-anexo-nube-v1-2.md`; la acreditación de la facultad, en `acreditacion-facultad-contrafirmante.md` |
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

> **Medición del 9-nov-2026.** La de hoy (11-nov) está en el §4.2; ahí está anotado qué se movió
> y por qué. Los números de esta tabla **no son el estado actual**: son el estado de aquel día.

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
| Suite completa del `firma-service` (Node 24, `better-sqlite3` recompilado) | 2 502 tests · 2 500 verdes · **0 rojos** · 2 omitidos (159 s). **Cifra vencida:** la de hoy es 2 574 (ver §4.2) |
| Gate `publicacion` (BD local) | 42 ítems · 32 OK · 6 pendientes · **2 bloqueantes pendientes**: `publicado` y `aprobacion_operativa_vigente` — **los dos son artefacto de la base local vacía**; hay que medir en la VM |
| Gate `primera_firma` (BD local) | **3 bloqueantes reales**: `firmado_nube`, `contrafirma_nube` y `estado_encargo`; más los 2 artefactos de la BD local (`publicado` y `aprobacion_operativa_vigente`). **Corrección del 11-nov:** esta fila decía «4 bloqueantes reales» e incluía `mail_provider_dpa`, pero **P1 se cerró el 10-nov** y el propio §3 lo dice (línea 51): ese ítem no estaba pendiente |
| Envío real desde el **servicio** (`kair@gesstiar.com`) | Message-ID `<5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` · `Authentication-Results: dkim=pass; spf=pass; dmarc=pass` · SPF/DKIM/DMARC = PASS en la UI de Gmail |
| Envío real desde la **app** (5 clientes) | **5/5 OK** con Message-ID propio: TEMPOACTIVA, TEMPOSUM, ASEPLUS, ASEL, COOTRACOM |
| `node main/test-email-env-931.js` | **33/33 OK** — ahora **carga** el cargador y el sender (no solo los lee) |
| `node main/test-secretos-1047.js` (nuevo) | **16/16 OK** — 3 841 archivos versionados barridos, **0 secretos** |
| `node main/_verificar-credenciales-build.js` | Pasa: credenciales de Google, 5 contraseñas de correo y cargador del `.env` cargan |
| Claves de cliente en archivos versionados | **0** (las 5 del `.env` aparecen en 7–8 commits cada una del historial, ninguna en el árbol) |

> **Lo que NO se midió:** el gate real (los dos artefactos de la base local) solo se mide
> en la VM, donde hoy corre el código anterior. **Corrección del 11-nov:** no falta **una**
> migración sino **tres**: la `060` (segunda mitad del Anexo de Nube), la `061` (registro de
> poderes del Encargado) y la `062` (su rastro append-only). ⚠️ El estado exacto del servidor no
> es verificable desde esta máquina.

## 4.2 Lo que se midió el 11-nov-2026

| Control | Resultado |
|---|---|
| Suite completa del `firma-service` (**Node 22.23.4**, `better-sqlite3` recompilado para ABI 127) | **2 574 tests · 2 572 verdes · 0 rojos · 2 omitidos** (220 s) |
| `node scripts/actualizar-manifiesto-1047.js --check` | **0** — el manifiesto está al día |
| `node scripts/generar-anexo-encargo.js --check` | **0** — `legal/anexo-encargo.html` y `sitio/anexo-encargo.html` idénticos (`6308b1f7…75b8948`, versión 2026-11-11) |
| `node scripts/actualizar-manifiesto-anexo-nube.js --check` | **exit 0** — el estado real de la suscripción coincide con el manifiesto. **A las 11:29 daba exit 3** (`no such table: gh_firma_anexo_nube_suscripciones`) porque la base local de desarrollo (`data/manual-8bc/firma.sqlite`, del 27-oct-2026) era anterior a la migración `060`. **Se migrationó (21 migraciones, 61 en total) y el check volvió a 0.** Respaldo de esa base antes de migrar: `data/manual-8bc/firma.pre-migracion-2026-11-11.sqlite` |
| Preflight del Anexo de Nube | **exit 5** y el motivo real: «no hay ninguna Empresa activa con el Anexo de Nube suscrito sobre el texto vigente». **A las 11:29 daba exit 3** (`no such column: anexo_nube_firmado_at`), por la misma base vieja; con las migraciones aplicadas vuelve a dar **exit 5**, que es el motivo que significa algo. El preflight **sí** imprime el bloque de facultad: representante legal «Javier Robles Fontalvo», actor sin definir (el `.env` local no trae `FIRMA_ADMIN_ACTOR`) |
| Gate `primera_firma` (BD local) | **42 ítems · 33 OK · 5 pendientes · 1 aviso · 3 N/A** — `listo: false`. Los 5 pendientes: `publicado`, `aprobacion_operativa_vigente` (los 2 artefactos de la base local) y `firmado_nube`, `contrafirma_nube`, `estado_encargo` (los 3 reales) |
| Tests de la lectura del operador (`tests/routes/admin-empresas*.test.js`) | **45 · 45 verdes** — son tres archivos (15 + 13 + 17). El §4 decía 27 |
| Tests de la vista del operador (`main/test-anexos-1038.js`, `main/test-anexos-1042.js`) | **27 · 27 verdes** (17 + 10) — el §4 decía 26. El +1 es el guard de UI que agregó el 📦1047 |
| `main/test-anexos-1041.js` | 6 · 6 verdes (tercer archivo de la vista) |
| Huellas de los textos | **Cuadran**: Anexo de Nube v1.3 `fdd10551…2b585d` (85 143 B) · v1.1 `e9517536…591482` (62 198 B) · v1.0 `aec7c401…3214ca` (59 857 B) · Encargo 2026-11-11 `6308b1f7…75b8948` (94 923 B) · Encargo 2026-11-06 `5cc7a346…60aa72` (87 202 B) · CDPA `0e1c7294…dc69b1` (97 831 B) · Acuerdo v1.6 `08e1eb8b…52f13e` (75 961 B) · Constancia `aaf68b4e…d0b413` (9 794 B). Las copias de `sitio/` son byte a byte iguales |
| Manifiesto · CDPA | `aceptada = true`, modo `aceptado_por_administrador`, fecha `2026-11-10`, `fecha_efectividad_addendum = null`; captura de 96 520 B con SHA-256 `9d989067…560` (verificada en disco) |
| Migraciones en el repo | **61 archivos `.sql`**, el último `062_encargado_poderes_append_only.sql` |

> ⚠️ **El gate de esta corrida se midió sobre la base local**, que no tiene las migraciones
> 060/061/062. **La compuerta que decide la apertura se mide en el servidor**, con las tres
> migraciones aplicadas. El plan de despliegue está en
> `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §0.

`google_dpa` sigue en `[N/A]`: no es que se cumpla, es que ya no aplica. Un ítem que ya no aplica
no se marca "ok".

> **Medición del 12-nov-2026, en el servidor (la que decide).** Los dos gates
> (`publicacion` y `primera_firma`) dieron **`listo: true`**: 42 ítems cada uno, **40 `ok`**,
> **0 pendientes**, **0 bloqueantes**, 1 aviso y 1 N/A. La **suite** del servicio cerró en
> **2 684 tests** (2 682 verdes, 0 rojos, 2 omitidos; corrida del 12-nov por la noche) y la corrida se repitió desde un clon limpio
> del commit. Esta tabla de §4.2 se conserva como la foto del 11-nov: **no se reescribe**.

## 4.3 Lo que cambió el 11-nov-2026 (los tres textos nuevos)

> **Fundamento:** `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md`.

Los textos vigentes afirmaban hechos que dejaron de ser ciertos el 10-nov-2026: el canal de correo
ya no es una cuenta gratuita de Gmail para consumidores (hay CDPA aceptado y cuenta empresarial),
y el papel de Google no estaba delimitado. Se emitieron **tres versiones nuevas**, cada una con su
propia huella:

| Instrumento | Versión nueva | SHA-256 | Bytes | Fecha | Estado |
|---|---|---|---|---|---|
| Acuerdo de uso | **v1.6** | `08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e` | 75 961 | 11-nov-2026 | **PUBLICADA** (`publicado: true`) el 11-nov-2026 con su autorización operativa (registro id 4); es la versión activa en la base de producción |
| Anexo de Nube | **v1.3** | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` | 85 143 | 11-nov-2026 | **SUSCRITO Y CONTRAFIRMADO el 12-nov-2026.** La v1.2 nunca lo fue: queda como referencia |
| Anexo de Encargo | **2026-11-11** | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` | 94 923 | 11-nov-2026 | **SUSCRITO Y CONTRAFIRMADO el 12-nov-2026.** El 2026-11-09 nunca lo fue: queda como referencia |

**Lo que NO se tocó** (y por qué):

- **Anexo de Nube v1.1** (`e9517536…591482`, 62 198 B, 5-nov-2026): la que **está suscrita** por
  ASEPLUS. Conserva su huella, su fecha y su rastro. Queda en `anexo_nube.versiones_firmadas`.
- **Anexo de Encargo 2026-11-06** (`5cc7a346…60aa72`, 87 202 B): el que **está suscrito y
  contrafirmado**. Se conserva archivado en `legal/` y en `sitio/`, sin editar jamás.
- **Anexo de Nube v1.2** (`242037b3…1f7245`, 84 062 B) y **Anexo de Encargo 2026-11-09**
  (`0cd6c05f…c22a1e`, 93 860 B): nunca fueron suscritos, así que **no hay firma que los respalde**
  y sus huellas no se mueven. Quedan como referencia en el expediente (la v1.2 conserva su archivo;
  el 2026-11-09 queda en el historial de git, porque `legal/anexo-encargo.html` es hoy el de la
  versión 2026-11-11).

**Constancia de versión y autorización** (`sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html`,
SHA-256 `aaf68b4e7df5e2757d5885840056218d97a0cbb1c9fa624bf7861962c8d0b413`, 9 794 B): **reemitida
contra la v1.6, completada con los datos del registro de aprobaciones y SIN FIRMAR** (las secciones 5
y 6 del documento siguen vacías: la autorización vive en el registro del servicio).

**La decisión del 10-nov-2026** (opción A · control interno, "no hay v1.3 y la huella `242037b3…1f7245`
no se mueve") **queda registrada** en el §3 y **fue revisada el 11-nov-2026**: el texto sí cambia,
por versión nueva y con huella propia, en los tres instrumentos.

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
| 4 | El service corría con código anterior (58 migraciones) | Las tres migraciones del 📦1047 (`060`, `061` y `062`) están escritas y probadas; **faltan desplegarlas en la VM** para medir el gate real. El plan, con los comandos de verificación, está en `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §0 |
| 5 | La suite local no se podía correr (`better-sqlite3` compilado para otro ABI de Node) | `better-sqlite3` recompilado: el 10-nov para Node 24 (ABI 137) y el **11-nov para Node 22 (ABI 127)**, que es el runtime que el servidor debe usar (`better-sqlite3` 11.10.0 no compila contra la V8 de Node 26). Suite completa **2 574 tests · 0 rojos** |

> **Lo que NO cambia:** el texto de los anexos, sus versiones y sus huellas. El gate
> `primera_firma` sigue con los **mismos 4 bloqueantes reales** (`firmado_nube`,
> `contrafirma_nube`, `mail_provider_dpa`, `estado_encargo`). Lo que se movió fue el
> **canal de correo de la app**, que estaba muerto y ahora **manda correo real** (5/5).
>
> ⚠️ **Corrección del 11-nov-2026:** este párrafo describe el estado **de aquel día (10-nov)**.
> Ese mismo día se cerró `mail_provider_dpa` (P1), así que los bloqueantes reales son **3**
> (ver §4.1). Y el 11-nov-2026 **el texto sí cambió**: hay Acuerdo v1.6, Anexo de Nube v1.3 y
> Anexo de Encargo 2026-11-11 (ver §4.3).
