// ════════════════════════════════════════════════════════════════════════════
// 銷貨開單
// ════════════════════════════════════════════════════════════════════════════

registerPage('sales-new', {
  html: `
    <div id="page-sales-new" class="page">
      <div class="page-header">
        <h1>銷貨開單</h1>
        <button class="btn primary" onclick="saveSalesOrder()">💾 儲存</button>
      </div>
      <div class="form-section">
        <div class="form-row">
          <div class="form-group">
            <label>單號</label>
            <input type="text" id="sales-no" placeholder="自動產生" disabled>
          </div>
          <div class="form-group">
            <label>日期</label>
            <input type="date" id="sales-date">
          </div>
          <div class="form-group">
            <label>客戶名稱</label>
            <input type="text" id="sales-customer" placeholder="輸入或選擇客戶"
                   list="customer-datalist" autocomplete="off">
            <datalist id="customer-datalist"></datalist>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group flex-3">
            <label>備註</label>
            <input type="text" id="sales-remark" placeholder="備註說明">
          </div>
        </div>
      </div>
      <div class="section-title">銷貨明細</div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th class="col-seq">SEQ</th><th>品號</th><th>品名</th><th>規格</th>
              <th class="col-qty">數量</th>
              <th class="text-right">單價</th><th class="text-right">小計</th>
              <th class="col-del"></th>
            </tr>
          </thead>
          <tbody id="sales-items-body">
            <tr><td colspan="8" class="empty-row">點擊「新增品項」加入明細</td></tr>
          </tbody>
        </table>
        <div class="table-footer-bar">
          <button class="btn secondary" onclick="openProductPicker()">＋ 新增品項</button>
          <span class="total-label">合計：<strong id="sales-total">$0</strong></span>
        </div>
      </div>
    </div>`,

  modals: `
    <div id="modal-product-picker" class="modal modal-lg">
      <div class="modal-header">
        <h2>選擇商品</h2>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>
      <div class="modal-body">
        <input type="text" id="product-search" class="product-search-input"
               placeholder="搜尋品號 / 品名..." oninput="filterProducts()">
        <div class="product-picker-wrap">
          <table>
            <thead>
              <tr>
                <th>品號</th><th>品名</th><th>規格</th>
                <th class="text-right">單價</th><th class="text-right">庫存</th><th></th>
              </tr>
            </thead>
            <tbody id="product-picker-body">
              <tr><td colspan="6" class="empty-row">載入中...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`,

  onShow() { initSalesForm(); }
});

// ── 初始化 ────────────────────────────────────────────────────────────────────

