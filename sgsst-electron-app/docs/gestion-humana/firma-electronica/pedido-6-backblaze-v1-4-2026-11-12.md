# Pedido 6 — el respaldo en Backblaze B2 y las tres adiciones a la v1.4 (12-nov-2026)

> **Qué es este documento.** Es el insumo del **punto 6** de la nota al abogado del 12-nov-2026 (el
> punto que nació de la decisión de M.7). Contiene (1) la determinación del equipo sobre el
> encuadre jurídico de la copia de respaldo fuera del servidor, con su base normativa verificada en
> fuente oficial el 12-nov-2026; (2) el esquema de cláusulas que K+AIR debería exigirle al proveedor;
> y (3) **el texto literal de las tres adiciones** a la v1.4 que el abogado tiene que revisar antes
> de que se arme el HTML definitivo.
>
> **Modo.** Asesoría. No se editó ningún texto suscrito: lo que sigue es **texto para pegar en copias
> nuevas** (v1.4 del Anexo de Nube y la versión nueva del Anexo de Encargo), nunca sobre
> `legal/anexo-nube-v1.3.html` ni sobre `legal/anexo-encargo.html`.
>
> **Estado de cada cosa.** La determinación es del equipo y **espera la ratificación del abogado
> externo**. El texto literal es una propuesta, no un texto publicado.

---

## 1. La determinación del equipo, y por qué cambió de forma

El encargo al agente legal preguntaba si la copia de los respaldos a Backblaze B2 (EE. UU.) es una
**transferencia internacional**, y pedía elegir entre cuatro vías: autorización del Titular,
excepción del art. 26(e), declaración de conformidad de la SIC o cláusulas modelo.

**La determinación es que ninguna de las cuatro es la vía, y esa es la respuesta:**

1. **Sí es una salida de datos personales al exterior, y debe declararse como tal.** Que los `.enc`
   vayan cifrados no cambia la naturaleza del dato: sigue siendo dato personal bajo control de
   K+AIR. El cifrado es una **medida de seguridad** (art. 4(h) y 18(b) de la Ley 1581 de 2012), no
   una exención. Lo que sí hace el cifrado, y es lo que hay que defender por escrito, es que **el
   destino no puede leer los archivos**: lo que el proveedor podría entregar, si se lo exigieran, es
   texto cifrado, y sin la frase —que no sale del servidor— es inservible.
2. **La prohibición del art. 26 no se activa.** Los Estados Unidos de América figuran en el
   **numeral 3.2 del Título V de la Circular Única** de la SIC (Resolución 56579 del 12-ago-2025),
   que reconoce **nivel adecuado de protección**. Por eso no hace falta ninguna de las excepciones
   del art. 26: ni la autorización expresa del Titular, ni la del art. 26(e), ni la declaración de
   conformidad de la SIC (parágrafo 1), que aplica «en los casos no contemplados como excepción».
3. **Calificada como transmisión internacional** (Encargado → Encargado: el proveedor custodia los
   archivos por cuenta del Responsable y por instrucción del Encargado), el **art. 24.2 del Decreto
   1377 de 2013** exonera de informar al Titular y de pedir su consentimiento, porque existe contrato
   en los términos del **art. 25** —y el Anexo de Encargo del 12-nov-2026, ya suscrito y
   contrafirmado, cumple ese contenido mínimo (alcances, actividades y las tres obligaciones).
4. **Backblaze es subencargado** (Encargado del Encargado) y debe entrar en la lista de proveedores:
   en el texto vigente, esa lista está en el **§4 del Anexo de Nube** y en el **§5 del Anexo de
   Encargo**. *(El §11 del Anexo de Nube es «Referencias normativas», no la lista: esa referencia
   estaba equivocada en el encargo y ya se corrigió en el expediente.)*
5. **Hacen falta dos contratos con papeles distintos:** el **Anexo de Encargo** (Empresa ↔ K+AIR),
   que ya existe y cumple el art. 25; y el **instrumento con Backblaze** (K+AIR ↔ Backblaze), que
   exige la cláusula de subencargados del §4 del Anexo de Encargo y que debe replicar ese mínimo.

### 1.1 La base normativa (consultada el 12-nov-2026)

