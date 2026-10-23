# Solicitud 11A — Acuerdo de uso K+AIR, versión 1.1, y Anexo de Encargo (Anexo de Nube)

**Para**: el abogado laboral colombiano que revisa el Acuerdo de uso y el Anexo de Encargo.
**De**: K+AIR (Gesstiar S.A.S.)
**Fecha**: 2026-10-23
**Objeto**: qué tiene que decidir, con qué insumo, y qué necesitamos de vuelta.

---

## 1. Qué se pide, en una página

K+AIR presta un servicio de **firma electrónica** (electrónica, no digital) para que el
Trabajador firme el contrato individual de trabajo. El **Acuerdo de uso** es el documento que
fija el método de esa firma: es lo que la Empresa y el Trabajador aceptan antes de firmar.

**La v1.0 del Acuerdo ya está publicada y sellada.** Vive en la base de datos, con su huella
SHA-256 (`52a490a4f4ce922109d42fa01ac45632cd62d5242bb82bf6e1967ede55710c04`) y está activa
desde el 21 de octubre. **No se toca.** La v1.1 que se está pidiendo sería un **archivo
nuevo, con su propia huella**, como manda el procedimiento de versionamiento.

**Pedimos tres cosas:**

1. **El texto final de los doce grupos de numerales** que están listados en la §6 de esta
   solicitud. Son veinte y tantos numerales. El insumo es el documento
   `propuestas-texto-11A-2026-10-20.md` (anexo A), que trae para cada uno el texto propuesto,
   la norma que lo respalda (con la cita oficial) y la razón por la que se propone cambiarlo.
2. **Cuatro decisiones concretas** (§4 de esta solicitud), con sus opciones y su consecuencia.
3. **La validación del Anexo de Nube** (§5): el anexo quefirma que el servicio funciona en la
   nube y que identifica a los terceros que intervienen.

**Lo que NO se espera:** un concepto. Los textos propuestos son **insumo de trabajo**, no una
propuesta cerrada. La redacción final es del abogado: si un texto no le sirve, se cambia, y el
cambio va con su fundamento.

**Lo que conviene que sepa antes de leer nada:**

- **El sistema ya hace lo que dicen los textos propuestos.** La auditoría de los capítulos II
  a XII (anexo B) comparó numeral por numeral el texto de la v1.0 contra el código, contra la
  norma oficial y contra la práctica del mercado. Los cambios propuestos no son meros "ajustes
  de estilo": son numerales que hoy **afirman algo que el código no hace** o que **contradicen
  la norma**. Si un numeral propuesto no calza con el código, el bloqueo es del código, no del
  texto.
- **El servicio ya está en producción, pero con cero firmas de trabajadores reales.** No hay
  ningún caso de un trabajador que haya firmado con la v1.0. Eso significa que **no hay una
  urgencia de "parar la máquina"**: hay una ventana para dejar el texto bien antes de la
  primera firma real.
- **El texto de la v1.0 sigue vigente y no se retira.** Los consentimientos ya aceptados no se
  tocan, y la v1.0 archivada es inmutable (tiene su manifiesto de huella, y hay un candado en
  el código que se niega a borrarla).

---

## 2. El estado del sistema hoy (actualización al 23 de octubre)

El plan del 20 de octubre (anexo C) dejó siete bloqueantes. Este es su estado real hoy:

| # | Bloqueante del plan | Estado al 23-oct | Qué significa |
|---|---|---|---|
| 1 | La 10.4 (versión vigente del Acuerdo y migración de la solicitud) | **CERRADO** | La v1.0 está publicada con su huella y el código migra la solicitud a la versión vigente. Ya no hay salidas sin retorno. |
| 2 | La D-02 (rechazar el OTP a un buzón del dominio de la Empresa) | **CÓDIGO LISTO, BANDERA APAGADA** | El sistema ya sabe distinguir un buzón corporativo de uno personal, ya tiene la salida en papel que lo hace legal, y ya avisa cuando el buzón es corporativo. Falta (a) que la v1.1 lo ordene y (b) **medir el inventario del buzón** (§4, decisión del owner). |
| 3 | El `conservacion_por_deber_legal` en la 5B | **CERRADO** | Es un campo explícito en la ficha de la Empresa, más el *hold* legal y un catálogo de retención por tipo de documento (80 años de custodia, con el deber legal sin término ganando sobre cualquier plazo). |
| 4 | La 9A (papel, medios autorizados, copia permanente, consulta a autoridades) | **CERRADO** | La salida en papel ya existe, que es lo que hace legal el rechazo del D-02: sin ella, exigir un medio personal sería una barrera de acceso al empleo. |
| 5 | Rechazar la firma visual en PNG | **HECHO** (20-oct) | El campo salió del esquema del commit. |
| 6 | El canal de datos de K+AIR y el registro de solicitudes (10.7(b)) | **PARCIAL** | El registro de solicitudes del Titular existe en el código, y hay un buzón de privacidad configurado. **Falta definir la persona o área responsable** (§4, decisión 3). |
| 7 | Compuerta 0.6 (hosting y proveedor de correo) | **RESPONDIDO** (§5) | Era el hueco que el plan dejó marcado. Ya sabemos dónde vive el dato y por qué caminos sale del país. |
| — | H-TC-19 (la semilla de prueba que convivía con la legal) | **RESUELTO en producción** | La v1.0 legal quedó con id 2; la semilla se borró con la purga del rastro de prueba, con recibo. En los demás ambientes sigue mandando la regla: cada versión, su archivo y su huella. |

