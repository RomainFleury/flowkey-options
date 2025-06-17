const pathNameConstraint = /^\/player\/.*/;

const extensionButtonsContainerId = 'flowkey-extension';
const buttonIdPrefix = 'flowkey-extension-button';
const modifiedInfoClass = `${extensionButtonsContainerId}-modified`;
const alwaysVisibleClass = `${extensionButtonsContainerId}-always-visible`;

let currentSong = null;
let currentAction = null;

// THIS CODE IS IN THE WEBSITE

const HIDE_LOGS = false;

function log(...message) {
  if (HIDE_LOGS) {
    return;
  }
  console.log(`🚀 [Flowkey Options Extension] ${message[0]}`, ...message.slice(1));
}

////////////////////////////////////////////////////////
// MESSAGE HANDLING
////////////////////////////////////////////////////////
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

function handleMessage(message, sender, sendResponse) {
  log('handleMessage', message, sender);
  switch (message.type) {
    case 'contentSync':
      contentSync(sendResponse);
      break;
    case 'getSongInfo':
      getSongInfoMessage(sendResponse);
      break;
    case 'sendSong':
      receiveSong(message.song);
      sendResponse({ type: 'songReceived' });
      break;
    case 'displayButtons':
      init();
      break;
    default:
      log('Unknown message type', message.type);
      break;
  }
}

function getSongInfoMessage(sendResponse) {
  const songInfo = getSongInfo();
  log(`getSongInfoMessage ~ songInfo ${JSON.stringify(songInfo, null, 2)}`);
  sendResponse(songInfo);
}

function receiveSong(song) {
  log(`receiveSong ~ song ${JSON.stringify(song, null, 2)}`);
  currentSong = song;
  // inject song in the page
  injectCurrentSong();
}

////////////////////////////////////////////////////////
// VIDEO HANDLING
////////////////////////////////////////////////////////

function getCurrentTime() {
  // player-video-container > .player-video
  const video = document.querySelector('.player-video'); //  as HTMLVideoElement
  if (!video) {
    log('Video element not found');
    return 0;
  }
  const currentTime = video.currentTime;
  registerVideoTimeUpdate((time) => {
    log(`🫣 getCurrentTime ~ time: ${time}`);
    currentTime = time;
  });
  return currentTime;
}

function registerVideoTimeUpdate(callback) {
  const video = document.querySelector('.player-video'); //  as HTMLVideoElement
  if (!video) {
    log('[Flowkey Sync] Video element not found');
    return;
  }
  video.addEventListener('timeupdate', callback);
  return () => video.removeEventListener('timeupdate', callback);
}

////////////////////////////////////////////////////////
// App tools and values
////////////////////////////////////////////////////////

const playerVideoContainerClass = 'player-video-container';
const sheetContainerClass = 'sheet-container';
const tabletControlsClass = 'tablet-controls';
const playAndHandButtonBarClass = 'play-and-hand-button-bar';
const playedCorrectlyFeedbackClass = 'played-correctly-feedback';
const notesNamesClass = 'note-names-container';
const mainControlsClass = 'main-controls';
const songViewInfoContainerClass = 'song-info-view';

function getFirstElementByClassName(className) {
  const potentialElements = document.getElementsByClassName(className);
  const potentialElement = potentialElements.item(0);
  return potentialElement || false;
}

function getPlayerVideoContainer() {
  return getFirstElementByClassName(playerVideoContainerClass);
}

function getSongViewInfoContainer() {
  return getFirstElementByClassName(songViewInfoContainerClass);
}

function getSheetContainer() {
  return getFirstElementByClassName(sheetContainerClass);
}

function getTabletControlsContainer() {
  return getFirstElementByClassName(tabletControlsClass);
}

function getPlayButtonAndHandsContainer() {
  return getFirstElementByClassName(playAndHandButtonBarClass);
}

function getPlayCorrectlyFeedbackContainer() {
  return getFirstElementByClassName(playedCorrectlyFeedbackClass);
}

function getNotesNamesContainer() {
  return getFirstElementByClassName(notesNamesClass);
}

function getMainControlsContainer() {
  return getFirstElementByClassName(mainControlsClass);
}

function resetPlacement() {
  // we use the app management of window resize to reset the values
  const targetWidth = window.outerWidth;
  const targetHeight = window.outerHeight;
  window.resizeTo(targetWidth - 1, targetHeight - 1);
  setTimeout(() => {
    window.resizeTo(targetWidth, targetHeight);
  }, 100);
}

function markModified(elements) {
  elements.forEach((element) => {
    element.classList.add(modifiedInfoClass);
  });
}

function unmarkModified(elements) {
  elements.forEach((element) => {
    element.classList.remove(modifiedInfoClass);
  });
}

function anyHaveBeenModified(elements) {
  return elements.some((element) => {
    return element.classList.contains(modifiedInfoClass);
  });
}

