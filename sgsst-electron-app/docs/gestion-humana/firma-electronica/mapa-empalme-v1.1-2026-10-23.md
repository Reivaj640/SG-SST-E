# Mapa de empalme: Acuerdo sobre el uso del mecanismo de firma electrónica, v1.1

**Qué es.** Documento de trabajo para que otro agente (o el owner) construya el archivo
`acuerdo-v1.1.txt` sin volver a interpretar al abogado. No es el Acuerdo: es el mapa que dice
qué numeral va, con qué texto y qué queda pendiente.

**De dónde sale.** Todo el texto citado sale de
`docs/gestion-humana/firma-electronica/respuesta-11A-2026-10-23.txt` (respuesta 11A de la asesoría
legal laboral y de protección de datos, 23 de octubre de 2026). La sección 2 de ese archivo es el
texto final de la v1.1. Excepciones: el texto del **8.6** está en la sección 1.1 de la misma
respuesta, y el texto del **10.7(b)** está en la sección 1.3. La sección 4 de ese archivo es la
tabla de qué bloquea la publicación y qué bloquea la primera firma. La sección 3 es el Anexo de
Nube.

**Corrección del 26-oct-2026.** La revisión legal del owner corrigió trece numerales: 1.4, 1.5,
3.4(e), 8.6, 9.5, 10.1, 10.2(h), 10.4(a), 10.5(f), 10.5(g), 10.8(a), 10.8(c) y 12.7. El texto
vigente de esos trece vive en `firma-service/scripts/fixtures/acuerdo-v1.1-cambios.json`; la tabla
cita el texto del abogado como referencia y, en las tres filas nuevas, el texto ya corregido.

**Regla que no se negocia.** La **v1.0 no se toca**: está publicada y sellada. La v1.1 será un
**archivo nuevo** (`acuerdo-v1.1.txt`) con **su propia huella**, y cada versión del Acuerdo tiene
la suya (numerales 1.5, 9.3 y 9.4 de la v1.0). Los consentimientos ya aceptados tampoco se
tocan.

**Nota de lectura de la tabla.** La columna "Texto final" cita el texto del abogado **íntegro**.
Cuando el abogado entregó varios párrafos para un mismo numeral, van unidos con `<br>`. Los
párrafos que el abogado marcó como explicación de redacción (no como texto del contrato) se
explican en la columna de cambios y **no** se copian al Acuerdo.

---

## 1. Numerales que cambian

Una fila por numeral reescrito. Son **52 filas**: los 47 numerales con texto escrito en la sección 2
de la respuesta, más el 8.6 y el 10.7(b), que esa misma sección remite a la 1.1 y a la 1.3
respectivamente, más el 9.5, el 10.8(a) y el 10.8(c), que se corrigen por la revisión legal del
26-oct-2026.

