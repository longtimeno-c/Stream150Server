let chatHistory = [];
let autoScroll = true;
let currentUser = null;

// Initialize the chat system
function initializeChat() {
    // Try to load saved username from localStorage
    currentUser = localStorage.getItem('chatUsername');
    
    if (!currentUser) {
        promptUsername();
    }

    // Set up scroll event listeners
    chatBox.addEventListener('scroll', handleScroll);
    mobileChatBox.addEventListener('scroll', handleScroll);
    
    // Set up chat input event listeners
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    });
    
    mobileChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    });
}

function promptUsername() {
    const username = prompt('Please enter a username:', '');
    if (username) {
        currentUser = username.trim();
        localStorage.setItem('chatUsername', currentUser);
    } else {
        currentUser = 'Viewer_' + Math.floor(Math.random() * 10000);
        localStorage.setItem('chatUsername', currentUser);
    }
}

function addChatMessage(message, platform, username, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${platform}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-timestamp';
    timeSpan.textContent = new Date(timestamp).toLocaleTimeString();
    
    const platformIndicator = document.createElement('span');
    platformIndicator.className = `platform-indicator ${platform}`;
    platformIndicator.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'chat-username';
    usernameSpan.textContent = username;
    usernameSpan.style.color = getColorFromUsername(username);
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'chat-text';
    messageSpan.textContent = `: ${message}`;
    
    messageDiv.appendChild(timeSpan);
    messageDiv.appendChild(platformIndicator);
    messageDiv.appendChild(usernameSpan);
    messageDiv.appendChild(messageSpan);
    
    // Add to both desktop and mobile chat boxes
    chatBox.appendChild(messageDiv.cloneNode(true));
    mobileChatBox.appendChild(messageDiv);
    
    pruneOldMessages();
    handleAutoScroll();
}

function handleAutoScroll() {
    if (autoScroll) {
        chatBox.scrollTop = chatBox.scrollHeight;
        mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
    }
}

function pruneOldMessages() {
    while (chatBox.children.length > 200) {
        chatBox.removeChild(chatBox.firstChild);
        mobileChatBox.removeChild(mobileChatBox.firstChild);
    }
}

function handleScroll(e) {
    const element = e.target;
    const atBottom = Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 50;
    autoScroll = atBottom;
}

function sendChat(inputElement = chatInput) {
    const message = inputElement.value.trim();
    if (!message) return;
    
    if (!currentUser) {
        promptUsername();
    }
    
    const chatMessage = {
        type: 'CHAT_MESSAGE',
        platform: 'web',
        message: message,
        username: currentUser,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
    };
    
    // Optimistic UI update - show message immediately
    addChatMessage(
        chatMessage.message,
        chatMessage.platform,
        chatMessage.username,
        chatMessage.timestamp
    );
    
    // Send to server
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(chatMessage));
        inputElement.value = '';
    } else {
        console.error('WebSocket is not connected');
        alert('Unable to send message - connection lost. Please refresh the page.');
    }
}

function handleNewChatMessage(data) {
    if (data.type === 'CHAT_HISTORY') {
        chatHistory = data.messages;
        chatBox.innerHTML = '';
        mobileChatBox.innerHTML = '';
        
        const recentMessages = data.messages.slice(-50);
        recentMessages.forEach(msg => {
            addChatMessage(msg.message, msg.platform, msg.username, msg.timestamp);
        });
    } else if (data.type === 'CHAT_MESSAGE') {
        // Don't add the message if it's already in the chat (prevents duplicates)
        if (!chatHistory.some(msg => msg.id === data.id)) {
            chatHistory.push(data);
            addChatMessage(data.message, data.platform, data.username, data.timestamp);
            
            if (chatHistory.length > 200) {
                chatHistory = chatHistory.slice(-200);
            }
        }
    }
}

function getColorFromUsername(username) {
    // Generate a consistent color based on username
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use a set of Twitch-like colors
    const colors = [
        '#FF4500', '#D2691E', '#FF7F50', '#9ACD32', '#00FA9A',
        '#00CED1', '#1E90FF', '#7B68EE', '#BA55D3', '#FF69B4'
    ];
    
    return colors[Math.abs(hash) % colors.length];
}

// Initialize chat when the page loads
document.addEventListener('DOMContentLoaded', initializeChat); 