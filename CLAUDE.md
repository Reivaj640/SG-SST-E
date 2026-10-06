# K+AIR — Arranque

> Este archivo es **puerta de entrada**. No contiene reglas: apunta a las que importan.
> Si tu herramienta lee otro nombre (`AGENTS.md`, `.cursorrules`, `GEMINI.md`), apunta a los
> mismos dos archivos.

## Orden de lectura obligatorio

1. **`PROMPT.md`** (raíz del repo) — elprompt operacional. Dice qué es K+AIR, cómo se trabaja
   aquí, las trampas activas y qué documento leer para cada tarea.
2. **`Historial.md`** (raíz del repo) — **dónde quedó el trabajo y qué falta.** Leelo antes de
   arrancar: ahí está el estado de cierre de la última jornada y la cola acordada.

Con eso dos ya tenés el contexto completo. No hace falta leer los demás antes de empezar.

## Antes de tocar código

| Vas a… | Leé además |
|---|---|
| Tocar una vista o un componente | `sgsst-electron-app/design_system.md` |
| Entender por qué el código es como es | `sgsst-electron-app/AGENTS.md` (buscá con grep, son 4 800+ líneas) |
| Escribir un test | `PROMPT.md` §7 |
| Afirmar que algo es una regla del proyecto | `PROMPT.md` **§5.9** — verificar contra el código |
| Cambiar un bridge o la base de datos | `PROMPT.md` §6 |
| Cambiar CSS, colores o tipografía | `PROMPT.md` §4 — **hay tres islas de paleta** |

## Tres reglas que rompen cosas si no las respetás

1. **Nada de commit sin la palabra correcta.** "ok procede" autoriza editar, **no** commitear.
   "dale" / "OK" / "commit" autorizan commit, **no** push. Solo "pushea" autoriza push.
2. **Cero presunciones: nada es una regla hasta contrastarlo con el código.** Un documento que diga
   "usá `KairUI.esc()`" NO es evidencia de que exista: en este repo esas dos funciones estaban
   documentadas y **no existen**. Grepeá antes de afirmar o de aplicar. Ver `PROMPT.md` §5.9.
3. **El EOL de cada archivo está fijado por su test.** Cambiarlo rompe el diff entero.
4. **Prohibido CJK, cirílico y hangul** en código y documentación. Se cuelan por las rutas.

## Antes de cerrar

**Preguntá al owner:** "¿Querés que actualice los documentos para la próxima jornada?"
Sin esa pregunta no se cierra la sesión. Ver `Historial.md` §Regla de cierre.
