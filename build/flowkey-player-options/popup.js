////////////////////////////////////////////////////////
// CONSTANTS
////////////////////////////////////////////////////////

const SYNC_SERVER_URL = 'http://localhost:2727/api/generate';
const HIDE_LOGS = false;
const LOG_LEVEL = HIDE_LOGS ? 'toast' : 'debug';

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

function logMessage(message, priority = 'toast') { // info, debug
  if (LOG_LEVEL === 'toast' && priority === 'debug') {
    return;
  }
  if (LOG_LEVEL === 'toast' || !message) {
    return;
  }
  console.log(`🚀 [Flowkey Options] ${message}`);

  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100); // Small delay to allow CSS transition

  // Hide and remove the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 3000);
}

function currentSongFromForm() {
  const title = document.getElementById('current-song-name').value;
  const author = document.getElementById('current-song-author').value;
  const id = document.getElementById('current-song-id').value;
  const measuresCount = document.getElementById('current-song-measures-count').value;
  const lengthInSeconds = document.getElementById('current-song-length-in-seconds').value;
  if (!title || !author || !id) {
    return null;
  }
  return {
    title,
    author,
    id,
    measuresCount,
    lengthInSeconds,
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

async function sendCurrentSongIfAvailable(song) {
  const currentSong = song || currentSongFromForm();
  if (currentSong) {
    await fetchSyncData(currentSong.title, currentSong.author, currentSong.id);
    sendSongToTab(currentSong);
  }
}

async function fetchJsonAndSendToTab(songInfo) {
  const completeInfo = await fetchSyncData(songInfo.title, songInfo.author, songInfo.idFromUrl);
  sendSongToTab(completeInfo);
  syncAllSongs();
}

async function fetchCurrentSongNameAndAuthor() {
  loading(true);
  logMessage('Fetching current song name and author');
  return new Promise((resolve) => {
    sendMessageToTab({ type: 'getSongInfo' }, (response) => {
      if (!response) {
        logMessage('🙏 No song info received');
        return;
      }
      logMessage(`Received song info: ${response.title} - ${response.author} - ${response.idFromUrl}`);
      document.getElementById('current-song-name').value = response.title;
      document.getElementById('current-song-author').value = response.author;
      document.getElementById('current-song-id').value = response.idFromUrl;
      document.getElementById('current-song-measures-count').value = response.measuresCount;
      document.getElementById('current-song-length-in-seconds').value = response.lengthInSeconds;
      document.getElementById('last-sheets').innerHTML = '';
      response.lastSheets.reverse().forEach((sheetImageUrl) => {
        const img = document.createElement('img');
        img.src = sheetImageUrl;
        img.classList.add('sheet');
        document.getElementById('last-sheets').appendChild(img);
      });
      document.getElementById('current-song-container').classList.remove('hidden');
      highlightCurrentSong(response.idFromUrl);
      loading(false);
      resolve(response);
    });
  });
}

async function fetchSyncData(title, author, id, measuresCount, lengthInSeconds) {
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
    `${SYNC_SERVER_URL}?pieceTitle=${encodeURIComponent(title)}&composer=${encodeURIComponent(
      author,
    )}&measuresCount=${encodeURIComponent(measuresCount)}&lengthInSeconds=${encodeURIComponent(
      lengthInSeconds,
    )}&instrumentVariant=${encodeURIComponent('A piano solo by Flowkey')}`,
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
  fetchCurrentSongNameAndAuthor().then(() => {
    syncAllSongs();
  });
  syncAllSongs();
}

////////////////////////////////////////////////////////
// HTML HELPERS
////////////////////////////////////////////////////////

////////////////////////////////////////////////////////
// SONGS LIST

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

  // Load button
  const loadButtonCell = document.createElement('td');
  const loadButton = document.createElement('button');
  loadButton.title = `Load ${song.title}`;
  loadButton.classList.add('icon-button');
  loadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>`;
  loadButton.addEventListener('click', () => {
    sendSongToTab(song);
  });
  loadButtonCell.appendChild(loadButton);
  row.appendChild(loadButtonCell);

  // Download button
  const downloadButtonCell = document.createElement('td');
  const downloadButton = document.createElement('button');
  downloadButton.title = `Download ${song.title}`;
  downloadButton.classList.add('icon-button');
  downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`;
  downloadButton.addEventListener('click', (e) => {
    downloadSong(song);
  });
  downloadButtonCell.appendChild(downloadButton);
  row.appendChild(downloadButtonCell);

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

function downloadSong(song) {
  const json = JSON.stringify(song, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${song.title} - ${song.author} - ${song.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  logMessage('Song downloaded');
}

function highlightCurrentSong(id) {
  document.querySelectorAll(`.current-song`).forEach((row) => {
    row.classList.remove('current-song');
  });
  const currentSong = currentSongFromForm();
  if (!currentSong && !id) {
    return;
  }
  const row = document.querySelector(`tr[data-id="${id || currentSong.id}"]`);
  row?.classList.add('current-song');
  sendCurrentSongIfAvailable(currentSong);
}
////////////////////////////////////////////////////////

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

    await fetchSyncData(
      currentSong.title,
      currentSong.author,
      currentSong.id,
      currentSong.measuresCount,
      currentSong.lengthInSeconds,
    );
    syncAllSongs();
    highlightCurrentSong(currentSong.id);
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
