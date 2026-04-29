# Instrucciones Globales - OpenCode

## Skills Disponibles

Todos los skills se activan con `skill({ name: "<nombre>" })`. El modelo decide cuando cargarlos segun la tarea.

### Skills de UI/UX

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **ui-ux-pro-max** | Diseno de interfaces, paletas, tipografia, animaciones, responsive, dark mode | OBLIGATORIO para UI/UX |
| **frontend-design** | Interfaces con alta calidad visual, estetica creativa, evitar look generico AI | Recomendado para UI nueva |

**ui-ux-pro-max** - Motor de busqueda Python (ejecutar antes de implementar UI):
```bash
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "K+AIR"
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack html-tailwind
```

**Stacks:** html-tailwind, react, nextjs, vue, svelte, swiftui, react-native, flutter, shadcn, jetpack-compose
**Dominios:** product, style, typography, color, landing, chart, ux, web, prompt

### Skills de Desarrollo

| Skill | Cuando usarlo | Activacion |
|-------|--------------|------------|
| **feature-dev** | Desarrollar features nuevas (workflow 7 fases) | Al implementar features |
| **code-architect** | Disenar arquitectura antes de implementar | Antes de features grandes |
| **code-explorer** | Entender codigo existente antes de modificarlo | Antes de tocar codigo desconocido |
| **code-reviewer** | Review de bugs, seguridad, calidad (confidence >= 80) | Despues de implementar, antes de commit |
| **code-simplifier** | Simplificar codigo manteniendo funcionalidad | Despues de implementar, antes de commit |
| **silent-failure-hunter** | Cazar errores silenciosos y error handling deficiente | Despues de escribir try-catch o fallbacks |
| **commit-workflow** | Crear commits, push, PRs con mensajes significativos | Al hacer commit o PR |

### Workflow Recomendado para Desarrollo

1. **feature-dev** - Workflow completo (7 fases: discovery, exploration, questions, architecture, implementation, review, summary)
2. **code-simplifier** - Despues de implementar codigo
3. **code-reviewer** - Antes de commit
4. **commit-workflow** - Al hacer commit

### Proyecto K+AIR (SG-SST Electron)
- Stack: Electron + vanilla JS + Python 3.11.9
- No usar frameworks frontend (React, Vue, etc.)
- Para UI usar: html-tailwind guidelines del skill ui-ux-pro-max
- Cumplir Resolucion 0312 de 2019 (Colombia)
