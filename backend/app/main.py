import hmac
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app import db, ssm, storage
from app.config import on_aws, origin_secret
from app.routers import exercises, photos, workouts


@asynccontextmanager
async def lifespan(_: FastAPI):
    ssm.load_parameters()
    if os.environ.get("AUTO_CREATE_TABLE") == "1":
        db.create_table_if_missing()
        storage.create_bucket_if_missing()
    yield


app = FastAPI(
    title="Gym API",
    # Interactive API docs locally only; on AWS they would just map the API for strangers.
    docs_url=None if on_aws() else "/api/docs",
    openapi_url=None if on_aws() else "/api/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def require_cloudfront(request: Request, call_next):
    """On AWS only CloudFront may call the API; it is what sets the viewer address header
    that rate limits trust."""
    expected = origin_secret()
    if expected and not hmac.compare_digest(
        request.headers.get("x-origin-verify", "").encode(), expected.encode()
    ):
        return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)


app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(photos.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
