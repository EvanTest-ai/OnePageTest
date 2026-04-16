# 銷貨管理系統 — 系統規格書

> 版本：1.0.0　最後更新：2026-04-10

---

## 目錄

1. [系統概述](#1-系統概述)
2. [技術架構](#2-技術架構)
3. [目錄結構](#3-目錄結構)
4. [Google Cloud 設定](#4-google-cloud-設定)
5. [Google Drive 資料庫設計](#5-google-drive-資料庫設計)
6. [功能模組](#6-功能模組)
7. [資料流程](#7-資料流程)
8. [API 函式說明](#8-api-函式說明)
9. [設定檔說明](#9-設定檔說明)
10. [開發待辦](#10-開發待辦)

---

## 1. 系統概述

**純前端**銷貨管理系統，無後端伺服器。以 **Google 雲端硬碟**作為資料庫，所有資料存放在指定資料夾內的 Google Sheets 試算表，支援 XLS 匯入 / 匯出。

### 設計原則

| 項目 | 說明 |
|------|------|
| 前端技術 | 純 HTML / CSS / JavaScript（無框架） |
| 資料庫 | Google Sheets（透過 Sheets API v4） |
| 檔案儲存 | Google Drive（透過 Drive API v3） |
| 認證 | Google Identity Services（OAuth 2.0） |
| XLS 處理 | SheetJS (xlsx 0.20.3) |
| 字型 | Noto Sans TC（Google Fonts） |

### 特性

- 不需登入即可瀏覽選單與 UI
- 僅在操作 Google Drive 資料時才觸發 OAuth 登入
- 所有資料限定存放於 `config.js` 指定的 Drive 資料夾

---

## 2. 技術架構

```
瀏覽器（純前端）
    │
    ├── index.html          UI 主體（多視圖、多頁面）
    ├── css/style.css       全域樣式
    └── js/
        ├── config.js       Google API 設定、資料夾 ID
        ├── auth.js         OAuth 2.0 token 管理
        ├── sheets.js       Google Sheets / Drive API 封裝
        └── app.js          應用邏輯、選單、頁面切換

外部相依（CDN）
    ├── SheetJS xlsx.full.min.js    XLS 匯入 / 匯出
    ├── Google Identity Services    OAuth 登入
    └── Google Fonts Noto Sans TC   字型
```

### 視圖架構

```
view-dashboard（主應用）
    ├── Topbar（☰ 品牌）
    ├── Sidebar（Menu Tree）
    └── Content Area（各功能頁面）

view-table（Google Sheets 原始資料表瀏覽）
```

---

## 3. 目錄結構

```
Evan_Test/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── auth.js
│   ├── sheets.js
│   └── app.js
└── doc/
    └── specification.md        ← 本文件
```

---

## 4. Google Cloud 設定

### 4.1 前置作業

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選擇專案
3. 啟用以下 API：
   - **Google Sheets API**
   - **Google Drive API**
4. 建立 OAuth 2.0 憑證
   - 類型：**網頁應用程式**
   - 授權的 JavaScript 來源：加入你的網域（本機開發用 `http://localhost`）
5. 複製 **用戶端 ID**，填入 `js/config.js`

### 4.2 OAuth 範圍（Scopes）

| Scope | 用途 |
|-------|------|
| `https://www.googleapis.com/auth/spreadsheets` | 讀寫 Google Sheets |
| `https://www.googleapis.com/auth/drive` | 讀寫 Google Drive 檔案 |

### 4.3 Token 管理

- Token 存放於 `sessionStorage`（頁籤關閉即清除）
- 自動計算過期時間（提前 60 秒視為過期）
- GIS（Google Identity Services）靜默載入，不自動彈出登入視窗

---

## 5. Google Drive 資料庫設計

### 5.1 資料夾結構

```
Google Drive
└── [指定資料夾 FOLDER_ID]
    └── SaleTest.xlsx           主要試算表
```

`FOLDER_ID` 取得方式：開啟 Google Drive → 進入目標資料夾 → 網址列最後一段即為 ID。
例：`https://drive.google.com/drive/folders/`**`1gSFA1LgRk4JI8fsOdses8Hz35tl06yzf`**

### 5.2 SaleTest 試算表結構

試算表名稱：**`SaleTest`**，包含三個工作表（Sheet）：

---

#### Sheet 1：Product（商品主檔）

| 欄 | 欄位名稱 | 說明 |
|----|----------|------|
| A | 欄位 A (ID/Key) | 品號（唯一鍵） |
| B | 欄位 B (名稱) | 商品中文名稱 |
| C | 欄位 C (規格) | 規格說明（選填） |
| D | 欄位 D (單價) | 售價（數字） |
| E | 欄位 E (數量) | 庫存數量（數字） |
| F | 欄位 F (總值) | 小計公式欄（選填，系統不使用） |

**資料列規則：**
- Row 1：欄位標題列（系統讀取時跳過）
- Row 2：欄位說明列（系統讀取時跳過）
- Row 3 起：實際商品資料

**範例資料：**

| A | B | C | D | E |
|---|---|---|---|---|
| ProductA | 商品 A | 500ml | 100 | 20 |
| ProductB | 商品 B | 600ml | 120 | 30 |
| ProductC | 商品 C | 700ml | 140 | 40 |

---

#### Sheet 2：SaleM（銷貨主檔）

| 欄 | 欄位名稱 | 說明 |
|----|----------|------|
| A | SEQ | 連續序號（跨訂單累計） |
| B | 單號 | 格式：`S` + `YYYYMMDDHHMMSS` |
| C | 客戶名稱 | 文字 |
| D | 日期 | `YYYY-MM-DD` |
| E | 總金額 | 該訂單所有品項小計加總 |
| F | 備註 | 選填 |

- Row 1：標題列（系統首次使用時自動建立）
- Row 2 起：實際訂單資料

---

#### Sheet 3：SaleD（銷貨明細檔）

| 欄 | 欄位名稱 | 說明 |
|----|----------|------|
| A | SEQ | 連續序號（跨訂單所有明細累計） |
| B | 單號 | 對應 SaleM 的單號（外鍵） |
| C | 品號 | 對應 Product 的 ID |
| D | 品名 | 商品名稱（寫入時快照） |
| E | 規格 | 商品規格（寫入時快照） |
| F | 數量 | 銷售數量 |
| G | 單價 | 銷售單價（寫入時快照） |
| H | 小計 | 數量 × 單價 |

- Row 1：標題列（系統首次使用時自動建立）
- Row 2 起：實際明細資料

---

### 5.3 單號規則

```
格式：S + YYYYMMDDHHMMSS
範例：S20260410143025
      ↑ ↑↑↑↑↑↑↑↑↑↑↑↑↑↑
      S 年  月日時分秒
```

以建立時的本機時間產生，同一秒內不可重複開單。

### 5.4 SEQ 規則

- **SaleM**：每張訂單各佔一列，SEQ 從 1 開始跨訂單累計
- **SaleD**：每個品項各佔一列，SEQ 從 1 開始跨所有訂單的所有明細累計
- 兩個工作表的 SEQ 彼此獨立

---

## 6. 功能模組

### 6.1 選單樹（Menu Tree）

```
銷貨管理系統
├── 🛒 銷貨
│   ├── 銷貨開單      [sales-new]
│   └── 銷貨記錄      [sales-list]   （開發中）
├── 🔍 查詢
│   ├── 銷貨查詢      [query-sales]  （開發中）
│   └── 庫存查詢      [query-inventory]（開發中）
├── 📦 庫存
│   ├── 庫存清單      [inv-list]     （開發中）
│   ├── 入庫作業      [inv-in]       （開發中）
│   └── 出庫作業      [inv-out]      （開發中）
└── ⚙️ 資料管理
    └── 資料表列表    [db-tables]    （需 Google 登入）
```

選單群組可點擊收合（`▾` 箭頭），側邊欄可透過 `☰` 按鈕整體收合。

---

### 6.2 銷貨開單（sales-new）

**功能：** 建立新銷貨單並寫入 SaleTest > SaleM + SaleD

**表單欄位：**

| 欄位 | 說明 | 備註 |
|------|------|------|
| 單號 | 自動產生 | 唯讀，格式 `S+YYYYMMDDHHMMSS` |
| 日期 | 預設今日 | 可修改 |
| 客戶名稱 | 必填 | 文字 |
| 備註 | 選填 | 文字 |

**銷貨明細：**

| 欄位 | 說明 |
|------|------|
| SEQ | 自動編號，從 1 起 |
| 品號 | 從 Product 工作表選取 |
| 品名 | 自動帶入 |
| 規格 | 自動帶入 |
| 數量 | 可修改，最小 1，最大為該品項庫存量（超出自動截斷） |
| 單價 | 自動帶入，唯讀 |
| 小計 | 即時計算（單價 × 數量） |

**商品選取 Modal：**

- 從 `Product` 工作表讀取商品（Row 3 起）
- 支援以品號 / 品名 / 規格即時篩選
- 庫存 = 0 的商品標示「無庫存」並停用選取
- 已加入明細的商品標示「已加入」並停用選取
- 庫存 ≤ 5 以紅色警示顯示

**儲存流程：**

```
驗證（客戶名稱 + 明細不空）
  ↓
讀取 SaleM 現有列數 → 計算 SEQ
寫入 SaleM 一列（主檔）
  ↓
讀取 SaleD 現有列數 → 計算起始 SEQ
逐一寫入 SaleD（每個品項一列）
  ↓
Toast 顯示成功訊息
清空表單，自動產生下一張單號
```

---

### 6.3 銷貨記錄（sales-list）

**定位：** 全量訂單清單，自動載入 SaleM 所有資料，可點「明細」查看該單的 SaleD 品項。

**狀態：** 開發中

---

### 6.4 銷貨查詢（query-sales）

**定位：** 條件式查詢，輸入條件後才執行，可跨單號、客戶、日期範圍過濾，結果展示含品項明細。

**與銷貨記錄的差異：**

| | 銷貨記錄 | 銷貨查詢 |
|-|----------|----------|
| 載入時機 | 進頁面自動載入 | 點查詢按鈕後才載入 |
| 預設顯示 | 全部訂單 | 空白，等待條件輸入 |
| 顯示層級 | 訂單主檔列表（SaleM） | 訂單含品項展開（SaleM + SaleD） |
| 適用場景 | 日常瀏覽、最新訂單 | 特定客戶/品項/時段的精確查找 |

**狀態：** 開發中

---

### 6.5 庫存查詢（query-inventory）

**定位：** 依品號 / 品名查詢 Product 工作表庫存現況。

**狀態：** 開發中

---

### 6.6 庫存清單（inv-list）

**定位：** 顯示 Product 工作表所有品項庫存，支援 XLS 匯出。

**狀態：** 開發中

---

### 6.7 入庫作業（inv-in）

**定位：** 輸入品號與數量，更新 Product 工作表 E 欄庫存（＋加）。

**狀態：** 開發中

---

### 6.8 出庫作業（inv-out）

**定位：** 輸入品號與數量，更新 Product 工作表 E 欄庫存（－減），不可低於 0。

**狀態：** 開發中

---

### 6.9 資料表管理（db-tables）

**定位：** 瀏覽與管理 Google Drive 指定資料夾內的所有試算表，提供 CRUD 操作與 XLS 匯入。

**功能：**

| 功能 | 說明 |
|------|------|
| 列出試算表 | 顯示指定資料夾內所有 Spreadsheet，依修改時間排序 |
| 開啟試算表 | 進入原始 Sheets 瀏覽模式（view-table），支援多 Sheet 切換 |
| 新增資料表 | 輸入名稱與欄位，自動建立並移入指定資料夾 |
| 匯入 XLS | 上傳 `.xls/.xlsx`，自動建立試算表並匯入資料 |
| 匯出 XLS | 下載目前瀏覽的工作表為 `.xlsx` |
| 刪除資料表 | 目前鎖定（測試保護用，`deleteFile` 已停用） |
| 新增 / 編輯 / 刪除列 | 直接在 Sheets 原始視圖操作 |

**需要 Google 登入：** 進入此頁面若未登入，會顯示登入提示。

---

## 7. 資料流程

### 7.1 銷貨開單完整流程

```
使用者操作                   系統行為
─────────                   ─────────
點「銷貨開單」              initSalesForm()
                             ├── salesItems = []
                             ├── 單號 = S+YYYYMMDDHHMMSS
                             └── 日期 = 今日

點「新增品項」              openProductPicker()
                             ├── 未登入 → Toast 提示
                             ├── 無快取 → loadProducts()
                             │    ├── getSaleTestId()
                             │    ├── getSpreadsheetInfo()
                             │    └── getSheetData('Product') → productCache
                             └── renderProductPicker()

搜尋關鍵字                  filterProducts() → renderProductPicker()

點「選取」                  addSalesItemById(id)
                             └── salesItems.push({...})
                                 renderSalesItems()

修改數量欄                  updateSalesQty(idx, val)
                             ├── 限制範圍 [1, stock]
                             └── renderSalesTotal()

點「儲存」                  saveSalesOrder()
                             ├── 驗證欄位
                             ├── getSaleTestId()
                             ├── 讀 SaleM → 計算 SEQ → appendRow(SaleM)
                             ├── 讀 SaleD → 計算 SEQ → appendRow(SaleD) × N
                             ├── Toast 成功
                             └── initSalesForm()（清空準備下一單）
```

### 7.2 Google Drive 認證流程

```
頁面載入
  └── DOMContentLoaded → initApp()
        └── showView('dashboard') + showPage('home')

GIS 腳本載入完成
  └── gisLoaded() → initAuth()
        └── 初始化 tokenClient（不彈出登入視窗）

使用者點「登入」（資料管理頁或開單頁）
  └── signIn() → tokenClient.requestAccessToken()
        └── handleAuthResponse()
              ├── accessToken 存入 sessionStorage
              └── onSignIn() → 刷新目前頁面
```

---

## 8. API 函式說明

### 8.1 sheets.js — Drive API

| 函式 | 說明 |
|------|------|
| `listSpreadsheets()` | 列出指定資料夾內所有試算表（依 `CONFIG.FOLDER_ID` 過濾） |
| `findSpreadsheetByName(name)` | 依名稱搜尋試算表，回傳第一筆 `{id, name}` |
| `deleteFile(fileId)` | 刪除檔案（目前已鎖定為測試保護） |
| `createSpreadsheet(name, cols)` | 建立試算表並移入指定資料夾 |

### 8.2 sheets.js — Sheets API

| 函式 | 說明 |
|------|------|
| `getSpreadsheetInfo(id)` | 取得試算表屬性與所有 Sheet 清單 |
| `getSheetData(id, sheetName)` | 讀取整個工作表，回傳 `string[][]` |
| `appendRow(id, sheetName, values)` | 在工作表末尾新增一列 |
| `updateRow(id, sheetName, rowIndex, values)` | 更新指定列（1-based，含標題） |
| `deleteRow(id, sheetName, rowIndex)` | 刪除指定列（使用 batchUpdate） |
| `addSheet(id, sheetName)` | 新增工作表分頁 |
| `deleteSheet(id, sheetName)` | 刪除工作表分頁 |

### 8.3 auth.js

| 函式 | 說明 |
|------|------|
| `initAuth()` | 初始化 GIS tokenClient（由 `gisLoaded()` 呼叫） |
| `signIn()` | 觸發 OAuth 登入彈窗 |
| `signOut()` | 撤銷 token 並清除 sessionStorage |
| `getAccessToken()` | 取得有效 token（優先記憶體，其次 sessionStorage） |
| `isSignedIn()` | 是否已登入（token 存在且未過期） |

### 8.4 app.js — 核心函式

| 函式 | 說明 |
|------|------|
| `initApp()` | 頁面載入入口，直接顯示主畫面 |
| `showPage(name)` | 切換頁面（更新 active class、觸發頁面初始化） |
| `toggleSidebar()` | 展開 / 收合側邊欄 |
| `toggleGroup(id)` | 展開 / 收合選單群組 |
| `generateOrderNo()` | 產生單號：`S` + `YYYYMMDDHHMMSS` |
| `getSaleTestId()` | 取得 SaleTest 試算表 ID（帶快取） |
| `loadProducts()` | 從 SaleTest > Product 載入商品快取 |
| `openProductPicker()` | 開啟商品選取 Modal |
| `filterProducts()` | 即時過濾商品清單 |
| `initSalesForm()` | 初始化銷貨開單表單 |
| `saveSalesOrder()` | 儲存銷貨單至 SaleM + SaleD |
| `addSalesItemById(id)` | 加入品項至明細 |
| `updateSalesQty(idx, val)` | 更新品項數量（含庫存上限驗證） |
| `removeSalesItem(idx)` | 移除品項 |
| `renderSalesItems()` | 重繪明細表格 |
| `renderSalesTotal()` | 更新小計與合計金額 |

---

## 9. 設定檔說明

### js/config.js

```javascript
const CONFIG = {
  // Google OAuth 2.0 用戶端 ID
  CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',

  // Google Drive 指定資料夾 ID
  // 網址列：https://drive.google.com/drive/folders/[FOLDER_ID]
  // 留空 '' 則使用 My Drive 根目錄
  FOLDER_ID: '',

  // OAuth 授權範圍（請勿修改）
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ].join(' ')
};
```

---

## 10. 開發待辦

### 高優先度

| 功能 | 頁面 | 說明 |
|------|------|------|
| 銷貨記錄 | sales-list | 自動載入 SaleM，點明細展開 SaleD |
| 銷貨查詢 | query-sales | 條件查詢（單號/客戶/日期範圍），展開品項明細 |
| 庫存查詢 | query-inventory | 依品號/品名查詢 Product 庫存 |

### 中優先度

| 功能 | 頁面 | 說明 |
|------|------|------|
| 庫存清單 | inv-list | 顯示 Product 全部品項，支援 XLS 匯出 |
| 入庫作業 | inv-in | 品號輸入 → 更新 Product E 欄（+ 加） |
| 出庫作業 | inv-out | 品號輸入 → 更新 Product E 欄（- 減，不可 < 0） |
| 首頁統計 | home | 本月銷貨筆數、金額、庫存品項、警示數 |

### 低優先度

| 功能 | 說明 |
|------|------|
| 刪除銷貨單 | 同步刪除 SaleM 一列 + SaleD 對應所有列 |
| 銷貨單修改 | 更新 SaleM 金額 + 重寫 SaleD 對應明細 |
| 庫存同步 | 儲存銷貨單時自動扣減 Product E 欄庫存 |
| 商品管理 | 直接在系統內維護 Product 工作表 |
| 客戶管理 | 建立客戶主檔工作表，開單時下拉選取 |
| 匯出銷貨單 | 單張訂單匯出為 XLS / PDF |
| 分頁 | 銷貨記錄 / 查詢結果分頁顯示 |
| 啟用刪除 | 解除 `deleteFile` 鎖定（目前為測試保護） |
