# Revisión de los Términos y Condiciones (Acuerdo de uso) — capítulos II a XII

**Fecha**: 2026-10-20
**Objeto**: el **Acuerdo sobre el uso del mecanismo de firma electrónica** (los "T&C"), versión v1.0
**Texto revisado**: `firma-service/scripts/fixtures/acuerdo-v1.0.txt` (639 líneas, 32.907 caracteres, huella SHA-256 `52a490a4f4ce922109d42fa01ac45632cd62d5242bb82bf6e1967ede55710c04`, **archivado** — ver el plan)
**Alcance**: capítulos II a XII (el capítulo I ya estaba cerrado).

> ⚠️ **Esto no es asesoría jurídica.** Es una revisión de coherencia (texto ↔
> código) y de trazabilidad normativa, hecha para que el abogado tenga la lista
> de lo que hay que decidir. Las redacciones propuestas son sugerencias: las
> escribe y firma el abogado.
>
> ⚠️ **Alcance de la verificación normativa**: los capítulos II, III, IV y VIII
> se verificaron **contra el texto oficial** (compilación jurídica del SENA,
> `normograma.sena.edu.co/compilacion`), artículo por artículo. Los capítulos
> V a XII se revisaron contra el **código** y contra las auditorías previas del
> 2026-10-19; sus citas se marcan **⚠️ No verificado** cuando no se vuelven a
> comprobar aquí.

---

## 0. Cómo se hizo esta revisión

1. Lectura completa del Acuerdo (capítulos I a XII) y mapeo de **cada numeral**
   contra el comportamiento real del servicio (`firma-service/src`,
   `firma-service/web/firma`) y contra la base de datos.
2. **Revisión independiente** de los capítulos II, III, IV y VIII, con cotejo
   literal de las citas contra la compilación oficial (SENA). Es la parte que
   está marcada **[V]** en las tablas.
3. Revisión de los capítulos V, VI, VII, IX, X, XI y XII contra el código y
   contra los documentos ya existentes (`auditoria-capitulo-iv-*`,
   `auditoria-capitulo-v-*`, `plan-cierre-acuerdo-2026-10-19.md`), sin duplicar
   sus hallazgos.
4. Prueba manual I-107 (2026-10-20, local, datos sintéticos) para comprobar en
   la práctica lo que el texto promete: la mini-app muestra el plazo y el canal
   de copia, el bloque de empresa, la constancia con los últimos 4 y el flujo de
   firma completo.

Numeración: **H-TC-01 … H-TC-12** son de la revisión de los capítulos II, III,
IV y VIII; **H-TC-13 … H-TC-19** son de la revisión de los capítulos V a XII.

---

## 1. Tablero: estado por capítulo

| Capítulo | Promesa principal | Código | Texto | Veredicto |
|---|---|---|---|---|
| II. Objeto | Método, base legal, no se toca el documento, sin costo para el Trabajador | 6.1/6.2, 5.4 | 2.1–2.3 | **PARCIAL** — el 2.2(a) promete que nada se elimina por el tiempo y el código sí elimina (H-TC-02) |
| III. Método | OTP + token, flujo (a)–(i) | `publicFlow.js` | 3.1–3.9 | **PARCIAL** — "huella con sal" (H-TC-10), "un solo uso" (H-TC-11), atribución del 3.8 (H-TC-07) |
| IV. Efectos jurídicos | Equivalencia con la firma manuscrita, presunción de autenticidad | — | 4.1–4.5 | **YA CONOCIDO** (4.1 cita un artículo caduco) + **el 4.5 contradice al 8.6** (H-TC-01) |
| V. Deberes del Firmante | 5.1 dice que a), b) y c) son los deberes del 2.2.2.47.6 | — | 5.1–5.5 | **YA CONOCIDO** (el preámbulo no coincide con el artículo) |
| VI. Reglas de uso | Vigencia, costo, exclusividad, garantía del empleador | 6.2 (obligación contractual) | 6.1–6.2 | **PARCIAL** (falta el registro del origen contractual del documento — tarea 10.3) |
| VII. Firma autográfica | Derecho a la firma en papel, no barrera de acceso | — | 7.1–7.3 | **NO CUMPLE** (es la 9A) |
| VIII. Copias y conservación | Medio autorizado, copia permanente, plazo comunicado | 8B (plazo y canal en la mini-app) | 8.1–8.7 | **PARCIAL** (8.2 sin registro de medios; 8.3/8.4/8.5 sin canal; 8.6 con el piso del D-03 ya cerrado) |
| IX. Manifestación y versionamiento | Versión vigente, huella a la vista, versión nueva sin retroactividad | `agreementService`, `app.js` | 9.1–9.6 | **PARCIAL** (9.3 sin hash a la vista = 10.5; 9.5 sin camino positivo = 10.4) |
| X. Datos personales | Qué se trata, para qué, con qué base, conservación, derechos, sensible | 8A.1, 8A.2, 8B, 8C, 8B-C | 10.1–10.9 | **PARCIAL** (10.2 desactualizado: la firma visual; 10.7(b) contradice al 2.2.2.25.4.4) |
| XI. Notificaciones | Avisos por correo, canales de la Empresa | `mailer.js` | 11.1–11.3 | **CUMPLE** |
| XII. Ley aplicable y finales | Normas aplicables, prueba de la aceptación conservada | `supresion.js` deja la aceptación | 12.1–12.7 | **PARCIAL** (12.3 con el nombre oficial de la Res. 0312; 12.7 y la purga) |

