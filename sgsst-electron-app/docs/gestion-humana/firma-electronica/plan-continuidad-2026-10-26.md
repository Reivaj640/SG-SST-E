# Plan de continuidad y retencion — servicio de firma electronica K+AIR

**Fecha:** 2026-10-26 · **Estado:** implementado en el PC, pendiente de instalar en el servidor
**Alcance:** los cuatro huecos del Anexo de Nube que dependen de datos propios
(RTO, RPO, plan de continuidad y plazo de supresion) y que hoy bloquean el
item `rto_rpo` del check de readiness.

---

## 1. Decision (valores firmes)

| # | Dato | Valor | De donde sale |
|---|---|---|---|
| 1 | **RTO** (tiempo objetivo de recuperacion) | **4 horas** | Decision propia: margen prudente sobre una restauracion que, probada, toma minutos |
| 2 | **RPO** (punto objetivo de recuperacion) | **24 horas** | Decision propia: igual al intervalo real de las copias |
| 3 | **Plan de continuidad** | redactado mas abajo | Decision propia, en el §3 |
| 4 | **Plazo de supresion** | **30 dias calendario** | Decision propia: alineado con la retencion de las copias |

**Respaldo: cada 24 horas a las 22:00 (hora de Colombia).**
**Retencion de las copias: 30 dias.**

Ninguna norma colombiana fija un RTO ni un RPO (verificado: la Ley 1581 art. 19
y el Decreto 1074 art. 2.2.2.25.3.7 le piden a la SIC poder evidenciar que las
medidas de seguridad se implementaron de forma efectiva, pero no fijan cifras).
Son **compromisos propios**, y por eso tienen que ser cumplibles por el equipo
que los firma.

---

## 2. Por que estos valores son cumplibles (la cadena de evidencia)

Un RTO solo es verdad si las tres piezas existen. Las tres estan:

| Pieza | Como existe | Donde esta probada |
|---|---|---|
| **Se detecta la caida** | `health-check.sh` en cron cada 5 minutos: revisa el servicio local y el publico, reinicia el servicio si esta caido (con espera de 10 min para no entrar en bucle) y deja log | El script esta probado en el PC; falta programarlo en el servidor |
| **Se puede restaurar** | `probar-restauracion.sh`: toma el ultimo respaldo, lo restaura en un temporal, comprueba integridad, tablas, conteos y `user_version`, y borra el temporal | **Probado en el PC: OK** (tablas=2, empresas=1, solicitudes=1, user_version=40, sin temporales tirados) |
| **Las copias existen y están sanas** | `backup-firma.sh`: backup online de SQLite (metodo oficial `.backup`, no copiando el archivo a pelo), `PRAGMA integrity_check` sobre la copia, tar de los PDF, retencion de 30 dias, log con tamano y sha256 | **Probado en el PC: OK** (respaldo OK con hash, la copia de 40 dias se borro, la de 10 dias se conservo) |

**Cadencia:** con un respaldo diario a las 22:00, lo peor que se puede perder
son las operaciones de las ultimas 24 horas → **RPO = 24 h**. Si el respaldo
fuera semanal, el RPO seria 168 h y no podriamos prometer 24 h.

**RTO = 4 h:** con la deteccion (5 min), el diagnostico, la restauracion desde
el ultimo respaldo y el reinicio, la recuperacion real es de minutos o de una
hora. Se promete 4 h para dejar margen (una persona puede estar dormida, el
tunel de Cloudflare puede necesitar un reinicio, puede haber que levantar el
servidor en otro equipo). Prometer menos (1 h) seria una promesa sin evidencia;
prometer mas (24 h) seria mas honesto pero innecesariamente debil.

**Supresion en 30 dias:** es el mismo plazo que la retencion de las copias. Asi
la poda de 30 dias **hace cumplir** el plazo de supresion en vez de dejarlo
en promesa. El plazo corre al terminar el encargo; mientras el encargo siga
vigente, la retencion es la del periodo de conservacion de la evidencia.

---

## 3. Texto del plan de continuidad (listo para el Anexo de Nube)

> Plan de continuidad: se realiza un respaldo diario a las 22:00 (hora de
> Colombia) de la base de datos y de la evidencia en PDF, con retencion de 30
> dias, y se verifica mensualmente que el respaldo se restaura correctamente.
> Si el servidor no vuelve, se restaura en otro equipo con la imagen del
> sistema y el ultimo respaldo, se avisa a cada Empresa por el canal de PQRS y
> la firma se reanuda una vez restablecido el servicio, sin que las firmas
> realizadas pierdan validez.

Texto de la seccion 3 del Anexo de Nube (sustituye los tres huecos):

> el tiempo objetivo de recuperacion (RTO) es de **4 horas** y el punto
> objetivo de recuperacion (RPO) es de **24 horas**; plan de continuidad
> operativa: [el texto del plan de continuidad, arriba].

Texto de la seccion 6 del Anexo de Nube (sustituye el hueco del plazo):

