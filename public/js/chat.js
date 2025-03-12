// Import getCookie function if not already available
function getCookie(name) {
    return Storage.get(name, { method: 'cookie', usePrefix: false });
}

let chatHistory = [];
let autoScroll = true;
const MAX_CHAT_MESSAGES = 100;
let currentUsername = 'Anonymous';

// Add filter toggle and explicit words list
const ENABLE_FILTER = true; // Toggle this to enable/disable filtering
const EXPLICIT_WORDS = [
    'cunt', 'nigger', 'nigga',
    'bitch', 'whore', 'slut',
    'cock', 'dick', 'pussy',
    'asshole', 'twat',
    'kike', 'spic', 'chink',
    'wank', 'coon',
];

// Word filtering function
function filterMessage(message) {
    if (!ENABLE_FILTER) return message;
    
    let words = message.split(' ');
    words = words.map(word => {
        const lowercaseWord = word.toLowerCase();
        if (EXPLICIT_WORDS.includes(lowercaseWord)) {
            return `${word.charAt(0)}***${word.charAt(word.length - 1)}`;
        }
        return word;
    });
    return words.join(' ');
}

// Make currentUsername globally accessible
window.currentUsername = currentUsername;

function initializeChat() {
    console.log('Initializing chat system...');
    
    // Listen for chat messages from the WebSocket
    document.addEventListener('ws-chat_message', function(e) {
        const data = e.detail;
        addChatMessage(data);
    });
    
    document.addEventListener('ws-chat_history', function(e) {
        const data = e.detail;
        loadChatHistory(data.messages);
    });
    
    // Set up chat input handlers
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChat();
            }
        });
    }
    
    const mobileChatInput = document.getElementById('mobileChatInput');
    if (mobileChatInput) {
        mobileChatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMobileChat();
            }
        });
    }
    
    // Listen for username changes
    document.addEventListener(UserManager.EVENTS.USERNAME_LOADED, function(e) {
        currentUsername = e.detail.username;
        window.currentUsername = currentUsername;
        console.log('Username loaded:', currentUsername);
    });
    
    document.addEventListener(UserManager.EVENTS.USERNAME_CHANGED, function(e) {
        currentUsername = e.detail.username;
        window.currentUsername = currentUsername;
        console.log('Username changed to:', currentUsername);
    });
    
    // Listen for WebSocket connection status
    document.addEventListener('websocket-connected', function() {
        console.log('Chat system: WebSocket connected');
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('connected');
            el.classList.remove('disconnected');
        });
    });
    
    document.addEventListener('websocket-closed', function() {
        console.log('Chat system: WebSocket disconnected');
        document.querySelectorAll('.chat-status').forEach(el => {
            el.classList.add('disconnected');
            el.classList.remove('connected');
        });
    });
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
        // Get the current username from cookie instead of defaulting to 'Anonymous'
        const username = getCookie('stream150_username') || 'Anonymous';
        
        message = {
            platform: 'web',
            username: username,
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
    if (!chatInput) return;
    
    let message = chatInput.value.trim();
    if (message) {
        // Filter the message before sending
        message = filterMessage(message);
        
        // Get the current username from UserManager
        const username = UserManager.getUsername();
        
        // Send the message to the server
        window.socket.send(JSON.stringify({
            type: 'CHAT_MESSAGE',
            platform: 'web',
            username: username,
            message: message
        }));
        
        // Clear the input
        chatInput.value = '';
    }
}

function sendMobileChat() {
    const mobileChatInput = document.getElementById('mobileChatInput');
    if (!mobileChatInput) return;
    
    let message = mobileChatInput.value.trim();
    if (message) {
        // Filter the message before sending
        message = filterMessage(message);
        
        // Get the current username from UserManager
        const username = UserManager.getUsername();
        
        // Send the message to the server
        window.socket.send(JSON.stringify({
            type: 'CHAT_MESSAGE',
            platform: 'web',
            username: username,
            message: message
        }));
        
        // Clear the input
        mobileChatInput.value = '';
    }
}

// Initialize chat when the page loads
document.addEventListener('DOMContentLoaded', initializeChat);