# フロントエンド仕様書

本ドキュメントは、`src/routes/admin.html` に実装されているサッカー分析動画作成ツール（Soccer Analysis Pro）のフロントエンド仕様をまとめたものです。

## 1. 概要

単一の HTML ファイル（`admin.html`）に、HTML / TailwindCSS（CDN）/ Vanilla JavaScript をすべて含めた SPA 形式の Web アプリケーション。

- **目的**: スマートフォン縦型（1080×1920）の Canvas 上で、サッカー映像と戦術ボードを重ねて録画し、録画後にナレーション音声を AI ボイスで変換して動画を出力する。
- **ターゲットデバイス**: PC ブラウザおよびモバイルブラウザ（タッチ対応）。
- **言語**: 日本語 UI。

## 2. 画面レイアウト

`<body>` は `flex` コンテナで、以下の 2 ペイン構成（モバイルでは縦積み）。

### 2.1 左ペイン: Canvas 領域（`#canvas-container`）

- 1080×1920 の `<canvas id="mainCanvas">` を縦長で表示。
- 上半分（y: 0〜960）が **動画表示領域**、下半分（y: 960〜1920）が **戦術ピッチ領域**。
- Canvas 上部にフローティングで動画コントロール（再生/一時停止、シークバー、時間表示）を配置。

### 2.2 右ペイン: 操作パネル（幅 `md:w-96`）

4 つのタブで構成：

| タブ | ID | 役割 |
| --- | --- | --- |
| 録画 | `tabRecording` | 動画読み込み・選手配置・録画開始/停止 |
| ボード作成 | `tabBoardManager` | 現在の盤面保存・順番変更・削除・呼び出し |
| 音声変換 | `tabVoiceConvert` | 録音音声を AI ボイスへ変換 |
| 結果 | `tabResult` | 変換結果のプレビュー・ダウンロード |

タブ切替は `switchTab(tabName)` で `.active` クラスを付け替えて行う。`voiceConvert` を初めて開いたときに `loadVoices()` が走る。

## 3. Canvas 描画

### 3.1 レンダリングループ

`render()` は `requestAnimationFrame` で常時駆動し、毎フレーム以下を順に描画：

1. 上半分（黒背景）に動画 (`ctx.drawImage(video, …)`) をアスペクト比維持でフィット表示。動画未読込時は「ここに動画をドロップして読み込み」を表示。
2. ピッチ（緑背景＋白ライン: 外枠・センターライン・センターサークル・ペナルティエリア）を描画。
3. 確定済み矢印（黄色）と、ドラッグ中の一時矢印（半透明黄色）を描画。
4. 選手（赤/青の塗り円＋白枠）とボール（白い五角形パターン付き）を描画。

### 3.2 オブジェクトモデル

`objects[]` 配列で管理。要素例：

```js
{ id: 'ball', x, y, r: 25, color: '#fff', type: 'ball' }
{ x, y, r: 35, color: '#ef4444' | '#3b82f6', type: 'player', team: 'red'|'blue' }
```

`arrows[]` は `{ start: {x,y}, end: {x,y} }` の配列。

### 3.3 インタラクション

- **ポインタ取得**: `getPointerPos(e)` でマウス/タッチに対応。Canvas 内部座標系（1080×1920）にスケール変換。
- **ドラッグ**: `pointerdown` 時にオブジェクトに当たっていれば移動、空白なら矢印描画開始。
- **カーソル**: ホバー対象有り→`grab`、ドラッグ中→`grabbing`、それ以外→`crosshair`。
- **タッチ**: `touchstart`/`touchmove` で `preventDefault()` を呼びスクロールを抑止。

## 4. 録画タブ機能

### 4.1 動画読み込み

- ドラッグ＆ドロップ、または動画未読込状態で Canvas をクリック→隠し `<input type="file">` を起動。
- `video/*` を受理し `URL.createObjectURL` で `<video>` 要素にセット、自動再生。読込完了で `#startRecBtn` を有効化。

### 4.2 動画コントロール

`#playPauseBtn`（再生/一時停止）、`#seekBar`（シーク）、`#timeDisplay`（`mm:ss / mm:ss`）。`video.ontimeupdate` で逐次更新。

### 4.3 チーム編成

赤/青チームそれぞれ `+`/`-` ボタンで人数を 0〜11 の範囲で増減。`changePlayerCount(team, delta)` がオブジェクト追加/末尾削除を行う。`#redCount`/`#blueCount` を更新。

### 4.4 リセット

