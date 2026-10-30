# Auditoría del Capítulo V — Deberes del Firmante (Acuerdo de uso v1.0)

**Fecha**: 2026-10-19
**Alcance**: Capítulo V del Acuerdo de uso (`scripts/fixtures/acuerdo-v1.0.txt`, líneas 239-272), numeral por numeral, contrastado contra (a) el artículo 2.2.2.47.6 del Decreto 1074 de 2015 en fuente oficial y (b) el código del servicio `firma-service`.
**Método**: verificación del texto oficial en compilación oficial + lectura del código (backend y mini-app) + suite de pruebas.
**Resultado**: 2 hallazgos de código corregidos y probados, 2 hallazgos de texto para el abogado, 1 riesgo de onboarding que queda como regla de alta de empresas.

> **Este documento no modifica el texto legal.** Las propuestas de redacción van como
> proposals para el abogado; el fixture aprobado sigue intacto.

---

## 1. Fuentes oficiales verificadas

| Fuente | URL | Uso |
|---|---|---|
| Compilación Jurídica SENA (Avance Jurídico) — Decreto 1074 de 2015, Cap. 47 | `https://normograma.sena.edu.co/compilacion/docs/decreto_1074_2015_pr038.htm` | Texto íntegro de los artículos 2.2.2.47.1 a 2.2.2.47.9 |
| Compilación Jurídica SENA — Decreto 1072 de 2015 | `https://normograma.sena.edu.co/compilacion/docs/decreto_1072_2015_pr001.htm` | Artículos 2.2.1.1.10 a 2.2.1.1.15 |
| Compilación Jurídica SENA — Ley 1564 de 2012 | `https://normograma.sena.edu.co/compilacion/docs/ley_1564_2012_pr008.htm` | Artículos 243 y 244 (documento auténtico) |

Las tres son de la misma familia editorial y fueron corroboradas contra DIAN y CREG
en una ronda anterior. El texto legal usado como referencia en esta auditoría es,
literalmente, el que está en esas páginas.

### Texto de referencia: artículo 2.2.2.47.6 "OBLIGACIONES DEL FIRMANTE"

> El firmante debe:
>
> 1. Mantener control y custodia sobre los datos de creación de la firma.
> 2. Actuar con diligencia para evitar la utilización no autorizada de sus datos de creación de la firma.
> 3. Dar aviso oportuno a cualquier persona que posea, haya recibido o vaya a recibir documentos o mensajes de datos firmados electrónicamente por el firmante, si:
>    3.1. El firmante sabe que los datos de creación de la firma han quedado en entredicho, o
>    3.2. Las circunstancias de que tiene conocimiento el firmante dan lugar a un riesgo considerable de que los datos de creación de la firma hayan quedado en entredicho.
>
> **PARÁGRAFO.** Se entiende que los datos de creación del firmante han quedado en entredicho cuando estos, entre otras, han sido conocidos ilegalmente por terceros, corren peligro de ser utilizados indebidamente, o el firmante ha perdido el control o custodia sobre los mismos y en general cualquier otra situación que ponga en duda la seguridad de la firma electrónica o que genere reparos sobre la calidad de la misma.

---

## 2. Auditoría numeral por numeral

| Numeral | Qué exige | ¿Cumplible en el sistema? | Veredicto |
|---|---|---|---|
| 5.1 (preámbulo) | Que a), b) y c) sean los deberes del 47.6 | — | **No calza con el artículo** (hallazgo de texto T1) |
| 5.1 a) | Condiciones y usos del Acuerdo, la ley y las políticas de seguridad de la Empresa y de K+AIR | Parcial: las políticas no se muestran | **Deber inaplicable** (hallazgo de texto T2) |
| 5.1 b) | Custodiar el OTP y el token, no entregarlos ni compartirlos | Sí (OTP de un solo uso, token de un solo uso, expiración) | OK |
| 5.1 c) | Avisar de inmediato a la Empresa **y a K+AIR** | **No había forma de avisar a K+AIR** | **Corregido en código** (H1) |
| 5.2 | OTP y token son personales e intransferibles | Sí | OK (ver el riesgo R1) |
| 5.3 | Revisar el documento y firmarlo solo si es exacto y completo | **La mini-app no decía QUÉ documento se firmaba** | **Corregido en código** (H2) |
| 5.4 | Imprimir o descargar copia del Acuerdo y del documento firmado | Sí (Fase 6 / `📦912`) | OK |
| 5.5 | No limita los deberes del Trabajador frente a la Empresa | Es una declaración de no exclusividad | OK |

