let chatHistory = [];
let autoScroll = true;

function addChatMessage(message, platform, username) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${platform}`;
    
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
    
    messageDiv.appendChild(platformIndicator);
    messageDiv.appendChild(usernameSpan);
    messageDiv.appendChild(messageSpan);
    
    chatBox.appendChild(messageDiv.cloneNode(true));
    mobileChatBox.appendChild(messageDiv);
    
    while (chatBox.children.length > 200) {
        chatBox.removeChild(chatBox.firstChild);
        mobileChatBox.removeChild(mobileChatBox.firstChild);
    }
    
    if (autoScroll) {
        chatBox.scrollTop = chatBox.scrollHeight;
        mobileChatBox.scrollTop = mobileChatBox.scrollHeight;
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

function initializeChatHistory(messages) {
    chatHistory = messages;
    
    // Clear existing messages
    chatBox.innerHTML = '';
    mobileChatBox.innerHTML = '';
    
    // Display last 50 messages
    const recentMessages = messages.slice(-50);
    recentMessages.forEach(msg => {
        addChatMessage(msg.message, msg.platform, msg.username);
    });
}

function handleNewChatMessage(data) {
    // Update to handle both individual messages and chat history
    if (data.type === 'CHAT_HISTORY') {
        initializeChatHistory(data.messages);
    } else {
        let username = data.username || 'Anonymous';
        let platform = data.platform || 'web';
        addChatMessage(data.message, platform, username);
        
        // Update local chat history
        chatHistory.push(data);
        if (chatHistory.length > 200) {
            chatHistory = chatHistory.slice(-200);
        }
    }
}

function sendChat() {
    const message = chatInput.value.trim();
    if (message) {
        const chatMessage = {
            type: 'CHAT_MESSAGE',
            platform: 'web',
            message: message,
            username: 'Viewer',
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        };
        
        ws.send(JSON.stringify(chatMessage));
        chatInput.value = '';
    }
}

function sendMobileChat() {
    const message = mobileChatInput.value.trim();
    if (message) {
        const chatMessage = {
            type: 'CHAT_MESSAGE',
            platform: 'web',
            message: message,
            username: 'Viewer',
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        };
        
        ws.send(JSON.stringify(chatMessage));
        mobileChatInput.value = '';
    }
}

// ... rest of the chat-related functions ... 