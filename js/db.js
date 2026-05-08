'use strict';
const db = new Dexie('AYFarmDB');
db.version(3).stores({
    farms: 'id',
    hangars: 'id, farmId',
    batches: 'id, hangarId, active',
    weights: 'id, batchId, date',
    feed: 'id, batchId, date',
    deaths: 'id, batchId, date',
    sales: 'id, batchId, date',
    expenses: 'id, batchId, date',
    feedStore: 'id, farmId, date',
    staff: 'id, farmId',
    tempLogs: 'id, hangarId, date',
    photos: 'id',
    equipment: 'id',
    marketPrices: 'id',
    clients: 'id',
    clientSales: 'id, clientId',
    agenda: 'id',
    settings: 'key',
    pendingSync: '++id'
});

db.queueForSync = async function (table, action, data) {
    await db.pendingSync.put({ table, action, data, timestamp: Date.now() });
    if (navigator.onLine) await this.processSyncQueue();
};

db.processSyncQueue = async function () {
    const pending = await db.pendingSync.orderBy('timestamp').toArray();
    if (!pending.length) return;
    for (const item of pending) {
        try {
            if (item.action === 'put') {
                await db.table(item.table).put(item.data);
            } else if (item.action === 'delete') {
                await db.table(item.table).delete(item.data.id);
            }
            await db.pendingSync.delete(item.id);
        } catch (e) {
            console.error('Sync failed:', item.table, e);
        }
    }
};

const Validator = {
    requiredFields: {
        farms: ['id', 'name'],
        hangars: ['id', 'name', 'farmId'],
        batches: ['id', 'name', 'hangarId', 'count', 'startCount', 'date'],
        weights: ['id', 'batchId', 'weight', 'date'],
        feed: ['id', 'batchId', 'bags', 'qty', 'date'],
        deaths: ['id', 'batchId', 'count', 'date'],
        sales: ['id', 'batchId', 'count', 'weight', 'price', 'total', 'date'],
        expenses: ['id', 'amount', 'date'],
        feedStore: ['id', 'farmId', 'bags', 'kg', 'date'],
        staff: ['id', 'farmId', 'name'],
        tempLogs: ['id', 'hangarId', 'temp', 'date'],
        marketPrices: ['id', 'price', 'date'],
        clients: ['id', 'name'],
        clientSales: ['id', 'clientId', 'amount', 'date'],
        agenda: ['id', 'date']
    },
    types: {
        farms: { id: 'string', name: 'string', loc: 'string' },
        hangars: { id: 'string', name: 'string', farmId: 'string', cap: 'number', area: 'number', windows: 'number', fans: 'number', fanCap: 'number' },
        batches: { id: 'string', name: 'string', hangarId: 'string', count: 'number', startCount: 'number', date: 'string', price: 'number', target: 'number', active: 'boolean' },
        weights: { id: 'string', batchId: 'string', weight: 'number', date: 'string', note: 'string' },
        feed: { id: 'string', batchId: 'string', bags: 'number', qty: 'number', date: 'string', type: 'string', cost: 'number' },
        deaths: { id: 'string', batchId: 'string', count: 'number', date: 'string', period: 'string', reason: 'string' },
        sales: { id: 'string', batchId: 'string', count: 'number', weight: 'number', price: 'number', total: 'number', date: 'string' },
        expenses: { id: 'string', batchId: 'string', type: 'string', amount: 'number', date: 'string', note: 'string' },
        feedStore: { id: 'string', farmId: 'string', date: 'string', bags: 'number', kg: 'number', txType: 'string', feedType: 'string', pricePerTon: 'number', note: 'string', batchId: 'string' },
        staff: { id: 'string', farmId: 'string', name: 'string', role: 'string', allowance: 'number', advance: 'number', startDate: 'string' },
        tempLogs: { id: 'string', hangarId: 'string', temp: 'number', hum: 'number', date: 'string', time: 'string', note: 'string' },
        marketPrices: { id: 'string', type: 'string', price: 'number', date: 'string' },
        clients: { id: 'string', name: 'string', phone: 'string' },
        clientSales: { id: 'string', clientId: 'string', amount: 'number', date: 'string', paid: 'boolean' },
        agenda: { id: 'string', type: 'string', date: 'string', note: 'string', done: 'boolean' }
    },
    validate(table, data) {
        const required = this.requiredFields[table];
        if (!required) return true;
        for (const field of required) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                console.error(`❌ Missing ${field} in ${table}`, data);
                if (typeof Utils !== 'undefined') Utils.toast(`بيانات ناقصة: ${field}`, 'error');
                return false;
            }
        }
        const typeMap = this.types[table];
        if (typeMap) {
            for (const [field, expectedType] of Object.entries(typeMap)) {
                if (data[field] === undefined || data[field] === null) continue;
                let actualType = typeof data[field];
                if (actualType === 'object') actualType = 'null';
                if (actualType !== expectedType && !(expectedType === 'number' && actualType === 'string' && !isNaN(Number(data[field])))) {
                    console.error(`❌ Wrong type ${field} in ${table}`, data);
                    if (typeof Utils !== 'undefined') Utils.toast(`نوع بيانات خاطئ: ${field}`, 'error');
                    return false;
                }
                if (expectedType === 'number' && actualType === 'string') data[field] = Number(data[field]);
            }
        }
        if (table === 'batches' && (isNaN(data.count) || data.count <= 0)) { Utils.toast('عدد الطيور موجباً', 'error'); return false; }
        if (table === 'weights' && (isNaN(data.weight) || data.weight <= 0)) { Utils.toast('الوزن موجباً', 'error'); return false; }
        if (table === 'deaths' && (isNaN(data.count) || data.count <= 0)) { Utils.toast('النافق موجباً', 'error'); return false; }
        if (table === 'feed' && (isNaN(data.qty) || data.qty <= 0)) { Utils.toast('العلف موجباً', 'error'); return false; }
        if (table === 'sales' && (isNaN(data.total) || data.total <= 0)) { Utils.toast('الإجمالي موجباً', 'error'); return false; }
        return true;
    }
};

