# AGENTS.md

AIエージェント(Claude Code / Codex など)向けの作業ルール。
このリポジトリは **カラオケ曲リスト** のデータストア兼Webアプリ。

曲の登録・編集用のWeb管理画面は存在しない。
**曲データの追加・編集はすべてエージェントが `docs/songs.json` を直接編集して行う。**

## リポジトリ構成

```text
docs/songs.json          ← 唯一のデータストア。編集対象はここだけ
docs/index.html          ← 検索用Webアプリ(スマホ用)
docs/app.js
docs/style.css
docs/manifest.json       ← PWA
docs/sw.js               ← Service Worker
docs/icons/
scripts/validate-songs.js
```

GitHub Pages で `main` ブランチの `/docs` を公開している。
`docs/songs.json` を push すれば、それだけでスマホ側に反映される。

## データ形式

`docs/songs.json` はオブジェクトの配列。

```json
[
  {
    "id": "yt_SX_ViT4Ra7k",
    "title": "Lemon",
    "artists": ["米津玄師"],
    "tieUp": "アンナチュラル 主題歌",
    "youtubeUrl": "https://www.youtube.com/watch?v=SX_ViT4Ra7k",
    "registeredAt": "2026-09-20T21:10:00+09:00",
    "status": "singable",
    "memo": "DAMでは-2が歌いやすい"
  }
]
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `id` | string | ○ | `yt_` + YouTube video ID。一意 |
| `title` | string | ○ | 正式な曲名 |
| `artists` | string[] | ○ | 正式な歌手名。1人でも配列。デュエット・コラボは全員を列挙 |
| `tieUp` | string | ○ | アニメ・ドラマ・映画などの作品名。無い場合は空文字 `""` |
| `youtubeUrl` | string | ○ | `https://www.youtube.com/watch?v=VIDEO_ID` 形式に統一 |
| `registeredAt` | string | ○ | ISO 8601 / 日本時間(`+09:00`) |
| `status` | string | ○ | `want` / `practicing` / `singable` |
| `memo` | string | ○ | 自由記述。無い場合は空文字 `""` |

キー変更(原曲キーからの上げ下げ)専用のフィールドは持たない。
**基本は原曲キーで歌う前提で、補正が必要な曲だけ `memo` に書く**(例: `"サビが高いので-3"`)。

`title` / `artists` / `tieUp` はWebアプリの検索対象になる。
`tieUp` を入れておくと「チェンソーマン」のような作品名でも曲を引ける。

`status` の意味:

```text
want       = 歌いたい
practicing = 練習中
singable   = 歌える
```

全フィールドを必ず含めること(`memo` が無い場合も `""` を入れる)。
上記以外のフィールドは追加しない。

## 新規曲登録

ユーザーから YouTube URL と「登録して」等の指示を受けた場合の手順。

### 1. URLから video ID を取得

対応する入力形式:

```text
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://m.youtube.com/watch?v=VIDEO_ID
https://music.youtube.com/watch?v=VIDEO_ID
https://www.youtube.com/shorts/VIDEO_ID
```

video ID は11文字(`A-Z a-z 0-9 _ -`)。
`&t=`、`?si=`、`&list=`、`&pp=` などの余計なパラメータは捨てる。

### 2. 重複チェック

`docs/songs.json` に同じ video ID(= 同じ `id`)が既に存在しないか確認する。

```bash
grep VIDEO_ID docs/songs.json
```

**既に存在する場合は登録せず、ユーザーにその曲の情報を伝えて終了する。**
同じ曲の別動画(別 video ID)については登録を禁止しない。

### 3. 動画情報を確認する

まず oEmbed で動画の存在と元タイトル・チャンネル名を確認する(APIキー不要)。

```bash
curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=VIDEO_ID&format=json"
```

`Not Found` が返る場合は動画が存在しない(またはIDの取り違え)。ユーザーに確認する。

### 4-5. 正式な曲名・歌手名・作品名を特定する

**YouTubeの動画タイトルをそのまま `title` にしない。**
必要ならWeb検索も使い、カラオケで検索できる正式表記を特定する。

```text
YouTubeタイトル: 米津玄師 Kenshi Yonezu - Lemon
→ { "title": "Lemon", "artists": ["米津玄師"], "tieUp": "アンナチュラル 主題歌" }

YouTubeタイトル: YOASOBI「夜に駆ける」 Official Music Video
→ { "title": "夜に駆ける", "artists": ["YOASOBI"], "tieUp": "" }

YouTubeタイトル: DAOKO × 米津玄師『打上花火』MUSIC VIDEO
→ { "title": "打上花火", "artists": ["DAOKO", "米津玄師"], "tieUp": "打ち上げ花火、下から見るか?横から見るか? 主題歌" }
```

ルール:

- `【MV】` `Official Music Video` `[Official Video]` `(Lyric Video)` `- Topic` などの装飾は除去する
- 英語併記のアーティスト名は日本語の公式表記に寄せる(`米津玄師 Kenshi Yonezu` → `米津玄師`)
- `×` `feat.` `with` などで複数名義の場合は `artists` に全員を並べる(表記順は動画・公式表記に従う)
- アニメタイアップや副題(`/ TVアニメ「○○」OPテーマ`)は `title` に含めず、`tieUp` に入れる
  - 書式は `作品名 + OP / ED / 主題歌 / 挿入歌`(例: `鬼滅の刃 OP`、`アンナチュラル 主題歌`)
  - タイアップが無い曲は空文字 `""`
- 歌ってみた・カバー動画は、原曲のアーティストを `artists` にし、`memo` に「○○のカバー動画」と書く
- 判断に迷う場合(略称・別名義・複数アーティスト名義など)はユーザーに確認する

### 6-10. songs.json に追加

**配列の末尾に追加する**(`git diff` を読みやすくするため。並び順はWebアプリ側でソートするのでファイル上の順序は問わない)。

新規登録時の初期値:

```text
registeredAt = 現在の日本時間
status       = "want"
memo         = ""
tieUp        = 調べた作品名(無ければ "")
```

現在の日本時間は次のコマンドで取得する。

```bash
TZ=Asia/Tokyo date +"%Y-%m-%dT%H:%M:%S+09:00"
```

ユーザーが同時に「これは歌える」「キーは-2」などと言っている場合は、その値を初期値の代わりに設定してよい。

### 11-13. 検証と確認

```bash
npm run validate
git diff
```

`npm run validate` が `OK` を返すことを必ず確認する。
エラーが出た場合は修正してから再実行する。
最後に `git diff` の内容をユーザーに示す。

## 既存曲の編集

対象曲は `title` の部分一致(大文字小文字を無視)で探す。
**候補が複数ある場合のみ**ユーザーに確認する。1曲に確定できる場合は確認不要。

```text
「Lemonを歌えるにして」        → status = "singable"
「Lemonを練習中にして」        → status = "practicing"
「Lemonのキーを-2にして」      → memo に "-2" を反映(キー専用フィールドは無い)
「Lemonに『ラスサビ怪しい』とメモして」 → memo = "ラスサビ怪しい"
```

- キー変更の指示は `memo` に書く。既存のmemoがある場合は追記・統合する(例: `"サビが高いので-3"`)
- `id` / `youtubeUrl` / `registeredAt` は原則変更しない(登録日時は履歴として残す)
- `title` / `artists` / `tieUp` は表記が誤っていた場合や、後から判明した場合に修正する
- 編集後も `npm run validate` と `git diff` を必ず実行する

## 削除

ユーザーが明示的に「削除して」と言った場合のみ、該当オブジェクトを配列から取り除く。
「もう歌わない」程度の発言では削除しない(判断に迷う場合は確認する)。

## validation

```bash
npm run validate
```

検証内容:

- JSONとして valid / トップレベルが配列
- `id` `title` `youtubeUrl` `registeredAt` が必須かつ空でない
- `artists` が空でない文字列の配列
- `tieUp` `memo` が文字列(空文字可)
- `youtubeUrl` が canonical 形式
- `id` が `yt_` + youtubeUrl の video ID と一致
- `registeredAt` が ISO 8601(日本時間以外は警告)
- `status` が `want` / `practicing` / `singable`
- `id` の重複なし / video ID の重複なし

## Git運用

`songs.json` の変更履歴 = 曲リストの履歴。人間が `git diff` で読めることを優先する。

- 1回の編集差分は小さく保つ(末尾追加、対象フィールドのみ変更)
- JSONのインデントは **スペース2** 、ファイル末尾は改行1つ
- 既存行の順序を無意味に入れ替えない、整形し直さない
- **コミット・pushはユーザーから指示されたときだけ行う。** 編集後は `git diff` を見せて判断を仰ぐ

コミットメッセージ例:

```text
add song: 米津玄師 - Lemon
update song: Lemon status=singable
```

## 禁止事項

- APIキー・パスワード・OAuth secret・private token をリポジトリに置かない
  (GitHub Pages で全世界に公開されるリポジトリである)
- YouTube Data API など秘密鍵が必要な方式をWebアプリ側に実装しない
  (曲情報の取得はエージェントが行う前提)
- 曲登録用のWeb管理画面・APIサーバー・DBを追加しない
- `docs/songs.json` 以外のファイルを、曲の追加・編集のついでに変更しない
- **歌詞を `memo` などに書き写さない。** このリポジトリはGitHub Pagesで公開されるため、
  歌詞(歌い出しの一節を含む)の掲載は公衆送信権の侵害になる。
  曲を思い出す手がかりは、Webアプリ側がYouTubeのサムネイルと `tieUp` を展開表示することで担保している

## Webアプリを変更した場合

`docs/index.html` `app.js` `style.css` `icons/` を変更したときは、
`docs/sw.js` の `VERSION` を上げること(`v1` → `v2`)。
上げないとPWAのキャッシュが更新されず、スマホ側に反映されない。

`docs/songs.json` の変更だけなら `VERSION` の更新は不要(常にネットワーク優先で取得している)。
