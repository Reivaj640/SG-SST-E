# Acta de cierre de la mesa de determinaciones L1 a L7 (12-nov-2026)

> **Qué es este documento.** El acta interna de la mesa que el owner abrió con el encargo «el agente legal
> debe cerrar las decisiones pendientes L1…L7, no generar planes, debe cerrarlas; el agente worker cumple el
> trabajo que el agente legal propone, y el agente general las valida». Recoge **qué se detuvo**, **qué quedó
> escrito**, **qué se midió** y **qué queda con nombre y responsable**.
>
> **Status.** Acta interna de expediente. **No sustituye la validación de un abogado matriculado**: la firma, la
> ratificación y la responsabilidad son del owner (Gesstiar S.A.S.).
>
> **Alcance.** Los siete puntos de la mesa **L** y los siete bloques de la meta **M.5, M.6, M.7, M.14, M.15,
> M.18 y M.20**. No se tocó ningún texto suscrito, ni el manifiesto, ni el sitio público.

---

## 1. Las siete determinaciones: qué se detuvo

| Punto | Tema | Determinación (el fondo, en una línea) | Dónde está el texto |
|---|---|---|---|
| **L1** | Papel de Google en el flujo de correo (J6) | Google es **Responsable** sobre la cuenta del administrador y la telemetría, y **Encargado** (Subencargado solo como figura contractual) sobre los datos del cliente del canal. La operación es **transmisión internacional a un Encargado**, **no transferencia**: **no se activa el art. 26 de la Ley 1581**; rigen el art. 24 num. 2 y el art. 25 del Decreto 1377. La entidad contractual es **Google LLC** (por perfil de pago). **P1 cerrado**; el CDPA se identifica **por huella** (no declara fecha) y su efectividad es el **10-nov-2026**; el derecho de auditoría del §7.5.2(a) **no se activa**; EE. UU. es **uno** de los países posibles; el CDPA **no fija plazo de 24 h ni de 48 h** | `dictamen-legal-l1-2026-11-12.md` |
| **L2** | Circular Externa 002 de 2025 y RNBD (J7) | La Circular 002 **no aplica al canal de correo** (transmisión) y **sí aplica** por su segundo supuesto (la transferencia del software). El **RNBD es obligación de la Empresa (Responsable)**, por sus propios activos: los **19,09 UVT** del expediente son de Gesstiar S.A.S. y son una declaración, no un certificado. Si la Empresa no está obligada, no se le puede exigir la inscripción | `dictamen-legal-2026-11-12-tandas-2-y-3.md` §1 |
| **L3** | Tabla supletoria de conservación (J8) | **Se validan los plazos** (10 y 5 años) **con cuatro condiciones expresas** (C1 a C4) y con la corrección de que la tabla tiene **ocho** categorías, no cinco, y de que el §8.6 **no** tiene un «compromiso contractual de 20 años» (es el piso legal desde el cese) | ídem §2 |
| **L4** | Redacción de la v1.4 y del Encargo que la remite (M.18) | **Se reemite ahora**, con C1–C7, el proveedor de respaldos y los actos del 12-nov declarados; P3 y P6 siguen pendientes; **no se promete lo que no está hecho** | `propuesta-v1.4-anexo-nube-2026-11-12.md` + `pedido-6-backblaze-v1-4-2026-11-12.md` |
| **L5** | Respaldo off-site en Backblaze B2 (M.7) | La copia es **transmisión internacional** (Encargado → Encargado), **no transferencia**: **no se activa el art. 26** y el art. 24 num. 2 exonera de informar y de consentir al Titular porque hay contrato del art. 25. **Ninguna** de las cuatro vías evaluadas era la vía. Backblaze **es subencargado** y entra en el **§4** del Nube y el **§5** del Encargo (el **§11** es «Referencias normativas»). El bucket **debe crearse en la región US** | `pedido-6-backblaze-v1-4-2026-11-12.md` |
| **L6** | La v1.1 como registro histórico (M.15) | La v1.1 **queda suscrita y sin contrafirma**, **no es instrumento ejecutado** y **no se contrafirma retroactivamente**. Pero **«bajo la v1.1 no se trató dato alguno» no se sostiene**: hubo una firma completada el 6-nov (`SIGN-2026-738564`), así que el expediente **declara** el tratamiento | `nota-expediente-v1-1-2026-11-12.md` (constancia) |
| **L7** | La variable inerte del `.env` (M.20) | La ficha publicada **no puede presentar como control lo que no es**: el rechazo del buzón corporativo es **incondicional** y la variable **no cambia ningún comportamiento**. Se conserva inerte, con el comentario que lo dice, y **no se cita como control en ningún documento** | ídem §5 + `deploy/README-DESPLIEGUE.md` |

