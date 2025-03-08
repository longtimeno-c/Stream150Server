const WebSocket = require('ws');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
        console.log('New client connected');
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                // Handle incoming messages
                console.log('Received:', data);
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });
        
        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
    
    return wss;
}

module.exports = { setupWebSocket };