| Numeral | Texto final (citado íntegro del .txt) | Qué cambió respecto de la v1.0 | Deja huecos que llenar |
|---|---|---|---|
| 1.2 | 1.2. Los datos de identificación de la Empresa (razón social, NIT, domicilio, representante legal y su documento, responsable interno del tratamiento, canales y política) se muestran al Firmante en el bloque «Empresa que solicita tu firma». En esa pantalla se muestra el número completo del documento del representante legal, para que el Trabajador pueda contrastarlo con el Registro Único Empresarial y Social.<br>La identificación que se incorpora a la Constancia es la copia archivada al momento de la aceptación: se almacena cifrada y se muestra enmascarada, con los cuatro (4) últimos dígitos, porque la Constancia se archiva y puede compartirse con la autoridad laboral. La diferencia es deliberada y no se extiende a los datos del Firmante.<br>La Constancia incorpora la huella SHA-256 de esa identificación archivada, calculada sin clave secreta sobre la identificación en claro, incluido el número completo del representante. La pantalla muestra la huella de la identificación vigente en ese momento. Si la Empresa cambia sus datos entre la aceptación y la firma, las huellas difieren. Esas huellas acreditan integridad; no reservan el dato frente a terceros, porque la identificación es pública en el RUES. Ni la identificación ni su huella alteran el texto ni la huella de este Acuerdo. | Separa la identificación que ve el Firmante (completa) de la que se archiva en la Constancia (cifrada, enmascarada con los cuatro últimos dígitos) y le pone huella SHA-256 sin clave secreta. | No. Los datos de la Empresa salen del bloque de identificación ya capturado en la solicitud. |
| 1.4 | 1.4. K+AIR, operada por Gesstiar S.A.S., es el proveedor del mecanismo descrito en el Capítulo III. El servicio se presta en la infraestructura operada por Gesstiar que se describe en el 10.1 y en el Anexo de Nube. K+AIR interviene como Encargado por cuenta de la Empresa, dentro de los alcances, finalidades y plazos de este Acuerdo y del contrato de transmisión del artículo 2.2.2.25.5.2 del Decreto 1074 de 2015 (Anexo de Encargo y su Anexo de Nube). K+AIR no es parte de la relación laboral. | Cambia la cita del artículo 25 del Decreto 1377 de 2013 por el artículo 2.2.2.25.5.2 del Decreto 1074 de 2015, y ancla el servicio en el 10.1 y en el Anexo de Nube. | No. |
| 1.5 | 1.5. Los datos completos de Gesstiar S.A.S., su domicilio, sus canales de atención y el canal de protección de datos del 10.7(b) constan en el Anexo de Encargo, disponible en [URL]. No forman parte del texto porque son susceptibles de cambiar y este Acuerdo, una vez publicado, no se modifica: cada versión tiene su propia huella. | Deja de remitir al "sitio web" y pone un `[URL]` explícito del Anexo de Encargo; los datos del operador no entran al texto. | **Sí: `[URL]`** del Anexo de Encargo. Bloquea la publicación y la primera firma (fila 10 de la tabla del §4). |
| 2.2 | 2.2. Este Acuerdo se celebra al amparo del artículo 2.2.2.47.7 del Decreto 1074 de 2015. Cuando el documento sea el contrato individual de trabajo o sus adiciones, modificaciones o anexos, se dicta además al amparo del artículo 2.2.1.1.8 del Decreto 1072 de 2015 y del artículo 2.2.1.1.9, que exige cumplir los requisitos mínimos del artículo 39 del Código Sustantivo del Trabajo; el parágrafo de ese artículo dispone que el acuerdo sobre el mecanismo se rige por el artículo 2.2.1.1.13 y por las estipulaciones adicionales que las partes convengan. Para los tres casos de los numerales 1, 2 y 3 del artículo 2.2.1.1.13, las partes dejan constancia de lo siguiente: | Reescribe el 2.2: agrega la cita al 2.2.1.1.8 del Decreto 1072 de 2015 y al artículo 39 del Código Sustantivo del Trabajo. | No. |
| 2.2(a) | 2.2(a). La vigencia de la firma corresponde a la del contrato y sus adiciones, modificaciones o anexos. El mecanismo no aplica al documento firmado ni a la Constancia ninguna política de eliminación por la terminación de la relación laboral; la conservación por plazo y la supresión posterior se rigen por el 8.6. La Constancia identifica la versión aceptada y la huella de su texto, según el 9.6. | Quita "ninguna política de eliminación por el transcurso del tiempo" y manda al 8.6; la Constancia remite al 9.6. | No. |
| 2.2(c) | 2.2(c). El uso del mecanismo es exclusivo para la relación laboral, sin que el documento firmado pierda validez, eficacia ni fuerza probatoria por el hecho de que la relación haya terminado, conforme al numeral 3 del artículo 2.2.1.1.13 del Decreto 1072 de 2015. | Agrega la cita al numeral 3 del artículo 2.2.1.1.13 del Decreto 1072 de 2015. | No. |
| 3.1 | 3.1. El método consiste en: (i) un enlace individual remitido a la dirección de correo registrada; (ii) un token de acceso; (iii) un código OTP remitido a la dirección de correo personal del Firmante, que la Empresa no administra; y (iv) la confirmación de la firma. El OTP es el dato de creación; el token es una credencial de acceso. El servicio se presta en la infraestructura del 10.1 y del Anexo de Nube. | Reescribe el método en cuatro pasos, separa el OTP (dato de creación) del token (credencial) y ancla el servicio en el 10.1 y en el Anexo de Nube. | No. |
| 3.3 | 3.3. El código OTP es el único dato de creación de la firma. El token es una credencial que permite abrir el enlace, pero no constituye dato de creación ni habilita por sí solo la manifestación de voluntad. La firma se perfecciona solo cuando el Firmante introduce el OTP y confirma.<br>El OTP se remite exclusivamente a la dirección personal del Firmante, no administrada por la Empresa. El token puede remitirse a la dirección de contacto registrada por la Empresa, pero su posesión no sustituye el OTP. Si el Firmante no cuenta con dirección personal, no se utiliza el mecanismo electrónico y se firma en papel. | Deja de decir que "los datos de creación son el OTP y el token": el OTP es el único dato de creación y el token es credencial de acceso. | No. |
| 3.4(c) | 3.4(c). El Trabajador abre el enlace. El enlace incorpora un token aleatorio, personal e intransferible, con vigencia de setenta y dos (72) horas en la modalidad remota. K+AIR puede reemitirlo a solicitud de la Empresa; cada reemisión se registra y deja sin efecto el token anterior. No hay más de un token vigente por solicitud. | Agrega la reemisión del token con invalidación del anterior y la regla de un solo token vigente por solicitud. | No. (Ver la condición de código (b) de la sección 5.) |
| 3.4(d) | 3.4(d). El Trabajador se identifica con el tipo y número de su documento. K+AIR compara el valor con la información registrada por la Empresa mediante HMAC-SHA-256 con clave secreta, registra el resultado y no conserva el número en texto claro. | Sustituye la "huella digital con sal" por HMAC-SHA-256 con clave secreta y precisa que el número no se conserva en claro. | No. |
| 3.4(e) | 3.4(e). Verificada la identificación, K+AIR envía al medio personal del Firmante, que la Empresa no administra, un OTP de un solo uso, que expira a los 600 segundos y admite cinco (5) intentos. El código nunca se almacena en claro: solo su HMAC-SHA-256. | El OTP va al medio personal del Firmante y no al correo registrado por la Empresa; la huella pasa de "con sal" a HMAC-SHA-256. | No. |
| 3.4(g) | 3.4(g). Superada la verificación, el Trabajador lee en pantalla el Acuerdo en la versión vigente al momento de la firma y lo acepta. Si la solicitud se creó bajo una versión anterior, el sistema le presenta la vigente para que la lea y la acepte en ese momento. La aceptación se registra con la versión, la huella SHA-256 del texto y la fecha y hora. El Trabajador no puede avanzar sin leer y aceptar. | Agrega la migración a la versión vigente en el momento de la firma y la regla de no avanzar sin leer y aceptar. | No. (Es la 10.4 que la tabla del §4 da por probada.) |
| 3.6(e) | 3.6(e). El OTP y el token se conservan únicamente como HMAC-SHA-256, nunca en texto claro. La clave secreta se mantiene fuera de la base de datos y bajo control de K+AIR. | Cambia "huella digital con sal" por HMAC-SHA-256 y exige la clave fuera de la base de datos. | No. |
| 3.6(g) | 3.6(g). El registro de auditoría no puede alterarse una vez escrito. La supresión dentro de la ventana de purga del 8.6 no es alteración: da lugar a una lápida que identifica la solicitud, la fecha y hora, las categorías suprimidas y el fundamento del plazo, y a un recibo que la Empresa entrega al Trabajador si lo solicita. | Aclara que la supresión dentro de la ventana de purga no es alteración y crea la lápida y el recibo. | No. |
| 3.7(a) | 3.7(a). El Firmante declara que la dirección personal a la que recibe el OTP es de su uso exclusivo, que no está administrada por la Empresa y que mantiene el control y la custodia del OTP conforme al artículo 2.2.2.47.6 del Decreto 1074 de 2015. Si no cuenta con una dirección personal, el mecanismo electrónico no se utiliza y la firma se hace en papel. El token puede remitirse a la dirección de contacto registrada por la Empresa, pero no es dato de creación y no permite firmar por sí solo. | Alinea el criterio de confiabilidad con el OTP como único dato de creación y con la dirección personal no administrada por la Empresa. | No. |
| 3.8 | 3.8. K+AIR conserva y pone a disposición los registros técnicos del mecanismo: la solicitud, los hitos, la constancia de envío del OTP, el registro de emisión y validación del token (sin conservarlo en claro), la verificación del OTP, la huella del documento y la constancia de firma. La Empresa conserva y pone a disposición la autorización del Trabajador, su identidad, la relación laboral y el medio electrónico autorizado para la copia. Conforme al parágrafo del artículo 2.2.2.47.7, K+AIR prueba la seguridad y confiabilidad técnica del mecanismo; la Empresa prueba la autorización y la identidad. La parte que invoca la firma acredita la cadena completa; la sola constancia no sustituye la prueba de la autorización. | Precisa la carga de la prueba: qué conserva cada parte y que la sola constancia no sustituye la prueba de la autorización. | No. |
| 3.10 | 3.10. Definiciones técnicas. Se distinguen tres huellas que no son equivalentes: a) SHA-256: se aplica a contenido íntegro y público; puede recalcularla cualquier tercero. Se usa para el texto del Acuerdo (3.6(b), 9.3, 9.6) y para el documento y su copia (2.3, 3.6(a), 3.7(b), 10.5(c)). b) HMAC-SHA-256: usa una clave secreta fuera de la base de datos; no puede recalcularse sin ella. Se usa para el documento de identidad del Firmante, el OTP y el token (3.4(d), 3.4(e), 3.6(e), 10.5(a), 10.5(b)). c) SHA-256 de la identificación de la Empresa: sin clave secreta, sobre la identificación en claro, incluido el documento del representante. Es reproducible por quien conozca esa identificación, que es pública en el RUES, y no ofrece reserva frente a terceros. Se usa para acreditar integridad en la Constancia (1.2, 10.5(g)). | Numeral nuevo: fija el vocabulario controlado de las tres huellas (SHA-256, HMAC-SHA-256 y SHA-256 de la identificación de la Empresa). | No. |
| 4.1 | 4.1. La firma electrónica tiene la misma validez y efectos jurídicos que la firma cuando cumple el requisito de firma del artículo 2.2.2.47.3 y es confiable en los términos del artículo 2.2.2.47.4 del Decreto 1074 de 2015. | Cambia la cita: la v1.0 citaba el 2.2.2.47.5; ahora se apoya en el 2.2.2.47.3 y el 2.2.2.47.4. | No. |
| 4.2 | 4.2. El requisito de firma de una persona queda cumplido respecto de un mensaje de datos cuando se usa una firma electrónica que, a la luz de todas las circunstancias —incluido este Acuerdo—, sea tan confiable como apropiada para los fines con que se generó o comunicó el mensaje (art. 2.2.2.47.3). | Se apoya en el 2.2.2.47.3 y reescribe la fórmula sin cambiar el sentido. | No. |
| 4.3 | 4.3. Conforme al parágrafo 2 del artículo 2.2.1.1.10 del Decreto 1072 de 2015, la firma electrónica tiene los mismos efectos que la firma manuscrita si cumple el artículo 2.2.2.47.3 del Decreto 1074 de 2015. | Precisa que la remisión es al 2.2.2.47.3 del Decreto 1074 de 2015. | No. |
| 4.4 | 4.4. Conforme al artículo 244 de la Ley 1564 de 2012, los documentos en forma de mensaje de datos se presumen auténticos. Su valoración se sujeta al artículo 247 de la misma ley. La firma electrónica no es firma digital: son figuras distintas. | Agrega la referencia al artículo 247 y la aclaración de que firma electrónica y firma digital son figuras distintas. | No. |
| 4.5 | 4.5. La validez, eficacia y fuerza probatoria de la firma no se afectan por la terminación de la relación laboral (numeral 3 del artículo 2.2.1.1.13). La supresión de la evidencia material conforme al 8.6 no revoca la firma ni altera su presunción; lo que puede afectar es la disponibilidad de los medios de prueba, por lo que la Empresa debe entregar la copia solicitada antes de suprimir y no suprimir mientras haya una solicitud pendiente. | Agrega el efecto de la supresión del 8.6 sobre la disponibilidad de los medios de prueba y el deber de no suprimir con una solicitud pendiente. | No. |
| 5.1 | 5.1. El Firmante acepta los deberes del artículo 2.2.2.47.6 del Decreto 1074 de 2015 y se compromete a cumplirlos: a) Cumplir las condiciones de este Acuerdo y las instrucciones de seguridad que se le informen por escrito antes de la firma, consultables en el enlace. No está obligado a cumplir políticas internas que no le hayan sido puestas a disposición antes de firmar. b) Custodiar el OTP, que es el dato de creación, y el token, que es una credencial de acceso, sin entregarlos ni permitir que un tercero los use. c) Avisar de inmediato a la Empresa y a K+AIR, por el canal de incidentes publicado en la pantalla de firma, cualquier situación que comprometa la seguridad: acceso no autorizado al correo, pérdida del dispositivo o conocimiento de que un tercero obtuvo el OTP o el enlace. | Corrige el 5.1 y sus literales: solo obliga con condiciones y seguridad informadas por escrito antes de la firma, separa OTP (dato de creación) de token (credencial) y fija el canal de incidentes publicado en la pantalla de firma. | No. (Exige que el canal de incidentes esté publicado en la pantalla de firma.) |
| 5.4 | 5.4. El Firmante puede imprimir o descargar copia de este Acuerdo y del documento firmado desde el enlace, mientras esté vigente y sin costo. El vencimiento del enlace no extingue su derecho a obtener copia de la Empresa conforme al 8.5. | Agrega que la descarga desde el enlace exige que esté vigente y que el derecho a obtener copia de la Empresa sigue vigente (8.5). | No. |
| 6.1(d) | 6.1(d). Parágrafo. Conforme al parágrafo del artículo 2.2.1.1.13 del Decreto 1072 de 2015, el empleador garantiza que el mecanismo cumple las condiciones del artículo 2.2.2.47.4 del Decreto 1074 de 2015. | Convierte el literal d) en parágrafo y corrige la cita: el 2.2.2.47.4 del Decreto 1074 de 2015. | No. |
| 6.2 | 6.2. Las reglas anteriores son de cumplimiento obligatorio para el contrato individual de trabajo y sus adiciones, modificaciones y anexos. Para los demás documentos de la relación laboral, la Empresa se obliga contractualmente a aplicar las mismas reglas, con fundamento en el parágrafo del artículo 2.2.1.1.9. El incumplimiento es responsabilidad de la Empresa y no afecta al Firmante. | Reescribe el 6.2: separa la obligatoriedad legal (contrato individual de trabajo) de la obligación contractual (demás documentos) y precisa que el incumplimiento no afecta al Firmante. | No. |
| 8.2 | 8.2. El Trabajador autoriza que la Empresa le entregue el contrato, sus anexos y modificaciones por el medio electrónico que indique en la solicitud. La autorización se registra, puede modificarse o revocarse en cualquier momento y no se presume por la aceptación del mecanismo. Si no autoriza un medio electrónico, la Empresa entrega copia en papel o por el medio que el Trabajador acepte. La falta de autorización no impide la firma electrónica. | Reescribe el 8.2: la autorización del medio se registra, se puede revocar y no se presume por la aceptación del mecanismo; la falta de autorización no impide la firma electrónica. | No. |
| 8.3 | 8.3. Los documentos firmados se mantienen disponibles para consulta en el formato en que fueron creados, por el canal que la Empresa publique. | Agrega el canal de consulta que publica la Empresa. | No. |
| 8.4 | 8.4. La Empresa suministra a las autoridades judiciales y de inspección, vigilancia y control los documentos requeridos, a través de su canal de atención, y los solicita a K+AIR por el medio previsto en el Anexo de Encargo. | Precisa que la solicitud a K+AIR se hace por el medio previsto en el Anexo de Encargo. | No. |
| 8.5 | 8.5. El Trabajador puede solicitar en cualquier momento una copia permanente del contrato firmado, sus anexos, modificaciones y la Constancia. La Empresa la entrega por el medio autorizado, sin costo, dentro de los cinco (5) días hábiles siguientes. La copia se conserva aunque el enlace haya expirado; la descarga desde el enlace es una cortesía y no sustituye este derecho. | Reescribe el 8.5: copia permanente, cinco (5) días hábiles, sin costo, y la copia sobrevive al vencimiento del enlace. | No. (Es la 9A que la tabla del §4 da por probada.) |
| 8.6 | 8.6. Conservación, copia y supresión.<br>a) El plazo de conservación de los registros del proceso de firma es el que resulte de la tabla de retención documental de la Empresa. Ese plazo no puede ser inferior a los mínimos del literal b).<br>b) Los registros del SG-SST enumerados en el artículo 2.2.4.6.13 del Decreto 1072 de 2015 se conservan como mínimo veinte (20) años contados desde el cese de la relación laboral: (i) perfiles epidemiológicos y conceptos de exámenes de ingreso, periódicos y de retiro; (ii) resultados de exámenes y pruebas complementarias cuando la Empresa cuente con médico especialista; (iii) resultados de mediciones y monitoreo de ambientes de trabajo; (iv) registros de capacitación, formación y entrenamiento; y (v) registros de suministro de elementos y equipos de protección personal. Los demás documentos y registros del SG-SST se rigen por la tabla de retención de la Empresa.<br>c) El contrato individual de trabajo y sus adiciones, modificaciones y anexos firmados electrónicamente se conservan con autenticidad, integridad y disponibilidad conforme al artículo 2.2.1.1.12 del Decreto 1072 de 2015, que no fija término. El sistema les asigna un hold y no los suprime por el vencimiento de la custodia.<br>d) Si la Empresa declara un deber legal o contractual de conservación, el sistema aplica un hold sobre el documento y no lo suprime mientras ese deber subsista.<br>e) La supresión procede solo cuando concurren: (i) vencimiento del plazo aplicable; (ii) ausencia de deber legal o contractual de conservación; (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold vigente. La supresión deja la lápida y el recibo del numeral 3.6(g).<br>f) La Empresa entrega al Trabajador, siempre y sin costo, copia del contrato, sus anexos y modificaciones, por el medio electrónico que el Trabajador autorice, conforme a los artículos 2.2.1.1.12 y 2.2.1.1.13 del Decreto 1072 de 2015. La solicitud se registra y se atiende antes de cualquier supresión.<br>g) Antes de la firma, la Empresa informa al Trabajador el plazo aplicable, el deber de conservación del contrato y el canal para solicitar copia. El sistema no envía aviso previo de supresión y este Acuerdo no lo promete.<br>h) Si la Empresa no declara un plazo, se aplica el mínimo legal que corresponda y, en su defecto, veinte (20) años contados desde la firma. Ese plazo es un máximo de custodia y no autoriza a conservar más allá de la finalidad. | Reescribe el 8.6 por completo: la v1.0 no fijaba plazo propio; ahora fija el piso de veinte (20) años del 2.2.4.6.13 para las cinco categorías enumeradas, hold sin término para el contrato, el deber legal declarado, la supresión condicionada y la entrega de copia. | No. (Texto tomado de la sección 1.1 de la respuesta, no de la sección 2.) |
| 8.7 | 8.7. La conservación puede realizarse en la infraestructura operada por Gesstiar y en los servicios de los subencargados identificados en el Anexo de Nube (Cloudflare, Inc. y Google LLC), con las medidas, plazos y obligaciones de devolución y supresión allí pactados. La supresión del 8.6 alcanza a los respaldos dentro del plazo allí previsto. La Empresa conserva la titularidad y puede solicitar devolución o supresión. | Nombra a los subencargados (Cloudflare, Inc. y Google LLC) y remite al Anexo de Nube; la v1.0 hablaba de "herramientas o sistemas externos" en genérico. | No. |
| 9.2 | 9.2. El Trabajador puede leer el Acuerdo antes de firmar. El sistema muestra la versión vigente al momento de la firma, habilita la casilla solo cuando el texto ha sido desplegado hasta su final y registra la aceptación con la huella del texto y la fecha y hora. El sistema acredita el despliegue, no la lectura. | Cambia "sólo cuando el texto ha sido leído en su totalidad" por "desplegado hasta su final" y aclara que el sistema acredita el despliegue, no la lectura. | No. |
| 9.5 | 9.5. Este Acuerdo es de aplicación desde la fecha de vigencia que consta en su encabezado y no tiene efectos retroactivos. El Trabajador que haya aceptado una versión anterior se rige por esa versión respecto de las firmas ya realizadas. Para las firmas posteriores a la entrada en vigencia de una versión nueva, el Trabajador debe leer y aceptar esa versión nueva en el momento mismo de la firma. | Fija la fecha de vigencia en el encabezado y aclara que no hay efectos retroactivos. (Corrección de la revisión del 26-oct: la v1.0 no llevaba fecha en el encabezado.) | No. |
| 10.1 | 10.1. Infraestructura y terceros. El servicio se presta en un servidor propio de Gesstiar S.A.S., ubicado físicamente en [ciudad, país], en la red local del operador y detrás de NAT. Se expone mediante el túnel kair-firma de Cloudflare, Inc. hacia firma.kair.fyi. El correo transaccional se envía mediante Google LLC (smtp.gmail.com, puerto 587). Cloudflare y Google actúan como subencargados solo si están vinculados por los contratos/DPA descritos en el Anexo de Nube; mientras no lo estén, no se les puede tratar como Encargados. El almacenamiento principal es el sistema de archivos del servidor; no hay proveedor externo de almacenamiento de objetos. Respaldos, monitoreo y soporte: [interno, a cargo de … / provisto por …]. Cuando este Acuerdo use “nube”, se refiere a la infraestructura operada por Gesstiar aquí descrita, no a un proveedor de hosting distinto. | Reescribe el 10.1: describe la infraestructura real del firma-service (servidor propio, túnel kair-firma de Cloudflare, SMTP de Google LLC) y condiciona el rol de subencargados a los DPA del Anexo de Nube. | **Sí: `[ciudad, país]`** (ubicación física del servidor) y **`[interno, a cargo de … / provisto por …]`** (respaldos, monitoreo y soporte). |
| 10.2(h) | 10.2(h). La identificación de la Empresa que se muestra en el bloque «Empresa que solicita tu firma»: razón social, NIT, domicilio, nombre y documento del representante legal, y la huella de esa identificación. Estos datos no pertenecen al Titular: se tratan por cuenta de la Empresa para que el Trabajador contraste quién le solicita la firma. | Agrega el literal h) y separa la identificación de la Empresa de los datos del Titular (los literales a) a g) del 10.2 quedan como están). | No. |
| 10.4(a) | 10.4(a). La finalidad del 10.3(f) se sustenta en el deber legal de conservar evidencia del proceso de firma (arts. 2.2.1.1.12, 2.2.1.1.13 num. 3 y 2.2.2.47.7) y en el deber de conservar prueba de la autorización, conforme al artículo 2.2.2.25.2.5. Opera sin perjuicio de la autorización del Titular. | Agrega la cita al artículo 2.2.2.25.2.5 (deber de conservar prueba de la autorización). | No. |
| 10.5(a) | 10.5(a). El documento del Trabajador se compara mediante HMAC-SHA-256 y se conserva solo la huella, no el número en claro. | Sustituye "huella digital con sal" por HMAC-SHA-256. | No. |
| 10.5(b) | 10.5(b). El OTP y el token se conservan solo como HMAC-SHA-256. | Sustituye "huella digital con sal" por HMAC-SHA-256. | No. |
| 10.5(d) | 10.5(d). Los registros de auditoría no se alteran. Su supresión en la ventana de purga deja la lápida y el recibo del 3.6(g) y no afecta la prueba de aceptación del 12.7. | Agrega la excepción de la lápida y el recibo y dice que no afecta la prueba de aceptación del 12.7. | No. |
| 10.5(f) | 10.5(f). Los operadores de infraestructura y correo actúan como Encargados y tratan los datos solo conforme a instrucciones, en los términos del artículo 2.2.2.25.5.2. | Cambia la cita del "artículo 25 del Decreto 1377 de 2013" por el artículo 2.2.2.25.5.2 del Decreto 1074 de 2015. | No. |
| 10.5(g) | 10.5(g). El documento del representante legal no se conserva en claro: se cifra con clave fuera de la base, se restringe el acceso y se muestra enmascarado con los cuatro últimos dígitos. La huella SHA-256 de la identificación de la Empresa es reproducible por quien conozca esa identificación, pública en el RUES; no reserva el dato y solo acredita integridad. | Numeral nuevo: el cifrado y el enmascarado de la identificación de la Empresa, y el alcance real de su huella. | No. |
| 10.6 | 10.6. Los plazos se determinan por categoría en la tabla de retención de la Empresa. Vencido el plazo y sin deber legal o contractual, el dato se suprime conforme al 8.6. La supresión del documento, la Constancia y los registros de auditoría deja la lápida y el recibo del 3.6(g) y 10.5(d). Los plazos del SG-SST son los del 8.6(b). | Reescribe el 10.6: manda al 8.6 para la supresión y fija que los plazos del SG-SST son los del 8.6(b). | No. |
| 10.7(b) | b) Los derechos del Titular se ejercen ante la Empresa, como Responsable, por el canal publicado en su política de tratamiento. K+AIR, como Encargado, también atiende las solicitudes que le sean dirigidas: designa una persona o área de protección de datos, mantiene un mecanismo permanente y gratuito publicado en la pantalla de firma y en el Anexo de Encargo, registra toda solicitud con fecha, identidad, tipo y radicado, y la traslada a la Empresa dentro de los dos (2) días hábiles siguientes, con la evidencia que repose en su custodia. K+AIR informa al Titular que la solicitud fue trasladada y no decide sobre el acceso, la rectificación, la supresión o la revocación. La Empresa decide y responde dentro de los plazos de los artículos 14 y 15 de la Ley 1581 de 2012. El canal de K+AIR es [correo o URL] y la persona o área responsable es [nombre o cargo]. | Reescribe el 10.7(b): K+AIR deja de no recibir solicitudes, las atiende y las traslada a la Empresa en dos (2) días hábiles (art. 15.1 de la Ley 1581 de 2012). | **Sí: `[correo o URL]`** (canal de K+AIR) y **`[nombre o cargo]`** (persona o área responsable). Bloquea la publicación y la primera firma (fila 9 de la tabla del §4). (Texto tomado de la sección 1.3 de la respuesta.) |
| 10.7(c) | 10.7(c). El Titular acredita su identidad. El ejercicio de los derechos y el acceso son gratuitos al menos una vez al mes calendario y cada vez que haya modificaciones sustanciales de la política. Para consultas más frecuentes, la Empresa solo puede cobrar gastos de envío, reproducción y certificación (art. 2.2.2.25.4.2). | Agrega el límite de lo que se puede cobrar en consultas más frecuentes, con la cita al 2.2.2.25.4.2. | No. |
| 10.7(e) | 10.7(e). El Titular acude primero a la Empresa o a K+AIR, conforme al artículo 15 de la Ley 1581 de 2012. Solo procede acudir a la SIC agotado el reclamo interno (art. 16). | Cambia "debe acudir primero a la Empresa" por "a la Empresa o a K+AIR" y agrega la cita al artículo 16. | No. |
| 10.7(f) | 10.7(f). La solicitud de copia es un derecho de acceso (art. 8(f) Ley 1581; art. 2.2.2.25.4.2) y no implica por sí misma un derecho de supresión. La supresión y la revocatoria no proceden cuando existe un deber legal o contractual de permanencia (art. 2.2.2.25.2.6). | Agrega las citas al artículo 8(f) de la Ley 1581, al 2.2.2.25.4.2 y al 2.2.2.25.2.6. | No. |
| 10.8(a) | 10.8(a). Cuando un documento objeto de firma contenga información relativa a la salud, el Titular debe ser informado de manera explícita y previa de que el dato es sensible, de cuáles son los datos que serán objeto de tratamiento y de la finalidad de éste, y debe otorgar su autorización expresa e informada en los términos del artículo 6 de la Ley 1581 de 2012 y del artículo 6 del Decreto 1377 de 2013, compilado en el artículo 2.2.2.25.2.3 del Decreto 1074 de 2015, salvo que concurra una excepción legal que releve la autorización, en los términos del artículo 6 o del artículo 10 de la Ley 1581 de 2012. En dicho evento debe informársele igualmente que, por tratarse de datos sensibles, no está obligado a autorizar su tratamiento. | Corrige la concordancia ("debe otorgar su autorización") y aclara que la excepción puede venir del artículo 6 o del artículo 10 de la Ley 1581. (Corrección de la revisión del 26-oct.) | No. |
| 10.8(c) | 10.8(c). BASE LEGAL. Para el tratamiento de la información de salud de que trata este numeral, la base legal es la autorización expresa del Titular en los términos del literal anterior o, cuando concurra, la excepción legal aplicable prevista en la ley, en particular las del artículo 6 o del artículo 10 de la Ley 1581 de 2012, que la Empresa identificará y documentará. Si la Empresa fundara el tratamiento en una base legal distinta, debe informárselo al Titular de forma expresa y anticipada antes de recoger el dato, y esa base debe constar en su política de tratamiento de datos personales. | Admite las excepciones del artículo 6 o del artículo 10, además de la autorización expresa, y mantiene el deber de informar una base distinta. (Corrección de la revisión del 26-oct.) | No. |
| 12.1 | 12.1. Este Acuerdo se rige por la ley colombiana y, en particular, por: Constitución Política, arts. 15 y 20; Ley 527 de 1999; Ley 594 de 2000; Ley 1562 de 2012; Ley 1564 de 2012; Ley 1581 de 2012; Decreto 1377 de 2013; Decreto 1072 de 2015; Decreto 1074 de 2015; Decreto 526 de 2021; Decreto 2364 de 2012; Resolución 0312 de 2019; y las normas que los modifiquen o sustituyan. El Decreto 526 de 2021 adicionó los artículos 2.2.1.1.8 a 2.2.1.1.15 del Decreto 1072 de 2015; el Decreto 2364 de 2012 reglamentó el artículo 7 de la Ley 527 y fue compilado en el Capítulo 47 del Decreto 1074 de 2015. | Reescribe el 12.1: amplía la lista de normas (Constitución Política, Ley 527 de 1999, Ley 594 de 2000, Decreto 526 de 2021, Decreto 2364 de 2012, Resolución 0312 de 2019) y explica dos de ellas. | No. |
| 12.3 | 12.3. El régimen de los documentos del SG-SST se determina por su normativa, por la Ley 1562 de 2012 y por la Resolución 0312 de 2019 del Ministerio del Trabajo, «Por la cual se definen los Estándares Mínimos del Sistema de Gestión de la Seguridad y Salud en el Trabajo SG-SST» (13 de febrero de 2019; Diario Oficial 50.872 de 19 de febrero de 2019), en cuanto resulte aplicable. Para esos documentos las reglas del Capítulo VI no son de imposición legal directa, porque el 2.2.1.1.13 está dirigido al contrato individual de trabajo, pero la Empresa se obliga contractualmente a aplicarlas en los términos del 6.2. | Reescribe el 12.3: identifica la Resolución 0312 de 2019 con su título, fecha y Diario Oficial, y precisa el alcance del Capítulo VI. | No. |
| 12.7 | 12.7. La Empresa conserva la prueba de la aceptación junto con la versión aceptada, la huella del texto, la fecha y hora y el identificador de la solicitud, conforme al artículo 2.2.2.25.2.5. Esta prueba subsiste a la supresión del 8.6. | Agrega que la prueba subsiste a la supresión del 8.6 y la cita al 2.2.2.25.2.5. | No. |

