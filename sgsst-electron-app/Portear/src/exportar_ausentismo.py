#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
=====================================================================
 Exportador de ausentismo (3.3.6) - ANEXA filas a una COPIA del Excel
 oficial (PI-FO-076 / PG-FO-076 / GI-FO-076 / A-FR-31).

 Por que un archivo aparte y no un comando nuevo en
 `actualizar_ausentismo.py`: ese script queda intacto (es el que se usa
 para el flujo viejo) y este solo hace una cosa - anexar filas a una
 copia, en una sola lectura y una sola escritura.

 USO:
   python exportar_ausentismo.py <archivo_copia> <empresa> <anio> <json>

 El JSON trae el mapeo YA RESUELTO (lo calcula Node, que es donde vive
 la logica de nombres de columna):
   {
     "hoja": "Aseplus 2024",       # hoja destino (o null para crearla)
     "encabezado_fila": 7,
     "mapa_columnas": { "cedula": 3, "nombre": 2, ... },   # campo -> indice 0-based
     "campos": ["cedula", "nombre", ...],                  # en el orden de las columnas
     "filas": [[valores...], ...],
     "registros": [{"id": "...", "fecha_inicio": "..."}]
   }

 SALIDA (stdout, una sola linea JSON):
   {"type": "result", "payload": {"success": true, "hoja": "...", "filas_por_id": [...]}}

 IMPORTANTE: el archivo que se recibe YA es una copia. Este script
 nunca escribe sobre el archivo oficial de la empresa.
=====================================================================
"""

import json
import os
import sys

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter


def log(mensaje):
    print(json.dumps({"type": "log", "message": str(mensaje)}, ensure_ascii=False))


def _resultado(payload):
    print(json.dumps({"type": "result", "payload": payload}, ensure_ascii=False))


def _fila_libre(ws, desde):
    """Primera fila a partir de `desde` cuya columna 1 esta vacia.

    Es la misma regla que usa `registrar_incapacidad` de
    `actualizar_ausentismo.py`: la columna 1 lleva el numero de caso.
    """
    max_row = ws.max_row or desde
    for r in range(desde, max_row + 2):
        valor = ws.cell(row=r, column=1).value
        if valor is None or str(valor).strip() == "":
            return r
    return max_row + 1


def _copiar_encabezado(origen, destino, hasta_fila):
    """Copia las filas 1..hasta_fila y el ancho de columnas de otra hoja."""
    for r in range(1, hasta_fila + 1):
        for c in range(1, (origen.max_column or 1) + 1):
            celda_origen = origen.cell(row=r, column=c)
            celda_destino = destino.cell(row=r, column=c)
            celda_destino.value = celda_origen.value
    for letra, dim in (origen.column_dimensions or {}).items():
        destino.column_dimensions[letra].width = dim.width
    for indice, dim in (origen.row_dimensions or {}).items():
        try:
            destino.row_dimensions[int(indice)].height = dim.height
        except (TypeError, ValueError):
            pass


def _hoja_de_datos(wb):
    """Devuelve la hoja de datos mas reciente (tiene CEDULA y DIAS)."""
    candidatas = []
    for nombre in wb.sheetnames:
        ws = wb[nombre]
        if ws is None or ws.max_row is None:
            continue
        for r in range(1, min(ws.max_row, 12) + 1):
            textos = []
            for c in range(1, min(ws.max_column or 1, 30) + 1):
                v = ws.cell(row=r, column=c).value
                textos.append("" if v is None else str(v).upper())
            tiene_dias = any("DIAS" in t and "INCAPACIDAD" in t for t in textos)
            tiene_cedula = any("CEDULA" in t for t in textos)
            if tiene_dias and tiene_cedula:
                candidatas.append((nombre, r))
                break
    if not candidatas:
        return None, None
    return wb[candidatas[-1][0]], candidatas[-1][1]


def exportar(archivo, empresa, anio, carga):
    if not os.path.exists(archivo):
        return {"success": False, "error": "No existe el archivo: %s" % archivo}

    wb = load_workbook(archivo)
    encabezado_fila = int(carga.get("encabezado_fila") or 7)
    mapa = carga.get("mapa_columnas") or {}
    campos = carga.get("campos") or []
    filas = carga.get("filas") or []
    registros = carga.get("registros") or []

    nombre_hoja = carga.get("hoja")
    ws = wb[nombre_hoja] if nombre_hoja and nombre_hoja in wb.sheetnames else None

    if ws is None:
        # La hoja del anio pedido no existe: se crea copiando la estructura
        # de la hoja de datos mas reciente (encabezados y anchos).
        origen, _ = _hoja_de_datos(wb)
        if origen is None:
            return {"success": False, "error": "La copia no tiene ninguna hoja de datos"}
        nombre_hoja = "%s %s" % (empresa.strip().upper(), anio)
        if nombre_hoja in wb.sheetnames:
            nombre_hoja = nombre_hoja + " (app)"
        ws = wb.create_sheet(title=nombre_hoja)
        _copiar_encabezado(origen, ws, encabezado_fila)
        log("Hoja creada: %s" % nombre_hoja)

    fila = _fila_libre(ws, encabezado_fila + 1)
    primera = fila
    for valores in filas:
        for i, campo in enumerate(campos):
            if i >= len(valores):
                break
            columna = mapa.get(campo)
            if columna is None:
                continue
            valor = valores[i]
            if valor is None:
                valor = ""
            ws.cell(row=fila, column=int(columna) + 1).value = valor
        fila += 1

    wb.save(archivo)

    por_id = []
    for i, reg in enumerate(registros):
        por_id.append({
            "id": reg.get("id"),
            "fila": primera + i,
            "fecha_inicio": reg.get("fecha_inicio")
        })

    return {
        "success": True,
        "hoja": nombre_hoja,
        "filas": len(filas),
        "fila_inicial": primera,
        "filas_por_id": por_id
    }


def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            "type": "result",
            "payload": {
                "success": False,
                "error": "Uso: python exportar_ausentismo.py <archivo> <empresa> <anio> <json>"
            }
        }, ensure_ascii=False))
        sys.exit(1)

    archivo = sys.argv[1]
    empresa = sys.argv[2]
    anio = sys.argv[3]
    try:
        carga = json.loads(sys.argv[4])
    except Exception as e:
        _resultado({"success": False, "error": "Error parsing JSON: %s" % e})
        return

    try:
        resultado = exportar(archivo, empresa, anio, carga)
    except Exception as e:
        import traceback
        _resultado({"success": False, "error": str(e), "trace": traceback.format_exc()})
        return

    _resultado(resultado)


if __name__ == "__main__":
    main()
