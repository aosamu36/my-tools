// ================================================================
// (スクロールロック不要 - シンプルなoverflow:hiddenで対応)
// ================================================================

// ================================================================
// 認証ガード（未ログインなら共通ログインページへ）
// getClient() は auth.js で定義済み
// ================================================================
requireAuth();

// ================================================================
// DB操作
// ================================================================
async function dbGetAll() {
  const c = getClient();
  const result = await c.from(ITEMS_TABLE_NAME).select('*').order('date', { ascending: false });
  if (result.error) throw result.error;
  return result.data;
}

async function dbInsert(item) {
  const c = getClient();
  const result = await c.from(ITEMS_TABLE_NAME).insert(item);
  if (result.error) throw result.error;
}

async function dbDelete(id) {
  const c = getClient();
  const result = await c.from(ITEMS_TABLE_NAME).delete().eq('id', id);
  if (result.error) throw result.error;
}

// ================================================================
// 日付ピッカー（iOSホイール風）
// ================================================================
let dpTarget = null;
let dpState = { year: null, month: null, day: null };
const dpYears = (function () {
  const arr = [];
  const cy = new Date().getFullYear();
  for (let y = cy - 5; y <= cy + 1; y++) arr.push(y);
  return arr;
})();

function pad2(n) { return String(n).padStart(2, '0'); }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

function setDpDate(prefix, isoDate) {
  document.getElementById(prefix + '-date').value = isoDate;
  const p = isoDate.split('-');
  document.getElementById(prefix + '-date-display').textContent = p[0] + '年' + (+p[1]) + '月' + (+p[2]) + '日';
}

function todayIso() {
  const t = new Date();
  return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
}

function renderDpColumn(id, labels, selectedIndex) {
  const col = document.getElementById(id);
  const pad = '<div style="height:90px"></div>';
  col.innerHTML = pad + labels.map(function (l) {
    return '<div class="wheel-item">' + l + '</div>';
  }).join('') + pad;
  selectedIndex = Math.max(0, selectedIndex);
  col.scrollTop = selectedIndex * DATE_PICKER_ROW_HEIGHT;
  highlightDp(col, selectedIndex);
}

function highlightDp(col, idx) {
  const items = col.querySelectorAll('.wheel-item');
  items.forEach(function (it, i) { it.classList.toggle('selected', i === idx); });
}

function bindDpScroll(id, onChange) {
  const col = document.getElementById(id);
  let t = null;
  col.onscroll = function () {
    clearTimeout(t);
    t = setTimeout(function () {
      const items = col.querySelectorAll('.wheel-item');
      let idx = Math.round(col.scrollTop / DATE_PICKER_ROW_HEIGHT);
      idx = Math.max(0, Math.min(idx, items.length - 1));
      col.scrollTo({ top: idx * DATE_PICKER_ROW_HEIGHT, behavior: 'smooth' });
      highlightDp(col, idx);
      onChange(idx);
    }, 120);
  };
}

function renderDpDayColumn(y, m, preferDay) {
  const max = daysInMonth(y, m);
  const d = Math.min(preferDay || 1, max);
  dpState.day = d;
  const items = [];
  for (let i = 1; i <= max; i++) items.push(i + '日');
  renderDpColumn('wheel-day', items, d - 1);
  bindDpScroll('wheel-day', function (idx) { dpState.day = idx + 1; });
}

function openDatePicker(prefix) {
  dpTarget = prefix;
  const iso = document.getElementById(prefix + '-date').value || todayIso();
  const p = iso.split('-');
  dpState = { year: +p[0], month: +p[1], day: +p[2] };

  renderDpColumn('wheel-year', dpYears.map(String), dpYears.indexOf(dpState.year));
  bindDpScroll('wheel-year', function (idx) {
    dpState.year = dpYears[idx];
    renderDpDayColumn(dpState.year, dpState.month, dpState.day);
  });

  renderDpColumn('wheel-month', Array.from({ length: 12 }, function (_, i) { return (i + 1) + '月'; }), dpState.month - 1);
  bindDpScroll('wheel-month', function (idx) {
    dpState.month = idx + 1;
    renderDpDayColumn(dpState.year, dpState.month, dpState.day);
  });

  renderDpDayColumn(dpState.year, dpState.month, dpState.day);

  document.getElementById('date-picker-modal').classList.add('show');
  document.body.classList.add('modal-open');
}

