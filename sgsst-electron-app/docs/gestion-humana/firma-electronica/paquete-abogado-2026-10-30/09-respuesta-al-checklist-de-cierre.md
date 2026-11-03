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
| 1. Integridad documental | 6 | 3 | 0 | 9 |
| 2. Decisiones de contenido y datos | 5 | 7 | 0 | 12 |
| 3. Conservación y supresión | 11 | 2 | 0 | 13 |
| 4. Seguridad del flujo | 14 | 0 | 0 | 14 |
| 5. Correo electrónico | 8 | 3 | 0 | 11 |
| 6. Correspondencia y pruebas | 12 | 0 | 0 | 12 |
| 7. Producción y despliegue | 3 | 12 | 0 | 15 |
| 8. Constancia y cierre | 4 | 6 | 0 | 10 |
| **TOTAL** | **63** | **33** | **0** | **96** |

Los 33 pendientes concilian: 3 de la sección 1 + 7 de la sección 2 + 2 de la sección 3 +
3 de la sección 5 + 12 de la sección 7 + 6 de la sección 8 = 33.

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
  en el árbol de trabajo: **2 090 pruebas, 2 088 aprobadas, 0 fallos y 2 omitidas (151,5 s)**.
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
| Anexo de Encargo (A2) | 86 407 | `7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` |
| Anexo de Nube v1.0 (A3) | 59 840 | `c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125` |
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
  **2 090 · 2 088 · 0 · 2**; esta suite se ejecutó localmente el 3-nov-2026 en el árbol de trabajo,
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
| Batería del `firma-service` | **2 090 · 2 088 verdes · 0 rojas · 2 omitidas**, corrida local 3-nov-2026 (151,5 s); pendiente reproducir desde clon limpio vinculado a T3 |

**Lo que la Fase 0 no mueve.** El cuadro sigue en **63 cerrados · 33 pendientes · 0 no aplica ·
96**: estas seis correcciones no crean ni cierran requisitos, hacen que el expediente diga la
verdad. Lo que sí queda pendiente está en el §8 y en las fases siguientes del plan del abogado.

---

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

**1.2 · Resolver la discrepancia entre la copia recibida y el manifiesto anterior — PENDIENTE
(falta el tamaño y hash de la copia que conserva el owner).**
El paquete actual se reconstruyó desde las fuentes del repositorio y sus archivos se
verificaron. La discrepancia de la copia recibida en la ronda anterior no puede atribuirse a
una conversión sin medir esa copia. Para esta v1.3, el archivo adjunto mide **71 555 bytes**;
si se convierte a CRLF, el aumento será de un byte por cada salto de línea (577 bytes):

- Si tu copia mide **72 132 bytes**, podría ser la conversión a CRLF.
- Si tu copia mide **57 187 bytes**, es el Acuerdo **v1.1** de la ronda del 27 de octubre, no
  la v1.3.
- Si tu copia mide **69 748 bytes**, es la **v1.2**.
- Si tu copia mide **73 208 bytes**, es el **v1.4**, que es el texto definitivo de hoy.

El valor del **v1.3, que queda como histórico**, es **71 555 bytes** y
`49eab0c5f3f0fa7e637843c50988b0f91867fe74ff31222cf8c327beabf4de12`; el del texto definitivo
(v1.4) es **73 208 bytes** y `7298a943…c585490f`. Envíame el tamaño y el
SHA-256 de tu copia y en un solo paso confirmo cuál de los cuatro casos es. Si prefieres
resolverlo sin depender de mí, la forma segura de recibirlo es por Drive (descarga directa
del archivo) y no por el cuerpo de un correo ni por WhatsApp, porque esos canales son los
que convierten el fin de línea.

**1.3 · Calcular y verificar SHA-256 del Acuerdo definitivo — CERRADO.**
`7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` (73 208 B, fin de línea
LF), recalculado el 30-oct-2026 sobre el archivo del repositorio. La v1.3 conserva su
huella `49eab0c5f3f0fa7e637843c50988b0f91867fe74ff31222cf8c327beabf4de12` (71 555 B) como
histórico. **El manifiesto ya declara la v1.4**: `acuerdo.archivo:
"scripts/fixtures/acuerdo-v1.4.txt"`, `acuerdo.hash: 7298a943…c585490f`, `acuerdo.version:
"v1.4"`, `publicado: false`. Ese valor es el que debe quedar transcrito en la Constancia
cuando apruebes.

**1.4 · Calcular y verificar SHA-256 del Anexo de Encargo — CERRADO.**
`7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` (86 407 B), recalculado el 1-nov-2026 sobre
`sgsst-electron-app/legal/anexo-encargo.html`, después de la cuarta revisión (plan de cierre del abogado del 31-oct-2026) y de la corrección del tipo social, del §5 y de la conclusión del RNBD (veredicto del abogado del 31-oct-2026). Su copia de
publicación `sitio/anexo-encargo.html` es **byte a byte idéntica**: mismo SHA-256, mismos
86 407 B. El manifiesto ya lo declara: `anexo_encargo.hash: 7d626ba9…9c5fd9`, con
`anexo_encargo.estado: "no_firmado"` (el modelo sigue sin firmar). El `SHA256SUMS.txt` del
paquete, reconstruido en esta ronda, lleva **esta misma** huella: ver 1.6.

