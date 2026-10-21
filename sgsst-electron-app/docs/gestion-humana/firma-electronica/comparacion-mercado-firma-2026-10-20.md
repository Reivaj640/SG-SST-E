# Comparación de mercado: cómo lo hacen Buk y los demás (2026-10-20)

> **Qué es esto**: un insumo para el owner y para el abogado. **No es un concepto
> jurídico firmado** y no modifica el Acuerdo. Las fuentes son las páginas públicas
> de cada proveedor (las citas llevan la fecha de publicación o de actualización que
> el propio proveedor muestra). Lo que no se pudo verificar en fuente pública está
> marcado `⚠️ No verificado`.

## Por qué se hizo esta comparación

El owner preguntó si el botón «Prefiero firmarlo en papel» es una rareza de K+AIR o
lo estándar del mercado. La respuesta corta: **es una rareza en el mercado local, y
es exactamente lo que la norma pide en la práctica aunque no lo exija literalmente**
(ver `consulta-legal-firma-en-papel-interfaz-2026-10-20.md`).

---

## 1. Buk (Colombia) — el competidor local de referencia

Fuentes: Centro de ayuda de Buk Colombia (sección «Firma digital»),
`supportcenter.buk.co/hc/es-419`, artículos del 13-jul-2026, 21-sep-2026 y 24-jul-2026.

### 1.1 A dónde llega el código de seguridad (el OTP)

> «El código se envía directamente al correo electrónico registrado del firmante,
> asegurando que solo la persona con acceso a ese correo pueda recibirlo.»
> — «¿Cómo funciona el código de seguridad en la firma de documentos en Buk?»

Y en el flujo de firma:

> «En la siguiente etapa, el sistema te solicitará que elijas un método para recibir
> el código de seguridad, que es el factor de doble autenticación. Podrás optar por
> recibirlo a través de **correo electrónico** o **Mensaje de texto (SMS)**.»

Detalle que importa: los datos son **los del perfil en la plataforma de la Empresa**,
pero el trabajador puede **elegir el canal** (correo o SMS) en el momento de firmar,
y en algunas configuraciones hasta **editar su número de teléfono desde el modal**
(«Editar mi teléfono»); si la configuración no lo permite, el mensaje dice
«Contacta a tu administrador».

**Lo que Buk NO tiene**: una vía para que el trabajador declare un medio que la
Empresa no conozca. El conjunto de medios es el que la Empresa cargó.

### 1.2 Qué pasa si el trabajador no quiere firmar electrónicamente

El modal de firma tiene tres opciones: **Cancelar / Rechazar / Firmar**.

> «El firmante puede rechazar el documento desde el mismo flujo de firma sin
> necesidad de recurrir a canales externos.»

El rechazo es **terminal e irreversible**: estampa la marca de agua «RECHAZADO» en el
PDF, registra IP + fecha + hora, cancela las otras solicitudes de firma, oculta el
documento y lo mueve a una carpeta «Rechazados».

**Buk NO tiene una vía de firma en papel dentro de la plataforma.** Y su propio
articolo reconoce que antes de esa función:

> «debía gestionar la coordinación de manera externa con el administrador para
> solicitar su eliminación o regeneración. Esto ocasionaba la pérdida de
> trazabilidad en el ciclo de vida del archivo o provocaba que el documento
> permaneciera de manera indefinida en estado pendiente de firma.»

Es decir: **el problema que la 9A de K+AIR resuelve (el documento que se queda
pendiente para siempre) es un problema que Buk no resolvió**.

---

## 2. El mercado global (DocuSign, Adobe Acrobat Sign) y el local de herramientas

### 2.1 A dónde llega el código

- **DocuSign**: el «código de acceso» lo **transmite el remitente** — «Puede transmitir
  el código de la manera que desee, ya sea por teléfono o en un mensaje de correo
  electrónico independiente. No obstante, no debe incluir el código en el mensaje del
  documento». La autenticación del destinatario (correo o teléfono) usa el dato que
  el **remitente** escribió.
- **Adobe Acrobat Sign** (OTPvE): el código va al correo del destinatario — que es el
  que el remitente escribió al crear el envío.

En la práctica, las empresas Colombianas que firman contrato con estas plataformas
escriben **el correo personal del trabajador** (es la única forma de que el código
llegue a quien tiene que firmar). Es decir: el mercado resuelve el problema del D-2
**cambiando el dato de entrada** (la Empresa pone el correo personal), no separando
los canales.

### 2.2 Qué pasa si el destinatario no quiere firmar electrónicamente

- **Adobe Acrobat Sign**: «Decline to sign the agreement as a recipient» — la
  capacidad de **rechazar** es configurable por la organización del remitente.
- **DocuSign**: existe la opción de **cargar un documento ya firmado** (el firmante
  sube la copia firmada a mano) y la de rechazar.

En ninguno de los dos el proveedor gestiona una "vía en papel": el papel es un
asunto entre el firmante y quien le envió el documento.

### 2.3 Plataformas colombianas de firma (FirmaRaíz, SignaSuite, LinkySign, JurídicaTime)

