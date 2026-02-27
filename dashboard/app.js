'use strict';
/**
 * Dashboard WebSocket client.
 * Connects to the bot server and reactively updates the UI.
 */

// ── Chart setup ────────────────────────────────────────────
Chart.defaults.color = '#64748b';
Chart.defaults.font.family = "'Inter', sans-serif";

const priceChart = new Chart(
    document.getElementById('price-chart'),
    {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
                y: {
                    position: 'right',
                    ticks: {
                        font: { family: 'JetBrains Mono', size: 10 },
                        callback: (v) => '$' + v.toLocaleString(),
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(13,19,33,0.95)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: ctx => ` $${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    },
                },
            },
        },
    }
);

// ── State ──────────────────────────────────────────────────
let currentState = null;
let activeSymbol = null;
const chartHistory = {};  // symbol → [{ time, close }]

// ── WebSocket connection ───────────────────────────────────
const WS_URL = `ws://${location.host}`;
let ws, reconnectTimer;

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        setStatus('connected', 'Live');
        clearTimeout(reconnectTimer);
        console.log('[WS] Connected');
    };

    ws.onmessage = (e) => {
        try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'STATE_UPDATE') {
                currentState = msg.data;
                renderAll(msg.data);
            }
        } catch (err) {
            console.error('[WS] Parse error:', err);
        }
    };

    ws.onclose = () => {
        setStatus('error', 'Disconnected');
        reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
        setStatus('error', 'Error');
    };
}

// ── Status indicator ───────────────────────────────────────
function setStatus(cls, label) {
    const dot = document.getElementById('status-dot');
    const lbl = document.getElementById('status-label');
    dot.className = 'status-dot ' + cls;
    lbl.textContent = label;
}

// ── Render all ─────────────────────────────────────────────
function renderAll(state) {
    renderAccount(state.account);
    renderPositions(state.positions, state.account.equity);
    renderSignals(state.signals);
    renderTrades(state.trades);
    renderErrors(state.errors);
    updateSymbolTabs(state.signals);
    updateMeta(state.lastTick);
}

