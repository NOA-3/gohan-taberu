# ごはんたべる？ 🍚

職員の食事利用チェックを行うモバイル対応ウェブアプリです。

## 機能概要

- **ログイン認証**: IDとパスワードでの職員認証
- **メニュー表示**: 日付ごとの献立表示
- **食事チェック**: 当日午前10時までのチェック機能
- **リアルタイム連携**: Googleスプレッドシートとの自動同期

## 技術構成

- **フロントエンド**: HTML5, CSS3, JavaScript ES6
- **バックエンド**: Google Apps Script
- **データベース**: Google スプレッドシート
- **ホスティング**: GitHub Pages

## セットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/yourusername/gohan-taberu.git
cd gohan-taberu
```

2. ローカルサーバー起動
```bash
npm start
```

3. ブラウザで `http://localhost:8000` にアクセス

## スプレッドシート設定

使用するGoogleスプレッドシート（ID: `1KEVnasB0wW7caGShkRs_gUD3M41SEoLVFKRzZ-bdW4I`）には以下のシートが含まれています：

- **献立管理**: 日付別メニュー情報
- **食事WEB回答**: 職員の食事利用チェック状況
- **ログイン情報**: 職員のログイン認証情報

## デプロイ

```bash
npm run deploy
```

## ライセンス

MIT License