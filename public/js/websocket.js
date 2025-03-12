// js/websocket.js
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

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
        
        // Request current poll state when connection is established
        socket.send(JSON.stringify({
            type: 'REQUEST_POLL_STATE'
        }));
        
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
            
            // Handle different message types
            switch(data.type) {
                case 'CHAT_MESSAGE':
                    // Handle individual chat message
                    if (typeof handleChatMessage === 'function') {
                        handleChatMessage(data);
                    }
                    break;
                    
                case 'CHAT_HISTORY':
                    // Handle chat history
                    if (typeof handleChatHistory === 'function') {
                        handleChatHistory(data.messages);
                    }
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
                    console.log('Stream status update received:', data.status);
                    if (typeof window.handleStreamStatusUpdate === 'function') {
                        window.handleStreamStatusUpdate(data.status);
                    } else if (typeof window.updateStreamStatus === 'function') {
                        window.updateStreamStatus(data.status === 'LIVE');
                    }
                    if (typeof updateViewerCount === 'function' && data.viewers !== undefined) {
                        updateViewerCount(data.viewers);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        
        // Update UI to show error state
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('disconnected');
            el.classList.remove('connected');
        });
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed');
        
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

// Initialize WebSocket when the page loads
document.addEventListener('DOMContentLoaded', initializeWebSocket);