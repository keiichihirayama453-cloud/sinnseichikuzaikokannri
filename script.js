// --- 初期データ ---
let locations = ["Aさん宅", "Bさん宅"];

let stocks = [
  { id: 1, location: "Aさん宅", name: "木材（ベニヤ板）", homeCount: 12, churchCount: 5, image: null, memo: "厚さ12mm。サカイの引っ越し箱の横に保管。" },
  { id: 2, location: "Aさん宅", name: "ビス・釘セット", homeCount: 5, churchCount: 2, image: null, memo: "長めのネジが中心です。" },
  { id: 3, location: "Bさん宅", name: "スタイロフォーム", homeCount: 8, churchCount: 2, image: null, memo: "20mm厚。雨に濡れないようビニールカバー保管。" }
];

let histories = [
  { time: "2026/11/06 14:00", text: "山田：Aさん宅から貸出へ 木材（ベニヤ板）を 5個 移動しました" }
];

let currentUploadedImage = null;
let isStockManageMode = false;
let currentModalStockId = null;

// --- アプリの初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupImagePreview();
  setupForms();
  setupModeToggle();
  setupModal();
  renderStockList();
  renderHistoryList();
  renderLocationManageList();
  updateLocationSelectOptions();
  updateEditSelectOptions();
});

// 1. タブ切り替え
function setupTabs() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      navButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetTabId = btn.getAttribute("data-tab");
      document.getElementById(targetTabId).classList.add("active");
    });
  });
}

// 2. モード切り替え
function setupModeToggle() {
  const btn = document.getElementById("btn-toggle-mode");
  if (!btn) return;

  btn.addEventListener("click", () => {
    isStockManageMode = !isStockManageMode;

    if (isStockManageMode) {
      btn.textContent = "確認モードに戻す";
      btn.classList.add("active-mode");
    } else {
      btn.textContent = "管理モードにする";
      btn.classList.remove("active-mode");
    }
  });
}

// 3. 在庫一覧表示
function renderStockList() {
  const listContainer = document.getElementById("stock-list");
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const groupedByLocation = {};
  locations.forEach(loc => {
    groupedByLocation[loc] = [];
  });

  stocks.forEach(stock => {
    if (!groupedByLocation[stock.location]) {
      groupedByLocation[stock.location] = [];
    }
    groupedByLocation[stock.location].push(stock);
  });

  for (const [location, items] of Object.entries(groupedByLocation)) {
    const card = document.createElement("div");
    card.className = "location-card";

    let itemsHTML = "";
    if (items.length === 0) {
      itemsHTML = `<div style="font-size:0.85rem; color:#888; padding:5px 0;">登録されている資材はありません</div>`;
    } else {
      items.forEach(stock => {
        itemsHTML += `
          <div class="stock-item-row" data-id="${stock.id}">
            <div class="stock-info">
              <div class="stock-title">${escapeHTML(stock.name)}</div>
              <div class="stock-counts">
                <span class="count-badge">宅: <strong>${stock.homeCount}</strong>個</span>
                <span class="count-badge">貸出: <strong>${stock.churchCount}</strong>個</span>
              </div>
            </div>
            <div style="color: #bbb; font-size: 0.9rem;">〉</div>
          </div>
        `;
      });
    }

    card.innerHTML = `
      <div class="location-header">🏠 ${escapeHTML(location)}</div>
      <div class="stock-items-container">
        ${itemsHTML}
      </div>
    `;
    listContainer.appendChild(card);
  }

  // 行クリックイベントの登録
  document.querySelectorAll(".stock-item-row").forEach(row => {
    row.addEventListener("click", () => {
      const stockId = parseInt(row.getAttribute("data-id"));
      openStockDetailModal(stockId);
    });
  });
}

// 4. モーダル設定
function setupModal() {
  const modal = document.getElementById("modal-detail");
  const closeBtn = document.getElementById("modal-close");

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
}

// 5. 資材詳細ポップアップを開く
function openStockDetailModal(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;

  currentModalStockId = stockId;
  const modal = document.getElementById("modal-detail");
  const body = document.getElementById("modal-body");

  const imgHTML = stock.image
    ? `<img src="${stock.image}" class="detail-img" alt="${stock.name}">`
    : `<div class="detail-img" style="display:flex;align-items:center;justify-content:center;color:#888;">画像なし</div>`;

  const memoText = stock.memo ? escapeHTML(stock.memo) : "メモはありません";

  // 管理モードの場合だけ「編集」「削除」ボタンを表示
  let actionButtonsHTML = "";
  if (isStockManageMode) {
    actionButtonsHTML = `
      <div class="modal-actions">
        <button class="btn-modal-edit" onclick="switchToEditMode(${stock.id})">編集する</button>
        <button class="btn-modal-delete" onclick="deleteStockModal(${stock.id})">削除する</button>
      </div>
    `;
  }

  body.innerHTML = `
    <h3 style="margin-bottom:12px; border-bottom:2px solid #edf2f7; padding-bottom:6px;">${escapeHTML(stock.name)}</h3>
    ${imgHTML}
    <div style="font-size:0.9rem; margin-bottom: 6px;">
      <strong>保管場所:</strong> 🏠 ${escapeHTML(stock.location)}
    </div>
    <div style="font-size:0.9rem; margin-bottom: 8px;">
      <strong>在庫状況:</strong> 宅 ${stock.homeCount}個 / 貸出 ${stock.churchCount}個
    </div>
    <div style="font-size:0.85rem; font-weight:bold; color:#555; margin-top:10px;">メモ・備考</div>
    <div class="detail-memo">${memoText}</div>
    ${actionButtonsHTML}
  `;

  modal.style.display = "flex";
}

