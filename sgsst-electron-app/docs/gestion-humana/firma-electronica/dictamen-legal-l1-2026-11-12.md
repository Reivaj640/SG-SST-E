# Determinación jurídica L1 (fila J6 del checklist del abogado) — cierre del punto

> **Qué es este documento.** Entrega final del agente legal del repositorio (skill
> `asesoria-legal-sg-sst`, **solo consulta**: no editó archivos ni ejecutó comandos sobre el repo) sobre el
> punto **L1** de la mesa, equivalente a la fila **J6** del checklist del abogado
> (`paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md`).
>
> **Método.** Cada norma se leyó en **fuente oficial** el **12-nov-2026**. Lo que no se pudo verificar se
> marca con **⚠️ No verificado** y se dice **cómo confirmarlo**. Cero invención normativa: no se cita ningún
> artículo que no se haya leído.
>
> **Status.** Asesoría jurídica informativa. **No sustituye la validación de un abogado matriculado**: la
> firma, la ratificación y la responsabilidad son del owner (Gesstiar S.A.S.).
>
> **Alcance de esta entrega.** Determinación escrita y textos literales listos para pegar. **No se modificó
> ningún archivo del repositorio**; otro agente los convirtió en archivo.

---

## 0. Las trece correcciones al encargo (0.1 a 0.13)

| # | Afirmación que hay que corregir | Corrección precisa | Evidencia |
|---|---|---|---|
| 0.1 | «el proveedor contractual es **Google Ireland Limited**» (manifiesto) | **La entidad contractual es la que determine el perfil de pago (billing address) de la cuenta.** La tabla oficial de Google asigna, para Google Workspace: `EMEA` → Google Ireland Limited; `United States and any other location not covered above` → **Google LLC** (1600 Amphitheatre Parkway, Mountain View, California). Colombia no está en EMEA, luego la entidad esperable es **Google LLC**, que es la que ya nombran la v1.3 y la v1.4 candidata. Google Ireland Limited **además figura como subprocesador** (operaciones de centro de datos en Irlanda), no como parte del Acuerdo. El nombre que se escriba en el §4 del Nube y en el §5 del Encargo debe ser el de la **Order Form o el correo de renovación de Google** (⚠️ el perfil de pago real de `kair@gesstiar.com` no está documentado en el repo). | `https://cloud.google.com/terms/google-entity` (12-nov-2026); `https://workspace.google.com/intl/en/terms/subprocessors/`; `firma-service/legal-readiness.json:71`; `legal/anexo-nube-v1.3.html:283` |
| 0.2 | el CDPA es el «**texto vigente del 30 de octubre de 2026**» | **El texto oficial no declara fecha de versión.** Se identifica por **huella**: SHA-256 `0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1`, 97 831 bytes, descargado el 9-nov-2026 y **re-verificado el 12-nov-2026 con resultado idéntico**. La cabecera `Last-Modified` del recurso estático (`Mon, 03 Oct 2022 11:26:32 GMT`) no es la fecha del texto. La fecha «30-oct-2026» proviene del registro interno del equipo, no del texto de Google. **Corrección de redacción:** toda mención a «texto vigente del 30 de octubre de 2026» se sustituye por «texto identificado por su huella SHA-256, descargado el 9 de noviembre de 2026». | `https://admin.google.com/terms/apps/8/1/en/dpa_terms.html` (descarga viva 12-nov-2026: `BYTES=97831`, `SHA256=0e1c7294…`, coincide con el manifiesto); `decision-regularizacion-correo-2026-11-09.md` |
| 0.3 | `fecha_efectividad_addendum: null` | El **§2 del CDPA** define el *Addendum Effective Date* como «la fecha en que el Cliente aceptó el Addendum». La aceptación del administrador consta el **10-nov-2026** (captura de consola, SHA-256 `9d989067…`, 96 520 B). **Por definición contractual, la fecha de efectividad del Addendum es el 10-nov-2026.** La consola no muestra ese campo y por eso el manifiesto lo deja en `null`: no falta el acto, falta la lectura del campo. | `legal-readiness.json:88-106`; CDPA §§1-2 |
| 0.4 | «**Su incorporación a esta cuenta y su fecha de efectividad están pendientes de verificación por el owner (P1)**» | **P1 está cerrado.** La aceptación existe, con fecha, modo (`aceptado_por_administrador`) y captura hasheada verificada en la máquina. **Corrección:** la v1.4 no puede volver a declarar pendiente lo que está cumplido; lo que queda abierto es la **fecha de renovación del Acuerdo** que rija la cuenta y la re-aceptación si el texto del CDPA cambia. | `legal-readiness.json:86-107`; `readinessLegal.js:1067-1089` |
| 0.5 | **Fondo:** «el envío es una **transferencia internacional** a Estados Unidos… y **sigue rigiendo el artículo 26 de la Ley 1581 de 2012**» | **La operación es una TRANSMISIÓN, no una transferencia.** Con el CDPA vigente y Google como Encargado, el receptor trata por cuenta del Responsable y no es Responsable del tratamiento: aplica el art. 3 num. 5 del Decreto 1377 de 2013 y no el num. 4. **No se activa el art. 26 de la Ley 1581 de 2012**; rigen el **art. 24 num. 2** y el **art. 25** del Decreto 1377. El propio Anexo se contradice: declara a Google «proveedor contractual encargado (Subencargado)» y, en el mismo §4, que «no crea, no declara ni presupone un contrato de transmisión». Con un Encargado, el contrato **es** de transmisión. | D. 1377 arts. 3 (num. 4 y 5), 24 num. 2, 25; CDPA §§4.3, 5.1.2, 5.1.3, 5.2.1; Circular Única SIC Título V num. 2.1 y 3.2; SIC Concepto 25-625951 |
| 0.6 | la auditoría se afirma sin condición: «el **derecho de auditoría del Cliente del §7.5.2**, que puede nombrar un auditor independiente» | El **§7.5.2(a)** condiciona ese derecho a que **se aplique la Ley Europea**. Para esta cuenta, que no está sometida al Reglamento (UE) 2016/679, **el derecho no se activa por sí solo**. Lo exigible en todo caso: §7.4 y §7.5.1 (certificaciones e informes SOC), §7.5.2(c) (revisión de la *Security Documentation*), §7.1 con Anexo 2 (medidas de seguridad). | CDPA §§7.4, 7.5, 7.5.1, 7.5.2 |
| 0.7 | «Google LLC, **con sede en Estados Unidos**» | La ubicación es «**cualquier país en que Google o sus subprocesadores tengan instalaciones**» (§10.1 del CDPA, confirmado por los Service Specific Terms §1.3). **Estados Unidos es uno de esos países, no el único**, y la fase no es de transferencia. | CDPA §10.1; `https://workspace.google.com/terms/service-terms/` §1.3 |
| 0.8 | (implicito) que el plazo de 48 h del Encargo refleja un plazo de Google | **El CDPA no fija plazo de 24 h ni de 48 h** para incidentes: el §7.2.1 exige «*promptly and without undue delay*». El plazo de **cuarenta y ocho (48) horas** del Anexo de Encargo es **compromiso propio de K+AIR** y no puede presentarse como reflejo de un plazo de Google. | `legal/anexo-encargo.html:403-405`; CDPA §7.2.1 |
| 0.9 | (defecto de estructura) | **La fila de Google del §4 tiene nueve celdas `<td>` para un encabezado de ocho columnas.** La novena («Los derechos de verificación o auditoría aplicables al proveedor quedan pendientes de determinar conforme al papel jurídico y los términos del servicio») es un residuo que abre una columna que el encabezado no declara. **Es un defecto heredado de la v1.3 publicada** y pasó a la v1.4 candidata. La fila nueva debe llevar **exactamente ocho `<td>`**. | `legal/anexo-nube-v1.3.html:282-325`; `candidatos-v1.4/anexo-nube-v1.4.html:287-330` |
| 0.10 | el encargo remitía al «**§11**» del Anexo de Nube para la ficha de proveedores | El **§11 del Anexo de Nube es «Referencias normativas»**. La ficha de proveedores vive en el **§4 del Anexo de Nube** (`<h2>4. Proveedores externos y subencargados</h2>`) y en el **§5 del Anexo de Encargo** (`<h2>5. Proveedores externos y subencargados</h2>`). El «§11» del expediente es el **§11 del CDPA de Google** (Subprocessors). | `legal/anexo-nube-v1.3.html:883`; `candidatos-v1.4/anexo-nube-v1.4.html:241, 885`; `legal/anexo-encargo.html:428` |
| 0.11 | el §4 de la v1.4 candidata remite al «Anexo de Encargo **version 2026-11-11**» | El Anexo de Encargo nuevo es la versión **2026-11-12**. Además el propio candidato es internamente inconsistente: su cabecera dice «Versión 2026-11-11» mientras su cláusula de prevalencia habla de «esta **versión 2026-11-12** de este Anexo de Encargo». Hay que unificar etiqueta de versión, cabecera, meta y remisiones. | `candidatos-v1.4/anexo-encargo-2026-11-12.html:8, 34, 535, 571-575`; `candidatos-v1.4/anexo-nube-v1.4.html:252` |
| 0.12 | (defecto de edición) | El §4 de la v1.4 candidata termina su párrafo introductorio con una **línea huérfana** que repite el cierre del párrafo anterior y deja la frase partida. Hay que eliminarla al sustituir el párrafo (queda subsumida en el texto nuevo). | `candidatos-v1.4/anexo-nube-v1.4.html:253-254` |
| 0.13 | la cita del Decreto 1377 que aparece en toda la Determinación y en sus literales: la que remite al **art. 2 num. 5 → art. 3 num. 5** (transmisión) y la que remite al **art. 2 num. 4 → art. 3 num. 4** (transferencia) | **Las dos definiciones están en el art. 3 del Decreto 1377 de 2013, no en el art. 2.** El art. 2 es «Tratamiento de datos en el ámbito personal o doméstico» (compilado en el art. 2.2.2.25.1.2 del Decreto 1074 de 2015) y el art. 3 es «Definiciones», donde el **num. 4** es Transferencia y el **num. 5** es Transmisión. Hay que sustituir la cita en la Determinación, en los literales que van a la v1.4 y en el Encargo 2026-11-12: **art. 2 num. 5 → art. 3 num. 5** y **art. 2 num. 4 → art. 3 num. 4**. Los textos **ya suscritos** (la v1.3 y el Encargo 2026-11-11) **no se tocan**: no tienen esta cita (usan la forma compilada, art. 2.2.2.25.1.3, numeral 4 y 5, del Decreto 1074 de 2015), y la corrección queda en la v1.4. | Revisión de asesoría del 13-nov-2026 (`revision-asesoria-s01-s04-2026-11-13.md`, 9 132 B, sha256 `7c1a0e67d89d…`); compilación oficial del Decreto 1377 de 2013 (Cancillería/Normograma, 13-nov-2026): «ARTÍCULO 2o. TRATAMIENTO DE DATOS EN EL ÁMBITO PERSONAL O DOMÉSTICO» y «ARTÍCULO 3o. Definiciones… 4. Transferencia… 5. Transmisión» |

---

## 1. Respuesta corta

**L1 queda determinado así:** (i) la entidad contractual es **Google LLC**, determinada por el perfil de pago
de la cuenta y no por el nombre del subprocesador; (ii) Google tiene **dos papeles calificados por
operación**: **Responsable** (art. 3(e) Ley 1581) sobre la cuenta del administrador y la telemetría, y
**Encargado** (art. 3(d)) sobre los datos del cliente del canal, donde «Subencargado» es solo figura
contractual; (iii) la operación es una **transmisión internacional a un Encargado** (art. 3 num. 5 del Decreto
1377 de 2013) y **no una transferencia**, por lo que **no se activa el art. 26 de la Ley 1581 de 2012** y rigen
el **art. 24 num. 2** y el **art. 25** del Decreto 1377; (iv) **P1 está cerrado**, el CDPA se identifica **por
huella SHA-256 sin fecha de versión** y su fecha de efectividad es el **10-nov-2026** por el §2; (v) el derecho
de auditoría del **§7.5.2(a) no se activa** para esta cuenta; (vi) **Estados Unidos es uno de los países
posibles, no el único**; (vii) el CDPA **no fija plazo de 24 h ni de 48 h**: el de 48 h es compromiso propio de
K+AIR.

---

## 2. Base normativa (12-nov-2026)

