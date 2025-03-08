// js/websocket.js
const socket = new WebSocket('ws://localhost:3001');

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