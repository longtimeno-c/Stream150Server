console.log('🔍 UI.js loaded and executing');

let hls = null;
let currentStream = null;

function getStreamUrls(useLocalhost = false) {
    const host = useLocalhost ? 'localhost' : 'watch.stream150.com';
    return {
        hls: `https://${host}:8000/live/StreamtoME/index.m3u8`,
        flv: `https://${host}:8000/live/StreamtoME.flv`
    };
}

function initializeStream(useLocalhost = false) {
    console.log('🔍 initializeStream called');
    console.log('🎥 Initializing stream player...');
    const video = document.getElementById('videoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');

    const urls = getStreamUrls(useLocalhost);
    
    // Show video, hide placeholder
    video.style.display = 'block';
    placeholder.style.display = 'none';
    
    if (hls.isSupported()) {
        console.log('✅ HLS.js is supported');
        if (hls) {
            console.log('♻️ Destroying existing HLS instance');
            hls.destroy();
        }
        
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            // Add retry configuration
            manifestLoadingMaxRetry: 6,
            manifestLoadingRetryDelay: 1000,
            manifestLoadingMaxRetryTimeout: 10000,
            levelLoadingMaxRetry: 6,
            levelLoadingRetryDelay: 1000,
            levelLoadingMaxRetryTimeout: 10000
        });

        console.log('🔄 Loading stream source:', urls.hls);
        
        // Add manifest loading error handler
        hls.on(hls.Events.MANIFEST_LOADING, () => {
            console.log('📡 Attempting to load HLS manifest...');
        });

        hls.loadSource(urls.hls);
        hls.attachMedia(video);
        
        hls.on(hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ HLS manifest parsed, attempting playback');
            video.play().catch(e => console.log('❌ Autoplay failed:', e));
        });

        hls.on(hls.Events.ERROR, (event, data) => {
            console.error('❌ HLS Error:', data);
            if (data.fatal) {
                switch(data.type) {
                    case hls.ErrorTypes.NETWORK_ERROR:
                        if (!useLocalhost) {
                            console.log('🔄 Network error with primary URL, trying localhost...');
                            initializeStream(true);
                            return;
                        }
                        console.log('🔄 Network error, attempting recovery...');
                        hls.startLoad();
                        break;
                    case hls.ErrorTypes.MEDIA_ERROR:
                        console.log('🔄 Media error, attempting recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.log('💀 Fatal error, destroying player...');
                        destroyStream();
                        break;
                }
            }
        });
    }
    // For Safari and iOS
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('📱 Using native HLS support');
        video.src = urls.hls;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.log('❌ Autoplay failed:', e));
        });
    }

    if (flvjs.isSupported()) {
        const flvPlayer = flvjs.createPlayer({
            type: 'flv',
            url: urls.flv,
            isLive: true,
            hasAudio: true,
            hasVideo: true,
            enableStashBuffer: false,
            // Add retry configuration
            cors: true,
            withCredentials: false,
            timeout: 5000,
            seekRetry: 5,
            maxRetryCount: 3
        });
        
        flvPlayer.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
            console.error('FLV Player Error:', errorType, errorDetail);
            flvPlayer.destroy();
        });

        flvPlayer.attachMediaElement(video);
        flvPlayer.load();
        flvPlayer.play();
    }
}

function destroyStream() {
    console.log('🛑 Destroying stream player...');
    if (hls) {
        hls.destroy();
        hls = null;
    }
    const video = document.getElementById('videoPlayer');
    video.src = '';
    
    // Show placeholder if it exists
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) {
        video.style.display = 'none';
        placeholder.style.display = 'block';
    }
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

