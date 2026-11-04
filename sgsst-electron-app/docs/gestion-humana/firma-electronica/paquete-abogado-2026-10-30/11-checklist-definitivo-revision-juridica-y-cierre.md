# Checklist definitivo de revisión jurídica y cierre

**Expediente:** mecanismo de firma electrónica K+AIR — Gesstiar S.A.S.  
**Fecha de preparación:** 30 de octubre de 2026  
**Destinatario:** asesoría jurídica laboral y de protección de datos  
**Estado del expediente al preparar este checklist:** revisión y cierre pendientes; no se solicita que el abogado certifique hechos técnicos que no haya verificado directamente.

> **Nota de actualización (30-oct-2026, después de su revisión).** Esta es la misma lista que usted
> recibió y que ahora se le devuelve **con su respuesta adjunta como documento 00**, con sus literales.
> Lo que cambió en este documento: la sección **A** lleva ahora las huellas de la **v1.4** y de los
> anexos corregidos, para identificar la versión y el hash exactos que se revisan y deciden
> envían; la sección **C** incorporó una columna con el estado de cada discrepancia; y la sección **D**
> refleja lo que ya se ejecutó y lo que sigue pendiente. El cuadro completo de los 96 requisitos, con
> su evidencia y su suma cuadrada, está en el documento 09.

## Instrucciones para el asesor

Para cada punto, marque una opción y complete la recomendación. Si solicita un cambio, indique el documento y numeral, el texto que debe sustituirse o añadirse, el fundamento y la evidencia que debe incorporarse. Si necesita información adicional, especifique qué debe entregar Gesstiar o la Empresa.

**Opciones de respuesta:** ☐ Aprobado  ☐ Aprobado con condición  ☐ Corregir  ☐ No aprobado  ☐ No aplica (justificar)

La revisión jurídica es una recomendación profesional que se conserva con su autoría. No es requisito legal general para operar software ni reemplaza las decisiones y responsabilidades del owner. La autorización operativa de publicación corresponde al representante legal y no certifica por sí sola la implementación técnica o el estado del servidor.

## A. Documentos sometidos a revisión

| ID | Documento | Versión / SHA-256 informado | Decisión del asesor |
|---|---|---|---|
| A1 | Acuerdo sobre uso del mecanismo de firma electrónica | **v1.4** · `7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` | |
| A2 | Anexo de Encargo de Tratamiento | **31-oct-2026 (v1.4)** · `02651747c5efdb3204e59ee430b3014cbb768b8567da89c63565d1162730d0f7` | |
| A3 | Anexo de Nube | **v1.0 (1-nov-2026)** · `aec7c40132979990cddbad669a8d4690d8439ddc447059d069cd8d19c83214ca` | |
| A4 | Constancia de versión y autorización de publicación | **03-nov-2026 (v1.4)** · 9 639 B · `3fd45c658e5160e2c63005d348ec1fd200abb5f26593c6adf6aabd0ccd6a736c` | |
| A5 | Especificación del abogado que ordena esta ronda | 30-oct-2026 · ver adjunto 08 | Acusar recibo / observaciones |
| A6 | Auditoría T1/T2 del Capítulo V | 19-oct-2026 · ver adjunto 06 | Acusar recibo / observaciones |
| A7 | Evaluación del canal de correo | 27-oct-2026 · ver adjunto 07; marcada como antecedente superado | Acusar recibo / observaciones |
| A8 | **Su revisión jurídica del 30-oct-2026** (la que responde a esta lista) | 30-oct-2026 · ver **adjunto 00** | Acusar recibo / observaciones |
| A9 | **Adenda de precisión jurídica sobre RNBD** | 1-nov-2026 · adjunto 13 · `74bfcde8d56cbba00a519822ea13d018c661c4a9b0ed068d7119dc789ae08493` | Revisar la precisión normativa; indicar si se aprueba como adenda explicativa o proponer cambios |

Las huellas de la fila A1 a la A4 son las del **Acuerdo v1.4** y de los anexos corregidos, y son las
mismas que declara el manifiesto del servicio (`firma-service/legal-readiness.json`) y las que
trae `SHA256SUMS.txt`. La v1.3 (`49eab0c5…f4de12`) queda como histórico: **no se aprueba contra
ella**. La comprobación de que el manifiesto, los archivos y el paquete dicen lo mismo es automática
y vive en `firma-service/tests/readiness-manifiesto-v1.4.test.js`.

