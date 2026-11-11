# Informe legal sobre el cierre de la firma electrónica (11-nov-2026)

> **Estado al cierre del 11-nov-2026 (después de este informe).** El informe no se reescribe: es el
> diagnóstico del día. Los hallazgos 1 y 2 de la §4 ya no aplican: el **Acuerdo v1.6** quedó
> **publicado** (`publicado: true` en el manifiesto) con su autorización operativa registrada (id 4,
> tipo OPERATIVA, 11-nov-2026) y es la versión activa en la base de producción desde las 14:51 hora de
> Colombia; y la **Constancia** se reemitió contra la v1.6 y ese mismo día se **completó** con los
> datos del registro del owner (huella `aaf68b4e…d0b413`, 9 794 B), con sus secciones 5 y 6 vacías
> porque la autorización vive en el registro de aprobaciones del servicio. Los tres instrumentos se
> emitieron con versión nueva (Acuerdo v1.6, Anexo de Nube v1.3, Anexo de Encargo 2026-11-11). Lo que
> **sigue pendiente** son los actos que faltan de P8: suscribir la v1.3 del Nube y el Encargo
> 2026-11-11 por ASEPLUS, y contrafirmar. `FIRMA_EXIGIR_ANEXO_NUBE` sigue **apagada**.

> Documento de expediente. Contiene (a) el **informe del agente jurídico** sobre las cinco
> preguntas remitidas por el owner, (b) la **verificación de cada afirmación contra el repo** y
> (c) **tres hallazgos que el agente no marcó**, verificados con el texto y los archivos.
>
> **Naturaleza:** asesoría jurídica informativa. **No sustituye la decisión del representante
> legal de Gesstiar S.A.S.** Ninguna recomendación se presume aprobada por silencio: su
> registro corresponde a la **sección E** del checklist definitivo (`J1`–`J14`).
>
> **Base verificada:** Ley 527/1999 · Decreto 1074/2015 (arts. 2.2.2.47.x y 2.2.2.25.x) ·
> Ley 1581/2012 · Ley 1564/2012 arts. 244 y 247 · Circular Única SIC, Título V (actualizado por
> la Circular 001 del 9-ene-2026) · Código de Comercio art. 196 · Supersociedades Of.
> 220-068333 del 28-03-2023 · Ley 1258/2008 art. 26.

---

## 1. Respuesta corta

1. **La contradicción es real y el Acuerdo vigente afirma hechos falsos.** El §10.1 del Acuerdo
   v1.5 dice, literalmente, que Google «actúa como Responsable del Tratamiento» y que «**No
   existe DPA empresarial ni contrato de transmisión con Google**», y el §8.7 afirma que el
   canal «se presta mediante una cuenta gratuita de Gmail para consumidores». Desde el
   10-nov-2026 el canal es Google Workspace con el CDPA aceptado.
2. **P1 — Publicar una v1.6 del Acuerdo**, con cambio acotado. No un otrosí, no una nota
   interna. **No mueve la huella del Anexo de Nube v1.2** (`242037b3…1f7245`).
3. **P2 — NO otrosí del Anexo de Encargo.** El acto que corresponde es la re-suscripción de la
   versión vigente (2026-11-09) por el canal administrativo, con motivo, y su contrafirma.
4. **P3 — Cerrar P3 antes de ejecutar P8**, porque el §11 del Anexo de Encargo publica el canal
   de derechos: cerrarlo después obligaría a una **segunda** re-suscripción.
5. **P4 — Tres correcciones al manifiesto** y **reemitir la Constancia** contra la versión que
   se publique (hoy declara v1.4 y está `no_firmada`).
6. **P5 — Orden de P8:** (1) suscripción ASEPLUS del Anexo de Nube v1.2 → (2) contrafirma
   K+AIR → (3) re-suscripción administrativa del Anexo de Encargo → (4) contrafirma K+AIR.
7. **Bloqueante único para abrir a trabajadores reales:** P3 + P8 + Constancia firmada de la
   versión vigente + compuertas medidas **en el servidor**.

---

## 2. Aplicación a K+AIR

### P1 · Acuerdo v1.5 vs. Anexo de Nube v1.2 vs. CDPA → **v1.6 del Acuerdo**

