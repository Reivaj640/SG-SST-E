# CONSULTA JURÍDICA — Tratamiento de datos de salud (CIE-10) en K+AIR

**Dirigida a:** abogado de datos personales y derecho laboral / SG-SST
**De:** Javier Robles Fontalvo — consultor SG-SST, desarrollador de K+AIR
**Fecha de la consulta:** 16 de octubre de 2026
**Fecha de verificación normativa:** 16 de octubre de 2026
**Asunto:** si la aplicación K+AIR, al transcribir el certificado de incapacidad y acumular códigos CIE-10 por trabajador, constituye o no un depósito de historia clínica ocupacional en poder del empleador, y cuál es el plazo legal de conservación de esos registros.

**Nota metodológica para el abogado:** todo lo afirmado en el bloque 3 fue verificado contra fuente oficial, con enlace y fecha. Cuando no fue posible abrir la fuente, aparece marcado como `No verificado`. El bloque 4 son recomendaciones técnicas, no conclusiones jurídicas.

---

## 1. Los hechos

### 1.1 Qué es K+AIR

1. K+AIR es una aplicación de escritorio (Electron, Windows) que un consultor de SG-SST instala en los equipos de sus clientes en Colombia.
2. No es software médico. No es prestador de servicios de salud. No presta servicios de medicina laboral ni realiza evaluaciones médicas ocupacionales.
3. **Responsable del tratamiento:** la empresa cliente que usa K+AIR. **Encargados:** el consultor y el operador SST que administran la aplicación.
4. **Persistencia:** base de datos SQLite local en el equipo del usuario (`app.getPath('userData')/kair.db`), documentada en `sgsst-electron-app/main/seguimiento-incapacidad-bridge.js:8`.
5. El módulo de seguimiento de incapacidad no transmite datos a ningún servidor. No afirmo que *toda* la aplicación esté deshabilitada de red: K+AIR tiene otros módulos (firma electrónica, correo) que sí contactan servicios externos. La afirmación "sin conexión" debe verificarse módulo por módulo.

### 1.2 Qué guarda la base de datos

Una tabla: `seguimiento_incapacidad_caso`. Cada fila es **un episodio de incapacidad** de un trabajador, con clave única `(empresa_id, cedula, fecha_inicio, fecha_fin)` (`seguimiento-incapacidad-bridge.js:172`). Por tanto, un trabajador con tres incapacidades en el año genera tres filas, y los campos clínicos se acumulan por trabajador de forma indirecta (varias filas consultadas por cédula).

Campos clínicos:

| Campo | Línea | Contenido |
|---|---|---|
| `codigo_cie10` | 78 | Código CIE-10 |
| `descripcion_diagnostico` | 79 | Descripción en texto libre |
| `cie10_dx2`, `origen_dx2` | 82-83 | Segundo diagnóstico y su origen |
| `cie10_dx3`, `origen_dx3` | 84-85 | Tercer diagnóstico y su origen |
| `cie10_calificada_dx1..4` | 136, 138, 140, 142 | Hasta 4 diagnósticos CIE-10 **calificados** (PCL) |
| `origen_dx_calificada1..4` | 137, 139, 141, 143 | Origen de cada uno |
| `fecha_calificacion_pcl`, `porcentaje_pcl_calificacion` | 133-134 | Fecha y porcentaje de pérdida de capacidad laboral |

La base de datos no aplica cifrado al contenido, y el archivo SQLite no exige autenticación para ser abierto.

### 1.3 Uso funcional de esos campos

- **Visualización en pantalla:** la tabla de casos muestra `descripcion_diagnostico` de cada episodio (`medicion-ausentismo.js:4287`).
- **Edición manual:** el usuario puede escribir o corregir el diagnóstico a mano en el formulario del caso (`medicion-ausentismo.js:4693`).
- **Exportación a Excel:** `main.js:12217-12218` escribe el CIE-10 en la columna `cie-10 de la incapacidad temporal dx 1` y el texto en la columna `diagnostico`. El generador de informes PRI reconoce esas columnas (`informe-pri-builder.html:1227-1229`, y `1296-1299` para los diagnósticos calificados).

### 1.4 De dónde proviene el diagnóstico

1. El diagnóstico **no lo genera ni lo dictamina K+AIR**. Se transcribe desde el **certificado de incapacidad**, documento que expide el médico u odontólogo tratante (Decreto 1427 de 2022, art. 2.2.3.3.2 y art. 2.2.3.1.4) y que, por norma, ya contiene el código CIE del diagnóstico principal y del relacionado.
2. K+AIR **no recibe ni almacena historia clínica ocupacional**: no recibe anamnesis, examen físico, pruebas, evoluciones ni anotaciones de atención. Solo recibe el resultado del certificado, que ya fue entregado al empleador por un canal legal.
3. La aplicación no guarda certificado médico ocupacional de aptitud ni concepto de restricciones. En esta versión del módulo, los campos de examen médico (`fecha_examen_medico`, `resultado_examen_medico`, líneas 95-96) existen en el esquema pero no están poblados por el flujo descrito.

---

## 2. La pregunta jurídica concreta

Cada pregunta lleva su premisa factual. Las marcadas `[N]` son las más importantes.

### Pregunta 1 — Depósito de historia clínica ocupacional `[N]`

**Premisa:** el empleador registra en su propia base de datos, por cada episodio de incapacidad y por cada trabajador, el código CIE-10 del diagnóstico principal y del relacionado (hasta 3 por episodio), más hasta 4 diagnósticos CIE-10 "calificados" con su origen, consolidados a lo largo de la vida laboral del trabajador. Esos datos **no** provienen de una evaluación médica ocupacional ni de la historia clínica ocupacional: provienen del certificado de incapacidad expedido por el médico tratante de la EPS, documento que el empleador tiene obligación legal de recibir y de radicar ante la EPS para el reconocimiento de la prestación económica.

