# Propuestas de texto para la v1.1 del Acuerdo (insumo para el abogado)

**Fecha**: 2026-10-20
**Origen**: dictamen del subagente de asesoría legal (fuente oficial verificada: compilación
jurídica del SENA, Gestor Normativo de Función Pública, Gestor Normativo CRA/MINTIC), a partir de
la revisión técnica de los capítulos II a XII
([`revision-tc-capitulos-2-12-2026-10-20.md`](./revision-tc-capitulos-2-12-2026-10-20.md)) y del
[plan de cierre](./plan-cierre-tc-y-decisiones-2026-10-20.md).
**Texto base**: `firma-service/scripts/fixtures/acuerdo-v1.0.txt` (v1.0, **archivado**: su huella
`52a490a4…` ya no se modifica).

> ⚠️ **Esto no es un concepto firmado.** Son **propuestas de redacción** con su fundamento
> normativo, para que el abogado laboral colombiano las escriba, las ajuste y las firme.
> El subagente de asesoría legal no firma conceptos ni representa ante la SIC.
>
> ⚠️ **Regla de uso del documento**: un numeral que aquí aparece marcado como *"el abogado
> debe cotejarlo con el código"* **no se publica** hasta que el cotejo esté hecho. La
> diferencia entre el texto y el comportamiento real es exactamente lo que esta v1.1
> viene a cerrar.

---

## 0. Veredicto en una página

| # | Punto | Veredicto |
|---|---|---|
| 1 | §4 vs §8 (4.5 / 2.2(a) / 2.2(c) vs 8.6) | **Se sostiene el problema.** Se recomienda la **Variante A más un piso legal declarado por documento** (no un piso automático en el código). La 2.2(a) es falsa contra el código; el 8.6 es insostenible tal como está para el contrato individual de trabajo |
| 2 | Firma visual (PNG) | **No entra al 10.2** como dato autónomo: no aporta nada al 47.4 y obligaría a un consentimiento expreso de dato sensible sin necesidad. **Se rechaza en el código.** Excepción: si la imagen se dibuja dentro del PDF firmado, es contenido del documento (10.2(f)) |
| 3 | 10.7(b) | **No se sostiene.** K+AIR, como Encargado, tiene obligación propia: designar persona/área y tener mecanismos disponibles (Decreto 1377 arts. 23 y 21 = 2.2.2.25.4.4 y 2.2.2.25.4.2). No puede dejar de recibir, registrar y trasmitir |
| 4 | H-TC-06 (art. 244 Ley 1564) | La auditoría del 19-Oct **se equivocó**: el art. 244 **sí** dice "los documentos en forma de mensaje de datos se presumen auténticos" (párr. 5), y la condición "tachados de falso" **no** le aplica |
| 5 | T5 (cadena 2.2.1.1.8 → párr. 2.2.1.1.9 → 2.2.2.47.7) | La cadena es real y el Acuerdo **no** la cita completa: falta el **2.2.1.1.8**. Va en el preámbulo del 2.2. (El T5 del plan previo está mal: el Acuerdo **sí** cita el 2.2.1.1.9, y la cita es fiel) |
| 6 | T1 (nube vs local) | **Confirmado**: el Decreto 1377 art. 5 (= 2.2.2.25.2.2) exige "obtener del Titular una nueva autorización cuando el cambio se refiera a la finalidad del Tratamiento". Y es **también** un defecto del Encargado (Anexo que no describe el tratamiento real → art. 25 roto) |
| 7 | 11A vs 11B | Coherentes, **con tres correcciones**: H-TC-05 (OTP al buzón de la Empresa) y H-TC-04 (registro de medios) **entran a la 11A**; H-TC-19 es previo a la publicación |
| 8 | `empresa_hash` (SHA-256 sin sal) | **No hay prohibición**, pero sí tres problemas: (i) la Constancia no debe sobreafirmar; (ii) es un identificador **reversible por fuerza bruta** de un tercero, publicado en un documento que circula; (iii) el **10.5(a) está mal redactado** y confunde el dato del Trabajador con el del representante. No cambiar el algoritmo; **sí partir el 10.5** |

### Tres correcciones al material previo (para el abogado)

- ⚠️ El **H34** del plan previo afirma que la Ley 1562/2012 "se titula *…en materia de Salud
  Ocupacional*". **Es falso**: el título oficial es *"Por la cual se reforma el Sistema General de
  Riesgos Laborales y se dictan otras disposiciones"* (11 de julio de 2012). El Acuerdo no usa
  ese título, así que **no hay error en el Acuerdo**; sí hay error en el plan.
- ⚠️ `LEGAL.md` §3.3 dice que el 2.2.1.1.9 remite al **art. 23** del CST. El texto oficial
  remite al **art. 39** del CST (y el 2.2.1.1.8 también al art. 39).
- ⚠️ El **H28** ("o atribuir la preclusión a doctrina") es mejorable: la Ley 1581 tiene un
  artículo expreso, el **16** (*"REQUISITO DE PROCEDIBILIDAD"*), que sí exige agotar el reclamo
  interno. No es doctrina.

---

## 1. Las tres decisiones del owner

### 1.1 La contradicción §4 vs §8 → **Variante A + carga en la Empresa**

**Por qué A sola no alcanza.** A separa "validez de la firma" de "evidencia material", que es lo
correcto: el numeral 3 del 2.2.1.1.13 protege **el acto**; el 2.2.1.1.12 obliga a **conservar**
("los empleadores deberán conservar los contratos de trabajo firmados electrónicamente mediante
los mecanismos técnicos que garanticen la autenticidad, integridad y disponibilidad") — **sin
término**. Son planos distintos y no se contradicen en abstracto.

El problema es de **operación**: el texto le dice al Trabajador que su firma "conserva su fuerza
probatoria" y que nada se elimina por el tiempo, y el 8.6 le da a la Empresa la potestad de
borrar la única evidencia cuando su tabla interna vence. El Trabajador tiene un derecho que la
Empresa puede defeat en la práctica. Eso no lo arregla una declaración: hay que poner la **carga**
donde está (la Empresa) y darle al Trabajador la **salida** (copia antes de la supresión).

**Por qué el piso automático en el código no.** Un piso automático en la 5B exige que el sistema
decida por sí mismo qué documentos se conservan sin término. La ley solo lo dice para el **contrato
individual de trabajo** y sus adiciones/anexos (2.2.1.1.12). Si el sistema lo decide por categoría,
se corre el riesgo de **sobre-retención** (que choca con el deber de supresión temporal del
2.2.2.25.2.8) o de **sub-retención** (y entonces el deber legal se extingue por tabla interna, que
es exactamente esta contradicción). La extensión natural: **que la Empresa declare, además del
plazo, si el documento es contrato individual de trabajo**, y que esa declaración gobierne la
supresión.

**Por qué C no.** El 2.2 es donde queda fijado el alcance del Acuerdo para el contrato de
trabajo. Borrar el 2.2(a) y el 2.2(c) deja el 4.5 como único lugar, y el 4.5 se apoya en el
numeral 3 del 2.2.1.1.13, que es **del contrato**, no de "la firma" en general.

> **Texto final:** 4.5, 2.2(a) y 8.6 en el §2 de este documento.

### 1.2 La firma visual (PNG) → **se rechaza en el código**

Fundamento:

1. El **10.2 es una lista cerrada** y hoy el sistema trata un dato que el texto no autoriza: eso
   es un tratamiento sin base (art. 4(b) y 4(c) de la Ley 1581; art. 4 del Decreto 1377 =
   2.2.2.25.2.1: *"la recolección de datos deberá limitarse a aquellos datos personales que son
   pertinentes y adecuados para la finalidad"*).
2. **No aporta nada al 2.2.2.47.4**: ese artículo exige solo (i) que los datos de creación
   correspondan exclusivamente al firmante y (ii) que se pueda detectar alteraciones no
   autorizadas posteriores. Un PNG no es dato de creación (es el *resultado* de la voluntad) ni es
   lo que detecta alteraciones (eso lo hacen las huellas SHA-256 del documento y de la constancia).
3. **Entrarla obligaría a consentimiento expreso de dato sensible**: el art. 5 de la Ley 1581
   lista "los datos biométricos" como sensibles, y el art. 6(a) prohíbe su tratamiento salvo
   autorización explícita; el 2.2.2.25.2.3 exige informar explícitamente **cuáles** datos son
   sensibles y la finalidad, obtener consentimiento expreso y que **ninguna actividad se condicione**
   a que el Titular los suministre.
4. ⚠️ **No verificado**: no se confirmó si el PNG se inserta en el PDF firmado. Si se inserta, el
   2.3 ("lo único que se le agrega es una página de sello") también queda desactualizado.
   **Esta es la única pregunta técnica que decide el caso** — y la respuesta legal es la misma en
   ambos escenarios: *dato autónomo → no; contenido del PDF → sí, dentro del 10.2(f)*.

> **Acción de código (propuesta, no ejecutada):** rechazar `firma_visual_png` en el endpoint de
> commit, o dejarlo solo si va dentro del PDF. Hoy el API lo acepta y lo guarda.

### 1.3 El 10.7(b) → **K+AIR tiene obligación propia como Encargado**

Base verificada:

- **Decreto 1377/2013 art. 23** (= 2.2.2.25.4.4): *"**Todo Responsable y Encargado** deberá
  designar a una persona o área que asuma la función de protección de datos personales, que dará
  trámite a las solicitudes de los Titulares…"*.
- **Decreto 1377/2013 art. 21** (= 2.2.2.25.4.2): *"Los **responsables y encargados** del
  tratamiento deben establecer mecanismos sencillos y ágiles que se encuentren **permanentemente
  disponibles** a los Titulares…"*.
- **Ley 1581 art. 8(a)** (conocer/actualizar/rectificar) y **art. 15** (reclamo): se puede
  ejercer frente al Responsable **o al Encargado**.
- **Decreto 1377 art. 9** (= 2.2.2.25.2.6), párr. 3: *"El responsable **y el encargado** deben
  poner a disposición del Titular mecanismos gratuitos y de fácil acceso…"*.

El numeral actual es **falso en la parte de "no recibe"** y verdadero en la de "no resuelve". La
fórmula correcta: *no resuelve, pero no puede ser un punto ciego*.

**Qué hay que implementar para poder cumplirlo** (texto y código van juntos):

| Qué | Detalle |
|---|---|
| **Canal de datos propio de K+AIR** | Ya existe el valor (`FIRMA_CANAL_INCIDENCIES`, default `adminkair@gmail.com`) pero hoy es el canal de *incidentes*. Debe publicarse como **canal de protección de datos**: en la mini-app, en el correo de invitación, en el 1.5/10.1 y en el §9 del Anexo de Encargo |
| **Registro de solicitudes** | Tabla + evento: fecha, canal, contenido, si fue trasmitida a la Empresa, fecha de trasmisión, respuesta, evidencia entregada. Sin eso no hay prueba de que K+AIR "dio trámite" |
| **Trasmisión a la Empresa** | Plazo interno corto. Sugerido: **2 días hábiles**, por simetría con el art. 15.1 de la Ley 1581 (traslado a quien corresponda: 2 días hábiles) |
| **Aporte de evidencia** | K+AIR es quien tiene la constancia, los eventos y el registro de la firma. Debe poder entregar esa evidencia a la Empresa para que responda, y al Titular cuando corresponda |
| **No bloquea** | La respuesta es de la Empresa (Responsable). El 10.7(d) (plazo de 15 días hábiles) se mantiene contra la Empresa |

---

## 2. Textos propuestos (listos para pegar)

Estilo conservado: MAYÚSCULAS en epígrafes, numerales con punto, literales con sangría, tono de
cláusula.

### 2.2. Preámbulo (H-TC-08 + cadena T5)

> **2.2.** Este Acuerdo es el acuerdo sobre el uso del mecanismo de firma electrónica previsto en el
> artículo 2.2.2.47.7 del Decreto 1074 de 2015, mediante el cual las partes estipulan las
> condiciones legales y técnicas a las que se ajustan para el intercambio de mensajes de datos y la
> creación de documentos electrónicos. Cuando el documento que se firma sea el contrato individual
> de trabajo o sus adiciones, modificaciones o anexos, este Acuerdo se dicta además al amparo del
> artículo 2.2.1.1.8 del Decreto 1072 de 2015, que permite la celebración del contrato individual
> de trabajo por firma electrónica por cualquiera de las partes o por ambas, y del artículo 2.2.1.1.9
> de ese mismo Decreto, según el cual el contrato de trabajo firmado electrónicamente debe cumplir
> los requisitos mínimos del artículo 39 del Código Sustantivo del Trabajo, cuyo parágrafo dispone
> que el acuerdo sobre el uso del mecanismo de firma electrónica previsto en el artículo 2.2.2.47.7
> del Decreto 1074 de 2015 se rige por lo señalado en el artículo 2.2.1.1.13 y por las
> disposiciones adicionales que las partes encuentren procedente convenir en el contrato mismo. En
> consecuencia, para los tres casos comprendidos en los numerales 1, 2 y 3 del artículo 2.2.1.1.13 del
> Decreto 1072 de 2015, las partes dejan constancia de lo siguiente:

*El "Para el caso previsto en el **parágrafo** del artículo 2.2.1.1.13" del texto actual se elimina:
a), b) y c) son los tres **numerales**, no el parágrafo. El parágrafo del 2.2.1.1.13 (el deber del
empleador de garantizar el 47.4) se traslada al 6.1(d) y al 3.8.*

