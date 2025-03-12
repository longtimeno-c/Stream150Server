const WebSocket = require('ws');
const PollManager = require('./pollManager');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', function connection(ws) {
        console.log('New WebSocket connection');
        
        // Send current poll state if exists
        const currentPoll = PollManager.getCurrentPoll();
        if (currentPoll) {
            ws.send(JSON.stringify({
                type: 'POLL_UPDATE',
                poll: currentPoll
            }));
        }
        
        ws.on('message', async function incoming(message) {
            try {
                const data = JSON.parse(message);
                console.log('Received:', data);
                
                switch (data.type) {
                    case 'CREATE_POLL':
                        if (data.poll) {
                            const newPoll = await PollManager.createPoll(data.poll);
                            broadcastToAll(wss, {
                                type: 'POLL_UPDATE',
                                poll: newPoll
                            });
                        }
                        break;
                        
                    case 'SUBMIT_VOTE':
                        if (data.pollId && typeof data.optionIndex === 'number') {
                            const updatedPoll = await PollManager.submitVote(data.pollId, data.optionIndex);
                            if (updatedPoll) {
                                broadcastToAll(wss, {
                                    type: 'POLL_UPDATE',
                                    poll: updatedPoll
                                });
                            }
                        }
                        break;
                        
                    case 'REQUEST_POLL_STATE':
                        const currentPoll = PollManager.getCurrentPoll();
                        ws.send(JSON.stringify({
                            type: 'POLL_UPDATE',
                            poll: currentPoll
                        }));
                        break;
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });
    });
}

function broadcastToAll(wss, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

module.exports = setupWebSocket; 