**Hecho verificado (texto del Acuerdo v1.5, `scripts/fixtures/acuerdo-v1.5.txt`):**

- **§8.7, párrafo 2:** «Actualmente, dicho servicio se presta mediante una cuenta gratuita de
  Gmail para consumidores, operada por Google.»
- **§10.1, párrafo 3:** «Gesstiar S.A.S. utiliza actualmente una cuenta gratuita de Gmail para
  consumidores, operada por Google.»
- **§10.1, párrafo 4:** «Google LLC decide sobre la finalidad y los medios de su propio
  servicio y trata los datos **por cuenta propia**; en esta operación **actúa como Responsable
  del Tratamiento** (art. 3, literales d) y e), de la Ley 1581 de 2012) […] **No existe DPA
  empresarial ni contrato de transmisión con Google**, y esta determinación no atribuye al
  Encargado facultades de supresión sobre las copias del proveedor ni le impone obligaciones
  contractuales a este.»
- **§10.5(f), párrafo 4:** repite literalmente ese mismo párrafo.
- **§10.5(f), párrafo 2:** «Mientras se utilice una cuenta gratuita de Gmail para consumidores,
  Gesstiar S.A.S. informará esta circunstancia a la Empresa […] No afirmará que Google esté
  sujeto al contrato de transmisión de datos […] ni que existe un acuerdo de tratamiento
  empresarial con Google, salvo que su existencia y aplicabilidad **hayan sido verificadas
  documentalmente**.»
- **§10.5(f), párrafo 6:** «La utilización de Gmail de consumo no se entenderá como una
  autorización contractual general para incorporar proveedores sin evaluación.»

**En contraste**, el Anexo de Nube v1.2 (§§1 y 4) y el Anexo de Encargo 2026-11-09 (§§4, 5, 8)
ya dicen: cuenta empresarial de Google Workspace (`kair@gesstiar.com`), CDPA como vínculo
contractual y **Google como Subencargado** del canal de correo.

**Cláusula que obliga a la vía de versión nueva (verificada):**

> **§9.4:** «La modificación del contenido de este Acuerdo requiere la publicación de una
> versión nueva con su propia huella digital.»

**Costo de cada vía:**

| Vía | Evaluación |
|---|---|
| **v1.6 del Acuerdo** | **Recomendada.** Los trabajadores que aceptaron la v1.5 se rigen por ella para las firmas ya realizadas (§9.5, sin efectos retroactivos) y deben leer y aceptar la v1.6 en la firma siguiente (el mecanismo de reaceptación ya está construido y probado en ambiente real: `AGREEMENT_VERSION_REACCEPT_REQUIRED` + `AGREEMENT_VERSION_MIGRATED`, pruebas 9A y 10.4). No toca la huella del Anexo de Nube. Costo: republicación, actualización del manifiesto y **reemisión de la Constancia**. |
| **Otrosí Gesstiar–Empresa** | **Descartado.** El §1.5 del Acuerdo solo remite los datos y canales del Encargado al Anexo de Encargo; no habilita un otrosí para cambiar §§10.1 y 10.5(f). No llega al Titular, no tiene versión ni huella en la Constancia (§9.6) y deja dos verdades sobre el mismo canal (arts. 4(d) veracidad y 4(e) transparencia, Ley 1581). |
| **Documento interno** | **Descartado.** No modifica el texto que el trabajador aceptó. |

**Corrección acotada propuesta (verificada contra el texto):** §8.7 **párrafo 2** (no el
último, que es una remisión al §10.1 y no cambia), §10.1 **párrafos 3 y 4**, §10.5(f)
**párrafos 2, 4 y 6**. No tocar §§3.4, 7, 9, 10.2–10.4 ni 12.

### P2 · Anexo de Encargo → **NO otrosí; basta la versión 2026-11-09**

**Hecho verificado (texto del Anexo de Encargo):**

