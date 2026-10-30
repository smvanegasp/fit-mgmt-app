OWNER_SPACE = "main"


def current_space() -> str:
    """The data space for this request.

    Until guest sandboxes and owner login exist (stage 5a) everything works on the owner's log.
    Stage 5a replaces this with the pantry's version, which reads the space only from the
    signed session cookie, so a guest can never reach the owner's data.
    """
    return OWNER_SPACE
