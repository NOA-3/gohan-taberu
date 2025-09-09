/**
 * ごはんたべる？ - Google Apps Script API (CORS完全対応版)
 * スプレッドシートID: 1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I
 */

const SPREADSHEET_ID = '1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I';
const SHEET_NAMES = {
  MENU: '献立管理',
  CHECKS: '食事WEB回答', 
  LOGIN: 'ログイン情報'
};

/**
 * POST処理 - CORS完全対応
 */
function doPost(e) {
  return createCorsResponse(e);
}

/**
 * GET処理 - CORS完全対応
 */
function doGet(e) {
  return createCorsResponse(e);
}

/**
 * OPTIONS処理 - プリフライト対応
 */
function doOptions(e) {
  return createCorsResponse(e);
}

/**
 * CORS完全対応レスポンス作成
 */
function createCorsResponse(e) {
  try {
    // プリフライトリクエスト（OPTIONS）の処理
    if (e.method === 'OPTIONS') {
      return ContentService
        .createTextOutput('')
        .setMimeType(ContentService.MimeType.TEXT)
        .setHeader('Access-Control-Allow-Origin', '*')
        .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        .setHeader('Access-Control-Max-Age', '86400');
    }

    // 実際のAPIリクエスト処理
    let requestData = {};
    
    if (e.method === 'POST' && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return createErrorResponse('Invalid JSON format');
      }
    } else if (e.parameter) {
      requestData = e.parameter;
    }

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
      default:
        result = { success: false, error: 'Invalid action: ' + action };
    }

    return createSuccessResponse(result);

  } catch (error) {
    console.error('API Error:', error);
    return createErrorResponse('Server error: ' + error.toString());
  }
}

/**
 * 成功レスポンス作成
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * エラーレスポンス作成
 */
function createErrorResponse(errorMessage) {
  const errorData = {
    success: false,
    error: errorMessage
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(errorData))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    
    // ヘッダー行をスキップして検索
    for (let i = 1; i < data.length; i++) {
      const [name, userId, userPassword] = data[i];
      if (userId === id && userPassword === password) {
        return {
          success: true,
          userName: name
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
      error: 'ログイン処理でエラーが発生しました: ' + error.toString()
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
    
    // ヘッダー行をスキップ
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
      recipes: recipes
    };
  } catch (error) {
    console.error('getRecipes error:', error);
    return {
      success: false,
      error: 'メニューデータの取得に失敗しました: ' + error.toString()
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
        error: '必要なパラメータが不足しています'
      };
    }

    // 時間制限チェック
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
    
    // ユーザー名の列を探す
    const headerRow = data[0];
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
        error: 'ユーザーが見つかりません: ' + userName
      };
    }
    
    // 日付の行を探す
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
        error: '該当する日付が見つかりません: ' + date
      };
    }
    
    // チェック状態を更新
    checkSheet.getRange(dateRow + 1, userColumn + 1).setValue(checked);
    
    return {
      success: true,
      checked: checked
    };
  } catch (error) {
    console.error('updateCheck error:', error);
    return {
      success: false,
      error: 'チェック状態の更新に失敗しました: ' + error.toString()
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
    
    // ユーザー名の列を探す
    const headerRow = data[0];
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
        error: 'ユーザーが見つかりません: ' + userName
      };
    }
    
    // 日付の行を探す
    for (let i = 1; i < data.length; i++) {
      const rowDate = new Date(data[i][0]);
      if (Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy/M/d') === date) {
        return {
          success: true,
          checked: data[i][userColumn] === true
        };
      }
    }
    
    return {
      success: true,
      checked: false
    };
  } catch (error) {
    console.error('getCheckState error:', error);
    return {
      success: false,
      error: 'チェック状態の取得に失敗しました: ' + error.toString()
    };
  }
}

/**
 * 日付が編集可能かチェック（当日の午前10時まで）
 */
function isEditable(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // 今日の日付のみ編集可能
  if (targetDate.getTime() !== today.getTime()) {
    return false;
  }
  
  // 午前10時まで編集可能
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
 * ユーザーデータ取得（ID指定）
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
          userName: name
        };
      }
    }
    
    return {
      success: false,
      error: 'ユーザーが見つかりません: ' + id
    };
  } catch (error) {
    console.error('getUserData error:', error);
    return {
      success: false,
      error: 'ユーザーデータの取得に失敗しました: ' + error.toString()
    };
  }
}