| Norma | Artículo / numeral | Qué dice | Fuente oficial | Fecha |
|---|---|---|---|---|
| Ley 1581 de 2012 | Art. 3(c) | **Dato personal**: toda información relativa a una persona natural que se encuentre en bases de datos, y los datos que el Responsable de ese tratamiento tiene en su poder | secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html | 12-nov-2026 |
| Ley 1581 de 2012 | Art. 3(d) | **Encargado**: la persona natural o jurídica que, por cuenta del Responsable, trata datos personales. La ley **solo distingue Responsable y Encargado**: no existe la categoría «subencargado» | ídem | 12-nov-2026 |
| Ley 1581 de 2012 | Art. 3(e) | **Responsable**: la persona natural o jurídica que decide sobre el tratamiento y la estructura de la base de datos | ídem | 12-nov-2026 |
| Ley 1581 de 2012 | Art. 26 | Prohíbe la **transferencia** de datos a un país sin nivel adecuado de protección, con las excepciones a–e; parágrafo 1 (declaración de conformidad de la SIC) | ídem | 12-nov-2026 |
| Decreto 1377 de 2013 | Art. 2, num. 4 | **Transferencia**: envío de datos personales a un receptor que a su vez es **Responsable** del Tratamiento | normograma.dian.gov.co/dian/compilacion/docs/decreto_1377_2013.htm | 12-nov-2026 |
| Decreto 1377 de 2013 | Art. 2, num. 5 | **Transmisión**: comunicación de datos personales con el objeto de que el **Encargado** los trate por cuenta del Responsable | ídem | 12-nov-2026 |
| Decreto 1377 de 2013 | Art. 24, num. 2 | Las transmisiones internacionales entre el responsable y el encargado **no requieren informar al Titular ni su consentimiento** cuando exista contrato en los términos del art. 25 | ídem | 12-nov-2026 |
| Decreto 1377 de 2013 | Art. 25 | Contenido mínimo del contrato (alcance del tratamiento y actividades) y las **tres obligaciones del Encargado**: tratar conforme a los principios, salvaguardar la seguridad y guardar confidencialidad | ídem | 12-nov-2026 |
| Circular Única de la SIC, Título V | Num. 2.1 | La información de **transmisión** internacional comprende la identificación del destinatario como **Encargado**, el país y el **contrato de transmisión**; la de **transferencia** exige destinatario **Responsable** y declaración de conformidad o causal del art. 26 | sede electrónica SIC (Resolución 56579 del 12-ago-2025, DO 53.210) | 12-nov-2026 |
| Circular Única de la SIC, Título V | Num. 3.2 | Lista de países con **nivel adecuado de protección** (incluye **Estados Unidos**). Parágrafo 1: los Responsables deben poder **demostrar** medidas apropiadas y efectivas y la seguridad de los registros. Parágrafo 2: país no listado, verificar causal del art. 26 o pedir declaración de conformidad. Parágrafo 3: el simple tránsito transfronterizo no comporta transferencia. Parágrafo 4: contempla la transmisión a países con nivel adecuado | ídem | 12-nov-2026 |
| SIC, Concepto 25-625951 (ene-2026) | Alcance | «si las operaciones contemplan la **transferencia** de datos —envío de la información o los datos personales a un receptor, que a su vez es Responsable del Tratamiento—, esta se encuentra plenamente sujeta a la Circular 002 de 2025. Sin embargo, si se realiza exclusivamente la **transmisión** de datos —comunicación de los mismos que tiene por objeto la realización de un Tratamiento por el Encargado por cuenta del Responsable—, no resulta aplicable» | sede electrónica SIC | 12-nov-2026 |
| CDPA de Google (Customers) | §§1-2 | El Addendum **rige desde** el *Addendum Effective Date*, definido como la fecha en que el Cliente aceptó el Addendum. *Subprocessor*: tercero autorizado como **another processor** | `https://admin.google.com/terms/apps/8/1/en/dpa_terms.html` | 12-nov-2026 |
| CDPA de Google | §§4.3, 5.1.1(b), 5.1.2, 5.1.3 | §4.3: el Addendum aplica **se aplique o no** la ley europea. §5.1.1(b): Google es **processor** bajo la condición de que se aplique la ley europea. §5.1.2: el Cliente processor **garantiza** que el controlador autorizó las Instrucciones, la designación de Google como **another processor** y el entretenimiento de Subprocessors, y **debe reenviar** al controlador las notificaciones de §§5.2.2, 7.2.1, 9.2.1 y 11.4. §5.1.3: responsabilidades bajo la ley no europea | ídem | 12-nov-2026 |
| CDPA de Google | §5.2.1 | El Cliente instruye a Google y se compromete frente al controlador | ídem | 12-nov-2026 |
| CDPA de Google | §6.2 | *Return or Deletion When Term Ends*: el Cliente instruye la eliminación de los datos restantes, incluidas las copias, al terminar el Término, con **período de recuperación de hasta 30 días** | ídem | 12-nov-2026 |
| CDPA de Google | §7.1 y Anexo 2 | Medidas de seguridad | ídem | 12-nov-2026 |
| CDPA de Google | §7.2.1 | Notificación de incidentes «*promptly and without undue delay*». **No fija plazo de 24 h ni de 48 h** | ídem | 12-nov-2026 |
| CDPA de Google | §§7.4, 7.5, 7.5.1, 7.5.2 | Certificaciones de cumplimiento e informes SOC; revisiones y auditorías. El derecho de auditor independiente del **§7.5.2(a) está condicionado a que se aplique la Ley Europea**; el §7.5.2(c) permite revisar la *Security Documentation* | ídem | 12-nov-2026 |
| CDPA de Google | §10.1 | *Customer Data* puede procesarse **en cualquier país** en que Google o sus Subprocessors tengan instalaciones | ídem | 12-nov-2026 |
| CDPA de Google | §§11.1-11.4 | Lista de subprocesadores, requisitos de engagement, **preaviso de 30 días** y derecho de oponerse (90 días) | ídem | 12-nov-2026 |
| Service Specific Terms de Google Workspace | §§1.1, 1.3 | *Data Regions Policy* (Data Region = Estados Unidos o Europa) y **Limitaciones**: «Google may store or process any Customer Data that is not covered by the Data Regions Policy wherever Google or its Subprocessors maintain facilities» | `https://workspace.google.com/terms/service-terms/` | 12-nov-2026 |
| Google Contracting Entity | Tabla de entidades | «*Google*» significa la entidad identificada según el **billing address** del Cliente. Para Google Workspace: `EMEA` → Google Ireland Limited; `United States and any other location not covered above` → **Google LLC** | `https://cloud.google.com/terms/google-entity` | 12-nov-2026 |
| Lista pública de subprocesadores de Workspace | — | **Google Ireland Ltd.** figura como subprocesador de operaciones de centro de datos en Irlanda | `https://workspace.google.com/intl/en/terms/subprocessors/` | 12-nov-2026 |

---

## 3. Aplicación: la determinación de L1 en fondo

### 3.1 Entidad contractual: Google LLC, y por qué se determina por el perfil de pago

Google no tiene una única contraparte: en cada Acuerdo, «Google» significa la entidad que la tabla de
*Google Contracting Entity* asigna según el **billing address** del Cliente. Para **Google Workspace**, la
tabla asigna `EMEA` → Google Ireland Limited y `United States and any other location not covered above` →
**Google LLC**. Colombia no está en EMEA, luego **la entidad esperable para una cuenta con perfil de pago en
Colombia es Google LLC**, y esa es la que ya nombran la v1.3 publicada y la v1.4 candidata.

El equívoco del expediente tiene un origen identificable: **Google Ireland Limited es real, pero como
subprocesador** (operaciones de centro de datos en Irlanda), no como parte del Acuerdo. Quien redactó el
manifiesto tomó el nombre que aparece primero en la lista pública de subprocesadores y lo puso en el campo
`proveedor`.

**Determinación:** el nombre que se escriba en el §4 del Anexo de Nube y en el §5 del Anexo de Encargo es
**Google LLC**, y debe ser el que conste en la Order Form o en el correo de renovación de Google
(**⚠️ No verificado**: el perfil de pago real de `kair@gesstiar.com` no está documentado en el repo; **cómo
confirmarlo**: Consola de Google → Facturación → perfil de pago).

### 3.2 Google tiene dos papeles, calificados por operación

| Operación | Papel | Figura | Fundamento | Consecuencia |
|---|---|---|---|---|
| **Cuenta del administrador de Workspace** (correo del administrador, nombre, uso, configuración) | **Responsable** (art. 3(e) Ley 1581) | Proveedor por cuenta propia | La Empresa no determina finalidades ni medios sobre estos datos; no son datos del cliente | **Nada que K+AIR pueda invocar** contra Google por cuenta de la Empresa. K+AIR responde por ellos ante el administrador, no ante la Empresa |
| **Telemetría del servicio de Google** (registros, métricas, uso) | **Responsable** (art. 3(e)) | Proveedor por cuenta propia | Ídem; ya declarado en el Anexo | Fuera de las obligaciones invocables en nombre de la Empresa |
| **Datos del cliente del canal de correo**: (i) correo del destinatario; (ii) información técnica del envío (fecha, hora, metadatos); (iii) OTP; (iv) enlace individual | **Encargado** (art. 3(d)), contratado por K+AIR | **Subencargado**: figura contractual del CDPA (*another processor*, §§2 y 5.1.2) | Opera por cuenta del Responsable, con instrucciones documentadas (CDPA §5.2.1 y §5.1.2) | **Transmisión internacional** (D. 1377 art. 3 num. 5). Rigen el art. 24 num. 2 y el art. 25; **no** se activa el art. 26 |
| **Proveedor de correo propio de la Empresa** (primera fila de la tabla del §4), cuando la Empresa lo configura | **Responsable** por los datos de su propia cuenta, según declara esa fila | Proveedor de la Empresa | La Empresa determina finalidades y medios | Aquí **sí** puede haber una **transferencia internacional** (art. 3 num. 4) si el proveedor es un Responsable en el exterior, y entonces **sí** aplican el art. 26 y el numeral 3.2. **Esta determinación no toca esa fila**: la corrección 0.5 es de la fila de Google |

**La etiqueta del CDPA no es la que decide.** La designación de Google como *processor* del §5.1.1(b) está
formulada **bajo la condición de que se aplique la ley europea**; para una cuenta fuera de EMEA rige el
§5.1.3. Lo que permite calificar a Google como Encargado en esta operación es la **operación concreta y el
vínculo contractual**: la cadena de instrucciones (Cliente instruye, §5.2.1), la garantía del Cliente de que el
controlador autorizó las Instrucciones y la designación de Google como *another processor* (§5.1.2(a)), y el
deber de reenviar al controlador las notificaciones de §§5.2.2, 7.2.1, 9.2.1 y 11.4 (§5.1.2(b)).

### 3.3 La operación es TRANSMISIÓN, no transferencia

| Criterio | Transferencia (art. 3 num. 4) | Transmisión (art. 3 num. 5) | Lo que ocurre en el canal de correo |
|---|---|---|---|
| ¿Quién recibe? | Un receptor que **a su vez es Responsable** del Tratamiento | Un **Encargado** que trata por cuenta del Responsable | Google **no** es Responsable de los datos del cliente: es Encargado (art. 3(d)) |
| ¿Con qué objeto? | El receptor decide sobre el tratamiento | El Encargado trata **por cuenta** del Responsable | Google trata con las instrucciones de K+AIR (CDPA §5.2.1, §5.1.2) |
| Encaje | No encaja | **Encaja** | **Transmisión internacional** |

De ahí se sigue, en cadena: **(a)** no se activa la prohibición del art. 26 de la Ley 1581 de 2012 (que se
refiere a transferencias); **(b)** no se activa el esquema de la declaración de conformidad de la SIC por
transferencia; **(c)** el régimen aplicable es el del **art. 24 num. 2** y el **art. 25** del Decreto 1377 de
2013; **(d)** el marco sectorial de referencia sigue siendo el **numeral 3.2 del Título V de la Circular Única**
(Estados Unidos con nivel adecuado; parágrafo primero: el Responsable debe poder **demostrar** medidas
apropiadas y efectivas y la seguridad de los registros; parágrafo cuarto: se contempla la transmisión a países
con nivel adecuado).

Esto es **el mismo marco que L5 (Backblaze)**, con la diferencia del sujeto: allí el receptor contratado por el
Encargado era un Responsable y la operación era transferencia; aquí el receptor es un **Encargado** y la
operación es transmisión. La Circular 002 de 2025 tampoco alcanza este canal por la misma razón (Concepto SIC
25-625951).

### 3.4 Los artículos que sí rigen, y el que deja de regir

- **Art. 24, numeral 2, del Decreto 1377 de 2013:** las transmisiones internacionales entre el Responsable y el
  Encargado **no requieren informar al Titular ni su consentimiento** cuando exista contrato en los términos
  del art. 25. El contrato existe: el **Anexo de Encargo versión 2026-11-12** (K+AIR–Empresa) y el **CDPA**
  (K+AIR–Google), con el Anexo de Nube que los vincula.
- **Art. 25 del Decreto 1377 de 2013:** contenido mínimo del contrato y las **tres obligaciones del
  Encargado** — tratar conforme a los principios, salvaguardar la seguridad y guardar confidencialidad. Las tres
  están en el Anexo de Encargo; en la relación con Google las aportan el CDPA §5.2.1 (instrucciones y
  confidencialidad), §7.1 con Anexo 2 (seguridad), §6.2 (devolución y supresión), §§7.4-7.5 (certificaciones y
  revisiones) y §11 (subencargados).
- **Art. 26 de la Ley 1581 de 2012:** **no se activa** en esta operación. El Anexo puede seguir citándolo **como
  norma del marco general**, pero no puede afirmar que este canal es una transferencia.
- **Numeral 3.2 del Título V de la Circular Única:** se mantiene como marco de referencia y como origen del
  deber de **responsabilidad demostrada** que corresponde al Responsable (la Empresa).

### 3.5 El CDPA: identificación por huella, fecha de efectividad y estado de P1

- **Identificación:** URL canónica `https://admin.google.com/terms/apps/8/1/en/dpa_terms.html` (espejo en Cloud
  `https://cloud.google.com/terms/data-processing-addendum`), **SHA-256
  `0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1`**, **97 831 bytes**, descargado el
  9-nov-2026 y verificado de nuevo el 12-nov-2026 con resultado idéntico. **El texto oficial no declara fecha de
  versión**: el Anexo identifica el instrumento por la huella, no por una fecha.
- **Fecha de efectividad:** el **§2 del CDPA** define el *Addendum Effective Date* como la fecha en que el
  Cliente aceptó el Addendum. La aceptación del administrador de `kair@gesstiar.com` consta el **10 de noviembre
  de 2026** (captura de la consola de Workspace, SHA-256 `9d989067…`, 96 520 B, verificada en la máquina). **Esa
  es la fecha de efectividad del Addendum.**
- **P1 (incorporación/aceptación del CDPA a la cuenta): cerrado.** Lo que queda pendiente es la **fecha de
  renovación del Acuerdo de Google Workspace que rija la cuenta** y la re-aceptación si Google cambia el
  texto.

### 3.6 La auditoría: el derecho del §7.5.2(a) no se activa

Lo exigible en todo caso: **§7.4** (certificaciones de cumplimiento e informes SOC), **§7.5.1**, **§7.5.2(c)**
(revisión de la *Security Documentation*) y **§7.1 con Anexo 2** (medidas de seguridad). El **§7.5.2(a)** —
auditor independiente nombrado por el Cliente— **está condicionado a que se aplique la Ley Europea**, de modo
que para esta cuenta no se activa por sí solo. Lo que K+AIR puede invocar es lo que el CDPA le atribuye en su
condición de Cliente, incluido el deber de reenviar al controlador las notificaciones de §§5.2.2, 7.2.1, 9.2.1
y 11.4 (§5.1.2(b)). **El Anexo no puede prometer un auditor independiente.**

### 3.7 Estados Unidos es uno de los países posibles, no el único

El **§10.1 del CDPA** permite que los *Customer Data* se procesen **en cualquier país en que Google o sus
Subprocessors tengan instalaciones**, y los **Service Specific Terms §1.3** lo confirman (los datos del cliente
no cubiertos por la *Data Regions Policy* pueden almacenarse o procesarse en cualquier país de instalaciones
de Google o de sus subencargados). La redacción correcta es «cualquier país en que Google o sus subencargados
tengan instalaciones, incluido Estados Unidos»; decir «con sede en Estados Unidos» como si fuera la única
ubicación posible es inexacto.

### 3.8 El CDPA no fija plazo de 24 h ni de 48 h

El **§7.2.1** exige notificar incidentes «*promptly and without undue delay*», y nada más. El plazo de
**cuarenta y ocho (48) horas** del Anexo de Encargo (`legal/anexo-encargo.html:403-405`) es **compromiso propio
de K+AIR** frente a la Empresa, y el mecanismo para cumplirlo es el reenvío al controlador del §5.1.2(b). El
Anexo no puede presentar ese plazo como reflejo de un plazo de Google, ni prometer un plazo de 24 h que el CDPA
no contiene.

### 3.9 Los siete actos del owner que dependen de esta determinación

1. **Obtener la Order Form o el correo de renovación de Google** y fijar el nombre de la entidad contractual
   (Google LLC) en el §4 del Anexo de Nube y en el §5 del Anexo de Encargo.
2. **Registrar la fecha de renovación del Acuerdo** de Google Workspace que rija la cuenta, y **re-aceptar el
   CDPA** en la consola si el texto cambia.
3. **Adoptar en el manifiesto** `legal-readiness.json` la corrección de clasificación y de entidad
   (`subencargados.mail_provider.proveedor`, `.pais`, `.transferencia`), para que el expediente no diga dos
   cosas distintas. Sin efecto de máquina: el gate solo lee booleanos y campos de presencia.
4. **Decidir y documentar la evidencia de las medidas** que el Responsable debe poder demostrar (parágrafo
   primero del numeral 3.2), e incorporarla al expediente.
5. **Traducir a la Empresa el preaviso de 30 días y el derecho de oponerse** del §11 del CDPA, para que el
   derecho de oposición que el §4 del Nube le reconoce sea exigible en la práctica.
6. **Cerrar P3** (alias de privacidad, soporte e incidentes) y **P6** (revocación de las credenciales
   anteriores).
7. **Suscribir y publicar** el Anexo de Nube v1.4 y el Anexo de Encargo 2026-11-12, con sus actas y huellas.

---

