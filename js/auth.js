/**
 * 認証処理モジュール
 */

class AuthManager {
  constructor() {
    this.isRedirecting = false; // リダイレクト中フラグ
    this.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.sessionClearTimer = null; // モバイル用遅延タイマー
    this.init();
  }

  init() {
    // DOM要素の取得
    this.loginForm = document.getElementById('loginForm');
    this.userIdInput = document.getElementById('userId');
    this.passwordInput = document.getElementById('password');
    this.loginBtn = document.getElementById('loginBtn');
    this.loginBtnText = document.getElementById('loginBtnText');
    this.loginSpinner = document.getElementById('loginSpinner');
    this.errorMessage = document.getElementById('errorMessage');

    // イベントリスナーの設定
    this.setupEventListeners();

    // タブ終了時のログアウト機能を設定
    this.setupTabCloseLogout();

    // ログインページの場合のみログイン済みチェックを実行
    if (this.loginForm) {
      this.checkExistingLogin();
    }
  }

  setupEventListeners() {
    // DOM要素が存在しない場合はスキップ（home.htmlなど）
    if (!this.loginForm) {
      return;
    }
    
    // フォーム送信イベント
    this.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Enterキーでのログイン（入力フィールドが存在する場合のみ）
    [this.userIdInput, this.passwordInput].forEach(input => {
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleLogin();
          }
        });
      }
    });

    // 入力フィールドのリアルタイムバリデーション
    [this.userIdInput, this.passwordInput].forEach(input => {
      input.addEventListener('input', () => {
        this.clearError();
        // バリデーションはフォーカス移動なしで実行
        this.validateFormSilent();
      });
    });
  }

  setupTabCloseLogout() {
    console.log('=== Session Management Setup ===');
    console.log('Device type:', this.isMobile ? 'Mobile' : 'PC');
    console.log('User Agent:', navigator.userAgent);
    
    if (!this.isMobile) {
      // PC: 従来の厳密なセッション管理
      console.log('Using PC session management (strict)');
      
      window.addEventListener('beforeunload', () => {
        if (!this.isRedirecting) {
          console.log('PC beforeunload: Clearing login info');
          this.clearLoginInfo();
        }
      });

      window.addEventListener('unload', () => {
        if (!this.isRedirecting) {
          console.log('PC unload: Clearing login info');
          this.clearLoginInfo();
        }
      });

      window.addEventListener('pagehide', () => {
        if (!this.isRedirecting) {
          console.log('PC pagehide: Clearing login info');
          this.clearLoginInfo();
        }
      });
    } else {
      // モバイル: より柔軟なセッション管理
      console.log('Using Mobile session management (flexible)');
      this.setupMobileSessionManagement();
    }
  }

  setupMobileSessionManagement() {
    // モバイル用: visibilitychangeで真のアプリ終了を検出
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !this.isRedirecting) {
        console.log('Mobile: Page hidden, starting delayed logout timer');
        this.startDelayedSessionClear();
      } else if (document.visibilityState === 'visible') {
        console.log('Mobile: Page visible, canceling logout timer');
        this.cancelDelayedSessionClear();
      }
    });
    
    // モバイルでも真のページ離脱（アプリ終了）は検出
    window.addEventListener('pagehide', (event) => {
      if (!this.isRedirecting && event.persisted === false) {
        console.log('Mobile pagehide: True app termination detected');
        this.clearLoginInfo();
      }
    });
  }

  startDelayedSessionClear() {
    // 既存のタイマーをクリア
    this.cancelDelayedSessionClear();
    
    // 5秒後にセッションクリア（一時的な離脱との区別）
    this.sessionClearTimer = setTimeout(() => {
      if (!this.isRedirecting) {
        console.log('Mobile: Delayed session clear executed');
        this.clearLoginInfo();
      }
    }, 5000);
  }

  cancelDelayedSessionClear() {
    if (this.sessionClearTimer) {
      clearTimeout(this.sessionClearTimer);
      this.sessionClearTimer = null;
      console.log('Mobile: Delayed session clear canceled');
    }
  }

  async handleLogin() {
    // バリデーション
    if (!this.validateForm()) {
      return;
    }

    const userId = this.userIdInput.value.trim();
    const password = this.passwordInput.value.trim();

    console.log('=== Login Attempt ===');
    console.log('User ID:', userId);
    console.log('Password Length:', password.length);

    try {
      // ローディング状態開始
      this.setLoading(true);
      this.clearError();

      // API呼び出し
      console.log('Calling authenticateUser API...');
      const result = await api.authenticateUser(userId, password);
      
      console.log('=== Login Response ===');
      console.log('Success:', result.success);
      console.log('User Name:', result.userName);
      if (result.error) {
        console.error('Login Error:', result.error);
      }

      if (result.success) {
        // ログイン成功
        console.log('Login successful, saving info and redirecting...');
        this.saveLoginInfo(userId, result.userName);
        this.redirectToHome();
      } else {
        // ログイン失敗
        console.error('Login failed:', result.error);
        this.showError(result.error || 'ログインに失敗しました');
        this.focusFirstInput();
      }
    } catch (error) {
      console.error('=== Login Exception ===');
      console.error('Error Object:', error);
      console.error('Error Message:', error.message);
      console.error('Stack Trace:', error.stack);
      this.showError('ログイン処理中にエラーが発生しました');
      this.focusFirstInput();
    } finally {
      this.setLoading(false);
    }
  }

  validateForm() {
    const userId = this.userIdInput.value.trim();
    const password = this.passwordInput.value.trim();

    if (!userId) {
      this.showError('ユーザーIDを入力してください');
      this.userIdInput.focus();
      return false;
    }

    if (!password) {
      this.showError('パスワードを入力してください');
      this.passwordInput.focus();
      return false;
    }

    return true;
  }

  validateFormSilent() {
    // フォーカス移動なしのバリデーション（リアルタイム用）
    const userId = this.userIdInput.value.trim();
    const password = this.passwordInput.value.trim();

    // エラーは表示しないが、バリデーション結果は返す
    if (!userId || !password) {
      return false;
    }

    return true;
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.loginBtn.classList.add('login-loading');
      this.loginBtn.disabled = true;
      this.loginBtnText.textContent = 'ログイン中...';
      this.loginSpinner.classList.remove('hidden');
      this.userIdInput.disabled = true;
      this.passwordInput.disabled = true;
    } else {
      this.loginBtn.classList.remove('login-loading');
      this.loginBtn.disabled = false;
      this.loginBtnText.textContent = 'ログイン';
      this.loginSpinner.classList.add('hidden');
      this.userIdInput.disabled = false;
      this.passwordInput.disabled = false;
    }
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
    
    // エラーメッセージを5秒後に自動で非表示
    setTimeout(() => {
      this.clearError();
    }, 5000);
  }

  clearError() {
    this.errorMessage.classList.add('hidden');
    this.errorMessage.textContent = '';
  }

  focusFirstInput() {
    this.userIdInput.focus();
    this.userIdInput.select();
  }

  saveLoginInfo(userId, userName) {
    // ローカルストレージに保存
    const loginInfo = {
      userId: userId,
      userName: userName,
      loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('gohan_login_info', JSON.stringify(loginInfo));
  }

  getLoginInfo() {
    try {
      const loginInfoStr = localStorage.getItem('gohan_login_info');
      if (!loginInfoStr) return null;
      
      const loginInfo = JSON.parse(loginInfoStr);
      
      // ログイン情報の有効期限チェック（24時間）
      const loginTime = new Date(loginInfo.loginTime);
      const now = new Date();
      const diffHours = (now - loginTime) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        this.clearLoginInfo();
        return null;
      }
      
      return loginInfo;
    } catch (error) {
      console.error('Failed to get login info:', error);
      this.clearLoginInfo();
      return null;
    }
  }

  clearLoginInfo() {
    localStorage.removeItem('gohan_login_info');
  }

  checkExistingLogin() {
    const loginInfo = this.getLoginInfo();
    if (loginInfo) {
      // 既にログイン済みの場合はホーム画面へリダイレクト
      this.redirectToHome();
    }
  }

  redirectToHome() {
    // リダイレクト中フラグを設定
    this.isRedirecting = true;
    
    // ホーム画面へリダイレクト（既にhome.htmlにいる場合は実行しない）
    if (window.location.pathname !== '/home.html' && !window.location.pathname.endsWith('/home.html')) {
      console.log('Redirecting to home.html');
      window.location.href = 'home.html';
    } else {
      // 既にhome.htmlにいる場合はフラグをリセット
      this.isRedirecting = false;
    }
  }

  logout() {
    this.cancelDelayedSessionClear(); // モバイル用タイマーをクリア
    this.clearLoginInfo();
    window.location.href = 'index.html';
  }
}

// 認証マネージャーのインスタンス化
const authManager = new AuthManager();

// グローバル関数のエクスポート
window.authManager = authManager;