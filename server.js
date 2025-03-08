const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const STREAM_KEY = 'StreamtoME';
const CHAT_HISTORY_FILE = path.join(__dirname, 'chat_history.json');
const MAX_CHAT_HISTORY = 1000; // Increased for better continuity

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isStreaming = false;
let viewerCount = 0;
let chatHistory = [];

// Load chat history from file
function loadChatHistory() {
    try {
        if (fs.existsSync(CHAT_HISTORY_FILE)) {
            const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
            chatHistory = JSON.parse(data);
            console.log(`Loaded ${chatHistory.length} messages from chat history`);
            
            // Clean up old messages if exceeding max
            if (chatHistory.length > MAX_CHAT_HISTORY) {
                chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
                saveChatHistory(); // Save the cleaned up history
            }
        }
    } catch (err) {
        console.error('Error loading chat history:', err);
        chatHistory = [];
    }
}

// Save chat history to file
function saveChatHistory() {
    try {
        fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
        console.error('Error saving chat history:', err);
    }
}

// Initialize
loadChatHistory();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    viewerCount++;
    
    // Send initial status
    ws.send(JSON.stringify({ 
        type: 'STREAM_STATUS', 
        status: isStreaming ? 'LIVE' : 'OFFLINE',
        viewers: viewerCount 
    }));

    // Send chat history as a single batch
    ws.send(JSON.stringify({
        type: 'CHAT_HISTORY',
        messages: chatHistory
    }));

    // Add a ping interval to keep connection alive
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'CHAT_MESSAGE') {
                const chatMessage = {
                    type: 'CHAT_MESSAGE',
                    platform: data.platform || 'web',
                    message: data.message,
                    username: data.username || 'Anonymous',
                    timestamp: new Date().toISOString(),
                    id: Date.now().toString()
                };
                
                // Add to chat history
                chatHistory.push(chatMessage);
                
                // Maintain maximum history size
                if (chatHistory.length > MAX_CHAT_HISTORY) {
                    chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
                }
                
                // Broadcast to ALL clients EXCEPT sender
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(chatMessage));
                    }
                });
                
                // Save periodically
                if (chatHistory.length % 10 === 0) {
                    saveChatHistory();
                }
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        clearInterval(pingInterval);
        viewerCount--;
        broadcast({ 
            type: 'VIEWER_COUNT', 
            viewers: viewerCount 
        });
    });

    ws.on('error', (error) => {
        clearInterval(pingInterval);
        console.error('WebSocket error:', error);
    });
});

// Update broadcast function to be more robust
function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (err) {
                console.error('Error broadcasting message:', err);
            }
        }
    });
}

// Save chat history periodically (every 5 minutes)
setInterval(saveChatHistory, 5 * 60 * 1000);

app.post('/authenticate', (req, res) => {
    const { name } = req.body;
    if (name === STREAM_KEY) {
        isStreaming = true;
        broadcast({ 
            type: 'STREAM_STATUS', 
            status: 'LIVE',
            viewers: viewerCount 
        });
        res.status(200).send('OK');
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/stream-ended', (req, res) => {
    isStreaming = false;
    broadcast({ 
        type: 'STREAM_STATUS', 
        status: 'OFFLINE',
        viewers: viewerCount 
    });
    res.status(200).send('Stream Ended');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Saving chat history before exit...');
    saveChatHistory();
    process.exit();
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    saveChatHistory(); // Save chat history on crash
});

server.listen(3001, () => {
    console.log('Backend server running on http://localhost:3001');
});