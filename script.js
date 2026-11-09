import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  set, 
  onValue 
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

// 1. Firebase初期化設定
const firebaseConfig = {
  apiKey: "AIzaSyCWbRgKKvKEHZM2yYEbMMtxNMrEb2lPxsI",
  authDomain: "sensitization.firebaseapp.com",
  databaseURL: "https://sensitization-default-rtdb.firebaseio.com",
  projectId: "sensitization",
  storageBucket: "sensitization.firebasestorage.app",
  messagingSenderId: "278775825763",
  appId: "1:278775825763:web:8cade894c83c4f023fff56"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 2. アプリ状態管理
let isManageMode = true; // 管理モード初期値
let locations = [];
let stocks = [];
let histories = [];
let currentEditingStockId = null;

// Firebaseリアルタイムデータ受信の設定
function initFirebaseSync() {
  // 保管場所同期
  onValue(ref(db, 'locations'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      locations = Array.isArray(data) ? data : Object.values(data);
    } else {
      // 初期データ設定（データが空の場合）
      locations = ["Aさん宅", "Bさん宅", "本部保管庫"];
      saveLocationsToFirebase();
    }
    updateSelectOptions();
    renderInventory();
  });

  // 資材一覧同期
  onValue(ref(db, 'stocks'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      stocks = Array.isArray(data) ? data : Object.values(data);
    } else {
      stocks = [];
    }
    updateSelectOptions();
    renderInventory();
  });

  // 履歴同期
  onValue(ref(db, 'histories'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      histories = Array.isArray(data) ? data : Object.values(data);
    } else {
      histories = [];
    }
    renderHistory();
  });
}

// クラウドへ保存する関数群
function saveLocationsToFirebase() {
  set(ref(db, 'locations'), locations);
}

function saveStocksToFirebase() {
  set(ref(db, 'stocks'), stocks);
}

function saveHistoriesToFirebase() {
  set(ref(db, 'histories'), histories);
}

// 3. UIレンダリング関連
function renderInventory() {
  const container = document.getElementById("location-cards-container");
  if (!container) return;
  container.innerHTML = "";

  locations.forEach(loc => {
    const card = document.createElement("div");
    card.className = "location-card";

    const header = document.createElement("div");
    header.className = "location-header";
    header.textContent = `🏠 ${loc}`;
    card.appendChild(header);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "stock-items-container";

    const locStocks = stocks.filter(s => (s.counts && s.counts[loc] > 0));

    if (locStocks.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.style.fontSize = "0.85rem";
      emptyMsg.style.color = "#999";
      emptyMsg.style.padding = "4px 0";
      emptyMsg.textContent = "登録されている資材はありません";
      itemsContainer.appendChild(emptyMsg);
    } else {
      locStocks.forEach(st => {
        const row = document.createElement("div");
        row.className = "stock-item-row";
        row.onclick = () => openModal(st.id);

        const info = document.createElement("div");
        info.className = "stock-info";

        const title = document.createElement("div");
        title.className = "stock-title";
        title.textContent = st.name;

        const countsDiv = document.createElement("div");
        countsDiv.className = "stock-counts";

        Object.keys(st.counts || {}).forEach(k => {
          if (st.counts[k] > 0) {
            const badge = document.createElement("span");
            badge.className = "count-badge";
            badge.textContent = `${k.replace('さん宅', '')}: ${st.counts[k]}個`;
            countsDiv.appendChild(badge);
          }
        });

        info.appendChild(title);
        info.appendChild(countsDiv);
        row.appendChild(info);

        const arrow = document.createElement("div");
        arrow.style.color = "#ccc";
        arrow.textContent = "›";
        row.appendChild(arrow);

        itemsContainer.appendChild(row);
      });
    }

    card.appendChild(itemsContainer);
    container.appendChild(card);
  });
}

