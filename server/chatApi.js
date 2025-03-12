const WebSocket = require('ws');
const crypto = require('crypto');

class ChatAPI {
    constructor() {
        this.apiClients = new Map(); // Store authenticated API clients
        this.apiKeys = new Set(); // Store valid API keys
    }

    initialize(server) {
        // Create a new WebSocket server for the API
        this.wss = new WebSocket.Server({ 
            server,
            path: '/api/chat'
        });

        this.setupWebSocketHandlers();
    }

    // Generate a new API key
    generateApiKey() {
        const apiKey = crypto.randomBytes(32).toString('hex');
        this.apiKeys.add(apiKey);
        return apiKey;
    }

    // Remove an API key
    removeApiKey(apiKey) {
        this.apiKeys.delete(apiKey);
    }

    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, req) => {
            console.log('New API client attempting to connect');

            // Handle authentication
            ws.isAuthenticated = false;

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);

                    // Handle authentication
                    if (data.type === 'AUTH') {
                        if (this.apiKeys.has(data.apiKey)) {
                            ws.isAuthenticated = true;
                            this.apiClients.set(ws, data.apiKey);
                            ws.send(JSON.stringify({
                                type: 'AUTH_SUCCESS',
                                message: 'Successfully authenticated'
                            }));
                            console.log('API client authenticated successfully');
                        } else {
                            ws.send(JSON.stringify({
                                type: 'AUTH_ERROR',
                                message: 'Invalid API key'
                            }));
                            ws.close();
                        }
                        return;
                    }

                    // Reject non-authenticated messages
                    if (!ws.isAuthenticated) {
                        ws.send(JSON.stringify({
                            type: 'ERROR',
                            message: 'Not authenticated'
                        }));
                        return;
                    }

                    // Handle other message types
                    switch (data.type) {
                        case 'PING':
                            ws.send(JSON.stringify({
                                type: 'PONG',
                                timestamp: Date.now()
                            }));
                            break;
                    }
                } catch (error) {
                    console.error('Error processing API message:', error);
                }
            });

            ws.on('close', () => {
                if (this.apiClients.has(ws)) {
                    this.apiClients.delete(ws);
                }
                console.log('API client disconnected');
            });
        });
    }

    // Broadcast chat message to all authenticated API clients
    broadcastChatMessage(message) {
        const chatMessage = {
            type: 'CHAT_MESSAGE',
            platform: message.platform || 'web',
            username: message.username || 'Anonymous',
            message: message.message,
            timestamp: message.timestamp || new Date().toISOString()
        };

        this.apiClients.forEach((apiKey, ws) => {
            if (ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(chatMessage));
            }
        });
    }
}

module.exports = new ChatAPI(); 