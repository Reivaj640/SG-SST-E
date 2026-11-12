# Registro de cierre del checklist de 96 requisitos

**Que es este documento.** El «registro de cierre» que pide el §5 (Fase 5) del
`plan-cierre-abogado-2026-10-31.txt`: version, hashes, commit, resultados de T1 a T9, decisiones A, B
y C, fecha y responsable.

**Que NO es, desde el 5-nov-2026.** Este registro **no es condicion de produccion**. El plan lo dice
expresamente (§5, linea 91 y actualizacion de la linea 5, decision (a) del owner): «su ausencia no
bloquea la publicacion ni la activacion. Lo que bloquea es que falte la evidencia a la que el
registro apunta (T4, T6, T7, T8 y T9)». Y las actas de cierre tampoco: **la firma de un acta no es
lo que verifica nada**. Por eso este registro se escribe con evidencia registrada —salidas
verificables, fechadas y atribuidas— y no con firmas.

**Fecha.** 12-nov-2026, 19:57Z (hora de Colombia: 14:57).
**Responsable.** Equipo de K+AIR. Actos de voluntad que faltan: Javier Robles Fontalvo, owner y
representante legal de Gesstiar S.A.S.

---

## 1. Identificacion

| Dato | Valor |
|---|---|
| Commit | `264d08df` (📦1052), identico a `origin/Dev` |
| Acuerdo vigente | v1.6, sha256 `08e1eb8b09449fbc57eebdda89518482b0063285d2f0f56ed335d2977532f13e`, 75 961 B, vigencia 11-nov-2026 |
| Anexo de Nube vigente | v1.3, sha256 `fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d`, 85 143 B, suscrito y contrafirmado el 12-nov-2026 |
| Anexo de Encargo vigente | 2026-11-11, sha256 `6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948`, 94 923 B, suscrito y contrafirmado el 12-nov-2026 |
| Manifiesto `legal-readiness.json` | sha256 `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f` — **byte a byte igual** entre el repositorio y produccion |
| Nodo del servicio | `kair-firma`, `active` / `enabled`, `NRestarts: 0` |
| Node del servidor | v20.20.2 (el repositorio corre con Node 22) |

## 2. Estado del checklist de 96 requisitos

**76 cerrados · 20 pendientes · 96.** `PARCIALMENTE` cuenta como pendiente: no esta cerrado.

| Seccion | Cerrados | Pendientes | Total |
|---|---|---|---|
| 1. Integridad y control documental | 7 | 2 | 9 |
| 2. Decisiones de contenido y proteccion de datos | 9 | 3 | 12 |
| 3. Conservacion, retencion y supresion | 11 | 2 | 13 |
| 4. Seguridad y funcionamiento del flujo de firma | 14 | 0 | 14 |
| 5. Seguridad del correo electronico | 9 | 2 | 11 |
| 6. Correspondencia entre Acuerdo y codigo | 11 | 1 | 12 |
| 7. Produccion y despliegue | 8 | 7 | 15 |
| 8. Constancia y cierre formal | 7 | 3 | 10 |
| **TOTAL** | **76** | **20** | **96** |

La tabla la regenera `firma-service/scripts/contar-estados-checklist.js` a partir del conteo real de
los estados del documento, y el script falla si el documento no cuadra consigo mismo.

**Los dos que se cerraron en esta misma ronda:** el `7.13` (el resultado de la comprobacion del
servidor quedo registrado en `MIGRACION-SERVIDOR-FIRMA.md` §5.1.4, con las actas completas en
`acta-comprobacion-servidor-2026-11-12.md` y `acta-despliegue-2026-11-12.md`) y el `8.10` (el
registro de cierre que es este documento, mas la `BITACORA.md` y el `CONTEXT.md` al dia). Eran los dos
ultimos huecos de la seccion 7 y de la seccion 8.

### Los 20 pendientes, con su dueño

| ID | Estado | Que falta | Quien |
|---|---|---|---|
| 1.2 | PENDIENTE | Resolver la discrepancia entre la copia recibida y el manifiesto anterior | Equipo |
| 1.9 | PARCIALMENTE | Los dos anexos suscritos contradicen la realidad: hace falta una version nueva (v1.4) | Owner + abogado |
| 2.7 | PARCIALMENTE | Decision escrita sobre Google LLC y la cuenta Gmail de consumo | Abogado |
| 2.8 | PARCIALMENTE | Alcance de la Circular Externa 002 de 2025 | Abogado |
| 2.9 | PENDIENTE | Obligacion de inscripcion en el RNBD o excepcion aplicable | Abogado |
| 3.1 | PENDIENTE | Validacion juridica de la tabla supletoria de conservacion | Abogado |
| 3.2 | PARCIALMENTE | Plazos generales de 10 y 5 anos | Abogado |
| 5.5 | PENDIENTE | Acreditar la activacion de MFA | Owner |
| 5.6 | PARCIALMENTE | Acreditar el uso de contrasena de aplicacion | Owner |
| 6.11 | PARCIALMENTE | Bateria completa de pruebas del servicio | Equipo (en curso) |
| 7.1 | PARCIALMENTE | Version exacta del codigo que se va a desplegar | Equipo (medido el 12-nov) |
| 7.5 | PENDIENTE | Estado de la base de datos y sus respaldos | Owner (destino del respaldo off-site) |
| 7.6 | PENDIENTE | Permisos de archivos y directorios | Owner (`sudo`) |
| 7.7 | PENDIENTE | Configuracion de seguridad del servicio | Owner (`sudo`) |
| 7.11 | PENDIENTE | Pruebas controladas de extremo a extremo | Owner + equipo (celular) |
| 7.12 | PARCIALMENTE | Version y migraciones en el servidor real | Equipo (medido el 12-nov) |
| 7.15 | PENDIENTE | Autorizar expresamente la activacion del flujo | Owner |
| 8.5 | PARCIALMENTE | Verificaciones tecnicas de publicacion | Equipo |
| 8.6 | PARCIALMENTE | El representante legal firma la autorizacion operativa | **Owner (T8)** |
| 8.8 | PARCIALMENTE | Quien autorizo, cuando y bajo que resultados | Equipo (acta del 12-nov; falta el 📦1051 y T1) |

