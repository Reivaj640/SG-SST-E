# Adaptación: `egm-drift-report` de google/elephant-goldfish-model

Este archivo es la **procedencia** de la skill. Si algún día se cuestiona de dónde salió
`SKILL.md`, la respuesta está acá y no en la memoria de nadie.

## 1. Origen

| Dato | Valor |
|---|---|
| Proyecto | **google/elephant-goldfish-model** (EGM, "Elephant-Goldfish Model") |
| URL | https://github.com/google/elephant-goldfish-model |
| Sitio del proyecto | https://egm.dev |
| Archivo de origen | `skills/egm-drift-report/SKILL.md` |
| Licencia | **Apache License 2.0** (el `LICENSE` del repo es el texto estándar; el proyecto **no** trae archivo `NOTICE`) |
| Consulta | 2026-11-11 — `SKILL.md` de 3 169 bytes, `sha256` `c000ffe2e77a9fe74ee6915b314e1547337c95c79a19014c44fd976dc6511476` |

EGM es un plugin de **desarrollo guiado por especificación** para asistentes de IA (harnesses:
Antigravity, Claude Code, Codex, ChatGPT Work, Muse). `egm-drift-report` es una de sus siete
skills: la que compara documentos de diseño contra el código y produce un reporte de diferencias.

> **EGM no es un modelo de IA.** Es un flujo de trabajo con skills, prompts y revisores. El
> "elephant" mantiene el contexto y redacta la especificación; el "goldfish" la revisa sin el
> contexto previo. Lo único que se portó de ahí fue la disciplina de comparar documento contra
> código y **reportar solo las diferencias**.

## 2. Qué se conservó del original

La columna vertebral del método es idéntica y sí es de EGM:

1. **Contextualizar** — leer el documento y anotar qué afirmaciones hace.
2. **Localizar la fuente** — encontrar el archivo del código que la sostiene; si no existe, eso
   **es** una deriva reportable.
3. **Verificar** — leer el estado **actual** de ese archivo. El original lo dice literal:
   *"Read files liberally to ensure you are looking at the current state of the code, not relying on
   memory."* En este repo eso es la regla de oro de `PROMPT.md` §5.9.
4. **Detectar** — comparar diseño contra realidad.
5. **Filtrar** — *"Report ONLY the differences. Do not describe what is working or what matches."*
   Si coinciden: `No drift detected`.
6. **Procesar secuencialmente** — el original lo pide para que el búfer de salida no desborde.

También se conservó el **formato estricto** del reporte: una sección `## <NOMBRE_DEL_DOCUMENTO>`
por documento, con la lista de divergencias o `No drift detected`.

## 3. Qué se cambió, y por qué

| # | Cambio | Por qué |
|---|---|---|
| 1 | Frontmatter reescrito: se quitó `license: Apache-2.0` y `disable-model-invocation: true` | El contrato de frontmatter de Mavis prohíbe la clave `license` y no reconoce `disable-model-invocation`. La licencia y la atribución quedan en el comentario HTML del `SKILL.md` y en este archivo. |
| 2 | `description` en español con disparadores del repo ("verificar si los documentos siguen siendo ciertos", "detectar deriva", "revisar que el doc y el código digan lo mismo") | Es la única puerta de entrada del skill: el agente decide cargarlo leyendo esta línea. |
| 3 | Se quitó el párrafo de ruteo por harness (`read [Codex integration]`, `${CLAUDE_PLUGIN_ROOT}/docs/claude.md`) | EGM esos archivos existen en sus harnesses; acá no. Referenciarlos sería una promesa que el repo no cumple. |
| 4 | La taxonomía de derivas pasó de 4 categorías genéricas (*Missing Features, Incomplete Models, Logic Shortcuts, Architectural Divergence*) a **7 derivas propias de este repo** | Las cuatro del original describen derivas de una especificación de software: faltan features, faltan campos de un modelo, hay un valor cableado, hay otra arquitectura. Acá el problema es de otra clase: documentos que prometieron cosas que el código ya no hace. |
| 5 | La salida pasó de `{YYYY-MM-DD}_DRIFT_REPORT.md` en el directorio de trabajo a `tmp/DRIFT/<fecha>_DRIFT_REPORT.md` | `tmp/` está en `.gitignore`: un reporte de deriva no debe ensuciar el árbol ni entrar a un commit por accidente. En la raíz del repo, no. |
| 6 | Se agregó "Inputs to collect" (directorio, alcance, destino) | El original da por hecho que hay un directorio. Acá hay varios candidatos y el skill tiene que preguntar cuál, no barrer todo. |
| 7 | El reporte exige **referencia de línea en ambos lados** (la del documento y la del código) | Sin el "dónde", la deriva no se puede arreglar. Es la diferencia entre un informe y un chisme. |
| 8 | Se agregó el **resumen en el chat** (cuántos documentos, cuántas derivas, las tres de mayor impacto) | El original solo escribe el archivo. El chat es donde el owner decide. |
| 9 | Se agregó `Failure handling` | Directorio inexistente, código no encontrado, documento gigante, afirmación externa no verificable. El último caso importa: lo que no se puede verificar **no** es deriva. |
| 10 | Se agregó la sección "Reglas de este repo que el reporte tiene que respetar" | El reporte se lee en un repo con reglas duras: nada es regla hasta contrastarlo con el código (`PROMPT.md` §5.9), los literales fijados son bombas de tiempo (trampa 28), el gate no puede dar verde sin lo que el documento promete. |
| 11 | Se quitó "Prompt the user to add missing links to the document" | Acá los documentos del expediente **no se tocan**: el skill informa y la decisión de corregir es del owner. |
| 12 | Se quitó "If not provided, ask the user to specify the target directory" → el método quedó en "preguntá cuál antes de empezar" | Mismo sentido, pero el original lo pide en un solo paso; acá hay un directorio por defecto y la pregunta es explícita. |

