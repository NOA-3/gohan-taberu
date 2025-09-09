/**
 * ホーム画面処理モジュール
 */

class HomeManager {
  constructor() {
    this.currentUser = null;
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth() + 1;
    this.menuData = [];
    this.checkStates = new Map();
    
    this.init();
  }

  init() {
    // ログイン状態チェック
    this.checkLoginStatus();
    
    // DOM要素の取得
    this.getDOMElements();
    
    // 日付セレクター初期化
    this.initializeDateSelectors();
    
    // イベントリスナー設定
    this.setupEventListeners();
    
    // 初期データ読み込み
    this.loadMenuData();
  }

  checkLoginStatus() {
    // authManagerが利用できない場合はログイン画面へリダイレクト
    if (typeof window.authManager === 'undefined') {
      window.location.href = 'index.html';
      return;
    }
    
    const loginInfo = window.authManager.getLoginInfo();
    if (!loginInfo) {
      // ログインしていない場合はログイン画面へリダイレクト
      window.location.href = 'index.html';
      return;
    }
    
    this.currentUser = loginInfo;
  }

  getDOMElements() {
    this.userNameElement = document.getElementById('userName');
    this.yearSelect = document.getElementById('yearSelect');
    this.monthSelect = document.getElementById('monthSelect');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.loadingIndicator = document.getElementById('loadingIndicator');
    this.menuContainer = document.getElementById('menuContainer');
    this.emptyState = document.getElementById('emptyState');
    this.messageContainer = document.getElementById('messageContainer');
    
    // ユーザー名表示
    this.userNameElement.textContent = this.currentUser.userName;
  }