## 3. Resultados de T1 a T9

| ID | Que exige el plan | Estado | Evidencia |
|---|---|---|---|
| T1 | Corrida reproducible desde clon limpio | En curso | Acta en `verificacion-cierre/` |
| T2 | (no separado en el plan) | — | — |
| T3 | Commit candidato identificado | **CERRADO** | `264d08df` |
| T4 | Verificacion formal en servidor: version, configuracion legal, migraciones, permisos, secretos, respaldos, auditoria | **CERRADO** | `acta-comprobacion-servidor-2026-11-12.md` (9 puntos, con lo que quedo) |
| T5 | (canal de `fecha_terminacion`) | **PARCIALMENTE** | El canal existe por rutas admin; falta el procedimiento escrito |
| T6 | E2E controlado posterior al despliegue, limpieza del rastro y evidencia | **CERRADO con salvedad** | `t6-caso-buzon-corporativo.md` y `scripts/probar-t6-medio-corporativo.js`: el caso del buzon corporativo se **rechaza** con HTTP 400 `MEDIO_OTP_CORPORATIVO` contra el codigo desplegado. **Salvedad:** el caso real no ha ocurrido en produccion (0 eventos `OTP_MEDIO_CORPORATIVO` en la base) |
| T7 | Reversion probada, no descrita | En curso | Acta en `verificacion-cierre/` |
| T8 | Autorizacion operativa independiente del owner, documento firmado | **PENDIENTE** | Acto de voluntad del owner: **no lo puede firmar nadie mas** |
| T9 | Reconfirmar en el momento de abrir: `acuerdo.publicado`, `aplicacion.activada` y el valor de `exigirAnexoNube` | **PENDIENTE** | Se reconfirma el dia de abrir, no antes |

**La compuerta G4** («T4, T6 y T7 con evidencia registrada; T8 firmada; T9 reconfirmado») esta en
**3 de 5**: T4 y T6 con evidencia, T7 en curso, T8 y T9 pendientes de actos del owner.

## 4. Decisiones A, B y C

| Decision | Que era | Estado | Fecha |
|---|---|---|---|
| A (N-6) | Versionar los dos archivos de prueba que `.gitignore` se tragaba | **APLICADA**: `tests/_adversary-e6e7.test.js` y `tests/routes/__test-isolation.test.js` estan versionados en git | 5-nov-2026 |
| B | Plazos de conservacion de 10 y 5 anos | **TOMADA CON LA COMPUERTA CERRADA**: la tabla supletoria sigue sin validar y la compuerta de conservacion esta cerrada a proposito, para que el texto no prometa un plazo que el sistema no aplica | 5-nov-2026 |
| C | `exigirAnexoNube` (la compuerta `FIRMA_EXIGIR_ANEXO_NUBE`) | **DECIDIDA: ENCENDERLA**, con el orden obligatorio del §13. La condicion tecnica **ya se cumple**: el preflight real del 12-nov-2026 19:56Z dio `ok: true`, exit 0 (texto vigente con huella coincidente y una Empresa activa con el Anexo de Nube suscrito **y contrafirmado**). **Falta el acto**: encender la variable y reiniciar | 5-nov-2026 |

## 5. Lo que este registro NO dice

1. **No dice que el servicio este abierto.** No lo esta: la compuerta `FIRMA_EXIGIR_ANEXO_NUBE` sigue
   apagada y no hay ninguna empresa real suscrita.
2. **No dice que production este al dia.** El 📦1051 no esta desplegado: `proxy-addr 2.0.7` sigue
   corriendo en el servidor (la critica que ese commit arregla).
3. **No dice que la compilacion de los 22 pendientes sea de una sola persona.** Diez son de terceros
   (abogado, owner, una persona con un celular) y el resto son actos tecnicos que hoy estan
   identified y con el comando a la mano.
4. **No cierra el 100%.** El `guion-de-cierre-2026-11-12.md` lista los 13 actos que solo el owner
   puede hacer, con el comando literal de cada uno.

## 6. Actas de esta medicion

- `acta-comprobacion-servidor-2026-11-12.md` — requisito 7.13.
- `acta-despliegue-2026-11-12.md` — requisito 8.8.
- Este documento — requisito 8.10 y el registro de cierre del plan.
- `t6-caso-buzon-corporativo.md` — T6.