## 4. Riesgos y qué confirmar

- **⚠️ No verificado — fecha de versión del CDPA.** El texto oficial no la declara; la cabecera `Last-Modified`
  del recurso (`Mon, 03 Oct 2022 11:26:32 GMT`) es de recurso estático y no sirve. **Cómo confirmarlo**: la
  línea «Last modified» del Acuerdo de Google Workspace que rija la cuenta (la consola no la muestra) o una
  captura fechada de la página del CDPA. Alternativa ya aplicada en los textos literales: sustituir la
  afirmación por la huella SHA-256 y la fecha de descarga.
- **⚠️ No verificado — entidad contractual.** La tabla oficial determina por perfil de pago; el perfil de pago
  real de `kair@gesstiar.com` no está documentado. **Cómo confirmarlo**: Consola de Google → Facturación →
  perfil de pago, o la Order Form / el correo de renovación.
- **⚠️ No verificado — Acuerdo que rija la cuenta y su fecha de renovación.** Declarado en el manifiesto
  (observaciones del 10-nov-2026: los términos vigentes entran en el próximo *renewal* y el ToS archivado de
  2021 no incorporaba el CDPA). **Cómo confirmarlo**: pantalla de suscripción de la consola o correo de
  renovación. **No afecta la determinación**: el CDPA aplica con independencia de si se aplica la ley europea
  (§4.3) y la aceptación del 10-nov-2026 está documentada.
- **⚠️ No verificado — que el conjunto Anexo de Encargo + Anexo de Nube + CDPA reúna los contenidos mínimos
  del art. 25 del Decreto 1377.** Los tres instrumentos contienen las tres obligaciones y las cláusulas de
  instrucciones y seguridad, pero la vista de conjunto no se hizo en un instrumento único. **Cómo confirmarlo**:
  revisión de los §§3, 4, 7.5 y 10 del Anexo de Encargo contra el art. 25, con la evidencia de los §§5.2.1,
  7.1 y 6.2 del CDPA.
- **⚠️ No verificado — Circular 001 del 9-ene-2026** que, según el §11 de la v1.4 candidata, modificó el
  numeral 3.3 del Título V (DO 53.362). Fuera del encargo de L1. **Cómo confirmarlo**: sede electrónica de la
  SIC.
- **Riesgo — contradicción interna que sobrevive si solo se cambia la fila.** El §4 del Nube dice a la vez «Google
  es un Encargado» y «no existe contrato de transmisión con Google». Publicar así es lo que menos conviene: está
  en el Anexo B.
- **Riesgo — la fila de Google tiene nueve celdas para ocho columnas** (0.9). Defecto heredado de la v1.3
  publicada; la fila nueva lo corrige, pero si alguien edita la fila sin contar celdas, el defecto se propaga.
- **Riesgo — la primera fila de la tabla (proveedor de correo de la Empresa) sigue siendo un Responsable.**
  Mientras tanto, esa fila **sí** puede configurar una transferencia internacional con el marco del art. 26 y
  del numeral 3.2. La v1.4 **no debe generalizar** la conclusión de Google a esa fila.
- **Riesgo — el verde del gate no cubre nada de esto.** `readinessLegal.js:1035-1043` (`_proveedorOk`) y
  `:1720-1736` solo leen `cuenta`, `rol`, `dpa`, `version`, `fecha`, `evidencia`, `devolucion_supresion`,
  `auditoria` y la forma de `aceptacion`. **El verde de `mail_provider_dpa` no certifica la fecha de
  efectividad, la entidad contractual ni la clasificación del flujo.**
- **Riesgo — el plazo de 48 h no es un plazo de Google.** Si el Anexo insinúa lo contrario, la Empresa puede
  entender lo contrario.

---

## 5. Descargo

Esto es **asesoría jurídica informativa del agente legal del repositorio**; no constituye asesoría jurídica
profesional ni sustituye la validación de un abogado matriculado. Las normas se consultaron el **12-nov-2026**
en las fuentes oficiales citadas y pueden cambiar después de esa fecha; el texto del CDPA se identificó por
huella SHA-256 y puede ser sustituido por Google en cualquier momento. Las afirmaciones sobre el estado de la
cuenta (aceptación, renovación del Acuerdo, perfil de pago, lista de subprocesadores) dependen de información
que está en la consola de Google y no en el repositorio. **La decisión final, la firma, la ratificación y la
responsabilidad son del owner (Gesstiar S.A.S.)**, y todo lo que aquí se declara pendiente así debe permanecer
en los textos que se publiquen.

**No se modificó ningún archivo del repositorio.** El único uso de comandos fue descargar el CDPA a
`$env:TEMP` para verificar su huella, sin escribir en el repo.

---

# ANEXO A — Texto literal HTML (listo para pegar)

> Sin dependencias de contexto: cada bloque es autónomo y sustituye al anterior en su ubicación. Entidades
> HTML con nombre (`&sect;`, `&aacute;`, `&oacute;`, `&iacute;`, `&eacute;`, `&uacute;`, `&ntilde;`, `&uuml;`,
> `&mdash;`, `&laquo;`, `&raquo;`), sin markdown dentro del HTML.

## A.1 Fila de Google del §4 del Anexo de Nube v1.4

> Ubicación: `candidatos-v1.4/anexo-nube-v1.4.html`, dentro de `<tbody>` de la tabla de 8 columnas, **reemplaza
> las líneas 287-330**. Lleva **exactamente ocho `<td>`**.

```html
      <tr>
        <td>Google LLC (Google Workspace)</td>
        <td>SMTP: env&iacute;o del c&oacute;digo OTP y, cuando la Empresa no tenga una cuenta de env&iacute;o
        propia configurada, del enlace de firma y de los avisos del servicio</td>
        <td>Los datos que efectivamente salen por ese canal, y solo esos: (i) el correo del destinatario;
        (ii) la informaci&oacute;n t&eacute;cnica del env&iacute;o, es decir la fecha y la hora y los metadatos
        t&eacute;cnicos del mensaje; (iii) el c&oacute;digo de verificaci&oacute;n de un solo uso (OTP); y (iv) el
        enlace individual de acceso a la solicitud de firma. No sale el documento firmado, ni la Constancia,
        ni el contenido del documento, ni ning&uacute;n dato sensible</td>
        <td><strong>Encargado (proveedor contractual encargado, que este Anexo designa como Subencargado)
        respecto de los datos del cliente que salen por este canal, mientras el CDPA este vigente y sea
        aplicable a la cuenta del Encargado.</strong> <strong>Subencargado es una figura contractual, no una
        categor&iacute;a de la Ley 1581 de 2012</strong>, que solo distingue Responsable (art&iacute;culo 3(e)) y
        Encargado (art&iacute;culo 3(d)); la determinaci&oacute;n de que Google sea Encargado en esta operaci&oacute;n
        no la da la etiqueta del instrumento, sino <strong>la operaci&oacute;n concreta y el v&iacute;nculo
        contractual</strong>: Google trata por cuenta del Responsable, con las instrucciones del Encargado
        (&sect;5.2.1 del CDPA) y con el deber de reenviar al controlador las notificaciones de los &sect;5.2.2,
        &sect;7.2.1, &sect;9.2.1 y &sect;11.4 (&sect;5.1.2(b)). Obliga a Google con las cl&aacute;usulas de
        seguridad (&sect;7.1 y Anexo 2), devoluci&oacute;n y supresi&oacute;n (&sect;6.2), certificaciones y
        revisiones (&sect;7.4 y &sect;7.5) y subencargados (&sect;11), que el Encargado cumple y responde frente
        a la Empresa en los mismos t&eacute;rminos en que responde por s&iacute; mismo. La designaci&oacute;n de
        processor del &sect;5.1.1(b) del CDPA est&aacute; formulada por Google <strong>bajo la condici&oacute;n de
        que se aplique la ley europea</strong>; para una cuenta fuera de EMEA rige el &sect;5.1.3, y el CDPA se
        aplica con independencia de si se aplica la ley europea (&sect;4.3). La lista de subencargados de Google
        es <code>https://workspace.google.com/intl/en/terms/subprocessors/</code>. <strong>Los datos de cuenta
        del administrador de Workspace y la teletr&iacute;a de Google no son datos del cliente:</strong> los trata
        Google por cuenta propia, con su propia base jur&iacute;dica, y quedan fuera de lo que K+AIR puede
        invocar contra Google en nombre de la Empresa</td>
        <td><strong>Google LLC</strong>, con sede en Estados Unidos. <strong>La entidad contractual se determina
        por el perfil de pago de la cuenta</strong>, y el perfil de pago real de esta cuenta <strong>no est&aacute;
        documentado en el expediente</strong>: su confirmaci&oacute;n contra el contrato (Order Form o correo de
        renovaci&oacute;n de Google) queda pendiente, y por eso este Anexo nombra a Google LLC como la entidad que la
        tabla de Google asigna a las ubicaciones distintas de EMEA, <strong>sin que esa atribuci&oacute;n se presente
        como un hecho verificado</strong>. <strong>El &sect;10.1 del CDPA permite que los datos del
        cliente se procesen en cualquier pa&iacute;s en que Google o sus subencargados tengan instalaciones</strong>,
        y los Service Specific Terms de Google Workspace lo confirman: los datos del cliente que no est&aacute;n
        cubiertos por la Data Regions Policy pueden almacenarse o procesarse en cualquier pa&iacute;s de
        instalaciones de Google o de sus subencargados. <strong>La comunicaci&oacute;n al exterior es una
        transmisi&oacute;n internacional de datos personales a un Encargado</strong> (art&iacute;culo 3, numeral 5,
        del Decreto 1377 de 2013), <strong>no una transferencia internacional</strong> (art&iacute;culo 3, numeral
        4), porque el receptor trata por cuenta del Responsable y no es Responsable del tratamiento: en
        consecuencia <strong>no se activa la prohibici&oacute;n de transferencia del art&iacute;culo 26 de la Ley
        1581 de 2012</strong>. La transmisi&oacute;n se rige por el art&iacute;culo 24, numeral 2, del Decreto 1377
        de 2013 (no requiere informar al Titular ni su consentimiento cuando exista contrato en los t&eacute;rminos
        del art&iacute;culo 25) y por el art&iacute;culo 25 del mismo Decreto (contenido m&iacute;nimo del contrato
        de transmisi&oacute;n y las tres obligaciones del Encargado: tratar conforme a los principios, salvaguardar
        la seguridad y guardar confidencialidad). <strong>El numeral 3.2 del T&iacute;tulo
        V de la Circular &Uacute;nica de la SIC se cita &uacute;nicamente como marco sectorial de referencia y no como
        fundamento de esta calificaci&oacute;n</strong>: ni ese numeral ni la lista de pa&iacute;ses con nivel
        adecuado de protecci&oacute;n fueron verificados por el abogado matriculado el 13 de noviembre de 2026, y
        <strong>la calificaci&oacute;n que este Anexo declara no depende de ellos</strong>, porque el art&iacute;culo
        24, numeral 2, y el art&iacute;culo 25 del Decreto 1377 de 2013 <strong>no condicionan el pa&iacute;s</strong>
        del encargado. <strong>Los Estados Unidos son uno de los pa&iacute;ses posibles, no el &uacute;nico</strong>, y
        que ese pa&iacute;s se declare <strong>no se apoya en ninguna exigencia legal verificada</strong></td>
        <td>Cloud Data Processing Addendum (Customers), el <strong>CDPA</strong>: URL can&oacute;nica de Workspace
        <code>https://admin.google.com/terms/apps/8/1/en/dpa_terms.html</code> (espejo en Cloud:
        <code>https://cloud.google.com/terms/data-processing-addendum</code>). <strong>El texto oficial no declara
        fecha de versi&oacute;n</strong>: se identifica por su huella, SHA-256 del archivo descargado el 9 de
        noviembre de 2026 (97 831 bytes):
        <code>0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1</code>, huella verificada de nuevo
        el 12 de noviembre de 2026 con el mismo resultado. <strong>Fecha de efectividad del Addendum:</strong> el
        &sect;2 del CDPA la define como la fecha en que el Cliente acept&oacute; el instrumento; la aceptaci&oacute;n
        del administrador de <code>kair@gesstiar.com</code> consta el <strong>10 de noviembre de 2026</strong>
        (captura de la consola de Workspace, SHA-256
        <code>9d989067baf9f7908d144dcdb86c04f9b62efa6e34e4714f7dd3132e5d825560</code>, 96 520 bytes), y esa es la
        fecha de efectividad. <strong>La incorporaci&oacute;n del CDPA a esta cuenta y su aceptaci&oacute;n est&aacute;n
        comprobadas</strong>; <strong>queda pendiente de verificaci&oacute;n por el owner</strong> la fecha de
        renovaci&oacute;n del Acuerdo de Google Workspace que rija la cuenta y la confirmaci&oacute;n de que el texto
        capturado por huella es el que esa cuenta tiene incorporado o aceptado. Si el texto del CDPA cambia, este
        Anexo se actualiza</td>
        <td>Si: el &sect;6.2 del CDPA (Return or Deletion When Term Ends) obliga a que el Cliente instruya a Google a
        eliminar todos los datos restantes, incluidas las copias existentes, al terminar el T&eacute;rmino, con un
        per&iacute;odo de recuperaci&oacute;n de hasta treinta (30) d&iacute;as. El Encargado instruye la
        devoluci&oacute;n y la supresi&oacute;n de los datos del canal y responde por el subencargado en los mismos
        t&eacute;rminos en que responde por s&iacute; mismo. <strong>El CDPA no fija un plazo de conservaci&oacute;n
        de los mensajes en el buz&oacute;n del proveedor</strong>, y este Anexo no le atribuye uno</td>
        <td><strong>Parcial y condicionado.</strong> Son exigibles en todo caso el &sect;7.4 (Compliance
        Certifications and SOC Reports), el &sect;7.5.1 (informes SOC) y el &sect;7.5.2(c) (revisi&oacute;n de la
        documentaci&oacute;n de seguridad). <strong>El derecho de auditor&iacute;a del Cliente del &sect;7.5.2(a), con
        auditor independiente nombrado por el Cliente, est&aacute; condicionado a que se aplique la Ley
        Europea</strong>, de modo que para esta cuenta, que no est&aacute; sujeta al Reglamento (UE) 2016/679, ese
        derecho no se activa por s&iacute; solo. El &sect;7.1 y el Anexo 2 del instrumento obligan a Google a las
        medidas de seguridad que ah&iacute; se describen. <strong>Lo que el Encargado puede invocar es lo que el CDPA
        le atribuye en su condici&oacute;n de Cliente</strong>, incluido el deber de reenviar al controlador las
        notificaciones de los &sect;5.2.2, &sect;7.2.1, &sect;9.2.1 y &sect;11.4 (&sect;5.1.2(b)); no se atribuye a
        Google un derecho de auditor&iacute;a del Cliente que el propio instrumento condiciona</td>
      </tr>
```

## A.2 Los tres párrafos del §4 del Anexo de Nube v1.4

**A.2.1 — Párrafo introductorio del §4** (reemplaza las líneas 242-254; absorbe y elimina la línea huérfana de
0.12):

