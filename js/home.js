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
      
      // デバッグ: リクエストパラメータを表示
      console.log('=== Loading Menu Data ===');
      console.log('Year:', this.currentYear);
      console.log('Month:', this.currentMonth);
      console.log('User:', this.currentUser);
      
      // メニューデータ取得
      const result = await api.getRecipes(this.currentYear, this.currentMonth);
      
      // デバッグ: APIレスポンスを表示
      console.log('=== Menu Data Response ===');
      console.log('Success:', result.success);
      console.log('Recipes:', result.recipes);
      console.log('Recipe Count:', result.recipes ? result.recipes.length : 0);
      if (result.error) {
        console.error('Error Message:', result.error);
      }
      
      if (result.success) {
        this.menuData = result.recipes || [];
        console.log('Menu data set, count:', this.menuData.length);
        
        if (this.menuData.length === 0) {
          console.warn('No recipes found for this month');
          this.showEmptyState();
        } else {
          // 今日から順に1日ずつ完全に読み込んで表示
          this.loadMenuDataProgressively();
        }
      } else {
        console.error('API returned success: false');
        this.showError(result.error || 'メニューデータの取得に失敗しました');
        this.showEmptyState();
      }
    } catch (error) {
      console.error('=== Menu Load Error ===');
      console.error('Error Object:', error);
      console.error('Error Message:', error.message);
      console.error('Stack Trace:', error.stack);
      this.showError('メニューデータの読み込み中にエラーが発生しました');
      this.showEmptyState();
    } finally {
      this.showLoading(false);
    }
  }

  async loadMenuDataProgressively() {
    try {
      console.log('=== Loading Menu Data Progressively (Day by Day) ===');
      
      // 今日の日付を取得
      const today = new Date();
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // 今日以降のメニューのみを対象
      const todayAndFuture = this.menuData.filter(menu => {
        const menuDate = new Date(menu.date);
        return menuDate >= todayDate;
      }).sort((a, b) => new Date(a.date) - new Date(b.date)); // 日付順にソート
      
      // メニューコンテナをクリア
      this.menuContainer.innerHTML = '';
      this.hideEmptyState();
      
      if (todayAndFuture.length === 0) {
        this.showEmptyState();
        return;
      }
      
      // 部分的並列処理：最初の3日分を並列取得、残りは順次処理
      const parallelBatchSize = Math.min(3, todayAndFuture.length);
      
      // Phase 1: 最初の3日分を並列処理（最重要な今日のデータを最速で表示）
      if (parallelBatchSize > 0) {
        console.log(`Phase 1: Loading first ${parallelBatchSize} days in parallel`);
        
        const parallelPromises = todayAndFuture.slice(0, parallelBatchSize).map(async (menu, index) => {
          try {
            console.log(`Parallel loading: ${menu.date}`);
            
            // チェック状態を取得
            const checkResult = await api.getCheckState(menu.date, this.currentUser.userName);
            
            return {
              menu,
              index,
              checkResult,
              success: true
            };
          } catch (error) {
            console.error(`Parallel loading failed for ${menu.date}:`, error);
            return {
              menu,
              index,
              checkResult: { success: false, checked: false },
              success: false,
              error
            };
          }
        });
        
        // 並列リクエストの完了を待つ
        const parallelResults = await Promise.all(parallelPromises);
        
        // 結果を日付順に処理して表示
        parallelResults
          .sort((a, b) => a.index - b.index) // 日付順を保持
          .forEach((result, displayIndex) => {
            const { menu, checkResult, success, error } = result;
            
            if (success && checkResult.success) {
              this.checkStates.set(menu.date, checkResult.checked);
              console.log(`Parallel check state loaded for ${menu.date}: ${checkResult.checked}`);
            } else {
              console.warn(`Parallel check state failed for ${menu.date}:`, error || checkResult.error);
              this.checkStates.set(menu.date, false);
            }
            
            // メニューボックスを作成して表示
            const menuBox = this.createMenuBox(menu);
            this.menuContainer.appendChild(menuBox);
            
            console.log(`Parallel day ${menu.date} displayed successfully`);
            
            // 最初の日（今日）の場合はスクロール
            if (displayIndex === 0) {
              setTimeout(() => {
                menuBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }
          });
        
        console.log(`Phase 1 completed: ${parallelBatchSize} days loaded in parallel`);
      }
      
      // Phase 2: 残りの日程を順次処理（従来の安全な方式）
      if (todayAndFuture.length > parallelBatchSize) {
        console.log(`Phase 2: Loading remaining ${todayAndFuture.length - parallelBatchSize} days sequentially`);
        
        for (let i = parallelBatchSize; i < todayAndFuture.length; i++) {
          try {
            const menu = todayAndFuture[i];
            console.log(`Sequential loading day ${i + 1}/${todayAndFuture.length}: ${menu.date}`);
            
            // チェック状態を取得
            const checkResult = await api.getCheckState(menu.date, this.currentUser.userName);
            
            if (checkResult.success) {
              this.checkStates.set(menu.date, checkResult.checked);
              console.log(`Sequential check state loaded for ${menu.date}: ${checkResult.checked}`);
            } else {
              console.warn(`Sequential check state failed for ${menu.date}:`, checkResult.error);
              this.checkStates.set(menu.date, false);
            }
            
            // メニューボックスを作成して即座に表示
            const menuBox = this.createMenuBox(menu);
            this.menuContainer.appendChild(menuBox);
            
            console.log(`Sequential day ${menu.date} displayed successfully`);
            
            // 次のリクエストまで短い間隔を空ける（100ms）
            if (i < todayAndFuture.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
          } catch (error) {
            console.error(`Sequential loading failed for day ${todayAndFuture[i].date}:`, error);
            // エラーがあってもメニューボックスは表示（チェック状態なしで）
            this.checkStates.set(todayAndFuture[i].date, false);
            const menuBox = this.createMenuBox(todayAndFuture[i]);
            this.menuContainer.appendChild(menuBox);
          }
        }
        
        console.log('Phase 2 completed: All remaining days loaded sequentially');
      }
      
      console.log('All menu data loaded progressively day by day');
      
    } catch (error) {
      console.error('=== Progressive Menu Load Error ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      this.showEmptyState();
    }
  }
  
  updateCheckboxState(date, checked) {
    const checkbox = document.querySelector(`[data-date="${date}"] .check-input`);
    const label = document.querySelector(`[data-date="${date}"] .check-label`);
    
    if (checkbox && label) {
      checkbox.checked = checked;
      label.textContent = `利用する ${checked ? '✅' : '⬜'}`;
    }
  }

  // 従来のrenderMenuBoxes関数は削除（loadMenuDataProgressivelyに統合）

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
            利用する ${isChecked ? '✅' : '⬜'}
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
      label.textContent = `利用する ${isChecked ? '✅' : '⬜'}`;
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
        label.textContent = `利用する ${!isChecked ? '✅' : '⬜'}`;
        this.showError(result.error || 'チェック状態の更新に失敗しました');
      }
    } catch (error) {
      console.error('Checkbox change error:', error);
      // エラー時：元に戻す
      event.target.checked = !isChecked;
      label.textContent = `利用する ${!isChecked ? '✅' : '⬜'}`;
      this.showError('チェック状態の更新中にエラーが発生しました');
    } finally {
      event.target.disabled = false;
    }
  }

  extractDay(dateString) {
    const parts = dateString.split('/');
    return parts[2] || '';
  }

  // scrollToToday関数は削除（loadMenuDataProgressivelyで自動スクロール処理）

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