#!/usr/bin/env bash
#
# Cross-check photo.url rows against files actually present in MEDIA_DIR.
# This is the step that catches the case-sensitivity and percent-encoding
# mismatches that would otherwise only surface as broken images on the LXC.
#
# macOS APFS is case-insensitive, so `Hero.JPG` vs `hero.JPG` works locally and
# 404s on the container's ext4. LC_ALL=C sorting plus an explicit case-insensitive
# second pass makes that visible here.
set -euo pipefail

cd "$(dirname "$0")/../.."

MEDIA_DIR="${MEDIA_DIR:-./media}"

if [[ ! -d "$MEDIA_DIR" ]]; then
  echo "error: MEDIA_DIR '$MEDIA_DIR' does not exist. Download the bucket first." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# DB side: strip the /media/ prefix and percent-decode, since express.static
# decodes the request path before hitting the filesystem.
docker compose exec -T postgres psql -U capri -d capri -Atc \
  "SELECT url FROM photo WHERE url LIKE '/media/%'" \
  | sed 's|^/media/||' \
  | python3 -c 'import sys,urllib.parse; [print(urllib.parse.unquote(l.rstrip("\n"))) for l in sys.stdin]' \
  | LC_ALL=C sort > "$tmp/db.txt"

# Disk side.
(cd "$MEDIA_DIR" && find . -type f ! -name '.DS_Store' | sed 's|^\./||') \
  | LC_ALL=C sort > "$tmp/disk.txt"

echo "==> $(wc -l < "$tmp/db.txt" | tr -d ' ') photo rows, $(wc -l < "$tmp/disk.txt" | tr -d ' ') files on disk"

echo
echo "==> In DB but MISSING on disk (these render as broken images):"
missing=$(LC_ALL=C comm -23 "$tmp/db.txt" "$tmp/disk.txt")
if [[ -z "$missing" ]]; then echo "    (none)"; else echo "$missing" | sed 's/^/    /'; fi

echo
echo "==> On disk but not referenced by any photo row (orphans, harmless):"
orphans=$(LC_ALL=C comm -13 "$tmp/db.txt" "$tmp/disk.txt")
if [[ -z "$orphans" ]]; then echo "    (none)"; else echo "$orphans" | sed 's/^/    /'; fi

# Case-only mismatches: present when a path matches ignoring case but not exactly.
# These are the ones macOS silently tolerates and Linux does not.
echo
echo "==> CASE-ONLY mismatches (work on macOS, 404 on the LXC):"
LC_ALL=C sort -f "$tmp/db.txt" > "$tmp/db.ci"
LC_ALL=C sort -f "$tmp/disk.txt" > "$tmp/disk.ci"
caseonly=$(LC_ALL=C comm -12 <(LC_ALL=C tr 'A-Z' 'a-z' < "$tmp/db.ci" | LC_ALL=C sort) \
                             <(LC_ALL=C tr 'A-Z' 'a-z' < "$tmp/disk.ci" | LC_ALL=C sort) \
           | while read -r lower; do
               d=$(LC_ALL=C grep -ix -m1 -- "$lower" "$tmp/db.txt" || true)
               k=$(LC_ALL=C grep -ix -m1 -- "$lower" "$tmp/disk.txt" || true)
               [[ -n "$d" && -n "$k" && "$d" != "$k" ]] && echo "    db='$d'  disk='$k'"
             done)
if [[ -z "$caseonly" ]]; then echo "    (none)"; else echo "$caseonly"; fi

echo
if [[ -n "$missing" || -n "$caseonly" ]]; then
  echo "==> FAIL: fix the above before deploying."
  exit 1
fi
echo "==> OK: every photo row resolves to a file on disk."