```html
  <p>El Responsable conoce y autoriza los siguientes proveedores externos, con las obligaciones de este Anexo.
  La columna de rol describe los papeles documentados. <strong>En el caso de Google, el papel lo determinan la
  operaci&oacute;n concreta y el v&iacute;nculo contractual:</strong> con la cuenta empresarial de Google Workspace
  vinculada por el Cloud Data Processing Addendum (CDPA), Google queda contractualmente obligado a tratar los datos
  del cliente como procesado y, <strong>mientras el CDPA este vigente y aplicable a la cuenta del Encargado</strong>,
  interviene como <strong>Encargado</strong> de los datos del servicio de correo, que este Anexo designa como
  <strong>Subencargado</strong>. La designaci&oacute;n de processor del &sect;5.1.1(b) del CDPA est&aacute;
  formulada por Google <strong>bajo la condici&oacute;n de que se aplique la ley europea</strong>; para una cuenta
  fuera de EMEA rige el &sect;5.1.3 del instrumento, y siguen siendo exigibles las obligaciones contractuales del
  CDPA que este Anexo cita. Por eso la redacci&oacute;n es condicional y no absoluta. La ficha de Google de la tabla
  siguiente documenta ese papel y su evidencia, y remite al &sect;5 (&laquo;Proveedores externos y
  subencargados&raquo;) del Anexo de Encargo versi&oacute;n 2026-11-12, que es el instrumento bilateral que lo
  determina:</p>
```

**A.2.2 — Párrafo de cierre del §4** (reemplaza las líneas 336-348):

```html
  <p>El Encargado notifica cualquier cambio de proveedor externo y el Responsable puede oponerse. La
  clasificaci&oacute;n jur&iacute;dica de cada operaci&oacute;n (transmisi&oacute;n, transferencia internacional o
  tratamiento por cuenta propia del proveedor) depende del papel concreto que ese proveedor desempe&ntilde;a en cada
  operaci&oacute;n y de las condiciones que le aplican, y no se presume por el solo hecho de estar en el exterior. En
  el flujo de correo, el papel de Google lo determinan la operaci&oacute;n concreta <strong>y</strong> el v&iacute;nculo
  contractual: con la cuenta empresarial de Google Workspace y el CDPA vigente y aplicable a la cuenta, Google
  trata los datos del cliente como procesado; sin esa condici&oacute;n, este Anexo no afirma ese papel. En la
  operaci&oacute;n descrita, y <strong>mientras el CDPA este vigente y aplicable a la cuenta del Encargado</strong>,
  Google LLC interviene como <strong>Encargado (Subencargado)</strong> de los datos del servicio de correo y el flujo
  constituye una <strong>transmisi&oacute;n internacional a un Encargado</strong> (art&iacute;culo 3, numeral 5, del
  Decreto 1377 de 2013), que se rige por el art&iacute;culo 24, numeral 2, y el art&iacute;culo 25 del mismo
  Decreto, con el CDPA y el Anexo de Encargo versi&oacute;n 2026-11-12 como base del v&iacute;nculo contractual con el
  proveedor. <strong>En consecuencia, en esta operaci&oacute;n no se activa la prohibici&oacute;n de transferencia del
  art&iacute;culo 26 de la Ley 1581 de 2012</strong>, porque el receptor no es Responsable del tratamiento. El
  numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica <strong>se cita solo como marco sectorial de
  referencia, no como fundamento de esta calificaci&oacute;n</strong>: su contenido y la lista de pa&iacute;ses con
  nivel adecuado de protecci&oacute;n <strong>no fueron verificados</strong> por el abogado matriculado el 13 de
  noviembre de 2026, y la calificaci&oacute;n que este Anexo declara no depende de ellos, porque el art&iacute;culo
  24, numeral 2, y el art&iacute;culo 25 del Decreto 1377 <strong>no condicionan el pa&iacute;s</strong> del
  encargado. <strong>La presencia o la ausencia de un
  DPA no se presume: se declara</strong>, y lo que este Anexo no hace es atribuirle a Google controles que no est&eacute;n
  documentados.</p>
```

**A.2.3 — Párrafo «El uso real del canal y el papel de Google LLC»** (reemplaza las líneas 350-366):

```html
  <p><strong>El uso real del canal y el papel de Google LLC.</strong> El canal de correo del servicio es una
  <strong>cuenta empresarial de Google Workspace</strong>, la <code>kair@gesstiar.com</code>, operada por Google LLC.
  Desde esa cuenta remite el Encargado el c&oacute;digo de verificaci&oacute;n de un solo uso (OTP) y, cuando la
  Empresa no ha configurado una cuenta de env&iacute;o propia en el servicio, el enlace individual de acceso a la
  solicitud de firma y los avisos del servicio. <strong>El v&iacute;nculo con el proveedor es el Cloud Data
  Processing Addendum (Customers)</strong>, el instrumento que Google incorpora a su Acuerdo con el cliente, cuya
  URL can&oacute;nica de Workspace es
  <code>https://admin.google.com/terms/apps/8/1/en/dpa_terms.html</code> y cuyo texto se identifica por su huella
  SHA-256 (SHA-256 del archivo descargado el 9 de noviembre de 2026, 97 831 bytes:
  <code>0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1</code>), porque <strong>el texto oficial
  no declara fecha de versi&oacute;n</strong>; la fecha de efectividad del Addendum es la del &sect;2, esto es, la fecha
  en que el Cliente lo acept&oacute;, que consta el 10 de noviembre de 2026.
  <strong>Mientras el CDPA este vigente y aplicable a la cuenta del Encargado, conforme al &sect;5.1 y al
  &sect;4.3 del instrumento, Google interviene como Encargado (Subencargado) de los datos del servicio de
  correo</strong>, con las obligaciones de seguridad, devoluci&oacute;n y supresi&oacute;n, certificaciones y
  revisiones y subencargados que este Anexo cita, y el Encargado responde por el cumplimiento del subencargado en los
  mismos t&eacute;rminos en que responde por s&iacute; mismo. <strong>Lo que este Anexo declara pendiente son los
  pasos enumerados en el estado declarado de la secci&oacute;n inicial</strong> (la confirmaci&oacute;n de la cuenta y
  de sus alias, la fecha de renovaci&oacute;n del Acuerdo de Google Workspace que rija la cuenta, el env&iacute;o real
  y la revocaci&oacute;n de las credenciales anteriores), no la caracterizaci&oacute;n de la operaci&oacute;n.</p>
```

## A.3 Fila de Google del §5 del Anexo de Encargo nuevo

> Ubicación: `candidatos-v1.4/anexo-encargo-2026-11-12.html`, tabla de 3 columnas, **reemplaza las líneas
> 444-458**.

```html
      <tr>
        <td>Google (Google Workspace)</td>
        <td>El env&iacute;o del c&oacute;digo OTP por correo electr&oacute;nico (SMTP de Google Workspace); el enlace
        de acceso y los avisos del servicio, cuando la empresa no tiene una cuenta de env&iacute;o propia
        configurada en el servicio</td>
        <td>Siempre para el c&oacute;digo OTP y, si la empresa no configur&oacute; cuenta propia, para el enlace y
        los avisos, con la cuenta empresarial de Google Workspace del Encargado. Rol:
        <strong>Encargado (Subencargado por v&iacute;nculo contractual)</strong>, con el Cloud Data Processing
        Addendum (CDPA) de Google como v&iacute;nculo contractual, designaci&oacute;n que produce efectos mientras el
        CDPA est&eacute; vigente y sea aplicable a la cuenta del Encargado (&sect;4.3 y &sect;5.1 del CDPA).
        Instrumento: <em>Cloud Data Processing Addendum (Customers)</em>. URL can&oacute;nica:
        <code>https://admin.google.com/terms/apps/8/1/en/dpa_terms.html</code>. <strong>El texto oficial no declara
        fecha de versi&oacute;n</strong>: se identifica por su huella SHA-256 (97 831 bytes, descargado el 9 de
        noviembre de 2026):
        <code>0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1</code>. Fecha de efectividad del
        Addendum: <strong>10 de noviembre de 2026</strong> (&sect;2 del CDPA: la fecha en que el Cliente acept&oacute;
        el instrumento; aceptaci&oacute;n del administrador documentada con captura de la consola de Workspace)</td>
      </tr>
```

## A.4 Párrafo «Determinación del papel del proveedor de correo (Google LLC)» del §5 del Anexo de Encargo

> Ubicación: `candidatos-v1.4/anexo-encargo-2026-11-12.html`, **reemplaza las líneas 495-523**.

```html
  <p><strong>Determinaci&oacute;n del papel del proveedor de correo (Google LLC).</strong> <strong>La entidad contractual
  se determina por el perfil de pago de la cuenta</strong>, y el perfil de pago real de esta cuenta no est&aacute;
  documentado en el expediente: queda pendiente de confirmaci&oacute;n contra el contrato, y este Anexo nombra a Google
  LLC como la entidad que la tabla de Google asigna a las ubicaciones distintas de EMEA, sin presentarlo como un
  hecho verificado. El flujo descrito incluye
  el correo del destinatario, el enlace individual, el c&oacute;digo OTP y metadatos t&eacute;cnicos; no incluye el
  documento laboral completo, documentos de identidad ni datos sensibles en el correo. El papel del proveedor lo
  determinan la operaci&oacute;n concreta y el v&iacute;nculo contractual: <strong>respecto de los datos del servicio
  de correo, y mientras el Cloud Data Processing Addendum (CDPA) de Google est&eacute; vigente y sea aplicable a la
  cuenta del Encargado, conforme al &sect;5.1 y al &sect;4.3 del instrumento, Google interviene como Encargado
  (Subencargado por v&iacute;nculo contractual)</strong>, con las obligaciones de seguridad (&sect;7.1 y Anexo 2),
  devoluci&oacute;n y supresi&oacute;n (&sect;6.2), certificaciones y revisiones (&sect;7.4 y &sect;7.5) y
  subencargados (&sect;11, cuya lista p&uacute;blica se publica en
  <code>https://workspace.google.com/intl/en/terms/subprocessors/</code>) del CDPA. El CDPA se aplica con
  independencia de si se aplica la ley europea o la no europea; la designaci&oacute;n de Google como processor del
  &sect;5.1.1(b) est&aacute; formulada por Google bajo la condici&oacute;n de que se aplique la ley europea, y para una
  cuenta fuera de EMEA rige el &sect;5.1.3, conforme al cual cada parte cumple las obligaciones que le correspondan
  bajo la ley que le aplique; siguen siendo exigibles las obligaciones contractuales del CDPA que este Anexo cita.
  <strong>Por eso esta determinaci&oacute;n es condicional y no absoluta.</strong> <strong>La operaci&oacute;n es una
  transmisi&oacute;n internacional de datos personales a un Encargado</strong> (art&iacute;culo 3, numeral 5, del
  Decreto 1377 de 2013), <strong>no una transferencia internacional</strong> (art&iacute;culo 3, numeral 4), porque
  Google no es Responsable del tratamiento de esos datos: <strong>en consecuencia no se activa la prohibici&oacute;n
  del art&iacute;culo 26 de la Ley 1581 de 2012</strong>, y el r&eacute;gimen aplicable es el del art&iacute;culo 24,
  numeral 2, y el art&iacute;culo 25 del Decreto 1377 de 2013, con el numeral 3.2 del T&iacute;tulo V de la
  Circular &Uacute;nica <strong>citado solo como marco sectorial de referencia y no como fundamento de esta
  calificaci&oacute;n</strong>: su contenido y la lista de pa&iacute;ses con nivel adecuado de protecci&oacute;n
  <strong>no fueron verificados</strong> por el abogado matriculado el 13 de noviembre de 2026, y esta
  calificaci&oacute;n no depende de ellos, porque el art&iacute;culo 24, numeral 2, y el art&iacute;culo 25 del
  Decreto 1377 <strong>no condicionan el pa&iacute;s</strong> del encargado. Los derechos de revisi&oacute;n y de certificaciones del Cliente del &sect;7.4 y del &sect;7.5, y
  la revisi&oacute;n de la documentaci&oacute;n de seguridad del &sect;7.5.2(c), los ejerce el Encargado, que es el
  Cliente de Google en la cuenta empresarial, y el Encargado responde frente a la Empresa por su resultado;
  <strong>el derecho de auditor&iacute;a del Cliente del &sect;7.5.2(a), con auditor independiente nombrado por el
  Cliente, est&aacute; condicionado a que se aplique la Ley Europea y no se activa por s&iacute; solo para esta
  cuenta</strong>. Los datos de cuenta del administrador de la cuenta de Workspace y la telemetr&iacute;a del servicio
  <strong>no son datos del cliente</strong> que K+AIR trate por cuenta de la Empresa: Google los trata por cuenta
  propia, conforme a sus propios t&eacute;rminos y con su propia base de protecci&oacute;n de datos, y no quedan
  cubiertos por las obligaciones que K+AIR puede invocar contra Google en nombre de la Empresa. La designaci&oacute;n
  de Subencargado queda condicionada a la verificaci&oacute;n de la vigencia y de la aplicabilidad del CDPA para la
  cuenta del Encargado, que se declara pendiente en esta secci&oacute;n.</p>
```

## A.5 Línea de opinión del abogado (Anexo de Nube v1.4)

```html
  <p><strong>Opini&oacute;n jur&iacute;dica del asesor legal de K+AIR (determinaci&oacute;n de L1, fila J6 del
  checklist del abogado, 12 de noviembre de 2026).</strong> La operaci&oacute;n de correo descrita en esta secci&oacute;n
  es una <strong>transmisi&oacute;n internacional de datos personales a un Encargado</strong> (art&iacute;culo 3,
  numeral 5, del Decreto 1377 de 2013): Google trata por cuenta del Responsable, con instrucciones del Encargado y un
  v&iacute;nculo contractual que es el Cloud Data Processing Addendum, de modo que <strong>no se configura una
  transferencia internacional a los efectos del art&iacute;culo 26 de la Ley 1581 de 2012</strong>, y el r&eacute;gimen
  aplicable es el del art&iacute;culo 24, numeral 2, y el art&iacute;culo 25 del Decreto 1377 de 2013, con el numeral
  3.2 del T&iacute;tulo V de la Circular &Uacute;nica de la SIC <strong>citado &uacute;nicamente como marco sectorial
  de referencia y pendiente de verificaci&oacute;n</strong>, porque su contenido y la lista de pa&iacute;ses con nivel
  adecuado de protecci&oacute;n no fueron verificados por el abogado matriculado el 13 de noviembre de 2026 y la
  calificaci&oacute;n que este Anexo hace no depende de ellos. Los datos de cuenta del
  administrador de Workspace y la telemetr&iacute;a del servicio no son datos del cliente: Google los trata por cuenta
  propia y no quedan cubiertos por las obligaciones que K+AIR puede invocar en nombre de la Empresa. Esta  opini&oacute;n se apoya en el texto oficial del CDPA descargado el 9 de noviembre de 2026 y verificado el 12 de
  noviembre de 2026 (SHA-256
  <code>0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1</code>), en la evidencia de aceptaci&oacute;n
  del administrador del 10 de noviembre de 2026 y en las fuentes normativas colombianas citadas en la secci&oacute;n 11.
  <strong>El p&aacute;rrafo siguiente declara la revisi&oacute;n del abogado matriculado del 13 de noviembre de 2026 y qu&eacute; parte de
  esta redacci&oacute;n cambia por efecto de ella.</strong>
  <strong>No sustituye la validaci&oacute;n de un abogado matriculado, no habilita el uso del canal para datos que
  aqu&iacute; no se declaran, y no habilita ning&uacute;n uso del canal que no est&eacute; en la secci&oacute;n 4.</strong></p>
```

---

# ANEXO B — Pasajes que quedan incoherentes si no se actualizan

