# Propuesta de Anexo de Nube v1.4 — 12 de noviembre de 2026

> **Qué es este documento.** Una **propuesta de trabajo**, no el texto firmable ni una versión
> publicada. No se editó `legal/anexo-nube-v1.3.html` ni ninguna de sus copias: un texto suscrito
> **no se corrige**, se sustituye por una versión nueva con huella propia (art. 44 de la Ley 527 de
> 1999 y §9.4 del Acuerdo de uso). Lo que sigue es el diagnóstico exacto y el reemplazo propuesto
> para que el owner decida y el abogado revise.

**Estado del texto vigente.** Anexo de Nube **v1.3**, SHA-256
`fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d`, 85 143 bytes, suscrito por
ASEPLUS CARIBE S.A.S. el 2026-11-12T15:38:27.990Z y contrafirmado por K+AIR el
2026-11-12T16:13:54.106Z. No se toca.

## 1. Por qué hace falta una versión nueva

El texto que gobierna la relación **se contradice a sí mismo** y **afirma como pendientes actos que
ya se ejecutaron**. No es una imprecisión de redacción: un lector —la Empresa, un auditor o un
titular— que lea el §1 y después la ficha del §5 recibe dos verdades incompatibles sobre el mismo
canal de correo. Y el Anexo de Encargo, que remite a este texto, arrastra la misma foto.

Las siete divergencias están abajo, cada una con su línea exacta y la evidencia que la desmiente.

## 2. Las siete divergencias

| # | Ubicación | Lo que dice el texto | Lo que es (evidencia) | Corrección propuesta |
|---|---|---|---|---|
| C1 | §1, líneas 90-93 | «Esta declaración es condicional: **no afirma** que el CDPA haya sido aceptado por el administrador de la cuenta, **ni que la cuenta esté activa**, ni que los alias existan, **ni que el envío real** con el dominio `@gesstiar.com` **ya se haya hecho**» | El mismo §1, líneas 101-108, declara **cumplidos** P1 (CDPA aceptado el 10-nov-2026), P2 (cuenta activa con MFA), P4 (SPF/DKIM/DMARC) y P5 (envío real con Message-ID y `Authentication-Results`). El manifiesto lo registra: `subencargados.mail_provider.aceptacion.aceptada = true`, `cuenta`, `fecha = 2026-11-10` | Retirar la negación absoluta y dejarla limitada a lo que de verdad sigue abierto: «no afirma que los alias `privacidad@`, `soporte@` e `incidentes@` existan, porque son el pendiente P3» |
| C2 | §1, líneas 112-114 | «**La copia del respaldo fuera del servidor** y la purga periódica de los respaldos **se ejecutan** con los scripts del despliegue» | **No hay copia fuera del servidor.** Los 22 respaldos de la base y 16 del storage viven en `/opt/kair-firma/backups`, el mismo disco que la base (M.7). `deploy/backup-firma.sh:286-288` tiene la línea de `rclone copy` **comentada**; `deploy/backup-offsite.sh` está escrito y validado, pero **sin destino configurado** | «La copia fuera del servidor está **prevista** con `deploy/backup-offsite.sh` y **queda pendiente** hasta que el owner decida el destino y se verifique la primera copia; la purga periódica sí se ejecuta con los scripts del despliegue» |
| C3 | §1, líneas 163-165 | «La activación de esa cuenta y la migración de la credencial del servidor **se cerraron** el 10 de noviembre de 2026 **(pendientes P2 y P5)**» | P2 y P5 **son los pendientes que se cerraron** ese día, no dos pendientes abiertos: `decision-regularizacion-correo-2026-11-09.md:31` y `:34` los marcan «Cerrado», y el mismo §5 declara el envío real con su Message-ID | «…se cerraron el 10 de noviembre de 2026: **eran los pendientes P2 y P5**» |
| C4 | §5, ficha «Contraseña de aplicación», líneas 617-620 | «**El método de autenticación está pendiente de decisión y de verificación por el owner (P2)**: si la consola tiene habilitadas las app passwords… si no, la opción es OAuth2» | P2 está cerrado desde el 10-nov-2026: la cuenta usa **app password** (`kair-firma-smtp`) con verificación en dos pasos, y el envío real ya se hizo con esa credencial (`decision-regularizacion-correo-2026-11-09.md:31`) | «El método de autenticación **es app password** de la cuenta `kair@gesstiar.com`, con verificación en dos pasos habilitada. **OAuth2 no se usa hoy**: queda como alternativa si el owner deshabilita las app passwords, y exigiría cambio de código y variables nuevas» |
| C5 | §5, líneas 623-624 | «**La fecha de generación de la credencial vigente no consta** y no se inventa» | La credencial vigente es `kair-firma-smtp`, **creada el 10-nov-2026**; la fecha está registrada en `decision-regularizacion-correo-2026-11-09.md:31` | «La credencial vigente (`kair-firma-smtp`) **se generó el 10 de noviembre de 2026**, cuando se migró la cuenta; esa es la fecha que consta en el expediente» |
| C6 | §5, ficha «Plantilla vigente», líneas 661-662 | «**El envío con el remitente nuevo** (`kair@gesstiar.com`) **sigue pendiente de ejecutar (P5)**» | El mismo §5, líneas 603-607, declara el envío **hecho**, con `Message-ID <5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` y `Authentication-Results: dkim=pass; spf=pass; dmarc=pass`. P5 está cerrado | Eliminar la frase y dejar la evidencia del envío real que ya está dos párrafos arriba en la misma ficha |
| C7 | Anexo de Encargo 2026-11-11, líneas 570-574 | «A la fecha de esta versión, esa versión 1.3 **no está todavía suscrito ni contrafirmado**: su suscripción, y la de este Anexo de Encargo…, **son pasos pendientes**» | Los dos instrumentos quedaron **suscritos y contrafirmados el 12-nov-2026** (suscripciones id 2, actas `050f223a…` y `5dcb2149…`; manifiesto `anexo_nube.firmado/contrafirmado = true`, `anexo_encargo.estado = firmado`) | No se corrige el Encargo 2026-11-11: se **reemite** una versión nueva que remita a la v1.4 y declare los actos ejecutados. La corrección de esta frase va en esa versión, no en la suscrita |

