import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_URL)
coffee_brew_db = client["coffee_brew"]

recipes = coffee_brew_db["recipes"]
brew_sessions = coffee_brew_db["brew_sessions"]
rfid_mappings = coffee_brew_db["rfid_mappings"]
