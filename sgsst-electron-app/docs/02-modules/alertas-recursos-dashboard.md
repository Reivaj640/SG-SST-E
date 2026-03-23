# Alertas del Dashboard - Módulo de Recursos

**Versión:** 0.1.91  
**Fecha:** 22 de marzo de 2026  
**Módulo:** Recursos (Módulo 1)

---

## 📋 Resumen

El sistema de alertas del módulo de Recursos ha sido mejorado para proporcionar información específica por submódulo, incluyendo alertas preventivas y validación de cumplimiento normativo.

---

## 🎯 Tipos de Alertas

### 1. Alertas de Capacitaciones (1.2.1)

**Archivo escaneado:** `Capacitaciones.xlsx`

#### Alertas Críticas (🔴)

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Cumplimiento < 50% | `{N} Capacitaciones Vencidas ({detalle})` | critical |
| Cumplimiento 50-89% | `{N} Capacitaciones Vencidas ({detalle})` | warning |

**Detalle por tipo:**
- COPASST
- Comité de Convivencia
- Inducciones
- Curso 50 Horas
- Otras

**Ejemplo de mensaje:**
```
5 Capacitaciones Vencidas (2 COPASST, 1 Comité Convivencia, 2 Inducciones)
Sesiones programadas sin ejecutar o sin registrar. Cumplimiento actual: 45.2%
```

#### Alertas Preventivas (🔵)

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Próximas en 7 días | `{N} Capacitaciones Próximas (7 días)` | info |

**Ejemplo de mensaje:**
```
3 Capacitaciones Próximas (7 días)
Sesiones programadas para esta semana. Verificar logística y participantes.
```

#### KPIs Calculados

| KPI | Fórmula | Fuente |
|-----|---------|--------|
| `overdue_docs` | Count(FECHA < hoy AND ESTADO ≠ 'Realizado') | Capacitaciones.xlsx |
| `compliance` | (Completadas / Total) × 100 | Capacitaciones.xlsx |
| `recursos_alerts` | Vencidas + Próximas(7 días) | Cálculo interno |

---

### 2. Alertas de EPP (2.13.1)

**Archivo escaneado:** `EntregaEPP.xlsx`

#### Alertas Críticas (🔴)

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| FECHA ENTREGA < hoy | `{N} EPP Sin Entregar (Vencidos)` | critical |

**Ejemplo de mensaje:**
```
8 EPP Sin Entregar (Vencidos)
Equipos de protección programados sin registro de entrega. Riesgo de incumplimiento normativo.
```

#### Alertas Preventivas (🔵)

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Próximos en 7 días | `{N} EPP Próximos a Entregar (7 días)` | info |

**Ejemplo de mensaje:**
```
5 EPP Próximos a Entregar (7 días)
Equipos programados para esta semana. Verificar disponibilidad y agendar entregas.
```

---

### 3. Verificación de Actas Constitutivas

#### COPASST (1.1.6)

**Carpeta escaneada:** `1.1.6 Conformación de Copasst/`

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Sin acta constitutiva | `COPASST: Sin Acta Constitutiva` | critical |

**Criterio de validación:**
- Busca archivos que contengan: `acta` AND (`constitutiva` OR `constitucion`)

**Ejemplo de mensaje:**
```
COPASST: Sin Acta Constitutiva
No se encontró el acta constitutiva de COPASST. Requisito normativo obligatorio.
```

#### Comité de Convivencia (1.1.8)

**Carpeta escaneada:** `1.1.8 Comité de Convivencia/`

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Sin acta constitutiva | `Comité de Convivencia: Sin Acta Constitutiva` | critical |

**Criterio de validación:**
- Busca archivos que contengan: `acta` AND (`constitutiva` OR `constitucion`)

**Ejemplo de mensaje:**
```
Comité de Convivencia: Sin Acta Constitutiva
No se encontró el acta constitutiva del Comité. Requisito normativo obligatorio.
```

---

## 🔧 Implementación Técnica

### Backend (Python)

**Archivo:** `Portear/python-embed/python-scripts/dashboard_scanner.py`

#### Estructura de Datos Devuelta

