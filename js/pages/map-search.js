// ════════════════════════════════════════════════════════════════════════════
// 地圖廁所查詢
// ════════════════════════════════════════════════════════════════════════════

registerPage('map-search', {
  html: `
    <div id="page-map-search" class="page">
      <div class="page-header">
        <h1>親子廁所查詢</h1>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="map-addr-input" class="form-input"
            placeholder="請輸入完整地址（例如：台北市大安區敦化南路二段319號）"
            style="flex:1;min-width:200px;"
            onkeydown="if(event.key==='Enter') mapSearchNearest()" />
          <button class="btn primary" onclick="mapSearchNearest()">🔍 搜尋最近 10 間</button>
          <button class="btn secondary" onclick="mapShowAll()">📍 顯示全部</button>
        </div>
        <div id="map-status" style="margin-top:8px;font-size:13px;color:#888;"></div>
      </div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div id="map-container" style="flex:1;min-width:300px;height:520px;border-radius:8px;border:1px solid #ddd;"></div>
        <div id="map-results" style="width:280px;max-height:520px;overflow-y:auto;"></div>
      </div>
    </div>`,

  onShow() {
    mapInitLeaflet();
  }
});

// ── 狀態 ───────────────────────────────────────────────────────────────────────
let _mapInstance   = null;
let _mapMarkers    = [];
let _mapCsvCache   = null;