---

## 2. La contradicción §4 vs §8 (y las otras dos del mismo eje)

### 2.1 La contradicción principal: **4.5 / 2.2(a) / 2.2(c) vs 8.6**

| # | Numeral | Literal | Promesa |
|---|---|---|---|
| 1 | **4.5** | "La validez, la eficacia y la fuerza probatoria de la firma realizada mediante este mecanismo **no se afectan** por la finalización de la relación laboral" | La firma conserva todo su valor probatorio |
| 2 | **2.2(a)** | "El mecanismo de firma electrónica **no aplica al documento firmado ni a la Constancia de firma electrónica ninguna política de eliminación por el transcurso del tiempo**" | Ni el documento firmado ni la constancia se borran nunca |
| 3 | **2.2(c)** | "sin que el documento firmado por el Trabajador pierda su validez, eficacia ni fuerza probatoria" | Lo mismo que el 4.5, dicho en el capítulo del objeto |
| 4 | **8.6** (última frase) | "Vencido ese plazo y sin que exista un deber legal o contractual de conservación, **el dato se suprime**" | La Empresa puede destruir la **única evidencia** de esa firma |

**En una frase**: el Capítulo IV promete que la firma conserva su validez y su
fuerza probatoria, y el Capítulo VIII —invocando el mismo artículo que obliga a
conservar (2.2.1.1.12)— le da a la Empresa la potestad de destruir la única
evidencia de esa firma cuando se agote su tabla de retención interna.

**Por qué importa, con el código real**:

1. La Empresa declara un plazo y lo comunica (`8.6`): `signRequest.js` congela
   `fecha_conservacion`; el plazo y el canal se muestran en la mini-app
   (verificado en la prueba manual I-107).
2. El trabajador firma. El 4.4 le dice que su documento **se presume
   auténtico** y el 4.5 que **conserva su fuerza probatoria**. No guarda copia.
3. Vencido el plazo, la Empresa abre la ventana de purga y la 5B borra el PDF
   original, el PDF firmado, la constancia, la fila de la firma y el registro de
   auditoría (`services/supresion.js`).
4. El enlace público responde 410; la verificación ya no dice "firma válida"
   (correcto), pero la **presunción del 4.4 no tiene documento sobre el cual
   operar** y la **fuerza probatoria del 4.5 se queda sin objeto**. El 8.5
   ("copia en cualquier momento y sin costo") responde lo mismo.

**El agravante normativo**: el 8.6 dice "Este Acuerdo no fija un plazo propio
porque la ley no lo fija", pero la ley que el 8.1 cita (2.2.1.1.12) no fija
plazo porque **impone un deber de conservación sin término** ("Los empleadores
deberán conservar los contratos de trabajo firmados electrónicamente"), no
porque no diga nada. Para el contrato individual de trabajo, la Empresa no
puede tratar su tabla interna de retención como si extingriera el deber legal.
En el código ese deber solo existe como un `hold_legal` manual que alguien
tiene que declarar.

**Corrección mínima propuesta (para el abogado) — Variante A, recomendada**:

- En el **8.6**, al final: *"La supresión del dato afecta a la evidencia
  material de la firma —el documento firmado, la Constancia de firma electrónica
  y el registro de auditoría—, conforme al numeral 3.6, y no a la validez, la
  eficacia ni la fuerza probatoria de la firma, conforme al numeral 4.5. La
  Empresa comunicará al Trabajador, con la anticipación del numeral 8.6, el
  momento en que expire el plazo, para que pueda obtener la copia y la
  constancia antes de la supresión."*
- En el **4.5**, al final: *"La conservación de la evidencia que respalda la
  firma se rige por el numeral 8.6."*
- En el **2.2(a)**, sustituir la segunda oración por: *"El mecanismo de firma
  electrónica no aplica al documento firmado ni a la Constancia de firma
  electrónica ninguna política de eliminación por el fruto de la finalización de
  la relación laboral; la conservación por plazo y la supresión posterior se
  rigen por el numeral 8.6."*

**Variante B (más tutela para el Trabajador)**: el 2.2(a) dice "…ninguna
política de eliminación **mientras subsista el deber legal o contractual de
conservación**". Exige una tarea de código nueva (un piso legal en la 5B; hoy
solo existe el `hold_legal` manual).

