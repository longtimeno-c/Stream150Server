/**
 * Server Highlights Integration
 * Extends the HighlightsManager to work with server-side storage
 */
(function() {
    // Reference to the WebSocket
    let socket = null;
    
    // Flag to track if we're connected to the server
    let isConnected = false;
    
    // Flag to track if we've received the initial highlights from the server
    let initialHighlightsReceived = false;
    
    // Flag to track if we've already initialized
    let isInitialized = false;
    
    // Create a fallback HighlightsManager if needed
    function ensureHighlightsManager() {
        if (!window.HighlightsManager) {
            console.error('HighlightsManager not found, creating a fallback version');
            window.HighlightsManager = {
                isAdmin: false,
                updateFromServer: function(highlights) {
                    console.log('Fallback updateFromServer called with:', highlights);
                }
            };
        }
        return window.HighlightsManager;
    }
    
    // Listen for the highlights-manager-ready event
    document.addEventListener('highlights-manager-ready', function() {
        console.log('Received highlights-manager-ready event, initializing server integration');
        init();
    });
    
    /**
     * Initialize the server highlights integration
     */
    function init() {
        // Prevent multiple initializations
        if (isInitialized) {
            console.log('Server highlights integration already initialized, skipping');
            return;
        }
        
        console.log('Initializing server highlights integration');
        isInitialized = true;
        
        // Ensure HighlightsManager is available
        ensureHighlightsManager();
        
        // Get the WebSocket from the global scope
        socket = window.socket;
        
        if (!socket) {
            console.error('WebSocket not available. Server highlights integration disabled.');
            return;
        }
        
        // Set up event listeners for WebSocket events
        setupWebSocketListeners();
        
        // Request highlights from the server
        requestHighlightsFromServer();
        
        // Force enable server storage mode after a short delay
        // This ensures that even if no highlights are received from the server,
        // new highlights will still be sent to the server
        setTimeout(function() {
            if (!initialHighlightsReceived) {
                console.log('Forcing server storage mode');
                window.HighlightsManager.updateFromServer([]);
            }
        }, 3000);
    }
    
    /**
     * Wait for HighlightsManager to be available
     * @param {Function} callback - Function to call when HighlightsManager is available
     * @param {number} attempts - Number of attempts so far
     */
    function waitForHighlightsManager(callback, attempts = 0) {
        if (window.HighlightsManager) {
            console.log('HighlightsManager found after', attempts, 'attempts');
            callback();
            return;
        }
        
        if (attempts > 20) {
            console.error('HighlightsManager not available after 20 attempts');
            return;
        }
        
        console.log('Waiting for HighlightsManager... Attempt', attempts + 1);
        setTimeout(function() {
            waitForHighlightsManager(callback, attempts + 1);
        }, 500);
    }
    
    /**
     * Set up WebSocket event listeners
     */
    function setupWebSocketListeners() {
        // Remove any existing event listeners to prevent duplicates
        socket.removeEventListener('open', handleSocketOpen);
        socket.removeEventListener('close', handleSocketClose);
        socket.removeEventListener('message', handleSocketMessage);
        
        // Listen for WebSocket open event
        socket.addEventListener('open', handleSocketOpen);
        
        // Listen for WebSocket close event
        socket.addEventListener('close', handleSocketClose);
        
        // Listen for WebSocket messages
        socket.addEventListener('message', handleSocketMessage);
        
        // Remove any existing document event listeners to prevent duplicates
        document.removeEventListener('highlight-added', handleHighlightAdded);
        document.removeEventListener('highlight-removed', handleHighlightRemoved);
        
        // Listen for custom events from the HighlightsManager
        document.addEventListener('highlight-added', handleHighlightAdded);
        document.addEventListener('highlight-removed', handleHighlightRemoved);
    }
    
    // Event handler functions
    function handleSocketOpen() {
        console.log('WebSocket connected. Server highlights integration enabled.');
        isConnected = true;
        
        // Request highlights from the server
        requestHighlightsFromServer();
    }
    
    function handleSocketClose() {
        console.log('WebSocket disconnected. Server highlights integration disabled.');
        isConnected = false;
    }
    
    function handleSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            // Handle highlights update
            if (data.type === 'HIGHLIGHTS_UPDATE') {
                handleHighlightsUpdate(data.highlights);
            }
            
            // Handle highlight added confirmation
            if (data.type === 'HIGHLIGHT_ADDED') {
                console.log('Highlight added to server:', data.highlight);
            }
            
            // Handle highlight removed confirmation
            if (data.type === 'HIGHLIGHT_REMOVED') {
                console.log('Highlight removed from server:', data.id, data.success);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    }
    
    function handleHighlightAdded(event) {
        const highlight = event.detail;
        sendHighlightToServer(highlight);
    }
    
    function handleHighlightRemoved(event) {
        const id = event.detail;
        removeHighlightFromServer(id);
    }
    
    /**
     * Request highlights from the server
     */
    function requestHighlightsFromServer() {
        if (!isConnected) {
            console.log('Not connected to server. Cannot request highlights.');
            return;
        }
        
        console.log('Requesting highlights from server');
        
        socket.send(JSON.stringify({
            type: 'REQUEST_HIGHLIGHTS'
        }));
    }
    
    /**
     * Handle highlights update from the server
     * @param {Array} serverHighlights - The highlights from the server
     */
    function handleHighlightsUpdate(serverHighlights) {
        console.log('Received highlights from server:', serverHighlights);
        
        // Always process highlights from the server, even if we've received them before
        // This ensures that if the server highlights change, we'll get the updates
        initialHighlightsReceived = true;
        
        // Ensure HighlightsManager is available
        ensureHighlightsManager();
        
        // Update the highlights
        window.HighlightsManager.updateFromServer(serverHighlights);
    }
    
    /**
     * Send a highlight to the server
     * @param {Object} highlight - The highlight to send
     */
    function sendHighlightToServer(highlight) {
        if (!isConnected) {
            console.log('Not connected to server. Cannot send highlight.');
            return;
        }
        
        console.log('Sending highlight to server:', highlight);
        
        // Check if the user is an admin
        const isAdmin = window.HighlightsManager ? window.HighlightsManager.isAdmin : false;
        
        socket.send(JSON.stringify({
            type: 'ADD_HIGHLIGHT',
            highlight: highlight,
            isAdmin: isAdmin
        }));
    }
    
    /**
     * Remove a highlight from the server
     * @param {string} id - The ID of the highlight to remove
     */
    function removeHighlightFromServer(id) {
        if (!isConnected) {
            console.log('Not connected to server. Cannot remove highlight.');
            return;
        }
        
        console.log('Removing highlight from server:', id);
        
        // Check if the user is an admin
        const isAdmin = window.HighlightsManager ? window.HighlightsManager.isAdmin : false;
        
        socket.send(JSON.stringify({
            type: 'REMOVE_HIGHLIGHT',
            id: id,
            isAdmin: isAdmin
        }));
    }
    
    // Initialize when the DOM is fully loaded - this is a fallback
    document.addEventListener('DOMContentLoaded', function() {
        // Check if HighlightsManager is already available
        if (window.HighlightsManager) {
            console.log('HighlightsManager already available at DOMContentLoaded, initializing server integration');
            init();
        } else {
            console.log('Waiting for highlights-manager-ready event...');
            // We'll wait for the highlights-manager-ready event
        }
    });
})(); 