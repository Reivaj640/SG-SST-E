# Candidatos v1.4 — PUBLICADOS el 14-nov-2026

> **Lo que hay en esta carpeta son los candidatos que se publicaron.** El 14-nov-2026 el owner dio el acto
> expreso de publicarlos: el Anexo de Nube v1.4 y el Anexo de Encargo 2026-11-12 quedaron vigentes en
> `legal/` y en `sitio/`. La carpeta queda como el **registro de cómo se armaron**. **Todavía no están
> firmados**: los dos actos (la suscripción de la Empresa y la contrafirma de K+AIR) son pendientes, y el
> manifiesto los declara no firmados, como es.

## Que hay aqui

| Archivo | Bytes | SHA-256 | Que es |
|---|---|---|---|
| `anexo-nube-v1.4.html` | 111 462 | `57983e54ffd2caa835060c58c89fcde226bc4d84df17eacadd55f1d0f6c392a4` | Texto vigente del Anexo de Nube v1.4 (6 anclas de C1 a C7 + 39 determinaciones de L1, L4 y L5 + la etiqueta de versión de la cabecera) |
| `anexo-encargo-2026-11-12.html` | 100 787 | `55a58967b3bb081bcee5f72d15b50b4b3141691418a9b8338df9db738b646fc9` | Candidato del Anexo de Encargo del 12-nov-2026 (5 anclas de C1 a C7 + 11 determinaciones de L1, L4 y L5 + 3 anclas de la regla de la compuerta + 2 anclas del acto de apertura) |

**El texto vigente del Anexo de Encargo no es byte a byte este candidato.** Es el candidato con la
**etiqueta de versión normalizada** por `scripts/generar-anexo-encargo.js`, que la escribe desde
`config/matriz-finalidades.json` (el encabezado, la línea de fecha y el pie): el pie del candidato quedó en
11-nov-2026 y el del texto vigente es 12-nov-2026. **Esa es la única diferencia**, y hay un guard que la
mide entera (`generar-candidatos-v1.4.test.js`): el texto vigente es
`a3014202ed812f532d9dada5b4ea99d954a146c898ba94e29db739209f96aa50` (100 787 B).

## Que NO se toco

| Documento | Bytes | SHA-256 |
|---|---|---|
| Anexo de Nube v1.3 (suscrito y contrafirmado el 12-nov-2026) | 85 143 | `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d` |
| Anexo de Encargo 2026-11-11 (suscrito y contrafirmado el 12-nov-2026) | 94 923 | `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948` |

Los dos textos ya suscritos quedan **intactos**: un texto suscrito no se toca. El que era vigente (la
2026-11-11) se conservó aparte, en `legal/anexo-encargo-2026-11-11.html` y en `sitio/`, con su huella. El
manifiesto los declara en `versiones_firmadas`, con su evidencia y su contrafirma: la bitácora es
append-only.

## Como se armaron

En **cuatro fases**, con `firma-service/scripts/generar-candidatos-v1.4.js`:

1. **Fase 1 — las siete divergencias (C1 a C7)**: los literales ya escritos de
   `../propuesta-v1.4-anexo-nube-2026-11-12.md` (6 anclas en el Nube, 5 en el Encargo).
2. **Fase 2 — las determinaciones legales de la mesa L1 a L7**: el texto literal **se lee de los propios
   documentos de determinacion** (`../dictamen-legal-l1-2026-11-12.md` para L1 y
   `../pedido-6-backblaze-v1-4-2026-11-12.md` para L4 y L5), con el motor de
   `firma-service/scripts/determinaciones-v1.4.js`. **El texto no se transcribe**: lo que esta escrito en la
   determinacion es lo que queda en el candidato, byte a byte. Son 39 cambios en el Nube y 11 en el Encargo.
3. **Fase 3 — la regla de la compuerta de la tabla supletoria** (decision del owner del 13-nov-2026): tres
   anclas literales en el Anexo de Encargo, que es donde esta la tabla del §8.
4. **Fase 4 — el acto de apertura de esa compuerta** (S-25, el 13-nov-2026): dos anclas literales mas en el
   Anexo de Encargo. Dos frases del texto firmado dejaron de ser ciertas: la una porque la compuerta ya no
   esta cerrada, y la otra («el Acuerdo que describe este mecanismo no esta aprobado ni publicado») porque
   el Acuerdo vigente es la v1.6, publicada y activa desde el 11-nov-2026. El texto firmado **no se toca**.
   El Anexo de Nube **no se mueve** en ninguna de las dos ultimas fases.

El script **se niega a escribir** si una ancla no casa **exactamente una vez**: con las 11 de la fase 1, las
50 de la fase 2, las 3 de la fase 3 y las 2 de la fase 4 bien, la salida es reproducible.

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

**El 14-nov-2026 se corrigieron tres mas (`EXT-15`, `EXT-17` y `EXT-35`), y el motivo es que el documento se
contradecia en su propia cara:** el titulo, la meta y el pie de la v1.4 decian 1.4 y 12-nov-2026, pero el
subtitulo de la cabecera y la linea de fecha de la pagina seguian diciendo **1.3** y **11-nov-2026**. Una
Empresa que lee «Version 1.3» en la cabecera de un texto que el manifiesto declara como v1.4 firma un texto
que el manifiesto no describe. La fecha que se puso es la del pie (12-nov-2026), que el agente general si
habia actualizado. Con esas tres, la huella del Anexo de Nube v1.4 paso de
`ba664e6f…e3b47` a `57983e54…392a4`.

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

## Que falta ahora

1. **La Empresa se suscribe** al texto v1.4 (ASEPLUS) y **K+AIR contrafirma**. El manifiesto ya declara la
   huella nueva y los dos textos como no firmados, que es lo que corresponde mientras los dos actos no
   ocurran.
2. **El manifiesto se actualiza** con la evidencia de esos dos actos (lo escriben los scripts que leen la
   base).
3. **La compuerta `FIRMA_EXIGIR_ANEXO_NUBE` sigue encendida**: ya lo estaba desde el 13-nov-2026 y este
   acto no la apaga.

El owner dio el acto expreso de publicar (14-nov-2026) y el texto que se firma es el de esta carpeta, con la
etiqueta de versión normalizada por el generador. La revisión jurídica del expediente ya está en el
dictamen de L1 y en el pedido 6; la redacción final la hizo K+AIR con la autorización del owner.

La determinacion completa esta en `../decisiones-de-fondo-2026-11-12.md`, bloque M.18.
