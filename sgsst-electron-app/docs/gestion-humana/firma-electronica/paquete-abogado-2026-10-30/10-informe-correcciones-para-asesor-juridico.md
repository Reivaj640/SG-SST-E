# Informe de correcciones para revisión jurídica

**Expediente:** firma electrónica K+AIR — Gesstiar S.A.S.
**Fecha:** 30 de octubre de 2026
**Destinatario:** asesor jurídico que emitió la revisión del 30-oct-2026 (adjunto 00)
**Objeto:** respuesta punto por punto a su revisión, con la evidencia de cada corrección y lo que queda pendiente de su decisión.

---

## 1. Resumen ejecutivo

Se aplicaron las correcciones de texto que su revisión exigió, sobre una **versión nueva del Acuerdo de uso (v1.4)** y nuevas versiones de los tres anexos. Cada corrección se hizo sobre el texto, con la diferencia entre versiones escrita y no transcrita, de modo que el texto corregido se puede comparar con el que usted revisó.

**Lo que se hizo**

- Se armó la **v1.4** del Acuerdo desde la v1.0 sellada, incorporando C-1, C-2, C-3, J3, J6/D1 y J14-2. La diferencia entre versiones queda **escrita**, no transcrita: el archivo `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.4-cambios.json` contiene el texto final de cada numeral cambiado, y se construyó con `scripts/construir-acuerdo-v1.4.js` a partir del de la v1.3.
- Se corrigió el **Anexo de Encargo**: J4, J12, J14-1, J9, J5, C-1 y J6/D1. Lo produce `scripts/generar-anexo-encargo.js` a partir de la matriz de finalidades, de modo que la matriz no se edita a mano dentro del documento.
- Se corrigió el **Anexo de Nube**: D2 literal en el §6, RTO en el §3, §10, §1, §9 y §8.
- Se reclasificó A4 como **Constancia de versión y autorización de publicación**; no atribuye aprobación jurídica al owner ni la presenta como requisito legal.
- Se corrigió el **manifiesto legal** (`legal-readiness.json`) y se le ató una prueba automática de siete (7) casos a los archivos reales.
- Se implementó el **código** de C-2 y C-1, se corrigió el cálculo de la retención para que no invente fechas y se forzó el cifrado en tránsito del canal de correo.
- Se redactó el **procedimiento de incidentes de datos de salud** (adjunto 12).

**Lo que NO se hizo, deliberadamente**

- No se publicó nada, no se firmó nada, no se abrió ninguna compuerta y no se hizo ninguna confirmación de cambios en el repositorio. La v1.3 queda como histórico, sin publicar, y **no se pide su aprobación sobre ella**.
- El bloqueo de solicitudes de firma sin Anexo de Nube suscrito está construido y probado, pero **detrás de una compuerta que está apagada** (`FIRMA_EXIGIR_ANEXO_NUBE`). Se explica por qué en el §5 y cuál es la secuencia para encenderla.
- La compuerta de conservación de 10 y 5 años sigue apagada (`tabla-conservacion.json` → `aplicacion.activada: false`), porque depende de la validación de los plazos que usted debe hacer.

**Lo que se le decide a usted**

Ocho (8) decisiones, detalladas en el §6. La principal: aprobar o no la v1.4 del Acuerdo y los tres anexos, identificando **versión y huella nuevas**, como exige su D3.

### El cuadro de los 96 requisitos

El cuadro reconciliado de los 96 requisitos queda así:

| Cerrados | Pendientes | No aplica | Total |
|---:|---:|---:|---:|
| 59 | 37 | 0 | 96 |

**De dónde sale el número:** no está escrito a mano. La tabla de conteo de `sgsst-electron-app/docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md` (adjunto 09) la genera el programa `sgsst-electron-app/firma-service/scripts/contar-estados-checklist.js`, que lee el documento y cuenta los estados reales de cada requisito, y después imprime el total. Al ejecutar ese programa el resultado es:

```
  Seccion 1: cerrados 5, pendientes 4, no aplica 0, total 9
  Seccion 2: cerrados 5, pendientes 7, no aplica 0, total 12
  Seccion 3: cerrados 10, pendientes 3, no aplica 0, total 13
  Seccion 4: cerrados 14, pendientes 0, no aplica 0, total 14
  Seccion 5: cerrados 8, pendientes 3, no aplica 0, total 11
  Seccion 6: cerrados 10, pendientes 2, no aplica 0, total 12
  Seccion 7: cerrados 3, pendientes 12, no aplica 0, total 15
  Seccion 8: cerrados 4, pendientes 6, no aplica 0, total 10
  TOTAL: cerrados 59, pendientes 37, no aplica 0, total 96
```

Las ocho secciones suman los 96 requisitos y la suma cuadra. Esto responde a su D4, que pedía «un único cuadro con los 96 estados, suma que cuadre, y la evidencia por punto»: el cuadro es el del adjunto 09 y su tabla se genera, no se escribe.

---

### Tercera revisión (31-oct-2026, tarde): quince correcciones aplicadas

Una tercera revisión del paquete, recibida la misma tarde, encontró **6 contradicciones
jurídicas, 5 inconsistencias de huella y conteo y 4 textos de retención**. Las quince están
aplicadas en los archivos de origen, y el paquete se reconstruyó después.

| # | Qué se corrigió | Dónde |
|---|---|---|
| **A-1** | La nota del modelo del Anexo de Nube en el manifiesto decía que el papel por operación, la clasificación jurídica, la Circular 002/2025, el RNBD y la evidencia técnica «quedan pendientes de validación profesional escrita». Ahora: el papel y la clasificación **están determinados**, la Circular 002/2025 **no aplica** a este canal, y quedan pendientes la verificación del RNBD y la evidencia técnica | `legal-readiness.json` |
| **A-2** | El pendiente (ii) del §5 del Anexo de Encargo pedía las «medidas… conforme al numeral 2 de la Circular Externa 002 de 2025», que el §5 del Anexo de Nube niega. Ahora es la evidencia que el régimen de transferencias internacionales exija a la Empresa como Responsable, con la constancia de que la Circular no aplica | `legal/anexo-encargo.html` §5 |
| **A-3** | El §12 del Anexo de Encargo afirmaba que la aceptación no resuelve «la validación conforme a la Circular 2 de 2025». Ahora: los requisitos de la transferencia internacional son la declaración en el RNBD, cuando la Empresa esté obligada a inscribirse, y las obligaciones de información y autorización frente al Titular | `legal/anexo-encargo.html` §12 |
| **A-4** | El aviso del Anexo de Nube repetía la contradicción en (iii), y su (iv) decía «las tres preguntas» cuando el §5 ya las responde | `legal/anexo-nube-v1.0.html` §1 |
| **A-5** | La exigibilidad de declarar en el RNBD «depende de la clasificación profesional del flujo». Ahora depende de la naturaleza jurídica y de los activos totales de Gesstiar S.A.S. frente al artículo 2.2.2.26.1.2 del Decreto 1074 de 2015 (modificado por el Decreto 090 de 2018), y de la verificación de los puntos 1 a 4 por el owner | `legal/anexo-nube-v1.0.html` §4 |
| **A-6** | «La necesidad de esos instrumentos… permanece pendiente». Ahora la necesidad del contrato de transmisión y de las Normas Corporativas Vinculantes **ya está resuelta** en esa sección, y queda por precisar si subsiste alguna exigencia de medidas a cargo de la Empresa como Responsable | `legal/anexo-nube-v1.0.html` §4 |
| **A-7** | Los marcadores del Anexo de Nube: **catorce (14) diligenciables** (4 del RNBD y 10 de la ficha del canal), más una mención literal del marcador en el texto del §5 | Anexo de Nube §4 y §5 |
| **B-1 a B-5** | La fila D3 del checklist, las huellas y tamaños del cuadro, el conteo de marcadores (catorce, no quince), la descripción del pendiente en el §2.7 del cuadro y la tabla de adjuntos de la nota | Adjunto 09, 11 y nota |
| **C-1 a C-4** | Los cuatro textos de retención que describían un comportamiento que el código ya no tiene: la nota de la compuerta, el respaldo congelado del código, el helper de los tests y la frase que viaja al adjunto 05 | `config/tabla-conservacion.json`, `src/services/retencion.js`, `tests/helpers.js`, `scripts/correspondencia-texto-codigo.js` |

