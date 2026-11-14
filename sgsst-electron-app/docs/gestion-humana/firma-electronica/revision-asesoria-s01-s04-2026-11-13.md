# Revisión de asesoría sobre S-01 a S-04 — 13 de noviembre de 2026

> **Qué es este documento.** La revisión que la **asesoría jurídica** hizo de las cuatro solicitudes al abogado
> matriculado (S-01 a S-04) **antes** de que salieran. Trae **una corrección obligatoria**, **dos avisos** y un
> **punto a favor**. Queda registrada aquí con su huella porque cambia lo que se le manda al abogado.
>
> **Qué NO es.** **No es la respuesta del abogado matriculado.** El propio escrito lo dice: «No sustituye la
> decisión del abogado matriculado ni del representante legal». Por eso esta revisión **dejó las cuatro
> `EMITIDA` y 0 `RESPONDIDA`**: lo que se corrigió fue **lo que se envía**, no lo que el abogado respondió.
> (Más tarde ese mismo día, S-01, S-03 y S-04 se cerraron **por resolución del owner** —«resuelto por
> decisión del owner, sin ratificación externa», no por respuesta— y S-02 sigue `EMITIDA`: ver
> `tabla-de-solicitudes-2026-11-13.md`.)
>
> **Estado del envío.** El owner's écrit del 13-nov-2026 registra las cuatro como «emitida hoy, pendiente tu
> envío». Esta revisión se produjo **antes** de ese envío y quedó incorporada al escrito; el envío físico sigue
> siendo del owner.

## 1. El escrito recibido

| | |
|---|---|
| Origen | el owner, el 13-nov-2026 |
| Formato | texto plano, **9 132 B** |
| SHA-256 | `7c1a0e67d89da3eeabd9eeb86585b77fe8553184515e4a45c2393807849dc132` |
| Contenido | la tabla maestra (solicitud → norma → qué bloquea → qué desbloquea), tres observaciones previas al envío, qué NO desbloquea la respuesta del abogado, y la recomendación de envío en tres pasos |

## 2. La corrección obligatoria: la cita del Decreto 1377

**Lo que decía.** S-01, numeral 1, decía: «la operación es una **transmisión internacional a un Encargado**
(art. 2 num. 5 del Decreto 1377 de 2013)».

**Por qué está mal.** El **art. 2 del Decreto 1377 de 2013** es «**Tratamiento de datos en el ámbito personal o
doméstico**». Las **definiciones** están en el **art. 3**, y de ahí son el **num. 4** (Transferencia) y el **num.
5** (Transmisión).

**Verificación en fuente oficial (13-nov-2026).** Compilación del Decreto 1377 de 2013, Cancillería —
`https://www.cancilleria.gov.co/normograma/compilacion/docs/decreto_1377_2013.htm`: «ARTÍCULO 2o. TRATAMIENTO DE
DATOS EN EL ÁMBITO PERSONAL O DOMÉSTICO»; y «Artículo 3. Definiciones… 4. Transferencia… 5. Transmisión». El
mismo texto compilado en el Decreto 1074 de 2015 (art. 2.2.2.25.1.x) remite expresamente al «(Decreto 1377 de
2013, artículo 3o)».

**El texto correcto.** «transmisión internacional a un Encargado (**art. 3 num. 5** del Decreto 1377 de 2013)».
Lo mismo para la transferencia: **art. 3 num. 4**.

**Lo que se hizo (13-nov-2026).** La cita se corrigió **en la fuente**, no en la salida:

| Dónde | Qué se corrigió |
|---|---|
| `dictamen-legal-l1-2026-11-12.md` | la Determinación de L1 (prosa, tablas y **literales**) y una **corrección 0.13** nueva que deja la corrección trazada |
| `pedido-6-backblaze-v1-4-2026-11-12.md` | la fila de la tabla de normas: «Art. 2, num. 4 y 5» → «Art. 3, num. 4 y 5» |
| `candidatos-v1.4/anexo-nube-v1.4.html` y `candidatos-v1.4/anexo-encargo-2026-11-12.html` | **regenerados** por el generador, que lee el literal del dictamen en runtime: el texto corregido llega solo, sin transcribirlo |
| `meta-para-abrir-a-empresas-reales-2026-11-12.md`, `CONTEXT.md`, `Historial.md`, `solicitudes-al-abogado-2026-11-13.md` | la cita en la prosa |

