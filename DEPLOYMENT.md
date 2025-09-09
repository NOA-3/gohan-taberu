# デプロイ手順

## 🚀 GitHub Pages デプロイ手順

### 1. GitHubリポジトリ作成
```bash
# リポジトリの初期化
git init
git add .
git commit -m "Initial commit: ごはんたべる？ アプリ"

# GitHubリポジトリと接続
git branch -M main
git remote add origin https://github.com/yourusername/gohan-taberu.git
git push -u origin main
```

### 2. GitHub Pages設定
1. GitHubリポジトリの「Settings」タブに移動
2. 「Pages」セクションを選択
3. Source: 「Deploy from a branch」
4. Branch: 「main」 / 「/ (root)」
5. 「Save」をクリック

### 3. カスタムドメイン設定（オプション）
独自ドメインを使用する場合：
1. `CNAME` ファイルをルートディレクトリに作成
2. ドメイン名を記述
3. DNSレコードでGitHub Pagesを指定

## ⚙️ Google Apps Script 設定

### 1. スプレッドシート準備
スプレッドシートID: `1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I`

必要なシート構成：
- **献立管理**: A列(日付), C列(メイン), D列(副菜1), E列(副菜2), F列(汁物)
- **食事WEB回答**: A列(日付), B列以降(職員名による回答)
- **ログイン情報**: A列(職員名), B列(ID), C列(パスワード)

### 2. Apps Script デプロイ
1. Google Apps Script ([script.google.com](https://script.google.com)) にアクセス
2. 新しいプロジェクト作成
3. `gas/Code.gs` の内容をコピー&ペースト
4. `SPREADSHEET_ID` を正しいIDに変更
5. 「デプロイ」→「新しいデプロイ」
6. 種類: 「ウェブアプリ」
7. 実行ユーザー: 「自分」
8. アクセス権限: 「全員」
9. デプロイ実行

### 3. API URL設定
1. デプロイ完了後、Web アプリURLをコピー
2. `js/api.js` の `GAS_API_URL` を更新
3. 変更をGitHubにプッシュ

## 🧪 テスト手順

### ローカルテスト
```bash
# ローカルサーバー起動
npm start
# または
python -m http.server 8000

# ブラウザで http://localhost:8000 にアクセス
```

### 機能テスト項目
- [ ] ログイン認証（正常 / 異常）
- [ ] 年月選択によるメニュー表示
- [ ] チェックボックス操作
- [ ] 時間制限機能（午前10時判定）
- [ ] レスポンシブデザイン確認
- [ ] PWA機能（ホーム画面追加）

### ブラウザ対応確認
- [ ] Chrome (Android/iOS)
- [ ] Safari (iOS)
- [ ] Edge (Android)
- [ ] Firefox (Android)

## 📱 PWA インストール

### Android
1. Chrome でサイトにアクセス
2. 「ホーム画面に追加」をタップ
3. アプリ名確認後「追加」

### iOS
1. Safari でサイトにアクセス
2. 共有ボタン → 「ホーム画面に追加」
3. アプリ名確認後「追加」

## 🔒 セキュリティ考慮事項

### HTTPS必須
- GitHub Pages は自動的にHTTPS対応
- カスタムドメイン使用時もHTTPS設定必要

### データ保護
- ログイン情報の適切な管理
- Apps Script の実行権限設定
- CORS設定の確認

## 🛠️ メンテナンス

### 定期更新項目
- [ ] スプレッドシートのデータ更新
- [ ] 年度切り替え対応
- [ ] ユーザー管理更新

### 監視項目
- [ ] Apps Script 実行回数制限
- [ ] GitHub Pages 帯域制限
- [ ] エラーログ確認

## 📞 サポート

問題が発生した場合：
1. ブラウザの開発者ツールでエラー確認
2. Apps Script のログ確認
3. スプレッドシートの権限設定確認