Los adjuntos 00 (su revisión), 05 (correspondencia texto-código), 09 (respuesta al checklist), 10
(informe de correcciones) y 12 (procedimiento de incidentes de datos de salud) se aportan como
antecedentes técnicos y de estado. Sus afirmaciones no sustituyen la revisión del texto fuente ni
una ejecución actual de pruebas.

## B. Decisiones y revisión jurídica solicitadas

| ID | Tema que requiere criterio jurídico | Documentos / referencias | Respuesta del asesor |
|---|---|---|---|
| J1 | **Acuerdo v1.3 completo.** Revisar si el mecanismo, su alcance, formación de la firma, consentimiento por documento, prueba, copias, conservación, responsabilidades y anexos son jurídicamente adecuados. Confirmar la versión y hash exactos que se aprueban. | A1; constancia A4 | ☐ Aprobar ☐ Condicionar ☐ Corregir ☐ No aprobar. Observación / texto exacto: |
| J2 | **Deberes del firmante (T1).** Confirmar que el numeral 5.1 distingue íntegramente los deberes legales del artículo citado de los deberes operativos adicionales; verificar que el deber de aviso no esté limitado a avisar a Empresa/K+AIR. | A1 §5.1; adjunto 06; especificación adjunto 08 §2 | Decisión y redacción requerida: |
| J3 | **Políticas de seguridad (T2).** Confirmar que el Firmante solo queda obligado por políticas comunicadas y accesibles antes de aplicarse, con versión y evidencia de disponibilidad/aceptación; precisar si la redacción de §5.1(f) y §5.6 lo satisface. | A1 §§5.1, 5.6; adjuntos 06 y 08 §3 | Decisión y redacción requerida: |
| J4 | **Finalidades y bases jurídicas.** Revisar cada finalidad 10.3(a)-(h), datos y titulares involucrados, base aplicable, instrucción de la Empresa, plazo y estado de habilitación. Indicar qué bases, instrucciones o datos debe aportar cada Empresa; confirmar que ninguna finalidad marcada pendiente pueda ejecutarse antes de resolverla. | A1 §§10.3-10.4; A2 matriz; `config/matriz-finalidades.json` | ☐ Aprobado ☐ Condicionar ☐ Corregir. Por finalidad: |
| J5 | **Roles de Responsable y Encargado.** Confirmar la asignación de roles entre Empresa y Gesstiar/K+AIR y señalar si alguna operación descrita exige un análisis distinto, incluida la operación de correo. | A1 cap. X; A2 §§1-2, 5; A3 §§3-5 | Decisión / operación / fundamento: |
| J6 | **Google y Gmail de consumo.** Determinar por la operación concreta y los términos aplicables el papel de Google, la clasificación del flujo, el fundamento jurídico y los deberes de información, autorización u otras medidas. Revisar expresamente las frases de A2 que hablan de un encuadre de transferencia ya determinado frente a los pasajes que dejan la clasificación pendiente. No se presume un DPA ni un subencargo contractual. | A2 §§5 y 8; A3 §§3-5 y 11; adjunto 07 (antecedente superado); adjunto 08 §7 | Determinación escrita, alcance y cambios exactos: |
| J7 | **Circular 002 de 2025 y RNBD.** Precisar qué obligación aplica a esta operación y qué evidencia debe entregar el owner; el expediente dice que inscripción, obligación y declaración están pendientes de verificación. | A2 §5; A3 §§5 y 11; adjunto 08 N3-N4 | Obligación / responsable / evidencia / plazo: |
| J8 | **Conservación supletoria 10 y 5 años.** Validar o proponer plazos distintos por categoría, fundamento, inicio de cómputo, excepciones, solicitudes de copia, holds y supresión. Indicar si la tabla puede entrar en vigor y bajo qué condiciones. | A1 §8.6; A2 tabla §8; `config/tabla-conservacion.json`; adjunto 08 §4 | ☐ Validar ☐ Cambiar ☐ No aprobar. Parámetros y condiciones: |
| J9 | **SG-SST y fecha de cese.** Confirmar categorías sujetas al plazo legal especial y el cómputo desde el cese; definir qué debe ocurrir cuando la fecha no esté disponible. Revisar la tensión identificada entre D1 (no aplicar veinte años a todos los documentos), la regla especial desde el cese y el plazo legado de veinte años desde la firma que la correspondencia describe con la compuerta cerrada. | A1 §8.6; A2 tabla §8; A3 §6; `retencion.js`; adjuntos 08 §4 y 05 | Regla jurídicamente aprobada / categorías / evento inicial / tratamiento de fecha desconocida: |
| J10 | **OTP, correo y elección en papel.** Revisar que la descripción del enlace y OTP refleje los medios de recepción reales, el rechazo del buzón que la Empresa pueda leer, los riesgos si ambos llegan a un mismo buzón y la alternativa en papel sin perjuicio para el Trabajador. | A1 §§3.1-3.4, 7.2; A2 §2; A3 §3; adjuntos 05 y 06 | Decisión / correcciones / condiciones de uso: |
| J11 | **Datos sensibles de salud y carga accidental.** Revisar la prohibición de uso, la declaración por documento, el procedimiento de bloqueo, retención temporal, notificación, base/instrucción y supresión; precisar las responsabilidades de Responsable y Encargado. | A1 §10.8; A2 §2; A3 §§3-5 | Decisión / texto o medidas adicionales: |
| J12 | **Anexos contractuales y orden de prevalencia.** Aprobar o corregir A2 y A3 como documentos contractuales, sus referencias, versiones, firmas, modificación, devolución, supresión, auditoría e incidentes. Confirmar si A3 debe firmarse junto con A2 y bajo qué condiciones. | A2 §§2, 9-13; A3 §§1, 8-10 | ☐ Aprobar ☐ Condicionar ☐ Corregir. Condiciones: |
| J13 | **Registro de versión y publicación.** Revisar si el registro identifica claramente la versión y reserva al representante legal la decisión de publicación, sin atribuir aprobación jurídica a quien no la emitió. | A4 §§1-6 | Recomendación / campos y secuencia: |
| J14 | **Puntos adicionales.** Señalar cualquier irregularidad jurídica o contractual relevante no recogida arriba, con documento, numeral, texto afectado, fundamento y recomendación. | Todos los adjuntos | Hallazgo / recomendación: |