**Lo que sigue bloqueando la publicación (no el texto, la operación):** el D-02 sin la v1.1 que
lo ordene, y el número del inventario del buzón. Ambos están resueltos en cuanto haya v1.1.

---

## 3. La decisión de fondo: tres caminos

### Camino A — Publicar la v1.1 tal como está, sin los textos de nube

Se publica todo salvo el grupo "Nube", y la operación real (que **es** en la nube) se sigue
sosteniendo con el texto viejo.

- **A favor**: es el más rápido; no depende de la firma del Anexo.
- **En contra**: el texto describe un despliegue que no es el real, y el Anexo quedaría
  firmando algo que el texto no dice. Es exactamente la distancia entre lo firmado y lo
  hecha, que es la que después se le cobra a uno.
- **Riesgo residual**: con cero firmas hoy, el riesgo es **deuda futura**, no daño actual.

### Camino B — Publicar la v1.1 con los textos de nube y firmar el Anexo de Nube antes de la primera firma real  ← **recomendado**

Se publica la v1.1 completa (los doce grupos, nube incluida) y se firma el Anexo de Encargo
como parte del mismo paquete.

- **A favor**: el texto y la operación coinciden; el Anexo queda firmado y con su huella; la
  primera firma real de un trabajador ocurre con el texto que describe lo que le pasa.
- **En contra**: añade a la Critical Path la firma del Anexo, que es del owner (y depende de
  datos administrativos que hoy no están: el NIT de Gesstiar, la URL real de la política de
  datos).
- **Es reversible**: si el Anexo no sale, la v1.1 se puede publicar igual, porque la v1.1 y el
  Anexo son documentos separados.

### Camino C — Aplazar todo a la 11B y seguir con la v1.0

- **A favor**: no se mueve nada; el servicio sigue como está.
- **En contra**: el 12.7 (la prueba de aceptación) y el 3.7(a) seguirían con el defecto
  detectado en la auditoría (H-TC-05): el texto afirma que los datos de creación
  "corresponden exclusivamente al Firmante" cuando el OTP se manda al buzón que **registró la
  Empresa**. El código ya tiene la salida; el texto no la refleja. Cada firma real que se
  firmara con la v1.0 acumularia ese defecto en el expediente.

**La recomendación del equipo técnico es el Camino B**, por una razón concreta: hoy no hay
ningún trabajador firmado, así que el Camino B no cuesta nada a los usuarios y sí cierra el
defecto antes de que exista el primer expediente.

---

## 4. Las cuatro decisiones que quedan

Las demás preguntas del plan del 20 de octubre ya están resueltas por el owner (variante A
para el 2.2, rechazo de la firma visual, y la obligación propia de K+AIR en el 10.7(b)) o
quedaron forzadas por el código (la 10.4, la 9A y el `conservacion_por_deber_legal` ya están
hechos). Quedan estas cuatro.

### Decisión 1 — El 8.6 (plazo de conservación) y el Código de Sustitución

**El problema.** El 8.6 de la v1.0 dice que el plazo de conservación "se determina por la tabla
de retención documental de la Empresa", que "constituye la referencia vigente de esa Empresa"
y que "no se modifica por este Acuerdo". Pero el 2.2.2.25.2.8 del Decreto 1074 exige que el
**código de sustitución** quede escrito en el contrato y sea la **modalidad** de conservación
que el Titular puede rechazar. Un texto que remite a un documento externo sin decir cuál es el
código no cumple.

**Las opciones.**