| Norma | Artículo / numeral | Qué dice | Fuente oficial |
|---|---|---|---|
| Ley 1581 de 2012 | Art. 26 | «Se prohíbe la transferencia de datos personales de cualquier tipo a países que no proporcionen niveles adecuados de protección… Esta prohibición no regirá cuando se trate de: a) información respecto de la cual el Titular haya otorgado su autorización expresa… e) transferencias necesarias para la ejecución de un contrato… **Parágrafo 1º.** En los casos no contemplados como excepción… corresponderá a la Superintendencia de Industria y Comercio, proferir la declaración de conformidad» | SUIN-Juriscol; compilado oficial de la JEP | 
| Ley 1581 de 2012 | Art. 3(c), (d), (e) · 4(d), (e), (h) · 12 · 17(d), (i), (o) · 18(b), (j), (k), (l) · 25 | Dato personal, Encargado, Responsable; veracidad, transparencia, seguridad; deber de informar con prueba; deberes del Responsable y del Encargado; el RNBD se alimenta de las políticas de tratamiento | idem | 
| Decreto 1377 de 2013 | Art. 3, num. 4 y 5 | **Transferencia:** el Responsable o Encargado envía datos a un receptor **que a su vez es Responsable**. **Transmisión:** comunicación de datos **para que el Encargado los trate por cuenta del Responsable** | ANI / Cancillería | 
| Decreto 1377 de 2013 | Art. 24 | «2. Las transmisiones internacionales… que se efectúen entre un responsable y un encargado… **no requerirán ser informadas al Titular ni contar con su consentimiento cuando exista un contrato en los términos del artículo 25 siguiente**» | idem | 
| Decreto 1377 de 2013 | Art. 25 | Contenido mínimo del contrato: alcances del tratamiento, actividades del encargado, obligaciones para con el Titular y el Responsable, y las tres obligaciones: tratar conforme a los principios, salvaguardar la seguridad, guardar confidencialidad | idem | 
| SIC, Circular Única, Título V, Cap. Tercero, num. 3.2 | 3.2 | Reconocen nivel adecuado: «Alemania; Australia, Austria; … **Estados Unidos de América**; …». **Parágrafo 1º:** los Responsables «deben ser capaces de **demostrar** que han implementado medidas apropiadas y efectivas… y para **otorgar seguridad a los registros**». **Parágrafo 3º:** el simple tránsito transfronterizo no comporta una transferencia. **Parágrafo 4º:** es posible transmitir a países con nivel adecuado | sede electrónica de la SIC | 
| SIC, Circular Externa 003 de 2025 (19-dic-2025) | Instrucciones 1, 3, 4, 5, 6, 7, 9 | Las cláusulas modelo son para cuando el país de destino **no** está en la lista de nivel adecuado; la suscripción es **facultativa**; no levantan la prohibición del art. 26; pueden complementarse con deberes de nivel igual o superior | compilado oficial de la JEP | 

### 1.2 Lo que hay que demostrar y lo que hay que informar

- **Demostrar las medidas** (parágrafo 1º del num. 3.2): cifrado de extremo, frase que no sale,
  verificación SHA-256, bucket privado, retención corta, ubicación y lista de subencargados — **con su
  evidencia**.
- **Informar al Titular** (art. 12 de la Ley 1581 y el aviso de privacidad) de que hay una copia de
  respaldo en EE. UU. El pendiente (iv) del §5 del Anexo de Encargo —«la política de tratamiento de
  la Empresa que informa al Titular de la transferencia»— debe ampliarse para **nombrar al proveedor
  y el país**, no solo el canal de correo.
- **Declarar la operación en la RNBD** a cargo de la Empresa (art. 25), sin perjuicio de que la
  inscripción le sea exigible por umbral o no.

### 1.3 Lo que no se verificó (⚠️ No verificado)

| # | Qué | Cómo confirmarlo |
|---|---|---|
| 1 | Si Backblaze queda calificada como Responsable y no como Encargado. Si lo fuera, la operación sería **transferencia** y aplicaría el art. 26 en vez del 24.2. | El contenido literal del DPA (Módulo 2) y el pronunciamiento del abogado externo |
| 2 | El **alcance territorial del DPA de Backblaze**: los documentos públicos son el de EEA/UE, el de UK y el anexo sufficiency. **No está verificado que apliquen a una cuenta colombiana**, ni que exista un módulo para clientes fuera de esas jurisdicciones. Si no aplica, el único vínculo posible es un **contrato bilateral nuevo**. | Leer `https://www.backblaze.com/company/dpa.html` y el Módulo 2 |
| 3 | Los **Términos del Servicio** de B2: ley aplicable, fuero (el acuerdo maestro que aparece en el registro de la SEC se rige por las leyes de Nueva York, con fuero exclusivo en Nueva York), límites de responsabilidad y obligaciones de supresión. | Leer los ToS vigentes antes de firmar |
| 4 | El **marco de compelled disclosure estadounidense** (CLOUD Act y normas equiparables) y su efecto sobre un proveedor que solo tiene texto cifrado. | Fuentes que el abogado externo considere, no la intuición de que «cifrado es seguro» |
| 5 | Si el **numeral 3.2** fue modificado después de la Resolución 56579 del 12-ago-2025: hay un proyecto de 2026 que agregaría países y que menciona la Circular 003/2025, **no se halló que se haya expedido**. | Última versión del Título V en la sede electrónica de la SIC, al momento de firmar |
| 6 | La **vigencia** de la Circular Externa 003 de 2025 y la fecha de publicación en el Diario Oficial (el compilado oficial imprime «No. 53.355 de 2 de enero de 2025», fecha incompatible con su propia expedición el 19-dic-2025). | Diario Oficial No. 53.355 |
| 7 | El **texto del ANEXO** de la Circular 003/2025 (los dos acuerdos modelo). | El PDF del Diario Oficial que la propia Circular remite |
| 8 | Si Backblaze **acepta** las cláusulas de incidentes en 24 horas, de auditoría y de derecho colombiano. Es cuestión comercial, no jurídica. | La negociación |

---

## 2. Las dos condiciones operativas que el dueño tiene que decidir antes de crear el bucket

