"""Read a WhatsApp "Export chat" text file into messages.

iPhone exports look like:
    [9/13/25, 10:51:07 AM] Sergio Vanegas: 2x3. Weighted dips 36 kg.
    ‎[11/12/25, 7:46:05 PM] Sergio Vanegas: ‎<attached: 00000143-PHOTO-2025-11-12-19-46-05.jpg>
with invisible marks (U+200E) at line starts, a narrow no-break space (U+202F) before AM/PM,
and messages that continue over several lines.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

_INVISIBLE = dict.fromkeys(map(ord, "‎‏‪‫‬﻿"), None)
_HEADER = re.compile(r"^\[(\d{1,2}/\d{1,2}/\d{2}), (\d{1,2}:\d{2}:\d{2}) ([AP]M)\] ([^:]+): ?(.*)$")
_ATTACHED = re.compile(r"<attached: ([^>]+)>")
_EDITED = "<This message was edited>"


@dataclass
class Message:
    at: datetime
    sender: str
    text: str
    attachment: str | None = None

    @property
    def key(self) -> str:
        """Stable id for corrections: the timestamp as WhatsApp prints it, e.g. "2025-11-12 19:46:05"."""
        return self.at.strftime("%Y-%m-%d %H:%M:%S")


def _clean(line: str) -> str:
    return line.translate(_INVISIBLE).replace(" ", " ").replace(" ", " ").rstrip()


def parse_chat(text: str) -> list[Message]:
    messages: list[Message] = []
    for raw in text.splitlines():
        line = _clean(raw)
        header = _HEADER.match(line)
        if header:
            date, time, ampm, sender, body = header.groups()
            at = datetime.strptime(f"{date} {time} {ampm}", "%m/%d/%y %I:%M:%S %p")
            messages.append(Message(at=at, sender=sender.strip(), text=body))
        elif messages:
            messages[-1].text += "\n" + line
    for message in messages:
        attached = _ATTACHED.search(message.text)
        if attached:
            message.attachment = attached.group(1)
            message.text = _ATTACHED.sub("", message.text)
        message.text = message.text.replace(_EDITED, "").strip()
    return messages


def read_chat(path: Path) -> list[Message]:
    return parse_chat(path.read_text(encoding="utf-8"))
