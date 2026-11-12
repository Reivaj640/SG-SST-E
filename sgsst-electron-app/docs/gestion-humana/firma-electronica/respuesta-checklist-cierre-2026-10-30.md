# Respuesta al checklist de cierre — Firma electrónica K+AIR

**Preparado el 30 de octubre de 2026, 21:40 (hora de Colombia), por Javier Robles Fontalvo
(Gesstiar S.A.S. — K+AIR), Representante Legal y responsable del servicio.**

> **Actualización de gobernanza — 3-nov-2026.** Las menciones anteriores a una aprobación o
> firma del abogado como condición de publicación quedan reemplazadas por esta regla: el abogado
> puede emitir recomendaciones; el owner registra en la sección E del checklist su decisión para
> cada pregunta J1-J14, con fundamento/evidencia o estado pendiente. El silencio no aprueba nada.
> A4 es una constancia interna de versión y autorización operativa del representante legal; no
> acredita aprobación jurídica ni abre una compuerta técnica. Las obligaciones contractuales,
> documentales y operativas que se describen abajo siguen vigentes.

Este documento responde los 96 requisitos del checklist de cierre, uno por uno, con la
evidencia verificada de cada uno. No se marca nada como cerrado sin evidencia comprobable.

**Esta es la única versión del cuadro de los 96 estados.** Reconciliada el 30-oct-2026,
después de aplicar las correcciones de la revisión jurídica (punto **D4** del asesor: el
tablero que recibió estaba roto y las filas no sumaban lo que declaraba el TOTAL). Todos
los números de la tabla de abajo salen del conteo real de los 96 encabezados de requisito,
nunca de una suma escrita a mano: lo verifica y regenera
`sgsst-electron-app/firma-service/scripts/contar-estados-checklist.js`, que sale con código
distinto de 0 si el documento no cuadra.

**Segunda revisión del paquete (31-oct-2026): seis puertas, las seis aplicadas.** La revisión
del 31-oct-2026 detectó seis cosas: una huella duplicada del Anexo de Nube, cinco pasajes que
seguían diciendo «pendiente de validación profesional», la matriz de finalidades desalineada
con J4, el canal de la fecha de terminación inexistente, catorce marcadores sin nombre en el
Anexo de Nube y el bloque T3–T9 sin ejecutar. **Las cinco primeras están aplicadas y
verificadas**; la sexta sigue esperando tu autorización. El detalle, punto por punto, está en
la sección «Segunda revisión: las seis puertas», más abajo, y el canal de la fecha de
terminación se describe en 3.5.

**Tercera revisión del paquete (31-oct-2026, tarde): quince correcciones, las quince
aplicadas.** La misma tarde, otra revisión encontró seis contradicciones jurídicas, cinco
inconsistencias de huella y conteo, y cuatro textos de retención que describían un
comportamiento que el código ya no tiene. **Las quince están aplicadas**, y en los archivos de
origen: nunca en las copias del paquete. Al aplicarlas aparecieron **cuatro textos más de la
misma clase** —uno de ellos en el §8 del Anexo de Encargo, que es el documento que la Empresa
firma—, que también quedaron corregidos. El detalle está en la sección «Tercera revisión:
quince correcciones», más abajo.

**Los cuatro estados** (los mismos del checklist):

| Estado | Significado |
|---|---|
| **Cerrado** | Evidencia suficiente y verificada. Se indica dónde está. |
| **Pendiente** | Falta evidencia, validación o ejecución. Se dice quién la tiene. |
| **Bloqueante para publicar** | Pendiente, e impide publicar el texto v1.4 como vigente. No impide el despliegue del código con la compuerta cerrada. |
| **No aplica** | Justificación documentada. |

**TABLERO DE CIERRE (generado por el conteo real de las filas)**

| Sección | Cerrados | Pendientes | No aplica | Total |
|---|---|---|---|---|
| 1. Integridad documental | 7 | 2 | 0 | 9 |
| 2. Decisiones de contenido y datos | 9 | 3 | 0 | 12 |
| 3. Conservación y supresión | 11 | 2 | 0 | 13 |
| 4. Seguridad del flujo | 14 | 0 | 0 | 14 |
| 5. Correo electrónico | 9 | 2 | 0 | 11 |
| 6. Correspondencia y pruebas | 12 | 0 | 0 | 12 |
| 7. Producción y despliegue | 8 | 7 | 0 | 15 |
| 8. Constancia y cierre | 7 | 3 | 0 | 10 |
| **TOTAL** | **77** | **19** | **0** | **96** |

Los 19 pendientes concilian: 2 de la sección 1 + 3 de la sección 2 + 2 de la sección 3 +
2 de la sección 5 + 7 de la sección 7 + 3 de la sección 8 = 19.

La sección 3 incluye la reverificación del cómputo SG-SST; la sección 7 debe identificar un
commit exacto antes de desplegar.

**Los tres cierres que propone el checklist:**

- **Cierre documental: NO.** Faltan las decisiones documentadas del owner sobre A1, A2 y A3 (2.1, 2.2, 2.3). Los
  cuatro textos de esta ronda ya están corregidos y con huella nueva (Acuerdo v1.4, Anexo de
  Encargo, Anexo de Nube y Constancia); lo que falta es el acta del owner (sección E del
  checklist) con las decisiones J1-J14 y, si se autoriza la publicación, la constancia A4
  firmada por el representante legal.
- **Estado técnico: PARCIAL.** La corrección del cómputo SG-SST y el canal de fecha de
  terminación están implementados (3.5). El 3-nov-2026 ejecuté la suite completa del servicio
  en el árbol de trabajo: **2 096 pruebas, 2 094 aprobadas, 0 fallos y 2 omitidas (94,8 s)**.
  Esta corrida no está vinculada a un commit candidato ni proviene de un clon limpio. La
  referencia previa de **146 pruebas de la app** (140 verdes, 6 fallos preexistentes idénticos
  a la línea base) no se reejecutó aquí. La preparación documental está organizada; falta fijar
  T3, reproducir T1 desde un clon limpio y cerrar las acciones y comprobaciones de servidor
  descritas en 7.12 y 7.13. T4 sí se ejecutó en modo de solo lectura y dejó hallazgos
  pendientes; por eso no corresponde declarar terminado el cierre técnico.
- **Cierre integral: NO.** Depende de las decisiones documentadas del owner y de las verificaciones y actos operativos pendientes. La recomendación jurídica se conserva cuando exista, pero no es una compuerta técnica.

---

## Segunda revisión: las seis puertas (31-oct-2026)

La revisión del paquete del 31-oct-2026 detectó seis cosas. **Las cinco primeras están
aplicadas y verificadas en esta ronda; la sexta sigue esperando tu autorización.** Se dejan
por orden, con lo que cambió y dónde se comprueba.

**Puerta 1 — la huella del Anexo de Nube no era una sola.** Las dos huellas anteriores del Anexo
de Nube, que quedan como **histórico** y no como referencia vigente, eran `263d81da…cc4d512` y
`75deec1c…c286`: el cuadro y el checklist de 11 puntos pedían aprobar el Anexo de Nube con la
primera, mientras el manifiesto, el `SHA256SUMS.txt` y la nota al abogado declaraban la segunda: dos huellas
para el mismo documento, y el mensaje de aprobación apuntaba a la que no era la del
manifiesto. Ahora hay **una sola huella en todos lados**, y sale del manifiesto, no de una
escritura a mano:

| Documento | Bytes | SHA-256 |
|---|---|---|
| Acuerdo de uso v1.4 | 73 208 | `7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` |
| Anexo de Encargo (A2) | 86 397 | `02651747c5efdb3204e59ee430b3014cbb768b8567da89c63565d1162730d0f7` |
| Anexo de Nube v1.0 (A3) | 59 857 | `aec7c40132979990cddbad669a8d4690d8439ddc447059d069cd8d19c83214ca` |
| Constancia de versión y autorización de publicación v1.4 (A4) | 9 639 | `3fd45c658e5160e2c63005d348ec1fd200abb5f26593c6adf6aabd0ccd6a736c` |

Las dos huellas viejas quedan **mencionadas a propósito** en el informe y en la nota al
abogado: describen la discrepancia encontrada, no son instrucciones actuales para firmar.
El registro del owner identifica una sola versión y huella nuevas (D3).

**Puerta 2 — cinco pasajes seguían diciendo «pendiente de validación profesional».** No
borrados: reescritos. La determinación que el abogado tomó (J6) queda como lo decidido, y la
lista de pendientes queda con los pasos externos reales: la evidencia de los controles del canal
de correo, la evidencia que el régimen de transferencias internacionales exija a la Empresa
(la Circular 002/2025 **no aplica** a este canal, corregido en la tercera revisión), la
declaración en el RNBD a cargo de la Empresa y la política que informa al Titular. Se corrigió
además el *lead-in* de la tabla del A3 §4 y la conclusión del A3 §5 sobre la Circular 002, que
**no aplica** a este canal (J7), y la nota `subencargados.google.nota` del manifiesto, que ya no
dice «pendiente de validación profesional escrita». El detalle punto por punto está en 2.7.

**Puerta 3 — la matriz de finalidades no estaba alineada con J4.** En la fuente
(`config/matriz-finalidades.json`), el `estado_habilitacion` de 10.3(d), (f) y (g) pasó a la
misma condición condicional de (a), (b), (c) y (e) —que J4 declaró correctos sin cambio—,
mientras 10.3(h) sigue «No habilitada». El Anexo de Encargo se **regeneró** con
`scripts/generar-anexo-encargo.js` (idempotente, escribe `legal/` y `sitio/`): el bloque
generado no se edita a mano, o habría dos fuentes de verdad.

**Puerta 4 — la fecha de terminación era un hueco.** El Anexo de Encargo §6 obliga a la
Empresa a comunicar la fecha de cese por el canal que el Encargado habilite. Ese canal
**ahora existe**: registro con evidencia, bitácora de solo anexado y recálculo acotado. Está
descrito en 3.5 y probado en `tests/fecha-terminacion-canal.test.js`.

**Puerta 5 — el Anexo de Nube ya no tiene ni un marcador sin diligenciar.** El §1.9 inventaría
los **catorce (14) marcadores diligenciables** —cuatro del RNBD y diez de la ficha del canal de
correo— **más una mención literal del marcador en el texto del §5**, que explica el formato de la
ficha y no es un campo. **El 31-oct-2026 quedaron diligenciados los catorce**, con evidencia
verificada: cuatro datos del propietario y el resto comprobado en el servidor de producción. No
se rellenaron con promesas, sino con hechos. **Lo que sigue abierto ya no es un dato del
documento**, sino cuatro decisiones del propietario, el cifrado en reposo del disco (verificado
como no implementado) y la validación del abogado. Aprobar el modelo sigue sin ser poder firmarlo.

**Puerta 6 — T3 sigue esperando tu autorización; T4 sí se ejecutó.** El commit candidato (T3) no
se puede fijar: «procede» autoriza editar, no commitear. La verificación de servidor (T4) **sí se
ejecutó el 31-oct-2026 por la tarde, en modo de solo lectura**: producción corre el Acuerdo v1.0 y no
el v1.4, el despliegue está nueve migraciones atrás, no hay git en el servidor (por eso el T3 no se
puede atar a un commit), los permisos del código desplegado son 777 y el cifrado en reposo del disco
no está implementado. T5 tiene su evidencia dentro del Anexo de Nube. T6 a T9 siguen esperando el
despliegue.

---

## Tercera revisión: quince correcciones (31-oct-2026, tarde)

Una tercera revisión del paquete, recibida la misma tarde, encontró **6 contradicciones
jurídicas, 5 inconsistencias de huella y conteo, y 4 textos de retención**. **Las quince están
aplicadas**, y en los archivos de origen: el Anexo de Encargo, el Anexo de Nube, el manifiesto
legal, la tabla supletoria, el código y los documentos que se entregan. En las copias del
paquete no se corrigió nada: se corrigió el origen y se regeneró el paquete.

| # | Qué se corrigió | Dónde |
|---|---|---|
| **A-1** | La nota del modelo del Anexo de Nube en el manifiesto decía que «el papel por operación, la clasificación jurídica, la Circular Externa 002 de 2025 de la SIC, el RNBD y la evidencia técnica del canal quedan pendientes de validación profesional escrita». Ahora dice que el papel por operación y la clasificación **están determinados** (Google LLC actúa como Responsable del Tratamiento y el flujo es una transferencia internacional a un país con nivel adecuado), que la Circular 002/2025 **no aplica** a este canal, y que quedan pendientes la verificación del RNBD por el owner y la evidencia técnica del canal | `legal-readiness.json` (ASCII puro) |
| **A-2** | El pendiente (ii) del §5 del Anexo de Encargo pedía «medidas apropiadas y efectivas para la transferencia, conforme al numeral 2 de la Circular Externa 002 de 2025», que el §5 del Anexo de Nube niega. Ahora es «la evidencia de lo que el régimen de transferencias internacionales exija a la Empresa como Responsable», con la constancia de que la Circular no aplica porque su ámbito son los procesos de transferencia de tecnología | `legal/anexo-encargo.html` §5 |
| **A-3** | El §12 del Anexo de Encargo decía que la aceptación no resuelve «la validación conforme a la Circular 2 de 2025 de la SIC». Ahora dice que no constituye por sí sola la solución de los requisitos de la transferencia internacional (la declaración de la transferencia en el Registro Nacional de Bases de Datos, cuando la Empresa esté obligada a inscribirse, y las obligaciones de información y autorización frente al Titular) | `legal/anexo-encargo.html` §12 |
| **A-4** | El aviso del Anexo de Nube repetía la contradicción en su pendiente (iii), y su (iv) decía «las tres preguntas» cuando el §5 ya las responde. Ahora (iii) es la evidencia que el régimen de transferencias internacionales exija, con la precisión de que la Circular no aplica; y (iv) es «la validación de las tres respuestas que este Anexo incorpora» | `legal/anexo-nube-v1.0.html` §1 |
| **A-5** | La exigibilidad de declarar la transferencia en el RNBD «depende de la clasificación profesional del flujo». Ahora depende de la naturaleza jurídica y de los activos totales de Gesstiar S.A.S. frente al artículo 2.2.2.26.1.2 del Decreto 1074 de 2015 (modificado por el Decreto 090 de 2018), que limita la inscripción a las sociedades y entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT y a las personas jurídicas de naturaleza pública, y de la verificación de los puntos 1 a 4 por el owner: **no depende de la clasificación del flujo de correo, que ya está determinada** | `legal/anexo-nube-v1.0.html` §4 |
| **A-6** | «La necesidad de esos instrumentos depende de la clasificación profesional del papel del proveedor y permanece pendiente». Ahora: la necesidad del contrato de transmisión y de las Normas Corporativas Vinculantes **ya está resuelta** en esa sección (Google LLC actúa como Responsable y el destino tiene nivel adecuado de protección), y queda por precisar si subsiste alguna exigencia de medidas a cargo de la Empresa como Responsable | `legal/anexo-nube-v1.0.html` §4 |
| **A-7** | Los marcadores del Anexo de Nube: **catorce (14) diligenciables** (4 del RNBD y 10 de la ficha del canal), más una mención literal del marcador en el texto del §5. **El 31-oct-2026 quedaron diligenciados los catorce**, con evidencia verificada | Anexo de Nube §4 y §5 |
| **B-1** | La fila D3 del checklist de 11 puntos seguía declarando la huella histórica del Anexo de Encargo. Ahora declara la vigente y nombra la anterior como histórica | Adjunto 11 |
| **B-2** | El cuadro presentar el Anexo de Encargo con la huella y el tamaño de la ronda anterior. Ahora las cuatro huellas de aquella ronda quedan **declaradas como históricas** y las que viajan en el paquete son las de los bytes que se entregan | Este cuadro, 1.6 |
| **B-3** | El T5 del checklist decía «quince (15) marcadores», y 4 + 10 no da quince. Ahora: **catorce (14) marcadores diligenciables**, más la mención literal del marcador en el texto del §5 | Adjunto 11 |
| **B-4** | El cuadro describía como pendiente «medidas para la transferencia del numeral 2 de la Circular 002/2025», que es exactamente lo que el Anexo de Nube niega. Ahora: la evidencia que el régimen de transferencias internacionales exija a la Empresa | Este cuadro, 2.7 |
| **B-5** | La tabla de adjuntos de la nota al abogado se regeneró con las huellas y los tamaños posteriores a A-2 y A-4. El Acuerdo (01) conserva su huella; A4 se reclasificó y su huella se recalculó | Nota al abogado |
| **C-1** | La nota de la compuerta decía que con la compuerta cerrada «el sistema conserva el plazo de custodia del catálogo (veinte (20) años)». Ahora: el sistema **no calcula fecha de supresión** y deja el registro retenido con el *hold* `tabla_supletoria_pendiente_validacion`, salvo las excepciones legales en vigor | `config/tabla-conservacion.json` |
| **C-2** | El mismo comentario obsoleto, en el respaldo congelado del código | `src/services/retencion.js` |
| **C-3** | El mismo comentario obsoleto, en el helper de los tests | `tests/helpers.js` |
| **C-4** | La frase que viaja al **adjunto 05** (la correspondencia) decía lo mismo. Ahora dice la verdad, y además que la fuente que queda registrada en la fila es `tabla_supletoria_pendiente`, no `catalogo_sistema` | `scripts/correspondencia-texto-codigo.js` |

**Y cuatro más de la misma clase, que no estaban en la lista del abogado.** Los encontró la misma
búsqueda, porque el defecto era el mismo —un texto que describe un comportamiento que el código
ya no tiene— y uno de ellos viaja en el documento que la Empresa firma:

| # | Qué se corrigió | Dónde |
|---|---|---|
| **E-1** | El §8 del Anexo de Encargo decía que el plazo supletorio «siempre existe» y que «ninguna categoría documental queda sin plazo». Con la compuerta cerrada **sí** queda sin plazo: el registro se retiene con el *hold* `tabla_supletoria_pendiente_validacion`. Ahora el texto dice que el plazo por defecto se aplica una vez validada y activada la tabla, y mientras tanto el registro queda retenido, sin fecha de supresión | `legal/anexo-encargo.html` §8 |
| **E-2** | El mismo *lead-in*, que se **genera**: el bloque de la tabla de conservación del Anexo de Encargo. Se corrigió en el generador, no a mano, y el Anexo se regeneró | `scripts/generar-anexo-encargo.js` |
| **E-3** | El cuadro decía que «mientras la compuerta siga cerrada el catálogo legado de veinte años desde la firma es el que aplica en la práctica». No es lo que hace el código | Este cuadro, 3.6 |
| **E-4** | El cuadro decía que con la compuerta cerrada «el despliegue es neutro: mismo plazo por defecto». No lo es: el registro queda retenido | Este cuadro, 7.10 |

**Lo que esta tercera revisión no cambió.** El canal de la fecha de terminación, la matriz de
finalidades y las huellas de la segunda ronda siguen como estaban: la revisión los confirmó.
Y el bloque **D** —lo que requiere decisión o ejecución y no corrección textual— sigue abierto:
T3 (commit candidato), T4 (verificación en servidor), T6 (E2E y acta), T7 (reversión probada), T8
(registro operativo del owner), T9 (reconfirmar compuertas), las decisiones J1-J14 del owner en
la sección E, la vigencia del Acuerdo y las evidencias de terceros.

---
## Cuarta revisión: el plan de cierre del abogado (31-oct-2026, noche)

El abogado entregó un plan de cierre con **seis correcciones documentales** (N-1 a N-6) y una
compuerta propia (G0) que las verifica. Las seis están aplicadas **en sus fuentes**, y la
compuerta se comprobó con un verificador propio.

- **N-1 — la nota del modelo del Anexo de Nube.** Decía que el papel de Google por operación, la
  clasificación jurídica, la Circular 002, el RNBD y la evidencia técnica «quedan pendientes de
  validación profesional escrita», lo que contradecía al A2 §5 y al A3 §4. Ahora dice que el papel
  por operación y la clasificación jurídica **están determinados** (Google LLC actúa como
  Responsable del Tratamiento y el flujo es una transferencia internacional a un país con nivel
  adecuado), que la Circular Externa 002 de 2025 **no aplica a este canal**, y que quedan
  pendientes la verificación del RNBD por el owner y la evidencia técnica del canal.
  **Se corrigió en el script que genera el manifiesto**, que es el dueño de ese texto: corregirlo a
  mano en el JSON lo borraba la siguiente vez que se regeneraba. Ese era el motivo por el que la
  corrección de la ronda anterior no había sobrevivido.
- **N-2 — la nota de `subencargados.google`.** Se quitó la cita «; Circular Externa 002 de 2025,
  numeral 2» y quedó «(art. 2.2.2.25.6.1 del Decreto 1074, si el abogado confirma que es exigible
  en una transferencia a país con nivel adecuado)». La Circular aparece en el expediente solo para
  decir que no aplica.
- **N-3 — las seis menciones de la cifra de pruebas.** Decían «2 075 verdes · 1 roja». Ahora dicen
  **2 096 · 2 094 · 0 · 2**; esta suite se ejecutó localmente el 3-nov-2026 en el árbol de trabajo,
  pero falta reproducirla desde un clon limpio vinculado a T3. También explican que `ADVE6.7` **no era un defecto de código**: le faltaba
  la declaración `declaracion_datos_sensibles`, exigida desde el `5534aca7` (📦978); que se
  conservaron `version_kair`, `consent_id:'5'` y `assert.equal(r.status, 201)`; y que **el
  archivo sí se modificó en esa ronda**.
- **N-4 — dos remisiones rotas.** El A2 §5 remitía al «(Anexo de Nube, §5)» —Seguridad— para una
  conclusión que está en el §4 —Proveedores externos—, y el A3 §1 remitía al «§5» por lo mismo.
  Las dos dicen ahora «(según la conclusión de este Anexo)», que no se rompe si se renumera. La
  línea 274 del A3, que es texto del abogado, no se tocó.
- **N-5 — las fechas del manifiesto.** `version`, `actualizado_at`, `anexo_nube.modelo.actualizado`
  y `anexo_encargo.version` quedan en 2026-10-31. Al hacerlo apareció un defecto del script: solo
  refrescaba el `hash` y la `nota` del bloque de la matriz, nunca su `actualizado_at`, así que la
  fecha quedaba vieja aunque la fuente dijera lo contrario. **Se corrigió el script**, no el JSON.
  La tabla de conservación, que también se modificó el 31-oct, quedó con la fecha al día.
- **N-6 — 37 pruebas que no viajaban.** `tests/_adversary-e6e7.test.js` (34 casos) y
  `tests/routes/__test-isolation.test.js` (3 casos) caen en la regla `_*.js` del `.gitignore`: se
  ejecutaban en la suite y **no estaban versionados**, y por eso `git diff` salía vacío y parecían
  archivos que nadie había tocado. Se agregó la excepción al `.gitignore` y los dos archivos
  quedaron versionados (`git ls-files` los muestra).

**La compuerta G0 del abogado, verificada con un comprobador propio:**

| Criterio | Resultado |
|---|---|
| 14/14 filas de la nota sin problemas | OK, y cada fila coincide con los bytes reales |
| `actualizar-manifiesto-v1.4.js --check` | exit 0 |
| Ninguna huella vieja usada como vigente | OK: las dos primeras, 0 apariciones en todo el expediente; la tercera, 3 menciones, las tres explícitamente históricas |
| Las dos frases contradictorias eliminadas | OK |
| Las seis cifras de pruebas iguales | OK, y ninguna línea junta la cifra vigente con «1 roja» |
| N-6 decidido | OK: las 37 pruebas viajan con el repo |
| Batería del `firma-service` | **2 096 · 2 094 verdes · 0 rojas · 2 omitidas**, corrida local 3-nov-2026 (94,8 s); pendiente reproducir desde clon limpio vinculado a T3 |

