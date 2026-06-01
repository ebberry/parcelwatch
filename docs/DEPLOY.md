# Deploying ParcelWatch on AWS Lightsail

A single Lightsail instance runs the whole stack with Docker Compose: the Next
web app, the watch worker, Postgres, Redis, and Caddy (free auto-HTTPS). Flat,
predictable cost (~$10/mo), and the app runs exactly as built — no serverless
rework.

## 0. Prerequisites
- An AWS account.
- **A domain is optional.** No domain yet? You'll use **sslip.io** with your
  instance's static IP (e.g. `52-10-20-30.sslip.io`) — it needs zero DNS setup
  and Caddy still gets a real HTTPS cert for it. Swap in a real domain later by
  editing two env lines + adding one A record.
- A magic-link email sender. Easiest: a free **Resend** account (SMTP creds).
  See the email note in step 4 about test-mode limits for the MVP demo.
- An **Anthropic API key** (optional) for the AI civic summaries —
  https://console.anthropic.com. Without it that feature degrades gracefully.
- This repo pushed to GitHub (so you can `git clone` it on the box).

## 1. Create the Lightsail instance
- Lightsail → Create instance → Linux/Unix → **OS Only → Debian 12**.
- Plan: **$10/mo (2 GB RAM, 2 vCPU)** — needed to build the image. (The $5/512 MB
  plan is too small to run `next build`; if you must use it, build the image in
  CI/locally and pull it instead.)
- Create. Then **Networking → attach a static IP** (note this IP — you need it).
- **Networking → IPv4 firewall**: add rules for **HTTP (80)** and **HTTPS (443)**.

## 2. Pick your hostname
- **No domain (MVP):** your hostname is `<ip-with-dashes>.sslip.io`. If your
  static IP is `52.10.20.30`, that's `52-10-20-30.sslip.io`. Nothing to configure
  — sslip.io resolves it to your IP automatically.
- **Have a domain:** add a DNS **A record** → the static IP, and use that name.

## 3. Install Docker on the box
SSH in (Lightsail browser SSH or your terminal), then:
```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER && newgrp docker
```

## 4. Get the code + configure
```bash
git clone <your-repo-url> parcelwatch && cd parcelwatch
cp deploy/.env.production.example deploy/.env.production
nano deploy/.env.production
```
Set in `deploy/.env.production`:
- `DOMAIN` / `AUTH_URL` → your hostname, e.g. `52-10-20-30.sslip.io` and
  `https://52-10-20-30.sslip.io`.
- `POSTGRES_PASSWORD` → a strong password; put the **same** password inside `DATABASE_URL`.
- `AUTH_SECRET` → run `openssl rand -base64 32`.
- `EMAIL_SERVER` → your Resend SMTP string (`smtps://resend:re_YOURKEY@smtp.resend.com:465`).
- `EMAIL_FROM` → in Resend **test mode**, keep `onboarding@resend.dev`. ⚠️ Test
  mode only delivers to **your own Resend signup email** — so for the demo, sign
  in as yourself. Verify a domain in Resend later to email anyone.
- `ANTHROPIC_API_KEY` → your Claude key (optional; enables AI civic summaries).
- `CENSUS_API_KEY` → your free Census key (optional; enables the neighborhood panel).
- `CRON_SECRET` → run `openssl rand -hex 16`.

## 5. Build, migrate, launch
```bash
# Build images + start everything (first build takes a few minutes)
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --build

# Create the database tables (one-time, and after any schema change)
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml \
  run --rm web npx drizzle-kit push --force
```
Caddy fetches a Let's Encrypt cert automatically (give it ~30s). Then visit
`https://<your-hostname>`.

## 6. Verify
- `https://<hostname>` loads the app over HTTPS (valid padlock).
- Search a Vashon address → the parcel report renders with all panels.
- `/signin` → enter **your own** email → magic link arrives → `/dashboard` loads.
- `docker compose ... logs -f worker` → the poller registers its 6h schedule and
  (with `ANTHROPIC_API_KEY` set) logs `warmed` areas + enriched counts.
- After the first worker run, the report's "In motion — your governments" panel
  shows AI summaries + relevance pills.

## Updating
```bash
git pull
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --build
# re-run the drizzle-kit push step if the schema changed
```

## Switching to a real domain later
1. Point the domain's **A record** at the same static IP.
2. Edit `deploy/.env.production`: `DOMAIN` + `AUTH_URL` → the real domain.
3. `docker compose ... up -d` (Caddy fetches a fresh cert; existing sign-ins
   re-issue against the new URL).

## Backups
- Lightsail → your instance → **Snapshots** → enable automatic snapshots (cheap;
  covers the Postgres volume).
- Logical DB dump: `docker compose ... exec db pg_dump -U parcelwatch parcelwatch > backup.sql`.

## Notes
- **Cost:** ~$10/mo flat for the instance + the AI layer (cached, pennies). Other
  data sources are free/keyless.
- **Worker:** runs in its own container, registers a repeatable 6-hour poll in
  Redis, warms the AI cache for each saved-address area, and diffs assessment +
  nearby-sales for parcel watches. (External trigger if ever needed:
  `POST /api/watches/poll` with `Authorization: Bearer $CRON_SECRET`.)
- **AI env loading:** the worker gets `ANTHROPIC_API_KEY` from Docker's injected
  env (`env_file`), not Node's `--env-file`, so it loads reliably in production.
- **PostGIS:** not currently used. If a future feature needs it, swap the `db`
  image to `postgis/postgis:16-3.4` and `CREATE EXTENSION postgis;`.
- **Scaling later:** move Postgres to Lightsail's managed DB or RDS, and run
  multiple web containers behind a load balancer; the `SourceCache` interface is
  ready for a shared Redis cache when you do.
