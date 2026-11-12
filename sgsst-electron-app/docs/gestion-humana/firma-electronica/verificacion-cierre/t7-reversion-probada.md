# T7 - El procedimiento de reversion de la firma, probado: que se borra, que se restaura y que evidencia queda

**Que se corrio.** La prueba controlada que el T7 pide: el programa de reversion del
repositorio (`scripts/limpiar-rastro-prueba.js`) ejecutado contra una **base aislada** con
filas **sinteticas**. Se midieron los dos caminos del programa (el que se niega y el que
borra), que se borra en verdad, que la base queda consistente, que el respaldo anterior se
restaura con el mismo contenido, y que evidencia queda escrita.

**Este acta tiene dos corridas.** La primera (14:57:07) se hizo contra el programa que
estaba **desplegado** en el servidor. Al reproducir a proposito el caso del consentimiento
**con eventos**, se **encontro un defecto** en ese programa: la limpieza por rango abortaba
con `FOREIGN KEY constraint failed`. El owner **corrigio** el programa en el repositorio. La
segunda corrida (15:16:27), que es la que **cierra este acta**, se hizo contra el programa
**corregido**, y el defecto ya no aparece. Las dos corridas y la comparacion A/B estan en la
sec. 10.

**Fecha.** 12-nov-2026. La corrida que cierra el acta es la de las **15:16:27** (hora de
Colombia); su salida completa esta en `/tmp/kair-t7/salida-t7-v2.txt` en el servidor y en
`/tmp/kair-t7-reversion/evidencia.txt`.

**Donde esta lo entregado.**
- El programa de prueba: `sgsst-electron-app/firma-service/scripts/probar-reversion.js`
  (sha256 `49b8a7a1d22a8d851b7e63cec4a9fd8e9e37aa6984bc5b380f1e6a652d7d9847`).
- El test: `sgsst-electron-app/firma-service/tests/scripts/probar-reversion.test.js`.
- Este acta: `sgsst-electron-app/docs/gestion-humana/firma-electronica/verificacion-cierre/t7-reversion-probada.md`.

Los dos primeros son **nuevos**: no se modifico ningun script existente. El programa de
prueba sigue el patron de `scripts/probar-t6-medio-corporativo.js`: el mismo esqueleto, la
misma cabecera que dice que prueba, por que existe y **que no prueba**, los mismos codigos
de salida, y la misma regla de `sin --confirmar-escribe el script no escribe nada`.

---

## 1. El requisito y el item que se mueven

| Que | Donde | Estado |
|---|---|---|
| **T7** - "Procedimiento de reversion probado, con que se restaura y acta de reversion" | `docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/10-informe-correcciones-para-asesor-juridico.md:136` | La fila decia "**PENDIENTE: depende del servidor.** Los programas de reversion existen en el repositorio; la prueba y el acta no". **La prueba y el acta existen** (este documento). Queda pendiente la corrida contra una fila real y la restauracion cifrada: ver sec. 9. |
| **7.14** - "Preparar un procedimiento de reversion o suspension - CERRADO" | `docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md:2067-2075` | Esta ya estaba cerrada por el **rollback por fases** de `plan-seguridad-2026-10-25.md` (suspension del servicio, reinstalacion del paquete anterior, restauracion desde el respaldo de las 22:00 del dia anterior). **Lo que faltaba era la parte de reversion del CONTENIDO** (la fila de la base), y eso es lo que este acta mide. |

La fila T7 pide dos cosas concretas del abogado: **que se restaura** (la version anterior
del Acuerdo y el catalogo de conservacion) y un **acta de reversion**. Las dos quedan
respondidas con mediciones en las sec. 5 y 6.

---

## 2. El codigo que se ejercito

El codigo que corre el programa de reversion es **byte a byte igual** al del repositorio en
la rama `Dev`: el *shadow* que se uso en el servidor (sec. 3) tiene el `src` y los
`fixtures` del despliegue, y solo el programa cambiado. Medido con SHA-256:

| Archivo | SHA-256 |
|---|---|
| `scripts/limpiar-rastro-prueba.js` **bajo prueba** (el del repo, con la correccion del owner) | `4e8b3e9bcc4b9fd23a4bf3c8ea19f5d1d8bdc1f0b8a3b7d7be9347889fb904b0` |
| `scripts/limpiar-rastro-prueba.js` **desplegado** en `/opt/kair-firma/app` (el de antes de la correccion) | `a1f3e76b7e390fcbbc048807f519a74a2f2b664a462e559baac5582aa7f27175` |
| `deploy/probar-restauracion.sh` (la prueba de restauracion cifrada), repo = desplegado | `cc9adc2a58313fb60bae695154ee31fac2997f7f157261bd46553cc268f1c958` |

**El arbol desplegado todavia no tiene la correccion**: por eso el programa bajo prueba
se copio a un *shadow* en `/tmp` (sec. 3) y la corrida lo dice en voz alta:

```
  [AVISO]  El programa bajo prueba NO es el que esta desplegado :: bajo prueba = /tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js :: sha256=4e8b3e9bcc4b9fd23a4bf3c8ea19f5d1d8bdc1f0b8a3b7d7be9347889fb904b0 :: desplegado = /opt/kair-firma/app/scripts/limpiar-rastro-prueba.js :: sha256=a1f3e76b7e390fcbbc048807f519a74a2f2b664a462e559baac5582aa7f27175 :: el arbol desplegado todavia no trae esta version
```

El programa de reversion que se ejecuto **no se reimplemento ni se reescribio**: se invoco
tal cual, con su propio `DB_PATH` apuntando a la copia. Lo unico que cambio entre las dos
corridas es el archivo corregido del repo.

Lo que el codigo exige como evidencia (y por eso se midio):

- `src/services/retencion.js` (catalogo de conservacion; la migracion 049 deja en la fila
  la regla que se aplico: `categoria_conservacion`, `regla_retencion`,
  `plazo_conservacion_*`, `fecha_inicio_conservacion`, y esas columnas **no se recalculan**).
- `SECURITY.md` T.5: la ventana de purga es la unica via por la que el registro de
  auditoria puede tocarse; el **hold frena siempre**; la ventana, el lote y la purga quedan
  en `gh_firma_purga_log` y el **recibo por firma** en `gh_firma_purga_registro`, ambos
  append-only y sin datos personales.
- `SECURITY.md` T.8: la 5B (`src/services/supresion.js`) es la capa que borra de verdad;
  su **lapida** (`gh_firma_purgadas`) y su recibo son append-only, y la **prueba de la
  aceptacion sobrevive** a la supresion porque vive en `gh_consentimientos_firma`.

---

