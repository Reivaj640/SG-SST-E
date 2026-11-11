# P11 — Rotación y revocación de las app passwords de los clientes

> **Estado al 10-nov-2026:** lo que depende del repo está **cerrado**. Lo que depende
> de Google es **una acción del owner** (revocar 5 app passwords) y está en el §3.
> Las claves **vivas son las mismas que están en el historial público**: por eso la
> revocación no puede esperar a que "esté todo listo".
>
> Este documento **no contiene ningún valor de clave**. Solo metadatos: empresa,
> buzón, fecha, quién y evidencia.

## 1. Qué es P11 y cómo se encontró

El 9-nov-2026, al barrer los 25 105 blobs del historial completo del repositorio
(que es **público**), aparecieron dos hallazgos materiales: **P11** (este) y **P12**
(el token personal de GitHub, ya revocado).

Las app passwords de Gmail de los clientes estaban escritas en `utils/emailSender.js`
y duplicadas en `Portear/src/`. Desde el 📦931 salen del código, pero **Git no borra el
pasado**: el commit que las metió (`840c31d7`, 📦286) es alcanzable desde `origin/Dev`,
`origin/Dev-Pc` y `origin/HEAD`.

**Medición del 10-nov-2026 (sin mostrar valores):**

| Medición | Resultado |
|---|---|
| Claves de cliente hoy en `sgsst-electron-app/.env` | **5**, en **4** buzones |
| Claves de cliente hoy en archivos versionados | **0** |
| Commits del historial que contienen cada clave | **7–8** por clave (`02911ede`, `6d96f80a`, `840c31d7`, `00284638`) |
| ¿Alcanzables desde ramas públicas? | **Sí** (`origin/Dev`, `origin/Dev-Pc`, `origin/HEAD`) |
| ¿El `.env` está ignorado por git? | **Sí** (`.gitignore:29`) |
| ¿El instalador lleva el `.env` de la app? | **Sí** — `electron-builder` NO lo excluye (a propósito, para que el correo funcione en el cliente) |

> **El vector de recurrencia está medido:** el `.env` de la app **viaja dentro del
> instalador**. Hoy **cada equipo de cliente tiene las 5 claves** de los 5 clientes.
> Por eso rotar sin cambiar dónde viven las claves repite P11 en 90 días.

## 2. Lo que ya está hecho (repo, 10-nov-2026)

| # | Qué | Dónde |
|---|---|---|
| 1 | Las 5 claves **salieron del código** | `utils/emailSender.js`, `Portear/src/*.py` (📦931) |
| 2 | El `.env` de la app **está ignorado** por git | `.gitignore:29` |
| 3 | El guard de build **corta** si falta una clave de cliente | `main/_verificar-credenciales-build.js` (📦931) |
| 4 | **El botón "Enviar por correo" volvió a funcionar**: `shared/env-loader.js` tenía un `*/` accidental dentro de un comentario de bloque, que cerraba el comentario antes de tiempo y dejaba el resto del archivo ejecutándose como código (`ReferenceError: utils is not defined` al importar). El botón estaba muerto en el instalador **y en desarrollo** | `shared/env-loader.js` + `main/test-email-env-931.js` (33/33) + guard de build (📦1047) |
| 5 | El token `ghp_` de `build-and-publish.bat` **fue sustituido** por `github_pat_TU_TOKEN_AQUI` y el `.bat` ahora lee `GH_TOKEN` del entorno | `build-and-publish.bat` (3 ocurrencias) |
| 6 | **Guarda nueva**: un escaneo de los 3 841 archivos versionados que corta el build si un secreto vuelve a aparecer. No imprime valores: dice archivo, línea y regla | `main/detector-secretos.js` + `main/test-secretos-1047.js` (16/16) |

**Las 5 claves se verificaron con envío real (11-nov-2026):** una por empresa, con
Message-ID propio. El canal de correo de la app **funciona**.

## 3. Lo que falta: la revocación (owner, 4 buzones, ~15 minutos)

> Orden recomendado: **crear las nuevas → instalarlas → reconstruir → distribuir →
> probar → revocar las viejas**. Revocar antes de distribuir deja a los clientes con
> correo muerto.
>
> **Excepción en este caso:** no hay trabajadores reales en producción y el botón
> "Enviar por correo" estaba roto, así que revocar **ahora** no rompe nada que esté
> en uso. Lo que no se puede es dejar las claves viejas vivas "por si acaso": están
> publicadas.

