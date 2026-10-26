# Paquete para el abogado — 26 de octubre de 2026

> Documento de cierre de la **Solicitud 11A** (respondida el 23-oct-2026) y de apertura de la
> **Solicitud 11B**: los tres documentos que faltaban revisar o aprobar, con lo que ya está
> verificado y lo que se necesita de vuelta.
>
> Para: asesoría legal laboral y de protección de datos. De: owner y equipo de K+AIR
> (Gesstiar S.A.S.). Fecha: 26 de octubre de 2026.

---

## 0. En una página

**Qué se le manda:** tres documentos (la v1.1 armada, el Anexo de Encargo y el Anexo de Nube) y
esta nota. Todo está verificado con hash.

**Qué se le pide:** cuatro cosas, numeradas como su respuesta 11A, para que pueda contestarlas en
el mismo formato (§2 de esta nota).

**Por qué ahora:** la primera firma real **ya ocurrió** como piloto de la excepción del D-03, bajo
el Acuerdo v1.0 que usted selló. La operación pública no puede empezar hasta que la v1.1 esté
publicada, el Anexo de Encargo tenga la revisión profesional y el Anexo de Nube esté firmado.

**Lo que ya no necesita hacer:** el código del 8.6 (20 años), el del 10.4 (migración a la versión
vigente) y el del D-03 (bloqueo auditable) están implementados y probados en producción (§3).

---

## 1. Los tres documentos

Se le mandan **copias** de los tres documentos, con el mismo contenido y el mismo hash que los que
tienen en el sistema (el archivo `SHA256SUMS.txt` de este paquete lo permite verificar). La ruta de
cada uno en el repositorio se da para que pueda rastrear de dónde sale.

| # | Documento | Adjunto | Ruta en el repositorio | Bytes | SHA-256 |
|---|---|---|---|---|
| 1 | Acuerdo de uso **v1.1** (texto final armado) | `01-acuerdo-uso-v1.1.txt` | `sgsst-electron-app/firma-service/scripts/fixtures/acuerdo-v1.1.txt` | 42 475 | `634b063c6494549f7918d51c273cc67b09b7628942394ef9603dbfad177629d0` |
| 2 | **Anexo de Encargo** (a la espera de su revisión) | `02-anexo-de-encargo.html` | `sgsst-electron-app/legal/anexo-encargo.html` | 24 768 | `891259196782e5c14231cc5a5a0263c096796d896055e574842dd512a64987ec` |
| 3 | **Anexo de Nube** v1.0 (el que reemplaza al anterior) | `03-anexo-de-nube-v1.0.html` | `sgsst-electron-app/legal/anexo-nube-v1.0.html` | 13 704 | `f7e126b1be9ed79a486e3371e3e5a3e9a7e9f4f9dd1df322974bdeb2cb3a0a84` |

**Sobre la v1.1 (documento 1).** El texto es **el de usted**: los doce grupos de numerales de la
sección 2 de su respuesta, copiados íntegros y empalmados sobre la v1.0 sellada por un script
reproducible (`scripts/empalmar-acuerdo-v1.1.js`), que **no reescribe, no parafrasea y no reordena**
nada: solo cambia de sitio bloques de texto que ya venían escritos. La v1.0 sellada no se tocó. El
texto no tiene ni un hueco: los tres datos que usted dejó entre corchetes (URL del Anexo,
canal de protección de datos y persona responsable) ya están definidos por el owner, y el único
corchete que queda —`[registrada por el sistema]`— no es un hueco, es el campo que el sistema
llena al.acceptar el Acuerdo.

**Sobre el Anexo de Encargo (documento 2).** El texto está completo (cero placeholders) y conserva
la marca de **«Revisión profesional pendiente»**. La marca no se quita sola: el sistema la trata
como un bloqueante de la publicación, y solo se quita cuando usted revisa el documento. Abajo (§2.2)
le copiamos **las cuatro cosas que la propia marca señala** como sujetas a revisión, para que
pueda responder sobre ellas sin releer todo.

**Sobre el Anexo de Nube (documento 3).** Es el que usted dictó en el §3 de su respuesta, con los
datos reales del servidor puestos en los corchetes que dejó ([ciudad, país], respaldos,
monitoreo, soporte, RTO, RPO, plazo de supresión, formato de devolución, canal de derechos,
persona o área, auditoría, vigencia). Le quedan **seis** corchetes, y son los que no podemos
llenar nosotros: **tres** del DPA de Google (que dependen de la cuenta que se cree) y **tres** del
bloque de firma de la Empresa (que se llenan en cada firma).

---

## 2. Lo que se le pide

### 2.1 · La v1.1 (punto 12) — ¿aprueba el texto final?

El texto es el suyo, empalmado sin reescribirlo. Necesitamos una de dos:

- **«Apruebo la v1.1 tal como está»**, con su firma; o
- la lista de numerales que quiere cambiar, para volver a empalmar.

Al aprobarla se publica como versión vigente y se habilita la migración de las solicitudes
existentes a esa versión (§4).

### 2.2 · El Anexo de Encargo (punto 11) — ¿lo aprueba?

La marca de revisión pendiente señala textualmente cuatro cosas. Sobre cada una, una línea:

1. **El tratamiento de los datos sensibles de salud.** (¿El alcance y las clausuras son los que
   usted quiere, dada la lectura corregida del 2.2.4.6.13?)
2. **El envío del enlace de acceso al contacto de la Empresa y del código OTP al medio personal
   del Titular.** (Confirmado en producción: el OTP va al correo que el firmante declara en la
   pantalla de firma, no al buzón de la Empresa. §3.5.)
3. **El plazo de atención de dos (2) días hábiles de las peticiones, quejas y reclamos.**
4. **La devolución de los datos al terminar el encargo.**

Si lo aprueba, quitamos la marca y el anexo queda operativo. Si algo debe cambiar, dígalo y lo
corregimos en el texto, no en el sistema.

### 2.3 · El Anexo de Nube (punto 9, parte del abogado) — los tres huecos del DPA de Google

Hoy el correo sale por una **cuenta de Google de consumo**, y esa cuenta **no habilita el
servicio**: su propia respuesta dice que, con una cuenta de consumidor, el Anexo no puede decir
«transmisión» porque hay **transferencia** y el Acuerdo necesita una autorización expresa,
separable e informada que hoy no existe.

Hay dos caminos y los dos son válidos; el que elija cambia lo que hay que escribir:

- **Camino 1 (el recomendado):** el owner crea una **cuenta Google Workspace o Google Cloud** con
  **DPA** vigente, la verificamos y migramos el SMTP. Con eso, Google es **Encargado** y el Anexo
  dice «transmisión», sin autorización del Titular. Para el Anexo necesitamos tres datos, que
  quedan en los corchetes señalados: **la versión y la fecha del DPA y la evidencia de que
  aplica**; **la cláusula de devolución y supresión** (cómo y en qué plazo Google devuelve o
  elimina los datos); y **la auditoría** (si el DPA permite auditorías externas y con qué periodicidad).
- **Camino 2:** el owner mantiene la cuenta de consumo y se redacta la **autorización expresa de
  transferencia** para el Titular, como Instrumento separado. Es un camino más pesado y con un
  requisito adicional frente a cada Trabajador.

**Si elige el Camino 1, los tres datos del DPA llegan con la cuenta y no necesitamos nada más de
usted en este punto.** Si elige el Camino 2, necesitamos el texto de la autorización.

### 2.4 · ¿Sigue vigente lo que decidió el 23 de octubre?

Han pasado tres días y hay hechos nuevos (§3). Un "sigue vigente" nos basta; si algo cambió en su
criterio, dígalo y lo ajustamos antes de publicar.

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
- El Anexo de Nube dice la verdad: los corchetes que dejó para respaldos, monitoreo, RTO, RPO y
  supresión están llenos con estos datos.

### 3.4 · El D-02: el inventario de buzones dio cero

El inventario de los casos en que el OTP cae en un buzón corporativo dio **0 casos**: no hay
ninguna Empresa con buzones corporativos registrados. El flag `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP` se
enciende al final, después de la v1.1 publicada, la 9A y la 10.4 probadas y el Anexo de Nube
firmado.

### 3.5 · El OTP va al medio personal del firmante — verificado

En la firma piloto, el código llegó al **correo que el firmante declaró en la pantalla de firma**, no
al buzón de la Empresa, y la copia del documento salió por el canal de la Empresa. Son los dos
comportamientos que exige el 10.7(b) y la decisión 3.

### 3.6 · El estado medido del gate

El readiness legal corre en el servidor y da **24_OK / 14 pendientes**. Los 14 son: ocho del
abogado (v1.1 ×3, 10.4, 8.6, Anexo de Encargo ×3), tres del Anexo de Nube (DPA de Google ×2 y la
firma por cada Empresa), dos pruebas reales (9A y D-03) y el flag del D-02.

---

## 4. Qué desbloquea cada respuesta

| Su respuesta | Qué cae en el manifiesto | Bloqueantes que se van |
|---|---|---|
| 2.1 — aprueba la v1.1 | `acuerdo_v1_1` (3 ítems) | **3** |
| 2.2 — aprueba el Anexo de Encargo | `anexo_encargo` (la marca de revisión) | **1** |
| 2.3 — el DPA de Google (o la autorización de transferencia) | `anexo_nube` (2 ítems de Google) | **2** |
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
- **El texto del Anexo de Nube.** Es el suyo; solo faltan los tres datos del DPA de Google (§2.3).
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

---

## 7. Formato de la respuesta

Como en su respuesta 11A, numerada, para poder aplicarla sinambigüedad:

```
1. v1.1: apruebo / cambio los numerales ...
2. Anexo de Encargo: apruebo / los puntos a corregir son ...
3. Anexo de Nube: Camino 1 (DPA de Google) / Camino 2 (autorización de transferencia) ...
   - versión y fecha del DPA: ...
   - devolución y supresión: ...
   - auditoría: ...
4. Vigencia: sigue vigente / cambia en ...
```

Gracias.

---

*Documento preparado el 26 de octubre de 2026. Los hashes de §1 son verificables con
`sha256sum` en el repositorio: si alguno no coincide, el documento que se le manda no es el que
está en el sistema, y eso hay que saberlo antes de responder.*