## 3. Como se corrio (los comandos, textuales)

El programa de reversion se invoco con **llaves propias de la corrida** y
`NODE_ENV=development` (modo desarrollo: no sale ningun correo y no se toca el SMTP de
produccion). La base que recibe es una **copia aislada** con la semilla sintetica, creada
por el propio programa de prueba con las migraciones desplegadas.

**a) El shadow (para medir la correccion sin tocar el despliegue):**

```bash
APP=/opt/kair-firma/app
S=/tmp/kair-t7/app
mkdir -p "$S/scripts"
ln -sfn "$APP/src" "$S/src"
ln -sfn "$APP/config" "$S/config"
ln -sfn "$APP/node_modules" "$S/node_modules"
ln -sfn "$APP/scripts/fixtures" "$S/scripts/fixtures"
scp scripts/limpiar-rastro-prueba.js javier@192.168.1.11:"$S/scripts/limpiar-rastro-prueba.js"
```

El `src`, el `config` y los `fixtures` del shadow son **enlaces al despliegue**: lo unico
que se substituye es el programa corregido. El `diff` entre el desplegado y el corregido
salio **solo** con la correccion del owner (sec. 10).

**b) El programa de prueba, en una base AISLADA:**

```bash
node /tmp/kair-t7/probar-reversion.js \
  --db=/tmp/kair-t7-reversion/reversion.sqlite \
  --trabajo=/tmp/kair-t7-reversion \
  --app-dir=/tmp/kair-t7/app \
  --programa=/tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js \
  --programa-desplegado=/opt/kair-firma/app/scripts/limpiar-rastro-prueba.js \
  --preparar \
  --confirmar-escribe
```

`--preparar` aplica las migraciones del repo sobre la base nueva y siembra la escena
sintetica: Empresa `900000001`, firma `SIGN-T7-PRUEBA-0001`, 3 eventos, 1 sesion, 1 token,
1 hold automatico `deber_legal_2.2.1.1.12 del Decreto 1072 de 2015` de actor `sistema`, 1
fila en `gh_firma_firmas_papel`, 1 consentimiento v1.0 **con su evento** en
`gh_consentimientos_eventos` (esta fila es la que hace que la limpieza por rango tenga que
borrar el hijo antes que el padre: ver sec. 10), las versiones del Acuerdo v1.0 (hash
`aaaa...`) y v1.6 (hash `bbbb...`, activa), y un PDF sintetico en disco.

**c) Lo que el programa de reversion ejecuta por dentro** (el `DB_PATH` y las llaves son
los de la corrida; el comando literal queda impreso en la salida, sec. 4):

```bash
cd /tmp/kair-t7/app
NODE_ENV=development DB_PATH=/tmp/kair-t7-reversion/reversion.sqlite \
  INTERNAL_API_KEY=llave-de-prueba-t7 ADMIN_API_KEY=llave-de-prueba-t7 \
  SMTP_HOST=localhost SMTP_USER=prueba-t7 SMTP_PASS=prueba-t7 \
  SMTP_FROM_EMAIL=prueba-t7@example.invalid PUBLIC_URL=http://127.0.0.1:8999 \
  node scripts/limpiar-rastro-prueba.js \
    --actor="Prueba T7" --motivo="Prueba controlada T7" --hasta=2026-12-31 --version=v1.0 --ejecutar
```

y, en el segundo caso, con `--forzar-hold` delante de `--ejecutar`.

**d) El respaldo y la restauracion** (los comandos que el programa imprime y ejecuta):

```bash
sqlite3 "/tmp/kair-t7-reversion/reversion.sqlite" ".backup '/tmp/kair-t7-reversion/antes.sqlite'"
sqlite3 "/tmp/kair-t7-reversion/restaurada.sqlite" ".restore '/tmp/kair-t7-reversion/antes.sqlite'"
sqlite3 -readonly /opt/kair-firma/data/firma.sqlite ".backup '/tmp/kair-t7-reversion/produccion-copia.sqlite'"
```

**e) La comprobacion de que PRODUCCION no se toco**: `sqlite3 -readonly` para leerla,
`systemctl show kair-firma -p MainPID -p NRestarts -p ActiveEnterTimestamp` y
`journalctl -u kair-firma --since "<marca>" --no-pager`.

**No se uso `sudo`, no se paro ni se reinicio el servicio, no se modifico ningun archivo de
produccion y no se borro nada del servidor.**

---

## 4. La salida medida (la corrida que cierra el acta)

`RESUMEN: 58 OK - 3 avisos - 0 fallas` - **codigo de salida 0**.

