#!/usr/bin/env bash
# demo — the whole AIR-DS system, end to end, in one command.
#
#   bash scripts/demo.sh
#
# install -> build -> gauntlet -> evals -> benchmark (fixture replay) ->
# ingest acme -> metrics report -> summary scoreboard.
#
# ZERO credentials, zero accounts, zero network services: after the initial
# `pnpm install` everything runs offline in any clean environment. The one
# optional extra is a local chromium for the benchmark's axe column
# (`npx playwright install chromium`) — without it the column reads
# "skipped (no browser)" and the demo still completes. Idempotent: run it
# as many times as you like.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
DEMO_T0=$SECONDS

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
STEP_TIMES=""
timed() { # timed "<label>" cmd...
  local label="$1"; shift
  local t0=$SECONDS
  "$@"
  STEP_TIMES="${STEP_TIMES}  ${label}: $((SECONDS - t0))s\n"
}

step "1/7 pnpm install (retries on lock collisions; the only step that may use the network)"
install_ok=""
for attempt in 1 2 3; do
  if pnpm install; then install_ok=1; break; fi
  echo "pnpm install attempt ${attempt} failed (lock collision?) — retrying in 5s"
  sleep 5
done
[ -n "$install_ok" ] || { echo "pnpm install failed after 3 attempts"; exit 1; }

step "2/7 Build: tokens -> react -> registries -> context -> mcp"
timed "build" pnpm build

step "3/7 Validation gauntlet (typecheck -> lint -> build -> test -> registry-check)"
timed "gauntlet" pnpm validate

step "4/7 Eval regression run (critical 1.0, overall >= 0.95 — deterministic, no LLM)"
timed "evals" pnpm --filter @ds/validate run evals

step "5/7 Benchmark — fixture replay (committed recordings, offline; axe auto-skips without a local browser)"
timed "benchmark" pnpm --filter @ds/validate run benchmark

step "6/7 Customer ingest: acme intake -> branded tokens + context + publish bundle"
timed "ingest" pnpm --filter @ds/ingest build
timed "ingest-run" node tooling/ingest/dist/cli.js run brands/acme-intake.json

step "7/7 Metrics report (per-release trend from metrics/history.jsonl)"
timed "metrics" pnpm --filter @ds/validate run metrics:report

SCOREBOARD="$(ls -t tooling/validate/benchmark-results/*-scoreboard.md 2>/dev/null | head -1 || true)"

printf '\n\033[1m================ AIR-DS DEMO COMPLETE ================\033[0m\n'
printf 'Total: %ss\n' "$((SECONDS - DEMO_T0))"
printf '%b' "$STEP_TIMES"
cat <<EOF

Explore from here (everything below is local, credential-free):
  Benchmark scoreboard   ${SCOREBOARD:-tooling/validate/benchmark-results/}
  Metrics trend          metrics/README.md          (history: metrics/history.jsonl)
  Storybook              pnpm storybook             (stories are the agents' ground truth)
  MCP server             .mcp.json                  (auto-wired: open this repo in Claude Code)
  Customer build (acme)  customer-builds/acme/      (intake-report.md, publish-plan.json)
  Agent-facing artifacts packages/context/dist/default/
  Release proof          bash scripts/release-pack.sh   -> release-artifacts/ tarballs
  Axe column (optional)  npx playwright install chromium   # one-time local browser
EOF
