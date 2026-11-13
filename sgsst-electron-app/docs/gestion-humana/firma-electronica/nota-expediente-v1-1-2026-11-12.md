# Nota de expediente — la versión 1.1 del Anexo de Nube, suscrita y sin contrafirma (12-nov-2026)

> **Qué es este documento.** Es la **constancia de expediente** del punto L6: la suscripción de la
> versión 1.1 del Anexo de Nube, que la Empresa firmó y K+AIR no contrafirmó. El texto base es el
> §3.3 del dictamen legal del 12-nov-2026 (`dictamen-legal-2026-11-12-tandas-2-y-3.md`, L6), y esta
> nota lo **corrige** en un punto de fondo y completa en los que el dictamen marcó como pendientes.
>
> **Lo que corrige.** El numeral 2.3 del texto base decía que la afirmación «bajo la v1.1 no se trató
> dato alguno» «no se sostiene y no se hace». Eso es cierto como diagnóstico, pero no es la nota que
> el expediente necesita: el expediente necesita **declarar** el tratamiento de la ventana del 5 al 11
> de noviembre de 2026, no dejar el hueco. El numeral 2.3 de esta nota **declara** ese tratamiento. El
> fondo jurídico no cambia: el dictamen sigue siendo la fuente, y esta nota es su aplicación al
> expediente.
>
> **Estado.** Constancia interna de expediente. No sustituye la revisión de un abogado matriculado.
> La firma, la ratificación y la responsabilidad son del owner (Gesstiar S.A.S.).

**Asunto:** Constancia sobre la suscripción de la versión 1.1 del Anexo de Nube, suscrita y sin
contrafirma.
**Fecha:** 12-nov-2026.
**Elabora:** asesoría jurídica de K+AIR (dictamen legal del 12-nov-2026, L6).

---

## 1. Hechos

**1.1.** La versión 1.1 del Anexo de Nube (SHA-256 `e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482`,
62.198 bytes) fue **suscrita** por ASEPLUS CARIBE S.A.S. (NIT 900.829.731-1) el **5 de noviembre de
2026 a las 22:51:34 UTC**, con verificación por código de un solo uso y registro de la dirección IP
181.63.26.145.

**1.2.** El Anexo de Nube es **bilateral**: su sección 10 exige la firma del Responsable y la del
Encargado. La suscripción de la Empresa es el primer acto; la contrafirma de K+AIR es el segundo.
**El segundo acto no se produjo.**

**1.3.** El texto vigente es la **versión 1.3**, **suscrita el 12 de noviembre de 2026 a las 15:38:27
UTC y contrafirmada por K+AIR el mismo día a las 16:13:54 UTC**, con sus dos actas.

**1.4.** El manifiesto conserva la v1.1 en `anexo_nube.versiones_firmadas`, con su huella, su fecha y
su evidencia, y con el indicador `contrafirmado: false`. **Verificado el 12-nov-2026** en el archivo
del repositorio `sgsst-electron-app/firma-service/legal-readiness.json`
(`anexo_nube.versiones_firmadas[0]`: `version` = `1.1`, `hash` = `e9517536…591482`, `fecha` =
`2026-11-05T22:51:34.349Z`, `contrafirmado` = `false`). El manifiesto **no se modificó**: su huella
está registrada en el expediente y cambiarlo obligaría a repropagar el expediente entero.

**1.5.** En la ventana del 5 al 11 de noviembre de 2026 hubo **una firma electrónica completada** y
**una cancelada**: `SIGN-2026-738564` (06-nov-2026, estado `SIGNED`) y `SIGN-2026-016820`
(06-nov-2026, estado `CANCELLED`). La v1.1 era en esas fechas **la única versión del Anexo de Nube
suscrita por la Empresa**: la v1.3 no se publicó hasta el 11 de noviembre de 2026.

---

## 2. Calificación

**2.1.** La v1.1 **no es un instrumento ejecutado**: no generó para K+AIR las obligaciones de un
Anexo bilateral, ni para la Empresa un marco contractual con K+AIR sobre el tratamiento en la nube.

**2.2.** **No se contrafirmará retroactivamente.** Una contrafirma con fecha de hoy, sobre un acto que
ocurrió en noviembre de 2026 y que K+AIR no realizó, sería la fabricación de un acto que no ocurrió:
es contrario al principio de veracidad (art. 4(d) de la Ley 1581 de 2012) y a la lógica de versionado
del §9.4 del Acuerdo.

**2.3. El tratamiento de la ventana del 5 al 11 de noviembre de 2026 SE DECLARA, no se niega.**
La afirmación «bajo la v1.1 no se trató dato alguno» **no se sostiene**: la base de producción
registra una firma electrónica completada el **6 de noviembre de 2026** (`SIGN-2026-738564`, estado
`SIGNED`) y una cancelada el mismo día (`SIGN-2026-016820`), y la v1.1 era en esas fechas la única
versión del Anexo de Nube suscrita por la Empresa (la v1.3 no se publicó hasta el 11 de noviembre).
Lo que corresponde, entonces, es **declarar** el hecho:

> Bajo la versión 1.1 **sí se trataron datos personales**: los de la firma electrónica completada el 6
> de noviembre de 2026. Ese tratamiento lo ejecutó K+AIR **como Encargado del Tratamiento**, conforme
> al Acuerdo y a la versión del Anexo de Nube que la Empresa tenía suscrita, que fue la v1.1. La v1.1
> nunca llegó a ser el instrumento bilateral —le faltó el segundo acto, la contrafirma de K+AIR—, y por
> eso el texto vigente es la v1.3, suscrita y contrafirmada el 12 de noviembre de 2026.

La ausencia de contrafirma califica **el instrumento**; no califica el **tratamiento** que ocurrió
mientras tanto, que se ejecutó bajo el Acuerdo y bajo el Anexo que la Empresa había suscrito. La
declaración se hace aquí, en el expediente, y no se omite.

**2.4. Pendiente de comprobación (acto del owner; NO bloquea el cierre).** Leer, **en modo de solo
lectura**, en las cinco filas de firma de producción la **versión y la huella del Anexo de Nube**
registradas, y dejar el resultado en el expediente. Es el único dato que falta para cerrar por
completo el numeral 2.3 de esta nota.

El **comando literal** (no modifica nada: `sqlite3 -readonly` abre la base en solo lectura; no hace
falta parar el servicio):

```bash
# 1. La conexión al servidor de producción.
ssh javier@192.168.1.11

# 2. Las FIRMAS: qué versión y qué huella del Anexo de Nube rigió cada una.
#    (columnas anexo_nube_version y anexo_nube_hash, migración 045)
sudo -u kairfirma sqlite3 -readonly /opt/kair-firma/data/firma.sqlite \
  "SELECT id_solicitud, estado, fecha_creacion, fecha_firma, anexo_nube_version, anexo_nube_hash FROM gh_firmas_electronicas ORDER BY id;"

# 3. Los CONSENTIMIENTOS: la versión del Anexo de Nube que se puso a disposición
#    del Trabajador y la que aceptó (columnas de la migración 051).
sudo -u kairfirma sqlite3 -readonly /opt/kair-firma/data/firma.sqlite \
  "SELECT id, id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo, fecha_aceptacion, anexo_nube_version, anexo_nube_hash, anexo_nube_origen, anexo_nube_firmado_at FROM gh_consentimientos_firma ORDER BY id;"
```

**Qué se espera.** Las cinco filas de firma de producción; en cada una, la versión y la huella del
Anexo de Nube con el que se firmó (o `NULL` si la fila es anterior a la migración 045). Si alguna
fila de la ventana del 5 al 11 de noviembre registra la v1.1, queda confirmado el asiento que sostiene
el numeral 2.3; si registra otra versión, se corrige el numeral 2.3 con el dato real. El resultado se
pega en este expediente, con la fecha y el responsable de la lectura.

---

## 3. Decisión y efectos

**3.1.** La v1.1 **queda como registro histórico del primer acto**: no se contrafirma, no se borra, no
se reescribe y no se omite del manifiesto.

**3.2.** Ningún texto vigente la presenta como suscrita y contrafirmada, ni como el instrumento que
rige la relación.

**3.3.** Este cierre no altera el bloque M.15, cuya decisión —no contrafirmar retroactivamente— es
correcta y cuya ejecución queda aquí documentada.

---

## 4. Límites

Esta nota constata y califica hechos del expediente; **no sustituye la revisión de un abogado
matriculado** ni decide sobre la responsabilidad por el tratamiento ocurrido en la ventana del 5 al
11 de noviembre de 2026, materia que se cerrará con la reemisión del Anexo de Nube (v1.4) y del
Anexo de Encargo que la remite.

---

## 5. Trazabilidad

| # | Qué | De dónde sale |
|---|---|---|
| 1 | Los hechos del numeral 1 y la calificación de los numerales 2.1 y 2.2 | Dictamen legal del 12-nov-2026 (L6), §3.1 a §3.3, con la evidencia que ahí se cita: `tabla-instrumentos-vigentes-2026-11-09.md`, `Historial.md`, `sitio/anexo-nube-v1.1.html` |
| 2 | El numeral 1.4 (el manifiesto con `contrafirmado: false`) | Verificado el 12-nov-2026 en `sgsst-electron-app/firma-service/legal-readiness.json` (`anexo_nube.versiones_firmadas[0]`). El archivo **no se modificó** |
| 3 | El numeral 1.5 (las dos firmas del 6 de noviembre) y la corrección del numeral 2.3 | `meta-para-abrir-a-empresas-reales-2026-11-12.md` (M.15 y las firmas de producción); dictamen legal del 12-nov-2026, §0.5 y §3.2 |
| 4 | El numeral 2.4 (la lectura pendiente y su comando literal) | El propio §3.4 del dictamen (lo que falta por verificar) y el runbook `docs/MIGRACION-SERVIDOR-FIRMA.md` (la ruta de la base en producción y el patrón `sudo -u kairfirma`) |
| 5 | La corrección de fondo del numeral 2.3 | El encargo del 12-nov-2026: la premisa «bajo la v1.1 no se trató dato alguno» **no se sostiene** y lo que corresponde es **declarar** ese tratamiento, no negarlo |
