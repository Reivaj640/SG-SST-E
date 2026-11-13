# Guion de cierre — qué falta para abrir el servicio de firma a empresas reales

> **Qué es esto.** El mapa `meta-para-abrir-a-empresas-reales-2026-11-12.md` lista los 30 puntos que
> separan «el servicio funciona» de «una empresa real puede firmar». Este documento es **la parte que
> depende de una persona**: los actos que **solo el owner** puede hacer, con el comando literal, con lo
> que cada uno cierra y con la evidencia que hay que guardar.
>
> **Cómo se lee.** Cada acto dice **qué hay que hacer**, **por qué** (el punto del mapa y la evidencia
> medida), **cómo se hace** (el comando o el acto literal), **qué cierra** y **qué evidencia queda**.
> Lo que ya está técnico y medido **no está aquí**: eso está en el mapa y en los informes de
> `verificacion-cierre/`.
>
> **Estado al 12-nov-2026.** El servicio está sano, con los instrumentos suscritos y contrafirmados, y
> los dos gates en `listo: true` con **0 bloqueantes**. Esto no es «abierto»: faltan **diez bloqueos
> duros**, y la mayoría de ellos son de esta lista.
>
> **El orden importa.** El primero es el que abre; los demás son condiciones. Encender la compuerta
> antes de cumplir las que la compuerta exige produce clientes a los que se les pide firmar sin el
> Anexo de Nube, que es justo lo que el Anexo de Encargo prohíbe.

---

## 1. Los actos, en el orden en que hay que hacerlos

| # | Acto | Cierra | Requiere |
|---|---|---|---|
| 1 | **`chmod` del código desplegado** (los 777) | M.9 | `sudo` en el servidor |
| 2 | **Desplegar el 📦1051 con `npm ci`** | M.8 | `sudo` + el paquete de despliegue |
| 3 | **Instalar la rotación de logs y restringir el directorio** | M.23 | `sudo` + el archivo `deploy/logrotate-kair-firma.conf` |
| 4 | **Configurar el destino del respaldo off-site** | M.7 | la decisión del destino y sus credenciales |
| 5 | **Firmar A4** (la autorización operativa) | M.4 | la firma del representante legal |
| 6 | **La ratificación del abogado** (J6, J7, J8) | M.5, M.6 | el abogado, por escrito |
| 7 | **Los tres alias de Workspace** (P3) | M.11 | la consola de Workspace |
| 8 | **Revocar la credencial anterior** (P6) | M.19 | la consola de Google |
| 9 | **Decidir la versión nueva de los anexos** | M.18 | la decisión + el abogado |
| 10 | **Dejar constancia del `TRUST_PROXY` real** | M.19 | un `grep` del `.env` |
| 11 | **La validación escrita de la compuerta** | M.2 | el equipo + el owner |
| 12 | **El alta y la primera firma de una empresa real** | M.1, M.3, M.10 | el owner + un Trabajador |
| 13 | **Encender `FIRMA_EXIGIR_ANEXO_NUBE`** | M.2 | la decisión de abrir |

---

## 2. Cada acto, con su comando

### 1. El `chmod` del código desplegado (cierra M.9)

**Por qué.** `/opt/kair-firma/app` y `/opt/kair-firma/app/src` están en **777**, con **236 archivos** y
18 directorios escribibles por cualquiera. El servicio corre como `kairfirma`: una cuenta local
cualquiera puede **reemplazar el código que después se ejecuta como `kairfirma`**. Es la única
observación que el abogado marcó como **bloqueante** el 31-oct-2026 y sigue igual cuatro meses
después. El paso 2b del runbook (`MIGRACION-SERVIDOR-FIRMA.md` §5.1) existe desde el 31-oct y **nunca
se aplicó**.

**Cómo.**

```bash
sudo chmod -R u=rwX,go=rX /opt/kair-firma/app
sudo chmod 750 /opt/kair-firma/app /opt/kair-firma/legal
```

**Qué cierra.** M.9, y con él el único punto que el abogado había marcado como bloqueante.

**Qué evidencia queda.** La medición del antes y del después:

```bash
find /opt/kair-firma/app -perm -0002 | wc -l   # antes: 254 (236 archivos + 18 directorios)
ls -ld /opt/kair-firma/app /opt/kair-firma/app/src
```

### 2. Desplegar el 📦1051 con `npm ci` (cierra M.8)

**Por qué.** Producción corre `proxy-addr 2.0.7` (**la crítica**: IP spoofing por subred IPv4-mapped
IPv6), `express 4.22.2` y `qs 6.15.3`. El repo ya los tiene en `2.0.8`, `4.22.3` y `6.16.2`. La causa
es una: **el runbook no instalaba dependencias** (el tar lleva `package.json` y el lock, pero no
`node_modules`), así que un despliegue dejaba el código nuevo con las librerías viejas, sin que
`npm audit` del servidor lo delatara.

**Cómo.** Los pasos de §5.1 del runbook, **con el paso de instalación** (ya documentado) y el servicio
**parado**:

```bash
sudo systemctl stop kair-firma
cd /opt/kair-firma/app && sudo npm ci --omit=dev
sudo bash /opt/kair-firma/migrar.sh          # las migraciones, antes de arrancar
sudo systemctl start kair-firma
```

**Qué cierra.** M.8.

**Qué evidencia queda.** La medición de las versiones en el servidor (**después** del despliegue):

```bash
cd /opt/kair-firma/app && npm ls express proxy-addr qs
sudo journalctl -u kair-firma --since today | tail -30
```

### 3. Rotación de logs y acceso restringido (cierra M.23)

**Por qué.** No hay `logrotate` para `kair-firma`, `/opt/kair-firma/logs` es `drwxr-xr-x root root`
(cualquier usuario de la maquina lo lee) y `health-check.log` crecía sin rotar (409 619 B al 12-nov).
Las tres casillas del `SECURITY.md` §7.4 **no se cumplen**.

**Cómo.** La configuración ya está escrita en
`sgsst-electron-app/firma-service/deploy/logrotate-kair-firma.conf`:

```bash
sudo cp .../logrotate-kair-firma.conf /etc/logrotate.d/kair-firma
sudo chmod 644 /etc/logrotate.d/kair-firma
sudo chmod 750 /opt/kair-firma/logs
sudo logrotate -d /etc/logrotate.d/kair-firma   # prueba en seco: no ejecuta
```

**Qué cierra.** M.23.

**Qué evidencia queda.** `ls -ld /opt/kair-firma/logs` (750) y la salida de `logrotate -d`.

### 4. El destino del respaldo off-site (cierra M.7)

**Por qué.** Los respaldos son diarios a las 22:00 y cifrados con GPG AES256, pero **viven en el
mismo disco que la base**. Los cuatro actos del P8 no estaban en ninguno (el del 12-nov a las 22:00 ya
los incluye). El script `deploy/backup-offsite.sh` está escrito y validado en el servidor: copia los
`.enc` **ya cifrados**, **nunca borra la copia local** y **no se da por buena la copia hasta que el
hash del destino coincide**.

**Cómo.** Decidir el destino (otra máquina, un bucket, un volumen), configurar las credenciales y
dejar el cron. El procedimiento completo está en `MIGRACION-SERVIDOR-FIRMA.md` §8.4.

**Qué cierra.** M.7.

**Qué evidencia queda.** La salida de la copia con **el hash del destino** y el **hash local
coincidentes** (no el éxito del `scp`: la seguridad de la copia se decide por el hash).

### 5. Firmar A4 (cierra M.4)

**Por qué.** La autorización operativa del representante legal **no está firmada**: las secciones 5 y 6
de la Constancia están vacías y el manifiesto declara `constancia.estado = "no_firmada"`. La
autorización **sí** quedó registrada en el servicio (`gh_firma_aprobaciones_publicacion`, id 4: la
v1.6, `08e1eb8b...`, del 11-nov-2026); lo que falta es el **documento firmado**.

**Cómo.** Firmar la Constancia (`sgsst-electron-app/legal/constancia-aprobacion-acuerdo.html`)
completando las secciones 5 y 6 con la **versión** y la **huella** que se autorizan.

**Qué cierra.** M.4 (y con ella el requisito `8.6` del cuadro canónico).

**Qué evidencia queda.** La Constancia firmada, con su huella.

