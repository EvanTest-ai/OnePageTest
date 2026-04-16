// ════════════════════════════════════════════════════════════════════════════
// 庫存查詢
// ════════════════════════════════════════════════════════════════════════════

registerPage('query-inventory', {
  html: `
    <div id="page-query-inventory" class="page">
      <div class="page-header">
        <h1>庫存查詢</h1>
        <button class="btn secondary" onclick="recalcInventory()"
                title="根據銷貨記錄補算尚未扣減的庫存數量">🔄 補算庫存</button>
      </div>
      <div class="search-bar">
        <input type="text" id="iq-keyword" placeholder="品號 / 品名 / 規格...">
        <button class="btn primary"    onclick="filterInventoryQuery()">🔍 搜尋</button>
        <button class="btn secondary"  onclick="resetInventoryQuery()">重設</button>
      </div>
      <div id="inv-query-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th>品號</th><th>品名</th><th>規格</th>
              <th class="text-right">單價</th>
              <th class="text-right">庫存量</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody id="inv-query-body">
            <tr><td colspan="6" class="empty-row">載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  onShow() { loadInventoryQuery(); }
});

// ── 載入 / 渲染 ───────────────────────────────────────────────────────────────

async function loadInventoryQuery() {
  const body = document.getElementById('inv-query-body');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">請先登入 Google 以載入庫存資料</td></tr>';
    const s = document.getElementById('inv-query-summary'); if (s) s.style.display = 'none';
    return;
  }
  setLoading(true);
  try {
    await loadProducts();
    renderInventoryQuery(productCache);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}

function renderInventoryQuery(products) {
  const body    = document.getElementById('inv-query-body');
  const summary = document.getElementById('inv-query-summary');
  if (!body) return;
  if (!products.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">查無符合條件的商品</td></tr>';
    if (summary) summary.style.display = 'none'; return;
  }
  const noStock  = products.filter(p => p.stock === 0).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  if (summary) {
    summary.style.display = '';
    const parts = [`共 ${products.length} 項商品`];
    if (noStock)  parts.push(`無庫存 ${noStock} 項`);
    if (lowStock) parts.push(`低庫存 ${lowStock} 項`);
    summary.textContent = parts.join('　｜　');
  }
  body.innerHTML = products.map(p => {
    const safety = getSafetyStock(p.id);
    const isLow  = safety > 0 ? p.stock <= safety : p.stock <= 5;
    const cls    = p.stock === 0 ? 'stock-none' : isLow ? 'stock-low' : 'stock-ok';
    const text   = p.stock === 0 ? '無庫存'     : isLow ? '低庫存'    : '正常';
    return `<tr>
      <td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.spec)}</td>
      <td class="text-right">${p.price.toLocaleString()}</td>
      <td class="text-right ${p.stock <= 5 ? 'text-warn' : ''}">${p.stock}</td>
      <td><span class="stock-badge ${cls}">${text}</span></td>
    </tr>`;
  }).join('');
}

function filterInventoryQuery() {
  const kw = (document.getElementById('iq-keyword')?.value || '').toLowerCase();
  renderInventoryQuery(productCache.filter(p =>
    !kw || p.id.toLowerCase().includes(kw) ||
    p.name.toLowerCase().includes(kw) || p.spec.toLowerCase().includes(kw)
  ));
}

function resetInventoryQuery() {
  document.getElementById('iq-keyword').value = '';
  renderInventoryQuery(productCache);
}

// ── 補算庫存（一次性對帳）────────────────────────────────────────────────────

async function recalcInventory() {
  if (!isSignedIn()) { showToast('請先登入 Google', 'error'); return; }
  if (!confirm(
    '此操作將根據所有銷貨明細重新計算庫存量。\n\n' +
    '適用情境：過去的銷貨記錄尚未扣減庫存時，執行一次補算。\n\n' +
    '注意：若庫存已是正確數量，請勿重複執行，否則會多扣一次。\n\n確定繼續？'
  )) return;
  setLoading(true);
  try {
    const id    = await getSaleTestId();
    const dRows = await getSheetData(id, 'SaleD');
    const soldMap = {};
    dRows.slice(1).forEach(row => {
      const prodId = (row[2]??'').toString().trim();
      const qty    = parseInt(row[5]) || 0;
      if (prodId && qty > 0) soldMap[prodId] = (soldMap[prodId]||0) + qty;
    });
    if (!Object.keys(soldMap).length) { showToast('尚無銷貨記錄，不需要補算', 'info'); return; }
    const pRows = await getSheetData(id, 'Product');
    let updatedCount = 0;
    for (let i = 1; i < pRows.length; i++) {
      const prodId = (pRows[i][0]??'').toString().trim();
      if (!prodId || !soldMap[prodId]) continue;
      const newStock = Math.max(0, (parseInt(pRows[i][4])||0) - soldMap[prodId]);
      await updateRow(id, 'Product', i+1, [
        pRows[i][0]??'', pRows[i][1]??'', pRows[i][2]??'', pRows[i][3]??'', newStock
      ]);
      updatedCount++;
    }
    productCache = [];
    showToast(`補算完成，已更新 ${updatedCount} 項商品`, 'success');
    await loadInventoryQuery();
  } catch (e) {
    showToast('補算失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}
