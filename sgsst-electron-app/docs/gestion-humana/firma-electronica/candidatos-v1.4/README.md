# Candidatos v1.4 — NO PUBLICADOS, NO FIRMABLES

> **Lo que hay en esta carpeta son candidatos.** No son el texto vigente, no estan publicados en `legal/` ni
> en `sitio/`, no los sirve el servicio y **no se pueden firmar**. Un texto se firma sobre lo que esta
> publicado; publicar estos candidatos es un acto que no se ha dado.

## Que hay aqui

| Archivo | Bytes | SHA-256 | Que es |
|---|---|---|---|
| `anexo-nube-v1.4.html` | 85 494 | `895d0d0b163ae7b207a96b775727146038285b7c1e76d9f65012369959d3fe39` | Candidato del Anexo de Nube v1.4 (6 anclas aplicadas) |
| `anexo-encargo-2026-11-12.html` | 95 118 | `2afb0e6877f8983604f4ac6fa9f4685ec69d5fd98f7d92e30dc26ba4f117af1c` | Candidato del Anexo de Encargo del 12-nov-2026 (5 anclas aplicadas) |

## Que NO se toco

| Documento | Bytes | SHA-256 |
|---|---|---|
| Anexo de Nube v1.3 (vigente, suscrito y contrafirmado el 12-nov-2026) | 85 143 | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` |
| Anexo de Encargo 2026-11-11 (vigente, suscrito y contrafirmado el 12-nov-2026) | 94 923 | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` |

Los dos textos vigentes quedan **intactos**: un texto suscrito no se toca. El manifiesto **no** se modifico con
estos candidatos.

## Como se armaron

Con `firma-service/scripts/generar-candidatos-v1.4.js`, que aplica los literales ya escritos de
`../propuesta-v1.4-anexo-nube-2026-11-12.md` (6 anclas en el Nube, 5 en el Encargo). El script **se niega a
escribir** si una ancla no casa **exactamente una vez**: con las 11 bien, la salida es reproducible.

```powershell
node firma-service/scripts/generar-candidatos-v1.4.js --estado   # solo mide: imprime hashes
node firma-service/scripts/generar-candidatos-v1.4.js             # escribe los candidatos
```

El script **no toca** `legal/`, **no toca** `sitio/` y **no toca** el manifiesto. Por eso los candidatos viven
aqui y no en el paquete de despliegue.

## Que falta para que exista una v1.4 de verdad

1. **El abogado revisa y redacta el texto final.** El equipo armo candidatos mecanicos para que el abogado
   revise un texto, no un diff. La redaccion final es del abogado.
2. **El owner decide y suscribe** (ASEPLUS) y **contrafirma** (K+AIR).
3. **El manifiesto se actualiza** con la huella de la v1.4 ya firmada.
4. **La compuerta `FIRMA_EXIGIR_ANEXO_NUBE` se enciende** al final, no antes.

Mientras tanto, el gate **baja a 37 items en `ok`**: es el mismo estado en que estaba la v1.3 antes del
12-nov-2026.

La determinacion completa esta en `../decisiones-de-fondo-2026-11-12.md`, bloque M.18.
