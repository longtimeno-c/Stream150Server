// js/websocket.js
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

// Chat message handler
function handleChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    const messageElement = createChatMessageElement(message);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Chat history handler
function handleChatHistory(messages) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

    // Clear existing messages
    chatMessages.innerHTML = '';

    // Add each message
    messages.forEach(message => {
        const messageElement = createChatMessageElement(message);
        chatMessages.appendChild(messageElement);
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper function to create chat message elements
function createChatMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'chat-message';
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const username = message.username || 'Anonymous';
    const platform = message.platform || 'web';
    
    div.innerHTML = `
        <span class="chat-timestamp">[${timestamp}]</span>
        <span class="chat-username ${platform}">${username}:</span>
        <span class="chat-text">${escapeHtml(message.message)}</span>
    `;
    
    return div;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initializeWebSocket() {
    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    
    // Create WebSocket connection
    socket = new WebSocket(wsUrl);
    window.socket = socket; // Make it globally available
    
    socket.onopen = () => {
        console.log('WebSocket connection established');
        // Dispatch connection event
        document.dispatchEvent(new CustomEvent('websocket-connected'));
        reconnectAttempts = 0;
        
        // Request initial states
        socket.send(JSON.stringify({ type: 'REQUEST_POLL_STATE' }));
        socket.send(JSON.stringify({ type: 'REQUEST_CHAT_HISTORY' }));
        socket.send(JSON.stringify({ type: 'REQUEST_STREAM_STATUS' }));
        
        // Update UI to show connected state
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('connected');
            el.classList.remove('disconnected');
        });
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);
            
            // Dispatch message event for all messages
            document.dispatchEvent(new CustomEvent('websocket-message', {
                detail: data
            }));
            
            // Also dispatch specific event types for better modularity
            document.dispatchEvent(new CustomEvent(`ws-${data.type.toLowerCase()}`, {
                detail: data
            }));
            
            // Handle different message types
            switch(data.type) {
                case 'CHAT_MESSAGE':
                    handleChatMessage(data);
                    break;
                    
                case 'CHAT_HISTORY':
                    handleChatHistory(data.messages);
                    break;
                    
                case 'POLL_UPDATE':
                    console.log('Poll update received:', data.poll);
                    break;
                    
                case 'POLL_END':
                    console.log('Poll ended:', data);
                    break;
                    
                case 'VIEWER_COUNT':
                    if (typeof updateViewerCount === 'function') {
                        updateViewerCount(data.viewers);
                    }
                    break;
                    
                case 'STREAM_STATUS':
                    console.log('Stream status update received:', data);
                    handleStreamStatusUpdate(data);
                    break;
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        document.dispatchEvent(new CustomEvent('websocket-error', { detail: error }));
        
        // Update UI to show error state
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('disconnected');
            el.classList.remove('connected');
        });
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed');
        document.dispatchEvent(new CustomEvent('websocket-closed'));
        
        // Update UI to show disconnected state
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('disconnected');
            el.classList.remove('connected');
        });
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(initializeWebSocket, reconnectDelay);
        } else {
            console.error('Maximum reconnection attempts reached');
        }
    };
}

function updateViewerCount(count) {
    const viewerCountElement = document.getElementById('viewerCount');
    if (viewerCountElement) {
        viewerCountElement.textContent = count;
    }
}

// Add stream status update handler
function handleStreamStatusUpdate(data) {
    // Update stream status in the UI
    const streamStatusElement = document.getElementById('streamStatus');
    const streamIndicator = document.getElementById('streamIndicator');
    const streamStatusMobile = document.getElementById('streamStatusMobile');
    
    const isLive = data.status === 'LIVE';
    
    // Update status text elements
    if (streamStatusElement) {
        streamStatusElement.textContent = isLive ? 'LIVE' : 'OFFLINE';
        streamStatusElement.className = isLive ? 'status-live' : 'status-offline';
    }
    
    if (streamStatusMobile) {
        streamStatusMobile.textContent = isLive ? 'LIVE' : 'OFFLINE';
        streamStatusMobile.className = isLive ? 'status-live' : 'status-offline';
    }
    
    // Update stream indicator if it exists
    if (streamIndicator) {
        streamIndicator.className = isLive ? 'stream-indicator live' : 'stream-indicator offline';
    }
    
    // Update viewer count if provided
    if (typeof data.viewers !== 'undefined' && typeof updateViewerCount === 'function') {
        updateViewerCount(data.viewers);
    }
    
    // Dispatch stream status event for other components
    document.dispatchEvent(new CustomEvent('stream-status-changed', {
        detail: { isLive, viewers: data.viewers }
    }));
}

// Initialize WebSocket when the page loads
document.addEventListener('DOMContentLoaded', initializeWebSocket);