function initSalesForm() {
  salesItems = [];
  renderSalesItems();
  document.getElementById('sales-no').value   = generateOrderNo();
  document.getElementById('sales-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('sales-customer').value = '';
  document.getElementById('sales-remark').value   = '';
  if (isSignedIn()) loadCustomerDatalistSilent();
}

// ── 儲存銷貨單 ────────────────────────────────────────────────────────────────

async function saveSalesOrder() {
  if (!isSignedIn()) { showToast('請先登入 Google', 'error'); return; }
  const orderNo  = document.getElementById('sales-no').value;
  const customer = document.getElementById('sales-customer').value.trim();
  const date     = document.getElementById('sales-date').value;
  const remark   = document.getElementById('sales-remark').value.trim();

  if (!customer)         { showToast('請輸入客戶名稱', 'error'); return; }
  if (!salesItems.length){ showToast('請加入至少一項銷貨明細', 'error'); return; }

  const total = salesItems.reduce((s, item) => s + item.price * item.qty, 0);
  setLoading(true);
  try {
    const id = await getSaleTestId();

    // SaleM
    const saleMRows = await getSheetData(id, 'SaleM');
    if (!saleMRows.length)
      await appendRow(id, 'SaleM', ['SEQ','單號','客戶名稱','日期','總金額','備註']);
    await appendRow(id, 'SaleM',
      [Math.max(saleMRows.length, 1), orderNo, customer, date, total, remark]);

    // SaleD
    const saleDRows = await getSheetData(id, 'SaleD');
    if (!saleDRows.length)
      await appendRow(id, 'SaleD', ['SEQ','單號','品號','品名','規格','數量','單價','小計']);
    let seq = Math.max(saleDRows.length, 1);
    for (const item of salesItems)
      await appendRow(id, 'SaleD',
        [seq++, orderNo, item.id, item.name, item.spec, item.qty, item.price, item.price * item.qty]);

    // 扣減庫存
    await deductStock(id, salesItems);
    productCache = [];

    showToast(`✔ 銷貨單 ${orderNo} 已儲存`, 'success');
    initSalesForm();
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── 商品選取 Modal ────────────────────────────────────────────────────────────

async function openProductPicker() {
  if (!isSignedIn()) { showToast('請先登入 Google', 'error'); return; }
  showModal('modal-product-picker');
  document.getElementById('product-search').value = '';
  if (!productCache.length) {
    document.getElementById('product-picker-body').innerHTML =
      '<tr><td colspan="6" class="empty-row">載入商品資料中...</td></tr>';
    setLoading(true);
    try { await loadProducts(); }
    catch (e) {
      document.getElementById('product-picker-body').innerHTML =
        `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`;
      setLoading(false); return;
    } finally { setLoading(false); }
  }
  renderProductPicker(productCache);
}

function renderProductPicker(products) {
  const tbody = document.getElementById('product-picker-body');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">無符合條件的商品</td></tr>'; return;
  }
  tbody.innerHTML = products.map(p => {
    const outOfStock  = p.stock <= 0;
    const alreadyAdded = salesItems.some(i => i.id === p.id);
    const disabled = outOfStock || alreadyAdded;
    const badge = alreadyAdded ? '<span class="badge added">已加入</span>'
                : outOfStock  ? '<span class="badge no-stock">無庫存</span>' : '';
    return `<tr class="${outOfStock ? 'row-disabled' : ''}">
      <td>${esc(p.id)}</td>
      <td>${esc(p.name)} ${badge}</td>
      <td>${esc(p.spec)}</td>
      <td class="text-right">${p.price.toLocaleString()}</td>
      <td class="text-right ${p.stock <= 5 ? 'text-warn' : ''}">${p.stock}</td>
      <td><button class="btn-sm primary" onclick="addSalesItemById('${esc(p.id)}')"
          ${disabled ? 'disabled' : ''}>選取</button></td>
    </tr>`;
  }).join('');
}

function filterProducts() {
  const kw = document.getElementById('product-search').value.toLowerCase();
  renderProductPicker(productCache.filter(p =>
    p.id.toLowerCase().includes(kw) ||
    p.name.toLowerCase().includes(kw) ||
    p.spec.toLowerCase().includes(kw)
  ));
}

// ── 明細管理 ──────────────────────────────────────────────────────────────────

function addSalesItemById(productId) {
  const p = productCache.find(p => p.id === productId);
  if (!p) return;
  if (salesItems.some(i => i.id === productId)) {
    showToast(`${p.name} 已在明細中`, 'error'); return;
  }
  salesItems.push({ id: p.id, name: p.name, spec: p.spec, price: p.price, stock: p.stock, qty: 1 });
  renderSalesItems();
  hideModal();
}

function updateSalesQty(idx, val) {
  const item = salesItems[idx];
  if (!item) return;
  const qty = Math.min(Math.max(parseInt(val) || 1, 1), item.stock);
  const inputs = document.querySelectorAll('#sales-items-body .qty-input');
  if (inputs[idx]) inputs[idx].value = qty;
  item.qty = qty;
  renderSalesTotal();
}

function removeSalesItem(idx) {
  salesItems.splice(idx, 1); renderSalesItems();
}

function renderSalesItems() {
  const tbody = document.getElementById('sales-items-body');
  if (!tbody) return;
  if (!salesItems.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">點擊「新增品項」加入明細</td></tr>';
    const t = document.getElementById('sales-total'); if (t) t.textContent = '$0';
    return;
  }
  tbody.innerHTML = salesItems.map((item, idx) => `
    <tr>
      <td class="col-seq">${idx + 1}</td>
      <td>${esc(item.id)}</td><td>${esc(item.name)}</td><td>${esc(item.spec)}</td>
      <td class="col-qty">
        <div class="qty-cell">
          <input type="number" class="qty-input" value="${item.qty}" min="1" max="${item.stock}"
                 onchange="updateSalesQty(${idx},this.value)"
                 oninput="this.value=Math.min(Math.max(this.value,1),${item.stock})">
          <span class="stock-hint">/ ${item.stock}</span>
        </div>
      </td>
      <td class="text-right">${item.price.toLocaleString()}</td>
      <td class="text-right" id="subtotal-${idx}">${(item.price*item.qty).toLocaleString()}</td>
      <td class="col-del">
        <button class="icon-btn danger" onclick="removeSalesItem(${idx})" title="移除">✕</button>
      </td>
    </tr>`).join('');
  renderSalesTotal();
}

function renderSalesTotal() {
  let total = 0;
  salesItems.forEach((item, idx) => {
    const sub = item.price * item.qty; total += sub;
    const el = document.getElementById(`subtotal-${idx}`);
    if (el) el.textContent = sub.toLocaleString();
  });
  const t = document.getElementById('sales-total');
  if (t) t.textContent = '$' + total.toLocaleString();
}
