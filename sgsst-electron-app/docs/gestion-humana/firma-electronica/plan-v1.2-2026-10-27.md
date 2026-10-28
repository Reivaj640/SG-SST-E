# Plan de la v1.2 del Acuerdo — qué hay que cambiar y por qué

**Fecha:** 27-oct-2026
**Origen:** revisión del abogado del 27-oct-2026 sobre la v1.1 (3 críticos, 6 problemas de
coherencia, 3 de datos personales, 2 de conservación, 8 controles técnicos).
**Estado:** plan de redacción. Los textos definitivos los redacta el padre (o un worker con esta
especificación) y vuelven al abogado como un paquete nuevo.
**Decisiones del owner ya tomadas:** canal de correo = **salida B** (documentar la transferencia,
sin cambiar de proveedor) · datos sensibles = **prohibición** de subir documentos con datos de
salud · 📦978 de código = **núcleo** (medio, Constancia, bloqueo del OTP).

---

## 0. Qué es la v1.2 y cómo se arma

- **Base:** la v1.0 sellada (`scripts/fixtures/acuerdo-v1.0.txt`). La v1.1 **nunca se publicó** (no
  tiene autorización operativa registrada, y el archivo ni siquiera viaja en el tar), así que sus 53
  cambios son borrador: la v1.2 los incorpora y suma las correcciones de esta revisión.
- **No se parchea la v1.1**: el empalme siempre sale de la base sellada, para que la cadena de
  custodia sea una sola y verificable.
- **Mecánica:** hoy `scripts/empalmar-acuerdo-v1.1.js` tiene fijados `DEFAULT_BASE` y
  `DEFAULT_CAMBIOS` y no acepta un `--cambios`. Para la v1.2 hay que decidir: (a) agregar las
  banderas `--base` y `--cambios` al script y reutilizarlo, o (b) crear
  `scripts/empalmar-acuerdo-v1.2.js`. La opción (a) evita dos copias del empalme, que es la
  trampa de la duplicación. **Pendiente de decisión técnica.**
- **Claves nuevas del JSON:** el empalme acepta `cambios` (reemplaza un numeral que existe en la
  base), `inserciones` (numeral nuevo, con su ancla), `absorbe` (quita literales) y
  `reemplazos_texto` (coincidencia exacta y **única**). Todo numeral que hoy no está en el JSON
  y hay que modificar **entra como clave nueva en `cambios`** (no hace falta tocar la v1.0).

---

## 1. Corrección 1 — la regla del medio de recepción del OTP

**Numerales:** 3.1, 3.3, 3.4(e), 3.7(a). Es el Crítico 2 y el Crítico 3 del abogado.

**El problema, con el texto literal de la v1.1:**

- 3.7(a): "Si no cuenta con una dirección personal, el mecanismo electrónico no se utiliza y la
  firma se hace en papel, **conforme al 3.3**."
- 3.3: "Cuando no hay medio personal confirmado ni indicado, el sistema remite el código al
  contacto registrado por la Empresa…"
- 3.4(e) (párrafo 2): "Cuando esa comprobación está habilitada, el sistema rechaza la solicitud y
  ofrece la firma en papel del 7.2; **mientras no lo esté, el sistema remite el código al contacto
  registrado por la Empresa**…"

El numeral que prohíbe remite al numeral que permite. Y el 3.4(e) describe un comportamiento que,
después del 📦978, **ya no existe**: el rechazo del buzón corporativo es incondicional.

**La redacción del abogado, literal** (va en el v1.2, sustituyendo la regla de 3.3, 3.4(e) y
3.7(a) por una sola):

