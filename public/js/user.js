// user.js - User management and authentication
// Handles username storage, validation, and UI updates

const UserManager = (function() {
    // Configuration
    const config = {
        usernameKey: 'username',
        defaultUsername: 'Anonymous',
        minUsernameLength: 2,
        maxUsernameLength: 20,
        rememberDays: 30,
        usernameRegex: /^[a-zA-Z0-9_\-\.]+$/ // Alphanumeric plus underscore, dash, and period
    };
    
    // Events
    const EVENTS = {
        USERNAME_LOADED: 'username-loaded',
        USERNAME_CHANGED: 'username-changed',
        USERNAME_ERROR: 'username-error'
    };
    
    // Private state
    let currentUsername = null;
    
    // Initialize the user manager
    function init() {
        // Get the username from storage
        getStoredUsername()
            .then(username => {
                if (username) {
                    setCurrentUsername(username);
                } else {
                    // If no username is stored, prompt for one
                    promptForUsername()
                        .then(newUsername => {
                            setCurrentUsername(newUsername);
                        })
                        .catch(err => {
                            console.error('Error getting username:', err);
                            // Fallback to default if there's an error
                            setCurrentUsername(config.defaultUsername);
                        });
                }
            });
    }
    
    // Get the username from storage
    function getStoredUsername() {
        return new Promise((resolve) => {
            const username = Storage.get(config.usernameKey, { default: null });
            resolve(username);
        });
    }
    
    // Set the current username and dispatch events
    function setCurrentUsername(username) {
        currentUsername = username || config.defaultUsername;
        
        // Make it available globally
        window.currentUsername = currentUsername;
        
        // Update all UI elements immediately
        if (typeof window.updateUsernameDisplays === 'function') {
            window.updateUsernameDisplays();
        }
        
        // Dispatch event to notify other components
        dispatchUsernameEvent(EVENTS.USERNAME_LOADED, currentUsername);
        
        return currentUsername;
    }
    
    // Validate a username
    function validateUsername(username) {
        if (!username || typeof username !== 'string') {
            return { valid: false, message: 'Username is required' };
        }
        
        username = username.trim();
        
        if (username.length < config.minUsernameLength) {
            return { 
                valid: false, 
                message: `Username must be at least ${config.minUsernameLength} characters` 
            };
        }
        
        if (username.length > config.maxUsernameLength) {
            return { 
                valid: false, 
                message: `Username cannot exceed ${config.maxUsernameLength} characters` 
            };
        }
        
        if (!config.usernameRegex.test(username)) {
            return { 
                valid: false, 
                message: 'Username can only contain letters, numbers, underscores, dashes, and periods' 
            };
        }
        
        return { valid: true };
    }
    
    // Save username to storage
    function saveUsername(username, remember = true) {
        const options = {
            expiry: remember ? config.rememberDays : null
        };
        
        return Storage.set(config.usernameKey, username, options);
    }
    
    // Dispatch a username-related event
    function dispatchUsernameEvent(eventName, username) {
        document.dispatchEvent(new CustomEvent(eventName, { 
            detail: { username } 
        }));
    }
    
    // Create a modal for username input
    function createUsernameModal(options = {}) {
        const { 
            title = 'Welcome to Stream150!',
            message = 'Please enter a username to use in the chat:',
            buttonText = 'Continue',
            showRememberMe = true,
            initialUsername = 'Anon',
            isChangingUsername = false
        } = options;
        
        // Create modal element
        const modal = document.createElement('div');
        modal.className = 'username-modal';
        
        // Create modal content with improved UI
        modal.innerHTML = `
            <div class="username-modal-content">
                <h2>${title}</h2>
                <p>${message}</p>
                <form id="usernameForm">
                    <div class="input-group">
                        <input 
                            type="text" 
                            id="usernameInput" 
                            placeholder="Your username" 
                            maxlength="${config.maxUsernameLength}" 
                            value="${initialUsername}"
                            required
                        >
                        <div class="error-message" id="usernameError"></div>
                    </div>
                    ${showRememberMe ? `
                    <div class="remember-me">
                        <input type="checkbox" id="rememberUsername" checked>
                        <label for="rememberUsername">Remember my username</label>
                    </div>
                    ` : ''}
                    <div class="button-group">
                        ${isChangingUsername ? `
                        <button type="button" id="cancelUsernameChange" class="secondary-button">Cancel</button>
                        ` : ''}
                        <button type="submit" class="primary-button">${buttonText}</button>
                    </div>
                </form>
            </div>
        `;
        
        return modal;
    }
    
    // Show error message in the username modal
    function showUsernameError(message) {
        const errorElement = document.getElementById('usernameError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Add error class to input
            const inputElement = document.getElementById('usernameInput');
            if (inputElement) {
                inputElement.classList.add('error');
            }
        }
    }
    
    // Clear error message in the username modal
    function clearUsernameError() {
        const errorElement = document.getElementById('usernameError');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
            
            // Remove error class from input
            const inputElement = document.getElementById('usernameInput');
            if (inputElement) {
                inputElement.classList.remove('error');
            }
        }
    }
    
    // Prompt the user for a username
    function promptForUsername(options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Create and add the modal to the DOM
                const modal = createUsernameModal({
                    ...options,
                    initialUsername: currentUsername !== config.defaultUsername ? currentUsername : ''
                });
                document.body.appendChild(modal);
                
                // Focus the input field
                const usernameInput = document.getElementById('usernameInput');
                if (usernameInput) {
                    usernameInput.focus();
                    
                    // Select all text if there's an initial value
                    if (usernameInput.value) {
                        usernameInput.select();
                    }
                }
                
                // Handle form submission
                const form = document.getElementById('usernameForm');
                if (form) {
                    form.addEventListener('submit', function(e) {
                        e.preventDefault();
                        
                        // Get and validate the username
                        const username = usernameInput.value.trim();
                        const validation = validateUsername(username);
                        
                        if (!validation.valid) {
                            showUsernameError(validation.message);
                            return;
                        }
                        
                        // Clear any previous errors
                        clearUsernameError();
                        
                        // Get remember preference
                        const rememberCheckbox = document.getElementById('rememberUsername');
                        const remember = rememberCheckbox ? rememberCheckbox.checked : true;
                        
                        // Save the username
                        saveUsername(username, remember);
                        
                        // Remove the modal
                        document.body.removeChild(modal);
                        
                        // Resolve the promise with the username
                        resolve(username);
                    });
                }
                
                // Handle cancel button if present
                const cancelButton = document.getElementById('cancelUsernameChange');
                if (cancelButton) {
                    cancelButton.addEventListener('click', function() {
                        // Remove the modal
                        document.body.removeChild(modal);
                        
                        // Resolve with the current username (no change)
                        resolve(currentUsername);
                    });
                }
                
                // Handle input validation on typing
                if (usernameInput) {
                    usernameInput.addEventListener('input', function() {
                        // Clear error when user starts typing
                        clearUsernameError();
                    });
                }
            } catch (err) {
                console.error('Error creating username prompt:', err);
                reject(err);
            }
        });
    }
    
    // Change the current username
    function changeUsername() {
        return promptForUsername({
            title: 'Change Username',
            message: 'Enter a new username:',
            buttonText: 'Update',
            showRememberMe: true,
            isChangingUsername: true
        }).then(username => {
            // Only update if the username actually changed
            if (username && username !== currentUsername) {
                // Set the current username first
                setCurrentUsername(username);
                
                // Then dispatch username changed event
                dispatchUsernameEvent(EVENTS.USERNAME_CHANGED, username);
                
                // Update UI immediately again to ensure it's updated
                if (typeof window.updateUsernameDisplays === 'function') {
                    window.updateUsernameDisplays();
                }
            }
            
            return username;
        });
    }
    
    // Public API
    return {
        // Initialize the user manager
        init,
        
        // Get the current username
        getUsername: function() {
            return currentUsername || config.defaultUsername;
        },
        
        // Change the username
        changeUsername,
        
        // Configure the user manager
        configure: function(options) {
            Object.assign(config, options);
        },
        
        // Events
        EVENTS
    };
})();

// Make UserManager available globally
window.UserManager = UserManager;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the user manager
    UserManager.init();
}); 