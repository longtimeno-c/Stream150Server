class ChatManager {
    constructor() {
        this.ws = new WebSocket(CONFIG.WEBSOCKET_URL);
        this.autoScroll = true;
        this.setupWebSocket();
        this.setupEventListeners();
    }

    setupWebSocket() {
        this.ws.onmessage = this.handleWebSocketMessage.bind(this);
        this.ws.onopen = () => console.log('Connected to chat server');
        this.ws.onerror = (error) => console.error('WebSocket error:', error);
        this.ws.onclose = this.handleWebSocketClose.bind(this);
    }

    // Copy all chat-related functions from the original file
    // Including: displayChatMessage, addChatMessage, sendChat, etc.
}

const chatManager = new ChatManager(); 