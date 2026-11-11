# Expiración de 90 días para `kair-release-pc` — 10-nov-2026

> **Estado al 10-nov-2026:** **PENDIENTE**. El personal access token fine-grained
> `kair-release-pc` **hoy no tiene fecha de expiración** y debe quedar con una
> ventana de **90 días**, cuyo vencimiento objetivo es el **2027-02-08**.
>
> **Responsable de ejecutar:** owner de la cuenta de GitHub `Reivaj640`.
>
> Esta acción **no se puede cerrar desde el repositorio** porque GitHub no ofrece
> una forma de administrar un PAT propio de usuario desde las rutas verificadas.
> El ajuste es **manual en la interfaz de GitHub**.
>
> Este documento **no contiene el valor del token ni ningún fragmento de
> credencial**. Solo metadatos: nombre, tipo, titular, permisos conocidos,
> fechas, responsable, pasos y evidencia.

## 1. Qué queda pendiente

El token `kair-release-pc` pertenece a la cuenta de GitHub `Reivaj640` y, al
corte de esta fecha, **no tiene fecha de expiración**. El owner decidió el
10-nov-2026 que su ventana de uso sea de **90 días**.

La tarea pendiente es una sola: editar el token en la interfaz de GitHub,
seleccionar **90 days** en **Expiration** y guardar el cambio con **Update
token**. Desde esa edición, la fecha de vencimiento objetivo queda en
**2027-02-08**.

## 2. Por qué queda pendiente y por qué no se cierra desde el repositorio

### 2.1 La credencial disponible no administra PATs

La credencial que hoy tiene la máquina en el **Administrador de credenciales de
Windows** es un **token convencional de GitHub de 40 caracteres**, con los
permisos `gist`, `repo` y `workflow`.

Esa credencial **sí funciona contra la API de GitHub**, pero **no administra
personal access tokens**: no permite leer, editar ni revocar
`kair-release-pc`. Por lo tanto, no sirve para ejecutar este cambio.

### 2.2 No existe una ruta de API para administrar este PAT

Se comprobaron las siguientes rutas y todas devolvieron **404**:

- `GET /users/Reivaj640/personal-access-tokens`
- `GET /user/personal-access-tokens`
- `GET /user/audit-log`
- `GET /users/Reivaj640/audit-log`

Los únicos endpoints de PAT disponibles son de **organización**, solo revocan
tokens de **GitHub Apps** y **no aplican a un PAT propio**. La edición del
vencimiento debe hacerse **manualmente en la interfaz de GitHub**.

### 2.3 El repositorio no contiene una vía alterna

| Verificación | Resultado |
|---|---|
| `GH_TOKEN` definida en el entorno | **No** |
| `GITHUB_TOKEN` definida en el entorno | **No** |
| `GET /repos/Reivaj640/SG-SST-E/actions/secrets` | `total_count: 0` — no hay secrets de Actions en el repo |
| `.github/workflows` | **No existe** — el repositorio no tiene workflows |
| Ocurrencias de `kair-release-pc` en todo el árbol | **1**, una mención en `Historial.md` |
| Valor del PAT en el repositorio o en el entorno | **No disponible** y **no debe documentarse** |

Por tanto, el repositorio no aporta una credencial alterna ni una ruta
automatizada para aplicar el vencimiento.

## 3. Procedimiento manual en GitHub

La ruta exacta en la interfaz es:

**GitHub → foto de perfil (arriba a la derecha) → Settings → Developer
settings (columna izquierda, abajo del todo) → Personal access tokens →
Fine-grained tokens → fila `kair-release-pc` → Edit → Expiration → 90 days →
Update token**

Pasos:

1. Iniciar sesión en GitHub con la cuenta `Reivaj640`.
2. Abrir la foto de perfil, arriba a la derecha, y entrar en **Settings**.
3. En la columna izquierda, abajo del todo, abrir **Developer settings**.
4. Entrar en **Personal access tokens** y luego en **Fine-grained tokens**.
5. Localizar la fila `kair-release-pc` y pulsar **Edit**.
6. En el campo **Expiration**, elegir **90 days**.
7. Revisar que la pantalla muestre el token `kair-release-pc` y el vencimiento
   calculado para el **2027-02-08**.
8. Pulsar **Update token** para guardar el cambio.

> Si la fecha mostrada por GitHub no coincide con **2027-02-08**, no se debe
> guardar: primero se debe corregir la selección de **Expiration**.

## 4. Qué verificar después de guardar

La evidencia debe confirmar que el cambio quedó aplicado:

1. Guardar una **captura de la pantalla de edición** donde se vean el token
   `kair-release-pc` y la nueva fecha de vencimiento. **El valor del token
   debe quedar tapado** en la captura.
2. **Volver a entrar** a la fila `kair-release-pc` en **Fine-grained tokens** y
   confirmar que **Expiration** muestra **90 days** y que la fecha de
   vencimiento es **2027-02-08**.
3. Registrar en la bitácora del proyecto la fecha de edición, la fecha de
   vencimiento, el responsable y la ubicación de la captura, **sin copiar el
   valor del token**.

## 5. Metadatos

| Campo | Valor |
|---|---|
| Nombre | `kair-release-pc` |
| Tipo | Personal access token fine-grained (PAT) de usuario |
| Titular | Cuenta de GitHub `Reivaj640` |
| Permisos | ⚠️ No verificado para `kair-release-pc` |
| Fecha de edición | Pendiente de ejecutar; referencia de decisión: 2026-11-10 |
| Fecha de vencimiento | **2027-02-08** — objetivo tras aplicar 90 días el 2026-11-10 |
| Expiración actual | **Ninguna** — el token hoy no tiene fecha de expiración |
| Responsable | Owner de la cuenta `Reivaj640` |
| Estado | **Pendiente** |
| Evidencia | Captura de la pantalla de edición con el valor tapado + fecha confirmada al volver a entrar |

> Los permisos `gist`, `repo` y `workflow` documentados en el §2.1 pertenecen
> a la **credencial convencional** del Administrador de credenciales de
> Windows. **No son los permisos verificados de `kair-release-pc`**.

## 6. Qué NO hacer

- **NO pegar el valor del token** en ningún archivo, mensaje, ticket o
  captura. Si una captura es necesaria, el valor debe quedar completamente
  tapado.
- **NO crear un PAT nuevo como sustituto** para cerrar esta tarea. Una
  rotación aislada repetiría el problema: el archivo `.env` viaja dentro del
  instalador.
- **NO reescribir el historial de Git** para resolver esta pendiente. El
  cambio de vencimiento es un ajuste de la credencial en GitHub y no requiere
  modificar el historial del repositorio.
- **NO usar la credencial convencional del Administrador de credenciales de
  Windows** como si pudiera administrar `kair-release-pc`; esa capacidad no
  está verificada para ese PAT.

## 7. Renovación cada 90 días

La renovación periódica, **cada 90 días**, es un **control de seguridad**.
La ventana limitada obliga a revisar el uso del token en cada renovación y a
decidir, con evidencia, si continúa siendo necesario, cómo se usa y dónde
debe vivir.

El **owner de la cuenta `Reivaj640`** es el responsable de:

1. Realizar la revisión del uso antes de cada renovación.
2. Editar la fecha de vencimiento en la interfaz de GitHub.
3. Guardar la evidencia de verificación descrita en el §4.
4. Registrar la nueva fecha de vencimiento en la bitácora del proyecto.

La fecha objetivo de esta renovación es **2027-02-08**. La fecha exacta de
cada renovación posterior depende de la fecha real en que se aplique el
cambio: ⚠️ No verificado.

## Explicación Simple

### El problema

Hay una llave de acceso de GitHub llamada `kair-release-pc`. Esa llave no tiene
fecha de vencimiento: puede seguir funcionando indefinidamente, aunque nadie
la necesite. Además, el equipo no tiene una forma de cambiarle la fecha desde
el proyecto; el cambio tiene que hacerse a mano en la pantalla de GitHub.

### La solución

El owner debe abrir GitHub, entrar a la configuración de la cuenta y buscar la
llave `kair-release-pc`. En la pantalla de edición, tiene que elegir
**90 days** en el campo de vencimiento y pulsar **Update token**. Así la llave
deja de ser permanente y queda con una fecha clara: **8 de febrero de 2027**.

El valor de la llave no debe copiarse en ninguna hoja de cálculo,
conversación, mensaje, documento ni captura de pantalla. Si se toma una foto
para dejar evidencia, la parte donde aparece la llave debe quedar tapada.

### Antes vs Después

**ANTES (con bug):** `kair-release-pc` no tiene vencimiento y puede seguir
usándose por tiempo indefinido. Además, el cambio depende de que alguien
recuerde hacerlo manualmente en GitHub.

**DESPUÉS (corregido):** `kair-release-pc` queda con 90 días de vigencia y
vence el **2027-02-08**. El owner revisa su uso antes de cada renovación y
deja evidencia de que la fecha sí quedó guardada.