// ── Account KPIs ───────────────────────────────────────────
function fmt(n) { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function renderAccount(acc) {
    if (!acc) return;
    const pnlEl = document.getElementById('kpi-pnl');
    const pnl = acc.pnl || 0;

    document.getElementById('kpi-equity').textContent = fmt(acc.equity);
    document.getElementById('kpi-buying-power').textContent = fmt(acc.buyingPower);
    document.getElementById('kpi-cash').textContent = 'Cash: ' + fmt(acc.cash);
    pnlEl.textContent = `P&L today: ${pnl >= 0 ? '+' : ''}${fmt(pnl)}`;
    pnlEl.className = 'kpi-sub ' + (pnl >= 0 ? 'positive' : 'negative');
}

// ── Positions ──────────────────────────────────────────────
function renderPositions(positions, equity) {
    const tbody = document.getElementById('positions-body');
    document.getElementById('kpi-positions').textContent = positions?.length ?? '—';

    if (!positions || positions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No open positions</td></tr>';
        return;
    }

    tbody.innerHTML = positions.map(p => {
        const pnlCls = p.pnl >= 0 ? 'positive' : 'negative';
        const sign = p.pnl >= 0 ? '+' : '';
        return `
      <tr>
        <td class="mono" style="font-weight:600;color:#60a5fa">${p.symbol}</td>
        <td><span class="badge badge-buy">LONG</span></td>
        <td class="mono">${(+p.qty).toFixed(4)}</td>
        <td class="mono">$${(+p.entryPrice).toFixed(4)}</td>
        <td class="mono ${pnlCls}">${sign}${fmt(p.pnl)}</td>
      </tr>`;
    }).join('');
}

// ── Signal log ────────────────────────────────────────────
function renderSignals(signals) {
    const list = document.getElementById('signal-log');
    const last = signals?.[0];
    if (last) {
        document.getElementById('kpi-signals').textContent = `Last: ${last.symbol} ${last.signal}`;
    }

    if (!signals || signals.length === 0) {
        list.innerHTML = '<li class="log-item log-empty">No signals yet</li>';
        return;
    }

    list.innerHTML = signals.map(s => {
        const cls = s.signal?.toLowerCase() || 'hold';
        const badge = `<span class="badge badge-${cls}">${s.signal}</span>`;
        const extras = [];
        if (s.rsi) extras.push(`RSI ${s.rsi}`);
        if (s.emaFast) extras.push(`EMA ${s.emaFast}/${s.emaSlow}`);
        if (s.histogram) extras.push(`H ${s.histogram}`);

        // Track history for chart
        if (!chartHistory[s.symbol]) chartHistory[s.symbol] = [];
        chartHistory[s.symbol].unshift({ time: s.ts, close: s.price });
        if (chartHistory[s.symbol].length > 80) chartHistory[s.symbol].pop();

        return `
      <li class="log-item ${cls}">
        <span class="log-sym">${s.symbol}</span>
        <span class="log-meta">${badge} ${s.reason || ''}${extras.length ? '<br><span style="color:#475569;font-size:0.7rem">' + extras.join(' · ') + '</span>' : ''}</span>
        <span class="log-ts">${shortTime(s.ts)}</span>
      </li>`;
    }).join('');

    // Update chart for active symbol
    if (activeSymbol && chartHistory[activeSymbol]) {
        renderChart(activeSymbol);
    }
}

// ── Trade log ─────────────────────────────────────────────
function renderTrades(trades) {
    const list = document.getElementById('trade-log');
    document.getElementById('kpi-trades').textContent = trades?.length ?? '—';

    if (!trades || trades.length === 0) {
        list.innerHTML = '<li class="log-item log-empty">No trades yet</li>';
        return;
    }

    list.innerHTML = trades.map(t => {
        const isBuy = t.action?.includes('BUY');
        const isSell = t.action?.includes('SELL') || t.action?.includes('CLOSE');
        const cls = isBuy ? 'buy' : isSell ? 'sell' : 'hold';
        return `
      <li class="log-item ${cls}">
        <span class="log-sym">${t.symbol}</span>
        <span class="log-meta"><span class="badge badge-${cls}">${t.action}</span> qty: ${t.qty} @ $${(+t.price).toFixed(4)}</span>
        <span class="log-ts">${shortTime(t.ts)}</span>
      </li>`;
    }).join('');
}

// ── Error log ─────────────────────────────────────────────
function renderErrors(errors) {
    const list = document.getElementById('error-log');
    if (!errors || errors.length === 0) {
        list.innerHTML = '<li class="log-item log-empty">No errors</li>';
        return;
    }
    list.innerHTML = errors.map(e => `
    <li class="log-item error">
      <span class="log-meta" style="color:#f59e0b">${e.symbol ? `[${e.symbol}] ` : ''}${e.message}</span>
      <span class="log-ts">${shortTime(e.ts)}</span>
    </li>`).join('');
}

// ── Symbol Tabs ────────────────────────────────────────────
function updateSymbolTabs(signals) {
    const tabs = document.getElementById('symbol-tabs');
    const syms = [...new Set((signals || []).map(s => s.symbol))].slice(0, 8);
    if (syms.length === 0) return;

    if (!activeSymbol || !syms.includes(activeSymbol)) {
        activeSymbol = syms[0];
    }

    tabs.innerHTML = syms.map(sym => `
    <button class="sym-tab ${sym === activeSymbol ? 'active' : ''}" data-sym="${sym}">${sym}</button>
  `).join('');

    tabs.querySelectorAll('.sym-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeSymbol = btn.dataset.sym;
            tabs.querySelectorAll('.sym-tab').forEach(b => b.classList.toggle('active', b === btn));
            renderChart(activeSymbol);
        });
    });

    renderChart(activeSymbol);
}

// ── Chart rendering ────────────────────────────────────────
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];
let colorIdx = 0;

function renderChart(symbol) {
    const history = (chartHistory[symbol] || []).slice().reverse();
    if (history.length === 0) return;

    const labels = history.map(h => shortTime(h.time));
    const data = history.map(h => h.close);
    const color = COLORS[colorIdx % COLORS.length];

    priceChart.data.labels = labels;
    priceChart.data.datasets = [{
        label: symbol,
        data,
        borderColor: color,
        backgroundColor: color.replace(')', ',0.08)').replace('rgb', 'rgba'),
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
    }];
    priceChart.update('none');
}

// ── Meta (last tick) ──────────────────────────────────────
function updateMeta(lastTick) {
    const el = document.getElementById('kpi-last-tick');
    if (lastTick) el.textContent = 'Last tick: ' + shortTime(lastTick);
}

// ── Clock ─────────────────────────────────────────────────
function updateClock() {
    document.getElementById('header-time').textContent =
        new Date().toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ── Helpers ────────────────────────────────────────────────
function shortTime(isoStr) {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Bootstrap ─────────────────────────────────────────────
// Load initial state via REST, then open WS
fetch('/api/state')
    .then(r => r.json())
    .then(state => { currentState = state; renderAll(state); })
    .catch(() => { })
    .finally(() => connect());