function closeDatePicker(e) {
  if (!e || e.target === document.getElementById('date-picker-modal')) {
    document.getElementById('date-picker-modal').classList.remove('show');
    document.body.classList.remove('modal-open');
  }
}

function confirmDatePicker() {
  const iso = dpState.year + '-' + pad2(dpState.month) + '-' + pad2(dpState.day);
  setDpDate(dpTarget, iso);
  closeDatePicker();
}

(function () {
  const handle = document.querySelector('#date-picker-modal .detail-handle');
  let startY = 0;
  handle.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
  handle.addEventListener('touchend', function (e) {
    if (e.changedTouches[0].clientY - startY > 40) closeDatePicker();
  }, { passive: true });
})();

let curYear  = new Date().getFullYear();
let curMonth = new Date().getMonth() + 1;

function fmt(n) {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function getGeminiKey() {
  const key = localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
  if (!key) {
    toast('設定からGemini APIキーを入力してください', 'error', 'settings');
    return null;
  }
  return key;
}

function toast(msg, type, iconName) {
  const el = document.getElementById('toast');
  el.replaceChildren();
  if (iconName) {
    const icon = document.createElement('span');
    icon.className = 'material-icons-round toast-icon';
    icon.textContent = iconName;
    icon.setAttribute('aria-hidden', 'true');
    el.appendChild(icon);
  }
  const message = document.createElement('span');
  message.className = 'toast-message';
  message.textContent = msg;
  el.appendChild(message);
  el.style.maxWidth = Math.max(0, document.documentElement.clientWidth - 32) + 'px';
  el.className = 'toast ' + (type || 'success') + ' show';
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, TOAST_DURATION_MS);
}

async function requestGemini(imageBase64, prompt, maxTokens, apiKey) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]}],
      generationConfig: { temperature: 0, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  return response.json();
}

function parseGeminiResponse(data) {
  if (data.error) throw new Error(data.error.message);
  if (!data.candidates || !data.candidates[0]) throw new Error('レスポンス空');

  const parts = data.candidates[0].content.parts;
  const textPart = parts.find(function (part) { return part.text && part.text.includes('{'); });
  if (!textPart) throw new Error('テキスト取得失敗');

  const jsonMatch = textPart.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON解析失敗');
  return JSON.parse(jsonMatch[0]);
}

function getAppName(appLabel) {
  if (typeof appLabel !== 'string') return 'メルカリ';

  const appName = Object.keys(APP_NAME_ALIASES).find(function (name) {
    return APP_NAME_ALIASES[name].some(function (alias) {
      return appLabel.includes(alias);
    });
  });
  return appName || 'メルカリ';
}

function getAiErrorMessage(error, action) {
  const message = error && typeof error.message === 'string'
    ? error.message.toLowerCase()
    : '';
  if (message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
    return 'AIの利用上限に達しました。しばらく待ってからもう一度お試しください。';
  }
  if (message.includes('api key') || message.includes('api_key') || message.includes('unauthenticated')) {
    return 'Gemini APIキーが正しくありません。設定を確認してください。';
  }
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('load failed')) {
    return '通信に失敗しました。ネットワークを確認してもう一度お試しください。';
  }
  return action + 'に失敗しました。画像や設定を確認してもう一度お試しください。';
}

// ================================================================
// ページ・ナビゲーション
// ================================================================
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'home')  renderHome();
  if (name === 'chart') renderChart();
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text == null ? '' : String(text);
  return element;
}

