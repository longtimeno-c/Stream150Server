const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const NodeMediaServer = require('node-media-server');

const STREAM_KEY = 'StreamtoME';
const CHAT_HISTORY_FILE = path.join(__dirname, 'data', 'chat_history.json');
const MAX_CHAT_HISTORY = 1000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isStreaming = false;
let viewerCount = 0;
let chatHistory = [];

// Load chat history from file
function loadChatHistory() {
    try {
        const dir = path.dirname(CHAT_HISTORY_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(CHAT_HISTORY_FILE)) {
            const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
            chatHistory = JSON.parse(data || '[]');
            if (chatHistory.length > MAX_CHAT_HISTORY) {
                chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
            }
            console.log(`Loaded ${chatHistory.length} messages from chat history`);
        } else {
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
        fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
        console.log(`Saved ${chatHistory.length} messages to chat history`);
    } catch (err) {
        console.error('Error saving chat history:', err);
    }
}

// Initialize chat history
loadChatHistory();

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Error loading page');
        }
    });
});

app.use((req, res) => {
    res.status(404).send('Not Found');
});

// WebSocket handling
wss.on('connection', (ws) => {
    viewerCount++;
    
    ws.send(JSON.stringify({ 
        type: 'STREAM_STATUS', 
        status: isStreaming ? 'LIVE' : 'OFFLINE',
        viewers: viewerCount 
    }));
    
    ws.send(JSON.stringify({ 
        type: 'CHAT_HISTORY', 
        messages: chatHistory 
    }));

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
                chatHistory.push(chatMessage);
                if (chatHistory.length > MAX_CHAT_HISTORY) {
                    chatHistory.shift(); // Remove oldest message
                }
                saveChatHistory();
                broadcast(chatMessage);
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
        console.error('WebSocket error:', error);
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Periodic chat history save
setInterval(saveChatHistory, 60 * 1000);

// Stream authentication endpoint
app.post('/authenticate', (req, res) => {
    const { name } = req.body;
    if (name === STREAM_KEY) {
        isStreaming = true;
        broadcast({ type: 'STREAM_STATUS', status: 'LIVE', viewers: viewerCount });
        res.status(200).send('OK');
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/stream-ended', (req, res) => {
    isStreaming = false;
    broadcast({ type: 'STREAM_STATUS', status: 'OFFLINE', viewers: viewerCount });
    res.status(200).send('Stream Ended');
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('Saving chat history before exit...');
    saveChatHistory();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    saveChatHistory();
});

// Node-Media-Server configuration
const nmsConfig = {
    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        port: 8000,
        allow_origin: '*',
        mediaroot: './media'
    }
};

const nms = new NodeMediaServer(nmsConfig);

nms.on('prePublish', (id, StreamPath) => {
    const streamKey = StreamPath.split('/')[2];
    if (streamKey === STREAM_KEY) {
        isStreaming = true;
        broadcast({ type: 'STREAM_STATUS', status: 'LIVE', viewers: viewerCount });
        console.log(`Stream started with key: ${streamKey}`);
    } else {
        const session = nms.getSession(id);
        session.reject();
        console.log(`Rejected stream with invalid key: ${streamKey}`);
    }
});

nms.on('donePublish', () => {
    isStreaming = false;
    broadcast({ type: 'STREAM_STATUS', status: 'OFFLINE', viewers: viewerCount });
    console.log('Stream ended');
});

nms.run();

// Start the server
server.listen(3001, () => {
    console.log('Server running on:');
    console.log('- Web: http://localhost:3001');
    console.log('- RTMP: rtmp://localhost:1935/live');
    console.log('- HLS: http://localhost:8000/live');
});