#!/usr/bin/env node
// songs.json の検証スクリプト。依存ライブラリなしで動作する。
// 使い方: npm run validate

const fs = require('fs');
const path = require('path');

const SONGS_PATH = path.join(__dirname, '..', 'docs', 'songs.json');
const STATUSES = ['want', 'practicing', 'singable', 'confident'];
const ALLOWED_FIELDS = ['id', 'title', 'artists', 'tieUp', 'youtubeUrl', 'registeredAt', 'status', 'memo'];
const CANONICAL_URL = /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const errors = [];
const warnings = [];

function error(index, message) {
  errors.push(`  [${index}] ${message}`);
}

function warn(index, message) {
  warnings.push(`  [${index}] ${message}`);
}

function requireString(song, index, field) {
  const value = song[field];
  if (typeof value !== 'string' || value.trim() === '') {
    error(index, `${field}: 必須項目です(空でない文字列)`);
    return null;
  }
  return value;
}

function label(song, index) {
  const title = typeof song.title === 'string' ? song.title : '(title不明)';
  const artists = Array.isArray(song.artists) ? song.artists.join(' / ') : '(artists不明)';
  return `${index}: ${title} / ${artists}`;
}

let raw;
try {
  raw = fs.readFileSync(SONGS_PATH, 'utf8');
} catch (e) {
  console.error(`NG songs.json を読み込めません: ${SONGS_PATH}`);
  console.error(`   ${e.message}`);
  process.exit(1);
}

let songs;
try {
  songs = JSON.parse(raw);
} catch (e) {
  console.error('NG songs.json が JSON として不正です');
  console.error(`   ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(songs)) {
  console.error('NG songs.json のトップレベルは配列である必要があります');
  process.exit(1);
}

const seenIds = new Map();
const seenVideoIds = new Map();

songs.forEach((song, index) => {
  if (song === null || typeof song !== 'object' || Array.isArray(song)) {
    error(index, '曲データはオブジェクトである必要があります');
    return;
  }

  const id = requireString(song, index, 'id');
  requireString(song, index, 'title');
  const youtubeUrl = requireString(song, index, 'youtubeUrl');
  const registeredAt = requireString(song, index, 'registeredAt');

  let videoId = null;
  if (youtubeUrl) {
    const match = CANONICAL_URL.exec(youtubeUrl);
    if (!match) {
      error(index, `youtubeUrl: https://www.youtube.com/watch?v=VIDEO_ID 形式にしてください (${youtubeUrl})`);
    } else {
      videoId = match[1];
    }
  }

  if (id && videoId && id !== `yt_${videoId}`) {
    error(index, `id: youtubeUrl の video ID と一致しません (期待値 yt_${videoId} / 実際 ${id})`);
  }

  if (registeredAt) {
    if (!ISO_8601.test(registeredAt) || Number.isNaN(Date.parse(registeredAt))) {
      error(index, `registeredAt: ISO 8601 形式にしてください (${registeredAt})`);
    } else if (!registeredAt.endsWith('+09:00')) {
      warn(index, `registeredAt: 日本時間(+09:00)を推奨します (${registeredAt})`);
    }
  }

  if (!Array.isArray(song.artists) || song.artists.length === 0) {
    error(index, `artists: 1人以上の配列にしてください (${JSON.stringify(song.artists)})`);
  } else if (song.artists.some((name) => typeof name !== 'string' || name.trim() === '')) {
    error(index, `artists: 空でない文字列の配列にしてください (${JSON.stringify(song.artists)})`);
  }

  if (!STATUSES.includes(song.status)) {
    error(index, `status: ${STATUSES.join(' / ')} のいずれかにしてください (${JSON.stringify(song.status)})`);
  }

  if (typeof song.tieUp !== 'string') {
    error(index, `tieUp: 文字列にしてください(無い場合は空文字) (${JSON.stringify(song.tieUp)})`);
  }

  if (typeof song.memo !== 'string') {
    error(index, `memo: 文字列にしてください(無い場合は空文字) (${JSON.stringify(song.memo)})`);
  }

  Object.keys(song).forEach((field) => {
    if (!ALLOWED_FIELDS.includes(field)) {
      warn(index, `${field}: 未知のフィールドです`);
    }
  });

  if (id) {
    if (seenIds.has(id)) {
      error(index, `id が重複しています: ${id} (${label(songs[seenIds.get(id)], seenIds.get(id))})`);
    } else {
      seenIds.set(id, index);
    }
  }

  if (videoId) {
    if (seenVideoIds.has(videoId)) {
      const first = seenVideoIds.get(videoId);
      error(index, `YouTube video ID が重複しています: ${videoId} (${label(songs[first], first)})`);
    } else {
      seenVideoIds.set(videoId, index);
    }
  }
});

if (warnings.length > 0) {
  console.log(`警告 ${warnings.length}件`);
  warnings.forEach((w) => console.log(w));
  console.log('');
}

if (errors.length > 0) {
  console.error(`NG ${errors.length}件のエラーがあります (${songs.length}曲を検査)`);
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

console.log(`OK ${songs.length}曲 / エラーなし`);
