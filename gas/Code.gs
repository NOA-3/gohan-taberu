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
    console.log('=== Mobile Authentication Debug ===');
    console.log('ID:', id);
    console.log('Password length:', password ? password.length : 0);
    console.log('Encoded flag:', encoded);
    
    // Base64エンコードされたパスワードをデコード
    let decodedPassword = password;
    if (encoded === 'true') {
      try {
        // 新しいデコード方式（モバイル対応）
        const decodedBytes = Utilities.base64Decode(password);
        decodedPassword = decodeURIComponent(Utilities.newBlob(decodedBytes).getDataAsString());
        console.log('Decoding method: Base64 + decodeURIComponent');
      } catch (decodeError) {
        console.warn('Base64 decoding failed, trying alternative method:', decodeError);
        try {
          // 代替方式: 直接デコード
          decodedPassword = Utilities.newBlob(Utilities.base64Decode(password)).getDataAsString();
          console.log('Decoding method: Standard Base64 fallback');
        } catch (fallbackError) {
          console.error('All decoding methods failed:', fallbackError);
          // 最後の手段: エンコードされていないとして処理
          decodedPassword = password;
          console.warn('WARNING: Using password as-is due to decoding failures');
        }
      }
    } else {
      console.log('Using plain text password (encoded=false)');
    }
    
    console.log('Final decoded password length:', decodedPassword ? decodedPassword.length : 0);
    
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
 * 指定年月のレシピ取得（デバッグ強化版）
 */
function getRecipes(year, month) {
  try {
    console.log(`=== getRecipes Debug Start ===`);
    console.log(`Request: year=${year}, month=${month}`);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
    
    // パフォーマンス最適化: 必要なデータのみ取得
    const targetMonth = `${year}/${String(month).padStart(2, '0')}`;
    console.log(`Target month string: "${targetMonth}"`);
    
    const lastRow = menuSheet.getLastRow();
    console.log(`Last row: ${lastRow}`);
    
    if (lastRow <= 1) {
      console.log('No data found (lastRow <= 1)');
      return { success: true, recipes: [] };
    }
    
    // ヘッダーを除いたデータ範囲を取得
    const dataRange = menuSheet.getRange(2, 1, lastRow - 1, 6);
    const data = dataRange.getValues();
    console.log(`Data rows retrieved: ${data.length}`);
    
    // 最初の数行をデバッグ出力
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const [dateStr, , main] = data[i];
      console.log(`Row ${i + 2}: date="${dateStr}" (type: ${typeof dateStr}), main="${main}"`);
      if (dateStr) {
        console.log(`Date string: "${dateStr.toString()}"`);
      }
    }
    
    const recipes = [];
    let matchCount = 0;
    
    // データをフィルタリングして処理
    for (let i = 0; i < data.length; i++) {
      const [dateStr, , main, side1, side2, soup] = data[i];
      
      // 日付の有効性をチェック
      if (!dateStr) continue;
      
      const date = new Date(dateStr);
      
      // 無効な日付をスキップ
      if (isNaN(date.getTime())) {
        console.log(`Invalid date skipped: "${dateStr}"`);
        continue;
      }
      
      // 年と月を直接比較（Dateオブジェクト対応）
      const dataYear = date.getFullYear();
      const dataMonth = date.getMonth() + 1; // getMonth()は0ベース
      const isMatch = (dataYear === year && dataMonth === month);
      
      console.log(`Row ${i + 2}: year=${dataYear}, month=${dataMonth}, target year=${year}, month=${month}, match=${isMatch}`);
      
      if (isMatch) {
        matchCount++;
        console.log(`Match found at row ${i + 2}: ${dataYear}/${dataMonth} matches ${year}/${month}`);
        
        const recipe = {
          date: Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/M/d'),
          dayOfWeek: getDayOfWeek(date),
          main: main || '',
          side1: side1 || '',
          side2: side2 || '',
          soup: soup || '',
          isEditable: isEditable(date)
        };
        
        console.log(`Recipe added:`, recipe);
        recipes.push(recipe);
      }
    }
    
    console.log(`=== getRecipes Debug End ===`);
    console.log(`Total matches found: ${matchCount}`);
    console.log(`Final recipes count: ${recipes.length}`);
    
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
 * 日付が編集可能かチェック（当日の午前10時まで、未来の日付は編集可能）
 */
function isEditable(date) {
  // 日本時間を取得
  const jstNow = new Date(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));
  const jstToday = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // 過去の日付は編集不可
  if (targetDate.getTime() < jstToday.getTime()) {
    return false;
  }
  
  // 未来の日付は編集可能
  if (targetDate.getTime() > jstToday.getTime()) {
    return true;
  }
  
  // 今日の日付は午前10時まで編集可能（日本時間）
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

/**
 * テスト用関数：2025年9月のデータをテスト
 */
function testSeptember2025() {
  console.log('=== Testing September 2025 ===');
  const result = getRecipes(2025, 9);
  console.log('Test result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * テスト用関数：スプレッドシートの生データ確認
 */
function testRawData() {
  console.log('=== Testing Raw Spreadsheet Data ===');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
  const data = menuSheet.getDataRange().getValues();
  
  console.log(`Total rows: ${data.length}`);
  
  // 9月のデータを探す
  for (let i = 1; i < Math.min(20, data.length); i++) {
    const [dateStr, , main] = data[i];
    if (dateStr) {
      const date = new Date(dateStr);
      const formattedDate = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');
      const month = date.getMonth() + 1; // getMonth()は0ベース
      
      console.log(`Row ${i + 1}: original="${dateStr}", formatted="${formattedDate}", month=${month}, main="${main}"`);
      
      if (month === 9) {
        console.log(`*** SEPTEMBER DATA FOUND at row ${i + 1} ***`);
      }
    }
  }
}

/**
 * テスト用関数：チェックシートのヘッダー確認
 */
function testCheckSheetHeaders() {
  console.log('=== Testing Check Sheet Headers ===');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const checkSheet = ss.getSheetByName(SHEET_NAMES.CHECKS);
  const headerRange = checkSheet.getRange(1, 1, 1, checkSheet.getLastColumn());
  const headerRow = headerRange.getValues()[0];
  
  console.log(`Total columns: ${headerRow.length}`);
  
  for (let i = 0; i < headerRow.length; i++) {
    console.log(`Column ${i + 1}: "${headerRow[i]}"`);
    if (headerRow[i] && headerRow[i].toString().includes('池島')) {
      console.log(`*** FOUND 池島 in column ${i + 1} ***`);
    }
  }
  
  // 特定のユーザー名で検索
  const targetUser = '池島 裕太';
  console.log(`Searching for exact match: "${targetUser}"`);
  
  for (let i = 1; i < headerRow.length; i++) {
    if (headerRow[i] === targetUser) {
      console.log(`*** EXACT MATCH found in column ${i + 1} ***`);
      return;
    }
  }
  
  console.log('No exact match found');
}