function renderHistory() {
  const list = document.getElementById("history-list");
  if (!list) return;
  list.innerHTML = "";
  
  // 新しい順に表示
  const reversed = [...histories].reverse();
  reversed.forEach(h => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div><strong>${h.text}</strong></div>
      <div class="history-time">${h.time}</div>
    `;
    list.appendChild(li);
  });
}

function updateSelectOptions() {
  const moveStockSel = document.getElementById("move-stock-select");
  const moveFromSel = document.getElementById("move-from-select");
  const moveToSel = document.getElementById("move-to-select");
  const regLocSel = document.getElementById("reg-stock-location");

  if (moveStockSel) {
    moveStockSel.innerHTML = stocks.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  }
  if (moveFromSel) {
    moveFromSel.innerHTML = locations.map(l => `<option value="${l}">${l}</option>`).join("");
  }
  if (moveToSel) {
    moveToSel.innerHTML = locations.map(l => `<option value="${l}">${l}</option>`).join("");
  }
  if (regLocSel) {
    regLocSel.innerHTML = locations.map(l => `<option value="${l}">${l}</option>`).join("");
  }
}

// 4. モーダル表示・インライン編集
function openModal(stockId) {
  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("modal-body");
  const stock = stocks.find(s => s.id === stockId);
  if (!stock || !modal || !body) return;

  currentEditingStockId = stockId;
  renderModalContent(stock, false);
  modal.style.display = "flex";
}

function renderModalContent(stock, isEditMode) {
  const body = document.getElementById("modal-body");

  if (!isEditMode) {
    // 閲覧表示
    let countsHtml = Object.keys(stock.counts || {})
      .filter(loc => stock.counts[loc] > 0)
      .map(loc => `<li>${loc}: <strong>${stock.counts[loc]}</strong> 個</li>`)
      .join("");

    body.innerHTML = `
      <h3 style="margin-bottom:10px;">${stock.name}</h3>
      ${stock.image ? `<img src="${stock.image}" class="detail-img">` : ''}
      <div style="margin-bottom:10px;">
        <strong>保管状況:</strong>
        <ul style="padding-left:20px; margin-top:5px;">${countsHtml || '在庫なし'}</ul>
      </div>
      <div>
        <strong>メモ・用途:</strong>
        <div class="detail-memo">${stock.memo || 'なし'}</div>
      </div>
      ${isManageMode ? `
        <div class="modal-actions">
          <button id="btn-edit-start" class="btn-modal-edit">編集</button>
          <button id="btn-delete-stock" class="btn-modal-delete">削除</button>
        </div>
      ` : ''}
    `;

    if (isManageMode) {
      document.getElementById("btn-edit-start").onclick = () => renderModalContent(stock, true);
      document.getElementById("btn-delete-stock").onclick = () => deleteStock(stock.id);
    }
  } else {
    // インライン編集画面
    let locationInputsHtml = locations.map(loc => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <label style="font-size:0.9rem;">${loc}</label>
        <input type="number" class="edit-loc-count" data-loc="${loc}" value="${stock.counts[loc] || 0}" min="0" style="width:80px; padding:4px;">
      </div>
    `).join("");

    body.innerHTML = `
      <h3 style="margin-bottom:10px;">資材情報の編集</h3>
      <div class="form-group" style="margin-bottom:10px;">
        <label>資材名</label>
        <input type="text" id="edit-name" value="${stock.name}">
      </div>
      <div class="form-group" style="margin-bottom:10px;">
        <label>各場所の個数</label>
        <div style="background:#f8f9fa; padding:8px; border-radius:6px;">
          ${locationInputsHtml}
        </div>
      </div>
      <div class="form-group" style="margin-bottom:10px;">
        <label>メモ</label>
        <textarea id="edit-memo" rows="3">${stock.memo || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button id="btn-edit-save" class="btn-modal-save">保存</button>
        <button id="btn-edit-cancel" class="btn-secondary" style="background:#7f8c8d;">キャンセル</button>
      </div>
    `;

    document.getElementById("btn-edit-save").onclick = () => saveStockEdit(stock.id);
    document.getElementById("btn-edit-cancel").onclick = () => renderModalContent(stock, false);
  }
}

function saveStockEdit(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;

  const newName = document.getElementById("edit-name").value.trim();
  const newMemo = document.getElementById("edit-memo").value.trim();

  if (!newName) {
    alert("資材名を入力してください");
    return;
  }

  stock.name = newName;
  stock.memo = newMemo;

  document.querySelectorAll(".edit-loc-count").forEach(input => {
    const loc = input.getAttribute("data-loc");
    const val = parseInt(input.value) || 0;
    stock.counts[loc] = val;
  });

  saveStocksToFirebase();
  addHistory(`[編集] ${stock.name} の情報を更新しました`);
  renderModalContent(stock, false);
}