### Dos aclaraciones de lectura (no son texto del Acuerdo)

- **4.1**: en la respuesta, detrás del texto del 4.1 hay un párrafo que explica por qué no se cita el
  2.2.2.47.5 (su remisión al 2.2.2.43.3 quedó apuntando al presupuesto de las Cámaras de Comercio).
  El abogado dice que **"la explicación va en el memorando, no en el contrato"**, así que ese párrafo
  no se copia al Acuerdo: solo queda el numeral 4.1 con la cita al 2.2.2.47.3 y al 2.2.2.47.4.
- **8.6 y 10.7(b)**: la sección 2 los remite ("8.6. (Texto del §1.1.)" y "10.7(b). (Texto del §1.3.)").
  Los textos citados arriba son los de la sección 1.1 y de la sección 1.3 respectivamente.
- **10.7(b)**: en la sección 1.3 el abogado escribió el párrafo bajo el rótulo "Texto final del 10.7(b)"
  y lo hizo arrancar con "b)" (no con "10.7(b)."). La celda lo cita tal cual; el numeral va en la
  primera columna.

---

## 2. Numerales que NO cambian

La sección 2 de la respuesta dice que **"los numerales no listados quedan como están en la v1.0"**.
Estos son los numerales de la v1.0 que no aparecen en la tabla anterior y que, por tanto, se copian
tal cual:

- **Capítulo I:** 1.1, 1.3.
- **Capítulo II:** 2.1, 2.3, y el literal **2.2(b)** (el costo del mecanismo, a cargo de la Empresa):
  el abogado no lo tocó y no lo eliminó; el 2.2 nuevo solo reescribe el encabezado y da el 2.2(a) y el
  2.2(c). **Verificar al empalmar que el 2.2(b) no se borre.**
- **Capítulo III:** 3.2, 3.4(a), 3.4(b), 3.4(f), 3.4(h), 3.4(i), 3.5, 3.6(a), 3.6(b), 3.6(c), 3.6(d),
  3.6(f), 3.6(h), 3.7(b), 3.9.
- **Capítulo IV:** ninguno (4.1 a 4.5 cambian).
- **Capítulo V:** 5.2, 5.3, 5.5. (Los literales 5.1(a), 5.1(b) y 5.1(c) cambian dentro del 5.1.)
- **Capítulo VI:** 6.1(a), 6.1(b), 6.1(c).
- **Capítulo VII:** 7.1, 7.2, 7.3 (ninguno cambia).
- **Capítulo VIII:** 8.1.
- **Capítulo IX:** 9.1, 9.3, 9.4, 9.6.
- **Capítulo X:** 10.2(a) a 10.2(g), 10.3(a) a 10.3(h), 10.4(b), 10.5(c), 10.5(e), 10.7(a), 10.7(d),
  10.7(g), 10.8(b), 10.9.
