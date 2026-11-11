# Decision A — Regularizacion del canal de correo con instrument contractual (9-nov-2026)

> Documento de decision. Es el contrato que gobierna la redaccion de la v1.2 del
> Anexo de Nube y de la nueva version del Anexo de Encargo, y el criterio con el
> que el gate (`readinessLegal.js`) califica el vinculo con el proveedor de
> correo.
>
> **Estado:** vigente desde el 9 de noviembre de 2026.
> **Sustituye:** `evaluacion-canal-correo-2026-10-27.md` (que evaluaba la opcion
> de mantener la cuenta de consumo) y el punto J6 del abogado del 30-oct-2026
> en cuanto al papel de Google, que queda superado por el criterio del
> apartado 3.
> **Superada por esta decision:** `especificacion-abogado-2026-10-30.md`, en la
> parte en que ordena documentar la operacion con una cuenta de consumo.
>
> **Estado al 10-nov-2026:** la decisión **se cumple en lo técnico** (P2, P4 y P5
> cerrados y medidos; ver el §7.1) **y en lo contractual**: **P1 cerrado el
> 10-nov-2026** — la aceptación del CDPA quedó registrada en el manifiesto desde
> un acta con su captura (ver §0.1). El canal
> del **servicio de firma** ya es el de Workspace y manda correo real; el canal de
> la **app de escritorio** (los buzones Gmail de consumo de los clientes) es otro
> y **no lo cubre esta decisión**: se resuelve en P11, que es un asunto de
> revocación de credenciales, no de marco contractual.

---

## 0.1. Estado medido al 10-nov-2026

| # | Estado | Evidencia |
|---|---|---|
| P2 | ✅ **Cerrado** | `kair@gesstiar.com` activa, con verificación en dos pasos y autenticación por app password (`kair-firma-smtp`, creada el 10-nov-2026) |
| P3 | ⬜ **Abierto** | No medido en esta sesión. Los tres alias siguen sin verificar ⚠️ No verificado |
| P4 | ✅ **Cerrado** | SPF `v=spf1 include:_spf.google.com ~all`, DKIM `google._domainkey` y DMARC `v=DMARC1; p=none; rua=mailto:kair@gesstiar.com` (TTL 14400, un solo registro) publicados y visibles en el autoritativo y en 8.8.8.8 / 1.1.1.1 / 9.9.9.9 |
| P5 | ✅ **Cerrado** | Envío real desde `kair@gesstiar.com`: Message-ID `<5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com>` y `Authentication-Results: dkim=pass; spf=pass; dmarc=pass`. El servicio corre con la credencial nueva (`.env` en `/opt/kair-firma`, `600 root:root`, 7 variables SMTP) |
| P1 | ✅ **Cerrado 10-nov-2026** | La aceptación del CDPA **queda registrada**: `legal-readiness.json → subencargados.mail_provider.aceptacion` = `aceptada: true`, modo `aceptado_por_administrador`, `fecha: 2026-11-10`, `fecha_efectividad_addendum: null`, y **`mail_provider_dpa` = `ok`** (gate: 6 → **5** pendientes). **El acto (evidencia):** la consola de Workspace declara «Aceptado por kair@gesstiar.com el Nov 10, 2026» en *Condiciones adicionales de seguridad y privacidad* (Cuenta → Configuración de la cuenta → Cumplimiento legal → Seguridad y privacidad → Términos adicionales → *Cloud Data Processing Addendum*), con el botón CANCELAR disponible — que solo aparece cuando ya está aceptado. **Captura:** `scripts/fixtures/captura-consola-cdpa-i-accept-2026-11-10.png`, 96 520 bytes, SHA-256 `9d989067baf9f7908d144dcdb86c04f9b62efa6e34e4714f7dd3132e5d825560`, `verificado_localmente: true`. **Registro:** acta `scripts/fixtures/aceptacion-cdpa-p1-2026-11-10.json` → `node scripts/actualizar-manifiesto-aceptacion-cdpa.js --aplicar --hoy=2026-11-10` (el `--check` posterior sale en 0 y el regenerador 1047 conserva el bloque). **Modo elegido: `aceptado_por_administrador`** (10-nov-2026): los términos vigentes del Acuerdo (`Last modified: October 12, 2026`) entran en el próximo renewal y el TOS archivado de 2021 no incorporaba el CDPA, entonces `incorporado_por_referencia` no es afirmable sin la fecha de renovación ⚠️ No verificado: si la cuenta ya renovó y cuál es la *Addendum Effective Date* (la consola no la muestra; el campo quedó en `null`). **Fuera de P1** (no se tocaron, y ninguno aplica a la operación colombiana): la certificación GDPR (*CERTIFICAR SI CORRESPONDE*) y la enmienda HIPAA (*REVISAR Y ACEPTAR*) |

