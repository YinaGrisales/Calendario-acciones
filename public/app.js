/* ============================================================
   Hub Afiliados 2026 — Standalone App (localStorage)
   ============================================================ */

// ── Formatters ──────────────────────────────────────────────
const fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmtNum = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MESES_LARGOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const TRM = 3700;
const COMISION_POR_NP = 43575;

// ── State ───────────────────────────────────────────────────
const today = new Date();
let currentMonth = today.getMonth();
const currentYear = today.getFullYear();
let currentLeverFilter = 'all';
let currentAffiliateFilter = 'all';
let currentTypeFilters = ['all'];
let currentResultPeriod = 'all';
let saveTimeout = null;

let quarterProjections = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
let quarterActualNps = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

let categories = {
    comunidad:    { label: "Comunidad",    members: ["Vivi Garcia", "Orange", "Tati Uribe"] },
    tradicional:  { label: "Tradicional",  members: ["Jairo García", "Camilo Barbosa"] },
    alianza:      { label: "Alianza",      members: ["Dessiré", "Bold"] },
    dropshipping: { label: "Dropshipping", members: [] }
};
let events = [];
let results = [];
let pendingAction = null;

// ── LocalStorage Persistence ────────────────────────────────
const STORAGE_KEY_PLANNING = 'hub2026_planning';
const STORAGE_KEY_RESULTS  = 'hub2026_results';
const STORAGE_KEY_Q_PROJ   = 'hub2026_q_projections';
const STORAGE_KEY_Q_ACTUAL = 'hub2026_q_actual_nps';

function loadFromStorage() {
    try {
        const planRaw = localStorage.getItem(STORAGE_KEY_PLANNING);
        if (planRaw) {
            const planData = JSON.parse(planRaw);
            events = planData.events || [];
            if (planData.categories) {
                Object.keys(categories).forEach(k => {
                    if (planData.categories[k]) categories[k] = planData.categories[k];
                });
            }
        }
        const resRaw = localStorage.getItem(STORAGE_KEY_RESULTS);
        if (resRaw) {
            results = JSON.parse(resRaw) || [];
        }
        const qProjRaw = localStorage.getItem(STORAGE_KEY_Q_PROJ);
        if (qProjRaw) {
            const parsed = JSON.parse(qProjRaw);
            Object.keys(quarterProjections).forEach(k => {
                if (parsed[k] !== undefined) quarterProjections[k] = parsed[k];
            });
        }
        const qActRaw = localStorage.getItem(STORAGE_KEY_Q_ACTUAL);
        if (qActRaw) {
            const parsed = JSON.parse(qActRaw);
            Object.keys(quarterActualNps).forEach(k => {
                if (parsed[k] !== undefined) quarterActualNps[k] = parsed[k];
            });
        }
    } catch (err) {
        showToast('Error al cargar datos locales', 'error');
    }
}

function saveQProjectionsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_Q_PROJ, JSON.stringify(quarterProjections));
    } catch (err) {
        showToast('Error al guardar proyecciones', 'error');
    }
}

function saveQActualToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_Q_ACTUAL, JSON.stringify(quarterActualNps));
    } catch (err) {
        showToast('Error al guardar NPs reales', 'error');
    }
}

function savePlanningToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_PLANNING, JSON.stringify({ events, categories }));
    } catch (err) {
        showToast('Error al guardar planificación', 'error');
    }
}

function saveResultsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));
    } catch (err) {
        showToast('Error al guardar resultados', 'error');
    }
}

function debouncedSaveResults() {
    const ind = document.getElementById('save-indicator');
    if (ind) {
        ind.innerText = "Sincronizando...";
        ind.classList.remove('hidden');
        ind.classList.remove('text-emerald-400');
        ind.classList.add('text-indigo-400');
    }
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveResultsToStorage();
        if (ind) {
            ind.innerText = "✓ Sincronizado";
            ind.classList.replace('text-indigo-400', 'text-emerald-400');
            setTimeout(() => ind.classList.add('hidden'), 2500);
        }
    }, 800);
}

