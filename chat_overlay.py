import websocket
import json
import threading
import asyncio
import aiohttp
from twitchio.ext import commands
import time
import signal
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Configuration
# Twitch Configuration
TWITCH_CHANNEL = os.getenv('TWITCH_CHANNEL')
TWITCH_TOKEN = os.getenv('TWITCH_TOKEN')
# YouTube Configuration
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
YOUTUBE_CHANNEL_ID = os.getenv('YOUTUBE_CHANNEL_ID')
YOUTUBE_LIVE_CHAT_ID = None  # Will be fetched dynamically
WEBSOCKET_URL = "ws://localhost:3001"  # Match your Node.js server

# Validate required environment variables
required_vars = ['TWITCH_CHANNEL', 'TWITCH_TOKEN', 'YOUTUBE_API_KEY', 'YOUTUBE_CHANNEL_ID']
missing_vars = [var for var in required_vars if not globals()[var]]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Helper function to check if WebSocket is connected
def is_websocket_connected(ws):
    return ws is not None and hasattr(ws, "sock") and ws.sock is not None

# Twitch Chat Bot
class TwitchChatBot(commands.Bot):
    def __init__(self, ws):
        super().__init__(token=TWITCH_TOKEN, prefix="!", initial_channels=[TWITCH_CHANNEL])
        self.ws = ws
        self.reconnect_attempts = 0
        self.max_reconnect_delay = 300  # Maximum 5 minutes between reconnect attempts

    async def event_ready(self):
        print(f"Connected to Twitch chat as {self.nick}")
        self.reconnect_attempts = 0  # Reset reconnect attempts on successful connection

    async def event_message(self, message):
        if message.author is None:
            return
        msg = f"{message.author.name}: {message.content}"
        self.send_to_websocket(msg, "twitch")
        print(f"Twitch | {msg}")

    def send_to_websocket(self, msg, platform):
        if is_websocket_connected(self.ws):
            try:
                self.ws.send(json.dumps({
                    "type": "CHAT_MESSAGE",
                    "platform": platform,
                    "username": msg.split(":")[0].strip(),
                    "message": msg.split(":", 1)[1].strip(),
                    "timestamp": ""
                }))
            except Exception as e:
                print(f"Error sending Twitch message to WebSocket: {e}")

    async def reconnect_twitch(self):
        while True:
            try:
                delay = min(30 * (2 ** self.reconnect_attempts), self.max_reconnect_delay)
                self.reconnect_attempts += 1
                print(f"Attempting to reconnect to Twitch in {delay} seconds (attempt {self.reconnect_attempts})...")
                await asyncio.sleep(delay)
                await self.start()
                return
            except Exception as e:
                print(f"Failed to reconnect to Twitch: {e}")