## 4. Las 7 derivas (las que gobiernan el reporte)

| # | Deriva | Origen en el repo |
|---|---|---|
| 1 | Afirmación que el código no tiene | Regla de oro: un doc puede afirmar cualquier cosa |
| 2 | Comportamiento que el doc no menciona | El 📦1047 añadió `contrafirma_facultad` al manifiesto y no a todas las tablas |
| 3 | Literal vencido | Trampa 28: `mtime +14` vs. `mtime +$RETENCION_DIAS`; los checks que fijan `?v=` se rompen en el próximo bumpeo |
| 4 | Ruta o archivo que no existe | El doc nombra un script que se movió |
| 5 | Versión o hash que ya no es el vigente | `PROMPT.md` §5.19: la versión sale del dato, nunca de memoria |
| 6 | Promesa que la forma no cumple | **La más cara**: produce falsos negativos. El panel pintaba "NO DECLARADA" con la faculty acreditada porque la lectura no traía `contrafirma_evidencia` |
| 7 | Estado del mundo que cambió | Producción, despliegues, cuentas, certificados |

La deriva #6 es la que justificó este skill: es la que un humano no ve (la pantalla muestra un
"NO" verosímil) y la que un test de(documento contra código) tampoco ve (el test compara el
documento con el código, no con la forma real que consume la vista).

## 5. Lo que NO se hizo

- **No se tradujo literal.** Una traducción literal habría producido un skill genérico que
  describe derivas que este repo no tiene. El port es una adaptación: mismo método, derivas reales.
- **No se copiaron scripts ni "personas" (revisores).** El `egm-drift-report` original no tiene
  scripts ni revisores asociados: solo instrucciones. Ese es el motivo por el cual este port es
  un `SKILL.md` de un solo archivo más este apéndice.
- **No se tocó `skills-lock.json`.** Ese lockfile registra las skills instaladas desde packs
  externos con un `computedHash` cuyo algoritmo **no se pudo reproducir** en este repo: se probaron
  el SHA-256 del archivo local (LF y CRLF), el del archivo upstream, el normalizado sin BOM, el de
  la carpeta y el de la carpeta con nombres, y ninguno coincide con los valores del lock para
  `doubt-driven-development`, `interview-me` ni `constraint-driven-development`. **Escribir un hash
  inventado sería una mentira de integridad**, así que la procedencia queda declarada acá y en
  `sgsst-electron-app/AGENTS.md`. Si el lock se regenera con la herramienta que lo produjo, esta
  skill debe entrar con `source: google/elephant-goldfish-model` y
  `skillPath: skills/egm-drift-report/SKILL.md`.
- **No se tocó ningún documento del expediente.** El skill produce un informe; corregir es otro
  paso y otro permiso.

## 6. Licencia y atribución

El trabajo de EGM está bajo Apache-2.0. Este archivo derivado se distribuye bajo la misma licencia
y conserva la atribución: el `SKILL.md` lleva un comentario HTML con la fuente y la licencia, y
este apéndice repite la procedencia completa. No se usa ninguna marca de Google ni de EGM: el
nombre `egm-drift-report` se conserva porque identifica el origen del método.
