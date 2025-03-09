/**
 * Highlights Debug Helper
 * This script helps diagnose and fix issues with server-side highlights integration
 */
(function() {
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
        console.log('Received highlights-manager-ready event, initializing debug helper');
        initDebugHelper();
    });
    
    function initDebugHelper() {
        // Prevent multiple initializations
        if (isInitialized) {
            console.log('Debug helper already initialized, skipping');
            return;
        }
        
        console.log('Highlights Debug Helper initialized');
        isInitialized = true;
        
        // Ensure HighlightsManager is available
        ensureHighlightsManager();
        
        // Add debug button to the page
        addDebugButton();
    }
    
    // Wait for DOM to be fully loaded - this is a fallback
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Highlights Debug Helper waiting for HighlightsManager...');
        
        // Check if HighlightsManager is already available
        if (window.HighlightsManager) {
            console.log('HighlightsManager already available at DOMContentLoaded, initializing debug helper');
            initDebugHelper();
        } else {
            console.log('Waiting for highlights-manager-ready event...');
            
            // As a fallback, try again after a delay
            setTimeout(function() {
                if (!window.HighlightsManager) {
                    console.log('HighlightsManager still not available, creating fallback and initializing');
                    ensureHighlightsManager();
                    initDebugHelper();
                }
            }, 2000);
        }
    });
    
    function addDebugButton() {
        // Find the debug controls container
        const debugControls = document.getElementById('adminDebugControls');
        
        if (debugControls) {
            // Make it visible
            debugControls.style.display = 'block';
            
            // Check if buttons already exist
            if (debugControls.querySelector('.debug-btn[data-action="debug-highlights"]')) {
                console.log('Debug buttons already exist, skipping');
                return;
            }
            
            // Add our debug button
            const debugButton = document.createElement('button');
            debugButton.className = 'debug-btn';
            debugButton.textContent = 'Debug Highlights';
            debugButton.setAttribute('data-action', 'debug-highlights');
            debugButton.onclick = debugHighlights;
            
            // Add a force upload button
            const forceUploadButton = document.createElement('button');
            forceUploadButton.className = 'debug-btn';
            forceUploadButton.textContent = 'Force Server Upload';
            forceUploadButton.setAttribute('data-action', 'force-upload');
            forceUploadButton.onclick = forceServerUpload;
            
            // Add buttons to the container
            debugControls.appendChild(debugButton);
            debugControls.appendChild(forceUploadButton);
        }
    }
    
    function debugHighlights() {
        console.log('=== HIGHLIGHTS DEBUG INFORMATION ===');
        
        // Ensure HighlightsManager is available
        ensureHighlightsManager();
        
        // Get admin status
        const isAdmin = window.HighlightsManager.isAdmin;
        console.log('Admin Status:', isAdmin);
        
        // Check if useServerStorage flag is set
        // This is a private variable, so we need to check indirectly
        const highlights = JSON.parse(localStorage.getItem('stream150Highlights') || '[]');
        console.log('Local Storage Highlights:', highlights);
        
        // Check WebSocket connection
        const socket = window.socket;
        const isConnected = socket && socket.readyState === WebSocket.OPEN;
        console.log('WebSocket Connected:', isConnected);
        
        // Display debug info
        alert(`
Highlights Debug Info:
- Admin Status: ${isAdmin}
- Local Highlights: ${highlights.length}
- WebSocket Connected: ${isConnected}

Check console for more details.
        `);
    }
    
    function forceServerUpload() {
        // Ensure HighlightsManager is available
        ensureHighlightsManager();
        
        if (!window.socket || window.socket.readyState !== WebSocket.OPEN) {
            alert('WebSocket not connected');
            return;
        }
        
        // Get highlights from local storage
        const highlights = JSON.parse(localStorage.getItem('stream150Highlights') || '[]');
        
        if (highlights.length === 0) {
            alert('No highlights found in local storage');
            return;
        }
        
        // Force the useServerStorage flag to true by calling updateFromServer
        // with the current highlights
        window.HighlightsManager.updateFromServer(highlights);
        
        // Now manually send each highlight to the server
        highlights.forEach(highlight => {
            sendHighlightToServer(highlight);
        });
        
        alert(`Forced ${highlights.length} highlights to be uploaded to the server`);
    }
    
    function sendHighlightToServer(highlight) {
        const socket = window.socket;
        
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }
        
        console.log('Forcing highlight upload to server:', highlight);
        
        // Always set isAdmin to true for this debug function
        socket.send(JSON.stringify({
            type: 'ADD_HIGHLIGHT',
            highlight: highlight,
            isAdmin: true
        }));
    }
})(); 