1. **La región del bucket es condición de la declaración.** Backblaze almacena los archivos del
   cliente en centros de datos de Estados Unidos (región US-West), pero también en **CA-East
   (Canadá)** y **EU-Central (Países Bajos)**. **El bucket debe crearse en la región United States**:
   si quedara en Canadá o en Países Bajos, el destino **dejaría de estar en la lista de países con
   nivel adecuado de protección** y toda la determinación de §1 cambiaría. Como la región es fija y el
   bucket se crea una vez, esto se decide antes de crearlo.
2. **El destino guarda la base completa, no una copia por Empresa.** Consecuencias que la v1.4 debe
   declarar y no ocultar: (i) **agregación**: un compromiso del bucket o de la clave compromete a
   todas las Empresas a la vez —la mitigación es el cifrado de extremo y el bucket privado—; (ii) **no
   hay separación por Empresa en el destino**, que es una cosa distinta de la que el Anexo de
   Encargo promete en el plano lógico; (iii) el **nombre del archivo no dice de qué Empresa es**, y
   eso es una **ventaja de minimización** que conviene conservar.

Y una tercera, ya resuelta por el equipo: **la poda del destino no respetaba el deber legal de
conservación.** El dictamen lo encontró (la poda por edad ignoraba `hold_legal`, mientras que la
poda local sí lo respeta) y el equipo **lo corrigió el 12-nov-2026 y lo probó en el servidor** (4 de
4 casos: con hold no se borra ninguna copia; sin hold sí; y si no se puede saber el estado, tampoco
se borra). **Por eso la v1.4 ya puede afirmar que el destino respeta el `hold`**: sin esa corrección,
no podía.

---

## 3. Las 16 cláusulas que K+AIR debería exigirle a Backblaze

Es un **esquema**, no un contrato. El contrato es un acto del owner; esto es la lista de cláusulas y
su contenido mínimo, con la razón de cada una.

| # | Cláusula | Contenido mínimo que debe exigir K+AIR | Por qué |
|---|---|---|---|
| 1 | **Partes, rol e instrucciones** | Backblaze, Inc. (2261 Market Street STE 81006, San Francisco, CA 94114, EE. UU.) actúa como **Encargado** (Encargado del Encargado) de los archivos de respaldo, **solo por instrucción de K+AIR** y **por cuenta de la Empresa**; se prohíbe el uso por cuenta propia. | Art. 3(d) Ley 1581; art. 25 Decreto 1377 |
| 2 | **Objeto, alcance y categorías de datos** | Solo almacenamiento de los archivos `.enc` del respaldo diario. **Cifrados**: Backblaze no recibe ni puede acceder al texto claro. Finalidad única: custodia y restitución. Prohibido cualquier análisis de contenido (incluido indexación, etiquetado y cualquier uso para IA o entrenamiento de modelos). | Arts. 4(b), (h), 7, 18(b) y (j) Ley 1581 |
| 3 | **Las tres obligaciones del art. 25** | (i) tratar conforme a los principios que tutelan los datos; (ii) salvaguardar la seguridad de las bases y los archivos; (iii) guardar confidencialidad. | Art. 25 Decreto 1377 |
| 4 | **Medidas de seguridad** | Cifrado en tránsito (TLS) y en reposo (AES-256); control de acceso por clave de aplicación con mínimo privilegio y MFA; separación entre tenants; registro de accesos; prohibición de acceso del personal del proveedor a los archivos del cliente sin autorización expresa y registrada. | Art. 4(h), 18(b) y (j) Ley 1581; parágrafo 1º del num. 3.2 |
| 5 | **Custodia de la clave y no acceso al texto claro** | Reconocimiento expreso de que la **frase de cifrado nunca se transmite** y de que, por tanto, el proveedor **no puede leer** los archivos; que el cifrado del cliente (GPG simétrico AES256) es anterior al cifrado del servicio (SSE-B2) y no lo sustituye. | Es la mitigación central |
| 6 | **Ubicación y subencargados** | Región **US**; lista de centros de datos y de subencargados; **aviso previo** de cualquier cambio de ubicación o de subencargado, con derecho de K+AIR de oponerse y de terminar sin costo; prohibición de mover los archivos fuera de EE. UU. sin instrucción escrita. | Parágrafo 1º del num. 3.2; art. 25 |
| 7 | **Subencargados** | Lista previa, autorización por escrito, obligaciones equivalentes, responsabilidad del proveedor por sus subencargados. | Art. 25; §4 del Anexo de Encargo |
| 8 | **Incidentes de seguridad** | Notificación sin demora indebida y **en todo caso dentro de las 24 horas** desde que el proveedor tenga conocimiento (el Anexo de Encargo se compromete con la Empresa a 48 horas, y ese margen no puede consumirse antes de llegar a K+AIR); contenido mínimo; cooperación ante la SIC. | Art. 18(k) Ley 1581; §4 del Anexo de Encargo |
| 9 | **Devolución y supresión** | Eliminación de todos los objetos, incluidos snapshots y ciclo de vida, al terminar el servicio o al instruir la supresión; **certificación** de eliminación; ciclo de vida configurado a la retención pactada. | Art. 25; Anexo §6 y §10 |
| 10 | **Auditoría y responsabilidad demostrada** | Derecho de K+AIR a obtener el informe SOC 2 y certificaciones vigentes, a enviar cuestionarios y a auditar (o a auditar mediante tercero), con plazo máximo razonable; obligación de entregar a la Empresa la evidencia del parágrafo 1º del num. 3.2. | Art. 17(i) y 25 Ley 1581; parágrafo 1º del num. 3.2 |
| 11 | **Instrucciones documentadas del Responsable** | Obedecer las instrucciones documentadas de la Empresa que llegan por conducto de K+AIR, e informar si alguna es contraria a la ley. | Art. 25; art. 17(o) y 18(l) Ley 1581 |
| 12 | **Confidencialidad y secreto profesional** | Confidencialidad indefinida sobre nombres de archivos, metadatos y la existencia misma de la relación. | Art. 4(g), 25 |
| 13 | **Responsabilidad e indemnización** | Que K+AIR pueda repetir contra el proveedor lo que pague a la Empresa o a los Titulares; **reconocer que la limitación de responsabilidad de los Términos no opera** frente a las obligaciones de protección de datos. | Art. 18 Ley 1581 |
| 14 | **Derecho colombiano y jurisdicción** | Ley aplicable colombiana para las obligaciones de protección de datos (o una cláusula de alcance que no desvirtúe las obligaciones de la SIC). Sin esta cláusula, la remisión a la SIC y el deber de informar de la Empresa quedan sin destino. | Art. 17(o) y 18(l) Ley 1581 |
| 15 | **Terminación y asistencia** | Derecho de K+AIR a obtener la restitución íntegra de los `.enc` (que es la operación que K+AIR puede hacer porque posee la frase) y asistencia en la migración. | Continuidad del servicio; art. 25 |
| 16 | **Vigencia, supervivencia y no cesión** | Vigencia mientras exista el servicio; supervivencia de confidencialidad, supresión y auditoría. | — |

