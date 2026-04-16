// ════════════════════════════════════════════════════════════════════════════
// 首頁 — 統計卡片 + 走勢圖
// ════════════════════════════════════════════════════════════════════════════

registerPage('home', {
  html: `
    <div id="page-home" class="page">
      <div class="page-header"><h1>首頁</h1></div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🛒</div>
          <div class="stat-val" id="stat-month-count">—</div>
          <div class="stat-label">本月銷貨筆數</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-val" id="stat-month-total">—</div>
          <div class="stat-label">本月銷貨金額</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-val" id="stat-inv-count">—</div>
          <div class="stat-label">庫存品項數</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-val" id="stat-inv-alert">—</div>
          <div class="stat-label">庫存警示</div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-title-bar">
          <span class="chart-title">每月銷貨金額</span>
          <span class="chart-note" id="chart-note"></span>
        </div>
        <div class="chart-wrap">
          <canvas id="sales-chart"></canvas>
        </div>
        <div id="chart-empty" class="chart-empty" style="display:none"></div>
      </div>
    </div>`,

  onShow() { loadHomeChart(); }
});

// ── 首頁圖表與統計 ────────────────────────────────────────────────────────────

async function loadHomeChart() {
  const canvas  = document.getElementById('sales-chart');
  const emptyEl = document.getElementById('chart-empty');
  const noteEl  = document.getElementById('chart-note');
  if (!canvas) return;

  const showEmpty = msg => {
    canvas.style.display = 'none';
    if (emptyEl) { emptyEl.style.display = ''; emptyEl.textContent = msg; }
  };

  if (!isSignedIn()) {
    ['stat-month-count','stat-month-total','stat-inv-count','stat-inv-alert']
      .forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = '—'; el.style.color = ''; } });
    showEmpty('請先登入 Google 以載入圖表');
    return;
  }

  canvas.style.display = '';
  if (emptyEl) emptyEl.style.display = 'none';

  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'SaleM');

    // ── 統計卡片 ──────────────────────────────────────────────────────────────
    const thisMonth = new Date().toISOString().slice(0, 7);
    const activeRows = rows.slice(1).filter(r =>
      (r[6] ?? '').toString().trim() !== '作廢'
    );
    const monthRows  = activeRows.filter(r =>
      (r[3] ?? '').toString().trim().startsWith(thisMonth)
    );
    const monthCount = monthRows.length;
    const monthTotal = monthRows.reduce((s, r) => s + (parseFloat(r[4]) || 0), 0);

    if (!productCache.length) await loadProducts();
    const totalItems = productCache.length;
    const alertItems = productCache.filter(p => {
      const safety = getSafetyStock(p.id);
      return safety > 0 ? p.stock <= safety : p.stock === 0;
    }).length;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('stat-month-count', monthCount);
    setVal('stat-month-total', '$' + monthTotal.toLocaleString());
    setVal('stat-inv-count',   totalItems);
    setVal('stat-inv-alert',   alertItems);
    const alertEl = document.getElementById('stat-inv-alert');
    if (alertEl) alertEl.style.color = alertItems > 0 ? 'var(--danger)' : '';

    // ── 圖表（近 12 個月走勢）────────────────────────────────────────────────
    const monthMap = {};
    rows.slice(1).forEach(row => {
      if ((row[6] ?? '').toString().trim() === '作廢') return;
      const date  = (row[3] ?? '').toString().trim();
      const total = parseFloat(row[4]) || 0;
      if (!date) return;
      const m = date.slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + total;
    });

    // 固定顯示最近 12 個月
    const last12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      last12.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const oldKeys = Object.keys(monthMap).filter(m => m < last12[0]).sort();
    const labels  = [...oldKeys, ...last12];
    const data    = labels.map(m => monthMap[m] || 0);

    if (data.every(v => v === 0)) { showEmpty('尚無銷貨記錄'); return; }

    // 3 個月移動平均
    const trend = data.map((_, i) => {
      const slice = data.slice(Math.max(0, i - 2), i + 1);
      return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length);
    });

    const grandTotal = data.reduce((s, v) => s + v, 0);
    if (noteEl) noteEl.textContent = `近 12 個月　合計 $${grandTotal.toLocaleString()}`;

    if (salesChart) { salesChart.destroy(); salesChart = null; }
    canvas.style.width = '100%'; canvas.style.height = '260px';
    canvas.removeAttribute('width'); canvas.removeAttribute('height');

    salesChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar', label: '月銷貨金額', data,
            backgroundColor: 'rgba(2,136,209,.7)',
            borderRadius: { topLeft: 5, topRight: 5 },
            borderSkipped: 'bottom', borderWidth: 0, maxBarThickness: 72, order: 2
          },
          {
            type: 'line', label: '3 月均線', data: trend,
            borderColor: 'rgba(255,100,50,.85)', backgroundColor: 'transparent',
            borderWidth: 2, pointRadius: 3, pointHoverRadius: 5,
            pointBackgroundColor: 'rgba(255,100,50,.85)',
            tension: 0.4, fill: false, order: 1
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 12 }, boxWidth: 14 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: {
            beginAtZero: true, grid: { color: 'rgba(184,217,240,.5)' },
            ticks: { font: { size: 12 }, callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v) }
          }
        }
      }
    });
  } catch (e) {
    showEmpty('圖表載入失敗：' + e.message);
  } finally {
    setLoading(false);
  }
}
