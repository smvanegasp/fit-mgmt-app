"""The cue check: when Sergio writes a note about an exercise, an LLM (gpt-oss-120b on Groq) says
whether it should add a cue to the exercise's "Keep in mind" list or reword one. It only
suggests; nothing changes until Sergio accepts. It works only from Sergio's own words.

Needs GROQ_API_KEY (backend/.env locally, SSM /fit/GROQ_API_KEY on AWS); without it the check is
off and the app works as before.
"""

import json
import os

import httpx

from app.models import CueSuggestion, Exercise, Note

URL = "https://api.groq.com/openai/v1/chat/completions"

PROMPT = """You keep a lifter's technique checklist ("Keep in mind") for one exercise: short cues \
that make the lift go better when they remember them. You get the exercise, its current cues and \
a note the lifter wrote today (often in Spanish). Decide what the note means for the checklist:

- "none": the note is about how today went (numbers, fatigue, mood, a one-off), not a repeatable \
how-to. Most notes are this.
- "update": it refines, corrects or replaces one existing cue. Give that cue's id and the new \
wording.
- "add": it is a new, repeatable how-to that no cue covers yet.

Rules:
- Use only the lifter's own words and ideas. Never add advice, technique or detail that is not \
in the note or the existing cue.
- English, one short line in the imperative (under 80 characters), like the existing cues.
- section: "setup" (before the lift: warm-up, equipment, machine settings, position), "brace" \
(breathing, bracing) or "lift" (execution, tempo, focus).

Reply with JSON only: {"action": "none" | "update" | "add", "noteId": string | null, \
"text": string | null, "section": "setup" | "brace" | "lift" | null}"""


class CueCheckOff(Exception):
    """No GROQ_API_KEY: the feature is off."""


def enabled() -> bool:
    return bool(os.environ.get("GROQ_API_KEY"))


def _ask(messages: list[dict[str, str]]) -> str:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise CueCheckOff
    response = httpx.post(
        URL,
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"),
            "messages": messages,
            "response_format": {"type": "json_object"},
            "reasoning_effort": "low",
            "temperature": 0.2,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def check(exercise: Exercise, cues: list[Note], note: str) -> CueSuggestion:
    shown = [{"id": c.id, "section": c.section, "text": c.text} for c in cues if not c.hidden]
    user = json.dumps({"exercise": exercise.name, "cues": shown, "note": note}, ensure_ascii=False)
    raw = _ask([{"role": "system", "content": PROMPT}, {"role": "user", "content": user}])
    try:
        suggestion = CueSuggestion.model_validate_json(raw)
    except ValueError:
        return CueSuggestion(action="none")
    # Anything incomplete or pointing at a cue that doesn't exist is no suggestion.
    if suggestion.action != "none" and not (suggestion.text or "").strip():
        return CueSuggestion(action="none")
    if suggestion.action == "update" and suggestion.noteId not in {c["id"] for c in shown}:
        return CueSuggestion(action="none")
    if suggestion.action == "add":
        suggestion.noteId = None
    return suggestion