function changeMonth(d) {
  curMonth += d;
  if (curMonth > 12) { curMonth = 1; curYear++; }
  if (curMonth < 1)  { curMonth = 12; curYear--; }
  renderHome();
}

// ================================================================
// ホームページ
// ================================================================
async function renderHome() {
  document.getElementById('month-label').textContent = curYear + '年' + curMonth + '月';
  const st = document.getElementById('db-status');
  st.textContent = '接続中';
  st.className = 'db-badge db-wait';

  try {
    const all = await dbGetAll();
    const mi = all.filter(function (i) {
      const d = new Date(i.date);
      return d.getFullYear() === curYear && d.getMonth() + 1 === curMonth;
    });

    document.getElementById('total-sales').textContent  = fmt(mi.reduce(function (s, i) { return s + (+i.price || 0); }, 0));
    document.getElementById('total-profit').textContent = fmt(mi.reduce(function (s, i) { return s + (+i.profit || 0); }, 0));
    document.getElementById('total-fee').textContent    = fmt(mi.reduce(function (s, i) {
      return s + (+i.fee_amount || 0) + (+i.shipping || 0) + (+i.cost || 0)
        + (i.packing != null ? +i.packing : DEFAULT_PACKING_COST);
    }, 0));
    document.getElementById('month-count').textContent = mi.length + '件';

    const appMap = Object.create(null);
    mi.forEach(function (i) {
      if (!appMap[i.app]) appMap[i.app] = { sales: 0, profit: 0 };
      appMap[i.app].sales  += +i.price || 0;
      appMap[i.app].profit += +i.profit || 0;
    });
    const breakdown = document.getElementById('app-breakdown');
    breakdown.replaceChildren();
    const appNames = Object.keys(appMap);
    if (appNames.length) {
      appNames.forEach(function (appName) {
        const stats = appMap[appName];
        const row = createTextElement('div', 'app-row', '');
        const name = createTextElement('div', '', appName);
        name.style.cssText = 'font-size:14px;font-weight:600';
        const values = document.createElement('div');
        values.style.textAlign = 'right';
        const sales = createTextElement('div', '', fmt(stats.sales));
        sales.style.cssText = 'font-size:14px;font-weight:700';
        const profit = createTextElement('div', '', '利益 ' + fmt(stats.profit));
        profit.style.cssText = 'font-size:11px;color:var(--green)';
        values.append(sales, profit);
        row.append(name, values);
        breakdown.appendChild(row);
      });
    } else {
      const noApps = createTextElement('div', '', 'データなし');
      noApps.style.cssText = 'color:var(--muted);font-size:13px';
      breakdown.appendChild(noApps);
    }

    const itemList = document.getElementById('item-list');
    itemList.replaceChildren();
    if (mi.length) {
      mi.forEach(function (item) {
        const tagClass = APP_TAG_CLASS[item.app] || 'tag-other';
        const date = new Date(item.date);
        const card = createTextElement('div', 'item-card', '');
        card.style.cursor = 'pointer';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.addEventListener('click', function () { showDetail(item); });
        card.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showDetail(item);
          }
        });

        const info = document.createElement('div');
        info.className = 'item-info';
        info.appendChild(createTextElement('div', 'item-name', item.name));
        const sub = createTextElement('div', 'item-sub', '');
        sub.appendChild(createTextElement('span', 'tag ' + tagClass, item.app));
        sub.appendChild(document.createTextNode((date.getMonth() + 1) + '/' + date.getDate()));
        info.appendChild(sub);

        const price = createTextElement('div', 'item-price', '');
        price.appendChild(createTextElement('div', 'item-sale-val', fmt(+item.price || 0)));
        price.appendChild(createTextElement('div', 'item-profit-val', '+' + fmt(+item.profit || 0)));
        card.append(info, price);
        itemList.appendChild(card);
      });
    } else {
      itemList.innerHTML = '<div class="empty">'
        + '<span class="material-icons-round" style="font-size:52px;color:var(--muted);display:block;text-align:center;margin-bottom:12px">inventory_2</span>'
        + '<div class="empty-text" style="text-align:center">まだ記録がありません<br>追加から登録してね</div>'
        + '</div>';
    }

    st.textContent = 'DB ✓';
    st.className = 'db-badge db-ok';
  } catch (e) {
    st.textContent = 'エラー';
    st.className = 'db-badge db-err';
    document.getElementById('item-list').innerHTML =
      '<div class="empty">'
      + '<span class="material-icons-round" style="font-size:52px;color:#ffb347;display:block;text-align:center;margin-bottom:12px">wifi_off</span>'
      + '<div class="empty-text" style="text-align:center">接続エラー<br>設定を確認してください</div>'
      + '</div>';
  }
}

