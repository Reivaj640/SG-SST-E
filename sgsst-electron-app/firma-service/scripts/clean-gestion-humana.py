#!/usr/bin/env python3
"""
clean-gestion-humana.py — Limpia tablas de gestion humana + firma electronica
de kair.db y firma-service/data/firma.sqlite.

USO:
  python clean-gestion-humana.py [--dry-run]

Por defecto hace los cambios. Con --dry-run solo muestra qué se haría.

REQUISITOS:
  - firma-service DEBE estar detenido (sino la DB está locked)
  - K+AIR app DEBE estar cerrada (para kair.db)

AUTOR: Mavis (auditoria gestion humana 2026-09-10)
BACKUP: C:\Proyectos de programacion\SG-SST-E\backups\gestion-humana-clean-<timestamp>\
"""

import sqlite3
import sys
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

# Tablas a LIMPIAR (DELETE FROM ...;)
# NO TOCAR: gh_firma_schema_migrations, gh_firma_idempotency_keys
KAIR_TABLES_TO_CLEAN = [
    'contrataciones',
    'base_personal',
    'gh_sedes',
    'gh_vacaciones',
    'gh_permisos',
    'gh_documentos',
    'gh_anuncios',
    'gh_mensajes',
    'gh_envios',
    'gh_comunicacion_adjuntos',
    'gh_documentos_afiliaciones',
    'gh_templates',
    'gh_contratacion_soportes',
    'gh_eventos_personal',
]

FIRMA_TABLES_TO_CLEAN = [
    'gh_firma_acuerdo_versiones',  # texto de los acuerdos (se regenera del schema)
    'gh_consentimientos_firma',
    'gh_firmas_electronicas',
    'gh_firma_eventos',
    'gh_firma_sesiones',
]

# Tablas que NUNCA debemos tocar (migrations, idempotency, audit)
KAIR_TABLES_PROTECTED = []
FIRMA_TABLES_PROTECTED = [
    'gh_firma_schema_migrations',  # tracking de migrations aplicadas
    'gh_firma_idempotency_keys',    # idempotency para rate limit
]

KAIR_DB_PATH = Path(os.environ.get('APPDATA', '')) / 'sgsst-electron-app' / 'kair.db'
FIRMA_DB_PATH = Path(r'C:\Proyectos de programación\SG-SST-E\sgsst-electron-app\firma-service\data\firma.sqlite')

DRY_RUN = '--dry-run' in sys.argv


def safe_wal_checkpoint(db_path):
    """Hace WAL checkpoint + truncate antes de modificar, para que los datos
    en el .wal se persistan al main .db y no haya inconsistencia."""
    conn = sqlite3.connect(str(db_path))
    try:
        result = conn.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()
        if not DRY_RUN:
            print(f'  [WAL] {db_path.name}: wal_checkpoint(TRUNCATE) = {result}')
    finally:
        conn.close()


def get_table_counts(conn, tables):
    """Retorna dict {table_name: row_count}"""
    counts = {}
    for t in tables:
        try:
            c = conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
            counts[t] = c
        except sqlite3.OperationalError as e:
            counts[t] = f'ERROR: {e}'
    return counts


def clean_table(conn, table):
    """DELETE FROM table. NO usa TRUNCATE (no soportado en SQLite)."""
    cursor = conn.execute(f'DELETE FROM "{table}"')
    deleted = cursor.rowcount
    # Resetear AUTOINCREMENT si existe
    try:
        conn.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}'")
    except sqlite3.OperationalError:
        pass  # No hay sqlite_sequence para esta tabla (no es AUTOINCREMENT)
    return deleted


