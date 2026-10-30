"""Owner passcode hashing with scrypt (stdlib), stored as "scrypt$<salt>$<hash>"."""

import base64
import hashlib
import hmac
import os

# scrypt cost: slow enough to make offline guessing of a short numeric code costly,
# fast enough for a login request. The real brute-force defense is the rate limit.
_N, _R, _P = 2**14, 8, 1


def _derive(passcode: str, salt: bytes) -> bytes:
    return hashlib.scrypt(passcode.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)


def hash_passcode(passcode: str) -> str:
    salt = os.urandom(16)
    encode = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${encode(salt)}${encode(_derive(passcode, salt))}"


def verify_passcode(passcode: str, stored: str) -> bool:
    try:
        scheme, salt, expected = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = _derive(passcode, base64.b64decode(salt))
        return hmac.compare_digest(actual, base64.b64decode(expected))
    except ValueError:
        return False
