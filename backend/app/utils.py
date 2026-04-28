from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def normalize_url(url: str) -> str:
    """
    Best-effort URL canonicalization for dedupe:
    - trim whitespace
    - strip fragments
    - sort query params
    """
    raw = (url or "").strip()
    if not raw:
        return raw

    parts = urlsplit(raw)
    query_pairs = parse_qsl(parts.query, keep_blank_values=True)
    query_pairs.sort(key=lambda kv: (kv[0], kv[1]))
    normalized_query = urlencode(query_pairs)

    return urlunsplit((parts.scheme, parts.netloc, parts.path, normalized_query, ""))