> **Regla de verificación del medio de recepción del OTP**
>
> El código OTP se enviará únicamente al medio de recepción que el Firmante haya confirmado en la
> pantalla de firma, de acuerdo con las condiciones de seguridad previstas en este Acuerdo. La
> comprobación técnica del medio deberá estar activa y haber superado las verificaciones definidas
> por K+AIR antes de habilitar el envío.
>
> Si el sistema no puede comprobar la condición exigida, si la comprobación está deshabilitada o
> si el medio no cumple las condiciones previstas, el sistema no enviará el OTP a una dirección
> alternativa registrada por la Empresa ni permitirá completar la firma electrónica. En tal caso,
> informará al Firmante y ofrecerá la firma autógrafa sobre papel, sin costo ni consecuencias
> adversas por elegirla.
>
> El registro del evento de bloqueo servirá como evidencia de la contingencia, pero no reemplazará
> la comprobación de seguridad ni autorizará a continuar por un medio que no cumpla las condiciones
> establecidas.

**Condición para incorporarla (la puso el abogado y hay que respetarla):** solo si el código
realmente bloquea el flujo. El 📦978 es lo que la habilita: (a) el buzón corporativo se rechaza
siempre, (b) la confirmación es obligatoria para cualquier destino, (c) el bloqueo del OTP es duro.

**Efectos colaterales del texto, que hay que ajustar en el mismo paquete:**

- El 3.4(e) actual dice "la solicitud queda bloqueada y **se requiere un nuevo OTP o una nueva
  solicitud**". Con el bloqueo duro (📦978), queda "**y se requiere una nueva solicitud**".
- El 3.1 y el 3.3 que hoy describen el envío al contacto registrado de la Empresa como
  alternativa **se reescriben**: no hay alternativa. El 3.3 deja de ser "el caso en que no hay
  medio" y pasa a ser parte de la regla única.
- El 3.7(a) deja de remitir al 3.3 y remite a la regla nueva.
- El 3.4(b) no cambia (el enlace por la cuenta de la Empresa).
- **El 3.4(e) y el 10.5(f)(iii) que hoy dicen que el aviso `OTP_MEDIO_CORPORATIVO` queda "en el
  registro de operaciones del servicio"**: con el 📦978 eso pasa a ser cierto (el evento queda en
  `gh_firma_eventos`, que es append-only). Se puede mantener la frase y se vuelve verificable.

**La afirmación que hay que BORRAR (Crítico 3):** el texto no puede describir como verificada la
independencia de los factores si el sistema no puede garantizarla. Revisar cualquier frase del
Capítulo III que afirme que el enlace y el OTP "son dos factores independientes" sin condicionar
al medio confirmado.

---

## 2. Corrección 2 — publicación de versiones y aceptación (3.4(g), 9.4, 9.5)

**Numerales:** 3.4(g) (cambia), **9.4** (no está en el JSON → clave nueva), 9.5 (cambia).

