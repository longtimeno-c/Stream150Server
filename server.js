const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const NodeMediaServer = require('node-media-server');
const EventEmitter = require('events');
const PollManager = require('./server/pollManager');

const STREAM_KEY = 'StreamtoME';
const CHAT_HISTORY_FILE = path.join(__dirname, 'data', 'chat_history.json');
const MAX_CHAT_HISTORY = 100;

const HIGHLIGHTS_FILE = path.join(__dirname, 'data', 'highlights.json');
const MAX_HIGHLIGHTS = 6;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isStreaming = false;
let viewerCount = 0;
let chatHistory = [];
let highlights = [];

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

// Load highlights from file
function loadHighlights() {
    try {
        // Ensure data directory exists
        const dir = path.dirname(HIGHLIGHTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(HIGHLIGHTS_FILE)) {
            const data = fs.readFileSync(HIGHLIGHTS_FILE, 'utf8');
            highlights = JSON.parse(data || '[]');
            console.log(`Loaded ${highlights.length} highlights from file`);
            
            // Clean up if exceeding max
            if (highlights.length > MAX_HIGHLIGHTS) {
                highlights = highlights.slice(-MAX_HIGHLIGHTS);
                saveHighlights(); // Save the cleaned up highlights
            }
        } else {
            // Create the file if it doesn't exist
            fs.writeFileSync(HIGHLIGHTS_FILE, '[]');
            highlights = [];
            console.log('Created new highlights file');
        }
    } catch (err) {
        console.error('Error loading highlights:', err);
        highlights = [];
    }
}