> **§7 Sustitución:** «Este Anexo **sustituye en su totalidad** el Anexo de Encargo de
> Tratamiento de Datos Personales anterior entre las mismas partes, si lo hubiere, y **desde su
> firma** se aplica a todas las operaciones de tratamiento que la empresa realice en el servicio de
> firma electrónica K+AIR. La sustitución no tiene efectos retroactivos: la evidencia del
> proceso de firma que ya se haya generado bajo el Anexo anterior se conserva…»

Y el §12: desde su firma por ambas partes, **deja sin efecto la versión 2026-11-06**, suscrita y
contrafirmada el 7-nov-2026.

**Recomendación:** el instrumento nuevo ya trae su propia cláusula de sustitución y su
eficacia está condicionada a los dos actos. Un otrosí sería un quinto instrumento sin efecto.
El acto que corresponde es la **re-suscripción de la versión vigente por el canal administrativo,
con un motivo expreso** que cite el §7 y el §12, seguida de la contrafirma de K+AIR. La
suscripción anterior **no se reescribe**: queda en `versiones_firmadas` con su huella
`5cc7a346…0aa72` y su texto archivado, que no se edita jamás.

### P3 · Canales de derechos → **cerrar P3 antes de P8**

**Hecho verificado (manifiesto y textos):**

- `encargado.canal_proteccion_datos = "privacidad.kair@gmail.com"`, `canal_confirmado: true`.
- Bloque `canales`: `derechos` → `privacidad.kair@gmail.com`, `pqrs` → `adminkair@gmail.com`,
  `incidentes` → `privacidad.kair@gmail.com`, los tres con `estado: "excepcion_documentada"` y
  el motivo: «Los alias de Workspace (privacidad@gesstiar.com, soporte@gesstiar.com,
  incidentes@gesstiar.com) **NO están verificados**: no consta que existan en la consola»,
  con `accion`: «Crear los alias en la consola de Workspace, verificar cada uno con un envío
  real y migrar después los canales en los documentos públicos y en `src/config.js`».
- El Anexo de Encargo publica esos mismos buzones: «Canal de protección de datos y de derechos
  ARCO: privacidad.kair@gmail.com · Canal de PQRS y soporte: adminkair@gmail.com y página de
  soporte».
- El **§5 (vii)** del Anexo de Encargo lista «la creación y verificación de los alias de
  privacidad, soporte e incidentes del dominio, a cargo de Gesstiar S.A.S.» como paso pendiente.

**Lo que la ley exige:** no que el canal esté en el dominio de la empresa, sino que exista
canal publicado, gratuito y permanente, con radicado y traslado al Responsable en 2 días
hábiles (Ley 1581 arts. 15.1 y 18(e)) y sin restringir el acceso a personas autorizadas
(art. 18(j)). Eso **sí** lo cumple hoy la casilla de consumo.

**El problema es probatorio, no de ilegalidad:** `canal_confirmado: true` enciende la compuerta
`canal_datos` con el detalle «Canal válido, documentado y confirmado», sin acta, fecha ni
monitoreo que lo sustente, mientras la tabla de canales dice que los alias no están verificados.

**Mínimo verificable de P3:** (i) crear los tres alias en la consola de Workspace; (ii) **un
envío real a cada alias**, con fecha y Message-ID del dominio, en acta; (iii) evidencia del
procedimiento de radicado y traslado en 2 días; (iv) actualizar los canales en los documentos
publicos y en `src/config.js`, y el manifiesto, para que `canal_confirmado: true` quede
sustentado.

**Por qué antes de P8:** cambiar el canal publicado en el §11 del Anexo de Encargo cambia su
texto y su huella → versión nueva y **segunda** re-suscripción. Si se cierra P3 primero, hay
una sola.

### P4 · Manifiesto y compuertas

