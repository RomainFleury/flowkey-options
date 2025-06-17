// TEST

// chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//   const flowTab = tabs.find(t => t.url.includes("app.flowkey.com/player"));
//   if(!flowTab) {
//     console.log("No flowkey tab found");
//     return;
//   }
  mapButtons();
  // console.log("Send message to tab", flowTab.id);
  // sendMessageToTab(flowTab.id, "getSongInfo",handleMessage);

  // sendMessageToTab(flowTab.id, "contentSync", (response) => {
  //   console.log("RESPONSE = ", response);
  // });
// });

function sendMessageToTab(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const flowTab = tabs.find(t => t.url.includes("app.flowkey.com/player"));
    if(!flowTab) {
      console.log("No flowkey tab found");
      return;
    }
    chrome.tabs.sendMessage(flowTab.id, message, callback);
  });
}


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


// API AND HELPER FUNCTIONS

const SYNC_SERVER_URL = "http://localhost:2727/api/generate";

function loadFromStorage(key) {
  return new Promise((resolve) => {
    const content = localStorage.getItem(key);
    resolve(content ? JSON.parse(content) : null);
  });
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function getStoredSongs() {
  return new Promise((resolve) => {
    // chrome.storage.local.get(null, (result) => {
    //   const songs = Object.keys(result).map(key => {
    //     const [title, author, id] = key.split("-");
    //     return { title, author, id };
    //   });
    //   resolve(songs);
    // });
    const songs = Object.keys(localStorage).filter(key => key.includes("-") && key.length > 6).map(key => {
      const content = localStorage.getItem(key);
      return formatSongData(key, JSON.parse(content));
    });
    resolve(songs);
  });
}






////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////

function getSongId(title, author, id) {
  return `${title}-${author}-${id}`;
}

function formatSongData(key, content) {
  const [title, author, id] = key.split("-");
  return { title, author, id, key, content };
}

function syncAllSongs() {
  const syncList = document.getElementById("sync-list");
    syncList.innerHTML = "";
    getStoredSongs().then(songs => {
      console.log("🚀 ~ syncAllSongs ~ songs:", songs);
      songs.forEach(song => {
        const syncItem = document.createElement("li");
        
        const songTitle = document.createElement("h3");
        songTitle.textContent = song.title;
        
        const songAuthor = document.createElement("p");
        songAuthor.textContent = song.author;
        
        const songId = document.createElement("p");
        songId.textContent = song.id;

        const songButton = document.createElement("button");
        songButton.textContent = "Use this song";
        songButton.addEventListener("click", () => {
          console.log("🚀 ~ mapButtons ~ songButton.addEventListener ~ song:", song);
        //  TODO SEND THIS SONG TO THE TAB
          sendSongToTab(song);
        });
        syncItem.appendChild(songTitle);
        syncItem.appendChild(songAuthor);
        syncItem.appendChild(songId);
        syncItem.appendChild(songButton);
        syncList.appendChild(syncItem);
      });
    });
  }

  function sendSongToTab(song) {
    sendMessageToTab({type: "sendSong", song}, (response) => {
      console.log("🚀 ~ sendSongToTab ~ response:", response);
    });
  }


////////////////////////////////////////////////////////
// EVENTS
////////////////////////////////////////////////////////


async function fetchCurrentSongNameAndAuthor() {
  console.log("🚀 ~ fetchCurrentSongNameAndAuthor ~ fetchCurrentSongNameAndAuthor:");
  return new Promise((resolve) => {
    sendMessageToTab({type: "getSongInfo"}, (response) => {
      console.log("🚀 ~ fetchCurrentSongNameAndAuthor ~ sendMessageToTab ~ response:", response);
      document.getElementById("current-song-name").value = response.title;
      document.getElementById("current-song-author").value = response.author;
      document.getElementById("current-song-id").value = response.idFromUrl;
      resolve(response);
  });
  });
}

//callback: (time: number) => void
function onTimeUpdate(callback) { // : () => void
  const video = document.querySelector(".player-video"); //  as HTMLVideoElement
  if (!video) {
    console.warn("[Flowkey Sync] Video element not found");
    return () => {};
  }

  const handler = () => callback(video.currentTime);
  video.addEventListener("timeupdate", handler);

  // Return cleanup function
  return () => video.removeEventListener("timeupdate", handler);
}

async function fetchSyncData(
  title,
  author,
  id
) {
  const cacheKey = getSongId(title, author, id);
  const cached = await loadFromStorage(cacheKey);
  if (cached) {
    console.log("[Flowkey Sync] Loaded from cache");
    return cached;
  }

  const response = await fetch(
    `${SYNC_SERVER_URL}?pieceTitle=${encodeURIComponent(
      title
    )}&composer=${encodeURIComponent(author)}`
  );
  const json = (await response.json());
  await saveToStorage(cacheKey, json);
  console.log("[Flowkey Sync] Fetched from server");
  return json;
}



////////////////////////////////////////////////////////
// BUTTON MAPPING
////////////////////////////////////////////////////////

function mapButtons() {

  document.getElementById("load-current-song-button").addEventListener("click", async () => {
    await fetchCurrentSongNameAndAuthor();
    syncAllSongs();
  });
  
  document.getElementById("fetch-current-song-button").addEventListener("click", async () => {
    await fetchCurrentSongNameAndAuthor();
    syncAllSongs();

    const title = document.getElementById("current-song-name").value;
    const author = document.getElementById("current-song-author").value;
    const id = document.getElementById("current-song-id").value;

    if(!title || !author || !id) {
      console.warn("No song found");
      return;
    }

    await fetchSyncData(title, author, id);
    syncAllSongs();
  });

  document.getElementById("sync-button").addEventListener("click", () => {
    // get all from the storage:
    syncAllSongs();
    // chrome.storage.local.get(null, (result) => {
    //   console.log("🚀 ~ mapButtons ~ chrome.storage.local.get ~ result:", result);
    //   const syncList = document.getElementById("sync-list");
    //   for(const key in result) {
    //     const syncItem = document.createElement("li");
    //     syncItem.textContent = key;
    //     syncList.appendChild(syncItem);
    //   }
    // });
  });
}