---

## 3. Hallazgos de código (corregidos en esta fase)

### H1 — El 5.1(c) no era cumplible: no había a quién avisarle en K+AIR

**Qué pasa hoy (antes de este cambio)**: la mini-app muestra un bloque "Empresa que
solicita tu firma" con los canales de la **Empresa** (`canal_pqrs` y
`canal_incidentes`, que son datos del cliente, por ejemplo
`seguridad@empresa.co`). En ninguna parte aparecía un canal de **K+AIR**
(Gesstiar S.A.S.). El 5.1(c) obliga al Firmante a "avisar de inmediato a la Empresa
**y a K+AIR**": sin un canal de K+AIR visible, ese deber no se podía cumplir, y el
trabajador queda sin dónde reportar que le comprometieron el OTP o el enlace de
firma.

**Qué se hizo**:

| Archivo | Cambio |
|---|---|
| `src/config.js` | Nueva variable `canalIncidentes`, leída de `FIRMA_CANAL_INCIDENCIAS` con valor por defecto `adminkair@gmail.com` (el mismo que publica el Anexo de Encargo de Tratamiento de Datos Personales, §9, datos de contacto del Encargado). |
| `src/routes/public.js` | El contexto público de `GET /s/:token` expone `canal_incidentes_kair`. |
| `web/firma/index.html` | Nuevo bloque `#documento-identidad` (con `#documento-categoria` y `#documento-referencia`) en la pantalla del documento, y un pie `<footer class="pie-kair">` **fuera de las pantallas**, con `#pie-kair-canal` y el valor por defecto `adminkair@gmail.com`. |
| `web/firma/app.js` | `renderPieKair(contexto)`: si el valor parece un correo, lo muestra como `mailto:`; si no, como texto plano (el valor viene del servidor y se convierte en `href`, así que no puede ser un esquema arbitrario). |
| `web/firma/styles.css` | Estilos `.documento-identidad` y `.pie-kair`. |

**Por qué el valor por defecto está en el HTML y no solo en la configuración**: el pie
vive fuera de las pantallas para estar disponible en todas, **incluida la pantalla de
error**, que es donde aterriza el firmante cuyo enlace no sirve. En esa pantalla no
hay contexto que traiga el canal. Si el servidor lo configura distinto
(`FIRMA_CANAL_INCIDENCIAS`), el contexto lo actualiza. Un test verifica que el
valor por defecto del HTML y el de la configuración **no divergen**.

### H2 — El 5.3 no tenía apoyo en pantalla: el Firmante no sabía qué documento firmaba

**Qué pasa hoy (antes de este cambio)**: el 5.3 obliga a "firmar únicamente
documentos cuyo contenido sea exacto, completo y corresponda a lo que la Empresa le
ha informado". Para poder cumplir eso, el Firmante necesita saber **qué** documento
tiene delante. El backend ya enviaba en el contexto `tipo_identificacion` (la
categoría: CONTRATO, ACTA, CERTIFICADO...) e `id_documento` (la referencia), pero la
mini-app **no los pintaba en ninguna parte**. El comentario del backend lo afirmaba
en contra de lo que el código hacía:

```
src/routes/public.js:135
  // La mini-app lo muestra como contexto ("Estás firmando un CONTRATO").
```

Ese comentario era falso: el contexto lo traía, la pantalla no lo mostraba. El
resultado es que el Firmante firmaba sobre un PDF sin saber si era el contrato que
esperaba o un acta distinta: exactamente el contenido que el 5.3 le exige verificar.

**Qué se hizo**: el bloque `#documento-identidad` (nuevo) y las funciones
`renderDocumentoIdentidad(contexto)` y `etiquetaDocumento(tipo)` en
`web/firma/app.js`. La categoría se traduce a lenguaje llano ("Estás firmando un
contrato.", "Estás firmando un acta.") y la referencia se muestra al lado. Si el
contexto no trae ninguno de los dos datos, el bloque no aparece: no se inventa
información.

**Comentario corregido**: el de `src/routes/public.js:135` ahora describe lo que
el código hace.

---

## 4. Hallazgos de texto (para el abogado; no se tocó el fixture)

### T1 — El preámbulo del 5.1 no corresponde al artículo que dice corresponder

El 5.1 abre con "El Firmante reconoce y acepta los deberes y obligaciones que el
artículo 2.2.2.47.6 del Decreto 1074 de 2015 impone a quien firma electrónicamente,
y se compromete a cumplirlos:", seguido de a), b) y c). El problema es que la lista
**no es** la del artículo:

1. **El literal a) no está en el artículo.** El artículo no dice "cumplir las
   condiciones y los usos previstos en este Acuerdo, en la legislación aplicable y
   en las políticas de seguridad de la Empresa y de K+AIR". Eso es un deber propio
   del Acuerdo, no del 47.6.
