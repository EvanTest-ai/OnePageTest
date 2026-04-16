// ════════════════════════════════════════════════════════════════════════════
// 商品管理
// ════════════════════════════════════════════════════════════════════════════

registerPage('product-mgmt', {
  html: `
    <div id="page-product-mgmt" class="page">
      <div class="page-header">
        <h1>商品管理</h1>
        <button class="btn primary" onclick="openProductModal(-1)">＋ 新增商品</button>
      </div>
      <div id="product-mgmt-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th>品號</th><th>品名</th><th>規格</th>
              <th class="text-right">單價</th>
              <th class="text-right">庫存量</th>
              <th class="text-right">安全量</th>
              <th style="width:120px"></th>
            </tr>
          </thead>
          <tbody id="product-mgmt-body">
            <tr><td colspan="7" class="empty-row">載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  modals: `
    <div id="modal-product-mgmt" class="modal">
      <div class="modal-header">
        <h2 id="modal-product-mgmt-title">新增商品</h2>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>品號</label>
          <input type="text" id="pm-id" placeholder="唯一識別碼（新增後不可更改）">
        </div>
        <div class="form-group">
          <label>品名</label>
          <input type="text" id="pm-name" placeholder="商品名稱">
        </div>
        <div class="form-group">
          <label>規格</label>
          <input type="text" id="pm-spec" placeholder="規格 / 備註">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>單價</label>
            <input type="number" id="pm-price" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>庫存量</label>
            <input type="number" id="pm-stock" placeholder="0" min="0">
          </div>
          <div class="form-group">
            <label>安全量</label>
            <input type="number" id="pm-safety" placeholder="0" min="0">
            <div class="hint">低於此數量時顯示警示</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="hideModal()">取消</button>
        <button class="btn primary" onclick="saveProductModal()">儲存</button>
      </div>
    </div>`,

  onShow() { loadProductMgmt(); }
});

// ── 載入 / 渲染 ───────────────────────────────────────────────────────────────

async function loadProductMgmt() {
  const body = document.getElementById('product-mgmt-body');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="7" class="empty-row">請先登入 Google</td></tr>'; return;
  }
  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'Product');
    productMgmtCache = [];
    for (let i = 1; i < rows.length; i++) {
      const prodId = (rows[i][0]??'').toString().trim();
      if (!prodId) continue;
      productMgmtCache.push({
        rowIndex: i + 1, id: prodId,
        name:  (rows[i][1]??'').toString().trim(),
        spec:  (rows[i][2]??'').toString().trim(),
        price: parseFloat(rows[i][3]) || 0,
        stock: parseInt(rows[i][4])   || 0
      });
    }
    productCache = productMgmtCache.map(p => ({ ...p }));
    const summary = document.getElementById('product-mgmt-summary');
    if (summary) { summary.style.display = ''; summary.textContent = `共 ${productMgmtCache.length} 項商品`; }
    if (!productMgmtCache.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-row">尚無商品，點擊「新增商品」建立</td></tr>'; return;
    }
    body.innerHTML = productMgmtCache.map((p, idx) => {
      const safety  = getSafetyStock(p.id);
      const isAlert = safety > 0 ? p.stock <= safety : p.stock === 0;
      return `<tr>
        <td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.spec)}</td>
        <td class="text-right">${p.price.toLocaleString()}</td>
        <td class="text-right ${isAlert ? 'text-warn' : ''}">${p.stock}</td>
        <td class="text-right">${safety || '—'}</td>
        <td class="td-ops">
          <button class="btn-sm primary" onclick="openProductModal(${idx})">編輯</button>
          <button class="btn-sm danger"  onclick="confirmDeleteProduct(${idx})">刪除</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="7" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}

// ── Modal 開啟 / 儲存 / 刪除 ──────────────────────────────────────────────────

function openProductModal(idx) {
  const isEdit = idx >= 0;
  document.getElementById('modal-product-mgmt-title').textContent = isEdit ? '編輯商品' : '新增商品';
  document.getElementById('modal-product-mgmt').dataset.idx = idx;
  const idEl = document.getElementById('pm-id');
  if (isEdit) {
    const p = productMgmtCache[idx];
    idEl.value = p.id; idEl.disabled = true;
    document.getElementById('pm-name').value   = p.name;
    document.getElementById('pm-spec').value   = p.spec;
    document.getElementById('pm-price').value  = p.price;
    document.getElementById('pm-stock').value  = p.stock;
    document.getElementById('pm-safety').value = getSafetyStock(p.id) || '';
  } else {
    idEl.value = ''; idEl.disabled = false;
    ['pm-name','pm-spec','pm-price','pm-stock','pm-safety']
      .forEach(id => { document.getElementById(id).value = ''; });
  }
  showModal('modal-product-mgmt');
}

async function saveProductModal() {
  const idx    = parseInt(document.getElementById('modal-product-mgmt').dataset.idx);
  const isEdit = idx >= 0;
  const prodId = document.getElementById('pm-id').value.trim();
  const name   = document.getElementById('pm-name').value.trim();
  const spec   = document.getElementById('pm-spec').value.trim();
  const price  = parseFloat(document.getElementById('pm-price').value)  || 0;
  const stock  = parseInt(document.getElementById('pm-stock').value)    || 0;
  const safety = parseInt(document.getElementById('pm-safety').value)   || 0;

  if (!prodId) { showToast('請輸入品號', 'error'); return; }
  if (!name)   { showToast('請輸入品名', 'error'); return; }
  if (!isEdit && productMgmtCache.some(p => p.id === prodId)) {
    showToast(`品號「${prodId}」已存在`, 'error'); return;
  }
  setSafetyStock(prodId, safety);
  hideModal();
  setLoading(true);
  try {
    const id  = await getSaleTestId();
    const row = [prodId, name, spec, price, stock];
    if (isEdit) {
      await updateRow(id, 'Product', productMgmtCache[idx].rowIndex, row);
      showToast(`✔「${prodId}」已更新`, 'success');
    } else {
      await appendRow(id, 'Product', row);
      showToast(`✔「${prodId}」已新增`, 'success');
    }
    productCache = [];
    await loadProductMgmt();
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

async function confirmDeleteProduct(idx) {
  const p = productMgmtCache[idx];
  if (!confirm(`確定要刪除商品「${p.id}　${p.name}」？此操作無法復原。`)) return;
  setLoading(true);
  try {
    const id = await getSaleTestId();
    await deleteRow(id, 'Product', p.rowIndex);
    productCache = [];
    showToast(`已刪除「${p.id}」`, 'success');
    await loadProductMgmt();
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}
