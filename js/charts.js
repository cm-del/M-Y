'use strict';
const Charts = {
    _chartLoaded: false,
    _loadingPromise: null,

    async _ensureChart() {
        if (window.Chart) return;
        if (!this._loadingPromise) {
            this._loadingPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
                script.onload = () => { this._chartLoaded = true; resolve(); };
                script.onerror = () => reject(new Error('فشل تحميل Chart.js'));
                document.head.appendChild(script);
            });
        }
        await this._loadingPromise;
    },

    async renderGrowthChart(canvasId, batchesData) {
        await this._ensureChart();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const colors = ['#76c7c0', '#d4af37', '#2c6faa'];
        const datasets = batchesData.map((b, i) => ({
            label: b.name,
            data: b.weights.map(w => ({ x: w.age, y: w.weight })),
            borderColor: colors[i % 3],
            tension: 0.4,
            pointRadius: 3
        }));
        new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e0e0e0' } } },
                scales: {
                    x: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } },
                    y: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } }
                }
            }
        });
    },

    async renderTempChart(canvasId, tempLogs) {
        await this._ensureChart();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const labels = tempLogs.map(t => t.date.slice(5) + ' ' + t.time);
        const data = tempLogs.map(t => t.temp);
        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'درجة الحرارة °C',
                    data,
                    borderColor: '#d4af37',
                    backgroundColor: 'rgba(212,175,55,0.1)',
                    tension: 0.3,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e0e0e0' } } },
                scales: {
                    x: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } },
                    y: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } }
                }
            }
        });
    },

    async renderFeedChart(canvasId, feedData) {
        await this._ensureChart();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const sorted = feedData.sort((a, b) => a.date.localeCompare(b.date));
        const labels = sorted.map(f => f.date.slice(5));
        const kgData = sorted.map(f => f.qty || 0);
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'علف مستهلك (كجم)',
                    data: kgData,
                    backgroundColor: '#76c7c033',
                    borderColor: '#76c7c0',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e0e0e0' } } },
                scales: {
                    x: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } },
                    y: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } }
                }
            }
        });
    },

    async renderMortalityChart(canvasId, deathsData) {
        await this._ensureChart();
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        const sorted = deathsData.sort((a, b) => a.date.localeCompare(b.date));
        const labels = sorted.map(d => d.date.slice(5));
        const data = sorted.map(d => d.count || 0);
        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'نفوق يومي',
                    data,
                    borderColor: '#d32f2f',
                    backgroundColor: 'rgba(211,47,47,0.08)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e0e0e0' } } },
                scales: {
                    x: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' } },
                    y: { ticks: { color: '#6999a3' }, grid: { color: '#1a3a4a' }, beginAtZero: true }
                }
            }
        });
    }
};