**Y cuatro textos más de la misma clase, que no estaban en la lista del abogado:** el §8 del
Anexo de Encargo (estático y generado) decía que el plazo supletorio «siempre existe» y que
«ninguna categoría documental queda sin plazo», y el cuadro decía en dos lugares que con la
compuerta cerrada el catálogo legado de veinte (20) años desde la firma es el que aplica. Con
la compuerta cerrada, el código **no calcula fecha de supresión** y deja el registro retenido
con el *hold* `tabla_supletoria_pendiente_validacion`. Los cuatro quedaron corregidos.

**Las huellas cambiaron y por eso el paquete se reconstruyó:** el Anexo de Encargo pasó a
`7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` (86 407 B) y el Anexo de Nube a `c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125` (59 840 B). El Acuerdo
(`7298a943…`) conserva su huella; A4 se reclasificó y su huella se recalculó. La comparación sigue siendo automática:
`armar-paquete-abogado.js` sale con código 3 si el manifiesto y el paquete no coinciden.

## 2. Trazabilidad, punto por punto

Su revisión tiene 39 puntos: A1 a A7, J1 a J14, C-1 a C-3, D1 a D6 y T1 a T9. Todos están contestados abajo. La columna «Qué se hizo» dice **PENDIENTE** cuando el punto no se cierra en esta ronda, y en ese caso dice por qué y quién lo tiene.

