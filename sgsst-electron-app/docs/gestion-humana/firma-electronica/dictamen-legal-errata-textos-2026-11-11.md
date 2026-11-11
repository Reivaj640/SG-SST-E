# Dictamen legal sobre la errata de los dos textos que P8 va a firmar

> **Asesor:** skill `asesoria-legal-sg-sst` del repo (`.opencode/skills/asesoria-legal-sg-sst/SKILL.md`).
> **Fecha:** 11 de noviembre de 2026. **Base verificada ese día contra fuente oficial**
> (Gestor Normativo de la Función Pública, Ley 527 de 1999).
> **Naturaleza:** asesoría jurídica informativa. No sustituye la decisión del representante legal de
> Gesstiar S.A.S., que es la autoridad del expediente. El agente que ejecuta este dictamen es un
> agente de código: aplica los cambios de texto que aquí se resuelven, y no presta asesoría jurídica
> profesional.
>
> **Objeto:** dictaminar los dos defectos que aparecieron en los dos textos que K+AIR va a
> contrafirmar en P8 —el **Anexo de Nube v1.3** y el **Anexo de Encargo 2026-11-11**—, y resolver si
> se corrigen **en sitio** (conservando su número de versión) o **con una etiqueta de versión
> nueva**, que es la decisión que el owner tenía abierta.
>
> **Estado al cierre del 11-nov-2026:** el owner decidió la **opción A** —errata en sitio,
> conservando las etiquetas **v1.3** y **2026-11-11**— (D9). La corrección está aplicada en el repo,
> las huellas nuevas están declaradas en el manifiesto, y **la instalación en el servidor se hizo a
> las 15:56** (los dos textos y el manifiesto, juntos, con respaldo) y quedó **verificada por SSH**:
> compuerta con 0 bloqueantes y los tres actos de P8 siguen pendientes. Lo que **no** se ha hecho:
> los cuatro actos de P8, que siguen esperando los códigos del owner.

---

## 1. Respuesta corta

**Los dos defectos son de CITA, no de fondo, y su corrección es obligatoria ANTES de la firma: el
Anexo de Encargo incorporaba por remisión el Anexo de Nube equivocado.** Se corrigen **en sitio**,
conservando el número de versión de cada texto (**Nube v1.3** y **Encargo 2026-11-11**), con la
errata documentada de forma expresa en el manifiesto, en el Historial y en este dictamen, y con una
línea de información a ASEPLUS antes de pedirle la firma. La alternativa —emitir una v1.4 y una
etiqueta de fecha nueva— no la recomienda el asesor: obliga a un ciclo de firma más sobre un texto
sustantivamente idéntico, y a re-sellar una doceña de menciones de versión dentro del Anexo de Nube
sin tocar las menciones históricas a la v1.1 y a la v1.2, que es donde cabe introducir un defecto
nuevo.

---

## 2. Los dos defectos, con su texto literal

### 2.1 Anexo de Nube v1.3 — §12 «Firmas», párrafo de la remisión

Texto corregido (el que decía «1.2» donde debía decir «1.3»):

> **Remisión al Anexo de Encargo version 2026-11-11.** Esta versión 1.2 **remite** al Anexo de
> Encargo de Tratamiento de Datos Personales version 2026-11-11, que es el **instrumento bilateral**
> de esta relación…

Y **la frase siguiente del mismo párrafo** decía (correctamente):

> **Esta versión 1.3 no sustituye ese instrumento por una cláusula unilateral**: lo remite y
> documenta la misma calificación con la evidencia que la sostiene…

El párrafo se contradecía a sí mismo: la remisión la hacía «esta versión 1.2» en un documento que
es la v1.3. La corrección es de una palabra.

### 2.2 Anexo de Encargo 2026-11-11 — cuatro referencias al Anexo de Nube v1.2

El menú, la §1 (Partes), la §5 (Proveedores externos y subencargados) y la §9 seguían apuntando a
`anexo-nube-v1.2.html`, y la §5 decía, en el mismo párrafo:

> …están en el <Anexo de Nube>, **versión 1.2**, que forma parte integral de este documento:

Mientras que la **cláusula de prevalencia** de esa misma §5 ya nombraba la v1.3:

> **La versión 1.3 del Anexo de Nube es el texto que se publicará** y remite a esta versión
> 2026-11-11 de este Anexo de Encargo sin sustituirla.

**Esto no es un detalle de redacción.** La §5 dice que el Anexo de Nube «forma parte integral de
este documento»: eso es una **incorporación por remisión**, y el artículo 44 de la Ley 527 de 1999
determina qué queda incorporado:

> «Salvo acuerdo en contrario entre las partes, cuando en un mensaje de datos se haga remisión total
> o parcial a directrices, normas, estándares, acuerdos, cláusulas, condiciones o términos
> fácilmente accesibles con la intención de incorporarlos como parte del contenido o hacerlos
> vinculantes jurídicamente, se presume que esos términos están incorporados por remisión a ese
> mensaje de datos. Entre las partes y conforme a la ley, esos términos serán jurídicamente válidos
> como si hubieran sido incorporados en su totalidad en el mensaje de datos.»

Lo que queda incorporado por el vínculo es **el texto al que el vínculo apunta**. Con el vínculo
apuntando a la v1.2, este Anexo de Encargo incorporaba por remisión un texto que (a) el propio
documento declara superado en su cláusula de prevalencia, (b) cuyo bloque de pendientes declara
como no cumplidos unos pasos que ya se cerraron el 10-nov-2026, y (c) que además está publicado y
se puede descargar. Es decir: **el instrumento iba a incorporar el texto equivocado**, y lo iba a
hacer por la vía que la ley usa para incorporar contenido vinculante.

### 2.3 Qué NO cambian las correcciones

Ni las partes, ni el objeto, ni las obligaciones, ni los precios, ni la distribución del riesgo, ni
los plazos, ni la calificación del papel de Google (D4 del dictamen del 11-nov), ni el bloque de
pendientes, ni la cláusula de prevalencia. Cambian **las citas**: qué versión se nombra y a qué
archivo apunta cada remisión.

---

## 3. Base normativa (verificada el 11-nov-2026 en fuente oficial)

