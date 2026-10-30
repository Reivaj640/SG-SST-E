# Paquete para el abogado — 30 de octubre de 2026 (ronda 4)

> Cierre de la línea legal conforme a su especificación del 30 de octubre de 2026 (12:59).
>
> Para: asesoría legal laboral y de protección de datos. De: owner y equipo de K+AIR
> (Gesstiar S.A.S.). Fecha: 30 de octubre de 2026.

---

## 0. En una página

**Qué se le manda:** ocho documentos —el Acuerdo v1.3 armado, el Anexo de Encargo con la
matriz de finalidades y la tabla de conservación, el Anexo de Nube con el papel de Google
documentado y la ficha técnica del canal, la Constancia de aprobación de la v1.3, la tabla
de correspondencia entre el texto y el código, la auditoría de los hallazgos T1 y T2 del
Capítulo V, la evaluación del canal de correo y su propia especificación— y esta nota. Todo
con su huella en `SHA256SUMS.txt`.

**Qué cambió desde su especificación de las 12:59.** Se aplicó completa, en el orden que
indicó: textos (Fase 1), Anexo de Encargo (Fase 2), Anexo de Nube (Fase 3), implementación
(Fase 4) y pruebas (Fase 5). El **Acuerdo v1.3** sale de la v1.0 sellada con dos scripts
reproducibles, no de una transcripción. **Aviso de cambios:** por eso **las huellas de los
adjuntos 1, 2, 3, 4 y 5 son nuevas**; las de la ronda anterior no sirven.

**La decisión de fondo que cambió.** Su instrucción D1 eliminó la retención indefinida. El
8.6(h) de la v1.2 —«sin plazo declarado, el registro queda retenido con un *hold* por plazo
no declarado y se reporta a la Empresa»— **ya no existe**, ni en el texto, ni en el código,
ni en los anexos. En su lugar hay una **tabla supletoria de conservación administrada por
K+AIR**, con un plazo por defecto por categoría documental, y el orden de precedencia que
usted indicó: primero las reglas legales que no se bajan, después la tabla de retención de la
Empresa, y a falta de plazo declarado por ella, la tabla supletoria.

**Lo que sigue abierto, y es lo que se le pide:**

1. **Aprobar o corregir el texto de la v1.3** (huella `2f8884c3…a875`), que es el que hoy se
   publicaría.
2. **Aprobar o corregir el Anexo de Encargo**, incluida la matriz de finalidades con Grupo A y
   Grupo B (§2 y §8).
3. **Aprobar los parámetros de la tabla supletoria** —diez (10) y cinco (5) años—, que hoy
   **no se activan en producción** (§2.3).
4. **Determinar por escrito el papel de Google** y **validar las dos conclusiones que el
   Anexo de Nube deja para revisión profesional** (§2.6).
5. **Responder las tres preguntas** del §4, de las que dos ya tienen respuesta incorporada al
   Anexo de Nube.

**Tres avisos que no se pueden omitir:**

- **La revisión jurídica profesional sigue pendiente.** El Anexo de Encargo conserva su marca
  de «Revisión profesional pendiente» y la Constancia de aprobación de la v1.3 **no está
  firmada**. Nada de este paquete se declara aprobado por el solo hecho de estar armado.
- **Los plazos de diez (10) y cinco (5) años no se activan en producción hasta que usted los
  valide.** El mecanismo queda construido y verificable; la activación es una decisión
  distinta, y es suya.
- **Nada se publicó, nada se activó y nada se firmó.** No hay commit, no hay push, no hay
  versión nueva publicada de la app y el *feature flag* sigue apagado.

---

## 1. Los ocho documentos