---

## 4. Lo que queda como acto del owner (nada de esto lo hace un texto)

1. **Abrir la cuenta de Backblaze B2 y crear el bucket en la región United States** (no en CA-East ni
   en EU-Central), y **documentar** nombre, región, endpoint y fecha.
2. **Negociar y firmar el instrumento con Backblaze** con las 16 cláusulas de §3.
3. **Instalar el script y el cron**, hacer la **primera copia verificada por SHA-256** y **probar la
   restauración desde el destino**.
4. **Asegurar la custodia de la frase de cifrado** en un sitio **colombiano**, fuera del servidor y
   fuera del bucket: si se pierde la máquina y con ella la frase, **todas las copias del bucket
   quedan inservibles**.
5. **Rotar las claves** de la aplicación B2 con mínimo privilegio y limitadas a ese bucket.
6. **Armar la v1.4 y el Encargo nuevo** con las adiciones de §5, publicar las dos copias idénticas,
   actualizar el manifiesto y **firmar** (o dejar constancia escrita de que se publica sin firma y con
   el gate en pendiente).
7. **Pedir al abogado externo** la ratificación de los cuatro puntos de §6.

---

## 5. Las tres adiciones (texto literal para pegar)

> **Advertencia general.** La adición **(i)** toca el texto que la propuesta v1.4 propone en **C2**.
> **El texto de C2 queda sustituido** por el de (i-c). No deben coexistir las dos redacciones. C1, C3,
> C4, C5 y C6 se aplican sin cambio, y **C7** queda servido por la adición **(ii)**.
>
> **Advertencia de estilo.** Se mantiene el del Anexo v1.3: entidades con nombre (`&oacute;`,
> `&iacute;`, `&aacute;`, `&eacute;`, `&uacute;`, `&ntilde;`, `&uuml;`, `&sect;`, `&mdash;`, `&laquo;`,
> `&raquo;`, `&ldquo;`, `&rdquo;`), etiquetas `<p>`, `<strong>`, `<code>`, `<table>`/`<thead>`/`<tbody>`,
> y la misma clase para las tablas. Sin entidades raras.

### (i-a) Anexo de Nube v1.4 — §4, **fila nueva de la tabla de proveedores**

> **Va después de la fila de Google.** Es una fila de la tabla de proveedores del §4, no del §11.