////////////////////////////////////////////////////////
// Standard html tools
////////////////////////////////////////////////////////
function addButton(container, name, label, title, onclick) {
  const button = document.createElement('button');
  button.setAttribute('name', name);
  button.setAttribute('title', title);
  button.classList.add(`${buttonIdPrefix}`);
  button.setAttribute('id', `${buttonIdPrefix}-${name}`);
  button.innerHTML = label;
  button.addEventListener('click', () => {
    onclick();
  });
  container.insertAdjacentElement('beforeend', button);
}

// IT ONLY WORKS IF THE EXTENSION IS OPEN, SO ITS SHIT.
// function askForSong() {
//   chrome.runtime.sendMessage({type: "canIGetSongInfoPlease", songInfo: getSongInfo()});
// }

////////////////////////////////////////////////////////
// Song and data handling
////////////////////////////////////////////////////////

function getSongInfo() {
  // : { title: string; author: string } | null
  const songInfoView = document.querySelector('.song-info-view');
  if (!songInfoView) return null;

  const author = songInfoView.querySelector('span')?.textContent || '';
  const title = songInfoView.querySelector('h4')?.textContent || '';
  const idFromUrl = window.location.href.split('/').pop();

  log('[Flowkey Sync] Song info', { title, author, idFromUrl });
  return { title, author, idFromUrl };
}

////////////////////////////////////////////////////////
// OTHER HTML TOOLS
////////////////////////////////////////////////////////

function createSongInfoContainer() {
  const songInfo = document.createElement('div');
  songInfo.setAttribute('id', 'song-info-container');
  songInfo.style.position = 'absolute';
  songInfo.style.zIndex = '1';
  songInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  songInfo.style.borderRadius = '1rem';
  songInfo.style.padding = '1rem';
  songInfo.style.margin = '1rem';
  songInfo.style.fontSize = '0.8rem';
  songInfo.style.position = 'absolute';
  songInfo.style.top = '96px';
  songInfo.style.overflow = 'hidden';
  songInfo.style.opacity = '0';
  songInfo.style.transition = 'opacity 0.3s ease-in-out';
  if (!currentSong) {
    songInfo.innerHTML = '';
    return songInfo;
  }
  songInfo.innerHTML = `
    <p><b><u>Author Notes</u></b>: ${currentSong.content.author_notes} <i>(${currentSong.content.author_notes_source})</i></p>
    <p><b><u>Context</u></b>: ${currentSong.content.historical_context}</p>
    <p><b><u>Historical Anecdote</u></b>: ${currentSong.content.historical_anecdote} <i>(${currentSong.content.historical_anecdote_source})</i></p>
  `;
  return songInfo;
}

function createSongButtonsContainer() {
  const songButtonsContainer = document.createElement('div');
  songButtonsContainer.setAttribute('id', 'song-buttons-container');
  songButtonsContainer.style.display = 'flex';
  songButtonsContainer.style.flexDirection = 'row';
  songButtonsContainer.style.gap = '1rem';
  songButtonsContainer.style.top = '96px';
  songButtonsContainer.style.right = '0';
  songButtonsContainer.style.zIndex = '1';
  songButtonsContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
  songButtonsContainer.style.borderRadius = '1rem';
  return songButtonsContainer;
}

function getSongInfoContainer() {
  return document.getElementById('song-info-container');
}

function toggleSongInfo() {
  const songInfoContainer = getSongInfoContainer();
  const toggleSongButton = document.getElementById('toggle-song');
  log(`toggleSongInfo`);
  if (songInfoContainer.style.opacity === '0') {
    log('SHOW');
    toggleSongButton.innerHTML = '🧯 Hide infos';
    songInfoContainer.style.opacity = '1';
  } else {
    log('HIDE');
    toggleSongButton.innerHTML = '🔥 Show infos';
    songInfoContainer.style.opacity = '0';
  }
}

function injectSongContainer() {
  const mainContainer = document.querySelector('.flowkey-player');
  if (!mainContainer) {
    return;
  }
  if (!currentSong) {
    if (document.querySelector('#song-info-container')) {
      document.querySelector('#song-info-container').remove();
    }
    return;
  }
  const songInfoContainer = createSongInfoContainer();
  mainContainer.appendChild(songInfoContainer);

  // Buttons to hide and show song info
  const songButtonsContainer = createSongButtonsContainer();
  const buttonToggleSong = createButtonToggleSong();
  songButtonsContainer.appendChild(buttonToggleSong);

  const songViewInfoContainer = getSongViewInfoContainer();
  songViewInfoContainer.parentElement.insertBefore(songButtonsContainer, songViewInfoContainer);
}

function injectCurrentSong() {
  injectSongContainer();
  const songInfoContainer = getSongInfoContainer();
  if (!songInfoContainer) {
    return;
  }
  songInfoContainer.innerHTML = `
    <p><b><u>Author Notes</u></b>: ${currentSong.content.author_notes} <i>(${currentSong.content.author_notes_source})</i></p>
    <p><b><u>Context</u></b>: ${currentSong.content.historical_context}</p>
    <p><b><u>Historical Anecdote</u></b>: ${currentSong.content.historical_anecdote} <i>(${currentSong.content.historical_anecdote_source})</i></p>
  `;
}

