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

### 3. Verificación de Período y Reuniones de Comités

#### COPASST (1.1.6) - **🆕 Actualizado v0.1.94**

**Carpetas escaneadas:** 
- `1.1.6 Conformación de Copasst/Constitución/` (actas de elección)
- `1.1.6 Conformación de Copasst/COPASST {year}/` (actas de reunión)

**Verificación de Período:**

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Sin acta de elección | `COPASST: Sin Acta de Elección/Constitución` | critical |
| Período vencido (>2 años) | `COPASST: Período vencido (YYYY-YYYY)` | critical |
| Período por vencer (≤3 meses) | `COPASST: Período por vencer (YYYY-YYYY)` | warning |
| Período vigente | `COPASST: Constitución al día (Período YYYY-YYYY)` | info |

**Criterio de validación (período):**
- Busca archivos que contengan: `acta` AND (`constitutiva` OR `constitucion` OR `escrutinio` OR `votacion`)
- Período = 2 años (ej: 2024-2026)
- Vigente hasta diciembre del año `latestYear + 2`

**Verificación de Reuniones:**

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Sin reunión mensual | `COPASST: Sin reunión desde [Mes] [Año]` | critical |
| Sin reuniones en el año | `COPASST: Sin reuniones registradas en [Año]` | critical |

**Criterio de validación (reuniones):**
- Busca archivos: `*acta*copasst*.xlsx` en carpetas `COPASST {year}/`
- Extrae mes del nombre: `(enero|febrero|...|diciembre)`
- Frecuencia esperada: **Mensual**

**Ejemplo de mensajes:**
```
INFO: COPASST: Constitución al día (Período 2024-2026)
Descripción: Última elección: 2024. Próxima renovación: Diciembre 2026.

CRITICAL: COPASST: Sin reunión desde Febrero 2026
Descripción: Última acta registrada: Febrero 2026. 
             Mes actual: Marzo 2026. 
             Requisito: Reuniones mensuales. 
             Meses sin acta: Marzo
```

---

#### Comité de Convivencia (1.1.8) - **🆕 Actualizado v0.1.94**

**Carpetas escaneadas:** 
- `1.1.8 Conformación de Comite de Convivencia/Constitución/` (actas de elección)
- `1.1.8 Conformación de Comite de Convivencia/CONVIVENCIA {year}/` (actas de reunión)

**Verificación de Período:**

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Sin acta de elección | `Comité: Sin Acta de Elección/Constitución` | critical |
| Período vencido (>2 años) | `Comité: Período vencido (YYYY-YYYY)` | critical |
| Período por vencer (≤3 meses) | `Comité: Período por vencer (YYYY-YYYY)` | warning |
| Período vigente | `Comité: Constitución al día (Período YYYY-YYYY)` | info |

**Criterio de validación (período):**
- Busca archivos que contengan: `acta` AND (`constitutiva` OR `constitucion` OR `escrutinio` OR `votacion`)
- Período = 2 años (ej: 2024-2026)
- Vigente hasta diciembre del año `latestYear + 2`

**Verificación de Reuniones:**

| Condición | Mensaje | Prioridad |
|-----------|---------|-----------|
| Sin reunión mensual | `Comité: Sin reunión desde [Mes] [Año]` | critical |
| Sin reuniones en el año | `Comité: Sin reuniones registradas en [Año]` | critical |

**Criterio de validación (reuniones):**
- Busca archivos: `*acta*convivencia*.xlsx` en carpetas `CONVIVENCIA {year}/`
- Extrae mes del nombre: `(enero|febrero|...|diciembre)`
- Frecuencia esperada: **Mensual**

**Ejemplo de mensajes:**
```
INFO: Comité: Constitución al día (Período 2024-2026)
Descripción: Última elección: 2024. Próxima renovación: Diciembre 2026.

CRITICAL: Comité: Sin reunión desde Enero 2026
Descripción: Última acta registrada: Enero 2026. 
             Mes actual: Marzo 2026. 
             Requisito: Reuniones mensuales. 
             Meses sin acta: Febrero, Marzo
```

---

## 🔧 Implementación Técnica

### Backend (JavaScript - main.js)

**Funciones agregadas (v0.1.94):**

