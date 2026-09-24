# karaoke-tools

カラオケで「歌いたい曲」「歌える曲」を管理・検索する個人用Webツール。

- **曲の登録・編集** … PCから Claude Code / Codex などのAIエージェントに指示して `docs/songs.json` を直接編集する
- **曲の検索** … カラオケ中にスマホから GitHub Pages 上の静的Webアプリで検索する

バックエンド・DB・APIサーバー・認証なし。GitHubリポジトリがそのままデータストア兼Webアプリになる。運用コストは月額0円。

公開URL: https://disconeko.github.io/karaoke-tools/

## 構成

```text
docs/                     ← GitHub Pages の公開ディレクトリ
├── index.html            ← 検索画面
├── app.js                ← 検索・絞り込み・ソート(依存ライブラリなし)
├── style.css             ← ダークテーマ
├── songs.json            ← 曲データ(唯一のデータストア)
├── manifest.json         ← PWA
├── sw.js                 ← Service Worker(オフラインキャッシュ)
└── icons/
scripts/
└── validate-songs.js     ← songs.json の検証
AGENTS.md                 ← AIエージェント向けの曲登録・編集ルール
```

ビルド不要。素のHTML/CSS/JavaScriptのみで、npmの依存パッケージも無し。

## ローカル起動方法

`songs.json` を `fetch` で読むため、`index.html` をファイルとして直接開くのではなくHTTPサーバー経由で開く。

```bash
npm start
```

→ http://localhost:8080 を開く。(内部で `npx serve docs` を実行する)

Pythonでも可。

```bash
python3 -m http.server 8080 --directory docs
```

## 曲登録方法

Web管理画面は無い。AIエージェントに話しかけて登録する。

```text
Claude Codeを起動

> この曲登録して
> https://www.youtube.com/watch?v=xxxxx

Claude Codeがsongs.jsonを編集

git diffで確認

git commit / push

スマホからGitHub Pagesを開いて検索
```

エージェントは `AGENTS.md` のルールに従って、video IDの重複確認・正式な曲名/歌手名の特定・`songs.json` への追記・validation まで行う。

編集も同じように指示する。

```text
> Lemonを歌えるにして
> Lemonのキーを-2にして
> Lemonに「ラスサビ怪しい」とメモして
```

## songs.json の仕様

```json
[
  {
    "id": "yt_-tKVN2mAKRI",
    "title": "打上花火",
    "artists": ["DAOKO", "米津玄師"],
    "tieUp": "打ち上げ花火、下から見るか?横から見るか? 主題歌",
    "youtubeUrl": "https://www.youtube.com/watch?v=-tKVN2mAKRI",
    "registeredAt": "2026-09-24T21:40:00+09:00",
    "status": "want",
    "memo": "デュエット向き"
  }
]
```

| フィールド | 型 | 説明 | デフォルト |
| --- | --- | --- | --- |
| `id` | string | `yt_` + YouTube video ID。一意 | — |
| `title` | string | 正式な曲名 | — |
| `artists` | string[] | 正式な歌手名。1人でも配列、デュエットは全員 | — |
| `tieUp` | string | アニメ・ドラマなどの作品名(例: `鬼滅の刃 OP`) | `""` |
| `youtubeUrl` | string | `https://www.youtube.com/watch?v=VIDEO_ID` 形式 | — |
| `registeredAt` | string | 登録日時。ISO 8601 / 日本時間(`+09:00`) | 登録時の日時 |
| `status` | string | `want` / `practicing` / `singable` / `confident` | `want` |
| `memo` | string | 自由記述 | `""` |

キー変更の専用フィールドは持ちません。基本は原曲キーで歌う前提で、
補正が必要な曲だけ `memo` に書きます(例: `"サビが高いので-3"`)。

### status の意味

```text
want       = 歌いたい
practicing = 練習中
singable   = 歌える
confident  = 自信あり(十八番)
```

習熟度の順は `want` → `practicing` → `singable` → `confident`。
`singable` は「一通り歌える」、`confident` は「人前で自信を持って歌える」の区別です。

## 検索画面でできること

- 曲名・歌手名・作品名の部分一致検索(検索ボックス1個、入力中にリアルタイム検索)
  - 大文字小文字、全角半角、ひらがな/カタカナの違いは無視する
  - スペース区切りで絞り込み(例: `米津 lemon`)
  - `tieUp` も検索対象なので「チェンソーマン」で KICK BACK が出る
- status での絞り込み(全部 / 自信あり / 歌える / 練習中 / 歌いたい)
- 並び替え(登録が新しい順 / 古い順 / 歌手名順 / 曲名順)
- 曲カードから YouTube を開く
- 曲カードをタップするとアコーディオンで展開し、MVサムネイル・作品名・メモ全文・登録日を表示

一覧は1曲2行(曲名+ステータス / 歌手名・メモ)に抑えて、1画面の表示曲数を優先している。

検索はブラウザ上で `songs.json` を全件読み込んでJavaScriptで行う。検索APIは無い。

> 歌詞は登録できません。GitHub Pagesは公開サイトなので、歌い出しを含む歌詞の掲載は
> 著作権(公衆送信権)の侵害になります。曲を思い出す手がかりはサムネイルと作品名で代用しています。

## validation

```bash
npm run validate
```

JSONの妥当性、必須フィールド、`artists` が空でない配列か、`status` の値、`id` と video ID の重複などを検証する。エラーがあれば終了コード1で落ちる。

## PWA利用方法

スマホのブラウザで公開URLを開き、共有メニューから「ホーム画面に追加」する。

- standalone表示(アドレスバー無し)で起動する
- Service Worker が画面のアセットと最後に取得した `songs.json` をキャッシュするため、カラオケ店で電波が悪くても検索できる
- 曲リストはオンラインなら常に最新を取得する(取得に3秒かかると自動でキャッシュを使う)

**Webアプリ側(`index.html` / `app.js` / `style.css` / `icons/`)を変更したときは `docs/sw.js` の `VERSION` を上げること。** 上げないとキャッシュが更新されない。曲を追加しただけなら不要。

## GitHub Pages 設定方法

リポジトリの Settings → Pages で以下を設定する。

```text
Source: Deploy from a branch
Branch: main  /docs
```

数十秒後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される。

## デプロイ方法

push するだけ。

```bash
git add .
git commit -m "add songs"
git push
```

GitHub Actions などのCI設定は不要。

## セキュリティ

公開リポジトリなので、APIキー・パスワード・OAuth secret・private token の類は一切置かない。
YouTube Data API など秘密鍵を必要とする方式はWebアプリ側では使わず、曲情報の取得はAIエージェント側で行う。