### 2.2(a)

> **a)** La vigencia de la firma corresponde a la vigencia del contrato y de sus adiciones,
> modificaciones o anexos. El mecanismo de firma electrónica no aplica al documento firmado ni a la
> Constancia de firma electrónica ninguna política de eliminación por el fruto de la finalización de
> la relación laboral; la conservación por plazo y la supresión posterior de esa evidencia se rigen
> por el numeral 8.6. La Constancia de firma electrónica identifica la versión de este Acuerdo
> aceptada y la huella digital de su texto, según lo previsto en el numeral 9.6.

### 2.2(c) (ajuste mínimo)

> **c)** El uso del mecanismo es exclusivo para la relación laboral, sin que el documento firmado por
> el Trabajador pierda su validez, eficacia ni fuerza probatoria por el mero hecho de que la
> relación laboral haya terminado, conforme al numeral 3 del artículo 2.2.1.1.13 del Decreto 1072
> de 2015.

### 3.1 (H-TC-11)

> **3.1.** El método pactado consiste en la generación de una firma electrónica por medio de un
> sistema de autenticación y verificación de identidad basado en un código de verificación de un solo
> uso, en adelante OTP, enviado a un medio de contacto personal del Firmante que la Empresa no
> administra, previo enlace individual y de uso personal remitido por la Empresa.

### 3.3 (H-TC-11)

> **3.3.** En este método, los datos de creación de la firma electrónica son el código OTP y el token
> de acceso. Ambos son únicos, personalísimos y permanecen bajo control exclusivo del Firmante. El
> token de acceso puede ser reemitido por K+AIR a solicitud de la Empresa, sin que ello afecte la
> vigencia de los tokens anteriores, que permanecen válidos hasta su vencimiento, y sin que puedan
> existir más de tres (3) tokens vigentes por solicitud. Cada reemisión queda registrada.

### 3.4(c) (H-TC-11)

> **c)** El Trabajador abre el enlace recibido en el servicio de firma electrónica de K+AIR. El enlace
> incorpora un token aleatorio, de uso personal, que puede ser reemitido por K+AIR sin invalidar
> los tokens anteriores. En la modalidad remota su vigencia es de setenta y dos (72) horas contadas
> desde su emisión.

### 3.4(d) (H-TC-10)

> **d)** El Trabajador se identifica indicando el tipo y el número de su documento de identidad.
> K+AIR compara el valor recibido con la información registrada por la Empresa, mediante una
> comparación de huellas digitales con clave secreta (HMAC-SHA-256), y registra el resultado de esa
> verificación. K+AIR no conserva el número de identidad en texto claro.

### 3.4(e) (H-TC-10)

> **e)** Verificada la identificación, K+AIR envía al medio de contacto personal del Firmante, que
> la Empresa no administra, un código OTP de un solo uso, que expira a los seiscientos (600)
> segundos contados desde su envío y admite un máximo de cinco (5) intentos de verificación. El código
> nunca se almacena en texto claro: solo se conserva su huella digital con clave secreta
> (HMAC-SHA-256).

### 3.4(g) (H-TC-11) — *dos versiones, según se implemente o no la 10.4*

> **Versión 10.4 implementada (la que debe publicarse):**
>
> **g)** Superada la verificación, el Trabajador lee en pantalla el presente Acuerdo, en la versión
> vigente en el momento de la firma, y lo acepta. Si la solicitud se creó bajo una versión
> anterior, el sistema le presenta la versión vigente para que la lea y la acepte en ese momento.
> Aceptarlo constituye una manifestación de voluntad independiente, que K+AIR registra junto con la
> versión del Acuerdo, la huella digital SHA-256 de su texto y la fecha y hora de aceptación. El
> Trabajador no puede avanzar en el flujo sin leer y aceptar el Acuerdo.

> **Versión sin 10.4 (no publicable tal cual):**
>
> **g)** Superada la verificación, el Trabajador lee en pantalla el presente Acuerdo, en la versión
> asociada a la solicitud, y lo acepta. […] Si la versión asociada a la solicitud ha sido
> sustituida, el sistema informa al Trabajador de esa situación y de la forma de solicitar la versión
> vigente, y no habilita la firma mientras no se acepte una versión vigente.

### 3.6(e) (H-TC-10)

> **e)** El código OTP y el token de acceso, únicamente en forma de huella digital con clave secreta
> (HMAC-SHA-256), y nunca en texto claro. La clave secreta se mantiene fuera de la base de datos y
> bajo control de K+AIR.

### 3.6(g) (H-TC-09)

> **g)** El registro de auditoría de los eventos del proceso de firma, que no puede ser alterado una
> vez registrado. La supresión del registro dentro de la ventana de purga gobernada conforme al
> numeral 8.6 no constituye una alteración del registro: da lugar a una lápida que identifica la
> solicitud, la fecha y hora de la supresión, las categorías suprimidas y el fundamento del plazo, y
> a un recibo que la Empresa entrega al Trabajador si este lo solicita.

### 3.7(a) (H-TC-05) — la redacción del owner (2026-10-20) y la pregunta al abogado

**Estado**: el código ya soporta lo que el texto dirá (migración `031`,
`resolveCorreoOtp`, `declararMedioOtp`, el registro de medios) y el rechazo
(`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`) se enciende **con la publicación de la v1.1**,
no antes (decisión del owner, 2026-10-20).

> **3.7. a)** El código de verificación (OTP) se remite a un medio de contacto
> personal del Firmante, que la Empresa no administra; el token de acceso se remite al medio de
> contacto registrado por la Empresa y no habilita por sí solo la manifestación de
> voluntad, que requiere el OTP y la verificación de identidad del Firmante.

**Por qué así y no «únicamente al medio de contacto personal registrado
por el Trabajador»** (la redacción anterior): la del owner refleja lo que el
código hace y lo que la norma exige, sin prometer más de lo que el sistema
puede sostener. El OTP va a un medio personal **que la Empresa no administra** (puede
ser que la Empresa conozca la dirección: lo que no puede es leer ese buzón). El
token de acceso sigue al contacto registrado por la Empresa, y se dice expresamente
que **no habilita por sí solo** la manifestación de voluntad, que es lo que
pide el 47.4 num. 1.

#### La pregunta que se manda AL ABOGADO ACOMPAÑANDO este texto (no se espera la respuesta)

> ¿Alcanza con que el token de acceso no habilite por sí solo la manifestación de
> voluntad —que exige el OTP y la verificación de identidad— para que los datos de
> creación de la firma correspondan exclusivamente al Firmante en el contexto en que se
> usan?

**Por qué no se espera la respuesta**: el código es el mismo bajo las dos
respuestas. Si la respuesta es «alcanza con que no puedan usarse por un tercero», el
3.7(a) de arriba sirve tal cual. Si la respuesta es «no alcanza: no deben entregarse», el
costo no es de código sino de texto: el 3.3 propose el token como dato de creación, y
esa definición se acota (el token es credencial de acceso, no dato de creación), con
una sola frase. En ambos casos el 3.7(a) se redacta igual; lo que cambia es una
frase del 3.3 y, quizá, una mención en el 3.7(a).

#### El 3.3 y la definición de «datos de creación» (contingencia)

El 3.3 actual dice: *«los datos de creación de la firma electrónica son el código OTP
y el token de acceso»*. Si el abogado respondiera que el token también debe
entregarse al Firmante para que el 47.4 se cumpla, ese numeral se acota así:

> **3.3.** En este método, el dato de creación de la firma electrónica es el código
> OTP, que es único, personalísimo y permanece bajo control exclusivo del Firmante. El
> token de acceso es una credencial de acceso al servicio, no un dato de creación: no
> habilita por sí solo la manifestación de voluntad, que requiere el OTP y la
> verificación de identidad del Firmante. [El token puede ser reemitido por K+AIR a
> solicitud de la Empresa, sin que ello afecte la vigencia de los tokens anteriores, que
> permanecen válidos hasta su vencimiento, y sin que puedan existir más de tres (3)
> tokens vigentes por solicitud. Cada reemisión queda registrada.]

### 3.8 (H-TC-07, atribución corregida)

> **3.8.** Presunción y carga de demostrar. De conformidad con el artículo 2.2.2.47.7 del Decreto
> 1074 de 2015, salvo prueba en contrario se presume que los mecanismos o técnicas de identificación
> personal o autenticación electrónica acordados mediante este Acuerdo cumplen los requisitos de
> firma electrónica. La parte que mediante acuerdo provee los métodos de firma electrónica, es decir
> K+AIR en su calidad de proveedor del mecanismo descrito en el Capítulo III, deberá asegurarse de
> que sus mecanismos son técnicamente seguros y confiables para el propósito de los mismos, y le
> corresponderá probar estos requisitos en caso de que sea necesario. La Empresa, en su calidad de
> Responsable, conserva y mantiene a disposición de K+AIR la evidencia técnica y los registros del
> proceso de firma mientras sean exigibles las obligaciones de conservación del Capítulo VIII, y
> garantiza, conforme al parágrafo del artículo 2.2.1.1.13 del Decreto 1072 de 2015, que el
> mecanismo utilizado cumple las condiciones del artículo 2.2.2.47.4 del Decreto 1074 de 2015.