// ── Toast Notifications ─────────────────────────────────────
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
        success: 'bg-emerald-600 text-white',
        error:   'bg-red-600 text-white',
        info:    'bg-indigo-600 text-white',
        warning: 'bg-amber-500 text-white'
    };
    const icons = {
        success: '✓',
        error:   '✕',
        info:    'ℹ',
        warning: '⚠'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${colors[type] || colors.info}`;
    toast.innerHTML = `<span class="text-sm">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Helpers ──────────────────────────────────────────────────
function cacColor(usd) {
    if (usd <= 0) return 'text-slate-400';
    if (usd <= 69) return 'text-emerald-600';
    if (usd <= 81) return 'text-amber-500';
    return 'text-red-600';
}

function unformat(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseInt(String(val).replace(/\D/g, "")) || 0;
}

function format(val) {
    return fmtNum.format(unformat(val));
}

function getAffiliateLever(name) {
    for (const [k, c] of Object.entries(categories)) {
        if (c.members.includes(name)) return k;
    }
    return null;
}

function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getQuarterFromDate(dateStr) {
    if (!dateStr) return null;
    const m = new Date(dateStr.replace(/-/g, '/')).getMonth();
    if (m <= 2) return 'Q1';
    if (m <= 5) return 'Q2';
    if (m <= 8) return 'Q3';
    return 'Q4';
}

function getMonthsForPeriod(period) {
    if (period === 'all') return null;
    if (period === 'Q1') return [0, 1, 2];
    if (period === 'Q2') return [3, 4, 5];
    if (period === 'Q3') return [6, 7, 8];
    if (period === 'Q4') return [9, 10, 11];
    const idx = parseInt(period);
    if (!isNaN(idx)) return [idx];
    return null;
}

function matchesPeriodFilter(dateStr, period) {
    if (period === 'all' || !dateStr) return true;
    const months = getMonthsForPeriod(period);
    if (!months) return true;
    const m = new Date(dateStr.replace(/-/g, '/')).getMonth();
    return months.includes(m);
}

function $(id) { return document.getElementById(id); }

function safeSet(id, val) {
    const el = $(id);
    if (el) el.innerText = val;
}

function safeHTML(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
}

// ── View Switching ──────────────────────────────────────────
function switchView(view) {
    const toggle = (id, hide) => { const el = $(id); if (el) el.classList.toggle('hidden', hide); };
    const activate = (id, active) => { const el = $(id); if (el) el.classList.toggle('active', active); };
    toggle('view-planning', view !== 'planning');
    toggle('view-results', view !== 'results');
    activate('tab-planning', view === 'planning');
    activate('tab-results', view === 'results');
}

// ── Filters ─────────────────────────────────────────────────
function updateFilters() {
    const ls = $('filter-lever');
    if (ls) {
        ls.innerHTML = '<option value="all">Todas las palancas</option>';
        Object.entries(categories).forEach(([k, c]) => {
            ls.innerHTML += `<option value="${k}">${c.label}</option>`;
        });
        ls.value = currentLeverFilter;
    }
    const as = $('filter-affiliate');
    if (as) {
        const val = as.value;
        as.innerHTML = '<option value="all">Todos los afiliados</option>';
        Object.entries(categories).forEach(([k, c]) => {
            if (currentLeverFilter !== 'all' && currentLeverFilter !== k) return;
            const g = document.createElement('optgroup');
            g.label = c.label;
            c.members.forEach(m => {
                const o = document.createElement('option');
                o.value = m;
                o.innerText = m;
                g.appendChild(o);
            });
            as.appendChild(g);
        });
        as.value = val || 'all';
    }
    updateTypeFilterUI();
}

function applyFilter() {
    currentLeverFilter = $('filter-lever').value;
    currentAffiliateFilter = $('filter-affiliate').value;
    updateFilters();
    refreshViews();
}

function toggleLeverFilter(k) {
    currentLeverFilter = currentLeverFilter === k ? 'all' : k;
    const ls = $('filter-lever');
    if (ls) ls.value = currentLeverFilter;
    refreshViews();
}

function toggleTypeFilter(t) {
    if (t === 'all') {
        currentTypeFilters = ['all'];
    } else {
        currentTypeFilters = currentTypeFilters.filter(x => x !== 'all');
        if (currentTypeFilters.includes(t)) {
            currentTypeFilters = currentTypeFilters.filter(x => x !== t);
        } else {
            currentTypeFilters.push(t);
        }
        if (currentTypeFilters.length === 0) currentTypeFilters = ['all'];
    }
    updateTypeFilterUI();
    refreshViews();
}

function updateTypeFilterUI() {
    const types = ['all', 'convocatoria', 'clase', 'contenido', 'cierre'];
    const activeStyles = {
        all:           'bg-indigo-600 text-white border-indigo-600 shadow-sm font-black',
        convocatoria:  'bg-blue-600 text-white border-blue-600 shadow-sm',
        clase:         'bg-green-600 text-white border-green-600 shadow-sm',
        contenido:     'bg-amber-500 text-white border-amber-500 shadow-sm',
        cierre:        'bg-red-600 text-white border-red-600 shadow-sm'
    };
    const inactiveStyles = {
        all:           'bg-white text-slate-400 border-slate-200 opacity-80',
        convocatoria:  'bg-white text-slate-400 border-slate-200 opacity-80',
        clase:         'bg-white text-slate-400 border-slate-200 opacity-80',
        contenido:     'bg-white text-slate-400 border-slate-200 opacity-80',
        cierre:        'bg-white text-slate-400 border-slate-200 opacity-80'
    };
    types.forEach(t => {
        const btn = $(`btn-type-${t}`);
        if (!btn) return;
        const active = currentTypeFilters.includes(t);
        const base = 'filter-chip ';
        btn.className = base + (active ? activeStyles[t] : inactiveStyles[t]);
    });
}

// ── Month Tabs ──────────────────────────────────────────────
function renderTabs() {
    const nav = $('month-tabs');
    if (!nav) return;
    nav.innerHTML = MESES_CORTOS.map((m, i) =>
        `<button onclick="setViewMonth(${i})" class="px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all ${
            currentMonth === i
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-400 hover:text-indigo-600 hover:bg-white'
        }">${m}</button>`
    ).join('');
}

function setViewMonth(i) {
    currentMonth = i;
    renderTabs();
    refreshViews();
}

function changeMonth(step) {
    currentMonth = (currentMonth + step + 12) % 12;
    setViewMonth(currentMonth);
}

// ── Calendar Rendering ──────────────────────────────────────
function renderCalendar() {
    const body = $('calendar-body');
    const title = $('calendar-title');
    if (!body) return;

    title.innerText = `${MESES_LARGOS[currentMonth]} ${currentYear}`;

    const first = new Date(currentYear, currentMonth, 1);
    const last  = new Date(currentYear, currentMonth + 1, 0);
    let gap = (first.getDay() + 6) % 7;
    let html = '';

    for (let i = 0; i < gap; i++) {
        if (i === 0) html += '<div class="week-num">-</div>';
        html += '<div class="day-cell bg-slate-50/40"></div>';
    }

    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    for (let d = 1; d <= last.getDate(); d++) {
        const ds = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        if ((gap + d - 1) % 7 === 0) {
            html += `<div class="week-num">${getISOWeek(new Date(currentYear, currentMonth, d))}</div>`;
        }

        const dEvs = events.filter(e =>
            ds >= e.date && ds <= (e.endDate || e.date) &&
            (currentAffiliateFilter === 'all' || e.affiliate === currentAffiliateFilter) &&
            (currentLeverFilter === 'all' || getAffiliateLever(e.affiliate) === currentLeverFilter) &&
            (currentTypeFilters.includes('all') || currentTypeFilters.includes(e.type))
        );

        const icons = { clase: '🎓', contenido: '📒', cierre: '🚨', convocatoria: '🗓️' };
        const evsHtml = dEvs.map(e => {
            const projLabel = e.projectedNps ? ` [${e.projectedNps}]` : '';
            return `<div class="event-badge type-${e.type}" onclick="event.stopPropagation(); manageAction('${e.id}')">${icons[e.type] || '🗓️'} ${e.affiliate}${projLabel}</div>`;
        }).join('');

        const isToday = ds === todayStr;
        const dow = new Date(currentYear, currentMonth, d).getDay();
        const isWeekend = dow === 0 || dow === 6;

        html += `<div class="day-cell relative cursor-pointer ${isToday ? 'ring-2 ring-indigo-400 ring-inset' : ''}" onclick="openAddModal('${ds}')">
            <span class="text-[8px] font-black ${isToday ? 'bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center' : isWeekend ? 'text-red-400' : 'text-slate-300'}">${d}</span>
            <div class="mt-0.5">${evsHtml}</div>
        </div>`;
    }

    body.innerHTML = html;
}

// ── Stats ───────────────────────────────────────────────────
function updateStats() {
    const pre = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
    const gFil = events.filter(e =>
        (currentAffiliateFilter === 'all' || e.affiliate === currentAffiliateFilter) &&
        (currentLeverFilter === 'all' || getAffiliateLever(e.affiliate) === currentLeverFilter) &&
        (currentTypeFilters.includes('all') || currentTypeFilters.includes(e.type))
    );
    const mEvs = gFil.filter(e =>
        (e.date && e.date.startsWith(pre)) ||
        (e.endDate && e.endDate.startsWith(pre))
    );

    safeSet('stat-clases', mEvs.filter(e => e.type === 'clase').length);
    safeSet('stat-contenido', mEvs.filter(e => e.type === 'contenido').length);

    const qs = [
        {id:'Q1', m:[0,1,2], cl:0, ct:0},
        {id:'Q2', m:[3,4,5], cl:0, ct:0},
        {id:'Q3', m:[6,7,8], cl:0, ct:0},
        {id:'Q4', m:[9,10,11], cl:0, ct:0}
    ];
    gFil.forEach(e => {
        const m = new Date(e.date.replace(/-/g,'/')).getMonth();
        const q = qs.find(q => q.m.includes(m));
        if (q) {
            if (e.type === 'clase') q.cl++;
            if (e.type === 'contenido') q.ct++;
        }
    });

    safeHTML('stats-quarters', qs.map(q =>
        `<div class="flex flex-col items-center py-2 px-1 rounded-lg hover:bg-indigo-50 transition-colors">
            <p class="text-xs font-black text-indigo-500 uppercase tracking-wide">${q.id}</p>
            <span class="text-xl font-black text-slate-800 mt-1">${q.cl}<span class="text-slate-300 font-medium mx-0.5">/</span>${q.ct}</span>
            <span class="text-[10px] text-slate-400 font-medium mt-0.5">clases / contenido</span>
        </div>`
    ).join(''));

    const lCt = {};
    Object.keys(categories).forEach(k => lCt[k] = new Set());
    mEvs.forEach(e => { const l = getAffiliateLever(e.affiliate); if (l) lCt[l].add(e.affiliate); });

    const calLeverColors = { comunidad: '#6366f1', tradicional: '#f59e0b', alianza: '#10b981', dropshipping: '#f43f5e' };
    safeHTML('stats-levers', Object.entries(categories).map(([k, c]) => {
        const dim = currentLeverFilter !== 'all' && currentLeverFilter !== k ? 'opacity-20 grayscale' : '';
        const clr = c.color || calLeverColors[k] || '#6366f1';
        return `<div class="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 ${dim}">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${clr}"></div>
            <span class="text-xs font-bold text-slate-700 truncate">${c.label}</span>
            <span class="text-lg font-black text-indigo-600 ml-auto">${lCt[k].size}</span>
        </div>`;
    }).join(''));
}

function renderPeriodFilter() {
    const container = $('result-period-container');
    if (!container) return;

    const periods = [
        { id: 'all', label: 'Todo' },
        { id: 'Q1', label: 'Q1' }, { id: 'Q2', label: 'Q2' },
        { id: 'Q3', label: 'Q3' }, { id: 'Q4', label: 'Q4' },
    ];
    const months = MESES_CORTOS.map((m, i) => ({ id: String(i), label: m }));

    const all = [...periods, ...months];
    container.innerHTML = all.map(p => {
        const isActive = currentResultPeriod === p.id;
        const isQ = p.id.startsWith('Q');
        const activeClass = isQ
            ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
            : p.id === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-black'
                : 'bg-slate-700 text-white border-slate-700 shadow-sm';
        const inactiveClass = isQ
            ? 'bg-violet-50 text-violet-600 border-violet-100'
            : 'bg-white text-slate-400 border-slate-200 opacity-80';
        return `<button onclick="setResultPeriod('${p.id}')" class="filter-chip ${isActive ? activeClass : inactiveClass}">${p.label}</button>`;
    }).join('');
}

function setResultPeriod(period) {
    currentResultPeriod = period;
    renderPeriodFilter();
    renderResultsTable();
    updateResultStats();
}

function handleQProjectionInput(q, el) {
    const val = parseInt(el.value) || 0;
    quarterProjections[q] = val;
    saveQProjectionsToStorage();
    updateQDelta(q);
    updateTopStats();
}

function handleQActualInput(q, el) {
    const val = parseInt(el.value) || 0;
    quarterActualNps[q] = val;
    saveQActualToStorage();
    updateQDelta(q);
    updateTopStats();
}

function updateQDelta(q) {
    const faltanRealEl = document.querySelector(`[data-q-faltan-real="${q}"]`);
    const faltanProyEl = document.querySelector(`[data-q-faltan-proy="${q}"]`);
    if (!faltanRealEl) return;

    const tableau = quarterActualNps[q] || 0;
    const meta = quarterProjections[q] || 0;

    const qMonths = { Q1: [0,1,2], Q2: [3,4,5], Q3: [6,7,8], Q4: [9,10,11] };
    let projQ = 0;
    results.forEach(r => {
        if (r.date && !r.confirmed) {
            const m = new Date(r.date.replace(/-/g,'/')).getMonth();
            if (qMonths[q].includes(m)) projQ += (r.projectedNps || 0);
        }
    });

    const deltaTvM = tableau - meta;
    faltanRealEl.className = `text-xs font-bold ${deltaTvM < 0 ? 'text-red-500' : 'text-emerald-500'}`;
    faltanRealEl.innerText = 'Tableau vs Meta: ' + (deltaTvM < 0 ? 'Faltan: ' + Math.abs(deltaTvM) : 'Cumplida');

    if (faltanProyEl) {
        const deltaTPvM = (tableau + projQ) - meta;
        const cls = deltaTPvM < 0 ? 'text-amber-500' : 'text-emerald-500';
        faltanProyEl.className = `text-xs font-bold ${cls}`;
        faltanProyEl.innerText = 'Tab+Proy vs Meta: ' + (deltaTPvM < 0 ? 'Faltan: ' + Math.abs(deltaTPvM) : 'Cumplida');
    }
}

function updateTopStats() {
    const fil = results.filter(r =>
        (currentAffiliateFilter === 'all' || r.name === currentAffiliateFilter) &&
        (currentLeverFilter === 'all' || getAffiliateLever(r.name) === currentLeverFilter)
    );
    const periodFil = fil.filter(r => matchesPeriodFilter(r.date, currentResultPeriod));
    const pNps = periodFil.reduce((acc, r) => acc + (r.nps || 0), 0);
    const isQFilter = ['Q1','Q2','Q3','Q4'].includes(currentResultPeriod);

    let displayNps = pNps;
    if (isQFilter) {
        displayNps = quarterActualNps[currentResultPeriod] || 0;
    } else if (currentResultPeriod === 'all') {
        displayNps = (quarterActualNps.Q1 || 0) + (quarterActualNps.Q2 || 0) + (quarterActualNps.Q3 || 0) + (quarterActualNps.Q4 || 0);
    }

    const projSum = periodFil.reduce((acc, r) => {
        return acc + (r.confirmed ? 0 : (r.projectedNps || 0));
    }, 0);

    safeSet('res-stat-nps', displayNps);
    safeSet('res-stat-nps-acciones', pNps);
    safeSet('res-stat-proj', projSum);
    safeSet('res-stat-tab-plus-proj', displayNps + projSum);
    safeSet('res-stat-combo-detail', `${displayNps} + ${projSum}`);

    const confirmedFil = periodFil.filter(r => r.confirmed);
    const cacInv = confirmedFil.reduce((acc, r) => {
        const rowComis = r.hasCommission !== false ? COMISION_POR_NP * (r.nps || 0) : 0;
        return acc + (r.fixed || 0) + (r.variable || 0) + rowComis + (r.pauta || 0);
    }, 0);
    const cacNps = confirmedFil.reduce((acc, r) => acc + (r.nps || 0), 0);
    const topCacAcc = cacNps > 0 ? cacInv / cacNps / TRM : 0;
    const topCacGen = displayNps > 0 ? cacInv / displayNps / TRM : 0;
    const elCacAcc = $('res-cac-acciones');
    const elCacGen = $('res-cac-general');
    if (elCacAcc) { elCacAcc.innerText = fmtUSD.format(topCacAcc); elCacAcc.className = `text-2xl font-black mt-0.5 ${cacColor(topCacAcc)}`; }
    if (elCacGen) { elCacGen.innerText = fmtUSD.format(topCacGen); elCacGen.className = `text-2xl font-black mt-0.5 ${cacColor(topCacGen)}`; }
}

function getFilteredResults() {
    return results.filter(r =>
        (currentAffiliateFilter === 'all' || r.name === currentAffiliateFilter) &&
        (currentLeverFilter === 'all' || getAffiliateLever(r.name) === currentLeverFilter) &&
        matchesPeriodFilter(r.date, currentResultPeriod)
    );
}

function updateResultStats() {
    const fil = results.filter(r =>
        (currentAffiliateFilter === 'all' || r.name === currentAffiliateFilter) &&
        (currentLeverFilter === 'all' || getAffiliateLever(r.name) === currentLeverFilter)
    );
    const periodFil = fil.filter(r => matchesPeriodFilter(r.date, currentResultPeriod));

    const pNpsFromTable = periodFil.reduce((acc, r) => acc + (r.nps || 0), 0);
    const projSum = periodFil.reduce((acc, r) => {
        return acc + (r.confirmed ? 0 : (r.projectedNps || 0));
    }, 0);
    const pInv = periodFil.reduce((acc, r) => {
        const rowComis = r.hasCommission !== false ? COMISION_POR_NP * (r.nps || 0) : 0;
        return acc + (r.fixed || 0) + (r.variable || 0) + rowComis + (r.pauta || 0);
    }, 0);

    const isQFilter = ['Q1','Q2','Q3','Q4'].includes(currentResultPeriod);
    let displayNps = pNpsFromTable;
    if (isQFilter) {
        displayNps = quarterActualNps[currentResultPeriod] || 0;
    } else if (currentResultPeriod === 'all') {
        displayNps = (quarterActualNps.Q1 || 0) + (quarterActualNps.Q2 || 0) + (quarterActualNps.Q3 || 0) + (quarterActualNps.Q4 || 0);
    }

    const labelEl = $('res-stat-nps-label');
    const comboLabelEl = $('res-stat-combo-label');
    if (labelEl) {
        if (currentResultPeriod === 'all') labelEl.innerText = 'NPs Tableau Total';
        else if (isQFilter) labelEl.innerText = `NPs Tableau ${currentResultPeriod}`;
        else labelEl.innerText = `NPs Tableau ${MESES_CORTOS[parseInt(currentResultPeriod)]}`;
    }
    if (comboLabelEl) {
        if (currentResultPeriod === 'all') comboLabelEl.innerText = 'Tableau + Proy Total';
        else if (isQFilter) comboLabelEl.innerText = `Tableau + Proy ${currentResultPeriod}`;
        else comboLabelEl.innerText = `Tableau + Proy ${MESES_CORTOS[parseInt(currentResultPeriod)]}`;
    }

    safeSet('res-stat-nps', displayNps);
    safeSet('res-stat-nps-acciones', pNpsFromTable);
    safeSet('res-stat-proj', projSum);
    safeSet('res-stat-tab-plus-proj', displayNps + projSum);
    safeSet('res-stat-combo-detail', `${displayNps} + ${projSum}`);
    safeSet('res-stat-inv', fmtCOP.format(pInv));

    const confirmedPeriodFil = periodFil.filter(r => r.confirmed);
    const cacInv = confirmedPeriodFil.reduce((acc, r) => {
        const rowComis = r.hasCommission !== false ? COMISION_POR_NP * (r.nps || 0) : 0;
        return acc + (r.fixed || 0) + (r.variable || 0) + rowComis + (r.pauta || 0);
    }, 0);
    const cacNpsAcc = confirmedPeriodFil.reduce((acc, r) => acc + (r.nps || 0), 0);
    const cacAcciones = cacNpsAcc > 0 ? cacInv / cacNpsAcc / TRM : 0;
    const cacGeneral = displayNps > 0 ? cacInv / displayNps / TRM : 0;
    const elCacAcc2 = $('res-cac-acciones');
    const elCacGen2 = $('res-cac-general');
    if (elCacAcc2) { elCacAcc2.innerText = fmtUSD.format(cacAcciones); elCacAcc2.className = `text-2xl font-black mt-0.5 ${cacColor(cacAcciones)}`; }
    if (elCacGen2) { elCacGen2.innerText = fmtUSD.format(cacGeneral); elCacGen2.className = `text-2xl font-black mt-0.5 ${cacColor(cacGeneral)}`; }

    const cacAccLabel = $('res-cac-acc-label');
    const cacGenLabel = $('res-cac-gen-label');
    if (cacAccLabel) {
        if (currentResultPeriod === 'all') cacAccLabel.innerText = 'CAC USD Acciones Total';
        else if (isQFilter) cacAccLabel.innerText = `CAC USD Acciones ${currentResultPeriod}`;
        else cacAccLabel.innerText = `CAC USD Acciones ${MESES_CORTOS[parseInt(currentResultPeriod)]}`;
    }
    if (cacGenLabel) {
        if (currentResultPeriod === 'all') cacGenLabel.innerText = 'CAC USD General Total';
        else if (isQFilter) cacGenLabel.innerText = `CAC USD General ${currentResultPeriod}`;
        else cacGenLabel.innerText = `CAC USD General ${MESES_CORTOS[parseInt(currentResultPeriod)]}`;
    }

    const qs = [
        {id:'Q1', m:[0,1,2], n:0},
        {id:'Q2', m:[3,4,5], n:0},
        {id:'Q3', m:[6,7,8], n:0},
        {id:'Q4', m:[9,10,11], n:0}
    ];
    fil.forEach(r => {
        if (r.date) {
            const m = new Date(r.date.replace(/-/g,'/')).getMonth();
            const q = qs.find(q => q.m.includes(m));
            if (q) q.n += (r.nps || 0);
        }
    });

    const qProj = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const qCacInv = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const qCacNps = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    fil.forEach(r => {
        if (r.date) {
            const m = new Date(r.date.replace(/-/g,'/')).getMonth();
            const qId = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
            if (!r.confirmed) qProj[qId] += (r.projectedNps || 0);
            if (r.confirmed) {
                const rowComis = r.hasCommission !== false ? COMISION_POR_NP * (r.nps || 0) : 0;
                qCacInv[qId] += (r.fixed || 0) + (r.variable || 0) + rowComis + (r.pauta || 0);
                qCacNps[qId] += (r.nps || 0);
            }
        }
    });

    safeHTML('res-stats-quarters', qs.map(q => {
        const tableau = quarterActualNps[q.id] || 0;
        const meta = quarterProjections[q.id] || 0;
        const projQ = qProj[q.id] || 0;
        const invQ = qCacInv[q.id] || 0;
        const npsAccQ = qCacNps[q.id] || 0;

        const deltaTvM = tableau - meta;
        const deltaTvMcls = deltaTvM < 0 ? 'text-red-500' : 'text-emerald-500';
        const deltaTvMtxt = deltaTvM < 0 ? 'Faltan: ' + Math.abs(deltaTvM) : 'Cumplida';

        const tabPlusProy = tableau + projQ;
        const deltaTPvM = tabPlusProy - meta;
        const deltaTPcls = deltaTPvM < 0 ? 'text-amber-500' : 'text-emerald-500';
        const deltaTPtxt = deltaTPvM < 0 ? 'Faltan: ' + Math.abs(deltaTPvM) : 'Cumplida';

        const cacAccQ = npsAccQ > 0 ? invQ / npsAccQ / TRM : 0;
        const cacGenQ = tableau > 0 ? invQ / tableau / TRM : 0;

        const isActive = currentResultPeriod === q.id;
        const ringCls = isActive ? 'ring-2 ring-violet-400 ring-inset' : '';
        return `<div class="flex flex-col items-center cursor-pointer hover:bg-violet-50 rounded-xl p-3 transition-colors ${ringCls} border border-slate-100" onclick="setResultPeriod('${q.id}')">
            <p class="text-sm font-black text-indigo-500 uppercase tracking-wide">${q.id}</p>
            <div class="flex items-center gap-1.5 mt-2">
                <span class="text-xs text-emerald-500 font-bold">Tableau:</span>
                <input type="text" value="${tableau}" onclick="event.stopPropagation()"
                    onchange="handleQActualInput('${q.id}', this)"
                    class="w-16 text-center text-sm font-bold rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 focus:border-emerald-500 focus:outline-none px-2 py-1">
            </div>
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="text-xs text-violet-500 font-bold">Meta:</span>
                <input type="text" value="${meta}" onclick="event.stopPropagation()"
                    onchange="handleQProjectionInput('${q.id}', this)"
                    class="w-16 text-center text-sm font-bold rounded-lg border border-violet-300 text-violet-700 bg-violet-50 focus:border-violet-500 focus:outline-none px-2 py-1">
            </div>
            <div class="w-full border-t border-slate-100 mt-1.5 pt-1.5 flex flex-col items-center gap-1">
                <span class="text-xs font-bold ${deltaTvMcls}" data-q-faltan-real="${q.id}">Tableau vs Meta: ${deltaTvMtxt}</span>
                <span class="text-xs font-bold ${deltaTPcls}" data-q-faltan-proy="${q.id}">Tab+Proy vs Meta: ${deltaTPtxt}</span>
            </div>
            <div class="w-full border-t border-slate-100 mt-1.5 pt-1.5 flex flex-col items-center gap-0.5">
                <span class="text-[8px] font-bold ${cacColor(cacAccQ)}">CAC Acc: ${fmtUSD.format(cacAccQ)}</span>
                <span class="text-[8px] font-bold ${cacColor(cacGenQ)}">CAC Gen: ${fmtUSD.format(cacGenQ)}</span>
            </div>
        </div>`;
    }).join(''));

    const lNps = {};
    Object.keys(categories).forEach(k => lNps[k] = 0);
    periodFil.forEach(r => { const l = getAffiliateLever(r.name); if (l) lNps[l] += (r.nps || 0); });

    const leverColors = { comunidad: '#6366f1', tradicional: '#f59e0b', alianza: '#10b981', dropshipping: '#f43f5e' };
    safeHTML('res-stats-levers', Object.entries(categories).map(([k, c]) => {
        const dim = currentLeverFilter !== 'all' && currentLeverFilter !== k ? 'opacity-30 grayscale' : '';
        const active = currentLeverFilter === k ? 'ring-2 ring-indigo-400' : '';
        const count = periodFil.filter(r => getAffiliateLever(r.name) === k).length;
        const clr = c.color || leverColors[k] || '#6366f1';
        return `<div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-all ${dim} ${active}" onclick="toggleLeverFilter('${k}')">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${clr}"></div>
            <div class="flex flex-col min-w-0 flex-1">
                <span class="text-xs font-bold text-slate-700 uppercase tracking-wide truncate">${c.label}</span>
                <span class="text-[10px] text-slate-400">${count} acciones</span>
            </div>
            <span class="text-lg font-black text-indigo-600">${lNps[k]}<span class="text-[9px] text-slate-400 font-medium ml-0.5">NPs</span></span>
        </div>`;
    }).join(''));
}

// ── Results Table ───────────────────────────────────────────
function handleNumberInput(el, id, field) {
    const rawValue = unformat(el.value);
    el.value = format(rawValue);
    const row = results.find(r => r.id === id);
    if (row) {
        row[field] = rawValue;
        updateCalculatedCells(id);
        updateResultStats();
        debouncedSaveResults();
    }
}

function renderDelta(actual, projected) {
    const nps = actual || 0;
    const proj = projected || 0;
    if (proj === 0 && nps === 0) return '<span class="delta-zero">—</span>';
    const delta = nps - proj;
    const sign = delta > 0 ? '+' : '';
    const cls = delta > 0 ? 'delta-positive' : delta < 0 ? 'delta-negative' : 'delta-zero';
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '';
    return `<span class="${cls}">${arrow} ${sign}${delta}</span>`;
}

function updateCalculatedCells(id) {
    const row = results.find(r => r.id === id);
    if (!row) return;
    const comis = row.hasCommission !== false ? COMISION_POR_NP * (row.nps || 0) : 0;
    const total = (row.fixed || 0) + (row.variable || 0) + comis + (row.pauta || 0);
    const cac = row.nps > 0 ? Math.round(total / row.nps) : 0;

    const rowEl = document.querySelector(`[data-row-id="${id}"]`);
    if (!rowEl) return;

    const s = (cls, txt) => { const e = rowEl.querySelector(cls); if (e) e.innerText = txt; };
    const h = (cls, html) => { const e = rowEl.querySelector(cls); if (e) e.innerHTML = html; };
    s('.cvr-ast-wa', row.wa_group > 0 ? (row.attendees / row.wa_group * 100).toFixed(1) + '%' : '0%');
    s('.cvr-wa-tr', row.wa_group > 0 ? (row.trials / row.wa_group * 100).toFixed(1) + '%' : '0%');
    s('.cvr-np-tr', row.trials > 0 ? (row.nps / row.trials * 100).toFixed(1) + '%' : '0%');
    h('.cell-delta', renderDelta(row.nps, row.projectedNps));
    s('.cell-comis', fmtCOP.format(comis));
    s('.cell-total', fmtCOP.format(total));
    s('.cell-cac-cop', fmtCOP.format(cac));
    const cacUsdEl = rowEl.querySelector('.cell-cac-usd');
    if (cacUsdEl) {
        const cacUsdVal = cac / TRM;
        cacUsdEl.innerText = fmtUSD.format(cacUsdVal);
        cacUsdEl.className = `formula-col text-[7px] cell-cac-usd font-bold ${cacColor(cacUsdVal)}`;
    }
}

function renderResultsTable() {
    const body = $('results-table-body');
    if (!body) return;

    const filteredRows = results.filter(row =>
        (currentAffiliateFilter === 'all' || row.name === currentAffiliateFilter) &&
        (currentLeverFilter === 'all' || getAffiliateLever(row.name) === currentLeverFilter) &&
        matchesPeriodFilter(row.date, currentResultPeriod)
    ).sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
    });

    body.innerHTML = filteredRows.map(row => {
        const comis = row.hasCommission !== false ? COMISION_POR_NP * (row.nps || 0) : 0;
        const total = (row.fixed || 0) + (row.variable || 0) + comis + (row.pauta || 0);
        const cac = row.nps > 0 ? Math.round(total / row.nps) : 0;

        return `<tr data-row-id="${row.id}" class="group">
            <td class="pl-2 py-1.5 text-left">
                <input type="text" value="${escapeHTML(row.name)}" onchange="updateResultValue(${row.id}, 'name', this.value)"
                    class="mb-0.5 font-bold text-slate-700 border-none bg-transparent p-0 w-full focus:ring-0 uppercase text-[0.68rem]"
                    placeholder="Nombre...">
                <div class="flex items-center gap-1">
                    <input type="date" value="${row.date}" onchange="updateResultValue(${row.id}, 'date', this.value)"
                        class="text-[7.5px] text-slate-300 font-semibold border-none bg-transparent p-0 w-auto">
                    <span class="text-[6.5px] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-300 font-bold italic">${escapeHTML(row.type || 'Clase')}</span>
                </div>
            </td>
            <td><input type="text" value="${format(row.wa_group)}" oninput="handleNumberInput(this, ${row.id}, 'wa_group')" class="w-10 text-center"></td>
            <td><input type="text" value="${format(row.attendees)}" oninput="handleNumberInput(this, ${row.id}, 'attendees')" class="w-10 text-center"></td>
            <td class="formula-col opacity-60 text-[7px] cvr-ast-wa">${row.wa_group > 0 ? (row.attendees/row.wa_group*100).toFixed(1)+'%' : '0%'}</td>
            <td><input type="text" value="${format(row.trials)}" oninput="handleNumberInput(this, ${row.id}, 'trials')" class="w-10 text-center"></td>
            <td class="formula-col opacity-60 text-[7px] cvr-wa-tr">${row.wa_group > 0 ? (row.trials/row.wa_group*100).toFixed(1)+'%' : '0%'}</td>
            <td><input type="text" value="${format(row.nps)}" oninput="handleNumberInput(this, ${row.id}, 'nps')" class="w-10 text-indigo-600 font-bold text-center"></td>
            <td class="formula-col text-[7px]"><input type="text" value="${format(row.projectedNps)}" oninput="handleNumberInput(this, ${row.id}, 'projectedNps')" class="w-10 text-center text-violet-600 font-bold"></td>
            <td class="text-[7px] text-center cell-delta">${renderDelta(row.nps, row.projectedNps)}</td>
            <td class="text-center"><input type="checkbox" ${row.confirmed ? 'checked' : ''} onchange="toggleConfirmed(${row.id}, this.checked)" class="w-3.5 h-3.5 accent-emerald-500 cursor-pointer" title="Marcar = usar NPs real en proyección"></td>
            <td class="formula-col opacity-60 text-[7px] cvr-np-tr">${row.trials > 0 ? (row.nps/row.trials*100).toFixed(1)+'%' : '0%'}</td>
            <td><div class="currency-input-wrapper"><span class="currency-symbol">$</span><input type="text" value="${format(row.fixed)}" oninput="handleNumberInput(this, ${row.id}, 'fixed')" class="w-14 input-money"></div></td>
            <td><div class="currency-input-wrapper"><span class="currency-symbol">$</span><input type="text" value="${format(row.variable)}" oninput="handleNumberInput(this, ${row.id}, 'variable')" class="w-14 input-money"></div></td>
            <td class="text-[7px]">
                <div class="flex flex-col items-center gap-0.5">
                    <select onchange="toggleCommission(${row.id}, this.value)" class="text-[7px] font-bold border-none bg-transparent p-0 text-center cursor-pointer outline-none ${row.hasCommission !== false ? 'text-emerald-600' : 'text-slate-300'}">
                        <option value="yes" ${row.hasCommission !== false ? 'selected' : ''}>Con comis.</option>
                        <option value="no" ${row.hasCommission === false ? 'selected' : ''}>Sin comis.</option>
                    </select>
                    <span class="cell-comis font-bold ${row.hasCommission !== false ? 'money-col' : 'text-slate-300 line-through'}">${fmtCOP.format(comis)}</span>
                </div>
            </td>
            <td><div class="currency-input-wrapper"><span class="currency-symbol">$</span><input type="text" value="${format(row.pauta)}" oninput="handleNumberInput(this, ${row.id}, 'pauta')" class="w-14 input-money"></div></td>
            <td class="total-col text-[7px] cell-total">${fmtCOP.format(total)}</td>
            <td class="formula-col text-[7px] cell-cac-cop">${fmtCOP.format(cac)}</td>
            <td class="formula-col text-[7px] cell-cac-usd font-bold ${cacColor(cac / TRM)}">${fmtUSD.format(cac / TRM)}</td>
            <td class="cursor-pointer" onclick="openNoteModal(${row.id})">
                <div class="w-24 text-[9px] text-slate-400 italic truncate hover:text-indigo-500 transition-colors" title="${escapeHTML(row.notes || '')}">${row.notes ? escapeHTML(row.notes).substring(0, 20) + (row.notes.length > 20 ? '...' : '') : '<span class=&quot;text-slate-200&quot;>+ nota</span>'}</div>
            </td>
            <td>
                <button onclick="deleteResultRow(${row.id})" class="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-sm font-bold">×</button>
            </td>
        </tr>`;
    }).join('');
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function addResultRow() {
    results.push({
        id: Date.now(),
        name: '',
        date: '',
        type: 'Clase',
        wa_group: 0, attendees: 0, trials: 0, nps: 0,
        fixed: 0, variable: 0, pauta: 0,
        projectedNps: 0,
        confirmed: false,
        hasCommission: true,
        notes: ''
    });
    renderResultsTable();
    updateResultStats();
    debouncedSaveResults();
    showToast('Fila manual agregada al final', 'info');
}

