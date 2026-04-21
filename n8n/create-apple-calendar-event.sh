#!/bin/bash
set -euo pipefail

SKILL_DIR="$HOME/.hermes/skills/apple/macos-calendar"
SCRIPT="$SKILL_DIR/scripts/calendar.sh"
TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

if [ ! -x "$SCRIPT" ]; then
  echo "macos-calendar script not found or not executable: $SCRIPT" >&2
  exit 1
fi

cat > "$TMP_JSON"

python3 - <<'PY' "$TMP_JSON"
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
data = json.loads(p.read_text())
required = ['summary']
missing = [k for k in required if not data.get(k)]
if missing:
    raise SystemExit(f"Missing required calendar fields: {', '.join(missing)}")
if not data.get('iso_date'):
    raise SystemExit('Missing required calendar field: iso_date')
if data.get('all_day') is not True and data.get('hour') is None:
    raise SystemExit('Missing required calendar field: hour')
print('calendar payload ok')
PY

# If no calendar supplied, prefer Work; fallback to first writable calendar handled by skill script.
python3 - <<'PY' "$TMP_JSON"
import json, sys, pathlib
p = pathlib.Path(sys.argv[1])
data = json.loads(p.read_text())
if not data.get('calendar'):
    data['calendar'] = 'Work'
p.write_text(json.dumps(data))
PY

cat "$TMP_JSON" | "$SCRIPT" create-event
