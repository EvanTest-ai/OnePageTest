// ════════════════════════════════════════════════════════════════════════════
// 資料表管理（Google Drive / Sheets 列表）
// ════════════════════════════════════════════════════════════════════════════

registerPage('db-tables', {
  html: `
    <div id="page-db-tables" class="page">
      <div class="page-header">
        <h1>資料表管理</h1>
        <div class="actions">
          <input type="file" id="xls-input" accept=".xls,.xlsx" style="display:none"
                 onchange="handleXlsImport(event)">
          <button class="btn secondary" onclick="importXls()">📥 匯入 XLS</button>
          <button class="btn primary" onclick="openCreateModal()">＋ 新增資料表</button>
        </div>
      </div>
      <div id="table-list">
        <div class="empty-state"><p>載入中...</p></div>
      </div>
    </div>`,

  modals: `
    <div id="modal-row" class="modal">
      <div class="modal-header">
        <h2 id="modal-row-title">新增資料列</h2>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>
      <div class="modal-body">
        <form id="row-form" onsubmit="event.preventDefault(); saveRow();"></form>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="hideModal()">取消</button>
        <button class="btn primary" onclick="saveRow()">儲存</button>
      </div>
    </div>

    <div id="modal-create" class="modal">
      <div class="modal-header">
        <h2>新增資料表</h2>
        <button class="modal-close" onclick="hideModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>資料表名稱</label>
          <input type="text" id="new-name" placeholder="例：客戶資料">
        </div>
        <div class="form-group">
          <label>欄位名稱（以逗號分隔）</label>
          <input type="text" id="new-cols" placeholder="例：id, 姓名, Email, 電話">
          <div class="hint">建立後的第一列將作為欄位標題</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="hideModal()">取消</button>
        <button class="btn primary" onclick="createTable()">建立</button>
      </div>
    </div>`,

  onShow() { loadDashboard(); }
});

