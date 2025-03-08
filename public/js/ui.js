function toggleFullscreen() {
    const player = document.querySelector('.video-player');
    if (!document.fullscreenElement) {
        player.requestFullscreen();
    } else {
        document.exitFullscreen();
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
    
    statusText.textContent = data.status;
    statusElement.className = 'status-indicator ' + 
        (data.status === 'LIVE' ? 'live' : 'offline');
    videoPlaceholder.textContent = 
        data.status === 'LIVE' ? 'Stream is Live!' : 'Waiting for stream...';
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
}); 