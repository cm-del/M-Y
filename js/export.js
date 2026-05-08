'use strict';
const Export = {
    async toCSV() {
        try {
            const bids = await App.getBatchIds();
            if (!bids || bids.length === 0) { Utils.toast('لا توجد دفعات نشطة', 'warning'); return; }
            const batches = await db.batches.where('id').anyOf(bids).toArray();
            if (batches.length === 0) { Utils.toast('لا توجد دفعات', 'warning'); return; }
            let csv = '\uFEFFالدفعة,طيور,تاريخ,عمر,وزن,علف,نفوق,مبيعات\n';
            for (const b of batches) {
                const lw = (await db.weights.where('batchId').equals(b.id).reverse().sortBy('date'))[0];
                const fKg = (await db.feed.where('batchId').equals(b.id).toArray()).reduce((s,x)=>s+x.qty,0);
                const dc = (await db.deaths.where('batchId').equals(b.id).toArray()).reduce((s,d)=>s+d.count,0);
                const sl = (await db.sales.where('batchId').equals(b.id).toArray()).reduce((s,x)=>s+x.total,0);
                csv += `${b.name},${b.count},${b.date},${Utils.dAge(b.date)},${lw?lw.weight:0},${(fKg/KPB).toFixed(1)},${dc},${Math.round(sl)}\n`;
            }
            const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'ay_farm.csv'; a.click();
            URL.revokeObjectURL(url);
            Utils.toast('تم تصدير CSV', 'success');
        } catch (e) { console.error(e); Utils.toast('فشل التصدير', 'error'); }
    },
    async shareReport() {
        try {
            const bids = await App.getBatchIds();
            if (!bids || !bids.length) { Utils.toast('لا دفعات', 'warning'); return; }
            const batches = await db.batches.where('id').anyOf(bids).toArray();
            let csv = '\uFEFFالدفعة,طيور,تاريخ,عمر,وزن,علف,نفوق,مبيعات\n';
            for (const b of batches) {
                const lw = (await db.weights.where('batchId').equals(b.id).reverse().sortBy('date'))[0];
                const fKg = (await db.feed.where('batchId').equals(b.id).toArray()).reduce((s,x)=>s+x.qty,0);
                const dc = (await db.deaths.where('batchId').equals(b.id).toArray()).reduce((s,d)=>s+d.count,0);
                const sl = (await db.sales.where('batchId').equals(b.id).toArray()).reduce((s,x)=>s+x.total,0);
                csv += `${b.name},${b.count},${b.date},${Utils.dAge(b.date)},${lw?lw.weight:0},${(fKg/KPB).toFixed(1)},${dc},${Math.round(sl)}\n`;
            }
            const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
            const file = new File([blob], 'تقرير_AY.csv', {type:'text/csv'});
            if (navigator.share) {
                await navigator.share({ title: 'تقرير A&Y', files: [file] });
            } else {
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'تقرير_AY.csv'; a.click();
            }
        } catch (e) { if (e.name !== 'AbortError') Utils.toast('فشلت المشاركة', 'error'); }
    },
    async toPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(18);
            doc.text('تقرير A&Y', 105, 20, { align: 'center' });
            const bids = await App.getBatchIds();
            if (!bids?.length) { Utils.toast('لا دفعات', 'warning'); return; }
            const batches = await db.batches.where('id').anyOf(bids).toArray();
            let y = 30;
            doc.setFontSize(12);
            batches.forEach(b => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(`${b.name} - ${Utils.dAge(b.date)} يوم`, 10, y);
                y += 8;
            });
            doc.save('تقرير_AY.pdf');
        } catch (e) { console.error(e); Utils.toast('فشل PDF', 'error'); }
    },
    async batchReport(batchId) {
        try {
            const b = await db.batches.get(batchId);
            if (!b) { Utils.toast('الدفعة غير موجودة', 'error'); return; }
            const costData = await Analytics.costPerKg(batchId);
            const mortality = await Analytics.getMortalityRate(batchId);
            const prediction = await Analytics.predictBestSellDate(batchId, b.target);
            let report = `🐔 ${b.name}\nالعمر: ${Utils.dAge(b.date)} يوم\nالنفوق: ${mortality?.percentage||0}%\n`;
            if(costData) report += `تكلفة/كجم: ${costData.costPerKg.toFixed(2)} ج.م\nالربح: ${costData.profit.toFixed(0)} ج.م\n`;
            if(prediction) report += `بيع متوقع: ${prediction.date}\n`;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([report], {type:'text/plain'}));
            a.download = `تقرير_${b.name}.txt`; a.click();
        } catch (e) { console.error(e); Utils.toast('فشل التقرير', 'error'); }
    },
    async backupJSON() {
        try {
            const all = {
                farms: await db.farms.toArray(), hangars: await db.hangars.toArray(),
                batches: await db.batches.toArray(), weights: await db.weights.toArray(),
                feed: await db.feed.toArray(), deaths: await db.deaths.toArray(),
                sales: await db.sales.toArray(), expenses: await db.expenses.toArray(),
                feedStore: await db.feedStore.toArray(), staff: await db.staff.toArray(),
                tempLogs: await db.tempLogs.toArray(), photos: await db.photos.toArray(),
                marketPrices: await db.marketPrices.toArray(), clients: await db.clients.toArray(),
                clientSales: await db.clientSales.toArray(), agenda: await db.agenda.toArray()
            };
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(all,null,2)], {type:'application/json'}));
            a.download = `backup_${Utils.todayS()}.json`; a.click();
            Utils.toast('تم النسخ الاحتياطي', 'success');
        } catch (e) { Utils.toast('فشل النسخ', 'error'); }
    },
    async restoreJSON(file) {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if(data.farms) await db.farms.bulkPut(data.farms);
                    if(data.hangars) await db.hangars.bulkPut(data.hangars);
                    if(data.batches) await db.batches.bulkPut(data.batches);
                    if(data.weights) await db.weights.bulkPut(data.weights);
                    if(data.feed) await db.feed.bulkPut(data.feed);
                    if(data.deaths) await db.deaths.bulkPut(data.deaths);
                    if(data.sales) await db.sales.bulkPut(data.sales);
                    if(data.expenses) await db.expenses.bulkPut(data.expenses);
                    if(data.feedStore) await db.feedStore.bulkPut(data.feedStore);
                    if(data.staff) await db.staff.bulkPut(data.staff);
                    if(data.tempLogs) await db.tempLogs.bulkPut(data.tempLogs);
                    if(data.photos) await db.photos.bulkPut(data.photos);
                    if(data.marketPrices) await db.marketPrices.bulkPut(data.marketPrices);
                    if(data.clients) await db.clients.bulkPut(data.clients);
                    if(data.clientSales) await db.clientSales.bulkPut(data.clientSales);
                    if(data.agenda) await db.agenda.bulkPut(data.agenda);
                    Utils.toast('تمت الاستعادة', 'success');
                    App.init();
                } catch (e) { Utils.toast('ملف تالف', 'error'); }
            };
            reader.readAsText(file);
        } catch (e) { Utils.toast('فشلت القراءة', 'error'); }
    }
};
