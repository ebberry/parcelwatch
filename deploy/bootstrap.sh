#!/usr/bin/env bash
#
# One-command Lightsail launch for ParcelWatch.
# Run from the repo root on a fresh Debian 12 box, AFTER your DNS A record
# (parcelwatch.yourdomain.com -> this box's static IP) resolves:
#
#   bash deploy/bootstrap.sh
#
# It installs Docker, generates the random secrets for you, asks only for the
# few keys you have, then builds + migrates + launches the whole stack.
# Re-running it just rebuilds (it won't overwrite an existing config).

set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

ENVF="deploy/.env.production"
COMPOSE="docker compose --env-file $ENVF -f deploy/docker-compose.yml"

say() { printf "\n\033[1;32m==>\033[0m %s\n" "$1"; }

# ---------------------------------------------------------------------------
# 1. Docker
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker, compose, git, openssl (sudo)..."
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-plugin git openssl
  sudo usermod -aG docker "$USER" || true
fi
# Use sudo for docker so it works before the group membership takes effect.
DOCKER="sudo docker"
COMPOSE="sudo $COMPOSE"

# ---------------------------------------------------------------------------
# 2. Config (only created once; safe to re-run)
# ---------------------------------------------------------------------------
if [ ! -f "$ENVF" ]; then
  say "First run — let's configure. The random secrets are generated for you."
  cp deploy/.env.production.example "$ENVF"

  read -rp "  Domain (e.g. parcelwatch.ebberry.com): " DOMAIN
  [ -n "$DOMAIN" ] || { echo "Domain is required."; exit 1; }
  read -rp "  Resend API key (re_...): " RESEND
  read -rp "  Anthropic / Claude key (sk-ant-..., Enter to skip AI summaries): " ANTHRO
  read -rp "  Census API key (Enter to skip the neighborhood panel): " CENSUS

  AUTH_SECRET="$(openssl rand -base64 32)"
  PGPASS="$(openssl rand -hex 24)"
  CRON="$(openssl rand -hex 16)"

  python3 - "$ENVF" <<PY
import sys
path = sys.argv[1]
vals = {
  "DOMAIN": "$DOMAIN",
  "AUTH_URL": "https://$DOMAIN",
  "AUTH_SECRET": "$AUTH_SECRET",
  "POSTGRES_PASSWORD": "$PGPASS",
  "DATABASE_URL": "postgres://parcelwatch:$PGPASS@db:5432/parcelwatch",
  "CRON_SECRET": "$CRON",
  "EMAIL_SERVER": ("smtps://resend:$RESEND@smtp.resend.com:465" if "$RESEND" else ""),
  "ANTHROPIC_API_KEY": "$ANTHRO",
  "CENSUS_API_KEY": "$CENSUS",
}
lines = open(path).read().splitlines()
seen = set()
out = []
for l in lines:
    k = l.split("=", 1)[0] if "=" in l and not l.lstrip().startswith("#") else None
    if k in vals:
        out.append(f"{k}={vals[k]}"); seen.add(k)
    else:
        out.append(l)
for k, v in vals.items():
    if k not in seen:
        out.append(f"{k}={v}")
open(path, "w").write("\n".join(out) + "\n")
print("  wrote", path)
PY
  echo "  Secrets generated; $ENVF is git-ignored and stays on this box only."
else
  say "Using existing $ENVF (delete it to reconfigure)."
fi

# ---------------------------------------------------------------------------
# 3. Build + launch + migrate
# ---------------------------------------------------------------------------
say "Building images and starting the stack (first build takes a few minutes)..."
$COMPOSE up -d --build

say "Creating the database tables..."
$COMPOSE run --rm web npx drizzle-kit push --force

DOMAIN_OUT="$(grep '^DOMAIN=' "$ENVF" | cut -d= -f2-)"
say "Launched. Caddy is fetching an HTTPS cert (give it ~30s)."
echo "    Open:  https://$DOMAIN_OUT"
echo "    Logs:  $COMPOSE logs -f web worker"
echo "    The worker warms the AI civic feed within ~1 minute."
