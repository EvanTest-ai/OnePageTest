/**
 * Google API 設定檔
 *
 * 設定步驟：
 * 1. 前往 https://console.cloud.google.com/
 * 2. 建立新專案（或選擇現有專案）
 * 3. 啟用 API：
 *    - Google Sheets API
 *    - Google Drive API
 * 4. 建立 OAuth 2.0 憑證：
 *    - 類型選擇「網頁應用程式」
 *    - 授權的 JavaScript 來源：加入 http://localhost 或你的網域
 * 5. 將下方 CLIENT_ID 替換為你的用戶端 ID
 */

const CONFIG = {
  CLIENT_ID: '387091536858-nprb9vcsnaflfasmqj81hntdtksatisf.apps.googleusercontent.com',

  // 指定 Google Drive 資料夾 ID（所有資料表都會建立在此資料夾內）
  // 取得方式：開啟 Google Drive → 進入目標資料夾 → 網址列最後一段即為 ID
  // 例：https://drive.google.com/drive/folders/1A2B3C4D5E  → FOLDER_ID = '1A2B3C4D5E'
  // 若留空或填 '' 則存放在「我的雲端硬碟」根目錄
  FOLDER_ID: '1gSFA1LgRk4JI8fsOdses8Hz35tl06yzf',

  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ].join(' ')
};
