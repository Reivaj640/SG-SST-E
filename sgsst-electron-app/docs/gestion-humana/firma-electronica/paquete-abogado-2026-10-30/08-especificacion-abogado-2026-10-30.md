# Especificacion de cierre de la linea legal (30 de octubre de 2026)

Documento de trabajo que registra, en texto fiel, la especificacion que el abogado
entrego el 30 de octubre de 2026 (12:59). Es la **fuente** de los cambios de la v1.3 del
Acuerdo, del Anexo de Encargo y del Anexo de Nube.

No es texto legal. El texto legal vive en el Acuerdo v1.3, en el Anexo de Encargo y en el
Anexo de Nube; este documento explica de donde sale cada cambio.

La especificacion **reemplaza** el plan v1.2 del 27 de octubre de 2026 en todo lo que
contradicen. En particular, cambia D1 de fondo: se elimina la retencion indefinida por
ausencia de plazo y aparece una **tabla supletoria de conservacion administrada por
K+AIR**.

---

## 1. Lo que ya estaba hecho y que esta especificacion NO toca

Las ocho piezas del plan v1.2 quedaron ejecutadas y verificadas antes de este documento:
texto v1.2, codigo D1/D2/D3, Anexo de Encargo (secciones 2 y 8), manifiesto de
readiness, tabla de correspondencia texto-codigo y paquete para el abogado.

---

## 2. T1 - El numeral 5.1, separado en deberes legales y deberes operativos

**Instruccion**: reemplazar la lista actual por una separacion entre los tres deberes
legales y los deberes operativos adicionales de K+AIR.

**Redaccion literal**:

- a) control y custodia;
- b) diligencia;
- c) aviso oportuno a cualquier persona que posea, haya recibido o vaya a recibir;
- y, en "Adicionalmente": d) usar personalmente enlace y OTP sin compartir;
  e) informar oportunamente a la Empresa o a K+AIR.

**Criterios**:

- los tres deberes legales completos;
- los adicionales distinguidos;
- el aviso legal NO restringido a Empresa/K+AIR;
- se conservan numeracion y referencias cruzadas.

**De donde sale la redaccion**: los tres deberes legales son los del articulo 2.2.2.47.6
del Decreto 1074 de 2015, auditados numeral por numeral contra la compilacion oficial el
19 de octubre de 2026 y recogidos en
`auditoria-capitulo-v-acuerdo-uso-2026-10-19.md` (hallazgo T1, Propuesta 1). El literal c)
de esa Propuesta reproduce el deber de aviso completo, con los criterios de "en entredicho"
y la definicion que da el paragrafo del articulo, que la v1.2 habia reducido a "avisar a la
Empresa y a K+AIR".

---

## 3. T2 - Las politicas de seguridad solo obligan si se pudieron conocer

**Instruccion**: el firmante solo queda obligado por politicas que haya podido conocer
antes de utilizarlas.

**Redaccion literal**:

> Cumplir las politicas de seguridad que regulen directamente el uso del mecanismo de firma
> electronica, siempre que hayan sido informadas de manera expresa al Firmante y puestas a
> su disposicion como anexo de este Acuerdo o mediante un medio de consulta accesible
> antes de su aplicacion. Estas politicas no podran modificar unilateralmente las
> condiciones esenciales del mecanismo ni imponer obligaciones que no hayan sido
> comunicadas al Firmante.

**Criterios**:

- no obliga a documentos internos nunca conocidos;
- se identifica la version;
- se registra la fecha de disponibilidad;
- se conserva evidencia de la version aceptada.

**De donde sale la redaccion**: el hallazgo T2 de la auditoria del 19 de octubre de 2026
documenta que el literal a) de la v1.2 obliga a cumplir unas politicas de seguridad que
el firmante nunca ve: un deber cuyo contenido no puede conocer no es exigible.

---

## 4. D1 - Fin de la retencion indefinida: tabla supletoria de conservacion

