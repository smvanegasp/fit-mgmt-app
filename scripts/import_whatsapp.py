"""Import the WhatsApp training log (stage 1).

Everything this script reads or writes about the chat stays in the git-ignored private/ folder:

    private/export/_chat.txt          the WhatsApp export, unzipped (with its photos)
    private/corrections.json          hand fixes for messages the rules can't read (optional)
    private/note_translations.json    English for the notes, captions and climbing notes
    private/import/parsed.json        the result: workouts, technique notes, body weight
    private/import/review.html        each session's messages next to what was parsed

Run from the repo root:
    cd backend && uv run python ../scripts/import_whatsapp.py parse
    cd backend && uv run python ../scripts/import_whatsapp.py load --local
    cd backend && uv run python ../scripts/import_whatsapp.py load --profile gym --table fit   (stage 7)

`load` is idempotent: ids come from the dates and photo file names, so running it again
overwrites the same rows instead of adding copies.
"""

import argparse
import html
import json
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.catalog import BY_ID  # noqa: E402
from app.importer.chat import read_chat  # noqa: E402
from app.importer.parse import parse_messages, translate_texts  # noqa: E402

PRIVATE = ROOT / "private"
EXPORT = PRIVATE / "export"
OUT = PRIVATE / "import"


def describe_sets(sets: list[dict]) -> str:
    """ "5x5 @ 170, 3x8 @ 150" style summary for the review page."""
    groups: list[list] = []
    for s in sets:
        key = (s.get("reps"), s.get("weightLb"), s.get("seconds"), s.get("drop"), s.get("detail"), s.get("each"))
        if groups and groups[-1][0] == key:
            groups[-1][1] += 1
        else:
            groups.append([key, 1])
    parts = []
    for (reps, weight, seconds, drop, detail, each), n in groups:
        text = f"{n}x{seconds}s" if seconds else f"{n}x{reps}"
        if weight is not None:
            text += f" @ {weight}{' each' if each else ''}"
        if drop:
            text += " (drop)"
        if detail:
            text += f" [{detail}]"
        parts.append(text)
    return ", ".join(parts)


def review_html(result: dict) -> str:
    rows = []
    for w in result["workouts"]:
        raw = "".join(
            f"<div class=msg><b>{m['at'][11:16]}</b> {html.escape(m['text'] or '')}"
            f"{' <i>[photo ' + html.escape(m['attachment']) + ']</i>' if m['attachment'] else ''}</div>"
            for m in w["raw"]
        )
        parsed = []
        for e in w["entries"]:
            name = BY_ID[e["exerciseId"]].name
            bits = [f"<b>{html.escape(name)}</b>"]
            if e.get("sets"):
                bits.append(html.escape(describe_sets(e["sets"])))
            if e.get("problems"):
                bits.append(html.escape("; ".join(
                    f"{p['grade']} {p.get('color', '')} {p['result']} x{p.get('count', p.get('attempts', ''))}"
                    for p in e["problems"])))
            if e.get("segments"):
                minutes = sum(s["minutes"] for s in e["segments"])
                bits.append(f"{len(e['segments'])} speed steps, {minutes:g} min")
            if e.get("distanceMi"):
                bits.append(f"{e['distanceMi']} mi")
            for t in e.get("targets", []):
                bits.append(f"<span class=t>target: {html.escape(t['text'])}</span>")
            for n in e.get("notes", []):
                bits.append(f"<span class=n>note: {html.escape(n)}</span>")
            for p in e.get("photos", []):
                bits.append(f"<img src='../export/{html.escape(p['file'])}'>")
            if not e.get("sets") and not e.get("problems") and not e.get("segments"):
                bits.append("<span class=warn>no sets</span>")
            parsed.append("<div class=entry>" + "<br>".join(bits) + "</div>")
        for n in w["notes"]:
            parsed.append(f"<div class=n>session note: {html.escape(n)}</div>")
        for p in w["photos"]:
            parsed.append(f"<div>session photo<br><img src='../export/{html.escape(p['file'])}'></div>")
        rows.append(
            f"<tr><td class=day>{w['date']}<br>{html.escape(w['label'])}<br>{w['startedAt'][11:16]}-{w['endedAt'][11:16]}</td>"
            f"<td>{raw}</td><td>{''.join(parsed)}</td></tr>"
        )
    notes = "".join(
        f"<li><b>{html.escape(BY_ID[n['exerciseId']].name)}</b> ({n['date']}, {n['sessions']} sessions): {html.escape(n['text'])}</li>"
        for n in result["notes"]
    )
    flags = "".join(f"<li>{html.escape(f)}</li>" for f in result["flags"])
    return f"""<!doctype html><meta charset=utf-8><title>Import review</title>
<style>body{{font:14px system-ui;margin:16px}} table{{border-collapse:collapse;width:100%}}
td{{border-top:1px solid #ccc;vertical-align:top;padding:6px}} .day{{white-space:nowrap;font-weight:600}}
.msg{{white-space:pre-wrap;margin-bottom:4px}} .entry{{margin-bottom:8px}} .t{{color:#2563eb}} .n{{color:#047857}}
.warn{{color:#dc2626;font-weight:600}} img{{max-height:120px;margin-top:4px}}</style>
<h1>Import review</h1><p>{len(result['workouts'])} sessions. Left: the chat. Right: what will be stored.</p>
<h2>Flags</h2><ul>{flags or '<li>none</li>'}</ul>
<h2>Technique log</h2><ul>{notes}</ul>
<h2>Sessions</h2><table>{''.join(rows)}</table>"""


