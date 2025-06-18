const pathNameConstraint = /^\/player\/.*/;

const extensionButtonsContainerId = 'flowkey-extension';
const buttonIdPrefix = 'flowkey-extension-button';
const modifiedInfoClass = `${extensionButtonsContainerId}-modified`;
const alwaysVisibleClass = `${extensionButtonsContainerId}-always-visible`;

const playHintsContainerId = 'play-hints-container';
const songInfoContainerId = 'song-info-container';
const toggleSongInfoButtonId = 'toggle-song';
const togglePlayingHintsButtonId = 'toggle-play-hints';
const songButtonsContainerId = 'song-buttons-container';

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

function registerVideoTimeUpdate() {
  const video = document.querySelector('.player-video'); //  as HTMLVideoElement
  if (!video) {
    log('[Flowkey Sync] Video element not found');
    return;
  }
  video.addEventListener('timeupdate', updatePlayHint);
  return () => video.removeEventListener('timeupdate', updatePlayHint);
}

// function registerVideoTimeUpdate() {
//   const video = document.querySelector('.player-video');
//   if (!video) {
//     log('Video element not found');
//     return;
//   }
//   video.addEventListener('timeupdate', );
// }

function updatePlayHint(event) {
  try {
    console.log('updatePlayHint');
    const playHintsContainer = getPlayingHintsContainer();
    log(`updatePlayHint ~ event: ${event}`);
    const video = document.querySelector('.player-video');
    if (!video) {
      log('Video element not found');
      return;
    }
    const currentTime = video.currentTime;
    log(`updatePlayHint ~ currentTime: ${currentTime}`);
    const section = getPlayingHintsSection(currentTime);
    if (section && playHintsContainer) {
      playHintsContainer.innerHTML = `Current time: ${currentTime}
${formatSection(section)}`;
    }
  } catch (error) {
    log(`updatePlayHint ~ error: ${error}`);
  }
}

function getPlayingHintsSection(currentTime) {
  if (!currentSong) {
    return undefined;
  }
  // "movements": [
  //     {
  //       "movement": "Single Movement Ballad",
  //       "tempo": "Slow (♩ = ~63 BPM)",
  //       "sections": [
  //         {
  //           "name": "Intro",
  //           "measures": [1, 4],
  //           "timing": "0:00–0:15",
  //           "start_time_sec": 0,
  //           "end_time_sec": 15,
  //           "dynamics": "mp",
  //           "texture": "Homophonic",
  //           "description": "A solo piano introduces the harmonic progression that underpins the entire song.",
  //           "interpretation": "Establishes the intimate and reflective mood of the piece.",
  //           "lyrics": null
  //         },
  //         {
  if (currentSong.content.movements.length === 0) {
    return undefined;
  }
  const currentTimeInSeconds = Math.floor(currentTime);
  log(`Current time: ${currentTime} (${currentTimeInSeconds})`);
  // if we don't find in first movement, we look in the next one

  const currentSection = currentSong.content.movements.reduce((foundSection, movement) => {
    return (
      foundSection ||
      movement.sections.find((section) => {
        return currentTimeInSeconds >= section.start_time_sec && currentTimeInSeconds <= section.end_time_sec;
      })
    );
  }, undefined);
  log(`getPlayingHintsSection ~ section: ${JSON.stringify(currentSection, null, 2)}`);
  if (!currentSection) {
    return undefined;
  }

  return currentSection;
}

////////////////////////////////////////////////////////
// App tools and values
////////////////////////////////////////////////////////

const flowkeyPlayerClass = 'flowkey-player';
const playerVideoContainerClass = 'player-video-container';
const sheetContainerClass = 'sheet-container';
const tabletControlsClass = 'tablet-controls';
const playAndHandButtonBarClass = 'play-and-hand-button-bar';
const playedCorrectlyFeedbackClass = 'played-correctly-feedback';
const notesNamesClass = 'note-names-container';
const mainControlsClass = 'main-controls';
const songViewInfoContainerClass = 'song-info-view';
const playButtonClass = 'play-button';
const playerVideoClass = 'player-video';

function getFirstElementByClassName(className) {
  const potentialElements = document.getElementsByClassName(className);
  const potentialElement = potentialElements.item(0);
  return potentialElement || false;
}

function getFlowkeyPlayerContainer() {
  return getFirstElementByClassName(flowkeyPlayerClass);
}

function getPlayerVideoContainer() {
  return getFirstElementByClassName(playerVideoContainerClass);
}

