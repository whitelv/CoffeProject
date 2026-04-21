from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class BrewStep(BaseModel):
    name: str
    instruction: str
    target_weight_g: float


class Recipe(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    steps: List[BrewStep]


class RfidMapping(BaseModel):
    uid: str
    recipe_id: str


class RfidMappingUpdate(BaseModel):
    recipe_id: str


class WeightPayload(BaseModel):
    weight: float


class OledPayload(BaseModel):
    line1: str
    line2: str = ""
    line3: str = ""


class RfidPayload(BaseModel):
    uid: str


class BrewStepLog(BaseModel):
    step_name: str
    target_weight_g: float
    actual_weight_g: float
    completed_at: datetime = Field(default_factory=datetime.utcnow)


class BrewSession(BaseModel):
    id: Optional[str] = None
    recipe_id: str
    recipe_name: str
    steps: List[BrewStepLog] = []
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    completed: bool = False
