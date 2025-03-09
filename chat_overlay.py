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
                # Exponential backoff for reconnect attempts
                delay = min(30 * (2 ** self.reconnect_attempts), self.max_reconnect_delay)
                self.reconnect_attempts += 1
                print(f"Attempting to reconnect to Twitch in {delay} seconds (attempt {self.reconnect_attempts})...")
                await asyncio.sleep(delay)
                
                # Try to reconnect
                await self.start()
                return  # If successful, exit the reconnect loop
            except Exception as e:
                print(f"Failed to reconnect to Twitch: {e}")
                # Continue the loop to try again

# YouTube Chat Fetcher
class YouTubeChatFetcher:
    def __init__(self, ws, loop):
        self.ws = ws
        self.loop = loop
        self.running = True
        self.live_chat_id = None
        self.processed_message_ids = set()
        self.session = None
        self.retry_count = 0
        self.max_retries = 10  # Limit retries to avoid excessive logging
        self.reconnect_attempts = 0
        self.max_reconnect_delay = 300  # Maximum 5 minutes between reconnect attempts

    async def get_live_chat_id(self):
        if not self.session:
            self.session = aiohttp.ClientSession()
            
        while self.running and not self.live_chat_id:
            url = f"https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId={YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key={YOUTUBE_API_KEY}"
            try:
                async with self.session.get(url) as resp:
                    data = await resp.json()
                    if "items" in data and data["items"]:
                        video_id = next((item["id"]["videoId"] for item in data["items"] if item["snippet"]["liveBroadcastContent"] == "live"), None)
                        if video_id:
                            chat_url = f"https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id={video_id}&key={YOUTUBE_API_KEY}"
                            async with self.session.get(chat_url) as chat_resp:
                                chat_data = await chat_resp.json()
                                if "items" in chat_data and chat_data["items"]:
                                    self.live_chat_id = chat_data["items"][0]["liveStreamingDetails"]["activeLiveChatId"]
                                    print(f"Found YouTube Live Chat ID: {self.live_chat_id}")
                                    self.retry_count = 0  # Reset retry count on success
                if not self.live_chat_id:
                    self.retry_count += 1
                    if self.retry_count <= self.max_retries:
                        print(f"No live stream found, retrying in 30s... (attempt {self.retry_count}/{self.max_retries})")
                    else:
                        print("Maximum retry attempts reached. Waiting for 5 minutes before trying again.")
                        self.retry_count = 0
                        await asyncio.sleep(300)  # Wait 5 minutes
                        continue
                    await asyncio.sleep(30)
            except Exception as e:
                print(f"Error fetching live chat ID: {e}")
                await asyncio.sleep(30)

    async def fetch_chat_messages(self):
        while self.running:
            try:
                # Reset live_chat_id if we need to reconnect
                self.live_chat_id = None
                
                # Try to get the live chat ID
                await self.get_live_chat_id()
                
                if not self.live_chat_id:
                    print("Failed to get live chat ID, will retry...")
                    continue

                print(f"Successfully connected to YouTube live chat, monitoring for messages...")
                url = f"https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId={self.live_chat_id}&part=snippet,authorDetails&key={YOUTUBE_API_KEY}"
                
                # Once we have a live chat ID, keep fetching messages until an error occurs
                while self.running and self.live_chat_id:
                    try:
                        async with self.session.get(url) as resp:
                            if resp.status != 200:
                                error_text = await resp.text()
                                print(f"YouTube API error (status {resp.status}): {error_text}")
                                # If we get an error, break out of this loop to reconnect
                                self.live_chat_id = None
                                break
                                
                            data = await resp.json()
                            if "items" in data:
                                for item in data["items"]:
                                    if item["id"] not in self.processed_message_ids:
                                        self.processed_message_ids.add(item["id"])
                                        username = item['authorDetails']['displayName']
                                        message = item['snippet']['displayMessage']
                                        msg = f"{username}: {message}"
                                        self.send_to_websocket(msg, "youtube")
                                        print(f"YouTube | {msg}")
                        await asyncio.sleep(5)
                    except Exception as e:
                        print(f"Error fetching chat messages: {e}")
                        # If we get an exception, break out of this loop to reconnect
                        self.live_chat_id = None
                        break
                
                # If we're here, we need to reconnect - wait a bit before trying again
                delay = min(30 * (2 ** self.reconnect_attempts), self.max_reconnect_delay)
                self.reconnect_attempts += 1
                print(f"YouTube connection lost, will attempt to reconnect in {delay}s... (attempt {self.reconnect_attempts})")
                await asyncio.sleep(delay)
                
            except Exception as e:
                print(f"Unexpected error in YouTube chat fetcher: {e}")
                delay = min(30 * (2 ** self.reconnect_attempts), self.max_reconnect_delay)
                self.reconnect_attempts += 1
                print(f"Will retry in {delay}s... (attempt {self.reconnect_attempts})")
                await asyncio.sleep(delay)
                
            # Limit the size of processed_message_ids to prevent memory issues during long runs
            if len(self.processed_message_ids) > 10000:
                print(f"Clearing message ID cache (was {len(self.processed_message_ids)} items)")
                self.processed_message_ids.clear()
                
        # This will only execute if self.running becomes False
        if self.session and not self.session.closed:
            await self.session.close()
            print("YouTube session closed")

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

    async def cleanup(self):
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
        # Reconnect logic is handled by the websocket_app_runner function

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
    # Import time for sleep in websocket reconnection
    import time
    import signal
    
    # Initialize WebSocket connection
    ws_app = None  # Will be set when connection opens
    
    # Create a single event loop for both async tasks
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Start Twitch Chat
    twitch_bot = TwitchChatBot(ws_app)
    
    # Start YouTube Chat
    youtube_fetcher = YouTubeChatFetcher(ws_app, loop)
    
    # Flag to control the main loop
    running = True
    
    # Signal handler for graceful shutdown
    def signal_handler(sig, frame):
        print("Signal received, preparing for graceful shutdown...")
        global running
        running = False
        # We don't exit immediately - let the main loop handle the shutdown
    
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
                    
                    # Wait for a short time to check if we should continue running
                    await asyncio.sleep(1)
                    
                    # Check if any task failed and needs to be restarted
                    if twitch_task.done() and not twitch_task.cancelled():
                        try:
                            twitch_task.result()  # This will raise any exception that occurred
                            print("Twitch task completed unexpectedly, will restart")
                        except Exception as e:
                            print(f"Twitch task failed with error: {e}, will restart")
                        twitch_task = asyncio.create_task(twitch_bot.reconnect_twitch())
                    
                    if youtube_task.done() and not youtube_task.cancelled():
                        try:
                            youtube_task.result()  # This will raise any exception that occurred
                            print("YouTube task completed unexpectedly, will restart")
                        except Exception as e:
                            print(f"YouTube task failed with error: {e}, will restart")
                        youtube_task = asyncio.create_task(youtube_fetcher.fetch_chat_messages())
                
                except asyncio.CancelledError:
                    print("Tasks cancelled, but will be restarted")
                except Exception as e:
                    print(f"Error in main loop: {e}, continuing...")
                    await asyncio.sleep(5)  # Wait a bit before retrying
            
            # If we get here, running has been set to False, so we're shutting down
            print("Shutting down tasks...")
            if twitch_task and not twitch_task.done():
                twitch_task.cancel()
            if youtube_task and not youtube_task.done():
                youtube_task.cancel()
                
        finally:
            # Ensure proper cleanup
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