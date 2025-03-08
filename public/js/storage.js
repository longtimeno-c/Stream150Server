// storage.js - Centralized storage management for client-side data
// Supports cookies, localStorage, and sessionStorage with fallbacks

const Storage = (function() {
    // Default configuration
    const config = {
        prefix: 'stream150_',
        defaultExpiry: 30, // days
        storageMethod: 'localStorage' // 'localStorage', 'sessionStorage', or 'cookie'
    };

    // Feature detection for storage methods
    const storageAvailable = {
        localStorage: (function() {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch(e) {
                return false;
            }
        })(),
        sessionStorage: (function() {
            try {
                sessionStorage.setItem('test', 'test');
                sessionStorage.removeItem('test');
                return true;
            } catch(e) {
                return false;
            }
        })(),
        cookie: (function() {
            return navigator.cookieEnabled;
        })()
    };

    // Determine best available storage method
    function getBestStorageMethod() {
        if (storageAvailable[config.storageMethod]) {
            return config.storageMethod;
        } else if (storageAvailable.localStorage) {
            return 'localStorage';
        } else if (storageAvailable.sessionStorage) {
            return 'sessionStorage';
        } else if (storageAvailable.cookie) {
            return 'cookie';
        } else {
            console.warn('No storage method available. Data will not persist.');
            return 'memory';
        }
    }

    // In-memory fallback storage
    const memoryStorage = {};

    // Cookie methods
    function setCookie(name, value, days) {
        try {
            const key = config.prefix + name;
            let expires = '';
            
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = `; expires=${date.toUTCString()}`;
            }
            
            document.cookie = `${key}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
            return true;
        } catch (e) {
            console.error('Error setting cookie:', e);
            return false;
        }
    }

    function getCookie(name) {
        try {
            const key = config.prefix + name;
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${key}=`);
            
            if (parts.length === 2) {
                const cookieValue = parts.pop().split(';').shift();
                return decodeURIComponent(cookieValue);
            }
            return null;
        } catch (e) {
            console.error('Error getting cookie:', e);
            return null;
        }
    }

    function removeCookie(name) {
        try {
            const key = config.prefix + name;
            document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            return true;
        } catch (e) {
            console.error('Error removing cookie:', e);
            return false;
        }
    }

    // Public API
    return {
        // Configure storage settings
        configure: function(options) {
            Object.assign(config, options);
        },
        
        // Get configuration
        getConfig: function() {
            return {...config};
        },
        
        // Set a value in storage
        set: function(key, value, options = {}) {
            const method = options.method || getBestStorageMethod();
            const expiry = options.expiry !== undefined ? options.expiry : config.defaultExpiry;
            const prefixedKey = options.usePrefix !== false ? config.prefix + key : key;
            
            try {
                // Convert non-string values to JSON
                const valueToStore = typeof value !== 'string' ? JSON.stringify(value) : value;
                
                switch (method) {
                    case 'localStorage':
                        if (expiry) {
                            const item = {
                                value: valueToStore,
                                expiry: expiry ? Date.now() + (expiry * 24 * 60 * 60 * 1000) : null
                            };
                            localStorage.setItem(prefixedKey, JSON.stringify(item));
                        } else {
                            localStorage.setItem(prefixedKey, valueToStore);
                        }
                        break;
                        
                    case 'sessionStorage':
                        sessionStorage.setItem(prefixedKey, valueToStore);
                        break;
                        
                    case 'cookie':
                        setCookie(key, valueToStore, expiry);
                        break;
                        
                    case 'memory':
                        memoryStorage[prefixedKey] = valueToStore;
                        break;
                }
                
                return true;
            } catch (e) {
                console.error('Error storing data:', e);
                return false;
            }
        },
        
        // Get a value from storage
        get: function(key, options = {}) {
            const method = options.method || getBestStorageMethod();
            const prefixedKey = options.usePrefix !== false ? config.prefix + key : key;
            const defaultValue = options.default;
            
            try {
                let value = null;
                
                switch (method) {
                    case 'localStorage':
                        const item = localStorage.getItem(prefixedKey);
                        if (item) {
                            try {
                                const parsed = JSON.parse(item);
                                // Check if it's our format with expiry
                                if (parsed && typeof parsed === 'object' && 'value' in parsed) {
                                    // Check if expired
                                    if (parsed.expiry && Date.now() > parsed.expiry) {
                                        localStorage.removeItem(prefixedKey);
                                        return defaultValue;
                                    }
                                    value = parsed.value;
                                } else {
                                    value = item;
                                }
                            } catch (e) {
                                // If not JSON, return as is
                                value = item;
                            }
                        }
                        break;
                        
                    case 'sessionStorage':
                        value = sessionStorage.getItem(prefixedKey);
                        break;
                        
                    case 'cookie':
                        value = getCookie(key);
                        break;
                        
                    case 'memory':
                        value = memoryStorage[prefixedKey];
                        break;
                }
                
                if (value === null) {
                    return defaultValue;
                }
                
                // Try to parse JSON if it looks like JSON
                if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        return JSON.parse(value);
                    } catch (e) {
                        return value;
                    }
                }
                
                return value;
            } catch (e) {
                console.error('Error retrieving data:', e);
                return defaultValue;
            }
        },
        
        // Remove a value from storage
        remove: function(key, options = {}) {
            const method = options.method || getBestStorageMethod();
            const prefixedKey = options.usePrefix !== false ? config.prefix + key : key;
            
            try {
                switch (method) {
                    case 'localStorage':
                        localStorage.removeItem(prefixedKey);
                        break;
                        
                    case 'sessionStorage':
                        sessionStorage.removeItem(prefixedKey);
                        break;
                        
                    case 'cookie':
                        removeCookie(key);
                        break;
                        
                    case 'memory':
                        delete memoryStorage[prefixedKey];
                        break;
                }
                
                return true;
            } catch (e) {
                console.error('Error removing data:', e);
                return false;
            }
        },
        
        // Clear all storage (only items with our prefix)
        clear: function(options = {}) {
            const method = options.method || getBestStorageMethod();
            
            try {
                switch (method) {
                    case 'localStorage':
                        for (let i = localStorage.length - 1; i >= 0; i--) {
                            const key = localStorage.key(i);
                            if (key.startsWith(config.prefix)) {
                                localStorage.removeItem(key);
                            }
                        }
                        break;
                        
                    case 'sessionStorage':
                        for (let i = sessionStorage.length - 1; i >= 0; i--) {
                            const key = sessionStorage.key(i);
                            if (key.startsWith(config.prefix)) {
                                sessionStorage.removeItem(key);
                            }
                        }
                        break;
                        
                    case 'cookie':
                        const cookies = document.cookie.split(';');
                        for (let i = 0; i < cookies.length; i++) {
                            const cookie = cookies[i].trim();
                            const key = cookie.split('=')[0];
                            if (key.startsWith(config.prefix)) {
                                document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                            }
                        }
                        break;
                        
                    case 'memory':
                        for (const key in memoryStorage) {
                            if (key.startsWith(config.prefix)) {
                                delete memoryStorage[key];
                            }
                        }
                        break;
                }
                
                return true;
            } catch (e) {
                console.error('Error clearing storage:', e);
                return false;
            }
        }
    };
})();

// Make Storage available globally
window.Storage = Storage; 