# YouTube Chat Fetcher
class YouTubeChatFetcher:
    def __init__(self, ws):
        self.ws = ws
        self.running = True
        self.live_chat_id = None
        self.retry_interval = 30  # Retry every 30 seconds
        self.api_key = YOUTUBE_API_KEY
        self.channel_id = YOUTUBE_CHANNEL_ID
        self.processed_message_ids = set()  # Track processed message IDs
        self.session = None
        # Add new fields for quota optimization
        self.next_page_token = None  # For pagination
        self.message_fetch_interval = 5  # Dynamic interval that will adjust based on activity
        self.min_fetch_interval = 5  # Minimum interval (5 seconds)
        self.max_fetch_interval = 30  # Maximum interval (30 seconds)
        self.messages_per_fetch = 0  # Track messages per fetch for dynamic adjustment
        self.last_stream_check = 0  # Last time we checked if stream was live
        self.stream_check_interval = 60  # Check stream status every 60 seconds
        self.last_chat_id = None  # Store last known chat ID

    async def get_live_chat_id(self):
        """Retrieve the Live Chat ID for the current live stream, retrying every 30s if not found."""
        while self.running:
            if not self.session:
                self.session = aiohttp.ClientSession()

            # Only check for live stream if enough time has passed
            current_time = time.time()
            if self.last_chat_id and (current_time - self.last_stream_check) < self.stream_check_interval:
                self.live_chat_id = self.last_chat_id
                return

            self.last_stream_check = current_time

            # First try searching for active live streams
            search_url = f"https://www.googleapis.com/youtube/v3/search?part=id&channelId={self.channel_id}&eventType=live&type=video&key={self.api_key}"
            print(f"Searching for live streams on channel: {self.channel_id}")

            try:
                async with self.session.get(search_url) as response:
                    search_response = await response.json()

                if "error" in search_response:
                    print(f"❌ YouTube API Error: {search_response['error'].get('message', 'Unknown error')}")
                    await asyncio.sleep(self.retry_interval)
                    continue

                if "items" in search_response:
                    if not search_response["items"]:
                        print("❌ No live streams found in search results")
                    
                    for item in search_response["items"]:
                        video_id = item["id"]["videoId"]
                        print(f"Found video: {video_id}, checking if live...")
                        
                        # Get video details to confirm it's live and get chat ID
                        chat_url = f"https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id={video_id}&key={self.api_key}"
                        
                        async with self.session.get(chat_url) as response:
                            chat_response = await response.json()

                        if "items" in chat_response and chat_response["items"]:
                            video_details = chat_response["items"][0]
                            
                            # Check if the video is actually live
                            if "liveStreamingDetails" in video_details:
                                self.live_chat_id = video_details["liveStreamingDetails"].get("activeLiveChatId")
                                if self.live_chat_id:
                                    print(f"✅ Live Chat ID Found: {self.live_chat_id}")
                                    self.last_chat_id = self.live_chat_id
                                    return
                                else:
                                    print("❌ Live stream found but no active chat ID")
                            else:
                                print("❌ Video is not live streaming")

                await asyncio.sleep(self.retry_interval)

            except Exception as e:
                print(f"Error fetching live chat ID: {e}")
                await asyncio.sleep(self.retry_interval)

    def adjust_fetch_interval(self):
        """Dynamically adjust the fetch interval based on chat activity"""
        if self.messages_per_fetch > 10:
            # High activity - decrease interval
            self.message_fetch_interval = max(self.min_fetch_interval, self.message_fetch_interval - 1)
        elif self.messages_per_fetch < 2:
            # Low activity - increase interval
            self.message_fetch_interval = min(self.max_fetch_interval, self.message_fetch_interval + 1)
        self.messages_per_fetch = 0  # Reset counter

    async def fetch_chat_messages(self):
        """Continuously fetch live chat messages from YouTube."""
        await self.get_live_chat_id()  # Wait until a live chat ID is found

        if not self.live_chat_id:
            print("❌ No live chat available. Exiting chat fetcher.")
            return

        while self.running:
            try:
                # Include pageToken if we have one
                url = f"https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId={self.live_chat_id}&part=snippet,authorDetails&key={self.api_key}"
                if self.next_page_token:
                    url += f"&pageToken={self.next_page_token}"

                async with self.session.get(url) as response:
                    chat_response = await response.json()

                if "error" in chat_response:
                    if "quota" in chat_response["error"].get("message", "").lower():
                        print("⚠️ API quota exceeded. Increasing intervals...")
                        self.message_fetch_interval = min(self.max_fetch_interval, self.message_fetch_interval * 2)
                        self.stream_check_interval = min(300, self.stream_check_interval * 2)  # Max 5 minutes
                    await asyncio.sleep(self.message_fetch_interval)
                    continue

                # Store next page token
                self.next_page_token = chat_response.get("nextPageToken")

                if "items" in chat_response:
                    self.messages_per_fetch = len(chat_response["items"])
                    for item in chat_response["items"]:
                        message_id = item["id"]

                        # Only process new messages
                        if message_id in self.processed_message_ids:
                            continue
                        self.processed_message_ids.add(message_id)

                        author = item["authorDetails"]["displayName"]
                        message = item["snippet"]["displayMessage"]
                        msg = f"{author}: {message}"
                        self.send_to_websocket(msg, "youtube")
                        print(f"YouTube | {msg}")

                    # Adjust fetch interval based on activity
                    self.adjust_fetch_interval()

                # Use the pollingIntervalMillis from the API response if available
                interval = chat_response.get("pollingIntervalMillis", self.message_fetch_interval * 1000) / 1000
                await asyncio.sleep(max(self.min_fetch_interval, min(interval, self.max_fetch_interval)))

            except Exception as e:
                print(f"Error fetching chat messages: {e}")
                self.live_chat_id = None
                self.next_page_token = None
                await asyncio.sleep(30)

    def send_to_websocket(self, msg, platform):
        if is_websocket_connected(self.ws):
            try:
                self.ws.send(json.dumps({
                    "type": "CHAT_MESSAGE",
                    "platform": platform,
                    "username": msg.split(":")[0].strip(),
                    "message": msg.split(":", 1)[1].strip(),
                    "timestamp": ""
                }))
            except Exception as e:
                print(f"Error sending YouTube message to WebSocket: {e}")

    def stop(self):
        """Stop fetching chat messages."""
        self.running = False

    async def cleanup(self):
        """Clean up resources."""
        self.running = False
        if self.session and not self.session.closed:
            await self.session.close()
            print("YouTube session closed during cleanup")

