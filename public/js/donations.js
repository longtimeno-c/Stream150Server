const paypalPoolUrl = 'https://www.paypal.com/pool/9c2agpViJU?sr=ancr';
const totalGoal = 1000;
const manualDonationAmount = 0;
const milestones = [
    { amount: 100, hours: 48 },
    { amount: 200, hours: 75 },
    { amount: 500, hours: 100 },
    { amount: 700, hours: 150 }
];

function createMilestoneMarkers() {
    const container = document.getElementById('progress-container');
    milestones.forEach(milestone => {
        const position = (milestone.amount / totalGoal) * 100;
        const milestoneLine = document.createElement('div');
        milestoneLine.className = 'milestone';
        milestoneLine.style.left = position + '%';
        container.appendChild(milestoneLine);

        const label = document.createElement('div');
        label.className = 'milestone-label';
        label.style.left = position + '%';
        label.innerHTML = `£${milestone.amount}<br><span class="stream-time">${milestone.hours} hrs</span>`;
        container.appendChild(label);
    });
}

async function fetchDonationAmount() {
    try {
        const response = await fetch(paypalPoolUrl);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const text = await response.text();
        const donationMatch = text.match(/"currencyAmount":"([0-9.]+)"/);
        if (donationMatch && donationMatch[1]) {
            return parseFloat(donationMatch[1]);
        }
        // If we can't parse the value, return the last known good value or manual amount
        return manualDonationAmount;
    } catch (error) {
        console.error('Error fetching donation data:', error);
        // Return the manual amount instead of 0 when there's an error
        return manualDonationAmount;
    }
}

function calculateStreamLength(donationAmount) {
    let streamLength = 48;
    for (const milestone of milestones) {
        if (donationAmount >= milestone.amount) {
            streamLength = milestone.hours;
        }
    }
    return streamLength;
}

async function updateDonationUI() {
    // Store the previous value in case the fetch fails
    const progressBar = document.getElementById('progress-bar');
    const previousWidth = progressBar.style.width;
    
    try {
        const donationAmount = await fetchDonationAmount();
        const source = (donationAmount === manualDonationAmount && donationAmount !== 0) 
            ? ' (Manual)' 
            : ' (PayPal)';
            
        document.getElementById('current-donations').innerText = 
            `Current Donations: £${donationAmount.toFixed(2)}${source}`;

        const progressPercentage = Math.min((donationAmount / totalGoal) * 100, 100);
        progressBar.style.width = progressPercentage + '%';
        progressBar.innerText = `${progressPercentage.toFixed(1)}%`;

        document.querySelectorAll('.milestone-label').forEach(label => {
            const milestoneAmount = parseInt(label.innerText.replace('£', ''));
            label.style.color = donationAmount >= milestoneAmount ? '#4caf50' : '#ffffff';
        });
    } catch (error) {
        console.error('Error updating donation UI:', error);
        // Restore the previous width if there's an error
        if (previousWidth) {
            progressBar.style.width = previousWidth;
        }
    }
}

// ... rest of the donation-related functions ... 