// ── Leaflet 初始化 ─────────────────────────────────────────────────────────────
function mapInitLeaflet() {
  if (_mapInstance) {
    setTimeout(() => _mapInstance.invalidateSize(), 120);
    return;
  }
  const el = document.getElementById('map-container');
  if (!el) return;

  _mapInstance = L.map('map-container').setView([25.0478, 121.5318], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(_mapInstance);
}

function mapClearMarkers() {
  _mapMarkers.forEach(m => _mapInstance.removeLayer(m));
  _mapMarkers = [];
}

function mapAddMarker(lat, lng, popupHtml, color) {
  const icon = L.divIcon({
    className: '',
    html: `<div style="background:${color || '#e53935'};width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
  const m = L.marker([lat, lng], { icon }).addTo(_mapInstance).bindPopup(popupHtml);
  _mapMarkers.push(m);
  return m;
}

// ── CSV 載入 ───────────────────────────────────────────────────────────────────
async function mapLoadCsv() {
  if (_mapCsvCache) return _mapCsvCache;
  setStatus('正在載入廁所資料...');
  const file = await findFileByName('臺北市親子友善廁所點位資訊.csv');
  if (!file) throw new Error('找不到「臺北市親子友善廁所點位資訊.csv」，請確認已上傳至 Google Drive');
  let raw = await getFileContentAutoEncoding(file.id);
  // 移除 BOM
  raw = raw.replace(/^\uFEFF/, '');
  const result = Papa.parse(raw, { header: true, skipEmptyLines: true });
  _mapCsvCache = result.data;
  // 於 console 輸出欄位名稱，方便確認
  console.log('[map-search] CSV 欄位名稱:', Object.keys(_mapCsvCache[0] || {}));
  setStatus(`已載入 ${_mapCsvCache.length} 筆資料`);
  return _mapCsvCache;
}

function mapGetCols(row) {
  const keys = Object.keys(row);
  console.log('[map-search] 偵測欄位:', keys);

  const lngCol  = keys.find(k => k.includes('經度') || k.includes('longitude') || k.toLowerCase().includes('lng'));
  const latCol  = keys.find(k => k.includes('緯度') || k.includes('latitude')  || k.toLowerCase().includes('lat'));
  const nameCol = keys.find(k => k.includes('設施名稱') || k.includes('名稱') || k.includes('廁所'));
  const addrCol = keys.find(k => k.includes('地址'));
  const distCol = keys.find(k => k.includes('行政區'));

  // 欄位偵測失敗時，顯示實際欄位名稱供確認
  if (!lngCol || !latCol) {
    const msg = `找不到經緯度欄位，CSV 欄位為：${keys.join('、')}`;
    setStatus(msg);
    console.error('[map-search]', msg);
  }

  return { lngCol, latCol, nameCol, addrCol, distCol };
}

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 搜尋最近 10 間 ─────────────────────────────────────────────────────────────
async function mapSearchNearest() {
  const addr = document.getElementById('map-addr-input')?.value.trim();
  if (!addr) { showToast('請輸入地址', 'warning'); return; }
  if (!isSignedIn()) { showToast('請先登入 Google', 'warning'); return; }
  setLoading(true);
  try {
    const data = await mapLoadCsv();
    setStatus('正在查詢地址座標...');

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1&countrycodes=tw`,
      { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } }
    );
    const geoData = await geoRes.json();
    if (!geoData.length) { showToast('找不到該地址，請使用完整格式，例如：台北市大安區敦化南路二段319號（段數用中文數字）', 'error'); return; }

    const cLat = parseFloat(geoData[0].lat);
    const cLng = parseFloat(geoData[0].lon);
    const { lngCol, latCol, nameCol, addrCol, distCol } = mapGetCols(data[0]);
    if (!lngCol || !latCol) { showToast('CSV 找不到經緯度欄位', 'error'); return; }

    const rows = data
      .map(row => {
        const lat = parseFloat(row[latCol]), lng = parseFloat(row[lngCol]);
        if (isNaN(lat) || isNaN(lng)) return null;
        return { ...row, _lat: lat, _lng: lng, _km: haversineKm(cLat, cLng, lat, lng) };
      })
      .filter(Boolean)
      .sort((a, b) => a._km - b._km)
      .slice(0, 10);

    mapClearMarkers();

    // 搜尋位置標記（藍色）
    mapAddMarker(cLat, cLng,
      `<b>搜尋位置</b><br>${geoData[0].display_name}`, '#1976d2');

    rows.forEach((row, i) => {
      const popup = `<b>${i+1}. ${row[nameCol] || '廁所'}</b><br>` +
                    `${row[addrCol] || ''}<br>` +
                    `<span style="color:#e53935">距離 ${(row._km * 1000).toFixed(0)} 公尺</span>`;
      const m = mapAddMarker(row._lat, row._lng, popup);
      if (i === 0) setTimeout(() => m.openPopup(), 400);
    });

    const allPts = [[cLat, cLng], ...rows.map(r => [r._lat, r._lng])];
    _mapInstance.fitBounds(L.latLngBounds(allPts).pad(0.15));

    renderMapResults(rows, nameCol, addrCol, distCol);
    setStatus(`以「${geoData[0].display_name.split(',')[0]}」為中心，找到最近 ${rows.length} 間廁所`);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── 顯示全部 ──────────────────────────────────────────────────────────────────
async function mapShowAll() {
  if (!isSignedIn()) { showToast('請先登入 Google', 'warning'); return; }
  setLoading(true);
  try {
    const data = await mapLoadCsv();
    const { lngCol, latCol, nameCol, addrCol } = mapGetCols(data[0]);
    if (!lngCol || !latCol) { showToast('CSV 找不到經緯度欄位', 'error'); return; }

    mapClearMarkers();
    let count = 0;
    data.forEach(row => {
      const lat = parseFloat(row[latCol]), lng = parseFloat(row[lngCol]);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapAddMarker(lat, lng,
          `<b>${row[nameCol] || '廁所'}</b><br>${row[addrCol] || ''}`);
        count++;
      }
    });
    if (_mapMarkers.length) {
      _mapInstance.fitBounds(
        L.featureGroup(_mapMarkers).getBounds().pad(0.05)
      );
    }
    document.getElementById('map-results').innerHTML =
      `<div style="padding:14px;color:#555;font-size:14px;">共顯示 <b>${count}</b> 個廁所點位</div>`;
    setStatus(`顯示全部 ${count} 筆`);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ── 結果列表 ─────────────────────────────────────────────────────────────────
function renderMapResults(rows, nameCol, addrCol, distCol) {
  const el = document.getElementById('map-results');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:10px 14px;font-weight:600;font-size:14px;border-bottom:1px solid #eee;">
      最近 ${rows.length} 間廁所
    </div>
    ${rows.map((row, i) => `
      <div onclick="mapFlyTo(${row._lat},${row._lng})"
           style="display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background .15s"
           onmouseover="this.style.background='#f5f8ff'" onmouseout="this.style.background=''">
        <div style="width:24px;height:24px;border-radius:50%;background:#e53935;color:#fff;font-size:12px;font-weight:700;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
        <div style="min-width:0;">
          <div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${row[nameCol] || '廁所'}
          </div>
          ${distCol && row[distCol] ? `<div style="font-size:12px;color:#888;">${row[distCol]}</div>` : ''}
          ${addrCol && row[addrCol] ? `<div style="font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${row[addrCol]}</div>` : ''}
          <div style="font-size:12px;color:#e53935;margin-top:2px;">${(row._km * 1000).toFixed(0)} 公尺</div>
        </div>
      </div>`).join('')}`;
}

function mapFlyTo(lat, lng) {
  if (_mapInstance) _mapInstance.flyTo([lat, lng], 17);
}

function setStatus(msg) {
  const el = document.getElementById('map-status');
  if (el) el.textContent = msg;
}
