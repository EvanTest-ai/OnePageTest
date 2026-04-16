// ════════════════════════════════════════════════════════════════════════════
// 客戶管理
// ════════════════════════════════════════════════════════════════════════════

registerPage('customer-mgmt', {
  html: `
    <div id="page-customer-mgmt" class="page">
      <div class="page-header">
        <h1>客戶管理</h1>
        <button class="btn primary" onclick="openCustomerModal(-1)">＋ 新增客戶</button>
      </div>
      <div id="customer-mgmt-summary" class="list-summary" style="display:none"></div>
      <div class="stub-table">
        <table>
          <thead>
            <tr>
              <th>客戶名稱</th><th>聯絡人</th><th>電話</th>
              <th>地址</th><th>備註</th>
              <th style="width:120px"></th>
            </tr>
          </thead>
          <tbody id="customer-mgmt-body">
            <tr><td colspan="6" class="empty-row">載入中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`,

  modals: `
    <div id="modal-customer" class="modal">
      <div class="modal-header">
        <h2 id="modal-customer-title">新增客戶</h2>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>客戶名稱</label>
          <input type="text" id="cm-name" placeholder="客戶名稱（必填）">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>聯絡人</label>
            <input type="text" id="cm-contact" placeholder="聯絡人姓名">
          </div>
          <div class="form-group">
            <label>電話</label>
            <input type="text" id="cm-phone" placeholder="聯絡電話">
          </div>
        </div>
        <div class="form-group">
          <label>地址</label>
          <input type="text" id="cm-address" placeholder="地址">
        </div>
        <div class="form-group">
          <label>備註</label>
          <input type="text" id="cm-remark" placeholder="備註">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="hideModal()">取消</button>
        <button class="btn primary" onclick="saveCustomerModal()">儲存</button>
      </div>
    </div>`,

  onShow() { loadCustomerMgmt(); }
});

// ── 客戶 Datalist（供銷貨開單使用）────────────────────────────────────────────

function updateCustomerDatalist() {
  const dl = document.getElementById('customer-datalist');
  if (!dl) return;
  dl.innerHTML = customerMgmtCache.map(c => `<option value="${esc(c.name)}">`).join('');
}

async function loadCustomerDatalistSilent() {
  try {
    if (customerMgmtCache.length) { updateCustomerDatalist(); return; }
    const id = await getSaleTestId();
    await ensureCustomerSheet(id);
    const rows = await getSheetData(id, 'Customer');
    customerMgmtCache = [];
    for (let i = 1; i < rows.length; i++) {
      const name = (rows[i][1]??'').toString().trim();
      if (!name) continue;
      customerMgmtCache.push({
        rowIndex: i + 1, seq: (rows[i][0]??'').toString().trim(), name,
        contact: (rows[i][2]??'').toString().trim(),
        phone:   (rows[i][3]??'').toString().trim(),
        address: (rows[i][4]??'').toString().trim(),
        remark:  (rows[i][5]??'').toString().trim()
      });
    }
    updateCustomerDatalist();
  } catch (e) { /* silently fail */ }
}

// ── 載入 / 渲染 ───────────────────────────────────────────────────────────────

