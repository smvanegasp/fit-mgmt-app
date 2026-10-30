import os

import pytest
from moto import mock_aws

from app import db, storage


@pytest.fixture(autouse=True)
def aws():
    """Every test gets a fresh, in-memory DynamoDB table and photos bucket."""
    os.environ.update(
        AWS_ACCESS_KEY_ID="test",
        AWS_SECRET_ACCESS_KEY="test",
        AWS_REGION="us-east-1",
        TABLE_NAME="fit-test",
        PHOTOS_BUCKET="fit-photos-test",
    )
    for name in ("DYNAMODB_ENDPOINT", "S3_ENDPOINT", "ORIGIN_SECRET", "AWS_PROFILE"):
        os.environ.pop(name, None)
    with mock_aws():
        db.get_table.cache_clear()
        storage.get_s3.cache_clear()
        db.create_table_if_missing()
        storage.create_bucket_if_missing()
        yield
    db.get_table.cache_clear()
    storage.get_s3.cache_clear()
