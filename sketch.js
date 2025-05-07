// 定数定義
const CONFIG = {
  maxButtons: 8,
  minButtons: 1,
  initialButtonCount: 2,
  colors: {
    primary: '#2196F3',
    secondary: '#FF4081',
    success: '#4CAF50',
    danger: '#F44336',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#212121',
    textSecondary: '#757575',
    border: '#E0E0E0'
  },
  storage: {
    buttonData: 'buttonCounterData',
    history: 'buttonCounterHistory',
    clearedHistory: 'clearedHistory',
    firstVisit: 'firstVisit'
  },
  app: {
    name: '日常の記録',
    description: '日常をボタンで数える。\nあなたの記録を気軽に記録しよう。',
    tutorial: [
      'ボタンの作成：記録したい項目を設定',
      'ボタンを押す：時刻とともに記録が保存',
      'ボタンの編集：ボタンの追加・削除・名前の変更',
      '履歴のダウンロード：Excelで保存',
    ]
  },
  pwa: {
    deferredPrompt: null,
    isInstallable: false
  }
};

// グローバル変数
let state = {
  buttonCount: CONFIG.initialButtonCount,
  buttonNames: [],
  editMode: false,
  gridButtons: [],
  controlButtons: {},
  clickHistory: [],
  showHistory: false,
  clearedHistory: [],
  historyPanel: null
};

// 初期化関数
function setup() {
  noCanvas();
  if (!localStorage.getItem(CONFIG.storage.buttonData)) {
    initializeNewApp();
  } else {
    loadSavedData();
  }

  // Service Worker の登録
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('ServiceWorker 登録成功:', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker 登録失敗:', err);
      });
  }

  // インストールイベントの監視
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    CONFIG.pwa.deferredPrompt = e;
    CONFIG.pwa.isInstallable = true;
    updateInstallButton();
  });

  // 初回訪問時はスプラッシュスクリーンを表示
  if (!localStorage.getItem(CONFIG.storage.firstVisit)) {
    showSplashScreen();
  } else {
    createUI();
  }
  applyGlobalStyles();
}

function initializeNewApp() {
  console.log('新規作成: 全てのデータをクリアします');
  localStorage.clear();
  state.buttonCount = 0;
  state.buttonNames = [];
  state.clickHistory = [];
  state.clearedHistory = [];
  state.editMode = false;
}

function loadSavedData() {
  loadButtonData();
  loadHistory();
}

// データ管理関数
function saveButtonData() {
  const data = {
    buttonCount: state.buttonCount,
    buttonNames: state.buttonNames
  };
  localStorage.setItem(CONFIG.storage.buttonData, JSON.stringify(data));
}

function loadButtonData() {
  const savedData = localStorage.getItem(CONFIG.storage.buttonData);
  if (savedData) {
    try {
      const data = JSON.parse(savedData);
      state.buttonCount = data.buttonCount;
      state.buttonNames = data.buttonNames || Array(state.buttonCount).fill('新規ボタン');
    } catch (e) {
      console.error('保存データの読み込みに失敗しました:', e);
      state.buttonCount = 0;
      state.buttonNames = [];
    }
  }
}

function saveHistory() {
  localStorage.setItem(CONFIG.storage.history, JSON.stringify(state.clickHistory));
  localStorage.setItem(CONFIG.storage.clearedHistory, JSON.stringify(state.clearedHistory));
}

function loadHistory() {
  const savedHistory = localStorage.getItem(CONFIG.storage.history);
  if (savedHistory) {
    try {
      state.clickHistory = JSON.parse(savedHistory);
    } catch (e) {
      console.error('履歴データの読み込みに失敗しました:', e);
      state.clickHistory = [];
    }
  }

  const savedClearedHistory = localStorage.getItem(CONFIG.storage.clearedHistory);
  if (savedClearedHistory) {
    try {
      state.clearedHistory = JSON.parse(savedClearedHistory);
    } catch (e) {
      console.error('クリアされた履歴データの読み込みに失敗しました:', e);
      state.clearedHistory = [];
    }
  }
}

// UI関連関数
function createUI() {
  const containers = createControlBarContainer();
  createControlButtons(containers);
  updateUI();
}