### 3.1 Las cinco claves

| Empresa | Buzón | Variable en el `.env` | Estado |
|---|---|---|---|
| TEMPOACTIVA | `tempoactivaestsas@gmail.com` | `KAIR_EMAIL_TEMPOACTIVA_PASSWORD` | Vigente — **publicada en el historial** |
| COOTRACOM | `tempoactivaestsas@gmail.com` (mismo buzón, **otra** clave) | `KAIR_EMAIL_COOTRACOM_PASSWORD` | Vigente — **publicada en el historial** |
| TEMPOSUM | `temposumestsas@gmail.com` | `KAIR_EMAIL_TEMPOSUM_PASSWORD` | Vigente — **publicada en el historial** |
| ASEPLUS | `asepluscaribesas@gmail.com` | `KAIR_EMAIL_ASEPLUS_PASSWORD` | Vigente — **publicada en el historial** |
| ASEL | `asel.contratacion@gmail.com` | `KAIR_EMAIL_ASEL_PASSWORD` | Vigente — **publicada en el historial** |

### 3.2 El paso a paso

1. En cada buzón: **Google Account → Seguridad → Verificación en dos pasos →
   Contraseñas de aplicación**. Crear una clave nueva con nombre reconocible
   (ej. `kair-remision-2026-11`) y **copiarla** (Google solo la muestra una vez).
2. Pegar cada clave en el `.env` de la máquina que compila
   (`sgsst-electron-app/.env`), **entre comillas**, con los espacios tal cual.
   No se documenta el valor en ningún archivo versionado.
3. Reconstruir el instalador y **distribuirlo** antes de revocar.
4. Probar "Enviar por correo" con una remisión de prueba y **verificar el
   Message-ID**.
5. **Revocar las 5 claves viejas** en Google (el mismo lugar del paso 1).
6. **Probar que la vieja ya no sirve**: un envío con la clave vieja debe fallar
   con error de autenticación. Eso es la evidencia de que quedaron revocadas.

### 3.3 Qué registrar (solo metadatos)

| Campo | Ejemplo |
|---|---|
| Empresa | ASEPLUS |
| Buzón | `asepluscaribesas@gmail.com` |
| Fecha de revocación | 2026-11-XX |
| Quién revocó | owner |
| Evidencia | captura de la pantalla de Google con la clave ya revocada (sin el valor) |
| Resultado | envío con la clave vieja → error de autenticación |

Ese registro va en `legal-readiness.json` o en la bitácora del proyecto, **nunca en
un archivo que lleve el valor**.

## 4. La decisión de fondo: dónde viven las claves nuevas

Rotar sin decidir esto **repite P11 en 90 días**. Las tres rutas:

| Ruta | Qué significa | Consecuencia |
|---|---|---|
| **A · Build por empresa** | Cada instalador lleva **solo** la clave de su cliente | Mitigación inmediata: un cliente solo ve la suya. 5 builds |
| **B · Relay en el servidor** | La clave vive en el servidor; la app pide enviar por HTTP | Destino: la clave **no sale** del servidor y no se distribuye |
| **C · Solo rotar** | Las 5 claves nuevas vuelven a viajar en cada instalador | P11 se repite completo |

**Recomendación: A como mitigación inmediata + B como destino.**

## 5. Lo que NO cierra P11

- **Reescribir el historial de Git.** No hace falta: revocar el token vuelve inerte
  la cadena (quien tenga la clave copiada no puede usarla). Reescribir es
  disruptivo (force push, rama pública, y hay **1 commit sin pushear**).
- **Un "sí" del detector.** El detector dice que el árbol **hoy** está limpio; el
  historial sigue teniendo las claves viejas, y por eso la revocación es la que
  cierra.

## 6. Cómo se verifica que no volvió a pasar

```bash
node sgsst-electron-app/main/test-secretos-1047.js   # 16/16 OK
node sgsst-electron-app/main/_verificar-credenciales-build.js   # corta el build si hay un secreto
```

## 7. Nota legal (no es un dictamen)

### 7.1 Qué cubre el CDPA y qué no

