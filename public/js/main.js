// Main functionality and utility functions
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
        const overlay = document.getElementById('mobileChatOverlay');
        if (overlay.style.display === 'flex') {
            overlay.style.display = 'none';
        } else {
            overlay.style.display = 'flex';
            document.getElementById('mobileChatBox').scrollTop = 
                document.getElementById('mobileChatBox').scrollHeight;
            document.getElementById('mobileChatInput').focus();
        }
    }
}

// Add any other general utility functions here 