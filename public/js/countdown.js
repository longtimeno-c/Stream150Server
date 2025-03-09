const eventDate = new Date("June 19, 2025 18:00:00").getTime();
const eventEnd = eventDate + 150 * 60 * 60 * 1000; // Event ends after 150 hours

const updateCountdown = () => {
    const now = new Date().getTime();
    const distanceToStart = eventDate - now;
    const distanceToEnd = eventEnd - now;
    const countdownElement = document.getElementById("countdown");

    // Helper to pad numbers to a fixed width
    const pad = (num, size) => String(num).padStart(size, '0');

    // Clear previous content
    countdownElement.innerHTML = "";

    if (distanceToStart > 0) {
        // Before event starts
        const days = Math.floor(distanceToStart / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distanceToStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distanceToStart % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distanceToStart % (1000 * 60)) / 1000);
        const milliseconds = Math.floor((distanceToStart % 1000));
        
        // Calculate progress bar width (100% at event start, 0% at 30 days before)
        const maxDistance = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        const progress = 100 - Math.min(100, (distanceToStart / maxDistance) * 100);
        
        // Create countdown HTML
        countdownElement.innerHTML = `
            <div class="countdown-status" style="width: ${progress}%"></div>
            <div class="countdown-label">Stream Starts In</div>
            <div class="countdown-time">
                ${days > 0 ? `
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(days, 2)}</span>
                    <span class="countdown-unit-label">days</span>
                </div>
                <span class="countdown-separator">:</span>
                ` : ''}
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(hours, 2)}</span>
                    <span class="countdown-unit-label">hrs</span>
                </div>
                <span class="countdown-separator">:</span>
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(minutes, 2)}</span>
                    <span class="countdown-unit-label">min</span>
                </div>
                <span class="countdown-separator">:</span>
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(seconds, 2)}</span>
                    <span class="countdown-unit-label">sec</span>
                </div>
                <span class="countdown-milliseconds">.${pad(milliseconds, 3)}</span>
            </div>
        `;
    } else if (distanceToEnd > 0) {
        // During event
        const elapsedTime = now - eventDate;
        const totalDuration = eventEnd - eventDate;
        const progress = (elapsedTime / totalDuration) * 100;
        
        const days = Math.floor(elapsedTime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((elapsedTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
        const milliseconds = Math.floor((elapsedTime % 1000));
        
        // Create elapsed time HTML
        countdownElement.innerHTML = `
            <div class="countdown-status" style="width: ${progress}%"></div>
            <div class="countdown-label">Stream Running For</div>
            <div class="countdown-time">
                ${days > 0 ? `
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(days, 2)}</span>
                    <span class="countdown-unit-label">days</span>
                </div>
                <span class="countdown-separator">:</span>
                ` : ''}
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(hours, 2)}</span>
                    <span class="countdown-unit-label">hrs</span>
                </div>
                <span class="countdown-separator">:</span>
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(minutes, 2)}</span>
                    <span class="countdown-unit-label">min</span>
                </div>
                <span class="countdown-separator">:</span>
                <div class="countdown-unit">
                    <span class="countdown-value">${pad(seconds, 2)}</span>
                    <span class="countdown-unit-label">sec</span>
                </div>
                <span class="countdown-milliseconds">.${pad(milliseconds, 3)}</span>
            </div>
        `;
    } else {
        // After event ends
        countdownElement.innerHTML = `
            <div class="countdown-status" style="width: 100%"></div>
            <div class="countdown-ended">The stream has ended!</div>
        `;
    }
};

// Update countdown every 50 milliseconds for smoother display
setInterval(updateCountdown, 50);
updateCountdown(); // Call immediately to avoid delay 