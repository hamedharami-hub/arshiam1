#!/usr/bin/env bash
# Backup the Firebase rules currently live for the ARSHNAZ project.
# Reads the released Firestore/Storage rulesets through the Firebase Rules API,
# using the access token the Firebase CLI keeps in its config store.
# Refreshes that token by running a harmless CLI call first.
set -euo pipefail

PROJECT="gen-lang-client-0845891098"
ROOT="/home/ubuntu/projects/arshiam1"
OUT="$ROOT/backups/firebase-rules/$(date +%Y-%m-%dT%H-%M-%S)"
CFG="$HOME/.config/configstore/firebase-tools.json"

mkdir -p "$OUT"

# Refresh the CLI token (side effect of any authenticated call).
npx -y firebase-tools@latest projects:list --project "$PROJECT" >/dev/null 2>&1 || true

python3 - "$PROJECT" "$CFG" "$OUT" <<'PY'
import json, sys, urllib.request, urllib.error, os

project, cfg_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
tok = json.load(open(cfg_path))["tokens"]["access_token"]

def get(url):
    req = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + tok,
        "x-goog-user-project": project,
    })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} for {url}: {e.read().decode()[:200]}")

releases = get(f"https://firebaserules.googleapis.com/v1/projects/{project}/releases")["releases"]
summary = []
for rel in releases:
    rid = rel["rulesetName"].split("/")[-1]
    rs = get(f"https://firebaserules.googleapis.com/v1/projects/{project}/rulesets/{rid}")
    safe = rel["name"].split("/releases/")[1].replace("/", "__")
    content = "\n".join(f.get("content", "") for f in rs.get("source", {}).get("files", []))
    with open(os.path.join(out, safe + ".rules"), "w") as fh:
        fh.write(content)
    summary.append({
        "release": rel["name"],
        "ruleset": rel["rulesetName"],
        "created": rs.get("createTime"),
        "chars": len(content),
    })

with open(os.path.join(out, "index.json"), "w") as fh:
    json.dump(summary, fh, indent=2)

print(f"backed up {len(summary)} rulesets into {out}")
for s in summary:
    print(f"  {s['chars']:>6} chars  {s['release'].split('/releases/')[1]}")
PY

# Keep the eight most recent backups.
cd "$ROOT/backups/firebase-rules" && ls -1dt */ 2>/dev/null | tail -n +9 | xargs -r rm -rf