| Item | Qué pidió | Qué se hizo | Dónde está la evidencia |
|---|---|---|---|
| A1 | Nueva versión del Acuerdo con huella recalculada (C-1, C-2, C-3) | Se armó la **v1.4** desde la v1.0 sellada, con la diferencia entre versiones escrita. La v1.3 (`49eab0c5…f4de12`) queda como histórico, sin publicar | `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.4.txt` · huella `7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` |
| A2 | 4 pasajes que contradicen J6, 4 celdas de base jurídica, la referencia al calendario de Google | Aplicadas las 4 correcciones de J6/D1, las 4 bases de J4, y retirado el calendario de Google. **Segunda ronda:** los dos pasajes del §5 que seguían diciendo «requiere validación profesional escrita», el estado de habilitación de 10.3(d), (f) y (g) alineado con J4, y el §6 con el canal de comunicación de la fecha de terminación | `sgsst-electron-app/legal/anexo-encargo.html` · huella `7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` |
| A3 | §6, §4 y §11, §10, §8 | §6 con el literal de D2; §4 con la ficha de Google conforme a J6; §11 con la Circular 001 de 2026; §10 sin marcadores de pendientes; §8 con la auditoría corregida. **Segunda ronda:** el §1, los dos pasajes del §4 y la conclusión del §5 sobre la Circular 002, que seguían dejando la calificación de Google (y el alcance de la Circular) como pendientes de validación profesional. **Ya no queda ninguno** | `sgsst-electron-app/legal/anexo-nube-v1.0.html` · huella `c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125` |
| A4 | «Capítulos I a XIII» y antecedente de la v1.1 sin respaldo | Corregido a «Capítulos I a XII». El antecedente de la v1.1 queda condicional. El 3-nov-2026 A4 se reclasificó como registro interno de versión y autorización operativa; no atribuye aprobación jurídica | `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html` · huella `3fd45c658e5160e2c63005d348ec1fd200abb5f26593c6adf6aabd0ccd6a736c` |
| A5 | Acuse de recibo de la especificación del 30-oct | Aplicada como instrucción vigente, salvo lo sustituido por D1 y por lo que usted resolvió | Adjunto 08; su contenido se aplicó en A1, A2 y A3 |
| A6 | Acuse de recibo de la auditoría T1/T2 | Sus dos hallazgos siguen atendidos. **PENDIENTE:** la reejecución fechada de T1 depende del servidor. Ver T1 | Adjunto 06; T1 en el §6 |
| A7 | No aplica (antecedente del 27-oct superado) | No se cita como base de aprobación ni como evidencia vigente. Sigue en el paquete como adjunto 07, marcado como antecedente superado | Adjunto 07; nota al abogado, lista de adjuntos |
| J1 | Corregir el Acuerdo v1.3 completo | Corregido en los tres puntos que usted nombró (C-1, C-2, C-3). El contenido sustantivo que usted aprobó no se tocó | A1 v1.4, §3.6(h), §9.2, §9.6, §10.8(d)(iv) |
| J2 | Aprobado; condición: el «canal de incidentes publicado en la pantalla de firma» del 5.1(e) debe existir y estar publicado antes de usar el mecanismo | El texto del 5.1(e) se mantiene. **PENDIENTE:** que el canal esté publicado y versionado es una verificación del servidor, no del texto. Su misma condición lo pide así | A1 v1.4, §5.1(e) |
| J3 | Aprobado con condición: medio y fecha de puesta a disposición de las políticas de seguridad | Corregido el 5.6: el medio concreto por el que las políticas se ponen a disposición, y la fecha de esa puesta | A1 v1.4, §5.6 |
| J4 | Declarar las bases jurídicas de 10.3(a), (b), (c) y (e) con su estado de habilitación | Aplicado. La matriz de finalidades (8 finalidades) declara el estado de cada una; 10.3(a), (b), (c) y (e) quedan «Habilitada» condicionadas a la suscripción de los anexos y a la inscripción de la tabla de conservación; 10.3(d), (f) y (g) quedan «Propuesta; no habilitada para producción»; 10.3(h) «No habilitada - pendiente de entrega de información por la Empresa» | `sgsst-electron-app/firma-service/config/matriz-finalidades.json` · huella `f09f80c98b4127cfe8beb0db485aebdede4fb953a0d96527f1168b3ed2711552` |
| J5 | Eliminar de A2 §5 la mención al calendario de Google | Retirada. En A2 §5 solo queda «treinta (30) días calendario» como plazo de devolución, que no es el calendario de Google | A2, §5: el término «calendario de Google» ya no aparece en el documento |
| J6 | Determinación escrita del papel de Google | Aplicada con su literal en A1 §10.1, A1 §10.5(f), A2 §4, A2 §5, A2 §8 y A3 §4. **PENDIENTE:** en el Anexo de Nube queda una frase del §5 que remite a revisión jurídica profesional, pero en el punto sobre la Circular Externa 002 de 2025, no sobre la clasificación de Google. Ver la nota al pie de esta tabla | A1 v1.4 §10.1 y §10.5(f); A2 §4, §5, §8; A3 §4 |
| J7 | Circular 002 de 2025 y RNBD | El texto ya no afirma comunicación previa a la Delegatura por esa vía. **PENDIENTE:** si K+AIR se presenta como proveedor de una tecnología que permite el tratamiento de datos personales, debe documentar el cumplimiento de la Circular 002 de 2025; y el estado de inscripción de Gesstiar en el RNBD lo verifica el owner | A3, §4 y §11; A2 §5 |
| J8 | Conservación supletoria de 10 y 5 años, con cinco condiciones | La tabla supletoria y el 8.6 del Acuerdo reflejan la precedencia del 8.6(a) y las cinco categorías del literal (b). **PENDIENTE:** el catálogo legado de 20 años desde la firma no está alineado, y la compuerta sigue cerrada porque depende de su validación | `sgsst-electron-app/firma-service/config/tabla-conservacion.json` → `aplicacion.activada: false`; A1 v1.4 §8.6; A2 §8 |
| J9 | SG-SST y fecha de cese; añadir a A2 §4 el deber de la Empresa de comunicar la fecha de terminación | Aplicado en A2 §6 (obligaciones del Responsable). Además, la retención dejó de inventar fechas: si no se conoce la fecha real de cese, el registro queda `fecha_cese_pendiente`, y si la tabla supletoria aún no está validada queda `tabla_supletoria_pendiente_validacion`, sin fecha de supresión calculada | A2 §6; `sgsst-electron-app/firma-service/src/services/retencion.js` |
| J10 | OTP, correo y elección en papel | El texto está. **PENDIENTE:** su condición es de producción: el interruptor aparece apagado y el inventario de buzones se corrió sobre población vacía. Falta el caso real rechazado con su asiento y el interruptor en su estado efectivo | T4, T6 en el §6; `sgsst-electron-app/firma-service/src/services/publicFlow.js:1540` (asiento `OTP_MEDIO_CORPORATIVO`) |
| J11 | Datos sensibles de salud; **corregir A1 §10.8(d)(iv)**: deber propio del Encargado frente a la SIC | Corregido el 10.8(d)(iv) con el deber propio del Encargado y el art. 18, literal k), de la Ley 1581. Además se redactó el procedimiento escrito con responsable, criterio de calificación y plantilla de comunicación a la Empresa sin adjunto ni enlace | A1 v1.4 §10.8(d)(iv); `sgsst-electron-app/docs/gestion-humana/firma-electronica/procedimiento-incidentes-datos-salud-2026-10-30.md` (adjunto 12) |
| J12 | Anexos contractuales y orden de prevalencia | Aplicado: §10 sin marcadores de pendientes, §1 con prevalencia también en conservación, devolución, supresión y auditoría, §9 con el procedimiento de modificación, §8 con la auditoría corregida, A2 §1 con la prohibición de operar con campos pendientes, A2 §7 sin cambio | A3 §1, §8, §9, §10; A2 §1 |
| J13 | Constancia de versión y publicación; secuencia de decisiones | A4 se reclasificó como registro interno del owner; no representa aprobación jurídica. Los campos de versión y autorización operativa siguen vacíos | A4 §§1-6; checklist §E |
| J14-1 | Mover a A2 §4 el deber de no designar subencargados sin contrato o DPA | Aplicado. En §4 (Encargado): «No designar subencargados sin informar previamente a la Empresa y sin que estén vinculados por contrato o DPA que les imponga obligaciones equivalentes». En §6 (Empresa): «Informarse y oponerse a la designación de subencargados, y no usar un proveedor de correo propio sin autorización escrita» | A2 §4 y §6 |
| J14-2 | A1 §8.7: la supresión alcanza la infraestructura del Encargado y los respaldos; Cloudflare no almacena copia | Corregido con su literal: «El túnel de Cloudflare, Inc. transporta y transita sin almacenar copia de los registros del proceso de firma» | A1 v1.4 §8.7 |
| J14-3 | A1 §10.8(d)(iv): deber de reportar incidentes del Encargado (J11) | Corregido, junto con el procedimiento escrito | A1 v1.4 §10.8(d)(iv); adjunto 12 |
| J14-4 | A3 §3: el RTO de 4 horas no es exigible sin alerta externa | Corregido: el §3 define el RTO como objetivo de recuperación dependiente de la detección y del inicio de la respuesta | A3 §3 |
| J14-5 | Trazabilidad del manifiesto: `v1_1_archivo` y `v1_1_hash` tenían el valor de otra versión | Corregido. El manifiesto declara la v1.4 con las cuatro huellas y con las claves inequívocas `archivo`, `hash` y `fecha`; las claves `v1_1_archivo`, `v1_1_hash` y `v1_1_fecha` ya no están. Se añadieron los bloques `constancia` y `matriz_finalidades`. Además existe una prueba de siete (7) casos que ata el manifiesto a los archivos reales: si el manifiesto y el archivo dejan de coincidir, la prueba falla | `sgsst-electron-app/firma-service/legal-readiness.json`; `sgsst-electron-app/firma-service/tests/readiness-manifiesto-v1.4.test.js` |
| C-1 | **Texto a sustituir en A1 3.6(h):** «…la del Anexo de Nube, tomada de su versión firmada por esa Empresa. Si la Empresa no ha suscrito el Anexo de Nube, el servicio no permite crear solicitudes de firma y, en consecuencia, no puede emitirse Constancia.» **Y en A2 9:** sustituir «o, si todavía no hay copia firmada, la del modelo vigente» por «o, si no hay copia firmada, la Constancia no puede emitirse» | **Las dos partes, separadas.** (1) **La Constancia no vincula un modelo sin firmar, y esto es incondicional y ya está hecho:** si la Empresa no suscrito el Anexo de Nube, lo que se archiva es `NULL`, no cae al modelo; el campo `version_incorporada` queda en `NULL` y no se escribe el modelo vigente. El texto de A1 3.6(h) y de A2 9 dice exactamente eso. (2) **El servicio no permite crear solicitudes de firma sin el Anexo de Nube suscrito, y esto va detrás de la compuerta `FIRMA_EXIGIR_ANEXO_NUBE`, que está apagada.** Ver el §5 para por qué y para la secuencia de encendido. El texto y el código coinciden a partir del paso (4) de esa secuencia | A1 v1.4 §3.6(h); A2 §9; `sgsst-electron-app/firma-service/src/services/manifiestoLegal.js:236-247` (parte 1); `sgsst-electron-app/firma-service/src/services/empresa.js:1149` y `sgsst-electron-app/firma-service/src/config.js:184` (parte 2) |
| C-2 | **A1 §9.2:** «El sistema registra además, en el mismo acto de aceptación, la versión y la huella SHA-256 del Anexo de Encargo y del Anexo de Nube que rigen esa firma para esa Empresa, y pone a disposición del Firmante, antes de habilitar la casilla, la matriz de finalidades que determinan el alcance de su autorización, con su versión y su huella.» **Y en §9.6,** idéntica referencia a las huellas de los anexos | **Aplicado, en el texto y en el código.** El 9.2, el 9.6, el 3.6(b) y el ordinal 3 de la Manifestación de Voluntad incorporan la matriz de finalidades con su versión y su huella, y registran el medio y la fecha. En el código, la aceptación registra la versión y la huella del Anexo de Encargo y del Anexo de Nube, la de la matriz, el medio y la fecha; hay un servicio nuevo para la matriz; hay una migración nueva; y la pantalla de firma pinta la matriz con su versión y su huella ANTES de la casilla, que no se habilita si la matriz no se leyó | A1 v1.4 §3.6(b), §9.2, §9.6, ordinal 3 del Cap. IX; `sgsst-electron-app/firma-service/src/services/publicFlow.js:690-746`; `sgsst-electron-app/firma-service/src/services/matrizFinalidades.js`; `sgsst-electron-app/firma-service/src/db/schema/051_alcance_aceptacion.sql`; `sgsst-electron-app/firma-service/web/firma/app.js` |
| C-3 | **Texto a añadir al final de A1 §10.8(d)(iv):** «K+AIR, en su calidad de Encargado, cumple por sí mismo el deber de que trata el artículo 18, literal k), de la Ley 1581 de 2012: informa a la Delegatura para la Protección de Datos Personales de la Superintendencia de Industria y Comercio cuando el hecho configure una violación de los códigos de seguridad del servicio y exista riesgo en la administración de la información de los Titulares, dentro de los plazos y por los canales que fija la normativa. Este deber es propio del Encargado y no se desplaza a la Empresa.» | **Aplicado.** Ese deber propio del Encargado quedó escrito en el 10.8(d)(iv), y el procedimiento que lo cumple quedó redactado en el adjunto 12 | A1 v1.4 §10.8(d)(iv); adjunto 12 |
| D1 | Sustituir por el texto de determinación de J6 en A2 §4, §5, §8; y A1 §10.5(f) y A3 §4 deben pasar de «pendiente de validación profesional» a la determinación | **Aplicado.** A1 §10.1 y §10.5(f) llevan el literal de la determinación; A2 §4, §5 y §8 lo llevan en las tres secciones; y A3 §4 ya dice «Responsable del Tratamiento en esta operación» y cierra el párrafo diciendo que «lo que queda pendiente son los pasos documentales enumerados en el bloque de pendientes de este Anexo, no la caracterización de la operación». **PENDIENTE:** la frase residual del §5 del Anexo de Nube, sobre la Circular 002, no sobre la clasificación de Google | A1 v1.4 §10.1, §10.5(f); A2 §4, §5, §8; A3 §4 |
| D2 | Sustituir el §6 del Anexo de Nube por el literal que usted escribió (piso de 20 años desde el cese para las cinco categorías del 8.6(b); los demás por la tabla de la Empresa o la supletoria; la fecha de firma no sustituye la de cese) | **Aplicado con su literal.** El §6 del Anexo de Nube reproduce ese texto | A3 §6 |
| D3 | No identificar los documentos finales con huellas anteriores; la decisión del owner debe señalar una sola versión y huella por documento | **Aplicado.** Las huellas nuevas están en la nota, el checklist y el manifiesto. Las huellas anteriores se conservan solo como antecedentes claramente identificados. Se reconstruyó el `SHA256SUMS.txt` con el paquete actualizado | Manifiesto `legal-readiness.json`; nota; checklist |
| D4 | Publicar un único cuadro con los 96 estados, suma que cuadre, y la evidencia por punto | **Aplicado.** El cuadro único es el del adjunto 09: 63 cerrados, 33 pendientes, 0 no aplica, 96 total. Su tabla de conteo la genera el programa, no se escribe a mano | Adjunto 09; `sgsst-electron-app/firma-service/scripts/contar-estados-checklist.js` |
| D5 | La correspondencia es evidencia estática; su encabezado declara huellas que quedan desactualizadas: debe regenerarse | **Aplicado.** Se generó la correspondencia de la v1.4, con 26 filas, 26 implementadas y 0 pendientes, y su encabezado declara las huellas nuevas de A1 y A2. La fila nueva es la del canal de la fecha de terminación. **PENDIENTE:** su valor probatorio es el que usted fijó: comprueba la presencia o ausencia de un ancla, no prueba el comportamiento funcional | Adjunto 05; `sgsst-electron-app/docs/gestion-humana/firma-electronica/correspondencia-texto-codigo-v1.4.md` |
| D6 | Regenerar el paquete completo con las versiones corregidas y un `SHA256SUMS.txt` nuevo | **Corregido en esta ronda:** el paquete y su `SHA256SUMS.txt` se reconstruyen después de los cambios documentales. El paquete se arma con `sgsst-electron-app/firma-service/scripts/armar-paquete-abogado.js`, que falla si el manifiesto y el paquete no coinciden | `sgsst-electron-app/firma-service/scripts/armar-paquete-abogado.js` |
| T1 | Reejecutar las pruebas de conservación tras el cambio, con resultados fechados y comparados con la línea base | **Ejecución histórica:** dos corridas locales del 30-oct-2026 reportaron 2 062 pruebas del servicio (2 059 verdes, 1 roja —ADVE6.7— y 2 omitidas) y 146 de la aplicación (140 verdes, 6 rojas preexistentes). **Corrida ejecutada el 3-nov-2026 en el árbol de trabajo:** 2 090 del servicio (2 088 verdes, 0 rojas, 2 omitidas; 151,5 s). No se ejecutó desde un clon limpio ni se vinculó a T3 porque aún no existe commit candidato. Reconciliación reportada: 2 062 de base +16 del canal de fecha de terminación = 2 078; +12 del control de huellas = 2 090 (+28 total). El test `ADVE6.7` se corrigió en el test y no era un defecto de código; el código de producción no se modificó por ese ajuste. **Pendiente:** commit T3 y reejecución desde clon limpio | `sgsst-electron-app/firma-service/src/services/retencion.js`; `src/services/fechaTerminacion.js`; control `tests/paquete-huellas-internas.test.js` |
| T2 | Correspondencia regenerada para el candidato y revisada **junto con** las pruebas funcionales, no en lugar de ellas | **La correspondencia está regenerada** (adjunto 05, 26/26). **PENDIENTE:** la revisión junto con las pruebas funcionales depende de T1 | Adjunto 05 |
| T3 | Fijar el candidato de código: código, configuración, documentos y migraciones (047, 048, 049, más 045/046) | **PENDIENTE: lo tiene el owner.** En esta ronda no se hizo ninguna confirmación de cambios en el repositorio, por instrucción expresa del owner | Repositorio, historial de cambios |
| T4 | Verificación por disco en `/opt/kair-firma/app/`: versión, configuración legal, migraciones aplicadas, permisos, secretos, respaldos y auditoría | **Ejecutada el 31-oct-2026, solo lectura.** Detectó producción en v1.0, nueve migraciones atrás, permisos 777, base de prueba dentro del despliegue y disco sin cifrar; corregir permisos y retirar base sigue pendiente | Servidor de producción |
| T5 | Los 8 apartados de la ficha del Anexo de Nube §5: servidor/puerto, STARTTLS negociado, cuenta de aplicación y rotación, MFA, plantilla vigente, contenido mínimo, bitácora con un envío real, gestión de incidentes y revocación | **Diligenciada el 31-oct-2026:** los 14 marcadores quedaron completados con los datos y evidencias descritos en el §1.9 del adjunto 09. Siguen pendientes decisiones operativas del owner, documentos RNBD y cifrado de disco, que está sin implementar | `sgsst-electron-app/firma-service/src/services/mailer.js:36` (`requireTLS: true`); `sgsst-electron-app/firma-service/src/config.js:75` (`SMTP_SECURE` en `false` por defecto); A3 §5 |
| T6 | E2E controlado con el caso «buzón corporativo rechazado» y el caso «medio personal confirmado», limpieza del rastro y acta | **PENDIENTE: depende del servidor.** El asiento `OTP_MEDIO_CORPORATIVO` ya se escribe en el registro de operaciones, y el interruptor `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` está en el repositorio, pero falta la corrida con población real | `sgsst-electron-app/firma-service/src/services/publicFlow.js:1540`; `sgsst-electron-app/firma-service/src/config.js:158` |
| T7 | Procedimiento de reversión probado, con qué se restaura y acta de reversión | **PENDIENTE: depende del servidor.** Los programas de reversión existen en el repositorio; la prueba y el acta no | `sgsst-electron-app/firma-service/scripts/limpiar-rastro-prueba.js`; programas de despliegue |
| T8 | Decisión operativa del representante legal, identificando versión/huella y verificaciones; registro de publicación separado | **Pendiente.** El owner documenta J1-J14 en la sección E; A4 se firma solo al autorizar publicación tras las verificaciones. No se requiere una firma del abogado para esta constancia | A4 §§1-6; checklist §E |
| T9 | Al cierre deben seguir en false: `acuerdo.publicado`, `anexo_encargo.estado: no_firmado`, `anexo_nube.firmado: false`, `tabla-conservacion.json → aplicacion.activada: false`, y `subencargados.google.dpa: false` | **Aplicado y verificado en esta ronda.** Los cinco valores están comprobados sobre el manifiesto y sobre la configuración de conservación | `sgsst-electron-app/firma-service/legal-readiness.json`; `sgsst-electron-app/firma-service/config/tabla-conservacion.json` |

