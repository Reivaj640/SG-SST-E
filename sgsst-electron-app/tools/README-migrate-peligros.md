# Migración de Matriz de Peligros: JSON → SQLite (better-sqlite3)

Este script standalone migra la persistencia actual del módulo 4.1.2 (JSON en
`%APPDATA%\sgsst-electron-app\identificacion-peligros-data\`) a una base SQLite
mantenida por `better-sqlite3` (ya en `package.json`).

## ⚠️ NO se ejecuta automáticamente

Es una utilidad. Solo se corre cuando decidas hacer la migración.

## Uso

```powershell
# 1) Ver qué se migraría (sin escribir nada):
node tools/migrate-peligros-to-sqlite.js --dry-run

# 2) Ejecutar la migración real:
node tools/migrate-peligros-to-sqlite.js

# 3) Con rutas personalizadas:
node tools/migrate-peligros-to-sqlite.js --src "C:\datos\json" --dst "C:\datos\peligros.db"
```

## Qué hace

1. Lee todos los `.json` en la carpeta origen (cada archivo = 1 empresa).
2. Crea un backup automático del `.db` destino si ya existe.
3. Crea el schema SQLite (idéntico al del preload v2 con better-sqlite3).
4. Inserta filas en 3 tablas:
   - `matrices` (1 fila por empresa, con el JSON completo)
   - `peligros` (1 fila por peligro, desnormalizado para queries rápidos)
   - `entities` (vacía por ahora — se llenará al usar el editor Patrón C)
5. Loggea cada paso con formato `[K+AIRSST][MIGRATE_PELIGROS][...]`.

## Después de migrar

1. Verificar que el `.db` tiene los conteos correctos (`sqlite3 peligros.db "SELECT COUNT(*) FROM peligros;"`).
2. Reemplazar el `identificacion-peligros-bridge.js` para usar SQLite en vez de JSON.
3. Borrar los JSON originales (o moverlos a una subcarpeta `archive/`).
4. Hacer commit del cambio en `main.js` y `preload.js`.

## Rollback

Si algo sale mal:
- El backup automático está en `<destino>.bak.<timestamp>`.
- Los JSON originales no se tocan hasta el paso 3 de "después de migrar".
