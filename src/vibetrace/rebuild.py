"""Recompute derived prompt feature columns with the current extractors.

Original prompt text is stored verbatim, so improving features.py never loses
data: bump FEATURES_VERSION, run `vibetrace rebuild`, and every prompt row is
re-extracted (raw_events additionally preserves full payloads for deeper
replays)."""

from __future__ import annotations

import json
from pathlib import Path

from vibetrace import FEATURES_VERSION, db
from vibetrace.features import extract_features


def recompute_features(db_path: Path) -> int:
    conn = db.connect(db_path)
    try:
        rows = conn.execute("SELECT id, prompt_text FROM prompts").fetchall()
        for row in rows:
            feats = extract_features(row["prompt_text"])
            sets = ", ".join(f"feat_{name} = ?" for name in feats)
            conn.execute(
                f"UPDATE prompts SET {sets}, features_version = ?, features_json = ? WHERE id = ?",
                [*feats.values(), FEATURES_VERSION, json.dumps(feats), row["id"]],
            )
        conn.execute(
            "INSERT OR REPLACE INTO meta(key, value) VALUES ('features_version', ?)",
            (FEATURES_VERSION,),
        )
        conn.commit()
        return len(rows)
    finally:
        conn.close()
