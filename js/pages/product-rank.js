// ════════════════════════════════════════════════════════════════════════════
// 商品銷售排行
// ════════════════════════════════════════════════════════════════════════════

registerPage('product-rank', {
  html: `
    <div id="page-product-rank" class="page">
      <div class="page-header">
        <h1>商品銷售排行</h1>
        <div class="actions">
          <input type="date" id="pr-from">
          <span class="date-sep">至</span>
          <input type="date" id="pr-to">
          <button class="btn primary" onclick="loadProductRank()">🔍 查詢</button>
        </div>
      </div>
      <div id="product-rank-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th class="col-seq">排名</th><th>品號</th><th>品名</th>
              <th class="text-right">銷售數量</th>
              <th class="text-right">銷售金額</th>
              <th class="text-right">佔比</th>
            </tr>
          </thead>
          <tbody id="product-rank-body">
            <tr><td colspan="6" class="empty-row">設定日期範圍後點擊查詢</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  onShow() {
    const y = new Date().getFullYear();
    const from = document.getElementById('pr-from');
    const to   = document.getElementById('pr-to');
    if (from && !from.value) from.value = `${y}-01-01`;
    if (to   && !to.value)   to.value   = new Date().toISOString().slice(0, 10);
    loadProductRank();
  }
});

// ── 查詢 ──────────────────────────────────────────────────────────────────────

async function loadProductRank() {
  const body    = document.getElementById('product-rank-body');
  const summary = document.getElementById('product-rank-summary');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">請先登入 Google</td></tr>'; return;
  }
  const from = document.getElementById('pr-from')?.value || '';
  const to   = document.getElementById('pr-to')?.value   || '';
  setLoading(true);
  try {
    const id = await getSaleTestId();
    const [mRows, dRows] = await Promise.all([
      getSheetData(id, 'SaleM'),
      getSheetData(id, 'SaleD')
    ]);
    // 建立有效訂單集合（非作廢 + 日期範圍內）
    const validOrders = new Set();
    mRows.slice(1).forEach(r => {
      if ((r[6]??'').toString().trim() === '作廢') return;
      const date = (r[3]??'').toString().trim();
      if (from && date < from) return;
      if (to   && date > to)   return;
      validOrders.add((r[1]??'').toString().trim());
    });
    // 彙總 SaleD
    const stats = {};
    dRows.slice(1).forEach(r => {
      const orderNo  = (r[1]??'').toString().trim();
      if (!validOrders.has(orderNo)) return;
      const prodId   = (r[2]??'').toString().trim();
      const name     = (r[3]??'').toString().trim();
      const qty      = parseInt(r[5])   || 0;
      const subtotal = parseFloat(r[7]) || 0;
      if (!prodId) return;
      if (!stats[prodId]) stats[prodId] = { name, qty: 0, total: 0 };
      stats[prodId].qty   += qty;
      stats[prodId].total += subtotal;
    });
    const sorted     = Object.entries(stats)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.total - a.total);
    const grandTotal = sorted.reduce((s, p) => s + p.total, 0);
    if (summary) {
      const rangeText = from || to ? `（${from||'—'} 至 ${to||'—'}）` : '（全部期間）';
      summary.style.display = '';
      summary.textContent   = `共 ${sorted.length} 項商品${rangeText}　合計：$${grandTotal.toLocaleString()}`;
    }
    if (!sorted.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-row">查無銷貨記錄</td></tr>'; return;
    }
    body.innerHTML = sorted.map((p, i) => {
      const pct = grandTotal > 0 ? ((p.total/grandTotal)*100).toFixed(1) : '0.0';
      return `<tr>
        <td class="col-seq">${i+1}</td>
        <td>${esc(p.id)}</td><td>${esc(p.name)}</td>
        <td class="text-right">${p.qty.toLocaleString()}</td>
        <td class="text-right">$${p.total.toLocaleString()}</td>
        <td class="text-right">${pct}%</td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}
