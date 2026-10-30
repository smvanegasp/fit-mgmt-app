"""Photo storage in S3 (Adobe S3Mock locally). Keys are "<space>/<id>.img" and "<space>/<id>-thumb.img"."""

import os
import time
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


def bucket() -> str:
    return os.environ.get("PHOTOS_BUCKET", "fit-photos")


@lru_cache
def get_s3():
    endpoint = os.environ.get("S3_ENDPOINT") or None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
        # Local S3 servers are reached by container name, so use path-style URLs there.
        config=Config(s3={"addressing_style": "path"}) if endpoint else None,
    )


def create_bucket_if_missing(attempts: int = 10) -> None:
    """Used for local dev and tests; in AWS the bucket is created by Terraform.

    Retries briefly because the local S3 container may still be starting.
    """
    s3 = get_s3()
    for attempt in range(attempts):
        try:
            s3.head_bucket(Bucket=bucket())
            return
        except ClientError as err:
            if err.response["Error"]["Code"] in ("404", "NoSuchBucket"):
                s3.create_bucket(Bucket=bucket())
                return
            if attempt == attempts - 1:
                raise
        except Exception:
            if attempt == attempts - 1:
                raise
        time.sleep(1)


def put(key: str, data: bytes, content_type: str) -> None:
    get_s3().put_object(Bucket=bucket(), Key=key, Body=data, ContentType=content_type)


def get(key: str) -> tuple[bytes, str] | None:
    try:
        obj = get_s3().get_object(Bucket=bucket(), Key=key)
    except ClientError as err:
        if err.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return None
        raise
    return obj["Body"].read(), obj.get("ContentType", "image/jpeg")


def delete(*keys: str) -> None:
    for key in keys:
        get_s3().delete_object(Bucket=bucket(), Key=key)
