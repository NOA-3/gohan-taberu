/**
 * ごはんたべる？ - Google Apps Script API
 * スプレッドシートID: 1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I
 */

const SPREADSHEET_ID = '1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I';
const SHEET_NAMES = {
  MENU: '献立管理',
  CHECKS: '食事WEB回答', 
  LOGIN: 'ログイン情報'
};

/**
 * POST処理 - CORS対応
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * GET処理 - CORS対応  
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * JSONP対応でリクエストを処理（CORS回避）
 */
function handleRequest(e) {
  try {
    let requestData = e.parameter;
    const action = requestData.action;
    
    let result;
    switch (action) {
      case 'login':
        result = authenticateUser(requestData.id, requestData.password);
        break;
      case 'getRecipes':
        // 数値に変換して渡す
        result = getRecipes(parseInt(requestData.year), parseInt(requestData.month));
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
        result = { success: false, error: 'Invalid action' };
    }
    
    // JSONPコールバックが指定されている場合
    if (requestData.callback) {
      const output = ContentService.createTextOutput();
      output.setMimeType(ContentService.MimeType.JAVASCRIPT);
      const jsonpResponse = `${requestData.callback}(${JSON.stringify(result)})`;
      return output.setContent(jsonpResponse);
    } else {
      // 通常のJSONレスポンス
      const output = ContentService.createTextOutput();
      output.setMimeType(ContentService.MimeType.JSON);
      return output.setContent(JSON.stringify(result));
    }
  } catch (error) {
    console.error('Request error:', error);
    const errorResult = {
      success: false,
      error: error.toString()
    };
    
    // JSONPエラーレスポンス
    if (e.parameter.callback) {
      const output = ContentService.createTextOutput();
      output.setMimeType(ContentService.MimeType.JAVASCRIPT);
      const jsonpResponse = `${e.parameter.callback}(${JSON.stringify(errorResult)})`;
      return output.setContent(jsonpResponse);
    } else {
      const output = ContentService.createTextOutput();
      output.setMimeType(ContentService.MimeType.JSON);
      return output.setContent(JSON.stringify(errorResult));
    }
  }
}

/**
 * ユーザー認証
 */
function authenticateUser(id, password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const loginSheet = ss.getSheetByName(SHEET_NAMES.LOGIN);
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
      error: 'ログイン処理でエラーが発生しました'
    };
  }
}

/**
 * 指定年月のレシピ取得
 */
function getRecipes(year, month) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
    const data = menuSheet.getDataRange().getValues();
    
    const recipes = [];
    const targetMonth = `${year}/${String(month).padStart(2, '0')}`;
    
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
      error: 'メニューデータの取得に失敗しました'
    };
  }
}

/**
 * チェック状態更新
 */
function updateCheck(date, userName, checked) {
  try {
    // checkedパラメータをブール値に変換
    const isChecked = (checked === 'true' || checked === true);
    
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
        error: 'ユーザーが見つかりません'
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
        error: '該当する日付が見つかりません'
      };
    }
    
    // チェック状態を更新
    checkSheet.getRange(dateRow + 1, userColumn + 1).setValue(isChecked);
    
    return {
      success: true,
      checked: isChecked
    };
  } catch (error) {
    console.error('updateCheck error:', error);
    return {
      success: false,
      error: 'チェック状態の更新に失敗しました'
    };
  }
}

/**
 * チェック状態取得
 */
function getCheckState(date, userName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const checkSheet = ss.getSheetByName(SHEET_NAMES.CHECKS);
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
        error: 'ユーザーが見つかりません'
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
      error: 'チェック状態の取得に失敗しました'
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
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const loginSheet = ss.getSheetByName(SHEET_NAMES.LOGIN);
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
      error: 'ユーザーが見つかりません'
    };
  } catch (error) {
    console.error('getUserData error:', error);
    return {
      success: false,
      error: 'ユーザーデータの取得に失敗しました'
    };
  }
}