const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailManager {
    constructor() {
        this.subscribersFile = path.join(__dirname, '..', 'data', 'subscribers.json');
        this.isEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
        this.subscribers = this.loadSubscribers();
        
        // Create email transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        // Verify connection configuration
        this.transporter.verify((error, success) => {
            if (error) {
                console.log('SMTP connection error:', error);
                console.log('Environment details:');
                console.log('- Node version:', process.version);
                console.log('- Platform:', process.platform);
                console.log('- Email enabled:', this.isEnabled);
                console.log('- SMTP Config:', {
                    host: process.env.EMAIL_HOST,
                    port: process.env.EMAIL_PORT,
                    secure: process.env.EMAIL_SECURE,
                    user: !!process.env.EMAIL_USER,
                    pass: !!process.env.EMAIL_PASS
                });
            } else {
                console.log('SMTP server is ready to take our messages');
            }
        });
    }

    loadSubscribers() {
        try {
            if (fs.existsSync(this.subscribersFile)) {
                const data = fs.readFileSync(this.subscribersFile, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            console.error('Error loading subscribers:', error);
            return [];
        }
    }

    saveSubscribers() {
        try {
            const dir = path.dirname(this.subscribersFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.subscribersFile, JSON.stringify(this.subscribers, null, 2));
        } catch (error) {
            console.error('Error saving subscribers:', error);
        }
    }

    async addSubscriber(email) {
        if (!this.isValidEmail(email)) {
            throw new Error('Invalid email address');
        }

        if (!this.subscribers.includes(email)) {
            this.subscribers.push(email);
            this.saveSubscribers();
            return true;
        }
        return false;
    }

    async removeSubscriber(email) {
        const index = this.subscribers.indexOf(email);
        if (index !== -1) {
            this.subscribers.splice(index, 1);
            this.saveSubscribers();
            return true;
        }
        return false;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async sendStreamNotification() {
        if (!this.isEnabled || this.subscribers.length === 0) {
            return;
        }

        try {
            for (const subscriber of this.subscribers) {
                // Create a unique unsubscribe link for each subscriber
                const unsubscribeLink = `http://watch.stream150.com/api/unsubscribe?email=${encodeURIComponent(subscriber)}`;
                
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: subscriber,
                    subject: '🎥 Stream150 is LIVE NOW! 🔴',
                    html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                line-height: 1.6;
                                color: #333;
                            }
                            .container {
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                background-color: #f9f9f9;
                                border-radius: 10px;
                            }
                            .header {
                                text-align: center;
                                padding: 20px 0;
                                background-color: #6441a5;
                                color: white;
                                border-radius: 8px 8px 0 0;
                                margin-bottom: 20px;
                            }
                            .content {
                                padding: 20px;
                                background-color: white;
                                border-radius: 8px;
                                margin-bottom: 20px;
                            }
                            .button {
                                display: inline-block;
                                padding: 12px 24px;
                                background-color: #6441a5;
                                color: white;
                                text-decoration: none;
                                border-radius: 5px;
                                margin: 20px 0;
                            }
                            .footer {
                                text-align: center;
                                font-size: 12px;
                                color: #666;
                                padding-top: 20px;
                                border-top: 1px solid #eee;
                            }
                            .emoji {
                                font-size: 24px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🎮 Stream150 is LIVE! 🎥</h1>
                            </div>
                            <div class="content">
                                <p>Hey Stream Fan! 👋</p>
                                <p>Great news! The stream you've been waiting for is now LIVE! 🔴</p>
                                <p>Join us for an exciting streaming session with:</p>
                                <ul>
                                    <li>🎯 Amazing gameplay moments</li>
                                    <li>💬 Live chat interaction</li>
                                    <li>🎉 Real-time entertainment</li>
                                </ul>
                                <center>
                                    <a href="http://watch.stream150.com" class="button">
                                        🎥 Watch Stream Now!
                                    </a>
                                </center>
                                <p>Don't miss out on the action! Click the button above to join the stream.</p>
                            </div>
                            <div class="footer">
                                <p>You're receiving this because you subscribed to Stream150 notifications.</p>
                                <p>To unsubscribe from these notifications, <a href="${unsubscribeLink}">click here</a>.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                    `
                };

                await this.transporter.sendMail(mailOptions);
                console.log(`Stream notification sent to ${subscriber}`);
            }
        } catch (error) {
            console.error('Error sending stream notification:', error);
        }
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    isNotificationsEnabled() {
        return this.isEnabled;
    }
}

module.exports = new EmailManager(); 