**Instruccion**: eliminar la retencion indefinida; tabla supletoria de conservacion
administrada por K+AIR, con plazos configurables por categoria y plazos especiales
justificados. El abogado fue explicito: "No recomiendo implementar veinte anos para
todo".

**Siete instrucciones**:

1. No implementar retencion indefinida por ausencia de plazo declarado.
2. No aplicar veinte anos a todos los documentos.
3. No eliminar las excepciones legales (el piso de veinte anos del SG-SST, el deber de
   conservacion del contrato individual de trabajo).
4. No permitir finalidades adicionales sin instruccion documentada.
5. No afirmar que Google es subencargado contractual sin soporte.
6. No afirmar controles del servidor que no esten verificados.
7. No publicar ni activar sin autorizacion expresa.

**Parametros iniciales**:

| Categoria | Plazo | Nota |
|---|---|---|
| Documento original y firmado | diez (10) anos | |
| Constancia y manifestacion | igual al del documento asociado | |
| Registro de operaciones y autenticacion | cinco (5) anos | |
| Solicitudes y comunicaciones operativas | cinco (5) anos | |
| Lapida y recibo | cinco (5) anos | |
| Respaldos cifrados | treinta (30) dias | |
| Categorias SG-SST especiales | veinte (20) anos desde el cese | piso legal, no se puede bajar |

**Los parametros de diez (10) y cinco (5) anos quedan sujetos a validacion juridica antes
de activarse en produccion.** El mecanismo se construye ya; la activacion es una decision
distinta.

---

## 5. E1 - Matriz de finalidades del 10.3, en Grupo A y Grupo B

Clasificar las ocho finalidades del numeral 10.3 del Acuerdo:

| Id | Finalidad |
|---|---|
| 10.3(a) | Crear y gestionar la solicitud de firma. |
| 10.3(b) | Enviar al Titular el enlace de acceso y el codigo OTP. |
| 10.3(c) | Verificar la identidad del Firmante. |
| 10.3(d) | Registrar y conservar su manifestacion de aceptacion de este Acuerdo. |
| 10.3(e) | Generar y entregar la constancia de firma. |
| 10.3(f) | Conservar la evidencia del proceso de firma por el tiempo indicado en el numeral 8.6. |
| 10.3(g) | Atender peticiones, quejas, reclamos y solicitudes relacionadas con el proceso de firma. |
| 10.3(h) | Cumplir obligaciones legales, administrativas o judiciales que resulten aplicables. |

**Nueve campos por finalidad**: Identificador, Descripcion, Categorias de datos, Titulares
involucrados, Base juridica declarada, Responsable que instruye, Plazo de conservacion,
Consecuencia de revocatoria o supresion, Estado de habilitacion.

**Reglas**:

- Grupo A (necesarias para el servicio) opera bajo instrucciones y contrato con fundamento
  documentado.
- Grupo B (particulares de la Empresa) no se activa hasta que la Empresa entregue la
  informacion.
- La declaracion de la Empresa no reemplaza la autorizacion cuando sea necesaria.
- K+AIR no usa datos para finalidades propias no documentadas ni legitimadas.

**Criterios**: las ocho finalidades identificadas; ninguna finalidad activa con campos
esenciales vacios; la Empresa puede consultar cuales estan habilitadas; evidencia de la
instruccion y su version; las no habilitadas no se ejecutan.

---

## 6. E2 - Una sola fuente de configuracion

- Una unica fuente de configuracion.
- Generar o sincronizar la tabla documental desde esa fuente.
- Asociar categoria a regla y a fundamento.
- Registrar cuando se modifica una regla.
- Trazabilidad de que version aplico a cada documento.

**Criterio**: si cambia un plazo, el sistema demuestra que regla aplico a cada documento y
no recalcula historicos sin operacion explicita, autorizada y auditada.

---

## 7. N1 a N6 - Anexo de Nube

