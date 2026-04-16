const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

async function apiRequest(url, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('尚未登入，請先登入');

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (res.status === 204) return null; // DELETE success

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `API 錯誤 (${res.status})`);
  }
  return json;
}

// ── Google Drive ──────────────────────────────────────────────────────────────

async function listSpreadsheets() {
  const parts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    "trashed=false"
  ];
  // 若設定了指定資料夾，只列出該資料夾內的檔案
  if (CONFIG.FOLDER_ID) parts.push(`'${CONFIG.FOLDER_ID}' in parents`);

  const q = encodeURIComponent(parts.join(' and '));
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const url = `${DRIVE_BASE}/files?q=${q}&fields=${fields}&orderBy=modifiedTime+desc&pageSize=100`;
  const data = await apiRequest(url);
  return data.files || [];
}

async function deleteFile(_fileId) {
  /**/
  alert('測試用無法刪除')
  // return apiRequest(`${DRIVE_BASE}/files/${_fileId}`, { method: 'DELETE' });
}

// 依名稱在指定資料夾（或根目錄）搜尋試算表，回傳第一筆結果
async function findSpreadsheetByName(name) {
  const parts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    "trashed=false",
    `name='${name}'`
  ];
  if (CONFIG.FOLDER_ID) parts.push(`'${CONFIG.FOLDER_ID}' in parents`);
  const q = encodeURIComponent(parts.join(' and '));
  const fields = encodeURIComponent('files(id,name)');
  const url = `${DRIVE_BASE}/files?q=${q}&fields=${fields}&pageSize=1`;
  const data = await apiRequest(url);
  return data.files?.[0] || null;
}

// ── Google Sheets ──────────────────────────────────────────────────────────────

async function createSpreadsheet(name, columns) {
  const body = {
    properties: { title: name },
    sheets: [{
      properties: { title: 'Sheet1' },
      data: [{
        rowData: [{
          values: columns.map(col => ({
            userEnteredValue: { stringValue: col },
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.26, green: 0.52, blue: 0.96 }
            }
          }))
        }]
      }]
    }]
  };

  const result = await apiRequest(SHEETS_BASE, { method: 'POST', body: JSON.stringify(body) });

  // 若設定了指定資料夾，將檔案移入該資料夾
  if (CONFIG.FOLDER_ID) {
    const fileId = result.spreadsheetId;
    // 取得目前父資料夾（預設為 My Drive 根目錄）
    const meta = await apiRequest(`${DRIVE_BASE}/files/${fileId}?fields=parents`);
    const prevParents = (meta.parents || []).join(',');
    // 移動到指定資料夾
    await apiRequest(
      `${DRIVE_BASE}/files/${fileId}?addParents=${CONFIG.FOLDER_ID}&removeParents=${prevParents}&fields=id`,
      { method: 'PATCH', body: JSON.stringify({}) }
    );
  }

  return result;
}

async function getSpreadsheetInfo(spreadsheetId) {
  return apiRequest(`${SHEETS_BASE}/${spreadsheetId}?fields=properties,sheets.properties`);
}

async function getSheetData(spreadsheetId, sheetName) {
  const range = encodeURIComponent(sheetName);
  const data = await apiRequest(`${SHEETS_BASE}/${spreadsheetId}/values/${range}`);
  return data.values || [];
}

async function appendRow(spreadsheetId, sheetName, values) {
  const range = encodeURIComponent(sheetName);
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return apiRequest(url, { method: 'POST', body: JSON.stringify({ values: [values] }) });
}

async function updateRow(spreadsheetId, sheetName, rowIndex, values) {
  // rowIndex 是 1-based（含標題列）
  const range = encodeURIComponent(`${sheetName}!A${rowIndex}`);
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  return apiRequest(url, { method: 'PUT', body: JSON.stringify({ values: [values] }) });
}

async function deleteRow(spreadsheetId, sheetName, rowIndex) {
  // 先取得 sheetId
  const info = await getSpreadsheetInfo(spreadsheetId);
  const sheet = info.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`找不到工作表：${sheetName}`);
  const sheetId = sheet.properties.sheetId;

  // 使用 batchUpdate 刪除整列
  return apiRequest(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex
          }
        }
      }]
    })
  });
}

async function addSheet(spreadsheetId, sheetName) {
  return apiRequest(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: sheetName } } }]
    })
  });
}

async function deleteSheet(spreadsheetId, sheetName) {
  const info = await getSpreadsheetInfo(spreadsheetId);
  const sheet = info.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`找不到工作表：${sheetName}`);
  return apiRequest(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }]
    })
  });
}
