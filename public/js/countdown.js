const eventDate = new Date("June 19, 2025 18:00:00").getTime();
const eventEnd = eventDate + 150 * 60 * 60 * 1000; // Event ends after 150 hours

const updateCountdown = () => {
    const now = new Date().getTime();
    const distanceToStart = eventDate - now;
    const distanceToEnd = eventEnd - now;

    let countdownText = "";

    // Helper to pad numbers to a fixed width
    const pad = (num, size) => String(num).padStart(size, '0');

    if (distanceToStart > 0) {
        // Before event starts
        const hours = pad(Math.floor(distanceToStart / (1000 * 60 * 60)), 2);
        const minutes = pad(Math.floor((distanceToStart % (1000 * 60 * 60)) / (1000 * 60)), 2);
        const seconds = pad(Math.floor((distanceToStart % (1000 * 60)) / 1000), 2);
        const milliseconds = pad(Math.floor((distanceToStart % 1000)), 3);
        countdownText = `T- ${hours}:${minutes}:${seconds}:${milliseconds}`;
    } else if (distanceToEnd > 0) {
        // During event
        const elapsedTime = now - eventDate;
        const hours = pad(Math.floor(elapsedTime / (1000 * 60 * 60)), 2);
        const minutes = pad(Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60)), 2);
        const seconds = pad(Math.floor((elapsedTime % (1000 * 60)) / 1000), 2);
        const milliseconds = pad(Math.floor((elapsedTime % 1000)), 3);
        countdownText = `T+ ${hours}:${minutes}:${seconds}:${milliseconds}`;
    } else {
        // After event ends
        countdownText = "The stream has ended!";
    }

    // Update the countdown display
    document.getElementById("countdown").innerHTML = countdownText;
};

// Update countdown every 50 milliseconds for smoother display
setInterval(updateCountdown, 50);
updateCountdown(); // Call immediately to avoid delay 