## C. Discrepancias documentales que requieren instrucción

No se asumen resueltas por este checklist. El asesor puede recomendar cambios y señalar fundamento o evidencia. El owner registra su decisión para cada punto en la sección E; los ajustes aritméticos o de estado también los consolida el owner.

| ID | Discrepancia observada | Instrucción solicitada | Estado a 30-oct-2026 (después de su revisión) |
|---|---|---|---|
| D1 | A2 contiene frases que parecen presentar como decidido un encuadre de transferencia/papel de Google, aunque otros pasajes y A3 dejan la clasificación pendiente. | Indicar qué afirmación conservar, retirar o condicionar, y en qué numeral. | **Aplicada.** En la v1.4, en el Anexo de Encargo (§§4, 5 y 8) y en el Anexo de Nube (§6) la determinación quedó con **su literal**, y se retiraron las frases que quedaban falsas al lado de esa determinación. **Pendiente de usted:** aprobar o formular observaciones a la determinación escrita sobre Google y la Circular 002 (2.7–2.8). Para RNBD, confirmar la aplicación con certificado societario y estados financieros (2.9). |
| D2 | A3 §6 afirma veinte años para registros SG-SST; la especificación ordena no aplicar veinte años a todos los documentos y el informe señala una tensión con el plazo legado desde la firma. | Precisar las categorías sujetas al plazo especial y la redacción correcta para A3 y la tabla. | **Aplicada.** El §6 del Anexo de Nube lleva su literal; el cómputo SG-SST corre **desde la fecha real de cese** y, si esa fecha no se conoce, el registro queda pendiente **sin fecha de supresión calculada** (se retiró el sustituto por la fecha de firma). **Pendiente de usted:** la validación del procedimiento y del alcance del *hold* mientras la fecha esté pendiente (J9). |
| D3 | La nota al abogado sugería aprobar A2 con hash `8c54a8de…f6d7`; en una ronda posterior el manifiesto, `SHA256SUMS` y el Anexo de Encargo seguían indicando `11e7ac238f8c19262ec2cca9e41ff60c6fc7b2e5a133a9652f2bddf74379a0f0`, que es una huella **histórica** (la del A2 antes de la corrección de D1). | Identificar el archivo exacto que el owner decide usar y retirar hashes antiguos de toda instrucción vigente. | **Aplicada.** La huella vigente del Anexo de Encargo es `02651747c5efdb3204e59ee430b3014cbb768b8567da89c63565d1162730d0f7` (86 397 B), y es la que llevan hoy la nota, el manifiesto y el `SHA256SUMS.txt`. La comparación es **automática**: `armar-paquete-abogado.js` sale con código 3 si el manifiesto y el paquete no coinciden, y `tests/readiness-manifiesto-v1.4.test.js` ata el manifiesto a los archivos reales. Los hashes antiguos se declaran históricos y se retiraron de las instrucciones vigentes. |
| D4 | La respuesta al checklist presenta 59/37 en su tablero, pero cambia el reparto de la sección 5 frente al informe; también menciona 34 pendientes al final y describe de forma distinta qué falta para el cierre técnico. | No emitir una conclusión basada en conteos incompatibles. Indicar si el abogado observa un impacto jurídico; owner debe reconciliar los 96 estados y actualizar las sumas. | **Aplicada.** Los 96 estados se reconciliaron en un solo cuadro (documento 09) y **la tabla de conteo ya no se escribe a mano**: se genera desde el conteo real de las filas con `scripts/contar-estados-checklist.js`, que además falla si el total no da 96. No queda ninguna cifra incompatible entre documentos. |
| D5 | La correspondencia marca 21/21 anclas implementadas, mientras advierte que es una comprobación textual; la batería se debe repetir tras la corrección de retención. Algunas notas describen el adjunto como evidencia de pruebas. | Confirmar que la correspondencia se trate como evidencia estática y que no se use para afirmar una prueba funcional reciente. Owner debe adjuntar resultados nuevos. | **En curso en esta misma ronda.** La correspondencia se regenera para la v1.4 con las líneas reales del código, y se declara como **evidencia estática** en todos los documentos (nunca como prueba funcional). La batería de pruebas se reejecutó el 30-oct-2026; el resultado está en el documento 10. |
| D6 | La respuesta al checklist conserva referencias históricas a nueve adjuntos; el paquete actual incluye diez adjuntos más este checklist. | Owner debe mantener la distinción entre documento histórico y manifiesto vigente, y regenerar el paquete/hash al cerrar. | **Aplicada.** El paquete se regenera con **14 adjuntos, del 00 al 13**, y su `SHA256SUMS.txt`; la nota al abogado distingue lo vigente de lo histórico y el manifiesto del servicio es el que dice qué versión está vigente. |