| # | Hallazgo | Acción |
|---|---|---|
| 1 | **`acuerdo.publicado: true` no está sustentado en el expediente.** La compuerta `publicado` lee la base (`gh_firma_acuerdo_versiones`) y el detalle hoy es «No hay una versión activa del Acuerdo». Además, la `nota` del bloque sigue diciendo «Candidata v1.4, NO aprobada y NO publicada», **contradiciendo sus propios campos** (`version: v1.5`, `publicado: true`, `fecha: 2026-11-05`). ⚠️ No verificado en el servidor. | Reescribir la nota con hechos verificables (versión, huella, fecha de publicación, estado de la Constancia, qué falta). |
| 2 | **Constancia:** `version: "v1.4"`, `estado: "no_firmada"`, `fecha: null`, `evidencia: null`, mientras el Acuerdo vigente es v1.5. Es el único instrumento diseñado para autorizar la publicación y **nombra una versión que no es la vigente**. | Reemitirla contra la v1.6 (o v1.5) con la huella exacta y suscribirla por el representante legal. |
| 3 | **`google_dpa: no_aplica` es correcto** (legado, no «ok»: evita un verde falso). **`mail_provider_dpa: ok` es defendible con reserva**: el texto de los anexos es condicional («mientras el CDPA esté vigente y sea aplicable a la cuenta») y `fecha_efectividad_addendum` es `null`. | Mantener `ok` y adjuntar la salvedad al detalle de la compuerta. |
| 4 | `anexo_nube` (modelo 1.2 sin suscribir, v1.1 en `versiones_firmadas`) y `anexo_encargo` (vigente no suscrito, 2026-11-06 ejecutada) son defendibles. | Cambiar la etiqueta del Encargo para que no se lea como «la Empresa no tiene contrato»: *vigente no suscrito; 2026-11-06 ejecutada*. |
| 5 | El grupo de la compuerta se llama `acuerdo_v1_1` y el ítem dice «Versión v1.1 activa en la base». | Renombrar a «versión vigente». |

### P5 · Guion exacto de P8

**Precondiciones:** aplicar en el servidor las migraciones **060, 061 y 062**; actor declarado
`Javier Robles Fontalvo` (representante legal → el código responde
`REPRESENTANTE_LEGAL_ENCARGADO`, **sin registrar poder**); `FIRMA_ADMIN_ACTOR` definido en el
servidor; y las decisiones de la v1.6 / P3 tomadas.

| Acto | Qué | Cierra |
|---|---|---|
| 1 | **Suscripción por ASEPLUS del Anexo de Nube v1.2** (huella `242037b3…1f7245`) por enlace de un solo uso, con código al medio que confirme el representante legal. | `firmado_nube` |
| 2 | **Contrafirma de K+AIR del Anexo de Nube v1.2**, dentro del servicio, con actor, motivo, código y acta propia con su huella y la sección de facultad. | `contrafirma_nube` (y `empresas_nube` por empresa) |
| 3 | **Re-suscripción del Anexo de Encargo vigente (2026-11-09)** por ASEPLUS, por canal administrativo, con motivo que cite el §7 y el §12. | parte de suscripción |
| 4 | **Contrafirma de K+AIR del Anexo de Encargo**, con actor, motivo, código y acta. | `estado_encargo` (y `empresas_base` por empresa) |

**Constancias que deben quedar:** actas de suscripción y de contrafirma de cada instrumento con
su huella; copias firmadas por cada parte con su propia huella (el servicio no las almacena:
Anexo de Encargo §12); rastros de solo anexado; acta y captura de la aceptación del CDPA;
**acta de P3 con los envíos reales a los alias**; Constancia reemitida y firmada; decisiones del
owner en la sección E (J1–J14).

**Lo que NO debe hacerse:** no reescribir la suscripción de la 2026-11-06 ni la v1.1 del Anexo de
Nube; no publicar alias no verificados; no encender `FIRMA_EXIGIR_ANEXO_NUBE` antes de que los
textos estén ejecutados; no abrir a trabajadores reales antes del cierre.

---

## 3. Hallazgos propios (no marcados por el agente), verificados contra el repo

### H1 🔴 · El Anexo de Nube v1.2 **también** está desactualizado

La v1.2 (escrita el 9-nov, **al día antes** de que se cerraran P1/P2/P4/P5) contiene su propia
declaración de pendientes:

