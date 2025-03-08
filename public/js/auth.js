// auth.js - Handles user authentication and username storage

// Function to get a cookie by name
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Function to set a cookie
function setCookie(name, value, days) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${value}${expires}; path=/`;
}

// Get the current username from cookie or prompt for a new one
function getUsername() {
    let username = getCookie('stream150_username');
    
    // If no username is stored, prompt the user
    if (!username) {
        username = promptForUsername();
    }
    
    return username || 'Anonymous';
}

// Prompt the user for a username
function promptForUsername() {
    // Create a modal dialog for username input
    const modal = document.createElement('div');
    modal.className = 'username-modal';
    modal.innerHTML = `
        <div class="username-modal-content">
            <h2>Welcome to Stream150!</h2>
            <p>Please enter a username to use in the chat:</p>
            <form id="usernameForm">
                <input type="text" id="usernameInput" placeholder="Your username" maxlength="20" required>
                <button type="submit">Continue</button>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus the input field
    const usernameInput = document.getElementById('usernameInput');
    usernameInput.focus();
    
    // Return a promise that resolves when the user submits the form
    return new Promise((resolve) => {
        document.getElementById('usernameForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = usernameInput.value.trim();
            
            if (username) {
                // Store the username in a cookie (valid for 30 days)
                setCookie('stream150_username', username, 30);
                
                // Remove the modal
                document.body.removeChild(modal);
                
                // Resolve the promise with the username
                resolve(username);
            }
        });
    });
}

// Function to change username
function changeUsername() {
    const newUsername = promptForUsername();
    newUsername.then(username => {
        // Update the UI to reflect the new username
        document.dispatchEvent(new CustomEvent('username-changed', { 
            detail: { username } 
        }));
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Get the username (will prompt if not set)
    getUsername().then(username => {
        console.log(`User identified as: ${username}`);
        
        // Dispatch an event to notify other components
        document.dispatchEvent(new CustomEvent('username-loaded', { 
            detail: { username } 
        }));
    });
}); 