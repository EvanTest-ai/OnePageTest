// ════════════════════════════════════════════════════════════════════════════
// 全域狀態
// ════════════════════════════════════════════════════════════════════════════

let state = {
  spreadsheetId: null, spreadsheetName: '',
  sheetName: null, sheets: [], headers: [], data: []
};

let salesItems        = [];
let productCache      = [];
let saleTestId        = null;
let saleMCache        = [];
let salesChart        = null;
let productMgmtCache  = [];
let customerMgmtCache = [];
let stockLogCache     = [];
let stockLogSheetReady   = false;
let customerSheetReady   = false;

// ════════════════════════════════════════════════════════════════════════════
// 頁面模組登錄機制
// ════════════════════════════════════════════════════════════════════════════

const PAGE_REGISTRY = {};

function registerPage(name, module) {
  PAGE_REGISTRY[name] = module;
}

// ════════════════════════════════════════════════════════════════════════════
// HTML 轉義
// ════════════════════════════════════════════════════════════════════════════

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ════════════════════════════════════════════════════════════════════════════
// Toast / Loading / Modal
// ════════════════════════════════════════════════════════════════════════════

let _toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function setLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showModal(id) {
  document.getElementById(id).classList.add('active');
  document.getElementById('overlay').classList.add('active');
}

function hideModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById('overlay').classList.remove('active');
}

// ════════════════════════════════════════════════════════════════════════════
// 單號產生 / SaleTest ID
// ════════════════════════════════════════════════════════════════════════════

function generateOrderNo() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `S${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function getSaleTestId() {
  if (saleTestId) return saleTestId;
  const file = await findSpreadsheetByName('SaleTest');
  if (!file) throw new Error('找不到「SaleTest」試算表，請確認已建立於指定資料夾');
  saleTestId = file.id;
  return saleTestId;
}

// ════════════════════════════════════════════════════════════════════════════
// 商品快取
// ════════════════════════════════════════════════════════════════════════════

async function loadProducts() {
  const id   = await getSaleTestId();
  const info = await getSpreadsheetInfo(id);
  if (!info.sheets.some(s => s.properties.title === 'Product'))
    throw new Error('找不到「Product」工作表');
  const rows = await getSheetData(id, 'Product');
  productCache = rows.slice(1).map(r => ({
    id:    (r[0] ?? '').toString().trim(),
    name:  (r[1] ?? '').toString().trim(),
    spec:  (r[2] ?? '').toString().trim(),
    price: parseFloat(r[3]) || 0,
    stock: parseInt(r[4])   || 0
  })).filter(p => p.id !== '');
}

// ════════════════════════════════════════════════════════════════════════════
// 安全庫存 (localStorage)
// ════════════════════════════════════════════════════════════════════════════

function getSafetyStock(productId) {
  return parseInt(JSON.parse(localStorage.getItem('safetyStocks') || '{}')[productId]) || 0;
}

function setSafetyStock(productId, qty) {
  const data = JSON.parse(localStorage.getItem('safetyStocks') || '{}');
  if (qty > 0) data[productId] = qty; else delete data[productId];
  localStorage.setItem('safetyStocks', JSON.stringify(data));
}

// ════════════════════════════════════════════════════════════════════════════
// 確保分頁存在
// ════════════════════════════════════════════════════════════════════════════

async function ensureSheet(id, name, headers) {
  const info = await getSpreadsheetInfo(id);
  if (!info.sheets.some(s => s.properties.title === name)) {
    await addSheet(id, name);
    await appendRow(id, name, headers);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 庫存扣減（銷貨儲存時呼叫）
// ════════════════════════════════════════════════════════════════════════════

async function deductStock(spreadsheetId, soldItems) {
  const rows = await getSheetData(spreadsheetId, 'Product');
  const map  = {};
  for (let i = 1; i < rows.length; i++) {
    const id = (rows[i][0] ?? '').toString().trim();
    if (id) map[id] = { rowIndex: i + 1, data: rows[i] };
  }
  for (const item of soldItems) {
    const entry = map[item.id];
    if (!entry) continue;
    const newStock = Math.max(0, (parseInt(entry.data[4]) || 0) - item.qty);
    await updateRow(spreadsheetId, 'Product', entry.rowIndex, [
      entry.data[0] ?? '', entry.data[1] ?? '',
      entry.data[2] ?? '', entry.data[3] ?? '', newStock
    ]);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 入出庫記錄寫入
// ════════════════════════════════════════════════════════════════════════════

async function appendStockLog(spreadsheetId, date, type, prodId, prodName, qty, remark) {
  if (!stockLogSheetReady) {
    await ensureSheet(spreadsheetId, 'StockLog',
      ['SEQ', '日期', '類型', '品號', '品名', '數量', '備註']);
    stockLogSheetReady = true;
  }
  const rows = await getSheetData(spreadsheetId, 'StockLog');
  await appendRow(spreadsheetId, 'StockLog',
    [Math.max(rows.length, 1), date, type, prodId, prodName, qty, remark]);
}

// ════════════════════════════════════════════════════════════════════════════
// 客戶分頁確認
// ════════════════════════════════════════════════════════════════════════════

async function ensureCustomerSheet(id) {
  if (!customerSheetReady) {
    await ensureSheet(id, 'Customer',
      ['SEQ', '客戶名稱', '聯絡人', '電話', '地址', '備註']);
    customerSheetReady = true;
  }
}