async function loadCustomerMgmt() {
  const body = document.getElementById('customer-mgmt-body');
  if (!body) return;
  if (!isSignedIn()) {
    body.innerHTML = '<tr><td colspan="6" class="empty-row">請先登入 Google</td></tr>'; return;
  }
  setLoading(true);
  try {
    const id = await getSaleTestId();
    await ensureCustomerSheet(id);
    const rows = await getSheetData(id, 'Customer');
    customerMgmtCache = [];
    for (let i = 1; i < rows.length; i++) {
      const name = (rows[i][1]??'').toString().trim();
      if (!name) continue;
      customerMgmtCache.push({
        rowIndex: i + 1, seq: (rows[i][0]??'').toString().trim(), name,
        contact: (rows[i][2]??'').toString().trim(),
        phone:   (rows[i][3]??'').toString().trim(),
        address: (rows[i][4]??'').toString().trim(),
        remark:  (rows[i][5]??'').toString().trim()
      });
    }
    updateCustomerDatalist();
    const summary = document.getElementById('customer-mgmt-summary');
    if (summary) { summary.style.display = ''; summary.textContent = `共 ${customerMgmtCache.length} 位客戶`; }
    if (!customerMgmtCache.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-row">尚無客戶資料，點擊「新增客戶」建立</td></tr>'; return;
    }
    body.innerHTML = customerMgmtCache.map((c, idx) => `
      <tr>
        <td>${esc(c.name)}</td><td>${esc(c.contact)}</td><td>${esc(c.phone)}</td>
        <td>${esc(c.address)}</td><td>${esc(c.remark)}</td>
        <td class="td-ops">
          <button class="btn-sm primary" onclick="openCustomerModal(${idx})">編輯</button>
          <button class="btn-sm danger"  onclick="confirmDeleteCustomer(${idx})">刪除</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="empty-row">${esc(e.message)}</td></tr>`;
  } finally { setLoading(false); }
}

// ── Modal 開啟 / 儲存 / 刪除 ──────────────────────────────────────────────────

function openCustomerModal(idx) {
  const isEdit = idx >= 0;
  document.getElementById('modal-customer-title').textContent = isEdit ? '編輯客戶' : '新增客戶';
  document.getElementById('modal-customer').dataset.idx = idx;
  if (isEdit) {
    const c = customerMgmtCache[idx];
    document.getElementById('cm-name').value    = c.name;
    document.getElementById('cm-contact').value = c.contact;
    document.getElementById('cm-phone').value   = c.phone;
    document.getElementById('cm-address').value = c.address;
    document.getElementById('cm-remark').value  = c.remark;
  } else {
    ['cm-name','cm-contact','cm-phone','cm-address','cm-remark']
      .forEach(id => { document.getElementById(id).value = ''; });
  }
  showModal('modal-customer');
}

async function saveCustomerModal() {
  const idx    = parseInt(document.getElementById('modal-customer').dataset.idx);
  const isEdit = idx >= 0;
  const name    = document.getElementById('cm-name').value.trim();
  const contact = document.getElementById('cm-contact').value.trim();
  const phone   = document.getElementById('cm-phone').value.trim();
  const address = document.getElementById('cm-address').value.trim();
  const remark  = document.getElementById('cm-remark').value.trim();

  if (!name) { showToast('請輸入客戶名稱', 'error'); return; }
  if (!isEdit && customerMgmtCache.some(c => c.name === name)) {
    showToast(`客戶「${name}」已存在`, 'error'); return;
  }
  hideModal();
  setLoading(true);
  try {
    const id = await getSaleTestId();
    if (isEdit) {
      const c = customerMgmtCache[idx];
      await updateRow(id, 'Customer', c.rowIndex, [c.seq || String(idx+1), name, contact, phone, address, remark]);
      showToast(`✔「${name}」已更新`, 'success');
    } else {
      const rows = await getSheetData(id, 'Customer');
      await appendRow(id, 'Customer', [Math.max(rows.length, 1), name, contact, phone, address, remark]);
      showToast(`✔「${name}」已新增`, 'success');
    }
    customerMgmtCache = [];
    await loadCustomerMgmt();
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

async function confirmDeleteCustomer(idx) {
  const c = customerMgmtCache[idx];
  if (!confirm(`確定要刪除客戶「${c.name}」？此操作無法復原。`)) return;
  setLoading(true);
  try {
    const id = await getSaleTestId();
    await deleteRow(id, 'Customer', c.rowIndex);
    customerMgmtCache = [];
    showToast(`已刪除「${c.name}」`, 'success');
    await loadCustomerMgmt();
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}