## D. Cierre técnico y operativo — para coordinación; no es certificación del abogado

Marque “evidencia presentada” solo cuando el equipo entregue resultados fechados y vinculados al commit/versión concreta. El abogado puede indicar requisitos jurídicos, pero la ejecución y certificación técnica corresponde al equipo/owner.

| ID | Evidencia requerida para el cierre | Estado según expediente compartido | Responsable / resultado |
|---|---|---|---|
| T1 | Reejecución de pruebas afectadas por el cambio SG-SST; resultados y fallos comparados con línea base | **Ejecutada localmente el 3-nov-2026 en el árbol de trabajo:** 2 096 pruebas · 2 094 verdes · 0 rojas · 2 omitidas · 94,8 s. No proviene de clon limpio ni está vinculada a T3. Reconciliación reportada: base 2 062 +16 por canal de fecha de terminación = 2 078; +12 por control de huellas = 2 090; +6 por el test de menciones de marcador = 2 096 (**+34** total). El resultado histórico de 30-oct-2026 fue 2 062 pruebas · 2 059 verdes · 1 roja · 2 omitidas. La falla histórica `ADVE6.7: zod acepta "5"` se corrigió en el test, no en código de producción. | |
| T2 | Correspondencia texto-código regenerada para el commit candidato, revisada junto con pruebas funcionales | **Regenerada contra el candidato v1.4: 26 filas · 26 implementadas · 0 pendientes** (adjunto 05), con las huellas del texto candidato en la cabecera. La fila nueva es la del canal de la fecha de terminación. Revisada junto con el reporte de T1. | |
| T3 | Commit exacto que contiene el código, configuración, documentos y migraciones candidatos | **Pendiente del owner:** todo el trabajo está en el árbol de trabajo, **sin commitear**. `HEAD` sigue en `e1d10728` (📦993) y **no** es el candidato: no se hizo ningún commit en esta línea. | |
| T4 | Verificación en servidor de versión, configuración legal, migraciones aplicadas, permisos, secretos, respaldos y auditoría | **Ejecutada el 31-oct-2026 por la tarde, en modo de solo lectura.** Resultado: producción corre el Acuerdo v1.0 y no el v1.4; el despliegue está nueve migraciones atrás (43 aplicadas contra 53 en el repositorio); no hay git en el servidor, de modo que el despliegue no se puede atar a un commit; los permisos del código desplegado son 777; el cifrado en reposo del disco no está implementado (raíz sobre LVM sin cifrado y área de intercambio en archivo sin cifrar); el respaldo diario corre a las 22:00 con suma de comprobación e integridad verificada, con el último del 28-oct-2026 porque el servidor estuvo apagado; y el TLS público y el del SMTP están verificados con TLSv1.3. No se reinició, no se desplegó y el servidor quedó sin un solo byte modificado | |
| T5 | Evidencias reales de configuración del canal de correo (TLS, cuenta, MFA, plantilla, registros, incidente y revocación), sin divulgar secretos | **Diligenciado el 31-oct-2026, y con lo que queda declarado.** La ficha §5 del Anexo de Nube y la determinación J6 están escritas, y los **catorce (14) marcadores** —**cuatro (4)** del RNBD y **diez (10)** de la ficha del canal— quedaron diligenciados con evidencia verificada: cuatro datos del propietario y el resto comprobado en el servidor de producción. El inventario exacto, con dónde se comprueba cada uno, está en el §1.9 del adjunto 09. **Quedan cuatro puntos, y no son datos:** la periodicidad de la rotación de la credencial, el escalamiento de un código de un solo uso rechazado, la fecha de generación de la contraseña de aplicación y dos documentos por adjuntar del RNBD; más el cifrado en reposo del disco, verificado como no implementado. La compuerta C-1 está apagada hoy: el bloqueo de solicitudes y Constancia se aplicará cuando se active, una vez satisfechas sus condiciones | |
| T6 | Prueba controlada E2E posterior al despliegue candidato, limpieza del rastro de prueba y acta | Pendiente según checklist | |
| T7 | Procedimiento de reversión probado o verificado y registro de cierre | Procedimiento descrito; ejecución/acta pendiente | |
| T8 | Decisión operativa del representante legal, identificando versión/hash y resultado de verificaciones; registro de publicación separado | Pendiente. A4 es un modelo interno sin firmar y no constituye compuerta técnica | |
| T9 | Compuertas `publicado` y `aplicacion.activada` verificadas en false hasta completar decisiones y evidencias | **Verificadas el 30-oct-2026, las tres en `false`:** `legal-readiness.json` → `acuerdo.publicado = false`; `config/tabla-conservacion.json` → `aplicacion.activada = false`; `src/config.js` → `exigirAnexoNube = false` (la variable `FIRMA_EXIGIR_ANEXO_NUBE` no está definida). Reconfirmar al cerrar | |