| # | Documento | Adjunto | Ruta en el repositorio | Bytes | SHA-256 |
|---|---|---|---|---|---|
| 1 | Acuerdo de uso **v1.3** (texto final armado) | `01-acuerdo-uso-v1.3.txt` | `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.3.txt` | 73 056 | `2f8884c36f7450728c452db9f7329e2eecd63874cc798405875911698e71a875` |
| 2 | **Anexo de Encargo** (matriz de finalidades + tabla de conservación) | `02-anexo-de-encargo.html` | `sgsst-electron-app/legal/anexo-encargo.html` | 85 947 | `8c54a8deb51f44a608cef769caa6121961da50dce66517fcfe2aab16aeecf6d7` |
| 3 | **Anexo de Nube** v1.0 (papel de Google, Circular, RNBD, ficha del canal) | `03-anexo-de-nube-v1.0.html` | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | 51 076 | `ad9ddcd45f20b80bdfb3a5026b60f15d29300c061ec3d342e3e82c94a0e5baa7` |
| 4 | **Constancia de aprobación** de la v1.3 | `04-constancia-de-aprobacion-v1.3.html` | `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html` | 10 800 | `0f015187ac501c71c98742c947fbfe9859d76520c37766fd9c0d93a6a83d3a00` |
| 5 | **Correspondencia texto ↔ código** de la v1.3 (generada, con la evidencia `archivo:línea` y el test que lo prueba) | `05-correspondencia-texto-codigo-v1.3.md` | `sgsst-electron-app/docs/gestion-humana/firma-electronica/correspondencia-texto-codigo-v1.3.md` | 10 341 | `53fba74027846865611a8c2e5693e21bb93522037fd6a879e4a1f76142a540b1` |
| 6 | **Auditoría del Capítulo V** — los dos hallazgos T1 y T2 (para el punto 5) | `06-auditoria-capitulo-v-t1-t2.md` | `sgsst-electron-app/docs/gestion-humana/firma-electronica/auditoria-capitulo-v-acuerdo-uso-2026-10-19.md` | 16 675 | `0b407184917b4da1bcd9f07e6b94e2afd27f4d037d1a426f37476a5f4361e654` |
| 7 | **Evaluación del canal de correo** — el papel del destinatario y el estado del RNBD | `07-evaluacion-canal-correo.md` | `sgsst-electron-app/docs/gestion-humana/firma-electronica/evaluacion-canal-correo-2026-10-27.md` | 16 949 | `3bb89a58f1756d37dc633a4a8a9084638f53c05d4505eb55f8b970f84cf1e1be` |
| 8 | **Su especificación del 30-oct-2026**, tal como se recibió | `08-especificacion-abogado-2026-10-30.md` | `sgsst-electron-app/docs/gestion-humana/firma-electronica/especificacion-abogado-2026-10-30.md` | 10 947 | `6e6d3f4a3aba229ab3b38d9e8a96f3ab6ae733b3dea518899d07fcd47ab0d47e` |

**Sobre el Acuerdo v1.3 (documento 1).** Se arma en dos pasos, ambos reproducibles:

```
node scripts/construir-acuerdo-v1.3.js        # deriva el JSON de cambios de la v1.3 del de la v1.2
node scripts/empalmar-acuerdo-v1.1.js \
  --version=v1.3 \
  --cambios=scripts/fixtures/acuerdo-v1.3-cambios.json \
  --datos=scripts/fixtures/acuerdo-v1.3-datos.json \
  --salida=scripts/fixtures/acuerdo-v1.3.txt
```

El primero aplica **solo** los deltas de su especificación sobre el JSON de la v1.2, de modo
que la diferencia entre las dos versiones queda escrita y no transcrita a mano. El segundo relee
la v1.0 sellada y sella el texto. **No tiene corchetes ni marcas de borrador**: el empalme se
niega a escribir si los encuentra. La fecha de vigencia **no** va llena: la fija el owner antes
de publicar, y así consta en el encabezado.

**Sobre el Anexo de Encargo (documento 2).** Su §2 trae la **matriz de finalidades** con Grupo
A y Grupo B, y su §8 trae la **tabla de conservación**. Las dos se generan desde una sola
fuente de configuración (§2.5), de modo que no pueden quedar desincronizadas.

