const WebSocket = require('ws');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ 
        server,
        // Add error handling for the WebSocket server
        clientTracking: true,
        handleProtocols: true
    });
    
    wss.on('connection', (ws, req) => {
        console.log('New client connected from:', req.socket.remoteAddress);
        
        // Send initial state to new client
        ws.send(JSON.stringify({
            type: 'STREAM_STATUS',
            status: isStreaming ? 'LIVE' : 'OFFLINE',
            viewers: viewerCount
        }));
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('Received:', data);
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket client error:', error);
        });
        
        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
    
    wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
    });
    
    return wss;
}

module.exports = { setupWebSocket };