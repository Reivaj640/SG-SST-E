# Paquete para el abogado — 27 de octubre de 2026 (ronda 2)

> Documento de cierre de la **Solicitud 11A** (respondida el 23-oct-2026) y de la **Solicitud 11B**
> (abierta el 27-oct-2026 y **respondida el mismo día**).
>
> Para: asesoría legal laboral y de protección de datos. De: owner y equipo de K+AIR
> (Gesstiar S.A.S.). Fecha: 27 de octubre de 2026.

---

## 0. En una página

**Qué se le manda:** cuatro documentos —la v1.1 armada, el Anexo de Encargo, el Anexo de Nube y la
Constancia de aprobación— y esta nota. Todo verificado con hash (`SHA256SUMS.txt`).

**Dónde estamos.** El 23 de octubre usted respondió la Solicitud 11A con los doce grupos de
numerales de la v1.1 y el dictamen del Anexo de Nube. Ese texto está empalmado, sin reescribirlo.
Después, dos cosas: la **primera firma real** ocurrió (26-oct, piloto del D-03) y el owner decidió
**mantener la cuenta gratuita de Gmail**, de modo que los documentos se alinearon con la
operación real en vez de prometer un acuerdo empresarial de tratamiento con Google que no está
acreditado. Eso dejó una pregunta abierta sobre el 3.4(e), la del medio personal del código, y el
27-oct se le mandaron **seis preguntas (1.a a 1.f)**. **Sus seis respuestas ya están aplicadas**, al
código y a los tres documentos, y esta nota le enseña exactamente dónde.

**Qué se le pide ahora, tres cosas:**

1. **Aprobar (o corregir) el texto de la v1.1** con sus seis decisiones incorporadas: el 3.1, el
   3.3, el 3.4(b), el 3.4(e), el 3.4(g), el 3.7(a), el 8.7, el 10.1 y el 10.5(f) cambiaron.
2. **Revisar el Anexo de Encargo** (versión 2026-10-27-b), que se reescribió en sus §2 a §8.
3. **Confirmar que la separación entre aprobación jurídica y autorización operativa** (su decisión
   1.f) quedó como usted lo pidió, incluida la Constancia de aprobación (documento 4).

**Un aviso que va contra una idea que usamos antes, y es importante que lo sepa:** su 1.b —«la
Empresa es quien realiza el envío, con sus propios correos; K+AIR es el puente»— se implementó
**hasta el final, y el código de verificación (OTP) quedó exceptuado**. El enlace de acceso y el
aviso de la firma los remite la Empresa desde su propia cuenta; el **OTP sale siempre desde la
cuenta de K+AIR**. La razón está en el §3.1 de esta nota, y es la razón por la que su 1.b no se
aplicó literal. Si usted prefiere que el OTP salga también por la cuenta de la Empresa, dígalo:
se cambia, pero hay que revisar la garantía central del servicio.

**Lo que ya no necesita hacer:** el código del 8.6 (20 años), el del 10.4 (migración a la versión
vigente) y el del D-03 (bloqueo auditable) están implementados y probados en producción (§4).

---

## 1. Los cuatro documentos

Se le mandan **copias**, con el mismo contenido y el mismo hash que los que tienen en el sistema.

| # | Documento | Adjunto | Ruta en el repositorio | Bytes | SHA-256 |
|---|---|---|---|---|---|
| 1 | Acuerdo de uso **v1.1** (texto final armado) | `01-acuerdo-uso-v1.1.txt` | `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.1.txt` | 57 187 | `09d69065b60000bb215be8f28fd67d0fb6fad7d32cb5a8e9c3afb45d817123d2` |
| 2 | **Anexo de Encargo** (versión 2026-10-27-b) | `02-anexo-de-encargo.html` | `sgsst-electron-app/legal/anexo-encargo.html` | 35 273 | `6831f53a03b9c2dd334ab16c022e942dfd09d1f2faee86d1f556fdf5ae825ab6` |
| 3 | **Anexo de Nube** v1.0 | `03-anexo-de-nube-v1.0.html` | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | 21 961 | `b8de57852a214b98c35ae3ace4ae7af31171636e105189ef4fef08a81a2e8d77` |
| 4 | **Constancia de aprobación** (nuevo) | `04-constancia-de-aprobacion.html` | `sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html` | 9 827 | `70e32fe7a109fe895adba04bed2f79bb3b7272caddbc1fb76a50027394cbc432` |

