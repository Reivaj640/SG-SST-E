# Auditoría de seguridad del servidor K+AIR (`kair-server`) — 29-oct-2026

> **Estado:** documento de trabajo. **No se ejecutó ningún cambio en el servidor.**
> Todo lo marcado como *verificado en repo* se comprobó leyendo el código; lo marcado
> como *observado en servidor* proviene de la auditoría del otro agente y **no** lo
> he confirmado de primera mano (falta llave SSH en el portátil, ver §5).

---

## 1. Resumen ejecutivo (para el owner)

La auditoría del otro agente es **sólida, honesta y está bien acotada**. No reporta
intrusión: reporta que los permisos de archivos y de red dejan **posibilidades de
acceso local**. Su parte más valuable es la lista de restricciones de §15 ("no ejecutar
esto sin validar") y el orden por fases.

Al contrastarla con el código del repo (que sí puedo leer) encontré **cinco
correcciones** y **un hallazgo que cambia el panorama**. En resumen:

| | |
|---|---|
| El riesgo **más grave no está en la lista** | El archivo `.env` de `/opt/kair-firma` contiene `ADMIN_API_KEY` e `INTERNAL_API_KEY`. Si está en 644, cualquier usuario local lee las llaves. **Esas llaves son justamente las que hay que rotar.** |
| El backup **ya está endurecido** | `backup-firma.sh` ya usa `umask 077`, `mktemp -d` + `chmod 700`, cifra con GPG y valida `PRAGMA integrity_check`. Los respaldos **no** nacen legibles. |
| El servicio Node **no está endurecido** | Ahí sí falta: `storage.js` escribe sin `mode`, así que hereda `umask 0022` → PDFs 644 y directorios 755. |
| La red **ya no es un blocker** | Tailscale da ruta directa al servidor desde el portátil. Falta la llave SSH, no la red. |
| El service ya tiene la mitad del hardening | `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=full`, `ReadWritePaths` ya están en la unidad. Lo que falta es `UMask` y las directivasadvanced. |

---

## 2. Lo que verifiqué en el repo (sin tocar el servidor)

### 2.1 El origen de los permisos abiertos — `firma-service/src/services/storage.js`

```js
41:  fs.mkdirSync(dir, { recursive: true });     // sin { mode } -> hereda el umask
66:  fs.writeFileSync(filepath, buffer);         // sin { mode } -> hereda el umask
86:  fs.writeFileSync(filepath, buffer);         // idem, para la via en papel
```

**No hay un solo `chmod` en todo el archivo.** Con `UMask=0022` (el valor observado en
el servidor) eso produce directorios 755 y archivos 644, exactamente lo que reporta
la auditoría. **El hallazgo H-01 está confirmado en código.**

Rutas (`storage.js:18`, `config.js:203`):

- `SERVICE_ROOT = path.resolve(__dirname, '..', '..')` -> `/opt/kair-firma/app`
- `config.storage.pdfPath = resolvePath(required('PDF_STORAGE_PATH', './storage/pdfs'))`
  -> en el servidor, `/opt/kair-firma/storage/pdfs` (**fuera** de `app/`)

Por eso la unidad necesita `ReadWritePaths=/opt/kair-firma` y no solo `/opt/kair-firma/app`.

### 2.2 La unidad systemd — `firma-service/deploy/kair-firma.service`

Está versionada en el repo, así que se puede contrastar con lo que leyó el otro agente.
Coincide en lo esencial:

```ini
User=kairfirma
WorkingDirectory=/opt/kair-firma/app
EnvironmentFile=/opt/kair-firma/.env
ExecStart=/usr/bin/node src/server.js
Restart=always / RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/kair-firma
LimitNOFILE=65536
```

**Ya tiene** `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=full` y `ReadWritePaths`.
**No tiene** `UMask` (confirma H-04) ni ninguna de las directivas avanzadas de la
Fase 3 del informe.

Dato que el informe no menciona: `ProtectSystem=full` **ya impide** que el proceso
escriba fuera de `/opt/kair-firma`. El aislamiento de escritura está hecho; lo que
falta son los permisos de lectura.

### 2.3 El backup ya está endurecido — `firma-service/deploy/backup-firma.sh`

```bash
76:  umask 077
133: WORK=$(mktemp -d /tmp/kair-backup-XXXXXX)
134: chmod 700 "$WORK"
138: trap 'rm -rf "$WORK"' EXIT
```

Además: copia **online** con `sqlite3 .backup` (seguro con WAL, sin parar el servicio),
verifica `PRAGMA integrity_check`, cifra con GPG simétrico AES256 (autenticado, MDC) y
**comprueba que se puede volver a descifrar**. La copia en claro nunca vive en
`$BACKUPS`, vive en un temporal 700 que se borra con `trap`.

**Conclusión:** el hallazgo "las copias de seguridad son legibles" **no aplica al
proceso de backup**: los `.enc` nacen 600 y son ilegibles sin la frase, y la frase
está en `/opt/kair-firma/backup.passphrase` (600, root:root). Lo que sí hay que
revisar son **los respaldos ya existentes** y el directorio `backups/`.

### 2.4 El modelo de conservación ya existe

- `030_conservacion_deber_legal.sql`: el flag `conservacion_por_deber_legal` a nivel de
  **EMPRESA**, con HOLD legal en `gh_firma_holds`. Nació de un problema real: "el
  vencimiento de la tabla de retención extingue un deber que la ley no extingue"
  (Decreto 1072 de 2015, art. 2.2.1.1.12).
- `046_purgas_respaldo.sql`: la purga alcanza **a nivel de registro** en los respaldos.
- `039_copia_permanente.sql`: copias que no se purgan.

Esto importa para el plan del ausentismo (§8).

### 2.5 Dos huecos de documentación y uno de código

1. **`ARCHITECTURE.md` y `PROJECT_OVERVIEW.md` no existen** en `firma-service/`. El
   informe pide revisarlos (§18.1) y `storage.js:7` **cita "ARCHITECTURE.md §20
   (Almacenamiento)"** que no está en el repo. Documentación referenciada y ausente.
2. Hay **45 migraciones** (`001`–`046`, falta la `015`), no 28 como anoté yo antes.
3. **Riesgo de integridad, no de permisos:** `saveOriginal` (`storage.js:56`) se llama
   desde `signRequest.js:757` con nombre determinístico `${id_solicitud}.pdf`, y
   `fs.writeFileSync` con `flag` por defecto (`'w'`) **trunca**. Si una solicitud se
   re-procesa, el PDF "congelado" se pisa. Hay que verificar si el flujo lo impide
   (idempotencia) o si de verdad se puede reescribir.

### 2.6 El servicio responde

```
GET https://firma.kair.fyi/health
{"status":"ok","kair_version":"compatible-0.1.189","uptime_seconds":95608,
 "checks":{"db":"ok","smtp":"configured"}}
```

26,5 h de uptime al momento de la consulta. **El servicio está sano.**

---

## 3. Correcciones y matices al informe original

| # | El informe dice | Realidad verificada | Ajuste |
|---|---|---|---|
| 1 | Las copias de seguridad son legibles | El script de backup pone `umask 077`, cifra y valida | **Severidad baja.** Solo revisar respaldos viejos y el directorio |
| 2 | Los PDFs y la BD quedan 644/755 | Correcto, y el origen está en `storage.js` (sin `mode`) | Confirmado. La causa es el `umask` del **servicio**, no un descuido del script |
| 3 | "Permisos 777/666 en `app/` y `src/`" | `ProtectSystem=full` ya limita la **escritura** | Sigue siendo real (lectura + ejecución + bypass por directorios), pero el riesgo es **integridad del código**, no confidencialidad |
| 4 | "No mover la base SQLite con el servicio activo" | `backup-firma.sh` ya usa `sqlite3 .backup` (online, seguro con WAL) | Correcto para **mover**; el backup ya no necesita parar el servicio. Los permisos de la BD viva **sí** requieren parar el servicio |
| 5 | Propone `UMask=0077` en systemd como Fase 3 | El script de backup **ya usa `umask 077` | Coherente: aplicarlo al servicio **alinea** el servicio con lo que el backup ya hace. Subirlo de prioridad |

### Lo que falta y cambia la severidad

**El hallazgo más grave del informe no está en su lista: el `.env`.**

`EnvironmentFile=/opt/kair-firma/.env` contiene `ADMIN_API_KEY`, `INTERNAL_API_KEY`
y credenciales de correo. `ProtectSystem=full` restringe la **escritura**, no la
**lectura**: si el `.env` está en 644, cualquier usuario local lee las llaves de la
firma. Y son **exactamente las llaves que hay que rotar** (pendiente #5: las 4 llaves
daban 401 contra `firma.kair.fyi`). Si un usuario local las leyó, ya las tiene.

**Recomendación: `UMask=0077` + `chmod 600 /opt/kair-firma/.env` es el P0 real**, por
encima de los PDFs.

### La severidad depende de un dato que el informe dejó pendiente

Los permisos `777` en `app/` y `src/` solo importan si **hay otros usuarios locales**
en el servidor. El propio informe lo dejó como comando pendiente (§14.1,
`getent passwd`). Si en la máquina solo existen `javier` (con sudo) y `kairfirma`, el
riesgo real es bajo: quien podría leer ya es root.

**Ese es el primer comando que hay que correr.** Define la severidad de H-02.

---

## 4. Hallazgos: severidad revisada

| ID | Hallazgo | Severidad informe | Severidad revisada | Por qué |
|---|---|---|---|---|
| H-01 | PDFs, BD y directorios legibles | Crítica | **Alta** (no crítica si solo hay 2 usuarios locales) | Depende del inventario de usuarios |
| H-02 | `app/` y `src/` en 777/666 | Crítica | **Media-alta** | `ProtectSystem=full` ya limita la escritura; el riesgo es integridad |
| H-03 | Respaldos legibles | Crítica | **Baja** | El script ya cifra y usa `umask 077`; revisar solo los existentes |
| H-04 | `UMask=0022` | Media | **Alta** | Es la causa raíz de H-01 y el punto de apalancamiento |
| H-05 | SSH en `0.0.0.0:22` + UFW inactivo | Crítica | **Media, condicionada al NAT** | "Escuchan en todas las interfaces" **no** significa "expuestos a internet". Hay que probar desde fuera de la red |
| H-06 | Cockpit en `0.0.0.0:9090` | Crítica | **Media-alta** | Cockpit da **root** con un login. Si el NAT lo expone, es crítico |
| H-07 | PCP en 44321-44323 | Media | **Media** | `pmproxy` tiene CVEs conocidos; en un servidor de app no es indispensable |
| H-08 | `.env` con llaves API | **No listado** | **Crítica** | Las llaves dan acceso a todo el servicio |
| H-09 | Tailscale activo y `direct` | **No listado** | **Informativa, positiva** | Resuelve el acceso remoto seguro; habilita el resto del trabajo |
| H-10 | El `.env` fuera del árbol del repo, sin versionar | **No listado** | **Media** | No hay forma de auditar ni de reconstruir la configuración |

---

## 5. El hallazgo que cambia el panorama: Tailscale

Verificado desde este portátil:

```
portatil   100.120.63.35   laptop-pss09anv   windows
servidor   100.119.81.74   kair-server       linux   active; direct 192.168.40.48:41641
```

**El tailnet es el mismo y la conexión es directa.** Esto desmonta el blocker que
venía arrastrando desde el 8-oct ("SSH imposible desde el portátil por otra red física
con el mismo rango 192.168.1.0/24"): ese diagnóstico era correcto **en su momento**,
pero la ruta correcta **nunca fue la LAN**, era Tailscale.

Prueba de conexión:

```
ssh javier@100.119.81.74 ...
-> Permission denied (publickey,password)
```

La **red llega** (el puerto 22 responde); lo que falta es **autenticación**: este
portátil no tiene llave SSH (`~/.ssh` solo contiene `known_hosts`).

**Cómo desbloquear, sin copiar llaves privadas por Drive:** generar un par en este
portátil y agregar la **pública** al `authorized_keys` del servidor desde el escritorio
(o por AnyDesk), que sí tiene llave. Es un cambio de una línea, reversible y seguro.
**Nunca copiar la llave privada por Drive** — eso sería contradecir el informe.

Esto destraba de una vez: la rotación de llaves de la firma (pendiente #5) y la Fase B
del plan del ausentismo (servicio `kair-data`), que necesitan escribir en el servidor.

---

## 6. Orden de ejecución corregido

El orden del informe (§17) es bueno. Lo reordeno por *severidad real* y por *coste de
reversión*:

### P0 — antes de tocar nada (solo lectura, 10 minutos)

1. `getent passwd` -> **cuántos usuarios locales hay.** Define H-01 y H-02.
2. `stat -c '%a %U:%G' /opt/kair-firma/.env /opt/kair-firma/backup.passphrase`
   -> si el `.env` esta en 644, es el hallazgo mas grave y va primero.
3. `sudo nft list ruleset` + `sudo ss -lntup` -> confirmar estado real.
4. **Probar desde fuera de la red** si el puerto 22 y el 9090 responden. Si no
   responden, H-05 y H-06 bajan de severidad.
5. **Ruta Tailscale probada**: `ssh javier@100.119.81.74` desde el escritorio.
   **Probar ANTES de cerrar cualquier sesión administrativa.**

### P1 — cambios de bajo riesgo, reversibles en un comando

6. `UMask=0077` en `kair-firma.service` + `systemctl daemon-reload` + restart en
   ventana autorizada. **Coherente con lo que el backup ya hace.**
7. `chmod 600 /opt/kair-firma/.env` y `chmod 640` (o 600) al directorio `backups/`.
8. `chmod 750` en `app/` y `src/` (no 700: el despliegue necesita leerlos).
   Revisar primero que el proceso de despliegue sigue funcionando.
9. Permisos del SQLite vivo: **parar el servicio -> chmod -> arrancar**. Nunca en
   caliente (el propio §15.5 lo advierte; el §17 lo lista sin esa dependencia).
10. Normalizar los respaldos ya existentes (mismo criterio del script).

### P2 — superficie de red

11. **Cockpit**: `systemctl disable --now cockpit.socket` si no se usa. Cockpit da root
    con un login; en un servidor que no se administra por web, sobra. Reversible con
    `enable --now`.
12. **SSH**: `PasswordAuthentication no` y, si el NAT lo expone, atar SSH a la interfaz
    Tailscale. Con Tailscale ya instalado, es preferible a exponer por IP pública.
13. **PCP**: evaluar `systemctl disable --now pcp`. En un servidor de aplicación no es
    indispensable; **deshabilitar no borra nada** y es reversible con `enable --now`.
14. **UFW**: activar **solo** con la política de acceso ya validada y con Tailscale
    verificado (el §15.8 lo dice bien: no cerrar SSH sin sesión alternativa).

### P3 — systemd avanzado (una directiva a la vez)

15. `ProtectHome=true`, `PrivateDevices=true`, `ProtectKernelTunables=true`,
    `ProtectKernelModules=true`, `ProtectControlGroups=true`, `RestrictSUIDSGID=true`.
16. `CapabilityBoundingSet=` vacio y `SystemCallFilter=@system-service`.
    Cada una se prueba: `systemctl restart` -> `curl -f http://127.0.0.1:3001/health`
    -> revisar logs. **Una por vez, con prueba de las 17 de §16.**

### P4 — aplicación, backups y monitoreo

17. La Fase 6 del informe (20 puntos de seguridad lógica) es la más pesada y la única
    que **no se puede hacer por partes sin entender el flujo de firma**. Trátala como
    proyecto aparte.
18. Pruebas de restauración: ya existe `deploy/probar-restauracion.sh`.
19. Alertas de disco y del tunel. **El disco lleno es la causa mas probable de caida
    del servicio**, y con el plan del ausentismo pasa a ser critico (§8).

---

## 7. Lo que no se puede decidir sin acceso al servidor

| Pregunta | Por que importa | Comando |
|---|---|---|
| Cuantos usuarios locales hay | Define H-01 y H-02 | `getent passwd` |
| Permisos del `.env` | Es el P0 real | `stat -c '%a %U:%G' /opt/kair-firma/.env` |
| Si el NAT expone 22/9090 | Define H-05 y H-06 | probar **desde fuera** de la red |
| Si hay cron/timers propios | El backup corre por cron a las 22:00 | `systemctl list-timers --all` |
| Si el `.env` esta en el `.gitignore` del deploy | Si no, se sube al repo | revisar `deploy/` y el `.env` de produccion |

---

## 8. Impacto directo en el plan del ausentismo (`kair-data`)

Este informe **cambia dos decisiones** del plan que veniamos armando:

1. **El servicio `kair-data` debe nacer con el hardening completo**, no después.
   `UMask=0077`, `NoNewPrivileges`, `ProtectSystem=full`, `ReadWritePaths` y `chmod 600`
   del `.env` **desde el primer deploy**. Un servicio nuevo en un servidor con
   permisos abiertos repite el problema desde cero.
2. **El modelo de conservación ya existe y se reusa.** La migracion
   `030_conservacion_deber_legal.sql` (flag por Empresa + HOLD legal) y la
   `046_purgas_respaldo.sql` (purga a nivel de registro en los respaldos) son
   exactamente el marco que necesita el historial de ausentismo, que se conserva
   **5 anos** por deber legal del SG-SST, contra los 30 dias de una copia de respaldo.
   No hay que inventarlo: hay que portarlo.
3. **La disponibilidad del servidor pasa a ser critica.** Si el historial de
   incapacidades vive en el servidor, un disco lleno o el tunel caido = no se puede
   registrar una incapacidad. Por eso el **outbox local** (cola de salida) del plan
   no es opcional, y por eso las alertas de disco (P4-19) suben de prioridad.
4. **La red de la casa es un punto unico de falla.** `kair-server` vive en el
   apartamento. Tailscale ayuda al acceso, pero si se cae el enlace de casa, el PC del
   cliente no registra. El outbox lo mitiga; hay que probarlo.

---

## 9. Decisiones que pide el owner

1. **¿Se instala la llave SSH en este portatil?** (desbloquea rotacion de llaves,
   `kair-data` y el resto de la auditoria). Recomendacion: si, con llave nueva
   dedicada, no copiando la privada del escritorio.
2. **¿Cockpit se deshabilita?** Es root con un login, en un servidor que no se
   administra por web. Recomendacion: si, reversible.
3. **¿Se amplia el Anexo de Encargo para el tratamiento de datos de salud?**
   Es requisito del plan del ausentismo, no de la auditoria. Sin el, el dato de salud
   no se puede centralizar ni aunque la infraestructura este perfecta.
4. **Orden entre la auditoria (P0-P3) y el plan del ausentismo (Fase A).**
   Recomendacion: **Fase A del ausentismo primero** (no toca el servidor, no depende de
   las llaves y deja valor medible), y la auditoria arranca con P0 (solo lectura) en
   paralelo.

---

## 10. Origen de este documento

- **Informe base:** auditoria de seguridad del servidor generada por el agente de
  programacion del owner el 29-oct-2026 (13 secciones, 8 fases, 12 restricciones,
  17 pruebas de aceptacion).
- **Contrastes propios:** lectura de `firma-service/src/services/storage.js`,
  `src/config.js`, `src/db/schema/030` y `046`, `deploy/kair-firma.service`,
  `deploy/backup-firma.sh`, y el estado de Tailscale y SSH desde este portatil.
- **Sin cambios aplicados.** El servidor no fue modificado. La unica accion sobre el
  servidor fue un `GET /health` publico.
