"""DynamoDB access: one table, partitioned by space (the owner's training log or a guest sandbox).

Guest sandboxes (stage 5a) will add a `ttl` attribute to their rows so DynamoDB deletes them
when the sandbox expires.
"""

import os
from decimal import Decimal
from functools import lru_cache
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key


def table_name() -> str:
    return os.environ.get("TABLE_NAME", "fit")


@lru_cache
def get_table():
    resource = boto3.resource(
        "dynamodb",
        endpoint_url=os.environ.get("DYNAMODB_ENDPOINT") or None,
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )
    return resource.Table(table_name())


def create_table_if_missing() -> None:
    """Used for local dev and tests; in AWS the table is created by Terraform."""
    client = get_table().meta.client
    if table_name() in client.list_tables()["TableNames"]:
        return
    client.create_table(
        TableName=table_name(),
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    client.get_waiter("table_exists").wait(TableName=table_name())
    client.update_time_to_live(
        TableName=table_name(),
        TimeToLiveSpecification={"Enabled": True, "AttributeName": "ttl"},
    )


def _pk(space: str) -> str:
    return f"SPACE#{space}"


def _from_dynamo(value: Any) -> Any:
    """Drop key and TTL attributes and turn DynamoDB Decimals back into ints or floats
    (weights like 22.5 lb are fractional), recursing into nested sets and lists."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, list):
        return [_from_dynamo(v) for v in value]
    if isinstance(value, dict):
        return {k: _from_dynamo(v) for k, v in value.items() if k not in ("pk", "sk", "ttl")}
    return value


def _to_dynamo(value: Any) -> Any:
    """DynamoDB rejects Python floats; store them as Decimals."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_to_dynamo(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_dynamo(v) for k, v in value.items()}
    return value


def put(space: str, sk: str, data: dict[str, Any]) -> None:
    get_table().put_item(Item={**_to_dynamo(data), "pk": _pk(space), "sk": sk})


def get(space: str, sk: str) -> dict[str, Any] | None:
    row = get_table().get_item(Key={"pk": _pk(space), "sk": sk}).get("Item")
    return _from_dynamo(row) if row else None


def query(space: str, sk_prefix: str) -> list[dict[str, Any]]:
    table = get_table()
    condition = Key("pk").eq(_pk(space))
    if sk_prefix:
        condition = condition & Key("sk").begins_with(sk_prefix)
    response = table.query(KeyConditionExpression=condition)
    rows = response["Items"]
    while "LastEvaluatedKey" in response:
        response = table.query(
            KeyConditionExpression=condition,
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        rows.extend(response["Items"])
    return [_from_dynamo(r) for r in rows]


def delete(space: str, sk: str) -> None:
    get_table().delete_item(Key={"pk": _pk(space), "sk": sk})


def put_many(space: str, rows: dict[str, dict[str, Any]]) -> None:
    """Write many rows ({sk: data}) in batches of 25."""
    with get_table().batch_writer() as batch:
        for sk, data in rows.items():
            batch.put_item(Item={**_to_dynamo(data), "pk": _pk(space), "sk": sk})


def keys(space: str, sk_prefix: str) -> list[tuple[str, dict[str, Any]]]:
    """(sk, data) for every row under a prefix; like query() but keeps the sort key."""
    table = get_table()
    condition = Key("pk").eq(_pk(space)) & Key("sk").begins_with(sk_prefix)
    response = table.query(KeyConditionExpression=condition)
    rows = response["Items"]
    while "LastEvaluatedKey" in response:
        response = table.query(KeyConditionExpression=condition, ExclusiveStartKey=response["LastEvaluatedKey"])
        rows.extend(response["Items"])
    return [(r["sk"], _from_dynamo(r)) for r in rows]


def delete_many(space: str, sks: list[str]) -> None:
    with get_table().batch_writer() as batch:
        for sk in sks:
            batch.delete_item(Key={"pk": _pk(space), "sk": sk})