**Sobre la v1.1 (documento 1).** El texto sigue siendo **el suyo**: los doce grupos de numerales de
la sección 2 de su respuesta 11A, copiados íntegros y empalmados sobre la v1.0 sellada por un script
reproducible (`scripts/empalmar-acuerdo-v1.1.js`) que **no reescribe, no parafrasea y no reordena**
nada. La v1.0 sellada no se tocó. Lo que cambió desde la versión que le enviamos el 27-oct son
**nueve numerales** (antes eran seis), y el detalle está en el §2.

**Sobre el Anexo de Encargo (documento 2).** Se reescribieron sus §2 a §8. Conserva la marca de
**«Revisión profesional pendiente»**: la marca no se quita sola, la quita su revisión (§5.2).

**Sobre el Anexo de Nube (documento 3).** Cambió su §3 (el canal de correo) y la tabla de
proveedores. Le quedan **cuatro** corchetes: **uno** de la condición contractual de Gmail (que no
podemos llenar nosotros: depende de su concepto) y **tres** del bloque de firma de la Empresa (que se
llenan en cada firma).

**Sobre la Constancia de aprobación (documento 4).** Es el instrumento nuevo de su decisión 1.f:
lleva **su texto íntegro** y, además, la garantía técnica definida de forma verificable —qué
protege, cómo se comprueba, qué bloquea la publicación y qué ocurre si deja de cumplirse—. Se
p-publica en el sitio. **Todavía no está firmada**: es la constancia que el owner firma cuando usted
apruebe el texto.

---

## 2. Sus seis decisiones y dónde quedaron aplicadas

| Decisión | Qué pidió | Dónde quedó | En el código |
|---|---|---|---|
| **1.a** | El flujo de la Empresa que obtiene el correo del candidato verbalmente en la contratación | v1.1: **3.1** (el método y el origen de la dirección), **3.3** (a dónde va el OTP), **3.4(e)** (el control del dominio corporativo) y **3.7(a)** (la declaración del Firmante). Anexo de Encargo: §2, §3 y §6 | La mini-app muestra la dirección que registró la Empresa y el Trabajador la **confirma** con una declaración de texto fijo; el servidor **exige** esa confirmación (422 `MEDIO_OTP_CONFIRMACION_REQUERIDA`) y la archiva con fecha, hora, dirección y versión del texto. El medio tiene **tres orígenes** (`TRABAJADOR`, `TRABAJADOR_CONFIRMADO`, `EMPRESA`) |
| **1.b** | La Empresa es quien remite, con sus propios correos; K+AIR es el puente | v1.1: **3.1** y **3.4(b)**. Anexo de Encargo: §2, §3, §4, §5 (fila del proveedor de la Empresa) y §6 | La Empresa registra su cuenta de envío (cifrada con la llave maestra, con rastro de cada cambio y revocable). El enlace, el aviso y la copia en papel salen por esa cuenta; si no hay cuenta configurada, salen de la de K+AIR. **El OTP nunca sale por la cuenta de la Empresa** (§3.1) |
| **1.c** | Aceptación por versión, sin actualización retroactiva, con la aceptación previa y su huella conservadas, y versiones inmutables | v1.1: **3.4(g)** | El sistema ya registraba la aceptación con versión, huella SHA-256 y fecha; lo nuevo es que el texto lo dice y que el sistema **no puede publicar** una versión nueva sin autorización operativa (§2) |
| **1.d** | El 8.7: Google vuelve a declararse como proveedor que interviene en el envío, se dice qué datos pasan, los plazos de conservación se separan y no se inventa un plazo para Google | v1.1: **8.7**. Anexo de Encargo: §8 (mismo texto, adaptado) | Sin cambios de código: describe el envío real |
| **1.e** | El 10.1 y el 10.5(f) reformulados, con las obligaciones propias de Gesstiar y sin atribuir plazos a Google | v1.1: **10.1** y **10.5(f)**. Anexo de Encargo: §5 | El correo post-firma ya no transporta el documento (§4.6): el "(ii) evitar incluir documentos firmados" del 10.5(f) es cierto |
| **1.f** | Aprobar el texto y autorizar a publicar son dos decisiones distintas, con la publicación condicionada a una garantía técnica verificable | v1.1: **3.1 a 3.7** (remisiones). Documento nuevo: **Constancia de aprobación** | `agreement.createVersion` con `activa: true` devuelve **409** si no hay autorización operativa registrada para esa versión **y ese texto**; la autorización se registra en una tabla append-only con versión, huella, garantía, resultado de verificaciones, responsable y fecha; el gate legal tiene un ítem propio que mira la versión en vigor |

---

## 3. Los tres puntos en que no hicimos exactamente lo que decía el texto propuesto

Se los decimos de entrada, con el motivo, para que no los encuentre de sorpresa.