> **Lo que la aceptación del CDPA cambia y lo que no.** Aceptarlo cierra el marco
> **contractual** del canal del servicio de firma. **No** cubre las cinco cuentas
> **Gmail de consumo** de los clientes (otro canal, otro instrumento, y en este
> caso el problema no es el marco sino la **exposición de credenciales**: P11). Y
> **no** habilita por sí sola la primera firma: siguen abiertos `firmado_nube`,
> `contrafirma_nube` y `estado_encargo`, que son actos de las partes.

---

## 1. Que se decide

Se decide **migrar la ruta transaccional del correo del servicio de firma
electronica K+AIR** desde una cuenta gratuita de Gmail de consumo
(`adminkair@gmail.com`) a una **cuenta empresarial de Google Workspace**
(`kair@gesstiar.com`), rigorously vinculada por el instrumento de tratamiento de
datos que Google incorpora a su Acuerdo con el cliente, y se decide que
**todos los documentos del expediente, el manifiesto y el codigo del servicio
digan lo mismo**.

El objetivo no es cambiar la direccion de un remitente. Es que la cuenta, el
instrumento contractual, los documentos, el manifiesto, el codigo y la evidencia
dejen de contradecirse. La v1.1 del Anexo de Nube declara a Google como
**Responsable del Tratamiento** en esta operacion; ese texto se queda sin
vigencia al cambiar el canal, y por eso esta decision va acompanada de una
v1.2 del Anexo de Nube y de una nueva version del Anexo de Encargo.

**Lo que esta decision NO habilita.** Cerrar el punto 2 no abre el servicio a
los trabajadores. Siguen pendientes, entre otros, la version de Node en
EOL, el respaldo fuera del servidor, la Seccion E del expediente, la
Constancia, la T8, la T6 (E2E sintetico) y la T7 (reversion probada). La
compuerta `FIRMA_EXIGIR_ANEXO_NUBE` sigue apagada y no se enciende sin
autorizacion expresa del owner.

---

## 2. La evidencia de la Fase 0

### 2.1 El instrumento: el Cloud Data Processing Addendum (CDPA)

> **Hallazgo que corrige al plan.** El plan (9-nov-2026) llama al instrumento
> como "Google Workspace DPA" con la URL
> `https://workspace.google.com/terms/dpa_terms/`. **Esa URL devuelve 404** a
> la fecha de esta decision. El URL que el repo tenia anotado desde el
> 27-oct-2026 (`https://workspace.google.com/terms/07072022/dpa_terms/`) es una
> **version archivada** de otro instrumento. El instrumento vigente ya no se
> llama "DPA": se llama **Cloud Data Processing Addendum (CDPA)** y es el mismo
> que antes se llamaba Data Processing Amendment (para Workspace) o Data
> Processing and Security Terms (para Cloud).

