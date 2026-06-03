#!/usr/bin/env bash
# Boot full dev stack: postgres + backend + frontend.
# Ctrl+C tears it all down: kill child processes, stop postgres container.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKEND_PID=""
FRONTEND_PID=""

color() { printf "\033[%sm%s\033[0m" "$1" "$2"; }
log()   { printf "%s %s\n" "$(color "1;36" "[dev]")" "$*"; }
err()   { printf "%s %s\n" "$(color "1;31" "[dev]")" "$*" >&2; }

cleanup() {
  echo
  log "shutdown — stopping children + postgres"

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log "kill frontend ($FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "kill backend ($BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  # Wait briefly for graceful exit.
  sleep 1
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
  done

  log "docker compose down"
  docker compose down --remove-orphans >/dev/null 2>&1 || true

  log "stopped."
  exit 0
}

trap cleanup INT TERM

# 1. postgres up + wait until healthy
log "starting postgres"
docker compose up -d postgres >/dev/null

for i in {1..30}; do
  status=$(docker inspect --format='{{.State.Health.Status}}' smartcollab_postgres 2>/dev/null || echo "missing")
  if [[ "$status" == "healthy" ]]; then
    log "postgres healthy"
    break
  fi
  if [[ "$i" == 30 ]]; then
    err "postgres did not become healthy after 30s"
    docker compose down --remove-orphans >/dev/null 2>&1 || true
    exit 1
  fi
  sleep 1
done

# 2. backend + frontend in parallel
log "starting backend (port 4000)"
npm --prefix backend run dev &
BACKEND_PID=$!

log "starting frontend (port 3000)"
npm --prefix frontend run dev &
FRONTEND_PID=$!

log "stack up. ctrl+c to stop everything."
log "backend: http://localhost:4000/healthz   frontend: http://localhost:3000"

# Wait on any child to exit. If one dies, tear down everything.
wait -n "$BACKEND_PID" "$FRONTEND_PID" || true
err "a child process exited unexpectedly — tearing down"
cleanup
