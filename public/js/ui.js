console.log('🔍 UI.js loaded and executing');

let hls = null;
let currentStream = null;
let currentUsername = window.currentUsername || 'Anonymous';

// Function to detect mobile devices
function isMobileDevice() {
    return (window.innerWidth <= 768) || 
           (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}

// Function to adjust UI for mobile devices
function adjustForMobile() {
    if (isMobileDevice()) {
        const videoPlayer = document.querySelector('.video-player');
        const controls = document.querySelector('.controls');
        
        // Move controls outside of video-player for mobile
        if (videoPlayer && controls && videoPlayer.contains(controls)) {
            const videoContainer = document.querySelector('.video-container');
            videoPlayer.removeChild(controls);
            videoContainer.appendChild(controls);
        }
    }
}

// Initialize UI components
function initializeUI() {
    console.log('Initializing UI components...');
    
    // Adjust for mobile devices
    adjustForMobile();
    
    // Get current username from UserManager and update immediately
    currentUsername = UserManager.getUsername();
    console.log('Current username on init:', currentUsername);
    
    // Update all username displays with the current username
    updateUsernameDisplays();
    
    // Add username displays to DOM if they don't exist
    addUsernameDisplaysToDOM();
    
    // Also set up a backup to ensure displays exist after a short delay
    // This helps with race conditions where DOM elements might not be ready
    setTimeout(() => {
        ensureUsernameDisplaysExist();
        updateUsernameDisplays(); // Update again after ensuring displays exist
    }, 1000);
    
    // Set up a MutationObserver to watch for DOM changes
    setupMutationObserver();
    
    // Set up periodic username check
    setupPeriodicUsernameCheck();
}

// Call initialization on page load
document.addEventListener('DOMContentLoaded', initializeUI);
window.addEventListener('resize', adjustForMobile);

function getStreamUrls(useLocalhost = false) {
    const host = useLocalhost ? 'localhost' : window.location.hostname;
    const protocol = window.location.protocol;
    // Use same protocol as the page
    return {
        hls: `${protocol}//${host}/live/StreamtoME/index.m3u8`,
        flv: `${protocol}//${host}/live/StreamtoME.flv`
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

    // Add autoplay attributes
    video.autoplay = true;
    video.muted = true; // Initially mute to bypass autoplay restrictions
    video.playsInline = true; // For iOS support
    
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
        // Once playing, we can try to unmute if user has interacted with the page
        if (document.documentElement.hasAttribute('data-user-interacted')) {
            video.muted = false;
        }
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
            debug: true,
            // Add quality level control
            capLevelToPlayerSize: true,
            startLevel: -1, // Auto-select initial quality
            abrEwmaDefaultEstimate: 500000, // Default bandwidth estimate
            abrMaxWithRealBitrate: true,
            // Add compression settings
            maxBufferSize: 30 * 1000 * 1000, // 30MB
            maxBufferLength: 30,
            enableSoftwareAES: true,
            // Add error recovery settings
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 1000,
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

        // Add quality level event listeners
        hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
            console.log(`🔄 Quality Level Changed to ${data.level}`);
        });

        // Improve error handling
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log('🔄 Network error, attempting recovery...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log('🔄 Media error, attempting recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.error('❌ Fatal error:', data);
                        hls.destroy();
                        break;
                }
            }
        });

        hls.loadSource(urls.hls);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            console.log('📡 HLS Manifest parsed, attempting autoplay...');
            video.play().catch(error => {
                console.log('❌ Autoplay failed:', error);
                // Show play button or unmute prompt if needed
                showAutoplayPrompt(video);
            });
            
            const qualities = data.levels.map((level, index) => ({
                index: index,
                bitrate: level.bitrate,
                width: level.width,
                height: level.height,
            }));
            
            updateQualitySelector(qualities, hls);
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari - fallback to native HLS support
        video.src = urls.hls;
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(error => {
                console.log('❌ Autoplay failed:', error);
                showAutoplayPrompt(video);
            });
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
    // Skip for mobile devices as we've hidden the button
    if (isMobileDevice()) {
        console.log('Fullscreen toggle ignored on mobile device');
        return;
    }
    
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

function changeQuality(levelIndex) {
    if (hls) {
        hls.currentLevel = parseInt(levelIndex);
    }
}

function updateQualitySelector(qualities, hls) {
    const selector = document.querySelector('.quality-selector');
    selector.innerHTML = `
        <select onchange="changeQuality(this.value)">
            <option value="-1">Auto</option>
            ${qualities.map(q => `
                <option value="${q.index}">${q.height}p (${Math.round(q.bitrate/1000)} kbps)</option>
            `).join('')}
        </select>
    `;
}

