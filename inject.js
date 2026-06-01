// --- 1. THE VOLUME & MUTE LOCK OVERRIDES ---
const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
const originalVolumeSet = originalVolumeDescriptor.set;
const originalVolumeGet = originalVolumeDescriptor.get;

const originalMutedDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');
const originalMutedSet = originalMutedDescriptor.set;
const originalMutedGet = originalMutedDescriptor.get;

const originalPlay = HTMLMediaElement.prototype.play;

let lockedVolume = null;

// Intercept ANY attempt to change the volume
Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    get: function() { return originalVolumeGet.call(this); },
    set: function(newVolume) {
        if (lockedVolume !== null) {
            if (Math.abs(newVolume - lockedVolume) < 0.0001) {
                originalVolumeSet.call(this, newVolume);
                return;
            }
            originalVolumeSet.call(this, lockedVolume);
            return; 
        }
        originalVolumeSet.call(this, newVolume);
    }
});

// Intercept ANY attempt to Mute the video/audio
Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    get: function() { return originalMutedGet.call(this); },
    set: function(newMuted) {
        // If locked, just silently drop the request to mute. 
        if (lockedVolume !== null && newMuted === true) {
            originalMutedSet.call(this, false); 
            return;
        }
        originalMutedSet.call(this, newMuted);
    }
});

// Catch brand new media the exact millisecond they try to play
HTMLMediaElement.prototype.play = function() {
    if (lockedVolume !== null) {
        originalVolumeSet.call(this, lockedVolume);
        originalMutedSet.call(this, false);
    }
    return originalPlay.apply(this, arguments);
};

// Listen for our extension's command and apply it to ALL media tags
window.addEventListener('SetFineVolume', (e) => {
    lockedVolume = e.detail;
    
    // SAFE: Sync the UI state
    const player = document.getElementById('movie_player');
    if (player && typeof player.unMute === 'function') {
        player.unMute();
    }

    // THE YT MUSIC FIX: Target BOTH video and audio elements!
    document.querySelectorAll('video, audio').forEach(media => {
        originalMutedSet.call(media, false); 
        originalVolumeSet.call(media, lockedVolume);
    });
});

// Release the lock when requested
window.addEventListener('ReleaseFineVolume', () => { lockedVolume = null; });

// --- 2. AUTO HD SETTER (1440p) ---
window.addEventListener('SetAutoHD', () => {
    const player = document.getElementById('movie_player');
    if (player && player.setPlaybackQualityRange) {
        player.setPlaybackQualityRange('hd1440', 'highres');
        player.setPlaybackQuality('hd1440');
    }
});