```html
      <tr>
        <td>Backblaze, Inc.</td>
        <td>Copia fuera del servidor de los respaldos cifrados de la base de datos y del almacenamiento de
        archivos (B2 Cloud Storage), alcanzada con <code>rclone</code> desde el servidor del Encargado</td>
        <td>Los archivos <code>.enc</code> del respaldo, que viajan <strong>cifrados</strong> (GPG sim&eacute;trico
        AES256) y que el proveedor <strong>no puede leer</strong>: la frase de cifrado no sale del servidor y no
        se transmite en ninguna operaci&oacute;n. Los metadatos del objeto (nombre, tama&ntilde;o, fecha de la copia,
        cuenta) <strong>no identifican a ning&uacute;n Titular ni a ninguna Empresa</strong>: el nombre del archivo
        es solo <code>firma-AAAAmmdd-HHMMSS.sqlite.enc</code> o <code>storage-AAAAmmdd-HHMMSS.tar.gz.enc</code>.
        El contenido cifrado s&iacute; incluye la base de datos del servicio, con los datos de las Empresas y de
        sus trabajadores, y por eso la copia es un contenedor &uacute;nico y com&uacute;n a todas las Empresas</td>
        <td><strong>Subencargado (Encargado del Encargado)</strong>, por la sola custodia de los archivos
        cifrados, por cuenta del Responsable (la Empresa) y por instrucci&oacute;n documentada del Encargado.
        <strong>Esta designaci&oacute;n produce efectos mientras el instrumento de la columna DPA est&eacute;
        vigente y sea aplicable a la cuenta del Encargado</strong>; el Encargado responde por el cumplimiento del
        subencargado en los mismos t&eacute;rminos en que responde por s&iacute; mismo</td>
        <td>Backblaze, Inc., con sede en San Francisco, California, Estados Unidos. El bucket se crea en la
        <strong>regi&oacute;n United States</strong> y los archivos del cliente se almacenan en centros de datos de
        Estados Unidos (regi&oacute;n US-West). <strong>La regi&oacute;n del bucket es condici&oacute;n de esta
        declaraci&oacute;n</strong>: el numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica de la SIC
        reconoce nivel adecuado de protecci&oacute;n a los Estados Unidos de Am&eacute;rica, y los archivos del
        cliente de Backblaze se almacenan en las regiones CA-East (Canad&aacute;) y EU-Central (Pa&iacute;ses Bajos)
        cuando la cuenta se crea en ellas. La regi&oacute;n efectiva del bucket queda declarada en el manifiesto del
        servicio</td>
        <td>Data Processing Addendum de Backblaze (M&oacute;dulo 2, tratamiento de los archivos del cliente por el
        Encargado del Encargado) y <strong>Anexo de tratamiento de datos de car&aacute;cter colombiano</strong> con
        el contenido m&iacute;nimo del art&iacute;culo 25 del Decreto 1377 de 2013 (alcances, actividades y las tres
        obligaciones m&iacute;nimas: tratar conforme a los principios que tutelan los datos, salvaguardar la
        seguridad de las bases de datos y guardar confidencialidad). URL del DPA:
        <code>https://www.backblaze.com/company/dpa.html</code>. Lista p&uacute;blica de subencargados:
        <code>https://www.backblaze.com/company/policy/subprocessors</code>. <strong>La suscripci&oacute;n de ese
        instrumento es un acto pendiente del owner y, mientras no ocurra, la designaci&oacute;n del subencargado
        queda condicionada a que exista</strong></td>
        <td>Si: eliminaci&oacute;n de los objetos al terminar el servicio o al instruir la supresi&oacute;n, con el
        ciclo de vida del bucket configurado y con certificaci&oacute;n de eliminaci&oacute;n. El Encargado instruye
        la eliminaci&oacute;n a Backblaze y responde frente a la Empresa por el resultado</td>
        <td>Si: informes de auditor&iacute;a y certificaciones del proveedor (SOC 2 y equivalentes), que el
        Encargado exige y mantiene a disposici&oacute;n del Responsable, y que son la evidencia de las medidas
        apropiadas y efectivas del par&aacute;grafo primero del numeral 3.2 del T&iacute;tulo V de la Circular
        &Uacute;nica</td>
      </tr>
```

### (i-b) Anexo de Nube v1.4 — §4, **párrafo que reemplaza** el que hoy dice que los respaldos no tienen proveedor externo

> **Reemplaza el párrafo de `anexo-nube-v1.3.html:328-330`.**

```html
  <p>Los respaldos, el monitoreo y el soporte: el <strong>monitoreo y el soporte</strong> los presta el Encargado
  con su propio personal, en la red local del operador, y <strong>no tienen proveedor externo detr&aacute;s</strong>;
  los <strong>respaldos</strong> s&iacute; tienen un proveedor externo desde la decisi&oacute;n de destino del
  12 de noviembre de 2026: el bucket de Backblaze B2 (B2 Cloud Storage) que se describe en la fila de la tabla
  anterior. <strong>Por eso los respaldos s&iacute; son un tratamiento con subencargado y el Encargado responde por
  ese subencargado en los mismos t&eacute;rminos en que responde por s&iacute; mismo</strong>. El resto de los
  proveedores externos del Servicio son los que figuran en la tabla.</p>
```

### (i-c) Anexo de Nube v1.4 — §3, **párrafo «Respaldos:»** (reemplaza el actual, y sustituye el texto propuesto en C2)

> **Reemplaza `anexo-nube-v1.3.html:199-215`** (el párrafo «Respaldos:»), dentro del §3 «Infraestructura y
> ubicación». Se entrega el párrafo entero porque un reemplazo de párrafo es atómico: pegar solo la mitad
> dejaría dos frases del §3 hablando de la copia al exterior en pasado y en futuro a la vez.