### 6. La ratificación del abogado (cierra M.5 y M.6)

**Por qué.** J6 (el papel de Google en el flujo de correo), J7 (el alcance de la Circular Externa
002/2025 y la inscripción en el RNBD) y J8 (la tabla supletoria de conservación, cuya compuerta está
**cerrada a propósito** hasta que el abogado la valide) siguen pendientes de un tercero. El propio
Anexo de Nube dice en su §5 que su contenido **debe ser revisado por un abogado** antes de ser
contractualmente válido.

**Cómo.** La respuesta escrita del abogado a las tres preguntas. Para J8, además, la validación de los
plazos de 10 y 5 años.

**Qué cierra.** M.5 y M.6.

**Qué evidencia queda.** La respuesta por escrito, y para J8 el `validado_por` y el `validado_at` de
la tabla.

### 7. Los tres alias de Workspace (cierra M.11)

**Por qué.** P3: `privacidad@`, `soporte@` e `incidentes@` de `gesstiar.com` **no están verificados**.
El manifiesto ya lo declara como excepción documentada en los tres canales que lo necesitan.

**Cómo.** Crearlos en la consola de Workspace y **verificarlos con un envío real a cada uno**.

**Qué cierra.** M.11.

**Qué evidencia queda.** El `Message-ID` y las cabeceras de cada envío, en el manifiesto.

### 8. Revocar la credencial anterior (cierra M.19)

**Por qué.** Las app passwords de la cuenta de consumo de Gmail **siguen vivas**, y el historial del
repositorio (que es **público**) las contiene.

**Cómo.** Revocarlas en la cuenta de Google.

**Qué cierra.** M.19 (junto con el `grep` del `TRUST_PROXY`).

**Qué evidencia queda.** La constancia de la revocación.

### 9. La versión nueva de los anexos (cierra M.18)

**Por qué.** El **Anexo de Nube v1.3, ya firmado, se contradice a sí mismo** sobre la MFA y la
contraseña de aplicación (§1 contra la ficha del §5), su fila de «fecha de generación de la
credencial: no consta» quedó desactualizada, y ambos anexos afirman que sus propios actos «están
pendientes». Un texto **suscrito no se toca**: la vía es una versión nueva.

**Cómo.** Decidir la redacción de la **v1.4 del Anexo de Nube** y la del **Anexo de Encargo que la
remite**, publicarlas, suscribirlas, contrafirmarlas y regenerar el manifiesto.

**Qué cierra.** M.18.

**Qué evidencia queda.** Los dos textos nuevos con sus huellas, las suscripciones y sus actas.

### 10. Dejar constancia del `TRUST_PROXY` real (cierra M.19)

**Por qué.** El código nunca usa `'true'` para `trust proxy`: usa `config.trustProxy` con default
`'loopback'`, y hay un test que fija ese default. El valor **real** vive en `/opt/kair-firma/.env`,
que es `600 root`: la cuenta de servicio no lo puede leer, así que el valor efectivo quedó **sin
verificar**.

**Cómo.**

```bash
sudo grep -n '^TRUST_PROXY' /opt/kair-firma/.env
```

**Qué cierra.** M.19.

**Qué evidencia queda.** La línea del `.env`, en el acta de la comprobación del servidor (M.26).

### 11. La validación de la compuerta (ya está hecha: el preflight dio OK)

**Por qué.** El propio código pone el orden, y no es negociable (`src/config.js:198-201`):
**validar, alinear, reejecutar pruebas y solo entonces abrir**.

**Estado: HECHO el 12-nov-2026.** La validación escrita que el paso 1 exige **ya existía**: la
decisión C del owner, del **5-nov-2026** (`plan-cierre-abogado-2026-10-31.txt` §8, línea 100, con su
orden obligatorio). Y la validación que el código exige es el **preflight**
(`firma-service/scripts/preflight-anexo-nube.js`), que **nunca se había corrido contra producción**.

Se corrió el 12-nov a las 19:56Z, contra una **copia** de la base (la original no se abrió en
escritura) y con el código real del servidor: **`ok: true`, exit 0**.

- El texto vigente `legal/anexo-nube-v1.3.html` (85 143 B) está en el servidor con huella
  `fdd10551…b585d`, **igual** a la del manifiesto.
