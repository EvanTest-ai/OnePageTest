# 銷貨管理系統 (Sales Management System)

這是一個基於 HTML、CSS 及 JavaScript 所開發的單頁式應用程式 (SPA)，專為中小型企業或個人工作室設計的輕量級銷貨管理解決方案。本系統利用 Google Sheets 作為後端資料庫，透過 Google Identity Services 進行身分驗證，並結合多種實用工具，提供完整的進銷存管理與報表分析功能。

## 🎯 系統功能與特色

### 1. 銷貨管理
- **銷貨開單**：快速建立新的銷售紀錄。
- **銷貨查詢**：查詢歷史銷售訂單與明細。

### 2. 庫存與商品管理
- **入出庫作業**：精準管理商品的入庫與出庫流程。
- **庫存查詢**：即時掌握各項商品的當前庫存量。
- **商品管理**：維護商品基本資料、價格等資訊。
- **入出庫記錄**：完整追蹤所有庫存異動歷程。

### 3. 客戶管理
- **客戶管理**：建立與維護客戶基本資料，方便後續的查詢與出貨紀錄追蹤。

### 4. 數據報表
- **客戶銷貨統計**：提供客戶購買行為分析。
- **商品銷售排行**：以圖表化方式呈現熱銷商品，協助擬定進貨策略。

### 5. 資料管理
- **資料表列表**：方便管理者直接存取並檢視底層雲端試算表結構與內容。

## 🛠 技術堆疊 (Tech Stack)

* **前端介面**：原生 HTML, CSS, JavaScript (Vanilla JS)。
* **資料庫**：Google Sheets (透過 API 把試算表當輕量級系統資料庫)。
* **身分驗證**：Google Identity Services (Google 帳號登入整合)。
* **圖表繪製**：[Chart.js](https://www.chartjs.org/) (用於數據與報表視覺化呈現)。
* **Excel 匯出**：[SheetJS](https://sheetjs.com/) (支援一鍵匯出表格資料為 XLS)。

## 📁 專案結構 (Directory Structure)

```text
OnePageTest/
├── css/
│   └── style.css            # 全域樣式及元件 UI 設計
├── js/
│   ├── pages/               # 各頁面與功能模組 (如：首頁、報表、庫存操作等)
│   ├── app.js               # SPA 主控台、UI 事件綁定以及選單切換邏輯
│   ├── auth.js              # Google Auth Oauth2 身分驗證流程
│   ├── config.js            # 環境變數與設定（試算表 ID、權限設定等）
│   ├── sheets.js            # 操作 Google Sheets API 核心封裝函式
│   └── utils.js             # 共用工具函式庫 (Toast 提示、遮罩、匯出等)
├── doc/                     # 開發或系統相關參考文件
└── index.html               # 應用程式唯一入口點頁面
```

## 🚀 快速開始 (Quick Start)

1. 請確保專案中 `js/config.js` 跟 `js/auth.js` 已經正確配置您的 **Google OAuth 2.0 用戶端 ID** 與 **Google Sheet ID**。
2. 啟動本機伺服器 (例如使用 VS Code 擴充套件 `Live Server`) 執行 `index.html`。
3. 或者是直接將靜態檔案部署至遠端主機或平台 (如 GitHub Pages / Vercel)。
4. 開啟網頁後點擊側邊欄「登入」進行 Google 授權，成功後即可存取功能表與資料。