**Sobre el Anexo de Nube (documento 3).** Cambió de fondo. Antes tenía **un** corchete de
fondo; ahora tiene **dieciséis**: doce con el texto `[PENDIENTE: el owner completa
con la evidencia]` (SMTP, MFA, plantilla del correo OTP, registro de envíos, incidentes y
revocación de credenciales), el de la determinación escrita del papel de Google validada por el
abogado, y tres del bloque de firma de la Empresa (nombre, NIT y representante legal), que se
llenan en cada firma. **Los corchetes son la lista de lo que falta, a la
vista.**

**Sobre la Constancia (documento 4).** Es el instrumento que separa aprobar el texto de
autorizar su publicación. Su campo de huella está vacío **a propósito**: se llena con la
autorización operativa del owner, no con la aprobación jurídica.

**Sobre la tabla de correspondencia (documento 5).** No es un escrito: la genera el script
`firma-service/scripts/correspondencia-texto-codigo.js`, que busca cada ancla en el código real
y pone la línea donde está. Si un ancla no aparece, la fila queda **PENDIENTE** a la vista: eso
es lo que el texto promete y el código todavía no cumple. Son **21 filas, 21 implementadas y 0 pendientes**.
Cubre **el repositorio**, no el
servidor desplegado.

---

## 2. Qué se hizo con su especificación

### 2.1 · T1 — El 5.1, con los tres deberes legales y los operativos adicionales

El 5.1 quedó separado en dos bloques. Los **tres deberes legales** son los del artículo
2.2.2.47.6 del Decreto 1074 de 2015, con la redacción que la auditoría del Capítulo V ya
había contrastado con la compilación oficial (adjunto 6):

- **a) Control y custodia** sobre los datos de creación de la firma.
- **b) Diligencia** para evitar la utilización no autorizada de esos datos. Este deber **no
  tenía literal propio** en la v1.2: es el hallazgo T1 de la auditoría.
- **c) Aviso oportuno a cualquier persona que posea, haya recibido o vaya a recibir**
  documentos o mensajes de datos firmados electrónicamente por el Firmante, con los criterios
  de «en entredicho» y la definición que da el parágrafo del artículo. El 5.1(c) de la v1.2
  decía solo «avisar de inmediato a la Empresa y a K+AIR», y eso dejaba fuera a las demás
  personas que reciben o van a recibir el documento firmado. **El aviso legal ya no está
  restringido a la Empresa y a K+AIR.**

Y en el bloque **«Adicionalmente»**, los deberes operativos de K+AIR:

- **d)** usar personalmente el enlace de acceso y el código OTP, sin compartirlos;
- **e)** informar oportunamente a la Empresa o a K+AIR por el canal de incidentes publicado en
  la pantalla de firma;
- **f)** el literal de las políticas de seguridad, que es el de T2 (§2.2).

**Lo que se conservó y por qué.** La primera mitad del 5.1(a) de la v1.2 —«cumplir las
condiciones de este Acuerdo y las instrucciones de seguridad que se le informen por escrito
antes de la firma»— no era el problema: el problema era la segunda mitad. Por eso el deber de
cumplir las condiciones de este Acuerdo y de la legislación aplicable **no se perdió**: quedó
como encabezado del bloque «Adicionalmente», y la parte que sí era un problema (obligar a
cumplir políticas internas que el Firmante nunca ve) pasó al literal f), acotado.

### 2.2 · T2 — Las políticas de seguridad solo obligan si se pudieron conocer

El literal f) lleva **su redacción literal**:

> Cumplir las políticas de seguridad que regulen directamente el uso del mecanismo de firma
> electrónica, siempre que hayan sido informadas de manera expresa al Firmante y puestas a su
> disposición como anexo de este Acuerdo o mediante un medio de consulta accesible antes de su
> aplicación. Estas políticas no podrán modificar unilateralmente las condiciones esenciales del
> mecanismo ni imponer obligaciones que no hayan sido comunicadas al Firmante.