## E. Acta interna de decisiones del owner

Esta sección documenta decisiones del representante legal. **No es aprobación jurídica ni se atribuye al asesor.** Si el asesor no responde alguno de los puntos J1-J14, el owner registra su propia decisión o deja el punto pendiente; no se presume aprobada una recomendación por silencio. La revisión recibida del abogado se conserva íntegra como antecedente, con su autoría y fecha.

| Punto | Decisión del owner / estado (resuelto, condicionado o pendiente) | Fundamento, condición o evidencia | Fecha |
|---|---|---|---|
| J1 | | | |
| J2 | | | |
| J3 | | | |
| J4 | | | |
| J5 | | | |
| J6 | | | |
| J7 | | | |
| J8 | | | |
| J9 | | | |
| J10 | | | |
| J11 | | | |
| J12 | | | |
| J13 | | | |
| J14 | | | |

**Nombre y cargo del owner:** ______________________________________________  
**Firma:** _________________________________________  **Fecha:** ______________________________

La firma de esta acta no sustituye los contratos de encargo, las autorizaciones de los Titulares, la resolución documental del RNBD ni las verificaciones técnicas y operativas.

## F. Seguimiento del owner

| Acción | Responsable | Fecha | Evidencia / hash / acta |
|---|---|---|---|
| Correcciones documentales completadas y nueva versión/hash | | | |
| Respuesta punto por punto a recomendaciones del abogado | | | |
| Pruebas y verificaciones técnicas completadas | | | |
| Recomendaciones del asesor respondidas y decisiones del owner registradas | | | |
| Autorización operativa independiente | | | |
| Decisión de publicar/activar o mantener bloqueado | | | |

**Regla de cierre:** no marcar el expediente como cerrado hasta que las recomendaciones recibidas tengan respuesta, las decisiones J1-J14 del owner estén documentadas, los documentos finales tengan hashes recalculados y las verificaciones técnicas/operativas requeridas estén registradas. No se declara una aprobación jurídica si el abogado no la emitió.