| Dato | Valor verificado |
|---|---|
| Instrumento | Cloud Data Processing Addendum (Customers) |
| URL canonica de Workspace | `https://admin.google.com/terms/apps/8/1/en/dpa_terms.html` |
| Espejo (Cloud) | `https://cloud.google.com/terms/data-processing-addendum` |
| Ultima modificacion del texto | **30 de octubre de 2026** |
| Versiones anteriores (declaradas por Google) | 8-jun-2026, 23-oct-2025, 13-oct-2025, 21-ago-2025, 15-oct-2024, 26-sep-2024, 9-sep-2024, 5-ago-2024, 23-may-2024, 9-abr-2024, 8-nov-2023, 15-ago-2023, 20-sep-2022 |
| SHA-256 del archivo canonico (97 831 bytes) | `0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1` |
| SHA-256 del espejo en Cloud (913 836 bytes) | `3ac83515e35af4ebaf7af12d65a4229cf6799c25db56bc8200d129aa20d4ea6a` |
| SHA-256 de la lista de subencargados | `6ae1754eca496ea58d56fbefa6cfbc21fdb5a55d21b4870a25f3029d62115374` |
| Lista de subencargados | `https://workspace.google.com/intl/en/terms/subprocessors/` |
| Fecha de descarga | 9 de noviembre de 2026 |

Los tres archivos descargados quedan en el expediente local del owner; **al
repo no se commitea ningun documento que venga de una sesion autenticada**.

### 2.2 Lo que el CDPA dice, literalmente

Verificado contra el texto descargado el 9-nov-2026 (seccion por seccion):

- **§1 Commencement.** El Addendum "will be effective and replace any terms
  previously applicable to the processing of Customer Data... from the Addendum
  Effective Date".
- **§2 Definiciones.** "Addendum Effective Date means the date on which Customer
  accepted, or the parties otherwise agreed to, this Addendum".
- **§4.3 Application of Addendum.** "Except to the extent this Addendum states
  otherwise, this Addendum will apply **irrespective of whether European Data
  Protection Law or Non-European Data Protection Law applies**".
- **§5.1.1 Processor and Controller Responsibilities.** "Google is a processor
  of that Customer Personal Data under European Data Protection Law"; "Customer
  is a controller or processor, as applicable". **Este parrafo esta sujeto a la
  condicion "If European Data Protection Law applies".**
- **§5.1.3 Responsabilidades bajo la ley no europea.** "If Non-European Data
  Protection Law applies to either party's processing of Customer Personal Data,
  the relevant party will comply with any obligations applicable to it under
  that law".
- **§6.2 Return or Deletion When Term Ends.** "Customer instructs Google to
  delete all remaining Customer Data (including existing copies) from Google's
  systems at the end of the Term", con un periodo de recuperacion de hasta 30
  dias.
- **§7.1 / Anexo 2.** Medidas de seguridad de Google como obligation
  contractual.
- **§7.4 Compliance Certifications and SOC Reports** y **§7.5 Reviews and
  Audits of Compliance** (7.5.1 documentacion de seguridad; 7.5.2 derechos de
  auditoria del Cliente, con un auditor independiente nombrado por el Cliente).
- **§10.1 Data Storage and Processing Facilities.** "Customer Data may be
  processed in any country in which Google or its Subprocessors maintain
  facilities".
- **§10.2 Restricted European Transfers.** Solo aplica cuando la ley europea se
  aplica a la transferencia; las SCCs (Controller-to-Processor) son la solucion
  para el caso no europeo (ver **§10.3 Certification by Non-EMEA Customers**).
- **§11 Subprocessors** (11.1 consentimiento, 11.2 informacion, 11.3 requisitos,
  11.4 oposicion).

### 2.3 Lo que NO se pudo verificar, y quien lo tiene que verificar