function toggleConfirmed(id, checked) {
    const r = results.find(row => row.id === id);
    if (r) {
        r.confirmed = checked;
        updateResultStats();
        debouncedSaveResults();
    }
}

function toggleCommission(id, val) {
    const r = results.find(row => row.id === id);
    if (r) {
        r.hasCommission = val === 'yes';
        updateCalculatedCells(id);
        renderResultsTable();
        updateResultStats();
        debouncedSaveResults();
    }
}

function deleteResultRow(id) {
    results = results.filter(r => r.id !== id);
    renderResultsTable();
    updateResultStats();
    debouncedSaveResults();
}

function updateResultValue(id, field, val) {
    const r = results.find(row => row.id === id);
    if (!r) return;
    if (field === 'name' || field === 'date' || field === 'type') {
        r[field] = val;
        renderResultsTable();
    } else if (field === 'notes') {
        r[field] = val;
    } else {
        r[field] = unformat(val);
        updateCalculatedCells(id);
    }
    updateResultStats();
    debouncedSaveResults();
}

// ── Notes Modal ─────────────────────────────────────────────
let pendingNoteRowId = null;

function openNoteModal(id) {
    pendingNoteRowId = id;
    const row = results.find(r => r.id === id);
    if (!row) return;
    const title = $('modal-notes-title');
    if (title) title.innerText = row.name ? `Notas — ${row.name}` : 'Notas';
    const ta = $('modal-notes-textarea');
    if (ta) ta.value = row.notes || '';
    openModal('modal-notes');
    setTimeout(() => { if (ta) ta.focus(); }, 100);
}

