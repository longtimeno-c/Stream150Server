let chatHistory = [];
let autoScroll = true;
const MAX_CHAT_MESSAGES = 100;

function initializeChat() {
    console.log('Initializing chat system...');
    
    // Listen for chat messages from the WebSocket
    document.addEventListener('ws-message', function(e) {
        const data = e.detail;
        if (data.type === 'CHAT_MESSAGE') {
            addChatMessage(data);
        } else if (data.type === 'CHAT_HISTORY') {
            loadChatHistory(data.messages);
        }
    });
    
    // Set up chat input handlers
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChat();
            }
        });
    }
    
    const mobileChatInput = document.getElementById('mobileChatInput');
    if (mobileChatInput) {
        mobileChatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMobileChat();
            }
        });
    }
}

function loadChatHistory(messages) {
    console.log('Loading chat history:', messages.length, 'messages');
    
    // Store the messages in the local history
    chatHistory = messages || [];
    
    const chatBox = document.getElementById('chatBox');
    const mobileChatBox = document.getElementById('mobileChatBox');
    
    if (!chatBox) {
        console.error('Chat box element not found');
        return;
    }
    
    // Clear existing messages
    chatBox.innerHTML = '';
    if (mobileChatBox) mobileChatBox.innerHTML = '';
    
    // Add each message to the chat
    if (chatHistory.length > 0) {
        chatHistory.forEach(msg => {
            addChatMessageToDOM(msg, chatBox);
            if (mobileChatBox) addChatMessageToDOM(msg, mobileChatBox);
        });
        
        // Ensure we scroll to the bottom to see the most recent messages
        setTimeout(() => {
            chatBox.scrollTop = chatBox.scrollHeight;
            if (mobileChatBox) mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
        }, 100);
    } else {
        console.warn('No chat history to load');
    }
}

function addChatMessage(message) {
    // Validate message
    if (!message || !message.message) {
        console.error('Invalid chat message:', message);
        return;
    }
    
    console.log('Adding chat message:', message);
    
    // Add to history
    chatHistory.push(message);
    
    // Limit history size
    if (chatHistory.length > MAX_CHAT_MESSAGES) {
        chatHistory.shift();
    }
    
    // Add to DOM
    const chatBox = document.getElementById('chatBox');
    const mobileChatBox = document.getElementById('mobileChatBox');
    
    if (chatBox) {
        addChatMessageToDOM(message, chatBox);
        
        // Only auto-scroll if we're already at the bottom
        const isAtBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 50;
        if (isAtBottom || autoScroll) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }
    
    if (mobileChatBox) {
        addChatMessageToDOM(message, mobileChatBox);
        
        // Only auto-scroll if we're already at the bottom
        const isAtBottom = mobileChatBox.scrollHeight - mobileChatBox.clientHeight <= mobileChatBox.scrollTop + 50;
        if (isAtBottom || autoScroll) {
            mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
        }
    }
}

function addChatMessageToDOM(message, container) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${message.platform}`;
    
    // Create platform badge
    const platformSpan = document.createElement('span');
    platformSpan.className = `platform-indicator ${message.platform}`;
    platformSpan.textContent = message.platform.charAt(0).toUpperCase() + message.platform.slice(1);
    
    // Create username element
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'chat-username';
    usernameSpan.textContent = message.username || 'Anonymous';
    
    // Create message text element
    const messageSpan = document.createElement('span');
    messageSpan.className = 'chat-text';
    messageSpan.textContent = message.message;
    
    // Assemble the message
    msgDiv.appendChild(platformSpan);
    msgDiv.appendChild(usernameSpan);
    msgDiv.appendChild(document.createTextNode(': '));
    msgDiv.appendChild(messageSpan);
    
    container.appendChild(msgDiv);
}

function sendChat() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !chatInput.value.trim()) return;
    
    const message = {
        type: 'CHAT_MESSAGE',
        platform: 'web',
        username: 'Web User', // You might want to implement a username system
        message: chatInput.value.trim(),
        timestamp: new Date().toISOString()
    };
    
    // Send via WebSocket
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        window.socket.send(JSON.stringify(message));
        chatInput.value = '';
    } else {
        console.error('WebSocket not connected');
        // Add a visual error indicator
        chatInput.classList.add('error');
        setTimeout(() => chatInput.classList.remove('error'), 2000);
    }
}

function sendMobileChat() {
    const mobileChatInput = document.getElementById('mobileChatInput');
    if (!mobileChatInput || !mobileChatInput.value.trim()) return;
    
    const message = {
        type: 'CHAT_MESSAGE',
        platform: 'web',
        username: 'Web User', // You might want to implement a username system
        message: mobileChatInput.value.trim(),
        timestamp: new Date().toISOString()
    };
    
    // Send via WebSocket
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        window.socket.send(JSON.stringify(message));
        mobileChatInput.value = '';
    } else {
        console.error('WebSocket not connected');
        // Add a visual error indicator
        mobileChatInput.classList.add('error');
        setTimeout(() => mobileChatInput.classList.remove('error'), 2000);
    }
}

// Initialize chat when the page loads
document.addEventListener('DOMContentLoaded', initializeChat); 