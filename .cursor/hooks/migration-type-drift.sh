#!/usr/bin/env bash
# Cursor afterFileEdit hook.
#
# Warns the agent when supabase/migrations/ is touched without regenerating
# src/lib/types/database.ts. Returns additional_context, never blocks.
#
# Stdin: JSON event payload from Cursor.
# Stdout: JSON object with optional additional_context.
set -euo pipefail

# Read stdin so the JSON pipe doesn't break upstream.
input="$(cat || true)"

# Cheap path filter — only react when the edited file is a migration.
file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"

case "$file_path" in
	*supabase/migrations/*.sql)
		;;
	*)
		exit 0
		;;
esac

# If git is available and database.ts is staged or modified alongside the migration, stay silent.
if command -v git >/dev/null 2>&1; then
	if git diff --name-only HEAD 2>/dev/null | grep -q '^src/lib/types/database\.ts$'; then
		exit 0
	fi
fi

cat <<'JSON'
{
	"additional_context": "Migration file edited. Before finishing this turn, run `npm run supabase:gen-types` and include the regenerated `src/lib/types/database.ts` in the same commit. See `.cursor/rules/db-changes.mdc`."
}
JSON
exit 0
