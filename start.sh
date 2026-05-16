#!/usr/bin/env bash
# start.sh — Run BandUp AI locally or in production
# Usage:
#   ./start.sh                  # dev mode (Vite dev server, hot reload)
#   ./start.sh --prod           # production mode (build frontend, nginx serves it)
#   ./start.sh --port-backend 5000 --port-frontend 8080 --host 0.0.0.0

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
BACKEND_PORT=5000
FRONTEND_PORT=8080
HOST=0.0.0.0
PROD_MODE=false

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --prod)            PROD_MODE=true;         shift ;;
    --port-backend)    BACKEND_PORT="$2";      shift 2 ;;
    --port-frontend)   FRONTEND_PORT="$2";     shift 2 ;;
    --host)            HOST="$2";              shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
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

if [[ "$PROD_MODE" == "true" ]]; then
  check_cmd nginx "sudo apt install nginx"
  check_cmd certbot "sudo apt install certbot python3-certbot-nginx"
fi

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
  if [[ "$PROD_MODE" == "true" ]]; then
    echo "    IS_ON_PROD=true"
    echo "    BASE_URL=https://backend.bandup-ai.com"
    echo "    FRONTEND_URL=https://bandup-ai.com"
    echo "    ALLOWED_ORIGINS=https://bandup-ai.com,https://www.bandup-ai.com"
  fi
  exit 1
fi

if ! grep -q "GEMINI_API_KEY=." "$BACKEND_DIR/.env" 2>/dev/null; then
  warn "GEMINI_API_KEY appears empty in backend/.env — AI chat will return 500 errors."
fi

if [[ "$PROD_MODE" == "true" ]]; then
  if ! grep -q "IS_ON_PROD=true" "$BACKEND_DIR/.env" 2>/dev/null; then
    warn "IS_ON_PROD is not set to true in backend/.env — running in dev mode with permissive CORS."
  fi
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
if [[ "$PROD_MODE" == "false" ]]; then
  for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      warn "Port $port is already in use. The server may fail to start."
    fi
  done
fi

# ── DB user + database creation ───────────────────────────────────────────────
# Parse postgresql://user:pass@host:port/dbname
DB_URL=$(grep "^DATABASE_URL=" "$BACKEND_DIR/.env" | cut -d'=' -f2-)
DB_USER=$(echo "$DB_URL" | sed 's|postgresql://||' | cut -d':' -f1)
DB_PASS=$(echo "$DB_URL" | sed 's|postgresql://[^:]*:||' | cut -d'@' -f1)
DB_NAME=$(echo "$DB_URL" | sed 's|.*\/||'  | sed 's|?.*||')

pg_admin() { sudo -u postgres psql -v ON_ERROR_STOP=1 -c "$1" 2>&1; }

if [[ -n "$DB_USER" && -n "$DB_NAME" ]]; then
  info "Ensuring PostgreSQL user '$DB_USER' exists..."
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1; then
    ok "User '$DB_USER' already exists."
  else
    if pg_admin "CREATE USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';" >> "$LOG_DIR/migrations.log" 2>&1; then
      ok "User '$DB_USER' created."
    else
      warn "Could not auto-create user '$DB_USER'."
      echo "  Run manually:  sudo -u postgres psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\""
      read -rp "  Continue anyway? [y/N] " yn
      [[ "$yn" =~ ^[Yy]$ ]] || exit 1
    fi
  fi

  info "Ensuring database '$DB_NAME' exists..."
  if sudo -u postgres psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
    ok "Database '$DB_NAME' already exists."
  else
    if pg_admin "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" >> "$LOG_DIR/migrations.log" 2>&1; then
      ok "Database '$DB_NAME' created (owner: $DB_USER)."
    else
      warn "Could not auto-create database '$DB_NAME'."
      echo "  Run manually:  sudo -u postgres psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
      read -rp "  Continue anyway? [y/N] " yn
      [[ "$yn" =~ ^[Yy]$ ]] || exit 1
    fi
  fi

  pg_admin "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" >> "$LOG_DIR/migrations.log" 2>&1 || true
else
  warn "Could not parse DATABASE_URL — skipping auto user/db creation."
fi

# ── DB schema init ────────────────────────────────────────────────────────────
# Tables are created via CREATE TABLE IF NOT EXISTS inside Users_DB.initialize()
# which is called automatically on first request. Nothing to run here.

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
info "Starting backend on 127.0.0.1:$BACKEND_PORT ..."
cd "$BACKEND_DIR/app"
uv run uvicorn main:app \
  --host 127.0.0.1 \
  --port "$BACKEND_PORT" \
  >> "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

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

# ── Production mode: build frontend + configure nginx ─────────────────────────
if [[ "$PROD_MODE" == "true" ]]; then
  info "Building frontend for production..."
  cd "$FRONTEND_DIR"
  npm run build >> "$LOG_DIR/frontend-build.log" 2>&1
  ok "Frontend built → band-buddy-connect/dist/"

  info "Installing nginx config..."
  NGINX_AVAIL="/etc/nginx/sites-available"
  NGINX_ENABLED="/etc/nginx/sites-enabled"

  sudo cp "$SCRIPT_DIR/nginx/bandup-ai.com.conf"         "$NGINX_AVAIL/bandup-ai.com"
  sudo cp "$SCRIPT_DIR/nginx/backend.bandup-ai.com.conf" "$NGINX_AVAIL/backend.bandup-ai.com"
  sudo ln -sf "$NGINX_AVAIL/bandup-ai.com"         "$NGINX_ENABLED/bandup-ai.com"
  sudo ln -sf "$NGINX_AVAIL/backend.bandup-ai.com" "$NGINX_ENABLED/backend.bandup-ai.com"

  if sudo nginx -t >> "$LOG_DIR/nginx.log" 2>&1; then
    sudo systemctl reload nginx
    ok "Nginx reloaded."
  else
    error "Nginx config test failed — check $LOG_DIR/nginx.log"
    exit 1
  fi

  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  BandUp AI — Production${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Frontend   https://bandup-ai.com  (nginx)"
  echo -e "  Backend    https://backend.bandup-ai.com  (nginx → :$BACKEND_PORT)"
  echo -e "  Pi LAN IP  ${LOCAL_IP:-unknown}"
  echo -e "  Logs       $LOG_DIR/"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  SSL: run certbot if not already done:"
  echo "    sudo certbot --nginx -d bandup-ai.com -d www.bandup-ai.com"
  echo "    sudo certbot --nginx -d backend.bandup-ai.com"
  echo ""
  echo "  Press Ctrl+C to stop the backend."
  echo ""
  wait

# ── Dev mode: Vite dev server ─────────────────────────────────────────────────
else
  info "Starting frontend dev server on $HOST:$FRONTEND_PORT ..."
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

  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  BandUp AI — Dev${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Frontend   http://${LOCAL_IP:-localhost}:$FRONTEND_PORT"
  echo -e "  Backend    http://${LOCAL_IP:-localhost}:$BACKEND_PORT"
  echo -e "  API docs   http://127.0.0.1:$BACKEND_PORT/docs"
  echo -e "  Logs       $LOG_DIR/"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "  Press Ctrl+C to stop both servers."
  echo ""
  wait
fi