### 3.10. (nuevo — vocabulario de huellas)

> **3.10. Definiciones técnicas.** Para los efectos de este Acuerdo se distinguen tres clases de
> huella digital, que no son equivalentes entre sí:
>
> **a)** La **huella digital SHA-256** es el resultado de la aplicación del algoritmo SHA-256 a un
> contenido íntegro y público, y puede ser recalculada por cualquier tercero que disponga de ese
> contenido. Se emplea para el texto de este Acuerdo (numerales 3.6(b), 9.3 y 9.6) y para el
> documento firmado y su copia (numerales 2.3, 3.6(a), 3.7(b) y 10.5(c)).
>
> **b)** La **huella digital con clave secreta (HMAC-SHA-256)** es el resultado de la aplicación del
> algoritmo HMAC-SHA-256 con una clave secreta mantenida fuera de la base de datos y bajo control de
> K+AIR. No puede recalcularse por terceros sin dicha clave. Se emplea para el número de identidad
> del Firmante, el código OTP y el token de acceso (numerales 3.4(d), 3.4(e), 3.6(e), 10.5(a) y
> 10.5(b)).
>
> **c)** La **huella digital SHA-256 de la identificación de la Empresa** es el resultado de la
> aplicación del algoritmo SHA-256, sin clave secreta, a la identificación de la Empresa en claro,
> incluido el número completo del documento de identidad de su representante legal. Solo quien
> conozca esa identificación completa puede recalcularla, y es reproducible por quien la conozca, por
> lo que no ofrece reserva alguna frente a un tercero. Se emplea para acreditar que la
> identificación de la Empresa incorporada a la Constancia de firma electrónica no ha sido alterada
> (numerales 1.2 y 10.5).

*Sobre la unificación del vocabulario: sí conviene unificar, pero en **tres familias y no en
una**. Lo que hay que arreglar es (i) quitar "con sal" de las tres menciones del HMAC, y
(ii) **separar la `empresa_hash` de las dos familias anteriores**, porque no es ni una cosa ni la
otra. Numerales a tocar: **3.4(d), 3.4(e), 3.6(e), 10.5(a), 10.5(b)** y añadir **1.2 + 10.5
(literal nueva)** para la `empresa_hash`. **No tocar** 2.3, 3.6(a), 3.6(b), 3.7(b), 9.3, 9.6 ni
10.5(c).*

### 4.4 (H-TC-06, corregido)

> **4.4.** De conformidad con el artículo 244 de la Ley 1564 de 2012, los documentos en forma de
> mensaje de datos se presumen auténticos. Quien aporta al proceso un documento en esa forma
> reconoce con ello su autenticidad y no podrá impugnarlo, excepto cuando al presentarlo alegue su
> falsedad, de conformidad con el parágrafo final de ese artículo. La valoración del mensaje de
> datos se sujeta a lo dispuesto en el artículo 247 de la misma ley.

*Lo que NO lleva y por qué:* la condición *"mientras no hayan sido tachados de falso o
desconocidos"* está en el **párr. 2** del art. 244 y recae sobre "los documentos públicos y los
privados emanados de las partes o de terceros… y los que contengan la reproducción de la voz o de
la imagen". **No** recae sobre los mensajes de datos (párr. 5). Añadirla sería introducir un error
nuevo: la presunción del mensaje de datos **no** es condicional.

### 4.5 (Variante A + carga en la Empresa)

> **4.5.** La validez, la eficacia y la fuerza probatoria de la firma realizada mediante este
> mecanismo no se afectan por la finalización de la relación laboral, conforme al numeral 3 del
> artículo 2.2.1.1.13 del Decreto 1072 de 2015, respecto del contrato individual de trabajo y sus
> adiciones, modificaciones y anexos. Respecto de los demás documentos, la misma garantía se
> sustenta en el artículo 2.2.2.47.5 del Decreto 1074 de 2015 y en la ampliación contractual del
> numeral 6.2. La supresión de la evidencia material de la firma conforme al numeral 8.6 no revoca
> la firma ni altera su validez, su eficacia ni su presunción de autenticidad; lo que puede afectar
> es la disponibilidad de los medios de prueba, por lo que la Empresa está obligada a comunicar el
> vencimiento del plazo con la anticipación del numeral 8.6, a entregar la copia que el Trabajador
> solicite y a no suprimir la evidencia de una firma respecto de la cual el Trabajador haya
> solicitado copia, hasta que le sea entregada.

### 8.5 (H-TC-12 / H-TC-15) — dos versiones

> **Versión A — con copia permanente (la que debe publicarse si la 9A entra):**
>
> **8.5.** La Empresa reconocerá el término copia al documento firmado electrónicamente como un
> documento físico entregado al destinatario. El Trabajador tiene derecho a obtener de la Empresa, en
> cualquier momento y sin costo, una copia de su documento firmado y de la Constancia de firma
> electrónica. La entrega de esa copia se efectúa por el canal que la Empresa publique en su
> política de tratamiento de datos personales y, en su defecto, por el correo electrónico registrado
> del Trabajador o por el medio electrónico autorizado a que se refiere el numeral 8.2, dentro de los
> cinco (5) días hábiles siguientes a la solicitud. El enlace de firma electrónica ofrece, mientras
> su vigencia, la descarga del documento firmado y de la Constancia; esa descarga es una cortesía
> durante la vigencia del enlace y no sustituye la entrega de la copia permanente a que se refiere
> este numeral, ni el vencimiento del enlace extingue el derecho del Trabajador a obtenerla de la
> Empresa.

> **Versión B — sin copia permanente (solo si la Empresa tiene un canal humano real y escrito; NO
> es la recomendada):**
>
> **8.5.** […] El enlace de firma electrónica ofrece, mientras su vigencia, la descarga del
> documento firmado y de la Constancia; esa descarga es una cortesía durante la vigencia del
> enlace. La copia permanente del documento firmado y de la Constancia la entrega la Empresa por el
> canal de su política de tratamiento de datos personales, dentro de los cinco (5) días hábiles
> siguientes a la solicitud del Trabajador.

**Dictamen:** la **Versión A**. La distinción que propone el plan ("cortesía / la copia permanente
la entrega la Empresa") es *correcta* pero **insuficiente**: sin canal, sin plazo y sin mecanismo,
"la Empresa la entrega" es una promesa tan vacía como la del 8.5 actual, solo que con menos ruido. Si
la 9A no entra antes de la v1.1, **no se publica la v1.1 con este numeral**: se publica el 8.5
como está y la 9A va en la v1.2 (con el riesgo de que entre la v1.1 y la v1.2 el texto prometa más
de lo que el sistema cumple).

### 8.6 (H-TC-01 / H-TC-03 — el numeral más importante de la v1.1)

> **8.6. PLAZO DE CONSERVACIÓN.** El plazo de conservación de los registros del proceso de firma se
> determina por la tabla de retención documental de la Empresa, la cual constituye la referencia
> vigente de esa Empresa y no se modifica por este Acuerdo. La Empresa debe comunicar al Trabajador,
> antes de solicitarle la firma, el plazo que le resulta aplicable al documento objeto de la firma,
> si el documento objeto de la firma es el contrato individual de trabajo o alguna de sus adiciones,
> modificaciones o anexos, y el canal en el que puede ejercer, en cualquier momento, una solicitud
> de copia.
>
> Cuando el documento objeto de la firma sea el contrato individual de trabajo o alguna de sus
> adiciones, modificaciones o anexos, el deber de conservación previsto en el artículo 2.2.1.1.12 del
> Decreto 1072 de 2015 prevalece sobre la tabla de retención documental de la Empresa, y el
> vencimiento del plazo de esa tabla no extingue dicho deber ni habilita la supresión de la evidencia
> de la firma.
>
> La supresión del dato y de la evidencia material de la firma conforme al numeral 10.6 solo procede
> cuando se cumplen, cumulativamente, las siguientes condiciones: (i) que el plazo aplicable se haya
> vencido; (ii) que no exista un deber legal o contractual de conservación, incluido el previsto en
> el artículo 2.2.1.1.12 del Decreto 1072 de 2015; (iii) que la Empresa haya comunicado al
> Trabajador el vencimiento del plazo con una anticipación no inferior a treinta (30) días calendario
> y le haya indicado el canal para obtener la copia; (iv) que el Trabajador no haya solicitado copia
> del documento firmado o de la Constancia de firma electrónica, o que la copia solicitada le haya
> sido entregada; y (v) que no exista una medida de conservación legal (hold) vigente sobre la
> evidencia.
>
> La supresión afecta a la evidencia material de la firma —el documento firmado, la Constancia de
> firma electrónica y el registro de auditoría—, conforme al numeral 3.6, literal g), y no a la
> validez, la eficacia ni la fuerza probatoria de la firma, conforme al numeral 4.5. La supresión
> deja una lápida que identifica la solicitud, la fecha y hora de la supresión, las categorías
> suprimidas y el fundamento del plazo, y un recibo que la Empresa entrega al Trabajador si este lo
> solicita.

> ⚠️ **El abogado debe cotejar las cinco condiciones (i)–(v) contra las cinco condiciones reales
> del 5B en la base** (no se reescribieron desde el código: se redactaron desde la norma). Si
> difieren, **manda el código** y se ajusta el texto. En particular, la condición (iii) (aviso de
> 30 días) **no existe hoy en el sistema**.

### 10.2 (H-TC-13 + la identificación de la Empresa, que hoy tampoco está en la lista)

> **10.2. Datos que se tratan.** Para la ejecución de este Acuerdo y del proceso de firma se tratan
> los siguientes datos personales del Titular:
>
> **a)** Tipo y número del documento de identidad.
>
> **b)** Dirección de correo electrónico.
>
> **c)** Dirección IP desde la que accede al servicio.
>
> **d)** Agente de usuario del dispositivo desde el que accede al servicio.
>
> **e)** Fechas y horas de las distintas etapas del proceso de firma.
>
> **f)** El documento que se firma y la constancia de firma.
>
> **g)** Los datos de identificación laboral que la Empresa haya inscrito en la solicitud de
> firma, como el identificador del trabajador, el identificador del documento a firmar y la
> categoría de éste.
>
> **h)** La identificación de la Empresa que se muestra al Firmante en el bloque «Empresa que
> solicita tu firma», incluidos la razón social, el NIT, el domicilio, el nombre y el número
> completo del documento de identidad de su representante legal, y la huella digital de esa
> identificación. Estos datos no pertenecen al Titular, se tratan por cuenta de la Empresa y con el
> fin de que el Trabajador pueda contrastar la identidad de quien le solicita la firma.
>
> *Este numeral no autoriza a la Empresa a enviar al servicio datos distintos de los aquí
> relacionados, ni atributos de metadatos que contengan datos personales del Titular distintos de
> los aquí relacionados. Cualquier dato adicional sobre el Titular requiere una actualización previa
> de este Acuerdo. Los datos que la Empresa remita por fuera de esta lista no serán objeto de
> tratamiento y serán descartados, sin perjuicio del deber de la Empresa de no remitirlos.*