function saveNoteFromModal() {
    if (pendingNoteRowId === null) return;
    const ta = $('modal-notes-textarea');
    const val = ta ? ta.value : '';
    const row = results.find(r => r.id === pendingNoteRowId);
    if (row) {
        row.notes = val;
        debouncedSaveResults();
        renderResultsTable();
    }
    closeModal('modal-notes');
    pendingNoteRowId = null;
}

// ── Event CRUD ──────────────────────────────────────────────
function openAddModal(d) {
    pendingAction = null;
    const sel = $('select-affiliate');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecciona miembro...</option>';
    Object.entries(categories).forEach(([k, c]) => {
        const g = document.createElement('optgroup');
        g.label = c.label;
        c.members.forEach(m => {
            const o = document.createElement('option');
            o.value = m;
            o.innerText = m;
            g.appendChild(o);
        });
        sel.appendChild(g);
    });
    $('input-start-date').value = d;
    $('input-end-date').value = d;
    $('input-projected-nps').value = '';
    $('modal-event-title').innerText = 'Nueva acción';
    toggleEndDateField();
    openModal('modal-event');
}

function manageAction(id) {
    pendingAction = events.find(e => String(e.id) === String(id));
    if (!pendingAction) return;
    const ct = $('choice-title');
    if (ct) ct.innerText = pendingAction.affiliate;
    openModal('modal-action-choice');
}

