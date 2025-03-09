/**
 * Stream Highlights Manager
 * Handles the display and interaction with stream highlights
 */
const HighlightsManager = (function() {
    // Configuration
    const CONFIG = {
        MAX_HIGHLIGHTS: 6,                // Maximum number of highlights to display
        ADMIN_USERNAME: 'Stream150Admin', // Admin username with upload privileges
        STORAGE_KEY: 'stream150Highlights' // Local storage key for highlights
    };

    // Sample highlight data - in a real implementation, this would come from an API
    const sampleHighlights = [
        {
            id: 'highlight-1',
            title: 'Stream Test',
            duration: 'YouTube',
            date: 'Highlight',
            thumbnailUrl: 'https://img.youtube.com/vi/9QnVbfKd7is/mqdefault.jpg',
            videoUrl: 'https://www.youtube.com/watch?v=9QnVbfKd7is',
            type: 'youtube',
            videoId: '9QnVbfKd7is'
        }
    ];

    // DOM elements
    let highlightsContainer;
    let youtubeModal;
    let youtubeIframe;
    let uploadModal;
    let uploadForm;
    let thumbnailUploadArea;
    let thumbnailFile;
    let thumbnailPreview;
    let thumbnailImage;
    let youtubeUrlInput;
    let userHighlights = [];
    let isAdmin = false;

    /**
     * Initialize the highlights manager
     */
    function init() {
        // Get DOM elements
        highlightsContainer = document.querySelector('.highlights-container');
        youtubeModal = document.getElementById('youtubeModal');
        youtubeIframe = document.getElementById('youtubeIframe');
        uploadModal = document.getElementById('uploadModal');
        uploadForm = document.getElementById('uploadForm');
        thumbnailUploadArea = document.getElementById('thumbnailUploadArea');
        thumbnailFile = document.getElementById('thumbnailFile');
        thumbnailPreview = document.getElementById('thumbnailPreview');
        thumbnailImage = document.getElementById('thumbnailImage');
        youtubeUrlInput = document.getElementById('youtubeUrl');
        
        if (highlightsContainer) {
            // Initialize max highlights display
            updateMaxHighlightsDisplay();
            
            // Initial check for admin status
            checkAdminStatus();
            
            // Set up retry mechanism for admin check
            setupAdminCheckRetry();
            
            // Add click event listeners to all highlight cards
            setupEventListeners();
            
            // Load highlights from local storage
            loadHighlights();
            
            console.log('Highlights Manager initialized');
        }
    }

    /**
     * Set up retry mechanism for admin check
     * Will keep checking for admin status for up to 1 minute
     */
    function setupAdminCheckRetry() {
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds (1 minute)
        const retryInterval = 2000; // 2 seconds between attempts
        
        console.log('Setting up admin check retry mechanism...');
        
        const retryCheck = function() {
            attempts++;
            console.log(`Admin check attempt ${attempts}/${maxAttempts}`);
            
            // Check admin status
            const result = checkAdminStatus();
            
            // If we found the admin or reached max attempts, stop retrying
            if (result.isAdmin || attempts >= maxAttempts) {
                console.log(`Admin check complete. Admin found: ${result.isAdmin}`);
                if (result.isAdmin) {
                    // Add a notification that admin was found
                    const adminMessage = document.querySelector('.admin-message');
                    if (adminMessage) {
                        adminMessage.innerHTML = `<strong>Admin access granted!</strong> You are logged in as ${result.username}.`;
                        adminMessage.classList.add('admin-message-active');
                        
                        // Highlight the message
                        adminMessage.classList.add('admin-highlight');
                        setTimeout(() => {
                            adminMessage.classList.remove('admin-highlight');
                        }, 2000);
                    }
                }
                return;
            }
            
            // Schedule next check
            setTimeout(retryCheck, retryInterval);
        };
        
        // Start the retry process after a short delay
        setTimeout(retryCheck, retryInterval);
    }

    /**
     * Update the max highlights display
     */
    function updateMaxHighlightsDisplay() {
        const maxHighlightsElement = document.getElementById('maxHighlights');
        if (maxHighlightsElement) {
            maxHighlightsElement.textContent = CONFIG.MAX_HIGHLIGHTS;
        }
    }

    /**
     * Update the highlight count display
     */
    function updateHighlightCountDisplay() {
        const highlightCountElement = document.getElementById('highlightCount');
        if (highlightCountElement) {
            const count = getAllHighlights().length;
            highlightCountElement.textContent = count;
            
            // Add visual indication if approaching limit
            if (count >= CONFIG.MAX_HIGHLIGHTS) {
                highlightCountElement.classList.add('count-limit');
            } else {
                highlightCountElement.classList.remove('count-limit');
            }
        }
    }

    /**
     * Check if the current user is an admin
     */
    function checkAdminStatus() {
        // Get username from UserManager if available
        let username = 'Anonymous';
        let source = 'default';
        
        // Method 1: Try to get from UserManager global object
        if (window.UserManager && typeof window.UserManager.getUsername === 'function') {
            try {
                username = window.UserManager.getUsername();
                source = 'UserManager.getUsername()';
            } catch (e) {
                console.error('Error getting username from UserManager:', e);
            }
        }
        
        // Method 2: Try to get from DOM elements
        if (username === 'Anonymous') {
            const usernameElements = document.querySelectorAll('.current-username');
            if (usernameElements && usernameElements.length > 0) {
                const displayedName = usernameElements[0].textContent.trim();
                if (displayedName && displayedName !== 'Anonymous') {
                    username = displayedName;
                    source = 'DOM element';
                }
            }
        }
        
        // Method 3: Try localStorage directly
        if (username === 'Anonymous') {
            try {
                const userData = localStorage.getItem('userData');
                if (userData) {
                    const parsedData = JSON.parse(userData);
                    if (parsedData && parsedData.username) {
                        username = parsedData.username;
                        source = 'localStorage.userData';
                    }
                }
            } catch (e) {
                console.error('Error checking user data in localStorage:', e);
            }
        }
        
        // Method 4: Check other possible localStorage keys
        if (username === 'Anonymous') {
            try {
                const username_storage = localStorage.getItem('username');
                if (username_storage) {
                    username = username_storage;
                    source = 'localStorage.username';
                }
            } catch (e) {
                console.error('Error checking username in localStorage:', e);
            }
        }
        
        // Check if user is admin
        const previousAdminStatus = isAdmin;
        isAdmin = username === CONFIG.ADMIN_USERNAME;
        
        // Log detailed information
        console.log('Username detection:');
        console.log('- Username:', username);
        console.log('- Source:', source);
        console.log('- Admin username should be:', CONFIG.ADMIN_USERNAME);
        console.log('- Is admin:', isAdmin);
        console.log('- Previous admin status:', previousAdminStatus);
        
        // Show/hide upload card based on admin status
        toggleUploadCardVisibility();
        
        // Return the status for debugging
        return {
            username,
            source,
            isAdmin,
            adminUsername: CONFIG.ADMIN_USERNAME
        };
    }

    /**
     * Toggle visibility of the upload card based on admin status
     */
    function toggleUploadCardVisibility() {
        const uploadCard = document.querySelector('.highlight-card.upload-card');
        console.log('Toggle upload card visibility:');
        console.log('- Upload card element found:', !!uploadCard);
        console.log('- Is admin:', isAdmin);
        
        if (uploadCard) {
            if (isAdmin) {
                console.log('- Setting upload card to display: block');
                uploadCard.style.display = 'block';
                
                // Make sure it's visible by also setting other properties
                uploadCard.style.visibility = 'visible';
                uploadCard.style.opacity = '1';
                
                // Add a highlight effect to make it obvious
                uploadCard.classList.add('admin-highlight');
                setTimeout(() => {
                    uploadCard.classList.remove('admin-highlight');
                }, 2000);
            } else {
                console.log('- Setting upload card to display: none');
                uploadCard.style.display = 'none';
            }
        } else {
            console.error('Upload card element not found in the DOM');
        }
        
        // Also update the admin message
        const adminMessage = document.querySelector('.admin-message');
        if (adminMessage) {
            if (isAdmin) {
                adminMessage.innerHTML = 'You are logged in as <strong>Stream150Admin</strong>. You can upload and manage highlights.';
                adminMessage.classList.add('admin-message-active');
            } else {
                adminMessage.innerHTML = 'Note: Only Stream150Admin can upload highlights';
                adminMessage.classList.remove('admin-message-active');
            }
        }
        
        // Show/hide debug controls
        const debugControls = document.getElementById('adminDebugControls');
        if (debugControls) {
            debugControls.style.display = isAdmin ? 'block' : 'none';
        }
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // YouTube card click
        const youtubeCards = document.querySelectorAll('.highlight-card.youtube-embed');
        youtubeCards.forEach(card => {
            card.addEventListener('click', handleYoutubeClick);
        });

        // Regular highlight card click
        const regularCards = document.querySelectorAll('.highlight-card:not(.youtube-embed):not(.upload-card)');
        regularCards.forEach(card => {
            card.addEventListener('click', handleHighlightClick);
        });

        // Upload card click (only for admin)
        const uploadCard = document.querySelector('.highlight-card.upload-card');
        if (uploadCard) {
            uploadCard.addEventListener('click', function(e) {
                if (isAdmin) {
                    openUploadModal();
                } else {
                    e.preventDefault();
                    alert('Only Stream150Admin can upload highlights.');
                }
            });
        }

        // Close YouTube modal
        const closeYoutubeBtn = document.getElementById('closeYoutubeModal');
        if (closeYoutubeBtn) {
            closeYoutubeBtn.addEventListener('click', closeYoutubeModal);
        }

        // Close upload modal
        const cancelUploadBtn = document.getElementById('cancelUpload');
        if (cancelUploadBtn) {
            cancelUploadBtn.addEventListener('click', closeUploadModal);
        }

        // Handle thumbnail file upload
        if (thumbnailFile) {
            thumbnailFile.addEventListener('change', handleThumbnailUpload);
        }

        if (thumbnailUploadArea) {
            thumbnailUploadArea.addEventListener('click', function() {
                thumbnailFile.click();
            });
        }

        // Handle form submission
        if (uploadForm) {
            uploadForm.addEventListener('submit', handleUploadSubmit);
        }

        // YouTube URL input change
        if (youtubeUrlInput) {
            youtubeUrlInput.addEventListener('input', handleYoutubeUrlInput);
        }

        // Close modals when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === youtubeModal) {
                closeYoutubeModal();
            }
            if (event.target === uploadModal) {
                closeUploadModal();
            }
        });

        // Listen for username changes
        document.addEventListener('usernameChanged', function(e) {
            checkAdminStatus();
        });
    }

    /**
     * Handle click on a YouTube highlight card
     * @param {Event} event - The click event
     */
    function handleYoutubeClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Find the closest highlight card if clicked on a child element
        const card = event.target.closest('.highlight-card');
        if (!card) return;
        
        // Get the video ID from the thumbnail element
        const thumbnailElement = card.querySelector('.youtube-preview');
        if (!thumbnailElement) return;
        
        const videoId = thumbnailElement.getAttribute('data-video-id');
        console.log('YouTube highlight clicked, video ID:', videoId);
        
        if (videoId) {
            // On mobile, open in YouTube app if possible
            if (isMobileDevice()) {
                window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
            } else {
                // On desktop, use the modal
                openYoutubeModal(videoId);
            }
        } else {
            console.error('No video ID found for YouTube highlight');
        }
    }

    /**
     * Check if the current device is mobile
     * @returns {boolean} - True if mobile device
     */
    function isMobileDevice() {
        return (window.innerWidth <= 767) || 
               (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }

    /**
     * Open YouTube modal with the specified video ID
     * @param {string} videoId - The YouTube video ID
     */
    function openYoutubeModal(videoId) {
        if (youtubeModal && youtubeIframe) {
            // Set the iframe source with the video ID
            youtubeIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            
            // Show the modal
            youtubeModal.classList.add('active');
            
            // Prevent body scrolling
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close the YouTube modal
     */
    function closeYoutubeModal() {
        if (youtubeModal && youtubeIframe) {
            // Hide the modal
            youtubeModal.classList.remove('active');
            
            // Stop the video by clearing the iframe source
            youtubeIframe.src = '';
            
            // Allow body scrolling
            document.body.style.overflow = '';
        }
    }

    /**
     * Handle click on a regular highlight card
     * @param {Event} event - The click event
     */
    function handleHighlightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Find the closest highlight card if clicked on a child element
        const card = event.target.closest('.highlight-card');
        if (!card) return;
        
        const title = card.querySelector('h4').textContent;
        const highlightId = card.getAttribute('data-id');
        
        console.log(`Highlight clicked: ${title} (ID: ${highlightId})`);
        
        // Find the highlight data
        const allHighlights = getAllHighlights();
        const highlight = allHighlights.find(h => h.id === highlightId);
        
        if (highlight) {
            if (highlight.type === 'youtube' && highlight.videoId) {
                // On mobile, open in YouTube app if possible
                if (isMobileDevice()) {
                    window.open(`https://www.youtube.com/watch?v=${highlight.videoId}`, '_blank');
                } else {
                    // On desktop, use the modal
                    openYoutubeModal(highlight.videoId);
                }
            } else if (highlight.videoUrl && highlight.videoUrl !== '#') {
                // Open video URL if it's a valid URL
                window.open(highlight.videoUrl, '_blank');
            } else {
                // Fallback to showing an alert
                alert(`Playing highlight: ${title}\n\nIn a production environment, this would play the actual video.`);
            }
        } else {
            console.error('Highlight data not found for ID:', highlightId);
            alert(`Error: Could not find data for highlight "${title}"`);
        }
    }

    /**
     * Open the upload modal
     */
    function openUploadModal() {
        if (!isAdmin) {
            alert('Only Stream150Admin can upload highlights.');
            return;
        }
        
        if (uploadModal) {
            // Reset the form
            if (uploadForm) {
                uploadForm.reset();
            }
            
            // Hide thumbnail preview
            if (thumbnailPreview) {
                thumbnailPreview.style.display = 'none';
            }
            
            // Show the modal
            uploadModal.classList.add('active');
            
            // Prevent body scrolling
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close the upload modal
     */
    function closeUploadModal() {
        if (uploadModal) {
            // Hide the modal
            uploadModal.classList.remove('active');
            
            // Allow body scrolling
            document.body.style.overflow = '';
        }
    }

    /**
     * Handle thumbnail file upload
     * @param {Event} event - The change event
     */
    function handleThumbnailUpload(event) {
        const file = event.target.files[0];
        
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                // Set the preview image source
                thumbnailImage.src = e.target.result;
                
                // Show the preview
                thumbnailPreview.style.display = 'block';
            };
            
            reader.readAsDataURL(file);
        }
    }

    /**
     * Handle YouTube URL input
     * @param {Event} event - The input event
     */
    function handleYoutubeUrlInput(event) {
        const url = event.target.value;
        
        // Extract video ID from YouTube URL
        const videoId = extractYoutubeVideoId(url);
        
        if (videoId) {
            // Set thumbnail preview from YouTube
            thumbnailImage.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            thumbnailPreview.style.display = 'block';
        }
    }

    /**
     * Extract YouTube video ID from URL
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The video ID or null if not found
     */
    function extractYoutubeVideoId(url) {
        if (!url) return null;
        
        // Regular expressions to match YouTube URL patterns
        const regexps = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/,
            /youtube\.com\/embed\/([^\/\?]+)/,
            /youtube\.com\/v\/([^\/\?]+)/
        ];
        
        for (const regex of regexps) {
            const match = url.match(regex);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }

    /**
     * Handle upload form submission
     * @param {Event} event - The submit event
     */
    function handleUploadSubmit(event) {
        event.preventDefault();
        
        if (!isAdmin) {
            alert('Only Stream150Admin can upload highlights.');
            return;
        }
        
        // Check if we've reached the maximum number of highlights
        if (getAllHighlights().length >= CONFIG.MAX_HIGHLIGHTS) {
            alert(`Maximum number of highlights (${CONFIG.MAX_HIGHLIGHTS}) reached. Please remove some highlights before adding more.`);
            return;
        }
        
        const title = document.getElementById('highlightTitle').value;
        const duration = document.getElementById('highlightDuration').value || '0:00';
        const youtubeUrl = document.getElementById('youtubeUrl').value;
        
        let thumbnailUrl = '';
        let videoUrl = '#';
        let type = 'local';
        let videoId = null;
        
        // Check if YouTube URL was provided
        if (youtubeUrl) {
            videoId = extractYoutubeVideoId(youtubeUrl);
            if (videoId) {
                thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                videoUrl = youtubeUrl;
                type = 'youtube';
            }
        } else if (thumbnailFile.files.length > 0) {
            // Use the uploaded thumbnail
            thumbnailUrl = URL.createObjectURL(thumbnailFile.files[0]);
        }
        
        // Create new highlight object
        const newHighlight = {
            id: 'highlight-' + Date.now(),
            title,
            duration,
            date: 'Just now',
            thumbnailUrl,
            videoUrl,
            type,
            videoId
        };
        
        // Add to highlights
        addHighlight(newHighlight);
        
        // Close the modal
        closeUploadModal();
    }

    /**
     * Add a highlight to the collection and update UI
     * @param {Object} highlight - The highlight data
     */
    function addHighlight(highlight) {
        // Add to user highlights
        userHighlights.push(highlight);
        
        // Save to local storage
        saveHighlights();
        
        // Add to UI
        addHighlightCard(highlight);
        
        // Update count display
        updateHighlightCountDisplay();
    }

    /**
     * Remove a highlight by ID
     * @param {string} id - The highlight ID
     */
    function removeHighlight(id) {
        console.log(`Removing highlight with ID: ${id}`);
        
        // Check if this is a sample highlight
        const isSampleHighlight = sampleHighlights.some(h => h.id === id);
        
        if (isSampleHighlight) {
            // For sample highlights, we'll just hide it from the UI
            // In a real implementation, you would remove it from the database
            console.log('This is a sample highlight. In a real implementation, it would be removed from the database.');
            
            // Remove from UI
            const card = document.querySelector(`.highlight-card[data-id="${id}"]`);
            if (card) {
                // Add a fade-out animation
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                
                // Remove after animation completes
                setTimeout(() => {
                    card.remove();
                    
                    // Update count display
                    updateHighlightCountDisplay();
                }, 300);
            }
        } else {
            // Remove from user highlights
            const previousLength = userHighlights.length;
            userHighlights = userHighlights.filter(h => h.id !== id);
            
            // Log the result
            console.log(`Removed highlight from userHighlights array. Before: ${previousLength}, After: ${userHighlights.length}`);
            
            // Save to local storage
            saveHighlights();
            
            // Remove from UI
            const card = document.querySelector(`.highlight-card[data-id="${id}"]`);
            if (card) {
                // Add a fade-out animation
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                
                // Remove after animation completes
                setTimeout(() => {
                    card.remove();
                    
                    // Update count display
                    updateHighlightCountDisplay();
                }, 300);
            } else {
                console.error(`Could not find card element for highlight ID: ${id}`);
                
                // Update count display anyway
                updateHighlightCountDisplay();
            }
        }
    }

    /**
     * Add a highlight card to the UI
     * @param {Object} highlight - The highlight data
     */
    function addHighlightCard(highlight) {
        // Create a new highlight card element
        const card = document.createElement('div');
        card.className = highlight.type === 'youtube' ? 'highlight-card youtube-embed' : 'highlight-card';
        card.setAttribute('data-id', highlight.id);
        
        // Create the card content
        let thumbnailHtml = '';
        
        if (highlight.type === 'youtube' && highlight.videoId) {
            thumbnailHtml = `
                <div class="highlight-thumbnail youtube-preview" data-video-id="${highlight.videoId}">
                    <img src="${highlight.thumbnailUrl}" alt="${highlight.title}" class="youtube-thumbnail">
                    <div class="highlight-duration">${highlight.duration}</div>
                    <div class="highlight-play-button">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
            `;
        } else {
            thumbnailHtml = `
                <div class="highlight-thumbnail">
                    ${highlight.thumbnailUrl ? `<img src="${highlight.thumbnailUrl}" alt="${highlight.title}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">` : ''}
                    <div class="highlight-duration">${highlight.duration}</div>
                    <div class="highlight-play-button">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
            `;
        }
        
        // Add delete button for admin
        const adminControlsHtml = isAdmin ? `
            <div class="highlight-admin-controls">
                <button class="highlight-delete-btn" title="Delete highlight">×</button>
            </div>
        ` : '';
        
        card.innerHTML = `
            ${thumbnailHtml}
            <div class="highlight-info">
                <h4>${highlight.title}</h4>
                <span class="highlight-date">${highlight.date}</span>
            </div>
            ${adminControlsHtml}
        `;
        
        // Add event listener for playing
        if (highlight.type === 'youtube') {
            card.addEventListener('click', handleYoutubeClick);
        } else {
            card.addEventListener('click', handleHighlightClick);
        }
        
        // Add event listener for delete button if admin
        if (isAdmin) {
            const deleteBtn = card.querySelector('.highlight-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent triggering the card click
                    if (confirm(`Delete highlight "${highlight.title}"?`)) {
                        removeHighlight(highlight.id);
                    }
                });
            }
        }
        
        // Find the upload card
        const uploadCard = document.querySelector('.highlight-card.upload-card');
        
        // Insert the new card before the upload card
        if (uploadCard && highlightsContainer) {
            highlightsContainer.insertBefore(card, uploadCard);
        } else if (highlightsContainer) {
            highlightsContainer.appendChild(card);
        }
    }

    /**
     * Get all highlights (sample + user)
     * @returns {Array} - Combined highlights
     */
    function getAllHighlights() {
        return [...sampleHighlights, ...userHighlights];
    }

    /**
     * Load highlights from local storage
     */
    function loadHighlights() {
        // Clear existing highlights
        clearHighlightsUI();
        
        // Load user highlights from storage
        loadUserHighlights();
        
        // Add sample highlights first
        sampleHighlights.forEach(highlight => {
            addHighlightCard(highlight);
        });
        
        // Check if we need to limit the number of highlights
        enforceHighlightLimit();
        
        // Update the count display
        updateHighlightCountDisplay();
    }

    /**
     * Clear all highlights from the UI
     */
    function clearHighlightsUI() {
        // Remove all highlight cards except the upload card
        const cards = document.querySelectorAll('.highlight-card:not(.upload-card)');
        cards.forEach(card => card.remove());
    }

    /**
     * Enforce the maximum number of highlights
     */
    function enforceHighlightLimit() {
        const allHighlights = getAllHighlights();
        
        if (allHighlights.length > CONFIG.MAX_HIGHLIGHTS) {
            // Remove excess user highlights
            const excess = allHighlights.length - CONFIG.MAX_HIGHLIGHTS;
            userHighlights = userHighlights.slice(0, Math.max(0, userHighlights.length - excess));
            
            // Save to storage
            saveHighlights();
            
            // Reload UI
            loadHighlights();
        }
    }

    /**
     * Load user highlights from local storage
     */
    function loadUserHighlights() {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        
        if (stored) {
            try {
                userHighlights = JSON.parse(stored);
                
                // Add each highlight to the UI
                userHighlights.forEach(highlight => {
                    addHighlightCard(highlight);
                });
            } catch (error) {
                console.error('Error loading user highlights:', error);
                userHighlights = [];
            }
        }
    }

    /**
     * Save highlights to local storage
     */
    function saveHighlights() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(userHighlights));
    }

    // Public API
    return {
        init,
        openYoutubeModal,
        openUploadModal,
        checkAdminStatus,
        CONFIG
    };
})();

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the highlights manager
    HighlightsManager.init();
}); 