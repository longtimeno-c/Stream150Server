const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let viewerCount = 0;

// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve the main page
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
            if (err) {
                console.error('Error sending index.html:', err);
                res.status(500).send('Error loading page');
            }
        });
    } catch (err) {
        console.error('Error in root route:', err);
        res.status(500).send('Server error');
    }
});

// Handle 404s
app.use((req, res) => {
    console.log('404 - Not Found:', req.url);
    res.status(404).send('Not Found');
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    viewerCount++;
    
    // Send initial status (no streaming status in this simplified version)
    ws.send(JSON.stringify({ 
        type: 'VIEWER_COUNT', 
        viewers: viewerCount 
    }));

    // Keep connection alive with ping
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
                // Broadcast chat message to all clients
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

// Broadcast function
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

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Start the server
server.listen(3001, () => {
    console.log('Server running on:');
    console.log('- Web: http://localhost:3001');
});