```
== T7 - REVERSION DE LA FIRMA (AMBIENTE REAL, COPIA AISLADA) =================
  base AISLADA : /tmp/kair-t7-reversion/reversion.sqlite
  trabajo      : /tmp/kair-t7-reversion
  produccion   : /opt/kair-firma/data/firma.sqlite (SOLO LECTURA)
  programa     : /tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js

== FASE 0 - EL ENTORNO =======================================================
  [OK]    sqlite3 esta disponible :: 3.45.1 2024-01-30 16:01:20 e876e51a0ed5c5b3126f52e532044363a014bc594cfefa87ffb5b82257ccalt1 (64-bit)
  [OK]    El programa de reversion BAJO PRUEBA :: /tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js :: sha256=4e8b3e9bcc4b9fd23a4bf3c8ea19f5d1d8bdc1f0b8a3b7d7be9347889fb904b0
  [AVISO]  El programa bajo prueba NO es el que esta desplegado :: bajo prueba = /tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js :: sha256=4e8b3e9bcc4b9fd23a4bf3c8ea19f5d1d8bdc1f0b8a3b7d7be9347889fb904b0 :: desplegado = /opt/kair-firma/app/scripts/limpiar-rastro-prueba.js :: sha256=a1f3e76b7e390fcbbc048807f519a74a2f2b664a462e559baac5582aa7f27175 :: el arbol desplegado todavia no trae esta version
  [OK]    La base AISLADA quedo preparada :: /tmp/kair-t7-reversion/reversion.sqlite :: migraciones del repo + semilla sintetica (empresa 900000001, firma SIGN-T7-PRUEBA-0001)

== FASE 1 - EL ESTADO "ANTES" Y EL RESPALDO ==================================
  [OK]    El estado ANTES de la reversion (base AISLADA) :: gh_firmas_electronicas=1 - gh_firma_eventos=3 - gh_firma_sesiones=1 - gh_firma_tokens=1 - gh_firma_holds=1 - gh_firma_firmas_papel=1 - gh_consentimientos_firma=1 - gh_consentimientos_eventos=1 - gh_firma_acuerdo_versiones=2 - gh_firma_purga_log=0 - gh_firma_purga_registro=0 - gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 - gh_firma_purga_lote=0
  [OK]    La base AISLADA estaba integra :: integrity_check=ok
  [OK]    La base AISLADA no tenia llaves rotas :: foreign_key_check=0 filas
  [OK]    El volcado canonico ANTES :: sha256 del .dump = ff4427dc72fd031b569480da7cebb5bc93447f3adb6c14d3feb3799bc7478a34
  [OK]    El hash del ARCHIVO ANTES :: sha256 del archivo = ab73c8576cde0e476bbb958f5f79c8d4884e39bd2c2333695a96b590431755a7
  [OK]    El respaldo captura el mismo contenido :: sha256 del .dump del respaldo = ff4427dc72fd031b569480da7cebb5bc93447f3adb6c14d3feb3799bc7478a34 (identico al de la base)
  [OK]    El hash del ARCHIVO del respaldo es DISTINTO al de la base :: respaldo = 5637f43315a7db793d29fb2a4174fa3a2b60ca6328d08e3e7111b6755e4e8364 :: base = ab73c8576cde0e476bbb958f5f79c8d4884e39bd2c2333695a96b590431755a7 :: el mismo contenido con distinta huella de archivo (por eso la comparacion honesta es la del volcado canonico)
  [OK]    El respaldo de esta corrida quedo en :: /tmp/kair-t7-reversion/antes.sqlite :: comando: sqlite3 "/tmp/kair-t7-reversion/reversion.sqlite" ".backup '/tmp/kair-t7-reversion/antes.sqlite'"
  [OK]    El estado ANTES de PRODUCCION (solo lectura) :: gh_firmas_electronicas=5 - gh_firma_eventos=55 - gh_firma_sesiones=5 - gh_firma_tokens=6 - gh_firma_holds=5 - gh_firma_firmas_papel=1 - gh_consentimientos_firma=3 - gh_consentimientos_eventos=0 - gh_firma_acuerdo_versiones=4 - gh_firma_purga_log=7 - gh_firma_purga_registro=13 - gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 - gh_firma_purga_lote=0 :: volcado=d90b347e080eb8be0f2c0aabdf2794e27314093c00ce560163940b97d1f20d2b

== FASE 2 - CASO A - LA REVERSION SIN --forzar-hold (TIENE QUE NEGARSE) ======
  [OK]    Comando del caso A :: node /tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js "--actor=Prueba T7" "--motivo=Prueba controlada T7" --hasta=2026-12-31 --version=v1.0 --ejecutar
  [OK]    El programa se NEGO a tocar la base :: codigo de salida 4 :: 4
  [OK]    El programa lo dice explicitamente :: la salida trae "NO SE TOCA NADA"
  [OK]    La negativa dice POR QUE (el hold) :: la salida menciona el hold
  [OK]    La base NO cambio nada con la negativa :: volcado canonico = ff4427dc72fd031b569480da7cebb5bc93447f3adb6c14d3feb3799bc7478a34 (identico al de antes)
  [OK]    Ninguna tabla cambio de conteo con la negativa :: gh_firmas_electronicas=1 - gh_firma_eventos=3 - gh_firma_sesiones=1 - gh_firma_tokens=1 - gh_firma_holds=1 - gh_firma_firmas_papel=1 - gh_consentimientos_firma=1 - gh_consentimientos_eventos=1 - gh_firma_acuerdo_versiones=2 - gh_firma_purga_log=0 - gh_firma_purga_registro=0 - gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 - gh_firma_purga_lote=0

== FASE 3 - CASO B - LA REVERSION CON --forzar-hold (TIENE QUE BORRAR Y DEJAR RECIBO) ====
  [OK]    Comando del caso B :: node /tmp/kair-t7/app/scripts/limpiar-rastro-prueba.js "--actor=Prueba T7" "--motivo=Prueba controlada T7" --hasta=2026-12-31 --version=v1.0 --forzar-hold --ejecutar
  [OK]    El programa termino bien :: codigo de salida 0
  [OK]    El estado DESPUES de la reversion :: gh_firmas_electronicas=0 - gh_firma_eventos=0 - gh_firma_sesiones=0 - gh_firma_tokens=0 - gh_firma_holds=0 - gh_firma_firmas_papel=0 - gh_consentimientos_firma=0 - gh_consentimientos_eventos=0 - gh_firma_acuerdo_versiones=1 - gh_firma_purga_log=2 - gh_firma_purga_registro=1 - gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 - gh_firma_purga_lote=0
  [OK]    Lo que dice borrar, lo borro :: "firmas eliminadas" :: el programa informo 1 y la base perdio 1 fila(s) de gh_firmas_electronicas
  [OK]    Lo que dice borrar, lo borro :: "eventos eliminados" :: el programa informo 3 y la base perdio 3 fila(s) de gh_firma_eventos
  [OK]    Lo que dice borrar, lo borro :: "sesiones eliminadas" :: el programa informo 1 y la base perdio 1 fila(s) de gh_firma_sesiones
  [OK]    Lo que dice borrar, lo borro :: "tokens eliminados" :: el programa informo 1 y la base perdio 1 fila(s) de gh_firma_tokens
  [OK]    Lo que dice borrar, lo borro :: "holds eliminados" :: el programa informo 1 y la base perdio 1 fila(s) de gh_firma_holds
  [OK]    Lo que dice borrar, lo borro :: "firmas en papel borradas" :: el programa informo 1 y la base perdio 1 fila(s) de gh_firma_firmas_papel
  [OK]    Lo que dice borrar, lo borro :: "consentimientos" :: el programa informo 1 y la base perdio 1 fila(s) de gh_consentimientos_firma
  [OK]    Lo que dice borrar, lo borro :: "eventos de consentimiento" :: el programa informo 1 y la base perdio 1 fila(s) de gh_consentimientos_eventos
  [OK]    El programa informo "archivos eliminados" :: 1 :: el archivo del PDF sintetico
  [OK]    La version de prueba del Acuerdo quedo retirada :: v1.0 ya no esta
  [OK]    La version VIGENTE del Acuerdo sigue publicada :: activa = v1.6 :: la reversion no rompio el texto legal
  [OK]    La base quedo integra despues de la reversion :: integrity_check=ok
  [OK]    La base no quedo con llaves rotas :: foreign_key_check=0 filas
  [OK]    La base sigue abriendose :: sqlite_master tiene 163 objetos
  [OK]    El trigger append-only quedo repuesto :: trg_firma_eventos_no_update
  [OK]    El trigger append-only quedo repuesto :: trg_firma_eventos_no_delete
  [OK]    El archivo del PDF de la prueba tambien se borro :: /tmp/kair-t7-reversion/pdfs/SIGN-T7-PRUEBA-0001.pdf ya no existe
  [OK]    Qedo el RECIBO por firma en gh_firma_purga_registro :: 1 fila(s) :: id=1 - firma_id=1 - actor=Prueba T7 - hold_verificado=1 - categorias=["PRUEBA_OPERATIVA"] - eventos_purgados=3
  [OK]    El recibo deja CONSTADO que se reviso el hold :: hold_verificado=1
  [OK]    El recibo deja POR QUE se forzo el hold :: motivo = Prueba controlada T7 | HOLD FORZADO en 1 fila(s) (id=1): nunca se firmo y el hold es el automatico (deber legal o plazo no declarado) | Esta fila tenia hold y se forzo: nunca se firmo y el hold es el automatico (deber legal o plazo no declarado)
  [OK]    Qedo el ASENTO append-only en gh_firma_purga_log :: 2 fila(s) :: LIMPIEZA_RASTRO_PRUEBA, LIMPIEZA_RASTRO_PRUEBA_ACUERDO
  [OK]    El asiento cuenta los holds revisados y los forzados :: hold_revisados=1 - hold_bloqueados=0
  [OK]    La 5B (supresion.js) no corrio y por eso no escribio su lapida :: gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 :: la lapida y el recibo de la 5B son de otra via (la ventana de purga), no de este programa

== FASE 4 - QUE SE RESTAURA (EL RESPALDO VUELVE) =============================
  [OK]    Se restauro el respaldo en otra base :: /tmp/kair-t7-reversion/restaurada.sqlite :: comando: sqlite3 "/tmp/kair-t7-reversion/restaurada.sqlite" ".restore '/tmp/kair-t7-reversion/antes.sqlite'"
  [OK]    El volcado canonico de la base RESTAURADA es IDENTICO al de origen :: sha256 = ff4427dc72fd031b569480da7cebb5bc93447f3adb6c14d3feb3799bc7478a34 (los dos)
  [OK]    La base restaurada tiene EXACTAMENTE lo que habia antes :: gh_firmas_electronicas=1 - gh_firma_eventos=3 - gh_firma_sesiones=1 - gh_firma_tokens=1 - gh_firma_holds=1 - gh_firma_firmas_papel=1 - gh_consentimientos_firma=1 - gh_consentimientos_eventos=1 - gh_firma_acuerdo_versiones=2 - gh_firma_purga_log=0 - gh_firma_purga_registro=0 - gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 - gh_firma_purga_lote=0
  [OK]    El respaldo devuelve la version anterior del Acuerdo :: vuelven las versiones v1.0, v1.6 (la de prueba v1.0 included)
  [OK]    El hash del ARCHIVO restaurado es DISTINTO (la trampa) :: restaurada = 5637f43315a7db793d29fb2a4174fa3a2b60ca6328d08e3e7111b6755e4e8364 :: origen = ab73c8576cde0e476bbb958f5f79c8d4884e39bd2c2333695a96b590431755a7 :: el CONTENIDO es el mismo (el volcado canonico coincide) pero la huella del archivo no: comparar por hash de archivo daria un falso negativo
  [OK]    El respaldo de PRODUCCION captura el mismo contenido :: sha256 del .dump de la copia = d90b347e080eb8be0f2c0aabdf2794e27314093c00ce560163940b97d1f20d2b (identico al de produccion)
  [OK]    La base de PRODUCCION restaurada es IDENTICA a produccion :: sha256 del volcado = d90b347e080eb8be0f2c0aabdf2794e27314093c00ce560163940b97d1f20d2b (los dos)
  [OK]    El hash del ARCHIVO de produccion es DISTINTO al de su respaldo :: produccion = 6c00afb540f3f0e55b4498ec800e7859ec717f565fcf34dd5fe794acf86e4371 :: respaldo = b61e947db0179210698c1e20176251e6b95c697b6cf7b93ba0fc8d0ba25b4994 :: mismo contenido, distinta huella de archivo

== FASE 5 - PRODUCCION INTACTA (SOLO LECTURA) ================================
  [OK]    Los conteos de PRODUCCION no cambiaron :: gh_firmas_electronicas=5 - gh_firma_eventos=55 - gh_firma_sesiones=5 - gh_firma_tokens=6 - gh_firma_holds=5 - gh_firma_firmas_papel=1 - gh_consentimientos_firma=3 - gh_consentimientos_eventos=0 - gh_firma_acuerdo_versiones=4 - gh_firma_purga_log=7 - gh_firma_purga_registro=13 - gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 - gh_firma_purga_lote=0
  [OK]    El volcado canonico de PRODUCCION no cambio :: sha256 = d90b347e080eb8be0f2c0aabdf2794e27314093c00ce560163940b97d1f20d2b
  [OK]    El servicio de produccion no se reinicio :: MainPID=281641 - NRestarts=0 - ActiveEnterTimestamp=Thu 2026-11-12 09:30:23 -05
  [OK]    El journal del servicio no tiene nada en la ventana de la prueba :: journalctl -u kair-firma --since "2026-11-12 15:16:27" :: -- No entries --

== FASE 6 - LA VIA CIFRADA DE LOS RESPALDOS (LO QUE NO SE PUEDE CORRER AQUI) ====
  [OK]    Los respaldos que hay en el servidor :: 55 linea(s) en /opt/kair-firma/backups :: total 7636 | -rw-r--r-- 1 root root   4127 nov 11 22:00 backup.log | -rw-r--r-- 1 root root    167 nov  6 16:33 firma-20261016-0250.sqlite.enc | -rw-r--r-- 1 root root  27511 nov  6 16:33 firma-20261021-020010.sqlite.enc
  [AVISO]  NO existe el log de la prueba de restauracion :: /opt/kair-firma/backups/restauracion.log :: la prueba de restauracion cifrada (deploy/probar-restauracion.sh) corre por el cron del dia 1 de cada mes; todavia no ha corrido
  [AVISO]  La restauracion CIFRADA no se puede correr con esta cuenta :: los .enc y la frase de cifrado son 600 root. Esta corrida comprueba la via de la copia limpia (.backup + .restore) con comparacion del volcado canonico, no la descifrado de gpg: esa queda pendiente de root

== LA EVIDENCIA ==============================================================
  [OK]    La evidencia quedo escrita :: /tmp/kair-t7-reversion/evidencia.txt

==============================================================================
RESUMEN: 58 OK - 3 avisos - 0 fallas
==============================================================================
--- exit del programa de prueba: 0 ---
```