**Las doce correcciones que la determinación de L1 le hizo al encargo** están en el §0 del dictamen de L1. Las
seis que le hizo la de L2/L3/L6/L7 están en su §1.3, §2.3 y §4. Ninguna quedó «para ver después».

---

## 2. Lo que el worker de código cumplió (medido)

El worker **implementó** lo que el agente legal propuso, y todo se midió.

| Insumo | Qué se implementó | Cómo se midió |
|---|---|---|
| **L3 / C1 a C4** | `retencion.js`: `plazoRegistroOperaciones()` (C1), cómputo en **años calendario** y texto sin la equivalencia falsa (C2), el piso no se baja (C3), la fecha de cese la informa y valida la Empresa (C4). `config/tabla-conservacion.json`: las ocho categorías con `plazo_anos`, las condiciones, el alcance que se somete a validación y `validado_por_documento`/`activado_at` en `null` | **6 pruebas nuevas** en `tests/services/conservacion-supletoria.test.js`; suite del área de conservación **24/24**; suite completa **2 683 / 2 681 / 0 / 2**, exit 0 |
| **L3 / compuerta** | `_tablaActivada()` exige `validado_por` **y** `validado_at` **y** rechaza el marcador `PENDIENTE…`: un marcador no es una validación | prueba «el marcador de "PENDIENTE" no abre la compuerta aunque se ponga la fecha» |
| **L6** | Constancia de expediente de la v1.1, con la premisa corregida (hubo una firma el 6-nov) y el comando literal de la lectura de solo lectura | `nota-expediente-v1-1-2026-11-12.md` |
| **L7** | El comentario de `src/config.js` que dice que la variable **no es un interruptor** y que el control real es el rechazo incondicional; el bloque de comentario obsoleto de `publicFlow.js` corregido («SIEMPRE ACTIVO») | `deploy/README-DESPLIEGUE.md` y `docs/MIGRACION-SERVIDOR-FIRMA.md` con el comando del `.env` (respaldo previo, borrado de una sola línea, verificación) |

**La compuerta sigue CERRADA** (`aplicacion.activada = false`) y **ahora está cerrado por código**: no se abre
sin la validación escrita, y el nombre del abogado **no se inventa**.

---

## 3. Lo que NO se hizo, y por qué (para que conste)

1. **El manifiesto legal (`legal-readiness.json`) no se tocó.** Su huella está registrada en el expediente;
   cambiarlo obliga a repropagar el expediente entero. Sus afirmaciones pendientes —`proveedor: Google Ireland
   Limited` frente a Google LLC, `fecha_efectividad_addendum: null`, y las frases sobre el flag y sobre las
   solicitudes de firma— **se corrigen al armar la v1.4 y al firmarla**, no antes: un manifiesto que declara un
   texto que ninguna Empresa ha suscrito es un gate mintiendo en verde.
2. **Los textos suscritos no se tocaron.** `legal/anexo-nube-v1.3.html` y `legal/anexo-encargo.html` quedan
   byte a byte iguales. La v1.4 son **copias nuevas**, en `candidatos-v1.4/`, marcadas **no firmables**.
3. **El sitio público no se tocó.** `sitio/` publica las huellas suscritas; publicar un texto no firmado
   obligaría a publicar su huella nueva sin que nadie lo haya suscrito.
4. **La migración 031 no se reescribió.** Ya está aplicada en producción. Su comentario obsoleto queda
   documentado.