### Nota al pie de la tabla: A3, J6 y D1

En el Anexo de Nube se aplicó su determinación en la ficha de la tabla de proveedores (§4), que dice «Responsable del Tratamiento en esta operación, por los motivos y con los efectos determinados en el §5 del Anexo de Encargo», y el párrafo que cierra esa sección dice que «Google LLC actúa como Responsable del Tratamiento y el flujo constituye una transferencia internacional a Estados Unidos».

**La frase que quedaba pendiente en el §5 también está corregida.** El documento decía: «Conclusión jurídica: Pendiente de revisión jurídica profesional», en el punto sobre la Circular Externa 002 de 2025. Esa frase no se refería a la clasificación de Google, sino al alcance de la Circular frente al simple uso de un canal de correo, que **su J7 ya resolvió**: la Circular no aplica a este canal, porque su ámbito son los procesos de transferencia de tecnología y el uso de una cuenta de correo para enviar un OTP no es eso. El §5 lo dice ahora, y el único pendiente que enuncia es el documento que reúna las caracterizaciones que la Circular exige si K+AIR llegara a presentarse como proveedor de una tecnología que permite el tratamiento de datos.

Sobre la contradicción interna que usted describió —«un documento contractual no puede afirmar a la vez que la calificación está pendiente y que ya está decidida»—: **está resuelta en los seis pasajes**, no en dos. El §3 y el §4 del Anexo de Nube ya estaban corregidos; en esta ronda se corrigieron los otros cinco que seguían diciendo «pendiente» al lado de la determinación: **A2 §5 (dos), A3 §1 (uno) y A3 §4 (dos)**, más el lead-in de la tabla del §4 y la nota del inventario del servicio (`subencargados.google.nota` del manifiesto), que seguían diciendo que no había calificación cerrada. A1 y A2 llevan la determinación en las cinco secciones que usted indicó.
### Segunda ronda: seis puertas que la revisión de cierre detectó