function createButtonToggleSong() {
  const button = document.createElement('button');
  button.setAttribute('id', 'toggle-song');
  button.innerHTML = '🔥 Show infos';
  button.addEventListener('click', toggleSongInfo);
  return button;
}

////////////////////////////////////////////////////////
// Buttons setup in the standard buttons bar
////////////////////////////////////////////////////////

function addButtonReverse(container) {
  addButton(container, 'reverse', '&#8593; &#8595;', 'Invert sheet and piano', () => {
    const sheet = getSheetContainer();
    const player = getPlayerVideoContainer();
    const tabletControls = getTabletControlsContainer();
    const playCorrectlyFeedback = getPlayCorrectlyFeedbackContainer();
    const notesNames = getNotesNamesContainer();
    if (!sheet || !player || !tabletControls || !playCorrectlyFeedback || !notesNames) {
      return;
    }
    const elementsList = [player, sheet, tabletControls, playCorrectlyFeedback, notesNames];
    if (anyHaveBeenModified(elementsList)) {
      resetPlacement();
      unmarkModified(elementsList);
      return;
    }

    // we need to replace the elements using css to keep compatilibity with original behavior
    // those calculations are crap
    sheet.style.top = `${player.offsetTop - tabletControls.clientHeight}px`;
    sheet.style.height = `${sheet.clientHeight + tabletControls.clientHeight}px`;
    playCorrectlyFeedback.style.top = `${player.offsetTop - tabletControls.clientHeight}px`;
    tabletControls.style.top = `${sheet.offsetTop + sheet.clientHeight}px`;

    const originalPlayerTop = player.offsetTop;
    player.style.top = `${sheet.offsetTop + sheet.clientHeight}px`;
    notesNames.style.top = `${player.offsetTop - originalPlayerTop}px`;

    markModified(elementsList);
  });
}

function addButtonAlwaysVisible(container) {
  addButton(container, 'always-visible', '&#128274;', 'Keep controls visible', () => {
    const mainControls = getMainControlsContainer();
    if (!mainControls) {
      return;
    }
    mainControls.classList.toggle(alwaysVisibleClass);
  });
}

////////////////////////////////////////////////////////
// Add all buttons init method
////////////////////////////////////////////////////////
function addButtons() {
  const container = getPlayButtonAndHandsContainer();
  if (!container) {
    return;
  }
  const buttonsContainer = document.createElement('div');
  buttonsContainer.setAttribute('id', extensionButtonsContainerId);
  container.insertAdjacentElement('beforeend', buttonsContainer);

  // works okay-ish
  addButtonReverse(buttonsContainer);

  // Does not work very well
  addButtonAlwaysVisible(buttonsContainer);

  // adds master mode button
  // button that sets video to opacity 0

  unsubscribeFromEvents();
}

////////////////////////////////////////////////////////
// Global init
////////////////////////////////////////////////////////
function init() {
  log('🚀 ~ init ~ init');
  if (currentAction === 'init') {
    return;
  }
  currentAction = 'init';
  if (!window || !window.location) {
    currentAction = null;
    console.info('No window or location found');
    return;
  }
  if (!pathNameConstraint.test(window.location.pathname)) {
    currentAction = null;
    console.info('Not playing');
    return;
  }
  if (document.getElementById(extensionButtonsContainerId)) {
    console.info('Buttons already present.');
    unsubscribeFromEvents();
    return;
  }
  setTimeout(() => {
    addButtons();
    // askForSong(); // only works if the extension is open, so its shit.
  }, 1000);
}

function doWhenReady(callback) {
  if (currentAction === 'lazyInit') {
    return;
  }
  currentAction = 'lazyInit';
  const interval = setInterval(() => {
    if (currentAction === 'canplay') {
      log('🚀 ~ doWhenReady ~ canplay');
      return;
    }
    if (!document.querySelector('.play-button')) {
      log('🚀 ~ doWhenReady ~ play-button not found');
      return;
    }
    if (document.querySelector('.player-video-container')) {
      log('🚀 ~ doWhenReady ~ player-video-container found');
      const video = document.querySelector('.player-video-container > .player-video');
      if (video) {
        currentAction = 'canplay';
        log('🚀 ~ doWhenReady ~ player-video-container video itself found');
        video.addEventListener('canplay', () => {
          log('🚀 ~ doWhenReady ~ canplay');
          callback();
          clearInterval(interval);
        });
        clearInterval(interval);
      }
    }
  }, 500);
}

function lazyInit() {
  log('🚀 ~ lazyInit');
  currentAction = 'lazyInit';

  setTimeout(() => {
    doWhenReady(init);
  }, 1000);
}

function unsubscribeFromEvents() {
  ['click', 'pageshow'].forEach((eventName) => {
    window.removeEventListener(eventName, lazyInit);
  });
}

['click', 'pageshow'].forEach((eventName) => {
  window.addEventListener(eventName, lazyInit);
});
