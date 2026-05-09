from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes.audio import router as audio_router
from .api.routes.transcribe import router as transcribe_router
from .api.routes.verify import router as verify_router
from .api.routes.export import router as export_router

app = FastAPI(title="MelodyScribe Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        # Electron production: renderer loads from file:// or custom scheme
        "file://",
        "null",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio_router)
app.include_router(transcribe_router)
app.include_router(verify_router)
app.include_router(export_router)

@app.get("/api/health")
def health_check():
    return {"success": True, "data": {"status": "ok"}}