**1.5 · Calcular y verificar SHA-256 del Anexo de Nube — CERRADO.**
`c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125` (59 840 B), recalculado el 1-nov-2026 sobre
`sgsst-electron-app/legal/anexo-nube-v1.0.html`, después de la cuarta revisión (plan de cierre del abogado del 31-oct-2026) y de la corrección del tipo social, del §5 y de la conclusión del RNBD (veredicto del abogado del 31-oct-2026). Su copia de
publicación `sitio/anexo-nube-v1.0.html` es **byte a byte idéntica**: mismo SHA-256, mismos
59 840 B. El manifiesto lo declara en el bloque del modelo (`anexo_nube.modelo.hash:
c9e29220…6f6e125`,
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
| 02 | Anexo de Encargo | 86 407 | `7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` |
| 03 | Anexo de Nube v1.0 | 59 840 | `c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125` |
| 04 | Constancia de versión y autorización de publicación v1.4 | 9 639 | `3fd45c658e5160e2c63005d348ec1fd200abb5f26593c6adf6aabd0ccd6a736c` |

El paquete no se publica ni se firma: armar el paquete no es aprobar nada.

**1.7 · Identificar la versión y documentar la decisión del owner — PENDIENTE.**
A4 es una constancia interna de versión y autorización de publicación, no una aprobación
jurídica. Su modelo identifica el documento y reserva al representante legal el registro de
la decisión operativa cuando las verificaciones estén completas. Los campos siguen vacíos;
no se afirma que la publicación esté autorizada ni que el contenido haya recibido aprobación
profesional. El owner registrará las decisiones J1-J14 en la sección E del checklist y firmará
A4 solo si y cuando decida autorizar la publicación, con versión, huella, evidencia y fecha.

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

**1.9 · Confirmar que no quedan marcadores de borrador, campos jurídicos sin resolver ni
textos contradictorios — PENDIENTE (parcial).**
- **Acuerdo v1.4: sin marcadores.** Se buscó TODO, TBD, XXX, FIXME, `[ ]`, `<<`, `>>`,
  PLACEHOLDER, `[fecha]`, `[nombre]`, `[...]`. Salieron **2** coincidencias de «TODO» (las
  dos dentro de «MÉTODO DE FIRMA ELECTRÓNICA PACTADO», que es la palabra legal), **7** de
  «pendiente» y **cero** de todo lo demás, y **se revisaron una por una**: todas son
  palabras del texto legal, no marcadores («todos los documentos que una Empresa envíe…»,
  «todo momento y sin costo alguno», «solicitud de copia pendiente», «hold vigente», «queda
  pendiente de informar y validar»). Cero marcadores reales.
- **Anexo de Encargo: sin marcadores.** Los **cero** `[PENDIENTE: …]` y las cinco filas con
  «Base jurídica propia de la Empresa: No declarada…» que quedaban en la ronda anterior
  están resueltos: las bases literales de J4 para 10.3(a), (b), (c) y (e) están escritas en
  la columna «Base jurídica declarada» y el «Estado de habilitación» de esas cuatro filas
  dice «Habilitada para la Empresa que haya suscrito el presente Anexo de Encargo y el
  Anexo de Nube, inscrito su tabla de retención documental y designado su canal de
  atención».
- **Anexo de Nube: los catorce (14) marcadores diligenciables quedaron diligenciados el
  31-oct-2026**, más una mención literal del marcador en el texto del §5, que no es un campo. El
  propio Anexo lo dice: «Este Anexo no se firma con marcadores [PENDIENTE] pendientes». **Inventario
  exacto, con dónde se comprueba y qué evidencia deja:**
  - **§4, tabla del RNBD (4).** (1) naturaleza jurídica de Gesstiar S.A.S. y si es sujeto de la
    Ley 1581 → certificado de existencia y representación de la Cámara de Comercio de Barranquilla;
    (2) activos totales a la fecha de corte → estados financieros y balance con sus notas; (3) si
    existe obligación de inscripción, incluida la de la base del servicio de firma → aplicación de
    la normatividad vigente de la SIC a los puntos 1 y 2; (4) estado del registro en el RNBD y si
    la declaración de la transferencia internacional ya está presentada y con qué causal → consulta
    del portal de la SIC.
  - **§5, ficha técnica del canal (10 campos y una mención).** Servidor SMTP efectivamente
    desplegado y evidencia de que la conexión sale cifrada; remitente efectivo y su evidencia;
    contraseña de aplicación: cuándo se generó; procedimiento y fecha de rotación; MFA
    (verificación en dos pasos); plantilla del correo OTP; contenido mínimo: la regla escrita y su
    evidencia; registro de errores y de envíos; escalamiento del canal, con responsables y
    evidencia; y última revocación de credenciales, con su evidencia. (La mención literal restante
    es la frase que explica el formato de la ficha, no un campo.)
  - **Ninguno de ellos era un hueco de texto:** eran los catorce datos que solo el owner podía dar
    con el servidor y la cuenta a la vista. **Ya están: el Anexo de Nube no tiene ni un marcador
    sin diligenciar.** Lo que sigue abierto es otra cosa —cuatro decisiones del propietario, el
    cifrado en reposo del disco y la validación del abogado—, y sin copia firmada el la compuerta C-1 está apagada hoy; el bloqueo se aplicará al activarla. Aprobar el modelo **no es** poder
    firmar el Anexo de una Empresa.
- **Textos contradictorios: la contradicción que el abogado señaló está del todo resuelta.** Ya no
  conviven un capítulo que da por decidida la clasificación del canal y otro que la deja
  pendiente: los cuatro documentos llevan la misma determinación (A1 §10.5(f), A2 §4, §5 y
  §8, A3 §4), con la advertencia de que no hay DPA empresarial y de que el Encargado no
  tiene facultades de supresión sobre las copias del proveedor. **En esta ronda se corrigieron
  además los cinco pasajes que seguían diciendo «requiere validación profesional escrita» al
  lado de esa determinación (2.7).** La correspondencia texto ↔ código (sección 6) recorre los
  26 compromisos del Acuerdo contra el código y no encuentra ni una sola promesa sin respaldo.

---

## 2. Decisiones de contenido y protección de datos (12 requisitos)

**2.1 · El owner decide si adopta el Acuerdo v1.4 — PENDIENTE.** La revisión del
30-oct-2026 aportó recomendaciones y correcciones C-1, C-2 y C-3, aplicadas en la v1.4
(`7298a943…c585490f`). El representante legal documenta en la sección E si adopta el texto,
lo condiciona o lo mantiene pendiente. A4 no registra una aprobación jurídica.

**2.2 · El owner decide si adopta el Anexo de Encargo — PENDIENTE.** Revisado y corregido
en esta ronda: el Anexo lleva las bases literales de J4
para 10.3(a), (b), (c) y (e), el estado «Habilitada» condicionado, el deber de la Empresa
de comunicar la fecha de cese, la determinación de J6 y la supresión de la mención al
calendario de Google (J5). Huella actual: `7d626ba9…9c5fd9`. Falta la decisión expresa del
owner sobre su uso y la suscripción entre las partes antes de tratar datos por cuenta de una Empresa.

**2.3 · El owner decide si adopta el Anexo de Nube — PENDIENTE.** Revisado y corregido
en esta ronda: §6 trae el texto literal de D2, §4 la
ficha de Google conforme a J6, §11 la cita corregida de la Circular 001 de 2026, §1 la
prevalencia en conservación, §8 la auditoría condicionada a la disponibilidad de Cloudflare
y §10 la advertencia de no firmarlo con marcadores. Huella actual: `c9e29220…6f6e125`.
Falta la decisión expresa del owner y la suscripción por las partes antes del tratamiento cubierto.

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

**2.5 · El owner decide sobre el tratamiento y las finalidades del numeral 10.3 —
PENDIENTE (ya está escrito; falta su decisión documentada).**
El 10.3 enumera **ocho finalidades**, y la matriz las trae con nueve campos cada una:
10.3(a) crear y gestionar la solicitud, (b) enviar el enlace y el OTP, (c) verificar la
identidad, (d) registrar la aceptación, (e) generar y entregar la constancia, (f) conservar
la evidencia, (g) atender PQRS y (h) cumplir obligaciones legales.
**Las bases jurídicas que faltaban ya están escritas**: el abogado las determinó por escrito
en **J4**, con la fórmula literal de cada una (autorización previa, expresa e informada del
Titular para 10.3(a); deber legal de confiabilidad de la firma para 10.3(b); deber legal de
verificar la identidad para 10.3(c); deber legal y contractual de generar y entregar la
constancia para 10.3(e)), y el Anexo de Encargo ya las trae en la columna «Base jurídica
declarada» (y en `config/matriz-finalidades.json`, que es la fuente única). **Grupo A:
(a) a (g), habilitadas solo para la Empresa que cumpla las tres condiciones** (suscribir
los dos anexos, inscribir su tabla de retención documental y designar su canal de atención).
**Grupo B: (h), no habilitada**, pendiente de que la Empresa identifique la obligación
concreta, su fundamento y plazo. Lo que falta es la decisión documentada del owner sobre el
texto (2.2), no el análisis: ese está hecho.

**Corrección de esta ronda: la columna «Estado de habilitación» de (d), (f) y (g).** J4 declaró
esas tres bases «correctas, sin cambio», pero el documento las traía todavía como «Propuesta; no
habilitada para producción hasta que el abogado valide la base jurídica…», mientras que este
cuadro las contaba como habilitadas de forma condicional: **el texto y esta respuesta decían cosas
distintas sobre las mismas tres finalidades**. Se alinearon con la misma condición que (a), (b),
(c) y (e) —«Habilitada para la Empresa que haya suscrito el presente Anexo de Encargo y el
Anexo de Nube, inscrito su tabla de retención documental y designado su canal de atención. No
habilitada en tanto no se cumplan esas tres condiciones»—, que es lo que corresponde a una base
declarada y validada. El cambio se hizo **en la fuente** (`config/matriz-finalidades.json`) y el
Anexo se regeneró con `scripts/generar-anexo-encargo.js`, que es idempotente y escribe `legal/` y
`sitio/` a la vez; el bloque generado no se edita a mano. La finalidad 10.3(h) **no se toca**: J4
la deja «No habilitada - pendiente de entrega de información por la Empresa» y así sigue.

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

**2.7 · Se documenta la decisión sobre Google LLC y la cuenta Gmail de consumo
— PENDIENTE (la determinación escrita requiere decisión del owner y evidencia por Empresa).**
El abogado **sí resolvió** esto por escrito, en **J6**, con la determinación literal que ya
está incorporada a los cuatro documentos: por la operación concreta, y contrastada con los
términos aplicables de la cuenta de consumo, Google LLC decide sobre la finalidad y los
medios de su propio servicio y trata los datos por cuenta propia; en esta operación actúa
como **Responsable del Tratamiento** (art. 3, literales d) y e), de la Ley 1581 de 2012) y
el flujo constituye una **transferencia internacional** de datos personales (art.
2.2.2.25.1.3, numeral 4, del Decreto 1074 de 2015) a un Responsable en Estados Unidos,
país con nivel adecuado de protección (numeral 3.2 del Título V de la Circular Única); no
existe DPA empresarial ni contrato de transmisión, y la determinación no atribuye al
Encargado facultades de supresión sobre las copias del proveedor. Verificado en los
archivos: A1 §10.5(f) (línea 365 de `acuerdo-v1.4.txt`), A2 §4, §5 y §8, y A3 §4.
**Lo que sigue pendiente para el owner:** (a) registrar en E sus decisiones J1-J14 sobre
los textos; (b) las evidencias que J6 exige
por Empresa —acknowledgment firmado, política de la Empresa con la transferencia y ficha del
RNBD—; y (c) la **decisión escrita y fechada de la fecha límite de migración** a una
cuenta empresarial con acuerdo de encargo, que el abogado marca como mitigación prioritaria
(no bloqueante, pero hoy no hay fecha). El Anexo de Nube §5 y el Anexo de Encargo §4 cubren
buena parte del estándar de la Circular 002/2025; falta el documento que lo reúna (2.8).
**Corrección de esta ronda: cinco pasajes que seguían diciendo «pendiente».** La determinación
de J6 ya estaba escrita e idéntica en el Anexo de Encargo §§4, 5 y 8 y en el Anexo de Nube §4, pero
**cinco pasajes seguían afirmando al lado que el papel de Google «requería validación profesional
escrita»**, y uno de ellos listaba la determinación escrita entre lo que quedaba pendiente. Eso
es un documento que afirma a la vez que la calificación está pendiente y que ya está decidida. Se
reescribieron los cinco:

| Documento | Pasaje | Qué dice ahora |
|---|---|---|
| Anexo de Encargo §5 | «La determinación de si Google actúa por cuenta propia… requieren validación profesional escrita» | El papel por operación y la calificación **están determinados** por la determinación que cierra la sección; los pasos externos que faltan no los reabren |
| Anexo de Encargo §5 | «Lo que queda pendiente… (i) la determinación escrita del papel de Google» | La lista de pendientes queda con los cuatro pasos externos reales (evidencia de controles del canal, la evidencia que el régimen de transferencias internacionales exija a la Empresa —la Circular 002/2025 **no aplica** a este canal—, declaración en el RNBD y política que informa al Titular) y dice **explícitamente** que la determinación no forma parte de esa lista porque está escrita y archivada |
| Anexo de Nube §1 | «El papel de Google por operación… requieren validación escrita del abogado colombiano» | La clasificación **está hecha y escrita** (Anexo de Encargo §5 y ficha del §4) y no queda pendiente de validación; los pendientes son la evidencia de controles, el RNBD y la evidencia que el régimen de transferencias internacionales exija a la Empresa (la Circular 002/2025 **no aplica** a este canal) |
| Anexo de Nube §4 | «su papel por operación y la clasificación jurídica del flujo requieren validación profesional escrita» | No quedan pendientes de validación: **están determinados** en el §5 del Anexo de Encargo |
| Anexo de Nube §4 (celda del DPA) | «La necesidad de un instrumento contractual… se determinan después de la validación profesional del papel de Google» | No existe contrato de transmisión: Google actúa como Responsable en esta operación, con los efectos del §5, y no se le imponen obligaciones contractuales de Encargado |

