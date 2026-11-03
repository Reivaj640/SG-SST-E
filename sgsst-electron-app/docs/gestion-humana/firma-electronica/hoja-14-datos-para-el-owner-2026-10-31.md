# Hoja de los 14 datos del Anexo de Nube (punto 1 de la Fase 1 del abogado)

**Fecha del registro original:** 31-oct-2026 · **Actualización:** 1-nov-2026 · **Para:** el owner · **Estado:** hoja histórica parcialmente superada; quedan 4 puntos abiertos

> **Corrección de la caracterización societaria (1-nov-2026).** La respuesta original de la fila 1 se conserva como antecedente de lo que se informó entonces, pero queda **SUPERADA**: describir a Gesstiar S.A.S. como «S.A.S. ordinaria» es incorrecto. La adenda 13 aplica la Ley 1258 de 2008: una S.A.S. es una sociedad por acciones simplificada y su naturaleza es comercial. El certificado de existencia y representación aún debe confirmar el tipo exacto; esta nota no atribuye una nueva declaración al owner.

El abogado pidió **14 marcadores** para que el Anexo de Nube sea firmable: **4 del RNBD** y **10 de la
ficha del canal de correo**. Los catorce están **diligenciados** en
`sgsst-electron-app/legal/anexo-nube-v1.0.html` con la evidencia verificada, y el manifiesto ya declara
la huella nueva.

**Lo que cambia respecto de esta misma hoja de hace unas horas:** pedía 9 respuestas. El servidor ya
estaba prendido, y de esos 9 solo **4 eran datos que no tenía nadie más**. Los que quedan no son
datos: son **decisiones tuyas**.

---

## A. Lo que respondiste (31-oct-2026)

| # | Tu respuesta | Dónde quedó escrita |
|---|---|---|
| 1 | **SUPERADA (respuesta original del 31-oct):** «S.A.S. ordinaria, no simplificada». La forma S.A.S. es una sociedad por acciones simplificada; la sociedad es comercial. Certificado de existencia y representación pendiente para confirmar datos registrales exactos. | Anexo de Nube §4 · RNBD, fila 1; adenda 13 |
| 2 | La sociedad está **recién creada**, con un valor de **$1.000.000** | Anexo de Nube §4 · RNBD, fila 2 |
| 3 | **No está inscrita** en el RNBD | Anexo de Nube §4 · RNBD, filas 3 y 4 |
| 4 | **Sí** tiene verificación en dos pasos | Anexo de Nube §5 · ficha MFA |
| 5 | Las contraseñas **no se han rotado**: está pendiente | Anexo de Nube §5 · contraseña de aplicación y rotación |
| 6 | **No sabe** quién escala un rechazo de OTP | Anexo de Nube §5 · escalamiento (queda como vacío declarado) |
| 7 | **Sí**: la regla de contenido mínimo la redacto yo con lo que hace el código | Anexo de Nube §5 · contenido mínimo |

## B. Lo que salió del servidor y cerró los otros siete marcadores

| Marcador | Evidencia verificada |
|---|---|
| Servidor SMTP y cifrado | `smtp.gmail.com` puerto 587 con STARTTLS; TLSv1.3 con `TLS_AES_256_GCM_SHA384`, `CN=smtp.gmail.com`, cadena válida (verify 0) |
| Remitente | `adminkair@gmail.com`; confirmado por los cuatro envíos reales del 26-oct, con `messageId` del dominio `@gmail.com` |
| Contraseña de aplicación | Existe y depende de `adminkair@gmail.com`; el secreto vive solo en el entorno del servidor, con permisos de solo lectura |
| Fecha de generación | **No consta**: el proveedor no la expone y el expediente no la registra. La evidencia disponible es la fecha de uso: 26-oct-2026 |
| Plantilla del OTP | La del código, con las cuatro frases del §5; dos `INVITE_SENT` y dos `OTP_SENT` con `envio_exitoso` el 26-oct |
| Contenido mínimo | Los cuatro datos del §4, con su `body_hash` y el destinatario enmascarado; el código nunca se guarda en claro |
| Registro de envíos y errores | `gh_firma_eventos` (de solo agregar) con `OTP_SENT`, `OTP_RESENT` y `OTP_SEND_FAILED`; bitácora del servicio con 5.250 líneas JSON |
| Última revocación | **Ninguna**: 3 tokens emitidos, `revocado_at` nulo en los tres, sin `revocado_por` ni `motivo_revocacion` |

## C. Lo que queda abierto (cuatro puntos)

| # | Qué falta | Por qué lo abro |
|---|---|---|
| 1 | **Rotación de la credencial**: cada cuánto y quién | Declaraste que está pendiente. El Anexo lo dice de forma expresa, y el abogado lo va a preguntar igual |
| 2 | **Escalamiento de un OTP rechazado**: a quién escala y a quién se le avisa, con nombres y cargos | El sistema **no escala**: al quinto intento el consentimiento queda `LOCKED` y no se notifica a nadie. No es un dato, es una decisión |
| 3 | **Fecha de generación de la contraseña de aplicación** | Si la tenés, se escribe; si no, queda como está, con la fecha de uso como evidencia |
| 4 | **Dos documentos por adjuntar**: el certificado de existencia y representación de la Cámara de Comercio, y la consulta al portal de la SIC que confirme que no está inscrita | Son los dos documentos que respaldan el RNBD |

## D. El resultado del RNBD, en una línea

Gesstiar S.A.S. **no tiene obligación de inscribirse en el RNBD**: el artículo 2.2.2.26.1.2 del
Decreto 1074 de 2015 (modificado por el Decreto 090 de 2018) pone el umbral en **100.000 UVT**, que con
la UVT 2026 de $52.374 (Resolución 000238 de 2025 de la DIAN) son **$5.237.400.000**; los activos
declarados son **$1.000.000**, es decir **19,09 UVT**: **5.237 veces por debajo** del umbral. Con eso,
**no inscrita** y **sin declaración de transferencia internacional pendiente**.

## E. Dónde quedó escrito, para que lo revises

- `sgsst-electron-app/legal/anexo-nube-v1.0.html` — los catorce apartados diligenciados.
- `sitio/anexo-nube-v1.0.html` — la copia publicada, byte a byte idéntica.
- `sgsst-electron-app/firma-service/legal-readiness.json` — la nota del modelo, escrita en su script.
- `sgsst-electron-app/docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/` — el paquete
  reconstruido, con la tabla de los catorce adjuntos rellenada desde los bytes reales.

**Lo que sigue sin depender de esta hoja:** las 6 decisiones del abogado, la fecha de vigencia del
Acuerdo v1.4, el commit candidato, la firma, y las verificaciones en el servidor.