### El texto literal de la negativa (CASO A), medido aparte

El programa imprime el plan y despues se niega. Salida completa del caso A, capturada
aparte el 12-nov-2026 a las 15:17 (hora de Colombia) con el programa **corregido**, sobre
una copia del estado ANTES. Los literales del servidor traen tildes y raya larga: aqui van
**transliterados a ASCII**, que es la regla de este acta.

```
{"timestamp":"2026-11-12T20:17:49.513Z","level":"info","message":"BD inicializada","env":"development","path":"/tmp/kair-t7-reversion/negativa-v2.sqlite","wal":"wal","foreignKeys":1}

=== LIMPIEZA DEL RASTRO DE PRUEBA ===
actor:  Prueba T7
motivo: Prueba controlada T7
corte:  2026-12-31 (nada mas nuevo se toca)
modo:   EJECUCION
alcance: filas de prueba + version del Acuerdo v1.0

--- Firmas a eliminar ---
  id=1 SIGN-T7-PRUEBA-0001 estado=PENDING empresa=900000001 creada=2026-11-01T10:00:00.000Z acuerdo=null hash=bbbbbbbbbbbb

--- Hold legal (deber de conservacion) ---
  id=1 SIGN-T7-PRUEBA-0001: hold vigente -- nunca se firmo y el hold es el automatico (deber legal o plazo no declarado)

--- Consentimientos a eliminar ---
  id=1 empresa=900000001 acuerdo=v1.0 aceptado=2026-11-01T10:08:00.000Z

--- Version del Acuerdo a eliminar ---
  v1.0 hash=aaaaaaaaaaaa activa=0 chars=51 creada=2026-11-01T09:00:00.000Z

--- Archivos a eliminar ---
  firma=1 pdf_original_path: /tmp/kair-t7-reversion/pdfs/SIGN-T7-PRUEBA-0001.pdf

=== NO SE TOCA NADA ===
  - 1 firma(s) tienen deber legal de conservacion (hold) que NO se puede forzar: id=1 (nunca se firmo y el hold es el automatico (deber legal o plazo no declarado)). Un hold impide destruir la prueba de una firma en discusion.
  - Si la fila nunca se firmo, el operador puede repetir el comando con --forzar-hold: el forzamiento queda escrito en el recibo con quien lo hizo y por que.
exit: 4
```