```html
  <p><strong>Respaldos:</strong> copias de la base de datos del servicio y de la evidencia en PDF, a cargo de
  Gesstiar S.A.S., con <strong>una copia local en el servidor y una copia fuera del servidor</strong>. La copia
  local es diaria, autom&aacute;tica, a las 22:00 (hora de Colombia, zona verificada el 26 de octubre de 2026 en el
  servidor de producci&oacute;n, que corre en <code>America/Bogota</code>), con verificaci&oacute;n de integridad de
  la copia y retenci&oacute;n configurada de treinta (30) d&iacute;as. La copia y su verificaci&oacute;n de
  integridad se probaron en el servidor el 26 de octubre de 2026 (copia de 458 752 B, integridad correcta). Las
  copias <strong>est&aacute;n cifradas en reposo</strong> con GPG sim&eacute;trico AES256 y una frase de paso que el
  owner conserva en una copia fuera del servidor: sin ella los respaldos son ilegibles y no hay recuperaci&oacute;n
  posible. <strong>La frase de paso nunca sale del servidor ni se transmite al destino.</strong>
  <strong>La copia fuera del servidor est&aacute; prevista con el script <code>deploy/backup-offsite.sh</code>, que
  copia solo los archivos ya cifrados, nunca borra la copia local y verifica por huella SHA-256 que la copia lleg&oacute;
  entera antes de darla por buena; desde esa verificaci&oacute;n se aplica la retenci&oacute;n de treinta (30)
  d&iacute;as en el destino.</strong> La apertura de la cuenta del proveedor, la creaci&oacute;n del bucket, la
  instalaci&oacute;n del script y la verificaci&oacute;n de la primera copia <strong>son actos pendientes del
  owner</strong>: este Anexo no declara ejecutada ninguna copia fuera del servidor mientras esa primera copia
  verificada no exista, y se actualiza con su evidencia cuando exista. Los treinta (30) d&iacute;as son
  <strong>retenci&oacute;n de COPIAS de respaldo, no de los registros</strong>: el plazo de cada registro es el que
  declara la Empresa, y un deber legal de conservaci&oacute;n (hold) impide suprimirlo y obliga a conservar sus
  respaldos. <strong>La conservaci&oacute;n que se satisface con el respaldo local y con el respaldo en el destino
  se declara en el manifiesto del servicio, con la retenci&oacute;n efectiva de cada copia; este Anexo no afirma una
  retenci&oacute;n en el destino que el servicio no pueda demostrar.</strong> La supresi&oacute;n del 8.6 alcanza a
  nivel de registro a las copias que siguen existiendo, mediante una purga peri&oacute;dica de los respaldos que
  descifra, suprime, recifra y reemplaza cada copia de forma at&oacute;mica. Adem&aacute;s, el primer d&iacute;a de
  cada mes a las 04:00 se ejecuta una prueba de restauraci&oacute;n que comprueba la integridad y las tablas del
  &uacute;ltimo respaldo y borra el temporal al terminar, sin dejar datos personales en el servidor.
  <strong>El destino de la copia fuera del servidor est&aacute; en Estados Unidos</strong>: el flujo es una
  <strong>transmisi&oacute;n internacional</strong> de datos personales en los t&eacute;rminos del art&iacute;culo
  2.2.2.25.1.3, numeral 5, del Decreto 1074 de 2015, porque el proveedor custodia los archivos como Encargado por
  instrucci&oacute;n del Encargado y por cuenta del Responsable; la prohibici&oacute;n del art&iacute;culo 26 de la
  Ley 1581 de 2012 no se activa, porque los Estados Unidos de Am&eacute;rica figuran en el numeral 3.2 del
  T&iacute;tulo V de la Circular &Uacute;nica de la SIC, y en todo caso esa transmisi&oacute;n no requiere ser
  informada al Titular ni contar con su consentimiento, porque existe contrato en los t&eacute;rminos del
  art&iacute;culo 25 del Decreto 1377 de 2013. <strong>Lo que viaja es texto cifrado y la frase no viaja</strong>;
  lo que el destino ve es el contenido cifrado, los metadatos de la copia y los metadatos de la cuenta del
  Encargado, y nada m&aacute;s. <strong>Monitoreo:</strong> a cargo de Gesstiar S.A.S., de forma interna, sin
  proveedor externo: un programa que revisa el servicio cada cinco (5) minutos, lo reinicia si ha ca&iacute;do y
  deja registro en bit&aacute;cora; consta instalado en el servidor en el despliegue del 26 de octubre de 2026.
  <strong>No avisa a ninguna persona</strong>: no hay alerta externa, as&iacute; que la recuperaci&oacute;n empieza
  cuando alguien se entera, no cuando el servicio cae. <strong>Soporte:</strong> interno, a cargo de Gesstiar
  S.A.S. <strong>Seguridad f&iacute;sica:</strong> a cargo de Gesstiar S.A.S., de forma interna, sin proveedor
  externo: el servidor est&aacute; en la red local del operador, detr&aacute;s de NAT. <strong>Continuidad:</strong>
  el tiempo objetivo de recuperaci&oacute;n (RTO) es de 4 horas, con el car&aacute;cter de objetivo de
  recuperaci&oacute;n dependiente de la detecci&oacute;n y del inicio de la respuesta, y el punto objetivo de
  recuperaci&oacute;n (RPO) es de 24 horas, alineado con el respaldo diario; son compromisos propios del
  Encargado, no plazos que fije una norma. Plan de continuidad operativa: copia diaria con retenci&oacute;n de
  30 d&iacute;as de COPIAS de respaldo (no de los registros) y prueba de restauraci&oacute;n mensual; el 26 de
  octubre de 2026 se prob&oacute; una restauraci&oacute;n completa en el servidor (26 tablas y la empresa
  registrada). Si el servidor no vuelve, se restaura en otro equipo con la imagen del sistema y el &uacute;ltimo
  respaldo, descifrado con la frase que el owner conserva fuera del servidor, se avisa a cada Empresa por el
  canal de PQRS y la firma se reanuda una vez restablecido el servicio, sin que las firmas realizadas pierdan
  validez.</p>
```

