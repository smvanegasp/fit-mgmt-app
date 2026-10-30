"""Write a parsed WhatsApp import (app.importer.parse) into DynamoDB and S3.

Rows (pk = SPACE#<space>):
    EXERCISE#<id>                          the catalog exercises
    WORKOUT#<yyyy-mm-dd>#<workoutId>       one per session, entries embedded
    NOTE#<exerciseId>#<yyyy-mm-dd>#<id>    the technique log
    BODY#<yyyy-mm-dd>                      body weight
    ROUTINE#<from>#<id>                    routine eras

Ids come from dates, message times and photo file names, so loading again rewrites the same
rows. Rows from an earlier import that are no longer produced (after a correction) are deleted;
rows the app created (source "app") are never touched.
"""

import io
from pathlib import Path
from typing import Any

from app import db, storage
from app.catalog import EXERCISES

PHOTO_MAX = 1600
THUMB_MAX = 400
IMPORTED_PREFIXES = ("WORKOUT#", "NOTE#", "BODY#", "ROUTINE#")


def exercise_rows() -> dict[str, dict[str, Any]]:
    return {
        f"EXERCISE#{e.id}": {
            "id": e.id, "name": e.name, "group": e.group, "load": e.load, "measure": e.measure,
            "barLb": e.bar_lb, "aliases": list(e.aliases), "source": "catalog",
        }
        for e in EXERCISES
    }


def _resize(data: bytes, size: int) -> bytes:
    from PIL import Image, ImageOps  # dev dependency: only the importer resizes photos

    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    image.thumbnail((size, size))
    out = io.BytesIO()
    image.save(out, "JPEG", quality=82, optimize=True)
    return out.getvalue()


def photo_key(space: str, file: str) -> str:
    """ "00000143-PHOTO-2025-11-12-19-46-05.jpg" -> "<space>/wa-00000143" (same shape as app photos)."""
    return f"{space}/wa-{file.split('-')[0]}"


def upload_photo(space: str, photos_dir: Path, file: str) -> str:
    key = photo_key(space, file)
    data = (photos_dir / file).read_bytes()
    storage.put(f"{key}.img", _resize(data, PHOTO_MAX), "image/jpeg")
    storage.put(f"{key}-thumb.img", _resize(data, THUMB_MAX), "image/jpeg")
    return key


def build_rows(parsed: dict[str, Any], space: str) -> tuple[dict[str, dict[str, Any]], set[str]]:
    """The rows to write, and the photo files they reference."""
    files: set[str] = set()

    def photos(items: list[dict[str, str]]) -> list[dict[str, str]]:
        out = []
        for p in items:
            files.add(p["file"])
            out.append({"key": photo_key(space, p["file"]), **({"caption": p["caption"]} if p.get("caption") else {})})
        return out

    rows: dict[str, dict[str, Any]] = {}
    for w in parsed["workouts"]:
        entries = []
        for e in w["entries"]:
            entry = {k: v for k, v in e.items() if k != "photos"}
            if e.get("photos"):
                entry["photos"] = photos(e["photos"])
            entries.append(entry)
        rows[f"WORKOUT#{w['date']}#{w['id']}"] = {
            "id": w["id"], "date": w["date"], "startedAt": w["startedAt"], "endedAt": w["endedAt"],
            "durationEstimated": w["durationEstimated"], "label": w["label"], "source": "whatsapp",
            **({"durationMin": w["durationMin"]} if w.get("durationMin") is not None else {}),
            "notes": w["notes"], "photos": photos(w["photos"]), "entries": entries,
        }
    for n in parsed["notes"]:
        rows[f"NOTE#{n['exerciseId']}#{n['date']}#{n['id']}"] = {
            "id": n["id"], "exerciseId": n["exerciseId"], "date": n["date"], "lastSeen": n["lastSeen"],
            "sessions": n["sessions"], "text": n["text"], "source": "whatsapp",
            **({"original": n["original"]} if n.get("original") else {}),
        }
    for b in parsed["body"]:
        rows[f"BODY#{b['date']}"] = {"date": b["date"], "weightLb": b["weightLb"], "source": "whatsapp"}
    for r in parsed["routines"]:
        row = {k: v for k, v in r.items() if k != "photo"}
        if r.get("photo"):
            row["photos"] = photos([{"file": r["photo"]}])
        rows[f"ROUTINE#{r['from']}#{r['id']}"] = {**row, "source": "whatsapp"}
    return rows, files


def load(parsed: dict[str, Any], space: str, photos_dir: Path) -> dict[str, int]:
    rows, files = build_rows(parsed, space)
    for file in sorted(files):
        upload_photo(space, photos_dir, file)
    stale = [
        sk
        for prefix in IMPORTED_PREFIXES
        for sk, data in db.keys(space, prefix)
        if data.get("source") == "whatsapp" and sk not in rows
    ]
    db.delete_many(space, stale)
    db.put_many(space, {**exercise_rows(), **rows})
    return {
        "workouts": len(parsed["workouts"]),
        "notes": len(parsed["notes"]),
        "body": len(parsed["body"]),
        "routines": len(parsed["routines"]),
        "photos": len(files),
        "stale rows deleted": len(stale),
    }
