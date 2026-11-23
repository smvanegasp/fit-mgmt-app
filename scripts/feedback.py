"""Read the feedback left in the app (Settings or the demo banner), for the start of a session.

Run from the repo root:
  cd backend && uv run python ../scripts/feedback.py            # new feedback on AWS (profile gym)
  cd backend && uv run python ../scripts/feedback.py --local    # the docker compose stack
  cd backend && uv run python ../scripts/feedback.py --all      # include feedback already handled
  cd backend && uv run python ../scripts/feedback.py --done <id> [<id> ...]   # mark handled

Screenshots attached to feedback are saved to private/feedback/ (git-ignored) to look at.

Feedback is private (guests may write anything): paraphrase it in commits, PRs and docs, never
quote it. Nothing secret is printed.
"""

import argparse
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--local", action="store_true", help="the docker compose stack")
    parser.add_argument("--profile", default="gym", help="AWS profile")
    parser.add_argument("--all", action="store_true", help="include feedback marked done")
    parser.add_argument("--done", nargs="+", metavar="ID", help="mark these as handled")
    args = parser.parse_args()
    # Windows terminals default to a legacy code page; feedback can hold accents and emoji.
    sys.stdout.reconfigure(encoding="utf-8")

    if args.local:
        os.environ.update(DYNAMODB_ENDPOINT="http://localhost:8010", S3_ENDPOINT="http://localhost:9190",
                          AWS_ACCESS_KEY_ID="local", AWS_SECRET_ACCESS_KEY="local", PHOTOS_BUCKET="fit-photos")
    else:
        os.environ["AWS_PROFILE"] = args.profile
        os.environ.setdefault("PHOTOS_BUCKET", f"fit-photos-{_account(args.profile)}")
    os.environ.setdefault("AWS_REGION", "us-east-1")
    os.environ.setdefault("TABLE_NAME", "fit")

    from app import db, storage
    from app.sandbox import FEEDBACK_SPACE

    rows = db.keys(FEEDBACK_SPACE, "FEEDBACK#")
    if args.done:
        wanted = set(args.done)
        for sk, row in rows:
            if row.get("id") in wanted:
                db.put(FEEDBACK_SPACE, sk, {**row, "status": "done"})
                print(f"Marked done: {row['id']}")
                wanted.discard(row["id"])
        for missing in sorted(wanted):
            print(f"Not found: {missing}")
        return

    shown = [row for _, row in reversed(rows) if args.all or row.get("status") != "done"]
    where = "local" if args.local else f"AWS profile {args.profile}"
    print(f"{len(shown)} {'feedback items' if args.all else 'new feedback items'} ({where})\n")
    for row in shown:
        print(f"[{row['id']}] {row['createdAt'][:16]} · {row['role']} · {row.get('page') or 'no screen'} · {row.get('status')}")
        print(f"  {row['text']}")
        for key in row.get("photos", []):
            print(f"  screenshot: {save_photo(storage, key)}")
        print()


SAVED = Path(__file__).resolve().parent.parent / "private" / "feedback"


def save_photo(storage, key: str) -> str:
    """Download a feedback screenshot to private/feedback/ (git-ignored) and say where it is."""
    found = storage.get(f"{key}.img")
    if found is None:
        return f"{key} (missing)"
    SAVED.mkdir(parents=True, exist_ok=True)
    path = SAVED / f"{key.split('/')[-1]}.jpg"
    path.write_bytes(found[0])
    return str(path)


def _account(profile: str) -> str:
    import boto3

    return boto3.Session(profile_name=profile).client("sts").get_caller_identity()["Account"]


if __name__ == "__main__":
    main()