| Hecho | Estado | Quien lo cierra | Como se cierra |
|---|---|---|---|
| Que `kair@gesstiar.com` este activa y sea el buzon del servicio | **Sin verificar** | Owner | Admin console de Workspace |
| Que la cuenta tenga verificacion en dos pasos | **Sin verificar** | Owner | Admin console |
| Que las app passwords esten habilitadas | **Sin verificar** | Owner | Admin console > Seguridad > Acceso a aplicaciones |
| Como se incorpora el CDPA a esta cuenta: **por referencia** al Acuerdo o por **opt-in** del administrador | **Sin verificar** | Owner | Admin console > Cuenta > Legal y cumplimiento > Terminos adicionales de seguridad y privacidad: "Cloud Data Processing Addendum" -> "Review and Accept" |
| La fecha de efectividad del Addendum para esta cuenta | **Sin verificar** | Owner | De la incorporacion por referencia o del opt-in |
| SPF, DKIM y DMARC de `gesstiar.com` | **Sin verificar** | Owner | DNS del dominio + cabeceras de un envio real |
| Alias `privacidad@`, `soporte@`, `incidentes@` | **Sin verificar** | Owner | Admin console > Gestion de correo > Alias |
| Que la cuenta antigua `adminkair@gmail.com` ya no remita nada | **Sin verificar** | Owner | Tras cambiar el `.env` del servidor |

**El agente no puede cerrar ninguno de estos puntos:** no tiene acceso al Admin
console ni a las credenciales del dominio. Quedan escritos, con nombre y
responsable, en el apartado 7.

### 2.4 El criterio juridico que gobierna los textos

Este es el criterio que se aplica **en el Anexo de Nube v1.2, en el Anexo de
Encargo version 2026-11-09 y en el codigo del gate**. Se redacta en forma
condicional y **no se afirma en forma absoluta ni que "Google es Responsable"
ni que "Google es Subencargado"**:

1. Respecto de **los datos del servicio de correo** (correo del destinatario,
   informacion tecnica del envio, codigo OTP y enlace individual de acceso), y
   **mientras el CDPA este vigente y aplicable a la cuenta**, Google interviene
   como **proveedor contractual encargado (Subencargado)**, en los terminos del
   CDPA: le aplican las obligaciones de seguridad (§7.1), devolucion y
   supresion (§6.2), auditoria (§7.5) y subencargados (§11), y el Encargado
   responde por el cumplimiento del subencargado en los mismos terminos en que
   responde por si mismo.
2. El CDPA **queda incorporado al Acuerdo** con la empresa y, conforme al
   **§4.3**, se aplica con independencia de si se aplica la ley europea o la no
   europea. La designation de Google como **encargado en el sentido del
   §5.1.1** esta formulada por Google **bajo la condicion de que se aplique la
   ley europea**; para una cuenta fuera de EMEA rige el **§5.1.3** (cada parte
   cumple las obligaciones que le correspondan bajo la ley que le aplique) y
   siguen siendo exigibles las obligaciones contractuales del CDPA citadas.
   **Por eso la redaccion es condicional y no absoluta.**
3. **La transferencia internacional no desaparece por tener DPA.** El **§10.1**
   del CDPA permite que los datos se procesen en cualquier pais donde Google o
   sus subencargados tengan instalaciones. El envio a un servidor de Google en
   Estados Unidos **sigue siendo una transferencia internacional** y sigue
   rigiendo por el numeral 3.2 del Titulo V de la Circular Unica (Estados
   Unidos con nivel adecuado) y por el articulo 26 de la Ley 1581 de 2012, con
   la base y lasObligaciones que alli se declaran.
4. **Se diferencian los datos del servicio de correo de los datos de cuenta y
   de telemetria.** Los datos de cuenta del administrador de Workspace y la
   telemetria del servicio **no forman parte de los datos del cliente** que
   K+AIR trata por cuenta de la Empresa: esos los trata Google por cuenta
   propia conforme a sus propios terminos, con su propia base de proteccion de
   datos, y **no** quedan cubiertos por las obligaciones que K+AIR puede
   invocar contra Google en nombre de la Empresa. Los dos ambitos **no se
   confunden** en ningun documento.
