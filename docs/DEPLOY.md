# Deploying ParcelWatch on AWS Lightsail

A single Lightsail instance runs the whole stack with Docker Compose: the Next
web app, the watch worker, Postgres, Redis, and Caddy (free auto-HTTPS). Flat,
predictable cost (~$10/mo), and the app runs exactly as built — no serverless
rework.

## 0. Prerequisites
- An AWS account and a domain you can edit DNS for.
- A magic-link email sender. Easiest: a free **Resend** account (gives you SMTP
  creds). Amazon SES also works but needs a one-time "production access" request.
- This repo pushed to GitHub (so you can `git clone` it on the box).

## 1. Create the Lightsail instance
- Lightsail → Create instance → Linux/Unix → **OS Only → Debian 12**.
- Plan: **$10/mo (2 GB RAM, 2 vCPU)** — needed to build the image. (The $5/512 MB
  plan is too small to run `next build`; if you must use it, build the image in
  CI/locally and pull it instead.)
- Create. Then **Networking → attach a static IP**.
- **Networking → IPv4 firewall**: add rules for **HTTP (80)** and **HTTPS (443)**.

## 2. Point your domain
- Add a DNS **A record** for your domain → the static IP. Wait for it to resolve.

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
```
Edit `deploy/.env.production`:
- `DOMAIN` / `AUTH_URL` → your domain.
- `POSTGRES_PASSWORD` → a strong password; put the **same** password inside `DATABASE_URL`.
- `AUTH_SECRET` → `openssl rand -base64 32`.
- `EMAIL_SERVER` → your Resend/SES SMTP string; `EMAIL_FROM` → a verified sender.
- `CENSUS_API_KEY` → your free Census key (optional; enables the neighborhood panel).
- `CRON_SECRET` → `openssl rand -hex 16`.

## 5. Build, migrate, launch
```bash
# Build images + start everything
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --build

# Create the database tables (one-time, and after any schema change)
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml \
  run --rm web npx drizzle-kit push --force
```
Caddy will fetch a Let's Encrypt cert automatically. Visit `https://<your-domain>`.

## 6. Verify
- `https://<domain>` loads the app over HTTPS.
- Search an address → parcel report renders.
- `/signin` → enter your email → you receive a real magic link → `/alerts` loads.
- `docker compose ... logs -f worker` shows the watch poller registering its 6h schedule.

## Updating
```bash
git pull
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d --build
# run the drizzle-kit push step again if the schema changed
```

## Backups
- Lightsail → your instance → **Snapshots** → enable automatic snapshots (cheap;
  covers the Postgres volume).
- For a logical DB backup: `docker compose ... exec db pg_dump -U parcelwatch parcelwatch > backup.sql`.

## Notes
- **Cost:** ~$10/mo flat for the instance. Marginal cost per user is ~$0 — every
  data source is free/keyless.
- **Worker:** runs in its own container, registers a repeatable 6-hour poll in
  Redis. No external cron needed. (If you ever want an external trigger,
  `POST /api/watches/poll` with `Authorization: Bearer $CRON_SECRET`.)
- **PostGIS:** not currently used. If a future feature needs it, swap the `db`
  image to `postgis/postgis:16-3.4` and `CREATE EXTENSION postgis;`.
- **Scaling later:** move Postgres to Lightsail's managed DB or RDS, and run
  multiple web containers behind a load balancer; the `SourceCache` interface is
  ready for a shared Redis cache when you do.