// ================================================================
// 詳細モーダル
// ================================================================
function showDetail(item) {
  const tagClass = APP_TAG_CLASS[item.app] || 'tag-other';
  const d = new Date(item.date);

  document.getElementById('d-name').textContent     = item.name;
  document.getElementById('d-app-badge').textContent = item.app;
  document.getElementById('d-app-badge').className   = 'detail-app-badge tag ' + tagClass;
  document.getElementById('d-date').textContent      = d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  document.getElementById('d-category').textContent  = item.category || 'その他';
  document.getElementById('d-price').textContent     = fmt(+item.price || 0);
  document.getElementById('d-fee').textContent       = fmt(+item.fee_amount || 0);
  document.getElementById('d-shipping').textContent  = fmt(+item.shipping || 0);
  document.getElementById('d-packing').textContent =
    fmt(item.packing != null ? +item.packing : DEFAULT_PACKING_COST);
  document.getElementById('d-cost').textContent      = fmt(+item.cost || 0);

  const profit = +item.profit || 0;
  document.getElementById('d-profit').textContent = fmt(profit);
  document.getElementById('d-profit').className   = 'detail-value ' + (profit >= 0 ? 'green' : 'red');

  document.getElementById('d-delete-btn').onclick = function () { closeDetail(); deleteItem(item.id); };
  document.getElementById('d-edit-btn').onclick   = function () { closeDetail(); editItem(item); };

  document.getElementById('detail-modal').classList.add('show');
  document.body.classList.add('modal-open');

  const sheet = document.querySelector('.detail-sheet');
  let startY = 0;
  sheet.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend',   function (e) { if (e.changedTouches[0].clientY - startY > 60) closeDetail(); }, { passive: true });
}

function closeDetail(e) {
  if (!e || e.target === document.getElementById('detail-modal')) {
    document.getElementById('detail-modal').classList.remove('show');
    document.body.classList.remove('modal-open');
  }
}

// ================================================================
// アイテム削除・編集・更新
// ================================================================
async function deleteItem(id) {
  if (!confirm('この記録を削除しますか？')) return;
  try {
    await dbDelete(id);
    renderHome();
    toast('削除しました');
  } catch (e) {
    toast('削除に失敗しました', 'error');
  }
}

function editItem(item) {
  const addBtn = document.querySelector('.nav-btn:nth-child(2)');
  showPage('add', addBtn);
  document.getElementById('f-name').value     = item.name || '';
  setDpDate('f', item.date || todayIso());
  document.getElementById('f-app').value      = item.app || 'メルカリ';
  document.getElementById('f-category').value = item.category || '遊戯王';
  document.getElementById('f-price').value    = item.price || 0;
  document.getElementById('f-shipping').value = item.shipping || 0;
  document.getElementById('f-cost').value     = item.cost || 0;
  document.getElementById('f-packing').value =
    item.packing != null ? item.packing : DEFAULT_PACKING_COST;
  calcProfit();

  const saveBtn = document.querySelector('.btn-save');
  saveBtn.textContent = '更新する';
  saveBtn._editId = item.id;
  saveBtn.onclick = function () { updateItem(this._editId); };
}