function getPlayerVideo() {
  return getFirstElementByClassName(playerVideoClass);
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

// IT ONLY WORKS IF THE EXTENSION IS OPEN, SO ITS SHIT.
// function askForSong() {
//   chrome.runtime.sendMessage({type: "canIGetSongInfoPlease", songInfo: getSongInfo()});
// }

////////////////////////////////////////////////////////
// Song and data handling
////////////////////////////////////////////////////////

function getSongInfo() {
  const songInfoView = document.querySelector('.song-info-view');
  if (!songInfoView) return null;

  const author = songInfoView.querySelector('span')?.textContent || '';
  const title = songInfoView.querySelector('h4')?.textContent || '';
  const idFromUrl = window.location.href.split('/').pop();

  const measuresCount = 0;
  log(`Duration: ${document.querySelector('.player-video')?.duration}`);
  const lengthInSeconds = document.querySelector('.player-video')?.duration || 0;
  const sheetContainer = getFirstElementByClassName('sheet-container');
  const lastTwoSheets = Array.from(sheetContainer.querySelectorAll('.sheet-image')).reverse().slice(0, 2);
  const lastSheets = lastTwoSheets.map((sheetElement) => {
    return sheetElement.style.backgroundImage.split('url(')[1].split(')')[0].replaceAll(/\"/g, '').trim();
  });

  log(`lastTwoSheets: ${JSON.stringify(lastSheets, null, 2)}`);
  log('[Flowkey Sync] Song info', {
    title,
    author,
    idFromUrl,
    measuresCount,
    lengthInSeconds,
    lastSheets,
  });
  return { title, author, idFromUrl, measuresCount, lengthInSeconds, lastSheets };
}

////////////////////////////////////////////////////////
// OTHER HTML TOOLS
////////////////////////////////////////////////////////

function getSongInfoContainer() {
  return document.getElementById(songInfoContainerId);
}

function createSongInfoContainer() {
  const existingSongInfoContainer = getSongInfoContainer();
  if (existingSongInfoContainer) {
    existingSongInfoContainer.remove();
  }

  const songInfo = document.createElement('div');
  songInfo.setAttribute('id', songInfoContainerId);
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

function getSongButtonsContainer() {
  return document.getElementById(songButtonsContainerId);
}

function createSongButtonsContainer() {
  const existingSongButtonsContainer = getSongButtonsContainer();
  if (existingSongButtonsContainer) {
    existingSongButtonsContainer.remove();
  }
  const songButtonsContainer = document.createElement('div');
  songButtonsContainer.setAttribute('id', songButtonsContainerId);
  songButtonsContainer.style.display = 'flex';
  songButtonsContainer.style.flexDirection = 'row';
  songButtonsContainer.style.gap = '1rem';
  songButtonsContainer.style.top = '96px';
  songButtonsContainer.style.right = '0';
  songButtonsContainer.style.zIndex = '1';
  songButtonsContainer.style.alignItems = 'center';
  return songButtonsContainer;
}

const buttonActiveStyles = {
  backgroundColor: 'var(--main-color)',
  color: 'white',
};

const buttonInactiveStyles = {
  backgroundColor: 'rgba(255, 255, 255, 1)',
  color: 'var(--main-color)',
};

const songButtonsStyles = {
  ...buttonInactiveStyles,
  borderRadius: '1rem',
  border: '1px solid var(--main-color)',
  height: '32px',
  width: '32px',
  fontSize: '1rem',
  cursor: 'pointer',
};

function getPlayingHintsContainer() {
  return document.getElementById(playHintsContainerId);
}

function createPlayingHintsContainer() {
  const existingPlayHintsContainer = getPlayingHintsContainer();
  if (existingPlayHintsContainer) {
    existingPlayHintsContainer.remove();
  }
  const playHintsContainer = document.createElement('div');
  playHintsContainer.setAttribute('id', playHintsContainerId);
  playHintsContainer.style.position = 'absolute';
  playHintsContainer.style.zIndex = '1';
  playHintsContainer.style.opacity = '0';
  playHintsContainer.style.transition = 'opacity 0.3s ease-in-out';
  playHintsContainer.style.top = '100px';
  playHintsContainer.innerHTML = '';
  return playHintsContainer;
}

function toggleSongInfo() {
  const songInfoContainer = getSongInfoContainer();
  const toggleSongButton = document.getElementById(toggleSongInfoButtonId);
  log(`toggleSongInfo`);
  if (songInfoContainer.style.opacity === '0') {
    log('SHOW');
    Object.assign(toggleSongButton.style, buttonActiveStyles);
    songInfoContainer.style.opacity = '1';
  } else {
    log('HIDE');
    Object.assign(toggleSongButton.style, buttonInactiveStyles);
    songInfoContainer.style.opacity = '0';
  }
}

function togglePlayingHints() {
  const playHintsContainer = getPlayingHintsContainer();
  const togglePlayingHintsButton = document.getElementById(togglePlayingHintsButtonId);
  log(`togglePlayingHints`);
  if (playHintsContainer.style.opacity === '0') {
    log('SHOW');
    Object.assign(togglePlayingHintsButton.style, buttonActiveStyles);
    playHintsContainer.style.opacity = '1';
  } else {
    log('HIDE');
    Object.assign(togglePlayingHintsButton.style, buttonInactiveStyles);
    playHintsContainer.style.opacity = '0';
  }
}

function injectSongContainer() {
  const mainContainer = getFlowkeyPlayerContainer();
  if (!mainContainer) {
    return;
  }
  if (!currentSong) {
    return;
  }

  // clean up existing song info container

  const songInfoContainer = createSongInfoContainer();
  mainContainer.appendChild(songInfoContainer);

  const playHintsContainer = createPlayingHintsContainer();
  mainContainer.appendChild(playHintsContainer);

  // Buttons to hide and show song info and play hints
  const songButtonsContainer = createSongButtonsContainer();
  const buttonToggleSong = createButtonToggleSongInfo();
  const buttonTogglePlayingHints = createButtonTogglePlayingHints();
  songButtonsContainer.appendChild(buttonToggleSong);
  songButtonsContainer.appendChild(buttonTogglePlayingHints);

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
    <p><span style="font-weight: bold; text-decoration: underline">Author Notes</span>: ${currentSong.content.author_notes} <span style="font-style: italic">(${currentSong.content.author_notes_source})</span></p>
    <p><span style="font-weight: bold; text-decoration: underline">Context</span>: ${currentSong.content.historical_context}</p>
    <p><span style="font-weight: bold; text-decoration: underline">Historical Anecdote</span>: ${currentSong.content.historical_anecdote} <span style="font-style: italic">(${currentSong.content.historical_anecdote_source})</span></p>
  `;
}

function createButtonToggleSongInfo() {
  const button = document.createElement('button');
  button.setAttribute('id', toggleSongInfoButtonId);
  button.innerHTML = '&#8505;';
  button.addEventListener('click', toggleSongInfo);
  Object.assign(button.style, songButtonsStyles);
  return button;
}

function createButtonTogglePlayingHints() {
  const button = document.createElement('button');
  button.setAttribute('id', togglePlayingHintsButtonId);
  button.innerHTML = '👯';
  button.addEventListener('click', togglePlayingHints);
  Object.assign(button.style, songButtonsStyles);
  return button;
}

function formatSection(section) {
  return `
    <h3>${section.name} (${section.timing})</h3>
    <p>Dynamics: ${section.dynamics}</p>
    <p>Texture: ${section.texture}</p>
    <p>Description: ${section.description}</p>
    <p>Interpretation: ${section.interpretation}</p>
    ${section.lyrics ? `<p>Lyrics: ${section.lyrics}…</p>` : ''}
  `;
}

////////////////////////////////////////////////////////
// Buttons setup in the standard buttons bar
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
    registerVideoTimeUpdate();
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
    if (!getPlayerVideo()) {
      log('🚀 ~ doWhenReady ~ play-button not found');
      return;
    }
    if (getPlayerVideoContainer()) {
      log('🚀 ~ doWhenReady ~ player-video-container found');
      const video = getPlayerVideo();
      if (video) {
        currentAction = 'canplay';
        log('🚀 ~ doWhenReady ~ player-video-container video itself found');
        video.addEventListener('canplay', () => {
          log('🚀 ~ doWhenReady ~ canplay');
          callback();
          clearInterval(interval);
        });
        clearInterval(interval);
        video.addEventListener('timeupdate', updatePlayHint);
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
  setTimeout(() => {
    ['click', 'pageshow'].forEach((eventName) => {
      window.removeEventListener(eventName, lazyInit);
    });
  }, 10000);
}

['click', 'pageshow'].forEach((eventName) => {
  window.addEventListener(eventName, lazyInit);
});