**Variante C (mínima)**: borrar el 2.2(a) y el 2.2(c) y dejar el 4.5 como único
lugar. No se recomienda: el 2.2 fija el alcance del documento para el
contrato de trabajo.

> **La v1.1 tiene que tocar los tres numerales o ninguno**: arreglar solo el 8.6
> deja vivas dos contradicciones; arreglar solo el 4.5 deja viva la del 8.5/8.6.

### 2.2 La segunda contradicción §4/§8: **5.4 vs 8.2 / 8.3 / 8.5**

- **5.4**: el Trabajador "puede imprimir o descargar copia de este Acuerdo y
  del documento firmado **desde el propio enlace de firma**".
- **8.2/8.3/8.5**: el documento firmado se suministra "siempre", se mantiene
  "disponible para posterior consulta" y el Trabajador puede obtener copia
  "**en cualquier momento y sin costo**".

**El problema**: el enlace **caduca** (72 h remota, 24 h presencial). Quien
firme y no descargue dentro de ese plazo se queda sin copia, aunque el
Acuerdo le promete que puede pedírsela a la Empresa "en cualquier momento".

**Opciones**: (A) que el 8.5 diga que la copia permanente la entrega la Empresa
por el canal de su política, y el 5.4 que el enlace es copia **de cortesía
durante la vigencia del enlace**; o (B) implementar la copia permanente (9A).

### 2.3 Contradicción ENTRE el marco legal interno y el Acuerdo: `LEGAL.md` §4 vs §8

`LEGAL.md` es el documento de análisis interno. Su §4 resume el Acuerdo y su
§8 trata la protección de datos. **Los dos contradicen al Acuerdo vigente** en
cuatro puntos:

| Punto | `LEGAL.md` §8 | El Acuerdo v1.0 | Consecuencia |
|---|---|---|---|
| Datos tratados | §8.1 lista "Firma visual (PNG, opcional) — Dato biométrico (categoría especial)" | El **10.2** cierra con "Este numeral no autoriza a la Empresa a enviar al servicio datos distintos de los aquí relacionados. Cualquier dato adicional sobre el Titular requiere una actualización previa de este Acuerdo" | El API **sí acepta** `firma_visual_png` (`src/routes/public.js`) y la guarda. Hay un dato que se trata y que el Acuerdo no autoriza → **H-TC-13** |
| Finalidades | §8.2: "únicamente" generar evidencia, auditar, cumplir obligaciones legales | El **10.3** lista **ocho** finalidades (a)–(h), que incluyen enviar el OTP, verificar la identidad y atender PQRS | El marco interno describe un tratamiento más estrecho que el que el firmante aceptó. El que obliga es el Acuerdo → **H-TC-14** |
| Base legal | §8.3: "**Ejecución de la relación laboral** (Art. 6 Ley 1581)" | El **10.4(b)**: "Las demás finalidades se sustentan en la **autorización expresa, informada y separable** otorgada por el Titular" | No se sabe cuál es el fundamento real → **H-TC-14** |
| Derechos del titular | §8.4: "K+AIR **debe permitir** el ejercicio de estos derechos" | El **10.7(b)**: "K+AIR… **no recibe ni resuelve** por su propia cuenta las solicitudes de los Titulares" | El 2.2.2.25.4.4 y el 2.2.2.25.4.2 obligan también al **Encargado** → **H-TC-16** |

**Cómo se resuelve**: el documento que obliga es el **Acuerdo** (es el que el
Trabajador acepta y cuya huella se archivó). Por tanto, `LEGAL.md` §8 se
actualiza para que describa lo que el Acuerdo dice. La **única excepción** es
el 10.7(b): ahí el problema está en el Acuerdo.

---

## 3. Trazabilidad: capítulos II, III, IV y VIII **[V]**

Leyenda: ✅ CUMPLE · 🟡 PARCIAL · ❌ NO CUMPLE.

### 3.1 Capítulo II

