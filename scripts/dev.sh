#!/usr/bin/env bash
# Boot full dev stack: postgres + redis + backend + frontend (+ optional email worker).
# Ctrl+C tears it all down: kill child processes, stop containers.
#
# Skip the email worker on boot:    SC_SKIP_WORKER=1 npm run dev
# Skip redis (worker auto-skips):   SC_SKIP_REDIS=1  npm run dev

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKEND_PID=""
FRONTEND_PID=""
WORKER_PID=""

color() { printf "\033[%sm%s\033[0m" "$1" "$2"; }
log()   { printf "%s %s\n" "$(color "1;36" "[dev]")" "$*"; }
err()   { printf "%s %s\n" "$(color "1;31" "[dev]")" "$*" >&2; }

cleanup() {
  echo
  log "shutdown — stopping children + containers"

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log "kill frontend ($FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    log "kill backend ($BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    log "kill worker ($WORKER_PID)"
    kill "$WORKER_PID" 2>/dev/null || true
  fi

  # Wait briefly for graceful exit.
  sleep 1
  for pid in "$FRONTEND_PID" "$BACKEND_PID" "$WORKER_PID"; do
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

# 1b. redis up + wait until healthy (skip with SC_SKIP_REDIS=1)
# Required by the BullMQ email queue + worker process. The backend itself
# fail-opens when REDIS_URL is unset, so the API path keeps working with
# redis down — only the email queue stops draining.
if [[ -z "${SC_SKIP_REDIS:-}" ]]; then
  log "starting redis"
  docker compose up -d redis >/dev/null
  for i in {1..30}; do
    status=$(docker inspect --format='{{.State.Health.Status}}' smartcollab_redis 2>/dev/null || echo "missing")
    if [[ "$status" == "healthy" ]]; then
      log "redis healthy"
      break
    fi
    if [[ "$i" == 30 ]]; then
      err "redis did not become healthy after 30s"
      docker compose down --remove-orphans >/dev/null 2>&1 || true
      exit 1
    fi
    sleep 1
  done
fi

# 2. backend + frontend + worker in parallel
# Heap caps keep total RAM in check on dev laptops with limited free memory.
# Override via SC_BACKEND_HEAP_MB / SC_FRONTEND_HEAP_MB env if you want more.
BACKEND_HEAP_MB="${SC_BACKEND_HEAP_MB:-768}"
FRONTEND_HEAP_MB="${SC_FRONTEND_HEAP_MB:-1536}"

log "starting backend (port 4000, heap ${BACKEND_HEAP_MB}MB)"
NODE_OPTIONS="--max-old-space-size=${BACKEND_HEAP_MB}" \
  npm --prefix backend run dev &
BACKEND_PID=$!

log "starting frontend (port 3000, heap ${FRONTEND_HEAP_MB}MB, webpack)"
NODE_OPTIONS="--max-old-space-size=${FRONTEND_HEAP_MB}" \
  npm --prefix frontend run dev &
FRONTEND_PID=$!

# 3. email worker (skip with SC_SKIP_WORKER=1). Drains the BullMQ email queue.
# Lighter heap cap since the worker only formats + ships emails.
if [[ -z "${SC_SKIP_WORKER:-}" ]] && [[ -z "${SC_SKIP_REDIS:-}" ]]; then
  WORKER_HEAP_MB="${SC_WORKER_HEAP_MB:-384}"
  log "starting email worker (heap ${WORKER_HEAP_MB}MB)"
  NODE_OPTIONS="--max-old-space-size=${WORKER_HEAP_MB}" \
    npm --prefix backend run worker &
  WORKER_PID=$!
fi

log "stack up. ctrl+c to stop everything."
log "backend: http://localhost:4000/healthz   frontend: http://localhost:3000"

# Wait on any child to exit. If one dies, tear down everything.
if [[ -n "$WORKER_PID" ]]; then
  wait -n "$BACKEND_PID" "$FRONTEND_PID" "$WORKER_PID" || true
else
  wait -n "$BACKEND_PID" "$FRONTEND_PID" || true
fi
err "a child process exited unexpectedly — tearing down"
cleanup
