# Dictamen legal sobre los textos que se van a firmar en P8

> **Estado al cierre del 11-nov-2026 (después de este dictamen).** El dictamen no se reescribe: es
> la asesoría del día. Lo que cambió después: (1) los tres instrumentos se emitieron con versión
> nueva —Acuerdo **v1.6** (`08e1eb8b…52f13e`, 75 961 B), Anexo de Nube **v1.3** (`fdd10551…2b585d`,
> 85 143 B) y Anexo de Encargo **2026-11-11** (`6308b1f7…75b8948`, 94 923 B)—; (2) la **Constancia se
> reemitió contra la v1.6** y el 11-nov-2026 se **completó** con los datos del registro del owner
> (huella `aaf68b4e…d0b413`, 9 794 B); sus secciones 5 y 6 siguen vacías porque la autorización
> vive en el registro de aprobaciones del servicio, no en el documento; (3) la **v1.6 quedó publicada**
> el 11-nov-2026 (`publicado: true` en el manifiesto), con su autorización operativa registrada
> (id 4) y es la versión activa en la base de producción. La decisión **D7** sigue vigente en lo que
> ordena: `FIRMA_EXIGIR_ANEXO_NUBE` no se enciende y no se abre a trabajadores reales hasta que los
> actos que faltan de P8 (suscribir la v1.3 del Nube y el Encargo 2026-11-11 por ASEPLUS, y
> contrafirmar) se ejecuten y las compuertas se midan.
>
> **(4) ERRATA DEL 11-nov-2026, antes de la firma.** Después de este dictamen aparecieron dos
> defectos de cita en los dos textos que P8 iba a firmar: el §12 del Anexo de Nube v1.3 decía «Esta
> versión **1.2** remite» al Anexo de Encargo (dentro de un texto que es la v1.3, y contradiciendo
> la frase siguiente del mismo párrafo), y el Anexo de Encargo 2026-11-11 remitía en cuatro puntos
> (menú, §1, §5 y §9) al Anexo de Nube **v1.2**, un texto superado que su propia §5 incorpora por
> remisión (art. 44 de la Ley 527 de 1999). Se corrigieron **antes de la suscripción y antes de
> publicarse**, conservando las etiquetas de versión (v1.3 y 2026-11-11) por decisión del owner
> (D9 del dictamen de la errata); lo que cambia son las huellas, y la anterior de cada texto queda
> declarada en la nota del manifiesto y en el Historial. Las versiones ya suscritas (Nube v1.1 y
> Encargo 2026-11-06) no se tocaron. Dictamen de la errata:
> `sgsst-electron-app/docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md`.

> **Asesor:** skill `asesoria-legal-sg-sst` del repo (`.opencode/skills/asesoria-legal-sg-sst/SKILL.md`).
> **Fecha:** 11 de noviembre de 2026. **Base verificada ese día contra fuente oficial.**
> **Naturaleza:** asesoría jurídica informativa. No sustituye la decisión del representante legal de
> Gesstiar S.A.S., que es la autoridad del expediente. Ninguna recomendación se presume aprobada
> por el silencio: su registro corresponde a la **sección E** del checklist definitivo (`J1`–`J14`).
>
> **Objeto:** resolver las tres preguntas que el owner remitió al abogado y decidir, con fundamento
> legal, si los tres instrumentos que K+AIR va a contrafirmar en P8 se firman en su redacción
> vigente o en una redacción corregida.

---

## 1. Respuesta corta

**Los tres instrumentos se corrigen ANTES de firmar, y cada corrección se hace por versión nueva
con su propia huella: Acuerdo v1.6, Anexo de Nube v1.3 y Anexo de Encargo en versión por fecha
nueva.** No hay atajo: el Acuerdo vigente (v1.5) afirma hechos que dejaron de ser ciertos el
10-nov, y corregir los anexos sin corregir el Acuerdo dejaría dos verdades incompatibles sobre el
mismo canal de correo.

---

## 2. Las tres preguntas remitidas al abogado

### 2.1 ¿Versión nueva u otrosí?

**Versión nueva, en los tres casos. El otrosí está descartado por el propio Acuerdo.**

- La obligación de versionar **no viene de la ley**: la verificación en fuente oficial no encontró
  en el Decreto 1074 de 2015 ninguna regla de «publicar una versión nueva con su propia huella
  digital» al modificar el contenido de un acuerdo o contrato electrónico (0 coincidencias de
  «huella», «nueva versión», «publicar una versión» y «modificar el contenido» en el texto
  compilado). **Viene del §9.4 del Acuerdo vigente**, que es una obligación contractual que
  K+AIR se impone a sí mismo y que vincula a la Empresa y al Titular que lo aceptan. Es más
  estricta que la ley, y por eso no se puede ofrecer a la contraparte una vía menos exigente.
