"""Turn WhatsApp training messages into workouts, entries, sets, notes and photos.

The chat is free text written between sets, so parsing is heuristic. Anything the rules get
wrong is fixed in a corrections file (kept in private/, never in git) keyed by message time:

    {
      "start": "2025-09-05",                       # ignore everything before this day
      "messages": {
        "2025-09-13 11:00:00": null,               # drop the message
        "2025-09-13 10:54:55": "2x3. Weighted dips 36 kg. Last set 2 reps",   # rewrite it
        "2026-02-05 20:01:59": {"entries": [...]}  # give the entries directly
      },
      "textFixes": [["Muñecos fuertes u derechas", "Muñecas fuertes y derechas"]],

      "photos": {"00000333-PHOTO-...jpg": "drop" | "workout" | "<exerciseId>"},
      "technique": {"<exerciseId>": ["cue written once but worth keeping", ...]},
      "routines": [...]
    }

Output (all JSON-serializable, ready for app.importer.load):
    workouts:  one per training session (a day; a gap of 2h+ starts a new one)
    notes:     the technique log per exercise (repeated cues merged, first and last date)
    body:      body-weight entries
"""

import hashlib
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from app.catalog import BY_ID, EXERCISES
from app.importer.chat import Message

KG_TO_LB = 2.20462
SESSION_GAP = timedelta(hours=2)
# A note written on its own right after an exercise belongs to that exercise.
ATTACH_NOTE_WITHIN = timedelta(minutes=5)
# Photos sent within this window of an entry belong to it.
ATTACH_PHOTO_WITHIN = timedelta(minutes=15)
# Two photos sent this close together are the same shot sent twice; keep the first.
DUPLICATE_PHOTO_WITHIN = timedelta(seconds=5)

COLORS = {
    "negro": "black", "rosado": "pink", "morado": "purple", "purple": "purple", "blanco": "white",
    "azul": "blue", "verde": "green", "amarillo": "yellow", "amarillos": "yellow", "naranja": "orange",
}


# ---------------------------------------------------------------- text helpers