function validateSaleForm() {
  const name  = document.getElementById('f-name').value.trim();
  const date  = document.getElementById('f-date').value.trim();
  const price = +document.getElementById('f-price').value || 0;

  if (!name)  { toast('商品名を入力してください', 'error'); return false; }
  if (!date)  { toast('購入日時を入力してください', 'error'); return false; }
  if (!price) { toast('商品代金を入力してください', 'error'); return false; }
  return true;
}

function buildItemFromForm(id, emptyPackingDefault) {
  const packing = document.getElementById('f-packing').value;
  return {
    id: id,
    name: document.getElementById('f-name').value.trim(),
    date: document.getElementById('f-date').value.trim(),
    app: document.getElementById('f-app').value,
    category: document.getElementById('f-category').value,
    price: +document.getElementById('f-price').value || 0,
    fee_amount: +document.getElementById('f-fee').value || 0,
    shipping: +document.getElementById('f-shipping').value || 0,
    profit: +document.getElementById('f-profit').value || 0,
    cost: +document.getElementById('f-cost').value || 0,
    packing: packing === '' ? emptyPackingDefault : (+packing || 0),
    delivery_method: '',
    item_id: ''
  };
}

async function updateItem(oldId) {
  if (!validateSaleForm()) return;

  const item = buildItemFromForm(oldId, 0);

  try {
    const c = getClient();
    const result = await c.from(ITEMS_TABLE_NAME).update(item).eq('id', oldId);
    if (result.error) throw result.error;
    toast('更新しました！');
    const saveBtn = document.querySelector('.btn-save');
    saveBtn.textContent = '保存';
    saveBtn.onclick = saveItem;
    saveBtn._editId = null;
    resetAddForm();
    renderHome();
  } catch (e) {
    toast('更新に失敗しました。通信状態を確認してもう一度お試しください。', 'error');
  }
}

// ================================================================
// フォーム
// ================================================================
function calcProfit() {
  const price    = +document.getElementById('f-price').value || 0;
  const shipping = +document.getElementById('f-shipping').value || 0;
  const cost     = +document.getElementById('f-cost').value || 0;
  const packingEl = document.getElementById('f-packing');
  const packing  = packingEl.value === '' ? 0 : +packingEl.value;
  const fee      = Math.floor(price * (FEE_RATES[document.getElementById('f-app').value] || DEFAULT_FEE_RATE));
  const profit   = price - fee - shipping - cost - packing;

  document.getElementById('f-fee').value = fee;
  document.getElementById('f-profit').value = profit;
  document.getElementById('f-profit-display').textContent = fmt(profit);
  document.getElementById('f-profit-display').style.color = profit >= 0 ? '#06a070' : '#e63262';
}

function resetAddForm() {
  ['f-name', 'f-price', 'f-shipping', 'f-cost', 'f-packing'].forEach(function (id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-fee').value = 0;
  document.getElementById('f-profit').value = 0;
  document.getElementById('f-profit-display').textContent = '¥0';
  document.getElementById('f-profit-display').style.color = '#06a070';
  document.getElementById('f-category').value = '遊戯王';
  setDpDate('f', todayIso());
}

async function saveItem() {
  if (!validateSaleForm()) return;

  const item = buildItemFromForm(Date.now().toString(), DEFAULT_PACKING_COST);

  try {
    await dbInsert(item);
    toast('保存しました！');
    resetAddForm();
  } catch (e) {
    toast('保存に失敗しました。通信状態を確認してもう一度お試しください。', 'error');
  }
}

// ================================================================
// 画像 → Base64 変換
// ================================================================
function toBase64(file) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const max = MAX_IMAGE_DIMENSION;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else       { w = Math.round(w * max / h); h = max; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]);
    };
    img.onerror = function () { reject(new Error('画像読み込み失敗')); };
    img.src = url;
  });
}

