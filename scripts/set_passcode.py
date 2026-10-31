"""Set the owner's 6-digit passcode for local development.

Run from the repo root:  cd backend && uv run python ../scripts/set_passcode.py

Writes PASSCODE_HASH (and a random SESSION_SECRET if missing) to backend/.env, which git
ignores, keeping the other keys (GROQ_API_KEY). The passcode itself is never stored or printed.
Restart the API afterwards: docker compose up -d api
"""

import getpass
import re
import secrets
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.passcode import hash_passcode  # noqa: E402

ENV_FILE = BACKEND / ".env"


def read_env() -> dict[str, str]:
    if not ENV_FILE.exists():
        return {}
    lines = [line for line in ENV_FILE.read_text().splitlines() if "=" in line and not line.lstrip().startswith("#")]
    pairs = (line.split("=", 1) for line in lines)
    return {k.strip(): v.strip().strip("'") for k, v in pairs}


def main() -> None:
    passcode = getpass.getpass("New 6-digit passcode (hidden): ")
    if not re.fullmatch(r"\d{6}", passcode):
        sys.exit("The passcode must be exactly 6 digits.")
    if getpass.getpass("Repeat it: ") != passcode:
        sys.exit("The passcodes don't match.")

    env = read_env()
    env["PASSCODE_HASH"] = hash_passcode(passcode)
    env.setdefault("SESSION_SECRET", secrets.token_urlsafe(32))
    # Single quotes stop docker compose from treating "$" in the hash as a variable.
    ENV_FILE.write_text("".join(f"{k}='{v}'\n" for k, v in env.items()))
    print(f"Saved to {ENV_FILE}. Restart the API: docker compose up -d api")


if __name__ == "__main__":
    main()
