# Paquete para el abogado — 27 de octubre de 2026

> Documento de cierre de la **Solicitud 11A** (respondida el 23-oct-2026) y de apertura de la
> **Solicitud 11B**, actualizado tras el cambio de enfoque sobre el proveedor de correo.
>
> Para: asesoría legal laboral y de protección de datos. De: owner y equipo de K+AIR
> (Gesstiar S.A.S.). Fecha: 27 de octubre de 2026.

---

## 0. En una página

**Qué se le manda:** tres documentos (la v1.1 armada, el Anexo de Encargo y el Anexo de Nube) y
esta nota. Todo está verificado con hash.

**Qué cambió respecto del paquete del 26 de octubre:** el owner decidió **mantener la cuenta
gratuita de Gmail** y, en vez de prometer un acuerdo empresarial de tratamiento con Google que no
está acreditado, **alinear los documentos con la operación real**. Los tres documentos ya no
prometen un DPA que no existe: describen la situación tal como es, con sus límites, y dejan la
**condición contractual de Gmail abierta** y sometida a su concepto.

**Por qué importa:** con una cuenta de consumidor, Google **no ofrece un acuerdo de
tratamiento de datos** y **no actúa como encargado** del tratamiento. Por eso el flujo de correo
no se documenta como transmisión a un Encargado sino como el tratamiento de un **proveedor
externo**, y por eso la pregunta que le hacemos (§2.3) cambió de "¿qué proveedor compramos?" a
"¿esta estructura contractual es la adecuada, y qué se necesita para sostenerla?".

**Qué se le pide:** cuatro cosas, numeradas como su respuesta 11A, para que pueda contestarlas en
el mismo formato (§2 de esta nota).

**Lo que ya no necesita hacer:** el código del 8.6 (20 años), el del 10.4 (migración a la versión
vigente) y el del D-03 (bloqueo auditable) están implementados y probados en producción (§3).

---

## 1. Los tres documentos

Se le mandan **copias** de los tres documentos, con el mismo contenido y el mismo hash que los que
tienen en el sistema (el archivo `SHA256SUMS.txt` de este paquete lo permite verificar). La ruta de
cada uno en el repositorio se da para que pueda rastrear de dónde sale.

| # | Documento | Adjunto | Ruta en el repositorio | Bytes | SHA-256 |
|---|---|---|---|---|---|
| 1 | Acuerdo de uso **v1.1** (texto final armado) | `01-acuerdo-uso-v1.1.txt` | `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.1.txt` | 46 579 | `9b5779989e98628f0f960a6eefea2f787addab52ea807d463e88ce3ca2f326e7` |
| 2 | **Anexo de Encargo** (a la espera de su revisión) | `02-anexo-de-encargo.html` | `sgsst-electron-app/legal/anexo-encargo.html` | 28 702 | `8ae584c000bdd7b8b6c5651667056fa09308c533303e2843321400f0136f3052` |
| 3 | **Anexo de Nube** v1.0 (el que reemplaza al anterior) | `03-anexo-de-nube-v1.0.html` | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | 20 029 | `570bca4c269697818a65bc86a1be722fc44c0dd8badc71a54dd734cb444f62ce` |

**Sobre la v1.1 (documento 1).** El texto sigue siendo **el suyo**: los doce grupos de numerales
de la sección 2 de su respuesta, copiados íntegros y empalmados sobre la v1.0 sellada por un script
reproducible (`scripts/empalmar-acuerdo-v1.1.js`), que **no reescribe, no parafrasea y no reordena**
nada: solo cambia de sitio bloques de texto que ya venían escritos. La v1.0 sellada no se tocó.

**Lo que cambió en esta versión** son seis numerales, todos por el mismo motivo: describir el canal
de correo como es y no como se suppose que debería ser.

| Numeral | Antes | Ahora |
|---|---|---|
| 3.1 | El enlace lo remite la Empresa | **Lo remite K+AIR**, desde su propia cuenta; el enlace y el OTP **no son dos factores independientes** porque llegan al mismo buzón |
| 3.4(b) | (no existía) | **Nuevo**: K+AIR crea la solicitud y envía el enlace al correo registrado del Trabajador |
| 3.4(e) | OTP al medio personal | El OTP sale por **la misma cuenta remitente**; conserva 600 s y cinco intentos, ahora "contados desde su envío" |
| 8.7 | Listaba a Google entre los subencargados | Ya **no lo lista**: con cuenta de consumo no lo es |
| 10.1 | Google como subencargado con DPA | Google como **proveedor de correo**, con la **condición real** declarada y sus dos salidas |
| 10.5(f) | "No se les transmiten datos personales" | Se elimina la frase: **sí viaja información**, y se describe qué y por qué canal |

