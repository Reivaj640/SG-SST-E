# Firma Electrónica K+AIR v1 — Marco Legal y Consideraciones Jurídicas

**Versión del documento**: 0.1 (borrador para revisión jurídica externa)
**Fecha**: 2026-08-17
**Estado**: Borrador para revisión por **abogado laboral colombiano** antes de producción.
**Documentos rectores**:
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`DATA_MODEL.md`](./DATA_MODEL.md)
- [`API.md`](./API.md)
- [`FLOWS.md`](./FLOWS.md)
- [`SECURITY.md`](./SECURITY.md)

> ⚠️ **Aviso importante (LEER ANTES DE USAR ESTE DOCUMENTO)**
>
> Este documento es un **análisis preliminar** del marco normativo
> aplicable a la arquitectura de Firma Electrónica K+AIR v1.
>
> **NO constituye asesoría jurídica.** Su propósito es:
>
> 1. Servir como insumo para que un **abogado laboral colombiano**
>    revise el diseño y proponga ajustes.
> 2. Documentar qué requisitos normativos intenta satisfacer la
>    arquitectura.
> 3. Identificar puntos donde se necesita criterio jurídico
>    profesional.
>
> **Ninguna afirmación de este documento debe interpretarse como
> "cumplimiento legal"**. El cumplimiento definitivo requiere:
>
> - Revisión del texto del **Acuerdo de uso de firma electrónica**
>   por abogado.
> - Revisión de la **manifestación de voluntad** por abogado.
> - Validación del **plazo de retención** por abogado.
> - Validación de la **política de protección de datos** por
>   abogado.
>
> **El sistema NO debe usarse en producción con trabajadores
> reales hasta que estas validaciones se completen.**

---

## Tabla de contenidos