**Pregunta:** ¿esa acumulación constituye, a la luz del artículo 30 literal b) de la Resolución 1843 de 2025 y del artículo 2.2.4.6.13 del Decreto 1072 de 2015, un depósito de historia clínica ocupacional en poder del empleador, dado que (i) el certificado de incapacidad es un documento distinto de la historia clínica ocupacional, (ii) su diagnóstico ya viene impreso y entregado por un tercero, y (iii) el contenido transcrito es un subconjunto acotado de campos del certificado, sin anamnesis ni procedimiento clínico?

**Sub-preguntas:**

- **1.a** Si la respuesta es negativa, ¿bajo qué premisa exacta? ¿Porque el certificado no es historia clínica ocupacional, o porque el contenido es insuficiente, o porque el fundamento de licitud no es la reserva sino otra cosa?
- **1.b** Si la respuesta es afirmable en algún supuesto (por ejemplo, si el Consultor transcribe diagnósticos que no aparecen en el certificado, o si añade notas clínicas propias), ¿dónde está la frontera?

### Pregunta 2 — Finalidad del indicador legal `[N]`

**Premisa:** el indicador "ausentismo por causa médica" de la Resolución 0312 de 2019 se calcula como `(número de días de ausencia por incapacidad laboral o común en el mes / número de días de trabajo programados en el mes) x 100`. La fórmula no menciona diagnóstico ni CIE-10.

**Pregunta:** ¿el código CIE-10 es **necesario** para calcular ese indicador, o su captura y conservación excede la finalidad que la norma exige? En concreto: ¿conservar el diagnóstico individualizado del trabajador es "necesario" para un indicador que solo consume días de ausencia y días programados?

**2.a** Si excede la finalidad, ¿qué efecto tiene eso en el marco del principio de finalidad y del deber de pertinencia, y aplica también a la información que el Consultor ya tiene almacenada de clientes anteriores?

### Pregunta 3 — La excepción del artículo 30 literal b) `[N]`

**Premisa (hecho normativo relevante):** la Resolución 2346 de 2007, derogada, decía en el parágrafo de su artículo 16: *"En ningún caso, el empleador podrá tener acceso a la historia clínica ocupacional."* Esa frase **no aparece** en el artículo 31 de la Resolución 1843 de 2025, que la deroga. El artículo 31 de la 1843 se limita a enumerar cuatro causales de comunicación. El artículo 30 literal b) abre una excepción: el empleador puede tener, conservar y anexar copia de historia clínica ocupacional *"salvo que cuenten con autorización expresa de este y tengan vinculado un médico especialista en seguridad y salud en el trabajo o el servicio de medicina laboral habilitado"*.

**Pregunta:** ¿la derogación de la prohibición absoluta del parágrafo del artículo 16 de la 2346 de 2007, y su sustitución por el régimen de excepción del artículo 30 literal b) de la 1843 de 2025, significa que hoy el empleador **sí puede** tener y conservar historia clínica ocupacional si cumple las dos condiciones (autorización expresa del trabajador más médico especialista vinculado)? ¿O debe leerse como una casilla no derogada de la prohibición?

**3.a** Si la excepción aplica, ¿qué obligaciones genera? Enumeradas, por favor:

- ¿Debe el empleador comunicarle al trabajador que va a conservar ese material?
- ¿La autorización del trabajador debe ser **específica** para historia clínica ocupacional, o basta la autorización general de tratamiento de datos personales? Aquí hay diferencia entre la autorización "expresa" del artículo 30 literal b) y la "autorización explícita" del artículo 6 literal a) de la Ley 1581 de 2012.
- ¿Puede esa autorización ser revocada? ¿Qué pasa con lo ya recolectado?
- ¿Qué obligaciones de seguridad y de registro de base de datos en el Registro Nacional de Bases de Datos de la SIC se activan?
- ¿La autorización del trabajador para tratar historia clínica ocupacional es compatible con la obligación del SG-SST de conservar documentos para el cumplimiento legal? ¿Conviven ambas, o se excluyen?

### Pregunta 4 — Base de licitud del tratamiento `[N]`

**Premisa:** el artículo 6 de la Ley 1581 de 2012 prohíbe tratar datos sensibles (los relativos a la salud están expresamente incluidos en el artículo 5) salvo autorización explícita del titular —"salvo en los casos que por ley no sea requerido el otorgamiento"—, interés vital, fundaciones sin ánimo de lucro o uso por razones de seguridad social. El artículo 10 lista cinco casos en que no se requiere autorización, y ninguno de los cinco contempla al empleador ni al SG-SST.

**4.a** ¿Cuál es la base de licitud para que el empleador trate el CIE-10 que el trabajador le entrega con el certificado de incapacidad: la **autorización del titular**, la **obligación legal del empleador** frente al trámite de la incapacidad y al SG-SST, o ambas como fundamentos alternativos? ¿Cómo se documenta una u otra?

**4.b** Si la base es la obligación legal, ¿dónde está esa obligación? La Resolución 1843 de 2025 obliga al empleador a tramitar, recibir y archivar el certificado, pero ¿obligaría también a conservar el **diagnóstico** y no solo las fechas y los días? ¿Qué pasa si la obligación legal solo cubre fechas y días, y el diagnóstico los excede?