El texto no tiene ni un hueco: el único corchete que queda —`[registrada por el sistema]`— no es
un hueco, es el campo que el sistema llena al aceptar el Acuerdo.

**Sobre el Anexo de Encargo (documento 2).** El texto está completo (cero placeholders) y conserva
la marca de **«Revisión profesional pendiente»**. La marca no se quita sola: el sistema la trata
como un bloqueante de la publicación, y solo se quita cuando usted revisa el documento. Abajo (§2.2)
le copiamos **las cuatro cosas que la propia marca señala** como sujetas a revisión, para que
pueda responder sobre ellas sin releer todo.

**Sobre el Anexo de Nube (documento 3).** Es el que usted dictó en el §3 de su respuesta, con los
datos reales del servidor puestos en los corchetes que dejó. Le quedan **cuatro** corchetes: **uno**
de la condición contractual de Gmail (que no podemos llenar nosotros: depende de su concepto) y
**tres** del bloque de firma de la Empresa (que se llenan en cada firma).

**Sobre lo que este documento ya no dice.** La versión anteriorfilled tres corchetes con datos del
DPA de Google que no existen. Se eliminaron, y en su lugar el documento dice la verdad: **no hay un
DPA empresarial aplicable a esta cuenta**, y esa es una condición pendiente, no un dato por
diligenciar.

---

## 2. Lo que se le pide

### 2.1 · La v1.1 (punto 12) — ¿aprueba el texto final?

El texto es el suyo, empalmado sin reescribirlo, con los seis numerales de la tabla de arriba
ajustados al canal de correo real. Necesitamos una de dos:

- **«Apruebo la v1.1 tal como está»**, con su firma; o
- la lista de numerales que quiere cambiar, para volver a empalmar.

Al aprobarla se publica como versión vigente y se habilita la migración de las solicitudes
existentes a esa versión (§4).

### 2.2 · El Anexo de Encargo (punto 11) — ¿lo aprueba?

La marca de revisión pendiente señala textualmente cuatro cosas. Sobre cada una, una línea:

1. **El tratamiento de los datos sensibles de salud.** (¿El alcance y las clausuras son los que
   usted quiere, dada la lectura corregida del 2.2.4.6.13?)
2. **El envío del enlace de acceso al contacto de la Empresa y del código OTP al medio personal
   del Titular.** (Verificado en producción: el OTP va al correo que el firmante declara en la
   pantalla de firma, no al buzón de la Empresa. §3.5.)
3. **El plazo de atención de dos (2) días hábiles de las peticiones, quejas y reclamos.**
4. **La devolución de los datos al terminar el encargo.**

Si lo aprueba, quitamos la marca y el anexo queda operativo. Si algo debe cambiar, dígalo y lo
corregimos en el texto, no en el sistema.

### 2.3 · El canal de correo — la pregunta que cambió de forma

**El hecho, verificado en la fuente oficial de Google** (`support.google.com/policies/answer/9581826`):
*"Google doesn't offer a Data Processing Agreement for the consumer versions of Gmail or Drive.
Google does not act as a data processor for the consumer version of these services."* Para
Workspace y Cloud sí hay un anexo de tratamiento de datos.

**Lo que ya hicimos, sin esperar su concepto**, porque es lo que exige la regla de no afirmar lo
no implementado:

- El **Anexo de Nube** describe a Google como **proveedor externo del servicio de correo**, dice
  explícitamente que **no** hay DPA empresarial aplicable a esta cuenta, y mantiene la cláusula
  de devolución, supresión y auditoría marcada como **no exigible** frente a Google (no hay
  contrato que las imponga).
- El **Anexo de Encargo** **no borró** la cláusula que exige contrato o DPA a los proveedores que
  reciben datos personales: la conservó y declaró que **hoy no está satisfecha** por la condición
  de la cuenta de Gmail. Se añadió que la aceptación del anexo por la empresa cliente **no
  constituye por sí sola** la solución del requisito contractual de transmisión.
- El **Acuerdo v1.1** (10.1 y 10.5(f)) dice lo mismo con su propia fórmula: la condición es
  **«una condición contractual pendiente de revisión jurídica»**, con dos salidas: una cuenta de
  Google Workspace o Cloud con acuerdo de tratamiento vigente, **o** la autorización expresa,
  separable e informada del Titular para la transferencia, con los efectos del artículo 26 de la
  Ley 1581.

**Lo que le pedimos ahora, entonces, no es un dato de un DPA que no existe, sino su concepto sobre
la estructura.** Concretamente:

1. **¿Es suficiente que los tres documentos declaren la condición y la dejen abierta**, o el
   servicio no debería ofrecerse a nuevas Empresas hasta que se resuelva?
