const pathNameConstraint = /^\/player\/.*/;

const extensionButtonsContainerId = 'flowkey-extension';
const buttonIdPrefix = 'flowkey-extension-button';
const modifiedInfoClass = `${extensionButtonsContainerId}-modified`;
const alwaysVisibleClass = `${extensionButtonsContainerId}-always-visible`;

// THIS CODE IS IN THE WEBSITE

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

function handleMessage(message, sender, sendResponse) {
  console.log("handleMessage", message, sender);
  switch(message.type) {
    case "contentSync":
      contentSync(sendResponse);
      break;
    case "getSongInfo":
      getSongInfoMessage(sendResponse);
      break;
    case "sendSong":
      console.log("🚀 ~ receiveSong ~ message:", message);
      receiveSong(message.song);
      break;
    default:
      console.warn("Unknown message type", message.type);
      break;
  }
}

function getSongInfoMessage(sendResponse) {
  const songInfo = getSongInfo();
  sendResponse(songInfo);
}

function receiveSong(song) {
  console.log("🚀 ~ receiveSong ~ song:", song);
}


function getSongInfo() { // : { title: string; author: string } | null 
  const songInfoView = document.querySelector(".song-info-view");
  if (!songInfoView) return null;

  console.log("🚀 ~ getSongInfo ~ songInfoView:", songInfoView);
  // const url = https://app.flowkey.com/player/DFkqYnpTKW57mPhjc
  // const url = https://app.flowkey.com/player/[ID]

  const author = songInfoView.querySelector("span")?.textContent || "";
  const title = songInfoView.querySelector("h4")?.textContent || "";
  const idFromUrl = window.location.href.split("/").pop();

  console.log("[Flowkey Sync] Song info", { title, author, idFromUrl });
  return { title, author, idFromUrl };
}

function getCurrentTime() {

  // player-video-container > .player-video
  const video = document.querySelector(".player-video"); //  as HTMLVideoElement
  if (!video) {
    console.warn("[Flowkey Sync] Video element not found");
    return 0;
  }
  const currentTime = video.currentTime;
  registerVideoTimeUpdate((time) => {
    console.log("🚀 ~ getCurrentTime ~ time:", time);
    currentTime = time;
  });
  return currentTime;
}

function registerVideoTimeUpdate(callback) {
  const video = document.querySelector(".player-video"); //  as HTMLVideoElement
  if (!video) {
    console.warn("[Flowkey Sync] Video element not found");
    return;
  }
  video.addEventListener("timeupdate", callback);
  return () => video.removeEventListener("timeupdate", callback);
}

////////////////////////////////////////////////////////
// App tools and vars
////////////////////////////////////////////////////////
const playerVideoContainerClass = "player-video-container";
const sheetContainerClass = "sheet-container";
const tabletControlsClass = "tablet-controls";
const playAndHandButtonBarClass = 'play-and-hand-button-bar';
const playedCorrectlyFeedbackClass = 'played-correctly-feedback';
const notesNamesClass = 'note-names-container';
const mainControlsClass = 'main-controls';

function getFirstElementByClassName(className) {
  const potentialElements = document.getElementsByClassName(className);
  const potentialElement = potentialElements.item(0);
  return potentialElement || false;
}

function getPlayerVideoContainer() {
  return getFirstElementByClassName(playerVideoContainerClass);
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
  window.resizeTo(
    targetWidth - 1,
    targetHeight - 1,
    );
  setTimeout(() => {
    window.resizeTo(
      targetWidth,
      targetHeight,
    );
  }, 100);
}

function markModified(elements) {
  elements.forEach(element => {
    element.classList.add(modifiedInfoClass);
  });
}

function unmarkModified(elements) {
  elements.forEach(element => {
    element.classList.remove(modifiedInfoClass);
  });
}

function anyHaveBeenModified(elements) {
  return elements.some(element => {
    return element.classList.contains(modifiedInfoClass);
  });
}

////////////////////////////////////////////////////////
// Specific tools
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

////////////////////////////////////////////////////////
// Actual buttons
////////////////////////////////////////////////////////
function addButtonReverse(container) {
  addButton(container, 'reverse', '&#8593; &#8595;', 'Invert sheet and piano', () => {
    const sheet = getSheetContainer();
    const player = getPlayerVideoContainer();
    const tabletControls = getTabletControlsContainer();
    const playCorrectlyFeedback = getPlayCorrectlyFeedbackContainer();
    const notesNames = getNotesNamesContainer();
    if(!sheet || !player || !tabletControls || !playCorrectlyFeedback || !notesNames) {
      return;
    }
    const elementsList = [
      player, sheet, tabletControls, playCorrectlyFeedback,notesNames
    ]
    if(anyHaveBeenModified(elementsList)) {
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
};

function addButtonAlwaysVisible(container) {
  addButton(container, 'always-visible', '&#128274;', 'Keep controls visible', () => {
    const mainControls = getMainControlsContainer();
    if(!mainControls) {
      return;
    }
    mainControls.classList.toggle(alwaysVisibleClass);
  })
}


////////////////////////////////////////////////////////
// Add all buttons
////////////////////////////////////////////////////////
function addButtons() {
  const container = getPlayButtonAndHandsContainer();
  if(!container) {
    return;
  }
  const buttonsContainer = document.createElement('div');
  buttonsContainer.setAttribute('id', extensionButtonsContainerId);
  container.insertAdjacentElement('beforeend', buttonsContainer);

  // works okay-ish
  addButtonReverse(buttonsContainer);

  // Does not work very well
  addButtonAlwaysVisible(buttonsContainer);
}

////////////////////////////////////////////////////////
// Global init
////////////////////////////////////////////////////////
function init(){
  if(!window || !window.location) {
    console.info('No window or location found');
    return;
  }
  if(!pathNameConstraint.test(window.location.pathname)) {
    console.info('Not playing');
    return;
  }
  if(document.getElementById(extensionButtonsContainerId)) {
    console.info('Buttons already present.');
    return;
  };
  setTimeout(() => {
    addButtons();
  }, 1000);
}

[
  "click",
  "pageshow"
].forEach(eventName => {
  window.addEventListener(eventName, (_event) => {
    init();
   });
});