| Numeral | Veredicto | Evidencia |
|---|---|---|
| 2.1 | ✅ | La versión viva se publica y se muestra antes de firmar. La cita del 2.2.2.47.1 num. 1 es **fiel** [V] |
| 2.2 preámbulo | 🟡 | La cita del **parágrafo** del 2.2.1.1.9 es **fiel** [V], pero la frase siguiente ("Para el caso previsto en el parágrafo del 2.2.1.1.13") apunta al parágrafo equivocado → **H-TC-08** |
| 2.2(a) | ❌ | La supresión **sí** elimina documento firmado, constancia, fila y eventos → **H-TC-02** |
| 2.2(b) | ✅ | No hay cobro; la descarga es un GET público |
| 2.2(c) | 🟡 | La "exclusividad" es del contrato individual de trabajo (6.2), no del mecanismo; la segunda mitad choca con el 8.6 → **H-TC-01** |
| 2.3 | 🟡 | La copia firmada conserva el original + una página de sello ✅, pero las huellas que se imprimen están **truncadas** (tarea 10.7) |

### 3.2 Capítulo III

| Numeral | Veredicto | Evidencia |
|---|---|---|
| 3.1 | 🟡 | El correo es el que **registra la Empresa**, no el Trabajador; sin validación de dominio (D2) → **H-TC-05** |
| 3.2 | ✅ | El PDF firmado no lleva firma criptográfica; la cita del 47.1 nums. 2, 3 y 4 es **fiel** [V] |
| 3.3 | 🟡 | OTP y token se guardan solo como HMAC ✅; pero la Empresa puede redirigir la invitación a cualquier correo → **H-TC-05** |
| 3.4(a)–(b) | ✅ | — |
| 3.4(c) | ✅ | "de un solo uso" es exacto: desde el 23-oct-2026 (📦933) la reemisión invalida siempre el token anterior y no hay más de un token vigente por solicitud → la parte del 3.4(c) de **H-TC-11** quedó **cerrada** |
| 3.4(d) | ✅ | La comparación por huella es real (`identificacion.verificar`, `identificacion_coincidio`, evento). La palabra "con sal" está desactualizada → **H-TC-10** |
| 3.4(e)–(f) | ✅ | OTP de un solo uso, 600 s, 5 intentos, nunca en texto claro (HMAC) |
| 3.4(g) | 🟡 | El gate es real (no se avanza sin aceptar), pero se muestra la versión **ligada a la solicitud**, no la vigente; si ya no es la activa, el trabajador recibe un 409 sin salida → depende de la **10.4** |
| 3.4(h)–(i) | ✅ | Verificado en la prueba manual I-107 (2026-10-20) |
| 3.5 | ✅ | La firma de la Empresa tiene su propio enlace, OTP y consentimiento (rol `EMPRESA` filtrado) |
| 3.6(a)–(f) | ✅ | Huellas, versión del Acuerdo, seis fechas, resultado de la identificación, HMAC del OTP y del token, IP y agente de usuario |
| 3.6(g) | 🟡 | Los triggers append-only existen, pero la 5B borra los eventos dentro de la ventana: **falta la excepción en el texto** → **H-TC-09** |
| 3.6(h) | 🟡 | Se conservan hasta la supresión → mismo problema que 2.2(a) y 4.5 → **H-TC-01** |
| 3.7(a)–(b) | ✅ / 🟡 | El código cumple; el contexto no, por el buzón de la Empresa → **H-TC-05** |
| 3.8 | 🟡 | 1ª frase fiel; 2ª **mala atribución**: el parágrafo del 47.7 carga a "la parte que **provee los métodos**" = K+AIR, no a la Empresa → **H-TC-07** |
| 3.9 | ❔ | Declaración sin contenido operativo propio; depende del Anexo de Encargo (T1) |

### 3.3 Capítulo IV

| Numeral | Veredicto | Evidencia |
|---|---|---|
| 4.1 | 🟡 | El 47.5 remite a un artículo **caduco** (2.2.2.43.3): YA CONOCIDO (auditoría del 2026-10-19) |
| 4.2 | 🟡 | Sustancia correcta; el oficial dice "incluido cualquier acuerdo aplicable" |
| 4.3 | 🟡 | Transcripción **fiel** del parágrafo 2 del 2.2.1.1.10 [V]. Salvedad: es para el contrato individual de trabajo |
| 4.4 | 🟡 | **La cita es fiel** [V] (ver H-TC-06). Lo que no se cumple es lo operativo: las huellas de la constancia van truncadas |
| 4.5 | ❌ | Contradicho por el 8.6 y por el código → **H-TC-01** |

### 3.4 Capítulo VIII