### (ii-a) Anexo de Nube v1.4 — §1, **literal nuevo** (declaración de los actos del 12-nov)

> **Va en el bloque «estado declarado» del §1**, después del literal de «Pendientes del proceso de
> regularización del canal de correo» y antes del literal del cifrado.

```html
      <li><strong>Los dos instrumentos anteriores s&iacute; quedaron suscritos y contrafirmados el 12 de noviembre
      de 2026.</strong> El <strong>Anexo de Nube versi&oacute;n 1.3</strong> (huella SHA-256
      <code>fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d</code>, 85 143 bytes) fue suscrito por
      ASEPLUS CARIBE S.A.S. (NIT 900.829.731-1), en calidad de Responsable, el
      <strong>2026-11-12T15:38:27.990Z</strong> (suscripci&oacute;n id 2; firmante: Lilia Mar&iacute;a
      V&aacute;squez Mu&ntilde;oz, Representante legal; IP de la firma 181.63.26.145), y fue contrafirmado por
      GESSTIAR S.A.S., en calidad de Encargado, el <strong>2026-11-12T16:13:54.106Z</strong> por Javier Robles
      Fontalvo, Representante Legal, con la facultad acreditada antes del acto; acta de contrafirma
      <code>acta-2-contrafirma-anexo-nube.pdf</code> (SHA-256
      <code>050f223a3665cf7d0f159a30669085238125f733688c31ba6e2385512c74a501</code>). El
      <strong>Anexo de Encargo de Tratamiento de Datos Personales versi&oacute;n 2026-11-11</strong> (huella
      SHA-256 <code>6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948</code>) fue suscrito por la
      misma Empresa el <strong>2026-11-12T15:40:06.992Z</strong> (suscripci&oacute;n id 2; acta
      <code>acta-2-anexo-encargo.pdf</code>, SHA-256
      <code>c0ca4211dbb2c67dfed259583ef2e73c10c56c79436b012147790619b22d21f6</code>) y contrafirmado por GESSTIAR
      S.A.S. el <strong>2026-11-12T16:14:31.105Z</strong> (acta
      <code>acta-2-contrafirma-anexo-encargo.pdf</code>, SHA-256
      <code>5dcb214928927f08eed3ee17712a952f46b87bb4479cf0bb9e668e814404b062</code>). Los cuatro rastros son
      append-only en <code>gh_firma_anexo_nube_eventos</code> y
      <code>gh_firma_anexo_encargo_eventos</code>, y las fechas de ejecuci&oacute;n quedaron en la ficha de la
      Empresa (<code>anexo_nube_firmado_at</code>, <code>anexo_nube_ejecutado_at</code>,
      <code>anexo_encargo_suscrito_at</code>). <strong>Las versiones ya suscritas no se reescriben:</strong> la
      v1.1 del Anexo de Nube queda como registro hist&oacute;rico, suscrita el 5 de noviembre de 2026 y
      <strong>sin contrafirma</strong>, y la v1.3 queda en <code>versiones_firmadas</code> con su huella y su
      evidencia. Esta declaraci&oacute;n se hace en la v1.4 y no altera los instrumentos ya ejecutados.</li>
```

### (ii-b) Anexo de Encargo (versión nueva) — §5, **párrafo final** (reemplaza el de prevalencia)

```html
  <p><strong>Prevalencia entre este Anexo de Encargo y el Anexo de Nube.</strong> En caso de conflicto entre este
  Anexo de Encargo y el Anexo de Nube, prevalece el instrumento bilateral m&aacute;s reciente suscrito por ambas
  partes. La redacci&oacute;n de la secci&oacute;n 2 de este Anexo, que deja al Anexo de Nube la infraestructura y los
  subencargados, se conserva intacta: es la que determina qui&eacute;n responde por la infraestructura, y esta
  cl&aacute;usula se a&ntilde;ade como regla de cierre del conflicto. <strong>Este Anexo de Encargo remite a la
  versi&oacute;n 1.4 del Anexo de Nube y no la sustituye.</strong> <strong>Los actos ya ejecutados son los
  siguientes</strong>: el Anexo de Nube versi&oacute;n 1.3 (SHA-256
  <code>fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d</code>) qued&oacute; suscrito por
  ASEPLUS CARIBE S.A.S. el 12 de noviembre de 2026 a las 15:38:27.990Z y contrafirmado por GESSTIAR S.A.S. el
  12 de noviembre de 2026 a las 16:13:54.106Z; este Anexo de Encargo en su versi&oacute;n 2026-11-11 (SHA-256
  <code>6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948</code>) qued&oacute; suscrito por la
  misma Empresa el 12 de noviembre de 2026 a las 15:40:06.992Z y contrafirmado por GESSTIAR S.A.S. el 12 de
  noviembre de 2026 a las 16:14:31.105Z, con las actas y las huellas que el manifiesto del servicio registra. En
  consecuencia, <strong>los dos instrumentos anteriores no son pasos pendientes: son instrumentos ejecutados</strong>,
  y sus textos y sus efectos se conservan sin alteraci&oacute;n. <strong>La suscripci&oacute;n y la contrafirma de
  esta versi&oacute;n nueva de este Anexo de Encargo y de la versi&oacute;n 1.4 del Anexo de Nube, en cambio, son
  pasos pendientes, con nombre y responsable, en esta secci&oacute;n</strong>, y hasta que ocurran, el manifiesto
  del servicio declara estos textos como no firmados.</p>
```