function deleteStock(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;

  if (confirm(`「${stock.name}」を完全に削除しますか？`)) {
    stocks = stocks.filter(s => s.id !== stockId);
    saveStocksToFirebase();
    addHistory(`[削除] ${stock.name} を削除しました`);
    document.getElementById("detail-modal").style.display = "none";
  }
}

function addHistory(text) {
  const timeStr = new Date().toLocaleString("ja-JP");
  histories.push({ text, time: timeStr });
  saveHistoriesToFirebase();
}

// 5. イベントリスナー登録
document.addEventListener("DOMContentLoaded", () => {
  // タブ切り替え
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = btn.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");
    };
  });

  // モード切り替えボタン
  const modeBtn = document.getElementById("btn-mode-toggle");
  modeBtn.onclick = () => {
    isManageMode = !isManageMode;
    if (isManageMode) {
      modeBtn.textContent = "確認モードに戻す";
      modeBtn.classList.remove("active-mode");
    } else {
      modeBtn.textContent = "管理モードにする";
      modeBtn.classList.add("active-mode");
    }
    renderInventory();
  };

  // モーダル閉じる
  document.getElementById("modal-close").onclick = () => {
    document.getElementById("detail-modal").style.display = "none";
  };

  // 画像プレビュー
  const imgInput = document.getElementById("reg-stock-img");
  const imgPreview = document.getElementById("img-preview");
  let currentBase64Image = "";

  imgInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        currentBase64Image = event.target.result;
        imgPreview.innerHTML = `<img src="${currentBase64Image}">`;
      };
      reader.readAsDataURL(file);
    }
  };

  // 新規資材登録
  document.getElementById("form-register-stock").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-stock-name").value.trim();
    const memo = document.getElementById("reg-stock-memo").value.trim();
    const loc = document.getElementById("reg-stock-location").value;
    const count = parseInt(document.getElementById("reg-stock-count").value) || 0;

    const newStock = {
      id: "stock_" + Date.now(),
      name: name,
      image: currentBase64Image,
      memo: memo,
      counts: {}
    };

    locations.forEach(l => {
      newStock.counts[l] = (l === loc) ? count : 0;
    });

    stocks.push(newStock);
    saveStocksToFirebase();
    addHistory(`[登録] ${name} を作成 (${loc}: ${count}個)`);

    // フォームリセット
    e.target.reset();
    imgPreview.innerHTML = "画像未選択";
    currentBase64Image = "";
    alert("資材を登録しました");
  };

  // 新規場所追加
  document.getElementById("form-register-location").onsubmit = (e) => {
    e.preventDefault();
    const locName = document.getElementById("reg-location-name").value.trim();
    if (locations.includes(locName)) {
      alert("その場所はすでに存在します");
      return;
    }

    locations.push(locName);
    stocks.forEach(s => {
      if (!s.counts) s.counts = {};
      s.counts[locName] = 0;
    });

    saveLocationsToFirebase();
    saveStocksToFirebase();
    addHistory(`[場所追加] ${locName} を追加しました`);

    e.target.reset();
    alert("新しい保管場所を追加しました");
  };

  // 移動フォーム
  document.getElementById("form-move").onsubmit = (e) => {
    e.preventDefault();
    const stockId = document.getElementById("move-stock-select").value;
    const fromLoc = document.getElementById("move-from-select").value;
    const toLoc = document.getElementById("move-to-select").value;
    const count = parseInt(document.getElementById("move-count").value) || 0;

    if (fromLoc === toLoc) {
      alert("移動元と移動先が同じです");
      return;
    }

    const stock = stocks.find(s => s.id === stockId);
    if (!stock) return;

    const currentCount = stock.counts[fromLoc] || 0;
    if (currentCount < count) {
      alert(`「${fromLoc}」には ${currentCount} 個しかありません（指定: ${count}個）`);
      return;
    }

    stock.counts[fromLoc] -= count;
    stock.counts[toLoc] = (stock.counts[toLoc] || 0) + count;

    saveStocksToFirebase();
    addHistory(`[移動] ${stock.name} を ${fromLoc} ➔ ${toLoc} へ ${count}個 移動`);

    alert("移動を記録しました");
  };

  // Firebase同期開始
  initFirebaseSync();
});
