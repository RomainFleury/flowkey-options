const SYNC_SERVER_URL = "http://localhost:2727/api/generate";
function getSongInfo() {
    const songInfoView = document.querySelector(".song-info-view");
    if (!songInfoView)
        return null;
    const author = songInfoView.querySelector("span")?.textContent || "";
    const title = songInfoView.querySelector("h4")?.textContent || "";
    return { title, author };
}
function getCurrentTime() {
    const video = document.querySelector(".player-video");
    if (!video) {
        console.warn("[Flowkey Sync] Video element not found");
        return 0;
    }
    return video.currentTime;
}
function onTimeUpdate(callback) {
    const video = document.querySelector(".player-video");
    if (!video) {
        console.warn("[Flowkey Sync] Video element not found");
        return () => { };
    }
    const handler = () => callback(video.currentTime);
    video.addEventListener("timeupdate", handler);
    // Return cleanup function
    return () => video.removeEventListener("timeupdate", handler);
}
async function fetchSyncData(title, composer) {
    const cacheKey = `${title}-${composer}`;
    const cached = await loadFromStorage(cacheKey);
    if (cached) {
        console.log("[Flowkey Sync] Loaded from cache");
        return cached;
    }
    const response = await fetch(`${SYNC_SERVER_URL}?pieceTitle=${encodeURIComponent(title)}&composer=${encodeURIComponent(composer)}`);
    const json = (await response.json());
    await saveToStorage(cacheKey, json);
    console.log("[Flowkey Sync] Fetched from server");
    return json;
}
function saveToStorage(key, data) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: data }, resolve);
    });
}
function loadFromStorage(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            resolve(result[key]);
        });
    });
}
function parseTimeToSeconds(timeStr) {
    const [minutes, seconds] = timeStr.split(":").map(Number);
    return minutes * 60 + seconds;
}
function getCurrentSection(time, analysis) {
    let currentSection = null;
    let currentSummary = null;
    // Find current section from movements
    for (const movement of analysis.movements) {
        for (const section of movement.sections) {
            const [startTime, endTime] = section.timing
                .split("–")
                .map(parseTimeToSeconds);
            if (time >= startTime && time <= endTime) {
                currentSection = section;
                break;
            }
        }
        if (currentSection)
            break;
    }
    // Find current summary entry
    for (const entry of analysis.summary_table) {
        if (time >= entry.start_time_sec && time <= entry.end_time_sec) {
            currentSummary = entry;
            break;
        }
    }
    return { section: currentSection, summary: currentSummary };
}
function displaySyncOverlay(data) {
    let overlay = document.getElementById("flowkey-sync-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "flowkey-sync-overlay";
        overlay.style.position = "absolute";
        overlay.style.top = "10px";
        overlay.style.right = "10px";
        overlay.style.padding = "10px";
        overlay.style.background = "#fff";
        overlay.style.border = "1px solid #ccc";
        overlay.style.borderRadius = "8px";
        overlay.style.zIndex = "9999";
        overlay.style.fontFamily = "sans-serif";
        overlay.style.maxWidth = "300px";
        document.body.appendChild(overlay);
    }
    // Initial display
    updateOverlayContent(overlay, getCurrentTime(), data);
    // Set up time update listener
    const cleanup = onTimeUpdate((time) => {
        updateOverlayContent(overlay, time, data);
    });
    // Clean up listener when overlay is removed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "childList" && !document.contains(overlay)) {
                cleanup();
                observer.disconnect();
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
function updateOverlayContent(overlay, time, data) {
    const { section, summary } = getCurrentSection(time, data);
    const timeStr = new Date(time * 1000).toISOString().substr(11, 8);
    let content = `
    <div style="margin-bottom: 10px;">
      <strong>${data.title}</strong> by ${data.composer}<br>
      <small>${data.key_signature} • ${data.time_signature}</small>
    </div>
    <div style="margin-bottom: 10px;">
      <strong>Current Time:</strong> ${timeStr}
    </div>
  `;
    if (summary) {
        content += `
      <div style="margin-bottom: 10px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
        <strong>Current Section:</strong><br>
        ${summary.name}<br>
        <small>Measures: ${summary.measures[0]}–${summary.measures[1]}</small><br>
        <small>Dynamics: ${summary.dynamics}</small><br>
        <small>${summary.description}</small>
      </div>
    `;
    }
    if (section) {
        content += `
      <div style="margin-bottom: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
        <strong>Detailed Analysis:</strong><br>
        ${section.name}<br>
        <small>Measures: ${section.measures}</small><br>
        <small>Dynamics: ${section.dynamics}</small><br>
        <small>${section.description}</small><br>
        <small><em>${section.interpretation}</em></small>
      </div>
    `;
    }
    overlay.innerHTML = content;
}
(async function initFlowkeySync() {
    const songInfo = getSongInfo();
    if (!songInfo) {
        console.error("[Flowkey Sync] Could not find song info");
        return;
    }
    const data = await fetchSyncData(songInfo.title, songInfo.author);
    displaySyncOverlay(data);
})();
export {};