5. **El paquete del abogado no se rearmó.** `scripts/armar-paquete-abogado.js` **sobrescribe los adjuntos** con
   sus orígenes: en la ronda 14 tuvo que usarse `git checkout` para restaurar cuatro archivos. El manifiesto de
   sumas se regenera **a mano**.

---

## 4. Lo que queda, con nombre y responsable

**Es acto de tercero, no de determinación.** Por eso los bloques **no pasan de PARCIALMENTE**: cerrarlos exigiría
firmar por un tercero.

| # | Lo que falta | Quién lo tiene | Qué lo desbloquea |
|---|---|---|---|
| 1 | **Ratificar L1 a L7** por escrito | Abogado matriculado | Un solo escrito que ratifique o corrija las siete determinaciones |
| 2 | **Validar la tabla supletoria**: `validado_por`, `validado_at`, `validado_por_documento` | Abogado matriculado | Su opinión con fecha y huella; después el owner **abre** la compuerta, en un acto **separado y posterior** |
| 3 | **Redactar y firmar la v1.4** y el Encargo 2026-11-12 | Abogado (redacción) y owner (firma y contrafirma) | Firma de la Empresa, contrafirma de K+AIR, actas y huellas; el manifiesto se actualiza **después**, con la huella real |
| 4 | **La cuenta y el bucket de Backblaze B2 en la región United States**, la llave, la custodia de la frase **fuera del servidor y fuera del bucket**, la primera copia verificada por SHA-256, la prueba de restauración y la rotación de claves | Owner | Los cuatro actos del P8, más el contrato con las cláusulas del art. 25 |
| 5 | **Contrato u Orden de Google** (entidad contractual), la fecha de renovación del Acuerdo de Workspace, **P3** (alias) y **P6** (revocación de credenciales) | Owner | Los siete actos de L1 |
| 6 | **La ventana de Node 22** con rollback (M.14) | Owner | La ventana de mantenimiento del plan (P5) |
| 7 | **En producción**: el manifiesto vivo sigue con las dos notas contraditorias (`191c08b8…` frente a `d9b59699…` del repo); `proxy-addr 2.0.7` crítica, `express 4.22.2`, `nodemailer 6.10.1`, `zod 3.25.76`, Node v20.20.2 | Owner | Desplegar el 📦1051 con `npm ci --omit=dev`; encender `FIRMA_EXIGIR_ANEXO_NUBE` al final; el `TRUST_PROXY` del `.env` |
| 8 | **La primera firma de una empresa real** (hoy solo ASEPLUS, de prueba) | Owner | Los siete puntos anteriores |

**Ninguno de estos pendientes es un veto legal para abrir**: lo que queda es **contractual**, **regulatorio por
veracidad** (art. 4(d) de la Ley 1581) y de **reputación frente al primer cliente**.

---

## 5. El conteo no cambia, y por qué

El mapa sigue con **30 bloques: 9 cerrados y 21 pendientes**. No es que la mesa no haya avanzado: es que **un
bloque cierra cuando lo que su texto dice que falta está hecho y medido**, y en los cinco bloques que
dependían de un tercero lo que falta es **firma, credencial, ventana o respuesta**. Cerrarlos por decreto
del agente legal sería un **verde falso**, que es exactamente el defecto que este mapa existe para evitar.

Lo que sí cambió en el mapa es el **«qué falta»** de M.5, M.6, M.15, M.18 y M.20: ya no dice «falta la
determinación» sino **el acto concreto, con su responsable**. Ese es el avance real de la ronda.

---

## 6. Cierre

La mesa **L1 a L7 está cerrada**: los siete puntos tienen determinación escrita, con su base normativa
verificada el 12-nov-2026 en fuente oficial, sus correcciones al encargo y sus textos literales listos para
pegar. Los cinco bloques de la meta que dependían de esta mesa tienen **acotado el «qué falta»** y cada
pendiente tiene **nombre y responsable**.

Lo que sigue abierto es **de otro tipo**: son actos del owner, del abogado matriculado y de producción, y
están enumerados arriba con lo que los desbloquea.