async function initDefaults() {
    if (!(await db.settings.get('weightUnit'))) await db.settings.put({ key: 'weightUnit', value: 'kg' });
    if (!(await db.settings.get('currency'))) await db.settings.put({ key: 'currency', value: 'EGP' });
    if (!(await db.settings.get('firstRun'))) await db.settings.put({ key: 'firstRun', value: 'done' });
    if (!(await db.settings.get('lowStockThreshold'))) await db.settings.put({ key: 'lowStockThreshold', value: '10' });
    await db.processSyncQueue();
}

async function migrateFromLocalStorage() {
    const old = localStorage.getItem('akh_v9');
    if (!old) return;
    const data = JSON.parse(old);
    if (data.farms) await db.farms.bulkPut(data.farms);
    if (data.hangars) await db.hangars.bulkPut(data.hangars);
    if (data.batches) await db.batches.bulkPut(data.batches);
    if (data.weights) await db.weights.bulkPut(data.weights);
    if (data.feed) await db.feed.bulkPut(data.feed);
    if (data.deaths) await db.deaths.bulkPut(data.deaths);
    if (data.sales) await db.sales.bulkPut(data.sales);
    if (data.expenses) await db.expenses.bulkPut(data.expenses);
    if (data.feedStore) await db.feedStore.bulkPut(data.feedStore);
    if (data.staff) await db.staff.bulkPut(data.staff);
    if (data.tempLogs) await db.tempLogs.bulkPut(data.tempLogs);
    if (data.photos) await db.photos.bulkPut(data.photos);
    if (data.marketPrices) await db.marketPrices.bulkPut(data.marketPrices);
    if (data.clients) await db.clients.bulkPut(data.clients);
    if (data.clientSales) await db.clientSales.bulkPut(data.clientSales);
    if (data.agenda) await db.agenda.bulkPut(data.agenda);
    localStorage.removeItem('akh_v9');
      }