5. **Mientras el CDPA no este verificado y vigente para la cuenta**, el texto
   no lo afirma: lo declara como condicion. La redaccion no dice "Google es
   Subencargado" a secas: dice "Google interviene como Subencargado **mientras
   el CDPA este vigente y aplicable a la cuenta del Encargado**, conforme al
   §5.1 y al §4.3 del instrumento".

### 2.5 La respuesta a las tres preguntas del abogado sobre este canal

Las tres preguntas que el abogado plugin sobre el canal de correo (si el papel
del destinatario debe determinarse desde los terminos del proveedor o desde la
operacion concreta; si la Circular 002 de 2025 exige comunicacion previa a la
Delegatura o basta la declaracion en el RNBD; y que redaccion deja la base de
la transferencia declarada de forma que pueda considerarse suficiente) quedan
respondidas asi, y el Anexo de Nube v1.2 las incorpora con la misma redaccion:

1. **El papel se determina por la operacion concreta Y por el vinculo
   contractual.** Con cuenta de consumo, por los terminos del proveedor, Google
   actuaba por cuenta propia. Con Workspace y CDPA vigente, el vinculo cambia el
   resultado: Google queda contractualmente obligado a tratar los datos del
   cliente como procesado (§5.1, §4.3). La redaccion refleja **las dos** cosas.
2. **La Circular 002 de 2025 no aplica por el simple uso de Gmail.** Su ambito
   son los procesos de transferencia de tecnologia. Un envio de codigo OTP por
   correo no es una transferencia de tecnologia. Se mantiene la aclaracion de la
   v1.1, que no se altera por el cambio de cuenta.
3. **La redaccion suficiente** es la que declara: la operacion, los datos, la
   finalidad, el destinatario, el pais, el fundamento (nivel adecuado, con las
   obligaciones que el regimen de transferencias impone a la Empresa), la
   base del vinculo con el proveedor (el CDPA) y las obligaciones de informacion
   y autorizacion al Titular.

---

## 3. Alcance: la ruta transaccional (decision A-2)

**Se migra (dentro de este cierre):**

- El envio del codigo OTP de un solo uso.
- El envio del enlace de acceso a la solicitud de firma.
- Los avisos del procedimiento de firma.
- La invitacion a suscribir el Anexo de Nube.
- El remitente por defecto: `kair@gesstiar.com`, nombre `K+AIR Firma
  Electronica`.

**NO se migra en este cierre, y se documenta la excepcion:**

| Canal | Direccion actual | Motivo de la excepcion | Como se cierra |
|---|---|---|---|
| Derechos del Titular | `privacidad.kair@gmail.com` | El alias `privacidad@gesstiar.com` **no esta verificado**: no consta que exista en Workspace. Publicar una direccion de derechos que no recibe solicitudes dejaria sin canal real a los titulares | El owner crea el alias en el Admin console y lo verifica con un envio real; despues se migra el canal en los documentos publicos y en `src/config.js` |
| PQRS | `adminkair@gmail.com` | El buzon publico de soporte tiene dependencias externas (cuenta de Google Auth Platform y publicidad del sitio) que son un paquete aparte | Igual que el anterior |
| Incidentes | `adminkair@gmail.com` | Mismo buzon | Mismo |

**Por que la excepcion es admisible y esta escrita.** El criterio de aceptacion
del plan es "no quedan referencias a Gmail Consumer **en la ruta
transaccional** ni en los documentos legales, **o hay excepcion escrita**". La
ruta transaccional no tiene ninguna referencia a una cuenta de consumo. Los
tres canales de la tabla si la tienen, y su excepcion queda escrita **con
motivo, responsable y accion de cierre**, en este documento y en el manifiesto
(`legal-readiness.json` -> `canales.excepcion_documentada`). No se afirma en
ningun sitio que esos buzones esten en Google Workspace.

