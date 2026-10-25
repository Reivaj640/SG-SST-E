# Plan de seguridad diferido — sugerencia, no restrictiva

**Estado:** 🟡 **Aplazado por decisión del owner el 2026-10-25.**
**No bloquea:** la primera firma con la v1.0, el funcionamiento actual del servicio ni la
publicación de la v1.1.
**Se retoma:** antes de una auditoría, de un DPA o de un cliente nuevo; antes de un
redespliegue que obligue a reinstalar dependencias; si aparece un CVE crítico; o, a más
tardar, el **2027-01-31**.

> Este documento es una **sugerencia de higiene de seguridad**, no un gate. La decisión de
> aplazarlo es del owner y queda registrada en `Historial.md`. Nada de lo que sigue se
> presenta como ejecutado.

---

## 1. Qué se decidió

El 2026-10-25 el owner decidió **no** hacer en esta ventana:

1. La migración de **Node 20 a Node 24** en el servidor `kair-server`.
2. El cierre **A/B/C** del `SECURITY.md` (se descartó C; A completo exige pentest, prueba
   de carga y revisión legal; B+ queda como camino recomendado cuando se retome).
3. El `npm audit fix` y los cambios mayores de `nodemailer` y `zod`.

La razón es de prioridad: la app funciona hoy, no hay firmas reales todavía y la primera
firma con la v1.0 es el objetivo inmediato. El salto de runtime tiene riesgo de despliegue
y no es un bloqueo funcional. Se retoma cuando haya una ventana tranquila o cuando alguno
de los disparadores de la §4 lo exija.

---

## 2. Qué se acepta por escrito (al 2026-10-25)

| Riesgo | Estado real | Consecuencia práctica |
|---|---|---|
| **Node 20 EOL** | El servidor corre **20.20.2**, publicado el 2026-03-24. La rama 20 llegó a su EOL el **2026-04-30**. | No hay parches nuevos de Node. La app sigue funcionando; el riesgo es que un CVE futuro quede sin corregir. |
| **`npm audit`** | **7 vulnerabilidades**: 1 crítica (`proxy-addr`), 4 altas (`body-parser`, `multer`, `nodemailer`, `zod`) y 2 moderadas (`express`/`qs`). | La exposición real es menor por el diseño (escucha en `127.0.0.1`, Cloudflare Tunnel, auth interna), pero no es cero. El impacto más probable es disponibilidad o IP de auditoría, no falsificación de firmas. |
| **`SECURITY.md` §7** | **39 casillas, 0 marcadas.** El documento es de diseño, no una certificación. | No se puede afirmar que el checklist pre-producción esté ejecutado. |
| **Backups** | El script existe (`deploy/backup-firma.sh`), pero **no hay cron**; las copias son manuales. | Un fallo entre copias puede perder el último tramo. No es parte de este plan, pero queda visible. |
| **Monitoreo** | No hay alerta de caída del servicio ni del túnel. | Una caída se detecta cuando alguien la reporta, no antes. |

**Lo que no cambia:** la validez de la firma electrónica no depende de la versión de Node.
Depende de la identidad, la integridad, la trazabilidad y la constancia. Node 24 es higiene
operativa y continuidad, no un requisito formal del mecanismo.

---

## 3. Qué NO se afirma

- ❌ Que el servidor corra una versión soportada de Node.
- ❌ Que `npm audit` esté limpio.
- ❌ Que el §7 del `SECURITY.md` esté ejecutado.
- ❌ Que haya pentest externo, prueba de 1000 firmas concurrentes o plan de incidentes.
- ❌ Que los backups sean automáticos o que la restauración esté probada.

Si alguien necesita alguna de esas afirmaciones para una auditoría o un cliente, este plan
deja de ser sugerencia y se convierte en requisito para esa entrega.

---

## 4. Disparadores para retomar

Se retoma **antes** de que ocurra cualquiera de estos:

1. **Primera firma real** con una ventana de más de 72 horas disponible.
2. **Auditoría, DPA o revisión de seguridad** de un cliente.
3. **Redespliegue** que obligue a `npm ci`, reconstruir `better-sqlite3` o reinstalar Node.
4. **CVE crítico** en Node 20 o en una de las dependencias auditadas.
5. **Cambio de infraestructura** (nuevo servidor, nueva IP, nuevo túnel).
6. **2027-01-31**, aunque no haya pasado nada: revisión obligatoria de la decisión.

---

## 5. Plan de acción propuesto

### Fase 1 — `npm audit fix` sin cambios mayores

**Objetivo:** quitar 5 de las 7 vulnerabilidades sin tocar Node.

- `npm audit fix` (sin `--force`) para `express`, `body-parser`, `qs`, `proxy-addr` y
  `multer`.
- **No** aplicar `npm audit fix --force`: arrastra `nodemailer` 10 y `zod` 4, que son
  cambios mayores y necesitan prueba aparte.