Una segunda revisión del paquete, recibida el 31-oct-2026, detectó seis puertas. Cinco quedaron
cerradas en el texto y en el código; la que depende de un acto del owner queda explícita y
con nombre. Se listan porque **el expediente se entrega contra huellas
nuevas** y usted no debe aprobar contra ninguna anterior:

| Puerta | Qué era | Qué se hizo |
|---|---|---|
| **Huella de A3 rota** | El cuadro y el checklist pedían aprobar el Anexo de Nube con `263d81da…cc4d512` (46 816 B), mientras el manifiesto, el `SHA256SUMS.txt` y la nota al abogado declaraban `75deec1c…c286` (47 308 B): las dos quedan como **histórico**. El propio documento 09 llevaba las dos cifras | Se recalcularon las huellas **sobre los bytes que se entregan** y se alinearon cuadro, checklist, informe, nota, manifiesto y `SHA256SUMS.txt`. **Una sola huella por documento**, y la comprobación es automática: `armar-paquete-abogado.js` sale con código 3 si el manifiesto y el paquete no coinciden, y una prueba ata el manifiesto a los archivos reales |
| **D1: cinco pasajes que seguían diciendo «pendiente»** | A2 §5 (dos), A3 §1 (uno) y A3 §4 (dos) afirmaban que el papel de Google «requería validación profesional escrita», al lado de la determinación de J6 ya escrita | Se reescribieron los cinco: la determinación queda como lo decidido y la lista de pendientes queda con los pasos externos reales. Se corrigieron además el lead-in de la tabla del §4 del Anexo de Nube, la conclusión del §5 sobre la Circular 002 y la nota `subencargados.google.nota` del manifiesto, que seguían diciendo que no había calificación cerrada |
| **Matriz de finalidades** | 10.3(d), (f) y (g) seguían como «Propuesta; no habilitada» aunque J4 las declaró correctas, mientras el cuadro las contaba como habilitadas de forma condicional | Se alinearon **en la fuente** (`config/matriz-finalidades.json`) con la misma condición que (a), (b), (c) y (e), y el Anexo se regeneró con `generar-anexo-encargo.js`, que es idempotente. 10.3(h) **no se toca**: J4 la deja no habilitada |
| **Fecha de cese** | El deber del Anexo de Encargo §6 no tenía ningún mecanismo después de crear la solicitud: una fila con `motivo_hold: fecha_cese_pendiente` no tenía salida y quedaba retenida indefinidamente, en contradicción con el 8.6(e) y el 8.6(h) del Acuerdo | **Se implementó el canal, en el código y no solo en el texto.** La Empresa comunica la fecha por `POST /internal/admin/empresas/:id_empresa/fecha-terminacion` (`src/routes/admin-empresas.js`); el registro con su evidencia va a `gh_firma_fecha_terminacion` (migración 052); la bitácora de la operación es de solo anexado (`gh_firma_fecha_terminacion_eventos`, migración 053, con disparadores `BEFORE UPDATE` y `BEFORE DELETE`); y el recálculo queda **acotado a las filas del trabajador comunicado** (`opciones.firmas` en `conservacion.js`). Sin evidencia no hay registro, y el *hold* sin término del contrato no se levanta por este camino. La revisión periódica que pide el §6 es un endpoint: `GET .../fecha-terminacion/pendientes`. Prueba: `tests/fecha-terminacion-canal.test.js`, 16 en verde. **El §6 del Anexo se reescribió** para que el texto describa ese mecanismo |
| **Anexo de Nube firmable** | Los catorce (14) marcadores diligenciables quedaron **diligenciados el 31-oct-2026**, más una mención literal del marcador en el texto del §5 | **No se rellenaron con promesas, sino con evidencia verificada**: 4 datos del RNBD dados por el owner y comprobados contra la norma, y 10 de la ficha técnica del canal comprobados en el servidor de producción. El inventario exacto, con dónde se comprueba cada uno, está en el §1.9 del adjunto 09. Lo que sigue abierto ya no es un dato del Anexo: cuatro decisiones del owner, el cifrado en reposo del disco (verificado como no implementado) y la validación del abogado. La compuerta C-1 está apagada hoy; el bloqueo se aplicará cuando se active |
| **T3 a T9** | Sin commit candidato, sin E2E posterior al despliegue, sin reversión probada, sin acta y con decisiones del owner aún por registrar. **La verificación de servidor (T4) sí se ejecutó el 31-oct-2026**, en modo de solo lectura | El código está listo; falta ejecutarlos. El T3 se puede fijar en cuanto el owner autorice la confirmación de cambios. La T4 encontró que producción corre el Acuerdo v1.0 y no el v1.4, que el despliegue está nueve migraciones atrás, que no hay git en el servidor (por eso el T3 no se puede atar a un commit), que los permisos del código desplegado son 777 y que el cifrado en reposo del disco no está implementado |