### (iii-a) Anexo de Nube v1.4 — §1, **literal nuevo** (el manifiesto declara lo que no está firmado)

> **Va en el bloque «estado declarado» del §1**, después del literal de (ii-a).

```html
      <li><strong>Estado de suscripci&oacute;n de esta versi&oacute;n 1.4.</strong> <strong>Esta versi&oacute;n 1.4
      no est&aacute; suscrita ni contrafirmada a la fecha de esta versi&oacute;n</strong>, y el manifiesto del
      servicio la declara <strong>no firmada</strong> (valores <code>firmado = false</code> y
      <code>contrafirmado = false</code>) mientras no ocurran los dos actos. <strong>La suscripci&oacute;n de la
      Empresa y la contrafirma del Encargado son pasos pendientes, con nombre y responsable.</strong> El manifiesto
      es la fuente de verdad del estado de suscripci&oacute;n, y la regla del expediente es que <strong>un texto no
      suscrito no aparece como suscrito en ninguna parte</strong>: mientras esta versi&oacute;n 1.4 no est&eacute;
      firmada, las versiones anteriores que s&iacute; lo est&aacute;n (la v1.1 y la v1.3 del Anexo de Nube, y las
      versiones 2026-11-06 y 2026-11-11 del Anexo de Encargo) siguen declar&aacute;ndose con sus fechas, sus actas
      y sus huellas en <code>versiones_firmadas</code>, sin reescribirse. La p&eacute;rdida del estado
      &laquo;firmado&raquo; en el manifiesto durante ese per&iacute;odo es el precio de no publicar un texto falso, y
      es el mismo estado que ten&iacute;a la v1.3 antes del 12 de noviembre de 2026. Si el owner decide publicar la
      v1.4 sin firma, esa decisi&oacute;n queda escrita en el expediente con su responsable y su fecha, y el
      manifiesto sigue declarando el texto como no firmado.</li>
```

> **⚠️ No verificado — el nombre y la huella del acta de *suscripción* de la v1.3.** En el manifiesto del
> servicio aparecen con nombre y huella las actas de contrafirma (`acta-2-contrafirma-anexo-nube.pdf`) y las
> dos del Encargo; **no aparece** el acta de suscripción de la v1.3. *Cómo confirmarlo:* en la carpeta de
> actas del servidor y en `gh_firma_anexo_nube_eventos` (evento `ACTA_GENERADA` de la suscripción id 2).
> **Por eso el literal (ii-a) cita con nombre y huella el acta de contrafirma, y no la de suscripción**, y no
> inventa un nombre de archivo.

---

## 6. Lo que se le pide al abogado externo (resumen)

1. **Ratificar la calificación jurídica**: ¿**transmisión internacional** (Encargado → Encargado) o
   **transferencia** (si Backblaze llegara a calificar como Responsable)? La redacción de (i-a) a
   (i-c) asume transmisión.
2. **Ratificar la vía**: nivel adecuado de protección de EE. UU. (num. 3.2 del Título V) más el art. 24.2
   del Decreto 1377 y el contrato del art. 25; y que **no** se pide declaración de conformidad de la SIC
   ni autorización del Titular.
3. **Revisar el esquema de cláusulas** (§3) y decir cuáles son innegociables desde el derecho y cuáles
   son comerciales: en particular **incidentes en 24 horas**, **auditoría** y **derecho colombiano
   aplicable**, porque los Términos del Servicio de Backblaze se rigen por derecho extranjero.
4. **Revisar la redacción** de (i-a) a (i-c), (ii-a), (ii-b) y (iii-a) antes de que se arme el HTML
   definitivo, y confirmar en particular: (a) que la **designación condicional** del subencargado es la
   forma correcta; (b) que la **declaración de los actos del 12-nov** es un hecho y no una declaración,
   con la salvedad del acta de suscripción de la v1.3; (c) que la **regla del manifiesto** satisface el
   principio de veracidad del art. 4(d) de la Ley 1581; y (d) que la frase sobre el `hold` del §3 no
   promete lo que el destino no cumple (con la corrección del 12-nov-2026, sí lo cumple).

---

## 7. Descargo

Esto es una lectura informativa de normas públicas verificadas en fuente oficial el 12 de noviembre de
2026, aplicada a los hechos que documenta el propio repositorio. **No constituye asesoría jurídica
profesional**: la decisión final, la firma y la responsabilidad son del owner (Gesstiar S.A.S.), y el
pronunciamiento de los cuatro puntos de §6 es del abogado externo.
