// 1. INJECT THE SECURE SCRIPTS & CSS
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Mini Player CSS (Upgraded to brute-force the Z-Index overlap)
const style = document.createElement('style');
style.textContent = `
    /* Force every possible video parent container to the absolute front */
    .fv-mini-player #primary,
    .fv-mini-player #player,
    .fv-mini-player #player-container-outer,
    .fv-mini-player #player-full-bleed-container,
    .fv-mini-player ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
        z-index: 999999 !important; 
        position: relative !important; 
    }

    .fv-mini-player ytd-player {
        position: fixed !important; bottom: 20px !important; right: 20px !important;
        width: 480px !important; height: 270px !important; z-index: 999999 !important;
        box-shadow: 0px 4px 20px rgba(0,0,0,0.8) !important; border-radius: 12px !important;
        background: black !important; overflow: hidden !important;
    }
    
    .fv-mini-player ytd-player .html5-video-player, .fv-mini-player ytd-player .html5-video-container,
    .fv-mini-player ytd-player video {
        width: 100% !important; height: 100% !important; top: 0 !important; left: 0 !important;
        margin: 0 !important; padding: 0 !important; object-fit: contain !important;
    }
    
    .fv-mini-player ytd-player .ytp-chrome-bottom { width: calc(100% - 24px) !important; left: 12px !important; }
    .fv-mini-player ytd-player .ytp-chapter-container { display: none !important; }
`;
(document.head || document.documentElement).appendChild(style);


// 2. THE VISUAL POPUP DISPLAY
let popupDisplay;
function showPopup(text) {
    if (!popupDisplay) {
        popupDisplay = document.createElement('div');
        popupDisplay.style.position = 'fixed'; popupDisplay.style.top = '10%'; popupDisplay.style.left = '50%';
        popupDisplay.style.transform = 'translateX(-50%)'; popupDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        popupDisplay.style.color = '#fff'; popupDisplay.style.padding = '10px 20px';
        popupDisplay.style.borderRadius = '5px'; popupDisplay.style.fontSize = '24px';
        popupDisplay.style.fontFamily = 'Arial, sans-serif'; popupDisplay.style.zIndex = '9999999';
        popupDisplay.style.pointerEvents = 'none'; popupDisplay.style.transition = 'opacity 0.2s';
        document.body.appendChild(popupDisplay);
    }
    popupDisplay.innerText = text;
    popupDisplay.style.opacity = '1';
    clearTimeout(popupDisplay.hideTimeout);
    popupDisplay.hideTimeout = setTimeout(() => { popupDisplay.style.opacity = '0'; }, 1500);
}


// 3. ISOLATED MATH & PERMANENT MEMORY
let currentFineVolume = localStorage.getItem('yt-fine-volume') ? parseFloat(localStorage.getItem('yt-fine-volume')) : null;

function releaseLock() {
    currentFineVolume = null;
    localStorage.removeItem('yt-fine-volume'); 
    window.dispatchEvent(new CustomEvent('ReleaseFineVolume'));
}

// 4. THE MASTER SCROLL CONTROLLER
window.addEventListener('wheel', (e) => {
    // Check if the mouse is hovering directly over ANY video player (Normal, Shorts, or YT Music)
    const player = e.target.closest('ytd-player') || 
                   e.target.closest('#movie_player') ||
                   e.target.closest('ytmusic-player') || 
                   e.target.closest('ytmusic-player-bar');
    
    // If the mouse is NOT over the video, let normal scrolling happen 
    if (!player) return;

    // Find the active video or audio tag to start our math from
    const media = player.querySelector('video, audio') || document.querySelector('video, audio');
    if (!media) return;

    // CRITICAL: Prevent YouTube from seeing the scroll event so it doesn't jump to the next Short!
    e.preventDefault();
    e.stopPropagation();

    if (currentFineVolume === null) currentFineVolume = media.volume;

    const STEP = 0.001;
    let delta = e.shiftKey ? (e.deltaY < 0 ? 0.01 : -0.01) : (e.deltaY < 0 ? STEP : -STEP);

    currentFineVolume += delta;
    currentFineVolume = Math.round(currentFineVolume * 1000) / 1000;
    if (currentFineVolume > 1) currentFineVolume = 1;
    if (currentFineVolume < 0) currentFineVolume = 0;

    localStorage.setItem('yt-fine-volume', currentFineVolume);
    window.dispatchEvent(new CustomEvent('SetFineVolume', { detail: currentFineVolume }));
    showPopup(`Volume: ${(currentFineVolume * 100).toFixed(1)}%`);
}, { passive: false });


// 5. THE AUTOMATIC RESTORER 
function autoRestoreVideoState() {
    let attempts = 0;
    const checkExist = setInterval(() => {
        attempts++;
        const mediaElements = document.querySelectorAll('video, audio');
        
        if (mediaElements.length > 0 && mediaElements[0].readyState > 0) {
            clearInterval(checkExist);
            
            if (currentFineVolume !== null) {
                window.dispatchEvent(new CustomEvent('SetFineVolume', { detail: currentFineVolume }));
            }
            window.dispatchEvent(new CustomEvent('SetAutoHD'));

        } else if (attempts > 50) {
            clearInterval(checkExist); 
        }
    }, 100);
}
window.addEventListener('load', autoRestoreVideoState);
document.addEventListener('yt-navigate-finish', autoRestoreVideoState);

// NEW: Catch silent playlist transitions natively!
// Whenever a new song/video actually loads its data, enforce our saved volume.
document.addEventListener('loadeddata', (e) => {
    if (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') {
        if (currentFineVolume !== null) {
            window.dispatchEvent(new CustomEvent('SetFineVolume', { detail: currentFineVolume }));
        }
    }
}, true); // Use 'true' to capture the event before YouTube's scripts can react


// 6. SMART RELEASES 
document.addEventListener('mousedown', (e) => {
    // .ytp-volume-area = Standard YouTube
    // ytd-shorts-player-controls = YouTube Shorts
    // #volume-slider = YouTube Music (Targeting ONLY the slider, not the whole bar!)
    if (e.target.closest('.ytp-volume-area') || 
        e.target.closest('ytd-shorts-player-controls') ||
        e.target.closest('#volume-slider') 
       ) {
        releaseLock();
    }
});

window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
    if (['m', 'M', 'ArrowUp', 'ArrowDown'].includes(e.key)) releaseLock();
});

// 7. MINI PLAYER SCROLL LOGIC
let isMiniPlayerActive = false;
window.addEventListener('scroll', () => {
    // Abort if we are on YouTube Music (prevents mini-player conflicts)
    if (window.location.hostname === 'music.youtube.com') return;

    if (!window.location.pathname.startsWith('/watch')) return;

    const playerWrapper = document.querySelector('ytd-player');
    if (!playerWrapper || document.fullscreenElement) return;

    const container = playerWrapper.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    if (rect.bottom < 0 && !isMiniPlayerActive) {
        isMiniPlayerActive = true;
        container.style.minHeight = container.offsetHeight + 'px';
        document.body.classList.add('fv-mini-player');
        
    } else if (rect.bottom >= 0 && isMiniPlayerActive) {
        isMiniPlayerActive = false;
        container.style.minHeight = '';
        document.body.classList.remove('fv-mini-player');
    }
});
