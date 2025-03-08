let hls = null;
let currentStream = null;

function initializeStream() {
    const video = document.getElementById('videoPlayer');
    
    // Destroy existing HLS instance if it exists
    if (hls) {
        hls.destroy();
        hls = null;
    }

    // Clear video source
    video.src = '';
    
    if (Hls.isSupported()) {
        hls = new Hls({
            debug: false,
            capLevelToPlayerSize: true,
            autoLevelCapping: -1,
            startLevel: -1, // Auto quality by default
            // Add some additional config for better performance
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 500
        });

        const streamUrl = `http://${window.location.hostname}:8000/live/StreamtoME/index.m3u8`;
        currentStream = streamUrl;
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            console.log('Stream manifest loaded, found ' + data.levels.length + ' quality levels');
            
            const qualitySelect = document.getElementById('qualitySelect');
            qualitySelect.innerHTML = '<option value="auto">Auto</option>';
            
            // Add available qualities
            data.levels.forEach((level, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.text = `${level.height}p`;
                qualitySelect.appendChild(option);
            });
            
            video.play().catch(function(error) {
                console.log("Play failed:", error);
            });
        });

        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('Network error, trying to recover...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('Media error, trying to recover...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error('Fatal error:', data);
                        destroyStream();
                        break;
                }
            }
        });
    }
    // For Safari and iOS
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        const streamUrl = `http://${window.location.hostname}:8000/live/StreamtoME/index.m3u8`;
        video.src = streamUrl;
        currentStream = streamUrl;
        
        video.addEventListener('loadedmetadata', function() {
            video.play().catch(function(error) {
                console.log("Play failed:", error);
            });
        });
    }
}

function destroyStream() {
    if (hls) {
        hls.destroy();
        hls = null;
    }
    const video = document.getElementById('videoPlayer');
    video.src = '';
    currentStream = null;
}

function toggleFullscreen() {
    const player = document.querySelector('.video-player');
    
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement) {
        // Request fullscreen
        if (player.requestFullscreen) {
            player.requestFullscreen();
        } else if (player.webkitRequestFullscreen) {
            player.webkitRequestFullscreen();
        } else if (player.mozRequestFullScreen) {
            player.mozRequestFullScreen();
        } else if (player.msRequestFullscreen) {
            player.msRequestFullscreen();
        }
        
        // Lock screen orientation for mobile if possible
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function(error) {
                console.log('Orientation lock failed:', error);
            });
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function changeQuality() {
    const quality = document.getElementById('qualitySelect').value;
    if (hls) {
        if (quality === 'auto') {
            hls.currentLevel = -1; // Auto quality
        } else {
            hls.currentLevel = parseInt(quality);
        }
    }
}

function toggleChat() {
    if (window.innerWidth <= 767) {
        if (mobileChatOverlay.style.display === 'flex') {
            mobileChatOverlay.style.display = 'none';
        } else {
            mobileChatOverlay.style.display = 'flex';
            mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
            mobileChatInput.focus();
        }
    }
}

function updateStreamStatus(data) {
    const statusElement = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const videoPlayer = document.getElementById('videoPlayer');
    
    statusText.textContent = data.status;
    statusElement.className = 'status-indicator ' + 
        (data.status === 'LIVE' ? 'live' : 'offline');
        
    if (data.status === 'LIVE') {
        videoPlaceholder.style.display = 'none';
        videoPlayer.style.display = 'block';
        videoPlaceholder.pause();
        initializeStream();
    } else {
        destroyStream();
        videoPlaceholder.style.display = 'block';
        videoPlayer.style.display = 'none';
        videoPlaceholder.play();
    }
}

function updateViewerCount(count) {
    document.getElementById('viewerCount').textContent = count;
}

function loadChatHistory(messages) {
    const chatBox = document.getElementById('chatBox');
    const mobileChatBox = document.getElementById('mobileChatBox');
    
    // Clear existing messages
    chatBox.innerHTML = '';
    mobileChatBox.innerHTML = '';
    
    // Display all history messages
    messages.forEach(msg => {
        let username = msg.username || 'Anonymous';
        let platform = msg.platform || 'web';
        addChatMessage(msg.message, platform, username);
    });
    
    // Scroll to bottom after loading history
    chatBox.scrollTop = chatBox.scrollHeight;
    mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chatBox');
    const mobileChatBox = document.getElementById('mobileChatBox');
    const chatInput = document.getElementById('chatInput');
    const mobileChatInput = document.getElementById('mobileChatInput');

    // Chat scroll listeners
    chatBox.addEventListener('scroll', () => {
        const isNearBottom = chatBox.scrollHeight - chatBox.clientHeight - chatBox.scrollTop < 100;
        autoScroll = isNearBottom;
    });

    mobileChatBox.addEventListener('scroll', () => {
        const isNearBottom = mobileChatBox.scrollHeight - mobileChatBox.clientHeight - mobileChatBox.scrollTop < 100;
        autoScroll = isNearBottom;
    });

    // Chat input listeners
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    });
    
    mobileChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMobileChat();
        }
    });

    // Click to focus input
    chatBox.addEventListener('click', () => {
        chatInput.focus();
    });
    
    mobileChatBox.addEventListener('click', () => {
        mobileChatInput.focus();
    });

    // Initialize donations
    createMilestoneMarkers();
    setInterval(updateDonationUI, 30000);
    updateDonationUI();

    // Add fullscreen change event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
});

function handleFullscreenChange() {
    const player = document.querySelector('.video-player');
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement) {
        // Exited fullscreen
        player.classList.remove('fullscreen');
        // Unlock screen orientation if possible
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    } else {
        // Entered fullscreen
        player.classList.add('fullscreen');
    }
}