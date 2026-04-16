let tokenClient = null;
let accessToken = null;

function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: handleAuthResponse,
    error_callback: (err) => {
      showToast('登入失敗：' + (err.message || err.type), 'error');
    }
  });
  // initApp() 由 DOMContentLoaded 負責呼叫，不在這裡重複觸發
}

function handleAuthResponse(response) {
  if (response.error) {
    showError('驗證失敗：' + response.error);
    return;
  }
  accessToken = response.access_token;
  // 計算過期時間並存入 sessionStorage
  const expiresAt = Date.now() + (response.expires_in - 60) * 1000;
  sessionStorage.setItem('access_token', accessToken);
  sessionStorage.setItem('token_expires_at', expiresAt.toString());
  onSignIn();
}

function signIn() {
  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.includes('YOUR_CLIENT_ID')) {
    showError('請先在 js/config.js 設定你的 Google CLIENT_ID');
    return;
  }
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('token_expires_at');
  onSignOut();
}

function getAccessToken() {
  if (accessToken) return accessToken;
  const saved = sessionStorage.getItem('access_token');
  const expiresAt = parseInt(sessionStorage.getItem('token_expires_at') || '0');
  if (saved && Date.now() < expiresAt) {
    accessToken = saved;
    return accessToken;
  }
  return null;
}

function isSignedIn() {
  return !!getAccessToken();
}