- Correr la suite completa con `--test-concurrency=1`.
- Desplegar en una ventana corta; verificar `/health`, `panel-firmas.js` y readiness.

**Criterio de aceptación:** `npm audit --omit=dev` baja a las 2 vulnerabilidades de
`nodemailer`/`zod` (o a 0 si se aprueban los mayores) y la suite sigue en verde.

**Riesgo:** bajo. Son actualizaciones dentro de la misma rama; aun así, se prueba antes de
producción.

### Fase 2 — Node 24 LTS + `better-sqlite3` 12

**Objetivo:** sacar el runtime de EOL sin romper la base.

- Node **24.22.1** (LTS “Krypton”, soporte hasta 2028-04-30).
- `better-sqlite3` **12.11.1** (declara soporte para Node 20/22/23/24/25/26).
- Probar primero en una copia: `npm ci`, suite completa, apertura de una copia de
  `firma.sqlite` y `PRAGMA integrity_check`.
- En el servidor, instalar Node 24 **al lado** de Node 20 (tarball en
  `/opt/node-v24.22.1-linux-x64`), no reemplazar `/usr/bin/node`.
- Cambiar el `ExecStart` de systemd al binario nuevo; mantener Node 20 como rollback.
- Verificar `/health`, `panel-firmas.js`, readiness y una firma de humo con datos ficticios.

**Criterio de aceptación:** servidor con Node 24, `node -v` correcto, integridad `ok`,
suite completa en verde y rollback probado.

**Riesgo:** medio. El módulo nativo cambia de ABI; por eso la instalación side-by-side y el
rollback son obligatorios.

### Fase 3 — `SECURITY.md` B+

**Objetivo:** que el documento diga la verdad sin reescribir 1 961 líneas.

- Cabecera de estado: “documento de diseño congelado; no certifica producción”.
- Corregir §1.2/§1.3: servidor propio Ubuntu 24.04, NAT + Cloudflare Tunnel,
  `firma.kair.fyi`, Node 24 (después de la Fase 2).
- Corregir §7.2 (backups manuales), §7.5 (`npm audit`, versiones con `^`), §7.7
  (carga/pentest/incidente) y §12.1 (dominio).
- Actualizar §8, §9.12 y §11.5 (versión y conteos de tests).
- Suavizar §14 (“0 amenazas sin mitigar” → “no verificado externamente”).
- **No renumerar secciones:** 28 referencias del código y los docs apuntan a §3, §4, §8,
  §9 y §11.
- Añadir una tabla de evidencia: `[x]` solo con fecha y fuente; `[ ]` con dueño.

**Criterio de aceptación:** ninguna afirmación falsa sobre Node, dominio, backups o
auditoría; el §7 sigue siendo plantilla y se dice.

### Fase 4 — Endurecimiento operativo (post-MVP, camino A)

No forma parte del aplazamiento actual. Es el trabajo que convierte el `SECURITY.md` en un
documento “A”:

- Backup diario por cron + prueba de restauración.
- Rotación y retención de logs (90 días) con acceso restringido.
- Monitoreo de uptime y alertas 5xx.
- Prueba de carga de 1000 firmas concurrentes.
- Pentest externo.
- Plan de respuesta a incidentes.
- Revisión del abogado sobre la v1.1 y el Anexo de Encargo.

---

## 6. Rollback

| Fase | Rollback |
|---|---|
| Fase 1 | Restaurar `package-lock.json` y `node_modules` anteriores; volver a desplegar el tar previo. |
| Fase 2 | Cambiar el `ExecStart` de systemd a `/usr/bin/node` (Node 20) y restaurar el `node_modules` compilado para Node 20. La base no se toca. |
| Fase 3 | Revertir el commit de documentación; no afecta el servicio. |

Antes de la Fase 2: backup de la BD con `sqlite3 .backup`, copia del `node_modules` actual y
del unit de systemd.

---

## 7. Criterio de cierre

Este plan se considera cerrado cuando:

- `node -v` en el servidor es una versión soportada (24.x o superior).
- `npm audit --omit=dev` no tiene vulnerabilidades altas ni críticas.
- El `SECURITY.md` no afirma nada que no esté respaldado por evidencia.
- La suite completa corre en verde en el runtime de producción.
- El rollback se probó al menos una vez.

Hasta entonces, el estado es **sugerencia aplazada**, no deuda cerrada.

---

## 8. Referencias

- `Historial.md` — decisión del 2026-10-25 y tablero de los 15 puntos.
- `SECURITY.md` — análisis de diseño y nota de estado.
- `docs/MIGRACION-SERVIDOR-FIRMA.md` §8 — pendientes operativos del servidor.
- `firma-service/package.json` — `engines` y dependencias.
- `main/test-firma-deploy-kit.js` — check del script de instalación.