// 6. モーダル内を「編集フォーム」に切り替える
window.switchToEditMode = function(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;

  const body = document.getElementById("modal-body");

  // 保管場所の選択肢を作成
  let locationOptions = "";
  locations.forEach(loc => {
    const selected = loc === stock.location ? "selected" : "";
    locationOptions += `<option value="${loc}" ${selected}>${loc}</option>`;
  });

  body.innerHTML = `
    <h3 style="margin-bottom:12px;">資材の編集</h3>
    <div class="form-group" style="margin-bottom:10px;">
      <label>資材名</label>
      <input type="text" id="edit-modal-name" value="${escapeHTML(stock.name)}">
    </div>
    <div class="form-group" style="margin-bottom:10px;">
      <label>保管場所</label>
      <select id="edit-modal-location">${locationOptions}</select>
    </div>
    <div class="form-group" style="margin-bottom:10px;">
      <label>宅の個数 / 貸出個数</label>
      <div style="display:flex; gap:8px;">
        <input type="number" id="edit-modal-home" value="${stock.homeCount}" min="0">
        <input type="number" id="edit-modal-church" value="${stock.churchCount}" min="0">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:10px;">
      <label>写真の変更</label>
      <input type="file" id="edit-modal-image" accept="image/*">
    </div>
    <div class="form-group" style="margin-bottom:10px;">
      <label>メモ</label>
      <textarea id="edit-modal-memo" rows="3">${escapeHTML(stock.memo || "")}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-modal-save" onclick="saveStockModal(${stock.id})">保存する</button>
      <button class="btn-modal-delete" onclick="openStockDetailModal(${stock.id})">取消</button>
    </div>
  `;

  // 画像変更用のイベント監視
  const imgInput = document.getElementById("edit-modal-image");
  imgInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        stock.tempImage = event.target.result; // 一時保存
      };
      reader.readAsDataURL(file);
    }
  });
};

// 7. モーダルでの編集内容を保存
window.saveStockModal = function(stockId) {
  const stock = stocks.find(s => s.id === stockId);
  if (!stock) return;

  const newName = document.getElementById("edit-modal-name").value.trim();
  const newLocation = document.getElementById("edit-modal-location").value;
  const newHome = parseInt(document.getElementById("edit-modal-home").value);
  const newChurch = parseInt(document.getElementById("edit-modal-church").value);
  const newMemo = document.getElementById("edit-modal-memo").value.trim();

  if (!newName) {
    alert("資材名を入力してください。");
    return;
  }
  if (isNaN(newHome) || isNaN(newChurch) || newHome < 0 || newChurch < 0) {
    alert("個数は0以上で入力してください。");
    return;
  }

  stock.name = newName;
  stock.location = newLocation;
  stock.homeCount = newHome;
  stock.churchCount = newChurch;
  stock.memo = newMemo;
  if (stock.tempImage) {
    stock.image = stock.tempImage;
    delete stock.tempImage;
  }

  addHistory(`【資材編集】「${stock.name}」の内容を更新しました`);
  renderStockList();
  updateEditSelectOptions();
  openStockDetailModal(stockId); // 詳細画面に戻す
  alert("変更を保存しました！");
};

// 8. モーダルから資材削除
window.deleteStockModal = function(stockId) {
  const stockIndex = stocks.findIndex(s => s.id === stockId);
  if (stockIndex === -1) return;

  const target = stocks[stockIndex];
  if (confirm(`「${target.name}」（${target.location}）を削除してもよろしいですか？`)) {
    addHistory(`【資材削除】「${target.name}」（${target.location}）を削除しました`);
    stocks.splice(stockIndex, 1);
    document.getElementById("modal-detail").style.display = "none";
    renderStockList();
    updateEditSelectOptions();
  }
};

// 9. 画像プレビュー
function setupImagePreview() {
  const imageInput = document.getElementById("reg-image");
  const previewBox = document.getElementById("image-preview");

  if (!imageInput) return;

  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        currentUploadedImage = event.target.result;
        previewBox.innerHTML = `<img src="${currentUploadedImage}" alt="プレビュー">`;
      };
      reader.readAsDataURL(file);
    } else {
      currentUploadedImage = null;
      previewBox.innerHTML = "画像未選択";
    }
  });
}

