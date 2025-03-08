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
        const text = await response.text();
        const donationMatch = text.match(/"currencyAmount":"([0-9.]+)"/);
        return donationMatch && donationMatch[1] ? parseFloat(donationMatch[1]) : manualDonationAmount;
    } catch (error) {
        console.error('Error fetching donation data:', error);
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
    const donationAmount = await fetchDonationAmount();
    const source = (donationAmount === manualDonationAmount && donationAmount !== 0) 
        ? ' (Manual)' 
        : ' (PayPal)';
        
    document.getElementById('current-donations').innerText = 
        `Current Donations: £${donationAmount.toFixed(2)}${source}`;

    const progressPercentage = Math.min((donationAmount / totalGoal) * 100, 100);
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = progressPercentage + '%';
    progressBar.innerText = `${progressPercentage.toFixed(1)}%`;

    document.querySelectorAll('.milestone-label').forEach(label => {
        const milestoneAmount = parseInt(label.innerText.replace('£', ''));
        label.style.color = donationAmount >= milestoneAmount ? '#4caf50' : '#ffffff';
    });
}

// ... rest of the donation-related functions ... 