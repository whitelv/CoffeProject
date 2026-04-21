from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from datetime import datetime

from database import recipes, rfid_mappings, brew_sessions
from models import Recipe, RfidMapping, RfidMappingUpdate, RfidPayload, WeightPayload, OledPayload, BrewSession, BrewStepLog

app = FastAPI(title="Coffee Brew API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory runtime state
current_session: dict | None = None
live_weight: float = 0.0
oled_message: str = ""
rfid_tag: str | None = None
step_logs: list[dict] = []
oled_state: dict = {"line1": "", "line2": "", "line3": "", "updated": False}


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


# --- RFID Mapping CRUD ---

@app.get("/rfid-mappings/")
async def list_rfid_mappings():
    result = []
    async for doc in rfid_mappings.find():
        result.append(fix_id(doc))
    return result


@app.post("/rfid-mappings/", status_code=201)
async def create_rfid_mapping(mapping: RfidMapping):
    mapping.uid = mapping.uid.upper()
    if await rfid_mappings.find_one({"uid": mapping.uid}):
        raise HTTPException(status_code=400, detail="Mapping for this UID already exists")
    await rfid_mappings.insert_one(mapping.model_dump())
    return mapping


@app.put("/rfid-mappings/{rfid}")
async def update_rfid_mapping(rfid: str, body: RfidMappingUpdate):
    result = await rfid_mappings.update_one(
        {"uid": rfid.upper()}, {"$set": {"recipe_id": body.recipe_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"uid": rfid.upper(), "recipe_id": body.recipe_id}


@app.delete("/rfid-mappings/{rfid}", status_code=204)
async def delete_rfid_mapping(rfid: str):
    result = await rfid_mappings.delete_one({"uid": rfid.upper()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")


# --- Recipe select (ESP32 endpoint) ---

@app.post("/recipe/select/")
async def select_recipe(body: RfidPayload):
    global current_session, oled_message

    uid = body.uid.upper()
    mapping = await rfid_mappings.find_one({"uid": uid})
    if not mapping:
        raise HTTPException(status_code=404, detail="No recipe mapped to this card")

    recipe = await recipes.find_one({"id": mapping["recipe_id"]})
    if not recipe:
        raise HTTPException(status_code=404, detail="Mapped recipe not found")

    first_step = recipe["steps"][0] if recipe.get("steps") else None

    current_session = {
        "recipe_id": recipe["id"],
        "recipe_name": recipe["name"],
        "step_index": 0,
        "active": True,
    }

    oled_message = f"{recipe['name']} / {first_step['name'] if first_step else ''}"

    return {
        "id": recipe["id"],
        "name": recipe["name"],
        "first_step": first_step["name"] if first_step else "",
        "target_weight_g": first_step["target_weight_g"] if first_step else 0,
    }


# --- Brew session & step management ---

@app.get("/session/")
async def get_session():
    if not current_session:
        return {"active": False}

    recipe = await recipes.find_one({"id": current_session["recipe_id"]})
    total = len(recipe["steps"]) if recipe else 0
    step_index = current_session["step_index"]

    return {
        **current_session,
        "recipe": fix_id(recipe) if recipe else None,
        "total_steps": total,
        "complete": step_index >= total,
    }


@app.get("/recipe/current/")
async def get_current_step():
    if not current_session:
        raise HTTPException(status_code=404, detail="No active brew session")

    recipe = await recipes.find_one({"id": current_session["recipe_id"]})
    if not recipe:
        raise HTTPException(status_code=404, detail="Session recipe not found")

    steps = recipe.get("steps", [])
    step_index = current_session["step_index"]

    if step_index >= len(steps):
        return {"complete": True}

    step = steps[step_index]
    return {
        "complete": False,
        "name": step["name"],
        "instruction": step["instruction"],
        "target_weight_g": step["target_weight_g"],
        "step_index": step_index,
        "total_steps": len(steps),
    }


@app.post("/step/complete/")
async def complete_step(body: WeightPayload):
    global current_session, oled_message

    if not current_session:
        raise HTTPException(status_code=404, detail="No active brew session")

    recipe = await recipes.find_one({"id": current_session["recipe_id"]})
    if not recipe:
        raise HTTPException(status_code=404, detail="Session recipe not found")

    steps = recipe.get("steps", [])
    step_index = current_session["step_index"]

    if step_index < len(steps):
        step = steps[step_index]
        step_logs.append({
            "step_name": step["name"],
            "target_weight_g": step["target_weight_g"],
            "actual_weight_g": body.weight,
            "completed_at": datetime.utcnow().isoformat(),
        })

    current_session["step_index"] = step_index + 1
    new_index = current_session["step_index"]
    is_complete = new_index >= len(steps)

    if not is_complete:
        next_step = steps[new_index]
        oled_message = f"{recipe['name']} / {next_step['name']}"
    else:
        oled_message = f"{recipe['name']} / Done"

    return {"step_index": new_index, "complete": is_complete}


@app.post("/brew/complete/")
async def complete_brew():
    global current_session, oled_message, step_logs

    if not current_session:
        raise HTTPException(status_code=404, detail="No active brew session")

    session_doc = BrewSession(
        recipe_id=current_session["recipe_id"],
        recipe_name=current_session["recipe_name"],
        steps=[BrewStepLog(**log) for log in step_logs],
        completed_at=datetime.utcnow(),
        completed=True,
    )
    await brew_sessions.insert_one(session_doc.model_dump())

    current_session = None
    oled_message = ""
    step_logs = []

    return {"ok": True}


# --- Live weight endpoints ---

@app.post("/weight/current/")
async def post_weight(body: WeightPayload):
    global live_weight
    live_weight = body.weight
    return {"ok": True, "active": current_session is not None}


@app.get("/weight/current/")
async def get_weight():
    return {"weight": live_weight}


@app.post("/weight/confirmed/")
async def post_confirmed_weight(body: WeightPayload):
    if not current_session:
        return {"ok": True}

    recipe = await recipes.find_one({"id": current_session["recipe_id"]})
    if not recipe:
        return {"ok": True}

    steps = recipe.get("steps", [])
    step_index = current_session["step_index"]

    if step_index < len(steps):
        target = steps[step_index]["target_weight_g"]
        if abs(body.weight - target) <= 5.0:
            # Reuse complete_step logic inline to avoid circular call issues
            step = steps[step_index]
            step_logs.append({
                "step_name": step["name"],
                "target_weight_g": step["target_weight_g"],
                "actual_weight_g": body.weight,
                "completed_at": datetime.utcnow().isoformat(),
            })
            current_session["step_index"] = step_index + 1
            new_index = current_session["step_index"]
            if new_index < len(steps):
                next_step = steps[new_index]
                oled_state.update({"line1": recipe["name"], "line2": next_step["name"], "line3": "", "updated": True})
            else:
                oled_state.update({"line1": recipe["name"], "line2": "Done!", "line3": "", "updated": True})

    return {"ok": True}


# --- OLED endpoints ---

@app.get("/oled/")
async def get_oled():
    if not oled_state["updated"]:
        return {"updated": False, "line1": "", "line2": "", "line3": ""}
    payload = {
        "updated": True,
        "line1": oled_state["line1"],
        "line2": oled_state["line2"],
        "line3": oled_state["line3"],
    }
    oled_state["updated"] = False
    return payload


@app.post("/oled/")
async def post_oled(body: OledPayload):
    oled_state.update({"line1": body.line1, "line2": body.line2, "line3": body.line3, "updated": True})
    return {"ok": True}
