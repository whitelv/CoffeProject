import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

RECIPES = [
    {
        "id": "espresso",
        "name": "Espresso",
        "type": "espresso",
        "description": "A short, concentrated shot of coffee brewed under pressure.",
        "grind_size": "fine",
        "total_coffee_g": 18,
        "total_water_g": 36,
        "estimated_time_sec": 60,
        "steps": [
            {
                "name": "Dose & Tamp",
                "instruction": "Grind 18g of coffee, distribute evenly and tamp firmly.",
                "target_weight_g": 18,
                "duration_sec": 20,
            },
            {
                "name": "Extract",
                "instruction": "Start the shot. Stop when you reach 36g in the cup.",
                "target_weight_g": 36,
                "duration_sec": 30,
            },
        ],
    },
    {
        "id": "v60",
        "name": "V60",
        "type": "pour-over",
        "description": "A clean, bright pour-over with full control over extraction.",
        "grind_size": "medium-fine",
        "total_coffee_g": 15,
        "total_water_g": 250,
        "estimated_time_sec": 210,
        "steps": [
            {
                "name": "Bloom",
                "instruction": "Pour 30g of water over the grounds. Wait 30 seconds.",
                "target_weight_g": 30,
                "duration_sec": 45,
            },
            {
                "name": "First Pour",
                "instruction": "Slowly pour in circles up to 100g total.",
                "target_weight_g": 100,
                "duration_sec": 45,
            },
            {
                "name": "Second Pour",
                "instruction": "Continue pouring in circles up to 175g total.",
                "target_weight_g": 175,
                "duration_sec": 45,
            },
            {
                "name": "Final Pour",
                "instruction": "Pour the remaining water to reach 250g. Let it drain.",
                "target_weight_g": 250,
                "duration_sec": 45,
            },
        ],
    },
    {
        "id": "french-press",
        "name": "French Press",
        "type": "immersion",
        "description": "A rich, full-bodied brew with a bold flavour.",
        "grind_size": "coarse",
        "total_coffee_g": 30,
        "total_water_g": 500,
        "estimated_time_sec": 300,
        "steps": [
            {
                "name": "Add Coffee & Water",
                "instruction": "Add 30g of coarsely ground coffee and pour 500g of hot water.",
                "target_weight_g": 500,
                "duration_sec": 30,
            },
            {
                "name": "Steep",
                "instruction": "Place the lid on (don't press). Wait 4 minutes.",
                "target_weight_g": 500,
                "duration_sec": 240,
            },
            {
                "name": "Press & Pour",
                "instruction": "Press the plunger down slowly and pour immediately.",
                "target_weight_g": 500,
                "duration_sec": 30,
            },
        ],
    },
    {
        "id": "aeropress",
        "name": "AeroPress",
        "type": "immersion",
        "description": "Versatile, smooth, and quick — great for travel.",
        "grind_size": "medium",
        "total_coffee_g": 17,
        "total_water_g": 200,
        "estimated_time_sec": 150,
        "steps": [
            {
                "name": "Bloom",
                "instruction": "Add 17g of coffee and pour 40g of water. Stir and wait 30s.",
                "target_weight_g": 40,
                "duration_sec": 40,
            },
            {
                "name": "Fill",
                "instruction": "Pour the remaining water to reach 200g.",
                "target_weight_g": 200,
                "duration_sec": 30,
            },
            {
                "name": "Press",
                "instruction": "Attach the cap and press down slowly over 30 seconds.",
                "target_weight_g": 200,
                "duration_sec": 40,
            },
        ],
    },
    {
        "id": "cold-brew",
        "name": "Cold Brew",
        "type": "cold",
        "description": "Smooth and low-acidity concentrate brewed cold overnight.",
        "grind_size": "extra-coarse",
        "total_coffee_g": 80,
        "total_water_g": 600,
        "estimated_time_sec": 720,
        "steps": [
            {
                "name": "Combine",
                "instruction": "Add 80g of coarsely ground coffee to the container and pour 600g of cold water.",
                "target_weight_g": 600,
                "duration_sec": 60,
            },
            {
                "name": "Steep",
                "instruction": "Cover and refrigerate for 12–18 hours.",
                "target_weight_g": 600,
                "duration_sec": 660,
            },
        ],
    },
]

RFID_MAPPINGS = [
    {"rfid": "CARD001", "recipe_id": "espresso"},
    {"rfid": "CARD002", "recipe_id": "v60"},
    {"rfid": "CARD003", "recipe_id": "french-press"},
    {"rfid": "CARD004", "recipe_id": "aeropress"},
    {"rfid": "CARD005", "recipe_id": "cold-brew"},
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client["coffee_brew"]

    existing_recipes = await db["recipes"].count_documents({})
    if existing_recipes == 0:
        await db["recipes"].insert_many(RECIPES)
        for r in RECIPES:
            print(f"  inserted recipe: {r['name']}")
    else:
        print(f"  recipes already seeded ({existing_recipes} found), skipping")

    existing_mappings = await db["rfid_mappings"].count_documents({})
    if existing_mappings == 0:
        await db["rfid_mappings"].insert_many(RFID_MAPPINGS)
        for m in RFID_MAPPINGS:
            print(f"  inserted mapping: {m['rfid']} → {m['recipe_id']}")
    else:
        print(f"  rfid_mappings already seeded ({existing_mappings} found), skipping")

    client.close()
    print("done.")


if __name__ == "__main__":
    asyncio.run(seed())
