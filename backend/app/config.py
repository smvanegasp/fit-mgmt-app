"""Runtime configuration from environment variables (docker compose locally, SSM on AWS)."""

import os
import warnings


def on_aws() -> bool:
    return bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


def origin_secret() -> str | None:
    """Set on AWS: CloudFront sends it in X-Origin-Verify, so direct API Gateway calls are refused."""
    return os.environ.get("ORIGIN_SECRET") or None


DEV_SECRET = "dev-only-insecure-secret"


def session_secret() -> str:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        if on_aws():
            raise RuntimeError("SESSION_SECRET is missing; put it in SSM")
        warnings.warn("SESSION_SECRET is not set; using an insecure development secret")
        return DEV_SECRET
    return secret


def passcode_hash() -> str | None:
    """Set with scripts/set_passcode.py; None means owner login is off."""
    return os.environ.get("PASSCODE_HASH") or None


def cookie_secure() -> bool:
    """Secure cookies everywhere except plain-http local development."""
    return os.environ.get("COOKIE_SECURE", "1") == "1"


def sandbox_limit_per_ip() -> int:
    """Demo sandboxes one IP may start per hour."""
    return int(os.environ.get("SANDBOX_LIMIT_PER_IP", "20"))


SANDBOX_HOURS = 24
OWNER_SESSION_DAYS = 90