function openEditEvent() {
    closeModal('modal-action-choice');
    const t = pendingAction;
    if (!t) return;

    const sel = $('select-affiliate');
    sel.innerHTML = '<option value="">Selecciona miembro...</option>';
    Object.entries(categories).forEach(([k, c]) => {
        const g = document.createElement('optgroup');
        g.label = c.label;
        c.members.forEach(m => {
            const o = document.createElement('option');
            o.value = m;
            o.innerText = m;
            g.appendChild(o);
        });
        sel.appendChild(g);
    });

    sel.value = t.affiliate;
    $('select-type').value = t.type;
    $('input-start-date').value = t.date;
    $('input-end-date').value = t.endDate || t.date;
    $('input-projected-nps').value = t.projectedNps || '';
    $('modal-event-title').innerText = 'Modificar acción';
    toggleEndDateField();
    openModal('modal-event');
}

function saveEvent() {
    const aff = $('select-affiliate').value;
    const typ = $('select-type').value;
    const sd  = $('input-start-date').value;
    const ed  = $('input-end-date').value;
    if (!aff || !sd) {
        showToast('Completa los campos obligatorios', 'warning');
        return;
    }

    const projNps = parseInt($('input-projected-nps').value) || 0;

    if (pendingAction) {
        const idx = events.findIndex(e => e.id === pendingAction.id);
        if (idx !== -1) {
            events[idx] = {
                ...pendingAction,
                affiliate: aff, type: typ, date: sd,
                endDate: typ === 'convocatoria' ? ed : sd,
                projectedNps: projNps
            };
        }
        showToast('Acción actualizada', 'success');
    } else {
        events.push({
            id: Date.now(),
            affiliate: aff, type: typ, date: sd,
            endDate: typ === 'convocatoria' ? ed : sd,
            projectedNps: projNps
        });
        showToast('Acción creada', 'success');
    }

    closeModal('modal-event');
    refreshViews();
    savePlanningToStorage();
}

