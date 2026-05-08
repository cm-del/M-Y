'use strict';
const Utils = {
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    todayS() { return new Date().toISOString().split('T')[0]; },
    nowT() { return new Date().toTimeString().slice(0,5); },
    fmt(n) { return Number(n || 0).toLocaleString('ar-EG'); },
    fD(d) {
        if(!d) return '';
        try { return new Date(d+'T12:00:00').toLocaleDateString('ar-EG',{day:'numeric',month:'short'}); } catch(e) { return d; }
    },
    dAge(d) { return Math.max(0, Math.floor((Date.now() - new Date(d+'T12:00:00')) / 86400000)); },
    fridays(d) {
        let s = new Date(d+'T12:00:00'), c=0;
        while(s.getDay() !== 5) s.setDate(s.getDate()+1);
        while(s <= new Date()) { c++; s.setDate(s.getDate()+7); }
        return c;
    },
    autoPeriod() { const h = new Date().getHours(); return h<12?'morning':h<18?'afternoon':'night'; },
    periodLabel(p) { return p==='morning'?'🌅 صباح':p==='afternoon'?'☀️ نهار':'🌙 ليل'; },
    idealRec(a) {
        if(a<=7) return {mn:32,mx:35,hn:55,hx:65};
        if(a<=14) return {mn:29,mx:32,hn:55,hx:65};
        if(a<=21) return {mn:26,mx:29,hn:55,hx:70};
        if(a<=28) return {mn:23,mx:26,hn:55,hx:70};
        return {mn:20,mx:24,hn:55,hx:75};
    },
    fmtCurrency(amount) {
        return this.fmt(Math.round(amount)) + ' ج.م';
    },
    toast(msg, type = 'success') {
        const bg = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--gold)' : 'var(--teal)';
        Toastify({
            text: msg,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "center",
            backgroundColor: bg,
            className: "toastify"
        }).showToast();
    },
    async confirm(msg) {
        return new Promise(resolve => {
            if (confirm(msg)) resolve(true);
            else resolve(false);
        });
    }
};
const KPB = 50;
