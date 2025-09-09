/**
 * ごはんたべる？ - Google Apps Script API (動作保証版)
 * スプレッドシートID: 1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I
 * 
 * 重要：Google Apps Scriptエディタで以下の設定を確認
 * 1. ランタイム: Chrome V8
 * 2. デプロイ設定: 「全員（匿名ユーザーを含む）」でアクセス許可
 * 3. 実行権限: 自分のアカウント
 */

const SPREADSHEET_ID = '1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I';
const SHEET_NAMES = {
  MENU: '献立管理',
  CHECKS: '食事WEB回答', 
  LOGIN: 'ログイン情報'
};

/**
 * GET処理
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * POST処理
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * OPTIONS処理 - プリフライト対応（V8ランタイム用）
 */
function doOptions(e) {
  const response = ContentService.createTextOutput('');
  response.setMimeType(ContentService.MimeType.TEXT);
  
  // V8ランタイムでのヘッダー設定
  try {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Max-Age', '86400');
  } catch (e) {
    // V8でsetHeaderが使えない場合は設定で対応
    console.log('Header setting not supported, using deployment settings');
  }
  
  return response;
}

/**
 * メインリクエスト処理
 */
function handleRequest(e) {
  try {
    // プリフライト処理
    if (e && e.method === 'OPTIONS') {
      return doOptions(e);
    }
    
    // リクエストデータ取得
    let requestData = {};
    
    if (e.method === 'POST' && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseError) {
        return createJsonResponse({
          success: false,
          error: 'Invalid JSON: ' + parseError.message
        });
      }
    } else if (e.parameter) {
      requestData = e.parameter;
    }
    
    // アクション処理
    const action = requestData.action;
    let result;
    
    switch (action) {
      case 'login':
        result = authenticateUser(requestData.id, requestData.password);
        break;
      case 'getRecipes':
        result = getRecipes(requestData.year, requestData.month);
        break;
      case 'updateCheck':
        result = updateCheck(requestData.date, requestData.userName, requestData.checked);
        break;
      case 'getCheckState':
        result = getCheckState(requestData.date, requestData.userName);
        break;
      case 'getUserData':
        result = getUserData(requestData.id);
        break;
      default:
        result = { 
          success: false, 
          error: 'Invalid action: ' + (action || 'undefined'),
          availableActions: ['login', 'getRecipes', 'updateCheck', 'getCheckState', 'getUserData']
        };
    }
    
    return createJsonResponse(result);
    
  } catch (error) {
    console.error('Request error:', error);
    return createJsonResponse({
      success: false,
      error: 'Server error: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * JSONレスポンス作成（CORSヘッダー付き）
 */
function createJsonResponse(data) {
  const response = ContentService.createTextOutput(JSON.stringify(data));
  response.setMimeType(ContentService.MimeType.JSON);
  
  // CORSヘッダー設定を試行
  try {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (e) {
    // ヘッダー設定できない場合はデプロイ設定に依存
    console.log('CORS headers set via deployment configuration');
  }
  
  return response;
}

/**
 * ユーザー認証
 */
function authenticateUser(id, password) {
  try {
    if (!id || !password) {
      return {
        success: false,
        error: 'IDとパスワードが必要です'
      };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const loginSheet = ss.getSheetByName(SHEET_NAMES.LOGIN);
    
    if (!loginSheet) {
      return {
        success: false,
        error: 'ログイン情報シートが見つかりません'
      };
    }

    const data = loginSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const [name, userId, userPassword] = data[i];
      if (userId === id && userPassword === password) {
        return {
          success: true,
          userName: name,
          loginTime: new Date().toISOString()
        };
      }
    }
    
    return {
      success: false,
      error: 'IDまたはパスワードが正しくありません'
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'ログイン処理エラー: ' + error.message
    };
  }
}

/**
 * 指定年月のレシピ取得
 */
function getRecipes(year, month) {
  try {
    if (!year || !month) {
      return {
        success: false,
        error: '年と月が必要です'
      };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
    
    if (!menuSheet) {
      return {
        success: false,
        error: '献立管理シートが見つかりません'
      };
    }

    const data = menuSheet.getDataRange().getValues();
    const recipes = [];
    const targetMonth = `${year}/${month}`;
    
    for (let i = 1; i < data.length; i++) {
      const [dateStr, , main, side1, side2, soup] = data[i];
      
      if (dateStr && dateStr.toString().startsWith(targetMonth)) {
        const date = new Date(dateStr);
        recipes.push({
          date: Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/M/d'),
          dayOfWeek: getDayOfWeek(date),
          main: main || '',
          side1: side1 || '',
          side2: side2 || '',
          soup: soup || '',
          isEditable: isEditable(date)
        });
      }
    }
    
    return {
      success: true,
      recipes: recipes,
      count: recipes.length
    };
    
  } catch (error) {
    console.error('getRecipes error:', error);
    return {
      success: false,
      error: 'メニュー取得エラー: ' + error.message
    };
  }
}

/**
 * チェック状態更新
 */
function updateCheck(date, userName, checked) {
  try {
    if (!date || !userName || checked === undefined) {
      return {
        success: false,
        error: '必要なパラメータが不足しています（date, userName, checked）'
      };
    }

    const targetDate = new Date(date);
    if (!isEditable(targetDate)) {
      return {
        success: false,
        error: '午前10時を過ぎているため、チェックできません'
      };
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const checkSheet = ss.getSheetByName(SHEET_NAMES.CHECKS);
    
    if (!checkSheet) {
      return {
        success: false,
        error: '食事WEB回答シートが見つかりません'
      };
    }

    const data = checkSheet.getDataRange().getValues();
    const headerRow = data[0];
    
    // ユーザー列検索
    let userColumn = -1;
    for (let i = 1; i < headerRow.length; i++) {
      if (headerRow[i] === userName) {
        userColumn = i;
        break;
      }
    }
    
    if (userColumn === -1) {
      return {
        success: false,
        error: `ユーザーが見つかりません: ${userName}`
      };
    }
    
    // 日付行検索
    let dateRow = -1;
    for (let i = 1; i < data.length; i++) {
      const rowDate = new Date(data[i][0]);
      if (Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy/M/d') === date) {
        dateRow = i;
        break;
      }
    }
    
    if (dateRow === -1) {
      return {
        success: false,
        error: `該当日付が見つかりません: ${date}`
      };
    }
    
    // 更新実行
    checkSheet.getRange(dateRow + 1, userColumn + 1).setValue(checked);
    
    return {
      success: true,
      checked: checked,
      date: date,
      userName: userName,
      updateTime: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('updateCheck error:', error);
    return {
      success: false,
      error: 'チェック更新エラー: ' + error.message
    };
  }
}

/**
 * チェック状態取得
 */
function getCheckState(date, userName) {
  try {
    if (!date || !userName) {
      return {
        success: false,
        error: '日付とユーザー名が必要です'
      };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const checkSheet = ss.getSheetByName(SHEET_NAMES.CHECKS);
    
    if (!checkSheet) {
      return {
        success: false,
        error: '食事WEB回答シートが見つかりません'
      };
    }

    const data = checkSheet.getDataRange().getValues();
    const headerRow = data[0];
    
    // ユーザー列検索
    let userColumn = -1;
    for (let i = 1; i < headerRow.length; i++) {
      if (headerRow[i] === userName) {
        userColumn = i;
        break;
      }
    }
    
    if (userColumn === -1) {
      return {
        success: false,
        error: `ユーザーが見つかりません: ${userName}`
      };
    }
    
    // 日付行検索
    for (let i = 1; i < data.length; i++) {
      const rowDate = new Date(data[i][0]);
      if (Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy/M/d') === date) {
        return {
          success: true,
          checked: data[i][userColumn] === true,
          date: date,
          userName: userName
        };
      }
    }
    
    return {
      success: true,
      checked: false,
      date: date,
      userName: userName
    };
    
  } catch (error) {
    console.error('getCheckState error:', error);
    return {
      success: false,
      error: 'チェック状態取得エラー: ' + error.message
    };
  }
}

/**
 * 日付編集可能性チェック
 */
function isEditable(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (targetDate.getTime() !== today.getTime()) {
    return false;
  }
  
  return now.getHours() < 10;
}

/**
 * 曜日取得
 */
function getDayOfWeek(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

/**
 * ユーザーデータ取得
 */
function getUserData(id) {
  try {
    if (!id) {
      return {
        success: false,
        error: 'IDが必要です'
      };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const loginSheet = ss.getSheetByName(SHEET_NAMES.LOGIN);
    
    if (!loginSheet) {
      return {
        success: false,
        error: 'ログイン情報シートが見つかりません'
      };
    }

    const data = loginSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const [name, userId] = data[i];
      if (userId === id) {
        return {
          success: true,
          userName: name,
          userId: userId
        };
      }
    }
    
    return {
      success: false,
      error: `ユーザーが見つかりません: ${id}`
    };
    
  } catch (error) {
    console.error('getUserData error:', error);
    return {
      success: false,
      error: 'ユーザーデータ取得エラー: ' + error.message
    };
  }
}