def summary(result: dict) -> str:
    workouts = result["workouts"]
    entries = [e for w in workouts for e in w["entries"]]
    by_exercise = Counter(BY_ID[e["exerciseId"]].name for e in entries)
    empty = sum(1 for e in entries if not (e.get("sets") or e.get("problems") or e.get("segments")))
    lines = [
        f"Sessions: {len(workouts)} ({workouts[0]['date']} to {workouts[-1]['date']})" if workouts else "Sessions: 0",
        f"Entries: {len(entries)} ({empty} without sets)",
        f"Sets: {sum(len(e.get('sets', [])) for e in entries)}",
        f"Technique notes: {len(result['notes'])}",
        f"Photos: {sum(len(w['photos']) + sum(len(e.get('photos', [])) for e in w['entries']) for w in workouts)}",
        f"Body weight entries: {len(result['body'])}",
        f"Flags: {len(result['flags'])}",
        "Exercises: " + ", ".join(f"{name} {n}" for name, n in by_exercise.most_common()),
    ]
    return "\n".join(lines)


def cmd_parse(_: argparse.Namespace) -> None:
    chat = EXPORT / "_chat.txt"
    if not chat.exists():
        sys.exit(f"Unzip the WhatsApp export into {EXPORT} first.")
    corrections_file = PRIVATE / "corrections.json"
    corrections = json.loads(corrections_file.read_text(encoding="utf-8")) if corrections_file.exists() else {}
    result = parse_messages(read_chat(chat), corrections)
    # The app is in English: notes, captions and climbing notes go through a private table.
    table_file = PRIVATE / "note_translations.json"
    if table_file.exists():
        translated = translate_texts(result, json.loads(table_file.read_text(encoding="utf-8")))
        print(f"Translated texts: {translated}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "parsed.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "review.html").write_text(review_html(result), encoding="utf-8")
    print(summary(result))
    print(f"\nWrote {OUT / 'parsed.json'} and {OUT / 'review.html'}")


def cmd_load(args: argparse.Namespace) -> None:
    parsed_file = OUT / "parsed.json"
    if not parsed_file.exists():
        sys.exit("Run `parse` first.")
    if args.local:
        # The docker compose stack, from the host (ports in docker-compose.yml).
        os.environ.update(
            DYNAMODB_ENDPOINT="http://localhost:8010", S3_ENDPOINT="http://localhost:9190",
            TABLE_NAME="fit", PHOTOS_BUCKET="fit-photos", AWS_REGION="us-east-1",
            AWS_ACCESS_KEY_ID="local", AWS_SECRET_ACCESS_KEY="local",
        )
        target = "local docker stack"
    else:
        if not (args.profile and args.table and args.bucket):
            sys.exit("Use --local, or --profile, --table and --bucket for AWS.")
        os.environ.update(AWS_PROFILE=args.profile, TABLE_NAME=args.table, PHOTOS_BUCKET=args.bucket,
                          AWS_REGION="us-east-1")
        for name in ("DYNAMODB_ENDPOINT", "S3_ENDPOINT", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
            os.environ.pop(name, None)
        target = f"AWS profile {args.profile}, table {args.table}, bucket {args.bucket}"
        answer = input(f"Write the import into space '{args.space}' on {target}? Type 'yes': ")
        if answer.strip() != "yes":
            sys.exit("Cancelled.")

    from app import db, storage
    from app.importer.load import load

    if args.local:
        db.create_table_if_missing()
        storage.create_bucket_if_missing()
    parsed = json.loads(parsed_file.read_text(encoding="utf-8"))
    result = load(parsed, args.space, EXPORT)
    print(f"Loaded into {target}, space '{args.space}':")
    for name, count in result.items():
        print(f"  {name}: {count}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("parse", help="read the chat and write private/import/parsed.json + review.html")
    load_cmd = sub.add_parser("load", help="write parsed.json into DynamoDB and the photos into S3")
    load_cmd.add_argument("--local", action="store_true", help="the docker compose stack")
    load_cmd.add_argument("--profile", help="AWS profile (stage 7)")
    load_cmd.add_argument("--table", help="DynamoDB table on AWS")
    load_cmd.add_argument("--bucket", help="photos bucket on AWS")
    load_cmd.add_argument("--space", default="main", help="data space (default: main, the owner's)")
    args = parser.parse_args()
    {"parse": cmd_parse, "load": cmd_load}[args.command](args)


if __name__ == "__main__":
    main()
