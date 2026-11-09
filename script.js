// --- Firebaseのインポート ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ご自身のFirebaseコンソールの設定情報をここに入れてください
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- データ格納用変数 ---
let locations = [];
let stocks = [];
let histories = [];

let currentUploadedImage = null;
let isStockManageMode = false;
let currentModalStockId = null;

// --- アプリの初期化（Firestoreからデータをロードしてから画面を構築） ---
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupImagePreview();
  setupModal();
  setupModeToggle();

  // Firestoreからデータを読み込む
  await loadDataFromFirestore();

  setupForms(); // フォーム送信イベントのセットアップ
});

// --- 画像自動圧縮・縮小関数 ---
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

// --- Firestoreからのデータ読み込み ---
async function loadDataFromFirestore() {
  try {
    // 1. locationsの読み込み
    const locSnap = await getDoc(doc(db, "settings", "locationsData"));
    if (locSnap.exists()) {
      locations = locSnap.data().list || ["Aさん宅", "Bさん宅"];
    } else {
      locations = ["Aさん宅", "Bさん宅"];
      await setDoc(doc(db, "settings", "locationsData"), { list: locations });
    }

    // 2. stocksの読み込み
    const stocksSnapshot = await getDocs(collection(db, "stocks"));
    stocks = [];
    stocksSnapshot.forEach((docSnap) => {
      stocks.push({ id: docSnap.id, ...docSnap.data() });
    });
    if (stocks.length === 0) {
      stocks = [
        { id: "1", location: "Aさん宅", name: "木材（ベニヤ板）", homeCount: 12, churchCount: 5, image: null, memo: "厚さ12mm。" },
        { id: "2", location: "Bさん宅", name: "スタイロフォーム", homeCount: 8, churchCount: 2, image: null, memo: "20mm厚。" }
      ];
      for (const s of stocks) {
        await setDoc(doc(db, "stocks", s.id), s);
      }
    }

    // 3. historiesの読み込み
    const histSnap = await getDoc(doc(db, "settings", "historiesData"));
    if (histSnap.exists()) {
      histories = histSnap.data().list || [];
    } else {
      histories = [{ time: "2026/11/06 14:00", text: "アプリを初期化しました" }];
      await setDoc(doc(db, "settings", "historiesData"), { list: histories });
    }

    // 画面を描画
    renderStockList();
    renderHistoryList();
    renderLocationManageList();
    updateLocationSelectOptions();
    updateEditSelectOptions();

  } catch (error) {
    console.error("データの読み込みに失敗しました: ", error);
    alert("データの読み込みに失敗しました。コンソールを確認してください。");
  }
}

// --- Firestoreへの設定保存ヘルパー ---
async function saveLocationsToFirestore() {
  await setDoc(doc(db, "settings", "locationsData"), { list: locations });
}

async function saveHistoriesToFirestore() {
  await setDoc(doc(db, "settings", "historiesData"), { list: histories });
}

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

  document.querySelectorAll(".stock-item-row").forEach(row => {
    row.addEventListener("click", () => {
      const stockId = row.getAttribute("data-id");
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

  let actionButtonsHTML = "";
  if (isStockManageMode) {
    actionButtonsHTML = `
      <div class="modal-actions">
        <button class="btn-modal-edit" onclick="switchToEditMode('${stock.id}')">編集する</button>
        <button class="btn-modal-delete" onclick="deleteStockModal('${stock.id}')">削除する</button>
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
      <button class="btn-modal-save" onclick="saveStockModal('${stock.id}')">保存する</button>
      <button class="btn-modal-delete" onclick="openStockDetailModal('${stock.id}')">取消</button>
    </div>
  `;

  const imgInput = document.getElementById("edit-modal-image");
  imgInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        stock.tempImage = await compressImage(file, 800, 0.7);
        alert("画像の圧縮が完了しました！「保存する」を押して反映させてください。");
      } catch (error) {
        console.error("画像の圧縮に失敗しました", error);
      }
    }
  });
};