// 10. 宅一覧管理
function renderLocationManageList() {
  const container = document.getElementById("location-manage-list");
  if (!container) return;
  container.innerHTML = "";

  locations.forEach(loc => {
    const li = document.createElement("li");
    li.className = "manage-item";
    li.innerHTML = `
      <span>🏠 ${escapeHTML(loc)}</span>
      <button class="btn-small-delete btn-delete-location" data-location="${escapeHTML(loc)}">削除</button>
    `;
    container.appendChild(li);
  });

  document.querySelectorAll(".btn-delete-location").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const locName = e.target.getAttribute("data-location");
      const hasItems = stocks.some(s => s.location === locName);
      if (hasItems) {
        alert(`「${locName}」にはまだ資材が登録されているため削除できません。`);
        return;
      }

      if (confirm(`宅「${locName}」を削除してもよろしいですか？`)) {
        locations = locations.filter(l => l !== locName);
        renderLocationManageList();
        updateLocationSelectOptions();
        renderStockList();
        addHistory(`【宅削除】「${locName}」を削除しました`);
      }
    });
  });
}

// 11. プルダウンの更新
function updateLocationSelectOptions() {
  const select = document.getElementById("reg-location-select");
  if (!select) return;
  select.innerHTML = "";
  locations.forEach(loc => {
    const option = document.createElement("option");
    option.value = loc;
    option.textContent = loc;
    select.appendChild(option);
  });
}

function updateEditSelectOptions() {
  const select = document.getElementById("edit-stock-id");
  if (!select) return;
  select.innerHTML = "";
  stocks.forEach(stock => {
    const option = document.createElement("option");
    option.value = stock.id;
    option.textContent = `【${stock.location}】${stock.name}`;
    select.appendChild(option);
  });
}

// 12. 履歴描画
function renderHistoryList() {
  const historyUl = document.getElementById("history-list");
  if (!historyUl) return;
  historyUl.innerHTML = "";
  histories.forEach(item => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div>${escapeHTML(item.text)}</div>
      <div class="history-time">${item.time}</div>
    `;
    historyUl.appendChild(li);
  });
}

// 13. フォームイベントの設定
function setupForms() {
  const locForm = document.getElementById("form-add-location");
  if (locForm) {
    locForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newLocName = document.getElementById("new-location-name").value.trim();

      if (!newLocName) return;
      if (locations.includes(newLocName)) {
        alert("その宅はすでに登録されています！");
        return;
      }

      locations.push(newLocName);
      updateLocationSelectOptions();
      renderStockList();
      renderLocationManageList();
      locForm.reset();
      alert(`新しい宅「${newLocName}」を追加しました！`);
    });
  }

  const regForm = document.getElementById("form-register");
  if (regForm) {
    regForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("reg-name").value;
      const location = document.getElementById("reg-location-select").value;
      const homeCount = parseInt(document.getElementById("reg-home-count").value) || 0;
      const churchCount = parseInt(document.getElementById("reg-church-count").value) || 0;
      const memo = document.getElementById("reg-memo").value.trim();

      const newStock = {
        id: Date.now(),
        name: name,
        location: location,
        homeCount: homeCount,
        churchCount: churchCount,
        image: currentUploadedImage,
        memo: memo
      };

      stocks.push(newStock);
      addHistory(`【新規登録】${location}に「${name}」を登録しました。（宅:${homeCount}個 / 貸出:${churchCount}個）`);

      renderStockList();
      updateEditSelectOptions();

      regForm.reset();
      const preview = document.getElementById("image-preview");
      if (preview) preview.innerHTML = "画像未選択";
      currentUploadedImage = null;
      updateLocationSelectOptions();

      alert("新規資材を登録しました！");
    });
  }

  const editForm = document.getElementById("form-edit");
  if (editForm) {
    editForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const stockId = parseInt(document.getElementById("edit-stock-id").value);
      const type = document.getElementById("edit-type").value;
      const count = parseInt(document.getElementById("edit-count").value) || 0;
      const userName = document.getElementById("edit-user").value;

      const targetStock = stocks.find(s => s.id === stockId);
      if (!targetStock) return;

      if (type === "move") {
        if (targetStock.homeCount < count) {
          alert("宅の在庫数が足りません！");
          return;
        }
        targetStock.homeCount -= count;
        targetStock.churchCount += count;
        addHistory(`${userName}：${targetStock.location}から貸出へ「${targetStock.name}」を ${count}個 移動しました`);
      } else if (type === "return") {
        if (targetStock.churchCount < count) {
          alert("貸出中の在庫数が足りません！");
          return;
        }
        targetStock.churchCount -= count;
        targetStock.homeCount += count;
        addHistory(`${userName}：貸出から${targetStock.location}へ「${targetStock.name}」を ${count}個 返却しました`);
      } else if (type === "use") {
        if (targetStock.churchCount < count) {
          alert("貸出中の在庫数が足りません！");
          return;
        }
        targetStock.churchCount -= count;
        addHistory(`${userName}：貸出中の「${targetStock.name}」を ${count}個 利用（消費）しました`);
      }

      renderStockList();
      editForm.reset();
      alert("在庫情報を更新しました！");
    });
  }
}

function addHistory(text) {
  const now = new Date();
  const timeStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  histories.unshift({ time: timeStr, text: text });
  renderHistoryList();
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}