---

## 3. Los cuatro documentos

| Documento | Versión | Huella SHA-256 | Bytes | Qué cambió y por qué item |
|---|---|---|---:|---|
| Acuerdo de uso | **v1.4** | `7298a9435b94c6c6f4f4365c3818fa7e8825524c2ebd524d380c10c2c585490f` | 73 208 | **C-1** (§3.6(h)): la Constancia no puede vincular un modelo sin firmar. **C-2** (§3.6(b), §9.2, §9.6 y ordinal 3 del Cap. IX): la matriz de finalidades se pone a disposición antes de habilitar la casilla, y la aceptación registra la versión y la huella de los dos anexos, el medio y la fecha. **C-3** (§10.8(d)(iv)): deber propio del Encargado frente a la SIC, art. 18(k) Ley 1581. **J3** (§5.6): medio y fecha de puesta a disposición de las políticas. **J6/D1** (§10.1 y §10.5(f)): la determinación del papel de Google por operación, con su literal. **J14-2** (§8.7): el túnel de Cloudflare transporta y transita sin almacenar copia |
| Anexo de Encargo | — | `7d626ba9cdd50d99283f6fdc294cca2b08755babb502453a25ea1aad9d9c5fd9` | 86 407 | **J4**: bases jurídicas literales de 10.3(a), (b), (c) y (e), con su estado de habilitación, tomadas de la matriz de finalidades. **J12** (§1): prohibición de operar con campos pendientes. **J14-1** (§4 y §6): el deber de no designar subencargados sin informar y sin contrato o DPA queda en las obligaciones del Encargado; en las del responsable quedan informarse y oponerse, y no usar un proveedor de correo propio sin autorización escrita. **J9** (§6): la Empresa comunica la fecha de terminación. **J5** (§5): fuera el calendario de Google. **C-1** (§9): sin copia firmada del Anexo de Nube la Constancia no puede emitirse. **J6/D1** (§4, §5 y §8): la determinación con su literal, y se retiraron las frases que quedaban falsas al lado de esa determinación. **Segunda ronda:** §5, los dos pasajes que aún pedían validación profesional, y el estado de habilitación de 10.3(d), (f) y (g) alineado con J4 (la matriz se editó en su fuente y el documento se regeneró). **§6**: el deber de comunicar la fecha de terminación, con el canal que el Encargado habilita en el servicio |
| Anexo de Nube | v1.0 | `c9e29220e805720fde4860ec8655ae3bd59afe444a5ecd7ec8473dabe6f6e125` | 59 840 | **D2** (§6): el texto literal del piso de 20 años desde el cese, con las cinco categorías del 8.6(b). **J6/D1** (§3 y §4): el papel de Google por operación pasa a la determinación, sin dejar frases que la contradigan. **J14-4** (§3): el RTO como objetivo de recuperación dependiente de la detección y del inicio de la respuesta. **J12** (§10): se firma sin marcadores de pendientes. **J12** (§1): la prevalencia del Anexo de Nube sobre el Anexo de Encargo también en conservación, devolución, supresión y auditoría. **J12** (§9): toda modificación se publica como versión nueva con su propia huella, se suscribe de nuevo por ambas partes y no altera las ya suscritas. **J12** (§8): la promesa de auditoría corregida. El papel de Google se documenta como proveedor de un Gmail de consumo, sin afirmar DPA empresarial. **Segunda ronda:** §1, los dos pasajes del §4 y la conclusión del §5 sobre la Circular 002, que seguían dejando la calificación pendiente de validación profesional |
| Constancia de versión y autorización de publicación | — | `3fd45c658e5160e2c63005d348ec1fd200abb5f26593c6adf6aabd0ccd6a736c` | 9 639 | **J13**: identifica la versión y reserva la autorización operativa al representante legal; no declara aprobación jurídica. Los campos de registro y autorización siguen vacíos |