- `#resetLayoutBtn`: ボール＋赤2/青2 の初期配置に戻す（`resetLayout()`）。
- `#resetArrowsBtn`: `arrows[]` を空に。

### 4.5 ボード送り

- `#nextBoardBtn` で、保存済みボードを順番に Canvas へ適用する。
- ボード順はボード作成タブの並び順をそのまま使う。
- 初回押下で 1 件目、以後は次のボードへ進み、最後まで到達するとボタンは disabled になる。
- 録画は従来どおり `canvas.captureStream(60)` のため、録画中にボードを送ると切り替えの様子もそのまま記録される。

### 4.6 録画

- `canvas.captureStream(60)` で 60fps の映像ストリーム取得。
- `getUserMedia({ audio: true })` でマイクを取得。失敗時は映像のみ録画（警告ログのみ、UI ブロックなし）。
- 取得音声は `MediaRecorder`（`audio/webm`）で**別途録音**し、後段の音声変換に利用するため `recordedAudioBlob` に保存。
- 同時に映像＋音声の合成ストリームを `MediaRecorder` で録画し、`recordedVideoBlob` に保存。
- MIME タイプは `getSupportedMimeType()` で `mp4(avc1) → mp4 → webm(vp9/vp8/その他)` の優先順から選定。
- 停止時に **自動で「音声変換」タブへ遷移**し、`loadVoices()` を実行。

## 5. 音声変換タブ機能

### 5.1 変換モード選択

ラジオボタンで 2 モード：

| value | ラベル | 説明 |
| --- | --- | --- |
| `mode1` | Voice Changer | ElevenLabs Speech-to-Speech（推奨） |
| `mode2` | STT-TTS | 音声認識 + 音声合成（Google Chirp 2/3） |

### 5.2 ボイス一覧の取得（`loadVoices`）

選択中モードに応じて API を呼ぶ：

- `mode1`: `GET /api/voice-convert/voices` → `voices[].voice_id`/`name` を `<select>` に流し込む。`#previewVoiceBtn` を表示。
- `mode2`: `GET /api/voice-convert/voices-chirp` → `voices[].name`/`gender`。Chirp 3 はプレビュー不可のため `#previewVoiceBtn` を非表示。

エラー時は `<option>` にエラー文言を表示。

### 5.3 ボイスプレビュー

`#previewVoiceBtn` 押下で、選択中ボイスの `preview_url` を `new Audio()` で再生（mode1 のみ）。

### 5.4 変換実行（`AudioProcessingManager`）

`#startConvertBtn` 押下で `audioManager.executeWithFallback(audioBlob, voiceId, preferredMode)` を呼ぶ。

#### フォールバック戦略

優先モードが失敗した場合、もう一方のモードへ自動切替：

- `mode1` 指定 → `[mode1, mode2_chirp]`
- `mode2` 指定 → `[mode2_chirp, mode1]`

両方失敗時はエラー文言（「Engチームに連絡してください」）を表示。

#### Mode1 (`executeMode1`)

`POST /api/voice-convert/mode1` に `multipart/form-data`（`audio`, `voice_id`）を送り、`ArrayBuffer` を受領。

#### Mode2 (`executeMode2`)

1. **STT**: `POST /api/voice-convert/mode2/stt` （`audio`, `language=ja-JP`）→ `words[]`（各語の `startTime`/`endTime`）。
2. **セグメント分割**: `segmentByPauses(words, pauseThreshold=0.5)` で 0.5 秒以上の無音を境に文を区切る。
3. **TTS**: 各セグメントごとに `POST /api/voice-convert/mode2/tts-chirp`（JSON: `text`, `language`, `voice_name`）→ Base64 音声と `actual_duration_ms`。
4. **合成 (`combineAudioSegments`)**: WebAudio `AudioContext` で 1ch バッファに各セグメントを `startTime` 位置にミックス。`actualDuration / duration` の比でリサンプリングして元発話の長さに合わせる。
5. **WAV 化**: `bufferToWav` で 16bit PCM WAV `ArrayBuffer` を生成。

### 5.5 進捗表示（`#progressSection`）

- スピナー、`#progressStatus`（テキスト）、`#progressFill`（プログレスバー幅 0〜100%）、`#progressDetail` を `updateProgress(percent, status, detail)` で更新。
- 進捗の代表値: 10/20/50/90/95/98/100%。

### 5.6 スキップ

`#skipConvertBtn` で `recordedVideoBlob` をそのまま `convertedVideoBlob` として結果タブへ進む。

### 5.7 変換動画の生成（`createConvertedVideo`）