- **A.1 (recomendada).** El 8.6 nombra **el código de sustitución como modalidad** y obliga a
  que el contrato individual diga cuál se usa y que el Trabajador pueda rechazarlo. Es lo que
  ya hace el catálogo por tipo de documento (80 años de custodia, con el deber legal sin
  término por encima).
- **A.2.** Se deja el 8.6 como está y se agrega un anexo con el código. Más fácil de publicar,
  pero deja el número en un documento que el Trabajador no firma.
- **A.3.** Se elimina el piso y cada documento conserva lo que la ley exija. Contradice el
  catálogo que ya está implementado.

**Qué implica cada una para el código:** A.1 no requiere código nuevo (el catálogo y el
*hold* ya están); A.2 y A.3 sí.

### Decisión 2 — El alcance del bloqueo del D-03 (la Empresa sin Anexo)

**El problema.** Hoy, si la Empresa no tiene Anexo de Encargo o canal de PQRS, el sistema
**avisa** pero no bloquea, y la solicitud se puede crear igual. El plan recommends bloquear.

**Las opciones.**

- **B.1 (recomendada).** El bloqueo llega hasta el **commit y la creación del consentimiento**:
  sin Anexo firmado, no hay solicitud que valga. Es la lectura estricta del deber de
  encargo.
- **B.2.** El bloqueo se queda donde está (aviso, no bloqueo) y la Empresa se regulariza por
  la vía administrativa. Menos fricción, pero la vía administrativa es la que **no deja
  rastro auditable** (es el punto que mas, abajo se describe).
- **B.3.** Intermedio: se bloquea la creación de la solicitud, pero el aviso y la
  regularización quedan registrados en la bitácora.

**Qué hay que decidir además (es del owner):** de dónde sale el canal de PQRS de la Empresa.
Hoy hay dos caminos —el formulario del escritorio y el endpoint administrativo— y no
coinciden en el registro. Mientras no se elija uno, el override no deja rastro.

### Decisión 3 — La persona o área de protección de datos de K+AIR, y su canal (10.7(b))

**El problema.** La v1.0 dice, en el 10.7(b), que "K+AIR, en su calidad de Encargado, **no
recibe ni resuelve por su propia cuenta** las solicitudes de los Titulares". Eso es lo que
dice el texto, y **es falso como descripción del sistema**: el código tiene un registro de
solicitudes del Titular y un buzón de privacidad. Y además es incompleto: como Encargado,
K+AIR tiene obligaciones propias (designar una persona o área responsable y tener un canal
disponible para que el Titular pueda presentar solicitudes).

**Las opciones.**

- **C.1 (recomendada).** Corregir el 10.7(b) para que diga la verdad: K+AIR atiende las
  solicitudes **que le lleguen** por el canal propio, las registra y las remite a la Empresa
  (que es la Responsable), y la Empresa las resuelve. Es el modelo del art. 21 del Decreto
  1377 aplicado al Encargado.
- **C.2.** Mantener el texto y **no** recibir solicitudes: obliga a que todo llegue por la
  Empresa. Es más simple, pero obliga a que la Empresa tenga el canal y a que K+AIR no
  pueda recibir una queja de la SIC sinRegistration previa.
- **C.3.** Texto intermedio: K+AIR recibe y registra, pero no responde.

**Lo que hay que definir para poder publicarlo (es del owner, no del abogado):**

1. **Quién** es la persona o el área responsable en K+AIR (nombre o cargo).
2. **Cuál** es el canal: hoy hay un buzón de privacidad configurado; falta confirmar que
   existe y que alguien lo mira.
3. **El plazo de trasmisión a la Empresa**: el código ya tiene un valor configurable (días
   hábiles); si el abogado quiere otro número, se cambia en un solo lugar.

### Decisión 4 — El Anexo de Nube: qué dice y qué se firma

Ver la §5. Es la decisión que depende de la Compuerta 0.6.

---

## 5. La Compuerta 0.6, contestada (dato nuevo del 23 de octubre)

El plan del 20 de octubre dejó este punto marcado como **no verificado**. Hoy sabemos esto, y
es lo que hay que tener en cuenta para firmar el Anexo:

| Dónde se trata el dato | Hecho verificado | Consecuencia |
|---|---|---|
| **Hosting** | Servidor Ubuntu Server 24.04.5 LTS, en la red local del owner (192.168.1.11), detrás de NAT. | El dato **no sale de la red local** por el túnel, pero el túnel es de Cloudflare (§ siguiente). **Falta documentar dónde está físicamente la máquina**: si está en Colombia, no hay transferencia por el hosting; si no, hay que decirlo. |
| **Tráfico de la aplicación** | Túnel de Cloudflare (`cloudflared`, tunnel `kair-firma`) hacia `firma.kair.fyi`. | El tráfico del Trabajador **pasa por la red global de Cloudflare**: hay **transmisión internacional** y **Cloudflare es un subencargado** que el Anexo hoy **no nombra**. |
| **Correo** | `SMTP_HOST=smtp.gmail.com`, puerto 587. | Cada correo (invitación, OTP, copia firmada) **sale a servidores de Google**: hay **transmisión internacional** y **Google es un subencargado** que el Anexo hoy **no nombra**. |
| **Almacenamiento de objetos / backups / monitoreo / soporte** | No hay un proveedor externo declarado; el almacenamiento es el sistema de archivos del servidor. | El Anexo los debe identificar **nominalmente** según su propio bloque 4. Si el respaldo y el monitoreo los hace una persona (no un proveedor), eso también hay que decirlo. |

**Lo que se le pregunta al abogado, en tres puntos:**

1. **¿La transmision a Cloudflare y a Google es "transmisión" (art. 24 del Decreto 1377) o
   "transferencia" (art. 26 de la Ley 1581)?** La distinción importa: la transmisión a un
   tercero en cabeza del Encargado, pursuant al contrato de encargo, **no requiere
   consentimiento del Titular** pero **sí debe constar** en el Anexo y en la política; la
   transferencia internacional exige autorización expresa del Titular.
2. **¿Basta el contrato de encargo (art. 25 del Decreto 1377) más la constancia en el Anexo,
   o hace falta además algo en el texto del Acuerdo?** El 10.x del Acuerdo describe el
   tratamiento; si los subencargados deben aparecer **en el Acuerdo** y no solo en el Anexo,
   eso cambia el texto.
3. **¿La Ley 1712 (correo electrónico) exige algo adicional por el uso de Gmail?** En
   particular: si el aviso al Trabajador se entrega por un buzón de la Empresa y no por el
   del Trabajador, ¿entra en la categoría de "mensaje de datos" que exige la ley, y qué
   obligaciones de identificación y de registro del envío se activan?

**Y una cuarta, que es del owner pero condiciona todo lo anterior:** el Anexo tiene un bloque
que exige la **identificación nominal** de los subencargados (hosting, almacenamiento de
objetos, SMTP, respaldos, monitoreo y soporte). Hoy, con el túnel y el correo, **dos de esos
proveedores no estaban identificados**. O se identifican en el Anexo, o el Anexo se firma
mintiendo. La recomendación del equipo es identificarlos.

---

## 6. Los doce grupos de numerales de la v1.1

El texto propuesto de cada uno está en el anexo A (`propuestas-texto-11A-2026-10-20.md`), con
la norma que lo respalda y el hallazgo que lo motiva. La columna "qué hay que revisar" es la
lista de trabajo del abogado.

| # | Grupo | Numerales | Qué hay que revisar |
|---|---|---|---|
| 1 | **Nube (T1)** | 1.4, 1.5, 3.1, 3.7(a), 5.1(c), 8.7, 10.1 | Que el texto describa la operación real (servicio en la nube) y que el 8.7 (conservación mediante herramientas externas) tenga respaldo en el Anexo. |
| 2 | **La contradicción §4 vs §8** | 2.2(a), 2.2(c), 4.5, 8.6 (+ el 2.2.2.25.2.8) | Que el capítulo de efectos jurídicos y el de conservación no se contradigan, y el código de sustitución (decisión 1). |
| 3 | **La cadena de gobernanza (T5)** | preámbulo del 2.2, 6.1(d), 6.2 | Que la cadena "Trabajador → Empresa → K+AIR" y el rol de cada uno quede inequívoco. |
| 4 | **Citas del capítulo IV** | 4.1, 4.2, 4.3, 4.4 | Que las cuatro afirmaciones del capítulo de efectos jurídicos tengan respaldo en la norma (eran las que "afirmaban una atribución que la norma no tiene"). |
| 5 | **Deberes del firmante** | 5.1 (preámbulo + a) | Que los deberes del Firmante sean exigibles y proporcionales. |
| 6 | **Atribución de la carga de la prueba** | 3.8 | A quién le toca probar qué en unohlido de la validación. |
| 7 | **Huellas: vocabulario** | 3.4(d), 3.4(e), 3.6(e), 3.10 (nuevo), 10.5(a), 10.5(b), 10.5(g) (nuevo), 1.2 | Que "huella", "firma" y "constancia" no se usen como sinónimos, y qué es la huella de la identificación. |
| 8 | **Tokens y versión** | 3.1, 3.3, 3.4(c), 3.4(g), 9.2 | **El 3.3 y el 3.7(a)**: qué son exactamente los "datos de creación" y por qué "corresponden exclusivamente al Firmante" (el corazón del H-TC-05). |
| 9 | **Copia y conservación** | 5.4, 8.2, 8.3, 8.4, 8.5 | El 8.2 (medio electrónico autorizado por el trabajador: registro y vía) y el 8.5 (copia permanente). |
| 10 | **Auditoría y purga** | 3.6(g), 10.5(d), 10.6, 12.7 | Que el 12.7 (la prueba de aceptación sobrevive a la supresión) sea coherente con lo que el código hace. |
| 11 | **Datos personales** | 10.2(h), 10.4(a), 10.7(b), 10.7(c), 10.7(e), 10.7(f) | **El 10.7(b)**: la obligación propia de K+AIR (decisión 3). |
| 12 | **Ley aplicable** | 12.1, 12.3 | Nombre oficial de la Resolución 0312 de 2019 y las referencias al Decreto 526 y al 2364. |

