from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .logging import SafeRequestLoggingMiddleware, logger, setup_logging
from .routes.auth import router as auth_router
from .routes.dreams import router as dreams_router
from .routes.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.LOG_LEVEL)
    logger.info("The Dream Machine API starting up", extra={"environment": settings.ENVIRONMENT})

    # Auto-initialize database tables for local runs
    try:
        from .database import engine
        from .models.base import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema initialized.")
    except Exception as exc:
        logger.warning(f"Database schema auto-init warning: {exc}")

    yield
    logger.info("The Dream Machine API shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="The Dream Machine API",
        version="0.1.0",
        description="Backend API for The Dream Machine - turning dream fragments into stories, reflections, and 3D films.",
        lifespan=lifespan,
    )

    # CORS configuration
    origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Safe structured logging middleware (NEVER logs bodies or dream text)
    app.add_middleware(SafeRequestLoggingMiddleware)

    # Mount routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(dreams_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.src.main:app", host="0.0.0.0", port=8000, reload=True)
