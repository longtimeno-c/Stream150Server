const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');

const STREAM_KEY = 'StreamtoME';

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isStreaming = false;
let viewerCount = 0;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authenticate stream key for RTMP server
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

// WebSocket connection handler
wss.on('connection', (ws) => {
    viewerCount++;
    ws.send(JSON.stringify({ 
        type: 'STREAM_STATUS', 
        status: isStreaming ? 'LIVE' : 'OFFLINE',
        viewers: viewerCount 
    }));

    ws.on('message', (message) => {
        console.log('received: %s', message);
    });

    ws.on('close', () => {
        viewerCount--;
        broadcast({ 
            type: 'VIEWER_COUNT', 
            viewers: viewerCount 
        });
        console.log('WebSocket connection closed');
    });
});

// Broadcast message to all WebSocket clients
function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Listen for when the stream stops
app.post('/stream-ended', (req, res) => {
    isStreaming = false;
    broadcast({ 
        type: 'STREAM_STATUS', 
        status: 'OFFLINE',
        viewers: viewerCount 
    });
    res.status(200).send('Stream Ended');
});

server.listen(3001, () => {
    console.log('Backend server running on http://localhost:3001');
});