function executeDeleteEvent() {
    if (!pendingAction) return;
    events = events.filter(e => e.id !== pendingAction.id);
    closeModal('modal-action-choice');
    refreshViews();
    savePlanningToStorage();
    showToast('Acción eliminada', 'info');
}

function toggleEndDateField() {
    const typeSel = $('select-type');
    const endContainer = $('end-date-container-add');
    if (typeSel && endContainer) {
        endContainer.classList.toggle('hidden', typeSel.value !== 'convocatoria');
    }
}

// ── Link Modal ──────────────────────────────────────────────
function openLinkModal() {
    const list = $('calendar-actions-list');
    if (!list) return;

    const sorted = [...events]
        .filter(e => e.type === 'clase' || e.type === 'contenido')
        .sort((a, b) => a.date.localeCompare(b.date));

    const existingKeys = results.map(r => `${r.name}_${r.date}_${(r.type || '').toLowerCase()}`);

    list.innerHTML = sorted.map(e => {
        const isLinked = existingKeys.includes(`${e.affiliate}_${e.date}_${e.type.toLowerCase()}`);
        const icon = e.type === 'clase' ? '🎓' : '📒';
        const projBadge = e.projectedNps ? `<span class="text-[7px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 ml-1">Proy: ${e.projectedNps}</span>` : '';
        return `<div onclick="${isLinked ? '' : `linkEventToResults('${e.id}')`}"
                     class="p-3 rounded-xl flex justify-between items-center group transition-all border
                     ${isLinked
                         ? 'opacity-40 grayscale cursor-not-allowed bg-slate-50 border-slate-100'
                         : 'hover:bg-indigo-600 hover:text-white hover:border-indigo-600 cursor-pointer bg-white border-slate-200 hover:shadow-md'}">
                    <div>
                        <span class="font-bold text-[10px] uppercase">${escapeHTML(e.affiliate)}</span>${projBadge}
                        <p class="text-[7px] text-slate-400 group-hover:text-indigo-200 mt-0.5">${e.date}</p>
                    </div>
                    <span class="text-[8px] font-bold px-2 py-1 rounded-lg bg-white text-indigo-600 self-center shadow-sm">${icon} ${e.type}</span>
                </div>`;
    }).join('') || '<p class="text-center py-8 text-slate-300 font-medium text-[9px] uppercase tracking-widest italic">Sin acciones vinculables</p>';

    openModal('modal-link');
}

