# Auditoría del Capítulo IV — Efectos jurídicos (citas normativas del Acuerdo de uso v1.0)

**Fecha**: 2026-10-19
**Alcance**: Capítulo IV del Acuerdo de uso (`scripts/fixtures/acuerdo-v1.0.txt`, líneas 212-236): los cinco numerales 4.1 a 4.5 y **cada una de las normas que citan**.
**Motivo**: este Capítulo estaba dado por cerrado en el plan, pero su registro en el repositorio no existía. Al auditar el Capítulo V se hizo la verificación de sus citas contra fuente oficial y aparecieron dos diferencias y una omisión.
**Método**: descarga de la compilación oficial y extracción local de cada artículo (sin truncamiento), cotejo literal con el texto del fixture.
**Resultado**: 2 de las 5 citas son fieles; 2 son paráfrasis que se presentan como transcripción; el Acuerdo no cita el artículo que contiene los requisitos materiales (2.2.2.47.4).

> **Este documento no modifica el texto legal.** Las propuestas van para el abogado.

---

## 1. Fuentes oficiales

| Fuente | URL | Artículos extraídos |
|---|---|---|
| Compilación Jurídica SENA — Decreto 1074 de 2015 | `https://normograma.sena.edu.co/compilacion/docs/decreto_1074_2015_pr038.htm` | 2.2.2.47.1 a 2.2.2.47.9 |
| Compilación Jurídica SENA — Decreto 1074 de 2015 | `https://normograma.sena.edu.co/compilacion/docs/decreto_1074_2015_pr035.htm` | 2.2.2.43.1 a 2.2.2.43.7 (Capítulo 43) |
| Compilación Jurídica SENA — Decreto 1072 de 2015 | `https://normograma.sena.edu.co/compilacion/docs/decreto_1072_2015_pr001.htm` | 2.2.1.1.10 a 2.2.1.1.15 |
| Compilación Jurídica SENA — Ley 1564 de 2012 | `https://normograma.sena.edu.co/compilacion/docs/ley_1564_2012_pr008.htm` | 243 y 244 |

---

## 2. Resumen

| Numeral | Norma citada | Veredicto |
|---|---|---|
| 4.1 | 2.2.2.47.5 → "requisitos establecidos en el artículo **2.2.2.47.3**" | **No es fiel.** El 47.5 dice "el artículo **2.2.2.43.3** de este decreto" |
| 4.2 | 2.2.2.47.3 → "incluido **este Acuerdo**" | Sustancia correcta, pero es paráfrasis: el oficial dice "incluido **cualquier acuerdo aplicable**" |
| 4.3 | Parágrafo 2 del 2.2.1.1.10 del Decreto 1072 | **Fiel**, con una salvedad de alcance |
| 4.4 | Artículo 244 de la Ley 1564 de 2012 | Sustancia correcta, pero **no es la frase del artículo**: "en forma de mensaje de datos" es del 243 y falta la condición final |
| 4.5 | Numeral 3 del 2.2.1.1.13 del Decreto 1072 | **Fiel en sustancia**, con una salvedad de alcance |

---

## 3. Detalle numeral por numeral

### 4.1 — Cita el artículo equivocado

**Texto del Acuerdo**:

> 4.1. De conformidad con el artículo 2.2.2.47.5 del Decreto 1074 de 2015, la firma
> electrónica tiene la misma validez y efectos jurídicos que la firma, si cumple los
> requisitos establecidos en el artículo 2.2.2.47.3 de ese Decreto.

**Texto oficial (2.2.2.47.5, "EFECTOS JURÍDICOS DE LA FIRMA ELECTRÓNICA")**:

> La firma electrónica tendrá la misma validez y efectos jurídicos que la firma, si
> aquella cumple con los requisitos establecidos en el artículo **2.2.2.43.3** de este
> decreto.

**Diferencia**: el Acuerdo sustituye el artículo citado. El 47.5 no remite al 47.3.

**Dato importante que hay que saber antes de corregir**: el **2.2.2.43.3 vigente no
tiene nada que ver con la firma electrónica**. En el Decreto 1074 de 2015, el
Capítulo 43 es el de las Cámaras de Comercio y el artículo 43.3 dice:

> ARTÍCULO 2.2.2.43.3. PRESUPUESTO ANUAL. Las Cámaras de Comercio prepararán y
> aprobarán un presupuesto anual de ingresos y gastos en el que se incluirán en forma
> discriminada los imputables a la actividad registral. ...

