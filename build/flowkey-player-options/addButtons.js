////////////////////////////////////////////////////////
// CONSTANTS AND CONFIGURATION
////////////////////////////////////////////////////////

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
const statusDotId = 'status-dot';

// State management system
const EXTENSION_STATES = {
  // Initial/Error states
  UNINITIALIZED: { name: 'Uninitialized', color: 'red', description: 'Extension not loaded or error occurred' },
  ERROR: { name: 'Error', color: 'darkred', description: 'An error has occurred' },

  // Page detection states
  PAGE_CHANGE_DETECTED: {
    name: 'Page Change Detected',
    color: 'purple',
    description: 'Navigation to new page detected',
  },
  NOT_SONG_PAGE: { name: 'Not Song Page', color: 'gray', description: 'Current page is not a song player page' },

  // Loading/Initialization states
  LOADING: { name: 'Loading', color: 'yellow', description: 'Extension is loading and initializing' },
  INITIALIZING: { name: 'Initializing', color: 'orange', description: 'Setting up extension components' },

  // Ready states
  READY: { name: 'Ready', color: 'lightgreen', description: 'Extension is ready and waiting for song data' },
  INITIALIZED: { name: 'Initialized', color: 'green', description: 'Extension fully initialized with buttons' },

  // Song data states
  SONG_LOADING: { name: 'Song Loading', color: 'blue', description: 'Loading song data from server' },
  SONG_LOADED: { name: 'Song Loaded', color: 'lightblue', description: 'Song data loaded and displayed' },

  // Playback states
  PLAYING: { name: 'Playing', color: 'cyan', description: 'Song is currently playing' },
  PAUSED: { name: 'Paused', color: 'pink', description: 'Song is paused' },

  // Reset states
  RESETTING: { name: 'Resetting', color: 'coral', description: 'Extension state is being reset' },
  RESET_COMPLETE: { name: 'Reset Complete', color: 'lime', description: 'Reset completed successfully' },
};

// App CSS class constants
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

// Button styles
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

const playingHintsContainerStyles = {
  position: 'absolute',
  zIndex: '1',
  opacity: '0',
  transition: 'opacity 0.3s ease-in-out',
  top: '100px',
  padding: '1rem',
  margin: '1rem',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: '1rem',
};

////////////////////////////////////////////////////////
// GLOBAL STATE VARIABLES
////////////////////////////////////////////////////////

let currentExtensionState = EXTENSION_STATES.UNINITIALIZED;
let loadingTimeout = null;
let currentSong = null;
let currentAction = null;
let lastCurrentTime = 0;

// THIS CODE IS IN THE WEBSITE
const HIDE_LOGS = false;

////////////////////////////////////////////////////////
// UTILITY FUNCTIONS
////////////////////////////////////////////////////////

function log(...message) {
  if (HIDE_LOGS) {
    return;
  }
  console.log(`🚀 [Flowkey Options Extension] ${message[0]}`, ...message.slice(1));
}

function getFirstElementByClassName(className) {
  const potentialElements = document.getElementsByClassName(className);
  const potentialElement = potentialElements.item(0);
  return potentialElement || false;
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
// STATE MANAGEMENT
////////////////////////////////////////////////////////

function setExtensionState(newState) {
  if (!EXTENSION_STATES[newState]) {
    log(`❌ Invalid state: ${newState}`);
    return;
  }

  const previousState = currentExtensionState;

  // Prevent getting stuck in loading states
  if (newState === 'LOADING' && (previousState.name === 'Loading' || previousState.name === 'Initializing')) {
    log(`⚠️ Skipping LOADING state transition from ${previousState.name}`);
    return;
  }

  // Clear any existing loading timeout
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }

  currentExtensionState = EXTENSION_STATES[newState];

  const statusDot = getStatusDot();
  if (statusDot) {
    statusDot.style.backgroundColor = currentExtensionState.color;
    statusDot.title = `${currentExtensionState.name}: ${currentExtensionState.description}`;
  }

  log(`🔄 State changed: ${previousState.name} → ${currentExtensionState.name}`);

  // Set timeout for loading states to prevent getting stuck
  if (newState === 'LOADING' || newState === 'INITIALIZING' || newState === 'SONG_LOADING') {
    loadingTimeout = setTimeout(() => {
      log(`⚠️ Loading state timeout reached for ${newState}, forcing to READY`);
      setExtensionState('READY');
    }, 10000); // 10 second timeout
  }
}