- [1. Propósito de este documento](#1-propósito-de-este-documento)
- [2. Marco normativo colombiano aplicable](#2-marco-normativo-colombiano-aplicable)
- [3. Análisis por requisito normativo](#3-análisis-por-requisito-normativo)
- [4. Acuerdo de uso de firma electrónica](#4-acuerdo-de-uso-de-firma-electrónica)
- [5. Manifestación de voluntad](#5-manifestación-de-voluntad)
- [6. Constancia de firma](#6-constancia-de-firma)
- [7. Plazo de retención documental](#7-plazo-de-retención-documental)
- [8. Protección de datos personales (Ley 1581/2012)](#8-protección-de-datos-personales-ley-15812012)
- [9. Riesgos legales identificados](#9-riesgos-legales-identificados)
- [10. Checklist de validación jurídica](#10-checklist-de-validación-jurídica)
- [11. Lo que K+AIR NO hace (limitaciones reconocidas)](#11-lo-que-kair-no-hace-limitaciones-reconocidas)
- [12. Glosario jurídico](#12-glosario-jurídico)
- [13. Anexo: textos referenciados de las normas](#13-anexo-textos-referenciados-de-las-normas)

---

## 1. Propósito de este documento

Este documento está dirigido principalmente al **abogado laboral
colombiano** que revisará la arquitectura de Firma Electrónica
K+AIR v1 antes de su puesta en producción. Su estructura es:

1. **Marco normativo**: qué normas son aplicables y por qué.
2. **Análisis por requisito**: cómo K+AIR intenta alinearse con
   cada norma.
3. **Acuerdo de uso**: plantilla de cláusulas que el abogado debe
   revisar y ajustar.
4. **Manifestación de voluntad**: texto propuesto.
5. **Constancia de firma**: qué debe contener para ser
   probatoria.
6. **Plazo de retención**: propuesto, sujeto a validación.
7. **Protección de datos**: alineación con Ley 1581/2012.
8. **Riesgos legales**: identificación preliminar.
9. **Checklist de validación**: lo que el abogado debe aprobar.

**El abogado debe firmar** un documento de validación por cada
sección crítica antes del go-live.

---

## 2. Marco normativo colombiano aplicable

### 2.1. Tabla resumen

| Norma | Materia | Aplicabilidad |
|---|---|---|
| **Ley 527 de 1999** | Mensajes de datos, comercio electrónico, firma digital | Marco general. Aplica a toda comunicación electrónica. |
| **Decreto 2364 de 2012** | Reglamenta firma electrónica, criterios de confiabilidad | Criterios para considerar confiable una firma electrónica. |
| **Decreto 1072 de 2015** (arts 2.2.1.1.8 a 2.2.1.1.13) | Reglas laborales sobre firma electrónica del contrato | Aplica a la firma del contrato de trabajo y otros documentos laborales. |
| **Decreto 526 de 2021** | Adiciona al 1072, regula firma electrónica del contrato laboral | Requisitos específicos para el contrato individual de trabajo. |
| **Ley 1581 de 2012** | Protección de datos personales | Aplica al tratamiento de datos del firmante. |
| **Decreto 1377 de 2013** | Reglamenta Ley 1581 | Procedimientos específicos. |
| **Ley 2121 de 2021** | Trabajo remoto, OTP | **Solo referencia complementaria** (menciona OTP en trabajo remoto). NO es columna vertebral. |
| **Código Sustantivo del Trabajo** (arts 23, 37, 38, 39, 46, 47) | Contrato individual de trabajo | Forma del contrato, modificaciones, prueba. |

### 2.2. Jerarquía

```
Constitución Política (arts 25, 53)
  │
  ▼
Ley 527/1999 (firma electrónica - marco general)
  │
  ▼
Decreto 2364/2012 (criterios firma electrónica)
  │
  ▼
Ley 1581/2012 (protección datos personales)
  │
  ▼
Decreto 1072/2015 (reglas laborales)
  │  incluye Decreto 526/2021
  ▼
Código Sustantivo del Trabajo
```

---

## 3. Análisis por requisito normativo

### 3.1. Ley 527 de 1999

**Artículos relevantes**:

- **Art. 6**: cuando cualquier norma requiera información por
  escrito, ese requisito se satisface con un mensaje de datos si
  la información es accesible para su ulterior consulta.
- **Art. 7**: el mensaje de datos se satisface cuando es
  atribuible a su autor, está disponible para quien debe
  recibirlo, y conserva su integridad.
- **Art. 28**: cuando una norma exija firma autógrafa, esa
  exigencia se satisface con una firma electrónica si:
  - Es atribuible al firmante.
  - Es confiable según lo acordado o lo esperado.
  - El método usado es aprobado por las partes o por la ley.

**Cómo K+AIR intenta satisfacer el requisito**:

| Requisito Ley 527 | Solución K+AIR |
|---|---|
| Atribuible al firmante | Identificación por cédula cotejada con `base_personal`. |
| Confiable | OTP + manifestación de voluntad + integridad (SHA-256) + trazabilidad (eventos). |
| Método aprobado | Acuerdo de uso firmado previamente. |
| Accesible para ulterior consulta | PDF + Constancia + eventos en BD, conservados. |
| Integridad | `document_hash_firmado` + `evidence_hash`. |

**Pendiente de validación**: confirmar que el conjunto
(identificación + autenticación + voluntad + integridad +
trazabilidad) es suficiente para ser considerado "firma
electróпica" según el art. 28.

### 3.2. Decreto 2364 de 2012

**Artículo 4 — Criterios para considerar confiable una firma
electrónica**:

> "Para efectos del artículo 28 de la Ley 527 de 1999, una firma
> electrónica será confiable si cumple con los siguientes
> requisitos:
>
> a) Identificabilidad: el firmante puede ser identificado de
> manera unívoca.
>
> b) Integridad: la firma permite verificar que el documento no
> ha sido alterado desde el momento de la firma.
>
> c) No repudio: la firma permite verificar que el firmante no
> puede negar haber firmado.
>
> d) Confidencialidad: la firma permite proteger la información
> contra acceso no autorizado."

**Cómo K+AIR intenta satisfacer cada criterio**:

| Criterio | Solución K+AIR |
|---|---|
| Identificabilidad | Cédula cotejada + OTP al correo registrado + IP/UA. |
| Integridad | SHA-256 (`document_hash_firmado` + `evidence_hash`). |
| No repudio | Línea de tiempo de eventos + hashes verificables. |
| Confidencialidad | TLS + hash de datos sensibles + redacción de logs. |

**Pendiente de validación**: el criterio de "no repudio" es el
más exigente. Confirmar si la combinación de eventos + hashes es
suficiente o si se necesita un TSA (Time Stamping Authority)
cualificado.

### 3.3. Decreto 1072 de 2015 (artículos 2.2.1.1.8 a 2.2.1.1.13)

**Art. 2.2.1.1.8**: el contrato de trabajo puede celebrarse por
escrito o verbalmente, y cuando se celebre por escrito, **puede
ser firmado electrónicamente**.

**Art. 2.2.1.1.9** (adicionado por Decreto 526/2021): el contrato
de trabajo suscrito electrónicamente debe cumplir con los
requisitos del art. 23 del CST.

**Art. 2.2.1.1.10**: la firma electrónica puede materializarse
mediante:
- Códigos.
- Contraseñas.
- Datos biométricos.
- Claves criptográficas privadas.

Siempre que permita **identificar al firmante** y sea **confiable
según la ley**.

**Art. 2.2.1.1.11**: el empleador debe proporcionar los medios
para la firma electrónica, **sin que el costo pueda trasladarse
al trabajador**. Los medios pueden ser desarrollos propios o
contratados.

**Art. 2.2.1.1.12**: conservación de documentos firmados
electrónicamente con **autenticidad, integridad y
disponibilidad**. El empleador debe **suministrar copia al
trabajador** cuando este lo solicite.

**Art. 2.2.1.1.13**: la firma electrónica no excluye el uso de
firma autógrafa si las partes lo acuerdan.

**Cómo K+AIR intenta satisfacer cada artículo**:

| Artículo | Solución K+AIR |
|---|---|
| 2.2.1.1.8 | Contrato se puede firmar vía web (no requiere papel). |
| 2.2.1.1.9 | Cumplimiento de requisitos del art. 23 CST (datos del contrato). |
| 2.2.1.1.10 | OTP = "código" del art. 2.2.1.1.10. Identificación vía cédula. |
| 2.2.1.1.11 | K+AIR es desarrollo propio del empleador. Costo es del empleador. |
| 2.2.1.1.12 | PDFs + Constancias conservados. Copia al trabajador por correo. |
| 2.2.1.1.13 | Si el trabajador no puede firmar electrónicamente, K+AIR permite firma física. |

**Pendiente de validación**:

- Confirmar que la copia al trabajador por correo + descarga
  desde K+AIR cumple con el deber de "suministrar copia".
- Confirmar el plazo exacto de conservación.

### 3.4. Decreto 526 de 2021

**Aspectos clave**:

- Regula específicamente la firma electrónica del contrato
  individual de trabajo.
- El contrato puede ser firmado por **cualquiera de las partes
  o ambas** mediante firma electrónica.
- Se aplican los mismos requisitos que a la firma autógrafa.

**Cómo K+AIR lo aborda**:

- El diseño soporta que el trabajador firme (escenario primario).
- La firma por parte del empleador (RH) se hace con su cuenta
  K+AIR local, fuera del flujo del Servicio.

### 3.5. Ley 1581 de 2012 y Decreto 1377 de 2013

Aplica al tratamiento de datos personales del firmante. Ver
sección 8.

### 3.6. Ley 2121 de 2021

**Solo referencia complementaria** porque menciona el uso de OTP
en el contexto de trabajo remoto. **NO es la columna vertebral
del diseño.**

**Riesgo de usarla como base**: si la demanda laboral cuestiona
la firma y se alega que la OTP no es firma electrónica, citar
esta ley como base podría debilitar la defensa. Por eso usamos
Ley 527 + Decretos como columna vertebral, y la 2121 solo como
referencia complementaria.

### 3.7. Código Sustantivo del Trabajo (CST)

**Art. 23**: requisitos del contrato individual de trabajo
(escrito cuando el término es > 3 meses, con cláusulas
esenciales).

**Art. 37**: modificaciones del contrato deben constar por
escrito.

**Art. 38**: el contrato se entiende celebrado sin estipulación
de término cuando no se fija duración o condición.

**Art. 39**: cuando no se determine plazo, se presume a término
indefinido.

**Art. 46**: contrato a término fijo. **Si la duración es
inferior a 1 año, solo puede prorrogarse hasta 3 veces, y
después se convierte en indefinido.**

**Art. 47**: renovación automática del contrato a término fijo
por una sola vez. Si la duración original es > 1 año, la
prórroga es por un año.

**Aplicación a K+AIR**:

- Todos los documentos laborales (contratos, otrosí,
  actualizaciones, autorizaciones) son susceptibles de firma
  electrónica.
- La "congelación" del PDF antes de firmar es coherente con la
  inmutabilidad del contrato firmado.

---

## 4. Acuerdo de uso de firma electrónica

### 4.1. Naturaleza jurídica

> **Pendiente de validación por abogado**: confirmar la
> naturaleza exacta.

**Propuesta de K+AIR**: el Acuerdo es un **acto jurídico
autónomo** mediante el cual el trabajador:

1. Acepta el **mecanismo** de firma electrónica provisto por el
   empleador.
2. Reconoce que la firma electrónica produce los mismos efectos
   que la firma autógrafa.
3. Autoriza el tratamiento de sus datos personales para los
   fines del mecanismo.

**Lo que NO es el Acuerdo**:

- ❌ No es un contrato laboral.
- ❌ No es un consentimiento para todos los documentos futuros.
- ❌ No es una autorización de firma en blanco.
- ❌ No transfiere el costo del mecanismo al trabajador.

### 4.2. Cláusulas mínimas (propuesta para revisión)

> **IMPORTANTE**: estas cláusulas son una **propuesta inicial**.
> El abogado debe revisarlas, ajustarlas y completarlas.

```
ACUERDO DE USO DE FIRMA ELECTRÓNICA
Versión: v1.0
Fecha de entrada en vigencia: [FECHA]

Entre:
- [NOMBRE DE LA EMPRESA], NIT [NIT], en adelante "EL EMPLEADOR"
- [NOMBRE DEL TRABAJADOR], identificado con [TIPO] [NÚMERO],
  en adelante "EL TRABAJADOR"

CLÁUSULA PRIMERA — OBJETO
EL TRABAJADOR acepta el uso del mecanismo de firma electrónica
provisto por EL EMPLEADOR, consistente en la combinación de
identificación mediante documento de identidad, autenticación
mediante código de un solo uso (OTP) remitido a su correo
electrónico, manifestación de voluntad, y firma del documento
correspondiente a través de la plataforma K+AIR.

CLÁUSULA SEGUNDA — ALCANCE
La firma electrónica se utilizará para firmar documentos
relacionados con la relación laboral, incluyendo pero sin
limitarse a: contrato de trabajo, sus modificaciones (otrosí),
actualizaciones de datos, autorizaciones, certificaciones y
demás documentos que requieran firma del trabajador.

La firma electrónica aplicada a cada documento se considera
firmada de manera libre, voluntaria y con pleno conocimiento
de su contenido, surte los mismos efectos jurídicos que la
firma autógrafa conforme a la Ley 527 de 1999 y sus decretos
reglamentarios.

CLÁUSULA TERCERA — MANIFESTACIÓN INDEPENDIENTE
La aceptación de este Acuerdo NO implica la aceptación
automática del contenido de ningún documento en particular.
Cada documento requerirá una manifestación de voluntad
independiente y específica al momento de su firma.

CLÁUSULA CUARTA — AUTENTICACIÓN
EL TRABAJADOR reconoce que el código OTP remitido a su correo
electrónico registrado constituye un mecanismo de
autenticación, y que la firma electrónica es el CONJUNTO de
identificación + autenticación + voluntad + integridad +
trazabilidad, no únicamente el OTP.

CLÁUSULA QUINTA — CONSENTIMIENTO PARA TRATAMIENTO DE DATOS
EL TRABAJADOR autoriza el tratamiento de sus datos personales
(identificación, correo electrónico, dirección IP, user-agent
y metadata de la firma) por parte de EL EMPLEADOR y del
operador del mecanismo de firma, para los fines exclusivos de
generar, conservar y verificar la firma electrónica de
documentos laborales, conforme a la Ley 1581 de 2012.

CLÁUSULA SEXTA — CONSERVACIÓN
Las firmas electrónicas realizadas mediante este mecanismo,
junto con los documentos firmados y la metadata asociada, se
conservarán durante el plazo que exija la ley para la
documentación laboral.

CLÁUSULA SÉPTIMA — NO TRASLADO DE COSTO
EL EMPLEADOR asume la totalidad del costo del mecanismo de
firma electrónica. Ningún costo asociado a este mecanismo
podrá ser trasladado a EL TRABAJADOR.

CLÁUSULA OCTAVA — DERECHO A FIRMA FÍSICA
EL TRABAJADOR podrá optar, en cualquier momento y sin
justificación, por la firma autógrafa de cualquier documento.
En tal caso, EL EMPLEADOR proporcionará los medios para la
firma física.

CLÁUSULA NOVENA — LIMITACIÓN DE RESPONSABILIDAD
EL EMPLEADOR no será responsable por el uso indebido del
mecanismo de firma electrónica derivado del compromiso del
correo electrónico o del dispositivo del TRABAJADOR. EL
TRABAJADOR se compromete a mantener la seguridad de su correo
electrónico y a notificar inmediatamente cualquier anomalía.

CLÁUSULA DÉCIMA — VIGENCIA Y VERSIONES
Este Acuerdo se acepta por versión. Si EL EMPLEADOR modifica
el contenido de este Acuerdo, los nuevos firmantes deberán
aceptar la versión actualizada. Los firmantes que ya
aceptaron una versión anterior conservan la versión que
firmaron, salvo que decidan aceptar la nueva.

CLÁUSULA DÉCIMA PRIMERA — ACEPTACIÓN
EL TRABAJADOR declara haber leído, comprendido y aceptado
íntegramente el contenido de este Acuerdo.

Aceptación registrada electrónicamente con fecha [FECHA] y
hora [HORA].

CLÁUSULA DÉCIMA SEGUNDA — SUMINISTRO DE COPIA
(Texto propuesto, sujeto a revisión jurídica)

Al cierre de cada firma electrónica, EL EMPLEADOR suministrará
a EL TRABAJADOR, mediante envío a su dirección de correo
electrónico registrada, los siguientes documentos:

1. Copia del documento firmado en formato PDF inmutable.
2. Copia de la Constancia de firma electrónica, que contiene
   la metadata de la firma (fechas, identificadores, hashes de
   verificación, mecanismo utilizado, marco normativo
   aplicable).

Adicionalmente, EL TRABAJADOR podrá solicitar en cualquier
momento copia adicional de estos documentos a EL EMPLEADOR,
quien deberá proporcionarla en un plazo no superior a [X]
días hábiles.

Esta obligación se cumple en concordancia con el artículo
2.2.1.1.12 del Decreto 1072 de 2015.
```

> **Nota para el abogado**: el texto de esta cláusula es
> **propuesto** y está marcado como sujeto a revisión jurídica.
> Se incorporó para cerrar el requisito de "suministrar copia al
> trabajador" desde el Acuerdo mismo, no solo desde el Decreto.
> La redacción definitiva (plazos, formato, excepciones) debe
> aprobarla el abogado laboral colombiano.

### 4.3. Lo que el Acuerdo NO debe contener

- ❌ Cláusulas que eximan al empleador de responsabilidad legal.
- ❌ Cláusulas que limiten los derechos del trabajador.
- ❌ Cláusulas que transfieran costos al trabajador.
- ❌ Cláusulas que impidan la firma autógrafa como alternativa.
- ❌ Cláusulas que autoricen al empleador a firmar en nombre del
  trabajador.
- ❌ Cláusulas que constituyan un contrato laboral paralelo.

### 4.4. Pendiente de validación por abogado

- [ ] Naturaleza jurídica exacta del Acuerdo.
- [ ] Cláusulas obligatorias por la legislación colombiana.
- [ ] Texto definitivo de cada cláusula.
- [ ] Si requiere formalidades adicionales (notaría, registro,
      etc.).
- [ ] Si la versión electrónica tiene la misma fuerza que la
      versión física firmada en presencia de un testigo.
- [ ] Texto definitivo de la CLÁUSULA DÉCIMA SEGUNDA (suministro
      de copia): plazos, formato, excepciones.
- [ ] Marco normativo del "consentimiento" en la mini-app: el
      checkbox "He leído y acepto" + OTP al correo es suficiente
      para acreditar voluntad bajo el art. 28 Ley 527/1999.

---

## 5. Manifestación de voluntad

### 5.1. Naturaleza

La manifestación de voluntad es el acto por el cual el trabajador
afirma estar de acuerdo con el contenido del documento que está
firmando. Es **independiente del Acuerdo de uso** y se realiza
**cada vez** que el trabajador firma un documento.

### 5.2. Texto propuesto

> **Pendiente de revisión por abogado**.

**Propuesta inicial**:

```
"He leído, comprendido y acepto el contenido del documento
"[NOMBRE DEL DOCUMENTO]" en su totalidad. Confirmo que la
información contenida refleja mi voluntad libre y
voluntaria."
```

### 5.3. Requisitos que debe cumplir

- [ ] Ser lo suficientemente clara para que el trabajador
      entienda qué está aceptando.
- [ ] Incluir el nombre del documento específico.
- [ ] Incluir una declaración de voluntad libre y consciente.
- [ ] Ser corta y fácil de leer (no más de 3-4 líneas).
- [ ] Estar en español.
- [ ] Permitir al trabajador leer el documento ANTES de
      aceptarla.

### 5.4. Validación en el sistema

K+AIR valida que:

- El usuario llegó al final del documento (scroll_al_final =
  true).
- El usuario marcó un checkbox "He leído y acepto".
- El usuario pulsó el botón "Firmar".
- Todos los eventos se registran con timestamp.

---

## 6. Constancia de firma

### 6.1. Naturaleza jurídica

> **Pendiente de validación por abogado**: confirmar que la
> Constancia tiene la fuerza probatoria necesaria y si requiere
> formalidades adicionales.

**K+AIR NO usa el término "certificado digital"** porque tiene
una connotación técnica/jurídica específica (vinculada a PKI y
entidades de certificación). La Constancia de K+AIR es un
**documento probatorio** que:

- Da fe de la realización de la firma.
- Contiene todos los elementos de verificación.
- Permite la verificación por terceros (con o sin el Servicio).

### 6.2. Contenido mínimo

> **Pendiente de validación por abogado**: confirmar todos los
> campos.

La Constancia debe incluir (ver `ARCHITECTURE.md` §15.2 para el
detalle):

1. Identificación del documento firmado.
2. Identificación del firmante.
3. Identificación del empleador.
4. Fecha y hora con zona horaria.
5. Método de firma.
6. Mecanismo de autenticación.
7. Manifestación de voluntad.
8. ID de la solicitud.
9. Hashes de verificación.
10. URL de verificación.
11. Marco normativo aplicable.
12. ID único de generación de la Constancia.

### 6.3. Verificabilidad

La Constancia debe permitir la verificación por terceros:

- **Sin Servicio**: recalcular SHA-256 del PDF y comparar con
  `document_hash_firmado`.
- **Con Servicio**: `GET /verificar/:id_solicitud` (endpoint
  público futuro).

---

## 7. Plazo de retención documental

### 7.1. Marco normativo

- **Código Sustantivo del Trabajo, Art. 264** y siguientes:
  prescripción de acciones laborales (3-5 años según el caso).
- **Decreto 1072 de 2015, Art. 2.2.1.1.12**: conservación
  con autenticidad, integridad y disponibilidad (sin plazo
  específico).
- **Código de Comercio**: conservación de libros y papeles
  (10 años para comerciantes).
- **Ley 1581/2012**: los datos personales solo se conservan
  durante el plazo necesario para la finalidad.

### 7.2. Propuesta de K+AIR

> **Pendiente de validación por abogado**: el plazo exacto.

**Propuesta inicial**:

- **Mínimo 10 años** desde la terminación de la relación
  laboral, considerando prescripción + conservación de
  evidencia.
- **Mínimo 5 años** desde la firma del documento, para
  documentos sin relación laboral continua (autorizaciones,
  actualizaciones, etc.).
- El plazo mayor aplica por defecto.

### 7.3. Borrado seguro

Pasado el plazo, K+AIR debe:

1. Eliminar los registros de la BD (DELETE + VACUUM).
2. Eliminar los PDFs del filesystem (borrado seguro).
3. Anonimizar la metadata que no deba conservarse.
4. Rotar los backups antiguos.
5. Generar un acta de eliminación.

### 7.4. Pendiente de validación

- [ ] Plazo exacto de retención.
- [ ] Procedimiento de borrado seguro aceptado legalmente.
- [ ] Documentación obligatoria del borrado.

---

## 8. Protección de datos personales (Ley 1581/2012)

### 8.1. Datos personales tratados

K+AIR trata los siguientes datos del firmante:

| Dato | Categoría | Finalidad |
|---|---|---|
| Tipo + número de identificación | Dato personal | Identificación. |
| Correo electrónico | Dato personal | Envío de OTP y notificación. |
| IP | Dato personal | Evidencia de auditoría. |
| User-agent | Dato personal | Evidencia de auditoría. |
| Hash de la cédula | Dato personal derivado | Cotejo sin guardar cédula en plano. |
| Hash del OTP | Dato personal derivado | Autenticación. |
| Firma visual (PNG, opcional) | Dato biométrico (categoría especial) | Complemento opcional. |

### 8.2. Finalidad

Los datos se utilizan **únicamente** para:

- Generar evidencia de la firma electrónica.
- Permitir auditoría posterior (empleador, trabajador,
  autoridades).
- Cumplir obligaciones legales de conservación documental.

### 8.3. Base legal del tratamiento

- **Ejecución de la relación laboral** (Art. 6 Ley 1581).
- **Cumplimiento de obligaciones legales** (Art. 6 Ley 1581).
- **Consentimiento del titular** para el caso del Acuerdo de
  uso.

### 8.4. Derechos del titular (Art. 17 Decreto 1377/2013)

EL TRABAJADOR tiene derecho a:

- **Conocer**: qué datos se almacenan sobre él.
- **Actualizar**: datos desactualizados o incorrectos.
- **Rectificar**: datos incorrectos.
- **Suprimir**: cuando el tratamiento no respete los principios
  legales (sujeto a excepciones legales).
- **Revocar**: la autorización otorgada.
- **Presentar quejas** ante la Superintendencia de Industria y
  Comercio.

K+AIR debe permitir el ejercicio de estos derechos mediante:

- Acceso a la Constancia (que contiene sus datos).
- Solicitud de copia de la evidencia al empleador.
- Solicitud de corrección o eliminación al empleador, quien
  gestionará con K+AIR.

### 8.5. Obligaciones de seguridad

- **Confidencialidad**: solo personal autorizado accede a los
  datos.
- **Integridad**: hashes SHA-256.
- **Disponibilidad**: backups + uptime del Servicio.
- **No repudio**: línea de tiempo de eventos.

### 8.6. Política de privacidad

K+AIR debe contar con una **política de privacidad** publicada
que:

- Liste los datos tratados.
- Explique la finalidad.
- Indique los derechos del titular y cómo ejercerlos.
- Identifique al responsable del tratamiento.
- Indique el canal de quejas.

### 8.7. Pendiente de validación

- [ ] Política de privacidad revisada por abogado.
- [ ] Procedimiento de atención de derechos del titular.
- [ ] Registro de tratamiento de datos (cuando aplique).
- [ ] Aviso de privacidad en la mini-app.

---

## 9. Riesgos legales identificados

### 9.1. Riesgos altos

| Riesgo | Probabilidad | Mitigación | Pendiente |
|---|---|---|---|
| **Trabajador repudia haber firmado** | Media | Eventos + hashes + correo | Validación de TSA con abogado. |
| **Cuestionamiento del OTP como firma** | Media | Marco normativo (Ley 527 + Decretos) | Confirmar con abogado que el marco es suficiente. |
| **Inconsistencia entre Acuerdo de uso y firma física** | Baja | Acuerdo versionado | Revisar cláusula de coexistencia. |
| **Cuestionamiento de la copia al trabajador** | Baja | Correo automático + descarga | Validar con abogado que es suficiente. |
| **Violación de protección de datos** | Baja | Política + cifrado + hash | Auditoría de cumplimiento. |

### 9.2. Riesgos medios

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Disputa sobre el contenido del Acuerdo | Media | Versionado + hash del texto. |
| Disputa sobre el plazo de retención | Baja | Política documentada. |
| Cambio normativo que invalide el diseño | Baja | Arquitectura flexible + roadmap v1.1+ |

### 9.3. Riesgos bajos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Phishing al trabajador | Baja | HSTS + dominio único. |
| Denegación del Servicio | Baja | Cloudflare + redundancia. |

---

## 10. Checklist de validación jurídica

El abogado laboral colombiano debe validar y firmar (con su
tarjeta profesional) los siguientes puntos antes del go-live:

### 10.1. Marco normativo

- [ ] Confirmar que el marco identificado es suficiente.
- [ ] Recomendar ajustes a la jerarquía normativa.
- [ ] Identificar normas adicionales aplicables (ej. normas
      sectoriales).

### 10.2. Acuerdo de uso

- [ ] Validar la naturaleza jurídica propuesta.
- [ ] Aprobar el texto definitivo de cada cláusula.
- [ ] Recomendar cláusulas adicionales si son necesarias.
- [ ] Confirmar que la versión electrónica surte los mismos
      efectos que la física.

### 10.3. Manifestación de voluntad

- [ ] Aprobar el texto propuesto.
- [ ] Recomendar ajustes al flujo de manifestación.
- [ ] Confirmar que es suficiente para acreditar voluntad.

### 10.4. Constancia de firma

- [ ] Aprobar el contenido de la Constancia.
- [ ] Confirmar que tiene la fuerza probatoria necesaria.
- [ ] Recomendar elementos adicionales si son necesarios.

### 10.5. Retención documental

- [ ] Aprobar el plazo de retención propuesto.
- [ ] Recomendar ajustes al procedimiento de borrado.
- [ ] Confirmar el cumplimiento del Art. 2.2.1.1.12 del Decreto
      1072.

### 10.6. Protección de datos

- [ ] Aprobar la política de privacidad.
- [ ] Confirmar cumplimiento de Ley 1581/2012.
- [ ] Validar el procedimiento de derechos del titular.
- [ ] Recomendar el aviso de privacidad para la mini-app.

### 10.7. Riesgos

- [ ] Revisar la lista de riesgos legales identificados.
- [ ] Recomendar mitigaciones adicionales.
- [ ] Identificar riesgos no contemplados.

### 10.8. Documento de aprobación

> El abogado debe emitir un **documento formal de aprobación**
> que incluya:
>
> - Sus credenciales (tarjeta profesional).
> - Fecha de la revisión.
> - Lista de secciones revisadas.
> - Lista de hallazgos.
> - Dictamen final: "Apto para producción" / "Apto con
>   condiciones" / "No apto".

---

## 11. Lo que K+AIR NO hace (limitaciones reconocidas)

K+AIR Firma Electrónica v1 **NO**:

- ❌ Implementa firma digital criptográfica con certificado
  (PKI/X.509).
- ❌ Reemplaza la firma autógrafa cuando el trabajador lo
  solicita.
- ❌ Implementa biometría como mecanismo principal.
- ❌ Usa sellos de tiempo cualificados (TSA).
- ❌ Se integra con entidades de certificación abiertas.
- ❌ Reemplaza la asesoría jurídica especializada.
- ❌ Garantiza la validez de la firma ante todas las
  eventualidades legales.

K+AIR **es** un mecanismo diseñado para alinearse con el marco
normativo aplicable, sujeto a validación jurídica externa.

---

## 12. Glosario jurídico

| Término | Definición |
|---|---|
| **Firma electrónica** | Método de firma basado en medios electrónicos (Ley 527/1999, art. 1). |
| **Firma digital** | Firma electrónica basada en criptografía asimétrica con certificado (Ley 527/1999, art. 2). |
| **Mensaje de datos** | Información generada, enviada, recibida, archivada o comunicada por medios electrónicos (Ley 527/1999, art. 1). |
| **Manifestación de voluntad** | Declaración explícita de aceptación del contenido de un documento. |
| **Acuerdo de uso** | Convenio entre empleador y trabajador para el uso del mecanismo de firma electrónica. |
| **Constancia de firma** | Documento probatorio de la realización de una firma electrónica. |
| **No repudio** | Criterio que impide al firmante negar la autoría de la firma. |
| **Confiabilidad** | Criterio del Decreto 2364/2012 que cualifica una firma electrónica. |
| **Tratamiento de datos** | Cualquier operación sobre datos personales (Ley 1581/2012, art. 3). |
| **Responsable del tratamiento** | Persona que decide sobre el tratamiento de datos (Ley 1581/2012, art. 3). |
| **Titular** | Persona natural cuyos datos personales son objeto de tratamiento. |

---

## 13. Anexo: textos referenciados de las normas

### 13.1. Ley 527 de 1999, Art. 28

> "Cuando una norma exija o prevea la firma autógrafa, ese
> requisito se satisfará con una firma electrónica que cumpla
> con los requisitos establecidos en la presente ley.
>
> Para efectos de lo dispuesto en el presente artículo, cuando
> una norma exija o prevea la firma autógrafa, esa exigencia se
> satisfará de la siguiente manera:
>
> a) En los casos en que la ley exija la firma autógrafa de
> una persona, se entenderá satisfecho dicho requisito
> cuando ésta:
>
> 1. Utilice un método de firma electrónica conforme a los
> parámetros y requisitos establecidos en la presente ley y su
> reglamento.
>
> 2. Que al momento de la firma, el método utilizado permita
> identificar unívocamente al firmante.
>
> 3. Que el método utilizado permita establecer que la firma
> electrónica fue creada utilizando un medio bajo el control
> exclusivo del firmante al momento de la firma.
>
> 4. Que el método utilizado permita percibir cualquier
> alteración de la firma electrónica después del momento de
> la firma.
>
> b) En los casos en que la ley exija o prevea la firma
> autógrafa de un servidor público o de un particular con
> funciones públicas, se entenderá satisfecho el requisito
> cuando la firma electrónica cumpla con lo dispuesto en el
> literal anterior y adicionalmente cuente con un certificado
> digital vigente, expedido por una entidad de certificación
> autorizada."

**Nota**: el literal (b) NO aplica al caso del trabajador
firmando un contrato laboral (no es servidor público). El
literal (a) sí aplica, y se satisface con la arquitectura de
K+AIR.

### 13.2. Decreto 2364 de 2012, Art. 4

> (Ver sección 3.2 de este documento para la transcripción
> completa y el análisis.)

### 13.3. Decreto 1072 de 2015, Art. 2.2.1.1.10

> "Para efectos del presente Título, la firma electrónica
> podrá materializarse a través de mecanismos tales como
> códigos, contraseñas, datos biométricos o claves
> criptográficas privadas, que permiten identificar a la
> persona que firma el documento y, en general, cualquier otro
> mecanismo o procedimiento que permita identificar de manera
> unívoca al firmante."

**Análisis**: el OTP al correo es un **"código"** en el sentido
del artículo. La manifestación de voluntad es un mecanismo
adicional que refuerza la voluntad.

### 13.4. Decreto 1072 de 2015, Art. 2.2.1.1.12

> "Las empresas que hayan suscrito contratos de trabajo
> mediante firma electrónica deberán conservar los documentos
> con la firma respectiva, garantizando su autenticidad,
> integridad y disponibilidad, y suministrando copia de los
> mismos al trabajador cuando este lo requiera."

**Análisis**: K+AIR cumple con:

- **Autenticidad**: SHA-256 + eventos.
- **Integridad**: SHA-256 + verificación.
- **Disponibilidad**: VPS + backups.
- **Copia al trabajador**: correo automático + descarga desde
  K+AIR.

### 13.5. Ley 1581 de 2012, Art. 6

> "Tratamiento de datos personales. El tratamiento de datos
> personales solo puede realizarse con el consentimiento previo
> y expreso del titular, o en los casos previstos en la
> presente ley, particularmente en el artículo 10.
>
> El consentimiento debe ser libre, previo, expreso e
> informado.
>
> No se podrá tratar datos personales sin autorización del
> titular, salvo en los casos expresamente previstos en la
> ley."

**Excepciones aplicables (Art. 10)**:

- Datos necesarios para la ejecución de la relación laboral.
- Datos necesarios para el cumplimiento de obligaciones legales.

**Análisis**: el tratamiento de los datos del firmante se
basa en:

- **Consentimiento** (para el Acuerdo de uso).
- **Relación laboral** (para los documentos derivados de la
  misma).
- **Obligación legal** (para conservación de documentos
  laborales).

---

**Fin del documento.**

**Conjunto de documentación de Firma Electrónica K+AIR v1**:

```
docs/gestion-humana/firma-electronica/
├── ARCHITECTURE.md   48.7 KB  ← Documento maestro
├── DATA_MODEL.md     37.5 KB  ← Modelo de datos
├── API.md            31.2 KB  ← Endpoints
├── FLOWS.md          40.9 KB  ← Diagramas de secuencia
├── SECURITY.md       30.5 KB  ← Análisis de seguridad
└── LEGAL.md          37.0 KB  ← Marco legal (ESTE DOC)
                       ─────
                     226.3 KB
```

> **Próximo paso fuera de la documentación**: implementación del
> Servicio de Firma (Express + SQLite + mini-app) y de los
> handlers de K+AIR que lo consuman. **Solo después de la
> validación jurídica de este documento y de SECURITY.md.**
