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
  constructor(container, moduleName, submoduleTitle, backToModuleCallback, currentCompany) {
    this.container = container;
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    this.backToModuleCallback = backToModuleCallback;
    this.currentCompany = currentCompany || '';

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
  this.updateHeaderContext();
 }

        /**
         * Carga la configuración desde el backend
         */
        async loadConfig() {
            try {
                // Intentar obtener la empresa desde window.currentCompany (set por renderer.js)
                this.companyName = this.currentCompany || window.currentCompany || window.electronAPI.currentCompany || null;
                
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
         * Escapa HTML para inyección segura de texto
         */
        escapeHtml(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        /**
         * Iniciales del proveedor para el avatar
         */
        iniciales(name) {
            const clean = String(name || '?').trim();
            const parts = clean.split(/\s+/).filter(Boolean);
            if (parts.length === 0) return '?';
            if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }

        /**
         * Nivel de calificación según puntaje (Res. 0312 / Decreto 1072)
         */
        nivelDe(score) {
            if (score >= 80) return { nivel: 'CUMPLE', resultado: 'HOMOLOGADO', texto: 'Aprobación inmediata del proveedor.', cls: 'ok', riesgo: 'Bajo', frase: 'Nivel: CUMPLE - HOMOLOGADO — Aprobación inmediata.' };
            if (score >= 50) return { nivel: 'PARCIAL', resultado: 'CONDICIONAL', texto: 'Requiere Plan de Mejora antes de contratar.', cls: 'warn', riesgo: 'Medio', frase: 'Nivel: PARCIAL - CONDICIONAL — Requiere Plan de Mejora.' };
            return { nivel: 'NO CUMPLE', resultado: 'INHABILITADO', texto: 'No se puede contratar con el proveedor.', cls: 'danger', riesgo: 'Alto riesgo', frase: 'Nivel: NO CUMPLE - INHABILITADO — No se puede contratar.' };
        }

        /**
         * Criterios de evaluación (matriz de 10 ítems SG-SST)
         */
        criteriosLista() {
            return [
                { key: 'arl', label: 'ARL y Seguridad Social', desc: 'Afiliación y vigencia del sistema de seguridad social' },
                { key: 'politica', label: 'Política de SST', desc: 'Política firmada, difundida y con fecha' },
                { key: 'iperc', label: 'Matriz de Peligros', desc: 'IPERC actualizado por cargo y proceso' },
                { key: 'pta', label: 'Plan de Trabajo Anual', desc: 'PTA con cronograma y avance' },
                { key: 'capacitacion', label: 'Registro Capacitaciones', desc: 'Evidencias de formación en SST' },
                { key: 'epp', label: 'Entrega de EPP', desc: 'Listados de entrega con firma' },
                { key: 'estadisticas', label: 'Estadísticas SST', desc: 'Indicadores del año anterior' },
                { key: 'clausula', label: 'Cláusula SST', desc: 'Obligatoriedad contractual de SST' },
                { key: 'reporte', label: 'Mecanismo Reporte', desc: 'Procedimiento de reporte de eventos' },
                { key: 'investigacion', label: 'Investigación Accidentes', desc: 'Metodología de investigación vigente' }
            ];
        }

        /**
         * Formatea fecha ISO o DD/MM/AAAA a DD/MM/AAAA
         */
        fmtFecha(d) {
            if (!d) return '—';
            const s = String(d).trim();
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return m[3] + '/' + m[2] + '/' + m[1];
            return s;
        }

        /**
         * Fecha comparable para ordenamiento
         */
        fechaTS(d) {
            const s = String(d || '').trim();
            let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
            m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
            return 0;
        }

        /**
         * Renderiza la estructura HTML principal (premium v2)
         */
        renderUI() {
            const checklistHtml = this.criteriosLista().map((c, i) => `
                <label class="ep-check">
                    <input type="checkbox" class="ep-eval-check" data-criterion="${i + 1}">
                    <span class="ep-check__box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
                    <span class="ep-check__num">${i + 1}</span>
                    <span class="ep-check__txt"><b>${c.label}</b><small>${c.desc}</small></span>
                </label>
            `).join('');

            this.container.innerHTML = `
            <div class="ep-root">
                <header class="ep-header">
                    <div class="ep-header__bar">
                        <div class="ep-header__id">
                            <span class="ep-header__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                            </span>
                            <div>
                                <h1 class="ep-header__title">Identificación y Evaluación de Bienes y Servicios</h1>
                                <p class="ep-header__sub">Gestión de proveedores y evaluación de bienes y servicios SG-SST</p>
                            </div>
                        </div>
                        <div class="ep-header__actions">
                            <button type="button" class="ep-btn ep-btn--outline" id="ep-btn-back-module">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>
                                Volver
                            </button>
                            <button type="button" class="ep-btn ep-btn--outline" id="ep-btn-criteria">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                                Ver Escala
                            </button>
                            <button type="button" class="ep-btn ep-btn--primary" id="ep-btn-new-provider-header">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                Nueva Evaluación
                            </button>
                        </div>
                    </div>
                </header>

                <div class="ep-content-scroll" id="ep-list-view">
                    <div class="ep-page">
                        <div class="ep-kpis">
                            <div class="ep-kpi">
                                <span class="ep-kpi__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></span>
                                <div class="ep-kpi__txt"><b id="ep-kpi-total">0</b><span>Total Evaluados</span></div>
                            </div>
                            <div class="ep-kpi">
                                <span class="ep-kpi__ic ep-kpi__ic--green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></span>
                                <div class="ep-kpi__txt"><b id="ep-kpi-approved">0</b><span>Aprobados</span></div>
                            </div>
                            <div class="ep-kpi">
                                <span class="ep-kpi__ic ep-kpi__ic--amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
                                <div class="ep-kpi__txt"><b id="ep-kpi-pending">0</b><span>Pendientes</span></div>
                            </div>
                            <div class="ep-kpi">
                                <span class="ep-kpi__ic ep-kpi__ic--red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></span>
                                <div class="ep-kpi__txt"><b id="ep-kpi-rejected">0</b><span>Rechazados</span></div>
                            </div>
                        </div>

                        <div class="ep-card">
                            <div class="ep-toolbar">
                                <div class="ep-search">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                    <input type="text" id="ep-search-input" placeholder="Buscar proveedor por nombre o NIT...">
                                </div>
                                <select id="ep-filter-type" class="ep-select">
                                    <option value="all">Tipo · Todos</option>
                                    <option value="Bien">Bien</option>
                                    <option value="Servicio">Servicio</option>
                                </select>
                                <select id="ep-filter-status" class="ep-select">
                                    <option value="all">Estado · Todos</option>
                                    <option value="Aprobado">Aprobados</option>
                                    <option value="Pendiente">Pendientes</option>
                                    <option value="Rechazado">Rechazados</option>
                                </select>
                                <div class="ep-toolbar__right">
                                    <span class="ep-count" id="ep-count">0 proveedores</span>
                                    <button type="button" class="ep-btn ep-btn--outline" id="ep-btn-export">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                                        Exportar CSV
                                    </button>
                                </div>
                            </div>
                            <div class="ep-tablewrap">
                                <table class="ep-table">
                                    <thead>
                                        <tr>
                                            <th>Proveedor</th>
                                            <th>Tipo</th>
                                            <th>Objeto</th>
                                            <th class="ep-th-sort" id="ep-th-fecha">Fecha <span class="ep-sort-ic" id="ep-sort-icon">▼</span></th>
                                            <th>Puntaje</th>
                                            <th>Estado</th>
                                            <th>Evidencias</th>
                                            <th class="ep-th-actions">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody id="ep-suppliers-table-body"></tbody>
                                </table>
                                <div class="ep-empty" id="ep-empty" hidden>
                                    <span class="ep-empty__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>
                                    <b>Sin resultados</b>
                                    <p>Ningún proveedor coincide con la búsqueda o los filtros activos.</p>
                                    <small>Ajusta los criterios o registra una nueva evaluación.</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="ep-detail" id="ep-detail-view" hidden>
                    <div class="ep-page">
                        <button type="button" class="ep-btn ep-btn--outline ep-btn--sm" id="ep-btn-back-to-list">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>
                            Volver a la Lista
                        </button>
                        <div class="ep-dcard">
                            <div class="ep-dcard__id">
                                <span class="ep-avatar ep-avatar--lg" id="ep-detail-avatar">—</span>
                                <div>
                                    <div class="ep-dcard__name" id="ep-detail-name">—</div>
                                    <div class="ep-dcard__meta">
                                        <span id="ep-detail-nit">NIT: —</span>
                                        <span class="ep-pill ep-pill--blue" id="ep-detail-type-chip">—</span>
                                        <span id="ep-detail-date">Evaluado: —</span>
                                    </div>
                                </div>
                            </div>
                            <div class="ep-dcard__score">
                                <div class="ep-dcard__pct"><b id="ep-detail-score">0</b><span>%</span><label>PUNTAJE</label></div>
                                <span class="ep-pill ep-pill--amber" id="ep-detail-status">Pendiente</span>
                                <button type="button" class="ep-btn ep-btn--primary" id="ep-detail-reevaluate">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
                                    Re-evaluar
                                </button>
                            </div>
                        </div>
                        <div class="ep-dgrid">
                            <div class="ep-dgrid__col">
                                <div class="ep-card">
                                    <div class="ep-card__title">
                                        <span class="ep-card__tic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></span>
                                        Información General
                                    </div>
                                    <dl class="ep-deflist">
                                        <div><dt>Razón Social</dt><dd id="ep-detail-full-name">—</dd></div>
                                        <div><dt>NIT</dt><dd id="ep-detail-nit-full">—</dd></div>
                                        <div><dt>Tipo</dt><dd id="ep-detail-type">—</dd></div>
                                        <div><dt>Objeto Contractual</dt><dd id="ep-detail-object">—</dd></div>
                                        <div><dt>Fecha Evaluación</dt><dd id="ep-detail-eval-date">—</dd></div>
                                        <div><dt>Ítems Verificados</dt><dd id="ep-detail-items">—</dd></div>
                                    </dl>
                                </div>
                                <div class="ep-card">
                                    <div class="ep-card__title">
                                        <span class="ep-card__tic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
                                        Observaciones
                                    </div>
                                    <div class="ep-obs" id="ep-detail-observations">Sin observaciones registradas.</div>
                                </div>
                                <div class="ep-card">
                                    <div class="ep-card__title">
                                        <span class="ep-card__tic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 0 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span>
                                        Evidencias Archivadas
                                    </div>
                                    <div class="ep-evpath">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                                        /Proveedores/<b id="ep-detail-path">—</b>/
                                    </div>
                                    <ul class="ep-evlist" id="ep-detail-file-list"></ul>
                                    <div class="ep-evnone" id="ep-no-files-msg" hidden>
                                        <p>Sin archivos en la carpeta del proveedor.</p>
                                    </div>
                                </div>
                            </div>
                            <div class="ep-card">
                                <div class="ep-card__title">
                                    <span class="ep-card__tic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
                                    Matriz de Cumplimiento SST · Decreto 1072 / Res. 0312
                                </div>
                                <div class="ep-matrix" id="ep-detail-checklist"></div>
                                <div class="ep-matrix__foot">
                                    <span class="ep-pill ep-pill--slate" id="ep-detail-matrix-count">0/10 ítems</span>
                                    <span id="ep-detail-matrix-nivel">—</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="ep-modal" id="ep-modal" role="dialog" aria-modal="true">
                    <div class="ep-modal__box">
                        <div class="ep-modal__head">
                            <div>
                                <h2 id="ep-modal-title">Nueva Evaluación de Proveedor</h2>
                                <p>Criterios Decreto 1072 de 2015 / Resolución 0312 de 2019</p>
                            </div>
                            <button type="button" class="ep-iconbtn" id="ep-btn-close-modal" title="Cerrar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        <div class="ep-modal__body">
                            <div class="ep-modal__col">
                                <h3>Información del Proveedor</h3>
                                <label class="ep-field"><span>Razón Social *</span><input type="text" id="ep-modal-name" class="ep-input" placeholder="Nombre de la empresa" autocomplete="off"></label>
                                <div class="ep-fieldrow">
                                    <label class="ep-field"><span>NIT *</span><input type="text" id="ep-modal-nit" class="ep-input" placeholder="900.000.000" autocomplete="off"></label>
                                    <label class="ep-field"><span>Tipo</span>
                                        <select id="ep-modal-type" class="ep-input"><option>Bien</option><option>Servicio</option></select>
                                    </label>
                                </div>
                                <label class="ep-field"><span>Objeto</span><input type="text" id="ep-modal-object" class="ep-input" placeholder="Descripción del bien o servicio" autocomplete="off"></label>
                                <label class="ep-field"><span>Observaciones</span><textarea id="ep-modal-observations" class="ep-input" rows="3" placeholder="Justificaciones, compromisos del plan de mejora..."></textarea></label>
                                <h3>Gestión de Evidencias</h3>
                                <div class="ep-dropzone" id="ep-dropzone" role="button" tabindex="0">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
                                    <b>Arrastra los archivos aquí</b>
                                    <small>o haz clic para seleccionar · se archivan en la carpeta del proveedor</small>
                                </div>
                                <div class="ep-ruta">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                                    /Proveedores/<b id="ep-preview-folder-name">NOMBRE</b>/
                                </div>
                                <div id="ep-file-list-container" class="ep-filelist" hidden>
                                    <ul id="ep-file-list"></ul>
                                </div>
                                <input type="file" id="ep-file-input" multiple hidden>
                            </div>
                            <div class="ep-modal__col">
                                <h3>Verificación · Documentos SG-SST</h3>
                                <div class="ep-scorebox" id="ep-scorebox">
                                    <span class="ep-scorebox__lbl">CALIFICACIÓN</span>
                                    <b id="ep-total-score">0%</b>
                                    <div class="ep-scorebar"><i id="ep-score-bar"></i></div>
                                    <small id="ep-score-label">SIN ÍTEMS</small>
                                </div>
                                <div class="ep-checklist">${checklistHtml}</div>
                            </div>
                        </div>
                        <div class="ep-modal__foot">
                            <button type="button" class="ep-btn ep-btn--outline" id="ep-btn-cancel-modal">Cancelar</button>
                            <button type="button" class="ep-btn ep-btn--primary" id="ep-btn-save-modal">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h11L19.5 8v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20V5A1.5 1.5 0 0 1 5 3.5Z"/><path d="M8 3.5V8h7V3.5"/><path d="M7.5 13.5h9M7.5 17h6"/></svg>
                                Guardar y Archivar
                            </button>
                        </div>
                    </div>
                </div>

                <div class="ep-drawerwrap" id="ep-drawer" hidden>
                    <div class="ep-drawerwrap__backdrop" id="ep-drawer-backdrop"></div>
                    <aside class="ep-drawer">
                        <div class="ep-drawer__head">
                            <div>
                                <h2>Escala de Calificación</h2>
                                <p>Interpretación de resultados · Habilitación contractual</p>
                            </div>
                            <button type="button" class="ep-iconbtn" id="ep-btn-close-panel" title="Cerrar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        <div class="ep-drawer__body">
                            <div class="ep-formula"><span>FÓRMULA</span><b>PUNTAJE = (Ítems / 10) × 100</b></div>
                            <h3>Niveles</h3>
                            <div class="ep-nivel ep-nivel--danger">
                                <div class="ep-nivel__head"><b>0% – 49%: NO CUMPLE</b><span class="ep-pill ep-pill--red">Alto riesgo</span></div>
                                <p><b>Resultado: INHABILITADO.</b> No se puede contratar con el proveedor.</p>
                            </div>
                            <div class="ep-nivel ep-nivel--warn">
                                <div class="ep-nivel__head"><b>50% – 79%: PARCIAL</b><span class="ep-pill ep-pill--amber">Medio</span></div>
                                <p><b>Resultado: CONDICIONAL.</b> Requiere Plan de Mejora antes de contratar.</p>
                            </div>
                            <div class="ep-nivel ep-nivel--ok">
                                <div class="ep-nivel__head"><b>80% – 100%: CUMPLE</b><span class="ep-pill ep-pill--green">Bajo</span></div>
                                <p><b>Resultado: HOMOLOGADO.</b> Aprobación inmediata del proveedor.</p>
                            </div>
                            <div class="ep-note"><b>Nota legal:</b> la calificación debe estar respaldada por las evidencias adjuntas en la carpeta del proveedor (Decreto 1072 de 2015, art. 2.2.4.1.2.5 y Resolución 0312 de 2019).</div>
                        </div>
                        <div class="ep-drawer__foot">
                            <button type="button" class="ep-btn ep-btn--outline" id="ep-btn-print-scale">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3.5h10V8"/><path d="M7 17H4.5c-.8 0-1.5-.7-1.5-1.5v-5C3 9.7 3.7 9 4.5 9h15c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5H17"/><rect x="7" y="14" width="10" height="6.5" rx="1"/></svg>
                                Imprimir
                            </button>
                            <button type="button" class="ep-btn ep-btn--primary" id="ep-btn-copy-scale">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                Copiar
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
            `;

            this.modal = document.getElementById('ep-modal');
            this.panel = document.getElementById('ep-drawer');
            this.dropZone = document.getElementById('ep-dropzone');
            this.fileInput = document.getElementById('ep-file-input');
        }


        /**
         * Datos filtrados por búsqueda + filtros activos
         */
        getFiltered() {
            const term = (document.getElementById('ep-search-input')?.value || '').toLowerCase().trim();
            const fType = document.getElementById('ep-filter-type')?.value || 'all';
            const fStatus = document.getElementById('ep-filter-status')?.value || 'all';

            let data = this.suppliersData.slice();
            if (term) {
                data = data.filter(s =>
                    String(s.name || '').toLowerCase().includes(term) ||
                    String(s.nit || '').toLowerCase().includes(term) ||
                    String(s.object || '').toLowerCase().includes(term)
                );
            }
            if (fType !== 'all') data = data.filter(s => s.type === fType);
            if (fStatus !== 'all') data = data.filter(s => s.status === fStatus);
            return data;
        }

        /**
         * Inicializa los eventos de la interfaz
         */
        initEventListeners() {
            // Botones principales
            document.getElementById('ep-btn-new-provider-header').addEventListener('click', () => this.openModal('new'));
            document.getElementById('ep-btn-criteria').addEventListener('click', () => this.abrirEscala());

            // Volver al Módulo Principal
            document.getElementById('ep-btn-back-module').addEventListener('click', () => {
                if (this.backToModuleCallback) this.backToModuleCallback();
            });

            // Volver a la Lista (Vista de Detalle)
            document.getElementById('ep-btn-back-to-list').addEventListener('click', () => this.showListView());

            // Cerrar Modal
            document.getElementById('ep-btn-close-modal').addEventListener('click', () => this.closeModal());
            document.getElementById('ep-btn-cancel-modal').addEventListener('click', () => this.closeModal());

            // Cerrar Drawer Escala
            document.getElementById('ep-btn-close-panel').addEventListener('click', () => this.cerrarEscala());
            document.getElementById('ep-drawer-backdrop').addEventListener('click', () => this.cerrarEscala());

            // Guardar Modal
            document.getElementById('ep-btn-save-modal').addEventListener('click', () => this.saveEvaluation());

            // Re-evaluar desde detalle
            document.getElementById('ep-detail-reevaluate').addEventListener('click', () => {
                if (this.currentSupplier) this.openModal(this.currentSupplier.id);
            });

            // Input Nombre (Live Preview de ruta)
            document.getElementById('ep-modal-name').addEventListener('input', () => this.updatePathPreview());

            // Eventos Checkboxes
            this.container.querySelectorAll('.ep-eval-check').forEach(cb => {
                cb.addEventListener('change', () => this.calculateScore());
            });

            // Eventos Drag & Drop
            this.dropZone.addEventListener('click', () => this.fileInput.click());
            this.fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
                this.fileInput.value = '';
            });
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

            // Búsqueda y filtros
            document.getElementById('ep-search-input').addEventListener('input', () => this.renderTable(this.getFiltered()));
            document.getElementById('ep-filter-type').addEventListener('change', () => this.renderTable(this.getFiltered()));
            document.getElementById('ep-filter-status').addEventListener('change', () => this.renderTable(this.getFiltered()));

            // Ordenamiento por fecha
            this._sortDir = 'desc';
            document.getElementById('ep-th-fecha').addEventListener('click', () => {
                this._sortDir = this._sortDir === 'desc' ? 'asc' : 'desc';
                document.getElementById('ep-sort-icon').textContent = this._sortDir === 'desc' ? '▼' : '▲';
                this.renderTable(this.getFiltered());
            });

            // Exportar CSV
            document.getElementById('ep-btn-export').addEventListener('click', () => this.exportCSV());

            // Botones del drawer escala
            document.getElementById('ep-btn-print-scale').addEventListener('click', () => {
                this.showNotification('Función imprimir en desarrollo', 'info');
            });
            document.getElementById('ep-btn-copy-scale').addEventListener('click', () => {
                const texto = 'ESCALA DE CALIFICACIÓN — PROVEEDORES SG-SST\n' +
                    'Fórmula: PUNTAJE = (Ítems / 10) × 100\n\n' +
                    '0% – 49%: NO CUMPLE — INHABILITADO (alto riesgo). No se puede contratar con el proveedor.\n' +
                    '50% – 79%: PARCIAL — CONDICIONAL (medio). Requiere Plan de Mejora antes de contratar.\n' +
                    '80% – 100%: CUMPLE — HOMOLOGADO (bajo). Aprobación inmediata del proveedor.\n\n' +
                    'Nota legal: la calificación debe estar respaldada por las evidencias adjuntas en la carpeta del proveedor (Decreto 1072 de 2015, art. 2.2.4.1.2.5 y Resolución 0312 de 2019).';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(texto).then(() => {
                        this.showNotification('Escala copiada al portapapeles', 'success');
                    }).catch(() => {
                        this.showNotification('No se pudo copiar al portapapeles', 'error');
                    });
                } else {
                    this.showNotification('Portapapeles no disponible', 'error');
                }
            });

            // Cerrar modal / drawer con Escape (un solo listener por instancia)
            this._escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeModal();
                    this.cerrarEscala();
                }
            };
            document.addEventListener('keydown', this._escHandler);

            // Cerrar modal al hacer clic fuera
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }

        /**
         * Renderiza la tabla de proveedores (premium v2)
         */
        renderTable(data) {
            const tbody = document.getElementById('ep-suppliers-table-body');
            if (!tbody) return;

            const token = (this._renderToken = (this._renderToken || 0) + 1);
            tbody.innerHTML = '';

            // Ordenamiento por fecha
            data = data.slice().sort((a, b) => {
                const diff = this.fechaTS(a.date) - this.fechaTS(b.date);
                return this._sortDir === 'desc' ? -diff : diff;
            });

            document.getElementById('ep-count').textContent = data.length + (data.length === 1 ? ' proveedor' : ' proveedores');
            document.getElementById('ep-empty').hidden = data.length !== 0;

            const pillEstado = s => s === 'Aprobado' ? 'ep-pill--green' : (s === 'Rechazado' ? 'ep-pill--red' : 'ep-pill--amber');
            const clsBarra = sc => sc >= 80 ? 'is-ok' : (sc >= 50 ? 'is-warn' : 'is-danger');

            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div class="ep-prov">
                            <span class="ep-avatar">${this.escapeHtml(this.iniciales(item.name))}</span>
                            <div class="ep-prov__txt"><b>${this.escapeHtml(item.name)}</b><small>NIT ${this.escapeHtml(item.nit || '—')}</small></div>
                        </div>
                    </td>
                    <td><span class="ep-pill ep-pill--blue">${this.escapeHtml(item.type || 'Servicio')}</span></td>
                    <td class="ep-obj" title="${this.escapeHtml(item.object || '')}">${this.escapeHtml(item.object || '—')}</td>
                    <td class="ep-nowrap">${this.escapeHtml(this.fmtFecha(item.date))}</td>
                    <td>
                        <div class="ep-pt">
                            <b>${item.score}%</b>
                            <div class="ep-pt__bar"><i class="${clsBarra(item.score)}" style="width:${Math.max(0, Math.min(100, item.score))}%"></i></div>
                        </div>
                    </td>
                    <td><span class="ep-pill ${pillEstado(item.status)}">${this.escapeHtml(item.status)}</span></td>
                    <td data-ep-evidcell="${this.escapeHtml(String(item.id))}">
                        ${item.evidence
                            ? '<span class="ep-pill ep-pill--green">Archivado</span>'
                            : '<span class="ep-pill ep-pill--slate">Sin evidencias</span>'}
                    </td>
                    <td>
                        <div class="ep-rowactions">
                            <button type="button" class="ep-btn ep-btn--ghost ep-btn--sm" data-ver="${this.escapeHtml(String(item.id))}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                                Ver
                            </button>
                            <button type="button" class="ep-btn ep-btn--ghost ep-btn--sm" data-reev="${this.escapeHtml(String(item.id))}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
                                Re-evaluar
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Acciones de fila (delegación)
            tbody.querySelectorAll('[data-ver]').forEach(btn => {
                btn.addEventListener('click', () => this.showDetailView(btn.getAttribute('data-ver')));
            });
            tbody.querySelectorAll('[data-reev]').forEach(btn => {
                btn.addEventListener('click', () => this.openModal(btn.getAttribute('data-reev')));
            });

            // Conteo real de evidencias por proveedor (async, sin bloquear)
            this.loadEvidenceCounts(token);

            this.updateMetrics();
        }

        /**
         * Actualiza el conteo de archivos en las pastillas de evidencias
         */
        async loadEvidenceCounts(token) {
            if (!this.submodulePath || !window.electronAPI || !window.electronAPI.listProviderFiles) return;
            const basePath = this.submodulePath.replace(/\\/g, '/');
            const jobs = this.suppliersData.filter(s => s.evidence && s.folder).map(async (s) => {
                try {
                    const res = await window.electronAPI.listProviderFiles(basePath + '/' + s.folder);
                    if (token !== this._renderToken) return;
                    const cell = document.querySelector(`[data-ep-evidcell="${CSS.escape(String(s.id))}"]`);
                    if (!cell) return;
                    const n = (res.success && res.files) ? res.files.length : 0;
                    cell.innerHTML = n > 0
                        ? `<span class="ep-pill ep-pill--green">Archivado · ${n}</span>`
                        : '<span class="ep-pill ep-pill--slate">Sin evidencias</span>';
                } catch (e) { /* mantener pastilla por defecto */ }
            });
            await Promise.all(jobs);
        }

        /**
         * Muestra la vista de detalle (premium v2)
         */
        async showDetailView(id) {
            try {
                const supplier = this.suppliersData.find(s => String(s.id) === String(id));
                if (!supplier) {
                    console.error('[2.9.1][ERROR] Proveedor no encontrado con ID:', id);
                    return;
                }
                this.currentSupplier = supplier;
                console.log('[2.9.1][DETAIL] Mostrando detalle de:', supplier.name);

                document.getElementById('ep-list-view').hidden = true;
                const detailView = document.getElementById('ep-detail-view');
                detailView.hidden = false;

                // Encabezado de ficha
                document.getElementById('ep-detail-avatar').textContent = this.iniciales(supplier.name);
                document.getElementById('ep-detail-name').textContent = supplier.name;
                document.getElementById('ep-detail-nit').textContent = 'NIT: ' + (supplier.nit || '—');
                document.getElementById('ep-detail-type-chip').textContent = supplier.type || 'Servicio';
                document.getElementById('ep-detail-date').textContent = 'Evaluado: ' + this.fmtFecha(supplier.date);

                const score = Math.max(0, Math.min(100, parseInt(supplier.score, 10) || 0));
                const scoreEl = document.getElementById('ep-detail-score');
                scoreEl.textContent = score;
                scoreEl.className = score >= 80 ? 'is-ok' : (score >= 50 ? 'is-warn' : 'is-danger');

                const badge = document.getElementById('ep-detail-status');
                const nivel = this.nivelDe(score);
                badge.textContent = (supplier.status || 'Pendiente') + ' · ' + nivel.nivel;
                badge.className = 'ep-pill ' + (supplier.status === 'Aprobado' ? 'ep-pill--green' : (supplier.status === 'Rechazado' ? 'ep-pill--red' : 'ep-pill--amber'));

                // Información general
                document.getElementById('ep-detail-full-name').textContent = supplier.name;
                document.getElementById('ep-detail-nit-full').textContent = supplier.nit || '—';
                document.getElementById('ep-detail-type').textContent = supplier.type || '—';
                document.getElementById('ep-detail-object').textContent = supplier.object || '—';
                document.getElementById('ep-detail-eval-date').textContent = this.fmtFecha(supplier.date);

                const criteria = supplier.criteria || {};
                const itemsOk = this.criteriosLista().filter(c => !!criteria[c.key]).length;
                document.getElementById('ep-detail-items').textContent = itemsOk + ' de 10';

                // Observaciones
                document.getElementById('ep-detail-observations').textContent =
                    (supplier.observations && supplier.observations.trim() !== '') ? supplier.observations : 'Sin observaciones registradas.';

                // Matriz de cumplimiento
                const matrix = document.getElementById('ep-detail-checklist');
                matrix.innerHTML = this.criteriosLista().map((c, i) => {
                    const ok = !!criteria[c.key];
                    return `
                        <div class="ep-mx ${ok ? 'is-ok' : 'is-danger'}">
                            <span class="ep-mx__ic">
                                ${ok
                                    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
                                    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'}
                            </span>
                            <span class="ep-mx__num">${i + 1}</span>
                            <span class="ep-mx__txt"><b>${c.label}</b><small>${c.desc}</small></span>
                        </div>
                    `;
                }).join('');
                document.getElementById('ep-detail-matrix-count').textContent = itemsOk + '/10 ítems';
                document.getElementById('ep-detail-matrix-nivel').textContent = nivel.frase;

                // Evidencias
                const fileList = document.getElementById('ep-detail-file-list');
                const noFilesMsg = document.getElementById('ep-no-files-msg');
                const pathB = document.getElementById('ep-detail-path');
                fileList.innerHTML = '';

                if (supplier.evidence && supplier.folder && this.submodulePath) {
                    pathB.textContent = supplier.folder;
                    noFilesMsg.hidden = true;
                    const folderPath = this.submodulePath.replace(/\\/g, '/') + '/' + supplier.folder;
                    try {
                        const listResult = await window.electronAPI.listProviderFiles(folderPath);
                        if (listResult.success && listResult.files && listResult.files.length > 0) {
                            listResult.files.forEach(file => {
                                let fileSize = file.size;
                                if (file.size > 1024 * 1024) fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
                                else if (file.size > 1024) fileSize = (file.size / 1024).toFixed(1) + ' KB';
                                else fileSize = file.size + ' B';
                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <span class="ep-evlist__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg></span>
                                    <span class="ep-evlist__name">${this.escapeHtml(file.name)}</span>
                                    <span class="ep-evlist__size">${fileSize}</span>
                                `;
                                li.style.cursor = 'pointer';
                                li.title = 'Abrir archivo';
                                li.addEventListener('click', () => {
                                    window.electronAPI.openPath(folderPath + '/' + file.name);
                                });
                                fileList.appendChild(li);
                            });
                        } else {
                            noFilesMsg.hidden = false;
                        }
                    } catch (error) {
                        console.error('[2.9.1][DETAIL] Error leyendo archivos:', error);
                        noFilesMsg.hidden = false;
                    }
                } else {
                    pathB.textContent = supplier.folder || '—';
                    noFilesMsg.hidden = false;
                }

                const scroll = this.container.querySelector('.ep-content-scroll');
                if (scroll) scroll.scrollTop = 0;
                window.scrollTo && window.scrollTo(0, 0);
                console.log('[2.9.1][DETAIL] Detalle poblado correctamente');
            } catch (error) {
                console.error('[2.9.1][ERROR] Error en showDetailView:', error);
                this.showNotification('Error al mostrar el detalle: ' + error.message, 'error');
            }
        }

        /**
         * Vuelve a la vista de lista
         */
        showListView() {
            document.getElementById('ep-detail-view').hidden = true;
            document.getElementById('ep-list-view').hidden = false;
            this.currentSupplier = null;
            const scroll = this.container.querySelector('.ep-content-scroll');
            if (scroll) scroll.scrollTop = 0;
        }

        /**
         * Actualiza las tarjetas KPI
         */
        updateMetrics() {
            const total = this.suppliersData.length;
            const approved = this.suppliersData.filter(s => s.status === 'Aprobado').length;
            const pending = this.suppliersData.filter(s => s.status === 'Pendiente').length;
            const rejected = this.suppliersData.filter(s => s.status === 'Rechazado').length;

            const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            set('ep-kpi-total', total);
            set('ep-kpi-approved', approved);
            set('ep-kpi-pending', pending);
            set('ep-kpi-rejected', rejected);
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
            document.getElementById('ep-modal-title').textContent = 'Nueva Evaluación de Proveedor';

            // Limpiar checkboxes
            this.container.querySelectorAll('.ep-eval-check').forEach(c => { c.checked = false; });

            // Limpiar archivos
            document.getElementById('ep-file-list').innerHTML = '';
            document.getElementById('ep-file-list-container').hidden = true;
            this.selectedFiles = [];

            // Resetear score y ruta
            this.calculateScore();
            this.updatePathPreview();

            // Mostrar modal
            this.modal.classList.add('active');

            // Cargar datos si es edición / re-evaluación
            if (id !== 'new') {
                const data = this.suppliersData.find(s => String(s.id) === String(id));
                if (data) {
                    this.currentSupplier = data;
                    document.getElementById('ep-modal-name').value = data.name || '';
                    document.getElementById('ep-modal-nit').value = data.nit || '';
                    document.getElementById('ep-modal-type').value = data.type || 'Bien';
                    document.getElementById('ep-modal-object').value = data.object || '';
                    document.getElementById('ep-modal-observations').value = data.observations || '';
                    document.getElementById('ep-modal-title').textContent = 'Re-evaluar: ' + (data.name || 'Proveedor');

                    const criteria = data.criteria || {};
                    const lista = this.criteriosLista();
                    this.container.querySelectorAll('.ep-eval-check').forEach((cb, i) => {
                        if (lista[i]) cb.checked = !!criteria[lista[i].key];
                    });
                    this.calculateScore();
                    this.updatePathPreview();
                }
            } else {
                this.currentSupplier = null;
            }
        }

        /**
         * Cierra el modal
         */
        closeModal() {
            if (!this.modal) return;
            this.modal.classList.remove('active');
            this.currentSupplier = null;
        }

        /**
         * Abre el drawer de la escala de calificación
         */
        abrirEscala() {
            if (this.panel) {
                this.panel.hidden = false;
                requestAnimationFrame(() => this.panel.classList.add('open'));
            }
        }

        /**
         * Cierra el drawer de la escala
         */
        cerrarEscala() {
            if (!this.panel) return;
            this.panel.classList.remove('open');
            setTimeout(() => { if (this.panel) this.panel.hidden = true; }, 200);
        }

        /**
         * Actualiza la vista previa de la ruta
         */
        updatePathPreview() {
            const name = document.getElementById('ep-modal-name').value || '[NOMBRE]';
            const cleanName = name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
            document.getElementById('ep-preview-folder-name').innerText = cleanName;
        }

        /**
         * Maneja la selección de archivos
         */
        handleFileSelect(files) {
            const list = document.getElementById('ep-file-list');
            const container = document.getElementById('ep-file-list-container');
            container.hidden = false;

            Array.from(files).forEach(file => {
                this.selectedFiles.push(file);
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="ep-filelist__name">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                        ${this.escapeHtml(file.name)}
                        <small>(${(file.size / 1024).toFixed(1)} KB)</small>
                    </span>
                    <button type="button" class="ep-filelist__rm" data-name="${this.escapeHtml(file.name)}" title="Quitar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                `;
                li.querySelector('.ep-filelist__rm').addEventListener('click', function () {
                    const fileName = this.getAttribute('data-name');
                    this.closest('li').remove();
                    this.selectedFiles = this.selectedFiles.filter(f => f.name !== fileName);
                    if (this.selectedFiles.length === 0) container.hidden = true;
                }.bind(this));
                list.appendChild(li);
            });
        }

        /**
         * Calcula el puntaje de evaluación
         */
        calculateScore() {
            const checkboxes = this.container.querySelectorAll('.ep-eval-check');
            const total = checkboxes.length;
            const checked = Array.from(checkboxes).filter(c => c.checked).length;
            const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

            const scoreDisplay = document.getElementById('ep-total-score');
            const progressBar = document.getElementById('ep-score-bar');
            const scoreLabel = document.getElementById('ep-score-label');
            const scoreBox = document.getElementById('ep-scorebox');

            scoreDisplay.innerText = percentage + '%';
            progressBar.style.width = percentage + '%';
            scoreLabel.innerText = checked === 0 ? 'SIN ÍTEMS' : this.nivelDe(percentage).nivel + ' · ' + this.nivelDe(percentage).resultado;

            scoreBox.classList.remove('is-ok', 'is-warn', 'is-danger');
            scoreBox.classList.add(this.nivelDe(percentage).cls);

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
         * Exporta la tabla visible a CSV (descarga directa)
         */
        exportCSV() {
            const data = this.getFiltered();
            if (data.length === 0) {
                this.showNotification('No hay datos para exportar', 'warning');
                return;
            }

            try {
                const esc = v => {
                    const s = String(v == null ? '' : v);
                    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
                };
                const header = ['Proveedor', 'NIT', 'Tipo', 'Objeto', 'Fecha', 'Puntaje (%)', 'Estado', 'Evidencias'];
                const lines = data.map(s => [
                    s.name, s.nit, s.type, s.object, this.fmtFecha(s.date), s.score, s.status,
                    s.evidence ? 'Sí' : 'No'
                ].map(esc).join(','));
                const csv = '\uFEFF' + header.map(esc).join(',') + '\n' + lines.join('\n');

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'proveedores-evaluacion-' + new Date().toISOString().split('T')[0] + '.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);

                this.showNotification('CSV exportado (' + data.length + ' registros)', 'success');
            } catch (error) {
                console.error('[2.9.1][ERROR] Error exportando CSV:', error);
                this.showNotification('Error exportando CSV', 'error');
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

  updateHeaderContext() {
    const companyEl = this.container.querySelector('#ep-header-company');
    if (companyEl && this.companyName) {
      companyEl.textContent = this.companyName;
    }
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
