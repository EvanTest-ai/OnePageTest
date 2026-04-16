// ════════════════════════════════════════════════════════════════════════════
// 銷貨查詢 + 作廢
// ════════════════════════════════════════════════════════════════════════════

registerPage('sales-list', {
  html: `
    <div id="page-sales-list" class="page">
      <div class="page-header">
        <h1>銷貨查詢</h1>
        <button class="btn primary" onclick="showPage('sales-new')">＋ 新增銷貨單</button>
      </div>
      <div class="search-bar">
        <input type="text" id="sl-keyword" placeholder="搜尋單號 / 客戶...">
        <input type="date" id="sl-date-from">
        <span class="date-sep">至</span>
        <input type="date" id="sl-date-to">
        <button class="btn secondary" onclick="filterSalesList()">🔍 搜尋</button>
        <button class="btn secondary" onclick="resetSalesList()">重設</button>
      </div>
      <div id="sales-list-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th class="col-seq">SEQ</th><th>單號</th><th>日期</th><th>客戶</th>
              <th class="text-right">金額</th><th>備註</th>
              <th style="width:90px"></th>
            </tr>
          </thead>
          <tbody id="sales-list-body">
            <tr><td colspan="7" class="empty-row">載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  modals: `
    <div id="modal-sale-detail" class="modal modal-lg">
      <div class="modal-header">
        <h2 id="modal-sale-detail-title">銷貨明細</h2>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>
      <div class="modal-body">
        <div id="modal-sale-detail-info" class="sale-detail-info"></div>
        <div class="product-picker-wrap">
          <table>
            <thead>
              <tr>
                <th class="col-seq">SEQ</th><th>品號</th><th>品名</th><th>規格</th>
                <th class="text-right">數量</th><th class="text-right">單價</th>
                <th class="text-right">小計</th>
              </tr>
            </thead>
            <tbody id="modal-sale-detail-body">
              <tr><td colspan="7" class="empty-row">載入中...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="sale-detail-total" id="modal-sale-detail-total"></div>
      </div>
    </div>`,

  onShow() { loadSalesList(); }
});

// ── 載入 ──────────────────────────────────────────────────────────────────────

async function loadSalesList() {
  const body = document.getElementById('sales-list-body');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="7" class="empty-row">請先登入 Google 以載入記錄</td></tr>'; return;
  }
  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'SaleM');
    saleMCache = rows.slice(1).map(row => ({
      seq:      (row[0] ?? '').toString().trim(),
      orderNo:  (row[1] ?? '').toString().trim(),
      customer: (row[2] ?? '').toString().trim(),
      date:     (row[3] ?? '').toString().trim(),
      total:    parseFloat(row[4]) || 0,
      remark:   (row[5] ?? '').toString().trim(),
      status:   (row[6] ?? '').toString().trim()
    })).filter(r => r.orderNo !== '');
    renderSalesList(saleMCache);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="7" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally {
    setLoading(false);
  }
}

function renderSalesList(orders) {
  const body    = document.getElementById('sales-list-body');
  const summary = document.getElementById('sales-list-summary');
  if (!body) return;
  if (!orders.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty-row">尚無銷貨記錄</td></tr>';
    if (summary) summary.style.display = 'none'; return;
  }
  const active   = orders.filter(r => r.status !== '作廢');
  const voidCnt  = orders.length - active.length;
  const totalAmt = active.reduce((s, r) => s + r.total, 0);
  if (summary) {
    summary.style.display = '';
    summary.textContent = voidCnt > 0
      ? `共 ${orders.length} 筆（含作廢 ${voidCnt} 筆），有效合計：$${totalAmt.toLocaleString()}`
      : `共 ${orders.length} 筆，合計金額：$${totalAmt.toLocaleString()}`;
  }
  body.innerHTML = orders.map(r => {
    const isVoid = r.status === '作廢';
    const detailBtn = `<button class="btn-sm secondary" onclick="showSaleDetail('${esc(r.orderNo)}','${esc(r.customer)}','${esc(r.date)}',${r.total})">明細</button>`;
    const voidBtn   = `<button class="btn-sm danger" onclick="voidSalesOrder('${esc(r.orderNo)}')">作廢</button>`;
    return `<tr class="${isVoid ? 'row-voided' : ''}">
      <td class="col-seq">${esc(r.seq)}</td>
      <td><code class="order-no">${esc(r.orderNo)}</code></td>
      <td>${esc(r.date)}</td><td>${esc(r.customer)}</td>
      <td class="text-right">${isVoid ? `<s>$${r.total.toLocaleString()}</s>` : `$${r.total.toLocaleString()}`}</td>
      <td>${esc(r.remark)}</td>
      <td class="td-ops">
        ${detailBtn}
        ${isVoid ? '<span class="badge no-stock">已作廢</span>' : voidBtn}
      </td>
    </tr>`;
  }).join('');
}

function filterSalesList() {
  const kw   = (document.getElementById('sl-keyword')?.value  || '').toLowerCase();
  const from =  document.getElementById('sl-date-from')?.value || '';
  const to   =  document.getElementById('sl-date-to')?.value   || '';
  renderSalesList(saleMCache.filter(r => {
    const matchKw   = !kw   || r.orderNo.toLowerCase().includes(kw) || r.customer.toLowerCase().includes(kw);
    const matchFrom = !from || r.date >= from;
    const matchTo   = !to   || r.date <= to;
    return matchKw && matchFrom && matchTo;
  }));
}

function resetSalesList() {
  document.getElementById('sl-keyword').value   = '';
  document.getElementById('sl-date-from').value = '';
  document.getElementById('sl-date-to').value   = '';
  renderSalesList(saleMCache);
}

// ── 銷貨明細 Modal ────────────────────────────────────────────────────────────

async function showSaleDetail(orderNo, customer, date, total) {
  document.getElementById('modal-sale-detail-title').textContent = `銷貨明細 — ${orderNo}`;
  document.getElementById('modal-sale-detail-info').innerHTML = `
    <span class="detail-info-item"><b>客戶：</b>${esc(customer)}</span>
    <span class="detail-info-item"><b>日期：</b>${esc(date)}</span>
    <span class="detail-info-item"><b>總金額：</b>$${Number(total).toLocaleString()}</span>`;
  document.getElementById('modal-sale-detail-body').innerHTML =
    '<tr><td colspan="7" class="empty-row">載入中...</td></tr>';
  document.getElementById('modal-sale-detail-total').textContent = '';
  showModal('modal-sale-detail');
  setLoading(true);
  try {
    const id   = await getSaleTestId();
    const rows = await getSheetData(id, 'SaleD');
    const details = rows.slice(1)
      .filter(row => (row[1] ?? '').toString().trim() === orderNo)
      .map(row => ({
        seq: (row[0]??'').toString().trim(), prodId: (row[2]??'').toString().trim(),
        name: (row[3]??'').toString().trim(), spec: (row[4]??'').toString().trim(),
        qty: parseInt(row[5])||0, price: parseFloat(row[6])||0, subtotal: parseFloat(row[7])||0
      }));
    const tbody = document.getElementById('modal-sale-detail-body');
    if (!details.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">此單無明細資料</td></tr>';
    } else {
      tbody.innerHTML = details.map(d => `
        <tr>
          <td class="col-seq">${esc(d.seq)}</td>
          <td>${esc(d.prodId)}</td><td>${esc(d.name)}</td><td>${esc(d.spec)}</td>
          <td class="text-right">${d.qty}</td>
          <td class="text-right">${d.price.toLocaleString()}</td>
          <td class="text-right">$${d.subtotal.toLocaleString()}</td>
        </tr>`).join('');
      document.getElementById('modal-sale-detail-total').textContent =
        `明細合計：$${details.reduce((s,d)=>s+d.subtotal,0).toLocaleString()}`;
    }
  } catch (e) {
    document.getElementById('modal-sale-detail-body').innerHTML =
      `<tr><td colspan="7" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}

// ── 銷貨單作廢 ────────────────────────────────────────────────────────────────

async function voidSalesOrder(orderNo) {
  if (!confirm(`確定要作廢銷貨單「${orderNo}」？\n庫存將自動回補，此操作無法復原。`)) return;
  setLoading(true);
  try {
    const id = await getSaleTestId();
    const mRows = await getSheetData(id, 'SaleM');
    let mRowIndex = -1, mRowData = null;
    for (let i = 1; i < mRows.length; i++) {
      if ((mRows[i][1]??'').toString().trim() === orderNo) {
        mRowIndex = i + 1; mRowData = mRows[i]; break;
      }
    }
    if (mRowIndex < 0) throw new Error('找不到此銷貨單');

    const dRows   = await getSheetData(id, 'SaleD');
    const details = dRows.slice(1).filter(r => (r[1]??'').toString().trim() === orderNo);

    if (details.length) {
      const pRows = await getSheetData(id, 'Product');
      for (const d of details) {
        const prodId = (d[2]??'').toString().trim();
        const qty    = parseInt(d[5]) || 0;
        for (let i = 1; i < pRows.length; i++) {
          if ((pRows[i][0]??'').toString().trim() === prodId) {
            const newStock = (parseInt(pRows[i][4])||0) + qty;
            await updateRow(id, 'Product', i+1, [
              pRows[i][0]??'', pRows[i][1]??'', pRows[i][2]??'', pRows[i][3]??'', newStock
            ]);
            break;
          }
        }
      }
    }

    await updateRow(id, 'SaleM', mRowIndex, [
      mRowData[0]??'', mRowData[1]??'', mRowData[2]??'',
      mRowData[3]??'', mRowData[4]??'', mRowData[5]??'', '作廢'
    ]);
    productCache = []; saleMCache = [];
    showToast(`✔ 銷貨單 ${orderNo} 已作廢，庫存已回補`, 'success');
    await loadSalesList();
  } catch (e) {
    showToast('作廢失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}
