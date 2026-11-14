#!/bin/sh
# Print every invite request as CSV on stdout. Pass --local to read the local dev database.
# Usage: scripts/export-invites.sh [--local] > invites.csv
set -eu
where="--remote"
[ "${1:-}" = "--local" ] && where="--local"
npx wrangler d1 execute ressac-invites "$where" --json \
  --command "SELECT email, origin, chip, memory, hope, lang, created_at, updated_at FROM invites ORDER BY created_at" \
| node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const rows = JSON.parse(s)[0].results;
    const cols = ["email", "origin", "chip", "memory", "hope", "lang", "created_at", "updated_at"];
    // A leading = + - @ would run as a formula in a spreadsheet: neutralise it.
    const cell = (v) => (v == null ? "" : `"${String(v).replace(/^[=+\-@]/, "\x27$&").replace(/"/g, "\"\"")}"`);
    console.log(cols.join(","));
    for (const r of rows) console.log(cols.map((c) => cell(r[c])).join(","));
  });'