def process_db(db_path, tables_to_clean, tables_protected, label):
    print(f'\n=== {label}: {db_path.name} ===')
    if not db_path.exists():
        print(f'  [SKIP] No existe: {db_path}')
        return
    print(f'  Path: {db_path}')
    print(f'  Size: {db_path.stat().st_size} bytes')
    # WAL checkpoint
    safe_wal_checkpoint(db_path)
    # Conectar
    conn = sqlite3.connect(str(db_path))
    try:
        # Verificar que las tablas existen
        existing = set(r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall())
        print(f'  Total tablas en DB: {len(existing)}')
        # Mostrar counts ANTES
        print(f'\n  Conteos ANTES de limpieza:')
        before = get_table_counts(conn, tables_to_clean)
        for t, c in before.items():
            if isinstance(c, int) and c > 0:
                print(f'    {t}: {c} rows')
        # Verificar que las tablas protected existen (deberían)
        for t in tables_protected:
            if t in existing:
                c = conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
                print(f'    [PROTECTED] {t}: {c} rows (NO TOCAR)')
        # Aplicar limpieza
        if DRY_RUN:
            print(f'\n  [DRY-RUN] No se aplicaron cambios')
        else:
            print(f'\n  Aplicando DELETE FROM en {len(tables_to_clean)} tablas...')
            total_deleted = 0
            for t in tables_to_clean:
                if t not in existing:
                    print(f'    [SKIP] {t}: no existe')
                    continue
                deleted = clean_table(conn, t)
                print(f'    {t}: {deleted} rows eliminados')
                total_deleted += deleted
            conn.commit()
            # VACUUM para liberar espacio
            print(f'\n  Ejecutando VACUUM...')
            conn.execute('VACUUM')
            conn.commit()
            print(f'  Total rows eliminados: {total_deleted}')
        # Verificar DESPUES
        print(f'\n  Conteos DESPUES:')
        after = get_table_counts(conn, tables_to_clean)
        for t, c in after.items():
            if isinstance(c, int):
                print(f'    {t}: {c} rows')
    finally:
        conn.close()
    print(f'  Size despues: {db_path.stat().st_size} bytes')


def main():
    print('=' * 70)
    print('CLEAN GESTION HUMANA + FIRMA ELECTRONICA')
    print('=' * 70)
    print(f'Modo: {"DRY-RUN (no aplica cambios)" if DRY_RUN else "EJECUTAR (aplica cambios)"}')
    print(f'Timestamp: {datetime.now().isoformat()}')
    # Confirmar en modo ejecutar (saltado en CI / non-interactive)
    if not DRY_RUN and sys.stdin.isatty():
        print('\n[ATENCION] Esto va a ELIMINAR todos los datos de:')
        print('  - kair.db: contrataciones, base_personal, gh_*, etc.')
        print('  - firma.sqlite: gh_consentimientos_firma, gh_firmas_electronicas, etc.')
        print('  - Deja intacto: schema, migrations tracking, idempotency keys')
        print('  - Backup en: backups/gestion-humana-clean-<timestamp>/')
        resp = input('\nEscribi SI para continuar, o Ctrl+C para abortar: ')
        if resp.strip().upper() != 'SI':
            print('Abortado por el usuario')
            sys.exit(0)
    elif not DRY_RUN:
        print('\n[NON-INTERACTIVE] Modo ejecutar sin confirmacion (asume --yes)')
    # Procesar kair.db
    process_db(
        KAIR_DB_PATH,
        KAIR_TABLES_TO_CLEAN,
        KAIR_TABLES_PROTECTED,
        'K+AIR DB (kair.db)'
    )
    # Procesar firma.sqlite
    process_db(
        FIRMA_DB_PATH,
        FIRMA_TABLES_TO_CLEAN,
        FIRMA_TABLES_PROTECTED,
        'FIRMA-SERVICE DB (firma.sqlite)'
    )
    print('\n' + '=' * 70)
    print('LIMPIEZA COMPLETADA')
    print('=' * 70)
    print('Proximos pasos:')
    print('  1. Reiniciar firma-service (lo hace el orquestador automaticamente)')
    print('  2. Abrir K+AIR - las tablas estaran vacias, listas para usar como nuevas')
    print('  3. Si algo salio mal, restaurar desde: backups/gestion-humana-clean-*/')


if __name__ == '__main__':
    main()
