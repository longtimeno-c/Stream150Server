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
    console.log('Quality changed to:', quality);
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
    } else {
        videoPlaceholder.style.display = 'flex';
        videoPlayer.style.display = 'none';
        videoPlaceholder.textContent = 'Waiting for stream...';
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