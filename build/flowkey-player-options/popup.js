////////////////////////////////////////////////////////
// CONSTANTS
////////////////////////////////////////////////////////

const SYNC_SERVER_URL = 'http://localhost:2727/api/generate';
const HIDE_LOGS = true;

// function handleMessageResponse(message, sender, sendResponse) {
//   console.log("🚀 ~ handleMessageResponse ~ sendResponse:", sendResponse);
//   console.log("🚀 ~ handleMessageResponse ~ message:", message);
//   console.log("🚀 ~ handleMessageResponse ~ function handleMessageResponse(message, sender, sendResponse) {:", sendResponse);
//   if(message.type === "getSongInfo") {
//     const songInfo = getSongInfo();
//     sendResponse({ songInfo });
//   }
// }

// THIS CODE IS IN THE POPUP

////////////////////////////////////////////////////////
// API AND HELPER FUNCTIONS
////////////////////////////////////////////////////////

function loadFromStorage(key) {
  const content = localStorage.getItem(key);
  return content ? JSON.parse(content) : null;
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getStoredSongs() {
  return Object.keys(localStorage)
    .filter((key) => key.includes('-') && key.length > 6)
    .map((key) => {
      return loadFromStorage(key);
    });
}

////////////////////////////////////////////////////////
// MESSAGE HANDLING
////////////////////////////////////////////////////////

// this is a bit stupid because it can't happen when the extension is closed
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   console.log("🚀 ~ chrome.runtime.onMessage.addListener ~ message:", message);
//   handleMessage(message, sender, sendResponse);
//   return true;
// });

// function handleMessage(message, sender, sendResponse) {
//   if(message.type === "canIGetSongInfoPlease") {
//     fetchJsonAndSendToTab(message.songInfo);
//   }
// }

function sendMessageToTab(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const flowTab = tabs.find((t) => t.url.includes('app.flowkey.com/player'));
    if (!flowTab) {
      console.log('No flowkey tab found');
      logMessage('No flowkey tab found');
      return;
    }
    chrome.tabs.sendMessage(flowTab.id, message, callback);
  });
}

function sendSongToTab(song) {
  logMessage(`Sending song to tab: ${song.title} - ${song.author} - ${song.id}`);
  sendMessageToTab({ type: 'sendSong', song }, (response) => {
    logMessage(`Song sent to tab`);
  });
}

////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////

function logMessage(message) {
  console.log(`🚀 [Flowkey Options] ${message}`);
  if (HIDE_LOGS) {
    return;
  }
  const messages = document.getElementById('messages');
  messages.textContent = message;
  messages.classList.remove('fadeout');
  setTimeout(() => {
    messages.classList.add('fadeout');
  }, 3000);
}

function currentSongFromForm() {
  const title = document.getElementById('current-song-name').value;
  const author = document.getElementById('current-song-author').value;
  const id = document.getElementById('current-song-id').value;
  if (!title || !author || !id) {
    return null;
  }
  return {
    title,
    author,
    id,
  };
}

function getSongId(title, author, id) {
  return `${title}-${author}-${id}`;
}

function formatSongData(key, content) {
  const [title, author, id] = key.split('-');
  return { title, author, id, key, content };
}

function syncAllSongs() {
  const syncList = document.getElementById('sync-list');
  syncList.innerHTML = '';
  getStoredSongs().forEach((song) => {
    const syncItem = createTableRow(song);
    syncList.appendChild(syncItem);
  });
  highlightCurrentSong();
}

function loading(active) {
  if (active) {
    document.getElementById('fetch-current-song-button').disabled = true;
    document.getElementById('song-loader').classList.remove('hidden');
  } else {
    document.getElementById('fetch-current-song-button').disabled = false;
    document.getElementById('song-loader').classList.add('hidden');
  }
}

////////////////////////////////////////////////////////
// ACTUAL ACTIONS
////////////////////////////////////////////////////////

async function fetchJsonAndSendToTab(songInfo) {
  const completeInfo = await fetchSyncData(songInfo.title, songInfo.author, songInfo.idFromUrl);
  sendSongToTab(completeInfo);
  syncAllSongs();
}