2. **El deber 2 del artículo (actuar con diligencia) no tiene literal propio.** Es el
   deber que sostiene la custodia del OTP y del token, y no aparece en la lista.
3. **El deber 3 del artículo quedó reducido.** El artículo obliga a "dar aviso
   oportuno a **cualquier persona que posea, haya recibido o vaya a recibir**
   documentos o mensajes de datos firmados electrónicamente por el firmante", y solo
   si se cumplen los criterios 3.1 o 3.2 (saber que los datos quedaron en
   entredicho, o conocer circunstancias que dan lugar a un riesgo considerable de que
   queden en entredicho). El 5.1(c) dice "avisar de inmediato a la Empresa y a
   K+AIR", lo que deja fuera a las demás personas que reciben o van a recibir el
   documento firmado (por ejemplo, la contraparte de un acta, quien reciba la
   copia, el archivo de la Empresa o un tercero que por cualquier vía obtenga el
   documento). También se pierden los criterios de "en entredicho" y la definición
   que da el parágrafo del artículo.

**Propuesta 1 (recomendada) — reproducir los tres deberes del artículo y añadir un
literal propio del Acuerdo**:

> 5.1. El Firmante reconoce y acepta los deberes y obligaciones que el artículo
> 2.2.2.47.6 del Decreto 1074 de 2015 impone a quien firma electrónicamente, y se
> compromete a cumplirlos. En particular:
>
> &nbsp;&nbsp;&nbsp;&nbsp;a) Mantener control y custodia sobre sus datos de creación de la firma.
>
> &nbsp;&nbsp;&nbsp;&nbsp;b) Actuar con diligencia para evitar la utilización no autorizada de sus datos de creación de la firma.
>
> &nbsp;&nbsp;&nbsp;&nbsp;c) Dar aviso oportuno a cualquier persona que posea, haya recibido o vaya a recibir documentos o mensajes de datos firmados electrónicamente por el Firmante, cuando el Firmante sepa que sus datos de creación de la firma han quedado en entredicho o cuando conozca circunstancias que den lugar a un riesgo considerable de que hayan quedado en entredicho. Se entiende que los datos de creación han quedado en entredicho, entre otros casos, cuando hayan sido conocidos ilegalmente por terceros, corran peligro de ser utilizados indebidamente, o el Firmante haya perdido el control o custodia sobre los mismos, o, en general, cuando exista cualquier otra situación que ponga en duda la seguridad de la firma electrónica o que genere reparos sobre su calidad.
>
> &nbsp;&nbsp;&nbsp;&nbsp;d) Custodiar y mantener bajo su exclusivo control sus datos de creación de la firma, esto es, el código OTP y el token de acceso, y no entregarlos, no compartirlos y no permitir que un tercero los utilice.
>
> &nbsp;&nbsp;&nbsp;&nbsp;e) Avisar de inmediato a la Empresa y a K+AIR cualquier situación que comprometa la seguridad de sus datos de creación de la firma, tales como el acceso no autorizado a su correo electrónico, la pérdida de control del dispositivo desde el que accede al servicio o el conocimiento de que un tercero ha obtenido o ha utilizado su código de verificación o su enlace de firma.

**Propuesta 2 (conservadora) — conservar a), b) y c) tal como están y corregir
únicamente el preámbulo**, para que no afirme que la lista es la del artículo:

> 5.1. El Firmante reconoce y acepta los deberes y obligaciones que el artículo
> 2.2.2.47.6 del Decreto 1074 de 2015 impone a quien firma electrónicamente, y se
> compromete a cumplirlos, así como los deberes específicos que este Acuerdo
> establece en su favor y en su contra. Estos últimos son:
> ... (sigue la lista actual)

**Nota para el abogado**: con la Propuesta 1, el literal d) recoge el contenido del
actual b) y el literal e), el del actual c), de modo que **nada se pierde**: el
5.1(b) y el 5.1(c) no desaparecen, cambian de letra. El 5.2 (personalidad e
intransferibilidad) y el 5.3 quedan intactos y sin duplicar.

### T2 — El 5.1(a) obliga al Firmante a cumplir políticas que nunca ve