> los suprime de sistemas y respaldos en **30 dias calendario**, salvo norma
> que exija conservarlos, y entrega [constancia de la supresion].

---

## 4. Fases de implementacion

### F0 — Hecho en el PC (📦959, sin commitear)

| Archivo | Que hace |
|---|---|
| `firma-service/deploy/backup-firma.sh` | Reescrito: retencion 30 dias, `integrity_check` sobre la copia, log con tamano + sha256, cron de las 22:00 documentado, `BASE` y retencion parametrizables |
| `firma-service/deploy/probar-restauracion.sh` | Nuevo: restaura el ultimo respaldo en un temporal, verifica integridad + tablas + conteos + `user_version`, borra el temporal con `trap` (nunca deja datos personales en `/tmp`), falla si no hay respaldos |
| `firma-service/deploy/health-check.sh` | Nuevo: deteccion de caidas cada 5 min (local + publico), reinicio con enfriamiento, log de cada revision |
| `firma-service/deploy/README-DESPLIEGUE.md` | Paso 9 actualizado: los tres scripts, los dos crons y las tres verificaciones |

Prueba funcional ejecutada en el PC (con Git Bash y un shim de `sqlite3` sobre
`better-sqlite3`, porque en el PC no hay sqlite3 CLI): **los 5 chequeos
pasaron** (sintaxis, respaldo, poda a 30 dias, restauracion con borrado del
temporal, y fallo correcto cuando no hay respaldos).

### F1 — Instalar en el servidor (lo hace el owner, en Cockpit)

Los comandos van en el §5. Salida esperada: 3 lineas de log del respaldo, 1
linea de la restauracion, 2 lineas del health check, y `timedatectl` en
America/Bogota.

#### Requisito previo: la hora del servidor (medido el 26-oct-2026)

El servidor corre en **`Etc/UTC`**, no en hora de Colombia. Eso rompe tres
cosas a la vez, y por eso es el **primer** paso, antes del cron:

1. **El cron de las 22:00 no es a las 22:00 de Colombia**: en UTC son las
   17:00. El Anexo de Nube y este plan declaran "22:00 (hora de Colombia)", y
   esa frase sería falsa.
2. **Los plazos en dias habiles se cuentan con el calendario UTC**
   (`src/services/solicitudes.js`, `_sumarDiasHabiles` usa `getDay()`): el
   plazo de dos (2) dias habiles de PQRS y el de cinco (5) dias habiles de la
   copia permanente se cuentan desde el dia UTC, que puede ser el dia
   siguiente (una solicitud del viernes a las 9 de la noche en Colombia es
   "sabado" en UTC). El codigo mismo dice que el dia debe ser **local**: el
   servidor es el que esta mal puesto.
3. **La constancia PDF imprime la hora del servidor**: un documento firmado a
   la 1 de la tarde en Colombia queda impreso a las 6 de la tarde. La
   precision legal la da el ISO crudo en base de datos, pero la lectura humana
   va 5 horas corrida.

La correccion es una linea: `sudo timedatectl set-timezone America/Bogota`.
Es reversible (`sudo timedatectl set-timezone Etc/UTC`) y **no** toca los datos:
la base guarda ISO en UTC y las comparaciones son por instante. Lo unico que
cambia es lo que ya decia tener que ser local (el codigo lo documenta en
`solicitudes.js:144` y en `pdfGen.js:123`). Colombia no tiene horario de
verano, asi que UTC-5 es fijo todo el ano.

**Que el deploy del 26-oct-2026 quedo instalado y funcionando** (evidencia):
el tar con los cuatro hashes correctos, las 40 migraciones aplicadas, el
servicio `active`, `/health` con `db: ok` y `smtp: configured`, los tres
scripts de continuidad con sus hashes correctos, los dos crons instalados, un
respaldo de 458 752 B con `integrity ok` y una restauracion con 26 tablas y
la empresa registrada.

### F2 — Llenar el manifiesto y el modelo (solo con la evidencia de F1)

| Donde | Campo | Valor | Cuando |
|---|---|---|---|
| `legal-readiness.json` | `infraestructura.rto_horas` | `4` | Cuando exista la evidencia de F1 |
| `legal-readiness.json` | `infraestructura.rpo_horas` | `24` | Cuando exista la evidencia de F1 |
| `legal-readiness.json` | `infraestructura.plan_continuidad` | el texto del §3 | Cuando exista la evidencia de F1 |
| `legal/anexo-nube-v1.0.html` + `sitio/anexo-nube-v1.0.html` | §3 | RTO 4 h, RPO 24 h, plan de continuidad | Cuando exista la evidencia de F1 |
| `legal/anexo-nube-v1.0.html` + `sitio/anexo-nube-v1.0.html` | §6 | plazo de supresion 30 dias | Cuando exista la evidencia de F1 |

**Regla que no se negocia (trampa 86):** un instrumento que declara el estado
no puede declarar el estado que uno quiere. Los cuatro campos se llenan
**despues** de que el cron este instalado y la restauracion probada en el
servidor, no antes. Llenarlos antes seria un verde falso: el check pasaria
sin que exista el respaldo que el RTO promete.

