// mejoramiento-store.js - Store compartido para el módulo Mejoramiento.
// F21.50 (2026-06-21) — Mejoramiento ahora SOLO tiene 7.1.1.
// Los KPIs de este store DEBEN coincidir 1-a-1 con los del viewer 7.1.1
// (acciones-pc-viewer.js → renderKpis):
//   - total       = state.data.length
//   - abiertas    = state.data.filter(a => a.estado === 'ABIERTA').length
//   - enProceso   = state.data.filter(a => a.estado === 'EN PROCESO').length
//   - cerradas    = state.data.filter(a => a.estado === 'CERRADO').length
//   - vencidas    = state.data.filter(_isVencida).length
//
// _isVencida en el viewer:
//   if (!a.cierre || !a.cierre.cerrada) {
//     return a.fecha && a.fecha < _todayIso() && a.estado !== 'CERRADO';
//   }
//   return false;

if (!window.MejoramientoStore) {
    window.MejoramientoStore = {
        _data: {
            '711': []   // 7.1.1 Acciones Preventivas y Correctivas
        },
        _listeners: [],

        update(submoduleCode, dataArray) {
            // Solo aceptamos 711 — los códigos legacy (712/713/714) se ignoran silenciosamente
            if (submoduleCode !== '711') return;
            this._data['711'] = Array.isArray(dataArray) ? dataArray : [];
            this._notify();
        },

        subscribe(fn) {
            this._listeners.push(fn);
            return () => {
                this._listeners = this._listeners.filter(l => l !== fn);
            };
        },

        _notify() {
            const stats = this.getStats();
            this._listeners.forEach(fn => {
                try { fn(stats); } catch (e) { console.error('[MejoramientoStore] Listener error:', e); }
            });
        },

        _todayIso() {
            return new Date().toISOString().split('T')[0];
        },

        _isVencida(a) {
            if (!a.cierre || !a.cierre.cerrada) {
                if (!a.fecha) return false;
                return a.fecha < this._todayIso() && a.estado !== 'CERRADO';
            }
            return false;
        },

        getStats() {
            const year = new Date().getFullYear();
            const currentMonth = new Date().getMonth();
            const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

            const items = this._data['711'] || [];
            const total = items.length;
            const abiertas = items.filter(a => a.estado === 'ABIERTA').length;
            const enProceso = items.filter(a => a.estado === 'EN PROCESO').length;
            const cerradas = items.filter(a => a.estado === 'CERRADO').length;
            const vencidas = items.filter(a => this._isVencida(a)).length;

            /* Cumplimiento % = cerradas / total (mismo denominador que el viewer) */
            const cumplimiento = total > 0 ? Math.round((cerradas / total) * 100) : 0;

            /* Distribución por mes de creación (para chart de barras) */
            const byMonth = Array(12).fill(0);
            items.forEach(a => {
                if (a.fechaCreacion) {
                    const dt = new Date(a.fechaCreacion + 'T00:00:00');
                    if (dt.getFullYear() === year) byMonth[dt.getMonth()]++;
                }
            });
            const mesActual = byMonth[currentMonth];

            /* Distribución por fuente (Excel vs nueva vs otra) — para chart de torta */
            const porFuente = { excel: 0, nueva: 0, otra: 0 };
            items.forEach(a => {
                const f = (a.fuenteOrigen || a.fuente || '').toLowerCase();
                if (f === 'excel') porFuente.excel++;
                else if (f === 'nueva' || f === 'sqlite') porFuente.nueva++;
                else porFuente.otra++;
            });

            return {
                total, abiertas, enProceso, cerradas, vencidas, cumplimiento,
                byMonth, mesActual, porFuente,
                year: String(year),
                mes: months[currentMonth]
            };
        }
    };
}