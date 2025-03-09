// Quality management for video playback
const QualityManager = (function() {
    let hls = null;
    let qualityLevels = [];
    const qualitySelect = document.getElementById('qualitySelect');

    // Default quality levels if not provided by manifest
    const defaultQualityLevels = [
        { height: 1080, bitrate: 5000000 },  // 1080p (5Mbps)
        { height: 720, bitrate: 2500000 },   // 720p (2.5Mbps)
        { height: 480, bitrate: 1000000 }    // 480p (1Mbps)
    ];

    function init(hlsInstance) {
        hls = hlsInstance;
        
        // Set up initial quality options
        updateQualityOptions(defaultQualityLevels);
        
        // Listen for quality level loading
        hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            if (data.levels && data.levels.length > 0) {
                qualityLevels = data.levels;
                updateQualityOptions(qualityLevels);
            }
        });

        // Listen for quality level changes
        hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
            updateSelectedQuality(data.level);
        });

        // Add change event listener to quality selector
        qualitySelect.addEventListener('change', function(e) {
            const level = parseInt(e.target.value);
            changeQuality(level);
        });

        // Load preferred quality from storage
        loadPreferredQuality();
    }

    function updateQualityOptions(levels) {
        // Clear existing options
        qualitySelect.innerHTML = '';

        // Add Auto option
        const autoOption = document.createElement('option');
        autoOption.value = '-1';
        autoOption.text = 'Auto';
        qualitySelect.add(autoOption);

        // Add quality options
        levels.forEach((level, index) => {
            const option = document.createElement('option');
            option.value = index;
            // Use full label for dropdown options
            option.text = `${level.height}p${level.height >= 720 ? ' HD' : ''}`;
            qualitySelect.add(option);
        });

        // Set initial selection
        const preferredQuality = localStorage.getItem('preferred_quality');
        if (preferredQuality !== null) {
            qualitySelect.value = preferredQuality;
        } else {
            qualitySelect.value = '-1'; // Auto
        }
    }

    function changeQuality(level) {
        if (!hls) return;

        hls.currentLevel = level;
        
        // Save preference if not auto
        if (level !== -1) {
            localStorage.setItem('preferred_quality', level);
        } else {
            localStorage.removeItem('preferred_quality');
        }

        // Update the select element
        qualitySelect.value = level.toString();
    }

    function updateSelectedQuality(level) {
        if (qualitySelect) {
            qualitySelect.value = level.toString();
        }
    }

    function loadPreferredQuality() {
        const preferredQuality = localStorage.getItem('preferred_quality');
        if (preferredQuality !== null && hls) {
            changeQuality(parseInt(preferredQuality));
        }
    }

    // Public API
    return {
        init,
        changeQuality,
        loadPreferredQuality
    };
})(); 