Los tres documentos de `sgsst-electron-app/legal/` son byte a byte idénticos a sus copias de `sitio/`, verificado.

---

## 4. El código

| Archivo y línea | Qué se hizo | Por qué item |
|---|---|---|
| `sgsst-electron-app/firma-service/src/services/publicFlow.js:690-746` | La aceptación registra la versión y la huella del Anexo de Encargo y del Anexo de Nube, la versión y la huella de la matriz, el medio y la fecha | **C-2** |
| `sgsst-electron-app/firma-service/src/services/matrizFinalidades.js` | Servicio nuevo que entrega la matriz de finalidades con su versión y su huella | **C-2** |
| `sgsst-electron-app/firma-service/src/db/schema/051_alcance_aceptacion.sql` | Migración nueva que guarda el alcance de la aceptación | **C-2** |
| `sgsst-electron-app/firma-service/web/firma/app.js` | La pantalla de firma pinta la matriz con su versión y su huella **antes** de la casilla, y la casilla no se habilita si la matriz no se leyó | **C-2**, y el «antes de habilitar la casilla» de su texto |
| `sgsst-electron-app/firma-service/src/services/manifiestoLegal.js:236-247` | Si la Empresa no suscrito el Anexo de Nube, lo que se archiva es `NULL`: `version_incorporada` y `hash_incorporada` quedan en `NULL` y no se escribe el modelo vigente | **C-1**, parte 1 |
| `sgsst-electron-app/firma-service/src/services/empresa.js:1149` | Bloquea la creación de solicitudes de firma si la Empresa no tiene el Anexo de Nube suscrito con su versión y su huella. La regla está construida y probada; su encendido depende de la compuerta | **C-1**, parte 2 |
| `sgsst-electron-app/firma-service/src/routes/admin-empresas.js:247` | Ruta `POST /internal/admin/empresas/:id_empresa/anexo-nube-firmado`: registra el Anexo de Nube firmado por la Empresa, con auditoría y motivo | **C-1** |
| `sgsst-electron-app/firma-service/src/schemas/admin-empresas.js` | Validación del cuerpo de esa ruta | **C-1** |
| `sgsst-electron-app/firma-service/src/db/schema/050_anexo_nube_por_empresa.sql` | Migración que guarda la suscripción del Anexo de Nube por Empresa | **C-1** |
| `sgsst-electron-app/firma-service/src/services/retencion.js` | La retención ya no inventa fechas: si no se conoce la fecha real de cese el registro queda `fecha_cese_pendiente`, y si la tabla supletoria aún no está validada queda `tabla_supletoria_pendiente_validacion`, sin fecha de supresión calculada | **J9**, **D2** |
| `sgsst-electron-app/firma-service/src/services/mailer.js:36` | `requireTLS: true`: el canal del código de verificación no puede degradar a texto claro | **T5**, y la condición (ii) del punto «Canal de correo» |
| `sgsst-electron-app/firma-service/src/config.js:184` | La variable nueva `exigirAnexoNube`, leída de `FIRMA_EXIGIR_ANEXO_NUBE`; queda en `false` mientras la variable de entorno no se fije en `true` | **C-1**, parte 2 |
| `sgsst-electron-app/firma-service/src/services/readinessLegal.js:1511` | El reporte de estado legal lee la misma variable: con la compuerta encendida avisa si alguna Empresa todavía no tiene el Anexo de Nube suscrito | **C-1**, parte 2 |
| `sgsst-electron-app/firma-service/legal-readiness.json` | Declara la v1.4 con las cuatro huellas y con las claves `archivo`, `hash` y `fecha`; se añadieron los bloques `constancia` y `matriz_finalidades`; se retiraron las claves `v1_1_archivo`, `v1_1_hash` y `v1_1_fecha` | **J14-5** |
| `sgsst-electron-app/firma-service/tests/readiness-manifiesto-v1.4.test.js` | Siete (7) pruebas que atan el manifiesto a los archivos reales: si el manifiesto y el archivo dejan de coincidir, la prueba falla | **J14-5** |
| `sgsst-electron-app/firma-service/src/services/fechaTerminacion.js` | Servicio nuevo del canal de la fecha de terminación: registra la comunicación con su evidencia, escribe la fecha en las filas del trabajador, recalcula el plazo **acotado** a esas filas y deja la bitácora de la operación. Mientras la fecha no llega, la fila sigue retenida y sin fecha de supresión | **J9**, y el §6 del Anexo de Encargo |
| `sgsst-electron-app/firma-service/src/db/schema/052_fecha_terminacion_canal.sql` | Migración nueva: `gh_firma_fecha_terminacion` (el registro con su evidencia y su canal) y `gh_firma_fecha_terminacion_eventos` (la bitácora) | **J9** |
| `sgsst-electron-app/firma-service/src/db/schema/053_fecha_terminacion_append_only.sql` | La bitácora del canal es de solo anexado: los disparadores abortan cualquier `UPDATE` o `DELETE`. Lleva `@skip-when-env test`, y su inmutabilidad se prueba contra una base en memoria | **J9** |
| `sgsst-electron-app/firma-service/src/services/conservacion.js` | `opciones.firmas`: el recálculo puede acotarse a las filas nombradas. Es lo que permite que la comunicación de un trabajador no mueva los plazos de los demás | **J9** |
| `sgsst-electron-app/firma-service/src/schemas/admin-empresas.js` | Validación del cuerpo de la ruta: la evidencia y el canal son obligatorios | **J9** |
| `sgsst-electron-app/firma-service/tests/fecha-terminacion-canal.test.js` | Dieciséis (16) pruebas: la fila retenida sin fecha, la comunicación con su evidencia, el recálculo acotado, la fecha que no se reescribe, la bitácora de solo anexado, el documento crudo que no queda en la base y el contrato HTTP de la ruta | **J9** |

---

## 5. Lo que NO se hizo, y por qué

**No se publicó nada.** `legal-readiness.json` deja `acuerdo.publicado: false`. La v1.4 está escrita y tiene huella, pero no está en producción.

**No se firmó nada.** El manifiesto deja `anexo_encargo.estado: no_firmado`, `anexo_nube.firmado: false` y `anexo_nube.hash: null`. Ningún documento del paquete lleva firma.