### F3 — Commit, despliegue y verificacion

1. Commit 📦959 (los 3 scripts, el README y este plan).
2. Re-armar el tar desde el commit (`git archive HEAD`) y desplegarlo.
3. Correr el check de readiness en el servidor: el item `rto_rpo` debe pasar de
   `pendiente` a `ok` con el motivo "RTO 4 h, RPO 24 h y plan de continuidad".

### F4 — Lo que sigue bloqueando (no es de este plan)

- **Punto 9**: la cuenta de Google de consumo no habilita el servicio. Sin
  Workspace/Cloud con DPA, `google_dpa` sigue pendiente.
- **Punto 11/12**: el Anexo de Encargo conserva el aviso "Revision
  profesional pendiente" y la v1.1 sigue sin enviarse al abogado.
- **Alerta externa**: el health check deja log y reinicia, pero **no avisa a
  nadie**. La otra mitad de la deteccion es un monitor de uptime en el panel de
  Cloudflare (del owner), que es la parte que de verdad despierta a alguien a
  las 3 de la mañana. Sin eso, el RTO de 4 h cuenta desde que el owner se
  entere, no desde que la caida ocurre.

---

## 5. Comandos (para Cockpit, uno por uno)

### 5.1 Instalar los scripts y los crons

**Paso 0 — la hora del servidor (antes que el cron):**

```bash
sudo timedatectl set-timezone America/Bogota
```

```bash
timedatectl
```

Debe decir `Time zone: America/Bogota (UTC-05:00)`. Si sigue en `Etc/UTC`, el
cron de las 22:00 dispararia a las 17:00 de Colombia y los plazos en dias
habiles se contarian con el dia UTC.

**Despues, los scripts y los crons:**

```bash
sudo cp /opt/kair-firma/app/deploy/backup-firma.sh /opt/kair-firma/backup-firma.sh
sudo cp /opt/kair-firma/app/deploy/probar-restauracion.sh /opt/kair-firma/probar-restauracion.sh
sudo cp /opt/kair-firma/app/deploy/health-check.sh /opt/kair-firma/health-check.sh
```

```bash
sudo chmod +x /opt/kair-firma/backup-firma.sh /opt/kair-firma/probar-restauracion.sh /opt/kair-firma/health-check.sh && sudo mkdir -p /opt/kair-firma/logs
```

```bash
echo "0 22 * * * root /opt/kair-firma/backup-firma.sh >> /opt/kair-firma/backups/backup.log 2>&1" | sudo tee /etc/cron.d/kair-firma-backup
```

```bash
echo "*/5 * * * * root /opt/kair-firma/health-check.sh >> /opt/kair-firma/logs/health-check.log 2>&1" | sudo tee /etc/cron.d/kair-firma-health
```

```bash
echo "0 4 1 * * root /opt/kair-firma/probar-restauracion.sh >> /opt/kair-firma/backups/restauracion.log 2>&1" | sudo tee /etc/cron.d/kair-firma-restauracion
```

Este tercero corre el dia 1 de cada mes a las 04:00 UTC (23:00 de Colombia) y
es lo que hace verdadera la frase del Anexo de Nube "se verifica mensualmente
que el respaldo se restaura correctamente". Sin el, el texto del Anexo seria
una promesa sin cron.

### 5.2 Correrlo una vez a mano y ver la salida

```bash
sudo /opt/kair-firma/backup-firma.sh
```

```bash
sudo /opt/kair-firma/probar-restauracion.sh
```

```bash
sudo /opt/kair-firma/health-check.sh
```

```bash
timedatectl
```

Salida esperada del respaldo:
`[fecha] Backup OK: firma-YYYYmmdd-HHMMSS.sqlite (NNN B, sha256 ..., integrity ok) + storage-....tar.gz`

Salida esperada de la restauracion:
`[fecha] Restauracion OK: tablas=N empresas=N solicitudes=N user_version=N` y
despues `[fecha] El temporal de la prueba se borro.`

### 5.3 Comprobacion de que el cron quedo instalado

```bash
sudo cat /etc/cron.d/kair-firma-backup /etc/cron.d/kair-firma-health
```

```bash
ls -la /opt/kair-firma/backups/
```

---

## 6. Lo que este plan NO cubre

- El cambio de proveedor de correo (puntos 8 y 9): es otro plan.
- La copia **off-site** de los respaldos (rclone a Google Drive): queda como
  opcion dentro del propio script, sin configurar. Hoy las copias viven en el
  mismo servidor que los datos: si se pierde el disco, se pierden las dos
  cosas. El RTO de 4 h asume que se puede levantar otro equipo con la imagen
  del sistema y restaurar desde ahi, lo que exige una copia fuera del
  servidor. **Es la brecha mas grande del plan y la mas facil de cerrar**
  (una linea de rclone + una cuenta).
- La tabla `empresas_nube` y el registro de `anexo_nube_firmado_at` (lo firma
  cada Empresa): no son parte de la continuidad.
