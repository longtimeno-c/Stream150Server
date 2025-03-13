import websocket
import json
import threading
import asyncio
import aiohttp
from twitchio.ext import commands
import time
import signal

# Configuration
# Twitch Configuration
TWITCH_CHANNEL = "westboys1912"  # Change this to your Twitch channel name
TWITCH_TOKEN = "oauth:xl0yg6ryxly7dpxoexyeuue0oxmivp"  # Generate at https://twitchtokengenerator.com/
# YouTube Configuration
YOUTUBE_API_KEY = "AIzaSyDoVhH2WRSvaC_KUSNNUxFywkVuAJ7Iss4"  # Get from Google Developer Console
YOUTUBE_CHANNEL_ID = "UC5MvICzk7cb1Oh2c9VBrnIw"  # Find from YouTube channel URL
YOUTUBE_LIVE_CHAT_ID = None  # Will be fetched dynamically
WEBSOCKET_URL = "ws://localhost:3001"  # Match your Node.js server

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

    async def get_live_chat_id(self):
        """Retrieve the Live Chat ID for the current live stream, retrying every 30s if not found."""
        while self.running:
            if not self.session:
                self.session = aiohttp.ClientSession()

            search_url = f"https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId={self.channel_id}&eventType=live&type=video&key={self.api_key}"

            try:
                async with self.session.get(search_url) as response:
                    search_response = await response.json()

                if "items" in search_response and search_response["items"]:
                    video_id = None
                    for item in search_response["items"]:
                        if item["snippet"]["liveBroadcastContent"] == "live":
                            video_id = item["id"]["videoId"]
                            break

                    if video_id:
                        chat_url = f"https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id={video_id}&key={self.api_key}"

                        async with self.session.get(chat_url) as response:
                            chat_response = await response.json()

                        if "items" in chat_response and chat_response["items"]:
                            self.live_chat_id = chat_response["items"][0]["liveStreamingDetails"]["activeLiveChatId"]
                            print(f"✅ Live Chat ID Found: {self.live_chat_id}")
                            return
                        else:
                            print("❌ Live stream found, but no active chat detected.")
                    else:
                        print("❌ No live video found.")
                else:
                    print("❌ No active YouTube live stream found. Retrying in 30 seconds...")

                await asyncio.sleep(self.retry_interval)

            except Exception as e:
                print(f"Error fetching live chat ID: {e}")
                await asyncio.sleep(self.retry_interval)

    async def fetch_chat_messages(self):
        """Continuously fetch live chat messages from YouTube."""
        await self.get_live_chat_id()  # Wait until a live chat ID is found

        if not self.live_chat_id:
            print("❌ No live chat available. Exiting chat fetcher.")
            return

        while self.running:
            try:
                url = f"https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId={self.live_chat_id}&part=snippet,authorDetails&key={self.api_key}"

                async with self.session.get(url) as response:
                    chat_response = await response.json()

                if "items" in chat_response:
                    for item in chat_response["items"]:
                        message_id = item["id"]  # Unique message ID

                        # Only process new messages
                        if message_id in self.processed_message_ids:
                            continue
                        self.processed_message_ids.add(message_id)  # Mark message as processed

                        author = item["authorDetails"]["displayName"]
                        message = item["snippet"]["displayMessage"]
                        msg = f"{author}: {message}"
                        self.send_to_websocket(msg, "youtube")
                        print(f"YouTube | {msg}")

                await asyncio.sleep(5)  # Wait before fetching the next batch of messages

            except Exception as e:
                print(f"Error fetching chat messages: {e}")
                self.live_chat_id = None  # Reset chat ID to trigger reconnection
                await asyncio.sleep(30)  # Wait before retrying

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