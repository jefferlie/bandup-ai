#!/usr/bin/env bash
# start.sh — Run BandUp AI locally (backend + frontend)
# Usage: ./start.sh [--port-backend 8000] [--port-frontend 8080] [--host 0.0.0.0]

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
BACKEND_PORT=8000
FRONTEND_PORT=8080
HOST=0.0.0.0          # 0.0.0.0 = accessible on local network (Raspberry Pi)
LOG_DIR="$(dirname "$0")/logs"

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --port-backend)  BACKEND_PORT="$2";  shift 2 ;;
    --port-frontend) FRONTEND_PORT="$2"; shift 2 ;;
    --host)          HOST="$2";          shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/band-buddy-connect"

mkdir -p "$LOG_DIR"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[bandup]${NC} $*"; }
ok()    { echo -e "${GREEN}[bandup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[bandup]${NC} $*"; }
error() { echo -e "${RED}[bandup]${NC} $*"; }

# ── Prerequisite checks ───────────────────────────────────────────────────────
info "Checking prerequisites..."

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command not found: $1"
    echo "  Install it with: $2"
    exit 1
  fi
}

check_cmd uv    "curl -LsSf https://astral.sh/uv/install.sh | sh"
check_cmd node  "sudo apt install nodejs  (or use nvm)"
check_cmd npm   "sudo apt install npm"

# ── .env check ────────────────────────────────────────────────────────────────
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  error "backend/.env not found."
  echo ""
  echo "  Copy the example and fill in your values:"
  echo "    cp backend/.env.example backend/.env"
  echo ""
  echo "  Required keys:"
  echo "    DATABASE_URL   — PostgreSQL connection string"
  echo "    GEMINI_API_KEY — Google AI Studio key (aistudio.google.com)"
  exit 1
fi

if ! grep -q "GEMINI_API_KEY=." "$BACKEND_DIR/.env" 2>/dev/null; then
  warn "GEMINI_API_KEY appears empty in backend/.env — AI chat will return 500 errors."
fi

# ── PostgreSQL check ──────────────────────────────────────────────────────────
if command -v pg_isready &>/dev/null; then
  if ! pg_isready -q 2>/dev/null; then
    warn "PostgreSQL doesn't seem to be running."
    echo "  Start it with:  sudo systemctl start postgresql"
    read -rp "  Continue anyway? [y/N] " yn
    [[ "$yn" =~ ^[Yy]$ ]] || exit 1
  else
    ok "PostgreSQL is ready."
  fi
else
  warn "pg_isready not found — skipping PostgreSQL check."
fi

# ── Port collision check ──────────────────────────────────────────────────────
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
     lsof -i ":${port}" &>/dev/null 2>&1; then
    warn "Port $port is already in use. The server may fail to start."
  fi
done

# ── DB creation ───────────────────────────────────────────────────────────────
# Parse DB name from DATABASE_URL (postgresql://user:pass@host:port/dbname)
DB_URL=$(grep "^DATABASE_URL=" "$BACKEND_DIR/.env" | cut -d'=' -f2-)
DB_NAME=$(echo "$DB_URL" | sed 's|.*\/||' | sed 's|?.*||')

if [[ -n "$DB_NAME" ]]; then
  info "Ensuring database '$DB_NAME' exists..."
  if psql -U postgres -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
    ok "Database '$DB_NAME' already exists."
  else
    if psql -U postgres -c "CREATE DATABASE \"$DB_NAME\";" >> "$LOG_DIR/migrations.log" 2>&1; then
      ok "Database '$DB_NAME' created."
    else
      warn "Could not auto-create database (may need sudo or peer auth)."
      warn "Run manually:  sudo -u postgres psql -c \"CREATE DATABASE $DB_NAME;\""
      read -rp "  Continue anyway? [y/N] " yn
      [[ "$yn" =~ ^[Yy]$ ]] || exit 1
    fi
  fi
else
  warn "Could not parse DB name from DATABASE_URL — skipping auto-create."
fi

# ── DB migrations ─────────────────────────────────────────────────────────────
info "Running database migrations..."
cd "$BACKEND_DIR"
if uv run alembic upgrade head >> "$LOG_DIR/migrations.log" 2>&1; then
  ok "Migrations applied."
else
  error "Migrations failed — check $LOG_DIR/migrations.log"
  exit 1
fi

# ── Frontend deps ─────────────────────────────────────────────────────────────
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  info "Installing frontend dependencies (first run)..."
  cd "$FRONTEND_DIR" && npm install --silent
fi

# ── Cleanup on exit ───────────────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  info "Shutting down..."
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null && ok "Backend stopped."
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Start backend ─────────────────────────────────────────────────────────────
info "Starting backend on $HOST:$BACKEND_PORT ..."
cd "$BACKEND_DIR/app"
uv run uvicorn main:app \
  --host "$HOST" \
  --port "$BACKEND_PORT" \
  >> "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready (up to 15 s)
for i in $(seq 1 15); do
  if nc -z 127.0.0.1 "$BACKEND_PORT" 2>/dev/null; then
    ok "Backend is up. (PID $BACKEND_PID)"
    break
  fi
  sleep 1
  if [[ $i -eq 15 ]]; then
    error "Backend did not start within 15 s — check $LOG_DIR/backend.log"
    kill "$BACKEND_PID" 2>/dev/null
    exit 1
  fi
done

# ── Start frontend ────────────────────────────────────────────────────────────
info "Starting frontend on $HOST:$FRONTEND_PORT ..."
cd "$FRONTEND_DIR"
VITE_DEV_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT" \
  npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" \
  >> "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 3
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  error "Frontend failed to start — check $LOG_DIR/frontend.log"
  kill "$BACKEND_PID" 2>/dev/null
  exit 1
fi
ok "Frontend is up. (PID $FRONTEND_PID)"

# ── Print access info ─────────────────────────────────────────────────────────
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  BandUp AI is running${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Frontend   http://${LOCAL_IP:-localhost}:$FRONTEND_PORT"
echo -e "  Backend    http://${LOCAL_IP:-localhost}:$BACKEND_PORT"
echo -e "  API docs   http://${LOCAL_IP:-localhost}:$BACKEND_PORT/docs"
echo -e "  Logs       $LOG_DIR/"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# ── Tail logs ────────────────────────────────────────────────────────────────
wait