*Si el owner decide conservar la firma visual, añadir:*

> **i)** La representación gráfica de la firma autográfica del Firmante, cuando la Empresa la
> registre en la solicitud de firma. Se trata de un dato de carácter especial, por cuanto permite
> identificar a la persona mediante la comparación de su rúbrica. Su tratamiento requiere el aviso
> previo y el consentimiento expreso del Titular previstos en el numeral 10.10, no basta la
> autorización del numeral 10.4, literal b), y su conservación se rige por el numeral 10.6.

*(Y un 10.10 nuevo con el aviso y el consentimiento expreso. El dictamen recomienda NO hacerlo:
rechazar la firma visual en el código.)*

### 10.4(a) (H27, frase partida y atribución fina)

> **a)** La finalidad del numeral 10.3, literal f), se sustenta en el deber legal de conservar
> evidencia suficiente de la manifestación de voluntad y del proceso de firma. Este deber aparece en
> el artículo 2.2.1.1.12 del Decreto 1072 de 2015, que obliga a los empleadores a conservar los
> contratos de trabajo firmados electrónicamente garantizando su autenticidad, integridad y
> disponibilidad; en el numeral 3 del artículo 2.2.1.1.13 del Decreto 1072 de 2015, que obliga a que
> el contrato de trabajo firmado electrónicamente no pierda su validez, eficacia ni fuerza
> probatoria por la finalización de la relación laboral; y en el artículo 2.2.2.47.7 del Decreto
> 1074 de 2015, que presume el cumplimiento de los requisitos de firma electrónica respecto de los
> mecanismos pactados mediante acuerdo y cuyo parágrafo obliga a K+AIR, como parte que provee los
> métodos de firma electrónica, a asegurarse de que sus mecanismos son técnicamente seguros y
> confiables y a probar estos requisitos en caso de que sea necesario. La conservación de la prueba
> de la autorización otorgada por el Titular se sustenta en el artículo 2.2.2.25.2.5 del Decreto
> 1074 de 2015. Todas estas bases operan sin perjuicio de la autorización del Titular.

### 10.5 (fisión de las dos "huellas" — H-TC-10, H-TC-18 y C.1)

> **10.5. Forma de tratamiento y medidas de seguridad.**
>
> **a)** El número del documento de identidad **del Trabajador** se compara mediante huella digital
> con clave secreta (HMAC-SHA-256) y se conserva únicamente esa huella, no el número en texto
> claro.
>
> **b)** El código OTP y el token de acceso se conservan únicamente en forma de huella digital con
> clave secreta (HMAC-SHA-256), y nunca en texto claro.
>
> **c)** El documento se identifica por su huella digital SHA-256 y toda modificación de su
> contenido resulta detectable.
>
> **d)** Los registros de auditoría no pueden alterarse una vez escritos. Su supresión dentro de la
> ventana de purga gobernada conforme al numeral 8.6 no constituye una alteración del registro: da
> lugar a una lápida que identifica la solicitud, la fecha y hora de la supresión, las categorías
> suprimidas y el fundamento del plazo, y a un recibo que la Empresa entrega al Trabajador si este
> lo solicita. La prueba de la aceptación de este Acuerdo por el Trabajador subsiste a esa
> supresión, conforme al numeral 12.7.
>
> **e)** El acceso a la información está restringido al personal autorizado por la Empresa y por
> K+AIR, conforme a la política de seguridad de cada uno.
>
> **f)** Los operadores de infraestructura y de correo electrónico que intervengan en el servicio
> actuarán como Encargados y tratarán los datos únicamente conforme a las instrucciones de la
> Empresa y de K+AIR, en los términos del artículo 25 del Decreto 1377 de 2013.
>
> **g)** El número del documento de identidad **del representante legal de la Empresa** no se conserva
> en texto claro en la base de datos: se cifra con una clave mantenida fuera de la base de datos y
> bajo control de K+AIR, se restringe su acceso al personal autorizado y se muestra de forma
> enmascarada, indicando únicamente los cuatro (4) últimos dígitos. La huella digital SHA-256 de la
> identificación de la Empresa es el resultado de la aplicación de ese algoritmo a dicha
> identificación en claro, incluido el número completo del documento de identidad de su representante
> legal; no utiliza clave secreta, por lo que es reproducible por cualquier persona que conozca
> dicha identificación —la cual es de público conocimiento en el Registro Único Empresarial y
> Social— y sirve únicamente para acreditar que la identificación incorporada a la Constancia de
> firma electrónica no ha sido alterada. K+AIR no afirma que esta huella reserve el dato respecto
> de terceros.

### 10.6 (con el puente y el remiso al 8.6)

> **10.6. PLAZO DE CONSERVACIÓN POR CATEGORÍA DE DATO.** Los plazos de conservación se determinan
> por categoría de dato en la tabla de retención documental de la Empresa, que es su referencia
> vigente. Vencido el plazo y sin que exista un deber legal o contractual de conservación, incluido
> el deber de conservación del artículo 2.2.1.1.12 del Decreto 1072 de 2015, el dato se suprime
> conforme a la política de la Empresa y a las condiciones del numeral 8.6. La supresión de los
> registros de auditoría, del documento firmado y de la Constancia de firma electrónica se rige por
> el numeral 3.6, literal g), y por el numeral 10.5, literal d), y deja la lápida y el recibo allí
> previstos. Los plazos para los archivos del sistema de gestión de seguridad y salud en el trabajo
> son los que establezca la normativa de dicho sistema y, en su defecto, los de la tabla de
> retención documental de la Empresa.

### 10.7(b) (H-TC-16, corregido)

> **b)** Los derechos del Titular se ejercen ante la Empresa, en su calidad de Responsable del
> Tratamiento, a través del canal de atención que la Empresa tenga publicado en su política de
> tratamiento de datos personales. K+AIR, en su calidad de Encargado del Tratamiento, también atiende
> las solicitudes de los Titulares que le sean dirigidas. A tal efecto, K+AIR designa una persona o
> área que asuma la función de protección de datos personales y mantiene a disposición de los
> Titulares un mecanismo sencillo, ágil y permanentemente disponible, publicado en la pantalla de
> firma y en el Anexo de Encargo de Tratamiento de Datos Personales. K+AIR registra toda solicitud
> que recibe, la remite a la Empresa dentro de los dos (2) días hábiles siguientes a su recepción,
> con la evidencia que reposa en su custodia, e informa al Titular sobre el estado de su solicitud.
> La respuesta al Titular corresponde a la Empresa, en su calidad de Responsable del Tratamiento,
> dentro del plazo del numeral 10.7, literal d). K+AIR no resuelve por su propia cuenta los
> derechos del Titular, pero no puede dejar de atender las solicitudes que le sean dirigidas,
> registrarlas ni remitirlas a la Empresa.

### 10.7(c) (H25, atribución correcta)

> **c)** El Titular debe acreditar su identidad. El ejercicio de los derechos y el acceso a los
> datos son gratuitos, al menos una vez al mes calendario y cada vez que existan modificaciones
> sustanciales de la política de tratamiento. Para las consultas cuya periodicidad sea mayor a una
> por cada mes calendario, la Empresa solo podrá cobrar al Titular los gastos de envío, reproducción
> y, en su caso, certificación de documentos, de conformidad con el artículo 2.2.2.25.4.2 del Decreto
> 1074 de 2015.

### 10.7(e) (H28, corregida y mejorada)

> **e)** El Titular debe acudir primero a la Empresa o a K+AIR, en sus calidades de Responsable y
> Encargado del Tratamiento, conforme al artículo 15 de la Ley 1581 de 2012. Sólo procede acudir a la
> Superintendencia de Industria y Comercio una vez agotado el reclamo interno, de conformidad con el
> artículo 16 de la Ley 1581 de 2012, y la actuación de la Superintendencia se adelanta de acuerdo con
> el artículo 22 de la misma ley.

### 10.7(f) (H26, reapuntada)

> **f)** La solicitud de copia constituye un derecho de acceso del Titular, en los términos del
> literal f) del artículo 8 de la Ley 1581 de 2012 y del artículo 2.2.2.25.4.2 del Decreto 1074 de
> 2015, y no implica por sí misma un derecho de supresión. La supresión del dato y la revocatoria
> de la autorización no procederán cuando el Titular tenga un deber legal o contractual de
> permanecer en la base de datos, en los términos del artículo 2.2.2.25.2.6 del Decreto 1074 de
> 2015, conforme al cual el Responsable y el Encargado deben poner a disposición del Titular
> mecanismos gratuitos y de fácil acceso para presentar la solicitud de supresión de datos o la
> revocatoria de la autorización otorgada.

### 12.1 (Decreto 2364 y Decreto 526)

> **12.1.** El presente Acuerdo se rige por la ley colombiana y, en particular, por las siguientes
> disposiciones: Ley 527 de 1999; Decreto 2364 de 2012; Ley 1562 de 2012; Ley 1564 de 2012; Ley
> 1581 de 2012; Decreto 1377 de 2013; Decreto 1072 de 2015; Decreto 1074 de 2015; Decreto 526 de
> 2021; y las normas que los modifiquen, complementen o sustituyan. El Decreto 526 de 2021 adicionó al
> Decreto 1072 de 2015 los artículos 2.2.1.1.8 a 2.2.1.1.15, que regulan la firma electrónica del
> contrato individual de trabajo, y el Decreto 2364 de 2012 reglamentó el artículo 7 de la Ley 527 de
> 1999 sobre firma electrónica y fue compilado en el Capítulo 47 del Decreto 1074 de 2015.

### 12.3 (nombre oficial de la Resolución 0312)

> **12.3.** El régimen de los documentos del sistema de gestión de seguridad y salud en el trabajo se
> determina por la normativa de dicho sistema, por la Ley 1562 de 2012 y por la Resolución 0312 de
> 2019 del Ministerio de Trabajo, «Por la cual se definen los Estándares Mínimos del Sistema de
> Gestión de la Seguridad y Salud en el Trabajo SG-SST», en cuanto resulten aplicables. Para esos
> documentos las reglas del Capítulo VI no son de imposición legal directa, porque el artículo
> 2.2.1.1.13 del Decreto 1072 de 2015 está dirigido al contrato individual de trabajo, pero la
> Empresa se obliga contractualmente a aplicarlas en los mismos términos del numeral 6.2, con
> fundamento en el parágrafo del artículo 2.2.1.1.9 del Decreto 1072 de 2015.

### 12.7 (puente con el 10.5(d))

> **12.7.** La Empresa conserva la prueba de la aceptación de este Acuerdo por el Trabajador, junto
> con la versión aceptada, la huella digital de su texto, la fecha y hora y el identificador de la
> solicitud, de conformidad con el artículo 2.2.2.25.2.5 del Decreto 1074 de 2015, que obliga a
> conservar prueba de la autorización otorgada por los Titulares para el tratamiento de sus datos
> personales. Esta prueba subsiste a la supresión de que trata el numeral 8.6.

### Numerales adicionales que la coherencia exige

