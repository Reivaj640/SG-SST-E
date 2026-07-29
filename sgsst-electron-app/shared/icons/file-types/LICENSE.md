# Iconos de archivos adjuntos

Los archivos SVG en esta carpeta (`word.svg`, `excel.svg`, `powerpoint.svg`, `pdf.svg`,
`image.svg`, `video.svg`, `audio.svg`, `archive.svg`, `text.svg`, `file.svg`) provienen
del proyecto [iconGenerator](https://github.com/mallowigi/iconGenerator) de
Elior "Mallowigi" Boukhobza, parte de la familia
[Material Theme UI](https://www.material-theme.com/).

## Licencia

```
The MIT License (MIT)

Copyright (c) 2015-2024 Elior "Mallowigi" Boukhobza

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Atribución

- **Repositorio fuente**: https://github.com/mallowigi/iconGenerator
- **Plugin original**: Atom Material Icons (Chrome/Firefox extension)
- **Material Theme UI**: https://www.material-theme.com/
- **Otros recursos**: Material Design Icons, FontAwesome 4.7.0, Octicons, Devicons, MFixx, File-Icons

## Uso en K+AIR

Estos iconos se usan en la Bandeja Integrada para mostrar el tipo de archivo de
cada adjunto (Word/Excel/PowerPoint/PDF/imagen/video/audio/zip/texto/genérico).
La asignación de extensión → icono se hace en
`renderer/bandeja-integrada/app.js` (función `attachmentIcon`).

Cada SVG incluye el comentario de licencia en sus primeras líneas (es la práctica
estándar de proyectos open source MIT).
