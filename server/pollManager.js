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
        console.log('📊 Polls loaded successfully');

        // Check if there's an active poll and validate its state
        if (pollData.activePoll) {
            const now = Date.now();
            const endTime = pollData.activePoll.endTime;
            
            // If the poll has expired, move it to history
            if (endTime && now >= endTime) {
                console.log('📊 Moving expired poll to history');
                pollData.activePoll.isActive = false;
                pollData.pollHistory.push(pollData.activePoll);
                pollData.activePoll = null;
            } else if (endTime) {
                // Poll is still active, set up the remaining timer
                console.log('📊 Restoring active poll timer');
                pollData.activePoll.isActive = true;
                const remainingTime = endTime - now;
                
                if (remainingTime > 0) {
                    setTimeout(async () => {
                        if (pollData.activePoll) {
                            console.log('📊 Auto-ending poll');
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
            console.log('📊 Initialized new polls file');
        } else {
            console.error('Error loading polls:', error);
        }
    }
}

// Save polls to file
async function savePolls() {
    try {
        await fs.writeFile(POLLS_FILE, JSON.stringify(pollData, null, 4));
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
        console.log(`📊 New poll created, duration: ${poll.duration}s`);
        setTimeout(async () => {
            if (pollData.activePoll && pollData.activePoll.id === poll.id) {
                console.log('📊 Poll ended automatically');
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

    console.log('📊 Ending current poll');
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

    // Create poll results message
    const totalVotes = endedPoll.totalVotes;
    const sortedOptions = [...endedPoll.options].sort((a, b) => b.votes - a.votes);
    const winningOption = sortedOptions[0];
    
    // Format vote counts with proper pluralization
    const formatVotes = (votes) => `${votes} ${votes === 1 ? 'vote' : 'votes'}`;
    
    // Create detailed results string with better formatting
    const resultsDetails = sortedOptions.map((option, index) => {
        const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        return `${medal} ${option.text}: ${percentage}% (${formatVotes(option.votes)})`;
    }).join('\n');
    
    const resultsMessage = {
        type: 'CHAT_MESSAGE',
        platform: 'web',
        username: 'Poll System',
        message: `📊 Poll Results: "${endedPoll.question}"\n\n${resultsDetails}\n\n📈 Total Votes: ${formatVotes(totalVotes)}`,
        timestamp: new Date().toISOString()
    };

    // Broadcast the results message
    if (global.broadcast) {
        global.broadcast(resultsMessage);
    }

    // Save to file
    await savePolls();

    return endedPoll;
}

// Submit a vote
async function submitVote(pollId, optionIndex, username) {
    if (!pollData.activePoll || pollData.activePoll.id !== pollId || !pollData.activePoll.isActive) {
        return null;
    }

    // Check if user has already voted
    if (votedUsers.has(username)) {
        return null;
    }

    // Validate option index
    if (optionIndex < 0 || optionIndex >= pollData.activePoll.options.length) {
        return null;
    }

    // Update vote count and record username
    pollData.activePoll.options[optionIndex].votes++;
    pollData.activePoll.totalVotes++;
    votedUsers.add(username);
    console.log(`📊 Vote recorded for poll option ${optionIndex + 1}`);

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