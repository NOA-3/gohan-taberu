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
        result = authenticateUser(requestData.id, requestData.password, requestData.encoded);
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
function authenticateUser(id, password, encoded) {
  try {
    // Base64エンコードされたパスワードをデコード
    let decodedPassword = password;
    if (encoded === 'true') {
      try {
        decodedPassword = Utilities.newBlob(Utilities.base64Decode(password)).getDataAsString();
      } catch (e) {
        console.error('Password decode error:', e);
        return {
          success: false,
          error: '認証データの処理に失敗しました'
        };
      }
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const loginSheet = ss.getSheetByName(SHEET_NAMES.LOGIN);
    const data = loginSheet.getDataRange().getValues();
    
    // ヘッダー行をスキップして検索
    for (let i = 1; i < data.length; i++) {
      const [name, userId, userPassword] = data[i];
      // IDの型変換も考慮（数値/文字列両方に対応）
      if (String(userId) === String(id) && userPassword === decodedPassword) {
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
 * 指定年月のレシピ取得（パフォーマンス最適化版）
 */
function getRecipes(year, month) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
    
    // パフォーマンス最適化: 必要なデータのみ取得
    const targetMonth = `${year}/${String(month).padStart(2, '0')}`;
    const lastRow = menuSheet.getLastRow();
    
    if (lastRow <= 1) {
      return { success: true, recipes: [] };
    }
    
    // ヘッダーを除いたデータ範囲を取得
    const dataRange = menuSheet.getRange(2, 1, lastRow - 1, 6);
    const data = dataRange.getValues();
    
    const recipes = [];
    
    // データをフィルタリングして処理
    for (let i = 0; i < data.length; i++) {
      const [dateStr, , main, side1, side2, soup] = data[i];
      
      // 日付の有効性をチェック
      if (!dateStr) continue;
      
      const dateString = dateStr.toString();
      if (dateString.startsWith(targetMonth)) {
        const date = new Date(dateStr);
        
        // 無効な日付をスキップ
        if (isNaN(date.getTime())) continue;
        
        recipes.push({
          date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/M/d'),
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
 * チェック状態更新（パフォーマンス最適化版）
 */
function updateCheck(date, userName, checked) {
  try {
    // パラメータのバリデーションと変換
    if (!date || !userName) {
      return {
        success: false,
        error: '必須パラメータが不足しています'
      };
    }
    
    const isChecked = (checked === 'true' || checked === true);
    
    // 時間制限チェック
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return {
        success: false,
        error: '無効な日付形式です'
      };
    }
    
    if (!isEditable(targetDate)) {
      return {
        success: false,
        error: '午前10時を過ぎているため、チェックできません'
      };
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const checkSheet = ss.getSheetByName(SHEET_NAMES.CHECKS);
    
    // パフォーマンス最適化: ヘッダー行のみ取得
    const headerRange = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn());
    const headerRow = headerRange.getValues()[0];
    
    // ユーザー名の列を探す
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
    
    // 日付列のみ取得して日付を検索
    const lastRow = checkSheet.getLastRow();
    const dateRange = checkSheet.getRange(2, 1, lastRow - 1, 1);
    const dateData = dateRange.getValues();
    
    // 日付の行を探す
    let dateRow = -1;
    const normalizedDate = date.replace(/\//g, '/');
    
    for (let i = 0; i < dateData.length; i++) {
      const rowDate = new Date(dateData[i][0]);
      if (!isNaN(rowDate.getTime())) {
        const formattedRowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy/M/d');
        if (formattedRowDate === normalizedDate) {
          dateRow = i + 2; // +2はヘッダー行とインデックスの調整
          break;
        }
      }
    }
    
    if (dateRow === -1) {
      return {
        success: false,
        error: '該当する日付が見つかりません: ' + date
      };
    }
    
    // チェック状態を更新（パフォーマンス最適化: セルの直接更新）
    checkSheet.getRange(dateRow, userColumn + 1).setValue(isChecked);
    
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
    const normalizedDate = date.replace(/\//g, '/');
    for (let i = 1; i < data.length; i++) {
      const rowDate = new Date(data[i][0]);
      const formattedRowDate = Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy/M/d');
      if (formattedRowDate === normalizedDate) {
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
  // 日本時間を取得
  const jstNow = new Date(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));
  const jstToday = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // 今日の日付のみ編集可能
  if (targetDate.getTime() !== jstToday.getTime()) {
    return false;
  }
  
  // 午前10時まで編集可能（日本時間）
  return jstNow.getHours() < 10;
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