Los tres criterios que puso —«se identifica la versión; se registra la fecha de disponibilidad;
se conserva evidencia de la versión aceptada»— se cumplen con el mecanismo de versionamiento
que **ya existía**, y no con una promesa nueva. Por eso la v1.3 añade el **numeral 5.6**,
que lo dice en el Acuerdo:

> Las políticas de seguridad que regulan el uso del mecanismo de firma electrónica son las que
> K+AIR informa expresamente al Firmante y le pone a su disposición antes de que resulten
> aplicables. La pantalla de firma muestra el texto íntegro de este Acuerdo junto con la
> versión de este Acuerdo, y la declaración de seguridad del medio por el que se recibe el
> código de verificación, con el texto que el servidor entrega para esa versión. Al aceptar, el
> sistema registra el texto aceptado, su huella digital SHA-256 y la fecha y hora, conforme al
> numeral 9.2. La versión de las políticas efectivamente aceptada queda así identificada, con
> la fecha en que se le pusieron a su disposición, y su evidencia se conserva. La publicación de
> una versión nueva de este Acuerdo no altera las aceptaciones ya registradas, que se rigen por
> la versión que el Firmante aceptó.

Esto es verificable en el código, no es una declaración: la pantalla de firma muestra la
versión del Acuerdo junto con el texto (`web/firma/app.js`), el sistema registra la aceptación
con el texto, su huella SHA-256 y la fecha y hora (`publicFlow.js`), y una versión nueva del
Acuerdo **no** mueve los consentimientos ya aceptados, porque cada uno conserva la huella del
texto que ese Firmante aceptó.

### 2.3 · D1 — Se acabó la retención indefinida

**Lo que cambió en el texto.** El 8.6(a) fija ahora el **orden de precedencia**:

1. las reglas legales especiales de los literales b) y c), que **no pueden rebajarse**;
2. la tabla de retención documental de la Empresa, que es la referencia vigente de esa Empresa
   y no se modifica por este Acuerdo;
3. a falta de plazo declarado por la Empresa, **la tabla supletoria de conservación que
   administra K+AIR**, que fija un plazo por defecto para cada categoría documental.

El 8.6(h) nuevo dice, en una línea: **«No hay retención indefinida.»** El 8.6(c), el 8.6(g),
el 3.6(g), el 10.4(a) y el 10.6 se ajustaron a la misma precedencia. En particular, el 3.6(g)
ya **no** promete que «el registro cuyo plazo de conservación no ha sido declarado por la
Empresa queda retenido por esa razón», porque ese mecanismo no existe.

**Los parámetros, que son la parte que le toca validar:**

| Categoría documental | Plazo por defecto | Punto de inicio | Fundamento |
|---|---|---|---|
| Documento original y firmado | diez (10) años | fecha de la firma | la finalidad del tratamiento |
| Constancia y manifestación de aceptación | igual al del documento asociado | fecha de la firma | la finalidad del tratamiento |
| Registro de operaciones y autenticación | cinco (5) años | fecha del registro | la finalidad del tratamiento |
| Solicitudes y comunicaciones operativas | cinco (5) años | fecha de la solicitud | la finalidad del tratamiento |
| Lápida y recibo de supresión | cinco (5) años | fecha de la supresión | la finalidad del tratamiento |
| Respaldos cifrados | treinta (30) días | fecha del respaldo | medida de seguridad; es copia de restauración, no archivo de custodia |
| Categorías SG-SST taxativas del 8.6(b) | veinte (20) años | **el cese de la relación laboral** | deber legal: artículo 2.2.4.6.13 del Decreto 1072 de 2015 |
| Contrato individual y sus anexos | sin término mientras subsista la relación laboral | — | deber legal: artículo 2.2.1.1.12 del Decreto 1072 de 2015 |

**Los diez (10) y los cinco (5) años no se activan en producción hasta que usted los valide.**
El mecanismo está construido y es verificable; lo que está pendiente es la decisión.

**Lo que NO se eliminó.** El piso de veinte (20) años del SG-SST, con su cómputo desde el
cese; el *hold* del contrato individual de trabajo mientras subsista la relación laboral; la
lápida y el recibo de la supresión; y la ventana de purga gobernada. Su instrucción «no
eliminar las excepciones legales» se cumplió literalmente.

