# Acta de despliegue (requisito 8.8 del cuadro canonico)

**Fecha de la medicion.** 12-nov-2026, 19:52Z a 19:57Z (hora de Colombia: 14:52 a 14:57).
**Responsable.** Equipo de K+AIR, por SSH en modo de solo lectura contra `kair-server`
(`javier@192.168.1.11`), contrastando con el repositorio en `264d08df`.
**Que se midio.** Que commit esta desplegado, con que resultados y con que despliegue.

---

## 1. Que commit esta desplegado

El despliegue de la firma electronica se hace **copiando archivos**: el servidor no tiene `.git`
(medido: `/opt/kair-firma/.git` no existe). El `git log` del servidor no existe, y el manifiesto
`legal-readiness.json` describe los TEXTOS, no el codigo.

La identificacion se hizo comparando el sha256 de cada archivo desplegable del repositorio con el
de los mismos archivos en el servidor:

| Medida | Valor |
|---|---|
| Commit del repositorio | `264d08df` (📦1052, «se corrigen las filas que describian un estado que ya no existe») |
| `origin/Dev` | `264d08df` (identico) |
| Archivos en comun | **247** |
| Archivos que difieren | **6** |
| Sobrantes en el servidor | **0** |

**El codigo de runtime que corre es byte a byte el de `264d08df`.** Lo unico que no esta desplegado
es:

| Archivo | Por que |
|---|---|
| `package.json` | el 📦1051 (bump de `express`, `proxy-addr` y `qs`) no se ha desplegado |
| `package-lock.json` | ídem |
| `scripts/actualizar-manifiesto-1047.js` | script auxiliar, version vieja |
| `scripts/actualizar-manifiesto-v1.6.js` | script auxiliar, version vieja |
| `deploy/setup-vm.sh` | script de despliegue, no es runtime |
| `deploy/README-DESPLIEGUE.md` | documentacion |

Los 201 archivos del repositorio que no estan en el servidor son **tests, scripts nuevos y
documentacion**: no forman parte del runtime y su ausencia es lo correcto.

**Como queda la frase del 8.8.** El requisito pide registrar «los resultados reproducidos para el
commit y el despliegue que finalmente se autoricen». Con esta medicion, la frase exacta es: **el
codigo de `264d08df` esta desplegado, salvo el bump de dependencias del 📦1051**. No es un «todo o
nada»: es un commit desplegado con una excepcion named, y la excepcion se puede medir en cualquier
momento con `firma-service/scripts/comparar-despliegue.js`.

## 2. Resultados con que se midio

| Control | Resultado | Cuando |
|---|---|---|
| Suite completa del repositorio | **2 624 pruebas · 2 622 verdes · 0 rojas · 2 omitidas** | 12-nov-2026 |
| Gate `publicacion` | **LISTO** · 42 items · 40 ok · 0 pendientes · 1 aviso · 1 no aplica · **0 bloqueantes** | 12-nov-2026 18:33Z |
| Gate `primera_firma` | mismo resumen, 0 bloqueantes | 12-nov-2026 |
| Migraciones aplicadas | 61, la ultima `062_encargado_poderes_append_only` | 12-nov-2026 |
| `GET /health` | `status: ok`, `db: ok`, `smtp: configured` | 12-nov-2026 19:52Z |
| Servicio | `active` / `enabled`, `NRestarts: 0` | 12-nov-2026 19:52Z |
| Manifiesto | `191c08b837b41069de4e2d25d7158fd90a7c3ce5f93b22696d2d7050f8a4013f`, **byte a byte igual** al del repo | 12-nov-2026 |
| Textos en disco | Acuerdo v1.6 `08e1eb8b…f13e`; Nube v1.3 `fdd10551…b585d`; Encargo `6308b1f7…b8948` | 12-nov-2026 |
| Preflight del Anexo de Nube | **`ok: true`, exit 0** | 12-nov-2026 19:56Z |

**Sobre el `/health`:** devuelve `version: "0.1.0"` y `kair_version: "compatible-0.1.189"`, que es un
valor **fijo**. No sirve como prueba de que se desplego algo; la comparacion por sha256 si.

## 3. Que NO quedo desplegado, y por que

El 📦1051 (`dfc403b0`, 12-nov 13:05) sube `express` a 4.22.3, `proxy-addr` a 2.0.8 y `qs` a 6.16.2.
**No esta en produccion**: el servidor sigue con `express 4.22.2`, `proxy-addr 2.0.7` y `qs 6.15.3`.

La razon es una y es concreta: **el runbook de despliegue no instala dependencias**. El tar lleva
`package.json` y `package-lock.json` pero no `node_modules`, y los pasos de §5.1 no corren `npm
install` ni `npm ci`. Sin ese paso, un despliegue deja el codigo nuevo con las librerias viejas, y
**el `npm audit` del servidor no lo delata y el servicio parece sano**.

El paso que faltaba ya esta escrito en `MIGRACION-SERVIDOR-FIRMA.md` §5.1 (agregado el 12-nov):
`npm ci --omit=dev` con el servicio parado, antes de las migraciones.

## 4. Que falta para que esta acta sea completa

1. **Desplegar el 📦1051** con el paso de instalacion, y volver a medir las versiones en el servidor.
   Acto del owner (`sudo`).
2. **Volver a medir con la bandera encendida.** El preflight de esta acta se corrio **sin**
   `--exigir-compuerta` porque la variable esta apagada; con la bandera encendida hay que correrlo
   con esa bandera y tiene que dar 0. Acto del owner (encender) con el equipo (correrlo).
3. **T1 (corrida desde clon limpio)**: se esta ejecutando en paralelo; su acta va aparte.
4. **T8 (autorizacion operativa firmada)**: documento firmado, distinto de la Constancia. Es un acto
   de voluntad del owner y **no lo puede firmar nadie mas**.

## 5. Comandos para reproducir

```bash
# Manifiesto del servidor (solo lectura)
cd /opt/kair-firma/app
find . -type f -not -path './node_modules/*' -not -path './data/*' -not -path './storage/*' \
  -not -path './logs/*' -not -path './backups/*' -not -name '*.enc' -not -name '*.pdf' -not -name '*.log' \
  -print0 | xargs -0 sha256sum | sed 's#  \./#  #' | LC_ALL=C sort > /tmp/manifiesto-servidor.txt

# Comparacion (en el PC)
node firma-service/scripts/comparar-despliegue.js \
  --repo <ruta>/sgsst-electron-app/firma-service \
  --servidor <manifiesto-servidor.txt>
# Codigo 1 y nombres de los archivos que difieren mientras haya diferencias.

# Versiones realmente instaladas en el servidor
node -e "for (const p of ['express','proxy-addr','qs','nodemailer','zod']) {
  console.log(p, require('/opt/kair-firma/app/node_modules/'+p+'/package.json').version);
}"
```

## 6. Acta relacionada

`acta-comprobacion-servidor-2026-11-12.md` (requisito 7.13), de la misma medicion.
