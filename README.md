# VAMOS

LINE で受信した動画を Cloudflare R2 に保存・配信するサーバーレスアプリケーションです。

## 概要

VAMOS は Cloudflare Workers 上で動作し、LINE Bot を通じて送信された動画メッセージを自動的に収集・保存します。保存された動画は管理画面で確認でき、API 経由で配信できます。

## 機能

- **LINE Webhook 受信**: LINE Messaging API からの動画メッセージを受信
- **動画の自動保存**: 受信した動画を Cloudflare R2 バケットに保存
- **管理画面**: Basic 認証で保護された Web インターフェースで動画一覧を閲覧
- **動画配信 API**: 保存された動画を HTTP 経由で配信

## 技術スタック

- [Cloudflare Workers](https://workers.cloudflare.com/) - サーバーレスランタイム
- [Cloudflare R2](https://www.cloudflare.com/products/r2/) - オブジェクトストレージ
- [LINE Messaging API](https://developers.line.biz/ja/docs/messaging-api/) - LINE Bot プラットフォーム
- TypeScript
- [Vitest](https://vitest.dev/) - テストフレームワーク

## セットアップ

### 前提条件

- Node.js 20 以上
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cloudflare アカウント
- LINE Developers アカウント

### インストール

```bash
npm install
```

### 環境変数の設定

以下のシークレットを Wrangler で設定してください:

```bash
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put BASIC_USERNAME
wrangler secret put BASIC_PASSWORD
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put GOOGLE_CLOUD_CREDENTIALS
```

| 変数名 | 説明 |
|--------|------|
| `LINE_CHANNEL_SECRET` | LINE チャネルシークレット |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE チャネルアクセストークン |
| `BASIC_USERNAME` | 管理画面の Basic 認証ユーザー名 |
| `BASIC_PASSWORD` | 管理画面の Basic 認証パスワード |
| `ELEVENLABS_API_KEY` | ElevenLabs API キー |
| `GOOGLE_CLOUD_CREDENTIALS` | Google Cloud サービスアカウント JSON (Base64) |

### R2 バケットの作成

```bash
wrangler r2 bucket create vamos-videos
```

## 開発

### ローカル開発サーバーの起動

```bash
npm run dev
```

### テストの実行

```bash
npm test
```

### 本番環境へのデプロイ

```bash
npm run deploy
```

## API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| `GET` | `/` | 管理画面（Basic 認証が必要） |
| `POST` | `/api/webhook` | LINE Webhook エンドポイント |
| `GET` | `/api/videos/:id` | 動画の取得 |

## プロジェクト構成

```
src/
├── index.ts          # エントリーポイント、ルーティング
├── types.ts          # 型定義
├── lib/
│   ├── auth.ts       # Basic 認証
│   ├── storage.ts    # R2 ストレージ操作
│   └── line/         # LINE API クライアント
└── routes/
    ├── admin.ts      # 管理画面ルート
    ├── admin.html    # 管理画面 HTML
    ├── videos.ts     # 動画配信ルート
    └── webhook.ts    # LINE Webhook ルート
```

## ライセンス

MIT



test