Todas describen el mismo patrón: **OTP al correo o al WhatsApp del firmante**, con
la misma descripción de las tres garantías (autenticidad, integridad, voluntad).
`⚠️ No verificado`: no se revisó una por una su flujo interno ni su acuerdo de
consentimiento; el patrón se desprende de sus páginas públicas.

---

## 3. La tabla: K+AIR contra el mercado

| | **Buk** (local) | **DocuSign / Adobe** (global) | **K+AIR** |
|---|---|---|---|
| **El OTP (dato de creación) llega a…** | el contacto registrado por la Empresa (correo o SMS, lo elige el trabajador **entre los de la Empresa**) | el correo que escribió el remitente (en la práctica, el personal del trabajador) | el medio **personal que declara el trabajador**; si no declara, el contacto de la Empresa (con aviso en el log e inventario) |
| **El trabajador puede declarar un medio que la Empresa no conoce** | no (salvo el teléfono, en algunas configuraciones) | no (quien lo escribe es el remitente) | **sí**, y el medio solo queda activo cuando el código prueba que lo controla |
| **Si no quiere firmar electrónicamente** | **rechazar** (terminal, irreversible) + coordinación fuera de la plataforma | rechazar / subir la copia firmada | **la vía en papel la ofrece el correo de la Empresa y la registra K+AIR**: hay asiento, Registro de firma autográfica y copia. **No hay botón en la mini-app** (decisión del owner, 2026-10-20: el producto no puede prometer en nombre de la Empresa) |
| **Registro de medios autorizados** (el 8.2) | el perfil de la plataforma | el enrutamiento del remitente | **sí**: el trabajador agrega y retira; la Empresa ve cuáles están activos |
| **Constancia del Documento firmado en papel** | no aplica | no aplica | **Registro de firma autográfica** (hechos del acto, con las dos huellas) |
| **Evidencia de que la opción en papel estuvo disponible** | no | no | **sí**: evento `PAPER_OPTION_AVAILABLE` con la huella del **cuerpo del correo** que lo ofreció (la oferta viaja en el correo de la Empresa) |

---

## 4. Lo que esto significa

1. **K+AIR va por delante del mercado local en los dos puntos que la ley exige en la
   práctica**: a dónde llega el dato de creación, y que exista una salida real para
   quien no quiere firmar electrónicamente.
2. **El botón no era una exigencia literal** (ninguna norma lo pide) y, además,
   **era una exposición**: la pantalla prometía en nombre de la Empresa lo que la
   Empresa haría. Por eso se quitó (decisión del owner, 2026-10-20): la vía
   se ofrece en el **correo de la Empresa** —que es quien tiene el deber del 7.2— y
   K+AIR se limita a registrarla. La consecuencia honesta es que la
   **descubribilidad del derecho queda en manos de la Empresa** (como en Buk), y que
   por eso **activar el rechazo del D-2 exige que la Empresa tenga declarado su
   canal de atención**.
3. **El riesgo de ir por delante es operativo, no legal**: si el rechazo del D-2 se
   enciende sin que la 9A esté comunicada y el inventario 돌 diga cuántas solicitudes
   tienen el código en un buzón corporativo, se rompen flujos de clientes que hoy
   funcionan. Por eso la secuencia sigue siendo: **código → 9A → 11A (el texto) →
   encender el rechazo**.
4. **Para el 11A**: el texto del Acuerdo no tiene que "mencionar el botón" (ninguna
   norma lo pide), pero sí debe decir **qué es el método**: que el OTP va a un medio
   personal que la Empresa no administra, y que el token de acceso no habilita por
   sí solo la manifestación de voluntad. Eso ya está en el 3.7(a) que se va a
   reescribir (redacción del owner, 2026-10-20) y en los numerales 7.2/7.3.
   
   Y una precisión que importa para el 11A: la alternativa de **mover los dos canales**
   (el token y el OTP al medio personal) **no es imposible, es peor** — en tres
   dimensiones: obliga a la Empresa a conocer un dato nuevo (el correo personal del
   trabajador), el trabajador tiene que estar pendiente de su correo personal para
   una invitación laboral, y la Empresa sabe dónde llegó el código. No es
   "inviable": es peor. Y esa comparación es la que va al abogado, no un
   "imposible".

## Fuentes consultadas (2026-10-20)

- Buk Colombia — Centro de ayuda, sección «Firma digital» (supportcenter.buk.co/hc/es-419):
  «¿Cómo funciona el código de seguridad…?» (21-sep-2026), «Flujo de firma
  electrónica» (13-jul-2026), «Rechazo de firma de documentos en Buk» (24-jul-2026).
- DocuSign Support — «Códigos de acceso para destinatarios» (26-may-2026).
- Adobe Acrobat Sign Help — «One-Time Password via Email (OTPvE)» y «Decline to sign
  the agreement as a recipient».
- FirmaRaíz — «Cómo firmar un contrato laboral electrónicamente en Colombia (Ley 527)»
  (22-jul-2026).
- `⚠️ No verificado`: el texto íntegro de los acuerdos de consentimiento de cada
  proveedor (no son públicos) y los flujos internos de Buk.