Es decir, **la remisión del 47.5 está caduca**: heredó la numeración anterior a la
compilación de 2015, cuando el capítulo de firma electrónica tenía otro número. La
remisión conservada en el texto oficial apunta hoy a un artículo ajeno.

Esto tiene dos consecuencias para el abogado:

1. No se puede "corregir" el 4.1 poniéndole 43.3: sería una cita literal, pero
   apuntaría al artículo del presupuesto anual de las Cámaras de Comercio.
2. El artículo que **sí** contiene los requisitos materiales de la firma es el
   **2.2.2.47.4** ("CONFIABILIDAD DE LA FIRMA ELECTRÓNICA"), que el Acuerdo **no
   cita en ningún punto**. Y es al que apuntan las otras normas del sector:
   - 2.2.1.1.11: "deberá proveer al trabajador de los medios necesarios para el uso
     de la firma electrónica... siempre que cumplan con las condiciones previstas en
     el **artículo 2.2.2.47.4**".
   - Parágrafo del 2.2.1.1.13: "El empleador garantizará que el mecanismo utilizado
     para la firma electrónica cumple con las condiciones establecidas en el **artículo
     2.2.2.47.4**".

**Propuesta**:

> 4.1. De conformidad con el artículo 2.2.2.47.5 del Decreto 1074 de 2015 y el
> parágrafo 2 del artículo 2.2.1.1.10 del Decreto 1072 de 2015, la firma electrónica
> tiene la misma validez y efectos jurídicos que la firma, si cumple los requisitos
> establecidos en el artículo 2.2.2.47.3 de ese Decreto.

Esa redacción conserva el contenido del 4.1 actual, pero lo apoya en las dos normas
que **sí** dicen eso (el 47.5 y el parágrafo 2 del 2.2.1.1.10), sin parafrasear la
remisión caduca del 47.5. Como alternativa, si el abogado prefiere, puede agregarse
un numeral nuevo que recoja el 47.4 de forma expresa, porque es el artículo que
contiene los dos requisitos materiales (los datos de creación corresponden
exclusivamente al firmante, y es posible detectar cualquier alteración no autorizada
del mensaje de datos después de la firma).

### 4.2 — Paráfrasis presented as cita

**Texto del Acuerdo**:

> ...incluido este Acuerdo, sea tan confiable como apropiada para los fines con los
> cuales se generó o comunicó ese mensaje.

**Texto oficial (2.2.2.47.3, "CUMPLIMIENTO DEL REQUISITO DE FIRMA")**:

> Cuando se exija la firma de una persona, ese requisito quedará cumplido en
> relación con un mensaje de datos si se utiliza una firma electrónica que, a la luz
> de todas las circunstancias del caso, **incluido cualquier acuerdo aplicable**, sea
> tan confiable como apropiada para los fines con los cuales se generó o comunicó
> ese mensaje.

**Diferencia**: "cualquier acuerdo aplicable" se reduce a "este Acuerdo".

**Lectura**: el Acuerdo **sí** es un acuerdo aplicable, así que la sustitución no
altera el resultado jurídico de la cláusula. Pero el texto del Acuerdo se presenta
como si fuera el del artículo, y un lector puede llegar a creer que la ley exige
que sea *este* Acuerdo y no cualquier otro. Dos opciones para el abogado:

- **Literal**: "incluido cualquier acuerdo aplicable, sea tan confiable como
  apropiada..." (deja constancia de que la cláusula aplica a lo que el artículo
  dice).
- **Explícitadora**: "incluido cualquier acuerdo aplicable y, en particular, este
  Acuerdo, sea tan confiable como apropiada...".

### 4.3 — Fiel (con salvedad de alcance)

**Texto del Acuerdo**:

> 4.3. De conformidad con el parágrafo 2 del artículo 2.2.1.1.10 del Decreto 1072 de
> 2015, la firma electrónica tiene los mismos efectos que la firma manuscrita si aquella
> cumple con los requisitos establecidos en el artículo 2.2.2.47.3 del Decreto 1074 de
> 2015.

**Texto oficial (parágrafo 2 del 2.2.1.1.10, Decreto 1072 de 2015, adicionado por el
artículo 1 del Decreto 526 de 2021)**:

> PARÁGRAFO 2o. La firma electrónica tendrá los mismos efectos que la firma
> manuscrita, si aquella cumple con los requisitos establecidos en el artículo
> 2.2.2.47.3 del Decreto 1074 de 2015.

**Veredicto**: transcripción fiel, palabra por palabra.

**Salvedad de alcance** (no es un error del texto, pero conviene que el abogado lo
sepa): el artículo 2.2.1.1.10 se titula "FIRMAS" y su encabezado dice "Para la
suscripción del **contrato individual de trabajo** firmado electrónicamente
podrán ser utilizadas las siguientes firmas". El parágrafo 2, por tanto, está
pensado para el contrato de trabajo. El Acuerdo de uso de K+AIR es un mecanismo
**genérico** (contratos, actas, certificados, autorizaciones), y el 4.3 lo invoca
para todo el objeto. La cita es correcta; lo que se extiende es el ámbito de la
norma. Para documentos que no sean el contrato individual de trabajo, el apoyo
principal queda en el 47.3 (4.2) y en el 47.7 ("FIRMA ELECTRÓNICA PACTADA MEDIANTE
ACUERDO", que el Acuerdo tampoco cita).

### 4.4 — Sustancia correcta, frase que no es del artículo

**Texto del Acuerdo**:

> 4.4. De conformidad con el artículo 244 de la Ley 1564 de 2012, los documentos en
> forma de mensaje de datos se presumen auténticos.

**Texto oficial (artículo 244 de la Ley 1564 de 2012, "DOCUMENTO AUTÉNTICO")**:

> Es auténtico un documento cuando existe certeza sobre la persona que lo ha elaborado,
> manuscrito, firmado, o cuando exista certeza respecto de la persona a quien se
> atribuya el documento.
>
> Los documentos públicos y los privados emanados de las partes o de terceros, en
> original o en copia, elaborados, firmados o manuscritos, y los que contengan la
> reproducción de la voz o de la imagen, se presumen auténticos, mientras no hayan
> sido tachados de falso o desconocidos, según el caso.
>
> También se presumirán auténticos los memoriales presentados para que formen parte
> del expediente, incluidas las demandas, sus contestaciones, los que impliquen
> disposición del derecho en litigio y los poderes en caso de sustitución.
>
> Así mismo se presumen auténticos todos los documentos que reúnan los requisitos
> para ser título ejecutivo.

**Diferencias**:

1. La frase "en forma de mensaje de datos" **no está en el artículo 244**. Está en el
   artículo 243 ("DISTINTAS CLASES DE DOCUMENTOS"), que enumera las clases de
   documento: "los escritos, impresos, planos, dibujos, cuadros, **mensajes de
   datos**, fotografías, cintas cinematográficas, discos, grabaciones magnetofónicas,
   videograbaciones, radiografías, talones, contraseñas, cupones, etiquetas, sellos
   y, en general, todo objeto mueble que tenga carácter representativo o declarativo".
2. Falta la condición final: la presunción se mantiene "**mientras no hayan sido
   tachados de falso o desconocidos**".
3. El alcance del artículo es el **proceso judicial**: "la parte que aporte al
   proceso un documento...". El 4.4 no dice que sea ante un juez.

**Veredicto**: la idea que el Acuerdo quiere expresser es correcta y está en el
artículo 244, pero la frase citada no es la del artículo.

**Propuesta**:

> 4.4. De conformidad con los artículos 243 y 244 de la Ley 1564 de 2012, los
> documentos en forma de mensaje de datos se presumen auténticos, mientras no hayan
> sido tachados de falso o desconocidos, según el caso.

### 4.5 — Fiel en sustancia (con salvedad de alcance)

**Texto del Acuerdo**:

> 4.5. La validez, la eficacia y la fuerza probatoria de la firma realizada mediante este
> mecanismo no se afectan por la finalización de la relación laboral, conforme al numeral
> 3 del artículo 2.2.1.1.13 del Decreto 1072 de 2015.

**Texto oficial (numeral 3 del 2.2.1.1.13, Decreto 1072 de 2015)**:

> 3. Su uso entre trabajador y empleador, será exclusivo para la relación laboral sin
> que, a la finalización de esta, el contrato de trabajo, sus adiciones y/o
> modificaciones firmado(s) electrónicamente pierdan su validez, eficacia y fuerza
> probatoria.

**Veredicto**: el contenido está correctamente atribuido. El numeral 3 dice
literalmente que, al terminar la relación laboral, el contrato firmado
electrónicamente **no pierde** validez, eficacia ni fuerza probatoria.

**Salvedad de alcance**: el numeral 3 empieza por "Su uso entre trabajador y
empleador será **exclusivo para la relación laboral**". El Acuerdo de uso de K+AIR
es un mecanismo genérico que puede usarse para documentos que no son el contrato
individual de trabajo. La consecuencia práctica es que, para un acta o un
certificado, la garantía del 4.5 no viene del 2.2.1.1.13 sino del principio general
de que el documento firmado conserva su valor. Conviene que el abogado lo valore así.

---

## 4. Lo que el Acuerdo no cita y debería considerar

| Artículo oficial | Qué establece | Por qué importa para K+AIR |
|---|---|---|
| 2.2.2.47.4 (CONFIABILIDAD) | Los datos de creación corresponden **exclusivamente** al firmante, y es posible **detectar cualquier alteración no autorizada** del mensaje de datos después de la firma. | Es el artículo que contiene los dos requisitos materiales. El 5.1(b) del Capítulo V implementa el primero; el hash del PDF firmado y la constancia implementan el segundo. El Acuerdo no lo cita. |
| 2.2.2.47.7 (FIRMA PACTADA MEDIANTE ACUERDO) | "Salvo prueba en contrario, se presume que los mecanismos o técnicas de identificación personal o autenticación electrónica que acuerden las partes **mediante acuerdo**, cumplen los requisitos de firma electrónica." El parágrafo pone en cabeza de la parte que provee el mecanismo la carga de probar que es seguro y confiable. | Es la norma que sostiene el carácter de "firma electrónica pactada" de todo el acuerdo. No está citada en el Acuerdo. |
| 2.2.1.1.11 | El empleador debe proveer los medios necesarios para usar la firma electrónica, y "la imposibilidad de firmar electrónicamente un contrato individual de trabajo **no será una barrera de acceso al empleo**". | Apoya el Capítulo VII (firma autográfica y no barrera) del Acuerdo, pero el deber es **del empleador**, no del Firmante. Hoy el Capítulo V solo recoge deberes del firmante. |
| 2.2.1.1.13, parágrafo | "El empleador garantizará que el mecanismo utilizado para la firma electrónica cumple con las condiciones establecidas en el artículo 2.2.2.47.4." | Deber de la **Empresa**, no del Firmante. Ver el riesgo de onboarding del correo de verificación en la auditoría del Capítulo V. |
| 2.2.1.1.13, numeral 2 | "No tendrá ningún costo para el trabajador, correspondiendo exclusivamente al empleador el pago de cualquier valor asociado." | Apoya el 5.4 (descarga sin costo) y el Capítulo VII. |
| 2.2.1.1.12 | Conservación del contrato firmado con garantías de autenticidad, integridad y disponibilidad, y entrega al trabajador por medio electrónico autorizado. | Apoya el Capítulo VIII (suministro de copias y conservación). |

**Conclusión de esta sección**: el Capítulo IV cites las normas que respaldan los
efectos jurídicos, pero el Acuerdo **no reparte los deberes que el sector le
impone al empleador** (proveer los medios, garantizar la seguridad del mecanismo,
no cobrar al trabajador). Esos deberes están repartidos en los Capítulos V (deberes
del Firmante), VI (reglas de uso) y VIII (conservación) de forma incompleta. Es una
observación de estructura para el abogado, no un defecto de código.

---

## 5. Qué NO se hizo

- No se modificó el fixture del Acuerdo: el texto legal aprobado no se toca sin
  abogado.
- No se cambió el hash del Acuerdo ni se republicó ninguna versión.
- No se implementó ninguna de las propuestas: las tres diferencias (4.1, 4.2, 4.4)
  son del texto, no del código.

---

## 6. Pendiente

1. Decisión del abogado sobre las tres propuestas (4.1, 4.2, 4.4) y sobre si
   incorporar una cita expresa al 2.2.2.47.4 y al 2.2.2.47.7.
2. Si el texto cambia, hay que **publicar una versión nueva** del Acuerdo (v1.1): el
   hash archivado en los consentimientos ya aceptados no se puede tocar.
3. Registrar el Capítulo IV en la tabla de estado de `Historial.md`, que hasta ahora
   no tenía fila para él.