| Numeral | Veredicto | Evidencia |
|---|---|---|
| 8.1 | 🟡 | Se conserva y se verifica la integridad, pero el artículo citado no tiene término y el 8.6 lo termina por tabla interna; además el capítulo **transpone** los cuatro párrafos del 2.2.1.1.12 cambiando "los contratos de trabajo" por "los documentos" sin marcar la ampliación (6.2) |
| 8.2 | ❌ | No existe el registro de medios autorizados ni ninguna vía para modificarlos, aunque el texto promete que el Trabajador puede hacerlo "en cualquier momento y sin costo" → **H-TC-04** |
| 8.3 | 🟡 | El formato se conserva y la verificación pública funciona indefinidamente, pero el **PDF no se puede descargar** sin el token, que caduca |
| 8.4 | 🟡 | No hay canal de suministro a autoridades; el endpoint interno sirve el original en `DUAL_FIRMADO` |
| 8.5 | 🟡 | La copia existe (correo + descarga), pero "en cualquier momento" es falso → **H-TC-15** |
| 8.6 | 🟡 | La supresión existe y es real; la comunicación del plazo existe en la mini-app ✅; pero el plazo y el canal eran "deseables" (opcionales) → **cerrado en código por el D-03 de hoy**; el texto sigue sin el piso del contrato de trabajo → **H-TC-03** |
| 8.7 | ❌ | El Anexo de Encargo describe un producto local ("copias de trabajo"), no la nube: es la T1 |

---

## 4. Trazabilidad: capítulos V a XII

| Numeral | Qué promete | Veredicto | Evidencia |
|---|---|---|---|
| 5.1(a) | El Firmante cumple "las políticas de seguridad de la Empresa y de K+AIR" | **YA CONOCIDO** (nunca ve esas políticas) | auditoría del cap. V |
| 5.4 | Copia desde el enlace | 🟡 (el enlace caduca) | `app.js` (`wireSignedDownloads`), TTL en `signRequest.js` |
| 6.1(d) | El empleador garantiza el 2.2.2.47.4 | ✅ | — |
| 6.2 | Las reglas de VI son obligatorias para el resto de documentos por obligación contractual | 🟡 | No hay forma de registrar el **origen contractual** del documento (tarea 10.3) |
| 7.1–7.3 | Firma autográfica, no barrera | ❌ | Es la 9A |
| 8.2/8.3/8.5 | Medio autorizado, consulta posterior, copia en cualquier momento | ❌/🟡 | Es la 9A |
| 8.6 | Plazo comunicado antes de la firma | ✅ | La mini-app muestra el plazo y el canal (prueba manual I-107) |
| 9.1 | La aceptación del Acuerdo es independiente de la del documento | ✅ | `consentAccept` y `commit` son pasos separados |
| 9.2 | La casilla se habilita solo cuando el texto se ha leído | 🟡 | Se habilita al pintar el texto, sin medir la lectura → **H-TC-17** |
| 9.3 | Versión con huella SHA-256 **que el sistema muestra junto al texto** | 🟡 | La versión se muestra; la huella no (tarea 10.5) |
| 9.5 | Sin efectos retroactivos; la versión nueva se acepta en el momento de la firma | 🟡 | El camino positivo no existe (tarea 10.4) |
| 9.6 | La constancia identifica la versión y la huella del texto | ✅ | `pdfGen.js` |
| 10.1 | K+AIR es Encargado, por cuenta de la Empresa | ✅ | `gh_firma_empresas` + Anexo de Encargo (art. 25 / 2.2.2.25.5.2) |
| 10.2 | Lista cerrada de datos | 🟡 | La **firma visual** no está en la lista → **H-TC-13** |
| 10.3 | Ocho finalidades | ✅ | (g) PQRS: la mini-app muestra el canal de la Empresa |
| 10.4(a) | Base legal de la conservación de evidencia | **YA CONOCIDO** (H27) | plan de cierre |
| 10.4(b) | Las demás finalidades: autorización expresa y separable | ✅ | `manifestacion_aceptada` + casilla separada del 10.8 |
| 10.5(a) | La identidad del Trabajador: huella con sal, no en claro | ✅ | HMAC por HKDF con ámbito de empresa |
| 10.5(b) | OTP y token solo como huella | ✅ (desde 8C) | Se eliminó `token_encrypted` |
| 10.5(c) | El documento se identifica por SHA-256 | ✅ | `pdfValidation()` |
| 10.5(d) | Los registros de auditoría no se alteran ni se eliminan | 🟡 | La 5B borra `gh_firma_eventos`; falta el puente en el texto → **H-TC-18** |
| 10.5(e) | Acceso restringido | ✅ | Llave admin + llaves per-empresa |
| 10.5(f) | Los operadores de infraestructura y correo actúan como Encargados | ❌ (T1) | El Anexo de Encargo de la nube no está escrito |
| 10.6 | Plazo por la tabla de la Empresa; vencida, se suprime | ✅ (8A.2) | No cubre **backups**: lo dice el Anexo, no el Acuerdo |
| 10.7(a) | Derechos del titular | ✅ | — |
| 10.7(b) | Los derechos se ejercen ante la Empresa | 🟡 | Contradice al 2.2.2.25.4.4/25.4.2 → **H-TC-16** |
| 10.7(c) | Derechos gratuitos "al menos una vez al mes calendario" | **YA CONOCIDO** (atribución incorrecta) | plan de cierre |
| 10.7(e) | "Sólo procede acudir a la SIC una vez agotado el reclamo interno" | **YA CONOCIDO** (H28) | plan de cierre |
| 10.7(f) | La solicitud de copia es derecho de acceso | **YA CONOCIDO** (H26) | plan de cierre |
| 10.8 | Datos de salud: aviso previo, categorías, consentimiento expreso | ✅ (8B) | `sensibles.js` + casilla `consentimiento_sensible` + inferencia por tipo de documento + 409 |
| 10.9 | Responsabilidad | ✅ | — |
| 11.1–11.3 | Notificaciones | ✅ | `mailer.js` |
| 12.1 | Normas aplicables | 🟡 | Faltan el Decreto 2364 y el Decreto 526 (YA CONOCIDO) |
| 12.3 | Nombre oficial de la Res. 0312 | **YA CONOCIDO** | — |
| 12.7 | La Empresa conserva la prueba de la aceptación | ✅ con salvedad | La fila de consentimiento sobrevive a la purga, pero los eventos no → **H-TC-18** |

