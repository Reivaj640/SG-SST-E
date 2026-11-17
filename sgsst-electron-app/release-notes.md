# K+AIR v0.1.253

> Esto es para el **usuario final**. Para trabajar sobre la aplicación, ver
> [`PROMPT.md`](../PROMPT.md) y [`Historial.md`](../Historial.md).

## Los anexos de cada empresa, y su contrafirma, en un solo lugar

Dentro de **Configuración**, en la ficha de cada empresa, hay ahora un panel con los dos anexos:
el **Anexo de Encargo** y el **Anexo de Nube**. Ahí se ve en qué punto está cada uno, y ahí se
hacen las dos cosas que el operador tenía que hacer por otros lados:

1. **Abrir la suscripción** y mandar el enlace a la Empresa.
2. **Verificar a quien firmó** por la Empresa (solo en el Anexo de Encargo: el Anexo de Nube lo
   coteja el servicio solo).
3. **Pedir el código de contrafirma** y **contrafirmar**.

Hasta ahora, la contrafirma del Anexo de Encargo se hacía desde la app, pero la del **Anexo de
Nube** —la que deja el instrumento realmente ejecutado— no: las rutas existían en el servidor,
pero en la aplicación no había ningún camino, y había que ejecutarla a mano, por consola, con un
paso a paso escrito. Eso era una fuente de errores y de actos sin rastro claro.

Ahora **los dos anexos se hacen igual, desde el mismo lugar**. El código de la contrafirma sigue
salendo al buzón de protección de datos de K+AIR —nunca al de la Empresa— y el motivo del acto
sigue siendo obligatorio: es lo que queda escrito en el expediente de por qué se contrafirmó.

## El panel de anexos ya no desaparece

Un defecto molesto: el panel de los anexos **a veces no aparecía**, aunque todo estuviera bien.
La causa era el *cache-bust* (el `?v=`) de la vista: la hoja y el iframe se habían quedado con el
token viejo, así que el navegador pedía una versión anterior del documento. El síntoma era "no
hay nada", y el problema estaba en un archivo que nadie había tocado.

Los tres tokens van ahora al compás, y hay una comprobación automática que lo verifica en cada
corrida de las pruebas.

## La tanda de la firma electrónica

Esta versión también recoge lo que se hizo en el servicio de firma durante estas semanas: se
firmaron y contrafirmaron el **Anexo de Nube v1.4** y el **Anexo de Encargo 2026-11-12** (con sus
actas), se regeneró el manifiesto de preparación legal y se actualizaron los documentos públicos
para que digan lo que ahora es cierto. Ese trabajo no cambia lo que se ve en pantalla: cambia lo
que el sistema puede demostrar. El detalle está en [`Historial.md`](../Historial.md).

## Si usabas la app instalada

Esta versión es una instalación nueva. Si tienes la anterior, **actualiza con el instalador**
(`K-AIR-Setup-0.1.253.exe`): la anterior era de finales de octubre y no tenía el panel de los
anexos ni ninguna parte del trabajo de firma electrónica.