**4.c** ¿Basta con el certificado como fuente de autorización? Es decir, ¿el hecho de que el trabajador entregue el certificado con su diagnóstico y origen al empleador (y además esté obligado a hacerlo para el trámite ante la EPS) equivale a una autorización expresa e informada en los términos del artículo 6 literal a) de la Ley 1581, o se requiere un documento de autorización específico para el tratamiento en base de datos?

### Pregunta 5 — Plazo de conservación `[N]`

**Premisa:** el artículo 2.2.4.6.13 del Decreto 1072 de 2015 obliga a conservar veinte años **cinco supuestos tasados** (perfiles epidemiológicos y conceptos de exámenes; resultados de exámenes cuando hay médico especialista; mediciones y monitoreo de ambientes; registros de capacitación; registro de suministro de elementos de protección personal). Para todo lo demás, la norma dice que el empleador debe elaborar y cumplir un sistema de archivo o retención documental. Los registros de incapacidad **no están** en la lista.

**5.a** ¿Qué plazo aplica a los registros de incapacidad del empleador, que no están en la lista cerrada del artículo 2.2.4.6.13?

**5.b (amplitud textual):** el artículo 30 literal f) de la Resolución 1843 de 2025 dice: *"Los documentos y registros deben ser conservados por un periodo mínimo de veinte (20) años, en el marco del Sistema de Gestión de Seguridad y Salud en el Trabajo."* Ese artículo inicia estableciendo que *"Las Instituciones prestadoras de servicios de medicina en Seguridad y Salud en el Trabajo serán responsables de la custodia, archivo y conservación de las historias clínicas ocupacionales..."*. Mi lectura es que los 20 años recaen sobre el prestador (IPS o médico), no sobre el empleador. **¿Es correcto, o el texto es lo bastante ambiguo como para que el plazo de 20 años también alcance al empleador?**

**5.c** ¿Ese dato sensible, que el trabajador puede conocer y pedir que se rectifique o se suprima (artículos 14 a 17 de la Ley 1581), debe tener una fecha de vencimiento más corta que la de un registro laboral ordinario, precisamente por ser un dato sensible?

### Pregunta 6 — Rol del software y del consultor `[N]`

**Premisa:** la aplicación es un software de escritorio, instalado en el equipo del cliente, que el Consultor administra. El Consultor es un tercero independiente, **no** es médico especialista ni prestador de medicina laboral, y no tiene vínculo laboral con ningún trabajador.

**Pregunta:** ¿qué obligaciones adquiere específicamente el **Consultor**, en calidad de encargado del tratamiento, respecto de estos datos sensibles? Concretamente:

- ¿Debe firmar o formalizar un contrato de encargo con el cliente que precise las finalidades (artículo 5 literal f) de la Ley 1581)?
- ¿Debe declarar que K+AIR no aplica controles de cifrado y que el acceso a la base de datos no tiene control de autenticación real?
- ¿Es un problema que el Consultor acceda a los diagnósticos desde un equipo que puede no ser el del cliente?

### Pregunta 7 — La frontera entre certificado de incapacidad e historia clínica ocupacional

**Premisa:** no encontré ninguna norma que diga de forma expresa que "el certificado de incapacidad no es historia clínica ocupacional". Lo que sí existe:

- El certificado lo expide el médico tratante de la EPS (Decreto 1427 de 2022).
- La Corte Constitucional ha dicho que el certificado de incapacidad "surge de un acto médico (...) independiente del trámite administrativo del reconocimiento de la prestación económica" (T-401 de 2017).
- La definición de historia clínica ocupacional de la Resolución 1843 de 2025 alude a "las evaluaciones médicas ocupacionales, resultados de las valoraciones complementarias y demás procedimientos ejecutados por el equipo de salud".

**Pregunta:** ¿es correcto que un certificado de incapacidad **no** es historia clínica ocupacional y, por tanto, que el régimen del artículo 30 literal b) de la 1843 ni siquiera se activa? ¿O hay jurisprudencia reciente (posterior a 2024) que haya tratado específicamente este punto?

### Pregunta 8 — Normativa que no encontré

**8.a** ¿Existe algún pronunciamiento de la **SIC** o del **MinSalud** sobre qué datos de salud puede almacenar un empleador en un sistema de información de SST? Busqué y no encontré uno específico, y quiero saber si es que existe y no lo encontré, o si efectivamente no existe.

**8.b** ¿Existe jurisprudencia (Corte Constitucional, Consejo de Estado o Corte Suprema, Sala Laboral) que haya sancionado a un empleador por conservar diagnósticos de trabajadores en su sistema de gestión interna?

**8.c** ¿Existe algún pronunciamiento de la SIC en el sentido de que la regla de "no recolectar datos distintos a los estrictamente necesarios" aplica a la base de datos de un SG-SST? ¿Ese principio ha sido aplicado a empleadores?

---

## 3. Fundamento normativo verificado

Todas las citas fueron leídas directamente en la fuente indicada. Fecha de consulta de todas: **16 de octubre de 2026**.

### 3.1 Resolución 1843 de 2025 — Ministerio del Trabajo

Expedida el **29 de abril de 2025** ("Dada en Bogotá, D.C., a 29 de abril de 2025"), publicada en el **Diario Oficial 53.109 del 6 de mayo de 2025**. Rige desde el 6 de mayo de 2025 (artículo 36: "rige a partir de la fecha de la publicación").

Fuentes oficiales:

- [Compilación Jurídica — Cancillería de Colombia](https://www.cancilleria.gov.co/normograma/compilacion/docs/resolucion_mtra_1843_2025.htm)
- [SISJUR — Alcaldía de Bogotá](https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?dt=S&i=178947)

**Artículo 2, literal h) — definición de historia clínica ocupacional:**