---

## 5. Hallazgos

### 5.1 De la revisión de los capítulos II, III, IV y VIII **[V]**

| # | Sev. | Hallazgo | Evidencia |
|---|---|---|---|
| **H-TC-01** | 🔴 Alta | **La contradicción §4 vs §8**: el 4.5 (validez, eficacia y fuerza probatoria intactas) y el 2.2(a)/(c) son incompatibles con el 8.6 ("vencido el plazo, el dato se suprime"), que termina un deber legal (2.2.1.1.12) **sin término** | `acuerdo-v1.0.txt:71-76, 82-84, 234-236, 352-359`; `services/supresion.js` |
| **H-TC-02** | 🔴 Alta | El **2.2(a)** afirma que el documento firmado y la Constancia no tienen política de eliminación por el tiempo: es **falso frente al código** (la 5B borra los tres archivos, la fila y los eventos). Se añadió sin implementar el efecto | `acuerdo-v1.0.txt:72-74`; `supresion.js` |
| **H-TC-03** | 🔴 Alta | El **8.6** era incumplible: el plazo y el canal eran opcionales (retención indefinida de datos personales). **Cerrado en código por el D-03 de hoy**; en el texto falta el piso del contrato de trabajo | `empresa.js` (deseables); `conservacion.js` |
| **H-TC-04** | 🔴 Alta | El **8.2** no se registra la autorización de medios ni hay vía para modificarla, aunque el texto promete que el Trabajador puede hacerlo "en cualquier momento y sin costo" | `001_initial.sql`; `routes/consent.js` |
| **H-TC-05** | 🔴 Alta | El **3.7(a)**: el OTP va al correo que registra la Empresa y la Empresa puede **redirigir la invitación a cualquier dirección**; la decisión D2 (rechazo de dominio) no está implementada | `routes/signRequest.js` (`notify-remote`) |
| **H-TC-06** | 🔴 Alta | **La auditoría del Capítulo IV del 2026-10-19 se equivocó en el 4.4**: el art. 244 de la Ley 1564/2012 **sí** dice "Los documentos en forma de mensaje de datos se presumen auténticos". Su propuesta (citar el 243 y añadir "mientras no hayan sido tachados de falso o desconocidos") **introduciría un error nuevo**: esa condición no aplica a los mensajes de datos | verificado contra la compilación del SENA |
| **H-TC-07** | 🟠 Media | El **3.8** atribuye a la Empresa la carga de la prueba que el parágrafo del 47.7 carga a "la parte que **provee los métodos**" = K+AIR (el 1.4 lo dice) | `acuerdo-v1.0.txt:36-37, 197-205` |
| **H-TC-08** | 🟠 Media | El **2.2** presenta a), b) y c) como "el caso previsto en el **parágrafo**" del 2.2.1.1.13, pero ese parágrafo regula otro deber: a), b) y c) son los tres **numerales** | `acuerdo-v1.0.txt:64-84` |
| **H-TC-09** | 🟠 Media | El **3.6(g)** ("no puede ser alterado ni eliminado") no tiene la excepción de la ventana de purga gobernada que el código sí respeta | `020_eventos_append_only.sql`; `supresion.js` |
| **H-TC-10** | 🟠 Media | "Huella digital **con sal**" (3.4(d), 3.4(e), 3.6(e)) describe una garantía **más débil y falsa**: el código usa HMAC-SHA-256 con clave fuera de la base | `crypto/otp.js`; `crypto/token.js` |
| **H-TC-11** | 🟠 Media | La parte del **3.4(c)** quedó **resuelta el 23-oct-2026 (📦933)**: "token de **un solo uso**" (3.1, 3.3, 3.4(c)) vuelve a ser exacto, porque la reemisión invalida siempre el token anterior y no hay más de un token vigente por solicitud. **Sigue en pie la parte del 3.4(g)**: el texto promete la "versión **vigente**" cuando el sistema muestra la versión **ligada a la solicitud** | `026_tokens_rotacion.sql`; `publicFlow.js` |
| **H-TC-12** | 🟠 Media | El **8.3/8.4/8.5** no tienen canal real: el PDF firmado solo baja por el token (que caduca) y no hay consulta pública que sirva el PDF a una autoridad | `publicFlow.js`; `routes/signRequest.js` |