---

## 5. Que se toco y que no (comparacion de volcado canonico)

La comparacion honesta de dos bases es la del **volcado canonico** (`sqlite3 .dump`): el
hash del **archivo** cambia aunque el contenido sea el mismo, porque `.backup` reordena
las paginas.

| Medicion | Base AISLADA antes | Base AISLADA **revertida** | Base **restaurada** desde el respaldo | **PRODUCCION** (antes y despues) |
|---|---|---|---|---|
| `gh_firmas_electronicas` | 1 | **0** | 1 | **5** |
| `gh_firma_eventos` | 3 | **0** | 3 | **55** |
| `gh_firma_sesiones` | 1 | **0** | 1 | **5** |
| `gh_firma_tokens` | 1 | **0** | 1 | **6** |
| `gh_firma_holds` | 1 | **0** | 1 | **5** |
| `gh_firma_firmas_papel` | 1 | **0** | 1 | **1** |
| `gh_consentimientos_firma` | 1 | **0** | 1 | **3** |
| `gh_consentimientos_eventos` | 1 | **0** | 1 | **0** |
| `gh_firma_acuerdo_versiones` | 2 (v1.0, v1.6) | **1 (v1.6)** | 2 (v1.0, v1.6) | **4** |
| `gh_firma_purga_log` | 0 | **2** | 0 | **7** |
| `gh_firma_purga_registro` | 0 | **1** | 0 | **13** |
| SHA-256 del **volcado canonico** (`.dump`) | `ff4427dc...8a34` | `c6d78508...9b6e` | **`ff4427dc...8a34`** | **`d90b347e...d2b`** |
| SHA-256 del **archivo** | `ab73c857...55a7` | `74a9c18e...4dcd` | `5637f433...8364` | `6c00afb5...e4371` |

Lo que dice esa tabla:

- **La COPIA AISLADA cambio**: es la unica que perdio filas, y perdio exactamente las que
  el programa dijo que iba a perder (sec. 4, "Lo que dice borrar, lo borro"), **incluidos
  los eventos del consentimiento**, que antes hangueaban al padre por la FK. La version de
  prueba v1.0 del Acuerdo salio; **la vigente (v1.6) sigue activa**.
- **La base RESTAURADA es identica a la de antes** de la reversion: mismo volcado canonico
  (`ff4427dc...8a34`), mismos conteos, y **vuelve la version anterior del Acuerdo (v1.0)**.
- **PRODUCCION no cambio**: mismos conteos, mismo volcado canonico (`d90b347e...d2b`) antes y
  despues, y el archivo conserva su huella (`6c00afb5...e4371`) y su fecha de modificacion
  (`nov 11 12:13`).
- El **servicio** no se reinicio: `MainPID=281641`, `NRestarts=0`,
  `ActiveEnterTimestamp=Thu 2026-11-12 09:30:23 -05`. El `journalctl -u kair-firma` de la
  ventana de la prueba: **`-- No entries --`**.

### La trampa (esta es la parte que el acta tiene que dejar escrita)

**El hash del archivo NO sirve para comparar dos bases.** Medido en esta misma corrida, en
las dos bases:

| Base | SHA-256 del ARCHIVO | SHA-256 del volcado canonico |
|---|---|---|
| PRODUCCION | `6c00afb540f3f0e55b4498ec800e7859ec717f565fcf34dd5fe794acf86e4371` | `d90b347e080eb8be0f2c0aabdf2794e27314093c00ce560163940b97d1f20d2b` |
| Su respaldo (`.backup` de la misma base) | `b61e947db0179210698c1e20176251e6b95c697b6cf7b93ba0fc8d0ba25b4994` | **`d90b347e...d2b` (IDENTICO)** |
| La base AISLADA antes de la reversion | `ab73c8576cde0e476bbb958f5f79c8d4884e39bd2c2333695a96b590431755a7` | `ff4427dc72fd031b569480da7cebb5bc93447f3adb6c14d3feb3799bc7478a34` |
| Su respaldo y su restauracion | `5637f43315a7db793d29fb2a4174fa3a2b60ca6328d08e3e7111b6755e4e8364` | **`ff4427dc...8a34` (IDENTICO)** |

O sea: el **archivo** del respaldo tiene una huella **distinta** de la base de la que salio
(`6c00afb5` contra `b61e947d` en produccion), mientras que el **volcado canonico** es
**identico**. Si el criterio de "el respaldo sirve" fuera el hash del archivo, un respaldo
perfecto se declararia roto.

