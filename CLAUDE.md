# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要：日本語レスポンス設定
**Claude Codeは必ず日本語でレスポンスしてください。**
- すべての分析レポート、提案、エラーメッセージを日本語で出力
- コードコメントも日本語で記述
- タスク管理とプログレス報告も日本語で実行

## 重要な制約事項
**以下の制約を厳守してください：**
- **MockAPIは絶対に使用しない** - 本番環境（Google Apps Script）のみを使用
- 開発環境でも必ず本番APIを使用してテスト
- `isDevelopment`の判定に関わらず、常にGAS APIを使用
- テストデータやダミーデータは使用せず、実際のスプレッドシートデータを使用

## SuperClaude Framework設定
このプロジェクトでは以下のSuperClaudeフラグを使用：
- `--japanese`: 全出力日本語化（必須）
- `--task-manage`: 自動タスク管理開始
- `--introspect`: 思考プロセス可視化
- `--orchestrate`: 最適ツール選択

### SuperClaude Framework インストール状況
**✅ インストール完了**: SuperClaude v4.0.9
**Python環境**: Python 3.13.7 (uvで管理)
**フレームワークファイル**: ~/.claude/ ディレクトリに配置済み

#### SuperClaude環境の有効化
```bash
# 仮想環境を有効化
source .venv/Scripts/activate

# SuperClaudeのインポート確認
python -c "import SuperClaude; print('SuperClaude ready')"
```

#### SuperClaudeスラッシュコマンド使用方法
Claude Code内で以下のスラッシュコマンドが利用可能：

**基本コマンド:**
- `/sc:analyze` - プロジェクト分析実行
- `/sc:load` - セッション開始時のプロジェクト読み込み
- `/sc:save` - セッション状態の保存
- `/mode:structured` - 構造化タスク管理モード

**注意**: スラッシュコマンドが認識されない場合は、以下で有効化：
```bash
# SuperClaudeフレームワークファイルを確認
ls ~/.claude/
# プロジェクト開始時に必要なフラグを使用
# --japanese --task-manage --introspect --orchestrate
```

#### SuperClaudeフレームワークファイル
- `FLAGS.md`: SuperClaudeフラグ設定
- `PRINCIPLES.md`: 開発原則
- `RULES.md`: コーディング規則
- `CLAUDE.md`: プロジェクト設定

### MCP サーバー設定状況
**現在の状況**: MCPサーバー未設定
**Serena連携**: 未連携

#### Serena連携手順（必要に応じて）
```bash
# Serenaサーバーを追加（設定が利用可能になった場合）
claude mcp add serena
claude mcp enable serena
```

#### 利用可能なMCPサーバー確認
```bash
claude mcp list
```

## Claude Code + Cursor連携設定

### 前提条件
- Claude Code (v1.0.109) がグローバルインストール済み
- Cursor Editor (v1.5.11) がインストール済み

### 連携手順
1. **Claude Code起動**: ターミナルで`claude`コマンド実行
2. **Cursor統合**: Cursorでプロジェクトを開く
3. **連携開始**: Cursorサイドバーの「ウニマーク」アイコンをクリック
4. **使用方法**:
   - コードを選択
   - 自然言語で編集指示（日本語で指示可能）
   - diff確認後に変更を適用

### 連携時の作業フロー
```
1. Cursorでファイルを開く
2. 編集したいコードセクションを選択
3. Claude Codeに日本語で指示
4. 変更内容を確認
5. 変更を適用
```

## Project Overview

スプレッドシートアプリケーションプロジェクト。プロジェクトの成長に合わせてコードベース構造と開発ワークフローを確立していきます。

## Development Commands

*プロジェクト構造が確立された際にコマンドを追加予定*

## Architecture Notes

*コンポーネント開発時にアーキテクチャドキュメントを追加予定*

## Development Guidelines

- ユーザー向けコンテンツには適切な日本語命名規則を使用
- データ処理とUIコンポーネントの明確な分離を維持
- スプレッドシート操作の適切なエラーハンドリングを実装
- データ操作にはTypeScriptを使用して型安全性を確保
- すべてのコードレビューと技術判断は日本語で実行