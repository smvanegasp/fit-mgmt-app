"""Runtime configuration from environment variables (docker compose locally, SSM on AWS)."""

import os


def on_aws() -> bool:
    return bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


def origin_secret() -> str | None:
    """Set on AWS: CloudFront sends it in X-Origin-Verify, so direct API Gateway calls are refused."""
    return os.environ.get("ORIGIN_SECRET") or None
