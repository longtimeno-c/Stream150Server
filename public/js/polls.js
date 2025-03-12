// Poll Manager
const PollManager = {
    currentPoll: null,
    hasVoted: false,
    isAdmin: false,
    votedUsers: new Set(),

    init() {
        console.log('PollManager initializing...');
        this.checkAdminStatus();
        this.setupWebSocket();
        this.setupUserChangeListener();
        console.log('PollManager initialized');
    },

    checkAdminStatus() {
        const username = UserManager.getUsername();
        this.isAdmin = username === 'Stream150Admin';
        this.updateAdminControls();
        console.log('Admin status checked:', this.isAdmin, 'Current username:', username);
    },

    setupUserChangeListener() {
        // Listen for username changes using the correct event name
        document.addEventListener('username-loaded', () => this.checkAdminStatus());
        document.addEventListener('username-changed', () => this.checkAdminStatus());
    },

    setupWebSocket() {
        console.log('Setting up WebSocket listeners for polls...');
        
        // Listen for poll-related WebSocket messages
        document.addEventListener('ws-poll_update', (event) => {
            const data = event.detail;
            console.log('Handling poll update:', data.poll);
            this.handlePollUpdate(data.poll);
        });

        document.addEventListener('ws-poll_end', (event) => {
            console.log('Handling poll end');
            this.handlePollEnd();
        });

        // Listen for WebSocket connection to request initial poll state
        document.addEventListener('websocket-connected', () => {
            console.log('WebSocket connected, requesting poll state');
            if (window.socket && window.socket.readyState === WebSocket.OPEN) {
                window.socket.send(JSON.stringify({
                    type: 'REQUEST_POLL_STATE'
                }));
            }
        });
    },

    updateAdminControls() {
        const adminControls = document.getElementById('pollAdminControls');
        if (adminControls) {
            adminControls.style.display = this.isAdmin ? 'block' : 'none';
            console.log('Admin controls visibility updated:', this.isAdmin);
        }
    },

    createPoll() {
        if (!this.isAdmin) {
            console.log('Non-admin tried to create poll');
            return;
        }

        // Show the modal
        this.showPollModal();
    },

    showPollModal() {
        // Create modal HTML if it doesn't exist
        if (!document.querySelector('.poll-modal-overlay')) {
            const modalHTML = `
                <div class="poll-modal-overlay">
                    <div class="poll-modal">
                        <h2>Create New Poll</h2>
                        <form class="poll-modal-form" id="pollForm">
                            <div class="form-group">
                                <label for="pollQuestion">Question</label>
                                <input type="text" id="pollQuestion" required placeholder="Enter your question">
                            </div>
                            <div class="form-group">
                                <label>Options</label>
                                <div class="poll-options-list" id="pollOptions">
                                    <div class="poll-option-input">
                                        <input type="text" placeholder="Option 1" required>
                                        <button type="button" class="remove-option-btn" onclick="PollManager.removeOption(this)">×</button>
                                    </div>
                                    <div class="poll-option-input">
                                        <input type="text" placeholder="Option 2" required>
                                        <button type="button" class="remove-option-btn" onclick="PollManager.removeOption(this)">×</button>
                                    </div>
                                </div>
                                <button type="button" class="add-option-btn" onclick="PollManager.addOption()">Add Option</button>
                            </div>
                            <div class="form-group">
                                <label for="pollDuration">Duration</label>
                                <div class="duration-input">
                                    <input type="number" id="pollDuration" required min="1" value="60">
                                    <span>seconds</span>
                                </div>
                            </div>
                            <div class="modal-buttons">
                                <button type="button" class="modal-btn cancel-btn" onclick="PollManager.hideModal()">Cancel</button>
                                <button type="submit" class="modal-btn create-btn">Create Poll</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Add form submit handler
            document.getElementById('pollForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitPollForm();
            });
        }

        // Show the modal
        const modal = document.querySelector('.poll-modal-overlay');
        modal.style.display = 'flex';
    },

    hideModal() {
        const modal = document.querySelector('.poll-modal-overlay');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    addOption() {
        const optionsList = document.querySelector('.poll-options-list');
        const optionCount = optionsList.children.length + 1;
        if (optionCount <= 5) {
            const newOption = document.createElement('div');
            newOption.className = 'poll-option-input';
            newOption.innerHTML = `
                <input type="text" placeholder="Option ${optionCount}" required>
                <button type="button" class="remove-option-btn" onclick="PollManager.removeOption(this)">×</button>
            `;
            optionsList.appendChild(newOption);
        }
    },

    removeOption(button) {
        const optionsList = document.querySelector('.poll-options-list');
        if (optionsList.children.length > 2) {
            button.closest('.poll-option-input').remove();
            // Update placeholders
            optionsList.querySelectorAll('.poll-option-input input').forEach((input, index) => {
                input.placeholder = `Option ${index + 1}`;
            });
        }
    },

    submitPollForm() {
        const question = document.getElementById('pollQuestion').value.trim();
        const duration = parseInt(document.getElementById('pollDuration').value);
        const optionsInputs = document.querySelectorAll('.poll-option-input input');
        
        const options = Array.from(optionsInputs)
            .map(input => ({
                text: input.value.trim(),
                votes: 0
            }))
            .filter(option => option.text !== '');

        if (options.length < 2) {
            alert('Please add at least 2 options');
            return;
        }

        const poll = {
            id: Date.now().toString(),
            question,
            options,
            duration,
            startTime: Date.now(),
            totalVotes: 0
        };

        console.log('Creating new poll:', poll);

        // Send poll to server
        window.socket.send(JSON.stringify({
            type: 'CREATE_POLL',
            poll
        }));

        // Hide the modal
        this.hideModal();

        // Reset the form
        document.getElementById('pollForm').reset();
    },

    handlePollUpdate(poll) {
        console.log('Updating poll:', poll);
        
        // If it's a new poll, do a full render
        if (!this.currentPoll || this.currentPoll.id !== poll.id) {
            this.hasVoted = false;
            this.votedUsers.clear();
            this.currentPoll = poll;
            this.renderPoll();
            return;
        }

        // Otherwise, just update the numbers
        this.currentPoll = poll;
        
        // Update vote counts and percentages smoothly
        poll.options.forEach((option, index) => {
            const percentage = poll.totalVotes > 0 ? (option.votes / poll.totalVotes * 100).toFixed(1) : 0;
            
            // Update both desktop and mobile containers
            ['.poll-container', '.mobile-poll-container'].forEach(containerSelector => {
                const container = document.querySelector(containerSelector);
                if (!container) return;

                const optionElement = container.querySelector(`[data-index="${index}"]`);
                if (!optionElement) return;

                // Update the bar width smoothly
                const bar = optionElement.querySelector('.poll-option-bar');
                if (bar) {
                    bar.style.width = `${percentage}%`;
                }

                // Update the percentage text
                const percentageElement = optionElement.querySelector('.poll-option-percentage');
                if (percentageElement) {
                    percentageElement.textContent = `${percentage}%`;
                }

                // Update vote count if visible
                const statsElement = optionElement.querySelector('.poll-option-stats');
                if (statsElement) {
                    statsElement.textContent = `(${option.votes} votes)`;
                }
            });
        });

        // Update total votes
        document.querySelectorAll('.poll-total-votes').forEach(element => {
            if (element) {
                element.textContent = `Total votes: ${poll.totalVotes}`;
            }
        });
    },

    handlePollEnd() {
        console.log('Ending poll');
        this.currentPoll = null;
        this.hasVoted = false;
        this.votedUsers.clear();
        this.hidePoll();
    },

    renderPoll() {
        console.log('Rendering poll:', this.currentPoll);
        const pollContainer = document.querySelector('.poll-container');
        const mobilePollContainer = document.querySelector('.mobile-poll-container');
        
        if (!pollContainer || !mobilePollContainer) {
            console.error('Poll containers not found:', {
                desktop: !!pollContainer,
                mobile: !!mobilePollContainer
            });
            return;
        }
        
        if (!this.currentPoll || !this.currentPoll.isActive) {
            console.log('No active poll to render');
            this.hidePoll();
            return;
        }

        const pollHTML = this.createPollHTML();
        console.log('Generated poll HTML');

        pollContainer.innerHTML = pollHTML;
        mobilePollContainer.innerHTML = pollHTML;

        pollContainer.style.display = 'block';
        mobilePollContainer.style.display = 'block';

        // Add click handlers for options if not voted
        if (!this.hasVoted) {
            document.querySelectorAll('.poll-option').forEach(option => {
                option.addEventListener('click', () => this.submitVote(option.dataset.index));
            });
        }
        
        console.log('Poll rendered successfully');
    },

    createPollHTML() {
        const { question, options, totalVotes } = this.currentPoll;

        return `
            <div class="poll-content">
                <h3>${question}</h3>
                <div class="poll-options">
                    ${options.map((option, index) => {
                        const percentage = totalVotes > 0 ? (option.votes / totalVotes * 100).toFixed(1) : 0;
                        
                        return `
                            <div class="poll-option ${this.hasVoted ? 'voted' : ''}" data-index="${index}">
                                <div class="poll-option-text">
                                    ${option.text}
                                    <span class="poll-option-stats">
                                        ${this.hasVoted ? `(${option.votes} votes)` : ''}
                                    </span>
                                </div>
                                <div class="poll-option-bar" style="width: ${percentage}%"></div>
                                <div class="poll-option-percentage">${percentage}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="poll-footer">
                    <span class="poll-total-votes">Total votes: ${totalVotes}</span>
                    ${!this.hasVoted ? '' : ''}
                </div>
            </div>
        `;
    },

    submitVote(optionIndex) {
        const username = UserManager.getUsername();
        if (this.hasVoted || this.votedUsers.has(username) || !this.currentPoll || !this.currentPoll.isActive) {
            console.log('Vote rejected:', { 
                hasVoted: this.hasVoted,
                userVoted: this.votedUsers.has(username),
                hasPoll: !!this.currentPoll,
                isActive: this.currentPoll?.isActive 
            });
            return;
        }

        console.log('Submitting vote for option:', optionIndex);

        // Mark as voted before the server response to prevent double votes
        this.hasVoted = true;
        this.votedUsers.add(username);

        // Add the just-voted class to the clicked option
        const votedOption = document.querySelector(`[data-index="${optionIndex}"]`);
        if (votedOption) {
            votedOption.classList.add('just-voted');
            // Remove the class after animation completes
            setTimeout(() => {
                votedOption.classList.remove('just-voted');
            }, 500);
        }

        window.socket.send(JSON.stringify({
            type: 'SUBMIT_VOTE',
            pollId: this.currentPoll.id,
            optionIndex: parseInt(optionIndex),
            username: username
        }));

        // Update UI to show voted state without full re-render
        document.querySelectorAll('.poll-option').forEach(option => {
            option.classList.add('voted');
            option.style.cursor = 'default';
            // Remove click handlers
            option.replaceWith(option.cloneNode(true));
        });

        // Hide the instruction text
        const instruction = document.querySelector('.poll-instruction');
        if (instruction) {
            instruction.style.display = 'none';
        }
    },

    hidePoll() {
        const pollContainer = document.querySelector('.poll-container');
        const mobilePollContainer = document.querySelector('.mobile-poll-container');
        
        if (pollContainer) {
            pollContainer.classList.add('removing');
            setTimeout(() => {
                pollContainer.style.display = 'none';
                pollContainer.classList.remove('removing');
            }, 500); // Match the animation duration
        }
        
        if (mobilePollContainer) {
            mobilePollContainer.classList.add('removing');
            setTimeout(() => {
                mobilePollContainer.style.display = 'none';
                mobilePollContainer.classList.remove('removing');
            }, 500); // Match the animation duration
        }
    }
};

// Initialize PollManager when document is ready
document.addEventListener('DOMContentLoaded', () => {
    PollManager.init();
}); 