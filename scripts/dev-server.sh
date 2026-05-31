#!/usr/bin/env bash
# Dev server that survives Cursor agent session switches (not tied to agent shells).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="$ROOT/.dev-server.pid"
LOG="$ROOT/.dev-server.log"

is_running() {
  [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

cmd_start() {
  if is_running; then
    echo "Dev server already running (pid $(cat "$PIDFILE"))."
    echo "  http://localhost:5173/"
    echo "  log: $LOG"
    exit 0
  fi
  cd "$ROOT"
  nohup npm run dev >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  sleep 0.3
  if ! is_running; then
    rm -f "$PIDFILE"
    echo "Failed to start. See $LOG"
    tail -20 "$LOG" 2>/dev/null || true
    exit 1
  fi
  echo "Dev server started (pid $(cat "$PIDFILE"))."
  echo "  http://localhost:5173/"
  echo "  log: $LOG"
}

cmd_stop() {
  if ! is_running; then
    rm -f "$PIDFILE"
    echo "Dev server is not running."
    exit 0
  fi
  pid="$(cat "$PIDFILE")"
  kill "$pid" 2>/dev/null || true
  # npm run dev may leave a child vite process
  pkill -P "$pid" 2>/dev/null || true
  rm -f "$PIDFILE"
  echo "Stopped dev server (was pid $pid)."
}

cmd_status() {
  if is_running; then
    echo "running (pid $(cat "$PIDFILE")) — http://localhost:5173/"
  else
    rm -f "$PIDFILE"
    echo "not running"
    exit 1
  fi
}

case "${1:-start}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  restart) cmd_stop; cmd_start ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