**Lo que NO se tocó.** Los textos **ya suscritos**: la Nube v1.3 (`fdd10551…`) y el Encargo 2026-11-11
(`6308b1f7…`). **No tienen esta cita**: usan la forma compilada —«art. 2.2.2.25.1.3, numeral 4 y 5, del Decreto
1074 de 2015»—, que es correcta. Un texto suscrito no se corrige: se sustituye, y la corrección vive en la v1.4.

**El guard.** El test de los candidatos ahora **falla si la cita errada vuelve a aparecer** en cualquiera de los
dos textos firmables, y además comprueba que la correcta sí está: una guarda que no se ve fallar no es una
guarda.

**Huellas nuevas de los candidatos** (mismo tamaño, huella distinta):
Anexo de Nube v1.4 — **103 390 B**, `fae2b26b87867d24d558c948e7f90f886f76d6cf6b3eb39eb19deda4dbd8b416`;
Anexo de Encargo 2026-11-12 — **97 962 B**, `7576b1a1dd7f7ded71ac6be7ff556a7041e04538266f199372e4f9c7082d9f3c`.

> **Anotación del 13-nov-2026 (tarde): estas huellas ya no son las vigentes.** Eran las de la mañana,
> después de corregir la cita del Decreto 1377. Ese mismo día, con la autorización expresa del owner,
> se aplicó al texto el **escrito informal** del abogado matriculado (archivado en
> `respuesta-del-abogado-2026-11-13.md`; **no es formal**: sin nombre, sin fecha de suscripción y sin
> huella), y los candidatos se regeneraron. **Las huellas vigentes** son: Anexo de Nube v1.4 —
> **111 462 B**, `ba664e6f1ad130c968b6224ab71ed66a52017e96ac578b8b0e740fd55f9e3b47`; Anexo de Encargo
> 2026-11-12 — **100 787 B**, `55a58967b3bb081bcee5f72d15b50b4b3141691418a9b8338df9db738b646fc9`
> (re-medido el 13-nov-2026 por el cambio de la regla de la compuerta y otra vez el 13-nov-2026, tarde,
> por el **acto de apertura** de esa compuerta (S-25): el Anexo de Nube **no se movió** en ninguno de los
> dos cambios).
> Las de arriba **no se reescriben** (este registro tiene fecha) pero **tampoco se pueden mandar**: el
> pedido al abogado (`solicitudes-al-abogado-2026-11-13.md`) trae la tabla de huellas vigentes al final.

## 3. Los dos avisos

### 3.1 S-04 — la condición de región del bucket: ¿exigencia legal o decisión propia?

**Lo que decía S-04.** El bucket debe ir a **región United States** porque Canadá y Países Bajos «no están en la
lista de países con nivel adecuado de protección».

**El aviso.** La asesoría **no pudo verificar** en esa consulta la lista publicada por la SIC con ese alcance. Y
aporta el encuadre: por el **art. 24 num. 2 del Decreto 1377**, una transmisión a un encargado se valida **con el
contrato del art. 25**, sin referencia a la lista de países; la lista entra por el camino de las **transferencias**
(art. 24 num. 1 → art. 26 de la Ley 1581).

**Lo que se hizo.** Se **agregó a S-04 la pregunta expresa**: si la condición de región US es **exigencia legal** o
**decisión conservadora de K+AIR**. De eso depende cómo se redacta la v1.4: como obligación normativa o como
decisión propia. Una mala redacción aquí es exactamente el tipo de texto que después contradice la realidad.

### 3.2 S-01 — el RNBD, el umbral de 100.000 UVT y la Circular 002 de 2025

**Lo que dice el aviso.** La SIC mantiene la obligación de inscripción en el **RNBD** para «las sociedades y
entidades sin ánimo de lucro que tengan activos totales superiores a 100 mil UVT» (sic.gov.co/registro-nacional-de-
bases-de-datos; reglamentación en el Decreto 1074 de 2015, libro 2, título 2, capítulo 26, modificado por el
Decreto 090 de 2018). **La redacción de S-01 es consistente** con eso: la inscripción se determina por los activos
de cada Empresa.