function createControlBarContainer() {
  const controlBar = createDiv('');
  controlBar.addClass('control-bar');

  // タイトルの追加（クリッカブルに変更）
  const title = createA('#', CONFIG.app.name);
  title.addClass('app-title');
  title.style('font-size', '20px');
  title.style('font-weight', 'bold');
  title.style('color', "red");
  title.style('margin-right', 'auto');
  title.style('text-decoration', 'none');
  title.style('cursor', 'pointer');
  title.mousePressed(() => {
    location.reload();
  });
  controlBar.child(title);

  // ハンバーガーメニューボタン（スマホ用）
  const menuButton = createButton('☰');
  menuButton.addClass('menu-button');
  menuButton.style('display', 'none');
  menuButton.style('background', 'none');
  menuButton.style('border', 'none');
  menuButton.style('font-size', '24px');
  menuButton.style('padding', '8px');
  menuButton.style('color', CONFIG.colors.text);
  menuButton.style('cursor', 'pointer');
  menuButton.mousePressed(toggleMobileMenu);
  controlBar.child(menuButton);

  // ボタンコンテナ（スマホでは最初は非表示）
  const buttonContainer = createDiv('');
  buttonContainer.id('control-buttons-container');
  buttonContainer.addClass('control-buttons-container');
  buttonContainer.style('display', windowWidth <= 768 ? 'none' : 'flex');
  buttonContainer.style('gap', '8px');
  buttonContainer.style('align-items', 'center');
  controlBar.child(buttonContainer);

  applyControlBarStyles(controlBar);
  return { controlBar, buttonContainer };
}

function createControlButtons(containers) {
  const { buttonContainer } = containers;

  state.controlButtons = {
    add: createAddButton(),
    remove: createRemoveButton(),
    edit: createEditButton(),
    history: createHistoryButton(),
    download: createDownloadButton(),
    install: createInstallButton()
  };

  // デバッグ用のリセットボタン
  const resetButton = createButton('🔄 Reset');
  resetButton.addClass('btn-secondary');
  resetButton.style('white-space', 'nowrap');
  resetButton.style('background', '#666');
  resetButton.style('margin-left', '8px');
  resetButton.mousePressed(() => {
    if (confirm('全てのデータとスプラッシュスクリーン表示状態をリセットしますか？')) {
      localStorage.clear();
      location.reload();
    }
  });
  state.controlButtons.reset = resetButton;

  Object.values(state.controlButtons).forEach(button => {
    buttonContainer.child(button);
  });
}

// ボタン作成関数
function createAddButton() {
  const button = createButton('＋');
  button.addClass('btn-success');
  applyControlButtonStyles(button);
  button.style('display', 'none');
  button.mousePressed(() => {
    if (state.buttonCount < CONFIG.maxButtons) {
      state.buttonCount++;
      saveButtonData();
      updateUI();
    }
  });
  return button;
}

function createRemoveButton() {
  const button = createButton('－');
  button.addClass('btn-danger');
  applyControlButtonStyles(button);
  button.style('display', 'none');
  button.mousePressed(() => {
    if (state.buttonCount > CONFIG.minButtons) {
      state.buttonCount--;
      saveButtonData();
      updateUI();
    }
  });
  return button;
}

function createEditButton() {
  const button = createButton('ボタンを編集');
  button.addClass('btn-primary');
  button.style('white-space', 'nowrap');
  button.mousePressed(toggleEditMode);
  return button;
}

function createHistoryButton() {
  const button = createButton('履歴を表示');
  button.addClass('btn-secondary');
  button.style('white-space', 'nowrap');
  button.mousePressed(() => {
    if (state.showHistory) {
      hideHistoryPanel();
    } else {
      showHistoryPanel();
    }
  });
  return button;
}

function createDownloadButton() {
  const button = createButton('履歴をダウンロード');
  button.addClass('btn-primary');
  button.style('white-space', 'nowrap');
  button.mousePressed(downloadExcel);
  return button;
}

function createInstallButton() {
  const button = createButton('アプリをインストール');
  button.addClass('btn-primary');
  button.style('white-space', 'nowrap');
  button.style('display', 'none');
  button.mousePressed(installApp);
  return button;
}

