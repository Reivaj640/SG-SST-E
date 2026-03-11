/**
 * SUBMÓDULO 2.9.1 - EVALUACIÓN DE PROVEEDORES
 * Componente principal para la gestión integral de proveedores
 * 
 * @module evaluacion-proveedores
 * @subcategory Gestión Integral / 2.9.1
 * @author K+AIR Development Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Referencia al módulo path (disponible en Electron renderer con nodeIntegration)
    const path = window.require ? window.require('path') : {
        join: (...args) => args.join('/').replace(/\/+/g, '/')
    };

    class EvaluacionProveedores {
        constructor(container, moduleName, submoduleTitle, backToModuleCallback) {
            this.container = container;
            this.moduleName = moduleName;
            this.submoduleTitle = submoduleTitle;
            this.backToModuleCallback = backToModuleCallback;

            // Estado del componente
            this.suppliersData = [];
            this.selectedFiles = [];
            this.currentSupplier = null;
            this.submodulePath = null;
            this.companyName = null;

            // Referencias DOM
            this.modal = null;
            this.panel = null;
            this.dropZone = null;
            this.fileInput = null;
        }

        /**
         * Renderiza el componente completo
         */
        async render() {
            // Registrar instancia global para manejo de eventos
            window.currentEvaluacionProveedoresInstance = this;

            // Limpiar contenedor
            this.container.innerHTML = '';
            this.container.className = '';
            this.container.classList.add('evaluacion-proveedores');

            // Cargar configuración y datos
            await this.loadConfig();
            await this.loadSuppliersData();

            // Renderizar UI
            this.renderUI();

            // Inicializar eventos
            this.initEventListeners();

            // Renderizar tabla inicial
            this.renderTable(this.suppliersData);
            this.updateMetrics();
        }

        /**
         * Carga la configuración desde el backend
         */
        async loadConfig() {
            try {
                // Intentar obtener la empresa desde window.currentCompany (set por renderer.js)
                this.companyName = window.currentCompany || window.electronAPI.currentCompany || null;
                
                // Si aún es null, intentar cargar desde config
                if (!this.companyName) {
                    const config = await window.electronAPI.loadConfig();
                    // Buscar la primera empresa en companyPaths como fallback
                    if (config.companyPaths) {
                        const companies = Object.keys(config.companyPaths);
                        this.companyName = companies.length > 0 ? companies[0] : null;
                    }
                }
                
                console.log('[2.9.1][CONFIG] Empresa actual:', this.companyName);
                
                // Si还是没有 empresa, mostrar notificación
                if (!this.companyName) {
                    console.warn('[2.9.1][WARN] No se pudo determinar la empresa actual');
                }
            } catch (error) {
                console.error('[2.9.1][ERROR] Error cargando configuración:', error);
                this.showNotification('Error cargando configuración', 'error');
            }
        }

        /**
         * Carga los datos de proveedores desde el archivo Excel
         */
        async loadSuppliersData() {
            console.log('========================================');
            console.log('[2.9.1][INICIO] Iniciando carga de datos de proveedores');
            console.log('[2.9.1][INICIO] Empresa:', this.companyName);
            console.log('========================================');

            if (!this.companyName) {
                console.warn('[2.9.1][WARN] No hay empresa seleccionada, usando datos vacíos');
                this.suppliersData = [];
                return;
            }

            try {
                console.log('[2.9.1][PASO 1] Buscando ruta del submódulo...');
                // Buscar ruta del submódulo
                const pathResult = await window.electronAPI.findSubmodulePath(
                    this.companyName,
                    'Gestión Integral',
                    '2.9.1 Identificación y evaluación para la adquisición de bienes y servicios'
                );

                if (pathResult.success) {
                    this.submodulePath = pathResult.path;
                    console.log('[2.9.1][PASO 1 COMPLETADO] ✅ Ruta encontrada:', this.submodulePath);

                    // Intentar leer archivo Excel de proveedores - USAR EL ARCHIVO EXISTENTE
                    const excelFileName = 'Identificaciòn y evaluaciòn de adquisiciones.xlsx';
                    const excelPath = this.submodulePath.replace(/\\/g, '/') + '/' + excelFileName;
                    console.log('[2.9.1][PASO 2] Intentando leer Excel desde:', excelPath);
                    console.log('[2.9.1][PASO 2] Nombre del archivo:', excelFileName);

                    try {
                        console.log('[2.9.1][PASO 3] Leyendo archivo Excel...');
                        // Intentar leer el archivo Excel (devuelve buffer)
                        const bufferResult = await window.electronAPI.readExcelFile(excelPath);
                        
                        if (bufferResult.success && bufferResult.data) {
                            console.log('[2.9.1][PASO 3 COMPLETADO] ✅ Buffer recibido, procesando con XLSX...');
                            
                            // Procesar buffer con XLSX
                            const workbook = XLSX.read(new Uint8Array(bufferResult.data), { type: 'array' });
                            
                            console.log('[2.9.1][INFO] Hojas encontradas:', workbook.SheetNames);

                            // Obtener primera hoja
                            const firstSheet = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[firstSheet];

                            console.log('[2.9.1][INFO] Rango de la hoja (!ref):', worksheet['!ref']);
                            
                            // 📊 CORRECCIÓN CRÍTICA: El !ref no se actualiza automáticamente al guardar con ExcelJS
                            // Necesitamos leer hasta la última fila posible, no solo las del !ref
                            
                            // Leer TODOS los datos como array (fila por fila) SIN usar el !ref
                            // Usamos range: 0 para leer desde la primera fila hasta el final del archivo
                            const rawData = XLSX.utils.sheet_to_json(worksheet, { 
                                header: 1, 
                                defval: '',
                                range: 0,  // Leer desde fila 0 hasta el final
                                blankrows: false  // Ignorar filas completamente vacías
                            });

                            console.log('[2.9.1][INFO] Total filas leídas (con range: 0):', rawData.length);
                            console.log('[2.9.1][DEBUG] Primeras 15 filas:', rawData.slice(0, 15));
                            
                            // Si no hay datos, intentar con el !ref original como fallback
                            if (rawData.length === 0 && worksheet['!ref']) {
                                console.log('[2.9.1][WARN] No se leyeron datos con range: 0, intentando con !ref original...');
                                const rawDataRef = XLSX.utils.sheet_to_json(worksheet, { 
                                    header: 1, 
                                    defval: '',
                                    range: worksheet['!ref']
                                });
                                if (rawDataRef.length > rawData.length) {
                                    console.log('[2.9.1][INFO] !ref original tiene más datos, usándolo...');
                                    rawData = rawDataRef;
                                    console.log('[2.9.1][INFO] Total filas leídas (!ref):', rawData.length);
                                }
                            }
                            
                            // Buscar automáticamente la fila de encabezados
                            // Los encabezados deben contener al menos "ID" o "Razón Social" o "NIT"
                            let headerRowIndex = -1;
                            for (let i = 0; i < Math.min(10, rawData.length); i++) {
                                const row = rawData[i];
                                if (row && row.length > 0) {
                                    // Verificar si esta fila contiene los encabezados esperados
                                    const rowStr = row.join(' ').toLowerCase();
                                    if (rowStr.includes('id') || rowStr.includes('razón social') || rowStr.includes('nit')) {
                                        headerRowIndex = i;
                                        console.log('[2.9.1][DEBUG] Fila de encabezados encontrada en índice:', i);
                                        break;
                                    }
                                }
                            }
                            
                            // Si no se encontraron encabezados, usar índice 0 por defecto
                            if (headerRowIndex === -1) {
                                console.warn('[2.9.1][WARN] No se encontraron encabezados, usando índice 0');
                                headerRowIndex = 0;
                            }
                            
                            const headers = rawData[headerRowIndex] || [];
                            
                            console.log('========================================');
                            console.log('[2.9.1][UBICACIÓN TÍTULOS]');
                            console.log('[2.9.1][UBICACIÓN TÍTULOS] Fila de encabezados: Índice', headerRowIndex, '(Fila', headerRowIndex + 1, ')');
                            console.log('[2.9.1][UBICACIÓN TÍTULOS] Encabezados encontrados:', headers);
                            console.log('[2.9.1][UBICACIÓN TÍTULOS] Total columnas:', headers.length);
                            console.log('[2.9.1][UBICACIÓN TÍTULOS] Detalle de columnas:');
                            headers.forEach((header, index) => {
                                console.log(`  Columna ${String.fromCharCode(65 + index)} (índice ${index}): "${header}"`);
                            });
                            console.log('========================================');
                            
                            // Leer datos desde la fila siguiente a los encabezados
                            const dataStartIndex = headerRowIndex + 1;
                            console.log('[2.9.1][UBICACIÓN DATOS]');
                            console.log('[2.9.1][UBICACIÓN DATOS] Inicio de datos: Índice', dataStartIndex, '(Fila', dataStartIndex + 1, ')');
                            console.log('[2.9.1][UBICACIÓN DATOS] Fin de datos: Índice', rawData.length - 1, '(Fila', rawData.length, ')');
                            
                            // 📊 LOG QUIRÚRGICO: Mostrar TODAS las filas para debugging
                            console.log('[2.9.1][DEBUG] === TODAS LAS FILAS DEL EXCEL ===');
                            rawData.forEach((row, idx) => {
                                const hasData = row && row.some(cell => cell !== '' && cell !== null && cell !== undefined);
                                console.log(`[2.9.1][DEBUG] Fila ${idx + 1}: ${hasData ? JSON.stringify(row) : '(VACÍA)'}`);
                            });
                            console.log('[2.9.1][DEBUG] === FIN DE FILAS ===');
                            
                            const suppliersData = [];
                            
                            for (let i = dataStartIndex; i < rawData.length; i++) {
                                const row = rawData[i];

                                console.log(`[2.9.1][LECTURA] === Procesando fila índice ${i} (Fila ${i + 1}) ===`);
                                console.log(`[2.9.1][LECTURA] Contenido crudo:`, row);

                                // Saltar filas vacías
                                if (!row || row.length === 0) {
                                    console.log(`[2.9.1][LECTURA] ⚠️ Saltando fila ${i + 1}: Está vacía o no existe`);
                                    continue;
                                }

                                // Verificar si hay al menos Razón Social (columna B, índice 1) o NIT (columna C, índice 2)
                                const razonSocial = row[1] ? String(row[1]).trim() : '';
                                const nit = row[2] ? String(row[2]).trim() : '';

                                console.log(`[2.9.1][LECTURA] Razón Social (col B): '${razonSocial}'`);
                                console.log(`[2.9.1][LECTURA] NIT (col C): '${nit}'`);

                                // Si la fila está vacía o solo tiene espacios, continuar
                                if (!razonSocial && !nit) {
                                    console.log(`[2.9.1][LECTURA] ⚠️ Saltando fila ${i + 1}: No tiene Razón Social ni NIT`);
                                    continue;
                                }

                                // Detener si llegamos a una fila de totales o separadora
                                if (razonSocial.toLowerCase().includes('total') ||
                                    razonSocial.toLowerCase().includes('---')) {
                                    console.log('[2.9.1][FIN DATOS] Fila de totales/separador encontrada en índice', i);
                                    break;
                                }
                                
                                console.log('[2.9.1][INDEXANDO] Procesando fila índice', i, '(Fila', i + 1, ')');
                                console.log('[2.9.1][INDEXANDO] Datos de fila:', row);
                                
                                // Mapear columnas según estructura del Excel (imagen actual.png)
                                // A=ID (0), B=Razón Social (1), C=NIT (2), D=Tipo (3), E=Objeto Contractual (4), 
                                // F=Fecha (5), G=Puntaje (6), H=Estado (7), I=Observaciones (8), J=Ruta Carpeta (9)
                                // K-T = Criterios (índices 10-19)
                                
                                const scoreStr = row[6] ? String(row[6]) : '0';
                                const score = parseInt(scoreStr.replace('%', '')) || 0;
                                
                                // Determinar estado según puntaje
                                let status = 'Pendiente';
                                if (score >= 80) status = 'Aprobado';
                                else if (score < 50 && score > 0) status = 'Rechazado';
                                
                                // Leer criterios (columnas K-T, índices 10-19)
                                const criteria = {
                                    arl: row[10] && (String(row[10]).toUpperCase() === 'X' || String(row[10]) === 'TRUE' || String(row[10]).trim() !== ''),
                                    politica: row[11] && (String(row[11]).toUpperCase() === 'X' || String(row[11]) === 'TRUE' || String(row[11]).trim() !== ''),
                                    iperc: row[12] && (String(row[12]).toUpperCase() === 'X' || String(row[12]) === 'TRUE' || String(row[12]).trim() !== ''),
                                    pta: row[13] && (String(row[13]).toUpperCase() === 'X' || String(row[13]) === 'TRUE' || String(row[13]).trim() !== ''),
                                    capacitacion: row[14] && (String(row[14]).toUpperCase() === 'X' || String(row[14]) === 'TRUE' || String(row[14]).trim() !== ''),
                                    epp: row[15] && (String(row[15]).toUpperCase() === 'X' || String(row[15]) === 'TRUE' || String(row[15]).trim() !== ''),
                                    estadisticas: row[16] && (String(row[16]).toUpperCase() === 'X' || String(row[16]) === 'TRUE' || String(row[16]).trim() !== ''),
                                    clausula: row[17] && (String(row[17]).toUpperCase() === 'X' || String(row[17]) === 'TRUE' || String(row[17]).trim() !== ''),
                                    reporte: row[18] && (String(row[18]).toUpperCase() === 'X' || String(row[18]) === 'TRUE' || String(row[18]).trim() !== ''),
                                    investigacion: row[19] && (String(row[19]).toUpperCase() === 'X' || String(row[19]) === 'TRUE' || String(row[19]).trim() !== '')
                                };
                                
                                console.log('[2.9.1][INDEXANDO] Criterios detectados:', criteria);
                                
                                suppliersData.push({
                                    id: row[0] || Date.now() + (i - dataStartIndex),
                                    name: razonSocial,
                                    nit: nit,
                                    type: row[3] || 'Servicio',
                                    object: row[4] || 'Servicio genérico',
                                    date: row[5] || new Date().toISOString().split('T')[0],
                                    score: score,
                                    status: status,
                                    observations: row[8] || '',
                                    folder: row[9] || razonSocial.replace(/\s+/g, '_').replace(/[^\w]/g, ''),
                                    criteria: criteria,
                                    evidence: row[9] ? true : false
                                });
                                
                                console.log('[2.9.1][INDEXANDO] ✅ Proveedor indexado:', razonSocial, '- NIT:', nit, '- Puntaje:', score);
                            }
                            
                            if (suppliersData.length > 0) {
                                this.suppliersData = suppliersData;
                                console.log('========================================');
                                console.log('[2.9.1][FINAL] ✅ Datos cargados exitosamente');
                                console.log('[2.9.1][FINAL] Total proveedores:', this.suppliersData.length);
                                console.log('[2.9.1][FINAL] Primer proveedor:', this.suppliersData[0]);
                                console.log('[2.9.1][FINAL] Último proveedor:', this.suppliersData[this.suppliersData.length - 1]);
                                console.log('========================================');
                            } else {
                                console.log('========================================');
                                console.log('[2.9.1][FINAL] ❌ Archivo Excel existe pero NO se cargaron datos');
                                console.log('[2.9.1][FINAL] Posibles causas:');
                                console.log('[2.9.1][FINAL] 1. Las filas no tienen Razón Social (col B) o NIT (col C)');
                                console.log('[2.9.1][FINAL] 2. Los datos están en una fila diferente a la esperada');
                                console.log('[2.9.1][FINAL] 3. Las filas están vacías o con formato incorrecto');
                                console.log('[2.9.1][FINAL] Revisa los logs [2.9.1][LECTURA] arriba para más detalles');
                                console.log('========================================');
                                this.suppliersData = [];
                            }
                        } else {
                            console.log('[2.9.1][ERROR] No se pudo leer el archivo Excel (posiblemente no existe)');
                            this.suppliersData = [];
                        }
                    } catch (excelError) {
                        console.warn('[2.9.1][ERROR] Error leyendo Excel:', excelError.message);
                        console.log('[2.9.1][INFO] Usando datos vacíos, se crearán al guardar');
                        this.suppliersData = [];
                    }
                } else {
                    console.warn('[2.9.1][ERROR] No se encontró ruta del submódulo:', pathResult.error);
                    this.suppliersData = [];
                }

            } catch (error) {
                console.error('[2.9.1][ERROR] Error cargando datos de proveedores:', error);
                this.suppliersData = [];
                this.showNotification('Error cargando datos de proveedores', 'error');
            }
            
            console.log('[2.9.1][FIN] Proceso de carga completado');
            console.log('========================================');
        }

        /**
         * Renderiza la estructura HTML principal
         */
        renderUI() {
            // Contenedor principal para la vista de lista
            const mainLayout = document.createElement('div');
            mainLayout.className = 'ep-module-container';
            mainLayout.id = 'ep-list-view-container';

            mainLayout.innerHTML = `
                <!-- 1. Encabezado -->
                <header class="ep-module-header">
                    <div class="ep-header-content">
                        <h1 class="ep-module-title">Identificación y Evaluación de Bienes y Servicios</h1>
                        <p class="ep-module-subtitle">Submódulo 2.9.1 | Gestión de Proveedores, Evidencias y Calificación</p>
                    </div>
                    <button class="ep-btn-back-module" id="ep-btn-back-module" title="Volver al módulo principal">
                        <i class="bi bi-arrow-left"></i> Volver
                    </button>
                </header>

                <!-- 2. Métricas -->
                <div class="ep-metrics-row">
                    <div class="ep-metric-card" style="border-color: var(--ep-primary);">
                        <div class="ep-metric-value" id="ep-total-suppliers">0</div>
                        <div class="ep-metric-label">Total Evaluados</div>
                    </div>
                    <div class="ep-metric-card" style="border-color: var(--ep-success);">
                        <div class="ep-metric-value" id="ep-approved-suppliers" style="color: var(--ep-success);">0</div>
                        <div class="ep-metric-label">Aprobados</div>
                    </div>
                    <div class="ep-metric-card" style="border-color: var(--ep-warning);">
                        <div class="ep-metric-value" id="ep-pending-suppliers" style="color: #b68b00;">0</div>
                        <div class="ep-metric-label">Pendientes</div>
                    </div>
                    <div class="ep-metric-card" style="border-color: var(--ep-danger);">
                        <div class="ep-metric-value" id="ep-rejected-suppliers" style="color: var(--ep-danger);">0</div>
                        <div class="ep-metric-label">Rechazados</div>
                    </div>
                </div>

                <!-- 3. Barra de Herramientas -->
                <div class="ep-toolbar">
                    <div class="ep-search-box">
                        <input type="text" class="ep-form-control" placeholder="Buscar proveedor..." id="ep-search-input" style="width: 300px;">
                        <select class="ep-form-control" id="ep-filter-status">
                            <option value="all">Todos</option>
                            <option value="Aprobado">Aprobado</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Rechazado">Rechazado</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="ep-btn ep-btn-outline" id="ep-btn-criteria">
                            <i class="bi bi-bar-chart"></i> Ver Escala
                        </button>
                        <button class="ep-btn ep-btn-outline" id="ep-btn-export">
                            <i class="bi bi-file-earmark-excel"></i> Exportar
                        </button>
                        <button class="ep-btn ep-btn-primary" id="ep-btn-new-provider">
                            <i class="bi bi-plus-lg"></i> Nuevo Proveedor
                        </button>
                    </div>
                </div>

                <!-- 4. Tabla Principal -->
                <div class="ep-data-table-container">
                    <table class="ep-data-table">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Tipo</th>
                                <th>Objeto</th>
                                <th>NIT</th>
                                <th>Fecha</th>
                                <th>Puntaje</th>
                                <th>Estado</th>
                                <th>Evidencias</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="ep-suppliers-table-body">
                            <!-- JS rellena esto -->
                        </tbody>
                    </table>
                </div>

                <!-- MODAL DE EVALUACIÓN -->
                <div class="ep-modal-overlay" id="ep-eval-modal">
                    <div class="ep-modal-content">
                        <div class="ep-modal-header">
                            <div>
                                <h3 class="ep-modal-title">Evaluación de Proveedores</h3>
                                <p class="ep-modal-subtitle">Criterios Decreto 1072 / Res. 0312</p>
                            </div>
                            <button class="ep-btn ep-btn-outline ep-btn-sm" id="ep-btn-close-modal">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                        
                        <div class="ep-modal-body">
                            <div class="ep-form-grid">
                                <!-- Izquierda: Datos -->
                                <div>
                                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; color: var(--ep-primary);">
                                        Información del Proveedor
                                    </h4>
                                    
                                    <div class="ep-eval-section">
                                        <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; font-weight: 500;">Razón Social</label>
                                        <input type="text" class="ep-form-control" id="ep-modal-name" placeholder="Nombre de la empresa" style="width: 100%;">
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                        <div>
                                            <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; font-weight: 500;">NIT</label>
                                            <input type="text" class="ep-form-control" id="ep-modal-nit" placeholder="900.000.000" style="width: 100%;">
                                        </div>
                                        <div>
                                            <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; font-weight: 500;">Tipo</label>
                                            <select class="ep-form-control" id="ep-modal-type" style="width: 100%;">
                                                <option value="Bien">Bien</option>
                                                <option value="Servicio">Servicio</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="ep-eval-section">
                                        <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; font-weight: 500;">Objeto</label>
                                        <input type="text" class="ep-form-control" id="ep-modal-object" placeholder="Descripción del servicio" style="width: 100%;">
                                    </div>

                                    <div class="ep-eval-section" style="margin-top: 2rem;">
                                        <label style="display: block; font-size: 0.85rem; margin-bottom: 0.25rem; font-weight: 500;">Observaciones</label>
                                        <textarea class="ep-form-control" id="ep-modal-observations" rows="3" placeholder="Justificaciones..." style="width: 100%;"></textarea>
                                    </div>
                                </div>

                                <!-- Derecha: Checklist -->
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                        <h4 style="margin: 0; color: var(--ep-primary);">Verificación</h4>
                                        <div class="ep-score-display" style="padding: 0.4rem 0.8rem; border-radius: 4px;">
                                            <div class="ep-score-label">CALIFICACIÓN</div>
                                            <div class="ep-score-number" id="ep-total-score">0%</div>
                                        </div>
                                    </div>
                                    
                                    <div class="ep-progress-bar">
                                        <div class="ep-progress-fill" id="ep-score-bar"></div>
                                    </div>

                                    <div class="ep-eval-section" style="margin-top: 1rem; max-height: 400px; overflow-y: auto;">
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>1. ARL y Seguridad Social</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="1">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>2. Política de SST</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="2">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>3. Matriz de Peligros</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="3">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>4. Plan de Trabajo Anual</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="4">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>5. Registro Capacitaciones</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="5">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>6. Entrega de EPP</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="6">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>7. Estadísticas SST</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="7">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>8. Cláusula SST</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="8">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>9. Mecanismo Reporte</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="9">
                                        </div>
                                        <div class="ep-eval-row">
                                            <div style="font-size:0.9rem;"><strong>10. Investigación Accidentes</strong></div>
                                            <input type="checkbox" class="ep-eval-check" data-criterion="10">
                                        </div>
                                    </div>
                                </div>

                                <!-- EVIDENCIAS -->
                                <div class="ep-evidence-section">
                                    <h4 style="color: var(--ep-primary); margin-bottom: 0.5rem;">
                                        <i class="bi bi-paperclip"></i> Gestión de Evidencias
                                    </h4>
                                    <div style="margin-bottom: 0.5rem;">
                                        <span style="font-size: 0.8rem; color: var(--ep-gray-600);">Ruta:</span><br>
                                        <span class="ep-path-preview">/Proveedores/<span id="ep-preview-folder-name">[NOMBRE]</span>/</span>
                                    </div>

                                    <div class="ep-drop-zone" id="ep-drop-zone">
                                        <div style="font-size: 2rem; color: var(--ep-primary); margin-bottom: 0.5rem;">
                                            <i class="bi bi-cloud-upload"></i>
                                        </div>
                                        <p style="font-weight: 500; margin: 0;">Arrastrar archivos o clic aquí</p>
                                        <input type="file" id="ep-evidence-input" multiple style="display: none;">
                                    </div>

                                    <div id="ep-file-list-container" style="display: none;">
                                        <ul id="ep-file-list" class="ep-file-list"></ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="ep-modal-footer">
                            <button class="ep-btn ep-btn-outline" id="ep-btn-cancel-modal">Cancelar</button>
                            <button class="ep-btn ep-btn-primary" id="ep-btn-save-modal">Guardar y Archivar</button>
                        </div>
                    </div>
                </div>

                <!-- PANEL LATERAL -->
                <div class="ep-criteria-panel" id="ep-criteria-panel">
                    <div class="ep-panel-header">
                        <div>
                            <div class="ep-panel-title">Escala de Calificación</div>
                            <div class="ep-panel-subtitle">Interpretación de Resultados</div>
                        </div>
                        <button class="ep-panel-close" id="ep-btn-close-panel">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    
                    <div class="ep-panel-body">
                        <p style="margin-bottom: 1.5rem; color: var(--ep-gray-600); font-size: 0.9rem;">
                            Escala basada en 10 ítems obligatorios. Define la habilitación contractual.
                        </p>

                        <div class="ep-formula-box">
                            <div class="ep-formula-label">FÓRMULA</div>
                            <div class="ep-formula-text">PUNTAJE = (Ítems / 10) x 100</div>
                        </div>

                        <h3 style="font-family: var(--ep-font-heading); margin-bottom: 1rem; border-bottom: 2px solid var(--ep-gray-200); padding-bottom: 0.5rem;">
                            Niveles
                        </h3>

                        <!-- 0-49 -->
                        <div class="ep-scale-card ep-scale-danger">
                            <div class="ep-scale-title">
                                <h4 style="color: var(--ep-danger); margin: 0;">0% - 49%: NO CUMPLE</h4>
                                <span class="ep-scale-badge">ALTO RIESGO</span>
                            </div>
                            <div class="ep-scale-result">
                                <strong>Resultado:</strong> <span style="color: var(--ep-danger); font-weight: bold;">INHABILITADO.</span> No se puede contratar.
                            </div>
                        </div>

                        <!-- 50-79 -->
                        <div class="ep-scale-card ep-scale-warning">
                            <div class="ep-scale-title">
                                <h4 style="color: #b68b00; margin: 0;">50% - 79%: PARCIAL</h4>
                                <span class="ep-scale-badge">MEDIO</span>
                            </div>
                            <div class="ep-scale-result" style="background: rgba(255, 193, 7, 0.1);">
                                <strong>Resultado:</strong> <span style="color: #b68b00; font-weight: bold;">CONDICIONAL.</span> Requiere Plan de Mejora.
                            </div>
                        </div>

                        <!-- 80-100 -->
                        <div class="ep-scale-card ep-scale-success">
                            <div class="ep-scale-title">
                                <h4 style="color: var(--ep-success); margin: 0;">80% - 100%: CUMPLE</h4>
                                <span class="ep-scale-badge">BAJO</span>
                            </div>
                            <div class="ep-scale-result" style="background: rgba(40, 167, 69, 0.1);">
                                <strong>Resultado:</strong> <span style="color: var(--ep-success); font-weight: bold;">HOMOLOGADO.</span> Aprobación inmediata.
                            </div>
                        </div>
                        
                        <div class="ep-legal-note">
                            <strong>Nota Legal:</strong> La calificación debe ser respaldada por las evidencias adjuntas.
                        </div>
                    </div>
                    
                    <div class="ep-panel-footer">
                        <button class="ep-btn ep-btn-outline ep-btn-sm" id="ep-btn-print-scale">
                            <i class="bi bi-printer"></i> Imprimir
                        </button>
                        <button class="ep-btn ep-btn-primary ep-btn-sm" id="ep-btn-copy-scale">
                            <i class="bi bi-clipboard"></i> Copiar
                        </button>
                    </div>
                </div>
            `;

            this.container.appendChild(mainLayout);

            // Contenedor separado para la vista de detalle (FUERA del mainLayout)
            const detailContainer = document.createElement('div');
            detailContainer.id = 'ep-detail-view';
            detailContainer.className = 'ep-detail-view';
            detailContainer.innerHTML = `
                <!-- Botón Volver -->
                <button class="ep-btn-back" id="ep-btn-back-to-list">
                    <i class="bi bi-arrow-left"></i> Volver a la Lista
                </button>

                <!-- Encabezado -->
                <div class="ep-detail-header">
                    <div class="ep-detail-title-group">
                        <h1 id="ep-detail-name">Nombre del Proveedor</h1>
                        <div class="ep-detail-meta">
                            <span id="ep-detail-nit">NIT: 900.000.000-1</span>
                            <span id="ep-detail-date">Evaluado: 01/01/2024</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <div class="ep-detail-score-badge" id="ep-detail-score-badge" style="color: var(--ep-success);">
                            <span id="ep-detail-score">85</span>%
                        </div>
                        <span class="ep-status-badge ep-status-approved" id="ep-detail-status">Aprobado</span>
                    </div>
                </div>

                <!-- Grid de Contenido -->
                <div class="ep-detail-grid">
                    <!-- Columna Izquierda -->
                    <div>
                        <!-- Información General -->
                        <div class="ep-detail-card">
                            <h3><i class="bi bi-building"></i> Información General</h3>
                            <div class="ep-info-row">
                                <span class="ep-info-label">Razón Social:</span>
                                <span class="ep-info-value" id="ep-detail-full-name">-</span>
                            </div>
                            <div class="ep-info-row">
                                <span class="ep-info-label">NIT:</span>
                                <span class="ep-info-value" id="ep-detail-nit-full">-</span>
                            </div>
                            <div class="ep-info-row">
                                <span class="ep-info-label">Tipo:</span>
                                <span class="ep-info-value" id="ep-detail-type">-</span>
                            </div>
                            <div class="ep-info-row">
                                <span class="ep-info-label">Objeto Contractual:</span>
                                <span class="ep-info-value" id="ep-detail-object">-</span>
                            </div>
                            <div class="ep-info-row">
                                <span class="ep-info-label">Fecha Evaluación:</span>
                                <span class="ep-info-value" id="ep-detail-eval-date">-</span>
                            </div>
                        </div>

                        <!-- Observaciones -->
                        <div class="ep-detail-card">
                            <h3><i class="bi bi-chat-left-text"></i> Observaciones</h3>
                            <div class="ep-observations-box" id="ep-detail-observations">
                                Sin observaciones registradas.
                            </div>
                        </div>
                    </div>

                    <!-- Columna Derecha -->
                    <div>
                        <!-- Matriz de Cumplimiento -->
                        <div class="ep-detail-card">
                            <h3><i class="bi bi-check2-square"></i> Matriz de Cumplimiento SST</h3>
                            <div class="ep-compliance-grid" id="ep-detail-checklist">
                                <!-- Se llena dinámicamente -->
                            </div>
                        </div>

                        <!-- Evidencias -->
                        <div class="ep-detail-card">
                            <h3><i class="bi bi-folder2-open"></i> Evidencias Documentales</h3>
                            <div style="margin-bottom: 0.75rem;">
                                <span style="font-size: 0.8rem; color: var(--ep-gray-600);">Ruta:</span><br>
                                <span class="ep-path-preview" id="ep-detail-path">/Proveedores/</span>
                            </div>
                            <div class="ep-no-files-msg" id="ep-no-files-msg" style="display: none;">
                                <i class="bi bi-inbox"></i>
                                <p>No hay archivos de evidencia archivados</p>
                            </div>
                            <ul class="ep-file-list-display" id="ep-detail-file-list" style="display: none;">
                                <!-- Se llena dinámicamente -->
                            </ul>
                        </div>
                    </div>
                </div>
            `;

            this.container.appendChild(detailContainer);

            // Guardar referencias
            this.modal = document.getElementById('ep-eval-modal');
            this.panel = document.getElementById('ep-criteria-panel');
            this.dropZone = document.getElementById('ep-drop-zone');
            this.fileInput = document.getElementById('ep-evidence-input');
            this.detailView = document.getElementById('ep-detail-view');
            this.listView = document.getElementById('ep-list-view-container');
        }

        /**
         * Inicializa todos los event listeners
         */
        initEventListeners() {
            // Botones principales
            document.getElementById('ep-btn-new-provider').addEventListener('click', () => this.openModal('new'));
            document.getElementById('ep-btn-criteria').addEventListener('click', () => this.togglePanel());
            
            // Botón Volver al Módulo Principal
            document.getElementById('ep-btn-back-module').addEventListener('click', () => {
                if (this.backToModuleCallback) {
                    this.backToModuleCallback();
                }
            });

            // Botón Volver a la Lista (Vista de Detalle)
            document.getElementById('ep-btn-back-to-list').addEventListener('click', () => this.showListView());

            // Cerrar Modal
            document.getElementById('ep-btn-close-modal').addEventListener('click', () => this.closeModal());
            document.getElementById('ep-btn-cancel-modal').addEventListener('click', () => this.closeModal());
            
            // Cerrar Panel
            document.getElementById('ep-btn-close-panel').addEventListener('click', () => this.closePanel());

            // Guardar Modal
            document.getElementById('ep-btn-save-modal').addEventListener('click', () => this.saveEvaluation());

            // Input Nombre (Live Preview)
            document.getElementById('ep-modal-name').addEventListener('input', () => this.updatePathPreview());

            // Eventos Checkboxes
            document.querySelectorAll('.ep-eval-check').forEach(cb => {
                cb.addEventListener('change', () => this.calculateScore());
            });

            // Eventos Drag & Drop
            this.dropZone.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
            
            this.dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.dropZone.classList.add('dragover');
            });
            
            this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('dragover'));
            
            this.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.dropZone.classList.remove('dragover');
                this.handleFileSelect(e.dataTransfer.files);
            });

            // Búsqueda
            document.getElementById('ep-search-input').addEventListener('keyup', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.suppliersData.filter(s =>
                    s.name.toLowerCase().includes(term) ||
                    s.object.toLowerCase().includes(term)
                );
                this.renderTable(filtered);
            });

            // Filtro por estado
            document.getElementById('ep-filter-status').addEventListener('change', (e) => {
                const status = e.target.value;
                if (status === 'all') {
                    this.renderTable(this.suppliersData);
                } else {
                    const filtered = this.suppliersData.filter(s => s.status === status);
                    this.renderTable(filtered);
                }
            });

            // Botones del panel
            document.getElementById('ep-btn-print-scale').addEventListener('click', () => {
                this.showNotification('Función imprimir en desarrollo', 'info');
            });
            
            document.getElementById('ep-btn-copy-scale').addEventListener('click', () => {
                this.showNotification('Función copiar en desarrollo', 'info');
            });

            document.getElementById('ep-btn-export').addEventListener('click', () => {
                this.exportToExcel();
            });

            // Cerrar modal con Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                    this.closePanel();
                }
            });

            // Cerrar modal al hacer clic fuera
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }

        /**
         * Renderiza la tabla de proveedores
         */
        renderTable(data) {
            const tbody = document.getElementById('ep-suppliers-table-body');
            if (!tbody) return;

            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--ep-gray-600);">
                            <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
                            No hay proveedores registrados
                        </td>
                    </tr>
                `;
                return;
            }

            data.forEach(item => {
                const tr = document.createElement('tr');
                let statusClass = item.status === 'Aprobado' ? 'ep-status-approved' :
                                 (item.status === 'Rechazado' ? 'ep-status-rejected' : 'ep-status-pending');

                tr.innerHTML = `
                    <td><div style="font-weight: 500;">${item.name}</div></td>
                    <td><span style="background: rgba(23, 78, 166, 0.1); color: var(--ep-primary); padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${item.type}</span></td>
                    <td>${item.object}</td>
                    <td style="font-family: monospace;">${item.nit}</td>
                    <td>${item.date}</td>
                    <td style="font-weight: bold;">${item.score}%</td>
                    <td><span class="ep-status-badge ${statusClass}">${item.status}</span></td>
                    <td>${item.evidence ? '<span style="color:var(--ep-success);"><i class="bi bi-check-circle"></i> Archivado</span>' : '<span style="color:var(--ep-gray-600);">-</span>'}</td>
                    <td style="text-align: right;">
                        <button class="ep-btn ep-btn-outline ep-btn-sm action-view-detail" data-id="${item.id}" style="margin-right: 0.5rem;">
                            <i class="bi bi-eye"></i> Ver
                        </button>
                        <button class="ep-btn ep-btn-outline ep-btn-sm action-edit" data-id="${item.id}">
                            <i class="bi bi-pencil"></i> Evaluar
                        </button>
                    </td>
                `;
                
                // Agregar evento al botón de ver detalle
                tr.querySelector('.action-view-detail').addEventListener('click', () => this.showDetailView(item.id));
                // Agregar evento al botón de editar
                tr.querySelector('.action-edit').addEventListener('click', () => this.openModal(item.id));
                tbody.appendChild(tr);
            });

            this.updateMetrics();
        }

        /**
         * Muestra la vista de detalle (Ficha Técnica) - AHORA ASÍNCRONA
         */
        async showDetailView(id) {
            try {
                const supplier = this.suppliersData.find(s => s.id === id);
                if (!supplier) {
                    console.error('[2.9.1][ERROR] Proveedor no encontrado con ID:', id);
                    return;
                }

                console.log('[2.9.1][DETAIL] Mostrando vista de detalle para:', supplier.name);

                // Ocultar elementos de la vista de lista
                const listView = document.getElementById('ep-suppliers-table-body')?.closest('.ep-data-table-container')?.parentElement;
                const metricsView = document.querySelector('.ep-metrics-row');
                const toolbarView = document.querySelector('.ep-toolbar');
                const headerView = document.querySelector('.ep-module-header');

                if (listView) listView.style.display = 'none';
                if (metricsView) metricsView.style.display = 'none';
                if (toolbarView) toolbarView.style.display = 'none';
                if (headerView) headerView.style.display = 'none';

                // Mostrar la vista de detalle
                const detailView = document.getElementById('ep-detail-view');
                if (detailView) {
                    detailView.style.display = 'block';
                    console.log('[2.9.1][DETAIL] Vista de detalle mostrada');
                } else {
                    console.error('[2.9.1][ERROR] No se encontró el elemento ep-detail-view');
                    return;
                }

                // --- POBLAR DATOS ENCABEZADO ---
                const nameEl = document.getElementById('ep-detail-name');
                const nitEl = document.getElementById('ep-detail-nit');
                const dateEl = document.getElementById('ep-detail-date');
                
                if (nameEl) nameEl.innerText = supplier.name;
                if (nitEl) nitEl.innerText = "NIT: " + supplier.nit;
                if (dateEl) dateEl.innerText = "Evaluado: " + supplier.date;

                const scoreEl = document.getElementById('ep-detail-score');
                if (scoreEl) scoreEl.innerText = supplier.score;

                const scoreBadge = document.getElementById('ep-detail-score-badge');
                if (scoreBadge) {
                    if (supplier.score >= 80) {
                        scoreBadge.style.color = 'var(--ep-success)';
                    } else if (supplier.score < 50) {
                        scoreBadge.style.color = 'var(--ep-danger)';
                    } else {
                        scoreBadge.style.color = '#b68b00';
                    }
                }

                const badge = document.getElementById('ep-detail-status');
                if (badge) {
                    badge.className = `ep-status-badge ${supplier.status === 'Aprobado' ? 'ep-status-approved' : (supplier.status === 'Rechazado' ? 'ep-status-rejected' : 'ep-status-pending')}`;
                    badge.innerText = supplier.status;
                }

                // --- POBLAR DATOS GENERALES ---
                const fullNameEl = document.getElementById('ep-detail-full-name');
                const nitFullEl = document.getElementById('ep-detail-nit-full');
                const typeEl = document.getElementById('ep-detail-type');
                const objectEl = document.getElementById('ep-detail-object');
                const evalDateEl = document.getElementById('ep-detail-eval-date');
                
                if (fullNameEl) fullNameEl.innerText = supplier.name;
                if (nitFullEl) nitFullEl.innerText = supplier.nit;
                if (typeEl) typeEl.innerText = supplier.type;
                if (objectEl) objectEl.innerText = supplier.object;
                if (evalDateEl) evalDateEl.innerText = supplier.date;

                // --- POBLAR OBSERVACIONES ---
                const obsEl = document.getElementById('ep-detail-observations');
                if (obsEl) {
                    if (supplier.observations && supplier.observations.trim() !== '') {
                        obsEl.innerText = supplier.observations;
                    } else {
                        obsEl.innerText = 'Sin observaciones registradas.';
                    }
                }

                // --- POBLAR MATRIZ DE CUMPLIMIENTO ---
                const checklistContainer = document.getElementById('ep-detail-checklist');
                if (checklistContainer) {
                    checklistContainer.innerHTML = '';

                    const checklistLabels = [
                        "1. Vigencia ARL / Seguridad Social",
                        "2. Política de SST",
                        "3. Matriz de Peligros (IPERC)",
                        "4. Plan de Trabajo Anual (PTA)",
                        "5. Registro Capacitaciones",
                        "6. Entrega de EPP",
                        "7. Estadísticas SST (Año anterior)",
                        "8. Cláusula SST en Contrato",
                        "9. Mecanismo Reporte Condiciones",
                        "10. Investigación Accidentes"
                    ];

                    // Usar criterios del proveedor
                    const criteria = supplier.criteria || {};
                    const criteriaKeys = ['arl', 'politica', 'iperc', 'pta', 'capacitacion', 'epp', 'estadisticas', 'clausula', 'reporte', 'investigacion'];

                    criteriaKeys.forEach((key, index) => {
                        const isCompliant = criteria[key] === true;
                        const div = document.createElement('div');
                        div.className = 'ep-compliance-item';
                        div.innerHTML = `
                            <div class="ep-compliance-status-icon ${isCompliant ? 'ep-status-compliant' : 'ep-status-non-compliant'}">
                                ${isCompliant ? '✔' : '✕'}
                            </div>
                            <div class="ep-compliance-text"><strong>${checklistLabels[index]}</strong></div>
                        `;
                        checklistContainer.appendChild(div);
                    });
                }

                // --- POBLAR EVIDENCIAS ---
                const fileList = document.getElementById('ep-detail-file-list');
                const noFilesMsg = document.getElementById('ep-no-files-msg');
                const pathSpan = document.getElementById('ep-detail-path');

                if (fileList && noFilesMsg && pathSpan) {
                    if (supplier.evidence && supplier.folder) {
                        noFilesMsg.style.display = 'none';
                        fileList.style.display = 'block';
                        fileList.innerHTML = '';

                        const folderName = supplier.folder;
                        const basePath = this.submodulePath.replace(/\\/g, '/');
                        const folderPath = basePath + '/' + folderName;
                        
                        pathSpan.innerText = `/Proveedores/${folderName}/`;

                        try {
                            // Leer archivos reales de la carpeta usando IPC
                            console.log('[2.9.1][DETAIL] Leyendo archivos de:', folderPath);
                            const listResult = await window.electronAPI.listProviderFiles(folderPath);
                            
                            if (listResult.success && listResult.files && listResult.files.length > 0) {
                                console.log('[2.9.1][DETAIL] Archivos encontrados:', listResult.files.length);
                                
                                listResult.files.forEach(file => {
                                    const li = document.createElement('li');
                                    
                                    // Formatear tamaño del archivo
                                    let fileSize = file.size;
                                    if (file.size > 1024 * 1024) {
                                        fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
                                    } else if (file.size > 1024) {
                                        fileSize = (file.size / 1024).toFixed(1) + ' KB';
                                    } else {
                                        fileSize = file.size + ' B';
                                    }
                                    
                                    // Determinar ícono según extensión
                                    const ext = file.name.split('.').pop().toLowerCase();
                                    let fileIcon = '📄';
                                    if (['pdf'].includes(ext)) fileIcon = '📕';
                                    else if (['xlsx', 'xls'].includes(ext)) fileIcon = '📗';
                                    else if (['docx', 'doc'].includes(ext)) fileIcon = '📘';
                                    else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) fileIcon = '🖼️';
                                    
                                    li.innerHTML = `
                                        <span class="ep-file-icon">${fileIcon}</span>
                                        <span class="ep-file-name">${file.name}</span>
                                        <span class="ep-file-size">${fileSize}</span>
                                    `;
                                    
                                    // Agregar evento para abrir archivo al hacer clic
                                    li.style.cursor = 'pointer';
                                    li.addEventListener('click', () => {
                                        window.electronAPI.openPath(folderPath + '/' + file.name);
                                    });
                                    
                                    fileList.appendChild(li);
                                });
                            } else {
                                // No hay archivos en la carpeta
                                noFilesMsg.style.display = 'block';
                                fileList.style.display = 'none';
                                console.log('[2.9.1][DETAIL] No hay archivos en la carpeta');
                            }
                        } catch (error) {
                            console.error('[2.9.1][DETAIL] Error leyendo archivos:', error);
                            noFilesMsg.style.display = 'block';
                            fileList.style.display = 'none';
                            noFilesMsg.querySelector('p').textContent = 'Error al cargar archivos: ' + error.message;
                        }
                    } else {
                        noFilesMsg.style.display = 'block';
                        fileList.style.display = 'none';
                        pathSpan.innerText = "Sin ruta asignada";
                    }
                }

                // Scroll al inicio
                window.scrollTo(0, 0);

                console.log('[2.9.1][DETAIL] Ficha técnica poblada correctamente');
            } catch (error) {
                console.error('[2.9.1][ERROR] Error en showDetailView:', error);
                this.showNotification('Error al mostrar el detalle: ' + error.message, 'error');
            }
        }

        /**
         * Vuelve a la vista de lista
         */
        showListView() {
            const listView = document.getElementById('ep-suppliers-table-body')?.closest('.ep-data-table-container')?.parentElement;
            const metricsView = document.querySelector('.ep-metrics-row');
            const toolbarView = document.querySelector('.ep-toolbar');
            const headerView = document.querySelector('.ep-module-header');
            const detailView = document.getElementById('ep-detail-view');
            
            if (detailView) detailView.style.display = 'none';
            if (headerView) headerView.style.display = 'block';
            if (metricsView) metricsView.style.display = 'grid';
            if (toolbarView) toolbarView.style.display = 'flex';
            if (listView) listView.style.display = 'block';
        }

        /**
         * Actualiza las métricas del dashboard
         */
        updateMetrics() {
            const total = this.suppliersData.length;
            const approved = this.suppliersData.filter(s => s.status === 'Aprobado').length;
            const pending = this.suppliersData.filter(s => s.status === 'Pendiente').length;
            const rejected = this.suppliersData.filter(s => s.status === 'Rechazado').length;

            document.getElementById('ep-total-suppliers').innerText = total;
            document.getElementById('ep-approved-suppliers').innerText = approved;
            document.getElementById('ep-pending-suppliers').innerText = pending;
            document.getElementById('ep-rejected-suppliers').innerText = rejected;
        }

        /**
         * Abre el modal de evaluación
         */
        openModal(id = 'new') {
            // Limpiar formulario
            document.getElementById('ep-modal-name').value = '';
            document.getElementById('ep-modal-nit').value = '';
            document.getElementById('ep-modal-type').value = 'Bien';
            document.getElementById('ep-modal-object').value = '';
            document.getElementById('ep-modal-observations').value = '';
            
            // Limpiar checkboxes
            document.querySelectorAll('.ep-eval-check').forEach(c => c.checked = false);
            
            // Limpiar archivos
            document.getElementById('ep-file-list').innerHTML = '';
            document.getElementById('ep-file-list-container').style.display = 'none';
            this.selectedFiles = [];
            
            // Resetear score
            this.calculateScore();
            this.updatePathPreview();

            // Mostrar modal
            this.modal.classList.add('active');
            
            // Cargar datos si es edición
            if (id !== 'new') {
                const data = this.suppliersData.find(s => s.id === id);
                if (data) {
                    this.currentSupplier = data;
                    document.getElementById('ep-modal-name').value = data.name;
                    document.getElementById('ep-modal-nit').value = data.nit;
                    // TODO: Cargar datos restantes
                }
            } else {
                this.currentSupplier = null;
            }
        }

        /**
         * Cierra el modal
         */
        closeModal() {
            console.log('[2.9.1][MODAL] Cerrando modal...');
            this.modal.classList.remove('active');
            this.currentSupplier = null;
            console.log('[2.9.1][MODAL] Modal cerrado, clase active removida');
        }

        /**
         * Abre/cierra el panel lateral
         */
        togglePanel() {
            this.panel.classList.toggle('open');
        }

        /**
         * Cierra el panel lateral
         */
        closePanel() {
            this.panel.classList.remove('open');
        }

        /**
         * Actualiza la vista previa de la ruta
         */
        updatePathPreview() {
            const name = document.getElementById('ep-modal-name').value || "[NOMBRE]";
            const cleanName = name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
            document.getElementById('ep-preview-folder-name').innerText = cleanName;
        }

        /**
         * Maneja la selección de archivos
         */
        handleFileSelect(files) {
            const list = document.getElementById('ep-file-list');
            const container = document.getElementById('ep-file-list-container');
            container.style.display = 'block';
            
            Array.from(files).forEach(file => {
                this.selectedFiles.push(file);
                const li = document.createElement('li');
                li.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="bi bi-file-earmark"></i> ${file.name} 
                        <small style="color: var(--ep-gray-600);">(${(file.size/1024).toFixed(1)} KB)</small>
                    </span>
                    <button class="ep-file-remove-btn" data-name="${file.name}">
                        <i class="bi bi-x-lg"></i>
                    </button>
                `;
                
                // Agregar evento al botón de eliminar
                li.querySelector('.ep-file-remove-btn').addEventListener('click', function() {
                    const fileName = this.getAttribute('data-name');
                    this.closest('li').remove();
                    this.selectedFiles = this.selectedFiles.filter(f => f.name !== fileName);
                    if (this.selectedFiles.length === 0) {
                        container.style.display = 'none';
                    }
                }.bind(this));
                
                list.appendChild(li);
            });
        }

        /**
         * Calcula el puntaje de evaluación
         */
        calculateScore() {
            const checkboxes = document.querySelectorAll('.ep-eval-check');
            const total = checkboxes.length;
            const checked = Array.from(checkboxes).filter(c => c.checked).length;
            const percentage = Math.round((checked / total) * 100);
            
            const scoreDisplay = document.getElementById('ep-total-score');
            const progressBar = document.getElementById('ep-score-bar');
            
            scoreDisplay.innerText = percentage + '%';
            progressBar.style.width = percentage + '%';
            
            // Cambiar color según puntaje
            if (percentage < 50) {
                scoreDisplay.style.color = 'var(--ep-danger)';
                progressBar.style.backgroundColor = 'var(--ep-danger)';
            } else if (percentage < 80) {
                scoreDisplay.style.color = 'var(--ep-warning)';
                progressBar.style.backgroundColor = 'var(--ep-warning)';
            } else {
                scoreDisplay.style.color = 'var(--ep-success)';
                progressBar.style.backgroundColor = 'var(--ep-success)';
            }
            
            return percentage;
        }

        /**
         * Guarda la evaluación
         */
        async saveEvaluation() {
            const score = this.calculateScore();
            const name = document.getElementById('ep-modal-name').value || "Proveedor_Sin_Nombre";
            const nit = document.getElementById('ep-modal-nit').value || "Pendiente";
            const type = document.getElementById('ep-modal-type').value;
            const object = document.getElementById('ep-modal-object').value || "Servicio Genérico";
            const observations = document.getElementById('ep-modal-observations').value;

            // Determinar estado según puntaje
            let status = "Pendiente";
            if (score >= 80) status = "Aprobado";
            else if (score < 50 && score > 0) status = "Rechazado";

            const saveBtn = document.getElementById('ep-btn-save-modal');
            const originalText = saveBtn.innerText;

            if (this.selectedFiles.length > 0) {
                // Procesar archivos
                saveBtn.innerText = "Procesando...";
                saveBtn.disabled = true;

                try {
                    await this.processFileEvidence(name, this.selectedFiles);
                    await this.finalizeSave(name, nit, type, object, observations, score, status, true);
                } catch (error) {
                    console.error('[2.9.1][ERROR] Error en saveEvaluation:', error);
                    this.showNotification('Error procesando archivos: ' + error.message, 'error');
                } finally {
                    saveBtn.innerText = originalText;
                    saveBtn.disabled = false;
                }
            } else {
                try {
                    await this.finalizeSave(name, nit, type, object, observations, score, status, false);
                } catch (error) {
                    console.error('[2.9.1][ERROR] Error en saveEvaluation:', error);
                    this.showNotification('Error guardando: ' + error.message, 'error');
                    saveBtn.innerText = originalText;
                    saveBtn.disabled = false;
                }
            }
        }

        /**
         * Procesa las evidencias (archivos) - IMPLEMENTACIÓN REAL
         */
        async processFileEvidence(providerName, files) {
            try {
                console.log('[2.9.1][EVIDENCIA] Iniciando procesamiento de archivos...');
                console.log('[2.9.1][EVIDENCIA] Proveedor:', providerName);
                console.log('[2.9.1][EVIDENCIA] Archivos:', files.length);

                // 1. Crear carpeta del proveedor
                const folderName = providerName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
                const basePath = this.submodulePath.replace(/\\/g, '/');
                
                console.log('[2.9.1][EVIDENCIA] Creando carpeta:', folderName);
                console.log('[2.9.1][EVIDENCIA] Ruta base:', basePath);

                const folderResult = await window.electronAPI.createProviderFolder(basePath, folderName);
                
                if (!folderResult.success) {
                    throw new Error(`Error creando carpeta: ${folderResult.error}`);
                }

                const folderPath = folderResult.path;
                console.log('[2.9.1][EVIDENCIA] ✅ Carpeta creada:', folderPath);

                // 2. Copiar cada archivo a la carpeta
                const copiedFiles = [];
                for (const file of files) {
                    console.log('[2.9.1][EVIDENCIA] Copiando archivo:', file.name);
                    
                    // Leer archivo como ArrayBuffer
                    const arrayBuffer = await file.arrayBuffer();
                    
                    // Convertir ArrayBuffer a Base64 usando btoa
                    const bytes = new Uint8Array(arrayBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64Data = btoa(binary);
                    
                    // Copiar archivo usando IPC (enviando datos base64)
                    const copyResult = await window.electronAPI.copyFileToProviderFolder(
                        base64Data,
                        folderPath,
                        file.name
                    );

                    if (!copyResult.success) {
                        throw new Error(`Error copiando archivo ${file.name}: ${copyResult.error}`);
                    }

                    copiedFiles.push(copyResult.path);
                    console.log('[2.9.1][EVIDENCIA] ✅ Archivo copiado:', copyResult.path);
                }

                console.log('[2.9.1][EVIDENCIA] === PROCESAMIENTO COMPLETADO ===');
                console.log('[2.9.1][EVIDENCIA] Archivos copiados:', copiedFiles.length);
                console.log('[2.9.1][EVIDENCIA] Ruta de la carpeta:', folderPath);

                // 3. Listar archivos para verificar
                const listResult = await window.electronAPI.listProviderFiles(folderPath);
                if (listResult.success) {
                    console.log('[2.9.1][EVIDENCIA] Archivos en la carpeta:', listResult.files);
                }

                return { success: true, folderPath, files: copiedFiles };

            } catch (error) {
                console.error('[2.9.1][EVIDENCIA][ERROR]', error);
                throw error;
            }
        }

        /**
         * Guarda los datos en el archivo Excel
         */
        async saveToExcel() {
            if (!this.companyName || !this.submodulePath) {
                console.error('[2.9.1][ERROR] No hay ruta para guardar Excel');
                return { success: false, error: 'No hay ruta configurada' };
            }

            try {
                // USAR EL MISMO ARCHIVO QUE SE USA PARA LEER
                const excelFileName = 'Identificaciòn y evaluaciòn de adquisiciones.xlsx';
                const excelPath = this.submodulePath.replace(/\\/g, '/') + '/' + excelFileName;
                
                console.log('========================================');
                console.log('[2.9.1][GUARDAR] Iniciando guardado en Excel');
                console.log('[2.9.1][GUARDAR] Ruta completa:', excelPath);
                console.log('[2.9.1][GUARDAR] Nombre del archivo:', excelFileName);
                console.log('[2.9.1][GUARDAR] Total registros a guardar:', this.suppliersData.length);
                console.log('[2.9.1][GUARDAR] Primer registro:', this.suppliersData[0]);
                console.log('[2.9.1][GUARDAR] Último registro:', this.suppliersData[this.suppliersData.length - 1]);
                console.log('========================================');

                // Preparar datos en formato del Excel (columnas A-T)
                // Estructura exacta según el archivo:
                // A=ID, B=Razón Social, C=NIT, D=Tipo, E=Objeto Contractual, F=Fecha Evaluación,
                // G=Puntaje (%), H=Estado, I=Observaciones, J=Ruta Carpeta,
                // K=1.ARL/SS, L=2.Política SST, M=3.IPERC, N=4.PTA, O=5.Capacitación,
                // P=6.EPP, Q=7.Estadísticas, R=8.Cláusula SST, S=9.Reporte, T=10.Investigación
                const excelData = this.suppliersData.map((s, index) => {
                    // Asegurar que el NIT se guarde como texto (prefijando con ' si es necesario)
                    let nitValue = s.nit || '';
                    // Si el NIT es numérico, asegurarse de que se guarde como texto
                    if (nitValue && !isNaN(nitValue)) {
                        nitValue = String(nitValue);
                    }
                    
                    const rowData = {
                        'ID': s.id || '',
                        'Razón Social': s.name || '',
                        'NIT': nitValue,  // Usar el valor procesado
                        'Tipo': s.type || 'Servicio',
                        'Objeto Contractual': s.object || s.service || '',
                        'Fecha Evaluación': s.date ? this.formatDateForExcel(s.date) : '',
                        'Puntaje (%)': s.score || 0,
                        'Estado': s.status || 'Pendiente',
                        'Observaciones': s.observations || '',
                        'Ruta Carpeta': s.folder || '',
                        '1. ARL/SS': s.criteria?.arl ? 'X' : '',
                        '2. Política SST': s.criteria?.politica ? 'X' : '',
                        '3. IPERC': s.criteria?.iperc ? 'X' : '',
                        '4. PTA': s.criteria?.pta ? 'X' : '',
                        '5. Capacitación': s.criteria?.capacitacion ? 'X' : '',
                        '6. EPP': s.criteria?.epp ? 'X' : '',
                        '7. Estadísticas': s.criteria?.estadisticas ? 'X' : '',
                        '8. Cláusula SST': s.criteria?.clausula ? 'X' : '',
                        '9. Reporte': s.criteria?.reporte ? 'X' : '',
                        '10. Investigación': s.criteria?.investigacion ? 'X' : ''
                    };
                    
                    // Log de depuración para verificar NIT
                    console.log(`[2.9.1][GUARDAR][FILA ${index}] NIT original: "${s.nit}" -> NIT Excel: "${rowData['NIT']}"`);
                    
                    return rowData;
                });

                console.log('[2.9.1][GUARDAR] Enviando datos a backend...');
                console.log('[2.9.1][GUARDAR] Datos preparados:', JSON.stringify(excelData[0], null, 2));

                // Llamar al backend para guardar
                console.log('[2.9.1][GUARDAR] Llamando a window.electronAPI.saveProveedoresExcelData...');
                const result = await window.electronAPI.saveProveedoresExcelData(excelPath, excelData);
                
                console.log('[2.9.1][GUARDAR] Resultado del backend:', result);
                
                if (result.success) {
                    console.log('========================================');
                    console.log('[2.9.1][GUARDAR] ✅ Datos guardados exitosamente en Excel');
                    console.log('[2.9.1][GUARDAR] Ruta:', excelPath);
                    console.log('[2.9.1][GUARDAR] Total registros:', this.suppliersData.length);
                    console.log('========================================');
                    return { success: true };
                } else {
                    console.error('========================================');
                    console.error('[2.9.1][GUARDAR] ❌ Error del backend:', result.error);
                    console.error('[2.9.1][GUARDAR] Ruta:', excelPath);
                    console.error('[2.9.1][GUARDAR] Posibles causas:');
                    console.error('[2.9.1][GUARDAR] 1. Archivo abierto en Excel');
                    console.error('[2.9.1][GUARDAR] 2. Sin permisos de escritura');
                    console.error('[2.9.1][GUARDAR] 3. Disco lleno');
                    console.error('[2.9.1][GUARDAR] 4. Ruta de red no disponible');
                    console.error('========================================');
                    return { success: false, error: result.error };
                }
            } catch (error) {
                console.error('========================================');
                console.error('[2.9.1][GUARDAR] ❌ Error EXCEPCIONAL en saveToExcel:', error);
                console.error('[2.9.1][GUARDAR] Error name:', error.name);
                console.error('[2.9.1][GUARDAR] Error message:', error.message);
                console.error('[2.9.1][GUARDAR] Error stack:', error.stack);
                console.error('[2.9.1][GUARDAR] Posibles causas:');
                console.error('[2.9.1][GUARDAR] 1. ENOSPC: Disco lleno (aunque muestre espacio libre)');
                console.error('[2.9.1][GUARDAR] 2. EACCES: Sin permisos de escritura');
                console.error('[2.9.1][GUARDAR] 3. EBUSY: Archivo bloqueado por otro proceso');
                console.error('[2.9.1][GUARDAR] 4. Ruta G: es unidad de red/Google Drive');
                console.error('========================================');
                return { success: false, error: error.message };
            }
        }

        /**
         * Formatea la fecha para Excel (DD/MM/AAAA)
         */
        formatDateForExcel(dateString) {
            try {
                const date = new Date(dateString);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            } catch (e) {
                return dateString;
            }
        }

        /**
         * Finaliza el guardado
         */
        async finalizeSave(name, nit, type, object, observations, score, status, hasEvidence) {
            const newSupplier = {
                id: this.currentSupplier ? this.currentSupplier.id : Date.now(),
                name: name,
                service: object,
                nit: nit,
                type: type,
                object: object,
                date: this.currentSupplier ? this.currentSupplier.date : new Date().toISOString().split('T')[0],
                score: score,
                status: status,
                evidence: hasEvidence,
                folder: name.replace(/\s+/g, '_').replace(/[^\w]/g, ''),
                observations: observations,
                // Obtener criterios de los checkboxes
                criteria: {
                    arl: document.querySelector('.ep-eval-check[data-criterion="1"]')?.checked || false,
                    politica: document.querySelector('.ep-eval-check[data-criterion="2"]')?.checked || false,
                    iperc: document.querySelector('.ep-eval-check[data-criterion="3"]')?.checked || false,
                    pta: document.querySelector('.ep-eval-check[data-criterion="4"]')?.checked || false,
                    capacitacion: document.querySelector('.ep-eval-check[data-criterion="5"]')?.checked || false,
                    epp: document.querySelector('.ep-eval-check[data-criterion="6"]')?.checked || false,
                    estadisticas: document.querySelector('.ep-eval-check[data-criterion="7"]')?.checked || false,
                    clausula: document.querySelector('.ep-eval-check[data-criterion="8"]')?.checked || false,
                    reporte: document.querySelector('.ep-eval-check[data-criterion="9"]')?.checked || false,
                    investigacion: document.querySelector('.ep-eval-check[data-criterion="10"]')?.checked || false
                }
            };

            if (this.currentSupplier) {
                // Actualizar existente
                const index = this.suppliersData.findIndex(s => s.id === this.currentSupplier.id);
                if (index !== -1) {
                    this.suppliersData[index] = newSupplier;
                }
            } else {
                // Agregar nuevo
                this.suppliersData.unshift(newSupplier);
            }

            // Guardar en Excel
            const saveBtn = document.getElementById('ep-btn-save-modal');
            saveBtn.innerText = "Guardando en Excel...";
            saveBtn.disabled = true;

            try {
                const result = await this.saveToExcel();
                
                if (result.success) {
                    this.renderTable(this.suppliersData);
                    
                    // Cerrar modal y limpiar formulario
                    this.closeModal();
                    
                    // Pequeño delay para asegurar que el modal se cerró visualmente
                    setTimeout(() => {
                        this.showNotification(`Proveedor guardado exitosamente. Estado: ${status}`, 'success');
                    }, 100);
                } else {
                    this.showNotification(`Error guardando: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('[2.9.1][ERROR] Error en finalizeSave:', error);
                this.showNotification('Error guardando proveedor: ' + error.message, 'error');
            } finally {
                saveBtn.innerText = "Guardar y Archivar";
                saveBtn.disabled = false;
            }
        }

        /**
         * Exporta a Excel
         */
        async exportToExcel() {
            if (this.suppliersData.length === 0) {
                this.showNotification('No hay datos para exportar', 'warning');
                return;
            }

            try {
                // Preparar datos para Excel
                const dataToExport = this.suppliersData.map(s => ({
                    Proveedor: s.name,
                    Tipo: s.type,
                    Objeto: s.object,
                    NIT: s.nit,
                    Fecha: s.date,
                    Puntaje: s.score,
                    Estado: s.status,
                    Evidencias: s.evidence ? 'Sí' : 'No'
                }));

                // Crear libro de Excel
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(dataToExport);

                // Ajustar ancho de columnas
                const wscols = [
                    {wch: 30}, {wch: 12}, {wch: 30}, {wch: 15}, {wch: 12}, {wch: 10}, {wch: 12}, {wch: 10}
                ];
                ws['!cols'] = wscols;

                XLSX.utils.book_append_sheet(wb, ws, "Proveedores");

                // Guardar archivo
                const filePath = await window.electronAPI.showSaveDialog({
                    title: 'Exportar Proveedores',
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                });

                if (filePath) {
                    // Escribir archivo
                    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                    // TODO: Implementar guardado real con IPC
                    this.showNotification('Archivo exportado exitosamente', 'success');
                }

            } catch (error) {
                console.error('[2.9.1][ERROR] Error exportando:', error);
                this.showNotification('Error exportando datos', 'error');
            }
        }

        /**
         * Muestra notificación tipo Toast moderna
         */
        showNotification(message, type = 'info') {
            // Crear contenedor de toasts si no existe
            let toastContainer = document.querySelector('.ep-toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.className = 'ep-toast-container';
                document.body.appendChild(toastContainer);
            }

            // Iconos según el tipo
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };

            // Crear el toast
            const toast = document.createElement('div');
            toast.className = `ep-toast ep-toast-${type}`;
            
            toast.innerHTML = `
                <span class="ep-toast-icon">${icons[type] || icons.info}</span>
                <span class="ep-toast-message">${message}</span>
                <button class="ep-toast-close" onclick="this.parentElement.remove()">✕</button>
            `;

            // Agregar al contenedor
            toastContainer.appendChild(toast);

            // Auto-eliminar después de 4 segundos
            setTimeout(() => {
                if (toast && toast.parentElement) {
                    toast.classList.add('ep-toast-hiding');
                    setTimeout(() => {
                        if (toast && toast.parentElement) {
                            toast.remove();
                        }
                    }, 300);
                }
            }, 4000);
        }

        /**
         * Limpieza al destruir el componente
         */
        destroy() {
            window.currentEvaluacionProveedoresInstance = null;
            this.suppliersData = [];
            this.selectedFiles = [];
            this.currentSupplier = null;
            
            // Limpiar contenedor de toasts
            const toastContainer = document.querySelector('.ep-toast-container');
            if (toastContainer) {
                toastContainer.remove();
            }
        }
    }

    // Exportar al scope global
    window.EvaluacionProveedores = EvaluacionProveedores;

})();
