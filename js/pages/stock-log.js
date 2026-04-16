// ════════════════════════════════════════════════════════════════════════════
// 入出庫記錄查詢
// ════════════════════════════════════════════════════════════════════════════

registerPage('stock-log', {
  html: `
    <div id="page-stock-log" class="page">
      <div class="page-header"><h1>入出庫記錄</h1></div>
      <div class="search-bar">
        <select id="sl-type" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-family:var(--font)">
          <option value="">全部類型</option>
          <option value="入庫">入庫</option>
          <option value="出庫">出庫</option>
        </select>
        <input type="text" id="sl-prod" placeholder="品號 / 品名...">
        <input type="date" id="sl-from">
        <span class="date-sep">至</span>
        <input type="date" id="sl-to">
        <button class="btn primary"   onclick="filterStockLog()">🔍 搜尋</button>
        <button class="btn secondary" onclick="resetStockLog()">重設</button>
      </div>
      <div id="stock-log-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th>日期</th><th>類型</th><th>品號</th><th>品名</th>
              <th class="text-right">數量</th><th>備註</th>
            </tr>
          </thead>
          <tbody id="stock-log-body">
            <tr><td colspan="6" class="empty-row">載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  onShow() { loadStockLog(); }
});

// ── 載入 / 渲染 ───────────────────────────────────────────────────────────────

async function loadStockLog() {
  const body = document.getElementById('stock-log-body');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">請先登入 Google</td></tr>'; return;
  }
  setLoading(true);
  try {
    const id = await getSaleTestId();
    await ensureSheet(id, 'StockLog', ['SEQ','日期','類型','品號','品名','數量','備註']);
    stockLogSheetReady = true;
    const rows = await getSheetData(id, 'StockLog');
    stockLogCache = rows.slice(1).map(r => ({
      date:   (r[1]??'').toString().trim(),
      type:   (r[2]??'').toString().trim(),
      prodId: (r[3]??'').toString().trim(),
      name:   (r[4]??'').toString().trim(),
      qty:    parseInt(r[5]) || 0,
      remark: (r[6]??'').toString().trim()
    })).filter(r => r.date || r.prodId);
    renderStockLog(stockLogCache);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}

function renderStockLog(logs) {
  const body    = document.getElementById('stock-log-body');
  const summary = document.getElementById('stock-log-summary');
  if (!body) return;
  if (!logs.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">尚無入出庫記錄</td></tr>';
    if (summary) summary.style.display = 'none'; return;
  }
  const inCnt  = logs.filter(l => l.type === '入庫').length;
  const outCnt = logs.filter(l => l.type === '出庫').length;
  if (summary) {
    summary.style.display = '';
    summary.textContent   = `共 ${logs.length} 筆　入庫 ${inCnt} 筆　出庫 ${outCnt} 筆`;
  }
  body.innerHTML = logs.map(l => `
    <tr>
      <td>${esc(l.date)}</td>
      <td><span class="stock-badge ${l.type==='入庫' ? 'stock-ok' : 'stock-low'}">${esc(l.type)}</span></td>
      <td>${esc(l.prodId)}</td><td>${esc(l.name)}</td>
      <td class="text-right">${l.qty}</td>
      <td>${esc(l.remark)}</td>
    </tr>`).join('');
}

function filterStockLog() {
  const type = document.getElementById('sl-type')?.value  || '';
  const prod = (document.getElementById('sl-prod')?.value || '').toLowerCase();
  const from = document.getElementById('sl-from')?.value  || '';
  const to   = document.getElementById('sl-to')?.value    || '';
  renderStockLog(stockLogCache.filter(l =>
    (!type || l.type === type) &&
    (!prod || l.prodId.toLowerCase().includes(prod) || l.name.toLowerCase().includes(prod)) &&
    (!from || l.date >= from) &&
    (!to   || l.date <= to)
  ));
}

function resetStockLog() {
  ['sl-type','sl-prod','sl-from','sl-to'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderStockLog(stockLogCache);
}