2. **Si la primera, ¿cuál de las dos salidas sostenemos?** La de un proveedor con DPA (migrar el
   envío) o la de la autorización expresa del Titular. Y si es esta última, **¿el Anexo de Encargo
   y la autorización del trabajador bastan, o hace falta un instrumento aparte**?
3. **El flujo de correo, como está hoy, es una transferencia internacional** en los términos del
   artículo 26 de la Ley 1581: sale del país la dirección del correo del firmante, el contenido
   del mensaje con el enlace y el OTP, y los metadatos del envío. **¿Qué base jurídica concretas
   recommends**, y qué redacción necesita el Anexo de Encargo para declararla?
4. **¿Conviene que el Anexo de Nube siga siendo un documento que no se firma hasta que la condición
   se resuelva**, o que se firme con la condición declarada y sea la empresa cliente la que decide
   si lo acepta? Hoy está en la primera postura.

**Lo que no se hizo, deliberadamente:** no se sustituyó el DPA inexistente por una cláusula propia
que diga lo mismo, ni se presents la cuenta de consumo como si tuviera un acuerdo empresarial.

### 2.4 · ¿Sigue vigente lo que decidió el 23 de octubre?

Han pasado cuatro días y hay hechos nuevos (§3). Un "sigue vigente" nos basta; si algo cambió en
su criterio, dígalo y lo ajustamos antes de publicar.

---

## 3. Lo que cambió desde su respuesta (todo verificado)

### 3.1 · La primera firma real ya ocurrió — como piloto del D-03

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
(14 eventos) y el `CONSENT_ACCEPTED` es **anterior** al `MANIFESTATION_RECORDED`: el Acuerdo se
aceptó antes de la manifestación, que es el orden del Bloque E6.

**Importante:** esta firma se hizo bajo el **Acuerdo v1.0**, no bajo la v1.1, porque la v1.1 todavía
no está publicada. Cada firma nueva sigue bajo el v1.0 hasta que usted apruebe.

### 3.2 · El D-03 (su decisión B.3) está implementado y probado en la vida real

Se bloquea la creación de la solicitud, el commit, la creación del consentimiento y la doble firma.
La excepción es **un flag auditable**, no un `if` silencioso, con sus seis condiciones:

| Condición | Cómo quedó |
|---|---|
| Autorización escrita | del owner, con fecha y referencia al documento |
| Alcance | una Empresa y un número máximo de firmas |
| Ruta en papel | declarada y operativa el mismo día |
| Plazo | fecha cierta, máximo 30 días |
| Rastro | bitácora **append-only** con trigger de no modificación |
| Límite | solo piloto autorizado |

El piloto usó una excepción real (autorización del owner, alcance 2 firmas, plazo al 2 de noviembre,
piloto autorizado) y su bitácora registra la creación, cada uso y el **cierre con el motivo
verdadero** —la firma que ocurrió, con su identificador y su hora— sin afirmar nada que no haya
pasado. Al cerrarse, el bloqueo vuelve a levantar y la Empresa queda sin poder firmar: que es
justo lo que tiene que pasar.

### 3.3 · El 8.6 (su decisión A.1) está en el código y en el Anexo de Nube

`ANIOS_CUSTODIA` de 80 a 20, hold sin término para el contrato, piso de 20 años del 2.2.4.6.13
con sus cinco categorías, supresión solo si concurren las cuatro condiciones, copia al Trabajador
sin costo. Los tres campos del manifiesto que estaban en `null` (`rto_horas`, `rpo_horas`,
`plan_continuidad`) ya no lo están, con evidencia del servidor:

- **RTO 4 horas, RPO 24 horas.** El RPO no puede ser menor al intervalo entre copias: el respaldo
  es diario, luego 24 horas.
- Respaldo diario a las 22:00 hora Colombia, retención 30 días, `integrity_check` **sobre la
  copia**, log con el SHA-256.
- Prueba de restauración mensual, verificada: integridad, tablas reales, conteos y versión de
  esquema.
- Detector de caídas cada 5 minutos, con reinicio y enfriamiento.
- El Anexo de Nube dice la verdad, y también lo que **no** tiene: los respaldos **no están
  cifrados**, el **cifrado en reposo del disco no está confirmado**, la copia vive **en el mismo
  servidor** que los datos y el detector de caídas **no avisa a ninguna persona**.

### 3.4 · El D-02: el inventario de buzones dio cero

El inventario de los casos en que el OTP cae en un buzón corporativo dio **0 casos**: no hay
ninguna Empresa con buzones corporativos registrados. El flag `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` se
enciende al final, después de la v1.1 publicada, la 9A y la 10.4 probadas y el Anexo de Nube
firmado.

### 3.5 · El OTP va al medio personal del firmante — verificado