### 3.1 · El OTP sale siempre desde la cuenta de K+AIR (la excepción a su 1.b)

Su 1.b, aplicada al pie de la letra, pondría el **código de verificación** en la cuenta de la
Empresa. No lo hicimos, por una razón que el propio marco legal que usted ha usado en las respuestas
anteriores impone: el OTP es el **dato de creación** de la firma, y el artículo 2.2.2.47.4 núm. 1
del Decreto 1074 de 2015 exige que ese dato, en el contexto en que se usa, **corresponda
exclusivamente al firmante**. Si la Empresa remitiera el código, la Empresa custodiaría el dato de
creación, y el 3.7(a) —que el Firmante declara que ese buzón no lo administra la Empresa— sería
falso.

El reparto que quedó, y que **aprovecha** la separación de canales:

- el **enlace de acceso** lo remite la Empresa, desde su cuenta (quien lo remite lo conoce, pero no
  es el dato de creación y no habilita la firma: el 3.4(b) lo dice);
- el **código** lo remite K+AIR, al medio personal que el Firmante confirmó;
- cuando la Empresa no ha configurado cuenta, los dos salen de la cuenta de K+AIR y llegan al mismo
  buzón, y entonces **no son dos factores independientes**: así lo dicen el 3.1 y el Anexo de Nube §3.

Es decir: la 1.b se aplicó completa, y la única excepción es la que protege el dato de creación.

### 3.2 · El 10.5(f)(iv) se escribió como lo que el código hace

Su texto proponía «revisar y corregir las direcciones de destinatario cuando se detecten errores». El
sistema **rechaza** las direcciones que no superen la validación al crear la solicitud; no las
corrige. El numeral quedó como «verificar la forma de las direcciones de destino en el momento de
crear la solicitud y no remitir a direcciones que no superen esa verificación». Es la regla de no
prometer controles que no existen, que es la que hemos seguido en todo el paquete.

### 3.3 · El 10.1 conserva dos cosas que su texto propuesto no mencionaba

Su 10.1 propuesto se adoptó como núcleo. Pero el 10.1 que estaba en la v1.1 tenía además el párrafo
de **infraestructura** (que incorpora el Anexo de Nube por referencia) y la **declaración de la
condición contractual con sus dos salidas** (migrar a una cuenta con DPA, o la autorización expresa
y separable del Titular). Su texto no los menciona, y sin ellos el Acuerdo dejaría de incorporar el
Anexo de Nube y de declarar la condición que sigue abierta. Se conservaron los dos.

---

## 4. Lo que cambió desde su respuesta del 23 de octubre (todo verificado)

### 4.1 · La primera firma real ya ocurrió — como piloto del D-03

**26-oct-2026, 16:10:16 hora Colombia.** Solicitud `SIGN-2026-927141`, estado `SIGNED`:

| Dato | Valor |
|---|---|
| Firmada | `2026-10-26T21:10:16.268Z` (16:10:16 Colombia) |
| Identificación | `CC`, coincidencia de huella: sí |
| Canal de verificación | correo electrónico |
| Acuerdo aceptado | consentimiento `3` (v1.0, la que usted selló) |
| Hash del documento original | `b7d6f08ac783f9404a6ceec32635c86847c09a7fb95297b053f20c6129aa782a` |
| Hash del documento firmado | `188bf0651dab3d4eba257f477b2f2a7f08f159287f3f0bba6e55e7eb1d5fd6be` |
| Hash de la evidencia | `8db98db0e5ec9dfc0f82e3b3a41b72698145d028709c30c5b83adf3a799cbe10` |
| Hash de la manifestación | `2b1ba3d3a311c2c7e253d134c549d38507d649ba0fd116e114153171cf8381b0` |

Los tres archivos en disco dan **exactamente** esos hashes. La bitácora tiene la cadena completa
(14 eventos) y el `CONSENT_ACCEPTED` es **anterior** al `MANIFESTATION_RECORDED`. Esta firma se
hizo bajo el **Acuerdo v1.0**, porque la v1.1 todavía no está publicada.

### 4.2 · El D-03 (su decisión B.3) está implementado y probado en la vida real

Se bloquea la creación de la solicitud, el commit, la creación del consentimiento y la doble firma.
La excepción es **un flag auditable**, no un `if` silencioso, con sus seis condiciones: autorización
escrita del owner con fecha y referencia, alcance de una Empresa y un número máximo de firmas, ruta
en papel declarada y operativa el mismo día, plazo con fecha cierta (máximo 30 días), rastro en
bitácora **append-only** con trigger de no modificación, y límite de piloto autorizado. El piloto
usó una excepción real y su bitácora registra la creación, cada uso y el **cierre con el motivo
verdadero**.