### 5.2 De la revisión de los capítulos V a XII

| # | Sev. | Hallazgo | Dónde | Qué propone |
|---|---|---|---|---|
| **H-TC-13** | 🔴 Alta | La **firma visual** (PNG) se acepta, se guarda y es dato de categoría especial, pero **no está en el 10.2**, que es una lista cerrada | `src/routes/public.js` (`commitBody.firma_visual_png`), `src/services/supresion.js` | (a) Meterla en el 10.2 con su base legal y su aviso, o (b) **dejar de aceptarla**. Hoy el sistema hace lo que el texto no autoriza. |
| **H-TC-14** | 🟠 Media | `LEGAL.md` §8 describe un tratamiento **más estrecho** que el que el firmante aceptó (finalidades y base legal) | `LEGAL.md` §8.2/§8.3 vs Acuerdo 10.3/10.4 | Actualizar `LEGAL.md` §8 para que refleje el Acuerdo. El Acuerdo manda. |
| **H-TC-15** | 🟠 Media | El **5.4** (copia desde el enlace) contradice al **8.2/8.3/8.5** (copia permanente y en cualquier momento) porque el enlace caduca | Acuerdo 5.4 vs 8.2/8.3/8.5 | Ver §2.2. Opción A: el enlace es cortesía, la entrega permanente es de la Empresa. |
| **H-TC-16** | 🟠 Media | El **10.7(b)** deja al Encargado sin mecanismo propio, pero el 2.2.2.25.4.4 y el 2.2.2.25.4.2 lo obligan a tenerlo | Acuerdo 10.7(b) | Agregar: "K+AIR atiende también las solicitudes que le lleguen directamente, y las trasmite a la Empresa". |
| **H-TC-17** | 🟢 Baja | El **9.2** dice que la casilla se habilita "sólo cuando el texto ha sido leído en su totalidad"; el sistema la habilita al pintar el texto, sin medir la lectura | `web/firma/app.js` (`renderAcuerdo`) | (a) Medir la lectura (scroll al final) y recién ahí habilitar, o (b) suavizar el 9.2. |
| **H-TC-18** | 🟠 Media | El **10.5(d)** ("los registros de auditoría no pueden alterarse ni eliminarse") y la **purga** (que borra `gh_firma_eventos`) se contradicen; no hay puente en el texto | Acuerdo 10.5(d)/10.6 vs `services/supresion.js` | Agregar al 10.5(d) el puente: "salvo la supresión autorizada… queda la lápida y el recibo". |
| **H-TC-19** | 🟠 Media | El **Acuerdo DEV** usa el número de versión **v1.0**, el mismo que el legal: en una base donde se sembró el DEV, **el legal v1.0 no se puede publicar** (409 `ACUERDO_VERSION_EXISTS`) | `scripts/seed-dev-acuerdo.js` | Sembrar el DEV con un número que no choque o no sembrarlo en staging. **Verificado en vivo** el 2026-10-20. |

---

## 6. Lo que ya está resuelto por el código (y por tanto no hay que pedir en el texto)

| Fase | Qué cambió | Numeral del Acuerdo que lo respalda |
|---|---|---|
| 8A.1 | Vencimiento y verificación de la conservación | 10.6 |
| 8A.2 | Supresión del dato con lápida y recibo | 10.6, 12.7 |
| 8B | Lista blanca de metadata + dato sensible con casilla separada | 10.2, 10.8 |
| 8C | El token solo existe como huella; rotación (un token vigente: la reemisión invalida el anterior) | 10.5(b) — con el ajuste de texto de H-TC-11 |
| 8B-C | La copia de empresa del consentimiento va cifrada y la huella se verifica al presentar | 1.2, 10.5 |
| **D-03 (hoy)** | La creación de la firma se bloquea con 409 si la Empresa no tiene Anexo firmado o plazo declarado | 1.4, 8.6 |

---

## 7. Qué falta para poder publicar una v1.1

