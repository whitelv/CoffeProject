from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/")
async def health_check():
    return {"status": "ok", "app": "Coffee Brew API"}
