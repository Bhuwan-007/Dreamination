import json
import logging
import sys
import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class JSONFormatter(logging.Formatter):
    """Structured JSON formatter forbidding any dream text or request body content."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Include custom non-content context if present
        for key in ("trace_id", "user_id", "stage", "duration_ms", "status_code", "path", "method"):
            if hasattr(record, key):
                log_obj[key] = getattr(record, key)

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configures structured JSON logging across the app."""
    logger = logging.getLogger("dream_machine")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Avoid duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)

    # Silence verbose 3rd party loggers
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.access").propagate = False

    return logger


logger = setup_logging()


class SafeRequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs HTTP requests WITHOUT ever reading or recording request bodies.
    Enforces Rule 6: Never log dream content.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        trace_id = request.headers.get("x-trace-id", "none")
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Log request metadata ONLY (method, path, status, duration) - NEVER the body
            extra = {
                "trace_id": trace_id,
                "method": method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            }
            logger.info(f"{method} {path} -> {response.status_code} ({duration_ms}ms)", extra=extra)
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            extra = {
                "trace_id": trace_id,
                "method": method,
                "path": path,
                "status_code": 500,
                "duration_ms": duration_ms,
            }
            logger.error(f"{method} {path} failed: {type(exc).__name__}", extra=extra, exc_info=True)
            raise
