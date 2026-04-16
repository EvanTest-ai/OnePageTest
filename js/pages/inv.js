// ════════════════════════════════════════════════════════════════════════════
// 入庫作業 + 出庫作業（共用邏輯）
// ════════════════════════════════════════════════════════════════════════════

registerPage('inv-in', {
  html: `
    <div id="page-inv-in" class="page">
      <div class="page-header">
        <h1>入庫作業</h1>
        <button class="btn primary" onclick="confirmInvIn()">✔ 確認入庫</button>
      </div>
      <div class="form-section">
        <div class="form-row">
          <div class="form-group">
            <label>入庫日期</label>
            <input type="date" id="in-date">
          </div>
          <div class="form-group flex-2">
            <label>商品（欄位 A）</label>
            <select id="in-prod-id" onchange="lookupProduct('in')">
              <option value="">— 選擇商品 —</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>現有庫存</label>
            <input type="text" id="in-current-stock" placeholder="—" disabled>
          </div>
          <div class="form-group">
            <label>入庫數量</label>
            <input type="number" id="in-qty" placeholder="0" min="1">
          </div>
          <div class="form-group flex-2">
            <label>備註</label>
            <input type="text" id="in-remark" placeholder="來源 / 說明">
          </div>
        </div>
      </div>
    </div>`,

  onShow() { initInvForm('in'); }
});

registerPage('inv-out', {
  html: `
    <div id="page-inv-out" class="page">
      <div class="page-header">
        <h1>出庫作業</h1>
        <button class="btn primary" onclick="confirmInvOut()">✔ 確認出庫</button>
      </div>
      <div class="form-section">
        <div class="form-row">
          <div class="form-group">
            <label>出庫日期</label>
            <input type="date" id="out-date">
          </div>
          <div class="form-group flex-2">
            <label>商品（欄位 A）</label>
            <select id="out-prod-id" onchange="lookupProduct('out')">
              <option value="">— 選擇商品 —</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>現有庫存</label>
            <input type="text" id="out-current-stock" placeholder="—" disabled>
          </div>
          <div class="form-group">
            <label>出庫數量</label>
            <input type="number" id="out-qty" placeholder="0" min="1">
          </div>
          <div class="form-group flex-2">
            <label>出庫原因</label>
            <input type="text" id="out-reason" placeholder="報廢 / 調撥 / 其他...">
          </div>
        </div>
      </div>
    </div>`,

  onShow() { initInvForm('out'); }
});

// ── 共用邏輯 ──────────────────────────────────────────────────────────────────

async function initInvForm(mode) {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById(`${mode}-date`).value          = today;
  document.getElementById(`${mode}-current-stock`).value = '';
  document.getElementById(`${mode}-qty`).value           = '';
  const remarkEl = document.getElementById(mode === 'in' ? 'in-remark' : 'out-reason');
  if (remarkEl) remarkEl.value = '';
  if (isSignedIn()) await loadProductOptions(mode);
}

async function loadProductOptions(mode) {
  const sel = document.getElementById(`${mode}-prod-id`);
  sel.innerHTML = '<option value="">— 選擇商品 —</option>';
  try {
    if (!productCache.length) await loadProducts();
    productCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.id}　${p.name}`;
      sel.appendChild(opt);
    });
  } catch (e) { /* 載入失敗不中斷頁面 */ }
}

function lookupProduct(mode) {
  const prodId  = document.getElementById(`${mode}-prod-id`).value;
  const stockEl = document.getElementById(`${mode}-current-stock`);
  if (!prodId) { stockEl.value = ''; return; }
  const p = productCache.find(p => p.id === prodId);
  stockEl.value = p ? p.stock : '';
}

// ── 確認入庫 ──────────────────────────────────────────────────────────────────

async function confirmInvIn() {
  if (!isSignedIn()) { showToast('請先登入 Google', 'error'); return; }
  const prodId   = document.getElementById('in-prod-id').value.trim();
  const qty      = parseInt(document.getElementById('in-qty').value) || 0;
  const date     = document.getElementById('in-date').value;
  const stockVal = document.getElementById('in-current-stock').value;

  if (!date)    { showToast('請選擇入庫日期', 'error'); return; }
  if (!prodId)  { showToast('請輸入品號', 'error'); return; }
  if (!stockVal){ showToast('請先輸入有效的品號', 'error'); return; }
  if (qty <= 0) { showToast('請輸入有效的入庫數量', 'error'); return; }

  const currentStock = parseInt(stockVal) || 0;
  if (!confirm(`確認入庫\n品號：${prodId}\n數量：${qty}\n入庫後庫存：${currentStock} → ${currentStock + qty}`)) return;

  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'Product');
    let rowIndex = -1, rowData = null;
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0]??'').toString().trim() === prodId) { rowIndex = i+1; rowData = rows[i]; break; }
    }
    if (rowIndex < 0) throw new Error(`找不到品號「${prodId}」`);
    const latest = parseInt(rowData[4]) || 0;
    const after  = latest + qty;
    await updateRow(id, 'Product', rowIndex,
      [rowData[0]??'', rowData[1]??'', rowData[2]??'', rowData[3]??'', after]);
    const remark = document.getElementById('in-remark').value.trim();
    await appendStockLog(id, date, '入庫', prodId, rowData[1]??'', qty, remark);
    productCache = [];
    showToast(`✔ 入庫完成：${prodId}　${latest} → ${after}`, 'success');
    initInvForm('in');
  } catch (e) {
    showToast('入庫失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

// ── 確認出庫 ──────────────────────────────────────────────────────────────────

async function confirmInvOut() {
  if (!isSignedIn()) { showToast('請先登入 Google', 'error'); return; }
  const prodId   = document.getElementById('out-prod-id').value.trim();
  const qty      = parseInt(document.getElementById('out-qty').value) || 0;
  const date     = document.getElementById('out-date').value;
  const stockVal = document.getElementById('out-current-stock').value;

  if (!date)    { showToast('請選擇出庫日期', 'error'); return; }
  if (!prodId)  { showToast('請輸入品號', 'error'); return; }
  if (!stockVal){ showToast('請先輸入有效的品號', 'error'); return; }
  if (qty <= 0) { showToast('請輸入有效的出庫數量', 'error'); return; }

  const currentStock = parseInt(stockVal) || 0;
  if (qty > currentStock) {
    showToast(`出庫數量（${qty}）超過現有庫存（${currentStock}）`, 'error'); return;
  }
  if (!confirm(`確認出庫\n品號：${prodId}\n數量：${qty}\n出庫後庫存：${currentStock} → ${currentStock - qty}`)) return;

  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'Product');
    let rowIndex = -1, rowData = null;
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0]??'').toString().trim() === prodId) { rowIndex = i+1; rowData = rows[i]; break; }
    }
    if (rowIndex < 0) throw new Error(`找不到品號「${prodId}」`);
    const latest = parseInt(rowData[4]) || 0;
    if (qty > latest) { showToast(`庫存不足（現有 ${latest}，出庫 ${qty}）`, 'error'); return; }
    const after = latest - qty;
    await updateRow(id, 'Product', rowIndex,
      [rowData[0]??'', rowData[1]??'', rowData[2]??'', rowData[3]??'', after]);
    const reason = document.getElementById('out-reason').value.trim();
    await appendStockLog(id, date, '出庫', prodId, rowData[1]??'', qty, reason);
    productCache = [];
    showToast(`✔ 出庫完成：${prodId}　${latest} → ${after}`, 'success');
    initInvForm('out');
  } catch (e) {
    showToast('出庫失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}