function linkEventToResults(id) {
    const e = events.find(ev => String(ev.id) === String(id));
    if (!e) return;
    results.unshift({
        id: Date.now(),
        name: e.affiliate,
        date: e.date,
        type: e.type.charAt(0).toUpperCase() + e.type.slice(1),
        wa_group: 0, attendees: 0, trials: 0, nps: 0,
        fixed: 0, variable: 0, pauta: 0,
        projectedNps: e.projectedNps || 0,
        confirmed: false,
        hasCommission: true,
        notes: ''
    });
    renderResultsTable();
    updateResultStats();
    closeModal('modal-link');
    debouncedSaveResults();
    showToast(`${e.affiliate} vinculado a resultados`, 'success');
}

// ── Settings ────────────────────────────────────────────────
function openSettings() {
    const cont = $('settings-lists');
    if (!cont) return;
    cont.innerHTML = Object.entries(categories).map(([k, c]) =>
        `<div>
            <label class="text-[8px] font-bold text-indigo-500 block mb-1.5 uppercase tracking-wider">${c.label}</label>
            <textarea id="area-${k}" class="w-full border border-slate-200 rounded-xl p-3 text-[11px] h-24 bg-slate-50 outline-none font-medium text-slate-600 focus:bg-white focus:border-indigo-300 shadow-inner transition-colors resize-none" placeholder="Un miembro por línea...">${c.members.join('\n')}</textarea>
        </div>`
    ).join('');
    openModal('modal-settings');
}

