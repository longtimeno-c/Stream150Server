const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EmailManager {
    constructor() {
        this.subscribersFile = path.join(__dirname, '..', 'data', 'subscribers.json');
        this.isEnabled = process.env.EMAIL_SYSTEM_ENABLED === 'true';
        this.emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
        this.subscribers = this.loadSubscribers();
        this.tokenStore = new Map(); // Store tokens with their creation timestamps
        
        // Initialize email provider
        if (this.isEnabled) {
            this.initializeEmailProvider();
        } else {
            console.log('Email system is disabled');
        }
    }

    initializeEmailProvider() {
        if (this.emailProvider === 'smtp') {
            this.initializeSMTP();
        } else if (this.emailProvider === 'resend') {
            this.initializeResend();
        } else {
            console.error('Invalid email provider specified');
            this.isEnabled = false;
        }
    }

    initializeSMTP() {
        try {
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
        } catch (error) {
            console.error('Failed to initialize SMTP:', error);
            this.isEnabled = false;
        }
    }

    initializeResend() {
        try {
            this.resend = new Resend(process.env.RESEND_API);
            console.log('Resend client initialized');
        } catch (error) {
            console.error('Failed to initialize Resend:', error);
            this.isEnabled = false;
        }
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

    generateUnsubscribeToken(email) {
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const data = `${email}:${timestamp}:${randomBytes}:${process.env.EMAIL_SECRET || 'default-secret'}`;
        const token = crypto.createHash('sha256').update(data).digest('hex');
        
        // Store the token with its timestamp
        this.tokenStore.set(token, {
            email,
            timestamp
        });

        return token;
    }

    verifyUnsubscribeToken(email, token) {
        const tokenData = this.tokenStore.get(token);
        if (!tokenData) {
            return false;
        }

        // Check if token matches the email
        if (tokenData.email !== email) {
            return false;
        }

        // Check if token is not older than 7 days
        const now = Date.now();
        const tokenAge = now - tokenData.timestamp;
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        if (tokenAge > SEVEN_DAYS) {
            // Clean up expired token
            this.tokenStore.delete(token);
            return false;
        }

        // Clean up used token
        this.tokenStore.delete(token);
        return true;
    }

    // Clean up expired tokens periodically
    cleanupExpiredTokens() {
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        for (const [token, data] of this.tokenStore.entries()) {
            if (now - data.timestamp > SEVEN_DAYS) {
                this.tokenStore.delete(token);
            }
        }
    }

    async sendStreamNotification() {
        if (!this.isEnabled || this.subscribers.length === 0) {
            return;
        }

        // Clean up expired tokens before sending new notifications
        this.cleanupExpiredTokens();

        try {
            for (const subscriber of this.subscribers) {
                const unsubscribeToken = this.generateUnsubscribeToken(subscriber);
                const unsubscribeLink = `https://watch.stream150.com/unsubscribe.html?email=${encodeURIComponent(subscriber)}&token=${unsubscribeToken}`;
                
                const emailContent = `
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
                            color: white !important;
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
                        a {
                            color: #6441a5;
                            text-decoration: none;
                        }
                        a:hover {
                            text-decoration: underline;
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
                                <a href="https://watch.stream150.com" class="button">
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
                `;

                if (this.emailProvider === 'smtp') {
                    await this.sendSMTPEmail(subscriber, emailContent);
                } else if (this.emailProvider === 'resend') {
                    await this.sendResendEmail(subscriber, emailContent);
                }
                
                console.log(`Stream notification sent to ${subscriber} using ${this.emailProvider}`);
            }
        } catch (error) {
            console.error('Error sending stream notification:', error);
        }
    }

    async sendSMTPEmail(recipient, htmlContent) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipient,
            subject: '🎥 Stream150 is LIVE NOW! 🔴',
            html: htmlContent
        };

        await this.transporter.sendMail(mailOptions);
    }

    async sendResendEmail(recipient, htmlContent) {
        await this.resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: recipient,
            subject: '🎥 Stream150 is LIVE NOW! 🔴',
            html: htmlContent
        });
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    isNotificationsEnabled() {
        return this.isEnabled;
    }
}

module.exports = new EmailManager(); 