> «**Pendientes del proceso de regularización del canal de correo (responsable: el owner). Los
> siguientes puntos no están cumplidos y este Anexo no los declara cumplidos:** P1, aceptar o
> confirmar la incorporación del CDPA en la consola de Workspace […] P2, confirmar que
> kair@gesstiar.com está activa, con verificación en dos pasos […] P3, crear y verificar los
> alias privacidad@, soporte@ e incidentes@ de gesstiar.com; P4, verificar SPF, DKIM y DMARC de
> gesstiar.com; P5, cambiar la credencial del servidor, reiniciar y ejecutar un envío real,
> guardando el Message-ID, el Authentication-Results y el remitente visible; y P6, revocar las
> app passwords de la cuenta de correo anterior del Encargado […] **Todos son actos del owner en
> consolas a las que el servicio no tiene acceso: ninguno los cierra una reescritura.**»

Y en su **§3**: «La activación de esa cuenta y la migración de la credencial son los pendientes
**P2 y P5** […] **hasta que se cierren, el último envío real que puede probarse es el del 26 de
octubre de 2026**.»

**Hoy P1, P2, P4 y P5 están cerrados** (CDPA aceptado; cuenta con 2SV; SPF/DKIM/DMARC
publicados; envío real con `dkim=pass; spf=pass; dmarc=pass` y Message-ID
`<5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>`). El texto, sin embargo, sigue diciendo
que **no están cumplidos** y que el último envío probable es del 26-oct.

**Consecuencia:** la decisión del owner del 10-nov («no hay v1.3; la huella `242037b3…1f7245` no
se mueve») choca con este hecho. El texto por suscribir **afirma un estado que ya no es el
real**. Corregirlo mueve la huella; no corregirlo deja una afirmación falsa en el instrumento
bilateral que K+AIR contrafirma.

> La frase del propio Anexo («ninguno los cierra una reescritura») es cierta **sobre los actos**,
> pero no sobre **la declaración**: el texto no se actualizó cuando los actos se cumplieron.

### H2 🔴 · El Anexo de Encargo 2026-11-09 tiene la misma condición

Su §5 lista los pasos pendientes del proceso: **(v)** la aceptación del CDPA en la consola ·
**(vi)** la confirmación de que la cuenta empresarial está activa, incluida la migración
efectiva de la credencial y su comprobación con un envío real · **(vii)** la creación y
verificación de los alias · **(viii)** la confirmación escrita del abogado · **(ix)** la
suscripción de esta versión y su contrafirma.

Los incisos **(v)** y **(vi)** están **cerrados** desde el 10-nov. **(viii)** está answered en
parte (la respuesta del abogado del 10-nov sobre la contrafirma) pero **no** sobre el alcance de
los canales ni el papel de Google para los datos de cuenta y la telemetría.

**Consecuencia:** el Anexo de Encargo que se va a firmar en P8 dice, en su propia sección de
pendientes, cosas que ya son ciertas. Y es el texto cuya huella el gate mide.

### H3 🟡 · El manifiesto tiene un bloque desactualizado que **nadie lee**

`legal-readiness.json` → `canales.transaccional`:

```
"estado": "pendiente_de_migracion",
"nota": "… El cambio de la credencial en el servidor, el reinicio y el ENVIO REAL de prueba los
ejecuta el owner (Fase 1 del plan del 9-nov-2026, pendientes P2, P4 y P5). Hasta que ese envio
real exista, el remitente efectivo sigue siendo el anterior: este manifiesto no declara un
envio que no se ha hecho."
```

P2, P4 y P5 están cerrados. El bloque es un **falso negativo** documental: el gate no lo lee
(`readinessLegal.js` solo consulta `canal_confirmado`), así que **no crea un verde falso**, pero
quien lea el expediente —el abogado, la SIC, un auditor— concluirá que el canal sigue en la
cuenta anterior. Contradice `mail_provider.aceptacion.aceptada = true` (10-nov), que sí lo
contradice.

---

## 4. Base normativa