Y hay una segunda mitad de la trampa, medida tambien: un respaldo hecho con `VACUUM INTO`
(no con `.backup`) produce un **volcado canonico distinto** para el **mismo** contenido,
porque `VACUUM` reordena los indices. El volcado canonico es canonico **para una misma
base**, no entre bases reconstruidas: por eso el respaldo de esta prueba se tomo con
`.backup` (`sqlite3 ... ".backup '...'"`), que es el mismo metodo que usa
`deploy/backup-firma.sh` en produccion.

---

## 6. Que se restaura (la respuesta al abogado)

La fila T7 pide "con que se restaura". Lo medido responde en tres puntos:

1. **Que se restaura: el respaldo que hay que TOMAR ANTES.** El programa de reversion, en
   su modo normal, **no deja respaldo propio**: borra dentro de una transaccion. (Solo el
   modo `--solo-consentimientos` crea un backup previo, con `VACUUM INTO`, en
   `scripts/limpiar-rastro-prueba.js:762-785`.) Por eso el procedimiento es:
   **respaldo primero, reversion despues**. El respaldo es el `.backup` de la base (el mismo
   mecanismo de `deploy/backup-firma.sh`, que ademas lo cifra con `gpg`).
2. **Que vuelve exactamente.** Restaurado el respaldo, el volcado canonico de la base
   restaurada es **identico** al de la base de origen (`ff4427dc...8a34` los dos) y los
   conteos son los de antes: vuelven la **firma**, sus **3 eventos**, la **sesion**, el
   **token**, el **hold**, la **firma en papel**, el **consentimiento** y su **evento**.
3. **Que vuelve la "version anterior" y el "catalogo de conservacion".** La reversion
   retira la version **v1.0** del Acuerdo (la de prueba) y deja vigente la **v1.6**; el
   respaldo **devuelve la v1.0**. Y el **catalogo de conservacion** no se pierde: la
   migracion 049 deja **en la fila** la regla que se aplico (`categoria_conservacion`,
   `regla_retencion`, `plazo_conservacion_*`, `fecha_inicio_conservacion`) y esas columnas
   **no se recalculan** (`src/services/retencion.js`); la fila borrada por la reversion
   vuelve con su categoria y su regla intactas al restaurar el respaldo. La
   `gh_consentimientos_firma` (la **prueba de la aceptacion**, que segun `SECURITY.md` T.8
   tiene que sobrevivir a la supresion) tambien vuelve.

En una linea, para el expediente: **lo que se restaura es el respaldo de la base tal
como estaba antes de la reversion (`.backup` previo, cifrado en produccion), y la prueba
demuestra que restaurado devuelve un volcado canonico identico al de origen.**

---

## 7. Que evidencia deja la reversion (lo que exige el propio codigo)

Medido en la base aislada, con el SQL crudo:

```
recibo=1 | firma=1 | actor=Prueba T7 | ["PRUEBA_OPERATIVA"] | hold_verificado=1 | eventos_purgados=3
asiento1=LIMPIEZA_RASTRO_PRUEBA | Prueba T7 | 1 | 3 | 1 | 0
asiento2=LIMPIEZA_RASTRO_PRUEBA_ACUERDO | Prueba T7 | 0 | 0 | 1 | 0
purgadas=0
purgas_pendientes=0
```

Que es exactamente lo que pide `SECURITY.md` T.5 y lo que el codigo escribe:

- **Recibo por firma** en `gh_firma_purga_registro`: una fila por firma, con `actor`,
  `categorias` (`["PRUEBA_OPERATIVA"]`), `hold_verificado = 1` y el **motivo del
  forzamiento** (quien lo hizo y por que). Sin el `token_hash`: la credencial no se
  conserva.
- **Asiento append-only** en `gh_firma_purga_log`: dos filas
  (`LIMPIEZA_RASTRO_PRUEBA` y `LIMPIEZA_RASTRO_PRUEBA_ACUERDO`), con `firmas_en_lote`,
  `eventos_purgados`, `hold_revisados = 1` y `hold_bloqueados = 0`.
- **El bloque RESULTADO** del programa ahora informa tambien los **eventos de
  consentimiento** borrados (`eventos de consentimiento: 1`), que es el numero que antes
  faltaba y que es el que hacia posible detectar el defecto de la sec. 10.
- **La 5B (`supresion.js`) NO corrio**: `gh_firma_purgadas = 0` y
  `gh_firma_purgas_pendientes = 0`. Su lapida y su recibo son de **otra via** (la ventana
  de purga del 8.6), no de este programa. Esta corrida **no abre esa ventana** y no finge
  haberla abierto.

---

## 8. Lo que esta prueba **NO** prueba

Esto es lo mas importante del acta.

1. **NO es una reversion real.** Es una corrida **controlada**: el programa de reversion
   del repo, invocado con llaves **propias** y `NODE_ENV=development`, contra una **base
   AISLADA** con **una sola fila sintetica**.
2. **Los datos son sinteticos.** La Empresa es `900000001` y el Trabajador `T7-TRAB-0001`:
   no hay ninguna persona real detras. El PDF "firmado" lo genera el propio programa de
   prueba y no es un documento real. La version v1.0 del Acuerdo es un texto de prueba con
   hash `aaaa...`: **no es el texto legal**.
3. **La base de PRODUCCION no se toco.** Solo se abrio con `sqlite3 -readonly` y con
   `.backup` (que lee). El contenido de produccion antes y despues es identico (sec. 5). Lo
   que la corrida demuestra es que el **mecanismo** funciona contra el codigo del repo
   (con la correccion del owner) montado sobre el `src` desplegado; no dice nada sobre lo
   que haya ocurrido en la vida real.
4. **El hold se FORZO.** Medido en PRODUCCION (solo lectura), las 5 firmas que existen
   tienen `hold_legal = 1` y `hold_actor = 'sistema'`:

   | id_solicitud | estado | `hold_legal` | motivo del hold |
   |---|---|---|---|
   | `SIGN-2026-734698` | OPENED | 1 | `deber_legal_2.2.1.1.12 del Decreto 1072 de 2015` |
   | `SIGN-2026-827084` | OTP_VERIFIED | 1 | `deber_legal_2.2.1.1.12 del Decreto 1072 de 2015` |
   | `SIGN-2026-927141` | SIGNED | 1 | `deber_legal_2.2.1.1.12 del Decreto 1072 de 2015` |
   | `SIGN-2026-738564` | SIGNED | 1 | `tabla_supletoria_pendiente_validacion` |
   | `SIGN-2026-016820` | CANCELLED | 1 | `deber_legal_2.2.1.1.12 del Decreto 1072 de 2015` |

   **Ninguna** se puede forzar: las cinco tienen un estado con acto (`OPENED`,
   `OTP_VERIFIED`, `SIGNED`, `CANCELLED`), y ademas la cuarta tiene un motivo que **no**
   es el automatico (`deber_legal_*` / `plazo_no_declarado`), o sea que seria un acto de
   gobierno y no se fuerza. La corrida forzo un hold **automatico** de una fila **que
   nunca se firmo**, que es el unico caso que el propio codigo permite forzar
   (`scripts/limpiar-rastro-prueba.js:314-369`). **Lo que se prueba es el mecanismo del
   forzamiento, no que el forzamiento sea procedente en produccion.**