---

## 7. Lo que se entrega

| Anexo | Documento | Para qué |
|---|---|---|
| **A** | `propuestas-texto-11A-2026-10-20.md` | El texto propuesto, numeral por numeral, con la norma que lo respalda (cita oficial) y el hallazgo que lo motiva. **Es el insumo de trabajo principal.** |
| **B** | `revision-tc-capitulos-2-12-2026-10-20.md` | La auditoría del Acuerdo contra el código y contra la norma: 19 hallazgos (H-TC-01 a H-TC-19). |
| **C** | `plan-cierre-tc-y-decisiones-2026-10-20.md` | El plan de cierre, la partición 11A / 11B, los bloqueantes y las decisiones ya tomadas. |
| **D** | `consulta-legal-firma-en-papel-interfaz-2026-10-20.md` | La consulta ya resuelta: la norma **no** obliga a que el Acuerdo mencione la ruta en papel ni a poner un botón. Se incluye para que no se vuelva a preguntar. |
| **E** | `comparacion-mercado-firma-2026-10-20.md` | Qué hacen Buk y el mercado global, para contraste. |
| **F** | `scripts/fixtures/acuerdo-v1.0.txt` | **El texto de la v1.0, como está publicado y sellado.** Es el punto de partida: la v1.1 se escribe contra este archivo. |

---

## 8. Lo que no se toca

- **La v1.0.** Sigue publicada, activa y sellada. El archivo y su huella son inmutables: si el
  texto cambia, es una versión nueva (v1.1) con su propia huella, y hay un candado en el
  código que se niega a borrar la v1.0 archivada.
- **Los consentimientos ya aceptados.** No se tocan.
- **El código.** El texto no se ajusta al código: si no calza, se cambia el código (y se dice
  en el Historial). La v1.1 describe lo que el sistema hace, no al revés.
- **El entregable del 12.7.** La prueba de aceptación de cada Trabajador se conserva con la
  versión aceptada, la huella del texto, la fecha y el identificador de la solicitud.

---

## 9. Qué necesitamos de vuelta, y en qué orden

1. **Primero, lo que bloquea lo demás:** la respuesta a las **cuatro decisiones** de la §4,
   en cualquier forma (un "sí" al recomendado, o la alternativa con el numeral redactado).
2. **Después, el texto** de los doce grupos de la §6, listo para publicar.
3. **En paralelo con el 1:** la validación (o la redacción) del **Anexo de Nube**, que depende
   de la respuesta al punto 2 de la §5 (transmisión vs transferencia) y de que el owner cierre
   los datos administrativos (NIT, URL real de la política de datos, persona responsable de
   datos).

**No hace falta** una revisión de la v1.0: ya está publicada, sellada y verificada.
**No hace falta** un concepto sobre la ruta en papel: ya está resuelto (anexo D).

**Plazo sugerido:** quince días hábiles para las cuatro decisiones, y una semana para el
texto. La razón del plazo no es la urgencia del servicio (no hay firmas de trabajadores
reales): es que la v1.1 es la que enciende el rechazo del OTP a buzones corporativos, y ese
rechazo solo es justo si el texto lo ordena.

---

*Documento preparado por K+AIR el 2026-10-23. Toda afirmación técnica de esta solicitud es
verificable contra el repositorio y contra el servidor de producción; el anexo B trae la
auditoría numeral por numeral.*
