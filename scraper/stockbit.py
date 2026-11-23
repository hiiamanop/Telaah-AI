import os
from pathlib import Path


def status() -> dict:
    token = os.getenv("STOCKBIT_REFRESH_TOKEN", "").strip()
    session_file = Path(os.getenv("STOCKBIT_SESSION_FILE", "data/stockbit_session.json"))
    configured = bool(token) or session_file.exists()
    return {
        "configured": configured,
        "source": "stockbit",
        "limitations": (
            []
            if configured
            else [
                "Session Stockbit belum diatur; broker summary penuh belum aktif."
            ]
        ),
    }
