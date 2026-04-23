#!/usr/bin/env bash
set -euo pipefail
LINKED="$(cat supabase/.temp/project-ref 2>/dev/null || echo NONE)"
REF_FROM_URL="$(echo "${PUBLIC_SUPABASE_URL:-}" | sed -E 's#https?://([^.]+)\..*#\1#')"
echo "linked CLI:      $LINKED"
echo "PUBLIC_SUPABASE: $REF_FROM_URL"
echo "SUPABASE_REF:    ${SUPABASE_REF:-}"
if [[ "$LINKED" != "${SUPABASE_REF:-}" ]] || [[ "$REF_FROM_URL" != "${SUPABASE_REF:-}" ]]; then
	echo ""
	echo "MISMATCH — run: npm run supabase:link"
	exit 1
fi
echo ""
echo "All three match."