async function fetchCurrentSongNameAndAuthor() {
  logMessage('Fetching current song name and author');
  return new Promise((resolve) => {
    sendMessageToTab({ type: 'getSongInfo' }, (response) => {
      logMessage(`Received song info: ${response.title} - ${response.author} - ${response.idFromUrl}`);
      document.getElementById('current-song-name').value = response.title;
      document.getElementById('current-song-author').value = response.author;
      document.getElementById('current-song-id').value = response.idFromUrl;
      document.getElementById('current-song-container').classList.remove('hidden');
      resolve(response);
    });
  });
}

async function fetchSyncData(title, author, id) {
  loading(true);
  logMessage(`Fetching sync data for: ${title} - ${author} - ${id}`);
  const cacheKey = getSongId(title, author, id);
  const cached = loadFromStorage(cacheKey);
  if (cached) {
    logMessage(`Loaded from cache: ${title} - ${author} - ${id}`);
    loading(false);
    return cached;
  }

  const response = await fetch(
    `${SYNC_SERVER_URL}?pieceTitle=${encodeURIComponent(title)}&composer=${encodeURIComponent(author)}`,
  );
  const RAW_JSON = await response.json();
  const formatted = formatSongData(cacheKey, RAW_JSON);
  saveToStorage(cacheKey, formatted);
  logMessage(`Fetched from server: ${title} - ${author} - ${id}`);
  console.log('[Flowkey Sync] Fetched from server');
  loading(false);
  return formatted;
}

function autoLoadCurrentSong() {
  fetchCurrentSongNameAndAuthor();
  syncAllSongs();
}

////////////////////////////////////////////////////////
// HTML HELPERS
////////////////////////////////////////////////////////

function createTableRow(song) {
  const row = document.createElement('tr');
  row.setAttribute('data-id', song.id);
  const title = document.createElement('td');
  title.title = song.id;
  title.textContent = song.title;
  row.appendChild(title);
  const author = document.createElement('td');
  author.textContent = song.author;
  row.appendChild(author);
  const loadButton = document.createElement('td');
  loadButton.classList.add('load-button');
  const button = document.createElement('button');
  button.textContent = 'Load';
  button.addEventListener('click', () => {
    sendSongToTab(song);
  });
  loadButton.appendChild(button);
  row.appendChild(loadButton);
  return row;
}

function downloadAllSongs() {
  const songs = getStoredSongs();
  const json = JSON.stringify(songs);
  const blob = new Blob([json], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  console.log('🚀 ~ downloadAllSongs ~ href:', href);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'songs.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  logMessage('Songs downloaded');
}

function highlightCurrentSong() {
  document.querySelectorAll(`.current-song`).forEach((row) => {
    row.classList.remove('current-song');
  });
  const currentSong = currentSongFromForm();
  if (!currentSong) {
    return;
  }
  const row = document.querySelector(`tr[data-id="${currentSong.id}"]`);
  if (row) {
    row.classList.add('current-song');
  }
}

////////////////////////////////////////////////////////
// BUTTON MAPPING
////////////////////////////////////////////////////////

function mapButtons() {
  document.getElementById('load-current-song-button').addEventListener('click', async () => {
    await fetchCurrentSongNameAndAuthor();
    syncAllSongs();
  });

  document.getElementById('fetch-current-song-button').addEventListener('click', async () => {
    const currentSong = currentSongFromForm();
    if (!currentSong) {
      logMessage('No song found');
      return;
    }

    await fetchSyncData(currentSong.title, currentSong.author, currentSong.id);
    syncAllSongs();
  });

  document.getElementById('sync-button').addEventListener('click', () => {
    // get all from the storage:
    syncAllSongs();
  });

  document.getElementById('download-all-songs-button').addEventListener('click', () => {
    downloadAllSongs();
  });
}

(() => {
  sendMessageToTab({ type: 'displayButtons' }, () => {});
  mapButtons();
  fetchCurrentSongNameAndAuthor();
  syncAllSongs();
  document.addEventListener('focus', () => {
    fetchCurrentSongNameAndAuthor();
  });
})();