| Numeral | Texto propuesto |
|---|---|
| **5.4** | "…desde el propio enlace de firma, **mientras su vigencia**, sin costo alguno. **El vencimiento del enlace no extingue el derecho del Trabajador a obtener de la Empresa la copia de que trata el numeral 8.5.**" |
| **6.1(d)** | "**Parágrafo.** De conformidad con el parágrafo del artículo 2.2.1.1.13 del Decreto 1072 de 2015, el empleador garantiza que el mecanismo utilizado para la firma electrónica cumple con las condiciones establecidas en el artículo 2.2.2.47.4 del Decreto 1074 de 2015." *(es parágrafo, no literal)* |
| **6.2** | "Las reglas del artículo anterior son de cumplimiento obligatorio para el contrato individual de trabajo y sus adiciones, modificaciones y anexos. Para los demás documentos de la relación laboral que la Empresa remita a firma mediante este mecanismo, la Empresa se obliga contractualmente a aplicar las mismas reglas, con fundamento en el parágrafo del artículo 2.2.1.1.9 del Decreto 1072 de 2015. El incumplimiento de cualquiera de ellas es responsabilidad de la Empresa y no afecta al Firmante." |
| **8.1–8.4** | Marcar el salto de alcance: "…**respecto del contrato individual de trabajo y sus adiciones, modificaciones y anexos**, y, **por ampliación contractual en los términos del numeral 6.2**, respecto de los demás documentos de la relación laboral." |
| **8.4** | "Cuando sea necesario, la Empresa suministrará a las autoridades judiciales y a las de inspección, vigilancia y control en asuntos laborales y administrativas los documentos firmados electrónicamente que sean requeridos, a través del canal de atención de la Empresa, quien los solicitará a K+AIR por el medio previsto en el Anexo de Encargo de Tratamiento de Datos Personales." |
| **9.2** | "…**desplegado hasta su final**" (en vez de "leído en su totalidad"), salvo que se implemente la medición de lectura (H-TC-17) |
| **3.7(a)** | "…se remiten **únicamente al medio de contacto personal registrado por el Trabajador**, que no podrá ser un buzón corporativo o compartido…" (cierra el H-TC-05 en el texto) |

---

## 3. C.1 — La `empresa_hash` (SHA-256 sin sal): qué se acepta y qué no

**¿Es aceptable que una constancia diga eso? Sí, y es mejor que la frase anterior.** Pero con
tres advertencias.

**No hay ninguna prohibición.** El SHA-256 sin sal es el algoritmo correcto para las huellas de
integridad (el texto del Acuerdo, el documento), donde un tercero **debe** poder recalcular. No se
puede "salar" todo. Y no cambiar el algoritmo ahora es la decisión correcta: la columna
`empresa_hash` **no tiene marcador de algoritmo** (las filas viejas y las nuevas serían
indistinguibles), cambiarlo rompería la verificación de las constancias ya emitidas ("No
disponible") y **re-hashear evidencia archivada es reescribir prueba**.

**Pero hay tres problemas reales, y uno de ellos es de texto, no de código:**

1. **Veracidad (art. 4(d) Ley 1581).** La frase corregida —"solo quien conozca esa identificación
   completa puede recalcular la huella"— es cierta pero **engañosa en efecto**: la identificación de
   la Empresa (razón social, NIT, domicilio) es **pública** en el RUES, y el único término
   desconocido es el número de documento del representante, que es enumerable. La redacción debe decir
   que **es reproducible por quien conozca la identificación completa, la cual es de público
   conocimiento** (ya lo dice la literal g) propuesta en el 10.5). Un juez o un inspector leerá la
   frase vieja como una reserva que no existe.
2. **Identificabilidad por fuerza bruta.** La huella es un identificador **reversible por
   diccionario** del representante legal (dato de un tercero, que no ha autorizado nada).
   Publicada en una Constancia que se archiva, se comparte con la ARL, llega a un inspector o a un
   expediente. El riesgo no es que el firmante la lea —ya lo ve en pantalla— sino que el hash
   **circula** y permite acumular confirmaciones sobre un tercero a lo largo del tiempo. No hay
   norma que lo prohíba, pero los principios de circulación restringida (art. 4(f) Ley 1581) y de
   necesidad (art. 4 del Decreto 1377) lo acortan.
3. **La redacción del 10.5(a).** Hoy el 10.5(a) habla del "número del documento de identidad" sin
   decir de quién, y eso confunde el dato del Trabajador (HMAC, sin texto claro) con el del
   representante (cifrado, no hasheado). La propuesta de la literal g) lo resuelve.

---

## 4. Lo que el texto exige y el código todavía no tiene

| Lo que el texto nuevo promete | Lo que falta en el sistema | Tarea |
|---|---|---|
| El 8.6 con cinco condiciones, incluida **(iii) el aviso de 30 días** | No hay ningún aviso previo a la supresión | **Tarea nueva**: sistema de preaviso (o cambiar la redacción si no se quiere implementarlo) |
| El 8.6 con el **piso del contrato individual de trabajo** (el 2.2.1.1.12 obliga a conservar sin término) | No existe el campo que declara la Empresa si el documento es contrato individual, ni la condición que impide suprimirlo | **Tarea nueva**: `conservacion_por_deber_legal` + `norma_conservacion` (ver §8.3) |
| El 10.7(b): K+AIR **atiende, registra y trasmite** | No hay canal propio de datos personales, ni registro de solicitudes, ni trasmisión | **Tarea nueva** (paquete 9A) |
| El 3.7(a) y el 3.1: el OTP va **únicamente al medio personal del Trabajador** | Hoy el correo es el que registra la Empresa y la **Empresa puede redirigir** la invitación (D-02 sin implementar) | **D-02** (bloqueante del Capítulo IV) |
| El 3.4(g): la **versión vigente** en el momento de la firma | Hoy se muestra la versión ligada a la solicitud | **Tarea 10.4** |
| El 3.10 y el 10.5(g): el representante cifrado, la huella sin reserva | Hecho (8B y 8B-C) | — |
| El 8.5 versión A: copia permanente en 5 días | No hay entrega permanente de copias | **Tarea 9A** |
| El 8.2: el **registro de medios autorizados** del Trabajador | No existe | **Tarea 9A** (y la redacción del 8.2 entra en la 11A) |
| El 8.4: suministro a autoridades por un canal | No hay canal | **Tarea 9A** |
| El 3.6(g) y el 10.5(d): la lápida y el recibo | Hecho (8A.2) | — |
| La **firma visual** rechazada | **Hecho el 2026-10-20**: el campo `firma_visual_png` se quitó del esquema del commit (antes se aceptaba y se **ignoraba**: no se guardaba, no se incrustaba en el PDF ni entraba en la huella de evidencia) | — |
| El 10.7(b) exige que el evento de una solicitud de derechos quede **registrado** | La tabla de eventos de consentimiento **no es append-only** | **Migración 028** |
| El **Anexo de Nube** (alcance, subencargados, ubicación, respaldos) | No existe; y no se pueden identificar los subencargados sin la **Compuerta 0.6** (hosting y proveedor de correo) | **Compuerta 0.6** (bloqueante del Anexo) |

---

## 5. Lo que el abogado tiene que decidir

| # | Decisión | El tradeoff en una frase |
|---|---|---|
| 1 | ¿Variante A, A+piso declarado, o B con piso automático en el código? | A no promete de más; B protege más al Trabajador pero obliga al sistema a decidir qué se conserva sin término |
| 2 | ¿La firma visual se rechaza o se declara? | El dictamen recomienda **rechazarla**: no aporta al 47.4 y cuesta un consentimiento sensible |
| 3 | ¿La 8.5 se publica como versión A (con copia permanente) o se deja como está hasta la 9A? | Versión A es lo correcto, pero **no publicable sin la 9A** |
| 4 | ¿Las cinco condiciones del 8.6 se adoptan tal cual, o se ajustan al código? | Si el texto pone un aviso de 30 días y el sistema no lo tiene, el texto vuelve a mentir |
| 5 | ¿Se acepta la "declaración de contrato individual" como un campo más de la Empresa? | Es la forma menos mala deMarker el piso legal sin que el sistema adivine |
| 6 | ¿La 11A incluye la 8.5 y el 10.7(b), o van a la 11B? | Si van a la 11B, la v1.1 sigue prometiendo lo que no se cumple |
| 7 | ¿Quién es la persona/área de protección de datos de K+AIR y cuál es el canal? | Sin eso, el 10.7(b) no se puede publicar |
| 8 | ¿Se publica la v1.1 con el riesgo de la T1 (nube) o se espera a la 11A completa? | Si el servicio ya opera, la T1 es *stop-the-line* |
| 9 | ¿El bloqueo del D-03 se extiende al **commit** y a la **creación del consentimiento**? (El dictamen recomienda **sí** a los tres: el commit es donde nace la evidencia y puede ocurrir días después; el consentimiento ya es un tratamiento de datos) | Bloquear más protege más, pero deja sin poder firmar a un Trabajador cuya Empresa suspendió el Anexo: por eso la firma en papel (7.1–7.2) tiene que ser ejercitable el mismo día |
| 10 | ¿Se implementa `conservacion_por_deber_legal` como **campo explícito** que declara la Empresa, o se infiere del tipo de documento? (El dictamen recomienda el campo: la taxonomía de la API no es la taxonomía legal, y un motor automático arriesga sobre-retención o sub-retención) | Sin el campo, el 8.6 con el piso es letra muerta |

---

## 6. Riesgos que el owner debe conocer antes de lanzar

1. **T1**: si el servicio ya firmó con trabajadores reales, los textos publicados describen un
   mecanismo local que no es el real; el Decreto 1377 art. 5 exige **nueva autorización** cuando
   cambia la finalidad, y el Anexo de Encargo (art. 25) no describe el tratamiento real.
2. **8.6 + contrato individual de trabajo**: el 2.2.1.1.12 obliga a conservar sin término; la
   tabla de retención de la Empresa no puede extinguir ese deber, y hoy el sistema sí suprime.
3. **D-02 (buzón de la Empresa)**: el OTP puede llegar a un buzón corporativo; entonces la Empresa
   tiene los datos de creación de la firma y el 3.7(a) y el 47.4 quedan sin poder de aplicación.
4. **D-03**: con el bloqueo activo, una empresa sin Anexo o sin plazo no puede firmar. Hay que
   correr el inventario y avisar antes.
5. **10.4**: sin ella, publicar la v1.1 deja al trabajador que llega tarde con un 409 sin salida.
6. **`empresa_hash`**: es una huella de integridad, no una reserva de secreto; en la Constancia
   tiene que decirse así (ya se corrigió en el PDF) o un juez leerá una propiedad que no existe.
7. **La firma visual**: si se acepta, es un dato sensible sin base legal ni aviso.
8. **Eventos de consentimiento**: el registro de auditoría del consentimiento no es append-only
   (el de la firma sí): un borrado no lo detiene la base de datos.

---

> Documento preparado el 2026-10-20. Las fuentes normativas fueron verificadas por el subagente
> de asesoría legal contra la compilación jurídica del SENA, el Gestor Normativo de Función Pública
> y el Gestor Normativo CRA/MINTIC. Lo que no se pudo verificar en fuente oficial está marcado
> **⚠️ No verificado** en el cuerpo del dictamen.

---

# 7. Complemento del dictamen (C.2, C.3, C.4, D y E)

## 7.1 (C.2) El 1.2 y la asimetría mini-app ↔ constancia

