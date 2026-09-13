---
name: silent-failure-hunter
description: Hunt for silent failures and deficient error handling — empty catch blocks, swallowed exceptions, bare try/catch without reporting, fallbacks that hide errors, and unhandled promise rejections. Use after writing try-catch blocks, fallbacks, retries, or validation paths.
license: MIT
---

# Silent Failure Hunter

Find and eliminate errors that fail without anyone noticing. A silent failure is
any code path where something goes wrong but the system keeps running as if
nothing happened — no log, no message, no visible result change. These are the
most dangerous bugs in a production enterprise app because they corrupt data and
erode trust without warning.

## When to use this skill

- After writing or editing any `try/catch`, `try/except`, `.catch()`, `finally`, or `onerror` handler
- After adding a fallback, default value, or retry path
- After a validation, parse, decode, or IPC boundary
- Before committing code that touches a contract (frontend ↔ backend) or a data sink

## Phase 1: Scan for the classic patterns

For each changed or nearby file, flag these smells:

1. **Empty catch** — `catch (e) {}` with no logging, no rethrow, no fallback signal
2. **Swallowed exception** — `catch (e) { return; }` or `return null` that discards the error and lets the caller assume success
3. **Generic catch that hides the cause** — `catch (e) { showError('Something failed') }` with no error code, no context, no inner message
4. **Fallback that masks failure** — `value ?? defaultValue` or `res || safeDefault` that silently substitutes a value when the real one failed to load
5. **Unhandled promise rejection** — `async` calls without `await` + `try/catch`, or `.then()` chains without `.catch()`
6. **Catch that logs but continues as success** — logging `console.log` then proceeding as if the operation worked
7. **Validation that fails open** — a guard that returns `true`/`undefined` on error instead of blocking
8. **IPC boundary leak** — backend returning a raw error string or stack to the renderer; renderer swallowing a non-`success` response

## Phase 2: Classify severity

- **CRITICAL**: data corruption, money/record loss, audit trail gap, or security bypass that happens silently
- **HIGH**: user-facing feature silently does nothing or shows stale data
- **MEDIUM**: degraded behavior with no signal to operator (logs or toast)
- **LOW**: cosmetic or unlikely path with weak observability

## Phase 3: Fix with the K+AIR contract shape

Every fixed path must produce a typed, observable result. For backend IPC:

```js
// BEFORE — silent
try { const r = JSON.parse(payload); return r; }
catch (e) { return {}; }

// AFTER — observable, typed, standard contract
try {
  const r = JSON.parse(payload);
  return { success: true, data: r };
} catch (e) {
  return {
    success: false,
    error: { code: 'PARSE_FAILED', message: 'Invalid payload: ' + e.message }
  };
}
```

Rules the fix must honor:

- Never throw raw errors to the renderer; always return the standard `{ success, data?, error? }` shape
- Never expose internal stack traces or file paths to the UI
- Always log structured: `[K+AIRSST][MODULE][ACTION][FAIL]` with error code + context
- Re-throw or surface ONLY when the caller can act; otherwise return a typed failure the caller checks with `if (res.success)`
- Empty catch is only acceptable when the failure is genuinely irrelevant AND documented with a `// why ignored` comment

## Phase 4: Report

Summarize each finding as: `file:line — pattern — severity — fix applied (or skipped + reason)`.
Do not over-fix: if a swallowed error is intentional and safe, note it and move on. Preserve
stability and backward compatibility — never change a contract's field names or types.