// Manual reset function to get out of stuck states
function forceReset() {
  log('🆘 Force reset called - clearing all timeouts and resetting state');

  // Clear any loading timeout
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }

  // Reset action
  currentAction = null;

  // Force to ready state
  setExtensionState('READY');

  log('✅ Force reset complete');
}

// Expose force reset globally for debugging
window.flowkeyForceReset = forceReset;

////////////////////////////////////////////////////////
// STATUS DOT MANAGEMENT
////////////////////////////////////////////////////////

function insertStatusDot() {
  const statusDiv = document.createElement('div');
  statusDiv.setAttribute('id', statusDotId);
  statusDiv.style.position = 'absolute';
  statusDiv.style.top = '10px';
  statusDiv.style.right = '10px';
  statusDiv.style.width = '10px';
  statusDiv.style.height = '10px';
  statusDiv.style.borderRadius = '50%';
  statusDiv.style.zIndex = '1';
  statusDiv.style.backgroundColor = currentExtensionState.color;
  statusDiv.title = `${currentExtensionState.name}: ${currentExtensionState.description}`;
  document.body.appendChild(statusDiv);
}

function getStatusDot() {
  const existing = document.getElementById(statusDotId);
  if (existing) {
    return existing;
  }
  insertStatusDot();
  return document.getElementById(statusDotId);
}

function setStatusDotColor(color) {
  // Legacy function for backward compatibility
  const statusDot = getStatusDot();
  if (!statusDot) {
    return;
  }
  statusDot.style.backgroundColor = color;
}

////////////////////////////////////////////////////////
// DOM ELEMENT GETTERS
////////////////////////////////////////////////////////

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

////////////////////////////////////////////////////////
// CONTAINER MANAGEMENT
////////////////////////////////////////////////////////

function getContainerAndCreateIfNeeded(containerId, createFunction, inject = true) {
  const mainContainer = getFlowkeyPlayerContainer();
  if (!mainContainer) {
    return;
  }
  const existing = document.getElementById(containerId);
  if (existing) {
    return existing;
  }
  const newContainer = createFunction();
  mainContainer.appendChild(newContainer);
  return newContainer;
}

function getSongInfoContainer() {
  return getContainerAndCreateIfNeeded(songInfoContainerId, createSongInfoContainer);
}

function createSongInfoContainer() {
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
  return getContainerAndCreateIfNeeded(songButtonsContainerId, createSongButtonsContainer, false);
}