  initializeDateSelectors() {
    // 年の選択肢生成（現在年を中心に前後2年）
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === this.currentYear) {
        option.selected = true;
      }
      this.yearSelect.appendChild(option);
    }
    
    // 月の選択肢生成
    for (let month = 1; month <= 12; month++) {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = month;
      if (month === this.currentMonth) {
        option.selected = true;
      }
      this.monthSelect.appendChild(option);
    }
  }

  setupEventListeners() {
    // 年月選択の変更イベント
    this.yearSelect.addEventListener('change', () => {
      this.currentYear = parseInt(this.yearSelect.value);
      this.loadMenuData();
    });
    
    this.monthSelect.addEventListener('change', () => {
      this.currentMonth = parseInt(this.monthSelect.value);
      this.loadMenuData();
    });
    
    // ログアウトボタン
    this.logoutBtn.addEventListener('click', () => {
      this.handleLogout();
    });
  }

  async loadMenuData() {
    try {
      this.showLoading(true);
      this.clearMessages();
      
      // メニューデータ取得
      const result = await api.getRecipes(this.currentYear, this.currentMonth);
      
      if (result.success) {
        this.menuData = result.recipes;
        await this.loadCheckStates();
        this.renderMenuBoxes();
        this.scrollToToday();
      } else {
        this.showError(result.error || 'メニューデータの取得に失敗しました');
        this.showEmptyState();
      }
    } catch (error) {
      console.error('Failed to load menu data:', error);
      this.showError('メニューデータの読み込み中にエラーが発生しました');
      this.showEmptyState();
    } finally {
      this.showLoading(false);
    }
  }

  async loadCheckStates() {
    try {
      // 各日付のチェック状態を取得
      for (const menu of this.menuData) {
        const result = await api.getCheckState(menu.date, this.currentUser.userName);
        if (result.success) {
          this.checkStates.set(menu.date, result.checked);
        }
      }
    } catch (error) {
      console.error('Failed to load check states:', error);
    }
  }

  renderMenuBoxes() {
    this.menuContainer.innerHTML = '';
    
    if (this.menuData.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.hideEmptyState();
    
    this.menuData.forEach(menu => {
      const menuBox = this.createMenuBox(menu);
      this.menuContainer.appendChild(menuBox);
    });
  }

  createMenuBox(menu) {
    const isChecked = this.checkStates.get(menu.date) || false;
    const isDisabled = !menu.isEditable;
    
    const boxElement = document.createElement('div');
    boxElement.className = `menu-box ${isDisabled ? 'disabled' : ''}`;
    boxElement.dataset.date = menu.date;
    
    boxElement.innerHTML = `
      ${!menu.isEditable ? '<div class="time-limit-notice">⏰ チェック期限を過ぎています</div>' : ''}
      
      <div class="menu-date">
        <span class="date-number">${this.extractDay(menu.date)}</span>
        <span class="date-day">${menu.dayOfWeek}曜日</span>
      </div>
      
      <div class="menu-items">
        <div class="menu-item">
          <div class="menu-item-icon main">🍖</div>
          <div class="menu-item-text ${isDisabled ? 'disabled' : ''}">
            ${menu.main || 'メイン料理未定'}
          </div>
        </div>
        
        <div class="menu-item">
          <div class="menu-item-icon side">🥗</div>
          <div class="menu-item-text ${isDisabled ? 'disabled' : ''}">
            ${menu.side1 || '副菜1未定'}
          </div>
        </div>
        
        <div class="menu-item">
          <div class="menu-item-icon side">🥬</div>
          <div class="menu-item-text ${isDisabled ? 'disabled' : ''}">
            ${menu.side2 || '副菜2未定'}
          </div>
        </div>
        
        <div class="menu-item">
          <div class="menu-item-icon soup">🍲</div>
          <div class="menu-item-text ${isDisabled ? 'disabled' : ''}">
            ${menu.soup || '汁物未定'}
          </div>
        </div>
      </div>
      
      <div class="check-area">
        <div class="check-container">
          <input 
            type="checkbox" 
            id="check_${menu.date.replace(/\//g, '_')}"
            class="check-input"
            ${isChecked ? 'checked' : ''}
            ${isDisabled ? 'disabled' : ''}
            data-date="${menu.date}"
          >
          <label 
            for="check_${menu.date.replace(/\//g, '_')}"
            class="check-label ${isDisabled ? 'disabled' : ''}"
          >
            ${isChecked ? '利用する ✅' : '利用しない ⬜'}
          </label>
        </div>
      </div>
    `;
    
    // チェックボックスのイベントリスナー
    const checkbox = boxElement.querySelector('.check-input');
    if (checkbox && !isDisabled) {
      checkbox.addEventListener('change', (e) => {
        this.handleCheckboxChange(e, menu.date);
      });
    }
    
    return boxElement;
  }

  async handleCheckboxChange(event, date) {
    const isChecked = event.target.checked;
    const label = event.target.nextElementSibling;
    
    try {
      // UI即座更新
      label.textContent = isChecked ? '利用する ✅' : '利用しない ⬜';
      event.target.disabled = true;
      
      // API呼び出し
      const result = await api.updateCheck(date, this.currentUser.userName, isChecked);
      
      if (result.success) {
        // 成功時
        this.checkStates.set(date, isChecked);
        this.showSuccess(isChecked ? '利用チェックを追加しました' : '利用チェックを解除しました');
      } else {
        // 失敗時：元に戻す
        event.target.checked = !isChecked;
        label.textContent = !isChecked ? '利用する ✅' : '利用しない ⬜';
        this.showError(result.error || 'チェック状態の更新に失敗しました');
      }
    } catch (error) {
      console.error('Checkbox change error:', error);
      // エラー時：元に戻す
      event.target.checked = !isChecked;
      label.textContent = !isChecked ? '利用する ✅' : '利用しない ⬜';
      this.showError('チェック状態の更新中にエラーが発生しました');
    } finally {
      event.target.disabled = false;
    }
  }

  extractDay(dateString) {
    const parts = dateString.split('/');
    return parts[2] || '';
  }

  scrollToToday() {
    const today = new Date();
    const todayString = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
    
    // 今日の日付のボックスを探す
    const todayBox = document.querySelector(`[data-date="${todayString}"]`);
    if (todayBox) {
      todayBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    // 今日の日付がない場合は、最も近い日付のボックスにスクロール
    const boxes = document.querySelectorAll('.menu-box');
    if (boxes.length > 0) {
      boxes[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  showLoading(show) {
    if (show) {
      this.loadingIndicator.classList.remove('hidden');
      this.menuContainer.classList.add('hidden');
      this.emptyState.classList.add('hidden');
    } else {
      this.loadingIndicator.classList.add('hidden');
      this.menuContainer.classList.remove('hidden');
    }
  }

  showEmptyState() {
    this.emptyState.classList.remove('hidden');
    this.menuContainer.classList.add('hidden');
  }

  hideEmptyState() {
    this.emptyState.classList.add('hidden');
  }

  showMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    this.messageContainer.appendChild(messageElement);
    
    // 3秒後に自動削除
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 3000);
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  clearMessages() {
    this.messageContainer.innerHTML = '';
  }

  handleLogout() {
    if (confirm('ログアウトしますか？')) {
      if (window.authManager) {
        window.authManager.logout();
      } else {
        // authManagerが利用できない場合は直接リダイレクト
        window.location.href = 'index.html';
      }
    }
  }
}

// ページ読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
  window.homeManager = new HomeManager();
});