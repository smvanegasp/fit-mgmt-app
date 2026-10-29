import os

import pytest
from moto import mock_aws

from app import db


@pytest.fixture(autouse=True)
def aws():
    """Every test gets a fresh, in-memory DynamoDB table."""
    os.environ.update(
        AWS_ACCESS_KEY_ID="test",
        AWS_SECRET_ACCESS_KEY="test",
        AWS_REGION="us-east-1",
        TABLE_NAME="fit-test",
    )
    os.environ.pop("DYNAMODB_ENDPOINT", None)
    os.environ.pop("ORIGIN_SECRET", None)
    with mock_aws():
        db.get_table.cache_clear()
        db.create_table_if_missing()
        yield
    db.get_table.cache_clear()
