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
})(); 