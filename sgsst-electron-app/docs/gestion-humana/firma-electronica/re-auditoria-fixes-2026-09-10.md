# Re-auditoría de los 3 hallazgos — 2026-09-10

**Objetivo**: confirmar que los 3 fixes aplicados cierran realmente los hallazgos de la auditoría inicial.

**Método**: re-correr los mismos queries/tests que encontraron los problemas originalmente, contra el código y la BD post-fixes.

---

## Hallazgo #1: race condition en `start-firma-tunnel.ps1` ✅ CERRADO

### Original
- Script mataba el proceso con `Stop-Process -Force` y esperaba solo 800ms antes de re-arrancar
- En el caso de hoy, el puerto 3001 quedó en TIME_WAIT → EADDRINUSE → script murió con exit 2
- `pasos.log` no se creaba porque la primera llamada a `Paso()` era DESPUÉS del crash

### Fix aplicado
- `Stop-FirmaService` ahora tiene un loop `Wait-PortFree` que espera hasta 10s con `Test-Port3001Free` cada 500ms
- El sleep post-Stop se redujo a 500ms (porque ahora Stop ya esperó)
- `try/catch` alrededor del segundo `Start-FirmaService` con retry automático después de 3s
- `Paso('script:inicio...')` se llama ANTES de `Start-CicloCompleto` (en la línea 257, antes de la invocación en línea 259)
- `pasos.log` se trunca al inicio del script para evitar confusión con runs anteriores

### Validación (Test 1)
```
Test 1a: Paso() antes de la invocación de Start-CicloCompleto
  ✓ OK - "Paso(script:inicio...)" en posición 11133 ANTES de la invocación en posición 11175
Test 1b: Loop Wait-PortFree en Stop-FirmaService
  ✓ OK - loop de espera encontrado
Test 1c: try/catch alrededor del segundo Start-FirmaService
  ✓ OK - try/catch con retry implementado
Test 1d: pasos.log se trunca al inicio
  ✓ OK - truncación al inicio para evitar confusión con runs anteriores
Test 1e: Start-Sleep -Milliseconds 800 eliminado del código activo
  ✓ OK - el sleep de 800ms solo aparece en comentarios, no en código activo
Test 1f: Start-Sleep -Milliseconds 500 presente en código activo
  ✓ OK - sleep de 500ms presente (reemplazo del 800ms)
```

**Estado**: ✅ CERRADO. Las 6 validaciones pasan. Si el script falla de nuevo, `pasos.log` tendrá al menos la línea `script:inicio` con timestamp, permitiendo diagnóstico inmediato.

---

## Hallazgo #2: PDFs originales faltantes en SR hijos de firma dual ✅ CERRADO

### Original
- `createForCompany` (signRequest.js:673) creaba el hijo con `padre.pdf_original_path` como path del hijo
- El archivo en disco NO se duplicaba
- 5 SR hijos en la BD no tenían archivo en `storage/pdfs/originales/`
- Riesgo de auditoría: si el archivo del padre se borraba, el registro del hijo quedaba con path roto

### Fix aplicado
- Después del INSERT del hijo (línea 787), se copia el archivo del padre al path del hijo usando `fs.copyFileSync`
- Se actualiza el registro del hijo con su propio path
- Si la copia falla (permisos, espacio), el create no se aborta — solo se loguea warning (el hash y el path del padre siguen siendo válidos)
- El path del hijo es `originales/{hijo.id_solicitud}.pdf` (patrón consistente con el padre)

### Validación (Test 4)
```
✔ signRequest.createForCompany: crea hijo vinculado al padre
✔ signRequest.createForCompany: falla si el padre no tiene requiere_firma_empresa=1
✔ signRequest.createForCompany: falla si ya existe un hijo (UNIQUE idx_gh_firmas_unico_hijo)
✔ signRequest.createForCompany: copia el PDF original al path del hijo (I-AUDIT-2026-09-10) (11.4889ms)
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

El test 4 valida:
1. Path del hijo es DISTINTO al del padre (`notStrictEqual`)
2. Path del hijo es `originales/{hijo.id_solicitud}.pdf` (patrón esperado)
3. El archivo del hijo existe en disco (`fs.existsSync`)
4. El contenido es IDÉNTICO al del padre (`equals` byte-a-byte)

**Estado**: ✅ CERRADO. Los nuevos SR hijos tendrán su propio archivo. Los 5 legacy quedan con path del padre (esperado, no se puede copiar retroactivamente sin re-emitir el SR).

---

## Hallazgo #3: Sin rate limit específico en `/verify` y `/verify-pdf` ✅ CERRADO

### Original
- Las rutas `/api/sign/:token/verify` y `/api/sign/:token/verify-pdf` solo dependían del `globalLimiter` (60 req/min por IP)
- Un atacante podía enumerar tokens a 60 req/min y hacer DoS enviando PDFs grandes a 60 PDFs/min

### Fix aplicado
- Nuevo `verifyLimiter` en `middleware/rateLimit.js` con key por IP+token (no solo IP)
- Límite: 30 req/min por IP+token (anti-enumeración + anti-DoS)
- Aplicado a las 2 rutas en `routes/public.js`
- Exportado y testeado

### Validación (Test 3)
```
Test 3: rate limiter 30/min por IP+token
Esperado: 30 requests con 200, después 429

req# 1-30: status=200 policy=30 remaining=29..0
req#31-35: status=429 policy=30 remaining=0

Resumen:
  200 OK: 30
  429 rate limited: 5
```

El test 3 confirma:
- Primer request: 200, `RateLimit: limit=30, remaining=29, reset=60`
- Request 30: 200, `remaining=0`
- Request 31+: 429 con `RATE_LIMIT_EXCEEDED` y código `limiter: verify`

**Estado**: ✅ CERRADO. Headers IETF draft-7 retornados correctamente, error uniforme con el resto del servicio.

---

## Resumen de tests (totales)

| Test | Resultado |
|---|---|
| Test 1: script syntax + pasos.log | 6/6 OK |
| Test 2: verify-pdf con PDF real | 1/1 OK (200 + headers) |
| Test 3: rate limiter dispara 429 en req #31 | OK (30×200 + 5×429) |
| Test 4: createForCompany copia PDF | 4/4 OK (3 originales + 1 nuevo) |
| Test 5: suite verify endpoint | 14/14 OK (sin regresiones) |
| **Total** | **25/25 OK** |

---

## Conclusión

Los 3 hallazgos de la auditoría inicial están **CERRADOS y validados con tests automatizados**. El sistema está más robusto:

1. **#1**: si el script vuelve a fallar, habrá un log para diagnosticar
2. **#2**: trazabilidad por firmante para auditoría legal
3. **#3**: defensa contra enumeración de tokens y DoS con PDFs

No se detectaron regresiones en los tests existentes (14/14 del verify endpoint siguen pasando).