> "Historia clínica ocupacional: Conjunto único de documentos privados, obligatorios y sometidos a reserva, en donde se registran cronológicamente las condiciones de salud del trabajador, las evaluaciones médicas ocupacionales, resultados de las valoraciones complementarias y demás procedimientos ejecutados por el equipo de salud que interviene en su atención."

**Artículo 30 — Custodia y entrega de la historia clínica ocupacional:**

> "Las Instituciones prestadoras de servicios de medicina en Seguridad y Salud en el trabajo serán responsables de la custodia, archivo y conservación de las historias clínicas ocupacionales y de las evaluaciones médicas realizadas a los trabajadores, atendiendo lo establecido en la legislación vigente en la materia."

**Literal b) — el supuesto del caso:**

> "En ningún caso, los empleadores podrán tener, conservar o anexar copia de la historia clínica ocupacional a la hoja de vida del trabajador salvo que cuenten con autorización expresa de este y tengan vinculado un médico especialista en seguridad y salud en el trabajo o el servicio de medicina laboral habilitado."

*Verificado en SISJUR (Alcaldía de Bogotá) leyendo el artículo 30 completo. En la compilación de Cancillería leí el artículo 30 y siguientes; por una limitación técnica de la lectura (la página se truncó) la literal b) la cito desde SISJUR. Ambas versiones son consistentes entre sí.*

**Literales e) y f) — conservación:**

> "e) El responsable de la custodia debe dejar constancia del traslado de la copia de la historia clínica ocupacional entre entidades, mediante acta o registros de entrega y devolución, las cuales deberán ir firmadas por los funcionarios responsables de su custodia.
> f) Los documentos y registros deben ser conservados por un periodo mínimo de veinte (20) años, en el marco del Sistema de Gestión de Seguridad y Salud en el Trabajo."

**Artículo 31 — Reserva de la historia clínica ocupacional** (verificado íntegro en la compilación de Cancillería):

> "La historia clínica ocupacional y en general, los documentos, exámenes o valoraciones clínicas o paraclínicas que allí reposen son estrictamente confidenciales y hacen parte de la reserva profesional; por lo tanto, no podrán comunicarse o darse a conocer, salvo los siguientes casos:
> a) Por orden de autoridad judicial.
> b) Mediante autorización escrita del trabajador interesado, cuando éste la requiera con fines estrictamente médicos.
> c) Por solicitud del médico o prestador de servicios en salud ocupacional, durante la realización de cualquier tipo de evaluación médica, previo consentimiento del trabajador, para seguimiento y análisis de la historia clínica ocupacional.
> d) Por la entidad o persona competente para determinar el origen o calificar la pérdida de capacidad laboral, previo consentimiento del trabajador."

**Dato crítico para el abogado:** el artículo 31 **no tiene parágrafo**. La prohibición absoluta que sí existía antes ("En ningún caso, el empleador podrá tener acceso a la historia clínica ocupacional", parágrafo del artículo 16 de la Resolución 2346 de 2007) **desapareció** con la derogación de esa resolución (artículo 36 de la 1843).

**Artículo 36 — Derogatorias:**

> "deroga la Resolución número 2346 de 2007, la Resolución número 1918 de 2009, Resolución número 1075 de 1992, la Resolución número 4050 de 1994"

**Artículo 19 (contenido del concepto médico ocupacional).** `No verificado` en texto literal: no se abrió la fuente oficial. Según fuentes secundarias y el contexto de los artículos 29 y 30, el instrumento que sí puede llegar al empleador es el concepto médico ocupacional, con restricciones y recomendaciones, no el diagnóstico. **Punto a confirmar.**

### 3.2 Decreto 1072 de 2015 — artículo 2.2.4.6.13

Fuente oficial: [Gestor Normativo — Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=72173)

> "**ARTÍCULO 2.2.4.6.13. Conservación de los documentos.**
> El empleador debe conservar los registros y documentos que soportan el Sistema de Gestión de la Seguridad y Salud en el Trabajo SG-SST de manera controlada, garantizando que sean legibles, fácilmente identificables y accesibles, protegidos contra daño, deterioro o pérdida.
> El responsable del SG-SST tendrá acceso a todos los documentos y registros exceptuando el acceso a las historias clínicas ocupacionales de los trabajadores cuando no tenga perfil de médico especialista en seguridad y salud en el trabajo.
> La conservación puede hacerse de forma electrónica de conformidad con lo establecido en el presente capítulo siempre y cuando se garantice la preservación de la información.
> Los siguientes documentos y registros, deben ser conservados por un periodo mínimo de veinte (20) años, contados a partir del momento en que cese la relación laboral del trabajador con la empresa:
> 1. Los resultados de los perfiles epidemiológicos de salud de los trabajadores, así como los conceptos de los exámenes de ingreso, periódicos y de retiro de los trabajadores, en caso que no cuente con los servicios de médico especialista en áreas afines a la seguridad y salud en el trabajo;
> 2. [Cuando la empresa cuente con médico especialista: resultados de exámenes de ingreso, periódicos y de egreso, así como los resultados de los exámenes complementarios...];
> 3. Resultados de mediciones y monitoreo a los ambientes de trabajo...
> 4. Registros de las actividades de capacitación, formación y entrenamiento en seguridad y salud en el trabajo; y,
> 5. Registro del suministro de elementos y equipos de protección personal.
> Para los demás documentos y registros, el empleador deberá elaborar y cumplir con un sistema de archivo o retención documental, según aplique, acorde con la normatividad vigente y las políticas de la empresa."

**Confirmado:** la lista es cerrada y no incluye los registros de incapacidad.

### 3.3 Ley 1581 de 2012 — protección de datos personales