- El §9.4 solo admite dos cosas: (i) corregir una copia ya publicada **que no altera el texto
  aceptado**, o (ii) **publicar una versión nueva con su propia huella**. El §10.1 y el §10.5(f)
  del Acuerdo v1.5 **alteran el sentido** de una disposición (dicen que no hay contrato con
  Google y que Google es Responsable de los datos del cliente): no son del caso (i).
- El otrosí, además, no llega al Titular, no tiene versión ni huella, y la Constancia no lo
  identifica (§9.6). El Titular que aceptó el Acuerdo v1.5 leyó un texto; un documento interno
  que lo corrige no le llega.
- **Lo que sí exige la norma** (y esto es lo que una versión nueva satisface): que se detecte
  cualquier alteración no autorizada del mensaje de datos hecha después de la firma
  (D. 1074/2015, art. 2.2.2.47.4, num. 2), y que el mensaje de datos se considere íntegro solo
  si permanece completo e inalterado (Ley 527/1999, art. 9). Un texto corregido sin versión ni
  huella rompe la trazabilidad que la Constancia y el registro de aceptación deben poder
  reconstruir.

**Aplicado a los tres instrumentos:**

| Instrumento | Estado real | Decisión |
|---|---|---|
| **Acuerdo v1.5** | Vigente (`activa = 1` en la base, hash `952592f0…825be28`), con **una** aceptación real de un Trabajador (6-nov-2026, `SIGN-2026-738564`). Declara «cuenta gratuita de Gmail para consumidores» y «No existe DPA empresarial ni contrato de transmisión con Google», dos veces cada uno (§8.7, §10.1 y §10.5(f)). | **v1.6.** Cambio acotado a §8.7, §10.1 y §10.5(f) + fecha de vigencia. La firma del 6-nov se rige por la v1.5 (§9.5, sin efectos retroactivos); las firmas siguientes requerirán leer y aceptar la v1.6. |
| **Anexo de Nube v1.2** | **Modelo no suscrito.** En la base, la suscripción de ASEPLUS es la **v1.1** (`FIRMADA`, 5-nov-2026). Nadie ha aceptado la v1.2. | **v1.3.** No invalida ninguna firma y no obliga a re-suscripción: P8 la suspende como primer acto. Editar los bytes de la «v1.2» conservando su número de versión y su fecha (9-nov-2026) haría que **dos documentos distintos se presentaran como la misma versión**, con la huella ya registrada en el manifiesto y citada en el expediente. |
| **Anexo de Encargo 2026-11-09** | **No suscrito.** El suscrito es el **2026-11-06** (hash `5cc7a346…0aa72`, 7-nov-2026), que queda archivado y no se edita jamás. | **Versión por fecha nueva.** El §7 ya trae la cláusula de sustitución; lo que corresponde es la suscripción del texto nuevo, no un quinto instrumento. El 2026-11-06 no se reescribe. |

### 2.2 ¿Qué canales se publican en el cierre?

**El canal que exista y esté verificado en el momento de la firma, y nada más.** Hoy son
`privacidad.kair@gmail.com` (datos y ARCO), `adminkair@gmail.com` (PQRS) y el mismo
`privacidad.kair@gmail.com` (incidentes).

- La ley **no** exige que el canal esté en el dominio propio de la Empresa: exige que exista
  canal publicado, gratuito y permanente, con radicado y traslado al Responsable en dos días
  hábiles, y sin restringir el acceso (Ley 1581/2012, arts. 15 y 18). La casilla de consumo
  cumple ese estándar.
- Lo que **no** puede seguir es la contradicción del expediente: el manifiesto declara
  `canal_confirmado: true` (lo que enciende la compuerta `canal_datos` con el detalle «Canal
  válido, documentado y confirmado») mientras el bloque `canales` dice que los alias de Workspace
  **no están verificados**. Un texto que publica un canal que nadie ha verificado, con una
  compuerta que lo da por confirmado, es un verde falso documental.
- **Alcance de esta corrección:** la v1.3 del Anexo de Nube y la versión nueva del Anexo de
  Encargo **conservan los buzones actuales** y corrigen el bloque de pendientes. La creación de
  los alias de Workspace (P3) es un acto del owner en la consola; si ocurre, produce **otra**
  versión del Anexo de Encargo con su huella y una re-suscripción, porque el §11 publica el canal.
  **P3 no es un bloqueante legal**: no se aplaza el cierre por él, pero tampoco se publica un
  alias que no se ha verificado.