// Save highlights to file
function saveHighlights() {
    try {
        // Ensure data directory exists
        const dir = path.dirname(HIGHLIGHTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
        
        fs.writeFileSync(HIGHLIGHTS_FILE, JSON.stringify(highlights, null, 2));
        console.log(`Saved ${highlights.length} highlights to file: ${HIGHLIGHTS_FILE}`);
    } catch (err) {
        console.error('Error saving highlights:', err);
    }
}

// Add a highlight
function addHighlight(highlight) {
    // Ensure we don't exceed the maximum
    if (highlights.length >= MAX_HIGHLIGHTS) {
        // Remove the oldest highlight
        highlights.shift();
    }
    
    // Add the new highlight
    highlights.push(highlight);
    
    // Save to file
    saveHighlights();
    
    // Broadcast the updated highlights
    broadcastHighlights();
}

// Remove a highlight
function removeHighlight(id) {
    const index = highlights.findIndex(h => h.id === id);
    if (index !== -1) {
        highlights.splice(index, 1);
        saveHighlights();
        broadcastHighlights();
        return true;
    }
    return false;
}

// Broadcast highlights to all connected clients
function broadcastHighlights() {
    broadcast({
        type: 'HIGHLIGHTS_UPDATE',
        highlights: highlights
    });
}

// Initialize
loadChatHistory();
loadHighlights();

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

// Proxy HLS requests to the media server
app.get('/live/:stream/:file', (req, res) => {
    const stream = req.params.stream;
    const file = req.params.file;
    const hlsUrl = `http://localhost:8000/live/${stream}/${file}`;
    
    console.log(`📡 Proxying HLS request to: ${hlsUrl}`);
    
    // Set appropriate headers for HLS content
    if (file.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (file.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
    }
    
    // Improved proxy implementation with error handling
    const proxyReq = http.get(hlsUrl, (proxyRes) => {
        // Copy all headers from the proxied response
        Object.keys(proxyRes.headers).forEach(key => {
            res.setHeader(key, proxyRes.headers[key]);
        });
        
        // Set status code
        res.status(proxyRes.statusCode);
        
        // Pipe the response data
        proxyRes.pipe(res);
        
        // Log success
        console.log(`✅ Successfully proxied HLS request: ${file} (${proxyRes.statusCode})`);
    });
    
    proxyReq.on('error', (err) => {
        console.error(`❌ Error proxying HLS request for ${file}:`, err);
        if (!res.headersSent) {
            res.status(502).send(`Error proxying HLS request: ${err.message}`);
        }
    });
    
    // Handle client disconnect
    req.on('close', () => {
        proxyReq.destroy();
    });
});

// Add a catch-all route for HLS segments that might have different patterns
app.get('/live/:stream/*', (req, res) => {
    const stream = req.params.stream;
    const pathParts = req.path.split('/');
    const file = pathParts[pathParts.length - 1];
    const hlsUrl = `http://localhost:8000${req.path}`;
    
    console.log(`📡 Proxying additional HLS request to: ${hlsUrl}`);
    
    // Set appropriate headers based on file extension
    if (file.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (file.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
    }
    
    // Proxy the request
    const proxyReq = http.get(hlsUrl, (proxyRes) => {
        Object.keys(proxyRes.headers).forEach(key => {
            res.setHeader(key, proxyRes.headers[key]);
        });
        res.status(proxyRes.statusCode);
        proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
        console.error(`❌ Error proxying additional HLS request:`, err);
        if (!res.headersSent) {
            res.status(502).send(`Error proxying request: ${err.message}`);
        }
    });
    
    req.on('close', () => {
        proxyReq.destroy();
    });
});

// Add this route to check if the HLS stream exists
app.get('/check-stream', (req, res) => {
    const hlsUrl = `http://localhost:8000/live/StreamtoME/index.m3u8`;
    
    console.log(`🔍 Checking if HLS stream exists at: ${hlsUrl}`);
    
    const checkReq = http.get(hlsUrl, (checkRes) => {
        console.log(`✅ HLS stream check result: ${checkRes.statusCode}`);
        
        res.json({
            exists: checkRes.statusCode === 200,
            statusCode: checkRes.statusCode,
            isStreaming: isStreaming
        });
    });
    
    checkReq.on('error', (err) => {
        console.error(`❌ Error checking HLS stream:`, err);
        res.status(500).json({
            exists: false,
            error: err.message,
            isStreaming: isStreaming
        });
    });
});

// Then your existing routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// This should be the LAST route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    console.log('404 - Not Found:', req.url);
    res.status(404).send('Not Found');
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    viewerCount++;
    
    // Send initial stream status and viewer count
    ws.send(JSON.stringify({ 
        type: 'STREAM_STATUS', 
        status: isStreaming ? 'LIVE' : 'OFFLINE',
        viewers: viewerCount 
    }));

    // Send current poll if exists
    const currentPoll = PollManager.getCurrentPoll();
    if (currentPoll) {
        console.log('Sending current poll to new client:', currentPoll);
        ws.send(JSON.stringify({
            type: 'POLL_UPDATE',
            poll: currentPoll
        }));
    } else {
        console.log('No active poll to send to new client');
    }
    
    // Send initial highlights
    ws.send(JSON.stringify({
        type: 'HIGHLIGHTS_UPDATE',
        highlights: highlights
    }));
    
    // Ensure all chat messages have the proper format before sending
    const recentMessages = chatHistory.slice(-50).map(msg => {
        // If it's a string, convert it to a proper message object
        if (typeof msg === 'string') {
            return {
                type: 'CHAT_MESSAGE',
                platform: 'web',
                username: 'Anonymous',
                message: msg,
                timestamp: new Date().toISOString(),
                id: Date.now().toString()
            };
        }
        // If it's already an object but missing fields, add defaults
        if (typeof msg === 'object') {
            return {
                type: msg.type || 'CHAT_MESSAGE',
                platform: msg.platform || 'web',
                username: msg.username || 'Anonymous',
                message: msg.message || '',
                timestamp: msg.timestamp || new Date().toISOString(),
                id: msg.id || Date.now().toString()
            };
        }
        return msg;
    });
    
    console.log(`Sending ${recentMessages.length} recent chat messages to new client`);
    
    ws.send(JSON.stringify({
        type: 'CHAT_HISTORY',
        messages: recentMessages
    }));
    
    // Broadcast updated viewer count
    broadcast({
        type: 'VIEWER_COUNT',
        viewers: viewerCount
    });
    
    // Handle incoming messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received WebSocket message:', data);
            
            if (data.type === 'CHAT_MESSAGE') {
                // Format the chat message
                const chatMessage = {
                    type: 'CHAT_MESSAGE',
                    platform: data.platform || 'web',
                    username: data.username || 'Anonymous',
                    message: data.message,
                    timestamp: new Date().toISOString(),
                    id: Date.now().toString()
                };
                
                // Add to chat history
                chatHistory.push(chatMessage);
                console.log(`Added message to chat history. Total: ${chatHistory.length}`);
                
                // Maintain maximum history size
                if (chatHistory.length > MAX_CHAT_HISTORY) {
                    chatHistory.shift();
                }
                
                // Save chat history periodically (every 10 messages)
                if (chatHistory.length % 10 === 0) {
                    saveChatHistory();
                }
                
                // Broadcast to all clients
                broadcast(chatMessage);
            } else if (data.type === 'REQUEST_CHAT_HISTORY') {
                console.log('Client requested chat history');
                
                // Ensure all chat messages have the proper format before sending
                const recentMessages = chatHistory.slice(-50).map(msg => {
                    // If it's a string, convert it to a proper message object
                    if (typeof msg === 'string') {
                        return {
                            type: 'CHAT_MESSAGE',
                            platform: 'web',
                            username: 'Anonymous',
                            message: msg,
                            timestamp: new Date().toISOString(),
                            id: Date.now().toString()
                        };
                    }
                    // If it's already an object but missing fields, add defaults
                    if (typeof msg === 'object') {
                        return {
                            type: msg.type || 'CHAT_MESSAGE',
                            platform: msg.platform || 'web',
                            username: msg.username || 'Anonymous',
                            message: msg.message || '',
                            timestamp: msg.timestamp || new Date().toISOString(),
                            id: msg.id || Date.now().toString()
                        };
                    }
                    return msg;
                });
                
                ws.send(JSON.stringify({
                    type: 'CHAT_HISTORY',
                    messages: recentMessages
                }));
            } else if (data.type === 'ADD_HIGHLIGHT') {
                if (data.highlight && data.isAdmin) {
                    // Generate a server-side ID if not provided
                    if (!data.highlight.id) {
                        data.highlight.id = 'highlight-' + Date.now();
                    }
                    
                    // Add server timestamp
                    data.highlight.serverTimestamp = new Date().toISOString();
                    
                    // Add the highlight
                    addHighlight(data.highlight);
                    
                    // Confirm to the sender
                    ws.send(JSON.stringify({
                        type: 'HIGHLIGHT_ADDED',
                        highlight: data.highlight
                    }));
                }
            } else if (data.type === 'REMOVE_HIGHLIGHT') {
                if (data.id && data.isAdmin) {
                    const removed = removeHighlight(data.id);
                    
                    // Confirm to the sender
                    ws.send(JSON.stringify({
                        type: 'HIGHLIGHT_REMOVED',
                        id: data.id,
                        success: removed
                    }));
                }
            } else if (data.type === 'REQUEST_HIGHLIGHTS') {
                // Send highlights to the requesting client
                ws.send(JSON.stringify({
                    type: 'HIGHLIGHTS_UPDATE',
                    highlights: highlights
                }));
            } else if (data.type === 'CREATE_POLL') {
                console.log('Creating new poll:', data.poll);
                if (data.poll) {
                    const newPoll = await PollManager.createPoll(data.poll);
                    // Broadcast the new poll to all clients
                    broadcast({
                        type: 'POLL_UPDATE',
                        poll: newPoll
                    });
                }
            } else if (data.type === 'SUBMIT_VOTE') {
                console.log('Processing vote:', data);
                if (data.pollId && typeof data.optionIndex === 'number' && data.username) {
                    const voteUpdate = await PollManager.submitVote(data.pollId, data.optionIndex, data.username);
                    if (voteUpdate) {
                        if (voteUpdate.type === 'vote_update') {
                            broadcast({
                                type: 'VOTE_UPDATE',
                                ...voteUpdate
                            });
                        }
                    }
                }
            } else if (data.type === 'REQUEST_POLL_STATE') {
                const currentPoll = PollManager.getCurrentPoll();
                ws.send(JSON.stringify({
                    type: 'POLL_UPDATE',
                    poll: currentPoll
                }));
            } else if (data.type === 'REQUEST_RECENT_POLL') {
                const recentPoll = PollManager.getMostRecentPoll();
                if (recentPoll) {
                    ws.send(JSON.stringify({
                        type: 'POLL_UPDATE',
                        poll: recentPoll,
                        isActive: false
                    }));
                }
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });
    
    // Handle disconnection
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        viewerCount = Math.max(0, viewerCount - 1);
        
        // Broadcast updated viewer count
        broadcast({
            type: 'VIEWER_COUNT',
            viewers: viewerCount
        });
    });
});

