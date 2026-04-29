#!/usr/bin/env bash
# Cursor afterFileEdit hook.
#
# When a *.svelte file is edited, scan the diff for newly-added <Button>
# opening tags whose label includes a primary-action keyword (Save, Update,
# Delete, Edit, Cancel, Generate) but lack a `hotkey=` attribute on the
# opening tag.
#
# `New` and `Add` are intentionally NOT triggers — those buttons are typically
# navigation links and the letters `n` / `a` are non-reclaimable in Chrome /
# collide with select-all in inputs respectively. (Use `hotkey="b"` for
# "New Book"-style labels where a per-label mnemonic fits.)
#
# Returns additional_context, never blocks.
#
# Pairs with .cursor/rules/hotkeys.mdc and the runtime dev console.warn in
# src/lib/components/ui/button/button.svelte.
#
# Stdin: JSON event payload from Cursor.
# Stdout: JSON object with optional additional_context.
set -euo pipefail

# Read stdin so the JSON pipe doesn't break upstream.
input="$(cat || true)"

# Cheap path filter — only react when the edited file is a .svelte file.
file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"

case "$file_path" in
	*.svelte)
		;;
	*)
		exit 0
		;;
esac

# Need git to inspect the diff for the file.
if ! command -v git >/dev/null 2>&1; then
	exit 0
fi

# Diff vs HEAD (covers staged + unstaged changes since the last commit).
# Bail quietly on any git error (e.g. file not in repo yet, brand-new file).
diff="$(git diff -U0 HEAD -- "$file_path" 2>/dev/null || true)"
if [ -z "$diff" ]; then
	exit 0
fi

# Pull only the added lines (lines that start with a single +, but not the
# +++ header).
added_lines="$(printf '%s' "$diff" | awk '/^\+[^+]/{ print substr($0, 2) }')"
if [ -z "$added_lines" ]; then
	exit 0
fi

# Look for `<Button` opening tags (may span multiple lines, but most of ours
# fit on one line in the shadcn pattern). For each such candidate line, if
# it does NOT contain `hotkey=` AND the next ~3 lines mention a primary-
# action keyword as the inline label, flag it.
#
# Also catch the inline `label="…"` shorthand: <Button hotkey-less label="Save".
flagged="$(printf '%s' "$added_lines" | awk '
	BEGIN { IGNORECASE = 1 }
	# match either the opening tag with inline label= OR a label keyword on the same line
	/<Button[^>]*label[[:space:]]*=[[:space:]]*"(Save|Update|Delete|Edit|Cancel|Generate)/ \
		&& $0 !~ /hotkey[[:space:]]*=/ { print; next }
	/<Button/ && $0 !~ /hotkey[[:space:]]*=/ { print; next }
' | grep -iE '(save|update|delete|edit|cancel|generate)' || true)"

if [ -z "$flagged" ]; then
	exit 0
fi

cat <<JSON
{
	"additional_context": "Detected one or more new \`<Button>\` opening tags in $file_path that look like primary actions (Save / Update / Delete / Edit / Cancel / Generate) but are missing a \`hotkey=\` prop. Add hotkey=\"s\" (save), \"u\" (update), \"d\" (delete), \"e\" (edit), \"g\" (generate), \"b\" (per-label mnemonic, e.g. New Book), or \"Escape\" (cancel buttons — bare Esc, no modifier). See \`.cursor/rules/hotkeys.mdc\` for the avoid-list of letters that conflict with browser/clipboard chords."
}
JSON
exit 0