```javascript
// Calcula estadísticas de Actas COPASST (similar a Afiliación)
async function calculateCopasstStats(basePath, currentYear) {
  // Retorna:
  return {
    totalActas: 0,
    actaMesEnCurso: false,      // ¿Existe acta del mes actual?
    ultimoMesRegistrado: null,  // Último mes encontrado
    actasAnio: 0,
    estado: 'danger',           // 'ok', 'warning', 'danger'
    alertas: []
  };
}

// Verifica período vigente de comité (COPASST o Convivencia)
function verifyCommitteePeriod(constitucionPath, committeeName) {
  // Retorna:
  return {
    vigente: true,              // ¿Período vigente?
    yearUltima: 2024,           // Año de última elección
    anosTranscurridos: 2,
    porVencer: false,           // ¿Alerta temprana?
    message: 'Período 2024-2026'
  };
}

// Verifica reuniones mensuales (usa nombre de archivo, NO fecha de modificación)
function verifyCOPASSTMeetings(basePath, year) {
  function verifyConvivenciaMeetings(basePath, year) {
  // Retorna:
  return {
    cumple: false,
    ultimoMes: 'Febrero',
    ultimoMesNumero: 2,
    mesesFaltantes: ['Marzo'],
    ultimoMesYear: 2026,
    message: 'Sin reunión desde Febrero 2026'
  };
}

// Extrae mes desde nombre de archivo
function getActasByFileName(folderPath) {
  // Filtra: *acta*copasst*.xlsx o *acta*convivencia*.xlsx
  // Extrae: (enero|febrero|...|diciembre) del nombre
  // Retorna: [{ fileName, month, monthNumber }]
}
```

### Frontend (JavaScript - recursos-home.js)

**Widget de Actas COPASST (v0.1.94):**

```javascript
createCopasstWidget() {
  const stats = this.resourceStats?.copasst || { 
    totalActas: 0,
    actaMesEnCurso: false,
    ultimoMesRegistrado: null,
    estado: 'ok',
    alertas: []
  };

  // Diseño tipo tarjeta (similar a Afiliación SSSI)
  const alDia = stats.actaMesEnCurso;
  const colorVar = alDia ? 'var(--k-success)' : 'var(--k-danger)';
  const statusText = alDia ? 'Al día' : 'Pendiente';

  // Widget muestra:
  // - Título: "Actas COPASST {year}"
  // - Badge: "Al día" o "Pendiente"
  // - Cantidad: "{N} actas"
  // - Mes actual y último registro
}
```

---

## 📊 Matriz de Estados del Módulo

| Estado | Condición | Badge | Color |
|--------|-----------|-------|-------|
| **OK** | 0 alertas | `OK` | Verde (#166534) |
| **Warning** | 1-5 alertas O cumplimiento 50-89% O período por vencer | `{N} Alertas` | Naranja (#c2410c) |
| **Danger** | >5 alertas O cumplimiento <50% O sin actas O período vencido | `{N} Alertas` | Rojo (#b91c1c) |

---

## 🧪 Pruebas

### Escenarios de Prueba - COPASST

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Última elección: 2024, hoy: Marzo 2026 | INFO: "Constitución al día (Período 2024-2026)" |
| 2 | Última elección: 2022, hoy: Marzo 2026 | CRITICAL: "Período vencido (2022-2024)" |
| 3 | Última acta: Febrero 2026, hoy: Marzo 2026 | CRITICAL: "Sin reunión desde Febrero 2026" |
| 4 | Última acta: Marzo 2026, hoy: Marzo 2026 | ✅ Sin alerta de reuniones |
| 5 | Sin actas de elección | CRITICAL: "Sin Acta de Elección/Constitución" |

### Escenarios de Prueba - Comité de Convivencia

| # | Escenario | Resultado Esperado |
|---|-----------|-------------------|
| 1 | Última elección: 2024, hoy: Marzo 2026 | INFO: "Constitución al día (Período 2024-2026)" |
| 2 | Última elección: 2022, hoy: Marzo 2026 | CRITICAL: "Período vencido (2022-2024)" |
| 3 | Última acta: Enero 2026, hoy: Marzo 2026 | CRITICAL: "Sin reunión desde Enero 2026" |
| 4 | Última acta: Marzo 2026, hoy: Marzo 2026 | ✅ Sin alerta de reuniones |
| 5 | Sin actas de elección | CRITICAL: "Sin Acta de Elección/Constitución" |

---

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