// Function to broadcast messages to all connected clients
function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// Make broadcast function globally available for other modules
global.broadcast = broadcast;

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

// Update the config to remove HTTPS
const config = {
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
    },
    trans: {
        ffmpeg: '/usr/bin/ffmpeg',  // Explicit path to ffmpeg on Ubuntu
        tasks: [
            {
                app: 'live',
                hls: true,
                hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
                hlsKeep: false,
                dash: false,
            }
        ]
    }
};

// Create RTMP server instance
const nms = new NodeMediaServer(config);

// Extend nms with EventEmitter if needed (fallback)
if (typeof nms.on !== 'function') {
    Object.setPrototypeOf(nms, EventEmitter.prototype);
    EventEmitter.call(nms);
}

//console.log('NMS instance before run:', nms);
nms.run()
console.log('NMS started (HTTP and RTMP servers running)');

// Add more detailed logging for RTMP events
nms.on('preConnect', (id, args) => {
    console.log('🔄 [RTMP] Client attempting to connect:', id);
});

nms.on('postConnect', (id, args) => {
    console.log('✅ [RTMP] Client connected:', id);
});

nms.on('prePublish', (id, StreamPath, args) => {
    console.log('🎥 [RTMP] Stream starting:', {
        id: id,
        path: StreamPath,
        args: args
    });
    let stream_key = StreamPath.split('/')[2];

    if (stream_key === STREAM_KEY) {
        console.log('✅ [RTMP] Stream key validated');
        console.log('📡 [HLS] HLS stream should be available at:', `http://localhost:8000/live/${stream_key}/index.m3u8`);
        isStreaming = true;
        broadcast({ 
            type: 'STREAM_STATUS', 
            status: 'LIVE',
            viewers: viewerCount 
        });
        return;
    }

    throw new Error('Invalid stream key');
});