**Lo que la Fase 0 no mueve.** El cuadro queda en **62 cerrados · 34 pendientes · 0 no aplica ·
96**: estas seis correcciones no crean ni cierran requisitos, hacen que el expediente diga la
verdad. La diferencia con la tabla anterior (63/33) no es un requisito que se abriera: es el
6.11, que pasó a **PARCIALMENTE** (corrida local hecha; faltan el clon limpio y el vínculo a
T3), y así el contador lo cuenta como pendiente en vez de dejar de contarlo. Lo que sí queda
pendiente está en el §8 y en las fases siguientes del plan del abogado.

---

## Quinta revision: la medicion del 12-nov-2026 (34 requisitos)

Esta ronda **midio** los requisitos del cuadro contra el codigo y contra el servidor de
produccion, y escribio el resultado en los informes de `verificacion-cierre/`. Este
cuadro se pone al dia con esa medicion: la palabra de estado de cada requisito medido
es la de hoy, y su cuerpo es el texto del informe, sin reescribirlo.

**Lo que NO se hizo.** Los requisitos que nadie midio **no se tocaron**: siguen con el
estado de la ronda del 30-oct-2026. La tabla resumen se regenera desde el conteo real
(`firma-service/scripts/contar-estados-checklist.js`), no a mano.

**Que pasa con el texto anterior.** El cuerpo de cada requisito medido **reemplaza** la
respuesta de la ronda del 30-oct-2026: este cuadro es un documento vivo y su respuesta es
la de hoy. Lo que decia antes no se borro de la memoria del proyecto: esta en el
historial de git, y las correcciones de cada ronda estan al principio del documento
(segunda, tercera, cuarta y esta quinta revision).

| # | Que se cambio | Donde |
|---|---|---|
| **F-1** | 1.2 Resolver la discrepancia entre la copia recibida y el manifiesto anterior: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 1.2 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-2** | 1.7 Identificar la version y documentar la decision del owner: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 1.7 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-3** | 1.9 Confirmar que no quedan marcadores de borrador, campos juridicos sin resolver ni textos contradictorios: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 1.9 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-4** | 2.1 El owner decide si adopta el Acuerdo v1.4: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 2.1 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-5** | 2.2 El owner decide si adopta el Anexo de Encargo: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 2.2 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-6** | 2.3 El owner decide si adopta el Anexo de Nube: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 2.3 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-7** | 2.5 El owner decide sobre el tratamiento y las finalidades del numeral 10.3: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 2.5 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-8** | 2.7 Se documenta la decision sobre Google LLC y la cuenta Gmail de consumo: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 2.7 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-9** | 2.8 Se verifica el alcance de la Circular Externa 002 de 2025 y la conclusion sobre transferencias internacionales: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 2.8 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-10** | 2.9 Se determina la obligacion de inscripcion en el RNBD o la excepcion aplicable: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 2.9 (evidencia en `verificacion-cierre/secciones-1-2.md`) |
| **F-11** | 3.1 Se valida jurídicamente la tabla supletoria de conservación: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 3.1 (evidencia en `verificacion-cierre/secciones-3-5.md`) |
| **F-12** | 3.2 Se aprueban o modifican los plazos generales de 10 y 5 años: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 3.2 (evidencia en `verificacion-cierre/secciones-3-5.md`) |
| **F-13** | 5.1 Se identifica la cuenta remitente real: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 5.1 (evidencia en `verificacion-cierre/secciones-3-5.md`) |
| **F-14** | 5.5 Se acredita la activación de MFA: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 5.5 (evidencia en `verificacion-cierre/secciones-3-5.md`) |
| **F-15** | 5.6 Se acredita el uso de contraseña de aplicación, sin incorporarla a los documentos ni al repositorio: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 5.6 (evidencia en `verificacion-cierre/secciones-3-5.md`) |
| **F-16** | 6.11 Ejecutar la bateria completa de pruebas del servicio: estado **PARCIALMENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 6.11 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-17** | 7.1 Confirmar la version exacta del codigo que se va a desplegar: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.1 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-18** | 7.3 Ejecutar las migraciones de base de datos necesarias: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 7.3 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-19** | 7.4 Comprobar que las migraciones se aplicaron correctamente: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 7.4 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-20** | 7.5 Verificar el estado de la base de datos y sus respaldos: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.5 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-21** | 7.6 Comprobar los permisos de archivos y directorios: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.6 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-22** | 7.7 Comprobar la configuracion de seguridad del servicio: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.7 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-23** | 7.8 Verificar que no haya credenciales expuestas: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 7.8 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-24** | 7.9 Verificar los registros y mecanismos de auditoria: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 7.9 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-25** | 7.11 Ejecutar pruebas controladas de extremo a extremo: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.11 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-26** | 7.12 Verificar la version y las migraciones en el servidor real: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.12 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-27** | 7.13 Registrar el resultado de la comprobacion del servidor: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 7.13 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-28** | 7.15 Autorizar expresamente la activacion del flujo: estado **PENDIENTE** -> **PENDIENTE**, con la medicion del 12-nov-2026 | Este cuadro, 7.15 (evidencia en `verificacion-cierre/secciones-6-7.md`) |
| **F-29** | 8.1 El owner registra sus decisiones sobre el contenido: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 8.1 (evidencia en `verificacion-cierre/seccion-8.md`) |
| **F-30** | 8.3 El owner define fecha de vigencia y alcance de uso: estado **PENDIENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 8.3 (evidencia en `verificacion-cierre/seccion-8.md`) |
| **F-31** | 8.5 Se completan las verificaciones técnicas de publicación: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 8.5 (evidencia en `verificacion-cierre/seccion-8.md`) |
| **F-32** | 8.6 El representante legal firma la autorización operativa: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 8.6 (evidencia en `verificacion-cierre/seccion-8.md`) |
| **F-33** | 8.8 Se registra quién autorizó, cuándo y bajo qué resultados de pruebas: estado **PENDIENTE** -> **PARCIALMENTE**, con la medicion del 12-nov-2026 | Este cuadro, 8.8 (evidencia en `verificacion-cierre/seccion-8.md`) |
| **F-34** | 8.10 Se actualiza la documentación del proyecto y el registro de cierre: estado **PARCIALMENTE** -> **CERRADO**, con la medicion del 12-nov-2026 | Este cuadro, 8.10 (evidencia en `verificacion-cierre/seccion-8.md`) |

## 1. Integridad y control documental (9 requisitos)

**1.1 · Identificar el archivo definitivo del Acuerdo de uso — CERRADO.**
El archivo definitivo es `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.4.txt`:
73 208 bytes, fin de línea LF, 578 líneas, SHA-256
`7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f`. Es el texto candidato de
esta ronda: la v1.4 con las correcciones C-1 (§3.6(h)), C-2 (§9.2, §9.6 y el ordinal 3 de la
Manifestación de Voluntad), C-3 (§10.8(d)(iv)), J3 (§5.6), J6/D1 (§10.5(f)) y J14-2 (§8.7),
que recogen las recomendaciones recibidas. **El owner aún no ha documentado su decisión de uso
ni se ha publicado**: véase la sección E del checklist y la compuerta del manifiesto.
Está en el árbol de trabajo, sin commitear; el commit candidato se elige en 7.1. La v1.3
queda como histórico (ver 1.8).

**1.2 · Resolver la discrepancia entre la copia recibida y el manifiesto anterior — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** Se busco en todo el expediente de la firma cualquier registro de la medicion de
la copia fisica del Acuerdo que el owner recibio en la ronda del 30-oct (tamano en bytes y SHA-256).
Se comparo con el texto vigente de hoy.

**Evidencia.** `sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md:279-298`
— el requisito ofrece cuatro casos (71 555 B = v1.3, 72 132 B = conversion a CRLF, 57 187 B = v1.1,
69 748 B = v1.2, 73 208 B = v1.4) y pide al owner el tamano y el hash de su copia. Una busqueda de
`copia recibida|72 132|57 187|69 748|discrepancia entre la copia` en
`sgsst-electron-app/docs/gestion-humana/firma-electronica/` **solo devuelve el propio cuadro y su
copia en el paquete (`paquete-abogado-2026-10-30/09-respuesta-al-checklist-de-cierre.md:279`)**: no
hay ninguna medicion registrada. El texto vigente de hoy es otro:
`sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt` (75 961 B, SHA-256
`08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e`), de modo que **ninguna de las
cuatro cifras del cuadro corresponde hoy al texto vigente**.

**Que falta.** Que el owner mida la copia que tiene en la mano y mande **bytes + SHA-256**; con eso
la pregunta se cierra en un paso. Sin esa medicion, la discrepancia de aquella ronda no queda
explicada en el expediente. Opcionalmente conviene registrar que el caso ya es historico: el
Acuerdo vigente es la v1.6 y el manifiesto declara esa huella
(`sgsst-electron-app/firma-service/legal-readiness.json:7-10`).

**Quien lo tiene.** Owner (medir y enviar la cifra). No requiere codigo.

**1.3 · Calcular y verificar SHA-256 del Acuerdo definitivo — CERRADO.**
`7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` (73 208 B, fin de línea
LF), recalculado el 30-oct-2026 sobre el archivo del repositorio. La v1.3 conserva su
huella `49eab0c5f3f0fa7e637843c50988b0f91867fe74ff31222cf8c327beabf4de12` (71 555 B) como
histórico. **El manifiesto ya declara la v1.4**: `acuerdo.archivo:
"scripts/fixtures/acuerdo-v1.4.txt"`, `acuerdo.hash: 7298a943…c585490f`, `acuerdo.version:
"v1.4"`, `publicado: false`. Ese valor es el que debe quedar transcrito en la Constancia
cuando apruebes.

**1.4 · Calcular y verificar SHA-256 del Anexo de Encargo — CERRADO.**
`02651747c5efdb3204e59ee430b3014cbb768b8567da89c63565d1162730d0f7` (86 397 B), recalculado el 1-nov-2026 sobre
`sgsst-electron-app/legal/anexo-encargo.html`, después de la cuarta revisión (plan de cierre del abogado del 31-oct-2026) y de la corrección del tipo social, del §5 y de la conclusión del RNBD (veredicto del abogado del 31-oct-2026). Su copia de
publicación `sitio/anexo-encargo.html` es **byte a byte idéntica**: mismo SHA-256, mismos
86 397 B. El manifiesto ya lo declara: `anexo_encargo.hash: 02651747…30d0f7`, con
`anexo_encargo.estado: "no_firmado"` (el modelo sigue sin firmar). El `SHA256SUMS.txt` del
paquete, reconstruido en esta ronda, lleva **esta misma** huella: ver 1.6.

**1.5 · Calcular y verificar SHA-256 del Anexo de Nube — CERRADO.**
`aec7c40132979990cddbad669a8d4690d8439ddc447059d069cd8d19c83214ca` (59 857 B), recalculado el 1-nov-2026 sobre
`sgsst-electron-app/legal/anexo-nube-v1.0.html`, después de la cuarta revisión (plan de cierre del abogado del 31-oct-2026) y de la corrección del tipo social, del §5 y de la conclusión del RNBD (veredicto del abogado del 31-oct-2026). Su copia de
publicación `sitio/anexo-nube-v1.0.html` es **byte a byte idéntica**: mismo SHA-256, mismos
59 857 B. El manifiesto lo declara en el bloque del modelo (`anexo_nube.modelo.hash:
aec7c401…83214ca`,
`modelo.version: "1.0"`), con `anexo_nube.firmado: false` y `anexo_nube.hash: null`, que es
lo correcto: el modelo sin firmar y el hash de la versión firmada, que aún no existe.

**1.6 · Verificar que SHA256SUMS.txt coincida con los archivos definitivos — CERRADO.**
Verificado hoy: el `SHA256SUMS.txt` del paquete coincidía con **10 de los 11** archivos que
listaba; el que no coincidía era el `11-checklist-definitivo-revision-juridica-y-cierre.md`,
que había cambiado de contenido en esta ronda y cuyo hash declarado quedó viejo. Y, más de
fondo, **los archivos que listaba eran los de la ronda anterior**: el Acuerdo **v1.3**
(71 555 B, `49eab0c5…`), el Anexo de Encargo con la huella `11e7ac23…9a0f0` (84 300 B), el
Anexo de Nube con la huella `af9ee65d…619072` (44 935 B) y la Constancia con la huella
`0f015187…d3a00` (10 800 B) — **cuatro huellas históricas, y ninguna de ellas es la del texto
que se entrega hoy**. Eso es exactamente lo que exigen los puntos **D3** y **D6** de la revisión
jurídica.

**Esta ronda lo regeneró** con `node sgsst-electron-app/firma-service/scripts/armar-paquete-abogado.js`:
el paquete tiene ahora **catorce adjuntos, del 00 al 13**, con su `SHA256SUMS.txt` reconstruido. La adenda 13 sobre RNBD se presenta como precisión informativa. El owner registra la decisión sobre su uso; no afirma que Gesstiar esté exenta.
El script **verifica el manifiesto legal antes de escribir el manifiesto del paquete**: si
la huella del Acuerdo, del Anexo de Encargo, del Anexo de Nube o de la Constancia que declara
`legal-readiness.json` no coincide con el archivo, o si la matriz de finalidades no cuadra, o
si la versión del manifiesto no es la del paquete, **no escribe el `SHA256SUMS.txt` y sale con
código 3**. Esta corrida terminó con **código 0**, o sea: las catorce huellas del paquete
coinciden con los archivos del repo y con lo que declara el manifiesto legal.

**La segunda ronda (31-oct-2026) lo regeneró otra vez**, después de las seis puertas: el Anexo
de Encargo y el Anexo de Nube ya no son los mismos archivos que en la ronda anterior (el A2
pasó de 84 300 B a 85 343 B y el A3 de 44 935 B a 48 161 B), así que el `SHA256SUMS.txt` volvió
a cambiar. **La tercera ronda (31-oct-2026, tarde) lo regeneró una vez más**, después de las
quince correcciones: el A2 pasó de 85 343 B a **86 382 B** y el A3 de 48 161 B a **49 153 B**.
Lo que no cambia es la regla: **la huella que se le pide al abogado sale del manifiesto y se
comprueba contra los bytes que se entregan**, no de lo que diga un texto.

Las huellas que viajan en el paquete, todas verificadas contra el manifiesto:

| Adjunto | Documento | Bytes | SHA-256 |
|---|---|---|---|
| 01 | Acuerdo de uso v1.4 | 73 208 | `7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` |
| 02 | Anexo de Encargo | 86 397 | `02651747c5efdb3204e59ee430b3014cbb768b8567da89c63565d1162730d0f7` |
| 03 | Anexo de Nube v1.0 | 59 857 | `aec7c40132979990cddbad669a8d4690d8439ddc447059d069cd8d19c83214ca` |
| 04 | Constancia de versión y autorización de publicación v1.4 | 9 639 | `3fd45c658e5160e2c63005d348ec1fd200abb5f26593c6adf6aabd0ccd6a736c` |

El paquete no se publica ni se firma: armar el paquete no es aprobar nada.

**1.7 · Identificar la version y documentar la decision del owner — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** La identificacion de la version (que texto se somete y con que huella) y el
registro de la decision del owner (acta interna, Constancia de version y autorizacion, y el registro
append-only de aprobaciones de publicacion en la base de produccion).

**Evidencia.**
- `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:59-76` — la Constancia identifica la
  **v1.6**, su SHA-256 `08e1eb8b...`, el responsable del registro (Javier Robles Fontalvo,
  Representante Legal de Gesstiar S.A.S.) y la fecha **2026-11-11**.
