'use strict';
const Weather = {
    cache: {},
    forecastCache: {},
    currentRegion: '30.06,31.25',
    TIMEOUT_MS: 8000,

    async load(region = this.currentRegion) {
        const key = region;
        const cached = this.cache[key];
        if (cached && Date.now() - cached.ts < 1800000) return cached.data;
        const [lat, lon] = region.split(',');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,uv_index&timezone=Africa/Cairo`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            const d = await res.json();
            const data = {
                temp: d.current.temperature_2m,
                hum: d.current.relative_humidity_2m,
                fl: d.current.apparent_temperature,
                wind: d.current.wind_speed_10m,
                uv: d.current.uv_index
            };
            this.cache[key] = { ts: Date.now(), data };
            return data;
        } catch(e) {
            if (e.name === 'AbortError') console.warn('⚠️ طلب الطقس استغرق وقتاً طويلاً');
            return null;
        }
    },

    async loadForecast(region = this.currentRegion, days = 7) {
        const key = region + '_fc';
        const cached = this.forecastCache[key];
        if (cached && Date.now() - cached.ts < 10800000) return cached.data;
        const [lat, lon] = region.split(',');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=Africa/Cairo&forecast_days=${days}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            const d = await res.json();
            const daysData = d.daily.time.map((date, i) => ({
                date,
                tempMax: d.daily.temperature_2m_max[i],
                tempMin: d.daily.temperature_2m_min[i],
                precipitation: d.daily.precipitation_sum[i],
                weatherCode: d.daily.weathercode[i],
                description: this.getWeatherDescription(d.daily.weathercode[i])
            }));
            this.forecastCache[key] = { ts: Date.now(), data: daysData };
            return daysData;
        } catch(e) {
            if (e.name === 'AbortError') console.warn('⚠️ طلب التوقعات استغرق وقتاً طويلاً');
            return null;
        }
    },

    getWeatherDescription(code) {
        const map = {
            0: '☀️ صافي', 1: '🌤 غائم جزئي', 2: '⛅ غائم', 3: '☁️ غائم كلياً',
            45: '🌫 ضباب', 48: '🌫 ضباب متجمد',
            51: '🌧 رذاذ خفيف', 53: '🌧 رذاذ', 55: '🌧 رذاذ كثيف',
            61: '🌦 مطر خفيف', 63: '🌦 مطر', 65: '🌧 مطر غزير',
            71: '❄️ ثلج خفيف', 73: '❄️ ثلج', 75: '❄️ ثلج كثيف',
            80: '🌦 زخات مطر', 81: '🌧 زخات متوسطة', 82: '🌧 زخات عنيفة',
            95: '⛈ عاصفة رعدية', 96: '⛈ عاصفة برد', 99: '⛈ عاصفة برد شديدة'
        };
        return map[code] || '❓ غير معروف';
    },

    async getAlerts() {
        const w = await this.load();
        if (!w) return [];
        const activeBatches = await db.batches.where('active').equals(1).toArray();
        if (!activeBatches.length) return [];
        const avgAge = Math.round(activeBatches.reduce((s, b) => s + Utils.dAge(b.date), 0) / activeBatches.length);
        const rec = Utils.idealRec(avgAge);
        const alerts = [];
        if (w.temp > rec.mx) alerts.push(`⚠️ إجهاد حراري: ${w.temp}°C أعلى من المثالي (${rec.mn}–${rec.mx}°C)`);
        else if (w.temp < rec.mn) alerts.push(`❄️ انخفاض حرارة: ${w.temp}°C أقل من المثالي (${rec.mn}–${rec.mx}°C)`);
        if (w.hum > rec.hx) alerts.push(`💧 رطوبة مرتفعة: ${w.hum}% (المثالي ${rec.hn}–${rec.hx}%)`);
        else if (w.hum < rec.hn) alerts.push(`🏜️ رطوبة منخفضة: ${w.hum}% (المثالي ${rec.hn}–${rec.hx}%)`);
        return alerts;
    },

    async renderWidget(elId) {
        const w = await this.load();
        if (!w) return null;
        document.getElementById(elId || 'hdrTemp').textContent = w.temp + '°';
        const ab = await db.batches.where('active').equals(1).toArray();
        const avg = ab.length ? Math.round(ab.reduce((s,b) => s + Utils.dAge(b.date),0) / ab.length) : 21;
        const rec = Utils.idealRec(avg);
        const tOk = w.temp >= rec.mn && w.temp <= rec.mx;
        const hOk = w.hum >= rec.hn && w.hum <= rec.hx;
        return { w, rec, tOk, hOk, avg };
    }
};