**Veredicto**: la asimetría **es lícita y deliberada**, y hay que escribirla como tal (no como
contradicción).

| Superficie | Dato | Razón jurídica de la diferencia |
|---|---|---|
| Mini-app (pantalla de firma) | **NÚMERO COMPLETO** del representante | **Transparencia en favor del Trabajador**: debe poder contrastar contra el RUES. Es una pantalla efímera, uno a uno, al firmar |
| Constancia (documento archivado) | **ÚLTIMOS 4** | **Principio de necesidad** (art. 4 del Decreto 1377 = 2.2.2.25.2.1) y **finalidad** (art. 4(b) Ley 1581): la constancia se archiva, se copia, va a la ARL, a un inspector o a un expediente |
| Identificación de la Empresa | no es dato del Titular | Se trata **por cuenta de la Empresa** (10.2 literal h) |

El 1.2 actual tiene **tres defectos**: (1) trata la identificación como si fuera **el mismo dato**
en los dos sitios; (2) dice "con su propia huella digital" **sin decir el algoritmo**; (3) no dice
que la huella de la pantalla es la de la **fila viva** y la de la Constancia la de la **copia
archivada**: si la Empresa cambia sus datos entre la aceptación y la firma, **son dos huellas
distintas** y el Trabajador ve "la de hoy".

### Texto propuesto — 1.2 (reemplaza el actual en su totalidad)

> **1.2. IDENTIFICACIÓN DE LA EMPRESA.** Los datos de identificación de la Empresa (razón social,
> NIT, domicilio, representante legal y su documento de identificación, responsable interno del
> tratamiento de datos personales, sus canales de atención y la política de tratamiento de datos) se
> muestran al Firmante en el bloque «Empresa que solicita tu firma», que se presenta junto con este
> Acuerdo en la pantalla de firma. En esa pantalla se muestra el número completo del documento de
> identidad del representante legal, a efectos de que el Trabajador pueda contrastar la identidad de
> la Empresa con el Registro Único Empresarial y Social.
>
> La identificación de la Empresa que se incorpora a la Constancia de firma electrónica es la copia
> archivada en el momento de la aceptación de este Acuerdo, la cual se almacena cifrada y se
> muestra de forma enmascarada, indicando únicamente los cuatro (4) últimos dígitos del documento de
> identidad del representante legal, por tratarse de un documento que se archiva y puede ser
> compartido con terceros, incluida la autoridad laboral. Esta diferencia de tratamiento es
> deliberada, responde a la necesidad de que el Trabajador pueda contrastar la identidad de quien le
> solicita la firma y a la de que la Constancia, por su carácter de documento archivado, no difunda
> datos completos de un tercero, y no se extiende a los datos del Firmante.
>
> La Constancia incorpora la huella digital SHA-256 de la identificación de la Empresa tal como fue
> archivada en el momento de la aceptación, calculada sin clave secreta sobre la identificación en
> claro, incluido el número completo del documento de identidad del representante legal. La pantalla
> de firma muestra la huella digital SHA-256 de la identificación de la Empresa que está vigente en
> ese momento. Si la Empresa modifica sus datos de identificación entre la aceptación y la firma,
> ambas huellas difieren y el Firmante ve en pantalla la información vigente. Estas huellas acreditan
> que la identificación no ha sido alterada; no ofrecen reserva alguna frente a un tercero que
> conozca dicha identificación, la cual es de público conocimiento en el Registro Único Empresarial y
> Social.
>
> Ni la incorporación de esa identificación a la Constancia ni su huella alteran el texto ni la huella
> digital de este Acuerdo. El Firmante declara que conoce la identidad de la Empresa con la que se
> vincula por el documento que firma y que puede solicitar a la Empresa los datos que allí no
> figuren.

*Consistencias que exige: el 10.2 literal (h) y el 10.5 literal (g), ya redactados arriba.*

## 7.2 (C.3) El D-03: alcance del bloqueo y el contrato individual de trabajo

### ¿Justifica el 1.4 y el 8.6 bloquear la creación de la solicitud? **Sí, y no es una política
comercial: es una exigencia legal con dos fundamentos independientes.**

| Fundamento | Norma | Por qué bloquea |
|---|---|---|
| **El Anexo es el presupuesto del Encargado** | Decreto 1377 art. 25 (= 2.2.2.25.5.2): *"El contrato que suscriba el Responsable con los encargados… señalará los alcances del tratamiento, las actividades que el encargado realizará por cuenta del responsable… y las obligaciones del Encargado"* | Sin Anexo firmado **no hay base contractual para que K+AIR trate** |
| **El plazo es condición de la conservación legítima** | 8.6 + 10.6 + Decreto 1377 art. 11 (= 2.2.2.25.2.8) | Sin plazo declarado el 8.6 es incumplible desde el primer día y la conservación queda sin término **y** sin supresión: las dos caras del mismo artículo 11 |

**El bloqueo es correcto y debe sostenerse.** Dos precisiones: las dos condiciones deben ser
**separadas y declarables** (ya están: `anexo_encargo_firmado_at` y `plazo_retencion_dias`); y el
409 le llega a la **Empresa** (quien opera la API), no al Trabajador, que siempre tiene la vía del
7.2 (firma en papel).

### ¿Debe cubrir también el commit y la creación del consentimiento? **Sí a los tres, con un solo
helper.**

| Punto | ¿Bloquear? | Fundamento |
|---|---|---|
| Creación de la solicitud | **Sí** (lo que ya está) | Es donde nace el tratamiento como Encargado |
| **Commit de la firma** | **Sí — y es el más importante** | El commit (i) produce la evidencia que la Empresa debe conservar, (ii) hace exigible el aviso previo del 8.6 y (iii) **puede ocurrir días después**: la Empresa puede dar de baja el Anexo entre la creación y la firma y **obtener la firma igual**. El chequeo es una lectura indexada |
| Creación del consentimiento | **Sí** | El consentimiento **no es inocuo**: es un tratamiento de datos del Titular (correo, HMAC del documento, IP, user-agent, versión y hash aceptados) guardado por K+AIR como Encargado. Sin el contrato del art. 25, ese tratamiento tampoco tiene base |
| Firma dual (`createForCompany()`) | **Sí (explícitamente)** | Hoy queda cubierta indirectamente por el padre; la firma del representante es un tratamiento propio (correo, OTP, IP, aceptación) |

**Contrapartida que hay que diseñar**: si se bloquea la creación del consentimiento, un Trabajador
que ya aceptó la v1.0 y cuya Empresa suspendió el Anexo se queda sin poder firmar. Eso es **el
resultado correcto**, y por eso el 7.1–7.2 (firma en papel) tienen que ser **ejercitables** el
mismo día que esto se active.

### El contrato individual de trabajo: qué declara la Empresa y cómo se gobierna la supresión

> **2.2.1.1.12** (Decreto 1072, adicionado por el art. 1 del Decreto 526 de 2021): *"Los empleadores
> deberán conservar los contratos de trabajo firmados electrónicamente mediante los mecanismos
> técnicos que garanticen la autenticidad, integridad y disponibilidad de los documentos."* — **Sin
> término.**

La tabla de retención interna **no puede extinguir** ese deber. El D-03 de hoy (que exige un plazo
declarado) es **insuficiente** para el contrato individual: si la Empresa declara 5 años, el sistema
suprime el contrato al año 5 y el 2.2.1.1.12 queda incumplido.

| Campo | Tipo | Significado |
|---|---|---|
| `plazo_retencion_dias` | entero | Plazo de la tabla de retención aplicable a ese documento. **Es un mínimo, no una fecha de supresión** cuando el flag siguiente está activo *(ya existe)* |
| `canal_copia` | texto | Canal para ejercer la solicitud de copia *(ya existe; el 8.6 lo exige)* |
| **`conservacion_por_deber_legal`** | booleano | **Nuevo.** `true` cuando el documento es el contrato individual de trabajo o alguna de sus adiciones, modificaciones o anexos, o cuando exista cualquier otro deber legal o contractual de conservación sin término |
| **`norma_conservacion`** | texto | **Nuevo.** La norma que impone el deber (p. ej. "2.2.1.1.12 del Decreto 1072 de 2015"). Se comunica al Trabajador y se archiva con la solicitud |

**Por qué una declaración y no un motor automático**: (i) la ley solo establece el deber sin término
para el contrato individual de trabajo; (ii) la taxonomía de la API no es la taxonomía legal; (iii) un
motor automático arriesga **sobre-retención** (que choca con el mismo art. 11 que obliga a suprimir) o
**sub-retención** (y entonces el deber legal se extingue por tabla interna, que es exactamente la
contradicción). La declaración **pone la determinación legal donde la ley la pone: en el empleador**.
El `hold_legal` manual se conserva como red de seguridad independiente.

**Cómo se gobierna la supresión**: la 5B gana una condición **no renunciable** (no se suprime si
`conservacion_por_deber_legal` está activo en la solicitud); `fecha_conservacion` deja de ser una
fecha de supresión cuando el flag está activo (es un **piso**, no un techo); y la comunicación del
8.6 debe incluir el flag y la norma, para que el Trabajador sepa que su contrato **no se borra**.

## 7.3 (C.4) T1: nube vs. local

**No es un solo defecto: son dos, y el segundo se le olvida a todo el mundo.**

| # | Defecto | Quién queda sin base | Norma |
|---|---|---|---|
| **1** | El Trabajador autorizó un mecanismo **local**; el tratamiento real es **en la nube** de Gesstiar, con almacenamiento de archivos y correo por SMTP, y con otros subencargados | **El Titular** | Decreto 1377 art. 5 (= 2.2.2.25.2.2): *"…deberá obtener del Titular una nueva autorización cuando el cambio se refiera a la finalidad del Tratamiento"* |
| **2** | El **Anexo de Encargo** que el Capítulo X invoca describe un producto local ("copias de trabajo", "software local"). K+AIR está tratando **fuera del alcance** que el Anexo declara | **El Encargado (K+AIR)** y, por extensión, la Empresa | Decreto 1377 art. 25 (= 2.2.2.25.5.2) y el 10.1 del propio Acuerdo |

**El defecto 2 es el más grave y no aparece en el plan**: si el Anexo no describe la operación real,
K+AIR no es un Encargado dentro del contrato. **Eso no se arregla re-autorizando al Trabajador**: se
arregla firmando el Anexo de Nube.

⚠️ **No verificado — Compuerta 0.6**: la ubicación del hosting y el proveedor de correo. Si el
hosting está fuera de Colombia hay **transferencia internacional** (art. 26 Ley 1581 y art. 24.1 del
Decreto 1377); si el correo sale por un SMTP extranjero hay **transmisión internacional** (que, con
contrato del art. 25, no requiere información ni consentimiento, pero **debe constar en el Anexo y en
la política**). Hay que confirmarlo antes de cerrar el Anexo.

### Textos propuestos (variante nube)

