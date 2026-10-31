"""Put the app's secrets in SSM Parameter Store for the AWS deployment.

Run from the repo root:  cd backend && uv run python ../scripts/set_aws_secrets.py
(add --new-passcode to choose a different passcode than the local one)

- SESSION_SECRET: generated once; never overwritten (changing it logs everyone out).
- PASSCODE_HASH and GROQ_API_KEY: copied from backend/.env when present, otherwise asked
  for with a hidden prompt.
Nothing secret is printed. Uses the "gym" AWS profile unless AWS_PROFILE is set. If the
API is already deployed, it is restarted so it reads the new values.
"""

import argparse
import getpass
import os
import re
import secrets
import sys
from pathlib import Path

import boto3

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

from app.passcode import hash_passcode  # noqa: E402
from set_passcode import read_env  # noqa: E402

PREFIX = "/fit/"


def ask_passcode() -> str:
    passcode = getpass.getpass("6-digit passcode for AWS (hidden): ")
    if not re.fullmatch(r"\d{6}", passcode):
        sys.exit("The passcode must be exactly 6 digits.")
    if getpass.getpass("Repeat it: ") != passcode:
        sys.exit("The passcodes don't match.")
    return hash_passcode(passcode)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--new-passcode", action="store_true")
    args = parser.parse_args()

    session = boto3.Session(profile_name=os.environ.get("AWS_PROFILE", "gym"),
                            region_name="us-east-1")
    ssm = session.client("ssm")
    existing = {
        p["Name"].removeprefix(PREFIX)
        for page in ssm.get_paginator("get_parameters_by_path").paginate(Path=PREFIX)
        for p in page["Parameters"]
    }
    env = read_env()

    values: dict[str, str] = {}
    if "SESSION_SECRET" not in existing:
        values["SESSION_SECRET"] = secrets.token_urlsafe(32)
    if args.new_passcode or not env.get("PASSCODE_HASH"):
        values["PASSCODE_HASH"] = ask_passcode()
    else:
        values["PASSCODE_HASH"] = env["PASSCODE_HASH"]
    values["GROQ_API_KEY"] = env.get("GROQ_API_KEY") or getpass.getpass("Groq API key (hidden): ")

    for name, value in values.items():
        if not value:
            sys.exit(f"{name} is empty; nothing saved for it.")
        ssm.put_parameter(Name=PREFIX + name, Value=value, Type="SecureString", Overwrite=True)
        print(f"Saved {PREFIX}{name}")

    # Lambda reads SSM at cold start: redeploying the same image replaces warm instances.
    lam = session.client("lambda")
    try:
        image = lam.get_function(FunctionName="fit-api")["Code"]["ImageUri"]
    except lam.exceptions.ResourceNotFoundException:
        return
    lam.update_function_code(FunctionName="fit-api", ImageUri=image)
    print("Restarted the API so it picks up the new values.")


if __name__ == "__main__":
    main()
