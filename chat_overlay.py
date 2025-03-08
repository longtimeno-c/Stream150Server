import tkinter as tk
from tkinter import font as tkFont
import websocket
import json
import threading
import asyncio
import aiohttp
from twitchio.ext import commands

# Configuration
# Twitch Configuration
TWITCH_CHANNEL = "westboys1912"  # Change this to your Twitch channel name
TWITCH_TOKEN = "oauth:xl0yg6ryxly7dpxoexyeuue0oxmivp"  # Generate at https://twitchtokengenerator.com/
# YouTube Configuration
YOUTUBE_API_KEY = "AIzaSyDoVhH2WRSvaC_KUSNNUxFywkVuAJ7Iss4"  # Get from Google Developer Console
YOUTUBE_CHANNEL_ID = "UC5MvICzk7cb1Oh2c9VBrnIw"  # Find from YouTube channel URL
YOUTUBE_LIVE_CHAT_ID = None  # Will be fetched dynamically
WEBSOCKET_URL = "ws://localhost:3001"  # Match your Node.js server

def create_chat_overlay():
    chat_overlay = tk.Tk()
    chat_overlay.title("Chat Overlay")
    chat_overlay.geometry("+800+200")
    chat_overlay.attributes("-topmost", True)
    
    chat_frame = tk.Frame(chat_overlay, bg="black")
    chat_frame.pack(fill="both", expand=True, padx=0, pady=0)

    chat_box = tk.Text(chat_frame, wrap="word", height=15, width=45, 
                      bg="black", fg="white", font=("Helvetica", 14, "bold"), 
                      bd=0, highlightthickness=0)
    chat_box.pack(expand=True, fill="both")
    chat_box.insert("end", "Connecting to chats...\n")
    chat_box.config(state="disabled")

    chat_box.tag_configure("twitch", foreground="white", background="purple")
    chat_box.tag_configure("youtube", foreground="white", background="red")

    return chat_overlay, chat_box

# Twitch Chat Bot
class TwitchChatBot(commands.Bot):
    def __init__(self, ws, chat_box):
        super().__init__(token=TWITCH_TOKEN, prefix="!", initial_channels=[TWITCH_CHANNEL])
        self.ws = ws
        self.chat_box = chat_box

    async def event_ready(self):
        print(f"Connected to Twitch chat as {self.nick}")

    async def event_message(self, message):
        if message.author is None:
            return
        msg = f"Twitch | {message.author.name}: {message.content}"
        self.send_to_websocket(msg, "twitch")
        self.update_chat_box(msg, "twitch")

    def send_to_websocket(self, msg, platform):
        if self.ws and self.ws.connected:
            self.ws.send(json.dumps({
                "type": "CHAT_MESSAGE",
                "platform": platform,
                "message": msg
            }))

    def update_chat_box(self, msg, tag):
        self.chat_box.config(state="normal")
        self.chat_box.insert("end", msg + "\n", tag)
        self.chat_box.yview("end")
        self.chat_box.config(state="disabled")

# YouTube Chat Fetcher
class YouTubeChatFetcher:
    def __init__(self, ws, chat_box):
        self.ws = ws
        self.chat_box = chat_box
        self.running = True
        self.live_chat_id = None
        self.processed_message_ids = set()

    async def get_live_chat_id(self):
        while self.running and not self.live_chat_id:
            url = f"https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId={YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key={YOUTUBE_API_KEY}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    data = await resp.json()
                if "items" in data and data["items"]:
                    video_id = next((item["id"]["videoId"] for item in data["items"] if item["snippet"]["liveBroadcastContent"] == "live"), None)
                    if video_id:
                        chat_url = f"https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id={video_id}&key={YOUTUBE_API_KEY}"
                        async with session.get(chat_url) as chat_resp:
                            chat_data = await chat_resp.json()
                            if "items" in chat_data and chat_data["items"]:
                                self.live_chat_id = chat_data["items"][0]["liveStreamingDetails"]["activeLiveChatId"]
                                print(f"Found YouTube Live Chat ID: {self.live_chat_id}")
            if not self.live_chat_id:
                print("No live stream found, retrying in 30s...")
                await asyncio.sleep(30)

    async def fetch_chat_messages(self):
        await self.get_live_chat_id()
        if not self.live_chat_id:
            return

        url = f"https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId={self.live_chat_id}&part=snippet,authorDetails&key={YOUTUBE_API_KEY}"
        while self.running:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    data = await resp.json()
                    if "items" in data:
                        for item in data["items"]:
                            if item["id"] not in self.processed_message_ids:
                                self.processed_message_ids.add(item["id"])
                                msg = f"YouTube | {item['authorDetails']['displayName']}: {item['snippet']['displayMessage']}"
                                self.send_to_websocket(msg, "youtube")
                                self.update_chat_box(msg, "youtube")
            await asyncio.sleep(5)

    def send_to_websocket(self, msg, platform):
        if self.ws and self.ws.connected:
            self.ws.send(json.dumps({
                "type": "CHAT_MESSAGE",
                "platform": platform,
                "message": msg
            }))

    def update_chat_box(self, msg, tag):
        self.chat_box.config(state="normal")
        self.chat_box.insert("end", msg + "\n", tag)
        self.chat_box.yview("end")
        self.chat_box.config(state="disabled")

def run_websocket(chat_box, twitch_bot, youtube_fetcher):
    def on_message(ws, message):
        data = json.loads(message)
        if data["type"] == "CHAT_MESSAGE":
            tag = "twitch" if data["platform"] == "twitch" else "youtube"
            chat_box.config(state="normal")
            chat_box.insert("end", data["message"] + "\n", tag)
            chat_box.yview("end")
            chat_box.config(state="disabled")

    def on_open(ws):
        print("Connected to WebSocket server")
        twitch_bot.ws = ws
        youtube_fetcher.ws = ws

    ws = websocket.WebSocketApp(WEBSOCKET_URL,
                              on_message=on_message,
                              on_open=on_open)
    ws.run_forever()

if __name__ == "__main__":
    chat_overlay, chat_box = create_chat_overlay()
    
    # Initialize WebSocket connection
    ws_thread = threading.Thread(target=run_websocket, args=(chat_box,), daemon=True)
    ws_thread.start()

    # Start Twitch Chat
    twitch_bot = TwitchChatBot(None, chat_box)  # ws will be set when connection opens
    threading.Thread(target=lambda: asyncio.run(twitch_bot.start()), daemon=True).start()

    # Start YouTube Chat
    youtube_fetcher = YouTubeChatFetcher(None, chat_box)  # ws will be set when connection opens
    threading.Thread(target=lambda: asyncio.run(youtube_fetcher.fetch_chat_messages()), daemon=True).start()

    chat_overlay.mainloop()