> **1.4.** K+AIR, operada por Gesstiar S.A.S., es el proveedor del mecanismo de firma electrónica
> descrito en el Capítulo III. El servicio de firma electrónica se presta en la nube de Gesstiar
> S.A.S. K+AIR interviene como Encargado del Tratamiento de los datos personales a que se refiere
> el Capítulo X, por cuenta de la Empresa y únicamente dentro de los alcances, las finalidades y los
> plazos descritos en este Acuerdo, por medio de los servidores de Gesstiar S.A.S. y de los
> subencargados que se identifiquen en el Anexo de Encargo de Tratamiento de Datos Personales. K+AIR
> no es parte de la relación laboral ni asume obligación alguna frente al Trabajador por dicha
> relación. La relación entre la Empresa, como Responsable, y K+AIR, como Encargado, se rige por el
> contrato de transmisión de datos personales que la Empresa suscribe con K+AIR, en los términos del
> artículo 25 del Decreto 1377 de 2013, compilado en el artículo 2.2.2.25.5.2 del Decreto 1074 de
> 2015 (Anexo de Encargo de Tratamiento de Datos Personales), cuyo Anexo de Nube describe el alcance
> del tratamiento, las instrucciones de la Empresa, las medidas de seguridad, los subencargados, la
> ubicación de los servidores, la conservación de los respaldos, la política de supresión, los plazos
> y las demás condiciones de auditoría.

> **3.1.** El método pactado consiste en la generación de una firma electrónica por medio de un
> sistema de autenticación y verificación de identidad basado en un código de verificación de un solo
> uso, en adelante OTP, enviado al correo electrónico registrado por el Trabajador, previo enlace
> individual y de uso personal remitido por la Empresa. El servicio de firma electrónica se presta en
> la nube de Gesstiar S.A.S., operador de K+AIR; en consecuencia, el documento que el Trabajador
> firma, los datos que el Trabajador suministra y los registros del proceso de firma son tratados por
> Gesstiar S.A.S. por cuenta de la Empresa, en los términos del Capítulo X y del Anexo de Encargo de
> Tratamiento de Datos Personales. El Trabajador acepta expresamente esta modalidad de tratamiento al
> aceptar este Acuerdo.

> **3.7. a)** Los datos de creación de la firma, en el contexto en que son utilizados, corresponden
> exclusivamente al Firmante. En efecto, el OTP y el token de acceso se generan para una persona
> determinada, se remiten únicamente a la dirección de correo electrónico personal registrada para
> esa persona, que no podrá ser un buzón corporativo, compartido o de un tercero, tienen una vigencia
> breve y limitada, admiten un número acotado de intentos y no pueden ser utilizados por un tercero.
> El mensaje que contiene el OTP y el enlace de firma es remitido por Gesstiar S.A.S., operador de
> K+AIR, en nombre de la Empresa, con el nombre de la Empresa como remitente visible y con una
> dirección de respuesta monitoreada. La Empresa no puede redirigir el enlace de firma ni el OTP a una
> dirección distinta de la registrada por el Trabajador.

> **5.1. c)** Avisar de inmediato a la Empresa y a K+AIR, a través del canal de incidentes que K+AIR
> publica en la pantalla de firma, cualquier situación que comprometa la seguridad de sus datos de
> creación de la firma, tales como el acceso no autorizado a su correo electrónico, la pérdida de
> control del dispositivo desde el que accede al servicio o el conocimiento de que un tercero ha
> obtenido o ha utilizado su código de verificación o su enlace de firma.

> **8.7.** Si la conservación se efectúa mediante herramientas o sistemas externos, la Empresa
> responde por la integridad, disponibilidad y confidencialidad de la información a través de un
> contrato con el proveedor, en los términos del Capítulo X. Cuando la conservación se efectúe en los
> sistemas de Gesstiar S.A.S., el Anexo de Nube del Anexo de Encargo de Tratamiento de Datos
> Personales describe la ubicación de los servidores, la periodicidad y el plazo de conservación de
> los respaldos, la política de supresión en los respaldos y en las copias de seguridad, y los
> subencargados, y la Empresa conserva, respecto de ellos, las mismas garantías de autenticidad,
> integridad y disponibilidad del numeral 8.1. La supresión de que trata el numeral 8.6 alcanza a los
> respaldos dentro del plazo allí previsto.

> **10.1. Responsable y Encargado.** La Empresa es el Responsable del Tratamiento y K+AIR es el
> Encargado, conforme a las definiciones de los literales d) y e) del artículo 3 de la Ley 1581 de
> 2012. La identificación de la Empresa como Responsable es la del bloque «Empresa que solicita tu
> firma» del numeral 1.2. K+AIR trata los datos únicamente por cuenta de la Empresa, dentro de los
> alcances, finalidades y plazos de este Acuerdo y conforme al contrato de transmisión de datos
> personales suscrito entre las partes, en los términos del artículo 25 del Decreto 1377 de 2013,
> compilado en el artículo 2.2.2.25.5.2 del Decreto 1074 de 2015. El tratamiento se efectúa en la
> nube de Gesstiar S.A.S., operador de K+AIR, en los servidores y con los subencargados que se
> identifican en el Anexo de Nube del Anexo de Encargo de Tratamiento de Datos Personales, incluidos
> los operadores de infraestructura y de correo electrónico. La Empresa ha informado al Trabajador,
> antes de solicitarle la firma, esta modalidad de tratamiento.

> **1.5. IDENTIFICACIÓN DEL OPERADOR** *(ajuste menor, sin cambio de fondo)*. Los datos de
> identificación completos de Gesstiar S.A.S., incluyendo su domicilio, sus canales de atención y el
> canal de protección de datos a que se refiere el numeral 10.7, literal b), constan en el Anexo de
> Encargo de Tratamiento de Datos Personales, disponible en el sitio web de K+AIR. Dichos datos no
> forman parte del texto de este Acuerdo porque son susceptibles de cambiar y este Acuerdo, una vez
> publicado, no se modifica: cada versión tiene su propia huella digital. Este criterio es el mismo
> que el del numeral 1.2 para la Empresa.

### El Anexo de Encargo: schedule cloud mínimo (nueve bloques)

| # | Bloque | Contenido mínimo |
|---|---|---|
| 1 | **Alcance** | Las categorías de datos del 10.2 (incluida la h), las finalidades del 10.3, y los sistemas concretos: servicio de firma, base de datos, almacenamiento de archivos, envío de correo |
| 2 | **Instrucciones del Responsable** | El documento, la categoría, el plazo, el canal; el deber de K+AIR de seguir instrucciones documentadas; la prohibición de usar los datos para otra cosa; el deber de **notificar** cualquier cambio (y el derecho de la Empresa a oponerse) |
| 3 | **Seguridad** | Cifrado en tránsito y en reposo; llave **fuera de la base**; control de acceso (llave de administración + llaves por empresa); auditoría *append-only*; política de reemisión y revocación del token; prohibición de datos sensibles en correos, notificaciones y registros; procedimiento de respuesta a incidentes |
| 4 | **Subencargados** | **Identificación nominal**: hosting, almacenamiento de objetos, SMTP, backups, monitoreo, soporte. Con deber de notificar cambios y derecho de oposición. **Una cláusula genérica no cumple el art. 25.** ⚠️ Hoy **no están identificados** (Compuerta 0.6) |
| 5 | **Ubicación** | País de los servidores y de los respaldos; y el tratamiento de una eventual transmisión internacional (arts. 24 y 26 del Decreto 1377 y art. 26 de la Ley 1581). ⚠️ Pendiente de confirmar |
| 6 | **Respaldo (backups)** | Periodicidad, plazo de retención, cifrado, **supresión en los respaldos** (plazo ≤ al declarado, o *crypto-shredding*) y el `hold legal`. Sin esto, el 10.6 no se cumple aunque la fila desaparezca |
| 7 | **Retención** | Categorías y plazos de la tabla de la Empresa **y la excepción del contrato individual de trabajo** (conservación sin término, 2.2.1.1.12) |
| 8 | **Supresión** | La 5B, la lápida, el recibo, la supresión en respaldos, la atención del `hold legal`, y la devolución o destrucción al terminar el contrato |
| 9 | **Auditoría** | Derecho de la Empresa a auditar; periodicidad de los informes; y el soporte probatorio del parágrafo del 2.2.2.47.7 (K+AIR debe asegurarse de la seguridad técnica y probarla). Referencia opcional: **2.2.2.47.8** (peritaje y auditoría independiente) |

### Si el servicio **ya está operando** con trabajadores reales: *stop-the-line* en cuatro movimientos

| # | Movimiento | Base |
|---|---|---|
| **1** | **Cortar**: no nuevas solicitudes de firma bajo el texto v1.0 (ni bajo ningún texto que no sea el de nube) hasta cerrar la 11A y el Anexo de Nube | La v1.0 describe una operación que no es la real |
| **2** | **Re-autorizar**: la Empresa comunica el cambio al Titular y **obtiene una nueva autorización**. El mecanismo técnico es la **10.4**: la solicitud pendiente migra a la v1.1 y el Trabajador **lee y acepta la v1.1 en el momento de la firma**. **Sin la 10.4, la re-autorización es imposible** | Decreto 1377 art. 5 |
| **3** | **Vía en papel**: si un Trabajador no acepta la versión nube, la Empresa le debe procurar la firma autográfica, sin costo. El 7.1–7.3 y el 2.2.1.1.11 obligan a ello, y el 7.3 exige que el sistema lo diga | Decreto 1072 art. 2.2.1.1.11 |
| **4** | **Regularizar el Anexo retroactivo** y **no invalidar lo ya firmado**: las firmas hechas bajo la v1.0 son válidas (el método fue el mismo; la operación fue la que ocurrió). El defecto es de información y de Anexo, no de firma. (i) Firmar el Anexo de Nube con una declaración de lo que efectivamente se hizo; (ii) notificar a los trabajadores; (iii) re-recolectar la aceptación de la v1.1 para lo que siga. **La 10.4 no puede borrar la aceptación de la v1.0** | — |

**Lo que no hay que hacer**: no "dar de baja" las firmas existentes (no hay defecto de método) y no
publicar la v1.1 sin la 10.4 (el Trabajador que llega tarde recibe un 409 sin salida).

## 7.4 (D) Qué bloquea la v1.1 y qué espera a la v1.2

**Tres niveles distintos, que no hay que confundir**: (i) bloqueante para el **texto** (11A); (ii)
bloqueante para el **lanzamiento** (código); (iii) bloqueante para el **procedimiento** de
publicación.

### La 11A ajustada (lista cerrada)

