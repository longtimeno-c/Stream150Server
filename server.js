const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const NodeMediaServer = require('node-media-server');
const EventEmitter = require('events')

const STREAM_KEY = 'StreamtoME';
const CHAT_HISTORY_FILE = path.join(__dirname, 'data', 'chat_history.json');
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

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    console.log('404 - Not Found:', req.url);
    res.status(404).send('Not Found');
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
                
                // Save immediately after each message
                saveChatHistory();
                
                // Broadcast to ALL clients INCLUDING sender
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

// Save chat history more frequently (every minute)
setInterval(saveChatHistory, 60 * 1000);

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

// Configure Node-Media-Server
const nmsConfig = {
    rtmp: {
        host: 'localhost',
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
    },
    http: {
        host: 'localhost',
        port: 8000,
        allow_origin: '*',
        mediaroot: './media'
    },
    trans: {
        ffmpeg: 'ffmpeg',
        tasks: [
            {
                app: 'live',
                hls: true,
                hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
                hlsKeep: true,
            }
        ]
    }
};

// Create RTMP server instance
const nms = new NodeMediaServer(nmsConfig);

// Extend nms with EventEmitter if needed (fallback)
if (typeof nms.on !== 'function') {
    Object.setPrototypeOf(nms, EventEmitter.prototype);
    EventEmitter.call(nms);
}

console.log('NMS instance before run:', nms);

// Start the server
nms.httpServer.run();
nms.rtmpServer.run();
console.log('NMS started (HTTP and RTMP servers running)');

// Attach event listeners AFTER running the server
nms.on('prePublish', (id, StreamPath, args) => {
    //console.log(`[NodeEvent on prePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    let stream_key = StreamPath.split('/')[2];
    let session = nms.getSession(id);

    if (stream_key === STREAM_KEY) {
        isStreaming = true;
        broadcast({ 
            type: 'STREAM_STATUS', 
            status: 'LIVE',
            viewers: viewerCount 
        });
        session.publishSuccess(); // Allow the stream to proceed
    } else {
        session.reject(); // Reject unauthorized streams
        console.log(`Rejected stream with key: ${stream_key}`);
    }
});

nms.on('donePublish', (id, StreamPath, args) => {
    //console.log(`[NodeEvent on donePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    isStreaming = false;
    broadcast({ 
        type: 'STREAM_STATUS', 
        status: 'OFFLINE',
        viewers: viewerCount 
    });
});

server.listen(3001, () => {
    console.log('Backend server running on:');
    console.log('- Web: http://localhost:3001');
    console.log('- RTMP: rtmp://localhost:1935/live');
    console.log('- HLS: http://localhost:8000/live');
});