const ws = new WebSocket('ws://localhost:3001');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'STREAM_STATUS') {
        updateStreamStatus(data);
    } else if (data.type === 'VIEWER_COUNT') {
        updateViewerCount(data.viewers);
    } else if (data.type === 'CHAT_HISTORY') {
        loadChatHistory(data.messages);
    } else if (data.type === 'CHAT_MESSAGE') {
        handleNewChatMessage(data);
    }
};

ws.onopen = () => {
    console.log('Connected to chat server');
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from chat server');
    setTimeout(() => {
        window.location.reload();
    }, 5000);
}; 