// ── 列表 ──────────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const el = document.getElementById('table-list');
  if (!el) return;
  if (!isSignedIn()) {
    const folderHint = CONFIG.FOLDER_ID
      ? `<p class="auth-folder-hint">📁 資料將存放於指定雲端資料夾</p>` : '';
    el.innerHTML = `
      <div class="auth-prompt">
        <div class="auth-prompt-icon">🔑</div>
        <p>需要登入 Google 才能存取雲端資料表</p>
        ${folderHint}
        <button class="btn primary" onclick="signIn()">使用 Google 帳號登入</button>
      </div>`; return;
  }
  setLoading(true);
  try {
    const files = await listSpreadsheets();
    renderTableCards(files);
  } catch (e) {
    showToast('載入失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

function renderTableCards(files) {
  const el = document.getElementById('table-list');
  if (!files.length) {
    el.innerHTML = '<div class="empty-state"><p>尚無資料表</p><p>點擊「新增資料表」開始使用</p></div>'; return;
  }
  el.innerHTML = files.map(f => `
    <div class="card" onclick="openSpreadsheet('${f.id}','${esc(f.name)}')">
      <div class="card-icon">📊</div>
      <div class="card-body">
        <div class="card-name">${esc(f.name)}</div>
        <div class="card-date">最後修改：${new Date(f.modifiedTime).toLocaleString('zh-TW')}</div>
      </div>
      <button class="icon-btn danger" title="刪除"
              onclick="event.stopPropagation();confirmDeleteFile('${f.id}','${esc(f.name)}')">🗑️</button>
    </div>`).join('');
}

// ── 開啟試算表 ────────────────────────────────────────────────────────────────

async function openSpreadsheet(id, name) {
  state.spreadsheetId   = id;
  state.spreadsheetName = name;
  setLoading(true);
  try {
    const info = await getSpreadsheetInfo(id);
    state.sheets    = info.sheets.map(s => s.properties.title);
    state.sheetName = state.sheets[0];
    document.getElementById('tbl-title').textContent = name;
    renderSheetTabs();
    await loadData();
    showView('table');
  } catch (e) {
    showToast('開啟失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

function renderSheetTabs() {
  document.getElementById('sheet-tabs').innerHTML = state.sheets.map(s =>
    `<button class="tab ${s === state.sheetName ? 'active' : ''}"
             onclick="switchSheet('${esc(s)}')">${esc(s)}</button>`
  ).join('');
}

async function switchSheet(name) {
  state.sheetName = name; renderSheetTabs(); await loadData();
}

async function loadData() {
  setLoading(true);
  try {
    const rows      = await getSheetData(state.spreadsheetId, state.sheetName);
    state.headers   = rows.length > 0 ? rows[0] : [];
    state.data      = rows.length > 1 ? rows.slice(1) : [];
    renderDataTable();
  } catch (e) {
    showToast('載入失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

function renderDataTable() {
  const addBtn    = document.getElementById('btn-add-row');
  const exportBtn = document.getElementById('btn-export');
  const countEl  = document.getElementById('row-count');
  const container = document.getElementById('tbl-container');
  if (!state.headers.length) {
    container.innerHTML = '<div class="empty-state"><p>此工作表尚無資料</p></div>';
    addBtn.style.display = exportBtn.style.display = 'none'; countEl.textContent = ''; return;
  }
  addBtn.style.display = exportBtn.style.display = 'inline-flex';
  countEl.textContent = `共 ${state.data.length} 筆`;
  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-num">#</th>
            ${state.headers.map(h => `<th>${esc(h)}</th>`).join('')}
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          ${state.data.length === 0
            ? `<tr><td colspan="${state.headers.length+2}" class="empty-row">尚無資料</td></tr>`
            : state.data.map((row, i) => `
              <tr>
                <td class="col-num">${i+1}</td>
                ${state.headers.map((_,ci) => `<td>${esc(row[ci]??'')}</td>`).join('')}
                <td class="col-actions">
                  <button class="btn-sm primary" onclick="openEditModal(${i})">編輯</button>
                  <button class="btn-sm danger"  onclick="confirmDeleteRow(${i})">刪除</button>
                </td>
              </tr>`).join('')
          }
        </tbody>
      </table>
    </div>`;
}

// ── 新增 / 編輯列 ────────────────────────────────────────────────────────────

function openAddModal() {
  document.getElementById('modal-row-title').textContent = '新增資料列';
  const form = document.getElementById('row-form');
  form.innerHTML = state.headers.map(h =>
    `<div class="form-group"><label>${esc(h)}</label>
     <input type="text" name="${esc(h)}" placeholder="${esc(h)}"></div>`
  ).join('');
  form.dataset.mode = 'add'; delete form.dataset.idx;
  showModal('modal-row');
}

function openEditModal(idx) {
  document.getElementById('modal-row-title').textContent = '編輯資料列';
  const row  = state.data[idx];
  const form = document.getElementById('row-form');
  form.innerHTML = state.headers.map((h, ci) =>
    `<div class="form-group"><label>${esc(h)}</label>
     <input type="text" name="${esc(h)}" value="${esc(row[ci]??'')}"></div>`
  ).join('');
  form.dataset.mode = 'edit'; form.dataset.idx = idx;
  showModal('modal-row');
}

async function saveRow() {
  const form   = document.getElementById('row-form');
  const values = Array.from(form.querySelectorAll('input')).map(i => i.value);
  hideModal(); setLoading(true);
  try {
    if (form.dataset.mode === 'add') {
      await appendRow(state.spreadsheetId, state.sheetName, values);
    } else {
      await updateRow(state.spreadsheetId, state.sheetName, parseInt(form.dataset.idx)+2, values);
    }
    await loadData(); showToast('儲存成功', 'success');
  } catch (e) {
    showToast('儲存失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

async function confirmDeleteRow(idx) {
  if (!confirm(`確定要刪除第 ${idx+1} 筆資料嗎？`)) return;
  setLoading(true);
  try {
    await deleteRow(state.spreadsheetId, state.sheetName, idx+2);
    await loadData(); showToast('已刪除', 'success');
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

// ── 新增資料表 ────────────────────────────────────────────────────────────────

function openCreateModal() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-cols').value = 'id, 姓名, Email, 電話, 建立日期';
  showModal('modal-create');
}

async function createTable() {
  const name = document.getElementById('new-name').value.trim();
  const cols = document.getElementById('new-cols').value.split(',').map(c=>c.trim()).filter(Boolean);
  if (!name) { showToast('請輸入資料表名稱', 'error'); return; }
  if (!cols.length) { showToast('請至少輸入一個欄位', 'error'); return; }
  hideModal(); setLoading(true);
  try {
    const res = await createSpreadsheet(name, cols);
    showToast(`「${name}」已建立`, 'success');
    await loadDashboard();
    await openSpreadsheet(res.spreadsheetId, name);
  } catch (e) {
    showToast('建立失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

async function confirmDeleteFile(id, name) {
  if (!confirm(`確定要刪除「${name}」？此操作無法復原。`)) return;
  setLoading(true);
  try {
    await deleteFile(id);
    showToast(`已刪除「${name}」`, 'success');
    await loadDashboard();
  } catch (e) {
    showToast('刪除失敗：' + e.message, 'error');
  } finally { setLoading(false); }
}

// ── 匯入 / 匯出 XLS ────────────────────────────────────────────────────────

function importXls() { document.getElementById('xls-input').click(); }

async function handleXlsImport(event) {
  const file = event.target.files[0]; if (!file) return;
  setLoading(true);
  try {
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data, { type: 'array' });
    const wsName = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, defval: '' });
    if (!rows.length) { showToast('XLS 檔案無資料', 'error'); return; }
    const tableName = file.name.replace(/\.(xlsx?|xls)$/i, '');
    const res = await createSpreadsheet(tableName, rows[0]);
    if (rows.length > 1) {
      const range = encodeURIComponent('Sheet1!A2');
      const url   = `${SHEETS_BASE}/${res.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getAccessToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows.slice(1) })
      });
    }
    showToast(`已匯入「${tableName}」，共 ${rows.length-1} 筆`, 'success');
    await loadDashboard();
    await openSpreadsheet(res.spreadsheetId, tableName);
  } catch (e) {
    showToast('匯入失敗：' + e.message, 'error');
  } finally { setLoading(false); event.target.value = ''; }
}

function exportXls() {
  if (!state.headers.length) { showToast('無資料可匯出', 'error'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([state.headers, ...state.data]);
  ws['!cols'] = state.headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, state.sheetName || 'Sheet1');
  XLSX.writeFile(wb, `${state.spreadsheetName}.xlsx`);
  showToast('Excel 檔已下載', 'success');
}

function backToDashboard() { showView('dashboard'); showPage('db-tables'); }