### 2.3 ¿Qué papel tiene Google sobre los datos de cuenta y la telemetría?

**El papel de Google es doble, y el Acuerdo v1.5 lo declara de manera incorrecta porque no lo
delimita.** Este es el punto que el informe legal del 11-nov no resolvió.

| Plano | Qué ocurre | Rol correcto |
|---|---|---|
| **(i) Datos de la cuenta del administrador de la cuenta empresarial y telemetría del servicio** | Google los trata **por cuenta propia**, con sus propios términos y su propia base de protección de datos. **No son datos del cliente que K+AIR trate por cuenta de la Empresa.** | Google es **Responsable del Tratamiento** (Ley 1581/2012, art. 3, literales d) y e)). **Esto sigue siendo cierto y no se borra.** |
| **(ii) Datos del cliente que transitan por el canal de correo** — dirección del Firmante, enlace de la solicitud, código OTP y aviso de la firma | Con la cuenta de consumo no había vínculo contractual; **con el CDPA aceptado el 10-nov-2026 sí lo hay**. | Google trata **por cuenta de K+AIR** y queda vinculado por el CDPA. |

- En el plano (ii), el CDPA es el **contrato de transmisión** entre K+AIR y Google en los términos
  del art. 2.2.2.25.5.2 del Decreto 1074 de 2015, que es lo que la Circular Única SIC exige para
  identificar al destinatario como Encargado del Tratamiento en una transmisión internacional
  (num. 2.1(e)).
- **«Subencargado» es figura contractual, no legal.** La verificación en fuente oficial no
  encontró «suboperador» ni «subencargado» en ninguna disposición del Decreto 1074/2015: la ley
  solo define **Responsable** y **Encargado** (Ley 1581/2012, art. 3, literales d) y e)). Los
  textos de K+AIR (Anexo de Encargo y Anexo de Nube) pueden usar «Subencargado», pero **deben
  declararlo como figura contractual** anclada al deber del Encargado frente al Titular y al
  Responsable, y no como una categoría de la ley. La v1.6 del Acuerdo hace esa declaración.
- La transferencia internacional al exterior se mantiene: el CDPA admite que los datos del
  cliente se procesen en cualquier país en el que Google o sus subencargados tengan
  instalaciones, incluidos los Estados Unidos, país con nivel adecuado de protección (num. 3.2
  del Título V de la Circular Única). Lo que cambia no es la existencia de la transferencia sino
  **el vínculo contractual** por el que se hace y la calificación del papel del proveedor.
- ⚠️ **No verificado:** el texto del CDPA **no está en el repo** (solo su SHA-256
  `0e1c7294…fc69b1` y la captura de la consola). Por eso la v1.6 declara lo que la evidencia
  sostiene —que fue **aceptado el 10-nov-2026** por el administrador de la cuenta— y mantiene
  **condicionada** la calificación del papel de Google a la vigencia y aplicabilidad del CDPA
  para esa cuenta, que es exactamente la fórmula que ya usa el Anexo de Encargo.

---

## 3. Correcciones de fondo al informe legal del 11-nov-2026

Este dictamen **no ratifica** tres afirmaciones del informe del 11-nov, porque la verificación en
fuente oficial las desmintió o las matizó:

1. **El art. 18, literal (b), de la Ley 1581 no es el deber de informar con información veraz.**
   El texto literal es: «Conservar la información bajo las condiciones de seguridad necesarias
   para impedir su adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento». El
   deber de que la información suministrada sea «veraz, completa, exacta, actualizada, comprobable
   y comprensible» es del **Responsable** (art. 17, literal e)), y el principio general está en el
   art. 4, literal d). **Consecuencia:** en K+AIR el Responsable es la **Empresa**, no K+AIR. La
   obligatoriedad de corregir el §10.1 no viene de que K+AIR incumpla el art. 18(b), sino de (i) la
   obligación contractual del propio Acuerdo (§9.4) y (ii) el riesgo de que K+AIR entregue a la
   Empresa y al Titular una información inexacta, sobre la que la Empresa decide como Responsable.
2. **No existe en el Decreto 1074/2015 la obligación de «publicar una versión nueva con su propia
   huella digital».** La obligación es la del §9.4 del Acuerdo. La norma exige integridad
   (Ley 527/1999, arts. 9 y 12) y detección de alteración posterior a la firma
   (D. 1074/2015, art. 2.2.2.47.4, num. 2).
3. **La conservación de mensajes de datos es el art. 12 de la Ley 527/1999** (accesibilidad,
   formato que demuestre reproducción exacta, e información de origen, destino, fecha y hora), no
   los arts. 8, 9 y 10, que tratan original, integridad y admisibilidad.

