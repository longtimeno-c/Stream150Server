const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { setupWebSocket } = require('./public/js/websocket');

const STREAM_KEY = 'StreamtoME';
const CHAT_HISTORY_FILE = path.join(__dirname, 'data', 'chat_history.json');
const MAX_CHAT_HISTORY = 1000; // Increased for better continuity

const app = express();
const server = http.createServer(app);

let isStreaming = false;
let viewerCount = 0;
let chatHistory = [];

// Load chat history from file
function loadChatHistory() {
    try {
        // Ensure data directory exists
        const dir = path.dirname(CHAT_HISTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(CHAT_HISTORY_FILE)) {
            const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
            chatHistory = JSON.parse(data || '[]');
            console.log(`Loaded ${chatHistory.length} messages from chat history`);
            
            // Clean up old messages if exceeding max
            if (chatHistory.length > MAX_CHAT_HISTORY) {
                chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
                saveChatHistory(); // Save the cleaned up history
            }
        } else {
            // Create the file if it doesn't exist
            fs.writeFileSync(CHAT_HISTORY_FILE, '[]');
            chatHistory = [];
            console.log('Created new chat history file');
        }
    } catch (err) {
        console.error('Error loading chat history:', err);
        chatHistory = [];
    }
}

// Save chat history to file
function saveChatHistory() {
    try {
        // Ensure data directory exists
        const dir = path.dirname(CHAT_HISTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
        console.log(`Saved ${chatHistory.length} messages to chat history`);
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

// Set up WebSocket
const wss = setupWebSocket(server);

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

// Ensure chat history is saved on exit
process.on('SIGINT', () => {
    console.log('Saving chat history before exit...');
    saveChatHistory();
    process.exit();
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    saveChatHistory();
});

// Add broadcast function that was referenced but missing
function broadcast(message) {
    if (!wss) return;
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Add error handling for the server
server.on('error', (error) => {
    console.error('Server error:', error);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
    } else {
        console.error('Error starting server:', error);
    }
    process.exit(1);
});