// スタイル適用関数
function applyControlButtonStyles(button) {
  button.style('min-width', '40px');
  button.style('height', '40px');
  button.style('padding', '0');
}

function applyControlBarStyles(controlBar) {
  controlBar.style('position', 'fixed');
  controlBar.style('top', '0');
  controlBar.style('left', '0');
  controlBar.style('right', '0');
  controlBar.style('height', '64px');
  controlBar.style('background', CONFIG.colors.surface);
  controlBar.style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');
  controlBar.style('display', 'flex');
  controlBar.style('align-items', 'center');
  controlBar.style('padding', '0 16px');
  controlBar.style('gap', '8px');
  controlBar.style('z-index', '1000');
}

// 編集モード関連関数
function toggleEditMode() {
  if (state.editMode) {
    saveButtonData();
  }
  state.editMode = !state.editMode;
  state.controlButtons.edit.html(state.editMode ? '完了' : 'ボタンを編集');
  state.controlButtons.add.style('display', state.editMode ? 'block' : 'none');
  state.controlButtons.remove.style('display', state.editMode ? 'block' : 'none');
  hideHistoryPanel();
  updateUI();
}

// 履歴関連関数
function showHistoryPanel() {
  hideHistoryPanel();
  state.historyPanel = createHistoryPanelContainer();
  createHistoryPanelContent();
  state.showHistory = true;
}

function hideHistoryPanel() {
  if (state.historyPanel) {
    state.historyPanel.remove();
    state.historyPanel = null;
  }
  state.showHistory = false;
}

// メイン更新関数
function updateUI() {
  clearGridButtons();
  const grid = calculateGrid();
  createGridButtons(grid);

  // ボタンが0個の場合、新規ボタン追加を促すボタンを表示
  if (state.buttonCount === 0) {
    const addFirstButton = createButton('＋ 新しいボタンを追加');
    addFirstButton.addClass('add-first-button');
    addFirstButton.style('position', 'fixed');
    addFirstButton.style('left', '50%');
    addFirstButton.style('top', '50%');
    addFirstButton.style('transform', 'translate(-50%, -50%)');
    addFirstButton.style('background', CONFIG.colors.secondary);
    addFirstButton.style('color', 'white');
    addFirstButton.style('padding', '16px 32px');
    addFirstButton.style('font-size', '18px');
    addFirstButton.style('border-radius', '8px');
    addFirstButton.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
    addFirstButton.style('cursor', 'pointer');
    addFirstButton.mousePressed(() => {
      // 編集モードに切り替え
      state.editMode = true;
      state.controlButtons.edit.html('編集を完了');
      state.controlButtons.add.style('display', 'inline-block');
      state.controlButtons.remove.style('display', 'inline-block');
      // 新規ボタンを追加
      state.buttonNames.push('新規ボタン');
      state.buttonCount++;
      saveButtonData();
      updateUI();
    });
    state.gridButtons.push(addFirstButton);
  } else if (state.editMode && state.buttonCount < CONFIG.maxButtons) {
    createAddNewButton();
  }
}

function clearGridButtons() {
  state.gridButtons.forEach(btn => {
    if (btn && btn.remove) {
      btn.remove();
    }
  });
  state.gridButtons = [];
}

function calculateGrid() {
  if (windowWidth <= 768) {
    return { rows: state.buttonCount, cols: 1 };
  }
  return getGrid(state.buttonCount);
}

// グリッド計算関数
function getGrid(n) {
  if (n === 1) return { rows: 1, cols: 1 };
  if (n === 2) return { rows: 1, cols: 2 };
  if (n === 3) return { rows: 1, cols: 3 };
  if (n === 4) return { rows: 2, cols: 2 };
  if (n <= 6) return { rows: 2, cols: 3 };
  return { rows: 2, cols: 4 };
}

// イベントハンドラ
function windowResized() {
  const buttonContainer = select('#control-buttons-container');
  if (buttonContainer) {
    if (windowWidth > 768) {
      // PC表示の場合は必ず表示
      buttonContainer.style('display', 'flex');
      buttonContainer.style('flex-direction', 'row');
      buttonContainer.style('position', 'static');
      buttonContainer.style('background', 'none');
      buttonContainer.style('box-shadow', 'none');
      buttonContainer.style('padding', '0');
    } else {
      // スマホ表示に切り替わる時は必ず非表示
      buttonContainer.style('display', 'none');
    }
  }
  updateUI();
}

