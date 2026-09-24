'use strict';

const STATUS_LABEL = {
  want: '歌いたい',
  practicing: '練習中',
  singable: '歌える',
};

const YOUTUBE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12ZM9.8 15.4V8.6l5.7 3.4-5.7 3.4Z"/></svg>';

const searchInput = document.getElementById('search');
const filtersEl = document.getElementById('filters');
const sortSelect = document.getElementById('sort');
const countEl = document.getElementById('count');
const resultsEl = document.getElementById('results');

const collator = new Intl.Collator('ja');

const state = { query: '', status: 'all', sort: 'newest' };
let songs = [];

// 半角/全角・大文字小文字・ひらがな/カタカナの違いを吸収する
function normalize(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function prepare(song) {
  return {
    ...song,
    searchText: normalize(`${song.title} ${song.artist}`),
    registeredTime: Date.parse(song.registeredAt) || 0,
  };
}

function formatKey(key) {
  if (key === 0) return 'Key ±0';
  return `Key ${key > 0 ? '+' : ''}${key}`;
}

function createCard(song) {
  const card = document.createElement('article');
  card.className = 'card';

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = song.title;
  body.appendChild(title);

  const artist = document.createElement('p');
  artist.className = 'card-artist';
  artist.textContent = song.artist;
  body.appendChild(artist);

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  const badge = document.createElement('span');
  badge.className = `badge badge-${song.status}`;
  badge.textContent = STATUS_LABEL[song.status] || song.status;
  meta.appendChild(badge);
  const key = document.createElement('span');
  key.textContent = formatKey(song.key);
  meta.appendChild(key);
  body.appendChild(meta);

  if (song.memo) {
    const memo = document.createElement('p');
    memo.className = 'card-memo';
    memo.textContent = song.memo;
    body.appendChild(memo);
  }

  card.appendChild(body);

  const link = document.createElement('a');
  link.className = 'yt-link';
  link.href = song.youtubeUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', `${song.title} をYouTubeで開く`);
  link.innerHTML = YOUTUBE_ICON;
  card.appendChild(link);

  return card;
}

function sortSongs(list) {
  switch (state.sort) {
    case 'oldest':
      return list.sort((a, b) => a.registeredTime - b.registeredTime);
    case 'title':
      return list.sort((a, b) => collator.compare(a.title, b.title));
    case 'artist':
      return list.sort(
        (a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title)
      );
    default:
      return list.sort((a, b) => b.registeredTime - a.registeredTime);
  }
}

function showMessage(text) {
  resultsEl.textContent = '';
  const message = document.createElement('p');
  message.className = 'message';
  message.textContent = text;
  resultsEl.appendChild(message);
}

function render() {
  const terms = normalize(state.query).split(/\s+/).filter(Boolean);

  const matched = songs.filter((song) => {
    if (state.status !== 'all' && song.status !== state.status) return false;
    return terms.every((term) => song.searchText.includes(term));
  });

  sortSongs(matched);
  countEl.textContent = `${matched.length}曲`;

  if (matched.length === 0) {
    showMessage(songs.length === 0 ? '曲が登録されていません' : '該当する曲がありません');
    return;
  }

  const fragment = document.createDocumentFragment();
  matched.forEach((song) => fragment.appendChild(createCard(song)));
  resultsEl.textContent = '';
  resultsEl.appendChild(fragment);
}

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  render();
});

filtersEl.addEventListener('click', (event) => {
  const button = event.target.closest('.chip');
  if (!button) return;
  state.status = button.dataset.status;
  filtersEl.querySelectorAll('.chip').forEach((chip) => {
    const active = chip === button;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  render();
});

sortSelect.addEventListener('change', () => {
  state.sort = sortSelect.value;
  render();
});

async function loadSongs() {
  try {
    const response = await fetch('./songs.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('songs.json is not an array');
    songs = data.map(prepare);
    render();
  } catch (error) {
    console.error(error);
    countEl.textContent = '';
    showMessage(
      location.protocol === 'file:'
        ? 'songs.json を読み込めません。file:// ではなくローカルサーバー(npm start)で開いてください。'
        : 'songs.json を読み込めませんでした。通信状態を確認して再読み込みしてください。'
    );
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('SW registration failed', error));
  });
}

loadSongs();