> Ubicación exacta, texto literal **actual** y texto literal **propuesto**. Todos los archivos son de
> `sgsst-electron-app/docs/gestion-humana/firma-electronica/candidatos-v1.4/`.

## B.1 §3 del Anexo de Nube v1.4 (líneas 186-196) — clasificación del flujo

**Texto literal ACTUAL** (líneas 186-196):

```html
  <strong>El proveedor del canal de correo es Google LLC</strong>, con sede en Estados Unidos:
  el env&iacute;o se produce contra los servidores de Google en ese pa&iacute;s y, <strong>mientras el CDPA este
  vigente y aplicable a la cuenta del Encargado</strong>, Google interviene como <strong>proveedor contractual
  encargado (Subencargado)</strong> de los datos del servicio de correo, conforme al &sect;5.1 y al &sect;4.3 del
  Cloud Data Processing Addendum (CDPA) que se describe en el &sect;4 de este Anexo. <strong>La transferencia
  internacional no desaparece por tener DPA:</strong> el &sect;10.1 del CDPA permite que los datos se procesen en
  cualquier pa&iacute;s donde Google o sus subencargados tengan instalaciones, de modo que el env&iacute;a sigue
  constituyendo una <strong>transferencia internacional a Estados Unidos</strong>, pa&iacute;s con nivel adecuado de
  protecci&oacute;n (numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica), y sigue rigiendo el art&iacute;culo
  26 de la Ley 1581 de 2012, con la base y las obligaciones que ese r&eacute;gimen impone a la Empresa como
  Responsable. <strong>Los datos del correo y los datos de cuenta o de teletr&iacute;a de Google son dos &aacute;mbitos
  distintos:</strong> los datos de la cuenta del administrador de Workspace y la teletr&iacute;a del servicio no
  forman parte de los datos del cliente que K+AIR trata por cuenta de la Empresa; esos los trata Google por cuenta
  propia, conforme a sus propios t&eacute;rminos y con su propia base de protecci&oacute;n de datos, y <strong>quedan
  fuera de las obligaciones que K+AIR puede invocar contra Google en nombre de la Empresa</strong>.
```

**Texto literal PROPUESTO:**

```html
  <strong>El proveedor del canal de correo es Google LLC</strong>, con sede en Estados Unidos:
  el env&iacute;o se produce contra los servidores de Google en ese pa&iacute;s y, <strong>mientras el CDPA este
  vigente y aplicable a la cuenta del Encargado</strong>, Google interviene como <strong>proveedor contractual
  encargado (Subencargado)</strong> de los datos del servicio de correo, conforme al &sect;5.1 y al &sect;4.3 del
  Cloud Data Processing Addendum (CDPA) que se describe en el &sect;4 de este Anexo. <strong>La comunicaci&oacute;n al
  exterior es una transmisi&oacute;n internacional a un Encargado:</strong> el &sect;10.1 del CDPA permite que los
  datos del cliente se procesen en cualquier pa&iacute;s donde Google o sus subencargados tengan instalaciones, y
  como Google trata esos datos por cuenta del Responsable, con instrucciones del Encargado, la operaci&oacute;n es una
  <strong>transmisi&oacute;n internacional de datos personales a un Encargado</strong> (art&iacute;culo 3, numeral 5,
  del Decreto 1377 de 2013), <strong>no una transferencia internacional</strong> (art&iacute;culo 3, numeral 4):
  <strong>en consecuencia no se activa el art&iacute;culo 26 de la Ley 1581 de 2012</strong> y el r&eacute;gimen
  aplicable es el del art&iacute;culo 24, numeral 2, y el art&iacute;culo 25 del Decreto 1377 de 2013, con el numeral
  3.2 del T&iacute;tulo V de la Circular &Uacute;nica <strong>citado solo como marco sectorial de referencia y
  pendiente de verificaci&oacute;n</strong> (el abogado matriculado no lo verific&oacute; el 13 de noviembre de
  2026): la calificaci&oacute;n que este Anexo declara no depende de &eacute;l, porque el art&iacute;culo 24,
  numeral 2, y el art&iacute;culo 25 del Decreto 1377 no condicionan el pa&iacute;s del encargado.
  <strong>Los datos del correo y los datos de cuenta o de teletr&iacute;a de Google son dos &aacute;mbitos
  distintos:</strong> los datos de la cuenta del administrador de Workspace y la teletr&iacute;a del servicio no
  forman parte de los datos del cliente que K+AIR trata por cuenta de la Empresa; esos los trata Google por cuenta
  propia, conforme a sus propios t&eacute;rminos y con su propia base de protecci&oacute;n de datos, y <strong>quedan
  fuera de las obligaciones que K+AIR puede invocar contra Google en nombre de la Empresa</strong>.
```

## B.2 §4 del Anexo de Nube v1.4, párrafo «Contrato de transmisión y Normas Corporativas Vinculantes» (líneas 488-507)

**Texto literal ACTUAL** (líneas 488-507, el párrafo completo):

```html
  <p><strong>Contrato de transmisi&oacute;n y Normas Corporativas Vinculantes.</strong> Este Anexo <strong>no crea,
  no declara ni presupone</strong> un contrato de transmisi&oacute;n con Google LLC, y <strong>no declara</strong> la
  aplicaci&oacute;n de Normas Corporativas Vinculantes (art&iacute;culo 27 de la Ley 1581 de 2012) ni ninguna
  exenci&oacute;n a las obligaciones de informaci&oacute;n y autorizaci&oacute;n del Titular. El v&iacute;nculo
  contractual que existe con el proveedor del canal de correo es el <strong>Cloud Data Processing Addendum
  (CDPA)</strong>, que es un acuerdo de tratamiento de datos y no un contrato de transmisi&oacute;n: la transferencia
  internacional sigue rigiendo por el numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica (Estados Unidos con
  nivel adecuado de protecci&oacute;n) y por el art&iacute;culo 26 de la Ley 1581 de 2012, con las obligaciones que
  ese r&eacute;gimen impone a la Empresa como Responsable, y no se le atribuyen a Google obligaciones de Encargado
  que no est&eacute;n en el CDPA.
```

**Texto literal PROPUESTO:**

```html
  <p><strong>Contrato de transmisi&oacute;n y Normas Corporativas Vinculantes.</strong> Este Anexo <strong>no crea ni
  presupone</strong> una exenci&oacute;n de las obligaciones del Responsable, y <strong>no declara</strong> la
  aplicaci&oacute;n de Normas Corporativas Vinculantes (art&iacute;culo 27 de la Ley 1581 de 2012). El v&iacute;nculo
  contractual con el proveedor del canal de correo es el <strong>Cloud Data Processing Addendum (CDPA)</strong>, que es
  el acuerdo de tratamiento de datos de Google con el Encargado, y el Anexo de Encargo versi&oacute;n 2026-11-12 es el
  contrato con la Empresa: entre ambos queda constituida la relaci&oacute;n de <strong>transmisi&oacute;n
  internacional</strong> del art&iacute;culo 24, numeral 2, y del art&iacute;culo 25 del Decreto 1377 de 2013, porque
  Google trata los datos del cliente por cuenta del Responsable y con instrucciones del Encargado;
  <strong>no se trata de una transferencia internacional</strong> (art&iacute;culo 3, numeral 4), de modo que
  <strong>no se activa el art&iacute;culo 26 de la Ley 1581 de 2012</strong>. <strong>Lo que el CDPA s&iacute;
  establece</strong> se declara en el &sect;4 de este Anexo: el papel de Subencargado del proveedor, mientras el CDPA
  est&eacute; vigente y sea aplicable a la cuenta del Encargado, y las obligaciones de seguridad (&sect;7.1),
  devoluci&oacute;n y supresi&oacute;n (&sect;6.2), certificaciones y revisiones (&sect;7.4, &sect;7.5 y
  &sect;7.5.2(c)) y subencargados (&sect;11) que le aplican. <strong>El numeral 3.2 del T&iacute;tulo V de la
  Circular &Uacute;nica (Estados Unidos con nivel adecuado de protecci&oacute;n) se cita solo como marco sectorial de
  referencia, no como fundamento</strong>: su contenido no fue verificado por el abogado matriculado el 13 de noviembre
  de 2026, y <strong>la calificaci&oacute;n de este Anexo no depende de &eacute;l</strong>, porque el art&iacute;culo 24,
  numeral 2, y el art&iacute;culo 25 del Decreto 1377 no condicionan el pa&iacute;s del encargado. <strong>Lo que
  queda pendiente, y lo confirm&oacute; un abogado matriculado, es si subsiste alguna exigencia de medidas
  apropiadas y efectivas a cargo de la Empresa como Responsable</strong>: hasta ese pronunciamiento este Anexo no
  afirma que exista ni que no exista. A Google no se le atribuyen obligaciones de Encargado que no est&eacute;n en el
  CDPA. <strong>Si el CDPA dejara de estar vigente o de ser aplicable a la cuenta, o si el proveedor o el servicio
  cambiaran, este Anexo se actualiza</strong>: en ese caso se declaran el proveedor, el v&iacute;nculo contractual, los
  datos, los pa&iacute;ses, los subencargados y las cl&aacute;usulas de devoluci&oacute;n, supresi&oacute;n y
  auditor&iacute;a que correspondan, y el papel de cada proveedor se reeval&uacute;a antes de que ese canal se use.</p>
```

> **Corrección del rango (13-nov-2026).** El rango de este bloque era **488-496** y dejaba fuera las
> líneas 497 a 507 del texto base. El resultado era un **párrafo roto con un fragmento duplicado** en la v1.4
> candidata («… que no están en el CDPA.» aparecía dos veces seguidas), porque el texto propuesto termina en
> «… que no están en el CDPA.» y el texto base continuaba con «<strong>Lo que el CDPA sí establece</strong>…».
> El rango passa a ser **488-507**, que es el párrafo completo, y el texto propuesto de arriba **incorpora** las
> frases del texto base que quedaban huérfanas («Lo que el CDPA sí establece…», «Queda por precisar, y lo
> confirma el abogado…», «Si el CDPA dejara de estar vigente…»), corregidas según el escrito del abogado
> matriculado del 13-nov-2026.

## B.3 §11 del Anexo de Nube v1.4, «Referencias normativas» (líneas 885-897) y viñeta del CDPA (líneas 903-915)

**Texto literal ACTUAL** (líneas 885-897):

```html
  <h2>11. Referencias normativas</h2>
  <ul>
    <li>Ley 1581 de 2012, art&iacute;culo 15.1 (traslado del reclamo), art&iacute;culos 14 y 15 (plazos de respuesta),
    art&iacute;culo 18(k) (comunicaci&oacute;n de incidentes), art&iacute;culo 26 (transferencia internacional) y
    art&iacute;culo 27 (normas corporativas vinculantes).</li>
    <li>Decreto 1072 de 2015, art&iacute;culo 2.2.4.6.13 (plazos de conservaci&oacute;n de los registros del SG-SST).</li>
    <li>Decreto 1074 de 2015, art&iacute;culos 2.2.2.25.5.1 y 2.2.2.25.5.2 (transmisi&oacute;n internacional y
    contrato de transmisi&oacute;n) y numeral 8.6 del
    Acuerdo sobre el uso del mecanismo de firma electr&oacute;nica.</li>
```

**Texto literal PROPUESTO:**

```html
  <h2>11. Referencias normativas</h2>
  <ul>
    <li>Ley 1581 de 2012, art&iacute;culo 15.1 (traslado del reclamo), art&iacute;culos 14 y 15 (plazos de respuesta),
    art&iacute;culo 18(k) (comunicaci&oacute;n de incidentes), art&iacute;culo 26 (prohibici&oacute;n de    transferencia a pa&iacute;ses sin nivel adecuado de protecci&oacute;n, que en la operaci&oacute;n de correo de la
    secci&oacute;n 4 no se activa por no tratarse de una transferencia) y art&iacute;culo 27 (normas corporativas
    vinculantes).</li>
    <li>Decreto 1072 de 2015, art&iacute;culo 2.2.4.6.13 (plazos de conservaci&oacute;n de los registros del SG-SST).</li>
    <li>Decreto 1377 de 2013, art&iacute;culo 3, numerales 4 y 5 (transferencia y transmisi&oacute;n internacional),
    art&iacute;culo 24, numeral 2 (transmisi&oacute;n internacional entre el Responsable y el Encargado) y
    art&iacute;culo 25 (contenido m&iacute;nimo del contrato de transmisi&oacute;n y obligaciones del Encargado).</li>
    <li>Decreto 1074 de 2015, art&iacute;culos 2.2.2.25.5.1 y 2.2.2.25.5.2 (transmisi&oacute;n internacional y
    contrato de transmisi&oacute;n) y numeral 8.6 del
    Acuerdo sobre el uso del mecanismo de firma electr&oacute;nica.</li>
    <li>Circular &Uacute;nica de la SIC, T&iacute;tulo V, numeral 3.2 (pa&iacute;ses con nivel adecuado de protecci&oacute;n,
    con Estados Unidos incluido) y sus par&aacute;grafos primero (responsabilidad demostrada), tercero (el simple
    tr&aacute;nsito transfronterizo no comporta una transferencia) y cuarto (la transmisi&oacute;n a pa&iacute;ses con
    nivel adecuado, en los t&eacute;rminos de la transferencia). <strong>Se cita como marco sectorial de referencia y
    no como fundamento de la calificaci&oacute;n que este Anexo hace: el contenido de este numeral y de la lista de
    pa&iacute;ses con nivel adecuado de protecci&oacute;n no fue verificado por el abogado matriculado el 13 de
    noviembre de 2026</strong>.</li>
  </ul>
```

> **Por qué vuelve la viñeta del Título V (13-nov-2026).** El texto propuesto de este bloque sustitu&iacute;a las
> l&iacute;neas 885-897 del texto base, entre las cuales estaba la viñeta del num&eacute;ral 3.2 del T&iacute;tulo V, y
> esa viñeta **qued&oacute; fuera** de la lista de referencias de la v1.4 mientras el cuerpo del Anexo la citaba como
> marco de referencia: una contradicci&oacute;n interna. Con el escrito del abogado matriculado del 13-nov-2026, que
> **no verific&oacute;** ese numeral, la correcci&oacute;n no es callar la norma sino **citarla con su salvedad**: queda
> en la lista de referencias y marcada como marco sectorial de referencia, no como fundamento.

**Texto literal ACTUAL** (viñeta del CDPA, líneas 903-915, fragmento a corregir):

```html
    <li>Cloud Data Processing Addendum (Customers) (CDPA) de Google, el instrumento de tratamiento de datos que
    Google incorpora a su Acuerdo con el cliente: URL can&oacute;nica de Workspace
    <code>https://admin.google.com/terms/apps/8/1/en/dpa_terms.html</code> (espejo en Cloud:
    <code>https://cloud.google.com/terms/data-processing-addendum</code>); texto vigente del <strong>30 de octubre de
    2026</strong>; SHA-256 del archivo descargado el 9 de noviembre de 2026 (97 831 bytes):
    <code>0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1</code>. Secciones que este Anexo cita: &sect;1 (Commencement), &sect;2 (Definiciones),
    &sect;4.3 (aplicaci&oacute;n del Addendum), &sect;5.1 y &sect;5.1.1(b) y &sect;5.1.3 (papel del proveedor),
    &sect;6.2 (devoluci&oacute;n o supresi&oacute;n al terminar el T&eacute;rmino), &sect;7.1 y Anexo 2 (medidas de
    seguridad), &sect;7.4 (Compliance Certifications and SOC Reports), &sect;7.5 (Reviews and Audits of Compliance)
    y &sect;7.5.2 (derechos de auditor&iacute;a del Cliente), &sect;10.1 (Data Storage and Processing Facilities),
    &sect;10.2 y &sect;10.3 (Restricted European Transfers y Certification by Non-EMEA Customers) y &sect;11
    (Subprocessors). Lista p&uacute;blica de subencargados:
    <code>https://workspace.google.com/intl/en/terms/subprocessors/</code>.</li>
```

