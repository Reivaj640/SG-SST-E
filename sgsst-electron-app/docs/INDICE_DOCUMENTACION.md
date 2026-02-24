# 📚 Índice Maestro de Documentación K+AIR

**Versión:** 2.0  
**Fecha:** 24 de febrero de 2026  
**Estado:** Actualizado Post-Reorganización

---

## 🎯 Inicio Rápido

### Para Nuevos Desarrolladores
1. 📖 [README.md](../README.md) - **Empezar aquí**
2. 📖 [docs/DEPENDENCIAS.md](DEPENDENCIAS.md) - Instalar requisitos
3. 📖 [docs/ARQUITECTURA_V2.md](ARQUITECTURA_V2.md) - Entender arquitectura
4. 📖 [docs/flujo-creacion-empresa.md](flujo-creacion-empresa.md) - Primer flujo

### Para Desarrolladores Existentes
1. 📖 [docs/ESTADO_ACTUAL_REORGANIZACION.md](ESTADO_ACTUAL_REORGANIZACION.md) - Cambios recientes
2. 📖 [docs/LIMPIEZA_REORGANIZACION_FEB_2026.md](LIMPIEZA_REORGANIZACION_FEB_2026.md) - Última limpieza
3. 📖 [docs/CHANGELOG.md](CHANGELOG.md) - Historial de cambios

---

## 📋 Categorías de Documentación

### 1. Documentación General del Proyecto