**No se hizo ninguna confirmación de cambios en el repositorio.** Por instrucción expresa del owner en esta ronda. Esto tiene una consecuencia que conviene que esté clara: **T3 no puede fijarse todavía**, porque su propio texto dice que el candidato «debe contener los textos corregidos, que aún no existen».

**No se abrió ninguna compuerta.** Las dos quedan en `false`: `FIRMA_EXIGIR_ANEXO_NUBE` (compuerta del Anexo de Nube) y `tabla-conservacion.json → aplicacion.activada: false` (compuerta de los plazos de 10 y 5 años).

**La v1.3 no se aprueba.** Queda como histórico, sin publicar. No se pide su aprobación sobre `49eab0c5…f4de12` ni sobre ninguna huella anterior, como exige su D3.

### Por qué la compuerta del Anexo de Nube está apagada

El C-1 tiene dos partes y se trataron distinto, a propósito.

La primera parte ya está hecha y es incondicional: la Constancia no puede vincular un modelo sin firmar. Si la Empresa no suscrito el Anexo de Nube, lo que se archiva es `NULL`.

La segunda parte es el bloqueo del servicio, y va detrás de la compuerta. La razón es una sola: **el Anexo de Nube v1.0 es hoy un modelo sin publicar**. Exigir su firma sería exigir un documento que el sistema todavía no publica, y dejaría a todas las Empresas —incluida la que hoy firma— sin poder firmar.

Esto no es suavizar su regla. Es el mismo mecanismo y el mismo orden que usted fijó para la compuerta de conservación, con la condición que escribió en J8: «El texto no se publica mientras el comportamiento no coincida con él. Orden correcto: (i) validar los plazos; (ii) alinear el catálogo legado al orden de precedencia del 8.6(a) —20 años desde el cese para las cinco categorías del 8.6(b), hold sin término para el contrato, y el plazo de la Empresa o el supletorio para el resto—; (iii) reejecutar pruebas; (iv) recién entonces abrir la compuerta, con validación escrita». La compuerta se abre **antes** de publicar, no después. La secuencia que deja el texto y el código coincidiendo es:

1. El abogado aprueba A1 (v1.4), A2 y A3 con sus huellas nuevas.
2. El owner publica el Anexo de Nube v1.0, para que las Empresas puedan suscribirlo.
3. Cada Empresa suscribe el Anexo de Encargo y el Anexo de Nube; el código ya registra esa suscripción con auditoría.
4. Se enciende `FIRMA_EXIGIR_ANEXO_NUBE=true`, con validación escrita. **A partir de aquí el texto y el código coinciden.**
5. Recién entonces se publica el Acuerdo v1.4 y se activan las firmas.

---

## 6. Decisiones que le corresponden

| # | Decisión | Por qué no la tomamos nosotros |
|---|---|---|
| 1 | **Aprobar o no la v1.4 del Acuerdo, el Anexo de Encargo, el Anexo de Nube y la Constancia**, identificando versión y huella nuevas | Su D3 lo exige: no se aprueba contra ninguna huella anterior. Las huellas a aprobar son las del §3 |
| 2 | **El papel de Google por operación, por escrito** (sección 2.7 del cuadro de 96 del adjunto 09; en su revisión, J6) | La determinación se incorporó a los textos con su literal, pero la validación por escrito es suya |
| 3 | **La Circular Externa 002 de 2025 de la SIC** (sección 2.8 del cuadro de 96; en su revisión, J7) | Si K+AIR se presenta como proveedor de una tecnología que permite el tratamiento de datos personales, debe documentar el cumplimiento de esa Circular |
| 4 | **El RNBD** (sección 2.9 del cuadro de 96; en su revisión, J7) | El estado de inscripción de Gesstiar lo verifica el owner; y la Empresa declara la transferencia si está inscrita |
| 5 | **Validar los plazos de diez (10) y cinco (5) años** (sección 3.2 del cuadro de 96; en su revisión, J8) | Hasta entonces la compuerta de conservación sigue cerrada. Su texto valida esos plazos como topes de custodia, con cinco condiciones |
| 6 | **La fecha de vigencia del Acuerdo** | La fija el owner, no el texto. Los cuatro documentos la dejan para su firma |
| 7 | **La evidencia de la cuenta de correo**: MFA, contraseña de aplicación, host y TLS reales | Son los 8 apartados de la ficha del Anexo de Nube §5, y no hay acceso al servidor desde esta ronda |
| 8 | **El ámbito de la condición de J9 (A2 §6) y de J4**, si quiere precisar más el literal | El deber de comunicar la fecha de cese y las bases jurídicas quedaron escritos como usted los indicó; si quiere acotar más el alcance, es una decisión suya |

---

## 7. La secuencia de cierre (J13 / T8) y el estado de cada paso

Secuencia operativa vigente, con el estado de hoy. La sección E registra decisiones del owner y A4 no representa una aprobación jurídica:

| Paso | Qué exige | Estado |
|---|---|---|
| (1) | Textos corregidos | **Hecho.** A1 v1.4, A2, A3 y A4 corregidos, con huella nueva |
| (2) | Huellas recalculadas | **Hecho.** Las cuatro huellas del §3, más la de la matriz de finalidades, en el manifiesto |
| (3) | Decisiones del owner sobre J1-J14, con fundamento/evidencia o estado pendiente | **PENDIENTE.** Se registran en la sección E del checklist |
| (4) | A4 firmada por el representante legal solo si autoriza la publicación, con versión/huella y resultados verificados | **PENDIENTE.** No es una firma de aprobación jurídica |
| (5) | Verificaciones T1-T7 registradas | **PENDIENTE.** Dependen del servidor. T2 está: la correspondencia regenerada |
| (6) | Autorización operativa del owner en A4 §§5-6 | **PENDIENTE.** Requiere verificar las condiciones técnicas y operativas antes de firmar |
| (7) | Publicación / activación registrada | **PENDIENTE.** Depende de (5) y (6) |
| (8) | Acta de cierre | **PENDIENTE.** Requiere el cuadro reconciliado (hecho), el paquete regenerado con `SHA256SUMS.txt` nuevo (D3, D6) y la reejecución de T1-T7 |

---

## 8. Qué se puede verificar desde el repositorio

- El cuadro de los 96 sale del programa `contar-estados-checklist.js`, no de una tabla escrita a mano.
- El manifiesto y los archivos reales no pueden separarse: la prueba de siete (7) casos falla si alguien cambia un documento sin actualizar el manifiesto.
- El paquete se arma con un programa que sale con código 3 si el manifiesto y el paquete no coinciden.
- La nota al abogado declara, para cada documento, sus bytes y su huella, y hay un programa que comprueba que la nota no miente: si el número o la huella del documento no coinciden con el archivo real, falla.

**Todo lo que este informe afirma como aplicado, se comprobó sobre los archivos. Todo lo que no se pudo comprobar, está marcado PENDIENTE y con su responsable.**