| Grupo | Numerales | Hallazgos que cierra |
|---|---|---|
| **Nube (T1)** | 1.4, 1.5, 3.1, 3.7(a), 5.1(c), 8.7, 10.1 | T1 |
| **La contradicción §4 vs §8** | 2.2(a), 2.2(c), 4.5, 8.6 (+ el art. 2.2.2.25.2.8) | H-TC-01, H-TC-02, H-TC-03 + el piso del contrato individual |
| **La cadena de gobernanza (T5)** | preámbulo del 2.2 (2.2.1.1.8 + párr. del 2.2.1.1.9 + 2.2.2.47.7), 6.1(d), 6.2 | T5, H-TC-08, H1 del plan previo |
| **Citas del Capítulo IV** | 4.1, 4.2, 4.3, 4.4 | H-TC-06 + las 3 diferencias de la auditoría del Cap. IV |
| **Deberes del Firmante** | 5.1 (preámbulo + a) | T1 y T2 de la auditoría del Cap. V |
| **Atribución de la carga de la prueba** | 3.8 | H-TC-07 |
| **Huellas: vocabulario** | 3.4(d), 3.4(e), 3.6(e), 3.10 (nuevo), 10.5(a), 10.5(b), 10.5(g) (nuevo), 1.2 | H-TC-10, H-TC-13 (parcial), C.1 |
| **Tokens y versión** | 3.1, 3.3, 3.4(c), 3.4(g), 9.2 | H-TC-11, H-TC-17 |
| **Copia y conservación** | 5.4, 8.2, 8.3, 8.4, 8.5 | H-TC-04, H-TC-12, H-TC-15 |
| **Auditoría y purga** | 3.6(g), 10.5(d), 10.6, 12.7 | H-TC-09, H-TC-18 |
| **Datos personales** | 10.2 (h), 10.4(a), 10.7(b), 10.7(c), 10.7(e), 10.7(f) | H-TC-13, H-TC-16, H26, H27, H28 |
| **Ley aplicable** | 12.1, 12.3 | Decreto 526, Decreto 2364, nombre oficial de la 0312 |

**Corrección a la partición del plan previo: entran a la 11A el H-TC-04 y el H-TC-05.**

- **H-TC-04 (el 8.2)**: para el contrato individual de trabajo, el 2.2.1.1.12 párr. 2 exige el
  suministro *"a través de un medio electrónico **autorizado por el trabajador**"*. El registro de
  esa autorización no es una funcionalidad: es un **requisito normativo**. Si el 8.2 se publica como
  está y no hay registro ni vía, se publica una promesa falsa **sobre un derecho que la ley impone**.
- **H-TC-05 (el OTP)**: el 3.7(a) dice hoy que el OTP *"se remite únicamente al medio de contacto
  **registrado por la Empresa**"* — que es exactamente el defecto, y el defecto rompe el
  **2.2.2.47.4 num. 1** (los datos de creación "corresponden exclusivamente al firmante"), del que
  dependen los 3.7, 4.1, 4.2, 4.5 y todo el Capítulo IV.

**También entran a la 11A**: el 4.1, el 4.2, el 4.3 y el 5.1 (son el mismo tipo de defecto: el texto
afirma una atribución que la norma no tiene; publicarlos en dos tandas produce una v1.1 con la
mitad de las citas corregidas y cinco sin corregir).

### Bloqueante para el lanzamiento (código): no bloquea el texto, bloquea la operación

| # | Qué | Por qué bloquea |
|---|---|---|
| 1 | **La 10.4** | Sin ella, publicar la v1.1 deja al Trabajador que llega tarde con un **409 sin salida**, y la re-autorización del T1 es imposible |
| 2 | **La D-02** (rechazar el `correo_verificacion` de dominio corporativo) | Sin ella, el 2.2.2.47.4 num. 1 es inoperante y el Capítulo IV no tiene base material |
| 3 | **El flag `conservacion_por_deber_legal` en la 5B** | Sin él, el 8.6 con el piso es letra muerta: el texto promete un deber legal sin término y el código borra el contrato al vencer la tabla |
| 4 | **La 9A** (papel, medios autorizados, copia permanente, consulta a autoridades) | El 7.1–7.3, el 8.2, el 8.4 y el 8.5 prometen derechos sin canal |
| 5 | **Rechazar `firma_visual_png`** | **Hecho el 2026-10-20** (el campo se quitó del esquema del commit) |
| 6 | **El canal de datos de K+AIR + el registro de solicitudes** (10.7(b)) | Sin ellos, el 10.7(b) no es cierto |
| 7 | **Compuerta 0.6** (hosting y proveedor de correo) | Sin ellos, el Anexo de Nube no se puede cerrar y la transferencia internacional queda abierta |

### Bloqueante para el procedimiento de publicación

- **H-TC-19**: el Acuerdo DEV sembrado con el número **v1.0** impide publicar el legal en la misma
  base (409 `ACUERDO_VERSION_EXISTS`). Resolver **antes** de publicar; no es un numeral.
- El archivo `acuerdo-v1.0.txt` **no se toca**: la v1.1 es un archivo nuevo con su propia huella y su
  propio archivado (`archivar-acuerdo.js`).

### Lo que puede esperar a la v1.2 (11B)

| Qué | Por qué puede esperar |
|---|---|
| El texto íntegro de la **copia permanente** del 8.5 y el registro completo de medios del 8.2, con su vía de modificación | Dependen de la 9A. En la 11A se publica la versión que es cierta hoy |
| La **medición de la lectura** del 9.2 (H-TC-17) | En la 11A basta "desplegado hasta su final" |
| El **canal público de consulta** del 8.3 y del 8.4 | Es un producto nuevo, no una falsehood |
| El **10.10** (aviso y consentimiento expreso de la firma visual), si el owner decide conservarla | Depende de la decisión de producto |
| El ajuste fino del **5.1(a)** con las políticas de seguridad anexas | Depende de que exista un lugar donde anexarlas |
| La **firma del representante** en el mismo flujo (hoy es un flujo paralelo) | Producto |

**Paralelo a la 11A (no es 11A ni 11B, pero no puede esperar)**: actualizar `LEGAL.md` §8 para que
describa lo que el Acuerdo dice (H-TC-14) y corregir sus dos errores (art. 39 del CST, no 23; el
art. 28 de la Ley 527 no es "de firma digital").

## 7.5 (E) Riesgos que el owner debe conocer antes de lanzar

1. **T1 (defecto 2)**: si el servicio ya opera, K+AIR está tratando en la nube fuera del alcance
   que declara el Anexo que el Capítulo X le promete, y eso **no se arregla re-autorizando al
   Trabajador**, sino firmando el Anexo de Nube.
2. **T1 (defecto 1)**: la v1.0 pide una autorización para un mecanismo local y la operación real es
   en la nube: el art. 5 del Decreto 1377 obliga a **obtener una nueva autorización** y a ofrecer
   papel.
3. **El 8.6 con el contrato individual de trabajo**: la tabla de retención interna puede extinguir un
   deber de conservación sin término, y el documento firmado es la única prueba de las condiciones de
   la relación laboral.
4. **El 4.5 contra el 8.6**: el Acuerdo le promete al Trabajador que su firma conserva su fuerza
   probatoria mientras le da a la Empresa la potestad de borrar la única evidencia.
5. **El 3.7(a) y el OTP corporativo**: si el `correo_verificacion` es un buzón compartido, la Empresa
   tiene uno de los dos datos de creación de la firma y el 2.2.2.47.4 num. 1 falla sin que el
   sistema lo note.
6. **La 10.4 ausente**: publicar la v1.1 sin ella deja al Trabajador con un plazo y un 409 sin
   salida, y es también lo que impide la re-autorización del T1.
7. **El 10.2 cerrado y la firma visual**: *(verificado en el código el 2026-10-20: el campo se
   aceptaba y se ignoraba; ya se quitó del esquema. El riesgo real era la promesa falsa al
   cliente y una puerta abierta a futuro, no un dato tratado.)*
8. **El 10.7(b)**: el Encargado le afirma al Titular que no recibe sus solicitudes, cuando las
   2.2.2.25.4.4 y 25.4.2 le imponen designar persona/área y mantener mecanismos disponibles.
9. **La transferencia internacional (⚠️ sin verificar)**: si el hosting o el SMTP están fuera de
   Colombia, aplican el art. 26 de la Ley 1581 y el régimen de la SIC, y ni el Acuerdo ni el Anexo
   dicen una palabra de eso.
10. **El 8.5 ("en cualquier momento")**: el Trabajador tiene derecho a copia permanente y el sistema
    solo puede entregarla mientras el enlace viva (72/24 h).
11. **El 7.1–7.3**: el derecho a la firma en papel y la no-barrera de acceso al empleo existen solo
    en el texto, y el Trabajador que no puede usar el mecanismo ve un aviso de irreversibilidad y
    nada más.
12. **El 8.2 (medios autorizados)**: para el contrato individual de trabajo la ley exige el
    suministro "por un medio electrónico autorizado por el trabajador" y no hay ningún registro de
    esa autorización en ninguna parte.
13. **El 3.8**: el Acuerdo le endosa a la Empresa la carga de probar la seguridad técnica del
    mecanismo, cuando el parágrafo del 2.2.2.47.7 se la pone a K+AIR — que K+AIR no podría cumplir
    con su propio texto.
14. **El 4.4**: la cita es fiel, pero la propuesta de la auditoría del 19-Oct habría metido un error
    nuevo (la condición "tachados de falso" no aplica a los mensajes de datos).
15. **La `empresa_hash`**: es reversible por diccionario, identifica al representante legal y circula
    en un documento archivado y compartido; el texto no debe insinuar que reserva nada.
16. **El H-TC-19**: con el Acuerdo DEV sembrado como v1.0, el legal no se puede publicar en esa base.
17. **El 4.1**: cita el 2.2.2.47.5, cuya remisión al 2.2.2.43.3 está hoy caída en el "PRESUPUESTO
    ANUAL de las Cámaras de Comercio".

### Fuentes oficiales consultadas (2026-10-20)

| Norma | Artículos | Enlace |
|---|---|---|
| **Ley 1564/2012** | 243, 244 (párr. 2 y 5), 247 | `normograma.sena.edu.co/compilacion/docs/ley_1564_2012_pr008.htm` |
| **Ley 1581/2012** | 3, 4, 5, 6, 8(f), 15, **16**, 22, 26 | `funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981` |
| **Decreto 1377/2013** (= 2.2.2.25.x del 1074) | 4, 5, 6, 8, 9, 11, 21, 23, 24, 25 | `normograma.sena.edu.co/compilacion/docs/decreto_1377_2013.htm` |
| **Decreto 1072/2015** | 2.2.1.1.8 – 2.2.1.1.15 (y el párr. del 2.2.1.1.9) | `normograma.sena.edu.co/compilacion/docs/decreto_1072_2015_pr001.htm` |
| **Decreto 1074/2015, Cap. 47** | 2.2.2.47.1 – 2.2.2.47.9 | `normograma.sena.edu.co/compilacion/docs/decreto_1074_2015_pr038.htm` |
| **Decreto 526/2021** | art. 1 (añade los 2.2.1.1.8–.15) — DO 51.679 del 19/05/2021 | Notas de vigencia del Decreto 1072 |
| **Decreto 2364/2012** | arts. 1–8 (compilados en el Cap. 47 del 1074) — 22/11/2012 | Remisiones en las notas de vigencia del Cap. 47 |
| **Resolución 0312/2019** | título oficial — DO 50.872 del 19/02/2019 | `normas.cra.gov.co/gestor/docs/resolucion_mtra_0312_2019.htm` |
| **Ley 1562/2012** | título oficial | `funcionpublica.gov.co/eva/gestornormativo/norma.php?i=48365` |

**⚠️ No verificado en esta revisión**: (a) la ubicación del hosting y el proveedor de correo
(Compuerta 0.6); (b) la vigencia del **Decreto 661 de 2026** (la compilación del SENA no es prueba
primaria de vigencia: eso es el Diario Oficial); (c) si la imagen PNG de la firma visual se inserta o
no en el PDF firmado (define el tratamiento del 10.2 literal (i) — aunque el campo ya no se acepta).
