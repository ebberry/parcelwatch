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
# 1. Prerequisites — Docker + compose + git + python3 + openssl (OS-aware)
# ---------------------------------------------------------------------------
need_install=0
command -v docker >/dev/null 2>&1 || need_install=1
docker compose version >/dev/null 2>&1 || need_install=1
command -v git >/dev/null 2>&1 || need_install=1
command -v python3 >/dev/null 2>&1 || need_install=1

if [ "$need_install" = 1 ]; then
  if command -v apt-get >/dev/null 2>&1; then
    say "Installing prerequisites with apt (Debian/Ubuntu)..."
    sudo apt-get update -y
    sudo apt-get install -y git docker.io docker-compose-plugin python3 openssl
    sudo systemctl enable --now docker 2>/dev/null || true
  elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    PKG=dnf; command -v dnf >/dev/null 2>&1 || PKG=yum
    say "Installing prerequisites with $PKG (Amazon Linux / RHEL)..."
    # NOTE: do NOT install 'curl' here — Amazon Linux ships curl-minimal which
    # already provides it, and adding full curl causes a package conflict.
    sudo "$PKG" install -y git docker python3 openssl
    sudo systemctl enable --now docker
    if ! docker compose version >/dev/null 2>&1; then
      say "Installing the Docker Compose v2 plugin..."
      ARCH="$(uname -m)"   # x86_64 or aarch64 — matches the release asset names
      sudo mkdir -p /usr/libexec/docker/cli-plugins
      sudo curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" \
        -o /usr/libexec/docker/cli-plugins/docker-compose
      sudo chmod +x /usr/libexec/docker/cli-plugins/docker-compose
    fi
  else
    echo "Could not find apt or dnf/yum. Install git, docker, and the docker compose plugin manually, then re-run."
    exit 1
  fi
  sudo usermod -aG docker "$USER" 2>/dev/null || true
fi

# Compose v2 builds via the Buildx plugin, and needs >= 0.17. Some docker
# packages (notably Amazon Linux) ship an OLDER buildx or none — both break the
# build. Install a current one into a HIGH-PRECEDENCE cli-plugins dir so it
# overrides any stale system copy. Runs even on a re-run.
bx_ok=0
if cur="$(docker buildx version 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)"; then
  [ -n "$cur" ] && [ "$(printf '%s\nv0.17.0\n' "$cur" | sort -V | head -1)" = "v0.17.0" ] && bx_ok=1
fi
if [ "$bx_ok" = 0 ]; then
  say "Installing a current Docker Buildx plugin (the system one is missing/too old)..."
  case "$(uname -m)" in
    x86_64) BX_ARCH=amd64 ;;
    aarch64) BX_ARCH=arm64 ;;
    *) BX_ARCH=amd64 ;;
  esac
  BX_VER="$(curl -fsSL -o /dev/null -w '%{url_effective}' https://github.com/docker/buildx/releases/latest | sed 's#.*/tag/##')"
  [ -n "$BX_VER" ] || BX_VER="v0.18.0"
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/buildx/releases/download/${BX_VER}/buildx-${BX_VER}.linux-${BX_ARCH}" \
    -o /usr/local/lib/docker/cli-plugins/docker-buildx
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
  docker buildx version 2>/dev/null | head -1 || true
fi

# Use sudo for docker so it works before the group membership takes effect.
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
