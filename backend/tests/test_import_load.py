"""WhatsApp import: writing parsed data to DynamoDB and S3 (moto)."""

import io
from pathlib import Path

from PIL import Image

from app import db, storage
from app.importer.load import load

PHOTO = "00000143-PHOTO-2025-11-12-19-46-05.jpg"


def parsed(entries_sets: int = 2) -> dict:
    return {
        "workouts": [{
            "id": "2025-11-12-1", "date": "2025-11-12", "startedAt": "2025-11-12T19:23:20",
            "endedAt": "2025-11-12T19:59:57", "durationEstimated": True, "label": "Push", "source": "whatsapp",
            "notes": [], "photos": [],
            "entries": [{"exerciseId": "bench-press", "sets": [{"reps": 4, "weightLb": 70}] * entries_sets,
                         "photos": [{"file": PHOTO, "caption": "Safety bars"}]}],
            "raw": [{"at": "2025-11-12T19:46:01", "text": "private chat text", "attachment": None}],
        }],
        "notes": [{"id": "abc", "exerciseId": "bench-press", "date": "2025-11-12", "lastSeen": "2026-01-01",
                   "sessions": 3, "text": "Leg drift always"}],
        "body": [{"date": "2025-10-25", "weightLb": 149.5, "raw": "67.8 kg"}],
        "routines": [{"id": "r1", "name": "4-day rotation", "from": "2025-09-05", "to": None, "days": ["Push"]}],
        "flags": [],
    }


def photos_dir(tmp_path: Path) -> Path:
    image = Image.new("RGB", (3000, 2000), "green")
    buffer = io.BytesIO()
    image.save(buffer, "JPEG")
    (tmp_path / PHOTO).write_bytes(buffer.getvalue())
    return tmp_path


def test_load_writes_rows_and_resized_photos(tmp_path: Path) -> None:
    result = load(parsed(), "main", photos_dir(tmp_path))
    assert result["workouts"] == 1 and result["photos"] == 1

    workout = db.get("main", "WORKOUT#2025-11-12#2025-11-12-1")
    assert workout["entries"][0]["photos"] == [{"key": "main/wa-00000143", "caption": "Safety bars"}]
    assert "raw" not in workout  # the chat text itself never goes to the database
    assert db.get("main", "NOTE#bench-press#2025-11-12#abc")["text"] == "Leg drift always"
    assert db.get("main", "BODY#2025-10-25")["weightLb"] == 149.5
    assert db.get("main", "ROUTINE#2025-09-05#r1")["name"] == "4-day rotation"
    assert db.get("main", "EXERCISE#bench-press")["barLb"] == 45

    full, _ = storage.get("main/wa-00000143.img")
    thumb, _ = storage.get("main/wa-00000143-thumb.img")
    assert max(Image.open(io.BytesIO(full)).size) == 1600
    assert max(Image.open(io.BytesIO(thumb)).size) == 400


def test_loading_again_replaces_the_import_but_keeps_app_workouts(tmp_path: Path) -> None:
    folder = photos_dir(tmp_path)
    load(parsed(), "main", folder)
    db.put("main", "WORKOUT#2026-11-01#app-1", {"id": "app-1", "source": "app"})
    db.put("main", "WORKOUT#2025-01-01#old", {"id": "old", "source": "whatsapp"})

    load(parsed(entries_sets=3), "main", folder)

    workouts = {w["id"]: w for w in db.query("main", "WORKOUT#")}
    assert set(workouts) == {"2025-11-12-1", "app-1"}  # the stale import row is gone
    assert len(workouts["2025-11-12-1"]["entries"][0]["sets"]) == 3


def test_loading_again_keeps_cue_choices_made_in_the_app(tmp_path: Path) -> None:
    folder = photos_dir(tmp_path)
    load(parsed(), "main", folder)
    sk = "NOTE#bench-press#2025-11-12#abc"
    db.put("main", sk, {**db.get("main", sk), "hidden": True, "section": "lift", "rank": 2})
    load(parsed(), "main", folder)
    row = db.get("main", sk)
    assert (row["hidden"], row["section"], row["rank"]) == (True, "lift", 2)
    # A placement in the corrections wins.
    data = parsed()
    data["notes"][0] |= {"section": "setup", "rank": 1}
    load(data, "main", folder)
    row = db.get("main", sk)
    assert (row["hidden"], row["section"], row["rank"]) == (True, "setup", 1)