**N1. Papel de Google.** Documentar el Gmail de consumo real **sin** afirmar DPA
empresarial ni contrato de subencargo. Documentar los datos transmitidos: correo del
destinatario, informacion tecnica de envio, OTP y enlace individual. No enviar documentos
laborales completos por OTP. No incluir documentos de identidad ni datos sensibles en el
correo. No afirmar que K+AIR controla la eliminacion de copias internas del proveedor. No
representar a Google como subencargado contractual.

**N2. Ficha tecnica del canal.** SMTP, TLS, contrasena de aplicacion, MFA, plantilla del
correo OTP, contenido minimo, registro de errores y envios, gestion de incidentes,
procedimiento de revocacion de credenciales. El owner entrega las evidencias; **las
credenciales nunca al documento ni al repositorio**.

**N3. Circular 002 de 2025.** No implementar comunicacion previa a la SIC por usar Gmail.
Documentar la operacion y dejar la conclusion juridica a revision profesional.

**N4. RNBD.** No declarar inscrita ni exenta sin comprobar. El owner verifica naturaleza
juridica, activos totales, obligacion de inscripcion y estado del registro.

**N5. Contrato de transmision y NCV.** No crear contrato de transmision ficticio ni
declarar NCV. Si luego se contrata un servicio empresarial con DPA, se actualiza el Anexo.

**N6. Respuestas a las tres preguntas**:

1. "Por la operacion concreta, contrastada con los terminos aplicables."
2. "No por el simple uso de Gmail; debe verificarse si existe una operacion especifica
   comprendida en su ambito."
3. "Identificacion de la operacion, datos, finalidad, destinatario, pais, fundamento
   aplicable y obligaciones de informacion y autorizacion."

Estas respuestas quedan incorporadas a la nota para el abogado.

---

## 8. Orden de ejecucion y criterios generales

**Orden**: Fase 1 textos (v1.3) -> Fase 2 Anexo de Encargo -> Fase 3 Anexo de Nube ->
Fase 4 implementacion -> Fase 5 pruebas -> Fase 6 validacion.

**Criterios generales**:

- No dar por terminado solo porque los documentos se generaron.
- Entregables con condicion de cierre: Acuerdo v1.3 con texto corregido, version y hash;
  Anexo de Encargo con matriz completa y tabla sincronizada; Anexo de Nube con el papel de
  Google documentado y los controles acreditados; codigo con las reglas implementadas; BD
  con migraciones y trazabilidad; pruebas ejecutadas; correspondencia sin promesas
  contractuales pendientes; servidor con version y migraciones comprobadas en produccion;
  aprobacion juridica y autorizacion operativa separadas.

**Recomendacion final del abogado**: el desarrollador puede comenzar con T1, T2, la
estructura de conservacion configurable y la matriz de finalidades.

---

## 9. Interpretaciones que se declaran para que el abogado las corrija

1. **T2 entra como literal f)** del nuevo 5.1, dentro del bloque "Adicionalmente", porque
   el 5.1 de T1 solo tiene literales a) a e). Si el abogado preferia que las politicas
   fueran un numeral propio, se mueve sin cambiar el fondo.
2. **El mecanismo de T2 se apoya en el versionamiento que ya existe**: la pantalla de firma
   muestra la version del Acuerdo junto con el texto, y la aceptacion registra el texto
   aceptado, su huella SHA-256 y la fecha y hora. Por eso la v1.3 anade un 5.6 que dice
   eso mismo en el Acuerdo, en vez de prometer un versioning que el codigo no tiene.
3. **Los parametros numericos (10 y 5 anos) viven en una sola fuente** (la tabla
   supletoria de K+AIR) y de ella salen la tabla publicada del Anexo de Encargo, el plazo
   por defecto del codigo y la regla que se congela en cada firma. El Acuerdo enuncia la
   regla y el orden de precedencia; no duplica los numeros.
4. **D1 no elimina el 8.6(b)**: el piso de veinte (20) anos del SG-SST se conserva como
   plazo legal no rebajable, y el 8.6(c) mantiene el hold del contrato individual mientras
   subsista la relacion laboral.
