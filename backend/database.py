import os
import logging
from typing import Dict, Optional, Union
from datetime import datetime

from pydantic import BaseModel

BEANIE_IMPORT_ERROR = None
try:
    from beanie import Document, init_beanie
    from motor.motor_asyncio import AsyncIOMotorClient
    # Satisfy Beanie's PyMongo append_metadata call without triggering MotorDatabase fallback
    AsyncIOMotorClient.append_metadata = lambda *args, **kwargs: None  # type: ignore
    HAS_BEANIE = True
except Exception as e:
    Document = object  # type: ignore
    HAS_BEANIE = False
    BEANIE_IMPORT_ERROR = str(e)

logger = logging.getLogger("quality_inspection_api")

db_client = None
is_db_connected: bool = False
db_error: Optional[str] = None


if HAS_BEANIE:
    class InspectionTelemetry(Document):
        batch_id: str
        machine_id: str
        timestamp: datetime
        classified_defect: str
        sensor_readings: Dict[str, float]
        root_cause: Dict[str, Union[str, float]]

        class Settings:
            name = "inspection_telemetry"
else:
    class InspectionTelemetry(BaseModel):  # type: ignore
        batch_id: str
        machine_id: str
        timestamp: datetime
        classified_defect: str
        sensor_readings: Dict[str, float]
        root_cause: Dict[str, Union[str, float]]

        async def insert(self):
            logger.debug("Beanie/Motor not installed; document insert skipped.")
            return self


DEFAULT_MONGO_URI = "mongodb+srv://jonathanscorrea45_db_user:KhPhUDxWgULWcXUT@qastra.ntr5l4c.mongodb.net/?retryWrites=true&w=majority"

async def init_db(mongo_uri: Optional[str] = None, db_name: Optional[str] = None) -> bool:
    """
    Initializes Beanie connection with MongoDB.
    Reads MONGO_URI from argument or environment, falling back to default cluster.
    """
    global db_client, is_db_connected, db_error

    if not HAS_BEANIE:
        db_error = f"Beanie/Motor not imported: {BEANIE_IMPORT_ERROR}"
        logger.warning(db_error)
        is_db_connected = False
        return False

    uri = mongo_uri or os.getenv("MONGO_URI") or os.getenv("MONGODB_URL") or DEFAULT_MONGO_URI
    database_name = db_name or os.getenv("MONGO_DB_NAME", "qastra")

    if not uri:
        logger.info("MongoDB URI not provided. Database persistence disabled until configured.")
        is_db_connected = False
        return False

    try:
        db_client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=8000)
        await init_beanie(database=db_client[database_name], document_models=[InspectionTelemetry])
        is_db_connected = True
        db_error = None
        logger.info(f"Connected to MongoDB database '{database_name}' successfully via Beanie.")
        return True
    except Exception as exc:
        db_error = str(exc)
        logger.warning(f"Could not connect to MongoDB ({exc}). Running with DB persistence disabled.")
        is_db_connected = False
        return False
