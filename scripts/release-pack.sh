#!/usr/bin/env bash
# release-pack — prove releasability locally, with ZERO credentials.
#
# Builds the workspace, then `pnpm pack`s every publishable package into
# release-artifacts/ and stages a version-stamped registry bundle (machine
# contracts + compiled context artifacts). Nothing here touches a registry
# or needs a token: actual `npm publish` lives in .github/workflows/release.yml
# behind a client-provided secret, deliberately disabled by default.
#
# Usage:
#   bash scripts/release-pack.sh
#   pnpm --filter @ds/validate run release:pack
#
# Idempotent and offline (after `pnpm install`).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERSION="$(node -p "require('./packages/tokens/package.json').version")"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
OUT="$ROOT/release-artifacts"

# The artifacts directory ignores itself — release outputs are proof, not history.
mkdir -p "$OUT"
printf '*\n' > "$OUT/.gitignore"
rm -f "$OUT"/*.tgz

echo "==> Building workspace (all packages, incl. tooling dists)"
pnpm -r build

PACKAGES=(
  packages/tokens
  packages/react
  packages/mcp
  packages/context
  tooling/validate
  tooling/ingest
)

echo "==> Packing ${#PACKAGES[@]} publishable packages -> release-artifacts/"
for pkg in "${PACKAGES[@]}"; do
  (cd "$pkg" && pnpm pack --pack-destination "$OUT" >/dev/null)
  echo "    packed $(node -p "require('./$pkg/package.json').name")"
done

echo "==> Staging version-stamped registry bundle"
BUNDLE="$OUT/registry-bundle-$VERSION"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE"
cp -R registries "$BUNDLE/registries"
if [ -d packages/context/dist ]; then
  cp -R packages/context/dist "$BUNDLE/context"
fi
node -e "
const fs = require('fs');
fs.writeFileSync('$BUNDLE/version.json', JSON.stringify({
  version: '$VERSION',
  git_sha: '$SHA',
  contents: ['registries/ (closed-world machine contracts)', 'context/ (compiled agent-facing artifacts, per brand)'],
  generatedBy: 'scripts/release-pack.sh',
}, null, 2) + '\n');
"

node -e "
const fs = require('fs');
const tarballs = fs.readdirSync('$OUT').filter(f => f.endsWith('.tgz')).sort();
fs.writeFileSync('$OUT/release-manifest.json', JSON.stringify({
  version: '$VERSION',
  git_sha: '$SHA',
  tarballs,
  registryBundle: 'registry-bundle-$VERSION/',
  publish: 'DISABLED by default — see .github/workflows/release.yml (client provides NPM_TOKEN)',
}, null, 2) + '\n');
"

echo ""
echo "RELEASE PACK COMPLETE — $OUT"
ls -1 "$OUT" | sed 's/^/  /'
echo ""
echo "Publish stays a documented, disabled step (client credentials only):"
echo "  .github/workflows/release.yml"