**Efecto colateral aceptado y declarado:** la cuenta
`adminkair@gmail.com` **deja de ser la identidad de envio**, pero **sigue
existiendo como buzon humano** de soporte y PQRS. Por eso la plan de
retirada de la cuenta de consumo se limita a lo que el plan dice: **revocar
las app passwords antiguas, verificar que no queda ninguna en el `.env` del
servidor e impedir que la cuenta se use para enviar**. No se propone cerrar
el buzon, porque dejaria sin canal a los tres canales de la tabla.

---

## 4. Autenticacion del canal (decision A-3)

**No se decide todavia, y no depende del agente.** La decision la toma el
Admin console de Workspace:

| Opcion | Cuando aplica | Que hay que hacer |
|---|---|---|
| **App password** | El Admin console tiene habilitadas las app passwords y la cuenta tiene verificacion en dos pasos | Solo el `.env` del servidor: `SMTP_USER`, `SMTP_PASS`. Sin cambio de codigo |
| **OAuth2** (recomendada si las app passwords estan deshabilitadas) | Google no emite app passwords para la cuenta | Cambio en `mailer.js` (`auth.type = 'OAuth2'`, `clientId`, `clientSecret`, `refreshToken`) y variables nuevas. **Lo ejecuta el owner** |
| **SMTP relay** | El administrador no quiere credenciales de usuario en el servidor | Allowlist de la IP del servidor y configuracion del relay |

**Regla que queda escrita:** mientras no se elija y no se pruebe una opcion, **el
canal sigue en la que esta en produccion**. La migracion de la credencial se
hace en una **ventana de mantenimiento**, con copia del `.env` anterior, y solo
se da por buena con un **envio real** que compruebe el `Message-ID` con dominio
`@gesstiar.com` y las cabeceras `Authentication-Results` (SPF, DKIM, DMARC).
Configurar no es probar.

---

## 5. El instrumento bilateral (decision A-4)

**Hallazgo que corrige al plan.** El plan asigna a la "§8" del Anexo de Encargo
la alineacion de auditoria e incidentes con el DPA. **La §8 del Anexo de
Encargo es "Conservacion de la evidencia del proceso de firma"** y no tiene
auditoria ni incidentes. Verificado contra el archivo: la notificacion de
incidentes esta en la **§4** (plazo maximo de 48 horas) y la bitacora de
auditoria en la **§3.4** y en la **§12**. Por eso la redaccion se reparte donde
el texto realmente dice las cosas.

**Instrumento que se emite: una nueva version del Anexo de Encargo, la
`2026-11-09`.** Es la recomendacion del plan y la opcion mas segura: una
version nueva suscrita por ambas partes deja sin efecto la declaracion de la
version 2026-11-06 en cuanto a lo que contradiga, sin ambigüedad de
prevalencia.

**Por que la v1.2 del Anexo de Nube, por si sola, no basta.** El Anexo de
Encargo 2026-11-06 es un contrato bilateral ya ejecutado y contrafirmado por
ASEPLUS el 7-nov-2026. Su §5 declara a Google como Responsable del
Tratamiento. **Una clausula nueva en un anexo posterior no puede, por si sola,
dejar sin efecto esa declaracion frente a la Empresa.** Por eso la v1.2
**remite** al instrumento bilateral y no lo sustituye.

**Si el abogado prefiriere un Otrosi modificatorio en lugar de una version
nueva:** los cambios son los mismos y quedan aislados en las §§4, 5, 3.4 y 12
mas la clausula de prevalencia, de modo que levantarlos en un Otrosi es un
recorte mecanico de las mismas cuatro secciones. **El texto de la version
2026-11-09 deja CONSTANCIA de que es una version nueva y de a que version
sustituye**, para que el modelo de suscripcion del servicio la reconozca.

**Que se escribe en la version 2026-11-09:**