**Lo que el código hace ahora.** Cada documento conserva **el plazo que le fue aplicado, con su
fuente y la fecha desde la que corre**. Modificar la tabla no recalcula nada histórico: un
recálculo exige una operación expresa, autorizada y auditada. Eso es su criterio de E2, y es
literalmente lo que hace.

**Una consecuencia operativa que debe mirar.** Con la v1.2, una Empresa que no declarara su
tabla de retención acumulaba registros como pendientes: nada de lo que esa Empresa firmaba se
supimía, y el sistema le iba reportando el pendiente. Con la v1.3 **eso desaparece**: toda
categoría tiene un plazo por defecto, y la Empresa que no declare uno ve cómo sus documentos
se suprimen al vencer ese plazo por defecto, no al indefinitely. Esto es lo que usted pidió, y
también es un cambio de comportamiento para el owner: **cada Empresa debería declarar su tabla
de retención documental**, aunque ya no sea necesaria para que algo se suprima.

### 2.4 · E1 — La matriz de finalidades, en Grupo A y Grupo B

El Anexo de Encargo §2 trae la matriz con los **nueve campos** que pidió: Identificador,
Descripción, Categorías de datos, Titulares involucrados, Base jurídica declarada,
Responsable que instruye, Plazo de conservación, Consecuencia de revocatoria o supresión y
Estado de habilitación.

- **Grupo A — siete finalidades (10.3(a) a 10.3(g))**: se ejecutan bajo las instrucciones
  documentadas del Responsable (la Empresa) y del contrato de encargo, con fundamento
  documentado.
- **Grupo B — una finalidad (10.3(h))**: *«Cumplir obligaciones legales, administrativas o
  judiciales que resulten aplicables»*. **No habilitada**, a la espera de que la Empresa
  entregue la información.

**Las reglas que se escribieron, textuales:** el Grupo A opera bajo instrucciones y contrato
con fundamento documentado; el Grupo B no se activa hasta que la Empresa entregue la
información; **la declaración de la Empresa no reemplaza la autorización cuando sea
necesaria**; y K+AIR no usa los datos para finalidades propias no documentadas ni
legitimadas. También quedó escrito que la Empresa puede consultar **cuáles están
habilitadas**.

**Lo que la matriz NO hace: inventar una base jurídica.** El 10.4(a) declara una base para una
finalidad; las demás se declaran como *«Instrucción documentada del Responsable (la Empresa) y
del contrato de encargo»* o como el deber legal que el propio Acuerdo invoca (conservar la
prueba de la aceptación, atender los derechos del Titular). **Donde no hay base declarada en los
documentos, la matriz lo dice y no la suple.** Si su criterio es que la matriz debe traer una
base concreta para las finalidades a), b), c) y e), dígalo y se completa con la que usted
indique.

### 2.5 · E2 — Una sola fuente de configuración

Hay **una** fuente: `firma-service/config/tabla-conservacion.json`. De ella salen, sin que
puedan quedar desincronizados:

1. el plazo por defecto que aplica el sistema cuando la Empresa no declara uno;
2. la tabla publicada del §8 del Anexo de Encargo;
3. la regla que se congela en cada firma.

La tabla del Anexo **se genera** desde esa fuente con un script idempotente: correrlo dos
veces produce el mismo archivo byte a byte. Cada categoría tiene su fundamento y su punto de
inicio; y el código registra el plazo aplicado, su fuente y la fecha de inicio en cada
documento, para que el sistema pueda demostrar **qué regla aplicó a cada documento** y no
recalcular historicos sin operación explícita, autorizada y auditada.

### 2.6 · N1 a N6 — El Anexo de Nube