function updateStreamStatus(status) {
    console.log(`🔄 Stream status update: ${status}`);
    const statusElement = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    
    statusText.textContent = status;
    statusElement.className = 'status-indicator ' + (status === 'LIVE' ? 'online' : 'offline');
    
    // Update viewer count display
    const viewerCount = document.getElementById('viewerCount');
    if (viewerCount) {
        viewerCount.style.display = status === 'LIVE' ? 'block' : 'none';
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
    console.log('🔍 DOM Content Loaded - initializing UI components');
    
    // Test HLS.js availability
    if (typeof Hls !== 'undefined') {
        console.log('✅ HLS.js is available');
    } else {
        console.error('❌ HLS.js is not loaded!');
    }
    
    // Test flv.js availability
    if (typeof flvjs !== 'undefined') {
        console.log('✅ flv.js is available');
    } else {
        console.error('❌ flv.js is not loaded!');
    }

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

    // Update WebSocket connection to use the correct port and path
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//watch.stream150.com:3001`;
    const ws = new WebSocket(wsUrl);
    console.log('🔌 Attempting WebSocket connection to:', wsUrl);

    ws.onopen = function() {
        console.log('✅ WebSocket connection established');
    };

    ws.onmessage = function(event) {
        console.log('📨 Received WebSocket message:', event.data);
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'STREAM_STATUS':
                handleStreamStatusUpdate(data.status);
                break;
            
            case 'VIEWER_COUNT':
                console.log('👥 Viewer count update:', data.viewers);
                updateViewerCount(data.viewers);
                break;
            
            case 'CHAT_HISTORY':
                console.log('📜 Received chat history');
                loadChatHistory(data.messages);
                break;
        }
    };

    ws.onerror = function(error) {
        console.error('❌ WebSocket error:', error);
    };

    ws.onclose = function() {
        console.log('🔌 WebSocket connection closed');
    };

    // Add video element event listeners
    const video = document.getElementById('videoPlayer');
    
    video.addEventListener('playing', () => {
        console.log('▶️ Video started playing');
    });

    video.addEventListener('waiting', () => {
        console.log('⏳ Video buffering...');
    });

    video.addEventListener('error', (e) => {
        console.error('❌ Video error:', video.error);
    });
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

// Add HLS handling to check stream availability and initialize player
const videoPlaceholder = document.getElementById('videoPlaceholder');

function initHLS(streamUrl) {
    if (Hls.isSupported()) {
        if (hls) {
            hls.destroy();
        }
        
        hls = new Hls({
            debug: true, // Enable debug logs
            enableWorker: true,
            lowLatencyMode: true,
        });

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log('HLS: Media attached');
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS: Manifest parsed, attempting to play');
            video.style.display = 'block';
            videoPlaceholder.style.display = 'none';
            video.play().catch(e => console.warn('Auto-play failed:', e));
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            console.warn('HLS Error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('HLS: Fatal network error... retrying');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('HLS: Fatal media error... retrying');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.log('HLS: Fatal error... destroying');
                        hls.destroy();
                        break;
                }
            }
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
            video.style.display = 'block';
            videoPlaceholder.style.display = 'none';
            video.play().catch(e => console.warn('Auto-play failed:', e));
        });
    }
}

// Update checkStreamAvailability to handle fallback
function checkStreamAvailability(url, tryLocalhost = true) {
    return fetch(url, { method: 'HEAD' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Stream not available: ${response.status}`);
            }
            console.log('Stream available, initializing HLS');
            initHLS(url);
            return true;
        })
        .catch(error => {
            console.warn('Stream availability check failed:', error);
            if (tryLocalhost && url.includes('watch.stream150.com')) {
                console.log('Trying localhost fallback...');
                const localhostUrl = url.replace('watch.stream150.com', 'localhost');
                return checkStreamAvailability(localhostUrl, false);
            }
            video.style.display = 'none';
            videoPlaceholder.style.display = 'block';
            return false;
        });
}

// Update handleStreamStatusUpdate to use the new URL handling
function handleStreamStatusUpdate(status) {
    console.log('🎥 Stream status update:', status);
    updateStreamStatus(status);
    
    if (status === 'LIVE') {
        const urls = getStreamUrls(false);
        
        // Check stream availability before initializing
        checkStreamAvailability(urls.hls)
            .then(isAvailable => {
                if (isAvailable) {
                    console.log('🟢 Stream is available, initializing player...');
                    initializeStream(false);
                } else {
                    console.log('🟡 Stream not ready yet, retrying in 5 seconds...');
                    setTimeout(() => handleStreamStatusUpdate(status), 5000);
                }
            });
    } else {
        console.log('🔴 Stream is offline');
        destroyStream();
    }
}