/**
 * Google Apps Script API連携モジュール (CORS根本解決版)
 * 
 * CORS解決策：
 * 1. GETリクエストのみ使用（プリフライト完全回避）
 * 2. URLパラメータでデータ送信
 * 3. シンプルリクエストでブラウザ制限なし
 */

// Apps Script Web AppのURL（Code.gs用）
// 2025-09-10更新: モバイル対応エンコーディング修正版
// 重要: MockAPIは使用しない - 常に本番環境でテスト
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbx4b3ZksDpLAsaPGgRx_wK9gvBD8sTAkvhUSADCZ6pgaKWCUadR1M1RpJH6af5qEomrdg/exec';

class GASApi {
  constructor() {
    this.baseUrl = GAS_API_URL;
  }

  /**
   * JSONPリクエスト実行（CORS回避）
   */
  async request(data) {
    return new Promise((resolve, reject) => {
      try {
        // URLパラメータ作成
        const params = new URLSearchParams();
        for (const key in data) {
          if (data[key] !== null && data[key] !== undefined) {
            params.append(key, data[key].toString());
          }
        }
        
        // JSONP用のコールバック関数名を生成（衝突回避）
        const callbackName = 'gasCallback_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        params.append('callback', callbackName);
        
        const url = `${this.baseUrl}?${params.toString()}`;
        
        // デバッグ: リクエスト情報を表示
        console.log('=== GAS API Request (JSONP) ===');
        console.log('URL:', url);
        console.log('Callback:', callbackName);
        console.log('Parameters:', Object.fromEntries(params));
        
        // グローバルコールバック関数を設定
        window[callbackName] = (result) => {
          console.log('=== GAS API Response ===');
          console.log('Full Response:', result);
          console.log('Success:', result.success);
          if (result.error) {
            console.error('API Error:', result.error);
          }
          
          // レスポンスのバリデーション
          if (result && typeof result === 'object') {
            resolve(result);
          } else {
            reject(new Error('無効なレスポンス形式です'));
          }
          
          // クリーンアップを遅延実行（レスポンス処理後）
          setTimeout(() => {
            try {
              delete window[callbackName];
              if (script && script.parentNode) {
                script.parentNode.removeChild(script);
              }
            } catch (cleanupError) {
              console.warn('Cleanup error:', cleanupError);
            }
          }, 100);
        };
        
        // scriptタグを作成してJSONPリクエスト
        const script = document.createElement('script');
        script.src = url;
        script.async = true; // 非同期読み込み
        script.crossOrigin = 'anonymous'; // CORS設定
        script.onerror = async (errorEvent) => {
          console.error('=== JSONP Request Failed ===');
          console.error('Error Event:', errorEvent);
          console.warn('JSONP failed, trying fetch as fallback...');
          
          // クリーンアップ
          try {
            delete window[callbackName];
            if (script && script.parentNode) {
              script.parentNode.removeChild(script);
            }
          } catch (cleanupError) {
            console.warn('Cleanup error in onerror:', cleanupError);
          }
          
          // フォールバック: 通常のfetchを試みる（モバイル通常モード対策）
          try {
            console.log('=== Fetch Fallback Attempt ===');
            const fetchUrl = url.replace(`&callback=${callbackName}`, '');
            console.log('Fetch URL:', fetchUrl);
            
            const response = await fetch(fetchUrl, {
              method: 'GET',
              mode: 'no-cors', // CORSエラーを回避
              credentials: 'omit'
            });
            
            // no-corsモードでは実際のレスポンスは取得できないが、
            // リクエスト自体は送信される
            console.log('Fetch request sent (no-cors mode)');
            
            // no-corsの場合、デフォルトレスポンスを返す
            resolve({
              success: false,
              error: 'CORS制限によりレスポンスを取得できません。JSONPを使用してください。'
            });
          } catch (fetchError) {
            console.error('Fetch fallback also failed:', fetchError);
            reject(new Error('ネットワークエラーまたはGoogle Apps Scriptのアクセスに失敗しました'));
          }
        };
        
        // タイムアウト設定（モバイル対応で20秒に延長）
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const timeoutDuration = isMobile ? 20000 : 15000; // モバイルは20秒、PCは15秒
        
        let timeoutId = setTimeout(() => {
          if (window[callbackName]) {
            console.warn('Request timeout for:', callbackName);
            console.warn('Timeout duration:', timeoutDuration + 'ms');
            console.warn('Is Mobile:', isMobile);
            
            // クリーンアップ
            try {
              delete window[callbackName];
              if (script && script.parentNode) {
                script.parentNode.removeChild(script);
              }
            } catch (cleanupError) {
              console.warn('Cleanup error in timeout:', cleanupError);
            }
            
            const errorMessage = isMobile 
              ? 'モバイル回線でのリクエストがタイムアウトしました。Wi-Fi環境または電波の良い場所で再試行してください。'
              : 'Google Apps Scriptへのリクエストがタイムアウトしました。ネットワーク環境を確認してください。';
            
            reject(new Error(errorMessage));
          }
        }, timeoutDuration);
        
        // 元のコールバックを保存し、タイムアウトクリア処理を追加
        const originalCallback = window[callbackName];
        window[callbackName] = (result) => {
          // タイムアウトをクリア
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          // 元のコールバックを安全に呼び出す
          try {
            originalCallback(result);
          } catch (callbackError) {
            console.error('Callback execution error:', callbackError);
            reject(new Error('レスポンス処理中にエラーが発生しました'));
          }
        };
        
        document.head.appendChild(script);
        
      } catch (error) {
        console.error('=== API Request Failed ===');
        console.error('Error Details:', error);
        reject(new Error('サーバーとの通信に失敗しました: ' + error.message));
      }
    });
  }

