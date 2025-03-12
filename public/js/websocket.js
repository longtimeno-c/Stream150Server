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
            
            // Dispatch message event
            document.dispatchEvent(new CustomEvent('websocket-message', {
                detail: data
            }));
            
            // Handle stream status updates
            if (data.type === 'STREAM_STATUS') {
                console.log('Stream status update received:', data.status);
                if (typeof updateStreamStatus === 'function') {
                    updateStreamStatus(data.status === 'LIVE');
                } else {
                    console.log('Stream status update functions not available');
                }
                if (typeof updateViewerCount === 'function' && data.viewers !== undefined) {
                    updateViewerCount(data.viewers);
                }
            }
            
            // Handle viewer count updates
            if (data.type === 'VIEWER_COUNT' && typeof updateViewerCount === 'function') {
                updateViewerCount(data.viewers);
            }
            
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
                case 'POLL_UPDATE':
                case 'POLL_END':
                    console.log('Poll message received:', data);
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