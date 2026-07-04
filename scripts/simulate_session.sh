#!/usr/bin/env bash
# Offline end-to-end exercise of the vibetrace pipeline — no live Claude Code
# session needed. Pipes realistic hook payloads into `python -m vibetrace.hook`
# exactly the way Claude Code would, simulating:
#   prompt 1 (vague, hurried)  -> Write of a vulnerable Flask app
#   prompt 2 (security-aware)  -> Edit that removes the eval() endpoint
#
# Usage: scripts/simulate_session.sh [target-dir]
#   target-dir defaults to a fresh temp dir. Requires vibetrace (and semgrep)
#   installed in the current Python environment.
set -euo pipefail

PYTHON=${PYTHON:-python3}
DIR=${1:-$(mktemp -d /tmp/vibetrace-demo-XXXX)}
SID="sim-$(date +%s)"
export CLAUDE_PROJECT_DIR="$DIR"

mkdir -p "$DIR" && cd "$DIR"
"$PYTHON" -m vibetrace.cli init --project "$DIR" >/dev/null

# On machines without registry access, point VIBETRACE_RULES at a local rules
# path (e.g. tests/fixtures/rules/vibetrace-test-rules.yaml or a semgrep-rules
# checkout) to keep the demo fully offline.
if [ -n "${VIBETRACE_RULES:-}" ]; then
  "$PYTHON" - "$DIR" "$VIBETRACE_RULES" <<'PY'
import json, sys, pathlib
cfg_path = pathlib.Path(sys.argv[1]) / ".vibetrace" / "config.json"
cfg = json.loads(cfg_path.read_text())
cfg["rules_config"] = sys.argv[2]
cfg_path.write_text(json.dumps(cfg, indent=2) + "\n")
PY
fi

hook() { # hook <event-arg> <payload-json>
  printf '%s' "$2" | "$PYTHON" -m vibetrace.hook "$1"
}

base() { # base <event> [extra json fields...]
  printf '{"session_id":"%s","hook_event_name":"%s","transcript_path":"/tmp/t.jsonl","cwd":"%s","permission_mode":"default"%s}' \
    "$SID" "$1" "$DIR" "${2:-}"
}

echo "== session start"
hook session-start "$(base SessionStart ',"source":"startup"')"

echo "== prompt 1 (vague): vulnerable write"
hook user-prompt-submit "$(base UserPromptSubmit ',"prompt":"just make a quick login page that checks the password against the db"')"
hook pre-tool-use "$(base PreToolUse ",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$DIR/app.py\"}")"
cat > "$DIR/app.py" <<'PY'
import sqlite3
import flask

app = flask.Flask(__name__)

@app.route("/login")
def login():
    user = flask.request.args.get("user", "")
    pw = flask.request.args.get("pw", "")
    conn = sqlite3.connect("users.db")
    query = "SELECT * FROM users WHERE name = '" + user + "' AND pw = '" + pw + "'"
    row = conn.execute(query).fetchone()
    return "ok" if row else "no"

@app.route("/calc")
def calc():
    return str(eval(flask.request.args.get("expr", "1")))

if __name__ == "__main__":
    app.run(debug=True)
PY
hook post-tool-use "$(base PostToolUse ",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$DIR/app.py\"},\"tool_response\":{}")"

echo "== prompt 2 (security-aware): fixing edit"
hook user-prompt-submit "$(base UserPromptSubmit ',"prompt":"Please remove the eval() endpoint in app.py and use a parameterized query to prevent SQL injection, never build SQL by concatenation"')"
hook pre-tool-use "$(base PreToolUse ",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$DIR/app.py\"}")"
cat > "$DIR/app.py" <<'PY'
import sqlite3
import flask

app = flask.Flask(__name__)

@app.route("/login")
def login():
    user = flask.request.args.get("user", "")
    pw = flask.request.args.get("pw", "")
    conn = sqlite3.connect("users.db")
    row = conn.execute(
        "SELECT * FROM users WHERE name = ? AND pw = ?", (user, pw)
    ).fetchone()
    return "ok" if row else "no"

if __name__ == "__main__":
    app.run()
PY
hook post-tool-use "$(base PostToolUse ",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$DIR/app.py\",\"old_string\":\"eval\",\"new_string\":\"\"},\"tool_response\":{}")"

echo "== stop + session end"
hook stop "$(base Stop)"
hook session-end "$(base SessionEnd ',"source":"other"')"

echo "== drain scans (runs semgrep)"
"$PYTHON" -m vibetrace.cli scan --drain --project "$DIR"

echo "== status"
"$PYTHON" -m vibetrace.cli status --project "$DIR"

echo
echo "Demo data in: $DIR"
echo "Browse it:    vibetrace dashboard --project $DIR"