def run_websocket(twitch_bot, youtube_fetcher):
    def on_message(ws, message):
        data = json.loads(message)
        if data["type"] == "CHAT_MESSAGE":
            print(f"Received: {data['platform']} | {data['username']}: {data['message']}")

    def on_open(ws):
        print("Connected to WebSocket server")
        twitch_bot.ws = ws
        youtube_fetcher.ws = ws

    def on_close(ws, close_status_code, close_msg):
        print(f"WebSocket connection closed: {close_status_code} - {close_msg}")

    def on_error(ws, error):
        print(f"WebSocket error: {error}")

    # Create WebSocket connection
    ws = websocket.WebSocketApp(WEBSOCKET_URL,
                              on_message=on_message,
                              on_open=on_open,
                              on_close=on_close,
                              on_error=on_error)
    
    # Run the WebSocket connection with automatic reconnection
    websocket_app_runner(ws)

def websocket_app_runner(ws_app):
    """Run the WebSocket app with automatic reconnection"""
    reconnect_delay = 5  # Start with 5 seconds
    max_reconnect_delay = 300  # Maximum 5 minutes
    reconnect_attempts = 0
    
    while True:
        try:
            ws_app.run_forever()
        except Exception as e:
            print(f"WebSocket connection error: {e}")
        
        # Calculate exponential backoff for reconnect
        delay = min(reconnect_delay * (2 ** reconnect_attempts), max_reconnect_delay)
        reconnect_attempts += 1
        print(f"WebSocket disconnected. Reconnecting in {delay} seconds (attempt {reconnect_attempts})...")
        time.sleep(delay)

if __name__ == "__main__":
    # Initialize WebSocket connection
    ws_app = None  # Will be set when connection opens
    
    # Create a single event loop for both async tasks
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Start Twitch Chat
    twitch_bot = TwitchChatBot(ws_app)
    
    # Start YouTube Chat
    youtube_fetcher = YouTubeChatFetcher(ws_app)
    
    # Flag to control the main loop
    running = True
    
    # Signal handler for graceful shutdown
    def signal_handler(sig, frame):
        print("Signal received, preparing for graceful shutdown...")
        global running
        running = False
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start WebSocket in a separate thread
    ws_thread = threading.Thread(target=run_websocket, args=(twitch_bot, youtube_fetcher), daemon=True)
    ws_thread.start()
    
    # Run both async tasks in the same event loop
    async def run_both():
        twitch_task = None
        youtube_task = None
        
        try:
            while running:
                try:
                    # Create tasks if they don't exist or are done
                    if twitch_task is None or twitch_task.done():
                        twitch_task = asyncio.create_task(twitch_bot.start())
                    
                    if youtube_task is None or youtube_task.done():
                        youtube_task = asyncio.create_task(youtube_fetcher.fetch_chat_messages())
                    
                    await asyncio.sleep(1)
                    
                    # Check for task failures
                    for task in [twitch_task, youtube_task]:
                        if task and task.done() and not task.cancelled():
                            try:
                                task.result()
                            except Exception as e:
                                print(f"Task failed with error: {e}, will restart")
                
                except Exception as e:
                    print(f"Error in main loop: {e}")
                    await asyncio.sleep(5)
            
            # Shutdown
            print("Shutting down tasks...")
            for task in [twitch_task, youtube_task]:
                if task and not task.done():
                    task.cancel()
                    
        finally:
            await youtube_fetcher.cleanup()
            print("Cleanup completed")
    
    try:
        # Run everything in the main thread with a shared event loop
        loop.run_until_complete(run_both())
    finally:
        # Cancel all tasks
        for task in asyncio.all_tasks(loop):
            task.cancel()
        
        # Run the loop a bit more to execute the cancellations
        try:
            loop.run_until_complete(asyncio.sleep(1))
        except asyncio.CancelledError:
            pass
            
        loop.close()
        print("Event loop closed")