function isSupportedImage(file) {
  return file.size <= MAX_IMAGE_FILE_SIZE && SUPPORTED_IMAGE_TYPE.test(file.type);
}

// ================================================================
// 追加ページ: 取引画像解析
// ================================================================
async function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  if (!isSupportedImage(file)) {
    toast(IMAGE_VALIDATION_MESSAGE, 'error');
    return;
  }

  const geminiKey = getGeminiKey();
  if (!geminiKey) return;

  const area = document.getElementById('upload-area');
  area.classList.add('analyzing');
  document.getElementById('upload-icon').className = '';
  document.getElementById('upload-icon').innerHTML = '<span class="spinner"></span>';
  document.getElementById('upload-text').textContent = 'AI解析中...';

  try {
    const jpegBase64 = await toBase64(file);
    let data;
    for (let attempt = 1; attempt <= GEMINI_IMAGE_RETRY_LIMIT; attempt++) {
      if (attempt > 1) {
        document.getElementById('upload-text').textContent =
          '再試行中... (' + attempt + '/' + GEMINI_IMAGE_RETRY_LIMIT + ')';
        await new Promise(function (resolve) {
          setTimeout(resolve, GEMINI_RETRY_DELAY_MS * attempt);
        });
      }
      data = await requestGemini(
        jpegBase64,
        TRANSACTION_IMAGE_PROMPT,
        TRANSACTION_IMAGE_MAX_TOKENS,
        geminiKey
      );
      if (!data.error) break;
      if (data.error.code === 429 && attempt < GEMINI_IMAGE_RETRY_LIMIT) continue;
      throw new Error('APIエラー: ' + data.error.message);
    }

    const p = parseGeminiResponse(data);

    if (p.name) document.getElementById('f-name').value = p.name;
    if (p.date) setDpDate('f', p.date);
    let appName = getAppName(p.app);
    const hasMercariDetails = appName === 'その他'
      && (p.fee_amount != null || p.profit != null || p.shipping != null);
    if (hasMercariDetails) appName = 'メルカリ';
    document.getElementById('f-app').value = appName;
    if (p.price != null) document.getElementById('f-price').value = p.price;

    const defaultShipping = appName === 'Yahoo!フリマ'
      ? YAHOO_FLEA_SHIPPING_COST
      : (p.delivery_method && p.delivery_method.includes('ゆうゆう'))
        ? MERCARI_YUUYU_SHIPPING_COST
        : DEFAULT_SHIPPING_COST;
    const shippingVal = (p.shipping != null && p.shipping > 0) ? p.shipping : defaultShipping;
    document.getElementById('f-shipping').value = shippingVal;

    if (p.name) {
      const bracket = p.name.match(/【([^】]+)】/);
      const kw = bracket ? bracket[1] : '';
      if      (kw === 'ポケカ') document.getElementById('f-category').value = 'ポケモン';
      else if (kw === '遊戯王') document.getElementById('f-category').value = '遊戯王';
      else                      document.getElementById('f-category').value = 'その他';
    }
    document.getElementById('f-packing').value = DEFAULT_PACKING_COST;
    calcProfit();

    const modal = document.getElementById('done-modal');
    modal.classList.add('show');
    modal._t = setTimeout(function () { modal.classList.remove('show'); }, 2500);

  } catch (err) {
    toast(getAiErrorMessage(err, '画像解析'), 'error');
  } finally {
    area.classList.remove('analyzing');
    const icon = document.getElementById('upload-icon');
    icon.className = 'material-icons-round';
    icon.style.fontSize = '28px';
    icon.textContent = 'add_a_photo';
    document.getElementById('upload-text').textContent = '取引画像をタップして選択';
  }
}