De paso se corrigió, en el mismo sentido, el lead-in de la tabla del §4 del Anexo de Nube, que decía
«La tabla no presupone que Google sea Responsable, Encargado o subencargado de Gesstiar» al lado
de una ficha que lo declara Responsable: ahora dice que la tabla **no presupone** ese papel sino
que **lo documenta** por lo determinado en el §5 del Anexo de Encargo.

**Y una desactualización que ya está corregida:** la nota `subencargados.google.nota` de
`legal-readiness.json` seguía diciendo que el papel de Google «queda pendiente de validación
profesional escrita» y que «no se declara una calificación jurídica cerrada». Con la determinación
de J6 ya incorporada a los cuatro textos, esa nota contradecía al expediente: **ya está
alineada** con la determinación, y el manifiesto sigue siendo ASCII puro y pasó la comprobación
automática (`actualizar-manifiesto-v1.4.js --check`, código 0).

**2.8 · Se verifica el alcance de la Circular Externa 002 de 2025 y la conclusión sobre
transferencias internacionales — PENDIENTE (bloqueante para publicar).**
El abogado lo verificó en fuente oficial y concluyó en **J7** que **no aplica a este
canal**: el ámbito de la Circular 002 de 2025 son los procesos de transferencia de
tecnología, y usar una cuenta de correo para enviar un OTP no es eso. Por tanto no exige
comunicación previa a la Delegatura por el solo uso de Gmail, y no se requiere Declaración
de Conformidad (EE.UU. tiene nivel adecuado de protección, numeral 3.2). **Lo que falta es
lo que J7 puso como condición:** si K+AIR se presenta ante sus Empresas como proveedor de
una tecnología que permite el tratamiento de datos personales, esa operación sí cae en el
ámbito de la Circular 002/2025 y debe documentarse —caracterización de las funcionalidades
que tratan datos (1.1), evaluación de cumplimiento (1.2), reglas de transferencia
internacional (1.3), mecanismos de responsabilidad demostrada (2.1-2.4), protección desde
el diseño y por defecto (3.1-3.3) y garantías contractuales (4.1-4.4)—. El Anexo de Nube
§5 y el Anexo de Encargo §4 cubren buena parte de esto; **falta el documento que lo reúna.**
Es tu decisión.

**2.9 · Se determina la obligación de inscripción en el RNBD o la excepción aplicable —
PENDIENTE (bloqueante para publicar).**
El abogado lo determinó por escrito en **J7**: el art. 2.2.2.26.1.2 del Decreto 1074
limita la inscripción a las sociedades con activos totales superiores a 100 000 UVT y a las
personas jurídicas de naturaleza pública; **una S.A.S. es una sociedad comercial y sí pertenece a la categoría de sociedades del literal (a); la posible exclusión depende de que sus activos totales no superen 100.000 UVT a la fecha de corte, verificados con certificado y estados financieros**, lo que hay que confirmar con el
certificado de existencia y representación y el balance. El Anexo de Nube deja el checklist
del RNBD **sin declarar inscrita ni exenta**. La parte registral (naturaleza jurídica, activos
totales y estado del registro) la verifica el owner con esos dos documentos; la declaración
de la transferencia en el RNBD, si la Empresa está inscrita, es de la Empresa (Responsable).
Queda pendiente de confirmar por el owner.