**Lo que el texto sí dice bien y no se toca:** P3 (los tres alias) y P6 (revocar las app passwords
anteriores) siguen pendientes; el cifrado en reposo del disco sigue **no implementado**; el RNBD y
la determinación sobre Google conservan su literal.

## 3. Texto propuesto para el Anexo de Nube v1.4

Los reemplazos son literales sobre el HTML del §1 y del §5. El que arme la v1.4 debe aplicarlos
sobre una **copia nueva**, generar el HTML definitivo y calcular su huella; **nunca** sobre
`anexo-nube-v1.3.html`.

### C1 — §1, primer bullet

**Antes** (líneas 90-93):

> Esta declaración es condicional: no afirma que el CDPA haya sido aceptado por el administrador de
> la cuenta, ni que la cuenta esté activa, ni que los alias existan, ni que el envío real con el
> dominio `@gesstiar.com` ya se haya hecho.

**Después:**

> Esta declaración es condicional en un solo punto: **no afirma que los alias `privacidad@`,
> `soporte@` e `incidentes@` existan**, porque crearlos y verificarlos es el pendiente P3, a cargo
> del owner. Los demás hechos que sostienen el papel de Google —la aceptación del CDPA, la cuenta
> empresarial activa, el envío real con el dominio `@gesstiar.com` y la publicación de SPF, DKIM y
> DMARC— están cumplidos y se declaran con su evidencia en el segundo bullet y en la ficha técnica
> del §5.

### C2 — §1, bullet del cifrado

**Antes** (líneas 112-114):

> La copia del respaldo fuera del servidor y la purga periódica de los respaldos se ejecutan con los
> scripts del despliegue…

**Después:**

> La copia del respaldo **fuera del servidor está prevista** con el script `deploy/backup-offsite.sh`
> y **queda pendiente** hasta que el owner decida el destino y se verifique la primera copia; la
> purga periódica de los respaldos sí se ejecuta con los scripts del despliegue…

### C3 — §1, párrafo de la cuenta

**Antes** (líneas 163-165):

> …se cerraron el 10 de noviembre de 2026 (pendientes P2 y P5)…

**Después:**

> …se cerraron el 10 de noviembre de 2026: **eran los pendientes P2 y P5**…

### C4 y C5 — §5, ficha «Contraseña de aplicación»

**Antes** (líneas 617-624): el método «está pendiente de decisión y de verificación por el owner
(P2)», con OAuth2 como alternativa abierta, y «la fecha de generación de la credencial vigente no
consta».

**Después:**

> El método de autenticación **es app password** de la cuenta `kair@gesstiar.com`, con verificación
> en dos pasos habilitada. La credencial vigente (`kair-firma-smtp`) **se generó el 10 de noviembre
> de 2026**, cuando se migró la cuenta, y esa es la fecha que consta en el expediente. **OAuth2 no se
> usa hoy**: queda como alternativa si el owner deshabilita las app passwords, y exigiría cambio de
> código y variables nuevas.

### C6 — §5, ficha «Plantilla vigente»

**Antes** (líneas 661-662):

> El envío con el remitente nuevo (`kair@gesstiar.com`) sigue pendiente de ejecutar (P5).

