const fs = require('fs').promises;
const path = require('path');

const POLLS_FILE = path.join(__dirname, '../data/polls.json');
let pollData = {
    activePoll: null,
    pollHistory: []
};

// Add this line to track voted users
const votedUsers = new Set();

// Load polls from file
async function loadPolls() {
    try {
        const data = await fs.readFile(POLLS_FILE, 'utf8');
        pollData = JSON.parse(data);
        console.log('Polls loaded from file');

        // Check if there's an active poll and validate its state
        if (pollData.activePoll) {
            const now = Date.now();
            const endTime = pollData.activePoll.endTime;
            
            // If the poll has expired, move it to history
            if (endTime && now >= endTime) {
                console.log('Found expired poll, moving to history');
                pollData.activePoll.isActive = false;
                pollData.pollHistory.push(pollData.activePoll);
                pollData.activePoll = null;
            } else if (endTime) {
                // Poll is still active, set up the remaining timer
                console.log('Found active poll, setting up remaining timer');
                pollData.activePoll.isActive = true;
                const remainingTime = endTime - now;
                
                if (remainingTime > 0) {
                    setTimeout(async () => {
                        if (pollData.activePoll) {
                            console.log('Auto-ending restored poll:', pollData.activePoll.id);
                            await endPoll();
                        }
                    }, remainingTime);
                }
            }
        }

        await savePolls(); // Save any changes we made
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, create it
            await savePolls();
            console.log('Created new polls file');
        } else {
            console.error('Error loading polls:', error);
        }
    }
}

// Save polls to file
async function savePolls() {
    try {
        await fs.writeFile(POLLS_FILE, JSON.stringify(pollData, null, 4));
        console.log('Polls saved to file');
    } catch (error) {
        console.error('Error saving polls:', error);
    }
}

// Create a new poll
async function createPoll(poll) {
    // End any active poll first
    if (pollData.activePoll) {
        await endPoll();
    }

    const now = Date.now();
    // Set up the new poll
    pollData.activePoll = {
        ...poll,
        startTime: now,
        endTime: now + (poll.duration * 1000), // Convert seconds to milliseconds
        isActive: true
    };

    // Clear voted users for new poll
    votedUsers.clear();

    // Save to file
    await savePolls();

    // Set up auto-end timer
    if (poll.duration > 0) {
        console.log(`Setting poll to end in ${poll.duration} seconds (at ${new Date(pollData.activePoll.endTime).toISOString()})`);
        setTimeout(async () => {
            if (pollData.activePoll && pollData.activePoll.id === poll.id) {
                console.log('Auto-ending poll:', poll.id);
                const endedPoll = await endPoll();
                // Broadcast poll end to all clients
                if (global.broadcast) {
                    global.broadcast({
                        type: 'POLL_END',
                        poll: endedPoll
                    });
                }
            }
        }, poll.duration * 1000);
    }

    return pollData.activePoll;
}

// End the current poll
async function endPoll() {
    if (!pollData.activePoll) return null;

    console.log('Ending poll:', pollData.activePoll.id);
    const endedPoll = {
        ...pollData.activePoll,
        endTime: Date.now(),
        isActive: false
    };

    // Add to history and clear active poll
    pollData.pollHistory.push(endedPoll);
    pollData.activePoll = null;
    
    // Clear voted users
    votedUsers.clear();

    // Keep only last 10 polls in history
    if (pollData.pollHistory.length > 10) {
        pollData.pollHistory = pollData.pollHistory.slice(-10);
    }

    // Save to file
    await savePolls();

    return endedPoll;
}

// Submit a vote
async function submitVote(pollId, optionIndex, username) {
    console.log('Attempting to submit vote:', { pollId, optionIndex, username, activePoll: pollData.activePoll?.id });
    
    if (!pollData.activePoll || pollData.activePoll.id !== pollId || !pollData.activePoll.isActive) {
        console.log('Vote rejected - poll not active or ID mismatch');
        return null;
    }

    // Check if user has already voted
    if (votedUsers.has(username)) {
        console.log('Vote rejected - user already voted:', username);
        return null;
    }

    // Validate option index
    if (optionIndex < 0 || optionIndex >= pollData.activePoll.options.length) {
        console.log('Vote rejected - invalid option index');
        return null;
    }

    // Update vote count and record username
    pollData.activePoll.options[optionIndex].votes++;
    pollData.activePoll.totalVotes++;
    votedUsers.add(username);
    console.log('Vote recorded successfully:', { poll: pollData.activePoll, username });

    // Save to file
    await savePolls();

    return pollData.activePoll;
}

// Get current poll state
function getCurrentPoll() {
    return pollData.activePoll;
}

// Get most recent poll from history
function getMostRecentPoll() {
    if (pollData.pollHistory && pollData.pollHistory.length > 0) {
        // Return the most recent poll from history
        return pollData.pollHistory[pollData.pollHistory.length - 1];
    }
    return null;
}

// Get poll history
function getPollHistory() {
    return pollData.pollHistory;
}

// Initialize polls on module load
loadPolls().catch(error => {
    console.error('Error initializing polls:', error);
});

module.exports = {
    loadPolls,
    createPoll,
    endPoll,
    submitVote,
    getCurrentPoll,
    getMostRecentPoll,
    getPollHistory
}; 