La **adenda 13** del paquete presenta para revisión la precisión normativa de que una S.A.S. sí pertenece a la categoría de sociedades; la conclusión factual sobre el umbral sigue pendiente del certificado, estados financieros y fecha de corte que determine el abogado. Se somete expresamente a su visto bueno como adenda explicativa.

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

**3.1 · Se valida jurídicamente la tabla supletoria de conservación — PENDIENTE (bloqueante
para publicar).**
La tabla vive en `firma-service/config/tabla-conservacion.json` y es la **fuente única**: de
ella salen el plazo por defecto del código, el piso legal y el punto de inicio, y de ella se
genera la sección 8 del Anexo de Encargo (fuente única, decisión E2 de tu especificación).
El Anexo y el código no pueden desincronizarse porque salen del mismo archivo.
El abogado la revisó en **J8** y la validó **con condiciones**; por eso la tabla declara hoy
`aplicacion.activada: false` y `aplicacion.validado_por: null`. La condición es que la
apertura es un acto expreso del owner y va después de los cuatro pasos del orden que fijó
J8 (ver 3.2). Hasta que eso ocurra, el requisito queda pendiente de esa validación escrita.

**3.2 · Se aprueban o modifican los plazos generales de 10 y 5 años — PENDIENTE (bloqueante
para publicar).**
El abogado los validó **con condiciones** en **J8**: 10 años (documento firmado, desde la
firma) y 5 años (registros operativos, solicitudes, lápida y recibo) son **topes de
custodia**, no plazos legales (art. 2.2.2.25.2.8 del Decreto 1074). Hoy **no aplican**: la
tabla declara su propia activación (`aplicacion.activada: false`) y el código la respeta:
no hay forma de que el sistema aplique esos plazos sin que esa fuente legal lo autorice, ni
una actualización automática puede abrirla. Con la compuerta cerrada, el comportamiento
legado aplica veinte (20) años desde la firma para categorías generales, con la fuente
`catalogo_sistema`. **Esto entra en tensión con D1, que prohíbe aplicar veinte años a todos
los documentos, y sigue pendiente de la corrección operativa**; por eso la compuerta de
publicación y activación permanece cerrada. El respaldo congelado del código también arranca
cerrado: si el archivo de configuración no se puede leer, el sistema conserva el plazo del
catálogo y no aplica los de la tabla por la sola falla de leer el archivo.
**El orden que hay que cumplir, según J8, es este y está en este orden:**
(i) validar los plazos — hecho; (ii) alinear el catálogo legado al orden de precedencia del
8.6(a): veinte años desde el cese para las cinco categorías del 8.6(b), *hold* sin término
para el contrato, y el plazo de la Empresa o el supletorio para el resto — pendiente;
(iii) reejecutar las pruebas — pendiente (6.11); (iv) **entonces** abrir la compuerta, con
validación escrita. Abrir la compuerta es un acto expreso del owner, con la validación
escrita del abogado encima. Los plazos 10/5 siguen, por tanto, **pendientes**.

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
aclaró en J10 y hay que tener presente:** el interruptor
`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` aparece **apagado** y el inventario de buzones
corporativos se ejecutó sobre **población vacía** (0 solicitudes revisadas el 26-oct-2026),
así que el rechazo incondicional **no está acreditado en producción**. La acreditación
—el interruptor en su estado efectivo, al menos un caso real rechazado con su asiento
`OTP_MEDIO_CORPORATIVO` y la reejecución del inventario con población real— es de la ronda
de pruebas de extremo a extremo (7.11), no de este requisito.

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

**5.1 · Se identifica la cuenta remitente real — PENDIENTE (es del owner y no viaja en los
documentos).**
La cuenta vive como variable de entorno en el servidor (`SMTP_FROM_EMAIL`,
`SMTP_FROM_NAME`). No está en el repositorio ni en ninguno de los nueve adjuntos, y no debe
ir: la evidencia se entrega al expediente, no al documento compartido.

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

**5.5 · Se acredita la activación de MFA — PENDIENTE (es del owner).**
No se trae en el paquete, por decisión propia: es evidencia de la cuenta, no del producto.

**5.6 · Se acredita el uso de contraseña de aplicación, sin incorporarla a los documentos ni
al repositorio — PENDIENTE (es del owner).**
La contraseña existe solo como variable de entorno en el servidor. **Verificado hoy: no
aparece en ninguno de los nueve adjuntos ni en el repositorio.** No se incorpora a los
documentos ni se transcribe en el expediente.

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
candidato: Acuerdo v1.4 `7298a943…490f` y Anexo de Encargo `7d626ba9…9c5fd9`. Las cuatro
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

**6.11 · Ejecutar la batería completa de pruebas del servicio — EJECUTADA en el árbol de trabajo; pendiente de vincular a T3.**
La corrida anterior, del 30-oct-2026 a las 21:37 (precede a la corrección del cálculo cuando
falta la fecha real de cese) había reportado **2 033 pruebas · 2 030 verdes · 1 roja · 2
omitidas · 148,3 segundos**; no acreditaba el estado de esta versión. La del 30-oct-2026 por
la tarde, sobre el candidato v1.4, reportó **2 062 pruebas · 2 059 verdes · 1 roja · 2
omitidas** (dos corridas independientes con el mismo resultado, según el registro histórico).
**Corrida ejecutada el 3-nov-2026 en el árbol de trabajo** con `npm --prefix firma-service test`:
**2 090 pruebas · 2 088 verdes · 0 rojas · 2 omitidas · 151,5 segundos**. La cifra coincide con
el reporte previo del equipo. La reconciliación informada sigue siendo 2 062 +16 por el canal
de fecha de terminación = 2 078; +12 por el control de huellas = 2 090 (**+28** total). El test
`ADVE6.7`, que había sido una falla en una corrida anterior, se corrigió en el test y no era un
defecto de código (detalle en el punto siguiente). **La ejecución no se hizo desde un clon
limpio ni está asociada a T3**, porque todavía no hay commit candidato.
La suite cubre lo que el abogado exige en **T1**: el cómputo desde el cese, las cinco
categorías del 8.6(b), la fecha de cese desconocida, el hold del contrato, la solicitud de
copia pendiente, la lápida y el recibo, la no-recalculación histórica y el alineamiento del
catálogo legado (`tests/conservacion-purga.test.js`, `tests/conservacion-8-6-h.test.js`,
`tests/services/conservacion-supletoria.test.js`, `tests/conservacion-deber-legal.test.js`,
`tests/recibo-supresion.test.js`), más el canal de la fecha de terminación
(`tests/fecha-terminacion-canal.test.js`). El resultado es de esta corrida local; su reproducción
desde un clon limpio y su vínculo al commit candidato T3 siguen pendientes.