- **Capítulo XI:** 11.1, 11.2, 11.3 (ninguno cambia).
- **Capítulo XII:** 12.2, 12.4, 12.5, 12.6.
- **Fuera de los capítulos:** el preámbulo ("Alcance" y "Las partes identificadas en el Capítulo I hemos
  acordado lo siguiente.") y el bloque final "MANIFESTACIÓN DE VOLUNTAD" quedan como están.

**Verificar al empalmar (observación sobre el texto de la v1.0, no instrucción del abogado):** el
punto 1 de la Manifestación de Voluntad dice, literalmente, "versión v1.0". Ese texto no aparece en
la sección 2 de la respuesta, así que hay que decidir qué se hace con él al construir el archivo
nuevo: si se deja así, el archivo nuevo se contradice a sí mismo.

---

## 3. Huecos que el owner tiene que llenar antes de publicar

Lista plana. Cada hueco con el numeral o el bloque donde aparece.

### Del texto de la v1.1

1. **1.5 — `[URL]`**: dirección del Anexo de Encargo. Bloquea la publicación y la primera firma
   (fila 10 de la tabla del §4).
2. **10.7(b) — `[correo o URL]`**: canal de datos de K+AIR. Bloquea la publicación y la primera firma
   (fila 9 de la tabla del §4).
3. **10.7(b) — `[nombre o cargo]`**: persona o área responsable de protección de datos, con acta de
   designación. Bloquea la publicación y la primera firma (fila 9 de la tabla del §4).
4. **Anexo de Encargo — NIT de Gesstiar S.A.S. con dígito de verificación, domicilio, representante
   legal y URL de la política de tratamiento**: no viven en el texto del Acuerdo; el 1.5 y el
   10.7(b) remiten a ese Anexo. **Resuelto el 26-oct-2026:** el NIT completo es `900987987-1`, y el
   domicilio, el representante y la URL ya constan en el Anexo. No bloquea por este concepto.
5. **Anexo de Nube — ubicación del servidor, respaldos, monitoreo y soporte**: desde la revisión del
   26-oct el 10.1 remite a ese Anexo; ya no son huecos del Acuerdo, pero sí condiciones de la firma.
### Del Anexo de Nube (`legal/anexo-nube-v1.0.html`)

6. **Partes — `[EMPRESA]`, `NIT [ ]`, `representada por [ ]`**: datos del Responsable.
7. **Partes — `NIT [ ]`, `representada por [ ]`**: datos del Encargado (Gesstiar S.A.S.).
8. **Infraestructura — `[ciudad, país]`**: ubicación física del servidor.
9. **Respaldos — `[frecuencia, retención, cifrado, responsable]`**.
10. **Monitoreo — `[herramienta o persona]`**.
11. **Soporte — `[interno o proveedor]`**.
12. **Seguridad física — `[control de acceso al lugar, energía, conectividad]`**.
13. **Continuidad — `RTO [ ]` y `RPO [ ]`**: sin RTO/RPO y plan de continuidad el servicio no está en
    condiciones de sostener contratos de trabajo (riesgo de disponibilidad, §3.3 de la respuesta).
14. **Subencargados — columnas "Devolución / supresión" y "Auditoría" de Cloudflare y de Google**: `[ ]`.
15. **Subencargados — filas `[Respaldo]`, `[Monitoreo]` y `[Soporte]`**: `[ ]` en proveedor, servicio,
    datos, rol, ubicación, DPA, devolución/supresión y auditoría.
16. **Rol de Google — `[Workspace/Cloud]`**: si la cuenta es de consumidor, el tratamiento es
    transferencia internacional y el Acuerdo necesita una autorización expresa, separable e
    informada que hoy no tiene (no alcanza con decir "transmisión").
17. **DPAs — `[self-serve / enterprise]` (Cloudflare) y `[Workspace/Cloud]` (Google)**: sin DPA
    firmada, Cloudflare y Google no pueden tratarse como Encargados.
18. **Seguridad — `Detalle: [anexo técnico]`**.
19. **Devolución y supresión — `[CSV/JSON/PDF]` (formato) y `[plazo]` (plazo de supresión)**.
20. **Derechos de los Titulares — `Canal: [correo/URL]` y `persona o área: [nombre/cargo]`**.
21. **Auditoría e incidentes — `[SOC 2 / ISO 27001 / propio]` (informes) y `[3]` (plazo contractual de
    notificación de incidentes)**.
22. **Vigencia, terminación y versión — `Vigencia: [ ]`, `Terminación: [ ]`, `Versión: [ ]`**.

### Adicionales que la respuesta marca como no verificado (§5)

23. **Tipo de cuenta de Google (Workspace/Cloud o consumidor)**: NO VERIFICADO. Define si hay
    transmisión o transferencia.
24. **DPAs de Cloudflare y de Google, y si cubren devolución, supresión y auditoría**: NO VERIFICADO.
25. **Ubicación física del servidor**: NO VERIFICADO. La respuesta da 192.168.1.11, no la ciudad ni el
    país.
26. **Si EE. UU. está en la lista de países adecuados de la SIC**: NO VERIFICADO. Si no está, la
    transferencia a un Responsable en EE. UU. necesita autorización expresa o excepción del
    artículo 26.
27. **Estado del Anexo de Encargo**: NO VERIFICADO. La base dice firmado y el onboarding dice que no
    hay ninguno. Hay que resolverlo **antes**, porque el Anexo de Nube se incorpora a él: otrosí si
    ya está firmado, reemplazo si no.

---

## 4. Los doce grupos

Reproducción de la tabla "grupo -> numerales -> veredicto" de la sección 2 de la respuesta.

| # | Grupo | Numerales | Veredicto |
|---|---|---|---|
| 1 | Nube (T1) | 1.4, 1.5, 3.1, 3.7(a), 5.1(c), 8.7, 10.1 | Reescritos |
| 2 | §4 vs §8 | 2.2, 2.2(a), 2.2(c), 4.5, 8.6 | Reescritos |
| 3 | Gobernanza (T5) | 2.2, 6.1(d), 6.2 | Aprobados con la cita al art. 39 CST |
| 4 | Citas del Cap. IV | 4.1, 4.2, 4.3, 4.4 | Corregidas (47.3 y 47.4; no 47.5/43.3) |
| 5 | Deberes del Firmante | 5.1, 5.1(a)-(c) | Corregidos |
| 6 | Carga de la prueba | 3.8 | Precisado |
| 7 | Huellas | 1.2, 3.4(d), 3.4(e), 3.6(e), 3.10, 10.5(a), 10.5(b), 10.5(g) | Aprobados con vocabulario controlado |
| 8 | Tokens y versión | 3.1, 3.3, 3.4(c), 3.4(g), 9.2 | Reescritos |
| 9 | Copia y conservación | 5.4, 8.2, 8.3, 8.4, 8.5 | Reescritos 5.4, 8.2 y 8.5 |
| 10 | Auditoría y purga | 3.6(g), 10.5(d), 10.6, 12.7 | Aprobados |
| 11 | Datos personales | 10.2(h), 10.4(a), 10.7(b)-(f) | Corregidos |
| 12 | Ley aplicable | 12.1, 12.3 | Corregidos |

Los doce grupos se solapan: el 2.2 aparece en los grupos 2 y 3, el 3.1 en los grupos 1 y 8, y el
3.7(a) en los grupos 1 y 8. Por eso el abogado presentó el texto **en orden de numeral**, no por
grupo: así el texto se puede pegar sin duplicados.

---

## 5. Condiciones de código que la v1.1 exige

Las tres condiciones que la respuesta pone como requisito para publicar. **Las tres ya se están
implementando aparte en el código**: este mapa no las implementa, solo las deja anotadas para que
el que construya `acuerdo-v1.1.txt` sepa que el texto y el código tienen que quedar de acuerdo.

**(a) `ANIOS_CUSTODIA` de 80 a 20 en `retencion.js`.**
Origen: sección 1.1 (efecto en el código) y numeral 8.6(b). Los 80 años **no son un plazo legal**:
son una política interna, y conservar 80 años un documento sin deber legal de conservación es
sobre-retención frente al 2.2.2.25.2.8. Se mantienen el hold del contrato, el piso de 20 años y
`conservacion_por_deber_legal`. Si el owner decide conservar 80, el texto tiene que decir "techo
técnico de custodia" y asumir el riesgo de sobre-retención; el abogado no lo recomienda. Si se
publica con 80, el texto miente sobre el código (fila 4 de la tabla del §4).

**(b) La reemisión del token deja sin efecto el anterior y no hay más de un token vigente.**
Origen: numeral 3.4(c) y la nota de condición de código que va con él. Si el sistema mantiene
válidos los tokens anteriores, hay que cambiar el código antes de publicar: un token "de un solo
uso" que convive con otros tres contradice el 3.2 y debilita el 3.7(a).

**(c) El bloqueo D-03 en los cuatro puntos, con excepción auditable.**
Origen: sección 1.2 (Decisión 2, B.3) y fila 3 de la tabla del §4 (lo ordenan el 1.4 y el 8.6).
Los cuatro puntos son: creación de la solicitud, commit, creación del consentimiento y doble firma.
Se bloquea cuando falta el Anexo de Encargo o el canal de PQRS. La excepción debe ser **un flag
auditable, no un `if` silencioso**: si el flag no existe, se implementa antes de publicar.

Condiciones que debe cumplir la excepción (sección 1.2 de la respuesta):

| Condición | Contenido |
|---|---|
| Autorización | Escrita, del owner o representante legal, con fecha y alcance. |
| Alcance | Una Empresa y un número máximo de firmas. |
| Ruta en papel | Disponible y operativa el mismo día. |
| Plazo | Fecha cierta para firmar el Anexo (máximo 30 días). |
| Rastro | Bitácora inmutable: usuario, fecha, motivo, Empresa, número de firmas. |
| Límite | No se usa para una Empresa nueva sin ningún Anexo, salvo piloto autorizado. |

---

## 6. Qué bloquea la publicación y qué bloquea la primera firma

Reproducción de la tabla del §4 de la respuesta.

| # | Requisito | ¿Bloquea publicar la v1.1? | ¿Bloquea la primera firma real? |
|---|---|---|---|
| 1 | 9A (copia permanente, medios autorizados) probada | Sí — el 8.2 y el 8.5 la prometen | Sí |
| 2 | 10.4 (migración a la versión vigente) probada | Sí — el 3.4(g) la promete | Sí |
| 3 | D-03 (bloqueo en creación, commit, consentimiento y doble firma) | Sí — el 1.4 y el 8.6 lo ordenan | Sí |
| 4 | 8.6 con el plazo corregido (20 años) | Sí — si se publica 80, el texto miente sobre el código | Sí |
| 5 | D-02 encendido | No | Sí — el 3.1, 3.3 y 3.7(a) lo ordenan |
| 6 | Anexo de Nube firmado + DPAs | No | Sí |
| 7 | Ubicación física del servidor | No | Sí |
| 8 | Anexo de Encargo: estado resuelto | No | Sí |
| 9 | Persona/área y canal de datos | Sí — el 10.7(b) los nombra | Sí |
| 10 | NIT, URL de la política | Sí — el 1.5 y el 10.7 lo remiten | Sí |
| 11 | Canal de PQRS único (formulario o endpoint) | Sí — sin él, el override no deja rastro | Sí |

**Secuencia correcta:** (1) cerrar 9A, 10.4 y D-03; (2) ajustar el 8.6 en el código; (3) publicar la
v1.1 como archivo nuevo con su propia huella; (4) encender D-02; (5) firmar el Anexo de Nube; (6)
primera firma real. La v1.0 y los consentimientos ya aceptados no se tocan.

---

## 7. Lo que este mapa no hace

- **No escribe `acuerdo-v1.1.txt`.** Ese archivo lo construye otro agente, con los huecos ya
  rellenados.
- **No toca la v1.0** (`firma-service/scripts/fixtures/acuerdo-v1.0.txt`), que está publicada y
  sellada, ni los consentimientos ya aceptados.
- **No inventa ningún dato.** Donde el abogado dejó un hueco, aquí queda un hueco, y en la sección
  5 de la respuesta está marcado como "No verificado".
- **No reproduce los hashes** de ninguna versión.