// Listen for username changes
document.addEventListener(UserManager.EVENTS.USERNAME_LOADED, function(e) {
    currentUsername = e.detail.username;
    // Update any UI elements that display the username
    updateUsernameDisplays();
    
    // Ensure username displays are added to UI
    ensureUsernameDisplaysExist();
});

document.addEventListener(UserManager.EVENTS.USERNAME_CHANGED, function(e) {
    currentUsername = e.detail.username;
    // Update any UI elements that display the username
    updateUsernameDisplays();
});

// Update all username displays in the UI
function updateUsernameDisplays() {
    // Get the latest username from UserManager
    const latestUsername = UserManager.getUsername();
    
    // Update our local variable
    currentUsername = latestUsername;
    
    console.log('Updating username displays with:', currentUsername);
    
    // Update all username elements with the current-username class
    const usernameElements = document.querySelectorAll('.current-username');
    usernameElements.forEach(element => {
        if (element.textContent !== currentUsername) {
            element.textContent = currentUsername;
            
            // Add a highlight effect to show the change
            element.classList.add('username-updated');
            setTimeout(() => {
                element.classList.remove('username-updated');
            }, 1500);
        }
    });
}

// Make updateUsernameDisplays available globally
window.updateUsernameDisplays = updateUsernameDisplays;

// Ensure username displays exist in all relevant UI components
function ensureUsernameDisplaysExist() {
    console.log('Ensuring username displays exist...');
    
    // Check if main chat header has username display
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader && !chatHeader.querySelector('.username-display')) {
        console.log('Adding missing username display to main chat header');
        const usernameDisplay = createUsernameDisplay();
        
        // Insert after the h3 element
        const h3Element = chatHeader.querySelector('h3');
        if (h3Element && h3Element.nextSibling) {
            chatHeader.insertBefore(usernameDisplay, h3Element.nextSibling);
        } else {
            chatHeader.appendChild(usernameDisplay);
        }
    }
    
    // Check if mobile chat header has username display
    const mobileChatHeader = document.querySelector('.mobile-chat-header');
    if (mobileChatHeader && !mobileChatHeader.querySelector('.mobile-username-display')) {
        console.log('Adding missing username display to mobile chat header');
        const mobileUsernameDisplay = createMobileUsernameDisplay();
        
        // Insert before the close button
        const closeButton = mobileChatHeader.querySelector('.close-chat-btn');
        if (closeButton) {
            mobileChatHeader.insertBefore(mobileUsernameDisplay, closeButton);
        } else {
            mobileChatHeader.appendChild(mobileUsernameDisplay);
        }
    }
}

// Create a username display element
function createUsernameDisplay() {
    const usernameDisplay = document.createElement('div');
    usernameDisplay.className = 'username-display';
    usernameDisplay.innerHTML = `
        <span>You: <span class="current-username">${currentUsername}</span></span>
        <button class="username-change-btn" onclick="UserManager.changeUsername()">Change</button>
    `;
    return usernameDisplay;
}

// Create a mobile username display element
function createMobileUsernameDisplay() {
    const usernameDisplay = document.createElement('div');
    usernameDisplay.className = 'mobile-username-display';
    usernameDisplay.innerHTML = `
        <span>You: <span class="current-username">${currentUsername}</span></span>
        <button class="username-change-btn" onclick="UserManager.changeUsername()">Change</button>
    `;
    return usernameDisplay;
}

