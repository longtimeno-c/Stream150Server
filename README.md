# Stream150Server

A real-time streaming platform that supports live chat from both Twitch and YouTube, featuring chat overlay, polls, and highlights.

## Features

- Multi-platform chat integration (Twitch & YouTube)
- Interactive polls
- Stream highlights
- HLS streaming support
- WebSocket-based real-time updates
- Email notifications when stream goes live

## Prerequisites

- Node.js (v14 or higher)
- Python 3.8 or higher
- FFmpeg
- PM2 (for process management)

## Installation

1. Clone the repository:

2. Install Node.js dependencies:
```bash
npm install
```

3. Set up Python virtual environment:
```bash
python -m venv myenv
source myenv/bin/activate  # On Linux/Mac
# or
myenv\Scripts\activate  # On Windows
```

4. Install Python dependencies:
```bash
pip install python-dotenv twitchio aiohttp websocket-client
```

5. Create a `.env` file in the root directory with your credentials:
```env
# Twitch Configuration
TWITCH_CHANNEL=your_twitch_channel
TWITCH_TOKEN=your_twitch_oauth_token

# YouTube Configuration
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_CHANNEL_ID=your_youtube_channel_id

# Stream Configuration
STREAM_KEY=your_stream_key

# Admin Configuration
ADMIN_USERNAME=your_admin_username  # Username with admin privileges for managing highlights

# Email Notifications
EMAIL_NOTIFICATIONS_ENABLED=true
PROTONMAIL_USER=your_protonmail_email
PROTONMAIL_PASS=your_protonmail_password
```

## Configuration

### Environment Variables

The following environment variables must be set in your `.env` file:

#### Twitch Configuration
- `TWITCH_CHANNEL`: Your Twitch channel name
- `TWITCH_TOKEN`: Your Twitch OAuth token (generate at https://twitchtokengenerator.com/)

#### YouTube Configuration
- `YOUTUBE_API_KEY`: Your YouTube API key (get from Google Developer Console)
- `YOUTUBE_CHANNEL_ID`: Your YouTube channel ID

#### Stream Configuration
- `STREAM_KEY`: Your stream key (defaults to 'StreamtoME' if not set)

#### Admin Configuration
- `ADMIN_USERNAME`: Username with administrative privileges for managing highlights and other admin-only features

#### Email Notifications
- `EMAIL_SYSTEM_ENABLED`: Set to `true` to enable the email system
- `EMAIL_NOTIFICATIONS_ENABLED`: Set to `true` to enable email notifications
- `EMAIL_PROVIDER`: Set as email provider (smtp/resend)
- `EMAIL_FROM`: Who the email is from
- `RESEND_API`: Set resend API

#### SMTP Configuration (if using SMTP provider)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
`EMAIL_USER`: Set gmail email
`EMAIL_PASS`: Set gmail special key


### Stream Key

The stream key is configured through the `STREAM_KEY` environment variable in your `.env` file. If not set, it defaults to `StreamtoME`. This key is used for RTMP authentication and HLS stream paths.

## Running the Server

1. Start the Node.js server:
```bash
npm i
```
```bash
npm start
# or
node server.js
```

2. Start the chat overlay service:
```bash
# Activate virtual environment
source myenv/bin/activate  # On Linux/Mac
# or
myenv\Scripts\activate  # On Windows

# Run with PM2 (recommended for production)
pm2 start myenv/bin/python --name "chat-overlay" -- chat_overlay.py

# Or run directly
python chat_overlay.py
```

## Stream URLs

- RTMP URL: `rtmp://localhost:1935/live`
- HLS URL: `http://localhost:8000/live/StreamtoME/index.m3u8`
- Web Interface: `http://localhost:3001`

## Development

### Project Structure

```
Stream150Server/
├── public/           # Static files and frontend
├── server/          # Server-side modules
├── data/           # Data storage
├── media/          # Media files
├── server.js       # Main server file
├── chat_overlay.py # Chat integration service
└── .env            # Environment variables
```

### Adding New Features

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and commit:
```bash
git add .
git commit -m "Add your feature"
```

3. Push to remote:
```bash
git push origin feature/your-feature-name
```

## Troubleshooting

### Common Issues

1. **Chat Overlay Not Working**
   - Check if the `.env` file is properly configured
   - Verify Twitch and YouTube credentials
   - Check WebSocket connection in browser console

2. **Stream Not Starting**
   - Verify FFmpeg is installed
   - Check RTMP server logs
   - Ensure correct stream key is being used

3. **Poll System Issues**
   - Check server logs for WebSocket errors
   - Verify database connection

4. **Admin Access Issues**
   - Verify `ADMIN_USERNAME` is correctly set in `.env`
   - Check that you're logged in with the correct username
   - Clear browser cache if changes don't take effect

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Email Notifications

The server includes an email notification system that alerts subscribers when the stream goes live. To use this feature:

1. Set `EMAIL_NOTIFICATIONS_ENABLED=true` in your `.env` file
2. Configure your ProtonMail credentials:
   - `PROTONMAIL_USER`: Your ProtonMail email address
   - `PROTONMAIL_PASS`: Your ProtonMail password or app-specific password
3. Subscribers can sign up through the form on the website
4. Notifications are automatically sent when the stream starts