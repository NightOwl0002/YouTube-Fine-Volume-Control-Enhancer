// --- 1. THE VOLUME LOCK OVERRIDE ---
const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
const originalSet = originalVolumeDescriptor.set;
const originalGet = originalVolumeDescriptor.get;

let lockedVolume = null;

Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    get: function() { return originalGet.call(this); },
    set: function(newVolume) {
        // Intercept YouTube's volume commands to protect your 0.1%
        if (lockedVolume !== null) {
            if (Math.abs(newVolume - lockedVolume) < 0.0001) {
                originalSet.call(this, newVolume);
                return;
            }
            return; 
        }
        originalSet.call(this, newVolume);
    }
});

// Listen for our extension's command to set your exact decimal volume
window.addEventListener('SetFineVolume', (e) => {
    lockedVolume = e.detail;
    const video = document.querySelector('video');
    if (video) {
        video.muted = false; // Force unmute
        originalSet.call(video, lockedVolume);
    }
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