**Después:** se elimina. La ficha ya declara, en las líneas 603-607, el envío real con su
`Message-ID` y su `Authentication-Results`; repetir un pendiente que no existe es lo que confunde.

### C7 — Anexo de Encargo (versión nueva)

El Encargo vigente **no se edita**. La versión nueva —`2026-11-12` o la que el owner decida— debe:

1. Remitir al **Anexo de Nube v1.4** en el menú, en el §1 (Partes), en el §5 (Proveedores externos
   y subencargados) y en el §9.
2. Reemplazar la frase de las líneas 570-574 por la constancia de los actos ejecutados: la v1.3 y el
   Encargo 2026-11-11 quedaron **suscritos y contrafirmados el 12-nov-2026**, con sus actas y
   huellas.
3. Conservar intactas las cláusulas de prevalencia, la matriz de finalidades y la remisión al CDPA.

## 4. Qué arrastra la v1.4 (para que no sorprenda)

- **Huella y bytes nuevos.** El manifiesto pasa a `anexo_nube.version = 1.4` y `modelo.hash` con la
  huella del texto nuevo; la v1.3 queda en `versiones_firmadas` **sin reescribirse**.
- **El gate retrocede mientras la v1.4 no esté suscrita.** `anexo_nube.firmado` y `contrafirmado`
  tienen que quedar en `false` para el texto nuevo (o el gate diría «firmado» sobre un texto que
  nadie firmó). Eso deja `firmado_nube` y `contrafirma_nube` en pendiente, y el cuadro pasa de 40
  `ok` a 38. **Es el precio de no publicar un texto falso**, y el owner tiene que decidirlo.
- **El Encargo también se reemite**, así que `estado_encargo` vuelve a pendiente hasta su firma. El
  cuadro baja a 37 `ok`. No es un retroceso real: es el mismo estado que tenía la v1.3 antes del
  12-nov.
- **Las dos copias** (`legal/` y `sitio/`) tienen que quedar byte a byte iguales, y el sitio público
  no se toca hasta que el owner autorice la publicación.
- **La firma de la v1.4 por una empresa real** es lo que vuelve a poner el gate en verde. ASEPLUS es
  la empresa de prueba: no hace falta volver a firmarla para «cerrar» M.18; hace falta que el primer
  cliente real firme el texto correcto.

## 5. Lo que esta propuesta NO hace

- No modifica `legal/anexo-nube-v1.3.html`, `legal/anexo-encargo.html`, sus copias de `sitio/` ni
  ninguna acta o suscripción.
- No cambia P3, P6, el cifrado del disco ni la determinación sobre Google.
- No enciende `FIRMA_EXIGIR_ANEXO_NUBE` ni publica nada.
- No sustituye la revisión del abogado: la decisión de reemitir y el texto final son suyos y del
  owner.

## 6. Actos que exige, en orden

| # | Acto | Quién | Evidencia que deja |
|---|---|---|---|
| 1 | Decidir si se emite la v1.4 ahora o se espera al primer cliente real | owner | decisión escrita en el expediente |
| 2 | Revisar los siete reemplazos y la remisión del Encargo | abogado | respuesta escrita, adjunta al dictamen del 11-nov-2026 |
| 3 | Armar la v1.4 y el Encargo nuevo, con huellas y manifiesto | equipo | archivos en `legal/` y `sitio/`, `legal-readiness.json` actualizado |
| 4 | Firmar (o dejar constancia de que se publica sin firma y con el gate en pendiente) | owner | acta de suscripción y contrafirma, o decisión de no firmar |

## 7. Evidencia

- `sgsst-electron-app/legal/anexo-nube-v1.3.html`: §1 líneas 90-93, 101-108 y 112-114; §5 líneas
  603-607, 617-624 y 661-662.
- `sgsst-electron-app/legal/anexo-encargo.html`: líneas 570-574 y las remisiones de las líneas 28,
  72, 431 y 834.
- `sgsst-electron-app/firma-service/legal-readiness.json`: `anexo_nube.firmado`, `contrafirmado`,
  `contrafirma_fecha`, `versiones_firmadas` y `anexo_encargo.estado`.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/decision-regularizacion-correo-2026-11-09.md`:
  líneas 31 (P2, con la fecha de la app password) y 34 (P5, con el Message-ID).
- `sgsst-electron-app/firma-service/deploy/backup-firma.sh:286-288` (la línea de `rclone`
  comentada) y `deploy/backup-offsite.sh` (escrito, sin destino configurado).
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/meta-para-abrir-a-empresas-reales-2026-11-12.md`:
  M.7 (no hay copia fuera del servidor) y M.18 (la versión nueva).
