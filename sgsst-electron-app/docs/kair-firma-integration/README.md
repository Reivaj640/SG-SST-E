# K+AIR ↔ firma-service — Integración v1

**Estado**: docs canónicos, Fase 0 cerrada, pendientes de implementación.
**Versión firma-service**: 0.1.190
**Fecha de canonización**: 2026-08-19

## Documentos

| Archivo | Tamaño | Propósito |
|---|---|---|
| `INTEGRATION.md` | 25.5 KB | Documento maestro: arquitectura, decisiones arquitectónicas tomadas, lifecycle, topología, fases de implementación |
| `INCONSISTENCIAS.md` | 14.7 KB | 28 contradicciones detectadas entre los 7 agentes discovery, cada una con resolución recomendada y estado |
| `READY-TO-IMPLEMENT.md` | 11.0 KB | Checklist de salida de Fase 0, 8 decisiones activas, tareas I-001+ con criterios de aceptación |

## 8 decisiones activas aprobadas (D-1, D-2, D-5, D-9, D-11, D-12, D-13, D-14)

Todas resueltas vía `ask_user` el 2026-08-19. Resumen:

- **D-1**: SÍ rename `tipo_documento` → `tipo_identificacion` (en identify).
- **D-2**: SÍ `subtipo_documento` libre en `metadata` JSON.
- **D-5**: NO E2E real en Fase 1; contract tests + smoke manual sintético.
- **D-9**: SÍ prefijo `/v1/` definitivo.
- **D-11**: Polling/reconciliación como fallback inicial del webhook.
- **D-12**: SÍ modelo custodia 3 dominios + matriz retención por tipo + validación jurídica antes de producción.
- **D-13**: SÍ scope por `id_empresa` en BD (tabla `gh_internal_clients`).
- **D-14**: SÍ política de deprecación (legacy v1.0/v1.1/v1.2, retiro v2.0 con criterios).

## Próximo paso

1. **Implementar Fase 1.1** en orden de ejecución: I-001 → I-002 → I-003 → I-004 → I-010 → I-012 → I-013a → I-005 → I-006 → I-013b → I-007 → I-008 → I-009 → I-011.
2. Cada tarea en commit chico, con tests pasando.
3. Push a `origin/Dev-Pc` cuando tengas todas las de Fase 1.1 listas.

## Production gate explícito (NO bloquea dev/test)

Antes de sign requests con **trabajadores reales**:
- [ ] Validación jurídica externa completada (LEGAL.md + matriz retención por tipo).
- [ ] D-11, D-12, D-13, D-14 aprobados (D-7, D-8 RETIRADOS).
- [ ] Matriz de retención por tipo documental.
- [ ] Observabilidad operativa.
- [ ] Plan de recuperación.
- [ ] CI configurado.
- [ ] TLS + auth K+AIR → firma-service.
- [ ] TLS + auth firma-service → K+AIR (CONDICIONAL si D-11 = A o B).
- [ ] Contrato de carga PDF (C-23) implementado + pdf-lib actualizado con CVEs revisados.