// ================================================================
// 生成ページ: カード画像解析・商品名生成
// ================================================================
let selectedRarity   = '';
let cardImageBase64  = '';

(function () {
  const grid = document.getElementById('rarity-grid');
  RARITIES.forEach(function (r) {
    const btn = document.createElement('button');
    btn.className = 'rarity-btn';
    btn.textContent = r;
    btn.onclick = function () {
      document.querySelectorAll('.rarity-btn').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      selectedRarity = r;
    };
    grid.appendChild(btn);
  });
})();

function handleCardImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  if (!isSupportedImage(file)) {
    toast(IMAGE_VALIDATION_MESSAGE, 'error');
    return;
  }

  const preview = document.getElementById('card-preview');
  const previewUrl = URL.createObjectURL(file);
  preview.onload = function () { URL.revokeObjectURL(previewUrl); };
  preview.onerror = function () { URL.revokeObjectURL(previewUrl); };
  preview.src = previewUrl;
  preview.classList.add('show');

  const area = document.getElementById('card-upload-area');
  area.classList.add('has-image');
  document.getElementById('card-upload-icon').textContent  = 'check_circle';
  document.getElementById('card-upload-icon').style.color  = 'var(--green)';
  document.getElementById('card-upload-text').textContent  = '画像を選択済み（タップで変更）';

  toBase64(file).then(function (b64) { cardImageBase64 = b64; });
}

