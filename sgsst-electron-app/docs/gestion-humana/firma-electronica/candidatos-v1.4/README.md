# Candidatos v1.4 — NO PUBLICADOS, NO FIRMABLES

> **Lo que hay en esta carpeta son candidatos.** No son el texto vigente, no estan publicados en `legal/` ni
> en `sitio/`, no los sirve el servicio y **no se pueden firmar**. Un texto se firma sobre lo que esta
> publicado; publicar estos candidatos es un acto que no se ha dado.

## Que hay aqui

| Archivo | Bytes | SHA-256 | Que es |
|---|---|---|---|
| `anexo-nube-v1.4.html` | 103 390 | `fae2b26b87867d24d558c948e7f90f886f76d6cf6b3eb39eb19deda4dbd8b416` | Candidato del Anexo de Nube v1.4 (6 anclas de C1 a C7 + 35 determinaciones de L1, L4 y L5) |
| `anexo-encargo-2026-11-12.html` | 97 962 | `7576b1a1dd7f7ded71ac6be7ff556a7041e04538266f199372e4f9c7082d9f3c` | Candidato del Anexo de Encargo del 12-nov-2026 (5 anclas de C1 a C7 + 10 determinaciones de L1, L4 y L5) |

## Que NO se toco

| Documento | Bytes | SHA-256 |
|---|---|---|
| Anexo de Nube v1.3 (vigente, suscrito y contrafirmado el 12-nov-2026) | 85 143 | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` |
| Anexo de Encargo 2026-11-11 (vigente, suscrito y contrafirmado el 12-nov-2026) | 94 923 | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` |

Los dos textos vigentes quedan **intactos**: un texto suscrito no se toca. El manifiesto **no** se modifico con
estos candidatos.

## Como se armaron

En **dos fases**, con `firma-service/scripts/generar-candidatos-v1.4.js`:

1. **Fase 1 — las siete divergencias (C1 a C7)**: los literales ya escritos de
   `../propuesta-v1.4-anexo-nube-2026-11-12.md` (6 anclas en el Nube, 5 en el Encargo).
2. **Fase 2 — las determinaciones legales de la mesa L1 a L7**: el texto literal **se lee de los propios
   documentos de determinacion** (`../dictamen-legal-l1-2026-11-12.md` para L1 y
   `../pedido-6-backblaze-v1-4-2026-11-12.md` para L4 y L5), con el motor de
   `firma-service/scripts/determinaciones-v1.4.js`. **El texto no se transcribe**: lo que esta escrito en la
   determinacion es lo que queda en el candidato, byte a byte. Son 35 cambios en el Nube y 10 en el Encargo.

El script **se niega a escribir** si una ancla no casa **exactamente una vez**: con las 11 de la fase 1 y las
45 de la fase 2 bien, la salida es reproducible.

```powershell
node firma-service/scripts/generar-candidatos-v1.4.js --estado   # solo mide: imprime hashes
node firma-service/scripts/generar-candidatos-v1.4.js             # escribe los candidatos
```

El script **no toca** `legal/`, **no toca** `sitio/` y **no toca** el manifiesto. Por eso los candidatos viven
aqui y no en el paquete de despliegue.

### Lo que cambio con la fase 2 (para el abogado)

- **La fila de Google del §4 tiene ahora ocho celdas** (antes nueve: la novena era un residuo que abria una
  columna que el encabezado no declara), y dice que Google es **Encargado** por la operacion concreta y el vinculo
  contractual, que **Subencargado es figura contractual** y no categoria legal, y que la comunicacion al exterior
  es una **transmision internacional a un Encargado**, **no una transferencia**: por eso **no se activa el
  art. 26** y rigen el art. 24 num. 2 y el art. 25 del Decreto 1377.
- **Se corrigieron doce afirmaciones del expediente** (las del §0 del dictamen): la entidad contractual es
  **Google LLC**, el CDPA **no declara fecha de version** (se identifica por huella) y su fecha de efectividad es
  el **10-nov-2026**, el derecho de auditoria del **§7.5.2(a) no se activa** (esta condicionado a la Ley
  Europea), Estados Unidos es **uno** de los paises posibles, y el CDPA **no fija plazo de 24 h ni de 48 h**.
- **Entro Backblaze, Inc. como subencargado** (fila nueva, con la region del bucket declarada), y el parrafo de
  **Respaldos** del §3 se reescribio entero (la copia fuera del servidor es una **transmision**, no una
  transferencia).
- **Se declararon los actos del 12-nov** (los dos instrumentos anteriores ya suscritos y contrafirmados) y que
  **esta v1.4 no esta suscrita**.
- **La version del Anexo de Encargo se unifico en 2026-11-12** (meta, cabecera, constancia del §12 y remisiones),
  y se corrigio el **C2**, que todavia decia «hasta que el owner decida el destino» cuando el destino ya se
  decidio (Backblaze B2).

Ademas, el agente general aplico **por la misma regla de version** nueve identificaciones que el dictamen no
enumeraba (el titulo, la meta, el §1, el pie y cuatro remisiones que decian «esta version 1.3» cuando el
documento **es** la 1.4). Van marcadas como `ext` en `determinaciones-v1.4.js` y se reportan al abogado: si
alguna no le parece bien, se quita y se vuelve a armar.

## Que falta para que exista una v1.4 de verdad

1. **El abogado revisa y redacta el texto final.** El equipo armo candidatos mecanicos para que el abogado
   revise un texto, no un diff. La redaccion final es del abogado.
2. **El owner decide y suscribe** (ASEPLUS) y **contrafirma** (K+AIR).
3. **El manifiesto se actualiza** con la huella de la v1.4 ya firmada.
4. **La compuerta `FIRMA_EXIGIR_ANEXO_NUBE` se enciende** al final, no antes.

Mientras tanto, el gate **baja a 37 items en `ok`**: es el mismo estado en que estaba la v1.3 antes del
12-nov-2026.

La determinacion completa esta en `../decisiones-de-fondo-2026-11-12.md`, bloque M.18.
