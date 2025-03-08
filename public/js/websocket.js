// js/websocket.js
const isProduction = window.location.hostname === 'watch.stream150.com';
const wsProtocol = isProduction ? 'wss' : 'ws';
const host = isProduction ? 'watch.stream150.com' : 'localhost';
const wsPort = isProduction ? '' : ':3001';
const wsUrl = `${wsProtocol}://${host}${wsPort}${isProduction ? '/ws' : ''}`;

const socket = new WebSocket(wsUrl);

socket.onopen = () => {
    console.log('WebSocket connected');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case 'VIEWER_COUNT':
            updateViewerCount(data.viewers);
            break;
        case 'CHAT_MESSAGE':
            // Handle chat messages (implemented elsewhere)
            break;
        case 'CHAT_HISTORY':
            // Handle chat history
            break;
    }
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

socket.onclose = () => {
    console.log('WebSocket closed');
};

function updateViewerCount(count) {
    document.getElementById('viewerCount').textContent = count;
}