| Documento | Propósito | Audiencia |
|-----------|-----------|-----------|
| [README.md](../README.md) | Visión general, instalación, uso | Todos |
| [docs/RESUMEN_EJECUTIVO.md](RESUMEN_EJECUTIVO.md) | **Resumen ejecutivo, métricas, logros** | Stakeholders, PM |
| [docs/PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Visión arquitectónica, decisiones clave | Arquitectos, Devs Senior |
| [docs/ARQUITECTURA_V2.md](ARQUITECTURA_V2.md) | **Arquitectura completa v2.0** | Arquitectos, Devs |
| [docs/DEPENDENCIAS.md](DEPENDENCIAS.md) | Requisitos e instalación | Todos |
| [docs/CHANGELOG.md](CHANGELOG.md) | Historial de cambios por versión | Todos |

### 2. Documentación de Arquitectura

| Documento | Propósito | Estado |
|-----------|-----------|--------|
| [docs/arquitectura.md](arquitectura.md) | Arquitectura del sistema (v1) | ⚠️ Legacy |
| [docs/ARQUITECTURA_V2.md](ARQUITECTURA_V2.md) | **Arquitectura completa (v2)** | ✅ Actual |
| [docs/archivos-clave.md](archivos-clave.md) | Archivos fundamentales | ✅ Útil |
| [docs/motor-normativo.md](motor-normativo.md) | Motor normativo 0312 | ✅ Actual |
| [docs/escenarios-normativos.md](escenarios-normativos.md) | Escenarios aplicables | ✅ Actual |
| [docs/flujo-creacion-empresa.md](flujo-creacion-empresa.md) | Flujo de creación | ✅ Actual |
| [docs/renderer.md](renderer.md) | Sistema de renderizado | ✅ Actual |

### 3. Documentación de Módulos

| Documento | Módulo | Descripción |
|-----------|--------|-------------|
| [docs/modulo-investigacion-accidentes.md](modulo-investigacion-accidentes.md) | 3.2.2 | Investigación con IA 🤖 |
| [docs/ui-update-responsable-sg.md](ui-update-responsable-sg.md) | 1.1.1 | UI Responsable SG |
| [docs/ui-update-roles-responsabilidades.md](ui-update-roles-responsabilidades.md) | 1.1.2 | UI Roles |
| [docs/analisis-evaluacion-inicial-sg-sst.md](analisis-evaluacion-inicial-sg-sst.md) | 2.3.1 | Evaluación inicial |
| [docs/analisis-evaluacion-inicial-sg-sst-actualizado.md](analisis-evaluacion-inicial-sg-sst-actualizado.md) | 2.3.1 | Evaluación (actualizado) |

### 4. Documentación Técnica

| Documento | Área | Propósito |
|-----------|------|-----------|
| [docs/api/](api/) | API | Documentación JSDoc generada |
| [docs/scripts-python.md](scripts-python.md) | Python | Scripts de procesamiento |
| [docs/ONLYOFFICE_SETUP.md](ONLYOFFICE_SETUP.md) | OnlyOffice | Configuración de integración |
| [docs/jsdoc.json](jsdoc.json) | Herramientas | Configuración JSDoc |

### 5. Documentación de Reorganización

| Documento | Descripción | Fecha |
|-----------|-------------|-------|
| [docs/LIMPIEZA_REORGANIZACION_FEB_2026.md](LIMPIEZA_REORGANIZACION_FEB_2026.md) | **Limpieza Feb 2026** | Feb 2026 |
| [docs/ESTADO_ACTUAL_REORGANIZACION.md](ESTADO_ACTUAL_REORGANIZACION.md) | 18 fases completadas | Ene 2026 |
| [docs/README-LIMPIEZA.md](README-LIMPIEZA.md) | Mantenimiento | 2025 |
| [docs/mantenimiento-documentacion.md](mantenimiento-documentacion.md) | Proceso de docs | 2025 |

### 6. Guías y Tutoriales

| Documento | Tipo | Propósito |
|-----------|------|-----------|
| [docs/acerca-de-actualizacion.md](acerca-de-actualizacion.md) | Guía | Actualización del sistema |

---

## 🗺️ Mapa de Navegación por Rol

### 👨‍💼 Product Owner / Stakeholder

```
README.md
├── Descripción General
├── Características Principales
└── Hoja de Ruta

docs/PROJECT_OVERVIEW.md
├── Visión del Producto
└── Decisiones de Negocio

docs/CHANGELOG.md
└── Historial de Versiones
```

### 🏗️ Arquitecto de Software

```
docs/ARQUITECTURA_V2.md
├── Arquitectura Electron
├── Sistema IPC
├── Motor Normativo
└── Decisiones Arquitectónicas

docs/archivos-clave.md
├── main.js
├── preload.js
├── renderer.js
└── index.html

docs/motor-normativo.md
└── Escenarios Normativos
```

### 👨‍💻 Desarrollador Frontend

```
docs/renderer.md
├── Sistema de Renderizado
├── Módulos y Submódulos
└── Sistema Visual Oficial

docs/ui-update-*.md
└── Patrones de UI

docs/api/
└── Componentes Globales (window.*)
```

### 👨‍💻 Desarrollador Backend (Electron/Node.js)

```
docs/ARQUITECTURA_V2.md
├── Main Process
├── IPC Handlers
└── Integración Python

main.js (código)
├── 55+ handlers IPC
└── Integración FileSystem

preload.js (código)
└── 60+ contratos IPC
```

### 🤖 Ingeniero de IA/ML

```
docs/modulo-investigacion-accidentes.md
├── LLM Integration
├── Flujo de Análisis
└── Generación de Informes

Portear/src/
├── llm_server.py
├── accident_processor.py
└── accident_report_generator.py
```

### 🐍 Desarrollador Python

```
docs/scripts-python.md
├── Scripts Disponibles
├── Integración con Electron
└── Ejemplos de Uso

Portear/
├── requirements.txt
└── src/ (15+ scripts)
```

### 📝 Technical Writer

```
docs/mantenimiento-documentacion.md
├── Proceso de Documentación
└── Estándares

docs/jsdoc.json
└── Configuración JSDoc

npm run docs:generate
└── Generación Automática
```

### 🧪 QA / Tester

```
docs/DEPENDENCIAS.md
└── Instalación para testing

test/
├── test-jsdoc.js
├── test-module-cards.js
└── test_remision_utils.py

docs/CHANGELOG.md
└── Cambios por versión
```

---

## 📊 Estado de la Documentación

### Documentación Principal

| Documento | Estado | Última Act. | Prioridad |
|-----------|--------|-------------|-----------|
| README.md | ✅ Actualizado | Feb 2026 | 🔴 Alta |
| ARQUITECTURA_V2.md | ✅ Nuevo | Feb 2026 | 🔴 Alta |
| PROJECT_OVERVIEW.md | ⚠️ Revisar | 2025 | 🟡 Media |
| DEPENDENCIAS.md | ⚠️ Revisar | 2025 | 🟡 Media |
| CHANGELOG.md | ⚠️ Actualizar | Pendiente | 🟡 Media |

### Documentación de Arquitectura

| Documento | Estado | Última Act. | Prioridad |
|-----------|--------|-------------|-----------|
| arquitectura.md | ⚠️ Legacy (v1) | 2025 | 🟢 Baja |
| ARQUITECTURA_V2.md | ✅ Nuevo (v2) | Feb 2026 | 🔴 Alta |
| archivos-clave.md | ⚠️ Actualizar | 2025 | 🟡 Media |
| motor-normativo.md | ✅ Útil | 2025 | 🟡 Media |
| renderer.md | ⚠️ Actualizar | 2025 | 🟡 Media |

### Documentación de Módulos

| Módulo | Documento | Estado |
|--------|-----------|--------|
| 1.1.1 Responsable SG | ui-update-responsable-sg.md | ✅ Actual |
| 1.1.2 Roles | ui-update-roles-responsabilidades.md | ✅ Actual |
| 2.3.1 Evaluación Inicial | analisis-evaluacion-inicial-sg-sst*.md | ✅ Actual |
| 3.2.2 Investigación | modulo-investigacion-accidentes.md | ✅ Actual |

### Documentación de Reorganización

| Documento | Estado | Cobertura |
|-----------|--------|-----------|
| LIMPIEZA_REORGANIZACION_FEB_2026.md | ✅ Completo | Limpieza raíz + módulos |
| ESTADO_ACTUAL_REORGANIZACION.md | ✅ Completo | 18 fases |
| README-LIMPIEZA.md | ⚠️ Parcial | Mantenimiento |

---

## 🔍 Búsqueda Rápida por Tema

### Instalación y Configuración

```
README.md → Instalación y Configuración
docs/DEPENDENCIAS.md → Guía completa
docs/ONLYOFFICE_SETUP.md → OnlyOffice
```

### Arquitectura

```
docs/ARQUITECTURA_V2.md → Arquitectura completa
docs/arquitectura.md → Arquitectura (v1)
docs/archivos-clave.md → Archivos fundamentales
```

### Módulos

```
README.md → Módulos y Funcionalidades
docs/modulo-investigacion-accidentes.md → Módulo 3.2.2 con IA
docs/ui-update-*.md → Actualizaciones de UI
```

### IPC / Contratos

```
preload.js → Contratos expuestos (código)
main.js → Handlers (código)
docs/ARQUITECTURA_V2.md → Sistema de Comunicación IPC
```

### Motor Normativo

```
docs/motor-normativo.md → Funcionamiento
docs/escenarios-normativos.md → Escenarios
README.md → Sección Motor Normativo
```

### Python / IA

```
docs/modulo-investigacion-accidentes.md → IA para accidentes
docs/scripts-python.md → Scripts Python
Portear/src/ → Código Python
```

### UI / Sistema Visual

```
docs/renderer.md → Sistema de renderizado
docs/ui-update-*.md → Componentes UI
styles.css → Sistema Visual Oficial (código)
```

### Reorganización / Limpieza

```
docs/LIMPIEZA_REORGANIZACION_FEB_2026.md → Última limpieza
docs/ESTADO_ACTUAL_REORGANIZACION.md → 18 fases
docs/README-LIMPIEZA.md → Mantenimiento
```

---

## 📈 Métricas de Documentación

### Cantidad de Documentación

| Tipo | Cantidad |
|------|----------|
| **Archivos en docs/** | 137 |
| **Documentación funcional** | 20+ |
| **Documentación API (JSDoc)** | 100+ |
| **Documentación de reorganización** | 4 |
| **Páginas estimadas** | 500+ |

### Cobertura

| Área | Cobertura | Estado |
|------|-----------|--------|
| **Arquitectura** | 95% | ✅ Excelente |
| **Módulos** | 70% | ⚠️ Mejorable |
| **Contratos IPC** | 90% | ✅ Buena (en código) |
| **Python/IA** | 85% | ✅ Buena |
| **UI/UX** | 60% | ⚠️ Mejorable |
| **Tests** | 40% | ❌ Insuficiente |

---

## 🎯 Próximas Acciones de Documentación

### Corto Plazo (1-2 semanas)

- [ ] Actualizar `docs/CHANGELOG.md` con cambios de Feb 2026
- [ ] Actualizar `docs/DEPENDENCIAS.md` con versiones actuales
- [ ] Crear guía de "Primeros Pasos" para nuevos devs
- [ ] Documentar módulos 4-7 (Peligros, Amenazas, Verificación, Mejoramiento)

### Mediano Plazo (1 mes)

- [ ] Completar documentación de todos los submódulos
- [ ] Crear diagramas de secuencia para flujos IPC
- [ ] Documentar tests y estrategia de QA
- [ ] Crear wiki en GitHub con documentación consolidada

### Largo Plazo (3 meses)

- [ ] Migrar documentación a sistema de documentación moderno (Docusaurus, GitBook)
- [ ] Agregar ejemplos interactivos
- [ ] Crear videos tutoriales
- [ ] Documentación en inglés (opcional)

---

## 🔗 Enlaces Externos Relacionados

### Electron

- [Documentación Oficial Electron](https://www.electronjs.org/docs)
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Context Bridge](https://www.electronjs.org/docs/latest/tutorial/context-bridge)

### Node.js

- [Node.js Docs](https://nodejs.org/docs)
- [child_process](https://nodejs.org/api/child_process.html)

### Python

- [Python Docs](https://docs.python.org/3/)
- [Flask Docs](https://flask.palletsprojects.com/)

### SG-SST (Normativa)

- [Resolución 0312 de 2019](https://www.minsalud.gov.co/)
- [Decreto 1072 de 2015](https://www.funcionpublica.gov.co/)

---

## 📞 Soporte y Contribuciones

### Para Preguntas

1. Revisar este índice primero
2. Buscar en documentación específica
3. Revisar código fuente comentado (JSDoc)
4. Contactar al equipo

### Para Contribuir

1. Seguir estándares JSDoc
2. Actualizar documentación funcional relevante
3. Ejecutar `npm run docs:generate`
4. Actualizar CHANGELOG.md
5. Crear Pull Request

---

**Mantenido por:** Product Architect & Full-Stack Team  
**Última actualización:** 24 de febrero de 2026  
**Versión:** 2.0

---

## 📝 Notas

- ✅ = Actualizado y verificado
- ⚠️ = Requiere revisión/actualización
- ❌ = Obsoleto o incompleto
- 🔴 = Alta prioridad
- 🟡 = Media prioridad
- 🟢 = Baja prioridad
