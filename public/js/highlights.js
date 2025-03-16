/**
 * Stream Highlights Manager
 * Handles the display and interaction with stream highlights
 */
// Define HighlightsManager and explicitly attach it to window
window.HighlightsManager = (function() {
    // Configuration
    const CONFIG = {
        MAX_HIGHLIGHTS: 6,                // Maximum number of highlights to display
        ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'Tristan', // Admin username from environment variable with fallback
        STORAGE_KEY: 'stream150Highlights' // Local storage key for highlights
    };

    // Sample highlight data - in a real implementation, this would come from an API
    const sampleHighlights = [
        {
            id: 'highlight-1',
            title: 'Stream Test',
            duration: 'Video',
            date: 'Highlight',
            thumbnailUrl: 'https://img.youtube.com/vi/9QnVbfKd7is/mqdefault.jpg',
            videoUrl: 'https://www.youtube.com/watch?v=9QnVbfKd7is',
            type: 'youtube',
            videoId: '9QnVbfKd7is'
        }
    ];

    // Private state
    let currentUsername = null;
    
    // DOM elements
    let desktopHighlightsContainer;
    let mobileHighlightsContainer;
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
    let useServerStorage = false; // Flag to indicate if we're using server storage

    // Track which highlights have been dispatched to prevent duplicates
    const dispatchedHighlights = new Set();
    const dispatchedRemovals = new Set();

    /**
     * Initialize the highlights manager
     */
    function init() {
        // Get DOM elements
        desktopHighlightsContainer = document.querySelector('.desktop-highlights .highlights-container');
        mobileHighlightsContainer = document.querySelector('.mobile-highlights .highlights-container');
        youtubeModal = document.getElementById('youtubeModal');
        youtubeIframe = document.getElementById('youtubeIframe');
        uploadModal = document.getElementById('uploadModal');
        uploadForm = document.getElementById('uploadForm');
        thumbnailUploadArea = document.getElementById('thumbnailUploadArea');
        thumbnailFile = document.getElementById('thumbnailFile');
        thumbnailPreview = document.getElementById('thumbnailPreview');
        thumbnailImage = document.getElementById('thumbnailImage');
        youtubeUrlInput = document.getElementById('youtubeUrl');
        
        if (desktopHighlightsContainer || mobileHighlightsContainer) {
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
                    
                    // Make sure all highlight cards have delete buttons
                    updateHighlightCardsForAdmin();
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
        const mobileMaxHighlightsElement = document.getElementById('mobileMaxHighlights');
        
        if (maxHighlightsElement) {
            maxHighlightsElement.textContent = CONFIG.MAX_HIGHLIGHTS;
        }
        
        if (mobileMaxHighlightsElement) {
            mobileMaxHighlightsElement.textContent = CONFIG.MAX_HIGHLIGHTS;
        }
    }

    /**
     * Update the highlight count display
     */
    function updateHighlightCountDisplay() {
        const highlightCountElement = document.getElementById('highlightCount');
        const mobileHighlightCountElement = document.getElementById('mobileHighlightCount');
        const count = getAllHighlights().length;
        
        if (highlightCountElement) {
            highlightCountElement.textContent = count;
            
            // Add visual indication if approaching limit
            if (count >= CONFIG.MAX_HIGHLIGHTS) {
                highlightCountElement.classList.add('count-limit');
            } else {
                highlightCountElement.classList.remove('count-limit');
            }
        }
        
        if (mobileHighlightCountElement) {
            mobileHighlightCountElement.textContent = count;
            
            // Add visual indication if approaching limit
            if (count >= CONFIG.MAX_HIGHLIGHTS) {
                mobileHighlightCountElement.classList.add('count-limit');
            } else {
                mobileHighlightCountElement.classList.remove('count-limit');
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
        console.log('- Is admin:', isAdmin);
        
        // If admin status changed, update the UI
        if (previousAdminStatus !== isAdmin) {
            console.log('Admin status changed. Updating UI...');
            
            // Show/hide upload card based on admin status
            toggleUploadCardVisibility();
            
            // Update all highlight cards to show/hide delete buttons
            updateHighlightCardsForAdmin();
        } else {
            // Just toggle visibility without full update
            toggleUploadCardVisibility();
        }
        
        // Return the status for debugging
        return {
            username,
            source,
            isAdmin,
            adminUsername: CONFIG.ADMIN_USERNAME
        };
    }

    /**
     * Update all highlight cards to show/hide admin controls based on admin status
     */
    function updateHighlightCardsForAdmin() {
        console.log('Updating highlight cards for admin status:', isAdmin);
        
        // Update desktop highlight cards
        if (desktopHighlightsContainer) {
            const desktopCards = desktopHighlightsContainer.querySelectorAll('.highlight-card:not(.upload-card)');
            
            desktopCards.forEach(card => {
                const highlightId = card.getAttribute('data-id');
                console.log(`Updating desktop card ${highlightId} for admin status`);
                
                // Remove existing admin controls if any
                const existingControls = card.querySelector('.highlight-admin-controls');
                if (existingControls) {
                    existingControls.remove();
                }
                
                // Add admin controls if admin
                if (isAdmin) {
                    // Get the highlight title for the confirmation dialog
                    const titleElement = card.querySelector('h4');
                    const title = titleElement ? titleElement.textContent : 'this highlight';
                    
                    // Create admin controls
                    const adminControls = document.createElement('div');
                    adminControls.className = 'highlight-admin-controls';
                    adminControls.innerHTML = `
                        <button class="highlight-delete-btn" title="Delete Highlight">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    `;
                    
                    // Add delete event listener
                    const deleteBtn = adminControls.querySelector('.highlight-delete-btn');
                    deleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevent opening the highlight
                        
                        if (confirm(`Are you sure you want to delete "${title}"?`)) {
                            removeHighlight(highlightId);
                        }
                    });
                    
                    // Add to card
                    card.appendChild(adminControls);
                }
            });
        }
        
        // Update mobile highlight cards
        if (mobileHighlightsContainer) {
            const mobileCards = mobileHighlightsContainer.querySelectorAll('.highlight-card:not(.upload-card)');
            
            mobileCards.forEach(card => {
                const highlightId = card.getAttribute('data-id');
                console.log(`Updating mobile card ${highlightId} for admin status`);
                
                // Remove existing admin controls if any
                const existingControls = card.querySelector('.highlight-admin-controls');
                if (existingControls) {
                    existingControls.remove();
                }
                
                // Add admin controls if admin
                if (isAdmin) {
                    // Get the highlight title for the confirmation dialog
                    const titleElement = card.querySelector('h4');
                    const title = titleElement ? titleElement.textContent : 'this highlight';
                    
                    // Create admin controls
                    const adminControls = document.createElement('div');
                    adminControls.className = 'highlight-admin-controls';
                    adminControls.innerHTML = `
                        <button class="highlight-delete-btn" title="Delete Highlight">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                        </button>
                    `;
                    
                    // Add delete event listener
                    const deleteBtn = adminControls.querySelector('.highlight-delete-btn');
                    deleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevent opening the highlight
                        
                        if (confirm(`Are you sure you want to delete "${title}"?`)) {
                            removeHighlight(highlightId);
                        }
                    });
                    
                    // Add to card
                    card.appendChild(adminControls);
                }
            });
        }
    }

    /**
     * Toggle visibility of the upload card based on admin status
     */
    function toggleUploadCardVisibility() {
        const desktopUploadCard = desktopHighlightsContainer ? desktopHighlightsContainer.querySelector('.highlight-card.upload-card') : null;
        const mobileUploadCard = mobileHighlightsContainer ? mobileHighlightsContainer.querySelector('.highlight-card.upload-card') : null;
        
        console.log('Toggle upload card visibility:');
        console.log('- Desktop upload card found:', !!desktopUploadCard);
        console.log('- Mobile upload card found:', !!mobileUploadCard);
        console.log('- Is admin:', isAdmin);
        
        // Handle desktop upload card
        if (desktopUploadCard) {
            if (isAdmin) {
                console.log('- Setting desktop upload card to display: block');
                desktopUploadCard.style.display = 'block';
                desktopUploadCard.style.visibility = 'visible';
                desktopUploadCard.style.opacity = '1';
                
                // Add a highlight effect to make it obvious
                desktopUploadCard.classList.add('admin-highlight');
                setTimeout(() => {
                    desktopUploadCard.classList.remove('admin-highlight');
                }, 2000);
            } else {
                console.log('- Setting desktop upload card to display: none');
                desktopUploadCard.style.display = 'none';
                desktopUploadCard.style.visibility = 'hidden';
                desktopUploadCard.style.opacity = '0';
            }
        }
        
        // Handle mobile upload card
        if (mobileUploadCard) {
            if (isAdmin) {
                console.log('- Setting mobile upload card to display: block');
                mobileUploadCard.style.display = 'block';
                mobileUploadCard.style.visibility = 'visible';
                mobileUploadCard.style.opacity = '1';
                
                // Add a highlight effect to make it obvious
                mobileUploadCard.classList.add('admin-highlight');
                setTimeout(() => {
                    mobileUploadCard.classList.remove('admin-highlight');
                }, 2000);
            } else {
                console.log('- Setting mobile upload card to display: none');
                mobileUploadCard.style.display = 'none';
                mobileUploadCard.style.visibility = 'hidden';
                mobileUploadCard.style.opacity = '0';
            }
        }
        
        // Update admin message
        const adminMessage = document.querySelector('.admin-message');
        if (adminMessage) {
            adminMessage.style.display = isAdmin ? 'block' : 'none';
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
            console.log('Opening YouTube modal for video ID:', videoId);
            
            // Set the iframe source with the video ID and additional parameters
            // autoplay=1: Start playing automatically
            // rel=0: Don't show related videos
            // modestbranding=1: Hide YouTube logo
            // enablejsapi=1: Enable JavaScript API
            youtubeIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
            
            // Show the modal
            youtubeModal.classList.add('active');
            
            // Prevent body scrolling
            document.body.style.overflow = 'hidden';
        } else {
            console.error('YouTube modal elements not found, opening in new tab instead');
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
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
            if (highlight.type === 'youtube') {
                console.log('Playing YouTube video:', highlight);
                
                // Check if this is a live stream
                const isLiveStream = highlight.isLiveStream || 
                                    (highlight.videoUrl && (highlight.videoUrl.includes('/live/') || 
                                                           highlight.videoUrl.includes('&live')));
                
                // On mobile, open in YouTube app if possible
                if (isMobileDevice()) {
                    // For live streams, use the original URL if available
                    if (isLiveStream && highlight.videoUrl) {
                        window.open(highlight.videoUrl, '_blank');
                    } else if (highlight.videoId) {
                        window.open(`https://www.youtube.com/watch?v=${highlight.videoId}`, '_blank');
                    } else {
                        alert(`Error: Could not find video information for "${title}"`);
                    }
                } else {
                    // On desktop, use the modal for regular videos or open in new tab for live streams
                    if (isLiveStream) {
                        // Live streams often work better in a new tab
                        window.open(highlight.videoUrl || `https://www.youtube.com/watch?v=${highlight.videoId}`, '_blank');
                    } else if (highlight.videoId) {
                        // Regular videos work fine in the modal
                        openYoutubeModal(highlight.videoId);
                    } else {
                        alert(`Error: Could not find video ID for "${title}"`);
                    }
                }
            } else if (highlight.videoUrl && highlight.videoUrl !== '#') {
                // Open video URL if it's a valid URL
                console.log('Opening video URL:', highlight.videoUrl);
                window.open(highlight.videoUrl, '_blank');
            } else {
                // Fallback to showing an alert
                console.log('No video URL or ID found, showing alert');
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
            console.log('Extracted YouTube video ID:', videoId);
            
            // Try different thumbnail qualities in case one fails
            const thumbnailQualities = [
                `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,  // HD quality
                `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,      // Medium quality
                `https://img.youtube.com/vi/${videoId}/0.jpg`,              // Default thumbnail
                `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,      // Alternative HD path
                `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,          // Alternative medium path
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`           // Alternative HQ path
            ];
            
            // Create a test image to check if thumbnail exists
            const testImage = new Image();
            let currentQualityIndex = 0;
            
            testImage.onload = function() {
                // Image loaded successfully, use this thumbnail
                thumbnailImage.src = this.src;
                thumbnailPreview.style.display = 'block';
                console.log('Successfully loaded thumbnail:', this.src);
            };
            
            testImage.onerror = function() {
                // Try next quality if available
                currentQualityIndex++;
                console.log(`Thumbnail quality ${currentQualityIndex-1} failed, trying next...`);
                
                if (currentQualityIndex < thumbnailQualities.length) {
                    testImage.src = thumbnailQualities[currentQualityIndex];
                } else {
                    // If all qualities fail, use a placeholder with YouTube branding
                    console.warn('Could not load YouTube thumbnail, using placeholder');
                    thumbnailImage.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="100%" height="100%" fill="#1a1a1a"/><path d="M231.9 229.1l-83.9-48.5V277.6l83.9-48.5zm47.3-146.4c-3.1-11.8-12.4-21.1-24.1-24.3C232.3 52.5 160 52.5 160 52.5s-72.3 0-95.1 5.9c-11.7 3.2-21 12.5-24.1 24.3C35 105.4 35 150 35 150s0 44.6 5.8 67.3c3.1 11.8 12.4 21.1 24.1 24.3 22.8 5.9 95.1 5.9 95.1 5.9s72.3 0 95.1-5.9c11.7-3.2 21-12.5 24.1-24.3 5.8-22.7 5.8-67.3 5.8-67.3s0-44.6-5.8-67.3z" fill="#ff0000"/><text x="240" y="190" text-anchor="middle" fill="white" font-family="Arial" font-size="18">YouTube Video</text><text x="240" y="220" text-anchor="middle" fill="white" font-family="Arial" font-size="14">' + videoId + '</text></svg>');
                    thumbnailPreview.style.display = 'block';
                }
            };
            
            // Start with highest quality
            testImage.src = thumbnailQualities[0];
            
            // Also store the video ID for later use
            thumbnailImage.setAttribute('data-video-id', videoId);
        } else {
            console.error('Could not extract video ID from URL:', url);
            alert('Could not extract a valid YouTube video ID from the provided URL. Please check the URL format.');
        }
    }

    /**
     * Extract YouTube video ID from URL
     * @param {string} url - The YouTube URL
     * @returns {string|null} - The video ID or null if not found
     */
    function extractYoutubeVideoId(url) {
        if (!url) return null;
        
        console.log('Attempting to extract video ID from URL:', url);
        
        // Regular expressions to match various YouTube URL patterns
        const regexps = [
            // Standard watch URLs
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?]+)/,
            // Embed URLs
            /youtube\.com\/embed\/([^\/\?]+)/,
            // Short youtu.be URLs
            /youtu\.be\/([^\/\?]+)/,
            // v= parameter anywhere in the URL
            /[?&]v=([^&]+)/,
            // Live stream URLs
            /youtube\.com\/live\/([^\/\?]+)/,
            // Legacy live URLs
            /youtube\.com\/watch\?v=([^&]+)&?.*?\blive\b/
        ];
        
        for (const regex of regexps) {
            const match = url.match(regex);
            if (match) {
                console.log('Found video ID:', match[1], 'using pattern:', regex);
                return match[1];
            }
        }
        
        // If we get here, no pattern matched
        console.error('No matching pattern found for URL:', url);
        return null;
    }

    /**
     * Format a date for display in highlights
     * @param {Date|number|string} date - The date to format (Date object, timestamp, or ISO string)
     * @returns {string} - Formatted date string (e.g., "2 hours ago", "Yesterday", "June 15, 2024")
     */
    function formatHighlightDate(date) {
        // Convert input to Date object
        const dateObj = date instanceof Date ? date : new Date(date);
        
        // Check if the date is valid
        if (isNaN(dateObj.getTime())) {
            return 'Unknown date';
        }
        
        const now = new Date();
        const diffMs = now - dateObj;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffMonth = (now.getMonth() + now.getFullYear() * 12) - (dateObj.getMonth() + dateObj.getFullYear() * 12);
        
        // Just now: less than 1 minute ago
        if (diffMin < 1) {
            return 'Just now';
        }
        
        // Minutes: 1-59 minutes ago
        if (diffMin < 60) {
            return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
        }
        
        // Hours: 1-23 hours ago
        if (diffHour < 24) {
            return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
        }
        
        // Yesterday: 1 day ago, but still yesterday
        if (diffDay === 1 && now.getDate() !== dateObj.getDate()) {
            return 'Yesterday';
        }
        
        // Days: 1-6 days ago
        if (diffDay < 7) {
            return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
        }
        
        // Last week: 1 week ago
        if (diffDay < 14) {
            return '1 week ago';
        }
        
        // Weeks: 2-4 weeks ago
        if (diffDay < 30) {
            const weeks = Math.floor(diffDay / 7);
            return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
        }
        
        // Months: 1-11 months ago
        if (diffMonth < 12) {
            return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`;
        }
        
        // Years: 1+ years ago
        const years = Math.floor(diffMonth / 12);
        return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }

    /**
     * Update the dates displayed on highlight cards
     */
    function updateHighlightDates() {
        // Get all highlights
        const highlights = getAllHighlights();
        
        // Get all highlight cards
        const highlightCards = document.querySelectorAll('.highlight-card:not(.upload-card)');
        
        // Update each card's date display
        highlightCards.forEach(card => {
            const highlightId = card.dataset.id;
            const highlight = highlights.find(h => h.id === highlightId);
            
            if (highlight && highlight.timestamp) {
                const dateElement = card.querySelector('.highlight-date');
                if (dateElement) {
                    dateElement.textContent = formatHighlightDate(highlight.timestamp);
                }
            }
        });
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
        const duration = document.getElementById('highlightDuration').value || 'Video'; // Default to "Video" instead of "0:00"
        const youtubeUrl = document.getElementById('youtubeUrl').value;
        
        let thumbnailUrl = '';
        let videoUrl = '#';
        let type = 'local';
        let videoId = null;
        let displayDuration = duration; // Use the provided duration by default
        
        // Check if YouTube URL was provided
        if (youtubeUrl) {
            videoId = extractYoutubeVideoId(youtubeUrl);
            if (videoId) {
                // Get the thumbnail URL from the image if it was loaded
                if (thumbnailImage.getAttribute('data-video-id') === videoId) {
                    thumbnailUrl = thumbnailImage.src;
                } else {
                    // Fallback to medium quality thumbnail
                    thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                }
                
                // Check if this is a live stream URL
                const isLiveStream = youtubeUrl.includes('/live/') || youtubeUrl.includes('&live');
                
                // Ensure we have a proper YouTube URL format for playback
                if (isLiveStream) {
                    // For live streams, preserve the original URL format if possible
                    videoUrl = youtubeUrl;
                    displayDuration = 'Live'; // Set display duration to "Live" for live streams
                    console.log('Detected live stream URL, preserving original format:', videoUrl);
                } else {
                    // For regular videos, use the standard watch format
                    videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    
                    // If no custom duration was provided, set it to "Video"
                    if (!duration || duration === '0:00') {
                        displayDuration = 'Video';
                    }
                }
                
                type = 'youtube';
                
                console.log('Adding YouTube highlight:', {
                    videoId,
                    thumbnailUrl,
                    videoUrl,
                    isLiveStream,
                    displayDuration
                });
            } else {
                alert('Could not extract a valid YouTube video ID from the provided URL. Please check the URL and try again.');
                return;
            }
        } else if (thumbnailFile.files.length > 0) {
            // Use the uploaded thumbnail
            thumbnailUrl = URL.createObjectURL(thumbnailFile.files[0]);
            
            // If no custom duration was provided, set it to "Video"
            if (!duration || duration === '0:00') {
                displayDuration = 'Video';
            }
        } else {
            // No thumbnail or YouTube URL provided
            alert('Please either upload a thumbnail image or provide a YouTube URL.');
            return;
        }
        
        // Get current timestamp
        const now = new Date();
        const timestamp = now.getTime();
        
        // Create new highlight object
        const newHighlight = {
            id: 'highlight-' + timestamp,
            title,
            duration: displayDuration, // Use the display duration
            date: formatHighlightDate(now),
            timestamp: timestamp, // Store the actual timestamp
            thumbnailUrl,
            videoUrl,
            type,
            videoId,
            isLiveStream: youtubeUrl && youtubeUrl.includes('/live/')
        };
        
        // Add to highlights
        addHighlight(newHighlight);
        
        // Close the modal
        closeUploadModal();
    }

    /**
     * Add a highlight
     * @param {Object} highlight - The highlight to add
     */
    function addHighlight(highlight) {
        console.log('Adding highlight:', highlight);
        
        // Add to user highlights
        userHighlights.push(highlight);
        
        // Save to storage
        saveHighlights();
        
        // Add to UI
        clearHighlightsUI();
        
        // Get all highlights
        const allHighlights = getAllHighlights();
        
        // Sort highlights by timestamp (newest first)
        const sortedHighlights = sortHighlightsByTimestamp(allHighlights);
        
        // Add highlights to UI
        sortedHighlights.forEach(highlight => {
            addHighlightCard(highlight);
        });
        
        // Update highlight count display
        updateHighlightCountDisplay();
        
        // Enforce highlight limit
        enforceHighlightLimit();
        
        // Dispatch event for server integration
        dispatchHighlightAddedEvent(highlight);
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
                card.remove();
                
                // Update count display
                updateHighlightCountDisplay();
                
                // Dispatch event for server integration
                dispatchHighlightRemovedEvent(id);
            }
        } else {
            // Find the highlight in the user highlights array
            const highlightIndex = userHighlights.findIndex(h => h.id === id);
            
            if (highlightIndex !== -1) {
                // Get the highlight for logging
                const highlight = userHighlights[highlightIndex];
                console.log(`Found highlight at index ${highlightIndex}:`, highlight);
                
                // Remove from user highlights array
                userHighlights.splice(highlightIndex, 1);
                console.log(`Removed highlight from userHighlights array. New length: ${userHighlights.length}`);
                
                // Save to local storage
                saveHighlights();
                
                // Remove from UI
                const card = document.querySelector(`.highlight-card[data-id="${id}"]`);
                if (card) {
                    card.remove();
                    console.log('Removed highlight card from UI');
                } else {
                    console.error(`Could not find highlight card with ID: ${id} in the DOM`);
                }
                
                // Update count display
                updateHighlightCountDisplay();
                
                // Dispatch event for server integration
                dispatchHighlightRemovedEvent(id);
            } else {
                console.error(`Could not find highlight with ID: ${id} in userHighlights array`);
            }
        }
    }

    /**
     * Add a highlight card to the UI
     * @param {Object} highlight - The highlight to add
     */
    function addHighlightCard(highlight) {
        // Create highlight card element
        const card = document.createElement('div');
        card.className = 'highlight-card';
        card.dataset.id = highlight.id;
        
        // Add YouTube-specific class if it's a YouTube video
        if (highlight.type === 'youtube') {
            card.classList.add('youtube-embed');
        }
        
        // Format the date if we have a timestamp but no formatted date
        let displayDate = highlight.date;
        if (highlight.timestamp && (!highlight.date || highlight.date === 'Just now')) {
            displayDate = formatHighlightDate(highlight.timestamp);
        }
        
        // Create card HTML
        card.innerHTML = `
            <div class="highlight-thumbnail${highlight.type === 'youtube' ? ' youtube-preview' : ''}"${highlight.videoId ? ` data-video-id="${highlight.videoId}"` : ''}>
                <img src="${highlight.thumbnailUrl}" alt="${highlight.title}" class="${highlight.type === 'youtube' ? 'youtube-thumbnail' : ''}">
                <div class="highlight-duration">${highlight.duration}</div>
                <div class="highlight-play-button">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
            </div>
            <div class="highlight-info">
                <h4>${highlight.title}</h4>
                <span class="highlight-date">${displayDate}</span>
            </div>
        `;
        
        // Add click event listener
        if (highlight.type === 'youtube') {
            card.addEventListener('click', function() {
                openYoutubeModal(highlight.videoId);
            });
        } else {
            card.addEventListener('click', handleHighlightClick);
        }
        
        // Add to desktop highlights container if it exists
        if (desktopHighlightsContainer) {
            const desktopCard = card.cloneNode(true);
            // Re-add event listeners to the cloned node
            if (highlight.type === 'youtube') {
                desktopCard.addEventListener('click', function() {
                    openYoutubeModal(highlight.videoId);
                });
            } else {
                desktopCard.addEventListener('click', handleHighlightClick);
            }
            desktopHighlightsContainer.appendChild(desktopCard);
        }
        
        // Add to mobile highlights container if it exists
        if (mobileHighlightsContainer) {
            const mobileCard = card.cloneNode(true);
            // Re-add event listeners to the cloned node
            if (highlight.type === 'youtube') {
                mobileCard.addEventListener('click', function() {
                    openYoutubeModal(highlight.videoId);
                });
            } else {
                mobileCard.addEventListener('click', handleHighlightClick);
            }
            mobileHighlightsContainer.appendChild(mobileCard);
        }
        
        // Update highlight count display
        updateHighlightCountDisplay();
        
        // If admin, add delete button
        if (isAdmin) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'highlight-delete-btn';
            deleteButton.innerHTML = '&times;';
            deleteButton.title = 'Delete highlight';
            deleteButton.addEventListener('click', function(event) {
                event.stopPropagation(); // Prevent card click
                removeHighlight(highlight.id);
            });
            card.appendChild(deleteButton);
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
     * Get timestamp from a highlight
     * @param {Object} highlight - The highlight object
     * @returns {number} - The timestamp
     */
    function getHighlightTimestamp(highlight) {
        // Use timestamp property if available
        if (highlight.timestamp) return highlight.timestamp;
        
        // Try to extract timestamp from ID
        if (highlight.id) {
            const idMatch = highlight.id.match(/highlight-(\d+)/);
            if (idMatch) return parseInt(idMatch[1]);
        }
        
        // Default to current time if no timestamp found
        return Date.now();
    }
    
    /**
     * Sort highlights by timestamp (newest first)
     * @param {Array} highlights - The highlights to sort
     * @returns {Array} - Sorted highlights
     */
    function sortHighlightsByTimestamp(highlights) {
        return [...highlights].sort((a, b) => {
            return getHighlightTimestamp(b) - getHighlightTimestamp(a);
        });
    }

    /**
     * Load highlights from local storage
     */
    function loadHighlights() {
        // Clear existing highlights
        clearHighlightsUI();
        
        // Load user highlights from storage
        loadUserHighlights();
        
        // Get all highlights
        const allHighlights = getAllHighlights();
        
        // Sort highlights by timestamp (newest first)
        const sortedHighlights = sortHighlightsByTimestamp(allHighlights);
        
        // Add highlights to UI
        sortedHighlights.forEach(highlight => {
            addHighlightCard(highlight);
        });
        
        // Check if we need to limit the number of highlights
        enforceHighlightLimit();
        
        // Update the count display
        updateHighlightCountDisplay();
        
        // Make sure admin controls are properly displayed
        if (isAdmin) {
            console.log('Admin detected during highlight loading, updating admin controls');
            updateHighlightCardsForAdmin();
        }
    }

    /**
     * Clear all highlights from the UI
     */
    function clearHighlightsUI() {
        // Remove all highlight cards except the upload card from desktop container
        if (desktopHighlightsContainer) {
            const desktopCards = desktopHighlightsContainer.querySelectorAll('.highlight-card:not(.upload-card)');
            desktopCards.forEach(card => card.remove());
        }
        
        // Remove all highlight cards except the upload card from mobile container
        if (mobileHighlightsContainer) {
            const mobileCards = mobileHighlightsContainer.querySelectorAll('.highlight-card:not(.upload-card)');
            mobileCards.forEach(card => card.remove());
        }
    }

    /**
     * Enforce the highlight limit by removing the oldest highlights
     */
    function enforceHighlightLimit() {
        const allHighlights = getAllHighlights();
        
        if (allHighlights.length > CONFIG.MAX_HIGHLIGHTS) {
            console.log(`Enforcing highlight limit: ${allHighlights.length} > ${CONFIG.MAX_HIGHLIGHTS}`);
            
            // Sort highlights by ID (which contains timestamp) to find the oldest
            const sortedHighlights = [...allHighlights].sort((a, b) => {
                // Extract timestamp from ID or use timestamp property
                const getTimestamp = (highlight) => {
                    if (highlight.timestamp) return highlight.timestamp;
                    
                    const idMatch = highlight.id.match(/highlight-(\d+)/);
                    return idMatch ? parseInt(idMatch[1]) : 0;
                };
                
                return getTimestamp(a) - getTimestamp(b);
            });
            
            // Remove oldest highlights until we're under the limit
            while (sortedHighlights.length > CONFIG.MAX_HIGHLIGHTS) {
                const oldestHighlight = sortedHighlights.shift();
                console.log('Removing oldest highlight:', oldestHighlight.id);
                removeHighlight(oldestHighlight.id);
            }
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
    
    /**
     * Update highlights from server
     * @param {Array} serverHighlights - The highlights from the server
     */
    function updateFromServer(serverHighlights) {
        console.log('Updating highlights from server:', serverHighlights);
        
        // Set the flag to indicate we're using server storage
        useServerStorage = true;
        
        // Clear existing highlights
        clearHighlightsUI();
        
        // Process each highlight to ensure it has a timestamp
        const processedHighlights = serverHighlights.map(highlight => {
            // Ensure the highlight has a timestamp if it has a date
            if (!highlight.timestamp && highlight.date && highlight.date !== 'Just now') {
                // Try to parse the date string to get a timestamp
                try {
                    const dateObj = new Date(highlight.date);
                    if (!isNaN(dateObj.getTime())) {
                        highlight.timestamp = dateObj.getTime();
                    }
                } catch (e) {
                    console.error('Error parsing date:', e);
                }
            }
            
            // If still no timestamp, try to extract from ID
            if (!highlight.timestamp && highlight.id) {
                const idMatch = highlight.id.match(/highlight-(\d+)/);
                if (idMatch) {
                    highlight.timestamp = parseInt(idMatch[1]);
                }
            }
            
            // If still no timestamp, use current time
            if (!highlight.timestamp) {
                highlight.timestamp = Date.now();
            }
            
            return highlight;
        });
        
        // Sort highlights by timestamp (newest first)
        const sortedHighlights = sortHighlightsByTimestamp(processedHighlights);
        
        // Add each highlight to the UI
        sortedHighlights.forEach(highlight => {
            addHighlightCard(highlight);
        });
        
        // Save the highlights to local storage
        userHighlights = processedHighlights;
        saveHighlights();
        
        // Update highlight dates periodically
        startDateUpdateInterval();
    }
    
    /**
     * Dispatch highlight added event for server integration
     * @param {Object} highlight - The highlight that was added
     */
    function dispatchHighlightAddedEvent(highlight) {
        // Check if this highlight has already been dispatched
        if (highlight.id && dispatchedHighlights.has(highlight.id)) {
            console.log('Highlight already dispatched, skipping:', highlight.id);
            return;
        }
        
        // Always dispatch the event, regardless of useServerStorage flag
        // This ensures that highlights are always sent to the server
        const event = new CustomEvent('highlight-added', {
            detail: highlight
        });
        document.dispatchEvent(event);
        console.log('Dispatched highlight-added event:', highlight);
        
        // Track that this highlight has been dispatched
        if (highlight.id) {
            dispatchedHighlights.add(highlight.id);
        }
    }
    
    /**
     * Dispatch highlight removed event for server integration
     * @param {string} id - The ID of the highlight that was removed
     */
    function dispatchHighlightRemovedEvent(id) {
        // Check if this removal has already been dispatched
        if (dispatchedRemovals.has(id)) {
            console.log('Highlight removal already dispatched, skipping:', id);
            return;
        }
        
        // Always dispatch the event, regardless of useServerStorage flag
        // This ensures that highlight removals are always sent to the server
        const event = new CustomEvent('highlight-removed', {
            detail: id
        });
        document.dispatchEvent(event);
        console.log('Dispatched highlight-removed event:', id);
        
        // Track that this removal has been dispatched
        dispatchedRemovals.add(id);
    }

    // Set up an interval to update highlight dates periodically
    let dateUpdateInterval = null;
    function startDateUpdateInterval() {
        // Clear any existing interval
        if (dateUpdateInterval) {
            clearInterval(dateUpdateInterval);
        }
        
        // Update dates immediately
        updateHighlightDates();
        
        // Set up interval to update dates every minute
        dateUpdateInterval = setInterval(updateHighlightDates, 60000);
    }

    // Initialize date updates when the page loads
    document.addEventListener('DOMContentLoaded', function() {
        startDateUpdateInterval();
    });

    // Public API
    return {
        init,
        openYoutubeModal,
        openUploadModal,
        checkAdminStatus,
        updateFromServer,
        CONFIG,
        get isAdmin() { return isAdmin; }
    };
})();

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the highlights manager
    window.HighlightsManager.init();
    
    // Ensure HighlightsManager is available globally
    console.log('HighlightsManager initialized and available globally:', !!window.HighlightsManager);
    
    // Dispatch an event to notify other scripts that HighlightsManager is ready
    document.dispatchEvent(new CustomEvent('highlights-manager-ready'));
}); 