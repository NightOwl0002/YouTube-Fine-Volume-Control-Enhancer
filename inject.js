// --- 1. THE VOLUME LOCK OVERRIDE ---
const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
const originalSet = originalVolumeDescriptor.set;
const originalGet = originalVolumeDescriptor.get;
const originalPlay = HTMLMediaElement.prototype.play;

let lockedVolume = null;

// Intercept ANY attempt to change the volume
Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    get: function() { return originalGet.call(this); },
    set: function(newVolume) {
        if (lockedVolume !== null) {
            // If it matches our safe volume, let it through
            if (Math.abs(newVolume - lockedVolume) < 0.0001) {
                originalSet.call(this, newVolume);
                return;
            }
            // If YouTube tries to force it to 100% (or anything else), 
            // throw it in the trash and forcefully apply our safe volume instead!
            originalSet.call(this, lockedVolume);
            return; 
        }
        originalSet.call(this, newVolume);
    }
});

// UPGRADE: Catch brand new Shorts the exact millisecond they try to play!
HTMLMediaElement.prototype.play = function() {
    if (lockedVolume !== null) {
        originalSet.call(this, lockedVolume);
        this.muted = false;
    }
    return originalPlay.apply(this, arguments);
};

// Listen for our extension's command and apply it to ALL video tags (Fixes Shorts multi-video)
window.addEventListener('SetFineVolume', (e) => {
    lockedVolume = e.detail;
    document.querySelectorAll('video').forEach(video => {
        video.muted = false;
        originalSet.call(video, lockedVolume);
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