### 4.3 · El 8.6 (su decisión A.1) está en el código y en el Anexo de Nube

`ANIOS_CUSTODIA` de 80 a 20, hold sin término para el contrato, piso de 20 años del 2.2.4.6.13 con
sus cinco categorías, supresión solo si concurren las cuatro condiciones, copia al Trabajador sin
costo. Los tres campos del manifiesto que estaban en `null` ya no lo están, con evidencia del
servidor: **RTO 4 horas, RPO 24 horas**; respaldo diario a las 22:00 hora Colombia con retención de
30 días e `integrity_check` **sobre la copia**; prueba de restauración mensual verificada; detector
de caídas cada 5 minutos. El Anexo de Nube dice la verdad, y también lo que **no** tiene: los
respaldos **no están cifrados**, el **cifrado en reposo del disco no está confirmado**, la copia vive
**en el mismo servidor** que los datos y el detector de caídas **no avisa a ninguna persona**.

### 4.4 · El D-02: el inventario de buzones dio cero

El inventario de los casos en que el OTP cae en un buzón corporativo dio **0 casos**. El flag
`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` **sigue apagado** y no se enciende hasta que la v1.1 esté
publicada, la 9A y la 10.4 probadas y el Anexo de Nube firmado.

### 4.5 · El OTP: qué cambió con su 1.a

En la firma piloto del 26-oct, el código llegó al correo que el firmante declaró en la pantalla de
firma. Con su 1.a, el camino normal es otro: la **Empresa** registra el medio personal (lo obtiene
del candidato en la contratación) y el **Trabajador lo confirma** en la pantalla de firma, con una
declaración fija que se archiva con su fecha, su hora y la versión del texto. La declaración la
exige el servidor, no el navegador.

Lo que **no** cambió: el rechazo del buzón corporativo (el 400 que impide que la Empresa lea el
código) sigue **apagado** (`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP = false`), porque sin la firma en papel
de la 9A encenderlo sería una barrera de acceso al empleo. Y si no hay medio personal confirmado,
el código va al contacto registrado por la Empresa y **el caso queda registrado como advertencia**.

### 4.6 · El correo post-firma ya no transporta el documento

Para que «el uso de Gmail quede limitado a las notificaciones necesarias» sea cierto, el correo
tenía que dejar de llevar el documento. **Antes** adjuntaba el PDF firmado y la Constancia; **ahora**
es un aviso con el enlace, y ambos se descargan desde la aplicación. Se creó además un endpoint
público de la Constancia. **La excepción, y su razón:** el flujo **en papel** conserva los adjuntos,
porque en ese flujo el enlace no sirve nada y sin adjunto el firmante se quedaría sin su copia.

### 4.7 · El estado medido del gate

El readiness legal corre en el servidor y da **40 ítems: 27 OK · 10 pendientes · 1 aviso · 2 N/A**.
Los 10 pendientes: la v1.1 activa en la base, **la autorización operativa de la versión vigente**
(el ítem nuevo de su 1.f), las pruebas reales de la 9A y la 10.4, el flag del D-02, tres del Anexo
de Nube (el modelo diligenciado, la firma por Empresa y el DPA de Google) y dos del Anexo de Encargo
(el estado real y la marca de revisión pendiente).

---

## 5. Qué desbloquea cada respuesta

| Su respuesta | Qué cae en el manifiesto | Bloqueantes que se van |
|---|---|---|
| 5.1 — aprueba (o corrige) el texto de la v1.1 | `acuerdo_v1_1` | **2** |
| 5.2 — aprueba el Anexo de Encargo | `anexo_encargo` (la marca de revisión) | **1** |
| 5.3 — concepto sobre la estructura del canal de correo | `anexo_nube` (ítems de Google) | **2** |
| Con la v1.1 publicada y autorizada | `n10_4` (migración a la versión vigente) | **1** |
| La 9A probada en papel | `n9a` (prueba de medios autorizados) | **1** |
| El Anexo de Nube firmado por cada Empresa | `anexo_nube` (firma por Empresa) | **1** |
| El D-02 encendido | `d02` (flag) | **1** |

**Una precisión sobre la 5.1:** aprobar el texto **no** publica la v1.1. La publicación exige la
**autorización operativa**, que es del owner y que se registra en el sistema con la huella del texto
aprobado. Esa es exactamente la separación que usted pidió en su 1.f, y por eso el documento 4
existe.

### 5.2 · El Anexo de Encargo: las cuatro cosas que su propia marca señala