- `sgsst-electron-app/firma-service/legal-readiness.json:15-18` — bloque `constancia`: v1.6, huella
  `aaf68b4e...`, `estado: "no_firmada"`.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103`
  (fila **J1**: «RESUELTO, con cambio de version») y `:115` (fila **J13**: «RESUELTO»).
- Medicion SSH del 12-nov-2026 (13:34 h. Colombia), tabla `gh_firma_aprobaciones_publicacion`:
  **4 filas**, y la id 4 es `v1.6` / `08e1eb8b...` / tipo `OPERATIVA` / «Javier Robles Fontalvo,
  owner de K+AIR» / fecha `2026-11-11`. La tabla es **append-only** (disparadores `no_update` y
  `no_delete` en el esquema), o sea el registro no se puede reescribir.

**Que falta.** Nada: queda cerrado. Dos precisiones para que no se lea mal: (a) las secciones 5 y 6
de la Constancia **siguen vacias por diseno** — la autorizacion operativa vive en
`gh_firma_aprobaciones_publicacion`, no en el documento (misma practica que la Constancia de la
v1.4); (b) esto **no es** aprobacion juridica del abogado: el expediente lo dice de forma expresa en
la Constancia y en el propio encabezado del acta (`:99`).

**Quien lo tiene.** Nadie (cierre del owner). Lo que sigue abierto en el expediente es la ratificacion
externa del abogado, que ya no es de este requisito.

**1.8 · Conservar las versiones anteriores como histórico, sin sobrescribir la constancia de
la v1.1 — CERRADO.**
- **v1.0** (la vigente en producción, sellada): `scripts/fixtures/acuerdo-v1.0.txt`, hash
  `52a490a4f4ce922109d42fa01ac45632cd62d5242bb82bf6e1967ede55710c04`, registrada en
  `scripts/fixtures/acuerdo-ARCHIVO.json` con `fecha_archivado` y `publicada_en_base` del
  20-oct-2026 y la nota de que es inmutable.
- **v1.1** y **v1.2**: `acuerdo-v1.1.txt` y `acuerdo-v1.2.txt` (69 748 B,
  `a74839f9…d6b08`), con sus JSON de cambios y de datos y sus scripts de construcción.
  Ninguna se publicó.
- **v1.3** (histórico desde esta ronda): `acuerdo-v1.3.txt`, 71 555 B,
  `49eab0c5…f4de12`. Es la copia que viaja hoy en el paquete; el manifiesto ya no la
  declara (declara la v1.4, ver 7.2).
  Ojo con esto: la copia **commiteada** (`aa568023`, 📦990) es de 73 056 B y tiene la huella
  `2f8884c3…e71a875`; difieren en cinco párrafos (en la commiteada la clasificación del
  canal de correo ya estaba decidida, y el 3.1 afirmaba que remitentes distintos prueban la
  independencia de los factores). Esa diferencia vive en el árbol de trabajo, sin commitear,
  y se resuelve al elegir el commit candidato (7.1).
- **La Constancia de la v1.1 no se sobrescribió**: la v1.3 y la v1.4 usan un archivo aparte
  (`legal/constancia-aprobacion-acuerdo.html` frente al modelo de la v1.3), y la Constancia
  de esta ronda conserva el antecedente de la v1.1 como condicional.
- El historial completo queda en git: 12 commits tocan `scripts/fixtures/`, desde `1ea32dba`
  (905) hasta `aa568023` (990).

**1.9 · Confirmar que no quedan marcadores de borrador, campos juridicos sin resolver ni textos contradictorios — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Barrido de marcadores (TODO, TBD, FIXME, XXX, PLACEHOLDER, `[PENDIENTE]`,
`[nombre`, `[fecha`, `[...]`) sobre los cuatro textos que hoy gobiernan la relacion; lectura de los
bloques de pendientes de los dos anexos vigentes; y contraste de cada afirmacion de estado del texto
contra la base de produccion y el manifiesto.

**Evidencia.**
- Barrido de hoy sobre los cuatro archivos: **cero marcadores de borrador**. Los unicos aciertos del
  filtro fueron la palabra legal «todo/todos» y la palabra «M&Eacute;TODO DE FIRMA ELECTR&Oacute;NICA
  PACTADO» (Acuerdo v1.6, lineas 75 y 77). La Constancia v1.6 no tiene ni una coincidencia.
- `sgsst-electron-app/legal/anexo-nube-v1.3.html:133-136` — los tres campos `[nombre de la Empresa]`,
  `[NIT de la Empresa]`, `[representante legal de la Empresa]` son **de diligenciamiento por cada
  Empresa** en la copia que firma (el propio texto lo dice), no marcadores sin resolver.
- **Pero hay afirmaciones del texto vigente que hoy son falsas.** `anexo-nube-v1.3.html:809` («su
  suscripcion por ASEPLUS CARIBE S.A.S. es un acto pendiente del owner (P8)») y `:844-846` («Los dos
  actos de esta version 1.3 estan pendientes»); `sgsst-electron-app/legal/anexo-encargo.html:535-536`
  (paso «(ix) la suscripcion de esta version 2026-11-11 ... y su contrafirma») y `:572-574` («esa
  version 1.3 no esta todavia suscrito ni contrafirmado»). La base dice lo contrario: suscripcion
  Nube v1.3 FIRMADA el `2026-11-12T15:38:27.990Z` y contrafirmada el `16:13:54.106Z`; Encargo
  2026-11-11 FIRMADA el `15:40:06.992Z` y contrafirmado el `16:14:31.105Z` (medicion SSH del 12-nov).
- **Y el Anexo de Nube se contradice consigo mismo:** su lead-in de la ficha tecnica
  (`anexo-nube-v1.3.html:565-568`) dice que «los apartados que dependen del estado de la cuenta de
  Google Workspace y de la credencial del servidor ya estan verificados (P2 y P5, cerrados el 10 de
  noviembre de 2026)» y que «los que siguen pendientes se declaran como tales (P6)», pero las filas
  de esa misma ficha dicen «El metodo de autenticacion esta pendiente de decision y de verificacion
  por el owner (P2)» (`:617-618`) y «Estado de la verificacion en dos pasos de la cuenta de correo de
  salida: pendiente de verificacion por el owner (P2) ... no esta verificado» (`:636-640`).
- Documental divergente en el expediente:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/tabla-instrumentos-vigentes-2026-11-09.md:28`
  y `:32` siguen diciendo «**NO suscrito**» para el Anexo de Nube v1.3 y el Anexo de Encargo
  2026-11-11, mientras la fila P8 de esa misma tabla (corregida en el commit `91214c55`) y la base
  dicen que los dos quedaron suscritos y contrafirmados el 12-nov.

**Que falta.** (1) Una **version nueva** de los dos anexos que corrija las afirmaciones caducadas
(«los dos actos estan pendientes», «P2 pendiente de verificacion»): la v1.4 del Anexo de Nube y una
version nueva del Anexo de Encargo. **Un texto ya suscrito no se toca** (regla que el propio
proyecto aplico el 11-nov con la errata: el control de alteracion es posterior a la firma, D. 1074
art. 2.2.2.47.4 num. 2), asi que la via correcta es version nueva con huella propia y firma de
nuevo. (2) Corregir las filas §1 de `tabla-instrumentos-vigentes-2026-11-09.md`, que hoy contradicen
la base. (3) No queda ningun marcador de borrador ni campo juridico sin resolver de fondo: lo que
queda son afirmaciones de estado que quedaron viejas.

**Quien lo tiene.** Equipo (los scripts que generan los textos:
`scripts/corregir-anexo-nube-v1.3.js` y `scripts/corregir-anexo-encargo-2026-11-11.js` son los
duenos del texto) y owner (autorizar la version nueva y volver a suscribir/contrafirmar).

## 2. Decisiones de contenido y protección de datos (12 requisitos)

**2.1 · El owner decide si adopta el Acuerdo v1.4 — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Si la version que hoy esta aprobada es la que el cuadro evaluo, si quedo
publicada y si existe la autorizacion operativa que la exige la compuerta.

**Evidencia.**
- La v1.4 quedo **historica**: la version vigente es la **v1.6** (`sgsst-electron-app/firma-service/
  legal-readiness.json:7-10`; `scripts/fixtures/acuerdo-v1.6.txt`, 75 961 B, `08e1eb8b...`), publicada
  el 11-nov-2026 con `publicado: true`.
- `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103` — fila **J1**:
  el owner aprueba la v1.6 y deja la v1.3, la v1.4 y la v1.5 como historico sin publicar.
- Medicion SSH del 12-nov-2026 (13:34 h. Colombia), tabla `gh_firma_acuerdo_versiones`:
  `v1.6` = **activa** (hash `08e1eb8b...`, `fecha_vigencia_inicio` `2026-11-11T19:51:42.036Z`,
  `creado_por` «Javier Robles Fontalvo, owner de K+AIR»); `v1.5`, `v1.4` y `v1.0` = inactivas. En
  `gh_firma_aprobaciones_publicacion`, la id 4 es la autorizacion operativa de la v1.6 (11-nov-2026).
- Gate `publicacion` medido hoy: **`listo: true`**, 42 items, 40 `ok`, **0 bloqueantes pendientes**,
  1 `aviso` (`empresas_nube`), 1 `no_aplica` (`google_dpa`).

**Que falta.** Nada: queda cerrado. La adopcion esta hecha, publicada y con su autorizacion operativa
registrada (que es lo que el sistema exige para activar una version).

**Quien lo tiene.** Nadie.

**2.2 · El owner decide si adopta el Anexo de Encargo — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Si existe la decision del owner, y si el instrumento quedo adoptado de verdad:
suscrito por la Empresa y contrafirmado por K+AIR, sobre el texto vigente.

**Evidencia.**
- `sgsst-electron-app/firma-service/legal-readiness.json:115-116` — `anexo_encargo.estado:
  "firmado"`, `fecha: "2026-11-12T16:14:31.105Z"`; `:128-129` — `version: "2026-11-11"`, hash
  `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948`.
- Medicion SSH del 12-nov-2026: `gh_firma_anexo_encargo_suscripciones` **id 2** = `900829731`,
  version `2026-11-11`, hash `6308b1f7...` (identico al hash del archivo medido hoy),
  `estado FIRMADA`, `firmado_at 2026-11-12T15:40:06.992Z`, `contrafirmado_at
  2026-11-12T16:14:31.105Z`; ficha de la empresa `anexo_encargo_firmado_at = 2026-11-12T16:14:31.105Z`.
  La suscripcion vieja (id 1, version 2026-11-06) queda **intacta**, como exige el expediente.
- `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:114` — fila
  **J12** con las tres versiones y la ejecucion del 12-nov.
- La suscripcion y la contrafirma son exigidas por el codigo antes de pedir firmas:
  `sgsst-electron-app/firma-service/src/services/empresa.js:1578` (exige `anexo_encargo_firmado_at`).

**Que falta.** Nada para el requisito: la adopcion del texto y su ejecucion estan hechas. Lo que
queda abierto no es de este requisito, sino el alta de **cada nueva Empresa**: sin su Anexo de
Encargo suscrito y contrafirmado, el codigo no le habilita pedir firmas
(`empresa.js:1578`, `:1613`), y ademas su canal de atencion (`canal_pqrs`) y su tabla de retencion
documental (que el codigo **no** puede verificar: es un documento que entrega la Empresa).

**Quien lo tiene.** Nadie para el requisito; para el onboarding de cada Empresa, la Empresa misma
(por la via publica del servicio) y K+AIR (la contrafirma).

**2.3 · El owner decide si adopta el Anexo de Nube — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Lo mismo que en 2.2, para el Anexo de Nube: decision, suscripcion y
contrafirma sobre el texto vigente (v1.3).

**Evidencia.**
- `sgsst-electron-app/firma-service/legal-readiness.json:142-147` — `firmado: true`, `fecha:
  "2026-11-12T15:38:27.990Z"`, `version: "1.3"`, hash `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d`,
  `contrafirmado: true`; `:171-175` — la v1.1 suscrita el 5-nov queda como historica, sin contrafirma.
- Medicion SSH del 12-nov-2026: `gh_firma_anexo_nube_suscripciones` **id 2** = version `1.3`, hash
  `fdd10551...` (identico al del archivo medido hoy), `FIRMADA` el `2026-11-12T15:38:27.990Z`,
  contrafirmada el `16:13:54.106Z`, con acta `050f223a3665cf7d...`; ficha de la empresa
  `anexo_nube_ejecutado_at = 2026-11-12T16:13:54.106Z`.
- `sgsst-electron-app/firma-service/legal-readiness.json:210` — `canales.transaccional.estado:
  "migrado"`.

**Que falta.** Nada para el requisito. Advertencia operativa: el codigo solo exige el Anexo de Nube
**con la compuerta encendida** (`config.exigirAnexoNube`, `sgsst-electron-app/firma-service/src/config.js:202-203`,
y la condicion en `empresa.js:1599-1612`). En produccion esa bandera sigue **apagada** —no se puede
leer su valor porque `/opt/kair-firma/.env` es `600 root:root` y `sudo` pide contrasena-, y por eso
el item `empresas_nube` sale como `aviso` y no bloqueante
(`sgsst-electron-app/firma-service/src/services/readinessLegal.js:1960-1968`). Es decir: **hoy el
servicio permitiria pedir firmas a una Empresa sin el Anexo de Nube**, y eso choca con el propio
Anexo de Encargo, que obliga a suscribirlo junto con el Encargo (J12).

**Quien lo tiene.** Owner (encender `FIRMA_EXIGIR_ANEXO_NUBE` cuando abra a empresas reales, con el
riesgo de que las empresas que no lo tengan susceptibility quedan sin poder firmar) y cada Empresa
(la suscripcion del texto vigente).

**2.4 · Se valida la distribución de roles entre Responsable y Encargado — CERRADO.**
El abogado la validó por escrito en **J5**: «Confirmo: Empresa = Responsable (arts. 1.1,
10.1, 10.9 A1; A2 §1); Gesstiar/K+AIR = Encargado (arts. 3(d) y 3(e) Ley 1581); Cloudflare =
subencargado con DPA v6.4 (A3 §4); proveedor de correo de la Empresa = proveedor del
Responsable, no subencargado (A3 §4)». La única condición que J5 le puso era una: eliminar
de la fila de Google del A2 §5 la mención «y, cuando la empresa lo use, el calendario». Esa
condición **está ejecutada**: el Anexo de Encargo corregido ya no menciona el calendario de
Google (las únicas apariciones de «calendario» son los treinta días calendario de
devolución). Y la misma declaración está en la cabecera del Anexo de Encargo y en el
manifiesto: **Responsable del tratamiento: la Empresa. Encargado: Gesstiar S.A.S.
(K+AIR)**. La regla operativa que la acompaña —el Encargado no sustituye la instrucción de
la Empresa ni la amplía, y K+AIR no usa los datos para finalidades propias no documentadas
ni legitimadas (numeral 10.3, taxativo)— sigue escrita. Lo que sigue pendiente es la
decisión documentada del owner sobre el uso del Anexo (2.2), no la validación de los roles.

**2.5 · El owner decide sobre el tratamiento y las finalidades del numeral 10.3 — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Que la matriz de finalidades (ocho finalidades, dos grupos) este escrita con sus
bases juridicas, y que exista **la decision documentada del owner** sobre ella, que es lo que el
cuadro pedia.

**Evidencia.**
- `sgsst-electron-app/firma-service/config/matriz-finalidades.json` — fuente unica: Grupo A
  (10.3(a) a (g)) con la misma condicion de habilitacion en las ocho filas
  (`:43, :56, :69, :82, :95, :108, :121`) y 10.3(h) en Grupo B con
  `estado_habilitacion: "No habilitada - pendiente de entrega de informacion por la Empresa"`
  (`:134`).
- `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:106` — fila **J4**:
  el owner registra la decision («APLICADO EN EL TEXTO») y las bases las valido el abogado el 30-oct.
- El texto que la contiene quedo adoptado: `sgsst-electron-app/legal/anexo-encargo.html:168-174`
  (Grupo A y Grupo B, con el estado de habilitacion) y `:281-292` (las ocho filas de la matriz
  generada), instrumento que quedo suscrito y contrafirmado (ver 2.2).

**Que falta.** Nada en cuanto a la decision del owner: esta tomada, documentada y el texto que la
lleva quedo adoptado y suscrito. Lo que queda abierto **no es de este requisito**, y conviene no
confundirlo: (a) la **ratificacion escrita del abogado** sobre J4 (y sobre J2, J3, J10 y J11), que el
propio acta marca «PENDIENTE la firma del asesor»; (b) los **datos de cada Empresa** (tabla de
retencion documental, instruccion documentada y datos), que la matriz exige para habilitar el Grupo A
y que la finalidad 10.3(h) sigue esperando; (c) la **tabla supletoria** de conservacion
(`config/tabla-conservacion.json`, `aplicacion.activada: false`), que es J8, no 2.5.

**Quien lo tiene.** Para lo que queda: el abogado (ratificacion escrita) y cada Empresa (sus datos);
el owner, para la parte de su propia acta.

**2.6 · Se valida la matriz de instrucciones de la Empresa y las finalidades del Grupo A y
Grupo B — CERRADO.**
Cada finalidad declara: identificador, literal, grupo, descripción, categorías de datos,
titulares involucrados, base jurídica, quién instruye y con qué fundamento, plazo de
conservación, consecuencia revocatoria y estado de habilitación. Las dos reglas de grupo
están escritas: Grupo A queda sin habilitar en producción hasta validar sus bases e
instrucciones; Grupo B no se activa hasta que la Empresa entregue la información, y ni la
aceptación del Acuerdo ni el solo curso de una firma la habilitan.
**Lo que exigieron J4 y C-2 está hecho, y es código:**
- **La matriz se pone a disposición del Firmante ANTES de la casilla.** El servidor la
  resuelve y la sirve en el contexto público (`publicFlow.js:486` `resolverMatrizFinalidades`
  y `publicFlow.js:516` `registrarPuestaEnDisposicionPoliticas`, que deja la fecha del
  **servidor**, la versión y la huella de la matriz en la fila de la solicitud), y el
  cliente la pinta (`web/firma/app.js:771` `renderMatrizFinalidades`) y **solo habilita la
  casilla de aceptación cuando el Firmante leyó completos los dos textos** —el Acuerdo y la
  matriz— (`web/firma/app.js:746` `actualizarHabilitacionAceptacion`). Si la matriz no
  llega, la casilla no se habilita y la aceptación falla con
  `MATRIZ_FINALIDADES_NO_DISPONIBLE` (`publicFlow.js:693`).
- **El registro de aceptación consigna el alcance, en el mismo acto**
  (`publicFlow.js:711-739`): versión y huella SHA-256 del Anexo de Encargo, versión, huella
  y origen del Anexo de Nube (la firmada por esa Empresa o, en su defecto, el modelo),
  versión y huella de la matriz, **medio** de disposición y **fecha** de esa disposición. La
  migración que lo respalda es `051_alcance_aceptacion.sql`.
- **El bloqueo de J4 está implementado.** `verificarHabilitacionFirma`
  (`src/services/empresa.js:1105-1135`) impide crear solicitudes de firma mientras la
  Empresa no tenga **el Anexo de Encargo firmado**, **el Anexo de Nube firmado con su
  versión y su huella SHA-256** y **el canal de atención declarado**; y una excepción
  operativa no sustituye esa condición documental (`empresa.js:1202-1208`, regla de C-1).
  *Una diferencia, para que conste:* la tercera condición de J4 —la **tabla de retención
  documental inscrita**— no la comprueba el código, porque es un documento que entrega la
  Empresa y que el sistema no puede verificar por sí solo. Queda como requisito documental
  por Empresa, no como hueco de código.

**2.7 · Se documenta la decision sobre Google LLC y la cuenta Gmail de consumo — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Los tres puntos que el cuadro dejo pendientes para el owner: (a) el registro de
las decisiones J1-J14 en la seccion E, (b) las evidencias que J6 exige por Empresa, y (c) la
decision escrita y fechada de la fecha limite de migracion a una cuenta empresarial con acuerdo de
encargo. Ademas, el estado real del canal de correo (Workspace + CDPA) y lo que el texto vigente
afirma sobre el.

**Evidencia.**
- (a) La seccion E del acta esta completa: `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103-116`
  (J1 a J14 resueltos o aplicados) y `:117-122` (D7, P3, P11, C-1, P7). La fila **J6** (`:108`) dice
  «RESUELTO, y CORREGIDO en sus dos afirmaciones previas» y delimita el papel de Google en dos planos.
- (c) La migracion **esta ejecutada y fechada**: el CDPA fue aceptado el 10-nov-2026 y la cuenta
  empresarial esta activa y verificada
  (`sgsst-electron-app/docs/gestion-humana/firma-electronica/decision-regularizacion-correo-2026-11-09.md:31-35`,
  P1/P2/P5 cerrados) y `sgsst-electron-app/firma-service/legal-readiness.json:77-99`
  (`aceptacion` del CDPA: modo `aceptado_por_administrador`, fecha `2026-11-10`, evidencia con hash
  `9d989067...`), `:210` (`canales.transaccional.estado: "migrado"`).
- El Acuerdo vigente ya no dice lo que decia la v1.5: `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt:322`
  (CDPA aceptado el 10-nov), `:359-365` (§10.1 y el papel de Google en dos planos), `:452` y `:456`
  (§10.5(f), sin atribuirle garantias no demostradas).
- (b) **Lo que falta, por Empresa**, esta escrito: `sgsst-electron-app/legal/anexo-encargo.html:524-537`
  enumera lo pendiente con nombre y responsable, entre ello (ii) la evidencia que el regimen de
  transferencias internacionales exija a la Empresa como Responsable, (iii) la declaracion de la
  transferencia en el RNBD a cargo de la Empresa, y (iv) la politica de tratamiento de la Empresa
  que informa al Titular.
- **Pendientes del owner en consolas, a hoy:** P3 (los tres alias `privacidad@`, `soporte@`,
  `incidentes@` de `gesstiar.com`; `decision-regularizacion-correo-2026-11-09.md:378` y
  `tabla-instrumentos-vigentes-2026-11-09.md:95`) y P6 (revocar las app passwords de
  `adminkair@gmail.com`; `decision-regularizacion-correo-2026-11-09.md:381`,
  `tabla-instrumentos-vigentes-2026-11-09.md:98`, y declarado dentro del propio texto en
  `anexo-nube-v1.3.html:627` y `:738`).
- La propia fila J6 (`:108`) anota dos cosas sin cerrar: el articulado del CDPA **no esta en el
  repo** (solo su SHA-256, la captura y la constancia de aceptacion) y `fecha_efectividad_addendum`
  del manifiesto es `null`; y la **ratificacion externa del abogado queda a cargo de Gesstiar**.

**Que falta.** (1) La **ratificacion externa del abogado** sobre J6 (y las demas preguntas
respondidas por el dictamen del 11-nov): owner + abogado. (2) Las **evidencias por Empresa**
(acknowledgment firmado, politica de la Empresa con la transferencia y ficha del RNBD): cada Empresa,
mas el owner en la parte registral (ver 2.9). (3) **P3 y P6**: owner, en la consola de Google.
(4) El texto vigente del Anexo de Nube v1.3 todavia afirma que el metodo de autenticacion y la
verificacion en dos pasos de la cuenta de salida «estan pendientes (P2)»
(`anexo-nube-v1.3.html:617-618` y `:636-640`), cuando P2 se cerro el 10-nov: se corrige con la
version nueva que pide 1.9.

**Quien lo tiene.** Owner (P3, P6, y manages la ratificacion externa), abogado (ratificacion de
J6/J8/J9 y de las preguntas del 11-nov), cada Empresa (sus evidencias).

**2.8 · Se verifica el alcance de la Circular Externa 002 de 2025 y la conclusion sobre transferencias internacionales — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Si el alcance de la Circular 002/2025 quedo verificado y la conclusion escrita en
los textos vigentes, y si existe el documento que J7 condiciono.

**Evidencia.**
- La verificacion esta hecha **en fuente oficial** y escrita: la conclusion juridica esta en
  `sgsst-electron-app/legal/anexo-nube-v1.3.html:396-412` («Conclusion juridica: la Circular Externa
  002 de 2025 no aplica a este canal, porque su ambito son los procesos de transferencia de
  tecnologia y el uso de una cuenta de correo para enviar un codigo OTP no es una transferencia de
  tecnologia»), con la misma condicion en
  `sgsst-electron-app/legal/anexo-encargo.html:528-530`.
- La fila **J7** del informe al asesor lo declara sin cerrar:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:109`
  («**PENDIENTE:** si K+AIR se presenta como proveedor de una tecnologia que permite el tratamiento de
  datos personales, debe documentar el cumplimiento de la Circular 002 de 2025; y el estado de
  inscripcion de Gesstiar en el RNBD lo verifica el owner»). En el acta del owner:
  `11-checklist-definitivo-revision-juridica-y-cierre.md:109`, **J7 = PENDIENTE**.
- **El documento que falta no existe.** Una busqueda de
  `responsabilidad demostrada|caracterizaci[oó]n de las funcionalidades|protecci[oó]n desde el dise[ñn]o|garant[ií]as contractuales`
  en todo `sgsst-electron-app` solo devuelve el propio cuadro (`respuesta-checklist-cierre-2026-10-30.md:602-605`)
  y las evaluaciones de canal de correo; **ningun documento reune las caracterizaciones** que la
  Circular exige (1.1, 1.2, 1.3, 2.1-2.4, 3.1-3.3, 4.1-4.4).
- El Anexo de Encargo lo dice con nombre y responsable:
  `sgsst-electron-app/legal/anexo-encargo.html:526-527` — pendiente (i), «el documento que demuestra las
  medidas de seguridad del canal de correo, que es la responsabilidad demostrada del parrafo primero
  del Titulo V».

**Que falta.** (1) **La decision del owner** sobre si K+AIR se presenta ante sus Empresas como
proveedor de una tecnologia que permite el tratamiento de datos personales: de esa decision depende
que la Circular 002/2025 entre o no en el ambito. (2) Si la respuesta es si, **el documento que reuna
las caracterizaciones** (el "documento que lo reuna" que el propio Anexo de Nube nombra) y el
**documento de seguridad del canal** que demuestra la responsabilidad demostrada del Titulo V.
(3) Lo que el RNBD exija (2.9). Con lo que hay hoy, la compuerta tecnica no bloquea: el gate
`publicacion` dio `listo: true` con 0 bloqueantes.

**Quien lo tiene.** Owner (la decision de encuadre y la orden de redactar); abogado (el contenido
juridico del documento); equipo (redaccion). No bloquea la apertura tecnica, pero es la exposicion
juridica mas grande que queda viva en la seccion.

**2.9 · Se determina la obligacion de inscripcion en el RNBD o la excepcion aplicable — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-1-2.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** La tabla registral del Anexo de Nube v1.3 (los cuatro puntos que el cuadro
dejo pendientes) y su estado real hoy.

**Evidencia.**
- `sgsst-electron-app/legal/anexo-nube-v1.3.html:414-481` — la tabla del RNBD. Punto 1 (naturaleza
  juridica): «el certificado de existencia y representacion de la Camara de Comercio de Barranquilla
  ... **sigue sin estar adjunto**» (`:430-434`). Punto 2 (activos totales): «Evidencia documental
  pendiente: el balance del primer ejercicio, que aun no existe» (`:444-445`); la cifra de
  $1.000.000 COP (19,09 UVT) es «una declaracion del owner y no sustituye los estados financieros»
  (`:457`). Punto 4 (estado del registro): «Evidencia documental pendiente: la consulta al portal de
  la SIC que confirme la ausencia de inscripcion, que el owner debe adjuntar» (`:470-471`).
- `:475-481` — «**Estado del registro en el RNBD: pendiente de verificacion por el owner.** Este Anexo
  no afirma que una transferencia este declarada en el RNBD ni que la declaracion sea o no exigible».
- `11-checklist-definitivo-revision-juridica-y-cierre.md:109` — fila **J7 = PENDIENTE**: «falta el
  certificado societario y los estados financieros».
- El criterio esta escrito y es favorable si se confirma: con la UVT 2026 de $52.374, el umbral de
  100.000 UVT del art. 2.2.2.26.1.2 del Decreto 1074 equivale a $5.237.400.000 COP y los activos
  declarados quedan «5.237 veces por debajo» (`anexo-nube-v1.3.html:452-459`).

**Que falta.** Tres documentos, todos del owner: (1) el **certificado de existencia y representacion**
de la Camara de Comercio de Barranquilla; (2) los **estados financieros / balance** del primer
ejercicio con sus notas, a la fecha de corte; (3) la **consulta al portal de la SIC** que confirme el
estado del registro en el RNBD. Con (1) y (2) se cierra la excepcion por umbral; si el owner decide
inscribirse, la **declaracion de la transferencia internacional** es de la **Empresa** como
Responsable, no de K+AIR.

**Quien lo tiene.** Owner (los tres documentos y la decision de memoria). El abogado, para la
calificacion final del umbral. La Empresa, la declaracion de la transferencia, si aplica.

**2.10 · Se valida que no se atribuyan a Google compromisos contractuales o garantías que no
estén demostrados — CERRADO.**
El Anexo de Nube **no** declara DPA empresarial, **no** declara subencargo contractual, **no**
declara contrato de transmisión y **no** declara Normas Corporativas Vinculantes. La
ficha de Google en §4 dice «Responsable del Tratamiento en esta operación» y conserva
íntegra la advertencia de que no hay DPA. El §8, corregido en esta ronda, condiciona la
entrega de los informes de Cloudflare a que el proveedor los ponga a disposición y a que su
disponibilidad no altere las obligaciones del Anexo — ya no promete certificaciones que
puedan no existir. El manifiesto lo tiene en false: `dpa: false`, `auditoria: false`,
`evidencia: null`. Y el Acuerdo lo dice en su propio texto (numeral 8.6): no se atribuye a
Google «plazos de conservación que no haya verificado». El §3 del Anexo deja por escrito
que, si más adelante se contrata un servicio empresarial con acuerdo de encargo, el Anexo
se actualiza.

**2.11 · Se revisa el envío de documentos firmados en papel como adjuntos de correo —
CERRADO.**
La firma en papel está ofrecida y operativa: el sistema registra «Opción de firma en papel
ofrecida» con canal `correo`. La regla del canal está escrita: por OTP **no** se envía
ningún documento laboral completo y el correo no incluye documentos de identidad ni datos
sensibles, **con una excepción documentada**: la copia en papel con su registro de firma
autográfica, que va en su propio mensaje y no en el OTP. Al recibir el correo de la copia en
papel, el destinatario puede usarla para obtener la copia física del documento firmado.
El abogado lo aprobó en **J10**: el diseño es jurídicamente correcto, no afirma dos factores,
y la firma autográfica sobre papel no tiene costo ni consecuencias adversas (7.3).

**2.12 · Se valida el tratamiento de datos sensibles y el procedimiento ante cargas
accidentales — CERRADO en el código y en el procedimiento escrito (la validación del texto
va con 2.1).**
El 10.8(d) está implementado: el canal de incidentes de salud (`incidenteSalud.js`,
`admin-incidentes.js`) bloquea la solicitud y registra el reporte. Hoy, 30-oct, se
agregaron las dos etiquetas que faltaban para que la línea de tiempo muestre el evento con
nombre propio en vez del dato crudo: «Carga accidental de datos de salud» e «Incidente de
datos de salud resuelto».
**El procedimiento escrito existe:**
`docs/gestion-humana/firma-electronica/procedimiento-incidentes-datos-salud-2026-10-30.md`
(29 197 B). Tiene el plazo legal de quince (15) días hábiles (RNBD, numeral 2.1, literal
f), ii), el criterio de calificación del hecho y la plantilla de comunicación a la Empresa
sin adjunto ni enlace de descarga. **La corrección obligatoria de J11 está aplicada en el
texto (10.8(d)(iv) de la v1.4):** K+AIR, en su calidad de Encargado, cumple por sí mismo el
deber del artículo 18, literal k), de la Ley 1581 de 2012 e informa a la Delegatura cuando
el hecho configure una violación de los códigos de seguridad del servicio; ese deber es
propio del Encargado y no se desplaza a la Empresa.
**Lo que queda pendiente es del owner y está escrito en el propio procedimiento:** cuatro
campos por confirmar —la persona o área de la Delegatura y su contacto, el usuario y las
credenciales de Gesstiar en el aplicativo, la cuenta desde la que se reporta, y quién firma
el reporte—, más **qué días hábiles se cuentan**, porque el repositorio no tiene calendario
de hábiles. Con esos cinco datos el procedimiento queda completo; sin ellos, se declara
operativo y no cumplido. La migración 049 y el procedimiento de supresión posterior están
cubiertos en la sección 3.

---

## 3. Conservación, retención y supresión (13 requisitos)

**3.1 · Se valida jurídicamente la tabla supletoria de conservación — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-3-5.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Qué se verificó.** Si la tabla supletoria de conservación está escrita y es de verdad la fuente
única del plazo por defecto, y si existe en el expediente la validación jurídica **escrita** que el
propio archivo declara como condición para abrir su compuerta de activación.

**Evidencia.**
- `sgsst-electron-app/firma-service/config/tabla-conservacion.json:1-12` — el archivo existe y
  lleva su propia compuerta: `estado` = `"PROPUESTA. Los plazos de diez (10) y cinco (5) años NO se
  activan en produccion hasta que el abogado los valide..."` (`:4`), y dentro de `aplicacion`:
  `activada: false` (`:6`), `estado: "PROPUESTA"` (`:7`), `validado_por: null` (`:8`),
  `validado_at: null` (`:9`). La nota del mismo bloque (`:10`) dice, literalmente, que cambiar
  `activada` a `true` "es un acto expreso del owner, con la validacion escrita del abogado sobre
  los plazos de diez (10) y cinco (5) anos: ni el codigo ni una actualizacion automatica lo hacen".
- **La fuente única es real y se verificó en código, no por afirmación.** `src/services/retencion.js:414`
  la declara "fuente ÚNICA", `:469` fija la ruta del archivo, `:518` la carga
  (`tablaConservacion()`), `:560` y `:938` la consultan al calcular cada firma; el respaldo
  congelado en código también arranca cerrado (`:474-487`, con `activada: false` en `:483`). La
  sección 8 del Anexo de Encargo se genera del mismo archivo:
  `scripts/generar-anexo-encargo.js:16` ("`config/tabla-conservacion.json` -> la tabla de
  conservacion (E2)"), `:62` (`CONFIG_TABLA_REL`) y `:664-679` (el generador **falla** si la
  tabla no trae sus categorías). Es decir: el Anexo y el código no pueden desincronizarse en los
  plazos, como afirma el cuadro.
- **Medición SSH del 12-nov-2026 (13:50 h. Colombia)** sobre
  `/opt/kair-firma/app/config/tabla-conservacion.json`: `activada=False`, `estado=PROPUESTA`,
  `validado_por=None`, y `DOCUMENTO_FIRMADO=3650` días. El archivo del servidor es el mismo del
  repositorio (hash idéntico).
- **Lo que sí existe del lado del abogado** es una validación **condicionada**, no la validación
  final que el archivo exige:
  `paquete-abogado-2026-10-30/00-revision-juridica-del-abogado-2026-10-30.txt:125-138` — J8 marca
  la casilla "Validar con condiciones" (`:126`), razona que "Valido 10 y 5 años como topes de
  custodia, no como plazos legales" (`:128`), y en `:132` pone el orden de cuatro pasos y la
  evidencia que exige: "Evidencia: tabla de la Empresa por escrito; pruebas de cómputo desde el
  cese, de la categoría no clasificada, del hold, de la copia pendiente y de la lápida; evidencia
  de purga de respaldos; **confirmación escrita de la alineación del catálogo legado**" (`:138`).
- **Pero el acta interna del owner del 11-nov sigue marcando J8 como PENDIENTE:**
  `paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:110` — "Los
  plazos de **diez (10)** y **cinco (5)** años siguen sin validarse:
  `config/tabla-conservacion.json` está en estado `PROPUESTA` y `aplicacion.activada` es `false`,
  así que **no se activan en producción** hasta que el asesor los valide por escrito". La fila T9
  (`:95`) exige verificar `aplicacion.activada` en `false` "hasta completar decisiones y
  evidencias", y el plan del 31-oct lo repite.
- La ratificación externa que el expediente pide sobre J8 sigue abierta:
  `docs/gestion-humana/firma-electronica/dictamen-legal-errata-textos-2026-11-11.md:215-218`
  (J6, J8 y J9 pendientes de ratificación externa).
- **Esto no bloquea la apertura técnica.** El gate `readinessLegal.js` no tiene ningún ítem que
  mida la compuerta: el control del grupo n86 mide el texto y el código del piso de veinte años
  (`src/services/readinessLegal.js:1562-1601`, ítems `codigo_20` en `:1564` y `texto_20` en
  `:1587`), y `_codigoRetencion` (`:508-529`) es un control **textual** sobre `retencion.js`
  (expresiones regulares: `ANIOS_CUSTODIA = 20`, `2.2.4.6.13`, `hold: true`) que **no lee**
  `aplicacion.activada`. Medición SSH del 12-nov con copia consistente de la base (los tres
  archivos `.sqlite`, `-wal` y `-shm`): gate `publicacion` → `listo=true`, 42 ítems, 40 ok, 0
  pendientes, 0 bloqueantes pendientes; gate `primera_firma` → idéntico.

**Qué falta.** (1) La **validación escrita del abogado** sobre los plazos de diez (10) y cinco (5)
años que la propia nota del archivo exige, con la evidencia que el mismo J8 enumera (`:138`): la
tabla de retención documental de la Empresa, las pruebas de cómputo desde el cese, la categoría no
clasificada, el hold, la copia pendiente, la lápida y la purga de respaldos. (2) El **acto expreso
del owner** que pone `aplicacion.activada` en `true` y llena `validado_por` y `validado_at` con
datos reales (hoy los dos son `null`). (3) La **ratificación externa** de J8/J9. Ninguno de los
tres es un desarrollo: son actos y documentos.

**Quién lo tiene.** Owner (el acto expreso sobre la compuerta y la gestión de la validación
externa) y abogado externo (la validación escrita y la ratificación). El equipo solo puede
acompañar con la evidencia técnica ya reunida.

**3.2 · Se aprueban o modifican los plazos generales de 10 y 5 años — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-3-5.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Qué se verificó.** Si los plazos generales de diez (10) y cinco (5) años están escritos en la
tabla, si el abogado los validó, y si el **orden de cuatro pasos que fijó J8** está cumplido. Y en
particular: si el comportamiento legado de veinte (20) años desde la firma que el cuadro describe
como vigente **sigue existiendo en el código**.

**Evidencia.**
- **Los plazos están escritos y el abogado los validó con condiciones.** En
  `config/tabla-conservacion.json`: `DOCUMENTO_FIRMADO` con `plazo_dias: 3650` y `punto_inicio:
  fecha_firma` (`:17-19`), y las tres categorías de cinco (5) años con `plazo_dias: 1825`
  (`:40-42` registro de operaciones, `:51-53` solicitudes y comunicaciones, `:61-65` lápida y
  recibo). El abogado: "Valido 10 y 5 años como topes de custodia, no como plazos legales"
  (`00-revision-juridica-del-abogado-2026-10-30.txt:128`).
- **El paso (ii) del orden de J8 ya está hecho en el código, y el cuadro canónico describe mal la
  situación.** J8 (`:132`) exigía "alinear el catálogo legado al orden de precedencia del 8.6(a)"
  porque, con la compuerta cerrada, se aplicaban veinte (20) años desde la firma a todo, con
  fuente `catalogo_sistema`. Hoy:
  - Búsqueda de `catalogo_sistema` en todo `firma-service/src/`: **0 coincidencias**. El catálogo
    legado de veinte años **ya no existe en el código**.
  - `src/services/retencion.js:1021-1026` — la rama de compuerta cerrada dice literalmente: "La
    tabla supletoria no está activada. Se conserva temporalmente con fecha de supresión nula; **no
    se inventa el fallback histórico de 20 años desde la firma** ni se adelanta la tabla pendiente
    de aprobación", y fija `fuente = 'tabla_supletoria_pendiente'`.
  - El orden de precedencia que J8 pedía está implementado en `retencion.js:963-1008`: (b) piso
    legal → (c) plazo declarado por la Empresa → (d) tabla supletoria; el piso de veinte años del
    SG-SST se cuenta desde el cese (`:986-997`), y el registro sin categoría clasificable queda
    retenido, no con plazo por defecto.
  - **Medición SSH del 12-nov-2026** sobre `/opt/kair-firma/data/firma.sqlite` (sqlite3 en modo
    `ro`): distribución de `plazo_conservacion_fuente` en `gh_firmas_electronicas` =
    `[(None, 4), ('tabla_supletoria_pendiente', 1)]`. **Cero filas con `catalogo_sistema`**: en
    producción no se aplicó nunca el comportamiento que el cuadro describe.
  - Residuo de texto: el comentario de `retencion.js:949-951` todavía afirma que en el camino de
    compuerta cerrada "el plazo corre desde la firma (que es lo que hace el catálogo)", frase que el
    propio `:1023` contradice. Es un comentario, no comportamiento, pero es lo que llevó a escribir
    el texto del cuadro.
- **Consecuencia documental:** las afirmaciones del cuadro en
  `respuesta-checklist-cierre-2026-10-30.md:902-905` ("Con la compuerta cerrada, el comportamiento
  legado aplica veinte (20) años desde la firma para categorías generales, con la fuente
  `catalogo_sistema`") y `:976` (el paso (ii) "pendiente") **hoy son falsas**. El 3.6 del mismo
  cuadro repite la misma premisa.
- **Lo que falta del orden de J8:** el paso (iii), reejecutar las pruebas (requisito 6.11), no
  está acreditado en el expediente —en esta verificación no se corrió la suite del `firma-service`,
  por límite de alcance—; y el paso (iv), abrir la compuerta con validación escrita, está
  incumplido por lo que dice 3.1.

**Qué falta.** (1) La **aprobación** de los plazos: el J8 del acta del 11-nov sigue PENDIENTE
(`11-checklist-definitivo...:110`), la compuerta está apagada y no hay acto del owner ni
validación escrita del abogado. (2) La **reejecución de las pruebas** del 6.11 después del cambio
del código de retención, con su registro. (3) La **apertura de la compuerta** con
`validado_por` y `validado_at` reales, que es el paso (iv) y el único que puede hacer que los
plazos 10/5 apliquen. (4) **Corregir el texto del cuadro canónico** (3.2 y 3.6), que describe un
comportamiento que el código ya no tiene: si alguien lo usa como mapa, va a buscar un catálogo
que no existe.

**Quién lo tiene.** Owner (la decisión y el acto de apertura) y abogado externo (la validación
escrita). El equipo, para la reejecución de las pruebas y para corregir el cuadro.

**3.3 · Se conserva el mínimo legal de 20 años para los registros SG-SST que correspondan —
CERRADO.**
`retencion.js` define el piso legal como `{ base: 'cese', anios: 20, norma: NORMA_SST }`.
Ninguna tabla puede bajarlo: el piso se aplica por encima del plazo declarado por la
Empresa y por encima del plazo por defecto. Cubierto por `tests/conservacion-purga.test.js`
y `tests/services/conservacion-supletoria.test.js`.

**3.4 · Se valida el tratamiento de los contratos laborales y sus anexos firmados —
CERRADO.**
El 8.6(c) asigna a los contratos y sus anexos firmados electrónicamente un **hold mientras
subsista la relación laboral** (`conservacion.js:418`). Cubierto por
`tests/conservacion-deber-legal.test.js`.

**3.5 · Se establece correctamente el inicio del cómputo de cada plazo — CERRADO.**
Hay tres puntos de inicio distinguidos, y el sistema nombra el que aplica en el texto que
ve el Trabajador: desde la firma (`NOMBRE_INICIO_FIRMA = 'la fecha de la firma'`), desde el
cese de la relación laboral (para el piso del SG-SST) y el que declare la Empresa. Se
corrigió el fallback que sustituía un cese desconocido por la firma: ahora queda pendiente
de informar y validar el cese, sin fecha de supresión calculada. **El abogado aprobó esa
regla en J9** («la fecha de firma NO sustituye la fecha de cese; el registro queda pendiente y
sin fecha de supresión calculada»), con una condición que también está aplicada en el texto:
la Empresa debe comunicar por el canal que el Encargado habilite en el servicio la fecha de
terminación de la relación laboral (literal en A2 §6).

**Ese canal existe: la condición de J9 no quedó en el texto, quedó en el código.**
- **La puerta que recibe la comunicación:** `POST /internal/admin/empresas/:id_empresa/fecha-terminacion`
  (`src/routes/admin-empresas.js`), con `X-Admin-API-Key` y el actor y el motivo por los
  headers `X-Admin-Actor` / `X-Admin-Motivo`.
- **El registro con su evidencia:** `gh_firma_fecha_terminacion` (migración 052) guarda la
  fecha, la evidencia de la comunicación, el canal por el que llegó, quién la registró y
  cuántas filas recibieron la fecha. **Sin evidencia no hay registro**: el servicio rechaza la
  comunicación y no escribe nada.
- **La bitácora de la operación:** `gh_firma_fecha_terminacion_eventos` (migración 053), de
  solo anexado: los disparadores `BEFORE UPDATE` y `BEFORE DELETE` abortan la operación. La
  inmutabilidad se prueba aplicando esa migración a una base en memoria.
- **El recálculo acotado:** la comunicación recalcula el plazo **de las filas del trabajador
  comunicado y solo de esas** (`opciones.firmas` en `conservacion.js`). Las filas de otro
  trabajador no se mueven, y un plazo ya calculado queda congelado.
- **Lo que no se inventa:** mientras la fecha no llega, la fila sigue retenida, sin fecha de
  conservación y sin fecha de supresión, y la fecha de firma no la sustituye. El *hold* sin
  término del contrato (8.6(c)) no se levanta por este camino: su motivo no es recalculable.
- **La revisión periódica:** `GET /internal/admin/empresas/:id_empresa/fecha-terminacion/pendientes`
  lista las filas que esperan la fecha y las que tienen la fecha con el recálculo pendiente.
  Eso es lo que hace verdad la frase «se revisa periódicamente» del Anexo de Encargo §6.
- **El documento crudo no queda en la base:** se guarda el seudónimo del trabajador con el
  ámbito de la Empresa (`psn1_…`), igual que en el resto del sistema.
- **Prueba:** `tests/fecha-terminacion-canal.test.js` (16 pruebas, 16 en verde).

**3.6 · Se aplica la precedencia de reglas legales especiales, tabla de la Empresa y tabla
supletoria K+AIR — CERRADO.**
El 8.6(a) fija el orden, y el código lo sigue: (a) el hold sin término, (b) el piso legal,
(c) el plazo que declara la Empresa, (d) a falta de plazo declarado, el plazo por defecto de
la tabla supletoria. Implementado en `retencion.js` y `conservacion.js`. El 10.6 del
Acuerdo dice lo mismo en el texto. Ojo con el alcance: la precedencia está implementada,
pero mientras la compuerta siga cerrada el plazo por defecto **no se aplica**: el registro
queda retenido, sin fecha de supresión, con el *hold* `tabla_supletoria_pendiente_validacion`,
salvo las excepciones legales que no dependen de la tabla (el piso del SG-SST desde el cese y
el *hold* sin término del contrato). El código **ya no aplica** el catálogo legado de veinte
(20) años desde la firma: lo que queda por alinear son los registros ya calculados con el
catálogo vigente, que es el paso (ii) del orden de J8 (ver 3.2), y la prueba de que ya no
contradice el 8.6(a), (b) y (h) es el paso (iii) (6.11).

**3.7 · Se comprueba que cada documento tenga categoría, plazo, fundamento y fecha de inicio
— CERRADO.**
La migración 049 agrega cuatro columnas a `gh_firmas_electronicas`:
`categoria_conservacion`, `plazo_conservacion_dias`, `plazo_conservacion_fuente` (de dónde
salió: `empresa` o `catalogo_sistema`) y `fecha_inicio_conservacion`. Queda congelado en la
fila **qué** plazo se aplicó, **de dónde** salió y **desde** qué fecha se contó, que es lo
que permite responder «por qué este documento se suprime en esta fecha» sin reconstruir la
historia del sistema.

**3.8 · Se verifica que los cambios de la tabla no modifiquen automáticamente plazos ya
calculados — CERRADO.**
Una firma con fecha de conservación es un registro histórico y su plazo queda congelado:
cambiar la tabla no mueve un documento ya firmado. Cubierto por
`tests/conservacion-8-6-h.test.js`.

**3.9 · Se exige operación expresa, autorizada y auditada para recalcular plazos — CERRADO.**
El recálculo no es un efecto colateral de editar la tabla: es una operación con actor, y
queda en la bitácora, que es de solo anexado.

**3.10 · Se comprueba que no se suprima información con un deber legal o contractual vigente
— CERRADO.**
El 8.6(d): mientras subsista el deber legal o contractual, el registro queda retenido por
esa razón y no se suprime. Cubierto por `tests/conservacion-deber-legal.test.js`.

**3.11 · Se comprueba que las solicitudes de copia pendientes y los holds impidan la
supresión cuando corresponda — CERRADO.**
El 8.6(e) exige que concurran las cuatro condiciones, y las dos de bloqueo están probadas en
las dos direcciones: la copia **pendiente** bloquea y la copia **atendida** la desbloquea
(«8.6(e)(iii) · la copia ATENDIDA desbloquea la supresión», verificado en la corrida de
hoy). El hold vigente bloquea mientras exista.

**3.12 · Se generan correctamente la lápida y el recibo de supresión — CERRADO.**
`supresion.js` y `reciboSupresion.js`; la lápida identifica la solicitud, la fecha y hora,
las categorías suprimidas y el fundamento del plazo. Cubierto por
`tests/recibo-supresion.test.js`.

**3.13 · Se comprueba que la evidencia de aceptación conserve su plazo aplicable — CERRADO.**
El 12.7 con las migraciones 047 (`prueba_aceptacion_supresion`) y 048
(`prueba_aceptacion_append_only`): la prueba de aceptación sobrevive a la supresión de los
demás registros, es de solo anexado y se rige por el plazo del documento asociado.

---

## 4. Seguridad y funcionamiento del flujo de firma (14 requisitos)

Las catorce fuentes de esta sección están implementadas y probadas. La evidencia es la tabla
de correspondencia (adjunto 5), que da el archivo y la línea de cada una, y los tests que
las cubren.

**4.1 · El firmante visualiza el Acuerdo y su versión antes de aceptarlo — CERRADO.**
`web/firma/app.js:751`.

**4.2 · Se registra la aceptación vinculada al texto y su huella SHA-256 — CERRADO.**
`src/services/publicFlow.js:1794` y `:719`. La aceptación queda atada al texto, no a un
número de versión suelto. **Y lo que J3 y C-2 añaden a ese registro ya está en el código**:
el mismo acto de aceptación consigna la versión y la huella SHA-256 de los dos anexos, el
medio y la fecha de puesta a disposición de las políticas y la versión y la huella de la
matriz (`publicFlow.js:711-739`, con la migración `051_alcance_aceptacion.sql`). Ver 2.6.

**4.3 · Las políticas de seguridad se muestran antes de su aplicación — CERRADO.**
Tu decisión T2, convertida en el numeral 5.6: las políticas solo obligan si fueron informadas
y se pusieron a disposición **antes** de su aplicación. `web/firma/app.js:778` y
`publicFlow.js:239`. El 5.6 de la v1.4 añade el detalle que exigía J3 —el **medio concreto**
de la puesta a disposición y su **fecha**, que no puede ser posterior a la fecha de
aceptación— y eso ya se registra en el servidor, con su fecha propia
(`publicFlow.js:516-575`, evento `POLITICAS_PUESTAS_A_DISPOSICION`).

**4.4 · Se conserva la versión, el texto aceptado y la fecha y hora — CERRADO.**
`publicFlow.js:1798`; y el 3.6(b) del Acuerdo lo exige. Una versión nueva no altera las
aceptaciones ya registradas.

**4.5 · Se comprueba la identificación del firmante — CERRADO.**
El tipo y el número de documento se comparan con HMAC-SHA-256 y clave secreta y **no se
conservan en texto claro** (migración 019). Sin verificación no hay firma.

**4.6 · Se comprueba el envío y validación del OTP — CERRADO.**
El 3.4(e): el OTP es el dato de creación de la firma; se registra su emisión y su
validación sin conservarlo en texto claro.

**4.7 · Se comprueba que el medio de OTP cumple el control del dominio corporativo —
CERRADO.**
El sistema comprueba si el medio al que sale el código pertenece a un dominio que la Empresa
pueda leer, y **rechaza la solicitud de manera incondicional**: no existe ninguna opción que
lo desactive, y en ese caso se ofrece la firma autográfica sobre papel.
`publicFlow.js:1161`, cubierto por `tests/d02-medio-otp.test.js`. **Lo que el abogado
aclaró en J10 y hay que tener presente:** la variable `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` **no es
un interruptor**. Desde la v1.2 del Acuerdo (27-oct-2026) **no se lee en ningún sitio del código**
(`src/config.js:176` la conserva solo para no romper despliegues que ya la tengan definida) y su
valor **no cambia ningún comportamiento**: el rechazo del buzón corporativo es incondicional
(`src/services/publicFlow.js`, función `_controlarMedioCorporativo`) y cada caso rechazado queda
como evento `OTP_MEDIO_CORPORATIVO` en `gh_firma_eventos`, que es de solo anexado.
Lo que sí faltaba era el **caso real en producción**: el inventario de buzones corporativos se había
ejecutado sobre **población vacía** (0 solicitudes revisadas el 26-oct-2026). Ese caso **se produjo
el 12-nov-2026** contra el **código desplegado**, sobre una copia aislada de la base, con su asiento
(evento id 151, `2026-11-12T18:57:58.217Z`, resultado `rechazado`) y con producción intacta
(`verificacion-cierre/t6-caso-buzon-corporativo.md`). Lo que queda para acreditarlo **en
producción** es que el caso ocurra en la base de producción, con una empresa real: es parte de la
ronda de pruebas de extremo a extremo (7.11) y del M.3 del mapa de la meta.

**4.8 · Se comprueba que el OTP no se puede alterar ni corregirse indebidamente — CERRADO.**
El aviso `OTP_MEDIO_CORPORATIVO` es de solo anexado: no se corrige ni se altera; lo único
que se le puede hacer es suprimirlo en la ventana del 8.6, con la lápida y el recibo.

**4.9 · Se comprueba la expiración, bloqueo y revocación de enlaces — CERRADO.**
El 3.4(c) fija la vigencia del token; hay rotación de tokens (migración 026) y revocación
con actor y motivo (`ADVE7.2.13` revoca con motivo solo espacios → 400;
`ADVE7.2.14` revoca con la llave interna en el header equivocado → 401; ambos verificados
hoy). La reemisión **no** revoca los tokens anteriores, porque el 3.4(c) lo impide: el aviso
queda registrado («8C: se pidió NO revocar los tokens anteriores; el 3.4(c) lo impide»).

**4.10 · Se comprueba el registro de eventos relevantes del proceso — CERRADO.**
La bitácora es de **solo anexado** en la base de datos, con disparadores que impiden las
sentencias de actualización y de eliminación (migración 020 y sus cinco equivalentes por
tabla). Cubierto por `tests/eventos-append-only.test.js`.

**4.11 · Se comprueba la integridad del PDF firmado y sus evidencias — CERRADO.**
En el piloto real del 26-oct-2026 se verificaron por hash los cuatro archivos: original
`b7d6f08a`, firmado `188bf065`, evidencia `8db98db0` y manifestación `2b1ba3d3`; los tres
archivos en disco dan exactamente esos hashes, y la bitácora tiene los 14 eventos con el
`CONSENT_ACCEPTED` anterior al `MANIFESTATION_RECORDED`.

**4.12 · Se comprueba que la identificación del representante legal solo muestre los últimos
cuatro dígitos en la pantalla correspondiente — CERRADO, con dos barreras.**
La primera es el servidor: `publicViewFor()` ya devuelve el valor enmascarado. La segunda se
agregó hoy (30-oct) en el cliente: `documentoRepresentanteParaMostrar()` en
`web/firma/app.js`, que repite el enmascarado sobre el valor que se va a pintar, por si el
contexto llegara con el dato en claro —un servidor viejo, una respuesta cacheada, un proxy
que no actualizó—. Las dos barreras hacen lo mismo a propósito: la que falta no alcanza para
que el número llegue a la pantalla. El número completo no se imprime nunca.

**4.13 · Se comprueba que una carga accidental de datos sensibles bloquee la solicitud y el
enlace — CERRADO.**
El 10.8(d): el canal de incidentes de salud bloquea la solicitud y registra el reporte. El
nombre del evento se muestra con etiqueta propia en la línea de tiempo (agregado hoy).

**4.14 · Se comprueba la notificación a la Empresa y la gestión del incidente — CERRADO.**
El reporte se registra y la Empresa es notificada; la resolución del incidente queda
registrada como evento propio. Cubierto por `tests/conservacion-8-6-h.test.js` y por el
control de presencia y ausencia de la tabla de correspondencia.

---

## 5. Seguridad del correo electrónico (11 requisitos)

**5.1 · Se identifica la cuenta remitente real — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-3-5.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Qué se verificó.** Cuál es la cuenta remitente real del canal transaccional, si está identificada
en el expediente, si es la que el código y el servidor usan, y si su dominio tiene lo publicado
para que un correo de ella sea autenticable por el receptor.

**Evidencia.**
- **La cuenta es `kair@gesstiar.com`** (Google Workspace), y está escrita en cuatro lugares que
  hoy gobiernan la relación:
  - `sgsst-electron-app/firma-service/legal-readiness.json:204-212` — bloque `canales.transaccional`:
    `cuenta: "kair@gesstiar.com"` (`:206`), `proveedor: "Google Workspace (Gmail),
    smtp.gmail.com:587 con STARTTLS"` (`:207`), `rol: "subencargado"` (`:208`), `estado: "migrado"`
    (`:210`), y la nota (`:211`) que declara P2, P4 y P5 cerrados el 10-nov y deja P11 y P3
    abiertos.
  - `sgsst-electron-app/legal/anexo-nube-v1.3.html:50-54` (el resumen del Anexo), `:159-171`
    (el §3: "el canal de correo del servicio es una **cuenta empresarial de Google Workspace**,
    la `kair@gesstiar.com`"), `:543-549` y `:594-597` ("Remitente declarado para este canal:
    `kair@gesstiar.com`, con el nombre «K+AIR Firma Electrónica»").
  - `sgsst-electron-app/legal/anexo-encargo.html:539-543` (el paso (vi) del §5: "la cuenta
    empresarial está activa... comprobada con un envío real desde `kair@gesstiar.com`, con su
    Message-ID y su `Authentication-Results`").
  - `docs/gestion-humana/firma-electronica/decision-regularizacion-correo-2026-11-09.md:31-34`
    (tabla de estado medido al 10-nov: P2, P4 y P5 cerrados con su evidencia).
- **El manifiesto en el servidor era el mismo del repositorio; hoy el repositorio lleva una corrección
  que el despliegue alinea.** Medición SSH del 12-nov:
  `sha256sum /opt/kair-firma/app/legal-readiness.json` =
  `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`, idéntico al hash local del
  `legal-readiness.json` de ese momento. **Nota de vigencia (12-nov-2026, tarde).** Esta medicion es la de ese momento y **no se reescribe**. Desde esa tarde el **repositorio** lleva el manifiesto `d9b596993cec7958cadadcd9d9ed51c33878eb03c5b0c4aa1bc642a4bfc9097b`, que difiere del de produccion en **exactamente dos campos**: las dos notas (`anexo_nube.modelo.nota` y `anexo_encargo.nota`) que en produccion dicen «NO esta suscrito» mientras el propio bloque declara `firmado: true` y `contrafirmado: true` con la fecha del 12-nov. Los dos actos **existen en la base de produccion** (suscripcion id 2, `FIRMADA` y `CONTRAFIRMADA`, acta `050f223a3665cf7d`): lo que se corrige es la prosa, no el hecho. **El despliegue es lo que alinea los dos**, y por eso el repositorio va por delante a proposito y el hash del manifiesto **no coincide** con el del servidor hasta que ese despliegue se ejecute. En ese manifiesto, `mail_provider.cuenta` = `workspace`, `rol` =
  `subencargado`, `dpa` = `true`, `aceptacion.aceptada` = `true`, `aceptacion.fecha` = `2026-11-10`
  (`legal-readiness.json:70-107`, con la evidencia de la captura en `:86-106`).
- **El código la usa y la publica.** `src/config.js:72-80` lee `SMTP_HOST`, `SMTP_PORT` (587 por
  defecto), `SMTP_SECURE` (`false`, es decir STARTTLS), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`
  y `SMTP_FROM_EMAIL`; `src/services/mailer.js:36` obliga a `requireTLS: true`, de modo que el
  canal no puede degradar a texto claro.
- **El dominio tiene lo publicado y medido desde este equipo (12-nov):** MX de `gesstiar.com` →
  `smtp.google.com`; SPF `v=spf1 include:_spf.google.com ~all`; DKIM `google._domainkey` presente;
  DMARC `v=DMARC1; p=none; rua=mailto:kair@gesstiar.com`.
- **El envío real está probado:** `anexo-nube-v1.3.html:603-606` — remitente `kair@gesstiar.com`,
  `Message-ID <5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` y
  `Authentication-Results: dkim=pass; spf=pass; dmarc=pass`. Y hay envíos reales del 12-nov con la
  credencial nueva: eventos `CODIGO_ENVIADO` (15:38:09 y 15:39:11) y `CONTRAFIRMA_CODIGO_ENVIADO`
  (15:40:32 y 16:12:54) en la base de producción.
- **Medición SSH del 12-nov:** la tabla `gh_firma_empresas_cuenta_envio` tiene **0 filas**; es decir,
  ninguna Empresa ha configurado cuenta propia de envío, y el remitente efectivo de todo el
  servicio es hoy el de K+AIR.
- **Contraste con el cuadro:** `respuesta-checklist-cierre-2026-10-30.md:1117-1121` afirma que la
  cuenta "vive como variable de entorno en el servidor", que "no está en el repositorio ni en
  ninguno de los nueve adjuntos, y no debe ir". **Hoy esa afirmación es falsa**: la cuenta está en
  el manifiesto, en el Anexo de Nube v1.3 y en el Anexo de Encargo, los dos ya suscritos y
  contrafirmados por ASEPLUS CARIBE S.A.S. el 12-nov. Lo que el cuadro quería preservar —que el
  **secreto** no viaje— sí se respeta (ver 5.6).

**Qué falta.** Nada para este requisito: la cuenta remitente real está identificada, documentada
en los instrumentos que la gobiernan, publicada en DNS y verificada con un envío real. Dos
precisiones que **no** son de este requisito, para que no se lea mal: (a) el remitente efectivo de
hoy es el de K+AIR para todos, porque `gh_firma_empresas_cuenta_envio` está vacía; (b) sigue
abierto **P3** (los alias `privacidad@`, `soporte@` e `incidentes@` de `gesstiar.com` no existen:
la medición DNS del 12-nov devuelve NXDOMAIN para `privacidad.gesstiar.com`,
`soporte.gesstiar.com` e `incidentes.gesstiar.com`), con excepción documentada en
`legal-readiness.json:213-232` y en `src/config.js:103-111` y `:127-135`. P3 afecta los canales de
derechos, PQRS e incidentes, no el remitente transaccional.

**Quién lo tiene.** Nadie (cierre del owner). La evidencia es pública y verificable; lo que queda
abierto (P3) es del owner, pero no es de este requisito.

**5.2 · Se documenta si el envío se realiza mediante Gmail de consumo o una cuenta
corporativa — CERRADO.**
**Gmail de consumo** (Google LLC), decisión de salida B del 27-oct-2026. Si la Empresa
configura una cuenta propia en el servicio (migración 042), el enlace de acceso y los avisos
del procedimiento salen de esa cuenta; **el OTP sale siempre de la cuenta de K+AIR**,
porque es el dato de creación de la firma y su custodia no puede depender de la Empresa.
En esa operación Google actúa como **Responsable del Tratamiento** y el flujo es una
transferencia internacional (determinación de J6, incorporada a A1 §10.5(f), A2 §4, §5 y §8
y A3 §4). **Pendiente adicional, no bloqueante:** la fecha límite de migración a una cuenta
empresarial con acuerdo de encargo, que el abogado pidió por escrito y que hasta hoy no
existe (ver 2.7).

**5.3 · Se identifica por separado el destinatario del enlace y el destinatario del OTP —
CERRADO, con limitación explícita.**
El sistema distingue las cuentas remitentes: si la Empresa configura la suya, el enlace
sale de esa cuenta y el OTP de K+AIR. Eso no demuestra que el Firmante reciba los mensajes
por buzones independientes. Si ambos llegan al mismo buzón, no son factores independientes.
El Acuerdo y el Anexo de Nube describen esa limitación y no atribuyen independencia por el
solo uso de remitentes diferentes; el 3.1 de la v1.4 lo dice con la fórmula que el abogado
aprobó en J10: «Que los mensajes salgan de remitentes o cuentas diferentes no demuestra por
sí solo esa independencia».

**5.4 · Se documenta SMTP y el uso de TLS — CERRADO en el código; falta la confirmación del
servidor.**
`src/config.js` lee la configuración del entorno: `SMTP_HOST`, `SMTP_PORT` (por defecto
**587**), `SMTP_SECURE` (por defecto **false**, es decir STARTTLS en el puerto 587),
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME` y `SMTP_FROM_EMAIL`. El transporte se crea con
`nodemailer.createTransport({ host, port, secure, user, pass, requireTLS: true })`.
**Cambio de esta ronda:** el transporte lleva ahora `requireTLS: true`
(`src/services/mailer.js:36`), que obliga a que la conexión negocie TLS y **hace fallar el
envío si el servidor no lo ofrece**: el canal del OTP no puede degradar a texto claro, ni
por error de configuración. Es la respuesta directa al punto **T5** del abogado («sin
evidencia de cifrado en tránsito del canal del OTP, no se puede sostener la confiabilidad
del art. 2.2.2.47.4 num. 1 del Decreto 1074»). En el ambiente de pruebas el transporte es
`jsonTransport` y no envía nada. **Pendiente de confirmar en el servidor:** el host real y
que el puerto STARTTLS está efectivamente en uso.

**5.5 · Se acredita la activación de MFA — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-3-5.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Qué se verificó.** Si existe **evidencia primaria** (captura de consola y/o acta) de que la
cuenta de salida `kair@gesstiar.com` tiene la verificación en dos pasos activada, y si los
instrumentos suscritos son coherentes entre sí sobre ese punto.

**Evidencia.**
- **No hay evidencia primaria para el MFA.** El expediente tiene captura y acta **solo** para el
  CDPA: `sgsst-electron-app/firma-service/scripts/fixtures/captura-consola-cdpa-i-accept-2026-11-10.png`
  y `.../scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json`, referenciadas en
  `legal-readiness.json:86-106`. Para el 2SV no hay captura ni acta: lo que hay es la **declaración
  del owner recogida en los documentos**, a partir de
  `decision-regularizacion-correo-2026-11-09.md:31` ("P2 | ✅ Cerrado | `kair@gesstiar.com` activa,
  con verificación en dos pasos y autenticación por app password").
- **El Anexo de Nube v1.3 se contradice a sí mismo, y la contradicción está en el instrumento
  firmado.** El §1 (`anexo-nube-v1.3.html:96-109`) declara, entre los pendientes que "no están
  cumplidos", que los demás "están cumplidos y este Anexo los declara con su evidencia", y en
  `:103-104` afirma que "**P2**, `kair@gesstiar.com` está activa, con verificación en dos pasos y
  autenticación por app password". Pero la ficha técnica del §5, en el mismo archivo, dice lo
  contrario:
  - `:635-646` (fila **MFA**): "Estado de la verificación en dos pasos de la cuenta de correo de
    salida: **pendiente de verificación por el owner (P2)**... su estado de verificación en dos
    pasos **no está verificado**: no se afirma ni que esté activa ni que no lo esté".
  - `:547-549` (cuerpo del §5): "El método de autenticación (contraseña de aplicación u OAuth2) y la
    **habilitación de la verificación en dos pasos de esa cuenta están pendientes de verificación
    por el owner (P2)**".
- **La evidencia que el propio §1 promete no existe:** el §1 dice que "P2" está cerrado "con su
  evidencia", y remite a la ficha técnica del §5; la ficha técnica en la fila de MFA dice que no hay
  verificación. La promesa de evidencia no tiene a qué fila apuntar.
- **El parcheo de los textos firmados no tocó esas filas.**
  `sgsst-electron-app/firma-service/scripts/corregir-anexo-nube-v1.3.js` (22 bloques de parche)
  intervino los bloques de estado (`:126`, `:145`, `:163`), pero **ninguno** toca la fila de MFA ni
  la de contraseña de aplicación de la ficha técnica del §5. El resultado es que el Anexo que
  ASEPLUS firmó el 12-nov dice, en dos lugares del mismo documento, que el MFA está cerrado y en
  otro que no está verificado.
- Lo que el propio expediente ya sabía: la fila **T5** del acta del 31-oct
  (`11-checklist-definitivo-revision-juridica-y-cierre.md:91`) ya había dejado uno de los cuatro
  puntos abiertos de la ficha del canal: "la fecha de generación de la contraseña de aplicación".
  Y la fila **J6/J8/J9** sigue pidiendo ratificación externa.

**Qué falta.** (1) La **evidencia primaria del 2SV**: una captura de la consola de Workspace
(Cuenta → Seguridad → Verificación en dos pasos) con su hash, y el acta que la registre, con el
mismo formato que la del CDPA (`aceptacion-cdpa-p1-2026-11-10.json` +
`captura-consola-cdpa-i-accept-2026-11-10.png`). Sin eso, el MFA está declarado, no acreditado.
(2) **Una versión nueva del Anexo de Nube** (v1.4) que corrija las dos filas que hoy contradicen
al §1: el Anexo v1.3 **ya está suscrito y contrafirmado** y un texto suscrito no se toca; eso
arrastra versión nueva del Anexo de Encargo y actualización del manifiesto con las huellas
nuevas. (3) La ratificación externa que el expediente pide para J6/J8/J9.

**Quién lo tiene.** Owner (captura y acta de la consola de Workspace; es un acto suyo, la
consola no es accesible al servicio) y equipo (redacción de la v1.4 del Anexo y su regeneration).

**5.6 · Se acredita el uso de contraseña de aplicación, sin incorporarla a los documentos ni al repositorio — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-3-5.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Qué se verificó.** Dos cosas por separado: (a) que el **método de autenticación** por contraseña
de aplicación esté acreditado, y (b) que el **secreto no esté** en los documentos ni en el
repositorio. La segunda es una obligación de no hacer; la primera, una de acreditar.

**Evidencia.**
- **El secreto no está en ninguna parte: verificado.**
  - Barrido con el detector del propio repo
    (`sgsst-electron-app/main/detector-secretos.js`, `escanear()` sobre los archivos versionados):
    **3891 archivos leídos, 0 hallazgos**.
  - Medición SSH del 12-nov sobre `/opt/kair-firma/.env`: permisos `-rw-------` y propietario
    `root root` — el usuario de servicio no lo puede leer. Se midió **presencia y longitud** de
    `SMTP_PASS`; **su valor no fue leído ni impreso en ningún momento**, ni en los comandos, ni en
    los logs, ni en este documento.
  - Los dos anexos lo dicen y lo cumplen: `anexo-nube-v1.3.html:614-616` ("Las credenciales no se
    documentan en este Anexo ni en ningún documento del expediente") y `:621-622` ("El secreto no
    se documenta en este Anexo ni en ningún documento del expediente: vive únicamente en el archivo
    de entorno del servidor").
- **El método está declarado, pero en el instrumento firmado se contradice.**
  - `decision-regularizacion-correo-2026-11-09.md:31` — "autenticación por app password
    (`kair-firma-smtp`, creada el 10-nov-2026)".
  - `anexo-nube-v1.3.html:101-104` — "**P2**, `kair@gesstiar.com` está activa, con verificación en
    dos pasos y **autenticación por app password**"; y `:164-165` — "la cuenta está activa, con
    verificación en dos pasos, y hay un envío real con ese remitente".
  - Pero la fila **Contraseña de aplicación** de la ficha técnica del §5
    (`anexo-nube-v1.3.html:613-632`) sigue diciendo: "El método de autenticación **está pendiente de
    decisión y de verificación por el owner (P2)**: si la consola de Workspace tiene habilitadas
    las app passwords y la cuenta tiene verificación en dos pasos, la credencial es una app
    password; si no, la opción es OAuth2, que exige cambio en el código del servicio y variables
    nuevas".
- **La fecha de generación sí consta en el expediente, y el Anexo firmado afirma lo contrario.**
  `anexo-nube-v1.3.html:623-625` dice que "La fecha de generación de la credencial vigente **no
  consta**" y que "el proveedor de correo no expone la fecha de creación de una app password y el
  expediente no la registra". Pero `decision-regularizacion-correo-2026-11-09.md:31` **sí** la
  registra: "creada el 10-nov-2026". La afirmación del Anexo v1.3 es anterior al dato y no se
  actualizó.
- **Faltan el procedimiento de rotación y la revocación de la credencial anterior.**
  `anexo-nube-v1.3.html:628-629` — "Procedimiento y periodicidad de rotación: **aún no hay
  procedimiento definido**, y el owner lo declara pendiente el 31-oct-2026"; y P6/P11 — revocar las
  app passwords de la cuenta de correo anterior (`anexo-nube-v1.3.html:99-101`, `:627-628`;
  `decision-regularizacion-correo-2026-11-09.md:381`;
  `11-checklist-definitivo-revision-juridica-y-cierre.md:119`, fila **P11**: "**PENDIENTE**, y no
  bloquea la firma. Revocar las app passwords de la cuenta de correo anterior del Encargado y
  verificar que no queda ninguna en el archivo de entorno del servidor").
- **Lo que sí se verificó del lado del servidor:** la credencial instalada es la de la cuenta nueva
  (el `.env` tiene `SMTP_PASS` y el servicio está `active`, `NRestarts=0`, activo desde
   2026-11-12 09:30:23 -05) y hubo envíos reales el 12-nov con ella. La **ausencia de
  `gh_firma_empresas_cuenta_envio`** (0 filas) confirma que no hay una segunda credencial de envío
  configurada por Empresa.

**Qué falta.** (1) **Una versión nueva del Anexo de Nube** que alinee las tres afirmaciones que
hoy se contradicen (el §1 da P2 por cerrado; la ficha técnica lo da por pendiente; y la fecha de
generación que el Anexo declara inexistente y el expediente sí tiene) — el texto está suscrito y
no se toca. (2) **El procedimiento de rotación** de la credencial, con su periodicidad, que el
propio Anexo declara inexistente y que el acta del 31-oct ya listaba como pendiente (fila T5).
(3) **P6/P11**: revocar las app passwords de la cuenta anterior (`adminkair@gmail.com`) y
verificar que no queda ninguna en el `.env` del servidor. (4) La **evidencia primaria** del 2SV que
la app password presupone (misma acta y captura que en 5.5), porque la contraseña de aplicación
solo existe si el 2SV está activo.

**Quién lo tiene.** Owner (la revocación en la consola y el procedimiento de rotación), equipo
(redacción de la v1.4 del Anexo de Nube y del Anexo de Encargo que la remite, con huellas nuevas en
el manifiesto). Ningún trabajo de código: el secreto está y debe seguir en el servidor.

**5.7 · Se verifica que los mensajes OTP no incluyan datos sensibles ni documentos
laborales completos — CERRADO.**
Regla escrita y aplicada: por OTP no se envía ningún documento laboral completo, y el
correo no incluye documentos de identidad ni datos sensibles. La **única excepción
documentada** es la copia en papel con su registro de firma autográfica, que viaja en su
propio mensaje.

**5.8 · Se documentan los registros de envío, errores y fallos — CERRADO.**
El emitente registra el identificador del mensaje, la fecha y hora, la IP de origen y el
resultado; el destino se guarda enmascarado. Hay registro de emisión y de validación del
OTP y del token, sin conservarlos en texto claro, y de los errores del envío con su
código.

**5.9 · Se documenta el procedimiento de incidentes y revocación de credenciales — CERRADO
el procedimiento; la evidencia es del owner.**
El procedimiento está escrito en el Anexo de Nube (sección 5) y su ficha tiene los apartados
marcados: lo que falta es la evidencia que solo el owner tiene. En esta ronda la §5 del
Anexo se corrigió (firma sin marcadores y RTO como objetivo de recuperación) y su lista de
pendientes quedó explícita: son 16 campos `[PENDIENTE: el owner completa con la evidencia]`,
ninguno de ellos jurídico.

**5.10 · Se verifica el canal de envío de documentos firmados en papel — CERRADO.**
Ver 2.11: correo, con la excepción documentada de la copia en papel.

**5.11 · Se documenta qué información puede conservar el proveedor y qué aspectos no
controla K+AIR — CERRADO.**
El Anexo de Nube lo dice: Google puede tratar y conservar datos asociados a los mensajes,
incluidos destinatarios, contenido enviado y metadatos técnicos, conforme a las
condiciones y políticas del servicio de Gmail; **esa conservación es independiente de los
plazos de conservación que aplica K+AIR**, y no se atribuye al proveedor plazos que no se
hayan verificado (Acuerdo, numeral 8.6). En esta ronda la ficha de Google (§4) quedó
redactada como «Responsable del Tratamiento en esta operación, por los motivos y con los
efectos determinados en el §5 del Anexo de Encargo», conservando íntegra la advertencia de
que no hay DPA empresarial.

---

## 6. Correspondencia entre Acuerdo y código (12 requisitos)

**Aviso de alcance de esta sección.** Las doce verificaciones se hicieron sobre la
correspondencia de la **v1.3** (`correspondencia-texto-codigo-v1.3.md`, 21 filas). Con la
v1.4 el texto que se aprobará es otro: el §3.6(h), el §5.6, el §8.7, el §9.2, el §9.6, el
§10.5(f) y el §10.8(d)(iv) cambiaron, y los anexos también. El punto **T2** del abogado es
exacto: la correspondencia se regenera **para el commit candidato** y se revisa junto con
las pruebas funcionales, no en lugar de ellas. Ese es el requisito 6.1. **Esta ronda lo
cerró**: la tabla se regeneró contra el candidato v1.4 y da 26 filas.

**6.1 · Ejecutar nuevamente `correspondencia-texto-codigo.js` — CERRADO.**
La tabla se regeneró contra el candidato v1.4 con
`node sgsst-electron-app/firma-service/scripts/correspondencia-texto-codigo.js --version=v1.4`
y quedó en `docs/gestion-humana/firma-electronica/correspondencia-texto-codigo-v1.4.md`:
**26 filas · 26 implementadas · 0 pendientes**. Su cabecera declara las huellas del texto
candidato: Acuerdo v1.4 `7298a943…490f` y Anexo de Encargo `02651747…30d0f7`. Las cuatro
filas que la v1.3 no mapeaba son el §3.6(b) (la matriz de finalidades se pone a disposición
antes de habilitar la casilla), el §3.6(h) (el Anexo de Nube suscrito por la Empresa, con
la compuerta que lo enciende), el §9.2 (el alcance de la aceptación) y el §9.6 con el
§5.6 (el medio y la fecha de la puesta a disposición). **La fila que esta ronda añadió es la
del canal de la fecha de terminación** (el 8.6(b) y el §6 del Anexo de Encargo).

**6.2 · Confirmar las 26 filas de la matriz — CERRADO.** Las 26 filas del Acuerdo v1.4 con
su texto, su evidencia `archivo:línea`, el test que lo prueba y su estado.

**6.3 · Confirmar cero anclas pendientes — CERRADO.** Cero pendientes.

**6.4 · Verificar los controles de presencia y ausencia — CERRADO.**
La tabla usa los dos tipos y explica por qué: el control de **presencia** comprueba que la
implementación está (el ancla tiene que aparecer); el de **ausencia** comprueba que lo que
el texto prohíbe no está (el ancla tiene que **no** aparecer). El de ausencia es el que
distingue «el texto está escrito» de «el código lo cumple». Ejemplo verificado: el ancla
prohibida del *hold* por plazo no declarado tiene que no aparecer, y la fila 8.6(h) lista
además la presencia del comportamiento que la sustituye.

**6.5 a 6.9 · Revisar manualmente las implementaciones críticas — CERRADO.**
Las cinco revisiones pedidas están hechas con archivo y línea en la tabla:
5. · retención y supresión: 8.6(a), 8.6(b), 8.6(c), 8.6(e), 8.6(h), 10.5(d), 10.6,
3.6(g) (tres filas), 12.7.
6. · control de aceptación del Acuerdo y de políticas de seguridad: 5.1 y 5.6.
7. · bitácora y sus mecanismos de protección: 3.6(g) con los disparadores de solo anexado.
8. · lápidas y recibos: 3.6(g).
9. · bloqueo y notificación de incidentes de datos sensibles: 10.8(d).

**6.10 · Confirmar que las pruebas citadas en la matriz realmente existen y se ejecutan —
CERRADO.**
Las rutas `tests/…` citadas en la tabla existen. La batería de 6.11 se ejecutó el 3-nov-2026 en
el árbol de trabajo local; su reproducción desde clon limpio, asociada al commit T3, sigue pendiente.

**6.11 · Ejecutar la bateria completa de pruebas del servicio — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PARCIALMENTE.*

**Que se verifico.** El texto canonico del requisito y su estado, y las tres fuentes que reportan
la ultima corrida de la suite: el runbook de despliegue, el `Historial.md` de la ronda del 12-nov
y el informe al abogado, donde T1 sigue marcado como pendiente de T3.

**Lo que se resolvio el 12-nov-2026 (T1).** La bateria se ejecuto **completa, tres veces, desde un
clon limpio del repositorio** (`verificacion-cierre/t1-corrida-desde-clon-limpio.md`):

| Corrida | tests | pass | fail | skipped |
|---|---|---|---|---|
| A (14:53) | 2 624 | 2 622 | **0** | 2 |
| B (15:03) | 2 630 | 2 628 | **0** | 2 |
| C (15:13) | 2 650 | 2 648 | **0** | 2 |

Las tres corrieron en un clon con `npm ci` desde cero (Node 22, ABI 127) y **sin `.env`**, y sus
conjuntos de nombres de prueba coinciden **exactamente** con las corridas del arbol del owner
(comparacion cerrada en los dos casos: 14:34 y 15:02). `npm ci` en el clon: `added 139 packages`,
exit 0, **0 vulnerabilidades**; los devDependencies no se perdieron y `better-sqlite3` carga bajo
Node 22.

**La corrida sobre el commit, que es la que faltaba (16:04 a 16:11).** Con la ronda ya commiteada
(`e4dd5f31`), el clon sale del commit: no hay nada que trasladar a mano.

```
tests 2665 | pass 2663 | fail 0 | cancelled 0 | skipped 2 | todo 0
duration_ms 323480
```

179 archivos de prueba, `exit 0`, sin bloques `not ok`. El clon se hizo con
`git -c core.autocrlf=false clone --no-hardlinks`, su `git status --porcelain` salio **vacio**, no
tiene `.env`, y `npm ci` dio `added 139 packages` con **0 vulnerabilidades**. Comparada contra la
corrida del arbol del owner: **el conjunto de los 2 665 nombres de prueba es identico** y los dos
omitidos son los mismos, con el mismo motivo escrito en el propio test. Y el clon quedo **byte a
byte** igual al arbol del owner: **4 810 archivos identicos, 0 diferentes, 0 ausentes**.

**Ojo con las dos cifras:** la del clon es la del commit `e4dd5f31`, **anterior** a las dos pruebas
de regresion del manifiesto que se agregaron el 12-nov por la tarde; el arbol de hoy da
**2 667 / 2 665 / 0 / 2**.

**Un hallazgo que hay que dejar escrito.** El primer clon se hizo con la configuracion del sistema
(`core.autocrlf = true`) y **no reproducia el arbol del owner**: materializo 2 697 de los 4 781
archivos versionados con CRLF, cuando los blobs los tienen en LF. El repo del owner tiene
`core.autocrlf = false` en su `.git/config` local, que pisa al del sistema. El clon tiene que
hacerse con `git -c core.autocrlf=false clone`, y `git reset --hard` **no** reescribe los archivos
que el indice ya da por buenos. Sin eso, un clon "limpio" en esta maquina **no** es el arbol del
owner, y cualquier prueba que mire bytes puede dar un resultado distinto.

**La corrida final del arbol del owner.** Con el arbol de dependencias ya corregido (las dos altas
de `npm audit` resueltas) y los tests nuevos de esta ronda, la suite completa se corrio una vez mas
sobre el arbol de trabajo del owner:

```
tests 2667 | pass 2665 | fail 0 | cancelled 0 | skipped 2 | todo 0
duration_ms 362425
```

179 archivos de prueba, `exit 0`, sin bloques `not ok`. **Esta es la cifra que publica ahora la
seccion 7 del runbook** (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md`); la de 2 606 / 2 604
que publicaba antes ya no era vigente, y la de **2 665 / 2 663** es la de la corrida sobre el commit
`e4dd5f31` (12-nov por la manana), que es **anterior** a las dos pruebas de regresion del manifiesto.

**Evidencia.**
`sgsst-electron-app/docs/gestion-humana/firma-electronica/verificacion-cierre/t1-corrida-desde-clon-limpio.md`
(el acta, con la salida literal de cada corrida y la de la corrida sobre el commit);
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §7 (la cifra vigente);
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1232` - "[ ] Correr los tests en el
servidor. La suite completa nunca se ha corrido ahi". Medido por SSH hoy: `/opt/kair-firma/app/tests`
**no existe** en el servidor.

**Que falta.** **Nada del lado de este requisito.** La corrida esta vinculada a un commit
(`e4dd5f31`), se reprodujo desde un clon limpio de ese commit, y la seccion 7 del runbook publica
la cifra vigente. Lo que **no** queda es otra cosa, y no es de este requisito: la suite **no se ha
corrido en el servidor** (`/opt/kair-firma/app/tests` no existe ahi), porque el servidor no tiene
los tests y desplegarlos es un acto del owner.

**Quien lo tiene.** — (cerrado por el equipo, con la corrida sobre el commit `e4dd5f31`).

**6.12 · Documentar los errores preexistentes, pruebas omitidas y resultados nuevos —
CERRADO.**
- **Servicio (corrida local del 3-nov-2026: 2 096 pruebas; 2 094 en verde, 0 con fallos, 2 omitidas, 94,8 s; falta clon limpio/T3).** La roja que había,
  `ADVE6.7: zod acepta "5" (coerce)`, **no era un defecto de código**: le faltaba la
  declaración `declaracion_datos_sensibles`, exigida desde el commit `5534aca7` (📦978), y se
  corrigió **en el test**, que **sí se modificó en esta ronda**; el código de producción no se
  tocó. Las dos omitidas son una prueba de rendimiento y una de esquema, cada una con su
  razón escrita en el propio test (6.11).
- **App (146 tests): 140 en verde, 6 con fallos, 4 sin resumen.** Los 4 sin resumen **no
  son fallos**: el runner no puede confirmar cuántos checks corrieron (`test-copasst-tema-890`,
  `test-init-order-bug`, `test-responsable-tema-891`, `test-visor-carga-892`).
- **Los 6 rojos de la app, con su archivo**, son **idénticos a la línea base** de antes de
  esta línea de trabajo, ninguno es de la línea legal:
  `test-bandeja-premium-v2` [47/48], `test-cfg-tabs-scroll-883` [15/19],
  `test-firma-constancia-consolidada` [81/83], `test-firma-constancia-p0-p1` [32/33],
  `test-firma-deploy-kit` [36/37], `test-firma-tunnel-kit` [23/25].
- **Resultado nuevo de esta jornada:** el mecanismo de conservación con trazabilidad, el
  sistema de compuerta de activación, las cuatro columnas de la migración 049, el canal de
  incidentes del 10.8(d) y la segunda barrera de enmascarado del representante legal.
- **Resultado nuevo de esta ronda (30-oct-2026, cierre de la línea legal):** el registro de
  aceptación con el alcance de la autorización (C-2/J3), la matriz de finalidades puesta a
  disposición antes de la casilla, la Constancia que no vincula un modelo de Anexo de Nube
  sin firmar (C-1), el catálogo legado de veinte años desde la firma retirado y el texto al
  Trabajador que ya no lo promete (D2), el piso legal del 8.6(b) que el hold ya no borra
  (D1), el SMTP con `requireTLS` (T5), el manifiesto legal en la v1.4 con cuatro huellas y
  su comprobación automática (J14-5), y el procedimiento escrito de incidentes de datos de
  salud (RNBD, 15 días hábiles).

**Aviso sobre el adjunto 5.** La correspondencia se regeneró **contra el candidato v1.4** (la huella
vigente va en la tabla de la nota, porque ese archivo se regenera con cada cambio de código y una
referencia escrita en prosa se quedaría vieja): declara **26 filas, 26 implementadas y 0 pendientes**, y su
cabecera lleva las huellas del texto candidato (Acuerdo `7298a943…490f`, Anexo de Encargo
`02651747…30d0f7`). Esa salida estática no sustituye la reejecución de pruebas. La cifra de 1-nov solo está reportada por el equipo y sigue pendiente de vinculación al commit candidato T3. `SHA256SUMS.txt` se
reconstruyó con los **catorce** adjuntos y sus huellas actuales, ya sobre los textos
corregidos (1.6).

---

## 7. Producción y despliegue (15 requisitos)

**7.1 · Confirmar la version exacta del codigo que se va a desplegar — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Como se puede identificar hoy el codigo que corre en produccion: el servidor
no tiene git, no tiene marcador de version, y el endpoint de salud no anuncia version real. Se
midieron por hash los archivos clave del arbol desplegado y se compararon con el arbol del repo
en el commit `264d08df`. Se reviso tambien el estado de la sesion de commits.

**Evidencia.**
`/health` (medido por SSH el 12-nov 13:31) - `{"status":"ok","version":"0.1.0","kair_version":"compatible-0.1.189","uptime_seconds":14441,"checks":{"db":"ok","smtp":"configured"}}`.
`sgsst-electron-app/firma-service/src/routes/health.js:45` - `kair_version: 'compatible-' + (config.env === 'production' ? '0.1.189' : 'dev')`: es un **valor fijo**, no dice que codigo corre. Por eso la comprobacion tiene que ser por disco, tal como dice el canonico
(`respuesta-checklist-cierre-2026-10-30.md:1241`).
Medido por SSH (`sha256sum` en `/opt/kair-firma/app` frente al hash del repo en `264d08df`):

| Archivo | Servidor | Repo `264d08df` | |
|---|---|---|---|
| `src/server.js` | `73947e2d...ff90` | `73947e2d...ff90` | igual |
| `src/services/readinessLegal.js` | `3f453ed2...2d9` | `3f453ed2...2d9` | igual |
| `config/tabla-conservacion.json` | `9c81a175...a61b` | `9c81a175...a61b` | igual |
| `legal-readiness.json` | `d9b59699...c9097b` | `191c08b8...4013f` | **difiere en 2 notas (12-nov); el despliegue lo alinea** |
| `scripts/fixtures/acuerdo-v1.6.txt` | `08e1eb8b...2f13e` | `08e1eb8b...2f13e` | igual |
| `package.json` | `0a25dbe8...e424` | `ca60b002...b55ca` | **distinto** |

Medido por SSH: `grep -n '"express"' /opt/kair-firma/app/package.json` devuelve `"express":
"^4.21.0"`, mientras el repo ya declara el piso `^4.22.3` (paquete 1051). El `package-lock.json`
desplegado fija `express 4.22.2`, `proxy-addr 2.0.7`, `qs 6.15.3` (lineas 551, 1141 y 1164 del lock
en disco).
`Historial.md:24` - el tar del despliegue habilitante fue `kair-deploy.tar.gz` (1 180 396 B,
sha256 `dc4c6936...97bc6`), armado con el codigo commiteado del paquete 1047 mas el manifiesto
corregido.
`Historial.md:8777` - los commits de la sesion (`91214c55` paquete 1050 y `dfc403b0` paquete 1051)
**no han salido del PC** y el paquete 1051 **no esta desplegado**.
`Historial.md:8781` - la cola del owner ya dice: "desplegar el 1051 en el servidor (el bump de
dependencias viaja en el paquete de despliegue, asi que sin desplegar la produccion sigue con las
versiones viejas)".

**Que falta.** Dos cosas. (a) Para el **proximo** despliegue no hay commit candidato declarado:
T3 sigue pendiente y el owner no ha fijado uno. (b) El estado desplegado es **mixto**: el codigo
fuente (`src/`) y el manifiesto coinciden con la punta del repo, pero los archivos de dependencias
en disco son los anteriores al paquete 1051. Es decir: **hoy no hay un commit unico que describa
lo que corre**, porque el codigo es de una epoca y el lock de otra. Ningun requisito pide
controlar eso, pero sin resolverlo la "version exacta" se responde por hash y no por nombre.
Ningun archivo del servidor declara la version: `package.json` dice `"version": "0.1.0"`
(constante) y no hay `.git` ni archivo de build.

**Quien lo tiene.** Owner (fijar el commit candidato, con el "dale" que autoriza commit) y
equipo (desplegar el 1051 con `npm ci --omit=dev`, paso que ya esta documentado).

**7.2 · Confirmar que el manifiesto corresponde a esa versión — CERRADO.**
`firma-service/legal-readiness.json` es el manifiesto que viaja dentro del paquete, y
**declara la v1.4** (actualizado en esta misma ronda): `acuerdo.archivo:
"scripts/fixtures/acuerdo-v1.4.txt"`, `acuerdo.hash: 7298a943…c585490f`, `acuerdo.version:
"v1.4"`, `publicado: false`; `constancia.archivo:
"legal/constancia-aprobacion-acuerdo.html"`, `constancia.hash: 3fd45c65…736c`,
`constancia.version: "v1.4"`, `constancia.estado: "no_firmada"`; `anexo_encargo.hash:
02651747…30d0f7` con `estado: "no_firmado"`; `anexo_nube.modelo.hash: aec7c401…83214ca`
con `anexo_nube.firmado: false` y `anexo_nube.hash: null`; y un bloque nuevo para la fuente
única de la matriz (`matriz_finalidades.archivo: "config/matriz-finalidades.json"`,
`hash: f09f80c9…711552`, `version: "1.0"`). Las claves `v1_1_*` quedaron renombradas, que es
lo que pedía el punto 5 de J14.
**Lo que no puede cambiar, y no cambió, es la garantía de fondo (punto T9 del abogado):**
`publicado: false`, `anexo_encargo.estado: "no_firmado"`, `anexo_nube.firmado: false`,
`tabla-conservacion.json → aplicacion.activada: false` (`validado_por: null`), y
`subencargados.google.dpa: false` sigue declarado como tal, sin que el texto afirme lo
contrario.

**7.3 · Ejecutar las migraciones de base de datos necesarias — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Las migraciones que el canonico pedia (`047`, `048`, `049`, `050`, `051`) y las
tres que se agregaron despues (`060` contrafirma del Anexo de Nube, `061` registro de poderes del
Encargado, `062` su rastro append-only), contra la tabla real de migraciones de la base de
produccion, y la correspondencia uno a uno con los archivos de migracion del repo.

**Evidencia.**
Medido por SSH: `SELECT COUNT(*) FROM gh_firma_schema_migrations` devuelve **61**, y las tres
ultimas filas son `060_anexo_nube_contrafirma`, `061_encargado_poderes` y
`062_encargado_poderes_append_only`, las tres con `applied_at = 2026-11-11 18:52:10` UTC, es
decir **13:52:10 hora de Colombia**, dentro de la ventana de la reparacion que quedo registrada en
`Historial.md:74` (13:38-13:52).
Comparacion 1:1 con el repo: `sgsst-electron-app/firma-service/src/db/schema/` tiene **61**
archivos `.sql` y el servidor tiene **61** migraciones aplicadas; la diferencia de los dos
conjuntos (hecha con `Compare-Object`) es **cero en ambos sentidos**: no hay migracion del repo sin
aplicar ni aplicada que no exista en el repo.
`Historial.md:74` - las migraciones las aplico **el propio servicio** al arrancar
(`src/server.js:251`), no un script aparte, con el entorno que le da systemd.

**Que falta.** Nada: queda cerrado. La comprobacion de que quedaron bien aplicadas es el 7.4.

**Quien lo tiene.** - (cerrado por el equipo en la reparacion del 11-nov-2026).

**7.4 · Comprobar que las migraciones se aplicaron correctamente — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** En disco y sobre la base de produccion: que las tablas, columnas y disparadores
que traen las tres migraciones nuevas existen de verdad, que la base esta integra, y que las rutas
que dependen de esas migraciones existen en el codigo que corre (un 404 significa codigo viejo).

**Evidencia.**
Medido por SSH contra `/opt/kair-firma/data/firma.sqlite`:
- `060`: la tabla `gh_firma_anexo_nube_suscripciones` tiene **15 columnas `contrafirma*`**
  (`contrafirmado_at`, `contrafirma_actor`, `contrafirma_motivo`, `contrafirma_codigo_enviado_at`,
  `contrafirma_canal`, `contrafirma_otp_hash`, `contrafirma_otp_intentos`,
  `contrafirma_otp_envios`, `contrafirma_estado`, `contrafirma_ip`, `contrafirma_user_agent`,
  `contrafirma_evidencia`, `contrafirma_acta_hash`, `contrafirma_acta_bytes`,
  `contrafirma_acta_archivo`); la ficha de empresa tiene las **5** columnas `anexo_nube*`
  (`anexo_nube_firmado_at`, `_version`, `_hash`, `_evidencia`, `anexo_nube_ejecutado_at`).
- `061` y `062`: existen `gh_firma_encargado_poderes` y `gh_firma_encargado_poderes_eventos`.
- Disparadores append-only: **36** disparadores `trg_*_no_delete` / `trg_*_no_update`, entre ellos
  `trg_firma_eventos_no_delete`, `trg_aprobaciones_publicacion_no_delete`,
  `trg_anexo_nube_eventos_no_delete`, `trg_encargado_poderes_eventos_no_delete`.
- `PRAGMA integrity_check` devuelve **ok**.
- Rutas que dependen del codigo nuevo: `POST` sin llave a las cuatro rutas de deshacer los actos
  devuelven **401** (existen), mientras una ruta inexistente devuelve **404**
  (medido por SSH el 12-nov 13:41).

**Que falta.** Nada: queda cerrado.

**Quien lo tiene.** - (cerrado por la reparacion del 11-nov-2026, verificado hoy por SSH).

**7.5 · Verificar el estado de la base de datos y sus respaldos — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** El estado de la base de produccion, el ciclo de respaldo diario (cifrado,
integridad, retencion), la existencia de una copia fuera del servidor, y si la **prueba de
restauracion mensual** que el propio manifiesto promete se ha ejecutado alguna vez. Ademas: si los
cuatro actos del P8 estan en algun respaldo.

**Evidencia.**
Medido por SSH:
- Base de produccion: `/opt/kair-firma/data/firma.sqlite` (872 448 B) con su WAL y SHM del
  12-nov 11:14; `PRAGMA integrity_check` = **ok**; 1 empresa (`900829731`), 2 suscripciones del
  Anexo de Nube y 2 del Anexo de Encargo.
- Ciclo de respaldo: `/etc/cron.d/kair-firma-backup` = `0 22 * * * root /opt/kair-firma/backup-firma.sh`.
  El log `backups/backup.log` del 11-nov 22:00 dice: "Backup OK: firma-20261111-220001.sqlite.enc
  (164714 B, sha256 `de14e3f4b3c94c32eb690ae9215c111cdc1b450c963726eac54bd5192ebde20a`, integrity
  ok, cifrado gpg) + storage-20261111-220001.tar.gz.enc". La frase de paso vive en
  `/opt/kair-firma/backup.passphrase` (600 root:root).
- **El ultimo respaldo es del 11-nov a las 22:00.** Los cuatro actos del P8 (12-nov 15:38 a
  16:14) **no estan en ningun respaldo todavia**: al momento de esta medicion (12-nov 13:35) el
  respaldo de hoy todavia no se habia hecho. Esto ya lo reporta el propio equipo en
  `Historial.md:8788`.
- **No hay copia fuera del servidor**: los 52 archivos `.enc` viven en `/opt/kair-firma/backups`, y
  `df -h` dice que `/opt` esta en `/dev/mapper/ubuntu--vg-ubuntu--lv` (11 % usado, 91 GB libres) -
  el **mismo disco** que la base. No existe `/opt/kair-firma/backups-offsite`, no hay `/mnt/*` ni
  `/media/*`, y no hay `rclone` instalado. El propio runbook lo lista como pendiente:
  `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1154` ("[ ] Copia **off-site** de los
  respaldos (hoy viven en el mismo servidor que los datos)").
- **La prueba de restauracion mensual nunca se ha ejecutado**: `/etc/cron.d/kair-firma-restauracion`
  esta en `0 4 1 * *` y escribe en `/opt/kair-firma/backups/restauracion.log`, archivo que **no
  existe** (los crons se instalaron el 6-nov, despues del 1 de noviembre, y el 1 de diciembre
  todavia no llega). Es decir: el manifiesto promete "una prueba de restauracion mensual"
  (`sgsst-electron-app/firma-service/legal-readiness.json:47`) y esa prueba **nunca ha corrido una
  vez**.

**Que falta.** Tres cosas, y la primera es la unica urgente: (a) **el respaldo de hoy (12-nov 22:00)
debe correr y verificarse**, porque hasta entonces los cuatro actos del P8 -la evidencia de los
actos que el propio expediente declara como ejecutados- **no estan en ninguna copia**: un fallo de
disco hasta las 22:00 los pierde. (b) **La copia off-site**, que es la brecha mas grande del plan de
continuidad y la mas facil de cerrar. (c) **Ejecutar y registrar una prueba de restauracion** al
menos una vez, para que la frase "se verifica mensualmente que el respaldo se restaura
correctamente" del Anexo de Nube no sea una promesa sin un solo respaldo restaurado nunca.

**Quien lo tiene.** Equipo (correr y verificar el respaldo de hoy; instalar la copia off-site) y
owner (la cuenta y el destino de la copia off-site).

**7.6 · Comprobar los permisos de archivos y directorios — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** Los permisos reales del arbol desplegado, contra lo que el propio runbook
exige. Se midieron el directorio de la app, sus subdirectorios, los archivos, y cuantos archivos y
directorios quedan con permiso de escritura para cualquiera.

**Evidencia.**
Medido por SSH (`ls -ld` / `ls -l` en `/opt/kair-firma`):

```
drwxrwxrwx  8 kairfirma kairfirma  4096 nov 11 13:52 /opt/kair-firma/app
drwxrwxrwx  9 kairfirma kairfirma  4096 nov 11 13:52 /opt/kair-firma/app/src
-rw-rw-rw-  1 kairfirma kairfirma 11796 nov 11 07:04 /opt/kair-firma/app/src/server.js
-rw-rw-rw-  1 kairfirma kairfirma  1171 nov 11 07:04 /opt/kair-firma/app/package.json
drwxr-xr-x  2 kairfirma kairfirma  4096 nov 11 14:01 /opt/kair-firma/legal
```

Conteo: **236 archivos** y **18 directorios** bajo `/opt/kair-firma/app` con bit de escritura para
otros (`-perm -0002`).
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:768` - lo que el runbook exige: "`drwxr-x---`
en `app/`, `drwxr-xr-x` en `app/src/`, `-rw-r--r--` en los archivos".
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:279` - el paso 2b del despliegue
(`chmod -R u=rwX,go=rX` y `chmod 750` sobre `app/` y `legal/`) **no se aplico**: el script de
reparacion del 11-nov (`kair-reparar-produccion-v2.sh`, `Historial.md:74`) repuso `node_modules` y
aplico las migraciones, pero no normalizo permisos.
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:735` - el abogado ya lo habia marcado el
31-oct-2026: "con permisos 777, cualquier usuario de la maquina puede escribir el codigo que corre
el servicio, y eso no es 'minimo privilegio'".
Medido por SSH: `id javier` -> `uid=1000(javier) gid=1000(javier) groups=1000(javier),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),101(lxd)`. La cuenta de servicio corre como `kairfirma`
(`/etc/systemd/system/kair-firma.service`), y con `app/` en 777 una cuenta local cualquiera puede
**reemplazar el codigo que despues se ejecuta como `kairfirma`**: es una via de escalamiento, no
solo un desorden de permisos.
Lo que **si** esta bien: el paso 2c no aplica (no existe `/opt/kair-firma/app/data`, ni
`app/data/test.sqlite`; medido: "cannot access"), y los secretos **no** viven en `app/`:
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:771`.

**Que falta.** Aplicar el paso 2b del runbook (`chmod -R u=rwX,go=rX` mas `chmod 750` sobre `app/` y
`legal/`), que es una operacion de root y no la hizo el despliegue. Es el unico punto de esta
seccion que el propio abogado habia marcado como bloqueante y que sigue igual cuatro meses de
despues.

**Quien lo tiene.** Owner (ejecutar el `chmod` con su clave de sudo); el procedimiento ya esta
escrito y es de una sola linea.

**7.7 · Comprobar la configuracion de seguridad del servicio — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** Como esta expuesto el servicio (puertos, entrada, proxy), como esta endurecida
la unidad de systemd, que versiones de dependencias corre de verdad el proceso, con que runtime, y
si el disco esta cifrado.

**Evidencia.**
Medido por SSH:
- **Superficie**: `ss -ltn` muestra el servicio escuchando **unicamente en `127.0.0.1:3001`**. No
  hay 80 ni 443 abiertos, no hay `nginx` ni `caddy` instalados. La unica entrada es
  `/etc/cloudflared/config.yml`: `firma.kair.fyi -> http://127.0.0.1:3001`. La VM corre ademas
  Cockpit (4330) y un agente de Tailscale, que son superficies por revisar aparte.
- **Unidad systemd** (`/etc/systemd/system/kair-firma.service`): `User=kairfirma`,
  `EnvironmentFile=/opt/kair-firma/.env`, `NoNewPrivileges=true`, `PrivateTmp=true`,
  `ProtectSystem=full`, `ReadWritePaths=/opt/kair-firma`, `LimitNOFILE=65536`.
- **Proxy de confianza**: `sgsst-electron-app/firma-service/src/config.js:58` ->
  `trustProxy: process.env.TRUST_PROXY || 'loopback'`, aplicado en
  `sgsst-electron-app/firma-service/src/server.js:67` -> `app.set('trust proxy', config.trustProxy)`.
  El valor por defecto es `'loopback'` y el codigo nunca usa `'true'`
  (`sgsst-electron-app/firma-service/deploy/README-DESPLIEGUE.md:45`). El valor real vive en el
  `.env` (600 root), que esta cuenta no puede leer: **esa comprobacion puntual queda del owner**.
- **Dependencias que corre el proceso** (leidas de `node_modules` en el servidor):
  `express 4.22.2`, `proxy-addr 2.0.7`, `qs 6.15.3`, `nodemailer 6.10.1`, `zod 3.25.76`. Es decir,
  **produccion sigue con la version CRITICA de `proxy-addr` (2.0.7) y con las dos ALTAS**
  (`nodemailer`, `zod`). El repo ya las corrigio (`Historial.md:8735`: `proxy-addr` 2.0.8, `qs`
  6.16.2, `express` 4.22.3), pero **ese cambio no esta desplegado**
  (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:346`).
- **Runtime**: `/usr/bin/node --version` -> **v20.20.2** (Node 20, EOL 2026-04-30). La decision del
  owner del 11-nov es Node 22 (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1186`), y el
  propio runbook avisa de que subirlo obliga a recompilar `better-sqlite3` antes de arrancar.
- **Cifrado en reposo**: `/dev/mapper` solo tiene `ubuntu--vg-ubuntu--lv` (sin `crypt`), y
  `/swap.img` es un archivo plano de 3,7 GB. El disco **no esta cifrado**, ya registrado como
  pendiente en `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:776`.

**Que falta.** (a) **Desplegar el paquete 1051 con `npm ci --omit=dev`**, que es lo que deja de
correr `proxy-addr` 2.0.7 y `qs` 6.15.3: hasta ese dia, el proceso ejecuta la version critica
aunque el repo ya la haya corregido. (b) **La decision del runtime**: Node 22, con su recompilacion
de `better-sqlite3` (ABI 127) antes de arrancar. (c) **El cifrado en reposo del disco**, que no es
un parche sino una decision del owner con el abogado. (d) La lectura del `TRUST_PROXY` real, que
solo puede hacer el owner porque el `.env` es 600 root.

**Quien lo tiene.** Equipo (desplegar el 1051 y recompilar el binario); owner (Node 22, cifrado en
reposo, lectura del `.env`).

**7.8 · Verificar que no haya credenciales expuestas — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Que los archivos de credenciales del servidor tengan permisos restringidos y que
no los pueda leer nadie mas; que no haya material de clave dentro del arbol de codigo desplegado;
y que el repositorio este limpio de credenciales.

**Evidencia.**
Medido por SSH (`stat`): `/opt/kair-firma/.env` **600 root:root**; `/opt/kair-firma/admin-key.txt`
**600 kairfirma:kairfirma**; `/opt/kair-firma/internal-key.txt` **600 kairfirma:kairfirma**;
`/opt/kair-firma/backup.passphrase` **600 root:root**. La cuenta de verificacion (`javier`,
uid 1000) **no puede leer ninguno de los cuatro** (el `grep` del `.env` responde "Permission
denied" y el `grep -o '^[A-Z_]*='` no imprime ni un nombre).
Barrido del arbol desplegado (`src`, `config`, `scripts`, `web`) con patrones de clave privada,
`sk_live_`, `ghp_` y `xox*`: **sin coincidencias**.
Barrido del repositorio (`firma-service`, 361 archivos `.js/.json/.txt/.html` sin `node_modules`) con
los mismos patrones: **sin coincidencias**.
`sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md:1209`
- el canonico ya daba por cerrado el lado del repositorio y dejaba pendiente solo la comprobacion en
el servidor de los permisos de los dos archivos de llave: **esa comprobacion esta hecha**.
`Historial.md:8756` - "Barrido de secretos: limpio" en la ronda del 12-nov.

**Que falta.** Nada respecto de las credenciales: queda cerrado. **Reserva que no pertenece a este
requisito pero se deja dicha porque es su vecina:** el arbol de codigo esta en 777 (7.6), o sea que
el riesgo residual no es "una credencial expuesta" sino "un codigo reemplazado". Se corrige en el
7.6, no aqui.

**Quien lo tiene.** - (cerrado: verificacion de solo lectura del 12-nov-2026).

**7.9 · Verificar los registros y mecanismos de auditoria — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Que las tablas de bitacora existen y tienen contenido, que los disparadores
append-only estan instalados, y que los actos del P8 (12-nov) quedaron con rastro.

**Evidencia.**
Medido por SSH:
- `gh_firma_eventos`: **55 filas**, con el desglose por evento: `CREATED 5`,
  `IDENTIFICATION_COMPLETED 4`, `INVITE_SENT 4`, `OPENED 4`, `OTP_SENT 4`, `OTP_VERIFIED 4`,
  `PAPER_OPTION_AVAILABLE 4`, `CONSENT_ACCEPTED 2`, `SIGN_COMMITTED 2`,
  `PAPER_SIGNATURE_REGISTERED 1`, `ELECTRONIC_FLOW_CANCELLED 1`, `OTP_FAILED 1`, y otros.
- **36 disparadores append-only** instalados, entre ellos `trg_firma_eventos_no_delete` y
  `trg_firma_eventos_no_update`, `trg_aprobaciones_publicacion_no_delete/update`,
  `trg_anexo_nube_eventos_no_delete/update`, `trg_anexo_encargo_eventos_no_delete/update`,
  `trg_encargado_poderes_eventos_no_delete/update`, `trg_empresas_auditoria_no_delete/update`,
  `trg_firma_purga_registro_no_delete/update`.
- Rastro de los actos del P8: `gh_firma_anexo_nube_eventos` con **15** filas (las ultimas:
  `CONTRAFIRMA_CODIGO_INVALIDO` 15:41:11, `CONTRAFIRMA_CODIGO_ENVIADO` 16:12:54,
  `CONTRAFIRMA_FACULTAD_VERIFICADA` 16:13:54, `CONTRAFIRMA_FIRMADA` 16:13:54,
  `CONTRAFIRMA_ACTA_GENERADA` 16:13:54 con `hash=050f223a...4a501`) y
  `gh_firma_anexo_encargo_eventos` con **20** filas (`REPRESENTANTE_VERIFICADO` 15:40:32,
  `CONTRAFIRMA_FIRMADA` 16:14:31, acta `5dcb2149...4b062`).
- `gh_firma_aprobaciones_publicacion` con **4** filas, todas de tipo `OPERATIVA` y con
  `aprobado_por` = Javier Robles Fontalvo (v1.0, v1.4, v1.5, v1.6), y `gh_firma_empresas_auditoria`
  con su disparador de solo anexado.
- Bitacora del sistema: `journalctl -u kair-firma` responde y el monitor de salud cada 5 minutos
  deja log en `/opt/kair-firma/logs/health-check.log` (409 619 B al 12-nov 13:35).

**Que falta.** Nada: queda cerrado.

**Quien lo tiene.** - (cerrado: mecanismo construido y probado por el equipo, verificado hoy por
SSH en produccion).

**7.10 · Comprobar que el feature flag permanezca desactivado hasta la autorización —
CERRADO, y no por un flag sino por la fuente legal.**
La compuerta **es un dato de la fuente legal**: `config/tabla-conservacion.json`, clave
`aplicacion.activada`, hoy en `false` (y `aplicacion.validado_por: null`,
`aplicacion.estado: "PROPUESTA"`). No es una variable de entorno ni una constante del
código, y por lo tanto **ni el código ni una actualización automática pueden abrirla**:
abrirla es un acto expreso del owner, con la validación escrita del abogado encima. El
respaldo congelado del código también arranca cerrado. Con la compuerta cerrada el
plazo por defecto **no se aplica**: el registro queda retenido, sin fecha de supresión, con
el *hold* `tabla_supletoria_pendiente_validacion`, y el texto de correo al Trabajador no
promete ningún plazo de custodia. El abogado fijó en **J8** el orden en que esto se abre: validar
→ alinear el catálogo legado → reejecutar pruebas → **entonces** abrir la compuerta, con
validación escrita (ver 3.2).

**7.11 · Ejecutar pruebas controladas de extremo a extremo — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** Si el flujo electronico completo se ha ejercitado en produccion contra el
codigo que hoy corre, y si el caso real que el abogado pidio (buzon corporativo rechazado) ha
ocurrido alguna vez.

**Evidencia.**
Medido por SSH:
- Las **cinco** firmas de la base de produccion: `SIGN-2026-734698` (26-oct, OPENED),
  `SIGN-2026-827084` (26-oct, OTP_VERIFIED), `SIGN-2026-927141` (26-oct, SIGNED),
  `SIGN-2026-738564` (06-nov, SIGNED) y `SIGN-2026-016820` (06-nov, CANCELLED). La **ultima
  firma electronica completa es del 6 de noviembre**: despues del despliegue del 11-nov y de los
  cuatro actos del P8 del 12-nov **no se ha ejercitado el flujo de firma**.
- El evento mas reciente de la bitacora es del 06-nov 20:25:34Z (`ELECTRONIC_FLOW_CANCELLED`).
- Los dos programas que el canonico exige estan en el servidor
  (`/opt/kair-firma/app/scripts/smoke-produccion.js` y `limpiar-rastro-prueba.js`, ambos del
  11-nov 07:04), pero **no se han corrido** contra el codigo actual.
- El caso real rechazado **no ha ocurrido**: hay **0 eventos `OTP_MEDIO_CORPORATIVO`** en la base.
  Esto es T6 del abogado y sigue abierto:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:135`.
- La referencia historica que el propio canonico cita
  (`respuesta-checklist-cierre-2026-10-30.md:1237`) es del **26-oct-2026** con 12 comprobaciones y
  0 fallas: contra el codigo de esa fecha, no contra el de hoy.
- `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1123` - el pendiente del runbook:
  "[ ] Correr los tests de extremo a extremo con datos reales: crear sign request, enviar la
  invitacion por correo, firmar desde el celular y descargar la constancia".

**Que falta.** Una corrida controlada de extremo a extremo **contra el codigo desplegado hoy**:
crear la solicitud, enviar la invitacion, firmar desde el celular y descargar la constancia, y
despues retirar el rastro con `limpiar-rastro-prueba.js --solo-firmas`. Con eso se cierra 7.11 y
ademas el T6 del abogado (el caso del buzon corporativo rechazado, que es el que la compuerta C-1
debe ver ocurrir en la vida real antes de encenderse para empresas que no tengan el Anexo de Nube).
Es el unico pendiente de esta seccion que exige **una persona con un celular**, no un script.

**Quien lo tiene.** Owner (firma desde el celular y descarga de la constancia) con el equipo
(smoke, limpieza del rastro y acta).

**7.12 · Verificar la version y las migraciones en el servidor real — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Las dos mitades del requisito, por separado: las migraciones en el servidor real
y la version del codigo que corre en el servidor real.

**Evidencia.**
*Migraciones: verificadas* (mismo detalle que en 7.3 y 7.4): 61 de 61 aplicadas, 1:1 con el repo,
`integrity_check` ok, tablas, columnas y disparadores presentes, y las cuatro rutas que dependen de
las migraciones respondiendo 401 y no 404.
*Version: no se puede leer del servicio.* `sgsst-electron-app/firma-service/src/routes/health.js:45`
devuelve `kair_version: 'compatible-' + (config.env === 'production' ? '0.1.189' : 'dev')`, un
valor fijo. Medido por SSH: `/opt/kair-firma/app` **no tiene `.git`** y su `package.json` declara
`"version": "0.1.0"`, tambien fijo. El canonico ya lo anticipaba:
`respuesta-checklist-cierre-2026-10-30.md:1243` ("responde, pero no anuncia version ni
migraciones"), y por eso la comprobacion tiene que ser por disco.
*Por disco si se puede, y da un resultado que no es limpio:* los hashes de `src/server.js`,
`src/services/readinessLegal.js`, `config/tabla-conservacion.json`, `legal-readiness.json` y
`scripts/fixtures/acuerdo-v1.6.txt` **coinciden con el repo en `264d08df`**; los de
`package.json` y `package-lock.json` **no** (el deployed lock fija `express 4.22.2`,
`proxy-addr 2.0.7`, `qs 6.15.3`).
El manifiesto de produccion si esta verificado byte a byte: `sha256sum
/opt/kair-firma/app/legal-readiness.json` = `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`,
que es el hash canonico del repo.

**Que falta.** La mitad de migraciones esta resuelta. La de version queda a medias: (a) **no hay
sello de version en el servidor** (ni git, ni build, ni version leida del manifiesto), asi que
responder "que version corre" obliga a comparar hashes archivo por archivo; y (b) el arbol
desplegado es **mixto** (codigo de la punta del repo, dependencias de antes del paquete 1051), de
modo que **ningun commit unico describe lo que corre ahora mismo**. Resolverlo es lo mismo que
desplegar el 1051 y dejar el sello de version.

**Quien lo tiene.** Equipo (desplegar el 1051 con `npm ci --omit=dev` y dejar el sello de version);
owner (decidir si el sello se lee del manifiesto o del hash de un archivo de build).

**7.13 · Registrar el resultado de la comprobacion del servidor — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Que el resultado de la comprobacion del servidor quedara **escrito en el
documento que el canonico designa**, y no solo medido. Antes de esta medicion, la seccion 5.1 del
runbook era **solo el procedimiento** (parar, copiar, normalizar permisos, verificar hashes, migrar,
arrancar, verificar) y el resultado vivia disperso en el `Historial.md` y en los informes. Ahora el
resultado esta en la seccion 5.1 del runbook, en un apartado propio.

**Evidencia.**
`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md`, seccion **5.1.4 «El resultado medido de la
comprobacion del servidor (12-nov-2026)»**: la medicion completa, con el commit de referencia
(`264d08df`), el estado del servicio, las migraciones, las cuatro huellas, los permisos, los logs, la
red, los respaldos y el resultado del preflight; mas la comparacion archivo por archivo del arbol
desplegado (247 archivos en comun, 6 diferentes, 0 sobrantes) y el comando para reproducirla.
Las actas completas, con la salida integra de cada comando, estan en
`verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md` (esta comprobacion) y
`verificacion-cierre/acta-despliegue-2026-11-12.md` (el despliegue, requisito 8.8).
La medicion se hizo el 12-nov-2026, 19:52Z a 19:57Z, por SSH en modo de solo lectura: la base se
midio con `sqlite3 -readonly` y el unico script que necesita abrirla (el preflight) se corrio contra
una **copia** hecha con `.backup`, que es consistente; la original no se abrio en escritura.

**Que falta.** Nada del requisito: el resultado quedo registrado en el lugar que el canonico
designa, con el commit, las huellas, las migraciones, lo verificado y lo que quedo abierto con su
dueno. **Lo que el acta deja abierto es de otros requisitos** (7.5, 7.6, 7.7, 7.15 y el despliegue del
📦1051), y esos no se cierran por escribir un acta.

**Quien lo tiene.** Equipo (medir y escribir el acta). La parte que queda es del owner y esta
nombrada en el propio apartado 5.1.4.

**7.14 · Preparar un procedimiento de reversión o suspensión — CERRADO.**
- **Suspensión inmediata:** `sudo systemctl stop kair-firma` (deja de atender con el código
  anterior).
- **Reversión del contenido:** reinstalar el paquete anterior conservando el directorio; el
  procedimiento completo, con sus disparadores, está en
  `docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md`.
- **Disparador de reversión:** cualquier diferencia en la comprobación de 7.4 o de 7.12
  revierte antes de tocar nada; la restauración de la base se hace con el respaldo de las 22:00 del
  día anterior.

**7.15 · Autorizar expresamente la activacion del flujo — PENDIENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/secciones-6-7.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

**Que se verifico.** Que exista un acto expreso del owner autorizando la activacion del flujo, y
cual es el estado real de las compuertas que hoy gobiernan la apertura.

**Evidencia.**
Medido por SSH, `gh_firma_aprobaciones_publicacion` (4 filas): las cuatro autorizaciones
registradas son de tipo `OPERATIVA` y se refieren a **publicar el Acuerdo** (v1.0, v1.4, v1.5,
v1.6), con `aprobado_por` = Javier Robles Fontalvo. **Ninguna de las cuatro es una autorizacion
de activacion del flujo.**
Estado real de las compuertas, medido:
- `sgsst-electron-app/firma-service/config/tabla-conservacion.json:6` -> `"activada": false`, con
  `"validado_por": null` y `"estado": "PROPUESTA"`: la compuerta de conservacion **esta cerrada a
  proposito** (es el orden J8 del abogado: validar, alinear, reejecutar pruebas y solo entonces
  abrir).
- `sgsst-electron-app/firma-service/src/config.js:203` ->
  `exigirAnexoNube: process.env.FIRMA_EXIGIR_ANEXO_NUBE === 'true'`: el interruptor C-1 **esta
  apagado** (y el propio codigo exige un orden escrito antes de encenderlo).
- `sgsst-electron-app/firma-service/legal-readiness.json:10` -> `"publicado": true`; linea 142
  `"firmado": true`; linea 147 `"contrafirmado": true`; lineas 115 y 137 `"estado": "firmado"`.
  La compuerta tecnica esta en verde: `Historial.md:8694` ("42 items cada uno, 40 `ok`, 0
  pendientes, **0 bloqueantes**") y `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1318` (la
  compuerta `primera_firma` en `listo: true`).
- Pero la base tiene **una sola empresa** (medido: `900829731`, ASEPLUS CARIBE S.A.S.), que es la
  empresa de prueba: `Historial.md:8714` ("lo que no esta hecho es abrirlo a una empresa real: en
  la base de produccion hay UNA sola empresa, ASEPLUS CARIBE S.A.S., que es la de prueba").
- `.../paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:137` - **T8**
  ("Decision operativa del representante legal, identificando version/huella y verificaciones")
  sigue **Pendiente**.

**Que falta.** El **acto expreso del owner que autorice abrir el flujo a empresas reales**, con la
version, la huella y las verificaciones que lo sostienen (T8). Lo que hoy existe es otra cosa y hay
que distinguirla con cuidado: (a) la autorizacion de **publicar el Acuerdo v1.6**, que ya esta
registrada (fila 4 de `gh_firma_aprobaciones_publicacion`); (b) los **cuatro actos del P8**, que
se ejecutaron sobre la **empresa de prueba**; y (c) el hecho de que la compuerta tecnica este en
verde con 0 bloqueantes. **Ninguna de las tres cosas es la autorizacion de abrir el flujo**, y
ademas esa apertura tiene dos compuertas de proposito que hoy estan cerradas
(`aplicacion.activada: false` y `FIRMA_EXIGIR_ANEXO_NUBE` apagado): la de la tabla de conservacion
por decision del owner con el abogado (J8), y la del Anexo de Nube, que el codigo exige no
encender sin validar y reejecutar pruebas.

**Quien lo tiene.** Owner (el acto mismo, con su responsable y sus verificaciones), con el abogado
para la validacion de la compuerta de conservacion (J8) y la ratificacion externa (J6 y J7).

## 8. Constancia y cierre formal (10 requisitos)

**8.1 · El owner registra sus decisiones sobre el contenido — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/seccion-8.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** La seccion E del acta interna de decisiones del owner
(`paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md`) tiene las 14
filas de J1 a J14, y cada una trae decision o estado pendiente explicito, fundamento y fecha. Se
verifico ademas que el archivo esta en el repositorio y versionado, y que la fila de la seccion E
sobre "Autorizacion operativa independiente" sigue vacia.

**Evidencia.**
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103` (J1) a `:116` (J14) — las 14 filas del acta, cada una con decision, fundamento o evidencia y fecha (30-oct, 11-nov).
- `:109` (J7, pendiente), `:110` (J8, pendiente), `:111` (J9, pendiente) — tres puntos que el owner dejo **expresamente** pendientes, con su responsable. Es decir: registrados, no resueltos.
- `:124-125` — el bloque de firma del acta ("Nombre y cargo", "Firma", "Fecha") esta **en blanco**.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-cierre-abogado-2026-10-31.txt:105` — el criterio del propio plan para «aprobado para produccion» es "Seccion E **firmada**, con version y hash de A1-A4".
- `git log -- 11-checklist-definitivo-revision-juridica-y-cierre.md` — ultimo commit `91214c55` (P8): el acta esta versionada, no es un borrador local.

**Que falta.** Solo el acto: la firma del acta (lineas 124-125 en blanco). El contenido de las 14
decisiones esta completo y fechado. En el fondo siguen abiertos tres puntos que el owner registro
como pendientes, cada uno con su responsable: J7 (certificado societario y estados financieros para
la Circular Externa 002 de 2025 y el RNBD), J8 (validacion escrita de los plazos de 10 y 5 anos) y
J9 (validacion del procedimiento de la fecha de cese y del alcance del `hold`).

**Quien lo tiene.** Owner (la firma del acta) y abogado externo (J7, J8, J9).

**8.2 · Se registra la huella SHA-256 de la versión identificada — CERRADO como dato del manifiesto.**
El manifiesto declara `acuerdo.hash: 7298a943…c585490f` (v1.4). A4 permite al owner
identificar la misma versión en su registro; ello no equivale a una aprobación jurídica ni
activa `publicado`. La publicación requiere la ruta operativa correspondiente y las demás
condiciones aplicables.

**8.3 · El owner define fecha de vigencia y alcance de uso — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/seccion-8.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Que la fecha de vigencia la declaro el owner y no se invento ni se confundo con
la fecha de registro de la autorizacion; que el texto publicado y la base de produccion coinciden
con esa fecha; y que el alcance de uso es el del texto que el owner aprobo con version y huella.

**Evidencia.**
- `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt:5` — "Fecha de vigencia: 11 de noviembre de 2026." (el texto publicado, no una nota al pie).
- `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.6.txt:7-11` — la clausula "Alcance": regula el uso del mecanismo de firma electronica de K+AIR y aplica a todos los documentos que una Empresa envie a firma de sus trabajadores por esa via.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/11-checklist-definitivo-revision-juridica-y-cierre.md:103` — decision del owner del 11-nov-2026: aprueba la v1.6 con huella `08e1eb8b...f13e`, 75 961 B y "fecha de vigencia 11-nov-2026".
- `sgsst-electron-app/firma-service/legal-readiness.json:8-10` — `version: "v1.6"`, `fecha: "2026-11-11"`, `publicado: true`.
- SSH, 12-nov: `SELECT fecha_vigencia_inicio FROM gh_firma_acuerdo_versiones` (version activa) → `2026-11-11T19:51:42.036Z`. **Coincide** con la fecha declarada: no hay desalineacion entre el texto y la base, que era la trampa de `plan-cierre-abogado-2026-10-31.txt:101` (decision D, "fecha cierta, anterior a la publicacion").
- SSH, 12-nov: `gh_firma_aprobaciones_publicacion` id 4 → `fecha_creacion = 2026-11-11T19:46:11.639Z`, es decir la autorizacion operativa quedo registrada **5 minutos antes** de la activacion, que es el orden que exige la barrera de publicacion.
- El anexo contractual por su lado: `legal-readiness.json:114-129` (`anexo_encargo.estado = "firmado"`, 2026-11-12T16:14:31.105Z, huella `6308b1f7...b8948`) y `:141-151` (`anexo_nube.firmado = true`, v1.3, contrafirmado 2026-11-12T16:13:54.106Z). Las dos partes suscribieron, que es lo que el propio requisito pedia.

**Que falta.** Nada del requisito. Aclaracion de alcance: el "alcance de uso" declarado por el owner
es el **contractual**, el de la clausula "Alcance" del Acuerdo v1.6 (aplica a toda Empresa que lo
suscriba, documento por documento). El alcance **operativo** (a que empresas reales y desde cuando
se abre el servicio) no esta declarado por el owner y no se maneja en este requisito: se maneja en la
decision C del plan de cierre (`plan-cierre-abogado-2026-10-31.txt:89` y `:100`), que sigue abierta
y se reporta en 8.5 y en la conclusion.

**Quien lo tiene.** Owner (ya ejecuto el 11-nov-2026); las partes, en las suscripciones de los
anexos.

**8.4 · Se comprueba que los anexos aprobados sean los mismos que utiliza el servicio —
CERRADO.**
Verificado hoy, archivo por archivo y con huella recalculada:
- **Acuerdo:** `scripts/fixtures/acuerdo-v1.4.txt`, 73 208 B, `7298a943…c585490f`.
- **Anexo de Encargo:** `legal/anexo-encargo.html`, 86 397 B, `02651747…30d0f7`.
- **Anexo de Nube:** `legal/anexo-nube-v1.0.html`, 59 857 B, `aec7c401…83214ca`.
Las copias de publicación en `sitio/` (`anexo-encargo.html`, `anexo-nube-v1.0.html`) son
**byte a byte idénticas** a las de `legal/` (mismo SHA-256). No hay dos textos: hay uno, y
la copia de publicación y la que usa el servicio son el mismo archivo.
El Anexo de Encargo **se genera** desde `config/matriz-finalidades.json` y
`config/tabla-conservacion.json`, que son las fuentes únicas y que viajan dentro del
paquete de despliegue; el Anexo de Nube viaja en `legal/`. No hay una copia del Anexo que
pueda quedar desalineada del código: si cambia la fuente, cambia el Anexo.

**8.5 · Se completan las verificaciones técnicas de publicación — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/seccion-8.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Qué se verificó.** La compuerta `publicacion` medida contra el codigo desplegado en el servidor; el
estado de las migraciones en la base de produccion; la salud del servicio; las huellas de los tres
textos en disco; y el cruce con la lista de verificaciones tecnicas T1 a T9 y la compuerta G4 del
plan de cierre. La tabla de la seccion 7 del cuadro canonico (30-oct) esta desactualizada: lo que
manda es el estado medido.

**Evidencia.**
- SSH, 12-nov 18:33Z: `node scripts/auditar-readiness-legal.js --gate=publicacion` contra el codigo de `/opt/kair-firma/app` → "Gate: publicacion — LISTO · Items: 42 · OK: 40 · Pendientes: 0 · Avisos: 1 · N/A: 1", con `bloqueantes_pendientes: 0`. El JSON del reporte: `resumen = {"total_items":42,"ok":40,"pendientes":0,"avisos":1,"no_aplica":1,"bloqueantes":20,"bloqueantes_pendientes":0}`.
- El mismo reporte, item "Aprobacion operativa de la version vigente": **OK** — "La version v1.6 tiene autorizacion operativa (aprobada por Javier Robles Fontalvo, owner de K+AIR el 2026-11-11)". El gate `primera_firma` da el mismo resumen (42 · 40 ok · 0 pendientes · 0 bloqueantes).
- SSH, 12-nov: `SELECT COUNT(*), MAX(version) FROM gh_firma_schema_migrations` → `61 | 062_encargado_poderes_append_only`. Las migraciones 060, 061 y 062 (las del P8) estan aplicadas.
- SSH, 12-nov: `systemctl is-active kair-firma` → `active`; `is-enabled` → `enabled`; `GET http://127.0.0.1:3001/health` → `{"status":"ok","db":"ok","smtp":"configured","uptime_seconds":14629}`.
- SSH, 12-nov: `sha256sum` en disco → `acuerdo-v1.6.txt` `08e1eb8b...f13e`, `legal/anexo-nube-v1.3.html` `fdd10551...b585d`, `legal/anexo-encargo.html` `6308b1f7...b8948`. Coinciden con `legal-readiness.json:7`, `:145` y `:129`.
- SSH, 12-nov: `sha256sum /opt/kair-firma/app/legal-readiness.json` → `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`, byte a byte igual al del repositorio (medido tambien en el PC). `sha256sum /opt/kair-firma/legal/constancia-aprobacion-acuerdo.html` → `aaf68b4e7df5e2757d5885840056218d97a0cbb1c9fa624bf7861962c8d0b413`.
- Suite, registrada en el expediente: `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md` §7 (12-nov por la tarde: **2 667 pruebas, 2 665 verdes, 0 rojas, 2 omitidas**; el 12-nov por la manana, sobre el commit `e4dd5f31`, 2 665 / 2 663) y `verificacion-cierre/t1-corrida-desde-clon-limpio.md` (tres corridas desde clon limpio, 0 fallos).

**Que falta.** Cuatro cosas, todas con dueño, y ninguna es un problema del texto publicado. **Lo que se
resolvio el 12-nov-2026** esta al final; lo que sigue abierto, antes:

1. **T6, el E2E con el caso real de buzon corporativo rechazado.** El camino esta probado por la suite, pero **el caso real no ha ocurrido**: la base de produccion tiene **0** eventos `OTP_MEDIO_CORPORATIVO` (`Historial.md:8729-8733`). El requisito de T6 es "E2E controlado con el caso... limpieza del rastro y acta" (`paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:135`).
2. **T7, la reversion probada, no descrita.** Los programas existen; la prueba y su evidencia no (`10-informe-correcciones-para-asesor-juridico.md:136`). Sigue en la cola del 12-nov (`Historial.md:8783-8784`).
3. **T1, la corrida reproducible desde clon limpio ligada a un commit candidato.** Sigue pendiente en el informe del 30-oct/11-nov (`10-informe-correcciones-para-asesor-juridico.md:130`), y la suite completa **nunca se ha corrido en el servidor** (`sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1121-1122`).
4. **El respaldo que cubra los actos del P8.** El ultimo respaldo es del 11-nov 22:00 (`/opt/kair-firma/backups`, medido por SSH el 12-nov 13:40), o sea que **los cuatro actos del 12-nov todavia no estan en ningun respaldo**; el de hoy 22:00 los incluye. El respaldo off-site sigue pendiente (`Historial.md:8788-8790`).

**Lo que se resolvio el 12-nov-2026 (medicion de esta misma ronda).**
- **T4**: cerrado con `acta-comprobacion-servidor-2026-11-12.md` y `acta-despliegue-2026-11-12.md`.
- **T7**: **probada de verdad** — 58 OK, 3 avisos, 0 fallas, exit 0, con el volcado canonico de la base restaurada identico al de origen y produccion intacta. La prueba **encontro un defecto real** (el borrado por rango de `gh_consentimientos_firma` sin borrar antes sus eventos, que la FK bloqueaba), **corregido y medido con un A/B**: el programa desplegado aborta con `FOREIGN KEY constraint failed` y exit 3; el corregido borra con exit 0. Falta **desplegar la correccion** y la **restauracion cifrada real** (root). Acta: `verificacion-cierre/t7-reversion-probada.md`.
- **T1**: **tres corridas desde un clon limpio** (`npm ci` desde cero, Node 22, sin `.env`): 2 624/2 622/0/2, 2 630/2 628/0/2 y 2 650/2 648/0/2. Los conjuntos de nombres de prueba coinciden **exactamente** con las corridas del arbol del owner, y el clon final quedo byte a byte identico (4 780 de 4 780 archivos). Falta la corrida **sobre el commit** (T3 lo tiene el owner) y la suite **en el servidor** (`/opt/kair-firma/app/tests` no existe). Acta: `verificacion-cierre/t1-corrida-desde-clon-limpio.md`.
- **T6**: con la evidencia registrada (`verificacion-cierre/t6-caso-buzon-corporativo.md` y `scripts/probar-t6-medio-corporativo.js`), con la salvedad de que el caso real **no ha ocurrido en produccion**.

La compuerta G4 del plan (`plan-cierre-abogado-2026-10-31.txt:82`) exige T4, T6 y T7 con evidencia
registrada y T8 firmada: **T4, T6 y T7 tienen evidencia registrada; T8 no esta firmada** (y es un acto
de voluntad que solo el owner puede hacer).

**Quien lo tiene.** Equipo (desplegar la correccion de T7, la fila T7 del informe, T1 sobre el commit);
owner (T8 firmada, el respaldo off-site, la decision de abrir).

**8.6 · El representante legal firma la autorización operativa — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/seccion-8.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** Tres cosas: (a) la autorizacion operativa de la publicacion de la v1.6, que esta
registrada en el servicio; (b) el documento A4 (la Constancia de version y autorizacion de
publicacion), que es donde el propio requisito dice que debe quedar; y (c) lo que el expediente
decidio sobre donde vive esa autorizacion.

**Evidencia.**
- SSH, 12-nov: `gh_firma_aprobaciones_publicacion` id 4 → `tipo = OPERATIVA`, `version = v1.6`, `hash = 08e1eb8b...f13e`, `aprobado_por = "Javier Robles Fontalvo, owner de K+AIR"`, `fecha = 2026-11-11`, `fecha_creacion = 2026-11-11T19:46:11.639Z`, con `garantia`, `resultado_verificaciones` y `responsable_despliegue` diligenciados. Registro append-only: no se reescribe.
- `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:143-172` — la seccion 5, "Constancia de la autorizacion operativa", tiene **las cinco celdas de valor vacias** (`<td></td>` en las lineas 153, 157, 161, 165 y 169): version y huella autorizadas, garantia tecnica verificada, persona que autoriza, fecha y observaciones.
- `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html:174-189` — la seccion 6, "Firma del representante legal", tiene la fila de decision con nombre, firma y fecha **vacios**.
- `sgsst-electron-app/firma-service/legal-readiness.json:17` — `constancia.estado = "no_firmada"`. `:20` — la nota que declara que la autorizacion operativa "no se documenta en este documento sino en el registro append-only de aprobaciones de publicacion del servicio (`gh_firma_aprobaciones_publicacion`, tipo OPERATIVA)" y que quedo registrada el 11-nov-2026.
- `sgsst-electron-app/docs/MIGRACION-SERVIDOR-FIRMA.md:1062-1065` — el mismo criterio escrito en el plan de despliegue: la seccion 5 y la seccion 6 "siguen vacias **por diseno**: la autorizacion vive en el registro de aprobaciones del servicio, no en el documento".
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/plan-cierre-abogado-2026-10-31.txt:80` — T8: "Autorizacion operativa independiente del owner... **Documento firmado**, distinto de la Constancia. ESTE si es un acto de voluntad: la firma es la prueba". `:82` — compuerta G4: "T8 firmada, porque es un acto de voluntad y no una constancia". `:109` — "T8 firmada por el owner, separada de la aprobacion juridica" es criterio de «aprobado para produccion».
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:137` — T8 sigue como "Pendiente".
- `Historial.md:8783-8784` — la cola del 12-nov deja T8 abierto.

**Que falta.** El **documento firmado**. El registro del servicio tiene toda la sustancia que T8
pide (version, huella, garantia, resultados de las verificaciones, responsable del despliegue) y es
append-only, pero una fila en la base no es el acto de voluntad firmado que el plan exige para T8 ni
lo que el requisito pide ("firma"). La Constancia esta publicada en `kair.fyi` con las secciones 5 y
6 vacias, y el manifiesto lo declara (`no_firmada`). Aparte, y como acto distinto: no existe
autorizacion operativa para la **apertura** del servicio a empresas reales (la decision C, ver
8.5 y la conclusion); la autorizacion del 11-nov es solo de publicacion y su propia nota dice que
"la compuerta `FIRMA_EXIGIR_ANEXO_NUBE` sigue APAGADA por decision escrita del owner".

**Quien lo tiene.** Owner (representante legal de Gesstiar S.A.S.). Es un acto suyo: nadie mas lo
puede firmar.

**8.7 · Se registra la versión y huella que se publicará — CERRADO.**
`legal-readiness.json` → `acuerdo.version: "v1.4"`, `acuerdo.hash: 7298a943…c585490f`,
`acuerdo.archivo: "scripts/fixtures/acuerdo-v1.4.txt"` y `publicado: false`. El campo
`publicado` solo pasa a `true` con la publicación, y esa publicación la ejecuta
`scripts/publicar-acuerdo-legal.js`, que además exige que el texto publicado coincida con
el del manifiesto.

**8.8 · Se registra quién autorizó, cuándo y bajo qué resultados de pruebas — PARCIALMENTE.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/seccion-8.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PENDIENTE.*

**Que se verifico.** El registro append-only de aprobaciones de publicacion (que es donde el
servicio deja esos tres datos), las actas de los cuatro actos del P8, y si existe un acta que fije
los resultados para un commit y un despliegue identificados.

**Evidencia.**
- SSH, 12-nov: `gh_firma_aprobaciones_publicacion` id 4 — **quien**: `aprobado_por = "Javier Robles Fontalvo, owner de K+AIR"`, `responsable_despliegue = "Javier Robles Fontalvo"`; **cuando**: `fecha = 2026-11-11`, `fecha_creacion = 2026-11-11T19:46:11.639Z`; **bajo que resultados**: `resultado_verificaciones` (la huella del texto en el servidor coincide con la del manifiesto y con la archivada; el orden autorizacion → publicacion; las migraciones 060, 061 y 062 aplicadas; con la v1.6 activa el reporte de auditoria legal no reporta bloqueantes) y `garantia` (tope del texto, barrera de publicacion con huella, Constancia `aaf68b4e...d0b413`, suite del 11-nov con 2 577 pruebas / 2 575 verdes / 0 rojas / 2 omitidas, 61 migraciones aplicadas, `/health` en ok, compuerta de publicacion sin bloqueantes).
- Actas de los cuatro actos del P8, en el servidor (`ls /opt/kair-firma/storage/pdfs/actas`, 12-nov): `acta-2-anexo-encargo.pdf` (7 693 B), `acta-2-contrafirma-anexo-nube.pdf` (7 167 B), `acta-2-contrafirma-anexo-encargo.pdf` (7 405 B), con sus SHA-256 en `legal-readiness.json:117`, `:146` y `:151`.

**Que falta.**
1. El despliegue en produccion **no esta al dia**: el bump de dependencias (`dfc403b0`) **no se ha desplegado**, o sea que produccion sigue corriendo el arbol viejo de dependencias (`Historial.md:8781-8783`). Lo que se autorizo el 11-nov no es exactamente lo que corre hoy.
2. **La corrida reproducible desde clon limpio (T1) no existe** (ver 8.5).
3. **El 📦1051 sigue sin desplegarse**, y es lo que separa "el commit que se autorizo" de "el despliegue que corre".

**Lo que se resolvieron el 12-nov-2026 (medicion de esta misma ronda).**
- **Ya hay acta de despliegue**, escrita con el commit, las huellas, las migraciones y los resultados: `verificacion-cierre/acta-despliegue-2026-11-12.md`, con el resumen en `MIGRACION-SERVIDOR-FIRMA.md` §5.1.4.
- **Ya se sabe con certeza que codigo corre**, y no por inferencia: la comparacion por sha256 de los 247 archivos desplegables da **6 diferencias y 0 sobrantes**, y las 6 son `package.json`, `package-lock.json`, dos scripts auxiliares y dos archivos de despliegue. Todo `src/` es byte a byte el de `264d08df`. El control es reproducible: `firma-service/scripts/comparar-despliegue.js`, que sale con codigo 1 nombrando los archivos mientras haya diferencias.
- **Quien y cuando** ya estaban en el registro id 4 (append-only), y **el manifiesto** es byte a byte igual entre el repositorio y produccion.

**Quien lo tiene.** Equipo (acta de despliegue con commit — **hecha** —, corrida limpia, despliegue del `dfc403b0`); owner (la firma y la decision de autorizar).

**8.9 · Se conserva la constancia como evidencia histórica — CERRADO en el diseño.**
`scripts/fixtures/acuerdo-ARCHIVO.json` ya funciona así con la v1.0: versión inmutable, con
`fecha_archivado`, `verificado_el` y la nota de que cambiar el texto exige publicar una
versión nueva con su propia huella, y que los consentimientos ya aceptados no se tocan.

**8.10 · Se actualiza la documentación del proyecto y el registro de cierre — CERRADO.**

**Medicion del 12-nov-2026** (informe `verificacion-cierre/seccion-8.md`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la medicion y su evidencia.

*Cambio de estado: en la ronda del 30-oct-2026 figuraba como PARCIALMENTE.*

**Que se verifico.** Los cuatro documentos que el requisito nombra (`Historial.md`, `PROMPT.md`,
`BITACORA.md`, `CONTEXT.md`), el estado del cuadro canonico de 96 requisitos, y si existe el acta de
cierre de este checklist.

**Que se cerro el 12-nov-2026 (esta misma ronda).** Los cuatro huecos que se senalaban estan
cerrados, cada uno con su documento:

| Hueco | Como quedo |
|---|---|
| (1) El acta de cierre del checklist de 96 requisitos | `verificacion-cierre/acta-cierre-checklist-2026-11-12.md`: el **registro de cierre** del §5 del plan de cierre, con version, hashes, commit, resultados de T1 a T9, decisiones A, B y C, fecha y responsable, y la lista de los 22 pendientes con su dueño |
| (2) Una entrada de `BITACORA.md` con el hito de la v1.6 y del P8 | `BITACORA.md`, entradas del 12-nov-2026: el hito (P8 ejecutado con ASEPLUS, que es **empresa de prueba**; Acuerdo v1.6 publicado; compuerta en `listo: true`), mas los dos hallazgos de la ronda (el preflight que decide si se puede abrir, y la comparacion del arbol desplegado) |
| (3) Actualizar `CONTEXT.md`, que describia un estado que ya no existe | `CONTEXT.md`: bloque de estado al tope con lo que hay hoy, lo que no hay, la meta, los diez bloqueos duros y lo que el owner debe hacer |
| (4) El "registro de cierre" del plan (T1 a T9 y decisiones A, B y C por escrito con su fecha) | El mismo `acta-cierre-checklist-2026-11-12.md`, seccion 3 (T1 a T9 con su evidencia) y seccion 4 (A aplicada, B tomada con la compuerta cerrada, C decidida el 5-nov) |

**Evidencia.**
- `Historial.md` **al dia**: la novena ronda (`Historial.md:8579`) documenta los cuatro actos del P8 con sus horas y huellas (`:8600-8610` el manifiesto `191c08b8...f8a4013f` y la compuerta en `listo: true`), y la decima ronda (`Historial.md:8687`) responde la pregunta de produccion con medidas (`:8694-8699` los dos gates, `:8710-8716` la respuesta honesta, `:8718-8727` los dos interruptores). La onceava ronda empalma el estado de esta ronda.
- `PROMPT.md` **al dia**: la regla 5.30 (`:997-1022`) fija la palabra clave del estado de un requisito y la 5.19 (`:718`) el control que compara contra una constante.
- `sgsst-electron-app/BITACORA.md` — tres entradas del 12-nov-2026: el hito v1.6/P8, el preflight de la compuerta y la comparacion del arbol desplegado. Cada una con su "por que se rompio" y sus reglas. **Ademas se corrigio una filtracion de caracteres CJK que venia de una ronda anterior** (4 caracteres en una entrada vieja): el barrido de caracteres prohibidos ahora da cero en el archivo.
- `sgsst-electron-app/CONTEXT.md` — el bloque de estado del 12-nov-2026 esta al tope.
- El cuadro canonico esta reconciliado con la medicion de hoy: **76 cerrados / 20 pendientes / 96**, con la tabla regenerada por `scripts/contar-estados-checklist.js` y los 34 requisitos medidos actualizados por `scripts/actualizar-cuadro-canonico-2026-11-12.js` (el texto sale literal del informe que lo midio).
- `plan-cierre-abogado-2026-10-31.txt:91` — el "registro de cierre" del plan **no es condicion de produccion**: "Lo que bloquea es que falte la evidencia a la que el registro apunta (T4, T6, T7, T8 y T9)". Por eso el registro se escribe con evidencia registrada y no con firmas.

**Que falta.** Nada del requisito. **Lo que el registro deja abierto es de otros requisitos** (T8, que
es un acto de voluntad del owner, y T1, T6 y T7, que estan en curso o con su salvedad declarada), y
quedan nombrados con su dueño en el propio registro de cierre.

**Quien lo tiene.** Equipo (la documentacion y el registro: hechos). Owner (las decisiones A, B y C
por escrito —las tres estan tomadas— y el acto de voluntad de la T8).

## Nota final

Tres cosas que este documento dice a propósito, porque son las que más se piden
y las que más pueden costar:

1. **Nada de este paquete queda adoptado por el solo hecho de estar armado.** A4 no está
   firmada y no constituye aprobación jurídica; el Anexo de Nube conserva sus 14 marcas de
   «[PENDIENTE: el owner completa con la evidencia]», el manifiesto sigue con
   `publicado: false`, `anexo_encargo.estado: "no_firmado"` y `anexo_nube.firmado: false`,
   y la compuerta de activación está cerrada.
   **Nada se publicó, nada se activó y nada se firmó.**
2. **El endpoint `/health` del servidor no anuncia versión ni migraciones**, y desde el
   equipo portátil no hay acceso SSH. Por eso la constancia técnica contra el **servidor
   desplegado** no se incluye: declarar controles contra un servidor sin verificar sería
   prometer lo que el servidor no hace.
3. **Las decisiones y evidencias pendientes siguen abiertas**, y ninguna se cierra por esta
   actualización: la decisión del owner sobre A1, A2 y A3 (2.1, 2.2, 2.3); el papel de
   Google por escrito para cada Empresa (2.7, con la determinación de J6 incorporada pero
   con evidencias por Empresa pendientes); el alcance de la
   Circular 002 de 2025 (2.8); la inscripción en el RNBD (2.9); la validación de los plazos
   de 10 y 5 años (3.2, con el orden de J8 por delante); la fecha de vigencia del Acuerdo
   (8.3); y la evidencia de la cuenta de correo y sus credenciales (5.1, 5.5, 5.6).

**Cómo registrar la decisión:** el representante legal completa E para J1-J14, con decisión,
fundamento/evidencia y fecha, o indica expresamente que un punto sigue pendiente. La firma
del owner en E no se presenta como revisión profesional. Las autorizaciones de las Empresas,
la resolución documental del RNBD y las verificaciones técnicas siguen siendo independientes.