- **La única roja era `ADVE6.7: zod acepta "5" (coerce)` y ya está corregida**
  (`tests/_adversary-e6e7.test.js:58`): esperaba 201 y recibía 422. **No era un defecto de
  código**: el 422 no venía del `consent_id` que el test mide, sino del control
  `declaracion_datos_sensibles`, que la ruta exige **desde el commit `5534aca7` (📦978)** y
  que el test no mandaba. El arreglo fue **en el test**: se le agregó la declaración, y
  **se conservaron** `version_kair`, `consent_id:'5'` y `assert.equal(r.status, 201)`, que es
  lo que el caso sigue comprobando. **El archivo sí se modificó en esta ronda**; lo que no se
  modificó fue el código de producción.
- **Las dos omitidas, con su razón escrita en el propio test:**
  (a) `internalServerLimiter: Capa 1 (id_empresa) 429 incluye headers IETF` — «Capa 1 con
  720 requests es muy lento; ver internalServerLimiter.test.js para test de isolation, y
  test de Capa 4 más abajo para headers IETF».
  (b) `§4.2: cliente omite document_hash del metadata → SKIP (zod schema lo requiere)` —
  «zod schema requiere document_hash; no se puede omitir sin cambiar el schema (fuera de
  scope)».
- Ninguna omisión oculta un defecto del producto: son, respectivamente, una prueba de
  rendimiento y una prueba de esquema que quedó fuera de alcance.
- **Corrección de esta ronda, reejecutada.** El archivado de los anexos de la firma
  (`manifiestoLegal.js`) llegaba a tumbar **33 firmas** con un 409 que el C-1 no manda: el
  C-1 bloquea por el **Anexo de Nube** y solo cuando esa Empresa no lo ha suscrito, y esa
  regla va detrás de la compuerta `exigirAnexoNube` (encendida) porque el Anexo de Nube v1.0
  sigue siendo un modelo sin publicar. El bloqueo del **Anexo de Encargo** en el archivado se
  retiró: esa suscripción ya es requisito de **crear** la solicitud (`empresa.js`), con su
  excepción auditable, y una firma otorgada por una vía legítima no se deshace. Además, la
  composición de la evidencia —que con C-2 pasó de 17 a 26 campos— estaba duplicada en cinco
  pruebas y cada copia era una receta distinta: ahora vive en **una sola** función
  (`buildEvidenciaFirma`, `tests/helpers.js`), que es la receta de recomputación por terceros.
- **Observación para la ronda siguiente (no es un defecto):** el plan interno de retención
  sigue devolviendo `anios: 20` cuando no hay plazo aplicable (compuerta cerrada, sin fecha de
  cese). Verificado: ese número **no llega a ningún texto** —la rama que lo usaría dice la
  verdad y no menciona años—, así que no hay nada que corregir en el 8.6. Se deja anotado
  para que nadie lo reutilice como si fuera un plazo.

**6.12 · Documentar los errores preexistentes, pruebas omitidas y resultados nuevos —
CERRADO.**
- **Servicio (corrida local del 3-nov-2026: 2 090 pruebas; 2 088 en verde, 0 con fallos, 2 omitidas, 151,5 s; falta clon limpio/T3).** La roja que había,
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
`7d626ba9…9c5fd9`). Esa salida estática no sustituye la reejecución de pruebas. La cifra de 1-nov solo está reportada por el equipo y sigue pendiente de vinculación al commit candidato T3. `SHA256SUMS.txt` se
reconstruyó con los **catorce** adjuntos y sus huellas actuales, ya sobre los textos
corregidos (1.6).

---

## 7. Producción y despliegue (15 requisitos)

**7.1 · Confirmar la versión exacta del código que se va a desplegar — PENDIENTE.**
El checklist anterior reportó el commit **`e1d10728`** (📦993) en la rama `Dev-Pc`, pero
esta corrección está en el árbol de trabajo sin commit. Se debe elegir y verificar el commit
que contenga los cambios antes de preparar un despliegue. No se publica ni activa desde este
paquete.
Los commits relevantes del árbol de trabajo son: `bd7113a0` (989, conservación con trazabilidad y compuerta), `aa568023`
(990, Acuerdo v1.3 y anexos), `ede74ebf` (991, despliegue con `config/` y compuerta),
`2805ef98` (992, limpieza) y `e1d10728` (993, cierre de la limpieza). El paquete se armó con
`git archive` **de ese commit**, de modo que solo lleva lo commiteado.
**A 30-oct-2026 el commit candidato todavía no se puede fijar**, y por dos razones que el
propio abogado escribió (T3): (i) los textos corregidos (Acuerdo v1.4, Anexos y Constancia)
existen en el árbol de trabajo pero **sin commitear**; (ii) el **paquete** se está
regenerando en esta misma ronda (el manifiesto ya está en la v1.4, ver 7.2). La diferencia
entre el paquete y el árbol de trabajo no es cosmética: el `01-acuerdo-uso-v1.3.txt` que
viaja en el paquete es la copia del árbol de trabajo (71 555 B, `49eab0c5…`), no la que está
commiteada en `aa568023` (73 056 B, `2f8884c3…`).