function createSongButtonsContainer() {
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

function getPlayingHintsContainer() {
  return getContainerAndCreateIfNeeded(playHintsContainerId, createPlayingHintsContainer);
}

function createPlayingHintsContainer() {
  const playHintsContainer = document.createElement('div');
  playHintsContainer.setAttribute('id', playHintsContainerId);
  Object.assign(playHintsContainer.style, playingHintsContainerStyles);
  playHintsContainer.innerHTML = '';
  return playHintsContainer;
}

function getCurrentPlayingHintsSectionId() {
  const playHintsContainer = document.getElementById(playHintsContainerId);
  if (!playHintsContainer) {
    return;
  }
  return playHintsContainer.getAttribute('data-section-id') || '';
}

function setCurrentPlayingHintsSection(section, playHintsContainer) {
  if (!playHintsContainer) {
    playHintsContainer = document.getElementById(playHintsContainerId);
  }
  if (!playHintsContainer) {
    return;
  }
  playHintsContainer.setAttribute('data-section-id', section.timing);
  playHintsContainer.innerHTML = formatSection(section);
}

function getButtonToggleSongInfo() {
  return getContainerAndCreateIfNeeded(toggleSongInfoButtonId, createButtonToggleSongInfo, false);
}

function createButtonToggleSongInfo() {
  const button = document.createElement('button');
  button.setAttribute('id', toggleSongInfoButtonId);
  button.innerHTML = '&#8505;';
  button.addEventListener('click', toggleSongInfo);
  Object.assign(button.style, songButtonsStyles);
  return button;
}

function getButtonTogglePlayingHints() {
  return getContainerAndCreateIfNeeded(togglePlayingHintsButtonId, createButtonTogglePlayingHints, false);
}

function createButtonTogglePlayingHints() {
  const button = document.createElement('button');
  button.setAttribute('id', togglePlayingHintsButtonId);
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>';
  button.addEventListener('click', togglePlayingHints);
  Object.assign(button.style, songButtonsStyles);
  return button;
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
  return currentTime || 0;
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

function updatePlayHint(event) {
  try {
    const currentTime = event?.target?.currentTime ? Math.floor(event.target.currentTime) : getCurrentTime();
    const currentSectionId = getCurrentPlayingHintsSectionId();
    if (currentTime === lastCurrentTime && currentSectionId) {
      return;
    }
    lastCurrentTime = currentTime;
    log(`updatePlayHint ~ currentTime: ${currentTime}`);
    const playHintsContainer = getPlayingHintsContainer();
    const section = getPlayingHintsSection(currentTime);
    if (section && section.timing !== currentSectionId) {
      setCurrentPlayingHintsSection(section, playHintsContainer);
    }
  } catch (error) {
    log(`updatePlayHint ~ error: ${error}`);
  }
}

function getPlayingHintsSection(currentTime) {
  if (!currentSong) {
    return undefined;
  }
  if (currentSong.content.movements.length === 0) {
    return undefined;
  }
  const currentSection = currentSong.content.movements.reduce((foundSection, movement) => {
    return (
      foundSection ||
      movement.sections.find((section) => {
        return currentTime >= section.start_time_sec && currentTime <= section.end_time_sec;
      })
    );
  }, undefined);

  if (!currentSection) {
    return undefined;
  }

  return currentSection;
}

////////////////////////////////////////////////////////
// SONG DATA HANDLING
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
      forceReset();
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
  setExtensionState('SONG_LOADING');
  currentSong = song;
  // inject song in the page
  injectCurrentSong();
  setExtensionState('SONG_LOADED');
}

////////////////////////////////////////////////////////
// UI INTERACTION FUNCTIONS
////////////////////////////////////////////////////////

function toggleContainer(container, buttonId, additionalAction) {
  const toggleButton = document.getElementById(buttonId);
  if (!toggleButton) {
    return;
  }
  if (container.style.opacity === '0') {
    Object.assign(toggleButton.style, buttonActiveStyles);
    container.style.opacity = '1';
    additionalAction?.();
  } else {
    Object.assign(toggleButton.style, buttonInactiveStyles);
    container.style.opacity = '0';
  }
}

function toggleSongInfo() {
  toggleContainer(getSongInfoContainer(), toggleSongInfoButtonId);
}

function togglePlayingHints() {
  toggleContainer(getPlayingHintsContainer(), togglePlayingHintsButtonId, updatePlayHint);
}

function injectSongContainer() {
  if (!currentSong) {
    return;
  }
  getPlayingHintsContainer();
  // Buttons to hide and show song info and play hints
  const songButtonsContainer = getSongButtonsContainer();
  const buttonToggleSong = getButtonToggleSongInfo();
  const buttonTogglePlayingHints = getButtonTogglePlayingHints();
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

////////////////////////////////////////////////////////
// BUTTON CREATION AND MANAGEMENT
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
// INITIALIZATION AND LIFECYCLE
////////////////////////////////////////////////////////

function init() {
  log('🚀 ~ init ~ init');
  if (currentAction === 'init') {
    return Promise.resolve();
  }
  currentAction = 'init';
  setExtensionState('INITIALIZING');

  if (!window || !window.location) {
    currentAction = null;
    setExtensionState('ERROR');
    console.info('No window or location found');
    return Promise.resolve();
  }
  if (!pathNameConstraint.test(window.location.pathname)) {
    currentAction = null;
    setExtensionState('NOT_SONG_PAGE');
    console.info('Not playing');
    return Promise.resolve();
  }
  if (document.getElementById(extensionButtonsContainerId)) {
    console.info('Buttons already present.');
    setExtensionState('INITIALIZED');
    unsubscribeFromEvents();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      addButtons();
      registerVideoTimeUpdate();
      setExtensionState('INITIALIZED');
      // askForSong(); // only works if the extension is open, so its shit.
      resolve();
    }, 1000);
  });
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

  // Prevent multiple simultaneous initializations
  if (currentAction === 'lazyInit' || currentAction === 'init') {
    log('⚠️ Already initializing, skipping lazyInit');
    return;
  }

  currentAction = 'lazyInit';
  setExtensionState('LOADING');

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