1. 変換音声を `AudioContext.decodeAudioData` で復号。
2. `MediaStreamDestination` に音声を接続。
3. 元動画を `<video>` で再生し `captureStream()`（Firefox は `mozCaptureStream`）で映像トラック取得。
4. 映像＋AI 音声を `MediaRecorder`（`videoBitsPerSecond: 5_000_000`）で録画。
5. 動画 `onended` で停止し `convertedVideoBlob` を確定。

## 6. ボード作成タブ機能

- `#saveBoardBtn`: 現在の `objects[]` と `arrows[]` をスナップショットとして保存。
- 保存データは `localStorage` (`vamos.savedBoards.v1`) に保持され、ページ再読込後も復元される。
- 各ボードには `呼び出す`、`上へ`、`下へ`、`削除` を提供する。
- `呼び出す` は保存済みボードを Canvas に反映し、録画タブへ戻して続きの編集や録画に使える状態にする。
- `上へ` / `下へ` で変更した並び順は、そのまま `#nextBoardBtn` の送り順に反映される。

## 7. 結果タブ機能

- `#resultStatus`: 成功/フォールバック/失敗バッジを表示。フォールバックが起きた場合は黄色のメッセージ。
- `#resultPreview`: `<video controls>` で `convertedVideoBlob` をプレビュー。
- `#downloadResultBtn`: `analysis_<timestamp>.<mp4|webm>` 名でダウンロード。拡張子は MIME から判定。
- `#regenerateBtn`: 音声変換タブに戻り、もう一方のモードへ自動切替。
- `#newRecordingBtn`: すべての Blob をクリアし、録画タブへ戻る。
- `#errorSection`: エラー時に表示し、「Engチームに連絡してください」を案内。

## 8. バックエンド API

| メソッド | パス | 用途 | リクエスト |
| --- | --- | --- | --- |
| GET | `/api/voice-convert/voices` | ElevenLabs ボイス一覧 | - |
| GET | `/api/voice-convert/voices-chirp` | Chirp 3 ボイス一覧 | - |
| POST | `/api/voice-convert/mode1` | Speech-to-Speech 変換 | multipart: `audio`, `voice_id` |
| POST | `/api/voice-convert/mode2/stt` | Chirp 2 音声認識 | multipart: `audio`, `language` |
| POST | `/api/voice-convert/mode2/tts-chirp` | Chirp 3 音声合成 | JSON: `text`, `language`, `voice_name` |

## 9. スタイル / UX

- ベースカラー: `#1a1a1a`（背景）/ `#27272a`〜`#3f3f46`（ボーダー）/ アクセント `#3b82f6`（青）, `#ef4444`（赤）, `#22c55e`（緑/ダウンロード）。
- TailwindCSS は CDN 読込（`https://cdn.tailwindcss.com`）。
- レスポンシブ: 768px 以下は body を縦スクロール許可、Canvas を `height: 70vh` に縮小、右ペインを下に積む。
- アニメーション: スピナー（CSS keyframes `spin`）、プログレスバーは `transition: width 0.3s`。

## 10. 状態管理

すべてグローバル変数で保持（フレームワークなし）：

| 変数 | 内容 |
| --- | --- |
| `objects[]` | 選手・ボール |
| `arrows[]` | 確定矢印 |
| `savedBoards[]`, `activeBoardIndex` | 保存済みボードと現在の送り位置 |
| `tempArrow` | ドラッグ中矢印 |
| `isDragging`, `dragTarget`, `arrowStart` | ポインタ状態 |
| `isVideoLoaded` | 動画読込済みフラグ |
| `mediaRecorder`, `recordedChunks` | 映像録画 |
| `window._audioRecorder` | 別系統の音声録音 |
| `recordedVideoBlob`, `recordedAudioBlob`, `convertedVideoBlob` | 各成果物 |
| `availableVoices[]` | ElevenLabs ボイス一覧 |
| `audioManager` | `AudioProcessingManager` インスタンス |

## 11. 既知の制約

- 単一 HTML / Vanilla JS のためモジュール分割・型チェックなし。
- `MediaRecorder` のサポート可否はブラウザに依存（Safari は MP4 限定）。
- Mode2 の音声合成は単一チャンネル（モノラル）で、各セグメントの線形リサンプリングのため音質劣化の可能性あり。
- マイク許可がない場合は音声変換不可（`recordedAudioBlob` が `null`）。
- 保存済みボードはブラウザの `localStorage` にのみ保持され、端末間共有はされない。