nms.on('donePublish', (id, StreamPath, args) => {
    console.log('🛑 [RTMP] Stream ended:', {
        id: id,
        path: StreamPath
    });
    isStreaming = false;
    broadcast({ 
        type: 'STREAM_STATUS', 
        status: 'OFFLINE',
        viewers: viewerCount 
    });
});

// Add logging for stream chunks being generated
nms.on('postHLSSegment', (id, level, sn, duration, start, end) => {
    console.log('📼 [HLS] New segment generated:', {
        id,
        level,
        segmentNumber: sn,
        duration,
        start,
        end,
        path: `live/StreamtoME/${sn}.ts`
    });
});

// Add this after nms.run()
console.log('📂 Media root directory:', path.resolve(config.http.mediaroot));
console.log('📂 Expected HLS path:', path.resolve(config.http.mediaroot, 'live', STREAM_KEY));

// Check if the directory exists
const hlsDir = path.resolve(config.http.mediaroot, 'live', STREAM_KEY);
fs.access(hlsDir, fs.constants.F_OK, (err) => {
    if (err) {
        console.log('⚠️ HLS directory does not exist yet:', hlsDir);
        // Create the directory structure
        fs.mkdirSync(hlsDir, { recursive: true });
        console.log('✅ Created HLS directory:', hlsDir);
    } else {
        console.log('✅ HLS directory exists:', hlsDir);
    }
});

// Initialize PollManager when server starts
PollManager.loadPolls();

server.listen(3001, () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const host = isProduction ? 'watch.stream150.com' : 'localhost';
    const protocol = isProduction ? 'https' : 'http';
    
    console.log('Backend server running on:');
    console.log(`- Web: ${protocol}://${host}:3001`);
    console.log(`- RTMP: rtmp://${host}:1935/live`);
    console.log(`- HLS: ${protocol}://${host}:${isProduction ? '8443' : '8000'}/live`);
});