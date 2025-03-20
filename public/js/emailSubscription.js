document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('emailSubscriptionForm');
    const emailInput = document.getElementById('emailInput');
    const subscribeBtn = document.getElementById('subscribeBtn');
    const messageDiv = document.getElementById('subscriptionMessage');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            if (!email) {
                showMessage('Please enter your email address', 'error');
                return;
            }

            try {
                subscribeBtn.disabled = true;
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();
                
                if (response.ok) {
                    showMessage(data.message, 'success');
                    emailInput.value = '';
                } else {
                    showMessage(data.message, 'error');
                }
            } catch (error) {
                showMessage('An error occurred. Please try again later.', 'error');
            } finally {
                subscribeBtn.disabled = false;
            }
        });
    }

    function showMessage(message, type) {
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `subscription-message ${type}`;
            
            // Clear message after 5 seconds
            setTimeout(() => {
                messageDiv.textContent = '';
                messageDiv.className = 'subscription-message';
            }, 5000);
        }
    }
}); 