**N1 · El papel de Google.** El Anexo documenta el uso real: una cuenta gratuita de Gmail
**para consumidores, operada por Google LLC**, desde la que el Encargado remite el OTP y el
enlace de firma. **No se afirma DPA empresarial, no se representa a Google como Encargado ni
como subencargado contractual, y no se declara contrato de transmisión.** Los datos que
efectivamente viajan por ese canal están listados y son solo esos: correo del destinatario,
información técnica del envío, el OTP y el enlace individual.

**Dos límites expresos** quedaron escritos: por OTP **no se envía ningún documento laboral
completo**, y el correo **no incluye documentos de identidad ni datos sensibles**. **Con una
excepción que le toca validar:** la copia del documento firmado *en papel*, con su registro de
firma autógrafa, sí viaja por correo con adjunto (`mailer.js`). Es el único flujo con adjunto,
y por eso la regla se escribió con esa excepción explícita en vez de ser falsa.

También quedó escrito que **el Encargado no controla la eliminación de las copias internas
del proveedor**, y que el remitente efectivo del enlace es la cuenta de la Empresa cuando esta
tiene una configurada, y la del Encargado cuando no.

**N2 · Ficha técnica del canal.** El §5 del Anexo trae la ficha con los ocho apartados que
pidió —SMTP, contraseña de aplicación, MFA, plantilla del correo OTP, contenido mínimo,
registro de errores y envíos, gestión de incidentes y procedimiento de revocación de
credenciales—. **Cada dato que el código permite verificar lleva el archivo y la línea**; el
resto es el marcador `[PENDIENTE: el owner completa con la evidencia]`. **Las credenciales no
van al documento ni al repositorio**, y no se pidieron.

**N3 · Circular 002 de 2025.** El Anexo cita la Circular Externa No. 002 del 7 de octubre de
2025 (DO 53.268 del 9 de octubre de 2025) y documenta la operación. **No se implementa ni se
declara comunicación previa a la SIC por usar Gmail.** La conclusión jurídica queda escrita
como *«Pendiente de revisión jurídica profesional»*.

**N4 · RNBD.** **No se declara inscrita ni exenta.** Quedó un checklist de cuatro puntos con
donde se comprueba cada uno —naturaleza jurídica, activos totales, obligación de inscripción y
estado del registro— y la frase de estado: *«Estado del registro en el RNBD: pendiente de
verificación por el owner.»*

**N5 · Contrato de transmisión y NCV.** **No se creó contrato de transmisión ficticio, no se
declaró NCV y no se declaró exención.** Quedó escrito: *«Si en el futuro se contrata un
servicio empresarial de correo con acuerdo de encargo, este Anexo se actualiza.»*

**N6 · Las tres preguntas.** Sus tres respuestas quedaron **incorporadas al Anexo de Nube**, y
así:

1. «Por la operación concreta, contrastada con los términos aplicables.»
2. «No por el simple uso de Gmail; debe verificarse si existe una operación específica
   comprendida en su ámbito.»
3. «Identificación de la operación, datos, finalidad, destinatario, país, fundamento
   aplicable y obligaciones de información y autorización.»

La tercera no quedó como una fórmula: el Anexo muestra **dónde se materializa cada elemento**
de esa identificación.

### 2.7 · Cuatro interpretaciones que declaramos, para que usted las corrija

1. **T2 entró como literal f)** del 5.1, dentro del bloque «Adicionalmente», porque el 5.1 de
   T1 solo tiene literales a) a e). Si prefiere que las políticas sean un numeral propio, se
   mueve sin cambiar el fondo.
2. **El mecanismo de T2 se apoya en el versionamiento que ya existía**, y por eso la v1.3
   añade un 5.6 que lo describe, en vez de prometer un versioning que el código no tiene.
3. **Los parámetros numéricos viven en una sola fuente**, y el Acuerdo enuncia la regla y el
   orden de precedencia en vez de duplicar los números. Si prefiere que el Acuerdo los
   reproduzca, se añade.
4. **D1 no eliminó el 8.6(b)**: el piso de veinte (20) años del SG-SST se conserva como plazo
   legal no rebajable, y el 8.6(c) mantiene el *hold* del contrato individual mientras subsista
   la relación laboral.