**El problema:** el 3.4(g) distingue publicar de aceptar ("las correcciones editoriales —las que no
alteran el sentido de la disposición— no exigen una aceptación nueva"), pero el 9.4 reproduce la
regla de publicación sin esa excepción y el 9.5 exige aceptación "en el momento mismo de la firma"
para toda versión nueva. Si una corrección editorial es "un cambio de texto", se publica como
versión nueva y el 9.5 exigiría aceptación: contradicción.

**Qué hacer:** distinguir dos cosas que hoy están mezcladas:
1. **Corregir una copia ya publicada sin alterar el texto aceptado** (por ejemplo, una errata de
   formato o una corrección que no altera el sentido): se corrige la copia, **el texto aceptado y
   su huella no cambian**, y no hay aceptación nueva.
2. **Publicar una versión nueva** (todo cambio de texto que altere el sentido): se publica con su
   huella, y a partir de su entrada en vigor las firmas siguientes requieren leerla y aceptarla.

El 9.4 y el 9.5 deben decir lo mismo que el 3.4(g), con la misma distinción.

---

## 3. Corrección 3 — conservación: el "máximo del literal h" (8.6(c), 8.6(h), 12.7)

**Numerales:** 8.6 (clave única que contiene a–h), 12.7.

**El problema:** el 8.6(h) no fija un máximo: "se aplica el término de prescripción de la acción
que corresponda —tres (3) años… y cinco (5) años…— y, si ninguno fuere aplicable, el plazo mínimo
necesario para la finalidad, que la Empresa documentará y que no podrá ser indefinido". Eso es un
**menú con un mínimo**, no un tope. Pero el 8.6(c) y el 12.7 lo invocan como "el máximo".

**Qué hacer (el abogado lo dijo):** "No debe llamarse 'máximo' a un criterio sin límite temporal
concreto" y "Reemplazar la referencia al 'máximo' por una regla basada en una tabla de
conservación por categoría documental; cada plazo necesita fundamento y punto de inicio
identificable."

**La tabla** va como anexo al Anexo de Encargo o como literal nuevo del 8.6, con columnas: categoría
documental · plazo · fundamento (deber legal / plazo de la finalidad) · punto de inicio · qué pasa
con la revocatoria.

**Consecuencia que hay que decidir con el owner (ver §12):** el 8.7 promete que la supresión
alcanza a los respaldos, y hoy **no** es cierto (los respaldos no se cifran, se podan por edad a 30
días y la supresión no los toca). Mientras el trabajo de respaldos esté aplazado, el v1.2 solo tiene
dos salidas: decir la verdad (y el abogado puede rechazarlo) o hacer el trabajo de respaldos antes
de publicar el v1.2. **El texto no puede prometer lo que el código no cumple** (trampa 99).

---

## 4. Corrección 4 — los anexos en la Constancia (1.5, 3.6)

**Numerales:** 1.5 (cambia, y arrastra 1.6 y 1.7 porque es una clave compuesta), **3.6** (no está
en el JSON → clave nueva).

**El problema:** el 1.5 promete que los anexos "constan, con su identificador y huella SHA-256, en
el Anexo de Encargo y en la Constancia de cada firma", pero el listado del 3.6 no los menciona, y
**en el código no existían** (cero coincidencias de "anexo" en los generadores de Constancia). El
📦978 los agrega: la Constancia lleva la versión y la huella de cada anexo, y la fila de la firma
los guarda en columnas propias.

**Qué hacer:** enumerar en el 3.6 los registros que ahora existen, incluido el identificador y la
huella del Anexo de Encargo y la del Anexo de Nube, y en qué momento se toma cada uno (la del
Anexo de Encargo, en la versión que esa Empresa aceptó; la del Anexo de Nube, en su versión
firmada, o en el modelo si no hay copia firmada). Ajustar el 1.5 si la redacción no coincide con
lo que el código genera.

**Atención:** el 3.6 **no** está en el JSON de cambios, así que hay que crearlo como clave nueva.

---

## 5. Corrección 5 — la base jurídica no puede ser una autorización general (10.4(b), 10.7, Manifestación)

**Numerales:** 10.4(a) (cambia), **10.4(b)** (no está en el JSON → clave nueva), 10.7 (cambia),
10.7(a) (no está → clave nueva si hace falta), Manifestación de Voluntad (heredada, sin clave).

**El problema (3.1 del abogado):** el 10.4(b) dice que "las demás finalidades se sustentan en la
autorización expresa, informada y separable otorgada por el Titular al aceptar este Acuerdo". Es
una cláusula general que cubre cualquier tratamiento presente o futuro. Y el abogado da tres
razones: no todo necesita consentimiento; en una relación laboral el consentimiento merece
especial atención por la asimetría de poder; y revocar no significa borrar lo que se debe
conservar ni habilita a seguir indefinidamente.

**Qué hacer:** la **matriz de finalidades** que el abogado pide (finalidad × categoría de datos ×
base jurídica × responsable de decidirla × plazo × consecuencias de la revocatoria). Va en el
Anexo de Encargo (§5 y §6) y su resumen, en el Capítulo X. El 10.4(b) pasa a decir que cada
finalidad tiene su base jurídica en la matriz, y que la autorización del Trabajador cubre solo las
finalidades que efectivamente listan esa base.

**El punto 3 de la Manifestación** ("Autorizo de manera expresa, informada y separable el
tratamiento de mis datos personales en los términos y con las finalidades del Capítulo X") tiene
que ajustarse a la matriz: si la autorización deja de ser general, el texto de la Manifestación
también.

---

## 6. Corrección 6 — datos sensibles de salud (10.8, 10.8(b))

**Numerales:** 10.8 (cambia), **10.8(b)** (no está en el JSON → clave nueva), 10.8(a) y 10.8(c)
(cambian).

**Decisión del owner:** **política 1** — el servicio no acepta documentos con datos sensibles de
salud. La Empresa conserva el documento original; la plataforma no necesita ese dato.

**Qué hacer:**
- Declarar la prohibición de forma expresa, con su fundamento (art. 5 Ley 1581 y art. 2.2.2.25.2.3
  del Decreto 1074: el tratamiento de datos sensibles de salud tiene reglas propias) y con lo que
  pasa si ocurre (la Empresa responde por el documento que sube; el servicio no lo trata más allá
  de la firma y no lo reenvía a terceros).
- **No prometer detección automática.** La verificación es una **declaración expresa y trazable de
  la Empresa por documento** (el 📦978 la exige al crear la solicitud y la registra en el registro
  append-only, atada a la huella del PDF). El 10.8(b) actual prohíbe *condicionar* al dato
  sensible; no prohíbe *cargarlo*: ese es el hueco.
- El texto debe decir que la casilla de aceptación general **no** es suficiente para datos de
  salud, y que por eso la declaración es específica por documento.

---

## 7. Corrección 7 — el canal de correo: salida B (10.1, 10.5(f))

**Numerales:** 10.1 (cambia), 10.5(f) (cambia).

**Decisión del owner:** salida B. Se mantiene el Gmail de consumo y la condición **se cierra**:
deja de ser "una condición contractual pendiente" y pasa a ser una descripción de la operación
jurídica.

**El encuadre (ver `evaluacion-canal-correo-2026-10-27.md`):** el canal es una **transferencia
internacional** a Estados Unidos —país con nivel adecuado de protección en la Circular Única de la
SIC, Título V, numeral 3.2— en la que el destinatario (Google, con una cuenta de consumo) actúa
como Responsable; y la **autorización expresa del Titular no es lo que hace falta** para esta
operación, porque el destino tiene nivel adecuado (es la excepción del art. 26(a) de la Ley 1581,
que solo opera cuando el destino no lo tiene).

**Qué debe decir el texto:**
- Qué operación es (transferencia, no transmisión), hacia dónde (EE.UU.), en qué calidad Google
  (Responsable bajo sus propias condiciones, no Encargado ni subencargado).
- Cuál es la base: nivel adecuado de protección + el deber de **demostrar medidas** (responsabilidad
  demostrada) + la validación conforme a la Circular 2 de 2025 de la SIC (transferencias de
  tecnología) + la declaración de la transferencia en el RNBD.
- Qué se hace: el detalle de las medidas (cifrado en tránsito y en reposo, clave SMTP cifrada con
  llave maestra fuera de la base, HMAC de identidad y OTP, control de acceso, registro append-only,
  trazabilidad de envíos, purga documentada) y dónde se documenta.
- **Y qué NO es:** no es una autorización del Titular, y no es un Encargado.

**Lo que hay que tener a mano antes de escribir el numeral:**
- Confirmar si Gesstiar está inscrita en el RNBD y si la transferencia internacional está declarada.
- LaDeterminación escrita del rol de Google, en el expediente.

**Aparte:** el Anexo de Nube (fila del proveedor de correo) y el Anexo de Encargo (§5 y §6) deben
decir lo mismo, con las mismas palabras. El "estado" de la condición en el manifiesto
(`legal-readiness.json`) tiene que dejar de ser "pendiente".

---

## 8. Corrección 8 — el 3.6(g) y el 10.5(d) tienen que describir la capacidad real

**Numerales:** 3.6(g) (cambia), 10.5(d) (cambia).

Hoy los dos dicen lo mismo ("los registros de auditoría no se alteran", con la salvedad de la
lápida). El abogado: "La inalterabilidad de la bitácora no se demuestra por declararla" y pide
describir **la capacidad efectivamente implementada**.

**Lo que el código sí hace (verificado):** `gh_firma_eventos` con disparadores de base que impiden
UPDATE y DELETE (migración 020); la lápida y el recibo en la ventana de purga; el 410
`CONSERVACION_VENCIDA`; el *hold* mientras subsista el deber legal.

**Lo que no hace:** cifrar los respaldos, purgar los respaldos, y la poda por edad a 30 días ignora
el *hold*. **Esto es lo que decide el §12.**

---

## 9. Corrección 9 — las referencias normativas (12.1, 12.2)

**Numerales:** 12.1 (cambia), **12.2** (no está en el JSON → clave nueva).

Uniformar la cita del Decreto 1377 de 2013 con la nota de compilación (artículos 24 y 25
compilados en los artículos 2.2.2.25.5.1 y 2.2.2.25.5.2 del Decreto 1074 de 2015), como ya se
hace en el 10.8(a). El 12.1 y el 12.2 no pueden listar la norma de origen y la compilada como si
fueran dos regímenes distintos.

---

## 10. Corrección 10 — la identificación del representante legal (1.2, 10.5(g))

**Numerales:** 1.2 (cambia), 10.5(g) (inserción existente: se edita su texto).

**El problema (3.3 del abogado):** el 1.2 dice que "En esa pantalla se muestra el número completo
del documento del representante legal, para que el Trabajador pueda contrastarlo con el Registro
Único Empresarial y Social". Y el 10.5(g) ya dice que la huella "no reserva el dato frente a
terceros" y que es "reproducible por quien conozca esa identificación, pública en el RUES".

**Matiz que importa:** ningún numeral dice que el número completo se guarde en la Constancia: lo
que se guarda es la huella, y se muestran los últimos cuatro dígitos. El riesgo real es que **la
huella no es una medida de confidencialidad**, no que el número quede expuesto.

**Qué hacer:** (a) mantener el 10.5(g) como está: es honesto, y que el propio texto reconozca la
debilidad de la huella es parte de lo que el abogado está validando; (b) justificar en el texto **por qué** se muestra el número completo en pantalla y en
qué situaciones, o sustituirlo por una comprobación que no lo exponga (por ejemplo, que el
Trabajador confirme que la Empresa quedo correctamente identificada, sin ver el número). El
trabajo real es la **justificación de necesidad y proporcionalidad**, y esa justificación debe
quedar escrita.

---

## 11. Corrección 11 — el 1.2 y el 3.6(h): cuándo se archiva la identificación

**Numerales:** 1.2, **3.6(h)** (no está en el JSON → clave nueva si se toca), 3.4(i) (no está).

**El problema, atenuado por el 1.2:** el 1.2 **ya dice** que lo incorporado a la Constancia es "la
copia archivada al momento de la aceptación", y además neutraliza el desajuste temporal ("Si la
Empresa cambia sus datos entre la aceptación y la firma, las huellas difieren"). Así que no hay
contradicción: lo que falta es **definirlo** en el listado del 3.6, que hoy no dice nada del
momento en que se archiva. El texto que de verdad genera la Constancia después de la firma es el
3.4(i).

**Qué hacer:** en el 3.6, decir que la identificación de la Empresa se archiva **al momento de la
aceptación** y que la Constancia lleva su huella, y que la Constancia se genera después de la
firma (3.4(i)) pero con esa huella archivada.

---

## 12. La consecuencia que hay que decidir con el owner antes de redactar el v1.2

**El 8.7 no se cumple.** El texto dice que la supresión del 8.6 "alcanza a los respaldos dentro del
plazo allí previsto", y el código no lo cumple: los respaldos no se cifran, la supresión no los
toca y la poda por edad a 30 días ignora el *hold*.

El owner aplazó el plan de seguridad (respaldos cifrados, copia fuera del servidor) el 25-oct, y
eligió el núcleo del 📦978 sin los respaldos. **Esa decisión choca con el 8.7**, y el texto no puede
prometer lo que el código no cumple. Hay tres salidas y son decisiones del owner:

1. **Hacer el trabajo de respaldos antes de publicar el v1.2** (cifrar, purgar, poda que respete
   el *hold*). Es lo que hace que el 8.7 sea cierto.
2. **Decir la verdad en el v1.2**: la supresión no alcanza los respaldos, que se conservan treinta
   (30) días sin cifrar, y la Empresa debe conocerlo. Es honesto, y es una promesa más débil que
   el abogado puede rechazar.
3. **Declarar el compromiso con plazo**: "K+AIR implementará el cifrado y la supresión de los
   respaldos antes del (fecha)". Deja el compromiso escrito y con fecha, y la v1.2 se publica
   después de cumplirlo.

**La recomendación del padre:** la 1, porque el 8.7 es de los hallazgos que el abogado marcó como
"crítico" del lado de la conservación, y porque el respaldo es donde vive la copia de los datos de
salud que la decisión de prohibirlos obliga a que se eliminen.

---

## 13. Resumen de las claves que hay que tocar en el JSON de la v1.2

**Reemplazos (clave existente en el JSON):** 3.1, 3.4(b), 3.4(g), 3.4(e), 3.7(a), 8.6, 9.5, 1.2,
1.5, 10.1, 10.4(a), 10.5(d), 10.5(f), 10.7, 10.8(a), 10.8(c), 12.1, 12.7.

**Claves nuevas (numerales que hoy vienen de la v1.0 y hay que modificar):** 9.4, 12.2, 3.6
(cabecera y listado), 3.6(h), 10.4(b), 10.8(b), y la 3.6(i) si se decide enumerar por separado la
identificación de la Empresa.

**Inserciones nuevas (numerales que no existen):** la regla del medio, si se decide que sea un
numeral propio (3.4(f) seria el candidato natural, insertado después de 3.4(e), y el 3.4(e) se
queda con la parte del OTP); el literal de la matriz de finalidades; el literal de la declaración
de datos sensibles, si va en el Acuerdo y no solo en el Anexo de Encargo.

**Reemplazos de texto libre (`reemplazos_texto`):** el párrafo de cierre del 10.3 y cualquier
otro texto suelto que hay que ajustar. Cada uno exige coincidencia **exacta y única**: si el texto
base cambio, el empalme se niega en vez de aplicar el reemplazo a medias.

**Absorciones (`absorbe`):** si la regla del medio se lleva por completo el 3.4(e), el literal o
párrafo que se queda sin contenido se absorbe.

---

## 14. Lo que hay que llevarle al abogado en el próximo paquete

1. El texto de la v1.2 completo (no un diff: el texto final, con su huella).
2. La **tabla de conservación** por categoría documental.
3. La **matriz de finalidades** y base jurídica.
4. La **declaración de los datos sensibles** y el procedimiento de la declaración por documento.
5. La **evaluación del canal de correo** ya escrita
   (`evaluacion-canal-correo-2026-10-27.md`), con laDeterminación del rol de Google y el estado del
   RNBD.
6. La **constancia técnica** de los ocho controles, con la evidencia (`archivo:linea`) y el
   resultado de las pruebas, incluidas las de fallo.
7. Las **tres preguntas puntuales** que quedan abiertas para el abogado:
   (a) ¿el rol del destinatario debe determinarse desde los términos del proveedor o desde la
   operación concreta?
   (b) ¿la Circular 2 de 2025 exige comunicación previa a la Delegatura en este caso, o basta la
   declaración en el RNBD?
   (c) con la salida B, ¿qué redacción del Anexo de Encargo deja la base de la transferencia
   declarada de forma que el abogado pueda considerarla suficiente?
