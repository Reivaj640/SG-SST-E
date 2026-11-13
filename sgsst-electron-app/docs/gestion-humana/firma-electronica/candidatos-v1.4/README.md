# Candidatos v1.4 — NO PUBLICADOS, NO FIRMABLES

> **Lo que hay en esta carpeta son candidatos.** No son el texto vigente, no estan publicados en `legal/` ni
> en `sitio/`, no los sirve el servicio y **no se pueden firmar**. Un texto se firma sobre lo que esta
> publicado; publicar estos candidatos es un acto que no se ha dado.

## Que hay aqui

| Archivo | Bytes | SHA-256 | Que es |
|---|---|---|---|
| `anexo-nube-v1.4.html` | 111 462 | `ba664e6f1ad130c968b6224ab71ed66a52017e96ac578b8b0e740fd55f9e3b47` | Candidato del Anexo de Nube v1.4 (6 anclas de C1 a C7 + 39 determinaciones de L1, L4 y L5) |
| `anexo-encargo-2026-11-12.html` | 100 396 | `b345ab87a816eddb98bf79c30be6de38d9d1fbe90f2682c89d8e7560bbe3a749` | Candidato del Anexo de Encargo del 12-nov-2026 (5 anclas de C1 a C7 + 11 determinaciones de L1, L4 y L5 + 4 anclas de la regla de la compuerta) |

## Que NO se toco

| Documento | Bytes | SHA-256 |
|---|---|---|
| Anexo de Nube v1.3 (vigente, suscrito y contrafirmado el 12-nov-2026) | 85 143 | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` |
| Anexo de Encargo 2026-11-11 (vigente, suscrito y contrafirmado el 12-nov-2026) | 94 923 | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` |

Los dos textos vigentes quedan **intactos**: un texto suscrito no se toca. El manifiesto **no** se modifico con
estos candidatos.

## Como se armaron

En **tres fases**, con `firma-service/scripts/generar-candidatos-v1.4.js`:

1. **Fase 1 — las siete divergencias (C1 a C7)**: los literales ya escritos de
   `../propuesta-v1.4-anexo-nube-2026-11-12.md` (6 anclas en el Nube, 5 en el Encargo).
2. **Fase 2 — las determinaciones legales de la mesa L1 a L7**: el texto literal **se lee de los propios
   documentos de determinacion** (`../dictamen-legal-l1-2026-11-12.md` para L1 y
   `../pedido-6-backblaze-v1-4-2026-11-12.md` para L4 y L5), con el motor de
   `firma-service/scripts/determinaciones-v1.4.js`. **El texto no se transcribe**: lo que esta escrito en la
   determinacion es lo que queda en el candidato, byte a byte. Son 39 cambios en el Nube y 11 en el Encargo.
3. **Fase 3 — la regla de la compuerta de la tabla supletoria** (decision del owner del 13-nov-2026): cuatro
   anclas literales en el Anexo de Encargo, que es donde esta la tabla del §8. El Anexo de Nube **no se mueve**.

El script **se niega a escribir** si una ancla no casa **exactamente una vez**: con las 11 de la fase 1, las
50 de la fase 2 y las 4 de la fase 3 bien, la salida es reproducible.

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

**Lo que cambio el 13-nov-2026 (escrito del abogado matriculado).** La seccion **B.8** del dictamen de L1
aplico al texto lo que el abogado escribio (que es **no formal**: sin nombre, sin fecha de suscripcion y sin
huella): el Titulo V y la lista de paises con nivel adecuado **dejan de ser fundamento** (son marco sectorial
de referencia y **no verificados**), la **region US del bucket es decision conservadora de K+AIR** y no una
exigencia legal, la **transferencia del software a la Empresa si cae en el supuesto (ii)** de la Circular
002 de 2025, y los **hechos contractuales del CDPA** quedan **pendientes de confirmacion contra el
contrato**. La redaccion final la hizo K+AIR con la autorizacion del owner.

**Lo que cambio con la fase 3 (13-nov-2026, decision del owner).** La **validacion escrita de un tercero
dejo de ser requisito** para abrir la compuerta de la tabla supletoria: la abre un acto expreso y
**fechado** de K+AIR. El texto firmado del Anexo de Encargo (el del 11-jun-2026, que **no se toca**) decia
en su §8 que la tabla «existe una vez validada y activada» y que «los plazos que esta tabla declara como
supletorios estan sujetos a la validacion juridica pendiente»: ese texto ya no describia la regla
vigente. Como el v1.4 es un texto **nuevo**, las dos frases se corrigen **en el candidato**, por ancla
literal, y el §8 pasa a decir que la apertura es un acto expreso y fechado de K+AIR, que los plazos no
dependen de una validacion de un tercero y que el numeral 8.6(a) del Acuerdo exige fundamento y punto de
inicio (que la tabla declara en sus ocho categorias). El §8 **sigue** publicando la fecha de la
**tabla** (31 de octubre de 2026): los plazos no cambiaron, y esa fecha esta en el texto firmado del
11-jun-2026 (moverla haria que el generador reescribiera el anexo firmado). La fecha de la **regla** va en
su propio campo del config (`regla_de_apertura_actualizada_at`). El Anexo de Nube **no cambio de bytes**:
`ba664e6f…e3b47`.

**El invariante que el motor sostiene.** El candidato tiene que ser **byte a byte** el literal de la
determinacion: si el motor reescribiera el literal por su cuenta, el texto que se firma no seria el texto
que se aprobo. Hay dos guards que lo vigilan (`generar-candidatos-v1.4.test.js`): el de identidad byte a
byte y el que prohibe que un fragmento toque el literal de una determinacion.

## Que falta para que exista una v1.4 de verdad

1. **El abogado revisa y redacta el texto final.** El equipo armo candidatos mecanicos para que el abogado
   revise un texto, no un diff. La redaccion final es del abogado.
2. **El owner decide y suscribe** (ASEPLUS) y **contrafirma** (K+AIR).
3. **El manifiesto se actualiza** con la huella de la v1.4 ya firmada.
4. **La compuerta `FIRMA_EXIGIR_ANEXO_NUBE` se enciende** al final, no antes.

Mientras tanto, el gate **baja a 37 items en `ok`**: es el mismo estado en que estaba la v1.3 antes del
12-nov-2026.

La determinacion completa esta en `../decisiones-de-fondo-2026-11-12.md`, bloque M.18.