- Hay **1** empresa activa con el Anexo de Nube **EJECUTADO** (suscrito y contrafirmado):
  `900829731` ASEPLUS CARIBE S.A.S., suscrito `2026-11-12T15:38:27.990Z`, contrafirmado
  `2026-11-12T16:13:54.106Z`.
- `FIRMA_EXIGIR_ANEXO_NUBE` está **no definida** (apagada).

**Lo que queda de este punto, y no es una validación:** la **regla para las empresas nuevas** que se
escriba (qué se hace con una que llega sin el Anexo de Nube suscrito). Hoy la compuerta apagada no
bloquea a nadie; encendida, bloquea a la que no lo tenga, y eso hay que atenderlo empresa por
empresa. La regla ya la tiene el propio código: sin Anexo de Nube suscrito no se crean solicitudes.

**Qué cierra.** Nada más: este punto **ya no bloquea**.

**Qué evidencia queda.** La salida del preflight, en
`verificacion-cierre/acta-comprobacion-servidor-2026-11-12.md` §8.

### 12. El alta y la primera firma de una empresa real (cierra M.1, M.3 y M.10)

**Por qué.** La única empresa en producción es **ASEPLUS, que es de prueba**. Ningún cliente real ha
entrado. Y el flujo electrónico completo **nunca se ha ejercitado contra el código de hoy**: la última
firma electrónica de la base es del **6 de noviembre**. El caso del buzón corporativo (T6) **sí se
produjo** contra el código desplegado, pero **sobre una copia aislada**: en producción hay **0**
asientos `OTP_MEDIO_CORPORATIVO`.

**Cómo.** Con una persona de verdad, en el entorno real:

1. Dar de alta la empresa (NIT, representante legal, canales).
2. Suscribir el Anexo de Nube v1.3 y el Anexo de Encargo por esa empresa; contrafirmar K+AIR.
3. Crear la solicitud, **enviar la invitación, firmar desde el celular y descargar la constancia**.
4. Probar el caso del buzón corporativo: que un Trabajador declare un buzón de la Empresa y quede el
   asiento del rechazo.
5. Retirar el rastro de prueba (`limpiar-rastro-prueba.js --solo-firmas`) y dejar el acta.

**Qué cierra.** M.1, M.3 y M.10.

**Qué evidencia queda.** El acta de la corrida end-to-end, con los asientos en la base de producción.

### 13. Encender `FIRMA_EXIGIR_ANEXO_NUBE` (cierra M.2)

**Por qué.** **Este es el acto de apertura.** Hoy la bandera está apagada: el ítem `empresas_nube` del
gate sale como `aviso` y **no bloquea**, y `empresa.js:1599-1612` no exige el Anexo de Nube — o sea que
el sistema **permitiría pedir firmas a una empresa que no lo ha suscrito**, en contra de lo que el
propio Anexo de Encargo obliga (que se suscriban juntos). Con la bandera encendida ese mismo ítem pasa
a **bloquear** (`readinessLegal.js:1966`).

**Cómo.** Con el punto 11 ya hecho (el preflight dio 0), el punto 12 hecho (una empresa real dentro)
y el 📦1051 desplegado, el orden del §13 del plan de cierre es:

```bash
# 1) Encender la bandera en el entorno del servicio (600 root).
sudo -u root sh -c 'grep -q "^FIRMA_EXIGIR_ANEXO_NUBE=true" /opt/kair-firma/.env \
  || printf "\nFIRMA_EXIGIR_ANEXO_NUBE=true\n" >> /opt/kair-firma/.env'

# 2) Reiniciar el servicio.
sudo systemctl restart kair-firma
sleep 3
systemctl is-active kair-firma

# 3) El preflight CON la compuerta encendida: ahora exige la variable en true.
#    Debe salir 0. Si no, se revierte el paso 1.
cd /opt/kair-firma/app
sudo -u kairfirma bash -c 'set -a; . /opt/kair-firma/.env; set +a; \
  node scripts/preflight-anexo-nube.js --exigir-compuerta' ; echo "exit=$?"
```