////////////////////////////////////////////////////////
// PAGE CHANGE HANDLING
////////////////////////////////////////////////////////

function reset() {
  log('🔄 Resetting extension state...');
  setExtensionState('RESETTING');

  // Reset current action and song
  currentAction = null;
  currentSong = null;

  // Remove existing containers
  const existingSongInfoContainer = getSongInfoContainer();
  if (existingSongInfoContainer) {
    existingSongInfoContainer.remove();
  }

  const existingPlayHintsContainer = getPlayingHintsContainer();
  if (existingPlayHintsContainer) {
    existingPlayHintsContainer.remove();
  }

  const existingSongButtonsContainer = getSongButtonsContainer();
  if (existingSongButtonsContainer) {
    existingSongButtonsContainer.remove();
  }

  // Remove existing extension buttons
  const existingExtensionButtons = document.getElementById(extensionButtonsContainerId);
  if (existingExtensionButtons) {
    existingExtensionButtons.remove();
  }

  // Remove video time update listener
  const video = getPlayerVideo();
  if (video) {
    video.removeEventListener('timeupdate', updatePlayHint);
  }

  // Show alert to user
  log('🎵 Flowkey Options Extension: Ready for new song!');

  log('✅ Extension state reset complete');
  setExtensionState('RESET_COMPLETE');
}

function isSongPage() {
  return pathNameConstraint.test(window.location.pathname);
}

function handlePageChange() {
  log('📄 Page change detected');
  setExtensionState('PAGE_CHANGE_DETECTED');

  if (isSongPage()) {
    log('🎵 Song page detected, resetting extension');
    reset();

    // Initialize for the new song page
    setTimeout(() => {
      init().then(() => {
        setExtensionState('READY');
      });
    }, 1000);
  } else {
    log('❌ Not a song page, skipping reset');
    setExtensionState('NOT_SONG_PAGE');
  }
}

// Listen for page changes using different methods
function setupPageChangeListeners() {
  // Method 1: Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handlePageChange);

  // Method 2: Listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    setTimeout(handlePageChange, 100);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    setTimeout(handlePageChange, 100);
  };

  // Method 3: Listen for URL changes using MutationObserver
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setExtensionState('PAGE_CHANGE_DETECTED');
      setTimeout(handlePageChange, 100);
    }
  });

  observer.observe(document, { subtree: true, childList: true });

  log('📡 Page change listeners setup complete');
}

////////////////////////////////////////////////////////
// MAIN INITIALIZATION
////////////////////////////////////////////////////////

(function () {
  // insert a status div (a small dot in the top right corner, that just has a background color)
  getStatusDot();
  ['click', 'pageshow'].forEach((eventName) => {
    window.addEventListener(eventName, lazyInit);
  });
  // Initialize page change listeners when the script loads
  setupPageChangeListeners();
})();