**Lo que NO está verificado.** El contenido específico de la **Circular Externa 002 de 2025** de la SIC (el PDF no
pudo leerse en esa consulta). Su aplicación al canal de correo y a la transferencia del software es **el punto que
el abogado debe confirmar**, no un hecho dado por cierto. Queda marcado como tal en S-01.

### 3.3 Un punto a favor (no hay que tocar nada)

La tabla supletoria **ya contiene** la categoría `SST_ESPECIAL` con 20 años desde el cese y `piso_legal: true`,
fundada en el art. 2.2.4.6.13 del Decreto 1072 de 2015. Es decir: la condición **C3** (la tabla de la Empresa no
puede bajar el piso legal) **ya está materializada en el archivo**, y el cómputo en años calendario (**C2**) también.
El abogado valida sobre un texto que ya respeta el mínimo de ley.

## 4. Qué NO desbloquea la respuesta del abogado

De los 20 pendientes del mapa, **solo tres dependen del abogado** (M.5, M.6, M.18) más la **parte jurídica de
M.7**. Los otros 16 **no son veto legal**:

- **8 de servidor y despliegue** (M.8, M.9, M.12, M.13, M.14, M.21, M.23, M.24): requieren `sudo`, el despliegue
  del 📦1051, la ventana de Node 22 y la restauración cifrada real. El worker puede preparar todo eso ahora; la
  ejecución es del owner (S-10, S-11, S-14 a S-16, S-19 a S-21).
- **Owner y terceros** (M.1 a M.4, M.10, M.11, M.16, M.19): empresa real, A4, consola de Workspace, `.env` y
  `TRUST_PROXY`, tráfico real.

## 5. La salvedad de régimen

La revisión recuerda, con palabras del propio criterio del 13-nov, que **una solicitud emitida no cierra un
bloque**: el bloque se cierra cuando la respuesta **se aplica y se verifica**. **S-01 a S-04 están `EMITIDA`, 0
respondidas.**

Esto es compatible con lo que dice la leyenda del mapa y con lo que dice la tabla: en la **tabla de solicitudes**
`CERRADA` significa «la respuesta se aplicó y se verificó», y en el **mapa** un bloque `CERRADO` significa «el
pedido está emitido y medido». Son dos objetos distintos, con dos estados distintos. Lo que la salvedad prohíbe es
leer el 30/0 del mapa como «el servicio puede abrirse»: eso lo dicen los hechos de cada bloque, y siguen ciertos.

## 6. La recomendación de envío (aplicada)

1. **Corregir la cita de S-01** (art. 2 num. 5 → **art. 3 num. 5** del Decreto 1377). — **Hecho** (§2).
2. **Agregar en S-04 la pregunta expresa** sobre si la condición de región US es exigencia legal o decisión
   propia. — **Hecho** (§3.1).
3. **Mantener las cuatro** con vence **2026-11-20** y con el formato de respuesta que ya pide el escrito (nombre,
   fecha, SHA-256, redacción literal). — **Se mantiene**.

## 7. Las fuentes

| Fuente | Para qué | Cuándo |
|---|---|---|
| Escrito de la asesoría (9 132 B, `7c1a0e67…`) | la revisión que se registra aquí | 13-nov-2026 |
| Compilación del Decreto 1377 de 2013, Cancillería (`cancilleria.gov.co/normograma/compilacion/docs/decreto_1377_2013.htm`) | verificar el art. 2 y el art. 3 | 13-nov-2026 |
| Decreto 1074 de 2015, art. 2.2.2.25.1.x, Cancillería (`cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm`) | el texto compilado remite al «Decreto 1377 de 2013, artículo 3o» | 13-nov-2026 |
| Decreto 1377 de 2013 en PDF, CVC (`cvc.gov.co/sites/default/files/2018-10/Decreto%201377%20de%202013-Jun-27.pdf`) | segunda fuente del mismo texto | 13-nov-2026 |
| SIC, Registro Nacional de Bases de Datos (`sic.gov.co/registro-nacional-de-bases-de-datos`) | el umbral de 100 mil UVT del RNBD | 13-nov-2026 |