| Norma | Artículos | Qué resuelve |
|---|---|---|
| **Ley 527 de 1999** | 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 28 | Firma electrónica, original e integridad, conservación, formación y validez del contrato por mensaje de datos — [Senado](http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html) |
| **Decreto 1074 de 2015** (compilado del 2364 de 2012) | 2.2.2.47.1 – 2.2.2.47.8 | Acuerdo sobre el mecanismo de firma, confiabilidad y pactada, deberes del firmante, publicación de versión con huella — [MINTIC](https://normograma.mintic.gov.co/mintic/compilacion/////////docs/decreto_2364_2012.htm) |
| **Decreto 1074 de 2015** | 2.2.2.25.1.3 núm. 4 · 2.2.2.25.5.1 núm. 2 · 2.2.2.25.5.2 · 2.2.2.25.6.1 | Contrato de transmisión, subencargados y responsabilidad demostrada — [Cancillería](https://www.cancilleria.gov.co/sites/default/files/Normograma/docs/pdf/decreto_1074_2015_pr026.pdf) |
| **Ley 1581 de 2012** | 3(d)(e) · 4(d)(e)(g)(h) · 12 · 15 y par. 1 · 16 · 17(b)(i) · 18(b)(e)(j)(k) · 26 | Roles; veracidad, transparencia, seguridad y confidencialidad; deber de informar; traslado de reclamos en 2 días hábiles; deber propio del Encargado; transferencia internacional — [Senado](http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html) |
| **Ley 1564 de 2012 (CGP)** | 244, 247 | Presunción de autenticidad y valoración de mensajes de datos — [normograma SENA](https://normograma.sena.edu.co/compilacion/docs/ley_1564_2012_pr008.htm) |
| **Circular Única SIC, Título V** | Cap. Tercero, num. 3.2 (par. 1 y 4) | Estados Unidos como país con nivel adecuado; responsabilidad demostrada — [SIC, actualizado por la Circular 001 del 9-ene-2026](https://sedeelectronica.sic.gov.co/transparencia/normativa/titulo-v-actualizado-el-9-de-enero-de-2026) *(enlace verificado el 11-nov-2026)* |
| **Supersociedades** | Of. 220-068333 del 28-03-2023 | Representación legal indelegable; los poderes especiales no defieren la representación — [PDF](https://www.supersociedades.gov.co/documents/107391/159040/OFICIO-220-068333-28-DE-MARZO-DE-2023.pdf) |
| **Ley 1258 de 2008** | 26 |.persona jurídica y representante legal |
| **Código de Comercio** | 196 | Funciones de la representación legal |

⚠️ **No verificado:** (i) que «subencargado» sea figura reconocida en la norma colombiana (la
Ley 1581 solo define Responsable y Encargado); (ii) el Apéndice 4 de la Circular Única SIC;
(iii) si la cuenta de Workspace ya renovó al Acuerdo vigente y cuál es la *Addendum Effective
Date*; (iv) el texto del CDPA **no está en el repo** (solo su SHA-256
`0e1c7294…fc69b1` y la captura de consola están registrados), de modo que cualquier afirmación
sobre su articulado —incluida la de que su §2 define la fecha de efectividad como la de
aceptación del cliente— queda **sin poder contrastar contra el archivo**.

---

## 5. Riesgos / a confirmar

- **Owner:** la decisión sobre la v1.6 (P1), el orden P3→P8 (P3), la Constancia (P4) y el
  contenido de la **sección E** del checklist, donde **J1–J14 están vacíos** salvo C-1, el P7
  punto 2 y la condición de facultad.
- **Google:** renovación del Acuerdo de la cuenta y aplicabilidad del CDPA; los datos de
  cuenta del administrador y la telemetría quedan fuera de los datos del cliente (Decisión A
  §2.4).
- **Servidor:** las compuertas se midieron en la base local, no en el servidor real. ⚠️ No
  verificado.
- **SIC:** inscripción en el RNBD pendiente de certificado y estados financieros; recognition de
  «subencargado» ⚠️ No verificado.
- **No afirmable todavía:** la fecha de apertura a trabajadores reales; el efecto de una v1.6
  sobre la reaceptación masiva; la validez de un otrosí frente al Titular (conclusión: no lo
  alcanza).

---

## 6. Descargo

Este documento es asesoría jurídica informativa y **no sustituye la decisión del representante
legal de Gesstiar S.A.S.**, que es la autoridad del expediente. Las conclusiones se fundan en
el texto de los instrumentos y en la norma consultada el 11-nov-2026 en fuentes oficiales; las
normas pueden cambiar. **Ninguna recomendación se presume aprobada por el silencio del owner**,
y su registro corresponde a la sección E del checklist definitivo.
