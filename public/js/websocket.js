// js/websocket.js
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

function initializeWebSocket() {
    // Determine WebSocket URL based on current environment
    const isProduction = window.location.hostname === 'watch.stream150.com';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const wsUrl = isProduction ? `${wsProtocol}://${host}/ws` : `ws://localhost:3001`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    
    // Create WebSocket connection
    socket = new WebSocket(wsUrl);
    window.socket = socket; // Make it globally available
    
    socket.onopen = function() {
        console.log('WebSocket connection established');
        reconnectAttempts = 0;
        
        // Update UI to show connected state
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('connected');
            el.classList.remove('disconnected');
        });
    };
    
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);
            
            // Dispatch custom event for other modules to listen to
            const wsEvent = new CustomEvent('ws-message', { detail: data });
            document.dispatchEvent(wsEvent);
            
            // Handle specific message types directly
            switch(data.type) {
                case 'VIEWER_COUNT':
                    updateViewerCount(data.viewers);
                    break;
                case 'STREAM_STATUS':
                    console.log('Stream status update received:', data.status);
                    // Check if the handleStreamStatusUpdate function is available
                    if (typeof window.handleStreamStatusUpdate === 'function') {
                        window.handleStreamStatusUpdate(data.status);
                    } else if (typeof window.updateStreamStatus === 'function') {
                        // Fallback to updateStreamStatus if handleStreamStatusUpdate is not available
                        window.updateStreamStatus(data.status);
                    } else {
                        console.error('Stream status update functions not available');
                        // Direct DOM manipulation as a last resort
                        const statusElement = document.getElementById('status');
                        const statusTextElement = document.getElementById('statusText');
                        
                        if (statusElement && statusTextElement) {
                            if (data.status === 'LIVE') {
                                statusElement.classList.remove('offline');
                                statusElement.classList.add('online');
                                statusTextElement.textContent = 'LIVE';
                            } else {
                                statusElement.classList.remove('online');
                                statusElement.classList.add('offline');
                                statusTextElement.textContent = data.status || 'OFFLINE';
                            }
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        
        // Update UI to show error state
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('disconnected');
            el.classList.remove('connected');
        });
    };
    
    socket.onclose = function() {
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