**7.2 · Confirmar que el manifiesto corresponde a esa versión — CERRADO.**
`firma-service/legal-readiness.json` es el manifiesto que viaja dentro del paquete, y
**declara la v1.4** (actualizado en esta misma ronda): `acuerdo.archivo:
"scripts/fixtures/acuerdo-v1.4.txt"`, `acuerdo.hash: 7298a943…c585490f`, `acuerdo.version:
"v1.4"`, `publicado: false`; `constancia.archivo:
"legal/constancia-aprobacion-acuerdo.html"`, `constancia.hash: 3fd45c65…736c`,
`constancia.version: "v1.4"`, `constancia.estado: "no_firmada"`; `anexo_encargo.hash:
7d626ba9…9c5fd9` con `estado: "no_firmado"`; `anexo_nube.modelo.hash: c9e29220…6f6e125`
con `anexo_nube.firmado: false` y `anexo_nube.hash: null`; y un bloque nuevo para la fuente
única de la matriz (`matriz_finalidades.archivo: "config/matriz-finalidades.json"`,
`hash: f09f80c9…711552`, `version: "1.0"`). Las claves `v1_1_*` quedaron renombradas, que es
lo que pedía el punto 5 de J14.
**Lo que no puede cambiar, y no cambió, es la garantía de fondo (punto T9 del abogado):**
`publicado: false`, `anexo_encargo.estado: "no_firmado"`, `anexo_nube.firmado: false`,
`tabla-conservacion.json → aplicacion.activada: false` (`validado_por: null`), y
`subencargados.google.dpa: false` sigue declarado como tal, sin que el texto afirme lo
contrario.

**7.3 · Ejecutar las migraciones de base de datos necesarias — PENDIENTE (bloqueante para
publicar; es la última milla).**
Las nuevas de esta línea son `047_prueba_aceptacion_supresion`,
`048_prueba_aceptacion_append_only` y `049_conservacion_supletoria`, **más**
`050_anexo_nube_por_empresa` y `051_alcance_aceptacion`, que son de esta ronda (la 051
registra el alcance de la aceptación de C-2: versión y huella de los dos anexos, versión y
huella de la matriz, medio de disposición y fecha de disposición). **Deben correr con el
servicio parado.** La 048 es append-only y, en el ambiente de pruebas, las migraciones
append-only se omiten por directiva de ambiente (`skipEnv: test`) y se prueban por
separado; en el servidor se aplican.

**7.4 · Comprobar que las migraciones se aplicaron correctamente — PENDIENTE.**
Se comprueba en disco sobre el servidor, después de migrar.

**7.5 · Verificar el estado de la base de datos y sus respaldos — PENDIENTE (el procedimiento
está escrito; la comprobación es en el servidor).**
Está declarado en el manifiesto (`infraestructura.respaldos`): copia automatizada diaria a
las 22:00 hora de Colombia de la base de datos y de la evidencia en PDF, **cifradas en
reposo** con una frase de paso que el owner conserva **fuera del servidor**; retención de 30
días de las **copias**, no de los registros; verificación de cada copia con
`PRAGMA integrity_check` y **prueba de restauración mensual**; la supresión del 8.6 alcanza
a las copias que siguen existiendo mediante una purga periódica que descifra, suprime,
recifra y reemplaza cada copia de forma atómica. RTO 4 horas, RPO 24 horas.

**7.6 · Comprobar los permisos de archivos y directorios — PENDIENTE.**
`sudo chown -R kairfirma:kairfirma /opt/kair-firma/app /opt/kair-firma/legal`.

**7.7 · Comprobar la configuración de seguridad del servicio — PENDIENTE.**
En el servidor: claves de entorno, llaves de API y rutas del túnel.

**7.8 · Verificar que no haya credenciales expuestas — PENDIENTE (en el repositorio: cerrado).**
**Verificado en el repositorio:** no hay ninguna credencial en el código ni en los ocho
adjuntos. Las llaves se leen del entorno (`ADMIN_API_KEY` e `INTERNAL_API_KEY`) y en el
servidor viven en `/opt/kair-firma/admin-key.txt` e `internal-key.txt`. Falta verificar en
el servidor que esos dos archivos tienen permisos restringidos y no los lee nadie más.

**7.9 · Verificar los registros y mecanismos de auditoría — PENDIENTE (el mecanismo está
cerrado).**
El mecanismo está construido y probado: bitácora de solo anexado con disparadores de base
de datos. Falta la comprobación en el servidor.

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

**7.11 · Ejecutar pruebas controladas de extremo a extremo — PENDIENTE (la última milla).**
`scripts/smoke-produccion.js --e2e --confirmar-e2e`, y después
`scripts/limpiar-rastro-prueba.js --solo-firmas` para retirar el rastro de la prueba.
**Referencia:** ese mismo script corrió contra `https://firma.kair.fyi` el 26-oct-2026 con
**12 comprobaciones y 0 fallas**, abriendo el enlace que él mismo acababa de crear y
resolviendo el token.

**7.12 · Verificar la versión y las migraciones en el servidor real — PENDIENTE, y es el
punto que no se puede cerrar desde este equipo.**
El endpoint `/health` del servidor **responde, pero no anuncia versión ni migraciones**:
devuelve `kair_version: "compatible-0.1.189"`, que es un valor fijo y no dice qué código
está corriendo. Por eso la comprobación tiene que ser **por disco**: la huella de
`/opt/kair-firma/app/config/tabla-conservacion.json` y de
`/opt/kair-firma/app/scripts/fixtures/acuerdo-v1.4.txt` (el texto candidato es ahora la
v1.4, con `7298a943…c585490f`), y la verificación de las
migraciones aplicadas. No hay acceso SSH desde el equipo portátil, así que esta verificación
se hace por el panel de control del servidor.