function saveCategories() {
    Object.keys(categories).forEach(k => {
        const area = $(`area-${k}`);
        if (area) {
            categories[k].members = area.value.split('\n').map(m => m.trim()).filter(m => m !== '');
        }
    });
    updateFilters();
    closeModal('modal-settings');
    refreshViews();
    savePlanningToStorage();
    showToast('Miembros actualizados', 'success');
}

// ── Modals ──────────────────────────────────────────────────
function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('flex');
}

function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('flex');
    el.classList.add('hidden');
}

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = ['modal-event', 'modal-link', 'modal-settings', 'modal-action-choice', 'modal-backup', 'modal-gsheet-import', 'modal-notes'];
        modals.forEach(id => closeModal(id));
    }
});

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
    const modals = ['modal-event', 'modal-link', 'modal-settings', 'modal-action-choice', 'modal-backup', 'modal-gsheet-import', 'modal-notes'];
    modals.forEach(id => {
        const el = $(id);
        if (el && e.target === el) closeModal(id);
    });
});

// ── Backup / Restore ────────────────────────────────────────
function openBackupModal() {
    openModal('modal-backup');
}

function exportJSON() {
    const data = {
        version: '1.2',
        exportDate: new Date().toISOString(),
        planning: { events, categories },
        results,
        quarterProjections,
        quarterActualNps
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub_afiliados_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Respaldo descargado', 'success');
}

function importJSON(evt) {
    const file = evt.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.planning) {
                events = data.planning.events || [];
                if (data.planning.categories) {
                    Object.keys(categories).forEach(k => {
                        if (data.planning.categories[k]) categories[k] = data.planning.categories[k];
                    });
                }
            }
            if (data.results) results = data.results;
            if (data.quarterProjections) {
                Object.keys(quarterProjections).forEach(k => {
                    if (data.quarterProjections[k] !== undefined) quarterProjections[k] = data.quarterProjections[k];
                });
            }
            if (data.quarterActualNps) {
                Object.keys(quarterActualNps).forEach(k => {
                    if (data.quarterActualNps[k] !== undefined) quarterActualNps[k] = data.quarterActualNps[k];
                });
            }

            savePlanningToStorage();
            saveResultsToStorage();
            saveQProjectionsToStorage();
            saveQActualToStorage();
            updateFilters();
            renderTabs();
            refreshViews();
            closeModal('modal-backup');
            showToast('Datos restaurados correctamente', 'success');
        } catch (err) {
            showToast('Error: archivo JSON inválido', 'error');
        }
    };
    reader.readAsText(file);
    evt.target.value = '';
}

function clearAllData() {
    if (!confirm('¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
    events = [];
    results = [];
    quarterProjections = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    quarterActualNps = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    localStorage.removeItem(STORAGE_KEY_PLANNING);
    localStorage.removeItem(STORAGE_KEY_RESULTS);
    localStorage.removeItem(STORAGE_KEY_Q_PROJ);
    localStorage.removeItem(STORAGE_KEY_Q_ACTUAL);
    updateFilters();
    renderTabs();
    refreshViews();
    closeModal('modal-backup');
    showToast('Todos los datos eliminados', 'warning');
}

// ── Import from Google Sheets ───────────────────────────────
function importFromGoogleSheets() {
    const calRaw = $('gsheet-calendario').value.trim();
    const resRaw = $('gsheet-resultados').value.trim();

    if (!calRaw && !resRaw) {
        showToast('Pega al menos uno de los dos campos', 'warning');
        return;
    }

    let importedCal = false;
    let importedRes = false;

    if (calRaw) {
        try {
            const calData = JSON.parse(calRaw);
            if (calData.events) {
                events = calData.events;
                importedCal = true;
            }
            if (calData.categories) {
                Object.keys(categories).forEach(k => {
                    if (calData.categories[k]) categories[k] = calData.categories[k];
                });
                importedCal = true;
            }
            if (!importedCal) {
                showToast('DATA_CALENDARIO: formato no reconocido', 'error');
            }
        } catch (err) {
            showToast('DATA_CALENDARIO: JSON inválido. Verifica que copiaste toda la celda A1.', 'error');
            return;
        }
    }

    if (resRaw) {
        try {
            const resData = JSON.parse(resRaw);
            if (Array.isArray(resData)) {
                results = resData;
                importedRes = true;
            } else {
                showToast('DATA_RESULTADOS: se esperaba un array []', 'error');
            }
        } catch (err) {
            showToast('DATA_RESULTADOS: JSON inválido. Verifica que copiaste toda la celda A1.', 'error');
            return;
        }
    }

    if (importedCal) savePlanningToStorage();
    if (importedRes) saveResultsToStorage();

    updateFilters();
    renderTabs();
    refreshViews();
    closeModal('modal-gsheet-import');

    const parts = [];
    if (importedCal) parts.push('calendario');
    if (importedRes) parts.push('resultados');
    showToast(`Importado correctamente: ${parts.join(' + ')}`, 'success');
}

// ── CSV Export ──────────────────────────────────────────────
function exportCSV() {
    if (results.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    const headers = ['Afiliado','Fecha','Tipo','WA_Group','Asistentes','Trials','NPs','Proy_NPs','Delta_NP','Confirmado','Con_Comision','Fijo','Variable','Comisiones','Pauta','TOTAL_INV','CAC_COP','CAC_USD','Notas'];
    const rows = results.map(r => {
        const comis = r.hasCommission !== false ? COMISION_POR_NP * (r.nps || 0) : 0;
        const total = (r.fixed || 0) + (r.variable || 0) + comis + (r.pauta || 0);
        const cacCop = r.nps > 0 ? Math.round(total / r.nps) : 0;
        const cacUsd = r.nps > 0 ? (total / r.nps / TRM).toFixed(2) : '0';
        const delta = (r.nps || 0) - (r.projectedNps || 0);
        return [
            r.name, r.date, r.type,
            r.wa_group || 0, r.attendees || 0, r.trials || 0, r.nps || 0,
            r.projectedNps || 0, delta, r.confirmed ? 'Si' : 'No',
            r.hasCommission !== false ? 'Si' : 'No',
            r.fixed || 0, r.variable || 0, comis, r.pauta || 0,
            total, cacCop, cacUsd,
            r.notes || ''
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_resultados_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exportado', 'success');
}

// ── Loading ─────────────────────────────────────────────────
function showLoading(show) {
    const el = $('loading-overlay');
    if (el) el.classList.toggle('hidden', !show);
}

// ── Refresh ─────────────────────────────────────────────────
function refreshViews() {
    renderCalendar();
    renderPeriodFilter();
    renderResultsTable();
    updateStats();
    updateResultStats();
}

// ── Init ────────────────────────────────────────────────────
function init() {
    showLoading(true);
    loadFromStorage();
    updateFilters();
    renderTabs();
    refreshViews();

    setTimeout(() => {
        showLoading(false);
        showToast('Hub cargado correctamente', 'success');
    }, 300);
}

window.onload = init;