async function generateDescription() {
  if (!cardImageBase64) { toast('カード画像を選択してください', 'error'); return; }
  if (!selectedRarity)  { toast('レアリティを選択してください', 'error'); return; }

  const geminiKey = getGeminiKey();
  if (!geminiKey) return;

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="border-color:#ffcbb5;border-top-color:#fff;margin-right:8px"></span>生成中...';

  try {
    const data = await requestGemini(
      cardImageBase64,
      CARD_DESCRIPTION_PROMPT,
      CARD_DESCRIPTION_MAX_TOKENS,
      geminiKey
    );
    const p = parseGeminiResponse(data);

    const cardName   = p.card_name   || '不明';
    const cardNumber = p.card_number || '不明';
    const cardCount  = p.card_count  || 1;
    const rarityDef  = RARITY_MAP[selectedRarity] || { title: selectedRarity, desc: selectedRarity };

    const titleName = cardName.replace(/[・\-－]/g, '');
    const countStr  = cardCount >= 2 ? ' ' + cardCount + '枚' : '';
    const title = titleName + ' ' + rarityDef.title + countStr + ' ' + cardNumber;

    const desc =
      '【カード名】\n' + cardName + '\n\n' +
      '【レアリティ】\n' + rarityDef.desc + '\n\n' +
      '【型番】\n' + cardNumber;

    document.getElementById('result-title').textContent = title;
    document.getElementById('result-desc').textContent  = desc;
    document.getElementById('generate-result').style.display = 'block';
    window.scrollTo(0, document.body.scrollHeight);

  } catch (err) {
    toast(getAiErrorMessage(err, '商品情報の生成'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<span class="material-icons-round" style="font-size:18px;vertical-align:-4px;margin-right:4px">auto_awesome</span>商品名・説明を生成';
  }
}

function copyText(id) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(function () {
    toast('コピーしました！');
  }).catch(function () {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('コピーしました！');
  });
}

// ================================================================
// グラフページ
// ================================================================
const chartInsts = {};

function destroyChart(key) {
  if (chartInsts[key]) { chartInsts[key].destroy(); delete chartInsts[key]; }
}

async function renderChart() {
  try {
    const all = await dbGetAll();
    const years = [...new Set(all.map(function (i) { return new Date(i.date).getFullYear(); }))].sort(function (a, b) { return b - a; });
    const sel = document.getElementById('chart-year');
    const curVal = sel.value;
    sel.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + '年</option>'; }).join('');
    if (curVal && years.includes(+curVal)) sel.value = curVal;

    const year   = +sel.value;
    const months = MONTH_LABELS;
    const labels = months.map(function (m) { return m + '月'; });

    const monthly = {};
    months.forEach(function (m) { monthly[m] = { sales: 0, profit: 0, fee: 0, count: 0 }; });

    all.filter(function (i) { return new Date(i.date).getFullYear() === year; })
       .forEach(function (i) {
         const m = String(new Date(i.date).getMonth() + 1);
         monthly[m].sales  += +i.price || 0;
         monthly[m].profit += +i.profit || 0;
         monthly[m].fee    += (+i.fee_amount || 0) + (+i.shipping || 0) + (+i.cost || 0)
           + (i.packing != null ? +i.packing : DEFAULT_PACKING_COST);
         monthly[m].count  += 1;
       });

    const totSales  = months.reduce(function (s, m) { return s + monthly[m].sales; }, 0);
    const totProfit = months.reduce(function (s, m) { return s + monthly[m].profit; }, 0);
    const totFee    = months.reduce(function (s, m) { return s + monthly[m].fee; }, 0);
    const totCount  = months.reduce(function (s, m) { return s + monthly[m].count; }, 0);

    document.getElementById('y-sales').textContent  = fmt(totSales);
    document.getElementById('y-profit').textContent = fmt(totProfit);
    document.getElementById('y-fee').textContent    = fmt(totFee);
    document.getElementById('y-count').textContent  = totCount + '件';

    const chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { ticks: { callback: function (v) { return '¥' + v.toLocaleString(); } } } }
    };

    destroyChart('bar');
    chartInsts['bar'] = new Chart(document.getElementById('chart-bar-canvas').getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: '売上', data: months.map(function (m) { return monthly[m].sales; }),  backgroundColor: 'rgba(255,107,53,0.75)', borderRadius: 4 },
          { label: '利益', data: months.map(function (m) { return monthly[m].profit; }), backgroundColor: 'rgba(6,214,160,0.75)',  borderRadius: 4 }
        ]
      },
      options: chartOpts
    });

    destroyChart('line');
    chartInsts['line'] = new Chart(document.getElementById('chart-line-canvas').getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: '売上', data: months.map(function (m) { return monthly[m].sales; }),  borderColor: 'rgba(255,107,53,1)', backgroundColor: 'rgba(255,107,53,0.08)', tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: 'rgba(255,107,53,1)' },
          { label: '利益', data: months.map(function (m) { return monthly[m].profit; }), borderColor: 'rgba(6,214,160,1)',  backgroundColor: 'rgba(6,214,160,0.08)',  tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: 'rgba(6,214,160,1)' }
        ]
      },
      options: chartOpts
    });

  } catch (e) {
    toast('グラフ取得失敗', 'error');
  }
}

// ================================================================
// 設定モーダル
// ================================================================
function openSettings() {
  document.getElementById('s-gemini').value = localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
  document.getElementById('settings-modal').classList.add('show');
  document.body.classList.add('modal-open');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('show');
  document.body.classList.remove('modal-open');
}

function closeSettingsOutside(e) {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
}

function saveSettings() {
  const gemini = document.getElementById('s-gemini').value.trim();
  if (gemini) localStorage.setItem(GEMINI_KEY_STORAGE_KEY, gemini);
  toast('設定を保存しました');
  closeSettings();
  renderHome();
}

// ================================================================
// 初期化
// ================================================================
(function () {
  setDpDate('f', todayIso());
  requireAuth().then(function (session) {
    if (session) renderHome();
  }).catch(function () {
    const status = document.getElementById('db-status');
    status.textContent = '認証エラー';
    status.className = 'db-badge db-err';
  });

  // スプラッシュ非表示
  setTimeout(function () {
    const s = document.getElementById('splash');
    s.classList.add('hide');
    setTimeout(function () { s.remove(); }, 800);
  }, 2200);
})();