5. **La restauracion probada es la de la COPIA LIMPIA**, no la cifrada. Los `.enc` de
   `/opt/kair-firma/backups` y la frase `/opt/kair-firma/backup.passphrase` son **`600
   root`**, y esta cuenta (`javier`) no los puede leer. Se midio que el respaldo cifrado
   **existe** y que `deploy/probar-restauracion.sh` esta desplegado, pero **el descifrado
   real no se corrio**: queda pendiente de root (sec. 9, punto 1).
6. **No se toco ningun servicio, ninguna migracion y ningun archivo de produccion.** No se
   uso `sudo`, no se reinicio nada, no se modifico `legal-readiness.json` ni `Historial.md`
   ni el cuadro canonico. No se commiteo ni se pusheo nada.
7. **No se corrio la suite de pruebas** del firma-service: solo el test propio de la
   sec. 11, que no abre ninguna base de datos.
8. **No se abrio ninguna compuerta.** `config/tabla-conservacion.json -> aplicacion.activada`
   sigue en `false`: la ventana de purga de la 5B sigue cerrada, como debe.
9. **La correccion del owner todavia no esta desplegada.** La corrida de la sec. 4 uso el
   archivo corregido copiado a un *shadow* en `/tmp`; el arbol de `/opt/kair-firma/app`
   sigue con la version anterior (`a1f3e76b...7175`). Ver sec. 9, punto 3.

---

## 9. Que queda pendiente

| # | Que falta | Quien | Por que esta corrida no lo cierra |
|---|---|---|---|
| 1 | **Correr la restauracion CIFRADA de verdad**: descifrar un `.enc` con `gpg`, restaurar y verificar (`deploy/probar-restauracion.sh`), que ademas produce `/opt/kair-firma/backups/restauracion.log`. | Owner o equipo con `root` | La frase (`/opt/kair-firma/backup.passphrase`) y los `.enc` de noviembre son `600 root`; esta cuenta no los puede leer. Ademas `sudo` pide contrasena. |
| 2 | **Decidir cuando corre la primera restauracion cifrada.** El cron actual es `0 4 1 * * root /opt/kair-firma/probar-restauracion.sh >> /opt/kair-firma/backups/restauracion.log 2>&1`: el dia **1 de cada mes**. Como hoy es el 12-nov-2026, el primer log real sera del **1-dic-2026**. | Owner | El dia del cron es una decision operativa; no lo cambia esta acta. |
| 3 | **Desplegar la correccion del defecto de la FK** (`scripts/limpiar-rastro-prueba.js`, sha256 `4e8b3e9b...04b0`) en `/opt/kair-firma/app`. | Owner | Esta corrida **no** toco el arbol desplegado (es una correccion de despliegue, no de la prueba). |
| 4 | **Cerrar la fila T7 del informe al abogado** (`:136`) con la evidencia de este acta, y decidir si el T7 queda CERRADO o PENDIENTE por los puntos 1 y 5. | Owner + abogado | Actualizar el informe del abogado y el manifiesto es un acto del owner, no del equipo. |
| 5 | **Una reversion sobre una fila real**, si el owner lo decide, con su acta y su respaldo verificado. | Owner | Requiere una fila real y una decision escrita: no lo puede hacer un script. |
| 6 | **Verificar por que el `.env` y las llaves de produccion no son legibles por la cuenta de servicio**, y lo del arbol desplegado en `777`: es el pendiente de **T4**, no de este acta. | Owner | Fuera del alcance de este encargo; ya medido en T4. |

---

## 10. El defecto de la llave foranea: como se encontro, como se corrigio y como se midio

### Que era

La limpieza **por rango** (el modo normal del programa) borra la fila de
`gh_consentimientos_firma` **sin borrar antes** sus filas de `gh_consentimientos_eventos`.
La FK de la migracion 010 (`gh_consentimientos_eventos.consent_id` ->
`gh_consentimientos_firma.id`) no deja borrar el padre antes que el hijo, y SQLite aborta
la transaccion. El modo `--solo-consentimientos` si lo hacia bien.

La primera corrida (14:57) no lo reprodujo porque la semilla no tenia el evento del
consentimiento; el defecto se descubrio al reproducirlo a proposito. El error era:

```
Error: SqliteError: FOREIGN KEY constraint failed
    at /opt/kair-firma/app/scripts/limpiar-rastro-prueba.js:1119:84
```

y la linea 1119 era:

```js
const rc = db.prepare('DELETE FROM gh_consentimientos_firma WHERE id = ?').run(c.id);
```

Lo bueno: la transaccion **revierte** y no se pierde nada. Lo malo: **la reversion no se
puede hacer** en una base donde el consentimiento tenga eventos, y el operador recibe una
traza de pila en vez de un mensaje. Y no es un caso de laboratorio: esa tabla la escribe
`src/services/consent.js:185,549,1161` (el evento `CONSENT_EXPIRED`).

### La correccion (del owner, en el repositorio)

`scripts/limpiar-rastro-prueba.js`, sha256
`4e8b3e9bcc4b9fd23a4bf3c8ea19f5d1d8bdc1f0b8a3b7d7be9347889fb904b0` (57942 bytes). El
`diff` contra el archivo desplegado sale **solo** con la correccion:

```
1078a1079
>   let eventosConsentimientoBorrados = 0;
1085a1087
>   const hayEventosConsentimiento = tablaExiste('gh_consentimientos_eventos');
1118a1121,1138
>         // PRIMERO los eventos del consentimiento. La FK de la migracion 010
>         // apunta al consentimiento (`gh_consentimientos_eventos.consent_id` ->
>         // `gh_consentimientos_firma.id`) y SQLite no deja borrar el padre
>         // antes que el hijo.
>         //
>         // Sin esta linea la limpieza POR RANGO falla con "FOREIGN KEY
>         // constraint failed" en cuanto un consentimiento tenga eventos, que es
>         // el caso normal: los escribe `src/services/consent.js`. La
>         //.transaction revierte (no se pierde nada) pero la reversion queda
>         // bloqueada y el operador recibe una traza de pila en vez de un
>         // resultado. Es el mismo orden que ya usaba el modo
>         // `--solo-consentimientos`.
>         if (hayEventosConsentimiento) {
>           const ce = db.prepare(
>             'DELETE FROM gh_consentimientos_eventos WHERE consent_id = ?'
>           ).run(c.id);
>           eventosConsentimientoBorrados += ce.changes;
>         }
1209a1230
>   console.log(`  eventos de consentimiento: ${eventosConsentimientoBorrados}`);
1221a1243
>     eventosConsentimientoBorrados,
```