Fuentes oficiales:

- [Gestor Normativo — Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981)
- [Cancillería — Normograma](https://cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm)

**Artículo 5 — Datos sensibles:**

> "...así como los datos relativos a la salud, a la vida sexual y los datos biométricos."

**Artículo 6 — Tratamiento de datos sensibles:**

> "Se prohíbe el Tratamiento de datos sensibles, excepto cuando:
> a) El Titular haya dado su autorización explícita a dicho Tratamiento, salvo en los casos que por ley no sea requerido el otorgamiento de dicha autorización;
> b) El Tratamiento sea necesario para salvaguardar el interés vital del Titular y este se encuentre física o jurídicamente incapacitado...
> c) El Tratamiento sea efectuado en el curso de las actividades legítimas... por parte de una fundación, ONG, asociación o cualquier otro organismo sin ánimo de lucro..."

**Artículo 9 — Autorización del Titular:**

> "Sin perjuicio de las excepciones previstas en la ley, en el Tratamiento se requiere la autorización previa e informada del Titular, la cual deberá ser obtenida por cualquier medio que pueda ser objeto de consulta posterior."

**Artículo 10 — Casos en que no es necesaria la autorización:**

> "La autorización del Titular no será necesaria cuando se trate de:
> a) Información requerida por una entidad pública o administrativa en ejercicio de sus funciones legales o por orden judicial;
> b) Datos de naturaleza pública;
> c) Casos de urgencia médica o sanitaria;
> d) Tratamiento de información autorizado por la ley para fines históricos, estadísticos o científicos;
> e) Datos relacionados con el Registro Civil de las Personas.
> Quien acceda a los datos personales sin que medie autorización previa deberá en todo caso cumplir con las disposiciones contenidas en la presente ley."

**Confirmado:** ninguno de los cinco supuestos del artículo 10 contempla al empleador privado en ejercicio del SG-SST.

### 3.4 Resolución 0312 de 2019 — Estándares Mínimos

Expedida el **13 de febrero de 2019**, Diario Oficial No. 50.872 de 19 de febrero de 2019.

Fuentes oficiales:

- [Normograma — Superservicios (compilación del MinTrabajo)](https://normograma.superservicios.gov.co/normograma/compilacion/docs/resolucion_mtra_0312_2019.htm)
- [Normograma — ICBF](https://www.icbf.gov.co/cargues/avance/compilacion/docs/resolucion_mtra_0312_2019.htm)

**Artículo 30 — Indicadores mínimos.** Indicador "Ausentismo por causa médica":

| Nombre | Definición | Fórmula | Interpretación | Periodicidad |
|---|---|---|---|---|
| Ausentismo por causa médica | Ausentismo es la no asistencia al trabajo, con incapacidad médica. | (Número de días de ausencia por incapacidad laboral o común en el mes / Número de días de trabajo programados en el mes) x 100 | En el mes se perdió X% de días programados de trabajo por incapacidad médica. | Mensual |

**Confirmado:** la fórmula no contiene ni menciona diagnóstico, CIE-10 ni origen de la contingencia.

**Adicionalmente**, el Estándar de "Ausentismo por causa médica" (Capítulo II) establece como criterio: *"Medir el ausentismo por incapacidad de origen laboral y común, como mínimo una (1) vez al mes y realizar la clasificación del origen del peligro/riesgo que lo generó (físicos, ergonómicos, o biomecánicos, químicos, de seguridad, públicos, psicosociales, entre otros)."*

**Argumento en contra, incluido por honestidad:** aquí sí aparece la palabra "origen", pero se refiere al **origen del peligro o riesgo** —a qué factor de riesgo del trabajo se asocia el evento— y el propio Estándar remite a los tipos de peligro del SG-SST, no al diagnóstico. Aun así, este texto es el argumento más fuerte que existe a favor de que un origen por episodio sea relevante para el SG-SST, y conviene que el abogado lo evalúe.

### 3.5 Decreto 1427 de 2022 (incorporado al Decreto 780 de 2016) — contenido del certificado de incapacidad

Fuente oficial: [Gestor Normativo — Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=191146)

**Artículo 2.2.3.1.4 — Competencia:**

> "Son competentes, para expedir el certificado de incapacidad o licencia de maternidad los médicos u odontólogos tratantes inscritos en el ReTHUS..."

**Artículo 2.2.3.3.2 — Certificado de incapacidad.** El documento "debe contener como mínimo", entre otros:

> "Código de diagnóstico principal, utilizando la Clasificación Internacional de Enfermedades - CIE, vigente
> Código del diagnóstico relacionado, utilizando la Clasificación Internacional de Enfermedades - CIE vigente
> Presunto origen de la incapacidad (común o laboral)
> Causa que motiva la atención.
> Fecha de inicio y terminación de la incapacidad;..."

**Parágrafo 1:**

> "Se entiende por prórroga de la incapacidad, la que se expide con posterioridad a la inicial, por la misma enfermedad o lesión, o por otra que tenga relación directa con esta, así se trate de código diferente de diagnóstico (CIE), y siempre y cuando entre una y otra no haya una interrupción mayor a treinta (30) días calendario."

**Dato central y favorable:** por norma, el CIE-10 del diagnóstico principal y del relacionado forma parte del certificado de incapacidad. El CIE-10 no es un dato que el Consultor haya extraído de un lugar indebido: viene en un documento que el trabajador entrega al empleador porque la ley lo obliga a entregarlo.

### 3.6 Circular 170 de 2025 — SENA

Fuente: [Normograma SENA](https://normograma.sena.edu.co/compilacion/docs/circular_sena_0170_2025.htm)

Contiene un pronunciamiento institucional que consolida la posición restrictiva:

> "...aunque el responsable del SG-SST debe tener acceso a todos los registros y documentos del sistema, no podrá acceder a las historias clínicas ocupacionales, salvo que cumpla con el perfil profesional exigido por la normatividad vigente."

Y sobre conservación:

> "...el expediente de historia clínica ocupacional deberá conservarse por un periodo mínimo de veinte (20) años contados a partir de la fecha de la última atención registrada. Este periodo se distribuye de la siguiente manera: Mínimo cinco (5) años en el archivo de gestión. Mínimo quince (15) años en el archivo central."

**Alcance:** esta distribución aplica a la historia clínica ocupacional bajo custodia del prestador, no al archivo del empleador. Y la Circular es un Concepto del SENA, no un concepto de Función Pública ni del Ministerio del Trabajo: no es de cumplimiento obligatorio, pero sí es un antecedente institucional relevante.

### 3.7 Concepto 090651 de 2023 — Departamento Administrativo de la Función Pública

Fuente: [Gestor Normativo — Concepto 090651 de 2023](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=217831), expedido el **2 de marzo de 2023**.

Este concepto es de una entidad pública (funcionarios públicos), por lo que **no es vinculante para empresas privadas**. Pero transcribe textualmente la norma anterior (artículo 16 de la Resolución 2346 de 2007, vigente en ese momento) y su parágrafo:

> "**PARÁGRAFO. En ningún caso, el empleador podrá tener acceso a la historia clínica ocupacional.**"

Y concluye:

> "Además de lo anterior, se prevé que la historia clínica ocupacional y en general, los documentos, exámenes o valoraciones clínicas o paraclínicas, son estrictamente confidenciales y hacen parte de la reserva profesional."

**Valor para el abogado:** muestra que, hasta mayo de 2025, la posición oficial era de prohibición absoluta para el empleador. Ese fue el estado del derecho durante 18 años. El artículo 30 literal b) de la 1843 es un giro relevante que un abogado debe explicar.

**Salvedad:** al citar este concepto, nótese que la Resolución 2346 de 2007 **ya está derogada**. El parágrafo del artículo 16 hoy no existe. El Concepto cita la norma que ya no está vigente.

### 3.8 Doctrina oficial sobre plazos de conservación (Archivo General de la Nación)

`No verificado` en texto íntegro: no fue posible abrir el PDF completo, solo se leyó el fragmento indexado por el buscador.

Fuentes:

- [Archivo General de la Nación — Concepto técnico sobre tiempos de retención](https://www.archivogeneral.gov.co/filebrowser/download/314)
- [Concepto técnico "Historia ocupacional / Historia Laboral"](https://www.archivogeneral.gov.co/filebrowser/download/583)

El Concepto técnico del AGN afirma:

> "...no existiría norma específica para determinar por cuánto tiempo deben conservar los expedientes referentes al reconocimiento de prestaciones económicas por incapacidad o licencia, por lo que su entidad deberá emprender un proceso de valoración documental que involucre un equipo interdisciplinario."

Y sobre los plazos:

> "En la bibliografía y normatividad vigente sobre elaboración de TRD se señala enfáticamente que los citados tiempos de retención se asignan a series y subseries documentales, no a tipos documentales."

**Dos salvedades importantes:** (a) el texto íntegro no pudo verificarse; (b) el AGN es la autoridad archivística del Estado y sus conceptos se dirigen a entidades públicas. **No son vinculantes para el sector privado**, pero son la única guía técnica oficial sobre retención documental que existe, y la analogía es la más cercana para un archivo de gestión de SST.

Sobre el [Acuerdo 001 de 2024 del AGN](https://cancilleria.gov.co/normograma/compilacion/docs/acuerdo_archivo_0001_2024.htm), que recomienda 80 años de retención para historias laborales de funcionarios públicos: mismo caso, **no vinculante para empresas privadas**.

### 3.9 Jurisprudencia encontrada

**Corte Constitucional, Sentencia T-426 de 2017** — [Relatoría oficial](https://www.corteconstitucional.gov.co/relatoria/2017/t-426-17.htm). Síntesis textual de la Relatoría:

> "**HISTORIA CLÍNICA — No puede ser solicitada por el empleador para realizar trámite de reconocimiento de incapacidades.**"

Y:

> "De manera que aunque el empleador tenga la carga de realizar el trámite de reconocimiento de incapacidad, esto no lo faculta para solicitar la historia clínica del trabajador y mucho menos para contemplar una norma interna en ese sentido."

**Precisión:** esta sentencia analiza un caso de VIH/SIDA y se refiere a la historia clínica general. Su uso aquí es por analogía. El argumento es el inverso del que necesita el owner: la Corte protege al trabajador frente al empleador. Pero establece **una distinción útil**: la carga del empleador es la de *tramitar* la incapacidad, y esa carga **no lo faculta** a acceder a más información clínica que la necesaria. Ese es el eje del argumento del owner, y es jurisprudencia de la Corte Constitucional.

**Corte Constitucional, Sentencia T-153 de 2024** — [Relatoría oficial](https://www.corteconstitucional.gov.co/relatoria/2024/t-153-24.htm). Reitera la reserva de la historia clínica y cita un caso en que "el ISS entregó copia completa de las valoraciones psicológicas al empleador", y la Corte constató que se violó el derecho a la intimidad "porque reveló información de la historia clínica que no tenía nada que ver con la reubicación del trabajador". **Este es el precedente más cercano al riesgo real del owner**: entregar al empleador información clínica que excede lo necesario para la reubicación o la continuidad laboral.

**Corte Constitucional, Sentencia T-031 de 2021** — caso en que el médico tratante solo remitió "el certificado médico de salud ocupacional donde consta el concepto de aptitud, las conductas ocupacionales, recomendaciones y observaciones finales", **sin historia clínica**, y la Corte lo consideró conforme al deber de reserva. Es un ejemplo del camino correcto: el empleador recibe el instrumento de conclusiones, no el historial.

**Corte Constitucional, Sentencia T-401 de 2017** — cita textual:

> "el certificado de incapacidad temporal, el cual resulta de la existencia de un concepto médico que acredita la falta temporal de capacidad laboral del trabajador, es decir que surge de «un acto médico (...) independiente del trámite administrativo del reconocimiento de la prestación económica»".

**Salvedad:** esta cita se verificó en un [documento oficial del Senado de Colombia](http://www.secretariasenado.gov.co/senado/basedoc/c-270_2023_pr003.html) que transcribe jurisprudencia; **no se abrió directamente la sentencia en el portal de la Corte Constitucional**. Para un abogado que quiera citarla en un escrito, debe abrir la sentencia directamente. **Marcado como no verificado en fuente primaria.**

**Otras sentencias citadas dentro de la T-426:** T-161 de 1993, T-413 de 1993, T-1051 de 2008, T-182 de 2009 (todas sobre reserva de historia clínica). Se las mencionan para que el abogado sepa que la línea jurisprudencial es larga y consistente.

### 3.10 Lo que NO se encontró (y es un dato para el abogado)

1. **Ningún pronunciamiento de la SIC ni del MinSalud** que especifique qué datos de salud puede almacenar un empleador en un sistema de información de SST. **La ausencia de antecedente también es un dato.** En una materia tan nueva (la 1843 es de mayo de 2025) es razonable que aún no exista.
2. **Ningún pronunciamiento de la SIC** que aplique específicamente el principio de pertinencia o finalidad a bases de datos de empleadores en el marco del SG-SST. Lo más cercano que se encontró es una Circular de la SIC de 2020 sobre establecimientos de comercio durante el COVID, que aplicó el principio general: *"NO se puede recolectar cualquier dato, sino aquel o aquellos que sean pertinentes para la finalidad para la cual son requeridos"* ([SIC](https://sedeelectronica.sic.gov.co/noticias/establecimientos-de-comercio-no-podran-abusar-de-la-solicitud-de-datos-personales-superindustria)). Pero su alcance es COVID y establecimientos de comercio, no SG-SST.
3. **No existe norma que diga expresamente que "el certificado de incapacidad no es historia clínica ocupacional".** Esa distinción es una inferencia, apoyada en la definición del artículo 2 literal h) de la 1843 y en la descripción de la T-401 de 2017.
4. **No se encontró jurisprudencia que sancione a un empleador por conservar diagnósticos en su sistema de gestión interna.** Las sentencias encontradas involucran a la ARL o al operador de salud ocupacional, que es el escenario más cercano.

### 3.11 Normas que se mencionan y no son pertinentes (para evitar confusiones)

- **Resoluciones 3100 de 2019 y 2654 de 2019 (MinSalud):** regulan el Sistema Único de Habilitación, la historia clínica electrónica y la telemedicina **de prestadores de servicios de salud**. No aplican a K+AIR porque no es prestador. La Resolución 2654 de 2019 fue derogada por la Resolución 1644 de 2026. Ninguna de las dos impone requisitos a un software de gestión de SST.
- **Ley 23 de 1982, artículo 34:** define historia clínica. Aplica al sector salud.
- **Práctica de mercado** (Prontera, HoldingSoft, Saludtools): **no son fuente normativa**. Se mencionan solo como referencia de práctica de mercado. La descripción de Saludtools que afirma que "un software que mezcla estos accesos termina exponiendo al médico ocupacional a sanciones disciplinarias y al empleador a sanciones por tratamiento indebido de datos sensibles" es una **afirmación comercial de un tercero**, no una posición oficial de la SIC. No se cita como norma.

---

## 4. Recomendaciones técnicas que no dependen de la respuesta del abogado

Estas son **recomendaciones técnicas**, no conclusiones jurídicas. No dependen de lo que responda el abogado y reducen riesgo desde hoy. Están ordenadas por relación esfuerzo/beneficio.

### 4.1 Lo que puede hacer esta semana, sin costo y sin esperar

1. **Sacar el diagnóstico de las exportaciones por defecto.** La exportación a Excel (`main.js:12217-12218`) es el punto de mayor riesgo: produce un archivo que sale del perímetro de la aplicación, viaja por correo, WhatsApp o Drive, y queda en copias dispersas. Un archivo Excel con la lista de trabajadores y sus diagnósticos es material que el Consultor no puede controlar.
   **Propuesta concreta:** exportar por defecto sin columnas clínicas, con una casilla explícita "incluir datos clínicos" que venga desmarcada. El objetivo no es ocultar datos: es que cada export salga limpio y que quien lo active asuma conscientemente.
2. **Marcar los campos clínicos como de solo lectura y de origen "transcrito del certificado".** El campo `descripcion_diagnostico` se puede editar a mano hoy. Si el dato es transcrito, un campo editable es un problema por dos razones: introduce información que no viene del certificado (lo que rebota contra la pregunta 1.b) y permite que alguien escriba cualquier cosa en el expediente.
   **Propuesta concreta:** convertirlo en solo lectura, con un botón "corregir" que registre fecha, usuario y valor anterior. Esa bitácora resuelve las dos cosas: protege el dato y deja rastro documental.
3. **Agregar un sello visible en pantalla** que aclare la naturaleza del dato, sin cambiar nada más:
   > "Este dato fue transcrito del certificado de incapacidad expedido por la EPS o ARL. K+AIR no realiza valoraciones médicas ni almacena historia clínica ocupacional."

   Esto no es una salvaguarda jurídica por sí mismo —un sello en pantalla no es blindaje— pero documenta la decisión de la empresa y reduce el riesgo de que alguien asuma que la aplicación almacena historiales.
4. **Documentar la política de tratamiento de datos del SG-SST del cliente.** La Ley 1581 obliga al responsable a tener una política documentada, y la política debe incluir finalidades, derechos, mecanismos y **tiempo de conservación**. El cliente muchas veces no tiene este documento. Conviene armarlo. Sirve tanto si el abogado dice que sí como si dice que no.

### 4.2 Lo que puede hacer este mes

5. **Definir y documentar el acceso a los campos clínicos dentro del SG-SST.** Aun con la mejor posición jurídica, hay una asimetría en el flujo: el Consultor SST y el responsable del SG-SST ven diagnósticos que otros colaboradores no deberían ver.
   **Propuesta concreta:** separar la tabla de casos clínicos de la tabla de indicadores, de modo que el responsable del SG-SST vea días y conteos, y el diagnóstico quede en una sección con acceso restringido por rol.

### 4.3 Lo que debe saber antes de vender esto como mitigación

6. **El control de acceso dentro de la aplicación es disuasorio, no criptográfico. No se puede vender como blindaje.** Conviene decirlo explícitamente al cliente, por escrito:

   - La base de datos es un archivo SQLite local en el equipo del usuario. Quien tenga acceso al equipo y al archivo tiene acceso a los datos.
   - La aplicación no cifra el contenido de la base de datos.
   - Los controles de rol dentro de la interfaz evitan el acceso por accidente o por curiosidad en el uso diario. **No impiden el acceso deliberado por alguien con acceso al equipo.**
   - Abrir el archivo con una herramienta de línea de comandos revela los diagnósticos en segundos. Quien lo haga está realizando una extracción deliberada de datos de salud de terceros, y eso ya es otra historia.

7. **El riesgo real no está en la aplicación: está en los archivos exportados.** La mitigación que más rinde no es proteger la base de datos, es evitar que salgan copias con diagnósticos. Por eso el punto 1 va primero.

### 4.4 Lo que se haría si el abogado demorara

8. **Implementar los puntos 1 y 2 ya.** Son cambios pequeños, no rompen nada, y son defendibles bajo cualquier respuesta del abogado. Si el abogado dice "puede seguir guardando", las mejoras se quedan como buenas prácticas. Si dice "no", ya está mitigando.
9. **No borrar datos históricos hasta que el abogado responda.** Borrar antes de tiempo puede ser tan problemático como conservar de más, especialmente si esos datos sustentan un derecho pensional o una reclamación posterior. La prudencia es congelar, no eliminar.
10. **Preguntar al abogado un punto adicional:** ¿qué pasa con la **historia clínica ocupacional en manos del Consultor** si el Consultor actúa como encargado? ¿Hay responsabilidad subsidiaria si un Consultor que se retira conserva copias en su equipo? Esto no estaba en la consulta inicial y conviene agregarlo.

---

## Nota final para el abogado

Tres puntos que se dejan explícitos por si el destinatario no los ve de la misma forma:

**a)** La posición que se sostiene —y que debe corregir si es errada— es que K+AIR **no está depositando historia clínica ocupacional**: está transcribiendo un campo que la ley obliga a que exista en el certificado de incapacidad, y que el empleador está obligado a recibir. El argumento fuerte no es que "el diagnóstico no es dato sensible" (sí lo es, y no se discute), sino que **el empleador ya tiene ese dato en papel por una obligación legal, y el software solo lo digitaliza**.

**b)** El segundo argumento es la **pregunta 2**: la Resolución 0312 pide días, no diagnósticos. Si el diagnóstico no es necesario para el indicador legal, entonces la retención del diagnóstico es adicional y queda sometida a la lectura más estricta del principio de finalidad. Este es el eslabón más débil de la posición, y es el que más interesa que el abogado evalúe.

**c)** Lo que **no** se puede resolver por cuenta propia es si la derogación de la prohibición absoluta del parágrafo del artículo 16 de la 2346 de 2007 cambió de verdad la regla de fondo. Ese es el corazón de la pregunta 3, y no se quiere asumirlo en ninguna dirección.

---

## Anexo técnico — hallazgos de la aplicación

Se incluyen para que el abogado sepa con exactitud qué hace el software. **No son conclusiones jurídicas.**

- **Bug corregido el 16 de octubre de 2026:** el formulario de edición leía `caso.diagnostico` mientras la columna real se llama `descripcion_diagnostico` (`medicion-ausentismo.js:4479` y `:4693`). Abrir un caso para editar borraba el diagnóstico en silencio. **Ya está corregido.**
- **Bug abierto:** `main.js:12219` lee `caso.origen_dx1`, campo que no existe en el esquema (solo existen `origen_dx2` y `origen_dx3`). El efecto es que esa columna del Excel exportado siempre queda vacía. **No se ha tocado**, porque cambiar la forma del Excel requiere prueba: la columna la lee `informe-pri-builder.html:1227-1229`.
- **Sin cifrado:** la base de datos es SQLite local y no cifra su contenido.

---

*Documento preparado el 16 de octubre de 2026. Normativa verificada contra fuente oficial en esa fecha. Los puntos marcados `No verificado` requieren confirmación adicional. Esta consulta informativa no sustituye asesoría jurídica profesional: la respuesta definitiva y las decisiones que de ella se deriven son responsabilidad del abogado consultado y del owner.*