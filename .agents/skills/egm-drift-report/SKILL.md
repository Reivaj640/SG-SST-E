---
name: egm-drift-report
description: Compara los documentos versionados de un directorio contra el código fuente actual y reporta SOLO las divergencias. Úsalo antes de commitear un paquete, cuando el owner pida "verificar si los documentos siguen siendo ciertos", "detectar deriva", "revisar que el doc y el código digan lo mismo", o cuando sospeches que una nota, una tabla o un README quedaron viejos. No lo uses para escribir ni corregir documentos: el informe es el entregable, la decisión de arreglar es del owner.
---

# Reporte de deriva entre documentos y código

<!--
Port adapted from google/elephant-goldfish-model (Apache-2.0, Google LLC).
Fuente: https://github.com/google/elephant-goldfish-model  ·  skill original:
skills/egm-drift-report/SKILL.md  ·  licencia: Apache 2.0
Que cambio y por que: references/adaptacion.md
-->

La enfermedad de este repo no es el código roto: son los **documentos que quedaron viejos**. Un README
que describe una retención que el script ya no tiene, una nota que promete una línea que la API no
expone, una tabla que declara un hash que ya no es el vigente. Ese desfasaje no rompe nada hoy y por
eso nadie lo ve: aparece tres meses después, cuando alguien confía en el documento.

Este skill produce el informe de esas diferencias. **No arregla nada**: el informe es el entregable y
la decisión de corregir es del owner.

## Inputs to collect

- **El directorio de documentos a revisar.** Por defecto:
  `sgsst-electron-app/docs/gestion-humana/firma-electronica/`. Si el owner no dijo cuál, preguntá
  cuál antes de empezar: un reporte de todo el repo mezcla lo que importa con lo que no.
- **El alcance dentro del directorio.** Por defecto, los `.md`. Los documentos de bitácora e
  histórico (`Historial.md`, `BITACORA.md`, los `*-checklist*`) son **registro de lo que pasó**, no
  afirmaciones sobre el estado actual: no son fuente de deriva salvo que el propio owner lo pida.
- **Dónde dejar el reporte.** Por defecto `tmp/DRIFT/<YYYY-MM-DD>_DRIFT_REPORT.md`. `tmp/` está en
  `.gitignore`, así que el reporte no ensucia el árbol ni entra a un commit por accidente. **Nunca**
  en la raíz del repo.

Si el directorio no existe o está vacío, decílo y preguntá. No inventes el alcance.

## Procedure

1. **Listar los documentos** del directorio y separarlos por rol: los que **afirman** el estado
   actual del sistema (API, flujos, guías de despliegue, tablas de instrumentos) son fuente de
   deriva; los que **registran** lo que pasó (bitácoras, historiales) no.

2. **Por cada documento, una por uno** (en orden, sin paralelizar: el búfer de salida se desborda):

   a. **Contextualizar.** Leer el documento. Anotar qué afirmaciones hace sobre el sistema: rutas,
      campos, errores, comandos, variables, versiones, hashes, estados de producción.

   b. **Localizar la fuente.** Para cada afirmación, encontrar el archivo del código que la
      sostiene. Si el documento no da la ruta explícita, buscarla (grep por el nombre de la ruta, el
      nombre de la función, la variable, el código de error). **Si no se encuentra, ESO ES DERIVA**:
      el documento afirma algo que no existe en el código.

   c. **Verificar.** Leer el estado ACTUAL de ese archivo. No te fíes de lo que dice el documento ni
      de lo que recuerdas de una sesión anterior: leé el código.

   d. **Detectar la deriva.** Las siete derivas de este repo:

      | # | Deriva | Cómo se ve |
      |---|---|---|
      | 1 | **Afirmación que el código no tiene** | El doc describe una ruta, un campo, un código de error o un comando que no aparece en el código |
      | 2 | **Comportamiento que el doc no menciona** | El código hace algo (un campo nuevo, una regla nueva, un paso más) y el documento no lo dice |
      | 3 | **Literal vencido** | El doc fija un valor (versión, token `?v=`, fecha, hash, un número de días) que el código ya no tiene. Es la trampa 28 del repo: un check o un doc que fija un literal se rompe solo, y su mutación queda vacía sin avisar |
      | 4 | **Ruta o archivo que no existe** | El doc nombra un archivo, una carpeta o una función que no está (o que está donde el doc dice que no) |
      | 5 | **Versión o hash que ya no es el vigente** | El doc declara una huella o una versión y el archivo real tiene otra. Se contrasta con el hash del archivo, no de memoria |
      | 6 | **Promesa que la forma no cumple** | El doc dice "la lectura trae X" (o "el panel muestra X") y la forma de la API o la vista no lo trae. Esta deriva produce **falsos negativos**: la pantalla dice que falta lo que ya está |
      | 7 | **Estado del mundo que cambió** | El doc afirma un estado de producción, de un despliegue, de una cuenta o de un certificado que ya no es cierto (el servidor corría el código anterior, la cuenta cambió de plan, el certificado venció) |

   e. **Filtrar.** Anotar **solo** las diferencias. No describir lo que funciona ni lo que coincide.
      Si el documento y el código dicen lo mismo, la sección del reporte es `No drift detected`.

