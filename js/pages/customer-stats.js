// ════════════════════════════════════════════════════════════════════════════
// 客戶銷貨統計
// ════════════════════════════════════════════════════════════════════════════

registerPage('customer-stats', {
  html: `
    <div id="page-customer-stats" class="page">
      <div class="page-header">
        <h1>客戶銷貨統計</h1>
        <div class="actions">
          <input type="date" id="cs-from">
          <span class="date-sep">至</span>
          <input type="date" id="cs-to">
          <button class="btn primary" onclick="loadCustomerStats()">🔍 查詢</button>
        </div>
      </div>
      <div id="customer-stats-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th class="col-seq">排名</th><th>客戶名稱</th>
              <th class="text-right">銷貨筆數</th>
              <th class="text-right">銷貨金額</th>
              <th class="text-right">佔比</th>
            </tr>
          </thead>
          <tbody id="customer-stats-body">
            <tr><td colspan="5" class="empty-row">設定日期範圍後點擊查詢</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  onShow() {
    const y = new Date().getFullYear();
    const from = document.getElementById('cs-from');
    const to   = document.getElementById('cs-to');
    if (from && !from.value) from.value = `${y}-01-01`;
    if (to   && !to.value)   to.value   = new Date().toISOString().slice(0, 10);
    loadCustomerStats();
  }
});

// ── 查詢 ──────────────────────────────────────────────────────────────────────

async function loadCustomerStats() {
  const body    = document.getElementById('customer-stats-body');
  const summary = document.getElementById('customer-stats-summary');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="5" class="empty-row">請先登入 Google</td></tr>'; return;
  }
  const from = document.getElementById('cs-from')?.value || '';
  const to   = document.getElementById('cs-to')?.value   || '';
  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'SaleM');
    const stats = {};
    rows.slice(1).forEach(r => {
      if ((r[6]??'').toString().trim() === '作廢') return;
      const date = (r[3]??'').toString().trim();
      if (from && date < from) return;
      if (to   && date > to)   return;
      const cust  = (r[2]??'').toString().trim() || '（未知）';
      const total = parseFloat(r[4]) || 0;
      if (!stats[cust]) stats[cust] = { count: 0, total: 0 };
      stats[cust].count++; stats[cust].total += total;
    });
    const sorted     = Object.entries(stats)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.total - a.total);
    const grandTotal = sorted.reduce((s, c) => s + c.total, 0);
    if (summary) {
      const rangeText = from || to ? `（${from||'—'} 至 ${to||'—'}）` : '（全部期間）';
      summary.style.display = '';
      summary.textContent   = `共 ${sorted.length} 位客戶${rangeText}　有效合計：$${grandTotal.toLocaleString()}`;
    }
    if (!sorted.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-row">查無銷貨記錄</td></tr>'; return;
    }
    body.innerHTML = sorted.map((c, i) => {
      const pct = grandTotal > 0 ? ((c.total/grandTotal)*100).toFixed(1) : '0.0';
      return `<tr>
        <td class="col-seq">${i+1}</td>
        <td>${esc(c.name)}</td>
        <td class="text-right">${c.count}</td>
        <td class="text-right">$${c.total.toLocaleString()}</td>
        <td class="text-right">${pct}%</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="5" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}