// 7. モーダルでの編集内容を保存
window.saveStockModal = async function(stockId) {
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

  await updateDoc(doc(db, "stocks", stock.id), {
    name: stock.name,
    location: stock.location,
    homeCount: stock.homeCount,
    churchCount: stock.churchCount,
    memo: stock.memo,
    image: stock.image || null
  });

  addHistory(`【資材編集】「${stock.name}」の内容を更新しました`);
  renderStockList();
  updateEditSelectOptions();
  openStockDetailModal(stockId);
  alert("変更を保存しました！");
};

// 8. モーダルから資材削除
window.deleteStockModal = async function(stockId) {
  const stockIndex = stocks.findIndex(s => s.id === stockId);
  if (stockIndex === -1) return;

  const target = stocks[stockIndex];
  if (confirm(`「${target.name}」（${target.location}）を削除してもよろしいですか？`)) {
    await deleteDoc(doc(db, "stocks", stockId));
    addHistory(`【資材削除】「${target.name}」（${target.location}）を削除しました`);
    stocks.splice(stockIndex, 1);
    document.getElementById("modal-detail").style.display = "none";
    renderStockList();
    updateEditSelectOptions();
  }
};

// 9. 画像プレビュー（自動圧縮付き）
function setupImagePreview() {
  const imageInput = document.getElementById("reg-image");
  const previewBox = document.getElementById("image-preview");

  if (!imageInput) return;

  imageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        previewBox.innerHTML = "画像を圧縮中...";
        currentUploadedImage = await compressImage(file, 800, 0.7);
        previewBox.innerHTML = `<img src="${currentUploadedImage}" alt="プレビュー">`;
      } catch (error) {
        console.error("画像の処理に失敗しました", error);
        alert("画像の読み込みに失敗しました。");
        currentUploadedImage = null;
        previewBox.innerHTML = "画像未選択";
      }
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
    btn.addEventListener("click", async (e) => {
      const locName = e.target.getAttribute("data-location");
      const hasItems = stocks.some(s => s.location === locName);
      if (hasItems) {
        alert(`「${locName}」にはまだ資材が登録されているため削除できません。`);
        return;
      }

      if (confirm(`宅「${locName}」を削除してもよろしいですか？`)) {
        locations = locations.filter(l => l !== locName);
        await saveLocationsToFirestore();
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
    locForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newLocName = document.getElementById("new-location-name").value.trim();

      if (!newLocName) return;
      if (locations.includes(newLocName)) {
        alert("その宅はすでに登録されています！");
        return;
      }

      locations.push(newLocName);
      await saveLocationsToFirestore();
      updateLocationSelectOptions();
      renderStockList();
      renderLocationManageList();
      locForm.reset();
      alert(`新しい宅「${newLocName}」を追加しました！`);
    });
  }

  const regForm = document.getElementById("form-register");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("reg-name").value;
      const location = document.getElementById("reg-location-select").value;
      const homeCount = parseInt(document.getElementById("reg-home-count").value) || 0;
      const churchCount = parseInt(document.getElementById("reg-church-count").value) || 0;
      const memo = document.getElementById("reg-memo").value.trim();

      const newId = String(Date.now());
      const newStock = {
        name: name,
        location: location,
        homeCount: homeCount,
        churchCount: churchCount,
        image: currentUploadedImage,
        memo: memo
      };

      await setDoc(doc(db, "stocks", newId), newStock);
      stocks.push({ id: newId, ...newStock });

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
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const stockId = document.getElementById("edit-stock-id").value;
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

      await updateDoc(doc(db, "stocks", targetStock.id), {
        homeCount: targetStock.homeCount,
        churchCount: targetStock.churchCount
      });
      await saveHistoriesToFirestore();

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
  if (histories.length > 50) histories.pop();
  saveHistoriesToFirestore();
  renderHistoryList();
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
