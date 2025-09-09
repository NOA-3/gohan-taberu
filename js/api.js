/**
 * Google Apps Script API連携モジュール (CORS根本解決版)
 * 
 * CORS解決策：
 * 1. GETリクエストのみ使用（プリフライト完全回避）
 * 2. URLパラメータでデータ送信
 * 3. シンプルリクエストでブラウザ制限なし
 */

// Apps Script Web AppのURL（Code-Final-CORS.gs用）
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbySNobqGMdzVRg-CnsFZ3kCzPHtCMh8r1BRVv2C8lZtwKfVjzDzjmz4txQypvCZApqMcA/exec';

class GASApi {
  constructor() {
    this.baseUrl = GAS_API_URL;
  }

  /**
   * GETリクエスト実行（プリフライト回避）
   */
  async request(data) {
    try {
      // URLパラメータ作成
      const params = new URLSearchParams();
      for (const key in data) {
        if (data[key] !== null && data[key] !== undefined) {
          params.append(key, data[key].toString());
        }
      }
      
      const url = `${this.baseUrl}?${params.toString()}`;
      
      // GETリクエスト（シンプルリクエスト - プリフライトなし）
      const response = await fetch(url, {
        method: 'GET',
        // ヘッダーなし（シンプルリクエスト維持）
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('API request failed:', error);
      throw new Error('サーバーとの通信に失敗しました: ' + error.message);
    }
  }

  /**
   * ユーザー認証
   */
  async authenticateUser(id, password) {
    return await this.request({
      action: 'login',
      id: id,
      password: password
    });
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
const isDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const api = isDevelopment ? new MockApi() : gasApi;

// エクスポート
window.api = api;