---

## 4. Decisiones que se toman (sección E del checklist)

| # | Decisión | Fundamento | Estado |
|---|---|---|---|
| **D1** | El Acuerdo se corrige por **versión nueva (v1.6)**, cambio acotado a §8.7, §10.1 y §10.5(f), más la fecha de vigencia. | §9.4 del Acuerdo; arts. 9 y 12 de la Ley 527; art. 2.2.2.47.4 num. 2 del D. 1074 | Decidido |
| **D2** | El Anexo de Nube se corrige por **versión nueva (v1.3)**. El modelo vigente (v1.2) **no se reescribe**: no lo ha suscrito nadie, pero su huella está registrada en el manifiesto y citada en el expediente. | Principio de veracidad (art. 4(d) Ley 1581); trazabilidad de la Constancia (§9.6) | Decidido |
| **D3** | El Anexo de Encargo se corrige por **versión nueva por fecha**. El 2026-11-06 suscrito queda archivado sin editar. | §7 y §12 del propio Anexo | Decidido |
| **D4** | El papel de Google se declara **dual y delimitado**: Responsable por cuenta propia en los datos de la cuenta del administrador y la telemetría; Encargado por contrato de transmisión (CDPA) en los datos del cliente. «Subencargado» se declara **figura contractual**, anclada al art. 2.2.2.25.5.2 del D. 1074. | Art. 3(d) y (e) Ley 1581; art. 2.2.2.25.5.2 D. 1074; num. 2.1(e) Circular Única SIC | Decidido |
| **D5** | **P3 (alias de Workspace) no es bloqueante legal.** Se publican los buzones actuales, verificados y existentes. Si el owner crea los alias, eso genera otra versión del Anexo de Encargo y una re-suscripción adicional. | Arts. 15 y 18 Ley 1581; el expediente no puede declarar un canal sin verificar | Decidido |
| **D6** | La **Constancia** se reemite contra la versión vigente (la v1.6) antes de la publicación. Hoy declara `v1.4` y está `no_firmada`. | §3.6(h) y §9.6 del Acuerdo | Decidido |
| **D7** | **No se enciende `FIRMA_EXIGIR_ANEXO_NUBE`** ni se abre a trabajadores reales hasta que los tres textos nuevos estén publicados, la Constancia esté firmada y las compuertas se midan en el servidor. | §9.5 (efectos a futuro) y la compuerta `aprobacion_operativa_vigente` | Decidido |

**Lo que este dictamen NO autoriza:** los actos que requieren la identidad del owner —la
autorización operativa de la v1.6 en `gh_firma_aprobaciones_publicacion`, la firma de la
Constancia, la suscripción de ASEPLUS y los cuatro códigos OTP de P8. Esos los ejecuta el owner.

---

## 5. Base normativa (verificada el 11-nov-2026)

