// ════════════════════════════════════════════════════════════════════════════
// 路由器 / 初始化 / 側邊欄 / 認證回呼
// ════════════════════════════════════════════════════════════════════════════

// ── 視圖切換（dashboard / table）─────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${name}`);
  if (el) el.classList.add('active');
}

// ── 頁面路由（首次訪問時自動注入 HTML 與 Modal）──────────────────────────────
function showPage(name) {
  const mod = PAGE_REGISTRY[name];
  if (mod && !document.getElementById(`page-${name}`)) {
    document.getElementById('main-content').insertAdjacentHTML('beforeend', mod.html);
    if (mod.modals) document.body.insertAdjacentHTML('beforeend', mod.modals);
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  document.querySelectorAll('.menu-item').forEach(item =>
    item.classList.toggle('active', item.dataset.page === name)
  );

  if (mod && mod.onShow) mod.onShow();
}

// ── 初始化 ────────────────────────────────────────────────────────────────────
function initApp() {
  showView('dashboard');
  showPage('home');
  refreshMenuAuth();
}

// ── 認證回呼 ─────────────────────────────────────────────────────────────────
function onSignIn() {
  refreshMenuAuth();
  const active = document.querySelector('.page.active');
  if (!active) return;
  const name = active.id.replace(/^page-/, '');
  const mod = PAGE_REGISTRY[name];
  if (mod && mod.onShow) mod.onShow();
}

function onSignOut() {
  state = { spreadsheetId: null, spreadsheetName: '', sheetName: null, sheets: [], headers: [], data: [] };
  refreshMenuAuth();
  const active = document.querySelector('.page.active');
  if (!active) return;
  const name = active.id.replace(/^page-/, '');
  const mod = PAGE_REGISTRY[name];
  if (mod && mod.onShow) mod.onShow();
}

// ── 側邊欄登入狀態 ────────────────────────────────────────────────────────────
function refreshMenuAuth() {
  const btn  = document.getElementById('menu-auth-btn');
  const desc = document.getElementById('menu-auth-desc');
  const icon = document.getElementById('menu-auth-icon');
  if (!btn || !desc || !icon) return;
  if (isSignedIn()) {
    icon.textContent = '✅';
    desc.textContent = '已登入';
    btn.textContent  = '登出';
    btn.classList.add('signed-in');
  } else {
    icon.textContent = '🔑';
    desc.textContent = '登入以使用相關功能';
    btn.textContent  = '登入';
    btn.classList.remove('signed-in');
  }
}

function toggleAuth() {
  isSignedIn() ? signOut() : signIn();
}

// ── 側邊欄 / 選單群組 ────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('app-layout').classList.toggle('sidebar-hidden');
}

function toggleGroup(id) {
  document.getElementById(id).classList.toggle('open');
}

// ── GIS 載入完成 ──────────────────────────────────────────────────────────────
function gisLoaded() { initAuth(); }

document.addEventListener('DOMContentLoaded', initApp);