**Texto literal PROPUESTO** (desde «…que es la fecha en que el Cliente lo acept&oacute; (&sect;2 del» hasta el cierre
del `</li>`):

```html
    instrumento), aceptaci&oacute;n documentada con captura de la consola de Workspace. Secciones que este Anexo cita: &sect;1 (Commencement), &sect;2 (Definiciones),
    &sect;4.3 (aplicaci&oacute;n del Addendum), &sect;5.1 y &sect;5.1.1(b) y &sect;5.1.2 y &sect;5.1.3 (papel del
    proveedor), &sect;5.2.1 (instrucciones del Cliente), &sect;6.2 (devoluci&oacute;n o supresi&oacute;n al terminar el
    T&eacute;rmino), &sect;7.1 y Anexo 2 (medidas de
    seguridad), &sect;7.2.1 (notificaci&oacute;n de incidentes, sin plazo fijo), &sect;7.4 (Compliance Certifications and SOC Reports), &sect;7.5 (Reviews and Audits of Compliance)
    y &sect;7.5.2 (derechos de revisi&oacute;n; el derecho de auditor&iacute;a del &sect;7.5.2(a) est&aacute;
    condicionado a la aplicaci&oacute;n de la Ley Europea), &sect;10.1 (Data Storage and Processing Facilities),
    &sect;10.2 y &sect;10.3 (Restricted European Transfers y Certification by Non-EMEA Customers) y &sect;11
    (Subprocessors). Lista p&uacute;blica de subencargados:
    <code>https://workspace.google.com/intl/en/terms/subprocessors/</code>.</li>
```

## B.4 §5 del Anexo de Encargo 2026-11-12, líneas 469-494

### Texto literal ACTUAL (líneas 469-494, tres párrafos)

```html
  <p><strong>Tratamiento relacionado con las comunicaciones de firma.</strong> Para ejecutar el proceso de firma
  electr&oacute;nica, Gesstiar S.A.S. utiliza como servicio de env&iacute;o de correo una cuenta empresarial de
  Google Workspace, vinculada con el Cloud Data Processing Addendum (CDPA) de Google, para el c&oacute;digo OTP y,
  cuando la empresa no tiene una cuenta de env&iacute;o propia configurada en el servicio, tambi&eacute;n para el
  enlace de acceso y los avisos del procedimiento. El c&oacute;digo OTP sale siempre de la cuenta del Encargado,
  porque es el dato de creaci&oacute;n de la firma y su custodia no puede depender de la empresa. En ese flujo se
  tratan la direcci&oacute;n del destinatario, el contenido del mensaje y los metadatos del env&iacute;o (fecha y hora,
  direcci&oacute;n IP de origen e identificador del mensaje); el documento firmado y la Constancia <strong>no</strong>
  viajan en el correo, se obtienen desde la aplicaci&oacute;n. El proveedor puede tratar esa informaci&oacute;n
  conforme al CDPA y a las condiciones del servicio. Cuando el enlace sale de la cuenta de la Empresa y el
  c&oacute;digo de la cuenta del Encargado, se usan cuentas remitentes distintas; ello no demuestra por s&iacute; solo
  que los destinatarios reciban los mensajes en buzones independientes.</p>
  <p>La conservaci&oacute;n que el proveedor del servicio de correo haga de los mensajes es independiente de los
  plazos que la empresa y el Encargado aplican a los documentos y a las evidencias: el plazo de la tabla de
  retenci&oacute;n documental de la empresa no controla la permanencia de una copia en el buz&oacute;n del
  proveedor, ni la eliminaci&oacute;n de un mensaje en los sistemas del Encargado implica su eliminaci&oacute;n
  simult&aacute;nea en los del proveedor. La devoluci&oacute;n y la supresi&oacute;n de esos datos se rigen por el
  &sect;6.2 del CDPA, que regula la eliminaci&oacute;n de todos los datos restantes del cliente, incluidas las copias
  existentes, al terminar el T&eacute;rmino, por instrucci&oacute;n del Cliente, con un per&iacute;odo de
  recuperaci&oacute;n de hasta treinta (30) d&iacute;as; el Encargado instruye esa eliminaci&oacute;n a Google y
  responde frente a la Empresa por su resultado. El Encargado no atribuye a Google un plazo contractual de
  conservaci&oacute;n espec&iacute;fico que no haya verificado documentalmente.</p>
  <p>La empresa cliente declara conocer esta configuraci&oacute;n t&eacute;cnica, el v&iacute;nculo contractual
  del canal de correo con el proveedor y los l&iacute;mites de ese v&iacute;nculo, sin que su aceptaci&oacute;n cierre
  la calificaci&oacute;n jur&iacute;dica del flujo ni sustituya los instrumentos que legalmente resulten
  exigibles.</p>
```

### Texto literal PROPUESTO

**Párrafo 1 (reemplaza las líneas 469-480)** — unifica el conjunto de datos con el declarado en el §4 del Anexo
de Nube, declara el papel y la clasificación:

```html
  <p><strong>Tratamiento relacionado con las comunicaciones de firma.</strong> Para ejecutar el proceso de firma
  electr&oacute;nica, Gesstiar S.A.S. utiliza como servicio de env&iacute;o de correo una cuenta empresarial de
  Google Workspace, vinculada con el Cloud Data Processing Addendum (CDPA) de Google, para el c&oacute;digo OTP y,
  cuando la empresa no tiene una cuenta de env&iacute;o propia configurada en el servicio, tambi&eacute;n para el
  enlace de acceso y los avisos del procedimiento. El c&oacute;digo OTP sale siempre de la cuenta del Encargado,
  porque es el dato de creaci&oacute;n de la firma y su custodia no puede depender de la empresa.
  <strong>Por ese canal salen, y solo esos, los datos que declara el &sect;4 del Anexo de Nube:</strong> (i) el
  correo del destinatario; (ii) la informaci&oacute;n t&eacute;cnica del env&iacute;o, es decir la fecha, la hora y
  los metadatos t&eacute;cnicos del mensaje; (iii) el c&oacute;digo de verificaci&oacute;n de un solo uso (OTP); y
  (iv) el enlace individual de acceso a la solicitud de firma. <strong>El cuerpo del mensaje se limita al c&oacute;digo
  o al enlace, sin otro contenido</strong>, y la direcci&oacute;n IP de origen es la del servidor del Encargado, que
  no es un dato de la Empresa ni del destinatario; el documento firmado y la Constancia <strong>no</strong>
  viajan en el correo, se obtienen desde la aplicaci&oacute;n. <strong>En esta operaci&oacute;n Google interviene como
  Encargado (Subencargado por v&iacute;nculo contractual)</strong>, trata los datos del cliente por cuenta del
  Responsable y con instrucciones del Encargado, y en consecuencia <strong>la comunicaci&oacute;n al exterior es una
  transmisi&oacute;n internacional de datos personales a un Encargado</strong> (art&iacute;culo 3, numeral 5, del
  Decreto 1377 de 2013), <strong>no una transferencia internacional</strong>, y <strong>no se activa el art&iacute;culo
  26 de la Ley 1581 de 2012</strong>. Cuando el enlace sale de la cuenta de la Empresa y el c&oacute;digo de la cuenta
  del Encargado, se usan cuentas remitentes distintas; ello no demuestra por s&iacute; solo que los destinatarios
  reciban los mensajes en buzones independientes.</p>
```

**Párrafo 2 (líneas 481-490)** — sin cambio de fondo, con una precisión que evita prometer un plazo que el CDPA no
fija:

```html
  <p>La conservaci&oacute;n que el proveedor del servicio de correo haga de los mensajes es independiente de los
  plazos que la empresa y el Encargado aplican a los documentos y a las evidencias: el plazo de la tabla de
  retenci&oacute;n documental de la empresa no controla la permanencia de una copia en el buz&oacute;n del
  proveedor, ni la eliminaci&oacute;n de un mensaje en los sistemas del Encargado implica su eliminaci&oacute;n
  simult&aacute;nea en los del proveedor. La devoluci&oacute;n y la supresi&oacute;n de esos datos se rigen por el
  &sect;6.2 del CDPA, que regula la eliminaci&oacute;n de todos los datos restantes del cliente, incluidas las copias
  existentes, al terminar el T&eacute;rmino, por instrucci&oacute;n del Cliente, con un per&iacute;odo de
  recuperaci&oacute;n de hasta treinta (30) d&iacute;as; el Encargado instruye esa eliminaci&oacute;n a Google y
  responde frente a la Empresa por su resultado. <strong>El &sect;6.2 opera al terminar el T&eacute;rmino y no fija
  un plazo de conservaci&oacute;n de los mensajes durante la vigencia del servicio</strong>. El Encargado no atribuye a
  Google un plazo contractual de
  conservaci&oacute;n espec&iacute;fico que no haya verificado documentalmente.</p>
```

**Párrafo 3 (líneas 491-494)** — sin cambios. Sigue siendo exacto después de la determinación: la aceptación de
la Empresa no cierra la calificación jurídica del flujo ni sustituye los instrumentos legalmente exigibles.

```html
  <p>La empresa cliente declara conocer esta configuraci&oacute;n t&eacute;cnica, el v&iacute;nculo contractual
  del canal de correo con el proveedor y los l&iacute;mites de ese v&iacute;nculo, sin que su aceptaci&oacute;n cierre
  la calificaci&oacute;n jur&iacute;dica del flujo ni sustituya los instrumentos que legalmente resulten
  exigibles.</p>
```

## B.5 §5 del Anexo de Encargo 2026-11-12, líneas 422-424

### Texto literal ACTUAL (con contexto mínimo, líneas 420-424)

```html
    <strong>mientras el CDPA est&eacute; vigente y sea aplicable a la cuenta del Encargado</strong>, conforme al
    &sect;5.1 y al &sect;4.3 del instrumento. El Encargado responde por el cumplimiento del subencargado en los
    mismos t&eacute;rminos en que responde por s&iacute; mismo. La secci&oacute;n 5 de este Anexo declara el papel del
    proveedor, el pa&iacute;s, el tratamiento de la transferencia internacional y las cl&aacute;usulas del CDPA que
    gobiernan la devoluci&oacute;n, la supresi&oacute;n, la auditor&iacute;a y los subencargados.</li>
```

### Texto literal PROPUESTO

```html
    <strong>mientras el CDPA est&eacute; vigente y sea aplicable a la cuenta del Encargado</strong>, conforme al
    &sect;5.1 y al &sect;4.3 del instrumento. El Encargado responde por el cumplimiento del subencargado en los
    mismos t&eacute;rminos en que responde por s&iacute; mismo. La secci&oacute;n 5 de este Anexo declara el papel del
    proveedor, el pa&iacute;s, el tratamiento de la transmisi&oacute;n internacional y las cl&aacute;usulas del CDPA que
    gobiernan la devoluci&oacute;n, la supresi&oacute;n, las certificaciones y revisiones y los subencargados.</li>
```

**Dos cambios en una línea:** «transferencia internacional» → «transmisión internacional» (corrección 0.5 en
fondo) y «la auditoría» → «las certificaciones y revisiones» (corrección 0.6: el derecho de auditoría del
§7.5.2(a) está condicionado a la Ley Europea, de modo que lo que el CDPA sí atribuye sin condición es lo de
§§7.4, 7.5.1 y 7.5.2(c)).

## B.6 Cabecera, meta y remisiones de versión del Anexo de Encargo 2026-11-12

### B.6.1 Meta (línea 8)

**ACTUAL:**

```html
<meta name="version" content="2026-11-11">
```

**PROPUESTO:**

```html
<meta name="version" content="2026-11-12">
```

### B.6.2 Cabecera (línea 34)

**ACTUAL:**

```html
  <p class="fecha">&Uacute;ltima actualizaci&oacute;n: 11 de noviembre de 2026 &middot; Versi&oacute;n 2026-11-11</p>
```

**PROPUESTO:**

```html
  <p class="fecha">&Uacute;ltima actualizaci&oacute;n: 12 de noviembre de 2026 &middot; Versi&oacute;n 2026-11-12</p>
```

### B.6.3 Constancia de versión del §12 (líneas 886-893)

**ACTUAL:**

```html
  <p><strong>Constancia de la versi&oacute;n.</strong> Este Anexo de Encargo es la versi&oacute;n
  <strong>2026-11-11</strong> y es una versi&oacute;n nueva entre las mismas partes: desde su firma por ambas, deja
  sin efecto la versi&oacute;n <strong>2026-11-06</strong> del Anexo de Encargo de Tratamiento de Datos Personales
  del servicio de firma electr&oacute;nica K+AIR, suscrita y contrafirmada el 7 de noviembre de 2026. Su eficacia
  est&aacute; sujeta a la suscripci&oacute;n de la Empresa y a la contrafirma del Encargado; mientras no ocurran, este
  texto no produce efectos por s&iacute; solo ni habilita a ninguna Empresa. La sustituci&oacute;n no tiene efectos
  retroactivos: la evidencia del proceso de firma ya generada bajo la versi&oacute;n anterior se conserva y se le
  aplica el mismo plazo de conservaci&oacute;n que le corresponde por el numeral 8.6 del Acuerdo.</p>
```

**PROPUESTO:**

```html
  <p><strong>Constancia de la versi&oacute;n.</strong> Este Anexo de Encargo es la versi&oacute;n
  <strong>2026-11-12</strong> y es una versi&oacute;n nueva entre las mismas partes: desde su firma por ambas, deja
  sin efecto la versi&oacute;n <strong>2026-11-11</strong> del Anexo de Encargo de Tratamiento de Datos Personales
  del servicio de firma electr&oacute;nica K+AIR, suscrita y contrafirmada el 12 de noviembre de 2026; la versi&oacute;n
  <strong>2026-11-06</strong>, suscrita y contrafirmada el 7 de noviembre de 2026, queda como antecedente hist&oacute;rico.
  Su eficacia
  est&aacute; sujeta a la suscripci&oacute;n de la Empresa y a la contrafirma del Encargado; mientras no ocurran, este
  texto no produce efectos por s&iacute; solo ni habilita a ninguna Empresa. La sustituci&oacute;n no tiene efectos
  retroactivos: la evidencia del proceso de firma ya generada bajo la versi&oacute;n anterior se conserva y se le
  aplica el mismo plazo de conservaci&oacute;n que le corresponde por el numeral 8.6 del Acuerdo.</p>
```

> Base del dato histórico: `legal-readiness.json`, bloque `anexo_encargo.nota` — «El texto vigente quedó suscrito
> por ASEPLUS CARIBE S.A.S. […] y contrafirmado por K+AIR el 12-nov-2026, con acta, huellas y facultad
> acreditada»; la versión 2026-11-06 «queda en `versiones_firmadas` como instrumento anterior».

### B.6.4 Las demás apariciones de «2026-11-11» en el Anexo de Encargo

| Línea | Texto literal ACTUAL (fragmento) | Texto literal PROPUESTO |
|---|---|---|
| 297 | `... contenida en este Anexo de Encargo de Tratamiento de Datos Personales del servicio de firma electr&oacute;nica K+AIR, versi&oacute;n 2026-11-11, fechada el 11 de noviembre de 2026, y en el Acuerdo de uso ...` | `... contenida en este Anexo de Encargo de Tratamiento de Datos Personales del servicio de firma electr&oacute;nica K+AIR, versi&oacute;n 2026-11-12, fechada el 12 de noviembre de 2026, y en el Acuerdo de uso ...` |
| 535 | `... y (ix) la suscripci&oacute;n de esta versi&oacute;n 2026-11-11 del Anexo de Encargo por la Empresa y su contrafirma por el Encargado, a cargo de la Empresa y de Gesstiar S.A.S.` | **Ya resuelto por el literal de B.8.5 (13-nov-2026):** la l&iacute;nea 535 est&aacute; dentro del p&aacute;rrafo «Lo que queda pendiente», que B.8.5 sustituye entero, y el literal nuevo ya dice `2026-11-12`. El motor **no** lleva este fragmento: aplicarlo sobre el literal nuevo lo dejar&iacute;a distinto del texto del dictamen y romper&iacute;a la identidad byte a byte entre el dictamen y el candidato. |
| 574 | `... este Anexo de Encargo en su versi&oacute;n 2026-11-11, cada uno con su suscripci&oacute;n, su contrafirma, su acta y su huella.` | **NO SE CAMBIA.** Es una afirmación histórica: nombra la versión que fue suscrita y contrafirmada el 12-nov-2026. Cambiarla a 2026-11-12 sería una inexactitud. |

### B.6.5 Las remisiones del Anexo de Nube v1.4 que nombran la versión del Encargo

Todas deben apuntar a la versión **2026-11-12** del Anexo de Encargo (instrumento que acompaña a la v1.4):

| Línea del `anexo-nube-v1.4.html` | Texto literal ACTUAL | Texto literal PROPUESTO |
|---|---|---|
| 145 | `Personales version 2026-11-11 y prevalece sobre las cl&aacute;usulas de ese Anexo que contradigan el Servicio,` | `Personales version 2026-11-12 y prevalece sobre las cl&aacute;usulas de ese Anexo que contradigan el Servicio,` |
| 148 | `conforme a la cl&aacute;usula de prevalencia del Anexo de Encargo version 2026-11-11. El alcance son las` | `conforme a la cl&aacute;usula de prevalencia del Anexo de Encargo version 2026-11-12. El alcance son las` |
| 252 | `(&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-11, que es el` | `(&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-12, que es el` (ya resuelto en el párrafo nuevo de A.2.1) |
| 577 | `(&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-11 y en la ficha de` | `(&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-12 y en la ficha de` |
| 812-813 | `<strong>Remisi&oacute;n al Anexo de Encargo version 2026-11-11.</strong> Esta versi&oacute;n 1.3 <strong>remite</strong>` / `al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-11, que es el <strong>instrumento` | `<strong>Remisi&oacute;n al Anexo de Encargo version 2026-11-12.</strong> Esta versi&oacute;n 1.4 <strong>remite</strong>` / `al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-12, que es el <strong>instrumento` |
| 823 | `Anexo de Encargo version 2026-11-11. <strong>Toda modificaci&oacute;n de este Anexo se publica como versi&oacute;n` | `Anexo de Encargo version 2026-11-12. <strong>Toda modificaci&oacute;n de este Anexo se publica como versi&oacute;n` |
| 845 | `disciplina que el registro de la contrafirma del Anexo de Encargo (&sect;12 del Anexo de Encargo version` / `2026-11-11), y queda en la evidencia de suscripci&oacute;n que el servicio registra y en el rastro append-only de la` | `disciplina que el registro de la contrafirma del Anexo de Encargo (&sect;12 del Anexo de Encargo version` / `2026-11-12), y queda en la evidencia de suscripci&oacute;n que el servicio registra y en el rastro append-only de la` |
| 874 | `<strong>se incorpora</strong> al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-11 en lo` | `<strong>se incorpora</strong> al Anexo de Encargo de Tratamiento de Datos Personales version 2026-11-12 en lo` |
| 881 | `del papel del proveedor del canal de correo es la del &sect;5 del Anexo de Encargo version 2026-11-11, que este` | `del papel del proveedor del canal de correo es la del &sect;5 del Anexo de Encargo version 2026-11-12, que este` |

Además, en la línea 846 la frase `Los dos actos de esta versi&oacute;n 1.3 est&aacute;n pendientes` pasa a
`Los dos actos de esta versi&oacute;n 1.4 est&aacute;n pendientes`.

### B.6.6 Advertencia de orden (evita un verde falso)

**El manifiesto no se actualiza antes de la firma.** `legal-readiness.json` registra `anexo_encargo.version:
"2026-11-11"` con su huella `6308b1f7…`, y `anexo_nube.version: "1.3"` con su huella: son los textos
**suscritos**. La versión 2026-11-12 del Encargo y la 1.4 del Nube son **candidatos no suscritos**; cambiar el
manifiesto antes de la firma y de calcular la huella SHA-256 real de los archivos nuevos haría que el gate
describiera un texto que ninguna Empresa ha suscrito. El orden correcto es: aplicar los textos → calcular
huellas → obtener firma y contrafirma → actualizar el manifiesto.

## B.7 Línea huérfana del §4 del Anexo de Nube v1.4 (líneas 253-254)

### Texto literal ACTUAL (líneas 251-254, con la línea huérfana marcada)

```html
  no absoluta. La ficha de Google de la tabla siguiente documenta ese papel y su evidencia, y remite al &sect;5
  (&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo version 2026-11-11, que es el
  instrumento bilateral que lo determina:</p>
  determinado en el &sect;5 del Anexo de Encargo:</p>
```

### Instrucción exacta de eliminación

**Eliminar por completo la línea 254**, es decir la línea completa:

```
  determinado en el &sect;5 del Anexo de Encargo:</p>
```

- **Qué se borra:** el texto `determinado en el &sect;5 del Anexo de Encargo:` **y** el cierre `</p>` que lo acompaña.
- **Qué no se borra:** nada más de ese bloque. La línea 253 (`instrumento bilateral que lo determina:</p>`) permanece,
  porque cierra el párrafo.
- **Por qué:** es el resto huérfano de una versión anterior del párrafo (duplica el cierre que ya está en la línea 253)
  y deja una frase partida después del punto y coma.
- **Dónde queda resuelto:** el párrafo completo se sustituye por el texto de **A.2.1**, que ya cierra con la remisión
  correcta al Anexo de Encargo **versión 2026-11-12**:

```html
  (&laquo;Proveedores externos y subencargados&raquo;) del Anexo de Encargo versi&oacute;n 2026-11-12, que es el
  instrumento bilateral que lo determina:</p>
```

- **Si se prefiere una corrección mínima sin sustituir el párrafo:** borrar solo la línea 254 y cambiar en la línea 252
  `version 2026-11-11` por `versi&oacute;n 2026-11-12`. Pero esa variante **deja en pie** la clasificación de
  transferencia que B.1 corrige, de modo que no es suficiente por sí sola.

---

## 6. Veredicto de cierre de L1

**L1 (fila J6 del checklist del abogado) queda DETERMINADO y CERRADO como determinación escrita.**

La calificación del papel de Google en el canal de correo no queda pendiente de un tercero: es **doble, por
operación** —**Responsable** (art. 3(e) Ley 1581 de 2012) sobre los datos de la cuenta del administrador y sobre
la telemetría del servicio, y **Encargado** (art. 3(d)) sobre los datos del cliente que salen por el canal, donde
«Subencargado» es figura exclusivamente contractual (CDPA §§2 y 5.1.2), no categoría legal—; y la operación es una
**transmisión internacional de datos personales a un Encargado** (art. 3 num. 5 del Decreto 1377 de 2013), **no
una transferencia** (num. 4), por lo que **no se activa la prohibición del art. 26 de la Ley 1581 de 2012** y
rigen el **art. 24 num. 2** y el **art. 25** del Decreto 1377, con el numeral 3.2 del Título V de la Circular
Única (Estados Unidos con nivel adecuado; parágrafo primero: responsabilidad demostrada) como marco de referencia.
La **entidad contractual es Google LLC**, determinada por el **perfil de pago** de la cuenta y no por la lista de
subprocesadores. **P1 está cerrado.** El CDPA se identifica **por huella SHA-256 (`0e1c7294…`, 97 831 B, verificada
el 12-nov-2026) y no por fecha de versión**, y su **fecha de efectividad es el 10-nov-2026** por el §2 (la aceptación
del administrador). El **derecho de auditoría del §7.5.2(a) no se activa** para esta cuenta, por estar condicionado a
la Ley Europea. **Estados Unidos es uno de los países posibles, no el único** (§10.1 del CDPA y Service Specific
Terms §1.3). El **CDPA no fija plazo de 24 h ni de 48 h** para incidentes, y el plazo de 48 h del Anexo de Encargo
es **compromiso propio de K+AIR**.

**Condición de cierre:** las **trece correcciones (0.1 a 0.13)** deben estar incorporadas antes de publicar la v1.4.
Mientras no lo estén, los textos de la v1.4 candidata **se contradicen entre sí** (declaran a Google Encargado y, a
la vez, que «no existe contrato de transmisión»; afirman «transferencia internacional» y, a la vez, la aplicación
del art. 26 frente a la propia calificación del receptor), y esa es exactamente la contradicción que esta
determinación cierra.

**Lo que queda sin verificar, y no impide el cierre:** la **fecha de versión del CDPA** (no declarada por el texto
oficial; se sustituye por huella y fecha de descarga) y la **entidad contractual** (depende del perfil de pago, que
no está documentado en el repo; se confirma con la Order Form o el correo de renovación de Google). Ambos quedan
como **acto del owner** y marcados `⚠️ No verificado` en el expediente.

### Los siete actos del owner (sin cambios respecto de la sección 3.9)

1. **Obtener la Order Form o el correo de renovación de Google** y fijar el nombre de la entidad contractual
   (Google LLC) en el §4 del Anexo de Nube y en el §5 del Anexo de Encargo.
2. **Registrar la fecha de renovación del Acuerdo** de Google Workspace que rija la cuenta, y **re-aceptar el
   CDPA** en la consola si el texto cambia.
3. **Adoptar en el manifiesto** `legal-readiness.json` la corrección de clasificación y de entidad
   (`subencargados.mail_provider.proveedor`, `.pais`, `.transferencia`), **después de la firma y con la huella real
   de los archivos nuevos** (ver B.6.6); sin efecto de máquina: el gate solo lee booleanos y campos de presencia.
4. **Decidir y documentar la evidencia de las medidas** que el Responsable debe poder demostrar (parágrafo primero
   del numeral 3.2), e incorporarla al expediente.
5. **Traducir a la Empresa el preaviso de 30 días y el derecho de oponerse** del §11 del CDPA, para que el derecho
   de oposición que el §4 del Nube le reconoce sea exigible en la práctica.
6. **Cerrar P3** (alias de privacidad, soporte e incidentes) y **P6** (revocación de las credenciales anteriores).
7. **Suscribir y publicar** el Anexo de Nube v1.4 y el Anexo de Encargo 2026-11-12, con sus actas y huellas, y con
   la unificación de versión tratada en B.6.

**No se editó ningún archivo del repositorio.** Con este complemento quedan entregadas, sin repeticiones, las tres
piezas que faltaban de la entrega anterior (cierre de B.3, B.4 a B.7 y el veredicto).

**VEREDICTO: PASS** — determinación de L1 entregada en el formato de 5 secciones con base normativa verificada
(12-nov-2026), trece correcciones con su corrección precisa (la **0.13** del 13-nov-2026, sobre la cita del
art. 3 num. 4 y 5 del Decreto 1377), siete actos del owner, texto literal HTML listo para
pegar, y lista completa de pasajes incoherentes con ubicación, texto actual y texto propuesto. Dos puntos quedan
marcados `⚠️ No verificado` (fecha de versión del CDPA y entidad contractual por perfil de pago) y ninguno bloquea
el cierre.

---

## B.8 Ajustes de la v1.4 que impone el escrito del abogado matriculado del 13-nov-2026

> **Qué es esta sección.** El 13 de noviembre de 2026 un abogado matriculado respondió por escrito a las
> solicitudes S-01, S-02, S-03, S-04 y S-23. Su escrito **no cierra ninguna de esas filas** (no lleva nombre,
> fecha de suscripción ni huella de un documento firmado), pero **confirma el núcleo normativo** de L1 y L4 y
> obliga a **cambiar cinco cosas** en el texto de la v1.4. Esta sección contiene los literales HTML que
> sustituyen a los que quedan afectados.
>
> **Las cinco cosas que cambian:**
>
> 1. **El numeral 3.2 del Título V de la Circular Única y la lista de países con nivel adecuado no fueron
>    verificados.** El abogado los leyó como marco, pero no los confirmó. Pasan a citarse **como marco sectorial
>    de referencia, nunca como fundamento** de la calificación que hacen los Anexos.
> 2. **La condición de que el país sea uno de esos países NO es una exigencia legal.** El art. 24 num. 2 y el
>    art. 25 del Decreto 1377 **no condicionan el país** del encargado. La región US del bucket de Backblaze, y
>    la mención de Estados Unidos en la ficha de Google, quedan como **decisión conservadora de K+AIR**.
> 3. **La transferencia del software a la Empresa sí cae en el supuesto (ii) de la Circular Externa 002 de 2025.**
>    El canal de correo sigue **fuera** de su ámbito literal. El texto anterior solo decía la primera mitad.
> 4. **Los hechos contractuales del CDPA no verificados** (el perfil de pago que fija la entidad contractual, la
>    huella y la efectividad del CDPA, el §7.5.2(a) condicionado a la Ley Europea, el carácter de Estados Unidos
>    como uno de los países posibles y el plazo de 48 horas) quedan **declarados como pendientes de confirmación
>    contra el contrato**.
> 5. **La Circular 002 leída en su literal** es la que está en la base normativa del escrito: sus dos supuestos
>    (i) y (ii), y sus instrucciones 1 a 4.

### B.8.0 Párrafo de revisión del abogado (se inserta después de la línea de opinión, al final del §4)

```html
  <p><strong>Revisi&oacute;n de un abogado matriculado del 13 de noviembre de 2026.</strong> El texto de esta secci&oacute;n
  se revis&oacute; a la luz del escrito de un abogado matriculado, de fecha 13 de noviembre de 2026, que verific&oacute;
  la base normativa en fuente oficial (Ley 1581 de 2012; Decretos 1377 de 2013, 1072 y 1074 de 2015; Circular Externa
  002 de 2025 de la SIC) y confirm&oacute; el n&uacute;cleo de esta determinaci&oacute;n: el doble papel de Google
  (Responsable y Encargado), la transmisi&oacute;n y no la transferencia, y la no activaci&oacute;n del art&iacute;culo
  26 de la Ley 1581 de 2012. <strong>Esa revisi&oacute;n no es una validaci&oacute;n formal</strong>: el escrito no lleva nombre,
  fecha de suscripci&oacute;n ni huella de un documento firmado, y por eso este Anexo no se presenta como ratificado
  por un tercero. <strong>Cuatro puntos de ese escrito cambian la redacci&oacute;n de este Anexo</strong>: (i) el
  numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica y la lista de pa&iacute;ses con nivel adecuado de
  protecci&oacute;n <strong>no fueron verificados</strong> y quedan como marco sectorial de referencia, no como
  fundamento; (ii) la condici&oacute;n de que el pa&iacute;s del encargado sea uno de esos pa&iacute;ses
  <strong>no es una exigencia legal</strong> del art&iacute;culo 24, numeral 2, ni del art&iacute;culo 25 del Decreto
  1377 de 2013, sino una decisi&oacute;n conservadora de K+AIR; (iii) la <strong>transferencia del software a la
  Empresa s&iacute; cae en el supuesto (ii)</strong> de la Circular Externa 002 de 2025, mientras el canal de correo
  queda fuera de su &aacute;mbito literal; y (iv) los hechos contractuales que ese escrito no pudo verificar
  <strong>quedan declarados como pendientes de confirmaci&oacute;n contra el contrato</strong> y este Anexo no los
  presenta como verificados. El plazo de cuarenta y ocho horas que este Anexo asume es, adem&aacute;s, compromiso
  propio del Encargado y no un plazo fijado por el CDPA.</p>
```

### B.8.1 §5 del Anexo de Nube v1.4, párrafo «Circular 002 de 2025 de la SIC» (líneas 401-417)

```html
  <p><strong>Circular 002 de 2025 de la SIC.</strong> La Circular Externa No. 002 del 7 de octubre de 2025 (la
  &laquo;Circular 2 de 2025&raquo; en las referencias de este Anexo), publicada en el Diario Oficial No. 53.268 del
  9 de octubre de 2025, da instrucciones aplicables a los <strong>procesos de transferencia de
  tecnolog&iacute;a</strong> en los que se transfieran datos personales o en los que se transfieran tecnolog&iacute;as
  que permitan o tengan por objeto el tratamiento de datos personales. <strong>Este Anexo documenta la
  operaci&oacute;n</strong>: el uso de la cuenta empresarial de Google Workspace del Encargado, con los
  datos, la finalidad, el destinatario y el pa&iacute;s que quedan declarados en esta secci&oacute;n y en el &sect;2 de
  este Anexo. <strong>Este Anexo no implementa ni declara ninguna comunicaci&oacute;n previa a la Delegatura para la
  Protecci&oacute;n de Datos Personales de la SIC por el hecho de usar Gmail</strong>, y tampoco afirma que dicha
  comunicaci&oacute;n sea necesaria. <strong>Conclusi&oacute;n jur&iacute;dica sobre el canal de correo: el canal queda
  fuera del alcance literal de la Circular</strong>, porque el &aacute;mbito de la Circular son los procesos de
  transferencia de tecnolog&iacute;a y el uso de una cuenta de correo para enviar un c&oacute;digo OTP no es una
  transferencia de tecnolog&iacute;a: lo gobiernan el art&iacute;culo 24, numeral 2, y el art&iacute;culo 25 del
  Decreto 1377 de 2013. <strong>Conclusi&oacute;n jur&iacute;dica sobre el servicio: la transferencia del software a la
  Empresa s&iacute; cae en el supuesto (ii) de la Circular</strong>, porque K+AIR permite y tiene por objeto el
  tratamiento de datos personales; en consecuencia, las instrucciones de la Circular se aplican a esa transferencia
  de tecnolog&iacute;a y no al canal de correo. <strong>Queda pendiente, y es un acto del owner, el documento que
  re&uacute;na las caracterizaciones que la Circular exige para la transferencia de tecnolog&iacute;a</strong> (los
  datos que se transfieren, la finalidad, la tecnolog&iacute;a y las medidas de seguridad): el &sect;2 (datos y
  finalidad), el &sect;4 (proveedores externos y subencargados) y el &sect;5 (seguridad) de este Anexo, junto con
  el &sect;4 y el &sect;9 del Anexo de Encargo, cubren buena parte de eso, pero no lo sustituyen. <strong>El texto de la
  Circular fue le&iacute;do y verificado por un abogado matriculado el 13 de noviembre de 2026</strong>, en la fuente
  oficial de la SIC.</p>
```

### B.8.2 §4 del Anexo de Nube v1.4, «Las tres preguntas del abogado» (líneas 508-528)

```html
  <p><strong>Las tres preguntas del abogado y las respuestas que este Anexo incorpora.</strong> Las tres preguntas
  planteadas sobre este canal (si el papel del destinatario debe determinarse desde los t&eacute;rminos del proveedor
  o desde la operaci&oacute;n concreta; si la Circular 002 de 2025 exige comunicaci&oacute;n previa a la Delegatura o
  basta la declaraci&oacute;n en el RNBD; y qu&eacute; redacci&oacute;n deja la base de la declaraci&oacute;n de la
  transmisi&oacute;n de forma que pueda considerarse suficiente) quedan respondidas en este Anexo con los textos
  siguientes, <strong>revisados por un abogado matriculado el 13 de noviembre de 2026</strong>; esa revisi&oacute;n
  <strong>no sustituye la validaci&oacute;n formal</strong>, que sigue pendiente:</p>
  <ul>
    <li><strong>Pregunta 1.</strong> &laquo;Por la operaci&oacute;n concreta, contrastada con los t&eacute;rminos
    aplicables y con el v&iacute;nculo contractual: con la cuenta empresarial de Google Workspace y el CDPA vigente
    y aplicable a la cuenta, Google trata los datos del cliente como procesado y queda contractualmente obligado a
    hacerlo; la redacci&oacute;n refleja las dos cosas.&raquo;</li>
    <li><strong>Pregunta 2.</strong> &laquo;El canal de correo queda <strong>fuera</strong> del &aacute;mbito literal de
    la Circular Externa 002 de 2025, porque su &aacute;mbito son los procesos de transferencia de tecnolog&iacute;a y el
    uso de una cuenta de correo no lo es; pero <strong>la transferencia del software a la Empresa s&iacute; cae en su
    supuesto (ii)</strong>, porque K+AIR permite y tiene por objeto el tratamiento de datos personales, y a esa
    transferencia se aplican sus instrucciones.&raquo;</li>
    <li><strong>Pregunta 3.</strong> &laquo;Identificaci&oacute;n de la operaci&oacute;n, datos, finalidad,
    destinatario, pa&iacute;s, fundamento aplicable y obligaciones de informaci&oacute;n y
    autorizaci&oacute;n.&raquo;</li>
  </ul>
  <p>La respuesta 3 se materializa as&iacute;: la operaci&oacute;n, los datos y la finalidad en esta secci&oacute;n y
  en el &sect;2 de este Anexo; el destinatario, en la secci&oacute;n 4; el pa&iacute;s de destino, en esta secci&oacute;n
  y en el &sect;3; el fundamento aplicable, en el &sect;11 y en el estado declarado de la secci&oacute;n inicial; y las obligaciones de
  informaci&oacute;n y autorizaci&oacute;n, en el &sect;2, en el &sect;7 y en el &sect;8 de este Anexo.</p>
```

### B.8.3 §8 del Anexo de Nube v1.4, párrafo de auditoría y de incidentes (líneas 788-800)

```html
  <p>El Encargado permite auditor&iacute;a o entrega, en cuanto Cloudflare los ponga a disposici&oacute;n y sin que su
  disponibilidad altere las obligaciones de este Anexo, los informes SOC 2 Tipo II, ISO/IEC 27001 e ISO/IEC 27701
  de Cloudflare, y la documentaci&oacute;n t&eacute;cnica del servicio. <strong>El proveedor del canal de correo
  tambi&eacute;n est&aacute; sujeto a un deber de auditor&iacute;a contractual, mientras el Cloud Data Processing
  Addendum (CDPA) est&eacute; vigente y aplicable a la cuenta del Encargado:</strong> el &sect;7.4 (Compliance
  Certifications and SOC Reports) oblig&oacute; a Google a facilitar sus certificaciones de cumplimiento y sus informes
  SOC, el &sect;7.5 (Reviews and Audits of Compliance) regula las revisiones y auditor&iacute;as del cumplimiento, y el
  &sect;7.5.2(c) permite revisar la <em>Security Documentation</em>. <strong>El derecho de auditor&iacute;a del Cliente
  del &sect;7.5.2(a), con auditor independiente nombrado por el Cliente, est&aacute; condicionado a que se aplique la
  Ley Europea</strong>, de modo que para esta cuenta, que no est&aacute; sujeta al Reglamento (UE) 2016/679, ese
  derecho no se activa por s&iacute; solo: lo que el Encargado exige y mantiene a disposici&oacute;n del Responsable son
  las certificaciones, los informes SOC y la documentaci&oacute;n de seguridad. El Encargado responde por el
  cumplimiento del subencargado en los mismos t&eacute;rminos en que responde por s&iacute; mismo y pone a
  disposici&oacute;n de la Empresa la documentaci&oacute;n que reciba del proveedor. <strong>Notifica incidentes sin
  demora injustificada y a m&aacute;s tardar en cuarenta y ocho (48) horas: ese plazo es un compromiso propio del
  Encargado y no un plazo fijado por el CDPA</strong>, cuyo &sect;7.2.1 exige &laquo;promptly and without undue
  delay&raquo; sin fijar un plazo de 24 ni de 48 horas. El Encargado colabora con la SIC e informa conforme al
  art&iacute;culo 18(k) de la Ley 1581; la notificaci&oacute;n de incidentes que involucren datos del cliente
  transmitidos por el canal se alinea con el r&eacute;gimen del &sect;7.2 del CDPA.</p>
```

### B.8.4 §11 del Anexo de Nube v1.4, viñeta de la Circular 002 (líneas 898-902)

```html
    <li>Circular Externa No. 002 del 7 de octubre de 2025 (la &laquo;Circular 2 de 2025&raquo; en las referencias de
    este Anexo) de la SIC, Diario Oficial No. 53.268 del 9 de octubre de 2025: instrucciones aplicables a los
    procesos de transferencia de tecnolog&iacute;a en los que se transfieran datos personales o en los que se
    transfieran tecnolog&iacute;as que permitan o tengan por objeto el tratamiento de datos personales;
    <strong>el canal de correo queda fuera de su &aacute;mbito literal y la transferencia del software a la Empresa
    s&iacute; cae en su supuesto (ii)</strong> (v&eacute;ase el &sect;4 de este Anexo).</li>
```

### B.8.5 §5 del Anexo de Encargo 2026-11-12, párrafo «Lo que queda pendiente» (líneas 524-537)

```html
  <p><strong>Lo que queda pendiente.</strong> La migraci&oacute;n del canal transaccional a una cuenta empresarial de
  Google Workspace vinculada por el CDPA qued&oacute; ejecutada; de los pasos que ese proceso exige, los que siguen
  pendientes son estos, y ninguno de ellos se declara cumplido en este anexo: (i) el documento que demuestra las
  medidas de seguridad del canal de correo, que es la responsabilidad demostrada del Responsable; el par&aacute;grafo
  primero del numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica se cita como marco sectorial de referencia y
  <strong>su contenido no fue verificado</strong> por el abogado matriculado el 13 de noviembre de 2026; (ii) la
  evidencia de lo que el r&eacute;gimen de transferencias internacionales exija a la Empresa como Responsable; el
  canal de correo queda <strong>fuera</strong> del alcance literal de la Circular Externa 002 de 2025, porque su
  &aacute;mbito son los procesos de transferencia de tecnolog&iacute;a (seg&uacute;n la conclusi&oacute;n de este
  Anexo), pero <strong>la transferencia del software a la Empresa s&iacute; cae en el supuesto (ii)</strong> de esa
  Circular, de modo que a esa transferencia se aplican sus instrucciones y queda pendiente, a cargo del owner, el
  documento que re&uacute;na las caracterizaciones que la Circular exige; (iii) la declaraci&oacute;n de la
  transferencia en el Registro Nacional de Bases de Datos, a cargo de cada Empresa como Responsable &mdash; la
  obligaci&oacute;n de inscripci&oacute;n se mide por los activos totales de cada Responsable, y los 19,09 UVT que el
  expediente declara para el Encargado son una declaraci&oacute;n del owner y no un certificado &mdash;, previa
  confirmaci&oacute;n de que est&aacute; inscrita; y (iv) la pol&iacute;tica de tratamiento de la Empresa que informa al
  Titular de la transferencia. Del v&iacute;nculo con el proveedor solo quedan dos pasos pendientes: (vii) la
  creaci&oacute;n y verificaci&oacute;n de los alias de privacidad, soporte e incidentes del dominio, a cargo de
  Gesstiar S.A.S.; y (ix) la suscripci&oacute;n de esta versi&oacute;n 2026-11-12 del Anexo de Encargo por la Empresa y su
  contrafirma por el Encargado, a cargo de la Empresa y de Gesstiar S.A.S. <strong>Este Anexo declara lo que est&aacute;
  hecho y deja lo que falta con nombre y responsable: no afirma que estos pasos ya est&eacute;n cumplidos.</strong></p>
```

### B.8.6 §12 del Anexo de Encargo 2026-11-12, viñetas del Título V y de la Circular 002 (líneas 964-969)

```html
    <li>Circular &Uacute;nica de la SIC, T&iacute;tulo V, numeral 3.2 (pa&iacute;ses con nivel adecuado de protecci&oacute;n,
    con Estados Unidos incluido) y sus par&aacute;grafos primero (responsabilidad demostrada), tercero (el simple
    tr&aacute;nsito transfronterizo no comporta una transferencia) y cuarto (la transmisi&oacute;n a pa&iacute;ses con
    nivel adecuado, en los t&eacute;rminos de la transferencia); actualizada por la Circular 001 del 9 de enero de
    2026, Diario Oficial 53.362. <strong>Se cita como marco sectorial de referencia y no como fundamento de la
    calificaci&oacute;n que este Anexo hace: su contenido y la lista de pa&iacute;ses con nivel adecuado de
    protecci&oacute;n no fueron verificados por el abogado matriculado el 13 de noviembre de 2026, y la
    calificaci&oacute;n de transmisi&oacute;n internacional que este Anexo declara no depende de &eacute;ste</strong>
    (art&iacute;culo 24, numeral 2, y art&iacute;culo 25 del Decreto 1377 de 2013, que no condicionan el pa&iacute;s del
    encargado).</li>
    <li>Circular 2 de 2025 de la SIC (instrucciones para los procesos de transferencia de tecnolog&iacute;a):
    <strong>el canal de correo queda fuera de su &aacute;mbito literal y la transferencia del software a la Empresa
    s&iacute; cae en su supuesto (ii)</strong> (v&eacute;ase el &sect;5 de este Anexo).</li>
```

> **Nota sobre el rango 524-537 (corregida el 13-nov-2026).** El texto literal nuevo dice **2026-11-12**, que
> es la versi&oacute;n que este Anexo de Encargo suscripci&oacute;n: la l&iacute;nea 535 del texto base est&aacute; **dentro**
> del p&aacute;rrafo que este rango sustituye, as&iacute; que la sustituci&oacute;n de `2026-11-11` por `2026-11-12` la trae
> **el propio literal** y el motor **no** lleva el fragmento `B6.4-535`. Antes el motor lo llevaba, y eso ten&iacute;a
> dos efectos: el candidato sal&iacute;a con una fecha que el dictamen no dec&iacute;a, y el **guard de identidad byte a byte**
> (el texto del candidato tiene que ser byte a byte el de la determinaci&oacute;n) fallaba sin que el generador se
> quejara. Un texto que se firma no puede salir de una fuente que dice otra fecha. La fila 535 de **B.6.4**
> queda **resuelta por este literal**.