El literal a) obliga a "cumplir las condiciones y los usos previstos en este
Acuerdo, en la legislación aplicable y en las políticas de seguridad de la Empresa y
de K+AIR". Un deber cuyo contenido el Firmante no puede conocer no es exigible, y
en un Acuerdo que el Firmante acepta desde la pantalla sin que nadie le muestre esas
políticas, es una cláusula vacía.

**Propuesta**:

> a) Cumplir las condiciones y los usos previstos en este Acuerdo y en la
> legislación aplicable, y cumplir además las políticas de seguridad de la Empresa y
> de K+AIR que le sean informadas de forma expresa y que se anexen a este Acuerdo.

**Alternativa (más simple, y posiblemente la preferible)**: dejar las políticas
como deber de la Empresa y no del Firmante, y añadir al Capítulo de obligaciones de
la Empresa que K+AIR le informará de forma expresa las políticas aplicables al
mecanismo de firma.

---

## 5. Riesgo de onboarding (no es código: es una regla de alta de empresas)

**El hecho**: el OTP se envía al `correo_verificacion` que **registra la Empresa** al
crear la solicitud de firma (API interna). Si esa dirección es un buzón corporativo
compartido (`rrhh@empresa.co`, `gestion@empresa.co`), entonces **la Empresa
recibe el OTP**, es decir, tiene uno de los datos de creación de la firma.

**Por qué importa**:

- El 5.1(b) y el 5.2 dicen que el OTP y el token son **personales e intransferibles**
  y que el Firmante "responde por las firmas que se generen con su uso indebido". Si
  la Empresa tiene el OTP, esa responsabilidad no se sostiene.
- El artículo 2.2.2.47.4 (CONFIABILIDAD) exige que "los datos de creación de la
  firma, en el contexto en que son utilizados, **correspondan exclusivamente al
  firmante**". Un OTP entregado a un buzón de la Empresa rompe esa condición en el
  contexto en que se usa.
- El parágrafo 2 del 2.2.1.1.13 del Decreto 1072 pone la garantía de que el
  mecanismo cumple las condiciones del 47.4 **en cabeza del empleador**, no del
  trabajador: si el OTP lo tiene la Empresa, la garantía se rompe por el lado que
  la tiene.

**Regla propuesta para el alta de empresas**: el `correo_verificacion` debe ser una
dirección **personal** del trabajador, nunca un buzón corporativo o compartido.

**Decisión pendiente del owner** (no implementada): si la API debe **rechazar**
un `correo_verificacion` cuyo dominio coincida con el de la Empresa, o si la regla
queda solo documentada en el onboarding. Rechazarla es más segura pero puede
frenar clientes legítimos que operan con correo corporativo único por trabajador; no
hacerlo deja el riesgo en manos del onboarding.

---

## 6. Qué NO se hizo (y por qué)

- **No se modificó el fixture del Acuerdo.** El texto legal aprobado no se toca sin
  abogado. Los hallazgos T1 y T2 quedan como propuestas.
- **No se tocó el Capítulo X (datos personales)** ni el Anexo de Encargo: su
  relación con el Capítulo V se registra en el documento de auditoría del
  Capítulo IV y en el plan, pero no se modifican en esta fase.
- **No se implementó la 5B (datos personales)** ni el comportamiento post-purga: no
  forman parte del Capítulo V y ya están anotados como deuda en el plan.

---

## 7. Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| Suite completa (`node --test`, 14 carpetas de tests) | **1185 tests · 1183 verdes · 0 fallos · 2 omitidos** |
| Tests nuevos del Capítulo V (`tests/capitulo-v-deberes-firmante.test.js`) | 4 verdes: markup y cableado, 12 mutaciones que el evaluador debe detectar, no-divergencia del canal HTML/config, y el contexto HTTP exponiendo `canal_incidentes_kair`, `tipo_identificacion` e `id_documento` |
| Barrido de caracteres no latinos (CJK, cirílico, hangul) | Limpio |
| EOL y BOM | Sin cambios respecto de la línea base |
| `node --check` sobre los archivos tocados | Limpio |

**Nota**: el texto legal del Capítulo V **no se modificó**, así que el hash del
Acuerdo y los consentimientos ya aceptados no cambian por esta fase.

---

## 8. Pendiente de esta auditoría

1. Decisión del owner sobre el rechazo de `correo_verificacion` con dominio de la
   Empresa (sección 5).
2. Revisión del abogado sobre T1 y T2, y sobre las propuestas de redacción.
3. Publicación de la v1.1 del Acuerdo cuando el abogado devuelva el texto: los
   literales propuestos cambian el hash, así que hay que publicar una versión nueva
   y no editar la v1.0.