### La medicion: A/B sobre la MISMA base sembrada

Las dos corridas son sobre **copias de la misma base** (`antes.sqlite`, que ya trae el
evento del consentimiento): A con el programa **desplegado** (el viejo) y B con el
**corregido**. Salida literal:

```
############ A) EL PROGRAMA DESPLEGADO (el de antes de la correccion) ############
  drop trg_firma_eventos_no_update
  drop trg_firma_eventos_no_delete
--- Reponiendo el trigger append-only de los eventos ---
  ok trg_firma_eventos_no_update
  ok trg_firma_eventos_no_delete
Error: SqliteError: FOREIGN KEY constraint failed
    at /opt/kair-firma/app/scripts/limpiar-rastro-prueba.js:1119:84
    at sqliteTransaction (/opt/kair-firma/app/node_modules/better-sqlite3/lib/methods/transaction.js:65:24)
    at aplicar (/opt/kair-firma/app/scripts/limpiar-rastro-prueba.js:1126:5)
    at main (/opt/kair-firma/app/scripts/limpiar-rastro-prueba.js:1344:13)
    at Object.<anonymous> (/opt/kair-firma/app/scripts/limpiar-rastro-prueba.js:1367:18)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
    at Module.load (node:internal/modules/cjs/loader:1266:32)
    at Module._load (node:internal/modules/cjs/loader:1091:12)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:164:12)
--- exit: 3 ---
firmas=1
consentimientos=1
eventos_consentimiento=1

############ B) EL PROGRAMA CORREGIDO ############
  filas de lote eliminadas: 0
  tokens eliminados:        1
  holds eliminados:         1
  firmas en papel borradas: 1
  consentimientos:          1
  eventos de consentimiento: 1
  archivos eliminados:      0
  hold revisados:           1
  hold forzados:            1 (id=1)
  version del Acuerdo:     eliminada (v1.0)
  recibo: 1 fila(s) en gh_firma_purga_registro y 2 en gh_firma_purga_log

=== VERIFICACION ===
  integridad:       ok
  firmas:           0
  eventos:          0
  consentimientos:  0
  version v1.0: 0
  OK: la base quedo integra y con los triggers repuestos.

Listo. Ahora se puede publicar el texto legal como v1.0.
  (firmas: 1, eventos: 3, consentimientos: 1, archivos: 0)
--- exit: 0 ---
firmas=0
consentimientos=0
eventos_consentimiento=0
versiones=v1.6
integridad=ok
llaves_rotas=0
recibo=1 | firma=1 | hold_verificado=1
asientos=2
```

Conclusion: con el programa viejo, la reversion **aborta** (exit 3) y no borra nada; con
el corregido, **borra** (exit 0), deja el evento del consentimiento en cero, la base queda
integra (`integridad=ok`), sin llaves rotas (`llaves_rotas=0`) y con el recibo puesto
(`recibo=1`, `asientos=2`).

Una nota honesta sobre la linea `archivos eliminados: 0` del bloque B: es que en esa copia
el PDF sintetico **ya se habia borrado** en la corrida principal, asi que no habia archivo
que borrar. En la corrida principal (sec. 4) el programa informo `archivos eliminados: 1`
y el archivo desaparecio del disco.

---

## 11. El test propio del programa

`sgsst-electron-app/firma-service/tests/scripts/probar-reversion.test.js`, con `node:test`
y `node:assert/strict`, en el estilo de los tests hermanos
(`tests/scripts/probar-t6-medio-corporativo.test.js`).

**No abre ninguna base de datos**: ni `data/test.sqlite` ni ninguna otra. Lo unico que
toca son archivos temporales del sistema, creados y borrados por el propio test. Por eso
se puede correr en paralelo con la suite, sin el conflicto de la base compartida:

```bash
node --test tests/scripts/probar-reversion.test.js
```

Salida:

```
tests 9
pass 9
fail 0
```

Que es lo que cubre:

| Caso | Que comprueba |
|---|---|
| Sin `--db` | El script no hace nada y sale con codigo distinto de 0. |
| Guard de produccion (ruta) | Si la base aislada es la de produccion, el script **se niega** y lo dice. |
| Guard de produccion (directorio) | Una base dentro de `/opt/kair-firma/data` tambien se rechaza, aunque no sea exactamente la de produccion. |
| Guard de produccion (bytes) | Al negarse, **no escribe ni un byte** en el archivo. |
| `--confirmar-escribe` | Preparar la base **exige** `--confirmar-escribe`: sin ella el script no crea el archivo y sale con codigo distinto de 0. |
| Ambiente del proceso | El ambiente que el script pasa al programa de reversion es **sintetico** y no trae rutas de secretos de produccion. |
| La semilla | Siembra el **evento del consentimiento**, que es el caso que hace fallar la limpieza por rango. |
| Ayuda | La ayuda sale con codigo 0 y explica `--db` y `--confirmar-escribe`. |

---

## 12. La huella de lo entregado

```
sgsst-electron-app/firma-service/scripts/probar-reversion.js
sha256  49b8a7a1d22a8d851b7e63cec4a9fd8e9e37aa6984bc5b380f1e6a652d7d9847
49699 bytes - ASCII puro - LF - sin BOM - node --check OK

sgsst-electron-app/firma-service/tests/scripts/probar-reversion.test.js
sha256  39e72ff4cb20f6f8fb5511fc21d2bb257c326ec0aa529ee44005c0e6308fc8c9
10035 bytes - ASCII puro - LF - sin BOM - node --check OK
```

La misma huella del programa es la del archivo que se ejecuto en el servidor
(`/tmp/kair-t7/probar-reversion.js`, sha256 `49b8a7a1...d9847`).

---

*Documento generado el 12-nov-2026 por el equipo de verificacion de K+AIR. No se modifico
ningun archivo del repositorio fuera de este documento, del programa nuevo
`scripts/probar-reversion.js` y su test `tests/scripts/probar-reversion.test.js`. No se
commiteo ni se pusheo nada. La base de produccion no recibio ni una escritura.*