1. **El tratamiento de los datos sensibles de salud** (el alcance y las clausuras, dada la lectura
   corregida del 2.2.4.6.13).
2. **El envío del enlace de acceso y del código OTP.** Con su 1.a y 1.b, el enlace lo remite la
   Empresa desde su cuenta (o desde la de K+AIR si no tiene ninguna) y el código lo remite K+AIR al
   medio personal que el Firmante confirmó, con la declaración archivada. El medio ya no es
   opcional en el sentido que se le temía: si hay medio registrado, la confirmación es obligatoria.
3. **El plazo de atención de dos (2) días hábiles** de las peticiones, quejas y reclamos.
4. **La devolución de los datos** al terminar el encargo.

### 5.3 · El canal de correo: lo que sigue abierto

**El hecho, verificado en la fuente oficial de Google** (`support.google.com/policies/answer/9581826`):
*"Google doesn't offer a Data Processing Agreement for the consumer versions of Gmail or Drive.
Google does not act as a data processor for the consumer version of these services."* Para
Workspace y Cloud sí hay un anexo de tratamiento de datos.

Lo que ya se hizo, sin esperar su concepto, porque es lo que exige la regla de no afirmar lo no
implementado: el **Anexo de Nube** describe a Google como **proveedor externo del servicio de
correo** y dice que **no** hay DPA empresarial aplicable; el **Anexo de Encargo** **no borró** la
cláusula que exige contrato o DPA a los proveedores que reciben datos personales, la conservó y
declaró que **hoy no está satisfecha**; y el **Acuerdo v1.1** (10.1 y 10.5(f)) dice lo mismo con su
propia fórmula, con las dos salidas.

Lo que le pedimos, entonces, no es un dato de un DPA que no existe, sino su concepto sobre la
estructura:

1. **¿Es suficiente que los tres documentos declaren la condición y la dejen abierta**, o el
   servicio no debería ofrecerse a nuevas Empresas hasta que se resuelva?
2. **Si la primera, ¿cuál de las dos salidas sostenemos?** La de un proveedor con DPA (migrar el
   envío) o la de la autorización expresa del Titular. Y si es esta última, **¿el Anexo de Encargo
   y la autorización del trabajador bastan, o hace falta un instrumento aparte**?
3. **El flujo de correo es una transferencia internacional** en los términos del artículo 26 de la
   Ley 1581: sale del país la dirección del firmante, el contenido del mensaje con el enlace y el
   OTP, y los metadatos del envío. **¿Qué base jurídica concreta recomienda**, y qué redacción
   necesita el Anexo de Encargo para declararla?
4. **¿Conviene que el Anexo de Nube siga siendo un documento que no se firma hasta que la condición
   se resuelva**, o que se firme con la condición declarada y sea la empresa cliente la que decide
   si lo acepta? Hoy está en la primera postura.

---

## 6. Lo que NO se le pide

- **No** le pedimos un DPA de Google que no existe, ni que se sustituya por una cláusula propia que
  diga lo mismo.
- **No** le pedimos un "sigue vigente" sobre las decisiones del 23-oct: si algo cambió en su
  criterio, dígalo y lo ajustamos antes de publicar.
- **No** le pedimos la autorización operativa: esa es del owner, y es lo que la Constancia de
  aprobación va a dejar por escrito.

---

## 7. Formato de la respuesta

Conteste numerado, como en su respuesta 11A, y devuelva **el mismo archivo `01-acuerdo-uso-v1.1.txt`**
con los numerales corregidos, o una lista de numerales con el texto nuevo. Si aprueba el texto tal
como está, basta con **«Apruebo la v1.1 con la huella `09d69065…123d2`»** y su firma: la huella va
para que quede probado sobre qué texto exacto se aprobó.

| # | Qué se le pide | Dónde |
|---|---|---|
| 5.1 | Aprobar o corregir el texto de la v1.1 con sus seis decisiones incorporadas | documento 1 |
| 5.2 | Aprobar o corregir el Anexo de Encargo (versión 2026-10-27-b) | documento 2 |
| 5.3 | Concepto sobre la estructura del canal de correo (las cuatro preguntas) | documentos 2 y 3 |
| 5.4 | Confirmar que la separación entre aprobación jurídica y autorización operativa quedó como usted la pidió | documento 4 |

---

### Control de integridad

`SHA256SUMS.txt` lista la huella de los cuatro adjuntos. Si el hash de un archivo que le llegó no
coincide con el del sistema, **dígalo antes de responder**: la respuesta va contra el texto que se le
mandó, no contra «el texto del Anexo de Encargo».
