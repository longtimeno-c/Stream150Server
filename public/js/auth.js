// auth.js - Handles user authentication and username storage
// This file now serves as a compatibility layer for existing code
// It uses the new UserManager and Storage modules

// Backward compatibility functions
function getCookie(name) {
    return Storage.get(name, { method: 'cookie', usePrefix: false });
}

function setCookie(name, value, days) {
    return Storage.set(name, value, { method: 'cookie', expiry: days, usePrefix: false });
}

function getUsername() {
    // Check for the old cookie format first
    const oldUsername = getCookie('stream150_username');
    
    if (oldUsername) {
        // Migrate the old cookie to the new storage system
        Storage.set('username', oldUsername);
        
        // Remove the old cookie
        document.cookie = 'stream150_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Return the username
        return Promise.resolve(oldUsername);
    }
    
    // Use the new UserManager
    return Promise.resolve(UserManager.getUsername());
}

function promptForUsername() {
    // Use the new UserManager
    return UserManager.changeUsername();
}

function changeUsername() {
    // Use the new UserManager
    UserManager.changeUsername().then(username => {
        // No need to dispatch event here, UserManager does it
    });
}

// Initialize on page load - this is now handled by UserManager
// Left here for backward compatibility
document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth.js loaded - using UserManager for authentication');
}); 