```json
{
  "kpis": {
    "accidents_month": 0,
    "pric_active": 0,
    "overdue_docs": 5,
    "compliance": 45.2,
    "recursos_alerts": 8
  },
  "tasks": [
    {
      "title": "5 Capacitaciones Vencidas (2 COPASST, 1 Comité, 2 Inducciones)",
      "desc": "Sesiones programadas sin ejecutar o sin registrar. Cumplimiento actual: 45.2%",
      "priority": "critical",
      "module": "capacitaciones",
      "icon": "fas fa-chalkboard-teacher",
      "submodule": "1.2.1 Programa de Capacitación"
    }
  ],
  "module_status": {
    "recursos": "danger"
  },
  "recursos_detail": {
    "capacitaciones_vencidas": {
      "total": 5,
      "copasst": 2,
      "comite_convivencia": 1,
      "inducciones": 2,
      "curso_50_horas": 0,
      "otros": 0
    },
    "capacitaciones_proximas": {
      "total": 3,
      "en_7_dias": 3,
      "en_15_dias": 0
    },
    "epp_por_entregar": 8,
    "cumplimiento_porcentaje": 45.2
  }
}
```

### Frontend (JavaScript)

**Archivo:** `renderer.js`

#### Función `updateModuleBadges()`

Muestra el badge del módulo de Recursos con el número real de alertas:

```javascript
// Antes: "OK", "Pendiente", "Alerta"
// Ahora: "3 Alertas", "5 Alertas", etc.

function updateModuleBadges(moduleStatus, recursosAlerts = 0) {
  for (const [moduleName, status] of Object.entries(moduleStatus)) {
    const badgeEl = document.getElementById(`module-badge-${moduleName}`);
    if (badgeEl) {
      if (moduleName === 'recursos' && recursosAlerts > 0) {
        badgeEl.textContent = `${recursosAlerts} Alertas`;
        // Colores según severidad
      }
    }
  }
}
```

#### Función `renderTasks()`

Muestra tareas con ícono y submódulo:

```javascript
// Nueva estructura visual:
// [Ícono] [TAG PRIORIDAD] [TAG SUBMÓDULO]
//         [Título de la tarea]
//         [Descripción]
```

---

## 📊 Matriz de Estados del Módulo

| Estado | Condición | Badge | Color |
|--------|-----------|-------|-------|
| **OK** | 0 alertas | `OK` | Verde (#166534) |
| **Warning** | 1-5 alertas O cumplimiento 50-89% | `{N} Alertas` | Naranja (#c2410c) |
| **Danger** | >5 alertas O cumplimiento <50% O sin actas | `{N} Alertas` | Rojo (#b91c1c) |

---

## 🧪 Pruebas

### Escenarios de Prueba

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | 0 capacitaciones vencidas, 0 EPP | Badge: "OK" |
| 2 | 3 capacitaciones vencidas | Badge: "3 Alertas" (Naranja) |
| 3 | 10 capacitaciones vencidas | Badge: "10 Alertas" (Rojo) |
| 4 | Cumplimiento 45% | Badge: "X Alertas" (Rojo) + Tarea crítica |
| 5 | Sin acta COPASST | Tarea crítica + Badge Rojo |
| 6 | 5 EPP próximos (7 días) | Tarea informativa + Badge Naranja |

### Comandos de Prueba

```bash
# Ejecutar script Python directamente
python Portear/python-embed/python-scripts/dashboard_scanner.py "C:\Empresas\Tempoactiva"

# Ver salida JSON
# Debe incluir recursos_detail y kpis.recursos_alerts
```

---

## 📈 Métricas de Impacto

### Antes de la Mejora

| Métrica | Valor |
|---------|-------|
| Alertas genéricas | "X Capacitaciones Vencidas" |
| Especificidad | 0% |
| Alertas preventivas | 0 |
| Validación normativa | 0% |

### Después de la Mejora

| Métrica | Valor |
|---------|-------|
| Alertas específicas | "X Capacitaciones Vencidas (detalle por tipo)" |
| Especificidad | 100% |
| Alertas preventivas | 2 tipos (capacitaciones, EPP) |
| Validación normativa | 2 actas verificadas |

---

## 🔗 Referencias Cruzadas

### Documentos Relacionados
- `docs/02-modules/modulo-1-recursos.md`
- `docs/05-updates/v0.1.91-navegacion-home-empresa.md`

### Archivos Clave
- `Portear/python-embed/python-scripts/dashboard_scanner.py`
- `renderer.js` (líneas ~2707-2725)

### Módulos Afectados
- **Recursos:** Badge actualizado
- **Dashboard:** Tareas con más detalle
- **Backend:** Python scanner mejorado

---

## ✅ Checklist de Implementación

- [x] Alertas específicas por tipo de capacitación
- [x] Alertas preventivas (7 y 15 días)
- [x] Cálculo de % de cumplimiento
- [x] Verificación de actas COPASST
- [x] Verificación de actas Comité de Convivencia
- [x] Badge dinámico con conteo real
- [x] UI de tareas con ícono y submódulo
- [x] Documentación actualizada

---

**Documento creado:** 22 de marzo de 2026  
**Próxima revisión:** v0.1.92
