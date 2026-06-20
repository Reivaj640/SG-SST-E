# Plan: Revertir `rendicion-home.html` a estado original

## Objetivo
Deshacer los cambios realizados en `rendicion-home.html` — el portal no debe ser migrado.

## Archivo a modificar
`modules/gestion-integral/rendicion-cuentas/rendicion-home.html`

## Cambios

### 1. CSS: Revertir header CSS (líneas 74-107)

De (actual):
```css
/* HEADER — Card Pattern (k-section-card) */
.k-section-card { ... }
.header-back-btn { ... }
.header-back-btn:hover { ... }
```

A (original):
```css
/* BARRA SUPERIOR INTERNA DEL PORTAL */
.portal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #f1f3f5;
}

.portal-logo {
    font-family: 'Lexend', sans-serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 10px;
}

.back-btn-internal {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 0.9rem;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    background: #f8f9fa;
    border: 1px solid var(--border);
}

.back-btn-internal:hover {
    color: var(--primary);
    background: var(--primary-light);
    border-color: var(--primary);
}
```

### 2. HTML: Revertir portal header (líneas 272-286)

De (actual):
```html
<!-- Header — Card Pattern -->
<div class="k-section-card">
    <div style="display:flex; align-items:center; gap:0.75rem;">
        <i class="bi bi-file-earmark-check" style="color:#174ea6; font-size:1.25rem;"></i>
        <div>
            <h3 style="...">Rendición de Cuentas SG-SST</h3>
            <p style="...">Gestión del informe anual de rendición de cuentas del SG-SST.</p>
        </div>
    </div>
    <div style="margin-left:auto;">
        <button class="header-back-btn" onclick="goBackToModule()">← Volver</button>
    </div>
</div>
```

A (original):
```html
<!-- Header -->
<div class="portal-header">
    <button class="back-btn-internal" onclick="goBackToModule()" title="Volver al módulo principal">
        <i class="bi bi-arrow-left"></i>
        <span>Volver al Módulo</span>
    </button>
    <div class="portal-logo">
        <i class="bi bi-file-earmark-check"></i>
        K+AIR RENDICIÓN
    </div>
</div>
```

## Verificación
- Sin errores de CSS/JS
- Portal mantiene su aspecto visual original