| Norma | Artículo | Texto literal | Fuente oficial |
|---|---|---|---|
| Ley 527/1999 | 3 (Interpretación) | «En la interpretación de esta ley habrán de tenerse en cuenta su origen internacional, la necesidad de promover la uniformidad de su aplicación y la observancia de la buena fe.» | [Gestor Normativo (Función Pública)](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276) |
| Ley 527/1999 | 7 (Firma) | «…se entenderá satisfecho dicho requerimiento si: a) Se ha utilizado un método que permita identificar al iniciador de un mensaje de datos **y para indicar que el contenido cuenta con su aprobación**; b) Que el método sea tanto confiable como apropiado para el propósito por el cual el mensaje fue generado o comunicado.» | misma |
| Ley 527/1999 | 8 (Original) | «…ese requisito quedará satisfecho por un mensaje de datos, si: a) Existe alguna garantía confiable de que se ha conservado la integridad de la información, **a partir del momento en que se generó por primera vez en su forma definitiva**…» | misma |
| Ley 527/1999 | 9 (Integridad) | «…se considerará que la información consignada en un mensaje de datos es íntegra, si ésta ha permanecido completa e inalterada, salvo la adición de algún endoso o de algún cambio que sea inherente al proceso de comunicación, archivo o presentación.» | misma |
| Ley 527/1999 | 28 (Atributos jurídicos de la firma digital) | «…4. Está ligada a la información o mensaje, de tal manera que **si éstos son cambiados, la firma digital es invalidada**.» | misma |
| Ley 527/1999 | 44 (Incorporación por remisión) | transcrito en el §2.2 | misma |
| D. 1074/2015 | 2.2.2.47.4 num. 2 | «Es posible detectar cualquier alteración no autorizada del mensaje de datos, hecha después del momento de la firma.» | [Normograma SENA](https://normograma.sena.edu.co/compilacion/docs/decreto_1074_2015_pr038.htm) |

**Qué se sigue de cada una, para este caso:**

- **Art. 44:** la corrección del Anexo de Encargo no es una mejora de estilo, es la **integridad del
  instrumento**: sin ella, el Anexo de Encargo incorpora por remisión un texto superado y su
  bloque de pendientes desactualizado.
- **Art. 7(a):** el firmante tiene que poder **aprobar inequívocamente** el contenido. Un §12 que
  dice «esta versión 1.2 remite» en un documento que es la v1.3 no permite esa aprobación.
- **Art. 8:** la «forma definitiva» del mensaje de datos —la forma cuya integridad se conserva— se
  genera **al momento en que se fija**; un texto que todavía no ha sido suscrito ni entregado a la
  contraparte está en la fase de formación de esa forma definitiva. La errata es parte de esa
  formación, no una alteración de algo ya formado.
- **Art. 28 num. 4:** la firma queda invalidada si se cambia el mensaje. Aquí **no hay ninguna
  firma** sobre estos dos textos: no hay nada que invalidar. La suscripción del 5-nov-2026 (Nube
  v1.1) y la del 7-nov-2026 (Encargo 2026-11-06) no se tocan.
- **D. 1074 art. 2.2.2.47.4 num. 2:** el control de alteración no autorizada es **posterior a la
  firma**. La alteración que la ley detectaría aquí es la que se hiciera después; por eso la
  corrección debe hacerse **antes** de firmar, y por eso firmarla después de corregirla es lo
  correcto.

---

## 4. La decisión de fondo: ¿se corrige en sitio o con etiqueta nueva?

### 4.1 Lo que la cláusula del propio Anexo dice, y lo que obliga

El §12 del Anexo de Nube v1.3 dice:

> **Toda modificación de este Anexo se publica como versión nueva con su propia huella SHA-256**,
> se suscribe nuevamente por ambas partes y no altera las versiones ya suscritas ni sus efectos
> sobre los registros ya generados.

Esa cláusula tiene **tres efectos**, y la errata cumple dos de los tres:

| Efecto | ¿Se cumple con la errata en sitio? | Por qué |
|---|---|---|
| (ii) «se suscribe nuevamente por ambas partes» | **Sí** | El texto corregido es el que se suscribe en P8. |
| (iii) «no altera las versiones ya suscritas ni sus efectos sobre los registros ya generados» | **Sí** | No hay ninguna versión suscrita sobre estos dos textos, ni ningún registro generado a partir de ellos. Las v1.1 (5-nov) y 2026-11-06 (7-nov) quedan intactas. |
| (i) «se publica como versión nueva con su propia huella SHA-256» | **No, literalmente** | El número de versión se conserva; lo que cambia es la huella. |

**Esta es la objeción seria a la errata en sitio, y por eso la decisión es del owner y se pone a
ratificación del abogado externo (§6).** La respuesta del asesor es que la cláusula cumple su
función —proteger las versiones suscritas y los registros ya generados— y que el caso de hoy no
tiene ninguna de las dos cosas, pero la lectura literal de la cláusula admite la versión nueva.

### 4.2 Por qué este caso **no** es el caso que el dictamen del 11-nov ya resolvió (D2)

D2 decidió que la v1.2 del Anexo de Nube **no se reescribía**, y su fundamento fue: «no lo ha
suscrito nadie, **pero su huella está registrada en el manifiesto y citada en el expediente**». La
razón de la regla era el riesgo de que **un tercero** tuviera bajo una misma etiqueta un texto
distinto del que estaba en vigor. Ese riesgo **no se materializa hoy**, por tres hechos verificables:

1. **Estos dos textos no se han publicado ni se han entregado a nadie.** El sitio público sigue
   sirviendo el Anexo de Nube **v1.1** (el suscrito el 5-nov) y el Anexo de Encargo **2026-11-06**
   (el suscrito y contrafirmado el 7-nov). La v1.3 y el 2026-11-11 existen solo en el repo, en el
   servidor y en el manifiesto de hoy: **nadie ajeno al expediente los ha visto**.
2. **Ninguna huella de estos textos está ligada a un acto.** La suscripción registra la huella del
   archivo **en el momento de suscribir** (la calcula el módulo que suscribe, sobre los bytes que
   sirve). No hay consentimiento, acta ni evento vinculado a `45500569…` ni a `c7c42a18…`.
3. **La contradicción del §12 era además una contradicción del propio §12**, es decir, del texto
   que iba a firmar la representante legal de ASEPLUS. Un instrumento que se contradice a sí mismo
   en su párrafo de firmas es peor, para el expediente, que un instrumento con un párrafo de
   historia de versiones.

### 4.3 Las tres opciones y su costo

| | **A. Errata en sitio** (conservar 1.3 y 2026-11-11) | **B. Versión nueva** (Nube v1.4 + Encargo con etiqueta de fecha nueva) | **C. Errata en sitio + nota visible de errata dentro de los instrumentos** |
|---|---|---|---|
| **Huellas** | Cambian las dos (`fdd10551…` y `6308b1f7…`) | Cambian las dos, y además cambian las **etiquetas** | Cambian las dos |
| **Cumplimiento literal del §12** | No en el efecto (i) | **Sí, en los tres** | No en el efecto (i) |
| **Texto que firma ASEPLUS** | El mismo texto sustantivo, con las citas bien | Un texto sustantivamente idéntico, con **doce o más** menciones de versión re-selladas | El mismo, con un párrafo que dice que el texto tuvo una errata |
| **Riesgo de introducir un defecto nuevo** | Bajo: cinco cambios de cita, verificados | **Alto**: hay que re-sellar el título, la meta, la línea de fecha, el bloque «qué versión es esta», la ficha técnica del §5, el bloque de versión del §9, la remisión, el §10, el §12 y el pie, **sin tocar** las menciones históricas a la v1.1 y a la v1.2 (PROMPT.md, trampa 75: el sello tiene que morder en todas y en ninguna) | Bajo |
| **Etiqueta del Anexo de Encargo** | Sigue siendo `2026-11-11` | La etiqueta del Encargo es una **fecha**: para que el cambio de bytes tenga etiqueta nueva tendría que ser `2026-11-12` (P8 se firmaría el 12-nov) o inventar una convención que el repo no usa | Sigue siendo `2026-11-11` |
| **Costo para P8** | Ninguno: se firma hoy | **Un ciclo de firma más** (4 OTP y 4 actos más) sobre un texto sustantivamente idéntico | Ninguno |
| **Transparencia con la contraparte** | La errata se dice **en una línea** a ASEPLUS al pedir la firma, y queda escrita en el manifiesto, el Historial y este dictamen | La errata se cuenta sola, dentro del texto | La errata se ve **dentro del texto que firma**, lo que es lo más transparente y lo más ruidoso |

### 4.4 Recomendación

**Opción A**, con estas condiciones, que son las que la hacen defendible:

1. La errata queda **documentada de forma expresa**: la nota de los dos bloques del manifiesto
   (`anexo_nube.modelo` y `anexo_encargo`) declara qué se corrigió y **cuál era la huella anterior**;
   el Historial registra la ronda; este dictamen la razona.
2. **ASEPLUS recibe una línea de información** antes de que firme, en el propio mensaje de P8: el
   texto que va a firmar es el texto corregido, con la errata de cita explicada. Es la buena fe del
   art. 3 de la Ley 527 y es lo que evita cualquier sorpresa.
3. La pregunta se pone a **ratificación del abogado externo** (§6), con la alternativa B descrita
   para que, si él la prefiere, la ruta esté clara.

---

## 5. Decisiones

| # | Decisión | Fundamento | Estado |
|---|---|---|---|
| **D8** | Los dos defectos de cita se **corrigen antes de la firma** (el del Nube: «Esta versión 1.2 remite» → «Esta versión 1.3 remite»; los del Encargo: cuatro referencias al Nube v1.2 → v1.3). La corrección no cambia contenido sustantivo. | Art. 44 (incorporación por remisión); art. 7(a) (aprobación inequívoca del contenido); art. 28 num. 4 (la firma liga al texto: aquí no hay firma); D. 1074/2015 art. 2.2.2.47.4 num. 2 | Decidido |
| **D9** | La corrección **se hace en sitio**: el Anexo de Nube conserva la etiqueta **v1.3** y el Anexo de Encargo la **2026-11-11**; lo que cambia es la huella, y la errata queda escrita en el manifiesto, el Historial y este dictamen, con la huella anterior declarada. | §12 del Anexo (dos de sus tres efectos se cumplen íntegros; el tercero se pone a ratificación); arts. 8 y 28 (no hay firma que invalidar y la forma definitiva no está fijada); hechos del §4.2 (nadie ajeno al expediente vio estos textos) | **Decidido el 11-nov-2026 por el owner** (opción A del §4.3). La corrección está aplicada en el repo y pendiente de instalación en el servidor |
| **D10** | La **corrección vive dentro de los scripts que producen los textos** (`corregir-anexo-nube-v1.3.js` y `corregir-anexo-encargo-2026-11-11.js`), no en el HTML. Corregidos a mano, la próxima corrida de esos scripts los borraría. | Regla del repo: el manifiesto y los textos son salidas de scripts, no archivos editados a mano | Decidido |
| **D11** | La **v1.6 del Acuerdo no se toca**: no tiene ninguno de estos defectos, y su compuerta de publicación ya está en verde. La errata no altera la base de datos ni la versión activa. | D. 1074 art. 2.2.2.47.4 num. 2: la alteración que la ley detecta es la posterior a la firma; aquí no hay ninguna | Decidido |

---

## 6. Riesgos / a confirmar

- ⚠️ **La objeción principal a D9 es la lectura literal del §12 del Anexo de Nube** («toda
  modificación se publica como versión nueva»). Es la única de las tres cláusulas que la errata en
  sitio no cumple al pie de la letra, y la decisión sobre ella **es del owner**; se pide al abogado
  externo que la ratifique o la rechace (con la ruta B preparada).
- ⚠️ **A ratificar por el abogado externo**, junto con lo que ya estaba pendiente (J6, J8, J9):
  (i) si una errata de cita previa a la suscripción puede corregirse conservando la etiqueta de
  versión; (ii) si la §5 del Anexo de Encargo, al incorporar por remisión el Anexo de Nube, debe
  citar además la **huella** del texto incorporado y no solo su versión; (iii) si la contradicción
  interna que estos defectos producían podía tener consecuencias que este dictamen no midió.
- ⚠️ **No verificado:** que el Anexo de Nube v1.3 y el Anexo de Encargo 2026-11-11 **no** hayan sido
  descargados por terceros desde el sitio antes de esta corrección. Lo que sí está verificado es que
  el sitio público sirve la v1.1 y el 2026-11-06, y que ninguna huella de estos dos textos está
  ligada a un acto del servicio.
- **Verificado en el servidor el 11-nov-2026, 15:56:** los dos textos y el manifiesto quedaron
  instalados (juntos, con respaldo en `/opt/kair-firma/backup-errata-20261111-155647`) y medidos por
  SSH: las tres huellas del servidor son las declaradas, la compuerta queda con **0 bloqueantes
  pendientes** (`publicado: ok`), y `firmado_nube`, `contrafirma_nube` y `estado_encargo` **siguen
  pendientes**, que es lo que este dictamen exige: una errata no fabrica una firma. La base no se
  tocó (1 empresa, 3 consentimientos, la v1.6 activa, 4 aprobaciones, y las dos suscripciones
  intactas en la v1.1 y el 2026-11-06).
- **Riesgo operativo:** cambiar la huella de los dos textos obliga a rehacer el manifiesto, a
  reinstalar los tres artefactos **juntos** (el manifiesto declara la huella del texto, y la
  compuerta la compara con el archivo que el servidor lee: instalarlos por separado dejaría un
  estado rojo) y a volver a medir la compuerta. Hecho y verificado en el repo; pendiente en el
  servidor.
- **Riesgo de la P8:** si el texto se firmara **sin** corregir, la suscripción quedaría sobre un
  instrumento que se contradice a sí mismo y que incorpora por remisión un texto superado. Eso es
  el acto que no se puede deshacer: por eso la corrección va **antes** de la firma, no después.

---

## 7. Descargo

Este documento es asesoría jurídica informativa y **no sustituye la decisión del representante legal
de Gesstiar S.A.S.**, que es la autoridad del expediente. Las conclusiones se fundan en el texto de
los instrumentos del repo y en la norma consultada el 11-nov-2026 en fuente oficial; las normas
pueden cambiar. **Ninguna recomendación se presume aprobada por el silencio del owner.** El agente
que ejecuta este dictamen es un agente de código: aplica los cambios de texto que aquí se resuelven,
y no presta asesoría jurídica profesional.