| Norma | Artículo/numeral | Texto literal | Fuente oficial |
|---|---|---|---|
| Ley 527/1999 | 9 (Integridad) | «se considerará que la información consignada en un mensaje de datos es íntegra, si ésta ha permanecido completa e inalterada, salvo la adición de algún endoso o de algún cambio que sea inherente al proceso de comunicación, archivo o presentación.» | [Senado](http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html) |
| Ley 527/1999 | 12 (Conservación) | Accesibilidad, conservación en formato que demuestre reproducción exacta, y conservación de la información de origen, destino, fecha y hora. | misma |
| Ley 527/1999 | 10 (Admisibilidad) | «En toda actuación administrativa o judicial, no se negará eficacia, validez o fuerza obligatoria y probatoria a todo tipo de información en forma de un mensaje de datos…» | misma |
| D. 1074/2015 | 2.2.2.47.4 num. 2 | «Es posible detectar cualquier alteración no autorizada del mensaje de datos, hecha después del momento de la firma.» | [SENA/Normograma](https://normograma.sena.edu.co/compilacion/docs/decreto_1074_2015_pr038.htm) |
| D. 1074/2015 | 2.2.2.25.1.3 num. 5 | «Transmisión. Tratamiento de datos personales que implica la comunicación de los mismos dentro o fuera del territorio de la República de Colombia cuando tenga por objeto la realización de un Tratamiento por el encargado por cuenta del Responsable.» | [DIAN/Normograma](https://normograma.dian.gov.co/dian/compilacion/docs/decreto_1074_2015.htm) |
| D. 1074/2015 | 2.2.2.25.5.2 | «El contrato que suscriba el Responsable con los encargados… señalará los alcances del tratamiento, las actividades que el encargado realizará por cuenta del responsable… y las obligaciones del Encargado para con el titular y el Responsable.» | misma |
| Ley 1581/2012 | 3(d) y 3(e) | «d) Encargado del Tratamiento: Persona natural o jurídica… que por sí misma o en asocio con otros, realice el Tratamiento de datos personales por cuenta del Responsable del Tratamiento; e) Responsable del Tratamiento: Persona natural o jurídica… que decida sobre la base de datos y/o el Tratamiento de los datos;» | [Senado](http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html) |
| Ley 1581/2012 | 17(e) | «e) Garantizar que la información que se suministre al Encargado del Tratamiento sea veraz, completa, exacta, actualizada, comprobable y comprensible;» | misma |
| Ley 1581/2012 | 18(b) | «b) Conservar la información bajo las condiciones de seguridad necesarias para impedir su adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento;» | misma |
| Ley 1581/2012 | 26 | «Se prohíbe la transferencia de datos personales de cualquier tipo a países que no proporcionen niveles adecuados de protección de datos.» | misma |
| SIC, Circular Única, Título V | Cap. III num. 2.1(e) | «La información relacionada con la Transmisión internacional de datos comprende la identificación del destinatario como Encargado del Tratamiento… si se tiene un contrato de transmisión de datos en los términos señalados en el artículo 2.2.2.25.5.2…» | [SIC, PDF oficial](https://www.sic.gov.co/sites/default/files/normatividad/082018/Titulo-V-Circular-03-del-1-08-2018.pdf) |
| SIC, Circular Única, Título V | num. 3.2 | Estados Unidos es país con nivel adecuado de protección. | misma |

---

## 6. Riesgos / a confirmar

- ⚠️ **No verificado:** el articulado del CDPA no está en el repo. Solo constan su SHA-256
  (`0e1c7294…fc69b1`, 97 831 B), su captura de aceptación (96 520 B,
  `9d989067…25560`) y la constancia de que el administrador de la cuenta lo aceptó el
  **10-nov-2026**. La `fecha_efectividad_addendum` del manifiesto es `null`: **no se afirma** que
  su fecha de efectividad sea la de la aceptación.
- ⚠️ **No verificado:** que la versión más reciente de la Circular Única, Título V, sea la del PDF
  consultado (Circular 03 de 2018). La sede electrónica de la SIC lista un PDF de 2020 que no se
  descargó.
- ⚠️ **No verificado en el servidor:** las compuertas se midieron en la base local. Las del
  servidor se miden después del despliegue, en el mismo acto que mide P8.
- **Riesgo de la v1.6:** hay **una** aceptación real del Acuerdo v1.5 (6-nov-2026). Quien firme
  después de la publicación de la v1.6 tendrá que leer y aceptar el texto nuevo. El mecanismo
  (`AGREEMENT_VERSION_REACCEPT_REQUIRED` + `AGREEMENT_VERSION_MIGRATED`) ya está construido y
  probado; falta medirlo contra el texto nuevo.
- **Riesgo de la v1.3 del Anexo de Nube:** la suscripción del 5-nov (v1.1) **no se reescribe** y
  queda en `versiones_firmadas`. P8 suscribe la v1.3 como primer acto; la Empresa conserva
  además su copia de la v1.1, que no se revoca.
- **Riesgo operativo:** tres textos nuevos y tres huellas nuevas exigen rehacer el manifiesto,
  reemitir la Constancia y volver a medir todas las compuertas. Si eso no alcanza, **P8 no se
  firma**: el acto de contrafirma con una huella que no coincide con el texto publicado es un
  verde falso.
- **A confirmar con abogado:** (i) si el Anexo de Encargo debe usar «Encargado» en lugar de
  «Subencargado» para Google, o si «Subencargado» se mantiene como figura contractual declarada;
  (ii) el alcance de la transferencia internacional que el CDPA habilita y suinteraction con el
  RNBD; (iii) la Circular Externa 002 de 2025 y si su ámbito alcanza a este canal.

---

## 7. Descargo

Este documento es asesoría jurídica informativa y **no sustituye la decisión del representante
legal de Gesstiar S.A.S.**, que es la autoridad del expediente. Las conclusiones se fundan en el
texto de los instrumentos del repo y en la norma consultada el 11-nov-2026 en fuentes oficiales;
las normas pueden cambiar. **Ninguna recomendación se presume aprobada por el silencio del
owner**, y su registro corresponde a la sección E del checklist definitivo. El agente que ejecuta
este dictamen es un agente de código: aplica los cambios de texto que aquí se resuelven, y no
presta asesoría jurídica profesional.
