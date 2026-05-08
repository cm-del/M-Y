'use strict';
const Analytics = {
    _cache: new Map(),

    invalidateBatch(batchId) {
        this._cache.delete('predictWeight_' + batchId);
        this._cache.delete('costPerKg_' + batchId);
        this._cache.delete('mortality_' + batchId);
    },
    clearCache() {
        this._cache.clear();
    },

    async predictWeight(batchId) {
        const cacheKey = 'predictWeight_' + batchId;
        if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
        const b = await db.batches.get(batchId);
        if (!b) return null;
        const weights = await db.weights.where('batchId').equals(batchId).toArray();
        if (weights.length < 3) return null;
        const ages = weights.map(w => Utils.dAge(b.date) - Utils.dAge(w.date));
        const vals = weights.map(w => w.weight);
        const n = ages.length;
        const sumX = ages.reduce((a,b)=>a+b,0);
        const sumY = vals.reduce((a,b)=>a+b,0);
        const sumXY = ages.reduce((s,x,i) => s + x*vals[i], 0);
        const sumX2 = ages.reduce((s,x) => s + x*x, 0);
        const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
        const intercept = (sumY - slope*sumX) / n;
        const result = { slope, intercept, predict(age) { return +(intercept + slope*age).toFixed(3); } };
        this._cache.set(cacheKey, result);
        return result;
    },

    async predictBestSellDate(batchId, targetWeight = 2.5) {
        const model = await this.predictWeight(batchId);
        if (!model || model.slope <= 0) return null;
        const b = await db.batches.get(batchId);
        if (!b) return null;
        const currentAge = Utils.dAge(b.date);
        const daysNeeded = Math.max(0, Math.ceil((targetWeight - model.intercept) / model.slope));
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + (daysNeeded - currentAge));
        return { date: targetDate.toISOString().split('T')[0], daysNeeded, model };
    },

    async costPerKg(batchId) {
        const cacheKey = 'costPerKg_' + batchId;
        if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
        const b = await db.batches.get(batchId);
        if (!b) return null;
        const feedKg = (await db.feed.where('batchId').equals(batchId).toArray()).reduce((s,x)=>s+x.qty,0);
        const deaths = (await db.deaths.where('batchId').equals(batchId).toArray()).reduce((s,d)=>s+d.count,0);
        const startCount = b.startCount || b.count;
        const lastFeedPrice = (await db.marketPrices.where('type').equals('علف').reverse().first())?.price || 0;
        const totalFeedCost = feedKg * (lastFeedPrice / 1000);
        const chickCost = startCount * (b.price || 0);
        const expenses = (await db.expenses.where('batchId').equals(batchId).toArray()).reduce((s,e)=>s+e.amount,0);
        const totalCost = chickCost + totalFeedCost + expenses;
        const totalSales = (await db.sales.where('batchId').equals(batchId).toArray()).reduce((s,x)=>s+x.total,0);
        const totalWeightSold = (await db.sales.where('batchId').equals(batchId).toArray()).reduce((s,x)=>s + (x.count * x.weight),0);
        const result = {
            cost: totalCost,
            weightSold: totalWeightSold,
            costPerKg: totalWeightSold ? totalCost / totalWeightSold : 0,
            revenue: totalSales,
            profit: totalSales - totalCost
        };
        this._cache.set(cacheKey, result);
        return result;
    },

    async getMortalityRate(batchId) {
        const cacheKey = 'mortality_' + batchId;
        if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
        const batch = await db.batches.get(batchId);
        if (!batch) return null;
        const startCount = batch.startCount || batch.count;
        if (!startCount || startCount <= 0) return null;
        const totalDeaths = (await db.deaths.where('batchId').equals(batchId).toArray()).reduce((s,d)=>s+d.count,0);
        const result = {
            startCount,
            totalDeaths,
            percentage: +((totalDeaths / startCount) * 100).toFixed(2),
            alive: startCount - totalDeaths
        };
        this._cache.set(cacheKey, result);
        return result;
    },

    // ========== ذكاء اصطناعي ==========
    async getDiseaseRisk(batchId) {
        const b = await db.batches.get(batchId);
        if (!b) return null;
        const mortality = await this.getMortalityRate(batchId);
        const deathHistory = await db.deaths.where('batchId').equals(batchId).toArray();
        let spikeDays = 0, total = 0;
        const byReason = {};
        deathHistory.forEach(d => {
            total += d.count;
            if (d.count >= 5) spikeDays++;
            byReason[d.reason] = (byReason[d.reason] || 0) + d.count;
        });
        const riskScore = ((mortality?.percentage || 0) * 0.4) + (spikeDays * 10) + (total > 50 ? 20 : 0);
        let level = 'منخفض', color = 'var(--teal)';
        if (riskScore > 60) { level = 'مرتفع'; color = 'var(--danger)'; }
        else if (riskScore > 30) { level = 'متوسط'; color = 'var(--gold)'; }
        return {
            riskScore, level, color,
            topReason: Object.entries(byReason).sort((a,b) => b[1]-a[1])[0]?.[0] || 'غير معروف',
            spikeDays,
            recommendation: level === 'مرتفع' ? 'استشر طبيب بيطري فوراً' :
                            level === 'متوسط' ? 'راقب النفوق عن كثب' : 'الوضع مستقر'
        };
    },

    async getRecommendations() {
        const batches = await db.batches.where('active').equals(1).toArray();
        const recs = [];
        for (const b of batches) {
            const risk = await this.getDiseaseRisk(b.id);
            if (risk && risk.level !== 'منخفض') {
                recs.push(`🦠 ${b.name}: خطر ${risk.level} (${risk.topReason})`);
            }
            const prediction = await this.predictBestSellDate(b.id, b.target || 2.5);
            if (prediction && prediction.daysNeeded <= 5) {
                recs.push(`📈 ${b.name}: البيع خلال ${prediction.daysNeeded} يوم`);
            }
        }
        const stock = await db.feedStore.where('txType').equals('out').toArray();
        const stockWarn = stock.length && (stock.reduce((s,x)=>s+x.kg,0) < 500);
        if (stockWarn) recs.push('🌾 المخزن الرئيسي منخفض');
        return recs;
    }
};
