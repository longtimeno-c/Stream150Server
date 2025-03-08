console.log('🔍 UI.js loaded and executing');

let hls = null;
let currentStream = null;

function getStreamUrls(useLocalhost = false) {
    const host = useLocalhost ? 'localhost' : 'watch.stream150.com';
    // Always use HTTP for stream server since it doesn't support HTTPS
    return {
        hls: `http://${host}:8000/live/StreamtoME/index.m3u8`,
        flv: `http://${host}:8000/live/StreamtoME.flv`
    };
}

function initializeStream(useLocalhost = false) {
    console.log('🔍 initializeStream called');
    console.log('🎥 Initializing stream player...');
    const video = document.getElementById('videoPlayer');
    const videoContainer = document.querySelector('.video-container');
    
    if (!video || !videoContainer) {
        console.error('Video elements not found');
        return;
    }

    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Connecting to stream...</div>
    `;
    videoContainer.appendChild(loadingIndicator);

    // Add video event listeners
    video.addEventListener('waiting', () => {
        console.log('⏳ Video buffering...');
        loadingIndicator.style.display = 'flex';
        loadingIndicator.querySelector('.loading-text').textContent = 'Buffering...';
    });

    video.addEventListener('playing', () => {
        console.log('▶️ Video playing');
        loadingIndicator.style.display = 'none';
    });

    video.addEventListener('canplay', () => {
        loadingIndicator.style.display = 'none';
    });

    const urls = getStreamUrls(useLocalhost);
    
    if (Hls.isSupported()) {
        console.log('✅ Initializing HLS player');
        if (hls) {
            hls.destroy();
        }
        
        hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000, // 60MB
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = false;
                // Handle mixed content
                if (window.location.protocol === 'https:' && url.startsWith('http:')) {
                    url = url.replace('http:', 'https:');
                }
            },
            manifestLoadPolicy: {
                default: {
                    maxTimeToFirstByteMs: 10000,
                    maxLoadTimeMs: 20000,
                    timeoutRetry: {
                        maxNumRetry: 3,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 8000
                    },
                    errorRetry: {
                        maxNumRetry: 3,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 8000
                    }
                }
            }
        });

        hls.on(Hls.Events.ERROR, function(event, data) {
            console.warn('HLS Error:', data);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('Fatal network error encountered, trying to recover...');
                        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                            // If HTTPS fails, try HTTP
                            const httpUrl = urls.hls.replace('https:', 'http:');
                            console.log('Retrying with HTTP:', httpUrl);
                            hls.loadSource(httpUrl);
                        } else {
                            hls.startLoad();
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('Fatal media error encountered, trying to recover...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error('Fatal error, cannot recover:', data);
                        hls.destroy();
                        break;
                }
            }
        });

        hls.loadSource(urls.hls);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ HLS manifest parsed, attempting playback');
            video.play().catch(e => console.log('❌ Autoplay failed:', e));
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari - fallback to native HLS support
        video.src = urls.hls;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.log('❌ Autoplay failed:', e));
        });
    }

    let connectionTimeout = setTimeout(() => {
        if (!video.readyState) {
            loadingIndicator.querySelector('.loading-text').textContent = 'Connection failed. Retrying...';
            // Attempt to reinitialize
            destroyStream();
            initializeStream(useLocalhost);
        }
    }, 10000); // 10 second timeout

    video.addEventListener('playing', () => {
        console.log('▶️ Video playing');
        loadingIndicator.style.display = 'none';
        clearTimeout(connectionTimeout); // Clear the timeout when video starts playing
    });
}

function destroyStream() {
    console.log('🛑 Destroying stream player...');
    if (currentStream) {
        currentStream.destroy();
        currentStream = null;
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

// Update WebSocket connection handling
function initializeWebSocket() {
    // Determine WebSocket protocol based on page protocol
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    // Remove the port for HTTPS connections
    const port = wsProtocol === 'wss' ? '' : ':3001';
    const wsUrl = `${wsProtocol}://${host}${port}`;
    
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    function connect() {
        try {
            ws = new WebSocket(wsUrl);
            console.log('🔌 Attempting WebSocket connection to:', wsUrl);

            ws.onopen = function() {
                console.log('✅ WebSocket connection established');
                reconnectAttempts = 0;
            };

            ws.onmessage = function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 Received WebSocket message:', data);
                    
                    switch(data.type) {
                        case 'STREAM_STATUS':
                            handleStreamStatusUpdate(data.status);
                            break;
                        case 'VIEWER_COUNT':
                            updateViewerCount(data.viewers);
                            break;
                        case 'CHAT_HISTORY':
                            loadChatHistory(data.messages);
                            break;
                    }
                } catch (error) {
                    console.error('❌ Error processing WebSocket message:', error);
                }
            };

            ws.onerror = function(error) {
                console.error('❌ WebSocket error:', error);
            };

            ws.onclose = function() {
                console.log('🔌 WebSocket connection closed');
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`🔄 Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                    setTimeout(connect, reconnectDelay);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }

    connect();
    return ws;
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 DOM Content Loaded - initializing UI components');

    // Initialize WebSocket connection
    initializeWebSocket();

    // Add fullscreen change event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Add video element event listeners
    const video = document.getElementById('videoPlayer');
    if (video) {
        video.addEventListener('playing', () => {
            console.log('▶️ Video started playing');
        });

        video.addEventListener('waiting', () => {
            console.log('⏳ Video buffering...');
        });

        video.addEventListener('error', (e) => {
            console.error('❌ Video error:', video.error);
        });
    }
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

// Update handleStreamStatusUpdate to use the new URL handling
async function checkStreamAvailability(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) {
            throw new Error(`Stream not available: ${response.status}`);
        }
        return true;
    } catch (error) {
        console.warn('Stream availability check failed:', error);
        return false;
    }
}

function handleStreamStatusUpdate(status) {
    console.log('🎥 Stream status update:', status);
    updateStreamStatus(status);
    
    const statusElement = document.getElementById('status');
    const statusTextElement = document.getElementById('statusText');
    
    if (status === 'LIVE') {
        if (statusElement && statusTextElement) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
            statusTextElement.textContent = 'LIVE';
        }
    } else {
        if (statusElement && statusTextElement) {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
            statusTextElement.textContent = 'OFFLINE';
        }
        destroyStream();
    }
}