3. **Redactar el reporte.** Un archivo, formato estricto:

   ```markdown
   ## <NOMBRE_DEL_DOCUMENTO>

   - <DERIVA 3>: el doc dice "mtime +14" (línea 85) y el script usa `mtime +$RETENCION_DIAS`
     (línea 266 de `deploy/backup-firma.sh`). El check que exige el literal queda vacío.
   - <DERIVA 6>: el doc afirma que la lectura trae `contrafirma_evidencia` (línea 389) y la forma
     del Anexo de Encargo no lo traía (`_suscripcionEncargo`).
   ```

   Con la referencia de línea en ambos lados: sin el "dónde", la deriva no se puede arreglar.

4. **Resumen en el chat.** Cantidad de documentos revisados, cantidad con deriva, y las tres
   divergencias de mayor impacto con su archivo y línea. Decí explícitamente si revisaste **todo**
   el directorio o **una parte** (si el directorio es grande, se procesa por secciones y el
   reporte dice qué se leyó).

## Output contract

- **Archivo**: `tmp/DRIFT/<YYYY-MM-DD>_DRIFT_REPORT.md`, con una sección `## <DOCUMENTO>` por
  documento revisado, en el orden en que se procesaron.
- **En el chat**: el resumen del punto 4, con la lista de archivos leídos. Nada más: el detalle
  vive en el archivo.
- **No se toca ningún documento ni ningún archivo de código.** Este skill informa. Si además querés
  corregir, es otro paso y otro permiso.

## Failure handling

- **El directorio no existe o está vacío**: decilo y preguntá cuál es el objetivo. No inventes el
  alcance ni revises "lo que haya parecido".
- **El código que el documento referencia no se encuentra**: reportalo como deriva #4, con el
  nombre que el documento usa. No lo saltees por "será que cambió de nombre": si no se encuentra,
  el documento está roto para quien lo lea.
- **Un documento es enorme** (`API.md` son ~3 300 líneas): leerlo por secciones, en orden, y dejar
  anotado en el reporte qué secciones se leyeron. La mitad leída no es el documento revisado.
- **El documento afirma algo que no se puede verificar** (un estado de una cuenta de un tercero,
  un acta de un abogado, un hash de un archivo que no está en el repo): eso **no** es deriva. Es
  una afirmación externa. Dejalo por fuera y decí en el resumen que quedó fuera y por qué.

## Reglas de este repo que el reporte tiene que respetar

- **Nada es una regla hasta contrastarlo con el código** (`PROMPT.md` §5.9). Si el documento y el
  código discrepan, el reporte lo dice y nombra cuál manda: hoy, el código. No resuelvas la
  divergencia por tu cuenta ni declares que el documento "está bien".
- **Un literal fijado en un doc o en un check es una bomba de tiempo** (trampa 28). Deriva #3 es la
  más silenciosa: nada falla hasta el próximo bumpeo.
- **Falla cerrada**: si el doc promete que algo se exige y el código no lo exige, eso es una
  divergencia de la peor clase (deriva #1 y #6 juntas): el gate puede dar verde sin lo que el
  documento promete.
- **El reporte no reescribe los anexos ni los textos legales.** Si la deriva toca un texto
  suscrito, se reporta y la decisión la toma el owner con el abogado.

## Ejemplos

**Entrada**: «¿Los documentos de firma-electronica siguen siendo ciertos?»

**Salida**: un `tmp/DRIFT/<fecha>_DRIFT_REPORT.md` con una sección por documento, solo las
divergencias, y en el chat: «Revisé 6 de 6 documentos. 3 con deriva: 2 literales vencidos y 1 promesa
que la API no cumple. El más grave: API.md dice que la lectura del Anexo de Encargo trae
`contrafirma_evidencia` y la forma no lo traía — eso hacía que el panel mostrara "NO DECLARADA" con la
facultad acreditada.»

**Entrada**: «Corre el drift report sobre `deploy/README-DESPLIEGUE.md`.»

**Salida**: un reporte de un solo documento, con la deriva #3 (el README y el script discrepan sobre
la retención) y la #7 si el README afirma un estado de la VM que ya no es cierto.
