#!/usr/bin/env bash
# Warn when a .svelte file grows by >30 lines in one edit and is already >200 lines.
set -euo pipefail

FILE="${CURSOR_FILE_PATH:-}"
if [[ -z "$FILE" || "$FILE" != *.svelte ]]; then
	exit 0
fi

if ! command -v git >/dev/null 2>&1; then
	exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	exit 0
fi

if ! git ls-files --error-unmatch "$FILE" >/dev/null 2>&1; then
	exit 0
fi

OLD_LINES=$(git show "HEAD:$FILE" 2>/dev/null | wc -l | tr -d ' ')
NEW_LINES=$(wc -l <"$FILE" | tr -d ' ')
DELTA=$((NEW_LINES - OLD_LINES))

if [[ "$OLD_LINES" -gt 200 && "$DELTA" -gt 30 ]]; then
	echo "⚠️  $FILE grew by $DELTA lines (now $NEW_LINES). Consider extracting a component (~150 line rule)." >&2
fi

exit 0