// Update the toggleChat function to include username display
function toggleChat() {
    const chatToggle = document.querySelector('.chat-toggle');
    const mobileChatOverlay = document.getElementById('mobileChatOverlay');
    
    if (mobileChatOverlay.style.display === 'none' || !mobileChatOverlay.style.display) {
        mobileChatOverlay.style.display = 'flex';
        chatToggle.classList.add('active');
        
        // Update mobile chat header with username
        updateMobileChatHeader();
        
        // Copy messages from main chat to mobile chat
        const chatBox = document.getElementById('chatBox');
        const mobileChatBox = document.getElementById('mobileChatBox');
        
        if (chatBox && mobileChatBox) {
            mobileChatBox.innerHTML = chatBox.innerHTML;
            mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
        }
    } else {
        mobileChatOverlay.style.display = 'none';
        chatToggle.classList.remove('active');
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
    // Always use secure WebSocket when page is loaded via HTTPS
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname;
    // Let Caddy handle the routing, so no explicit port needed
    const wsUrl = `${wsProtocol}://${host}/ws`;
    
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

    // Add page interaction detection
    document.addEventListener('click', () => {
        document.documentElement.setAttribute('data-user-interacted', 'true');
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
        
        // Re-adjust for mobile when exiting fullscreen
        if (isMobileDevice()) {
            setTimeout(adjustForMobile, 100); // Small delay to ensure DOM is updated
        }
    } else {
        // Entered fullscreen
        player.classList.add('fullscreen');
        
        // When in fullscreen on mobile, move controls back inside player
        if (isMobileDevice()) {
            const controls = document.querySelector('.controls');
            const videoContainer = document.querySelector('.video-container');
            
            if (controls && videoContainer.contains(controls) && !player.contains(controls)) {
                videoContainer.removeChild(controls);
                player.appendChild(controls);
            }
        }
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

// Add new function to handle autoplay restrictions
function showAutoplayPrompt(video) {
    const prompt = document.createElement('div');
    prompt.className = 'autoplay-prompt';
    prompt.innerHTML = `
        <div class="autoplay-message">
            <p>Click to unmute and play</p>
            <button class="unmute-button">
                <i class="fas fa-volume-mute"></i> Unmute
            </button>
        </div>
    `;
    
    video.parentElement.appendChild(prompt);
    
    prompt.querySelector('.unmute-button').addEventListener('click', () => {
        video.muted = false;
        video.play().catch(console.error);
        prompt.remove();
        document.documentElement.setAttribute('data-user-interacted', 'true');
    });
}

// Function to jump to live stream
function jumpToLive() {
    const video = document.getElementById('videoPlayer');
    const liveBtn = document.querySelector('.live-btn');
    
    // If using HLS.js
    if (window.hls) {
        // Jump to live edge
        window.hls.liveSyncPosition = null;
        window.hls.currentLevel = -1; // Auto quality
        
        // Start playing if paused
        if (video.paused) {
            video.play().catch(e => console.error('Play failed:', e));
        }
        
        // Highlight the live button
        if (liveBtn) {
            liveBtn.classList.remove('inactive');
            // Add a brief animation
            liveBtn.classList.add('pulse');
            setTimeout(() => {
                liveBtn.classList.remove('pulse');
            }, 1000);
        }
        
        console.log('Jumped to live edge of stream');
    }
}

// Add username displays directly to the DOM
function addUsernameDisplaysToDOM() {
    console.log('Adding username displays to DOM...');
    
    // Add to main chat header
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
        // Remove any existing username display to avoid duplicates
        const existingDisplay = chatHeader.querySelector('.username-display');
        if (existingDisplay) {
            chatHeader.removeChild(existingDisplay);
        }
        
        // Create and add the username display
        const usernameDisplay = createUsernameDisplay();
        
        // Insert after the h3 element
        const h3Element = chatHeader.querySelector('h3');
        if (h3Element && h3Element.nextSibling) {
            chatHeader.insertBefore(usernameDisplay, h3Element.nextSibling);
        } else {
            chatHeader.appendChild(usernameDisplay);
        }
        
        console.log('Added username display to main chat header');
    } else {
        console.warn('Chat header not found in DOM');
    }
    
    // Add to mobile chat header
    const mobileChatHeader = document.querySelector('.mobile-chat-header');
    if (mobileChatHeader) {
        // Remove any existing username display to avoid duplicates
        const existingDisplay = mobileChatHeader.querySelector('.mobile-username-display');
        if (existingDisplay) {
            mobileChatHeader.removeChild(existingDisplay);
        }
        
        // Create and add the mobile username display
        const mobileUsernameDisplay = createMobileUsernameDisplay();
        
        // Insert before the close button
        const closeButton = mobileChatHeader.querySelector('.close-chat-btn');
        if (closeButton) {
            mobileChatHeader.insertBefore(mobileUsernameDisplay, closeButton);
        } else {
            mobileChatHeader.appendChild(mobileUsernameDisplay);
        }
        
        console.log('Added username display to mobile chat header');
    }
}

// Set up a MutationObserver to watch for DOM changes
function setupMutationObserver() {
    // Create a MutationObserver to watch for changes to the DOM
    const observer = new MutationObserver((mutations) => {
        // Check if any mutations affected the chat headers
        const chatHeaderMutated = mutations.some(mutation => {
            return mutation.target.classList && 
                  (mutation.target.classList.contains('chat-header') || 
                   mutation.target.classList.contains('mobile-chat-header') ||
                   mutation.target.closest('.chat-header') ||
                   mutation.target.closest('.mobile-chat-header'));
        });
        
        // If chat headers were affected, ensure username displays exist
        if (chatHeaderMutated) {
            console.log('Chat header changed, ensuring username displays exist');
            ensureUsernameDisplaysExist();
        }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
    
    console.log('MutationObserver set up to watch for DOM changes');
}

// Set up periodic check to ensure username is up-to-date
function setupPeriodicUsernameCheck() {
    // Check every 5 seconds
    setInterval(() => {
        const storedUsername = UserManager.getUsername();
        if (storedUsername !== currentUsername) {
            console.log('Username mismatch detected, updating from:', currentUsername, 'to:', storedUsername);
            currentUsername = storedUsername;
            updateUsernameDisplays();
        }
    }, 5000);
}