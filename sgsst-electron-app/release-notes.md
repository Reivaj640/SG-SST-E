# K+AIR v0.1.252

> Esto es para el **usuario final**. Para trabajar sobre la aplicación, ver
> [`PROMPT.md`](../PROMPT.md) y [`Historial.md`](../Historial.md).

## Volvió a verse el historial de incapacidades

La pantalla de **Registros de Ausentismo** salía vacía, con los filtros de año y de tipo
de incapacidad quedados en "Cargando años..." sin terminar nunca. Y el formulario para
registrar una incapacidad tampoco lograba guardarla.

Los datos **nunca se habían perdido**: el archivo de la carpeta 3.3.6 estaba ahí, con sus
1.275 registros de Tempoactiva. Lo que pasaba es que la app no lo estaba buscando donde
estaba, así que no lo encontraba.

Ahora la pantalla vuelve a mostrar los **1.275 registros**, con los filtros de año y de
clase funcionando, y el formulario de registro vuelve a guardar.

**Lo que esto corrige, en dos partes:**

1. **El buscador.** La app se apoyaba en una lista de archivos que se guardaba en su configuración
   interna. Cuando una empresa se vuelve a vincular (que es lo que se hizo con Tempoactiva),
   esa lista se rehace desde cero y la app se quedaba sin forma de encontrar el archivo. Ahora
   lo busca directamente en la carpeta, así que da lo mismo se haya vinculado la empresa hoy o
   hace seis meses.

2. **La pantalla ya no miente.** Cuando algo falla, los filtros quedaban congelados en "Cargando
   años..." para siempre, y eso hacía ver que faltaban los datos. Ahora, cuando no hay nada
   que mostrar, los filtros se ponen en "Todos" y el aviso dice qué pasó.

## K+AIR ahora avisa si le falta algo para poder trabajar

El registro de incapacidades usa unos programas de Python que vienen con la aplicación. En
este computador faltaba una parte de esa instalación, y el síntoma era un error técnico
(`ModuleNotFoundError: No module named 'pandas'`) que aparecía a mitad de uso, cuando el
usuario ya había llenado el formulario.

Ahora, si a K+AIR le falta esa pieza, **te lo dice al abrir la aplicación**, con un mensaje
claro que dice qué se debe ejecutar y dónde está el instalador de esa pieza. No hace falta
descubrirlo en el peor momento.

## Los documentos legales y el sitio público se actualizaron

Los documentos legales de K+AIR (privacidad, términos, anexo de encargo, autorización de
los trabajadores y soporte) se volvieron a publicar con el texto al día, y el sitio público
los muestra con su fecha de versión correcta. Antes, dos de esas páginas seguían anunciando
una versión vieja.

## La firma electrónica sigue en preparación

El módulo de firma eléctrica está casi listo: el Acuerdo de uso ya va por su **versión 1.2**,
revisada por el abogado, y los tres anexos que acompañan a la firma se publicaron con el
cambio del canal de correo.

Todavía **no está en operación para las empresas**: falta el despliegue final en el servidor
y la rotación de las llaves de cada empresa. En cuanto eso pase, se avisa. Esta nota no
promete una fecha, porque esa decisión no es del desarrollo.

## Lo que cambió por dentro

Para quien quiera el detalle técnico, el `CHANGELOG.md` de esta versión trae los tres
paquetes completos: 📦985 (el buscador de archivos y los filtros), 📦986 (el aviso de
dependencias de Python) y 📦987 (la documentación). Cada uno con su defecto, su arreglo y
cómo se verificó.