En la firma piloto, el código llegó al **correo que el firmante declaró en la pantalla de firma**, no
al buzón de la Empresa. Son los dos comportamientos que exige el 10.7(b) y la decisión 3.

### 3.6 · El correo post-firma ya no transporta el documento

Este cambio viene del mismo enfoque: para que "el uso de Gmail quede limitado a las notificaciones
necesarias" sea cierto, el correo tenía que dejar de llevar el documento. **Antes**, el correo post
firma adjuntaba el PDF firmado y la Constancia; **ahora** es un aviso con el enlace, y el
documento firmado y la Constancia se descargan desde la aplicación. Se creó además un endpoint
público de la Constancia, porque el botón de la mini-app estaba oculto precisamente porque el
trabajador la recibía por correo.

**La excepción, y su razón:** el flujo **en papel** conserva los adjuntos. En ese flujo la solicitud
queda en estado cancelado y el enlace no sirve nada, así que sin adjunto el firmante en papel se
quedaría **sin su copia**.

### 3.7 · El estado medido del gate

El readiness legal corre en el servidor. El último despliegue medido daba **25 OK / 13 pendientes**.
Los 13 son: siete del abogado (v1.1 ×3, Anexo de Encargo ×3, condición de Gmail ×1), dos pruebas
reales (9A y 10.4), el D-03 y el flag del D-02, y la firma del Anexo de Nube por cada Empresa.

---

## 4. Qué desbloquea cada respuesta

| Su respuesta | Qué cae en el manifiesto | Bloqueantes que se van |
|---|---|---|
| 2.1 — aprueba la v1.1 | `acuerdo_v1_1` (3 ítems) | **3** |
| 2.2 — aprueba el Anexo de Encargo | `anexo_encargo` (la marca de revisión) | **1** |
| 2.3 — concepto sobre la estructura del canal de correo | `anexo_nube` (ítems de Google) | **2** |
| Con la v1.1 publicada | `n10_4` (migración a la versión vigente) | **1** |
| La 9A probada en papel | `n9a` (prueba de medios autorizados) | **1** |
| El Anexo de Nube firmado por cada Empresa | `anexo_nube` (firma por Empresa) | **1** |
| El D-02 encendido | `d02` (flag) | **1** |
| El D-03 probado en sus cuatro puntos | `d03` | **1** |

**Con 2.1 y 2.2 se van cuatro bloqueantes de golpe** y queda publicable la v1.1, que es la llave
de los demás.

---

## 5. Lo que NO se le pide

- **El 8.6, el 10.4 y el D-03.** Ya están implementados y probados en producción (§3.2, §3.3).
- **El texto del Anexo de Nube.** Es el suyo; lo que falta es su concepto sobre la condición
  contractual (§2.3), no un dato de un DPA que no existe.
- **La v1.0.** Sellada el 20 de octubre, hash `52a490a4…10c04`, no se toca. La v1.1 la **reemplaza**
  como versión vigente; los consentimientos ya aceptados no se alteran.
- **La 9A.** Se prueba con un Trabajador de la Empresa, no con el abogado.

---

## 6. Lo que vence mientras tanto

- Mientras la v1.1 no esté publicada, **toda firma nueva se hace bajo el v1.0**.
- El **D-02 sigue apagado**: no se enciende hasta que estén la v1.1 publicada, la 9A y la 10.4
  probadas y el Anexo de Nube firmado.
- El **Anexo de Nube no está firmado por ninguna Empresa**: sin eso, el D-03 bloquea a la primera
  Empresa que quiera firmar, y el D-02 no se puede encender.
- El **gate de primera firma sigue bloqueado** por la condición contractual del canal de correo.
  El servicio no se presenta como aprobado.

---

## 7. Formato de la respuesta

Como en su respuesta 11A, numerada, para poder aplicarla sin ambigüedad:

```
1. v1.1: apruebo / cambio los numerales ...
2. Anexo de Encargo: apruebo / los puntos a corregir son ...
3. Canal de correo:
   3.1 ¿Basta declarar la condición, o no se ofrece el servicio hasta resolverla? ...
   3.2 ¿Qué salida se sostiene: proveedor con DPA o autorización expresa del Titular? ...
   3.3 ¿Qué base jurídica para la transferencia internacional y qué redacción en el Anexo? ...
   3.4 ¿El Anexo de Nube sigue sin firmarse hasta resolver la condición, o lo firma la Empresa? ...
4. Vigencia: sigue vigente / cambia en ...
```

Gracias.

---

*Documento preparado el 27 de octubre de 2026. Los hashes de §1 son verificables con
`sha256sum` en el repositorio: si alguno no coincide, el documento que se le manda no es el que
está en el sistema, y eso hay que saberlo antes de responder.*