// Excelダウンロード
function downloadExcel() {
  // ワークブックの作成
  const wb = XLSX.utils.book_new();

  // データの準備
  const data = [
    ['ボタン名', '日時'], // ヘッダー
    ...state.clickHistory.map(record => [record.buttonName, record.timestamp])
  ];

  // ワークシートの作成
  const ws = XLSX.utils.aoa_to_sheet(data);

  // 列幅の設定
  const wscols = [
    { wch: 20 }, // ボタン名列
    { wch: 20 }  // 日時列
  ];
  ws['!cols'] = wscols;

  // ワークブックにシートを追加
  XLSX.utils.book_append_sheet(wb, ws, "履歴");

  // Excelファイルの生成とダウンロード
  XLSX.writeFile(wb, `button_history_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// グローバルスタイルの適用
function applyGlobalStyles() {
  const style = document.createElement('style');
  style.textContent = `
    body {
      background-color: ${CONFIG.colors.background};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    button {
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    button:active {
      transform: translateY(1px);
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    input {
      border: 2px solid ${CONFIG.colors.border};
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 16px;
      transition: all 0.2s ease;
    }
    input:focus {
      outline: none;
      border-color: ${CONFIG.colors.primary};
      box-shadow: 0 0 0 3px rgba(33,150,243,0.1);
    }
    .menu-button {
      display: none;
    }
    .control-buttons-container {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    @media (max-width: 768px) {
      .menu-button {
        display: block !important;
      }
      .control-buttons-container {
        display: none;
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        background: ${CONFIG.colors.surface};
        padding: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
      }
      .control-buttons-container button {
        flex: 0 1 auto;
        min-width: 140px;
        margin: 4px;
      }
      .control-bar {
        justify-content: space-between;
      }
      /* スマホ表示時のリセットボタンのスタイル */
      .btn-secondary[style*="background: #666"] {
        margin-left: 0 !important;
        margin-top: 0 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function createHistoryPanelContainer() {
  const historyPanel = createDiv('');
  historyPanel.addClass('history-panel');
  historyPanel.style('position', 'fixed');
  historyPanel.style('right', '20px');
  historyPanel.style('top', '80px');
  historyPanel.style('width', '300px');
  historyPanel.style('max-height', 'calc(100vh - 100px)');
  historyPanel.style('overflow-y', 'auto');
  historyPanel.style('background', CONFIG.colors.surface);
  historyPanel.style('padding', '16px');
  historyPanel.style('border-radius', '12px');
  historyPanel.style('box-shadow', '0 4px 12px rgba(0,0,0,0.1)');
  historyPanel.style('z-index', '1000');
  return historyPanel;
}

function createHistoryPanelContent() {
  const header = createDiv('履歴');
  header.style('font-size', '20px');
  header.style('font-weight', 'bold');
  header.style('margin-bottom', '16px');
  header.style('color', CONFIG.colors.text);
  state.historyPanel.child(header);

  // ボタン操作のコンテナ
  const buttonContainer = createDiv('');
  buttonContainer.style('display', 'flex');
  buttonContainer.style('gap', '8px');
  buttonContainer.style('margin-bottom', '16px');
  buttonContainer.style('flex-wrap', 'wrap');

  // 履歴クリアボタン
  const clearHistoryButton = createButton('履歴をクリア');
  clearHistoryButton.addClass('btn-danger');
  clearHistoryButton.mousePressed(() => {
    if (confirm('本当に履歴をクリアしますか？\nクリアした履歴は後で復元できます。')) {
      state.clearedHistory = [...state.clickHistory];
      state.clickHistory = [];
      saveHistory();
      hideHistoryPanel();
      showHistoryPanel();
    }
  });
  buttonContainer.child(clearHistoryButton);

  // ボタン設定削除ボタン
  const clearButtonsButton = createButton('ボタン設定を削除');
  clearButtonsButton.addClass('btn-danger');
  clearButtonsButton.mousePressed(() => {
    if (confirm('本当にボタン設定を削除しますか？\nこの操作は取り消せません。')) {
      state.buttonNames = [];
      state.buttonCount = 0;
      saveButtonData();
      hideHistoryPanel();
      // 編集モードを終了して新規ボタン追加を促す画面を表示
      if (state.editMode) {
        state.editMode = false;
        state.controlButtons.edit.html('ボタンを編集');
        state.controlButtons.add.style('display', 'none');
        state.controlButtons.remove.style('display', 'none');
      }
      updateUI();
    }
  });
  buttonContainer.child(clearButtonsButton);

  // クリアした履歴の復元ボタン
  if (state.clearedHistory.length > 0) {
    const restoreButton = createButton('履歴を復元');
    restoreButton.addClass('btn-success');
    restoreButton.mousePressed(() => {
      if (confirm('クリアされた履歴を復元しますか？\n現在の履歴は上書きされます。')) {
        state.clickHistory = [...state.clearedHistory];
        state.clearedHistory = [];
        saveHistory();
        hideHistoryPanel();
        showHistoryPanel();
      }
    });
    buttonContainer.child(restoreButton);
  }

  state.historyPanel.child(buttonContainer);

  const historyList = createDiv('');
  historyList.style('display', 'flex');
  historyList.style('flex-direction', 'column');
  historyList.style('gap', '8px');

  [...state.clickHistory].reverse().forEach((record, index) => {
    const recordDiv = createDiv('');
    recordDiv.addClass('history-item');
    recordDiv.style('display', 'flex');
    recordDiv.style('justify-content', 'space-between');
    recordDiv.style('align-items', 'center');
    recordDiv.style('background', '#f5f5f5');
    recordDiv.style('padding', '8px 12px');
    recordDiv.style('border-radius', '4px');

    const contentDiv = createDiv('');
    contentDiv.style('flex-grow', '1');

    const buttonName = createDiv(record.buttonName);
    buttonName.addClass('history-item-name');
    buttonName.style('font-weight', 'bold');
    buttonName.style('margin-bottom', '4px');

    const timestamp = createDiv(record.timestamp);
    timestamp.addClass('history-item-time');
    timestamp.style('font-size', '0.9em');
    timestamp.style('color', '#666');

    contentDiv.child(buttonName);
    contentDiv.child(timestamp);

    const deleteButton = createButton('×');
    deleteButton.addClass('history-delete-button');
    deleteButton.style('background', 'none');
    deleteButton.style('border', 'none');
    deleteButton.style('color', CONFIG.colors.danger);
    deleteButton.style('font-size', '20px');
    deleteButton.style('padding', '4px 8px');
    deleteButton.style('margin-left', '8px');
    deleteButton.style('cursor', 'pointer');
    deleteButton.mousePressed(() => {
      const actualIndex = state.clickHistory.length - 1 - index;
      state.clickHistory.splice(actualIndex, 1);
      saveHistory();
      hideHistoryPanel();
      showHistoryPanel();
    });

    recordDiv.child(contentDiv);
    recordDiv.child(deleteButton);
    historyList.child(recordDiv);
  });

  state.historyPanel.child(historyList);
}

function createAddNewButton() {
  const addNewBtn = createButton('＋ 新しいボタンを追加');
  addNewBtn.addClass('add-new-button');
  addNewBtn.style('position', 'fixed');
  addNewBtn.style('left', '50%');
  addNewBtn.style('bottom', '20px');
  addNewBtn.style('transform', 'translateX(-50%)');
  addNewBtn.style('background', CONFIG.colors.primary);
  addNewBtn.style('color', 'white');
  addNewBtn.style('padding', '12px 24px');
  addNewBtn.style('border-radius', '8px');
  addNewBtn.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
  addNewBtn.mousePressed(() => {
    if (state.buttonCount === 0) {
      state.buttonNames = [];
      state.clickHistory = [];
      state.clearedHistory = [];
    }
    // 編集モードに切り替え
    if (!state.editMode) {
      state.editMode = true;
      state.controlButtons.edit.html('編集を完了');
      state.controlButtons.add.style('display', 'inline-block');
      state.controlButtons.remove.style('display', 'inline-block');
    }
    // 新規ボタンを追加
    state.buttonNames.push('新規ボタン');
    state.buttonCount++;
    saveButtonData();
    updateUI();
  });
  state.gridButtons.push(addNewBtn);
}

function createGridButtons(grid) {
  let w = windowWidth / grid.cols;
  let h = (windowHeight - 80) / grid.rows;

  // スマートフォン対応のための調整
  if (windowWidth <= 768) {
    w = windowWidth;
    h = (windowHeight - 120) / state.buttonCount;
  }

  let btn = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (btn >= state.buttonCount) break;
      let x = c * w;
      let y = r * h + 80;

      if (state.editMode) {
        createEditModeButton(btn, x, y, w, h);
      } else {
        createNormalButton(btn, x, y, w, h);
      }
      btn++;
    }
  }
}

function createEditModeButton(btn, x, y, w, h) {
  const editContainer = createDiv('');
  editContainer.addClass('edit-container');
  editContainer.style('position', 'fixed');
  editContainer.style('left', `${x + w * 0.1}px`);
  editContainer.style('top', `${y + h * 0.3}px`);
  editContainer.style('width', `${w * 0.8}px`);
  editContainer.style('display', 'flex');
  editContainer.style('align-items', 'center');
  editContainer.style('gap', '8px');

  const inp = createInput(state.buttonNames[btn] === '新規ボタン' ? '' : state.buttonNames[btn]);
  inp.attribute('placeholder', '新規ボタン');
  inp.style('flex', '1');
  inp.style('height', '32px');
  inp.style('font-size', windowWidth <= 768 ? '16px' : '20px');
  inp.input(() => {
    if (inp.value() || inp.value() === '') {
      state.buttonNames[btn] = inp.value() || '新規ボタン';
      saveButtonData();
    }
  });

  const deleteBtn = createButton('×');
  deleteBtn.addClass('btn-danger');
  deleteBtn.style('width', '32px');
  deleteBtn.style('height', '32px');
  deleteBtn.style('padding', '0');
  deleteBtn.style('font-size', '20px');
  deleteBtn.style('line-height', '1');
  deleteBtn.mousePressed(() => {
    if (state.buttonCount > CONFIG.minButtons) {
      state.buttonNames.splice(btn, 1);
      state.buttonCount--;
      saveButtonData();
      updateUI();
    }
  });

  editContainer.child(inp);
  editContainer.child(deleteBtn);
  state.gridButtons.push(editContainer);
}

function createNormalButton(btn, x, y, w, h) {
  const button = createButton(state.buttonNames[btn] || '新規ボタン');
  button.addClass('grid-button');
  button.style('left', `${x + w * 0.05}px`);
  button.style('top', `${y + h * 0.15}px`);
  button.style('width', `${w * 0.9}px`);
  button.style('height', `${h * 0.7}px`);
  button.style('font-size', windowWidth <= 768 ? '16px' : '2vw');
  button.style('background', CONFIG.colors.primary);
  button.style('color', 'white');
  button.style('font-weight', 'bold');
  button.style('text-shadow', '0 1px 2px rgba(0,0,0,0.2)');
  button.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
  button.style('transition', 'all 0.2s ease');

  button.mouseOver(() => {
    button.style('transform', 'translateY(-2px)');
    button.style('box-shadow', '0 6px 12px rgba(0,0,0,0.15)');
  });
  button.mouseOut(() => {
    button.style('transform', 'translateY(0)');
    button.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
  });

  button.mousePressed(() => {
    const now = new Date();
    const timestamp = formatDate(now);
    const buttonName = state.buttonNames[btn] || '新規ボタン';

    // コンソールにログを表示
    console.log(`ボタン: ${buttonName}`);
    console.log(`時刻: ${timestamp}`);
    console.log('------------------------');

    state.clickHistory.push({
      buttonName: buttonName,
      timestamp: timestamp
    });
    saveHistory();

    // 履歴パネルが表示されている場合は非表示にする
    if (state.showHistory) {
      hideHistoryPanel();
    }

    button.style('transform', 'scale(0.98)');
    setTimeout(() => {
      button.style('transform', 'scale(1)');
    }, 100);
  });
  state.gridButtons.push(button);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

function toggleMobileMenu() {
  const buttonContainer = select('#control-buttons-container');
  if (!buttonContainer) return;

  const isVisible = buttonContainer.style('display') !== 'none';

  if (isVisible) {
    buttonContainer.style('display', 'none');
  } else {
    buttonContainer.style('display', 'flex');
    // スマホビューの場合のみ、縦方向に配置
    if (windowWidth <= 768) {
      buttonContainer.style('flex-direction', 'column');
      buttonContainer.style('position', 'absolute');
      buttonContainer.style('top', '64px');
      buttonContainer.style('left', '0');
      buttonContainer.style('right', '0');
      buttonContainer.style('background', CONFIG.colors.surface);
      buttonContainer.style('padding', '16px');
      buttonContainer.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
      buttonContainer.style('z-index', '1000');
    }
  }
}

function showSplashScreen() {
  // スプラッシュスクリーンのコンテナ
  const splashContainer = createDiv('');
  splashContainer.style('position', 'fixed');
  splashContainer.style('top', '0');
  splashContainer.style('left', '0');
  splashContainer.style('width', '100%');
  splashContainer.style('height', '100%');
  splashContainer.style('background', CONFIG.colors.surface);
  splashContainer.style('display', 'flex');
  splashContainer.style('flex-direction', 'column');
  splashContainer.style('align-items', 'center');
  splashContainer.style('justify-content', 'center');
  splashContainer.style('padding', '20px');
  splashContainer.style('z-index', '2000');

  // アプリ名
  // タイトルの追加（クリッカブルに変更）
  const title = createA('#', CONFIG.app.name);
  title.addClass('app-title');
  title.style('font-size', '20px');
  title.style('font-weight', 'bold');
  title.style('color', CONFIG.colors.text);
  title.style('margin-right', 'auto');
  title.style('text-decoration', 'none');
  title.style('cursor', 'pointer');
  title.mousePressed(() => {
    location.reload();
  });
  splashContainer.child(title);

  // アプリの説明
  const description = createDiv(CONFIG.app.description.replace('\n', '<br>'));
  description.style('font-size', '18px');
  description.style('color', CONFIG.colors.textSecondary);
  description.style('margin-bottom', '40px');
  description.style('text-align', 'center');
  splashContainer.child(description);

  // チュートリアル
  const tutorialContainer = createDiv('');
  tutorialContainer.style('max-width', '600px');
  tutorialContainer.style('width', '100%');
  tutorialContainer.style('margin-bottom', '40px');

  CONFIG.app.tutorial.forEach((text, index) => {
    const step = createDiv(`${index + 1}. ${text}`);
    step.style('font-size', '16px');
    step.style('color', CONFIG.colors.text);
    step.style('margin-bottom', '16px');
    step.style('padding', '12px');
    step.style('background', '#f5f5f5');
    step.style('border-radius', '8px');
    tutorialContainer.child(step);
  });
  splashContainer.child(tutorialContainer);

  // 開始ボタン
  const startButton = createButton('はじめる');
  startButton.style('background', CONFIG.colors.primary);
  startButton.style('color', 'white');
  startButton.style('padding', '16px 32px');
  startButton.style('font-size', '18px');
  startButton.style('border-radius', '8px');
  startButton.style('border', 'none');
  startButton.style('cursor', 'pointer');
  startButton.style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');
  startButton.mousePressed(() => {
    // 初回訪問フラグを設定
    localStorage.setItem(CONFIG.storage.firstVisit, 'true');
    // スプラッシュスクリーンを削除
    splashContainer.remove();
    // メインUIを作成
    createUI();
  });
  splashContainer.child(startButton);
}

function updateInstallButton() {
  if (state.controlButtons.install) {
    state.controlButtons.install.style('display',
      CONFIG.pwa.isInstallable ? 'inline-block' : 'none'
    );
  }
}

async function installApp() {
  if (!CONFIG.pwa.deferredPrompt) return;

  CONFIG.pwa.deferredPrompt.prompt();
  const result = await CONFIG.pwa.deferredPrompt.userChoice;

  if (result.outcome === 'accepted') {
    console.log('アプリがインストールされました');
  } else {
    console.log('インストールがキャンセルされました');
  }

  CONFIG.pwa.deferredPrompt = null;
  CONFIG.pwa.isInstallable = false;
  updateInstallButton();
}