| Orden | Qué | Depende de |
|---|---|---|
| 1 | **10.4** (camino positivo del 9.5) | Sin esto, publicar la v1.1 deja al trabajador que llegue tarde con un 409 sin salida |
| 2 | **11A** (correctivo mínimo del texto, con el abogado): T1, 10.6, token, 10.8, 10.7(c), 6.1(d)/6.2, 10.7(f)/10.4(a)/10.7(e), Decreto 526, nombre de la Res. 0312, **H-TC-01, 02, 04, 05, 07, 08, 09, 10, 11, 13, 15, 16, 18** | De 10.4 y de la revisión del abogado |
| 3 | **9A** (papel, medios autorizados, copia permanente, 8.4/8.5) | Sin ella, el 7.1–7.3 y el 8.2/8.3/8.5 quedan prometiendo lo que no existe |
| 4 | **11B** (el resto, v1.2) | De 9A |
| 5 | **Publicación** | De todo lo anterior + el abogado |

### Correcciones de la auditoría previa que hay que hacer ANTES de la 11A

1. **H-TC-06**: la auditoría del Capítulo IV del 2026-10-19 propone una
   redacción del **4.4** que es incorrecta. Si la 11A la aplica tal cual,
   mete un error nuevo en el texto legal. Corregir ese documento primero.
2. **El T5 del plan está desactualizado**: dice que "el Acuerdo no cita el
   2.2.1.1.9". **Sí lo cita**, en el 2.2, y la cita es fiel. Lo que sí falla es
   el parágrafo vs los numerales (H-TC-08).
3. **H-TC-19**: el Acuerdo DEV y el legal no pueden compartir el número de
   versión.

### Lo que **no** se puede hacer todavía

- Publicar la v1.1: cambia el hash y las firmas nuevas quedan bajo el texto
  nuevo.
- Cambiar el archivo `acuerdo-v1.0.txt`: está **archivado**.
- Sembrar el Acuerdo DEV en una base donde se publicará el legal.

---

## 8. Citas normativas

### 8.1 Verificadas en esta revisión (compilación del SENA) **[V]**

| Cita | Numeral | Estado |
|---|---|---|
| 2.2.2.47.1 num. 1 | 2.1 | ✅ fiel |
| 2.2.2.47.1 nums. 2, 3 y 4 | 3.2 (y 3.1, 3.3, 3.5) | ✅ fiel |
| 2.2.2.47.4 (ambos numerales) | 3.7 | ✅ **verbatim** |
| 2.2.2.47.5 | 4.1 | ⚠️ el oficial remite al 2.2.2.43.3 (caduco) — YA CONOCIDO |
| 2.2.2.47.3 | 4.1, 4.2 | ✅ fiel |
| 2.2.2.47.7 (y su parágrafo) | 2.2, 3.8 | ✅ 1ª frase fiel; 2ª **mala atribución** (H-TC-07) |
| 2.2.1.1.9 (parágrafo) | 2.2 | ✅ fiel |
| 2.2.1.1.10 (parágrafo 2) | 4.3 | ✅ fiel, palabra por palabra |
| 2.2.1.1.12 (4 párrafos) | 8.1–8.4 | 🟡 el capítulo transpone los cuatro párrafos cambiando "los contratos de trabajo" por "los documentos" |
| 2.2.1.1.13 (3 numerales + 1 parágrafo) | 2.2, 4.5 | 🟡 el 2.2 confunde parágrafo con numerales (H-TC-08) |
| Art. 244 Ley 1564/2012 | 4.4 | ✅ **la cita es fiel** (párr. 5) — corrige a la auditoría previa (H-TC-06) |
| Ley 1581/2012, Decreto 1377/2013, Ley 527/1999, Res. 0312/2019, Decreto 2364/2012, Decreto 526/2021 | cap. X, XII y anexos | ⚠️ **No verificado en esta revisión** (fuera de los capítulos revisados contra fuente oficial) |

### 8.2 Nota sobre el Decreto 526

Verificado que los artículos 2.2.1.1.8 a 2.2.1.1.15 del Decreto 1072 llevan la
nota "<Artículo adicionado por el artículo 1 del Decreto 526 de 2021>". El
Acuerdo invoca el 2.2.1.1.9, .10, .12 y .13 **sin nombrar la norma que los
añadió** (ya marcado en el plan de cierre).

---

## 9. Qué NO hace esta revisión

- No firma conceptos, no representa ante la SIC ni ante ninguna autoridad.
- No redacta el texto definitivo de ningún numeral: solo señala qué está mal y
  qué depende de qué.
- No ejecuta ni autoriza migraciones, purgas ni publicaciones.
- No cierra la **T1** (documentos publicados que dicen "software local" frente
  a un servicio en la nube): es decisión del owner y, si el servicio ya opera,
  es *stop-the-line*.
