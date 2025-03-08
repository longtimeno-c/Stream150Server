let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function initializeWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts = 0;
        updateConnectionStatus(true);
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionStatus(false);
        
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(initializeWebSocket, 3000 * reconnectAttempts);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'CHAT_MESSAGE':
                case 'CHAT_HISTORY':
                    handleNewChatMessage(data);
                    break;
                case 'VIEWER_COUNT':
                    updateViewerCount(data.count);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };
}

function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    
    if (connected) {
        statusDot.style.backgroundColor = '#ff4444';
        statusDot.style.boxShadow = '0 0 6px #ff4444';
        statusText.textContent = 'LIVE';
    } else {
        statusDot.style.backgroundColor = '#666';
        statusDot.style.boxShadow = 'none';
        statusText.textContent = 'OFFLINE';
    }
}

function updateViewerCount(count) {
    const viewerCountElements = document.querySelectorAll('.viewer-count');
    viewerCountElements.forEach(element => {
        element.textContent = `${count} ${count === 1 ? 'viewer' : 'viewers'}`;
    });
}

// Initialize WebSocket when the page loads
document.addEventListener('DOMContentLoaded', initializeWebSocket); 