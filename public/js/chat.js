let chatHistory = [];
let autoScroll = true;
const MAX_CHAT_MESSAGES = 100;
let currentUsername = 'Anonymous'; // Default username

// Make currentUsername globally accessible
window.currentUsername = currentUsername;

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
    
    // Listen for username changes
    document.addEventListener('username-loaded', function(e) {
        currentUsername = e.detail.username;
        window.currentUsername = currentUsername; // Update global variable
        console.log('Username loaded:', currentUsername);
        
        // Add username change button to chat header
        addUsernameChangeButton();
    });
    
    document.addEventListener('username-changed', function(e) {
        currentUsername = e.detail.username;
        window.currentUsername = currentUsername; // Update global variable
        console.log('Username changed to:', currentUsername);
    });
}

// Add a button to change username
function addUsernameChangeButton() {
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader && !document.querySelector('.username-display')) {
        const usernameDisplay = document.createElement('div');
        usernameDisplay.className = 'username-display';
        usernameDisplay.innerHTML = `
            <span>You: <span class="current-username">${currentUsername}</span></span>
            <button class="username-change-btn" onclick="changeUsername()">Change</button>
        `;
        chatHeader.appendChild(usernameDisplay);
    }
}

function loadChatHistory(messages) {
    console.log('Loading chat history:', messages ? messages.length : 0, 'messages');
    
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
            // Skip invalid messages
            if (!msg) return;
            
            // Convert string messages to objects
            if (typeof msg === 'string') {
                msg = {
                    platform: 'web',
                    username: 'Anonymous',
                    message: msg
                };
            }
            
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
    // Handle string messages (convert to object format)
    if (typeof message === 'string') {
        message = {
            type: 'CHAT_MESSAGE',
            platform: 'web',
            username: 'Anonymous',
            message: message,
            timestamp: new Date().toISOString()
        };
    }
    
    // Validate message
    if (!message || (!message.message && typeof message !== 'string')) {
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
    // Handle string messages (convert to object format)
    if (typeof message === 'string') {
        message = {
            platform: 'web',
            username: 'Anonymous',
            message: message
        };
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${message.platform || 'web'}`;
    
    // Create platform badge
    const platformSpan = document.createElement('span');
    platformSpan.className = `platform-indicator ${message.platform || 'web'}`;
    platformSpan.textContent = (message.platform || 'web').charAt(0).toUpperCase() + (message.platform || 'web').slice(1);
    
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
        username: currentUsername, // Use the stored username
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
        username: currentUsername, // Use the stored username
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