**7.13 · Registrar el resultado de la comprobación del servidor — PENDIENTE.**
Es el acta del despliegue. El documento que la recoge es
`docs/MIGRACION-SERVIDOR-FIRMA.md`, sección 5.1.

**7.14 · Preparar un procedimiento de reversión o suspensión — CERRADO.**
- **Suspensión inmediata:** `sudo systemctl stop kair-firma` (deja de atender con el código
  anterior).
- **Reversión del contenido:** reinstalar el paquete anterior conservando el directorio; el
  procedimiento completo, con sus disparadores, está en
  `docs/gestion-humana/firma-electronica/plan-seguridad-2026-10-25.md`.
- **Disparador de reversión:** cualquier diferencia en la comprobación de 7.4 o de 7.12
  revierte antes de tocar nada; la restauración de la base se hace con el respaldo de las 22:00 del
  día anterior.

**7.15 · Autorizar expresamente la activación del flujo — PENDIENTE (bloqueante para
publicar; corresponde al owner después de completar las verificaciones).**

---

## 8. Constancia y cierre formal (10 requisitos)

**8.1 · El owner registra sus decisiones sobre el contenido — PENDIENTE.**
Las preguntas J1-J14 siguen abiertas hasta que el owner documente una respuesta, condición
o estado pendiente para cada una. Las recomendaciones del abogado se conservan atribuidas a
su autor y no se sustituyen por una firma de A4.

**8.2 · Se registra la huella SHA-256 de la versión identificada — CERRADO como dato del manifiesto.**
El manifiesto declara `acuerdo.hash: 7298a943…c585490f` (v1.4). A4 permite al owner
identificar la misma versión en su registro; ello no equivale a una aprobación jurídica ni
activa `publicado`. La publicación requiere la ruta operativa correspondiente y las demás
condiciones aplicables.

**8.3 · El owner define fecha de vigencia y alcance de uso — PENDIENTE.** La fecha de vigencia
la declara el owner antes de publicar; no se inventa ni se confunde con la fecha de registro
de A4. Los anexos contractuales requieren sus propias suscripciones por las partes.

**8.4 · Se comprueba que los anexos aprobados sean los mismos que utiliza el servicio —
CERRADO.**
Verificado hoy, archivo por archivo y con huella recalculada:
- **Acuerdo:** `scripts/fixtures/acuerdo-v1.4.txt`, 73 208 B, `7298a943…c585490f`.
- **Anexo de Encargo:** `legal/anexo-encargo.html`, 86 407 B, `7d626ba9…9c5fd9`.
- **Anexo de Nube:** `legal/anexo-nube-v1.0.html`, 59 840 B, `c9e29220…6f6e125`.
Las copias de publicación en `sitio/` (`anexo-encargo.html`, `anexo-nube-v1.0.html`) son
**byte a byte idénticas** a las de `legal/` (mismo SHA-256). No hay dos textos: hay uno, y
la copia de publicación y la que usa el servicio son el mismo archivo.
El Anexo de Encargo **se genera** desde `config/matriz-finalidades.json` y
`config/tabla-conservacion.json`, que son las fuentes únicas y que viajan dentro del
paquete de despliegue; el Anexo de Nube viaja en `legal/`. No hay una copia del Anexo que
pueda quedar desalineada del código: si cambia la fuente, cambia el Anexo.

**8.5 · Se completan las verificaciones técnicas de publicación — PENDIENTE.**
Son las de la sección 7, en el servidor.

**8.6 · El representante legal firma la autorización operativa — PENDIENTE.** Se documenta
en A4 solo después de completar y verificar las condiciones de publicación.

**8.7 · Se registra la versión y huella que se publicará — CERRADO.**
`legal-readiness.json` → `acuerdo.version: "v1.4"`, `acuerdo.hash: 7298a943…c585490f`,
`acuerdo.archivo: "scripts/fixtures/acuerdo-v1.4.txt"` y `publicado: false`. El campo
`publicado` solo pasa a `true` con la publicación, y esa publicación la ejecuta
`scripts/publicar-acuerdo-legal.js`, que además exige que el texto publicado coincida con
el del manifiesto.

**8.8 · Se registra quién autorizó, cuándo y bajo qué resultados de pruebas — PENDIENTE.**
Es el acta. El resultado disponible del servicio es el de 6.11 (corrida local 3-nov-2026, aún
sin vínculo a T3); la cifra de la app (146 · 140 · 6) corresponde a la línea base registrada.
El acta debe fijar los resultados reproducidos para el commit y el despliegue que finalmente se autoricen.

**8.9 · Se conserva la constancia como evidencia histórica — CERRADO en el diseño.**
`scripts/fixtures/acuerdo-ARCHIVO.json` ya funciona así con la v1.0: versión inmutable, con
`fecha_archivado`, `verificado_el` y la nota de que cambiar el texto exige publicar una
versión nueva con su propia huella, y que los consentimientos ya aceptados no se tocan.

**8.10 · Se actualiza la documentación del proyecto y el registro de cierre — PARCIALMENTE.**
Ya está actualizado: `Historial.md` (entradas del 30-oct, tarde y noche), `PROMPT.md`
(reglas 5.19 a 5.23 y trampas 105 a 109), `sgsst-electron-app/BITACORA.md` (las dos
entradas del 30-oct) y `sgsst-electron-app/CONTEXT.md` (el hito de la v1.3 y el de la
compuerta). **Falta** el acta de cierre de este checklist, que se escribe cuando los
pendientes estén resueltos. A 30-oct-2026, con el cuadro reconciliado (D4), falta además
registrar en la bitácora la publicación de la v1.4 y sus huellas nuevas.

---

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