- **§4 (Obligaciones del encargado):** se mantiene el deber de **no designar
  subencargados sin informar previamente** a la Empresa y **sin que esten
  vinculados por contrato o DPA** que les imponga obligaciones equivalentes. Se
  **retira** la determinacion de que Google actua como Responsable del
  Tratamiento en esta operacion, y se sustituye por la autorizacion de Google
  Workspace como subencargado, con el CDPA como vinculo.
- **§5 (Proveedores externos y subencargados):** la ficha de Google pasa a
  **Subencargado**, con el CDPA (instrumento, URL, fecha de vigencia del texto
  y huella SHA-256 del archivo descargado), el pais, el tratamiento de la
  transferencia internacional conforme al §10.1, y las clausulas de
  devolucion/supresion (§6.2), auditoria (§7.5) y subencargados (§11). Se
  mantiene la distincion con la **cuenta de correo de la Empresa**, que no es
  subencargado del Encargado.
- **§3.4 y §12 (bitacora y firmas):** se alinean con el CDPA en lo que toca a
  la devolucion, la supresion y la auditoria del proveedor.
- **Clausula de prevalencia:** en caso de conflicto entre el Anexo de Encargo y
  el Anexo de Nube, **prevalece el instrumento bilateral mas reciente suscrito
  por ambas partes**. La redaccion de la §2 actual ("el Anexo de Nube prevalece
  sobre el en lo relativo a la infraestructura y los subencargados") se
  **conserva** porque es la que dice quien responde por la infraestructura, y
  se le anade la clausula nueva como regla de cierre del conflicto.
- **NO se toca** el Acuerdo v1.5 ni sus clausulas 10.1 y 10.5(f).

---

## 6. Como cambia el gate

El item `google_dpa` **deja de existir como pendiente**: pasa a un item
**legado en estado `no_aplica`**, con el detalle de que la cuenta de consumo se
sustituyo por Google Workspace con CDPA y que el item vigente es
`mail_provider_dpa`. **No se marca `ok`**: un item que ya no aplica no es un
item cumplido, y marcarlo `ok` seria un verde falso.

El item nuevo `mail_provider_dpa` **exige**:

- `proveedor`, `servicio` y `cuenta` declarados, con `cuenta` en
  `workspace | cloud | empresarial | transaccional`.
- `rol === 'subencargado'`.
- `dpa === true`, con `instrumento`, `version`, `fecha`, `devolucion_supresion`,
  `auditoria` y `evidencia`.
- `pais`, `nivel_adecuado` y `transferencia` como **datos informativos**, no
  como condiciones.

Los items `devolucion_supresion` y `auditoria` dejan de tener la rama de
"el proveedor de consumo es aceptable": ahora exigen **Cloudflare y el
proveedor de correo**.

Ademas se corrige el **hallazgo 3.3** del plan, que era un **falso positivo**
del gate: `firmado_nube` y `empresas_nube` **no comparaban** la version y la
huella del Anexo de Nube firmado con el modelo vigente. Con la v1.2 publicada,
el gate habria seguido diciendo "Anexo de Nube firmado" citando la v1.1. **Esa
comparacion se hace ANTES de cambiar la version del modelo**, no despues.

---

## 7. Los pendientes, con nombre y responsable

| # | Pendiente | Responsable | Como se cierra | Que bloquea |
|---|---|---|---|---|
| P1 | ~~Aceptar o confirmar la incorporacion del CDPA en la consola de Workspace~~ — **CERRADO 10-nov-2026** (aceptado en la consola, acta + captura SHA-256 `9d989067…560`, registro aplicado) | ~~Owner~~ | Admin console > Cuenta > Terminos adicionales de seguridad y privacidad > "Cloud Data Processing Addendum" (ya muestra "Aceptado por kair@gesstiar.com el Nov 10, 2026") | `mail_provider_dpa` → **ok** |
| P2 | Confirmar que `kair@gesstiar.com` esta activa, con 2SV y con el metodo de autenticacion elegido | **Owner** | Admin console | Fase 1 (cambio de credencial) |
| P3 | Crear y verificar los alias `privacidad@`, `soporte@`, `incidentes@` de `gesstiar.com` | **Owner** | Admin console + un envio real a cada alias | Cierre de la excepcion de canales |
| P4 | Verificar SPF, DKIM y DMARC de `gesstiar.com` | **Owner** | DNS + cabeceras del envio real | Prueba de envio |
| P5 | Cambiar la credencial del servidor, reiniciar y **mandar un envio real**; guardar `Message-ID`, `Authentication-Results` y remitente visible | **Owner** | Ventana de mantenimiento con copia del `.env` anterior | Fase 1 |
| P6 | Revocar las app passwords de `adminkair@gmail.com` y verificar que no queda ninguna en el `.env` | **Owner** | Consola de la cuenta de consumo + revision del `.env` | Cierre del punto 2 |
| P7 | Confirmar por escrito la respuesta del abogado a las cuatro preguntas del §8 del plan (instrumento bilateral, contrafirma de la v1.2, alcance de canales, papel de Google para datos de cuenta y telemetria) | **Owner** | Consulta al abogado, con la respuesta escrita en el expediente | Suscripcion de la v1.2 y del Encargo 2026-11-09 |
| P8 | Suscribir la v1.2 del Anexo de Nube con ASEPLUS y, si el abogado lo confirma, re-suscribir el Anexo de Encargo 2026-11-09 | **Owner** (el agente no puede firmar por la Empresa ni por K+AIR) | Flujo de suscripcion y contrafirma del servicio | `firmado_nube`, `estado_encargo` |
| P9 | Publicar `legal/anexo-nube-v1.2.html` y `sitio/anexo-nube-v1.2.html` y regenerar `gh-pages` | **Owner** | El agente deja los dos archivos byte a byte iguales y su SHA-256 calculado | Consulta publica del Anexo de Nube |
| P10 | Desplegar el servicio con la v1.2 y el manifiesto nuevo | **Owner** | El agente deja el paquete armado y verificado | Preflight |

**Ninguno de estos pendientes se cierra por rewriting.** P1, P2, P5 y P6 son
actos del owner en consolas que el agente no tiene. P7 es una respuesta
humana. P8 es una firma.

---

## 8. Lo que esta decision no hace

- **No afirma** que la cuenta de Workspace este activa, ni que el CDPA este
  aceptado, ni que los alias existan, ni que el DNSS este bien: son P1 a P4.
- **No infiere** la respuesta del abogado: es P7, y el texto que se emite deja
  constancia de que la confirmacion esta pendiente.
- **No cierra** el punto 2 por si sola: mientras P1, P5, P6, P8 y P9 queden
  abiertos, el gate mostrara pendientes y la ruta transaccional seguira
  documentada como pendiente de migrar.
- **No enciende** `FIRMA_EXIGIR_ANEXO_NUBE` ni abre produccion.
- **No bumpea** la version de la app.

---

## 9. Anexo: los tres archivos de evidencia

| Archivo | Bytes | SHA-256 |
|---|---|---|
| `cdpa-customer-dpa_terms.html` | 97 831 | `0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1` |
| `cdpa-cloud-data-processing-addendum.html` | 913 836 | `3ac83515e35af4ebaf7af12d65a4229cf6799c25db56bc8200d129aa20d4ea6a` |
| `subprocessors-workspace.html` | 603 042 | `6ae1754eca496ea58d56fbefa6cfbc21fdb5a55d21b4870a25f3029d62115374` |

Los tres se descargaron el 9-nov-2026 con la URL publica de Google, sin
sesion autenticada. Los dos primeros son **el mismo instrumento** en dos
presentaciones (Workspace y Cloud): por eso sus huellas difieren y su fecha de
vigencia es la misma.
