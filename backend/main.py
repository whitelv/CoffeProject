from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import recipes
from models import Recipe

app = FastAPI(title="Coffee Brew API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory runtime state
active_brew_session = None
live_weight: float = 0.0
oled_display: str = ""
rfid_tag: str | None = None


def fix_id(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@app.get("/")
async def health_check():
    return {"status": "ok", "app": "Coffee Brew API"}


# --- Recipe CRUD ---

@app.get("/recipes/")
async def list_recipes():
    result = []
    async for doc in recipes.find():
        result.append(fix_id(doc))
    return result


@app.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str):
    doc = await recipes.find_one({"id": recipe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return fix_id(doc)


@app.post("/recipes/", status_code=201)
async def create_recipe(recipe: Recipe):
    if await recipes.find_one({"id": recipe.id}):
        raise HTTPException(status_code=400, detail="Recipe with this id already exists")
    await recipes.insert_one(recipe.model_dump())
    return recipe


@app.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, recipe: Recipe):
    result = await recipes.replace_one({"id": recipe_id}, recipe.model_dump())
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@app.delete("/recipes/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: str):
    result = await recipes.delete_one({"id": recipe_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