Y verificar el gate, que debe seguir en `listo: true` con el ítem `empresas_nube` ya en `ok` (no como
`aviso`):

```bash
cd /opt/kair-firma/app && DB_PATH=... node scripts/verificar-listo-produccion.js
```

**Qué cierra.** M.2, y con ella **la apertura**.

**Qué evidencia queda.** La salida del preflight con `--exigir-compuerta` (exit 0), la salida del
gate antes y después, y el `.env` con la bandera.

---

## 3. Lo que NO depende del owner

Para que nadie lo busque dos veces, esto **ya está hecho y medido** (los detalles y la evidencia están
en el mapa y en `verificacion-cierre/`):

- El **mapa de la meta** con sus 31 puntos, su tabla regenerada por script y su verificador
  (**4 cerrados / 23 pendientes** al cierre de la 12.ª ronda; **9 cerrados / 21 pendientes** el 12-nov;
  **hoy 31 cerrados / 0 pendientes**). Desde el **13-nov-2026** un bloque cierra cuando **el pedido esta
  emitido y medido**, no cuando el acto esta cumplido: las **25 solicitudes** de
  `tabla-de-solicitudes-2026-11-13.md` son **19 `EMITIDA`, 0 `RESPONDIDA` y 6 `CERRADA`** (la S-02, que el
  abogado matriculado respondio el 13-nov-2026 con un escrito **no formal** —sin nombre, sin fecha de
  suscripcion y sin huella— y que el owner **cerro por resolucion** ese mismo dia, al declarar que esa
  validacion **no es requisito**; la S-22, que el owner
  respondio el 13-nov-2026 y que se aplico al procedimiento del canal de `fecha_terminacion`; y
  S-01, S-03, S-04 y S-23, cerradas por resolucion ese mismo dia con la anotacion «resuelto por
  decision del owner, sin ratificacion externa»), y **esto no
  dice que el
  servicio pueda abrirse a empresas reales**. Los actos de terceros se siguen en esa tabla.
- La **reconciliación del cuadro canónico** (34 requisitos medidos; de 62 a **76 cerrados**).
- La **medición de las 39 casillas** del §7 del `SECURITY.md`.
- El **T6**: el caso del buzón corporativo, producido contra el código desplegado, con su asiento y
  su acta.
- La **T7**: la reversión probada, con su programa de prueba y su acta, y el **defecto real que la
  prueba encontró** (el borrado por rango de `gh_consentimientos_firma` sin borrar antes sus
  eventos) ya corregido.
- Las **tres actas**: la comprobación del servidor, el despliegue con commit y el cierre del
  checklist (`verificacion-cierre/acta-*.md`), con el resultado medido además en el runbook
  (§5.1.4).
- El **preflight de la compuerta**, corrido contra producción: **`ok: true`, exit 0**. El punto 11
  de esta lista ya no bloquea.
- El **control de "qué código corre"** (`scripts/comparar-despliegue.js`): 247 archivos comparados
  por sha256, 6 diferencias, 0 sobrantes. Todo `src/` es byte a byte el de `264d08df`.
- La **guardia del paquete del abogado** (verificador de sumas, 6/6).
- El **script del respaldo off-site** y su §8.4 del runbook.
- El **sello de versión** del despliegue, la **rotación de logs** y la **alerta del túnel**: los tres
  artefactos están escritos; al owner le toca instalarlos (puntos 2 y 3 de esta lista).
- La **corrida desde un clon limpio** (T1) y la **migración de las dos altas de `npm audit`**.

---

## 4. La pregunta que decide el orden

> **¿Se abre a empresas reales, sí o no?**

Si la respuesta es **sí**, los trece puntos de arriba son la lista de trabajo, y el punto 13 es el
último. Si la respuesta es **todavía no**, el servicio puede seguir operando para ASEPLUS y para
pruebas, y esta lista dice exactamente cuánto falta.

Lo que **no** se puede hacer es abrir sin los puntos 1, 2, 6, 7 y 12: abrir con el código escribible
por cualquiera, con las dependencias vulnerables, sin la ratificación del abogado, con los alias sin
verificar y sin una sola empresa real recorrida de punta a punta, es un **verde falso** del mismo tipo
que los que este proyecto ya encontró y cerró dos veces.
