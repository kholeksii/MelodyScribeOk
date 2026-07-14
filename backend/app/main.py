import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes.audio import router as audio_router
from .api.routes.export import router as export_router
from .api.routes.transcribe import router as transcribe_router
from .api.routes.verify import router as verify_router
from .errors import FfmpegMissingError

# Without this, every logger.info/warning in the app (transcription pipeline,
# key/meter detection, uploads) is silently dropped — uvicorn only configures
# its own access/error loggers, not the root logger our modules use (B2).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

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
    # Same-machine dev server reached from another device on the LAN (e.g.
    # an iPad), still restricted to private network ranges + Vite's dev ports.
    allow_origin_regex=r"^http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):517\d$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_CODE_BY_STATUS = {
    400: "bad_request",
    404: "not_found",
    422: "unprocessable",
    500: "internal",
}


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "data": None, "error": {"code": code, "message": message}},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = _CODE_BY_STATUS.get(exc.status_code, f"http_{exc.status_code}")
    return _error_response(exc.status_code, code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return _error_response(422, "validation_error", str(exc.errors()))


@app.exception_handler(FfmpegMissingError)
async def ffmpeg_exception_handler(request: Request, exc: FfmpegMissingError) -> JSONResponse:
    return _error_response(422, "ffmpeg_missing", str(exc))


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    # Log with traceback — a bare 400 in the access log is undiagnosable
    # (the Cyrillic-filename export bug hid here with zero log lines)
    logger.warning(f"Bad request on {request.url.path}: {exc}", exc_info=True)
    return _error_response(400, "bad_request", str(exc))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return _error_response(500, "internal", str(exc))


app.include_router(audio_router)
app.include_router(transcribe_router)
app.include_router(verify_router)
app.include_router(export_router)


@app.get("/api/health")
def health_check():
    return {"success": True, "data": {"status": "ok"}}
