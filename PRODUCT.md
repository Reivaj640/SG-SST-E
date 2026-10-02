# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Profesional SG-SST en empresa**: gestiona todo el sistema de gestión de seguridad y salud en el trabajo de su empresa (planes, capacitaciones, accidentes, indicadores, reportes).
- **Consultor para varias empresas**: atiende múltiples empresas clientes desde una misma instalación (multi-empresa).
- **Varios roles por permiso**: administrador, jefes de área y trabajadores entran cada uno con su rol y permisos (p. ej. Bandeja Integrada condicionada por usuario desde Gestión de Usuario).

## Product Purpose

Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) de escritorio que reemplaza el Excel y la carpeta física: centraliza los módulos del SG-SST —evaluaciones, incapacidades, investigación de accidentes, remisiones, indicadores, planes de acción, SVE— en una sola aplicación. El éxito es que una empresa pueda operar su sistema de gestión y evidenciar su cumplimiento sin salir de la aplicación.

## Positioning

Cumplimiento SG-SST en un solo lugar: todos los módulos del sistema de gestión bajo la Resolución 0312 de 2019 (Colombia) en una aplicación de escritorio con base de datos local (SQLite) y sincronización entre equipos, sin depender de un servidor en la nube.

## Operating Context

- Contexto normativo colombiano: Resolución 0312 de 2019 y normativa SG-SST aplicable; formato es_CO (fechas, moneda con coma decimal).
- Trabajo con documentos reales del oficio: Excel, Word, PDF (FURAT, remisiones, reportes, incapacidades) y correo Gmail integrado (Bandeja Integrada).
- Varios equipos por empresa que trabajan offline y sincronizan sus datos locales cuando hay conexión (aislamiento por empresa_id).
- Flujo de desarrollo iterativo por lotes `📦n` con suites de regresión; los cambios de comportamiento y los commits se hacen sólo con autorización explícita del usuario.

## Capabilities and Constraints

- Aplicación de escritorio Electron (ventana propia, actualización automática vía electron-updater, instalador .exe para Windows); la interfaz es web corriendo en Chromium.
- **Stack confirmado por el usuario:** Electron + JavaScript vanilla, sin frameworks frontend. Regla del repo: CSS plano BEM con prefijo `kair-`, iconos Lucide en SVG inline, backend por IPC (`window.electronAPI.*`).
- Módulos existentes: Evaluación Inicial/EMO, Incapacidades (SQLite), Reportes de Accidentes (FURAT), Investigación de Accidentes con análisis de 5 Porqués (servidor Python local), Remisiones/Restricciones, Gestión Humana, Bandeja Integrada (Gmail), Medicina Preventiva/SVE (sección 3.1.2), Configuración multi-empresa.
- Los datos locales en SQLite son la fuente de verdad; la sincronización viaja como archivo de intercambio entre equipos.
- Hechos abiertos (sin decidir): alcance fuera de Colombia/i18n, estrategia de precios o licenciamiento, soporte fuera de Windows.

## Brand Commitments

- Identidad visual **K+AIR** existente en el código: paleta con azul de marca `#174ea6` y verde `#28a745`, componentes con prefijo `kair-`, tema oscuro `[data-theme="dark"]`, tipografía Inter/Plus Jakarta Sans. (Evidencia del repositorio; en esta sesión el usuario no fijó compromisos visuales nuevos.)

## Evidence on Hand

- `sgsst-electron-app/AGENTS.md` (~4.600 líneas): convenciones del repo, historia por lotes `📦n`, reglas sagradas de trabajo.
- Suites de regresión `main/test-*.js` y `tests/test-*.js` (512 checks) como scripts sueltos de node/Electron, sin framework de tests.
- Prototipos aprobados por el usuario replicados desde archivos `.tar` (patrón de vistas "replica XxxView.tsx").
- `llm_server.py` + `dataset_v5_final.jsonl` para el análisis de 5 Porqués (calidad validada contra dataset de entrenamiento).
- Ausencias que no deben inventarse: no hay README, DESIGN.md previo, testimonios, clientes, benchmarks ni precios.

## Product Principles

1. El cumplimiento normativo manda: toda funcionalidad sirve para operar y evidenciar el SG-SST (Resolución 0312).
2. Offline primero: sin internet la aplicación sigue funcionando; la sincronización es transporte, no dependencia.
3. Los datos locales son la verdad: base SQLite por empresa; nada se escribe sin pasar por la capa de persistencia.
4. Mantenibilidad por convención: vanilla JS + BEM `kair-`, convención de commits `📦n`, tests antes de afirmar que algo funciona.
5. Cambio con autorización: nada de commits ni cambios de comportamiento sin aprobación explícita del usuario.