| Canal | Cuenta | Instrumento | Rol de Google |
|---|---|---|---|
| Servicio de firma (transaccional) | `kair@gesstiar.com` — **Google Workspace** | **CDPA** (Cloud Data Processing Addendum), que se incorpora al *Agreement* y cubre los *Customer Data* de la cuenta | **Subencargado** (Decisión A del 9-nov-2026) |
| App de escritorio (remisiones) | 5 cuentas **Gmail de consumo** de los clientes | **No hay CDPA**: rigen los Google TOS (<https://policies.google.com/terms?hl=es>) y la Privacy Policy; Google no actúa como encargado | Responsable por cuenta propia ⚠️ No verificado en la consola de cada cliente |

- Texto del CDPA: <https://cloud.google.com/terms/data-processing-addendum>
- Ópt-in (lo que hace el owner en la consola): Admin console → **Cuenta → Configuración de la cuenta → Cumplimiento legal** → **Seguridad y privacidad → Términos adicionales** → *Cloud Data Processing Addendum* → **Review and Accept** → **I Accept**. Google dice que solo hace falta el opt-in **si el acuerdo de Workspace no incorpora el CDPA por referencia**, y que, si no se sabe, conviene optar igual: <https://knowledge.workspace.google.com/admin/compliance/privacy-compliance-and-records-for-google-workspace-and-cloud-identity>

### 7.2 Por qué revocar es una obligación de resultado, no una preferencia

- **Ley 1581 de 2012, art. 4 lit. (g) y (h)**: principio de **seguridad** (medidas técnicas, humanas y administrativas contra consulta, uso o acceso no autorizado) y de **confidencialidad**. **Art. 5**: los datos **relativos a la salud** son **datos sensibles**. **Arts. 17 lit. (d) y 18 lit. (b)**: conservar la información bajo condiciones de seguridad. Texto: <https://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html> · PDF oficial SIC: <https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Ley_1581_2012.pdf>
- **Decreto 1377 de 2013**: **art. 2** — la excepción del ámbito personal o doméstico **no aplica** (aquí es uso empresarial); **art. 3 num. 3** — definición de datos sensibles (salud); **art. 25** — el Encargado debe salvaguardar la seguridad y la confidencialidad; **arts. 26 y 27** — responsabilidad demostrada ante el Titular. Texto: <https://cancilleria.gov.co/normograma/compilacion/docs/decreto_1377_2013.htm> · PDF oficial SIC: <https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/DECRETO%2B1377%2BDEL%2B27%2BDE%2BJUNIO%2BDE%2B2013.pdf>

**Conclusión:** la ley no dice "rote las app passwords"; dice que debe haber **medidas
razonables de seguridad**. Rotar y revocar las credenciales expuestas es la medida
razonable y documentable, y es la que además **reduce el daño** mientras se decide
lo demás. Conviene dejar escrito el análisis (arts. 26–27).

### 7.3 La pregunta que todavía no tiene respuesta: ¿se reporta a la SIC?

- **Ley 1581 de 2012, art. 17 lit. (n)** (deber del Responsable) y **art. 18 lit. (k)**
  (deber del Encargado): **informar a la SIC** cuando se presenten **violaciones a
  los códigos de seguridad** y existan **riesgos en la administración de la
  información de los Titulares**.
- **Circular Única de la SIC, Título V**: el reporte de incidentes de seguridad se
  presenta en **15 días hábiles** desde la detección y la puesta en conocimiento.
  Fuente: <https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/cumplimiento-de-la-obligacion-del-reporte-de-incidentes-de-seguridad>
  ⚠️ **No verificado** que el texto idéntico se conserve en la Circular 01 de 2026
  vigente (confirmado en las versiones 2020–2022).

**No se puede afirmar que este caso sea reportable** sin estos hechos, que están
sin medir: (1) el alcance y la fecha de la exposición en Git; (2) si un tercero
leyó o usó las claves; (3) si los buzones llegarían a contener remisiones con
datos de salud (hoy **no hay trabajadores reales en producción**, y las claves se
detectaron y se revocaron sin uso indebido probado).

**Lo que sí es una decisión, y no un hecho: la decisión de radicar o no ante la
SIC, y la notificación a cada Empresa (Responsable), es del owner con el abogado.**
La cuantificación del daño (arts. 26–27) y la eventual **calificación como
delito informático** (Ley 1273 de 2009, art. 254) también son del abogado:
⚠️ **No verificado**.

> Este apartado es apoyo informativo, no asesoría jurídica profesional. La decisión
> final y la responsabilidad son del owner.

