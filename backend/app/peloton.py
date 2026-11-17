"""Reading a Peloton class from its summary screenshot (Sergio, 2026-11-17: "I just want to add a
photo"). A vision model on Groq (qwen/qwen3.8-27b by default, PELOTON_MODEL to change it) returns
the stats as JSON; each field is kept only if it's valid. Needs GROQ_API_KEY, like the cue check.

The date on the screen is not read: in a test the model read "11/1/26" as Nov 12. A class belongs
to the workout it's added to, which has its own date.
"""

import base64
import json
import os

import httpx
from pydantic import ValidationError

from app.models import Peloton

URL = "https://api.groq.com/openai/v1/chat/completions"
FIELDS = list(Peloton.model_fields)

PROMPT = (
    "This is a Peloton workout summary screenshot. Return only a JSON object with these keys, "
    "null for anything the screen doesn't show: discipline (cycling, running, walking, rowing...), "
    "title (the class name, e.g. \"60 min Reggaeton Ride\"), instructor (as written, in normal capitalization), "
    "minutes (the class length in minutes), outputKj (Total Output in kJ), distanceMi (miles), calories (kcal), "
    "avgWatts (Avg Output in watts), avgCadence (rpm), avgResistance (percent), avgSpeedMph. Numbers as numbers."
)


class PelotonOff(Exception):
    """No GROQ_API_KEY: reading is off (the photo is still saved)."""


def read(image: bytes) -> Peloton:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise PelotonOff
    data = base64.b64encode(image).decode()
    response = httpx.post(
        URL,
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": os.environ.get("PELOTON_MODEL", "qwen/qwen3.8-27b"),
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{data}"}},
            ]}],
        },
        timeout=45,
    )
    response.raise_for_status()
    return parse(response.json()["choices"][0]["message"]["content"])


def parse(raw: str) -> Peloton:
    """The model's JSON -> Peloton, keeping each valid field and dropping the rest."""
    try:
        found = json.loads(raw)
    except ValueError:
        return Peloton()
    if not isinstance(found, dict):
        return Peloton()
    kept = {}
    for name in FIELDS:
        value = found.get(name)
        if value in (None, ""):
            continue
        try:
            kept[name] = getattr(Peloton.model_validate({name: value}), name)
        except ValidationError:
            continue
    return Peloton(**kept)