---

## 3. Los puntos que le quedan

| # | Punto | Dónde | Qué se le pide |
|---|---|---|---|
| 1 | Texto de la v1.3 | documento 1 | Aprobar o corregir, contra la huella `2f8884c3…a875` |
| 2 | Anexo de Encargo | documento 2 | Aprobar o corregir, incluida la matriz (§2) y la tabla (§8) |
| 3 | Parámetros de la tabla supletoria | §2.3 de esta nota | Validar los diez (10) y cinco (5) años, o fijar otros |
| 4 | Papel de Google, Circular y RNBD | documento 3 | Determinar por escrito el papel; revisar las dos conclusiones dejadas pendientes |
| 5 | Las tres preguntas | §4 de esta nota | Responder lo que falta, y validar las respuestas ya incorporadas |

---

## 4. Las tres preguntas: lo que ya está y lo que falta

1. **¿El rol del destinatario debe determinarse desde los términos del proveedor o desde la
   operación concreta?** → **Ya incorporada al Anexo de Nube:** «Por la operación concreta,
   contrastada con los términos aplicables.» Se le pide que la valide.
2. **¿La Circular 2 de 2025 exige comunicación previa a la Delegatura en este caso, o basta la
   declaración en el RNBD?** → **Parcialmente incorporada:** el Anexo documenta la operación y
   deja la conclusión jurídica para revisión profesional; la parte del RNBD queda pendiente de
   la verificación del owner (naturaleza jurídica, activos totales y estado del registro). **Le
   toca decidir a usted.**
3. **Con la salida B (documentar la transferencia sin cambiar de proveedor), ¿qué redacción del
   Anexo de Encargo deja la base de la transferencia declarada de forma que usted pueda
   considerarla suficiente?** → **Incorporada:** el Anexo de Nube documenta la operación, los
   datos, la finalidad y el papel del proveedor **sin** declarar DPA, subencargo contractual,
   contrato de transmisión ni NCV, y deja por escrito que el Anexo se actualiza si más adelante
   se contrata un servicio empresarial con acuerdo de encargo.

---

## 5. Lo que NO va en este paquete

- **La constancia técnica: dos cosas distintas.** El adjunto 5 es la evidencia contra el
  **código del repositorio**: cada numeral del Acuerdo con el archivo y la línea que lo
  implementa y el test que lo prueba, con las filas que el código todavía no cumple marcadas
  como PENDIENTES a la vista. Lo que **no se puede enviar todavía es la misma constancia contra
  el servidor desplegado**: desde este equipo no hay acceso SSH y el endpoint `/health`, que sí
  responde, no anuncia versión ni migraciones aplicadas, así que el estado del servidor no se
  pudo verificar. Declarar los controles contra un servidor sin verificar sería prometer lo que
  el servidor no hace.

- **La activación en producción de los plazos de diez (10) y cinco (5) años.** El mecanismo
  existe; la decisión de activarlos es suya (§2.3).

- **La evidencia de la ficha técnica del canal (SMTP, MFA, plantilla, registros, incidentes,
  revocación).** La trae el owner; no se pide ni se publica aquí.

- **La autorización operativa de publicación.** Es del owner y se registra con la huella del
  texto aprobado, después de su aprobación. El abogado aprueba el texto; publicar es otra
  decisión, de otra persona, y en otro momento.

---

## 6. Formato de la respuesta

Conteste numerado, como en la respuesta 11A. Para aprobar basta con:

> «Apruebo la v1.3 con la huella `2f8884c3…a875` y el Anexo de Encargo con la huella
> `8c54a8de…f6d7`»».

La huella va para que quede probado sobre qué texto exacto se aprobó.

---

### Control de integridad

`SHA256SUMS.txt` lista la huella de los ocho adjuntos. Si el hash de un archivo que le llegó
no coincide con el de esta nota, **dígalo antes de responder**: la respuesta va contra el texto
que se le mandó, no contra «el texto del Acuerdo».