def normalize(text: str) -> str:
    """Lowercase, no accents, only letters/digits/spaces (so "Chin up’s" -> "chin up s")."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


_ALIASES = sorted(
    ((normalize(alias), ex.id) for ex in EXERCISES for alias in ex.aliases),
    key=lambda pair: -len(pair[0]),
)


def find_exercise(text: str) -> str | None:
    """The catalog exercise named in the text (longest alias wins), or None."""
    padded = f" {normalize(text)} "
    for alias, exercise_id in _ALIASES:
        if f" {alias} " in padded:
            return exercise_id
    return None


SET_RE = re.compile(r"(?<!\d)(?<!\d\.)(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)(?!\.?\d)(?!\s*(?:lbs?|kg|kbs|lab)\b)")
REPS_BY_WEIGHT_RE = re.compile(r"(?<![\d.])(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)\s*(lbs?|kg|kbs|lab)\b", re.I)
HOLD_RE = re.compile(r"(\d+)\s*[xX]\s*(\d+)\s*sec", re.I)
WEIGHT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(lbs?|lab|kbs|kg)\b", re.I)
PLUS_WEIGHT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:lbs?|kg)?\.?\s*\+\s*(\d+(?:\.\d+)?)\s*(lbs?|kg)\b", re.I)
# "(3x4 2 vez)": the target was hit twice. The lookbehind keeps "3x7 vez" from reading as 7 times.
TIMES_RE = re.compile(r"(?<![xX\d])(?<![xX]\s)(\d+)\s*ve(?:z|ces)\b", re.I)
DASH_SEQ_RE = re.compile(r"^\s*(\d+(?:\s*-\s*\d+){2,})\s*(?:\((.*)\))?\s*$")
DASH_WEIGHTS_IN_PARENS_RE = re.compile(r"(\d+)\s*lbs?\s*-\s*(\d+)\s*lbs?\s*-\s*(\d+)\s*lbs?\s*-\s*(\d+)\s*lbs?", re.I)
MPH_RE = re.compile(r"(\d+(?:\.\d+)?)\s*m[op]h\s+(\d+(?:\.\d+)?)\s*(min|sec)", re.I)
MILES_RE = re.compile(r"(\d+(?:\.\d+)?)\s*mi\b", re.I)
GRADE_RE = re.compile(r"\bV([0-9])\b")
COMPLEX_RE = re.compile(r"(\d+)\s*x\s*\(?\s*((?:\d+\s*(?:pull|muscle|dips?)\s*(?:and\s*)?){2,})\)?", re.I)
WORDS_ONLY_FILLER = {
    "lbs", "lb", "kg", "kbs", "lab", "barra", "bar", "each", "leg", "vez", "veces", "antes", "y",
    "x", "and", "last", "set", "sets", "con", "en", "el", "la", "de", "a", "with", "sin", "peso",
    "pull", "pulls", "up", "ups", "dip", "dips", "muscle", "mancuerna", "mancuernas", "dumbbell",
    "dumbbells", "mi", "grupo", "hold", "rep", "reps", "repes", "repea",
}


def to_lb(value: float, unit: str) -> float:
    lb = value * KG_TO_LB if unit.lower() == "kg" else value
    return round(lb * 2) / 2


def _num(text: str) -> float | int:
    value = float(text)
    return int(value) if value.is_integer() else value


# ---------------------------------------------------------------- output shapes


@dataclass
class Entry:
    exercise_id: str
    sets: list[dict[str, Any]] = field(default_factory=list)
    targets: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    photos: list[dict[str, str]] = field(default_factory=list)
    problems: list[dict[str, Any]] = field(default_factory=list)  # climbing
    segments: list[dict[str, Any]] = field(default_factory=list)  # running
    distance_mi: float | None = None
    raw: list[str] = field(default_factory=list)
    last_at: datetime | None = None

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {"exerciseId": self.exercise_id}
        notes = list(dict.fromkeys(self.notes))  # the same cue written twice in one session
        for key, value in (
            ("sets", self.sets), ("targets", self.targets), ("notes", notes),
            ("photos", self.photos), ("problems", self.problems), ("segments", self.segments),
        ):
            if value:
                out[key] = value
        if self.distance_mi is not None:
            out["distanceMi"] = self.distance_mi
        return out


@dataclass
class Session:
    started: datetime
    ended: datetime
    entries: list[Entry] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    photos: list[dict[str, str]] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)

    def entry_for(self, exercise_id: str, at: datetime) -> Entry:
        """Consecutive messages about the same exercise build one entry."""
        if self.entries and self.entries[-1].exercise_id == exercise_id:
            entry = self.entries[-1]
        else:
            entry = Entry(exercise_id)
            self.entries.append(entry)
        entry.last_at = at
        return entry

    @property
    def current(self) -> Entry | None:
        return self.entries[-1] if self.entries else None


# ---------------------------------------------------------------- lifting


def _split_targets(line: str) -> tuple[str, list[str], list[str]]:
    """Pull "(...)" groups out of a line. Groups with sets or "N vez" are the previous target
    ("(antes 4x4)", "(5x5 180 lbs 2 veces)"); other groups are notes ("(16 Pos)")."""
    # "...+barra. 5x5 180 lbs 3 veces)." has no opening parenthesis: the target starts at the
    # second set pattern.
    if line.count(")") > line.count("("):
        head = line.split(")")[0]
        weight = WEIGHT_RE.search(head)
        later = SET_RE.search(head, weight.end()) if weight else None
        if later:
            line = line[: later.start()] + "(" + line[later.start():]
    targets: list[str] = []
    notes: list[str] = []
    # "2x(3 pull 3 muscle 3 pull)": these parentheses group a complex, they aren't a comment.
    line = re.sub(r"(\d+\s*x)\s*\(([^()]*)\)", r"\1 \2", line, flags=re.I)

    def take(match: re.Match[str]) -> str:
        inner = match.group(1).strip()
        if SET_RE.search(inner) or TIMES_RE.search(inner) or re.search(r"\bantes\b", inner, re.I):
            targets.append(inner)
        elif inner:
            notes.append(inner)
        return " "

    line = re.sub(r"\(([^()]*)\)", take, line)
    return line, targets, notes


def _target_json(text: str) -> dict[str, Any]:
    times = TIMES_RE.search(text)
    out: dict[str, Any] = {"text": " ".join(text.split())}
    if times:
        out["times"] = int(times.group(1))
    return out


def _weights(segment: str) -> tuple[float | None, bool]:
    """(weight in lb, written per hand) from a segment; None when no weight is written."""
    each = bool(re.search(r"\beach\b|\bcada\b", segment, re.I))
    plus = PLUS_WEIGHT_RE.search(segment)
    if plus:
        unit = plus.group(3)
        return to_lb(float(plus.group(1)), unit) + to_lb(float(plus.group(2)), unit), each
    found = WEIGHT_RE.findall(segment)
    if found:
        value, unit = found[0]
        return to_lb(float(value), unit), each
    if re.search(r"free weight|sin peso|no weight", segment, re.I):
        return 0.0, each
    return None, each


def _fold(text: str) -> str:
    """Lowercase without accents, one character per character (so match positions line up)."""
    return "".join(unicodedata.normalize("NFKD", c)[0] for c in text).lower()


def _note_text(segment: str, exercise_id: str | None, keep_weights: bool = False) -> str | None:
    """What's left of a segment once sets, weights and the exercise name are taken out, when
    it reads like a note ("derecha supina inicio", "setup en 7")."""
    text = HOLD_RE.sub(" ", segment)
    text = REPS_BY_WEIGHT_RE.sub(" ", text)
    text = SET_RE.sub(" ", text)
    text = re.sub(r"\b\d+\s*rep\w*", " ", text, flags=re.I)
    if not keep_weights:
        text = WEIGHT_RE.sub(" ", text)
    text = re.sub(r"\+\s*barra?\b|\+\s*bar\b|\beach\b( leg)?", " ", text, flags=re.I)
    if exercise_id:
        for alias in sorted(BY_ID[exercise_id].aliases, key=len, reverse=True):
            pattern = re.escape(alias).replace(r"\ ", r"[\s.’']*")
            for match in reversed(list(re.finditer(pattern, _fold(text)))):
                text = text[: match.start()] + " " + text[match.end():]
    text = re.sub(r"(\s*\.\s*){2,}", ". ", text)  # dots left behind by removed sets
    text = re.sub(r"^[\s.,:;+\-]+|[\s.,:;+\-]+$", "", " ".join(text.split()))
    words = [w for w in normalize(text).split() if w not in WORDS_ONLY_FILLER and not w.isdigit()]
    if len(" ".join(words)) < 4 or find_exercise(text) and normalize(text) in {a for a, _ in _ALIASES}:
        return None
    return text


def parse_sets(segment: str, exercise_id: str | None) -> list[dict[str, Any]]:
    """Sets written in one segment: "3x5", "1x8 1x7 1x4", "13x100 lbs", "2x7 sec hold"."""
    exercise = BY_ID.get(exercise_id or "")
    weight, each = _weights(segment)
    sets: list[dict[str, Any]] = []

    def add(count: int, reps: float | None, w: float | None, **extra: Any) -> None:
        for _ in range(count):
            s: dict[str, Any] = {}
            if reps is not None:
                s["reps"] = _num(str(reps))
            if w is not None and exercise and exercise.load not in ("bodyweight", "none"):
                s["weightLb"] = _num(str(w))
            if each and exercise and exercise.load == "dumbbell":
                s["each"] = True
            s.update(extra)
            sets.append(s)

    complex_ = COMPLEX_RE.search(segment)
    if complex_:
        moves = re.findall(r"(\d+)\s*(pull|muscle|dips?)", complex_.group(2), re.I)
        detail = " + ".join(f"{n} {m.lower().rstrip('s')}" for n, m in moves)
        add(int(complex_.group(1)), sum(int(n) for n, _ in moves), None, detail=detail)
        return sets
    for match in HOLD_RE.finditer(segment):
        add(int(match.group(1)), None, None, seconds=int(match.group(2)))
    if sets:
        return sets
    for match in REPS_BY_WEIGHT_RE.finditer(segment):
        add(1, float(match.group(1)), to_lb(float(match.group(2)), match.group(3)))
    stripped = REPS_BY_WEIGHT_RE.sub(" ", segment)
    for match in SET_RE.finditer(stripped):
        add(int(match.group(1)), float(match.group(2)), weight)
    if not sets:
        # "Squats 1x16 90 lbs" is covered above; "16 repea 90 lbs" / "90 lbs al fallo 16 repes"
        reps = re.search(r"(\d+)\s*rep(?:e|ea|es|s)?\b", segment, re.I)
        # "Aumentamos volumen 1 rep" / "Last volume 16 rep" are comments, not sets.
        if reps and (weight is not None or find_exercise(segment)) and not re.search(r"volum", segment, re.I):
            add(1, float(reps.group(1)), weight)
    return sets


# ---------------------------------------------------------------- climbing and running


def parse_climb(text: str) -> list[dict[str, Any]]:
    """ "V1. 1 negro\nV2 1 rosado" / "V3 morado nuevo fail 3" / "V3 azul done"."""
    problems: list[dict[str, Any]] = []
    matches = list(GRADE_RE.finditer(text))
    for i, match in enumerate(matches):
        chunk = text[match.end(): matches[i + 1].start() if i + 1 < len(matches) else len(text)]
        words = normalize(chunk)
        problem: dict[str, Any] = {"grade": f"V{match.group(1)}"}
        color = next((COLORS[w] for w in words.split() if w in COLORS), None)
        if color:
            problem["color"] = color
        failed = re.search(r"\b(fail|pendiente|almost|falta|llegue|dificil|debo)\b", words)
        number = re.search(r"\b(\d+)\b", words)
        if failed:
            problem["result"] = "attempted"
            fail_count = re.search(r"fail (\d+)", words)
            if fail_count:
                problem["attempts"] = int(fail_count.group(1))
        else:
            problem["result"] = "sent"
            problem["count"] = int(number.group(1)) if number else 1
        note = re.sub(r"^[\s.,:-]+|[\s.,:-]+$", "", " ".join(chunk.split()))
        if note and not re.fullmatch(r"\d+\.?", note):
            problem["note"] = note
        problems.append(problem)
    return problems


def parse_run(text: str) -> tuple[list[dict[str, Any]], float | None]:
    segments = [
        {"mph": _num(m.group(1)), "minutes": _num(m.group(2)) if m.group(3).lower() == "min"
         else round(float(m.group(2)) / 60, 2)}
        for m in MPH_RE.finditer(text)
    ]
    miles = MILES_RE.search(text)
    return segments, (float(miles.group(1)) if miles else None)


# ---------------------------------------------------------------- dropsets


def _dash(seq: str) -> list[int]:
    return [int(n) for n in re.findall(r"\d+", seq)]


def parse_dropset(text: str) -> tuple[list[dict[str, Any]], list[str]] | None:
    """Ladders like "90-70-45-25-0" (weights) with "4-3-3-3-4" (reps), in either order, or reps
    with the weights in parentheses ("5-5-5-7 (70 lbs-45 lbs- 25 lbs - 0 lbs)")."""
    seqs: list[tuple[list[int], str | None]] = []
    for line in text.splitlines():
        match = DASH_SEQ_RE.match(line.replace("–", "-"))
        if match:
            seqs.append((_dash(match.group(1)), match.group(2)))
    if not seqs:
        return None
    weights: list[int] | None = None
    reps: list[int] | None = None
    targets: list[str] = []
    for seq, paren in seqs:
        is_weights = seq[0] >= 20 and seq[-1] == 0 and seq == sorted(seq, reverse=True)
        if is_weights:
            weights = seq
        else:
            reps = seq
            if paren:
                in_paren = DASH_WEIGHTS_IN_PARENS_RE.search(paren)
                if in_paren:
                    weights = weights or [int(n) for n in in_paren.groups()]
                    before = paren[: in_paren.start()].strip()
                    if before:
                        targets.append(before)
                else:
                    targets.append(paren)
    if not weights or not reps:
        return None
    sets = [
        {"reps": r, "weightLb": w, "drop": True}
        for w, r in zip(weights, reps)
        if r > 0
    ]
    return sets, targets


# ---------------------------------------------------------------- per message


def _lifting(session: Session, message: Message, text: str) -> bool:
    """Parse a lifting message into the session; False when nothing was understood."""
    understood = False
    drop = parse_dropset(text)
    lines = text.splitlines()
    if drop:
        lines = [l for l in lines if not DASH_SEQ_RE.match(l.replace("–", "-")) and normalize(l) != "dropset"]

    current: str | None = None
    for line in lines:
        if not line.strip():
            continue
        line, targets, paren_notes = _split_targets(line)
        segments = [s for s in re.split(r"\s+-\s+", line) if s.strip()]
        for segment in segments:
            exercise_id = find_exercise(segment)
            if COMPLEX_RE.search(segment):
                exercise_id = "muscle-up-complex"
            sets = parse_sets(segment, exercise_id or current or (session.current.exercise_id if session.current else None))
            if (
                sets and not exercise_id and not current and session.current and session.current.sets
                and all("weightLb" not in s for s in sets)
                and BY_ID[session.current.exercise_id].load not in ("bodyweight", "none")
                and "weightLb" in session.current.sets[-1]
            ):
                # A follow-up like "1x6 last again" or "Ulyima 1x4" repeats the last weight.
                for s in sets:
                    s["weightLb"] = session.current.sets[-1]["weightLb"]
                    if session.current.sets[-1].get("each"):
                        s["each"] = True
            if exercise_id and not sets and (current or session.current) and _note_text(segment, exercise_id):
                # "Con confianza como en fondos, fuerza a mil" names an exercise inside a
                # sentence: it's a note for the exercise being logged, not a new one.
                exercise_id = None
            if exercise_id:
                current = exercise_id
            target_id = exercise_id or current
            if sets and not target_id and session.current:
                target_id = session.current.exercise_id
                session.flags.append(f"{message.key}: sets without an exercise, added to {target_id}: {segment!r}")
            if not target_id:
                continue
            if sets or exercise_id:
                entry = session.entry_for(target_id, message.at)
                entry.sets.extend(sets)
                entry.raw.append(segment.strip())
                understood = True
                note = _note_text(segment, exercise_id)
                if note:
                    entry.notes.append(note)
            elif session.current and session.current.exercise_id == target_id:
                # A line of words under an exercise ("Leg drift always.") is a note for it.
                note = _note_text(segment, None, keep_weights=True)
                if note:
                    session.current.notes.append(note)
                    understood = True
        entry = session.current if (current or session.current) else None
        if entry is not None:
            entry.targets.extend(_target_json(t) for t in targets)
            entry.notes.extend(n for n in paren_notes if _note_text(n, None, keep_weights=True))

    if drop:
        sets, targets = drop
        # The ladder comes after the main sets and belongs to the weighted exercise just logged
        # (dips, chin-ups).
        exercise_id = current
        if not exercise_id:
            recent = [e for e in session.entries if BY_ID[e.exercise_id].load == "added"]
            exercise_id = recent[-1].exercise_id if recent else (session.current.exercise_id if session.current else None)
        if exercise_id and sets:
            entry = session.entry_for(exercise_id, message.at)
            entry.sets.extend(sets)
            entry.targets.extend({"text": t, "kind": "dropset"} for t in targets)
            understood = True
    return understood


def _is_duplicate_photo(session: Session, message: Message) -> bool:
    """The same shot sent twice in a row (WhatsApp often attaches each photo twice)."""
    last = session.messages[-2] if len(session.messages) > 1 else None
    return (
        last is not None and bool(last.attachment) and last.attachment != message.attachment
        and message.at - last.at <= DUPLICATE_PHOTO_WITHIN
        and (last.text or "") == (message.text or "")
    )


def _apply_photo(session: Session, message: Message, choice: str | None) -> None:
    photo = {"file": message.attachment or ""}
    if message.text:
        photo["caption"] = message.text
    previous = session.photos + [p for e in session.entries for p in e.photos]
    last = session.messages[-2] if len(session.messages) > 1 else None
    if _is_duplicate_photo(session, message) and any(p["file"] == last.attachment for p in previous):
        return
    if choice == "workout":
        session.photos.append(photo)
        return
    if choice and choice in BY_ID:
        session.entry_for(choice, message.at).photos.append(photo)
        return
    near = [e for e in session.entries if e.last_at and abs(message.at - e.last_at) <= ATTACH_PHOTO_WITHIN]
    if near:
        min(near, key=lambda e: abs(message.at - e.last_at)).photos.append(photo)
    else:
        session.photos.append(photo)


def handle_message(session: Session, message: Message, corrections: dict[str, Any]) -> None:
    text = message.text
    if message.attachment:
        choice = corrections.get("photos", {}).get(message.attachment)
        if choice != "drop" and re.search(r"\.(jpe?g|png)$", message.attachment, re.I):
            if GRADE_RE.search(text) and not _is_duplicate_photo(session, message):
                # "V3. Agarre blanco." under a route photo is a problem tried that day.
                entry = session.entry_for("bouldering", message.at)
                entry.problems.extend(parse_climb(text))
                choice = choice or "bouldering"
            _apply_photo(session, message, choice)
        return
    if not text:
        return
    if re.search(r"my weight", text, re.I):
        weight = WEIGHT_RE.search(text)
        if weight:
            session.notes.append(f"Body weight {weight.group(0)}")
        return
    if GRADE_RE.search(text):
        # Climbing lines go to the bouldering entry; a lifting line in the same message
        # ("Pull ups wide. 3x10.") is parsed as usual.
        climb, rest = [], []
        for line in text.splitlines():
            (rest if not GRADE_RE.search(line) and SET_RE.search(line) else climb).append(line)
        entry = session.entry_for("bouldering", message.at)
        entry.problems.extend(parse_climb("\n".join(climb)))
        entry.raw.append(text)
        if rest:
            _lifting(session, message, "\n".join(rest))
        return
    segments, miles = parse_run(text)
    if segments or (miles is not None and session.current and session.current.exercise_id == "treadmill"):
        entry = session.entry_for("treadmill", message.at)
        entry.segments.extend(segments)
        if miles is not None:
            entry.distance_mi = miles
        entry.raw.append(text)
        return
    if _lifting(session, message, text):
        return
    # Words on their own: a note for the exercise just logged, or for the session.
    current = session.current
    if current and current.last_at and message.at - current.last_at <= ATTACH_NOTE_WITHIN:
        current.notes.append(text)
    elif current and current.exercise_id == "bouldering":
        current.notes.append(text)
    else:
        session.notes.append(text)


# ---------------------------------------------------------------- whole chat


def _entries_from_json(session: Session, message: Message, entries: list[dict[str, Any]]) -> None:
    for data in entries:
        entry = session.entry_for(data["exerciseId"], message.at)
        entry.sets.extend(data.get("sets", []))
        entry.targets.extend(data.get("targets", []))
        entry.notes.extend(data.get("notes", []))
        entry.problems.extend(data.get("problems", []))
        entry.segments.extend(data.get("segments", []))
        if "distanceMi" in data:
            entry.distance_mi = data["distanceMi"]


def label_for(entries: list[Entry]) -> str:
    """A short name for the session from its main lifting group (most sets), plus climbing /
    running."""
    groups = {
        "Push": {"dips", "bench-press", "smith-bench-press", "dumbbell-bench-press", "overhead-press", "bar-dips"},
        "Squat": {"squat", "smith-squat", "pistol-squat"},
        "Deadlift": {"deadlift", "rdl", "reverse-leg-curl"},
        "Pull": {"chin-ups", "pull-ups", "muscle-up-complex", "wide-pull-ups", "close-pull-ups", "french-chin-ups"},
        "Front lever": {"front-raise", "full-front-raise", "advanced-tuck-hold", "half-tuck-front-lever-raise",
                        "l-sit-tuck-planche", "high-pull-ups"},
    }
    parts: list[str] = []
    sets_per_group: dict[str, int] = {}
    for entry in entries:
        name = next((g for g, ids in groups.items() if entry.exercise_id in ids), None)
        if name:
            sets_per_group[name] = sets_per_group.get(name, 0) + len(entry.sets)
    if sets_per_group:
        # Ties go to the group logged first (dicts keep insertion order).
        parts.append(max(sets_per_group, key=lambda g: sets_per_group[g]))
    if any(e.exercise_id == "bouldering" for e in entries):
        parts.append("Climb")
    if any(e.exercise_id == "treadmill" for e in entries):
        parts.append("Run")
    if not parts and entries:
        parts.append(BY_ID[entries[0].exercise_id].name)
    return " + ".join(parts) or "Workout"


def _cues(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!])\s+|\n+", text)
    return [p.strip(" .") for p in parts if len(normalize(p)) >= 8]


def _note_id(exercise_id: str, text: str) -> str:
    return hashlib.sha1(f"{exercise_id}|{normalize(text)}".encode()).hexdigest()[:12]


def parse_messages(messages: list[Message], corrections: dict[str, Any] | None = None) -> dict[str, Any]:
    corrections = corrections or {}
    start = date.fromisoformat(corrections.get("start", "1970-01-01"))
    rewrites = corrections.get("messages", {})
    # Typos fixed everywhere before parsing: [["Muñecos fuertes", "Muñecas fuertes"], ...], in order.
    text_fixes: list[list[str]] = corrections.get("textFixes", [])

    sessions: list[Session] = []
    for message in messages:
        if message.at.date() < start:
            continue
        text = message.text or ""
        if not message.attachment and ("deleted this message" in text or re.fullmatch(r"https?://\S+", text)):
            continue
        if message.key in rewrites:
            fix = rewrites[message.key]
            if fix is None:
                continue
            if isinstance(fix, str):
                message = Message(message.at, message.sender, fix, message.attachment)
        if message.text and text_fixes:
            fixed = message.text
            for wrong, right in text_fixes:
                fixed = fixed.replace(wrong, right)
            message = Message(message.at, message.sender, fixed, message.attachment)
        last = sessions[-1] if sessions else None
        if last is None or message.at.date() != last.ended.date() or message.at - last.ended > SESSION_GAP:
            last = Session(started=message.at, ended=message.at)
            sessions.append(last)
        last.ended = message.at
        last.messages.append(message)
        fix = rewrites.get(message.key)
        if isinstance(fix, dict):
            _entries_from_json(last, message, fix.get("entries", []))
            last.notes.extend(fix.get("notes", []))
            choice = corrections.get("photos", {}).get(message.attachment or "")
            if message.attachment and choice != "drop":
                _apply_photo(last, message, choice)
        else:
            handle_message(last, message, corrections)

    sessions = [s for s in sessions if s.entries]
    workouts: list[dict[str, Any]] = []
    flags: list[str] = []
    per_day: dict[str, int] = defaultdict(int)
    cue_log: dict[tuple[str, str], dict[str, Any]] = {}
    body: list[dict[str, Any]] = []

    for session in sessions:
        day = session.started.date().isoformat()
        per_day[day] += 1
        workout_id = f"{day}-{per_day[day]}"
        for note in list(session.notes):
            weight = re.match(r"Body weight (\d+(?:\.\d+)?)\s*(kg|lbs?)", note, re.I)
            if weight:
                body.append({"date": day, "weightLb": to_lb(float(weight.group(1)), weight.group(2)),
                             "raw": note.removeprefix("Body weight ")})
                session.notes.remove(note)
        for entry in session.entries:
            for note in entry.notes:
                for cue in _cues(note):
                    key = (entry.exercise_id, normalize(cue))
                    seen = cue_log.setdefault(key, {
                        "id": _note_id(entry.exercise_id, cue), "exerciseId": entry.exercise_id,
                        "text": cue, "date": day, "lastSeen": day, "sessions": set(),
                    })
                    seen["lastSeen"] = day
                    seen["sessions"].add(workout_id)
        flags.extend(f"{workout_id} {f}" for f in session.flags)
        workouts.append({
            "id": workout_id,
            "date": day,
            "startedAt": session.started.isoformat(),
            "endedAt": session.ended.isoformat(),
            "durationEstimated": True,
            "label": label_for(session.entries),
            "source": "whatsapp",
            "notes": session.notes,
            "photos": session.photos,
            "entries": [e.to_json() for e in session.entries],
            "raw": [{"at": m.at.isoformat(), "text": m.text, "attachment": m.attachment} for m in session.messages],
        })

    # Technique log: cues written in two or more sessions, plus the ones picked by hand.
    picked = {(ex, normalize(t)): t for ex, texts in corrections.get("technique", {}).items() for t in texts}
    # Repeated session comments ("Last volume", "entreno de retomar") stay on their workouts only.
    excluded = {(ex, normalize(t)) for ex, texts in corrections.get("notTechnique", {}).items() for t in texts}
    notes = []
    for key, cue in cue_log.items():
        if key in excluded:
            continue
        if len(cue["sessions"]) >= 2 or key in picked:
            notes.append({**cue, "sessions": len(cue["sessions"])})
    for (exercise_id, norm), text in picked.items():
        if (exercise_id, norm) not in cue_log:
            flags.append(f"technique cue not found in the chat for {exercise_id}: {text!r}")
    notes.sort(key=lambda n: (n["exerciseId"], n["date"]))

    return {
        "workouts": workouts,
        "notes": notes,
        "body": body,
        "routines": corrections.get("routines", []),
        "flags": flags,
    }