  /**
   * ユーザー認証
   */
  async authenticateUser(id, password) {
    try {
      // パスワードをBase64エンコード（モバイル互換性改善 - UTF-8対応）
      let encodedPassword;
      try {
        // 方法1: 標準的なエンコード
        encodedPassword = btoa(encodeURIComponent(password));
        console.log('Encoding method: Standard btoa + encodeURIComponent');
      } catch (btoaError) {
        console.warn('Standard btoa failed, using TextEncoder fallback:', btoaError);
        try {
          // 方法2: TextEncoder使用（モダンブラウザ対応）
          const encoder = new TextEncoder();
          const data = encoder.encode(password);
          encodedPassword = btoa(String.fromCharCode.apply(null, data));
          console.log('Encoding method: TextEncoder fallback');
        } catch (fallbackError) {
          console.error('All encoding methods failed:', fallbackError);
          // 方法3: 最後の手段 - 平文送信（セキュリティ警告）
          encodedPassword = password;
          console.warn('WARNING: Using plain text password due to encoding failures');
        }
      }
      
      // デバッグ: モバイル環境情報をログ出力
      console.log('=== Mobile Debug Info ===');
      console.log('User Agent:', navigator.userAgent);
      console.log('Screen Size:', `${screen.width}x${screen.height}`);
      const isMobileDetected = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('Is Mobile:', isMobileDetected);
      console.log('Touch Support:', 'ontouchstart' in window);
      console.log('Max Touch Points:', navigator.maxTouchPoints || 0);
      console.log('Password Length:', password.length);
      console.log('Encoded Password Length:', encodedPassword.length);
      
      return await this.request({
        action: 'login',
        id: id,
        password: encodedPassword,
        encoded: 'true'
      });
    } catch (error) {
      console.error('=== Mobile Authentication Error ===');
      console.error('Error Type:', error.name);
      console.error('Error Message:', error.message);
      console.error('User Agent:', navigator.userAgent);
      throw new Error('モバイル環境でのログインエラー: ' + error.message);
    }
  }

  /**
   * レシピデータ取得
   */
  async getRecipes(year, month) {
    return await this.request({
      action: 'getRecipes',
      year: year,
      month: month
    });
  }

  /**
   * チェック状態更新
   */
  async updateCheck(date, userName, checked) {
    return await this.request({
      action: 'updateCheck',
      date: date,
      userName: userName,
      checked: checked
    });
  }

  /**
   * チェック状態取得
   */
  async getCheckState(date, userName) {
    return await this.request({
      action: 'getCheckState',
      date: date,
      userName: userName
    });
  }

  /**
   * ユーザーデータ取得
   */
  async getUserData(id) {
    return await this.request({
      action: 'getUserData',
      id: id
    });
  }
}

// グローバルインスタンス
const gasApi = new GASApi();

// 開発環境用モックAPI（変更なし）
class MockApi {
  constructor() {
    this.users = [
      { name: '田中 太郎', id: 'taro.t', password: 'pass123' },
      { name: '山田 花子', id: 'hanako.y', password: 'pass456' }
    ];
    
    this.recipes = [
      {
        date: '2025/9/1',
        dayOfWeek: '月',
        main: 'ハンバーグ',
        side1: 'サラダ',
        side2: 'デザート',
        soup: 'スープ',
        isEditable: true
      },
      {
        date: '2025/9/2',
        dayOfWeek: '火',
        main: '鶏の唐揚げ',
        side1: 'ポテトサラダ',
        side2: 'ひじき',
        soup: '味噌汁',
        isEditable: false
      }
    ];
    
    this.checks = new Map();
  }

  async authenticateUser(id, password) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = this.users.find(u => u.id === id && u.password === password);
        if (user) {
          resolve({
            success: true,
            userName: user.name
          });
        } else {
          resolve({
            success: false,
            error: 'IDまたはパスワードが正しくありません'
          });
        }
      }, 1000);
    });
  }

  async getRecipes(year, month) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          recipes: this.recipes,
          count: this.recipes.length
        });
      }, 500);
    });
  }

  async updateCheck(date, userName, checked) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const key = `${date}_${userName}`;
        this.checks.set(key, checked);
        resolve({
          success: true,
          checked: checked,
          date: date,
          userName: userName,
          updateTime: new Date().toISOString()
        });
      }, 300);
    });
  }

  async getCheckState(date, userName) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const key = `${date}_${userName}`;
        const checked = this.checks.get(key) || false;
        resolve({
          success: true,
          checked: checked,
          date: date,
          userName: userName
        });
      }, 200);
    });
  }

  async getUserData(id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = this.users.find(u => u.id === id);
        if (user) {
          resolve({
            success: true,
            userName: user.name,
            userId: user.id
          });
        } else {
          resolve({
            success: false,
            error: 'ユーザーが見つかりません'
          });
        }
      }, 300);
    });
  }
}

// 開発環境判定とAPI切り替え
// 本番環境を強制的に使用する場合は、以下のコメントを外してください
// const api = gasApi;

// 開発環境でモックAPIを使用する場合（デフォルト）
const isDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// const api = isDevelopment ? new MockApi() : gasApi;

// 本番環境（Google Apps Script）を常に使用
const api = gasApi;

// デバッグ: 使用中のAPIを表示
console.log('=== API Configuration ===');
console.log('Using API:', api instanceof GASApi ? 'GAS API (Production)' : 'Mock API (Development)');
console.log('GAS API URL:', GAS_API_URL);
console.log('Current Location:', location.hostname);

// エクスポート
window.api = api;