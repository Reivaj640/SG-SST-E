# Evaluación del canal de correo — la condición contractual del proveedor de correo

**Fecha:** 27-oct-2026
**Estado:** insumo técnico para la decisión del owner y para el concepto del abogado.
**Aviso:** esto **no es un concepto jurídico**. Es la evaluación que el abogado pidió que quedara
documentada ("hay que resolver y documentar la evaluación del canal de correo antes de declarar
resuelta la condición"). Las conclusiones de derecho que aquí se apuntan salen de las fuentes
citadas, y **las confirma o corrige el abogado**.

---

## 1. Qué pregunta el abogado

Del Crítico 1 de su revisión del 27-oct-2026:

> "No basta con que los documentos declaren la condición y la dejen abierta. Hay que resolverla:
> determinar el rol real de Google, el destino de los datos, la operación jurídica aplicable y si
> se cumplen las condiciones legales correspondientes. Si la evaluación no está resuelta y
> documentada, el contrato no debería sostenerse en el flujo afectado."

Y su pregunta operativa: *"¿Basta que los tres documentos declaren la condición y la dejen abierta,
o el servicio no debería ofrecerse a nuevas Empresas hasta resolverla?"*

Este documento responde la primera parte con la evidencia disponible. La segunda es una decisión
administrativa del owner, y este documento dice qué cuesta cada salida.

---

## 2. Los hechos del canal, verificados contra el código y la configuración

| Eslabón | Quién lo presta hoy | ¿Contrato de encargo (DPA)? |
|---|---|---|
| Hosting y túnel | Cloudflare | **Sí** — DPA v6.4 (3-abr-2026), ya declarada en el Anexo de Nube |
| Base de datos y almacenamiento | Servidor `kair-server` (propio) | No aplica (no hay transferencia) |
| **Correo: enlace de acceso y aviso de firma** | Cuenta de K+AIR **o** cuenta propia de la Empresa (desde el 📦976, cifrada, con rastro y revocable) | **Es el eslabón abierto** |
| **Correo: OTP** | **Siempre desde la cuenta de K+AIR** | Mismo eslabón |

Verificado en el código: `src/services/mailer.js` (`sendOTP` ignora la cuenta de la Empresa y lo
avisa por log) y `src/services/cuentaEnvio.js` (cifrado `cifrado-cuenta-envio`, campo
`clave_cuenta_envio`, auditoría append-only, la clave nunca se devuelve ni se loguea).

La decisión técnica del 976 —**el OTP sale siempre desde la cuenta de K+AIR** porque es el dato de
creación y su custodia no puede depender de la Empresa— significa que **cambiar de proveedor de
correo afecta tanto el enlace como el OTP**: no hay un canal alternativo que quede fuera del
problema.

La cuenta de K+AIR hoy es una **cuenta Gmail de consumo**, sin contrato de encargo.

---

## 3. El marco legal aplicable (fuentes verificadas)

| Norma | Qué dice | Aplicación aquí |
|---|---|---|
| **Ley 1581 de 2012, art. 26** | Prohíbe transferir datos a países sin nivel adecuado. Excepciones: (a) autorización expresa e inequívoca del titular; (e) transferencias necesarias para la ejecución de un contrato con el titular, con su autorización | El marco de la transferencia |
| **Decreto 1074 de 2015, art. 2.2.2.25.5.1** (Decreto 1377 de 2013, art. 24) | Las transmisiones internacionales entre Responsable y Encargado **"no requerirán ser informadas al Titular ni contar con su consentimiento cuando exista un contrato en los términos del art. 2.2.2.25.5.2"** | La vía que **no** necesita consentimiento |
| **Decreto 1074 de 2015, art. 2.2.2.25.5.2** (Decreto 1377 de 2013, art. 25) | El **Contrato de transmisión** debe declarar los alcances, las actividades y las obligaciones del Encargado: (i) tratar conforme a los principios; (ii) salvaguardar la seguridad de las bases de datos; (iii) guardar confidencialidad | Los tres contenido obligatorios |
| **Circular Única SIC, Título V, 3.2** (actualizada por la Circular 001 del 9-ene-2026, DO 53.362) | Lista de países con **nivel adecuado de protección**: Alemania, Austria, …, **Estados Unidos de América**, …, Japón, Reino Unido, etc. | **El destino (EE.UU.) tiene nivel adecuado** |
| **Ídem, parágrafo primero** | Aun con nivel adecuado, por el **principio de responsabilidad demostrada** el Responsable debe poder **demostrar** que implementó medidas apropiadas y efectivas | La carga documental que falta |
| **Ídem, parágrafo tercero** | "El simple tránsito transfronterizo de datos no comporta una transferencia" (el simple paso por redes y servicios) | Por qué aquí **no** es tránsito: Google es un tercero que trata por sus propios términos |
| **Ídem, parágrafo cuarto** | Es posible la transmisión a países con nivel adecuado, en los términos de la transferencia | Puente entre las dos figuras |
| **Circular 2 de 2025 SIC** | Instrucciones para los procesos de **transferencia de tecnología** en los que se transfieran datos personales: hay que validar que la operación cumpla las reglas de transferencia/transmisión | Aplica al hecho de que el servicio vive en infraestructura extranjera |
| **Concepto SIC 25-632634 (25-feb-2026)** | Criterios para determinar el rol de Responsable o Encargado, las condiciones de la transmisión, la exigencia de contratos de transmisión, el alcance de la responsabilidad demostrada y las alternativas cuando el país receptor no cumple (Declaración de Conformidad) | El método que el abogado pide aplicar |
| **Ley 1581 de 2012, art. 27** | Normas Corporativas Vinculantes | Alternativa adicional, hoy no usada |

---

## 4. La distinción que decide el caso

| | **Transferencia internacional** | **Transmisión internacional** |
|---|---|---|
| El destinatario | Actúa como **Responsable** (trata por cuenta propia) | Actúa como **Encargado** (trata por cuenta del Responsable) |
| Base | Art. 26 Ley 1581 | Art. 2.2.2.25.5.1 y .2 del Decreto 1074 |
| Instrumento | Autorización del titular, causal de excepción o Declaración de Conformidad, **o** destino con nivel adecuado | **Contrato de transmisión** con los tres contenidos del 2.2.2.25.5.2 |
| ¿Hay que informar o consentir? | Depende: con destino adecuado, **no hace falta autorización** | **No**: "no requerirán ser informadas al Titular ni contar con su consentimiento" |

El abogado tiene razón en el punto central: **la categoría no la decide el contrato, la decide el
rol real del destinatario**. Y un contrato nuestro no puede convertir a Google en Encargado ni
imponerle obligaciones que Google no aceptó. Por eso "autorización expresa" no es la respuesta
automática: es una de las excepciones del art. 26, y solo tiene sentido cuando el destino **no**
tiene nivel adecuado.

---

## 5. El rol real de Google, según la modalidad

| Modalidad | Rol de Google | Evidencia |
|---|---|---|
| **Gmail de consumo** (la de hoy) | **Responsable**: no hay DPA; Google define las finalidades y los medios de su propio tratamiento | Google no ofrece contrato de encargo para cuentas de consumo |
| **Google Workspace** (o cualquier proveedor con DPA) | **Encargado**: "Customer is the controller and Google is a processor" | Data Processing Amendment de Google Workspace, cláusula 5.1 |

Con Gmail de consumo, el envío del correo a la casilla del Trabajador es una **transferencia
internacional**: Gesstiar (Responsable de la base) entrega datos a un tercero en el extranjero
que los trata por cuenta propia. No es "tránsito transfronterizo" del parágrafo tercero, porque
Google no es un simple paso por la red: es el destinatario que los trata.

---

## 6. Si es transferencia: ¿es lícita hacia Estados Unidos?

**Sí, por nivel adecuado de protección**, con tres condiciones:

1. **El destino está en la lista** del numeral 3.2 del Título V de la Circular Única (EE.UU. está).
2. **Principio de responsabilidad demostrada** (parágrafo primero): hay que poder **demostrar** las
   medidas. Aquí eso significa: cifrado en tránsito y en reposo, clave SMTP cifrada en la base con
   llave maestra fuera de la base, HMAC de identidad y OTP, control de acceso al servidor,
   registro append-only con disparadores de base que impiden UPDATE y DELETE, trazabilidad de
   cada envío y purga documentada. **Buena parte de esto ya está implementado y verificado**;
   lo que falta es el documento que lo declare.
3. **Validar la operación de transferencia de tecnología** conforme a la Circular 2 de 2025, y
   **declarar la transferencia** en el Registro Nacional de Bases de Datos (el formulario de la
   SIC pide el tipo de transferencia y su causal). **Esto está sin verificar**: hay que confirmar si
   Gesstiar está inscrita en el RNBD y si la transferencia internacional está declarada ahí.

**Consecuencia que cambia el texto:** la "autorización expresa del Titular" que el Acuerdo v1.1
propone como alternativa **no es lo que hace falta para esta operación**. Sería la excepción del
art. 26(a), pensada para cuando el destino no tiene nivel adecuado, y aquí el destino sí lo tiene.
Usarla de todas formas sería más débil de lo necesario y, como dice el abogado, **no puede ser una
autorización genérica**.

---

## 7. Las tres salidas, con su costo

### A. Cambiar el proveedor de correo a uno con DPA (Google Workspace u otro)

- **Efecto jurídico:** pasa a ser **transmisión internacional**. Con el contrato en los términos
  del 2.2.2.25.5.2, **no hay que informar al Titular ni pedir su consentimiento**, y no hace falta
  invocar el art. 26.
- **Efecto operativo:** el bloqueante del Anexo de Encargo desaparece; el Anexo de Nube suma la fila
  del nuevo proveedor; el texto puede declarar una operación cerrada en vez de una condición
  abierta.
- **Costo:** licencia del proveedor, migración de la cuenta de envío, y —lo más útil— la SIC ya
  publicó un **acuerdo modelo de transferencia internacional** y cláusulas tipo en la Circular
  Externa 002 de 2025, que sirven de base para redactar el contrato.
- **Efecto sobre la 1.b:** la cuenta propia de la Empresa (📦976) sigue valiendo: cada Empresa
  puede seguir usando su cuenta, pero su cuenta también cae en la misma categoría y necesita el
  mismo encuadre.

### B. Mantener el Gmail de consumo y documentar la transferencia

- **Efecto jurídico:** lícita por nivel adecuado, **siempre que** se cumplan las tres condiciones
  del punto 6 (demostración de medidas, validación Circular 2 de 2025, declaración en el RNBD).
- **Efecto operativo:** el texto deja de declarar "una condición contractual abierta" y declara lo
  que es: una **transferencia internacional a un país con nivel adecuado**, con el deber de
  demostrar las medidas.
- **Costo:** trabajo documental, no licences.
- **Riesgo que queda:** si el rol de Google se determinara como Encargado **sin** contrato, la
  operación no tendría base. Por eso la determinación del rol debe quedar escrita y no solo
  asumida.

### C. Autorización expresa del Titular

- **Solo sería necesaria** si el destino no tuviera nivel adecuado, o si se quisiera una capa
  adicional. Hoy no es necesaria, y el abogado ya advirtió que no puede ser genérica: tendría que
  ser expresa, inequívoca, informada, específica para la transferencia y revocable, y **no
  resuelve** el caso en que Google trata por cuenta propia.
- **Costo:** de implementación, alto (la autorización del Trabajador está en relación laboral, con
  asimetría de poder — justo lo que el abogado señala en el 3.1 de su revisión).

---

## 8. Qué implica en los tres documentos

| Documento | Qué hay que cambiar |
|---|---|
| **Acuerdo v1.1, 10.1 y 10.5(f)** | Hoy dicen que la condición contractual está **abierta**. Deben decir **qué operación es** (transferencia o transmisión), **hacia dónde** (EE.UU.), **en qué calidad** (Responsable o Encargado) y **qué se hace** (demostración de medidas, validación, declaración en el RNBD). La redacción de la v1.1 fue redactada antes de esta evaluación y por eso quedó en forma de "condición abierta". |
| **Anexo de Encargo (§5 y §6)** | Declarar la base jurídica de la transferencia al proveedor de correo, y el deber de demostrar medidas. Si se elige la salida A, es el **contrato de transmisión** el que la respalda, no una autorización. |
| **Anexo de Nube** | Hoy declara a Cloudflare con su DPA. Si el proveedor de correo cambia, **se añade o se cambia la fila**; si no cambia, se declara el encuadre de transferencia en la fila del correo. |
| **Constancia de aprobación** | Registra la garantía técnica; el ítem de la condición contractual debe reflejar el estado real (cerrada con la salida A, o cerrada con la salida B), no "abierta". |

---

## 9. La pregunta de fondo: ¿se ofrece el servicio mientras la condición está abierta?

Con esta evaluación, **la zona gris se cierra**: la operación del canal de correo no es un
"pendiente contractual" indeterminado, es una transferencia internacional a un país con nivel
adecuado, con tres condiciones que cumplir. Lo que falta no es una definición jurídica: es
documentación y, en su caso, un contrato.

Eso abre tres caminos y el owner elige:

1. **Salida A** (cambiar de proveedor): resuelve de raíz, con coste de licencia y migración.
2. **Salida B** (documentar): resuelve con trabajo documental, sin coste de licencia, y la
   condición queda **cerrada y explicada** en los tres documentos.
3. **No resolver ahora**: seguir con la condición declarada como abierta. Es lo que el texto
   actual hace, y es lo que el abogado dice que no es admisible sin evaluación documentada.

> **Decisión del owner (27-oct-2026): salida B.** No se cambia de proveedor de correo. La condición
> se cierra documentando el encuadre de transferencia internacional a Estados Unidos (país con nivel
> adecuado de protección de la SIC), y cumpliendo las tres condiciones del punto 6. Con esa decisión,
> el texto del Acuerdo v1.2 **debe dejar de decir "condición contractual pendiente"** y decir qué
> operación es, con qué base, y qué se hace para demostrar las medidas.

Lo que **no** es admisible en ningún caso es seguir declarando una condición abierta sin haber
hecho ninguna de las dos cosas. Y hay una tercera cosa que tampoco es admisible: **ofrecer el
servicio a nuevas Empresas sin resolver**, porque eso multiplica los titulares afectados por una
condición que ya se sabe cuál es.

**Nota operativa:** la salida B no exige cambiar de proveedor ni bloquear nada; exige un
documento. La salida A exige una decisión de compra. La diferencia entre una y otra es el
tiempo, no la injusticia.

---

## 10. Lo que falta, y quién lo decide

| # | Pendiente | Quién |
|---|---|---|
| 1 | ~~**Decisión del owner**: ¿salida A (cambiar de proveedor) o salida B (documentar la transferencia)?~~ **Decidido el 27-oct-2026: salida B** | — |
| 2 | **Verificar el estado del RNBD** de Gesstiar: ¿está inscrita? ¿la transferencia internacional está declarada? ¿con qué causal? | Assistant (consulta) + Owner (trámite) |
| 3 | **Confirmar el rol de Google** desde los términos aplicables a la modalidad concreta, por escrito, y dejar esa Determinación en el expediente | Assistant redacta, abogado valida |
| 4 | **Pregunta puntual al abogado**: (a) ¿el rol debe determinarse desde los términos de Google o desde la operación concreta? (b) ¿la Circular 2 de 2025 exige comunicación previa a la Delegatura en este caso, o basta con la declaración en el RNBD? (c) si se mantiene el Gmail de consumo, ¿qué redacta el Anexo de Encargo para que la base de la transferencia quede declarada? | Abogado |
| 5 | **Redactar el paquete de cambios** de los tres documentos y la v1.2 del Acuerdo | Assistant, con el texto del abogado |

---

## 11. Fuentes

- Ley 1581 de 2012, arts. 26 y 27.
- Decreto 1074 de 2015, arts. 2.2.2.25.5.1 y 2.2.2.25.5.2 (compilan los arts. 24 y 25 del
  Decreto 1377 de 2013).
- Circular Única de la SIC, Título V, numeral 3.1 (estándares) y 3.2 (países con nivel adecuado de
  protección, con EE.UU. incluido) y sus parágrafos primero, tercero y cuarto. Actualizada por la
  Circular 001 del 9 de enero de 2026 (Diario Oficial 53.362).
- Circular 2 de 2025 de la SIC (transferencias de tecnología).
- Concepto SIC 25-632634 del 25 de febrero de 2026 (alcance de la Circular Externa 002 de 2025):
  https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/alcance-de-la-circular-002-de-2025-sobre-transferencias-internacionales-de-datos
- SIC, Normas Corporativas Vinculantes:
  https://sedeelectronica.sic.gov.co/delegatura/proteccion-de-datos-personales/normas-corporativas-vinculantes
- Google, Data Processing Amendment de Google Workspace (cláusula 5.1: "Customer is the controller and
  Google is a processor"): https://workspace.google.com/terms/07072022/dpa_terms/
- Google, ausencia de contrato de encargo en las cuentas de consumo (Privacy Help Center):
  https://support.google.com/policies/answer/9581826
- Cloudflare, Data Processing Addendum v6.4 (3-abr-2026), ya declarada en el Anexo de Nube.
