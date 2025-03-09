// Quality management for video playback
const QualityManager = (function() {
    let hls = null;
    let qualityLevels = [];
    const qualitySelect = document.getElementById('qualitySelect');

    // Default quality levels if not provided by manifest
    const defaultQualityLevels = [
        { height: 1080, bitrate: 5000000, index: 0 },  // 1080p (5Mbps)
        { height: 720, bitrate: 2500000, index: 1 },   // 720p (2.5Mbps)
        { height: 480, bitrate: 1000000, index: 2 }    // 480p (1Mbps)
    ];

    function init(hlsInstance) {
        hls = hlsInstance;
        
        // Always start with Auto quality
        if (hls) {
            hls.currentLevel = -1;
            hls.nextLevel = -1;
        }
        
        // Set up initial quality options with default levels
        updateQualityOptions(defaultQualityLevels);
        
        // Listen for quality level loading
        hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            console.log('HLS Quality Levels:', data.levels);
            
            if (data.levels && data.levels.length > 0) {
                // If we have real levels from the stream, use them
                if (data.levels.some(level => level.height > 0)) {
                    qualityLevels = data.levels;
                    updateQualityOptions(qualityLevels);
                } else {
                    // If levels don't have height info, use our defaults but map to real indices
                    const mappedLevels = defaultQualityLevels.map((level, i) => {
                        return {
                            ...level,
                            index: i < data.levels.length ? i : 0
                        };
                    });
                    updateQualityOptions(mappedLevels);
                }
                
                // Always set to Auto quality after manifest is parsed
                setTimeout(() => {
                    setAutoQuality();
                }, 500);
            }
        });

        // Listen for quality level changes
        hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
            console.log('Quality level switched to:', data.level);
            updateSelectedQuality(data.level);
        });

        // Add change event listener to quality selector
        qualitySelect.addEventListener('change', function(e) {
            const level = parseInt(e.target.value);
            console.log('Quality selection changed to:', level);
            changeQuality(level);
        });
    }

    function updateQualityOptions(levels) {
        console.log('Updating quality options with levels:', levels);
        
        // Clear existing options
        qualitySelect.innerHTML = '';

        // Add Auto option
        const autoOption = document.createElement('option');
        autoOption.value = '-1';
        autoOption.text = 'Auto';
        qualitySelect.add(autoOption);

        // Add quality options
        levels.forEach((level, i) => {
            const option = document.createElement('option');
            // Use the level's index property if available, otherwise use the array index
            option.value = level.index !== undefined ? level.index : i;
            
            // Make sure height is a positive number
            const height = level.height > 0 ? level.height : 
                           i === 0 ? 1080 : 
                           i === 1 ? 720 : 
                           i === 2 ? 480 : 360;
                           
            option.text = `${height}p${height >= 720 ? ' HD' : ''}`;
            qualitySelect.add(option);
        });

        // Always set initial selection to Auto
        qualitySelect.value = '-1';
    }

    function changeQuality(level) {
        if (!hls) return;
        
        console.log('Changing quality to level:', level);

        try {
            // Set the quality level in HLS.js
            hls.nextLevel = parseInt(level);
            
            // Save preference if not auto
            if (level !== -1) {
                localStorage.setItem('preferred_quality', level);
            } else {
                localStorage.removeItem('preferred_quality');
            }
    
            // Update the select element
            qualitySelect.value = level.toString();
            
            console.log('Quality level set to:', hls.currentLevel, 'Next level:', hls.nextLevel);
        } catch (error) {
            console.error('Error changing quality level:', error);
        }
    }

    function updateSelectedQuality(level) {
        if (qualitySelect) {
            qualitySelect.value = level.toString();
        }
    }

    function loadPreferredQuality() {
        // We're now always defaulting to Auto, so this function is just for reference
        // and backward compatibility
        setAutoQuality();
    }

    function setAutoQuality() {
        if (hls) {
            console.log('Setting quality to Auto');
            hls.currentLevel = -1;
            hls.nextLevel = -1;
            qualitySelect.value = '-1';
            localStorage.removeItem('preferred_quality');
        }
    }

    // Public API
    return {
        init,
        changeQuality,
        loadPreferredQuality,
        setAutoQuality
    };
})(); 