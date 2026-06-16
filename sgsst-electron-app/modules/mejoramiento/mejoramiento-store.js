// mejoramiento-store.js - Store compartido para aggregation de datos entre submódulos 7.1.x

if (!window.MejoramientoStore) {
    window.MejoramientoStore = {
        _data: {
            '711': [],  // Acciones Preventivas y Correctivas
            '712': [],  // Acciones de Mejora (Gerencia)
            '713': [],  // Acciones de Mejora (AT y EL)
            '714': []   // Planes de Mejoramiento
        },
        _listeners: [],

        update(submoduleCode, dataArray) {
            this._data[submoduleCode] = Array.isArray(dataArray) ? dataArray : [];
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

        getStats() {
            const year = new Date().getFullYear();
            const currentMonth = new Date().getMonth();
            const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

            const result = {};

            for (const [code, items] of Object.entries(this._data)) {
                const total = items.length;
                const pendientes = items.filter(d => d.estado === 'pendiente').length;
                const enProceso = items.filter(d => d.estado === 'en-proceso').length;
                const implementadas = items.filter(d => d.estado === 'implementada').length;
                const verificadas = items.filter(d => d.estado === 'verificada').length;
                const cerradas = items.filter(d => d.estado === 'cerrada').length;
                const vencidas = items.filter(d => d.estado === 'vencida').length;

                const byMonth = Array(12).fill(0);
                items.forEach(d => {
                    if (d.fechaCreacion) {
                        const dt = new Date(d.fechaCreacion + 'T00:00:00');
                        if (dt.getFullYear() === year) {
                            byMonth[dt.getMonth()]++;
                        }
                    }
                });

                const mesActual = byMonth[currentMonth];

                result[code] = {
                    total, pendientes, enProceso, implementadas, verificadas, cerradas, vencidas,
                    byMonth, mesActual, year: String(year),
                    mes: months[currentMonth]
                };
            }

            const allItems = Object.values(this._data).flat();
            const totalAll = allItems.length;
            const implementadasAll = allItems.filter(d => d.estado === 'implementada' || d.estado === 'verificada' || d.estado === 'cerrada').length;
            const eficacia = totalAll > 0 ? Math.round((implementadasAll / totalAll) * 100) : 0;

            const totalPendientes = allItems.filter(d => d.estado === 'pendiente').length;
            const totalEnProceso = allItems.filter(d => d.estado === 'en-proceso').length;
            const totalVencidas = allItems.filter(d => d.estado === 'vencida').length;

            const allByMonth = Array(12).fill(0);
            allItems.forEach(d => {
                if (d.fechaCreacion) {
                    const dt = new Date(d.fechaCreacion + 'T00:00:00');
                    if (dt.getFullYear() === year) {
                        allByMonth[dt.getMonth()]++;
                    }
                }
            });

            result._global = {
                total: totalAll,
                eficacia,
                pendientes: totalPendientes,
                enProceso: totalEnProceso,
                vencidas: totalVencidas,
                implementadas: implementadasAll,
                byMonth: allByMonth,
                year: String(year),
                mes: months[currentMonth]
            };

            return result;
        }
    };
}
