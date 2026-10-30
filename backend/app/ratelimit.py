"""Fixed-window rate limits backed by DynamoDB counters (works across Lambda instances)."""

import time

from fastapi import HTTPException, Request, status

from app import db


def client_ip(request: Request) -> str:
    # Behind CloudFront the viewer's address arrives in this header ("ip:port").
    viewer = request.headers.get("cloudfront-viewer-address")
    if viewer:
        return viewer.rsplit(":", 1)[0]
    return request.client.host if request.client else "unknown"


def _key(name: str, window_seconds: int) -> str:
    return f"{name}#{int(time.time()) // window_seconds}"


def count(name: str, window_seconds: int) -> int:
    """Current count for this window, without incrementing."""
    row = db.get_table().get_item(
        Key={"pk": f"COUNTER#{_key(name, window_seconds)}", "sk": "COUNTER"}
    ).get("Item")
    return int(row["n"]) if row else 0


def hit(name: str, window_seconds: int) -> int:
    """Record one event in the current window and return the window's total."""
    return db.increment(_key(name, window_seconds), ttl_seconds=window_seconds * 2)


def too_many(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail)
