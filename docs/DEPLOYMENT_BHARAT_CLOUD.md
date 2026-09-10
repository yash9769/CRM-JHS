# Deploying the CRM to Bharat Cloud (aaPanel)

Two environments, same VM (the one already running the vendor management app under
aaPanel), managed the same way: push-to-deploy via GitHub Actions over SSH.

| Environment | Branch        | Directory on VM           | Frontend port | Backend port |
|-------------|---------------|----------------------------|----------------|---------------|
| Staging     | `development` | `~/apps/crm-staging`       | 8030           | 8035          |
| Production  | `production`  | `~/apps/crm-production`    | 8040           | 8045          |

Pushing to `development` deploys to staging; pushing to `production` deploys to
production. Each is a separate git checkout, separate `.env`, separate Docker Compose
project (containers, volumes, network) — they don't share a database or interfere with
each other, they just happen to live on the same box as vendor.

**Architecture per environment**: a `frontend` container (nginx serving the built React
SPA, and reverse-proxying `/api/` to the backend container internally — so the browser
never needs CORS or a build-time API URL) and a `backend` container (Fastify API), each
published on their own host port. `postgres` is a third container but is **not**
published to the host — only the backend container can reach it. This matches vendor's
choice of not exposing the database to the internet, while still giving the frontend and
backend their own reachable ports, as you asked.

---

## 1. Open the ports

The VM already has aaPanel and Docker installed (from the vendor deployment), so skip
straight to ports. Two places need every port opened, or traffic won't get through even
if one of them allows it:

- **Bharat Cloud's firewall/security-group console** (TCP, inbound): **8030, 8035, 8040,
  8045**, alongside whatever's already open for vendor (8010/8020) and SSH.
- **aaPanel's own firewall**: Security → Firewall → Add Port Rule, for the same four
  ports (TCP).

## 2. Note on the existing Postgres

You mentioned Postgres may already be running on this VM — that's fine and expected
(vendor's own `db` container, or a native install). This setup's `postgres` container is
**not** published to the host at all (no `ports:` entry), so it can't collide with
anything already bound to 5432. If you ever need to reach this CRM's database directly
from the VM (e.g. `psql`, pgAdmin), do it via `docker compose exec postgres psql -U
crm_admin -d crm_staging` from inside the checkout directory rather than exposing a host
port.

## 3. Deploy key (same one-time step as vendor, if not already done)

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<your github-actions-deploy public key>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

If the vendor deploy key is already on this VM and you're fine reusing it for this repo
too, you can skip generating a new one — just reuse the same `SSH_PRIVATE_KEY` secret
value in this repo's GitHub Actions secrets (step 4).

That's it for the VM side — **the workflows below bootstrap everything else
themselves**: cloning the repo into `~/apps/crm-staging` / `~/apps/crm-production` on
their first run, and writing each directory's `.env` from GitHub secrets if it isn't
there yet. Nothing left to clone or configure by hand.

---

## 4. GitHub repo setup

In the `yash9769/CRM-JHS` repo: **Settings → Secrets and variables → Actions → New
repository secret**, add:

- `SSH_HOST` — the VM's IP address
- `SSH_USER` — the VM user the deploy key is set up for
- `SSH_PRIVATE_KEY` — full contents of the private key file (the whole
  `-----BEGIN...-----`/`-----END...-----` block)
- `SSH_PORT` — only if SSH runs on something other than 22
- `PROD_POSTGRES_PASSWORD` and `PROD_JWT_SECRET` — generate with
  `openssl rand -base64 24` and `openssl rand -base64 48` respectively
- `STAGING_POSTGRES_PASSWORD` and `STAGING_JWT_SECRET` — generate **different** values
  than production's, same commands

Push to `development` → GitHub Actions SSHes in, clones the repo into
`~/apps/crm-staging` if it's not there yet, writes `.env` from the two `STAGING_*`
secrets if one doesn't exist yet, then builds and starts the stack on ports 8030/8035.
Push (merge) to `production` → the same thing happens in `~/apps/crm-production`, using
the `PROD_*` secrets and ports 8040/8045. Both are also runnable on-demand from the
Actions tab (`workflow_dispatch`) without a new commit — useful for the very first
deploy.

Confirm it worked:
```bash
curl http://<VM_IP>:8035/api/v1/health   # staging backend
curl http://<VM_IP>:8030/                # staging frontend
curl http://<VM_IP>:8045/api/v1/health   # production backend
curl http://<VM_IP>:8040/                # production frontend
```
Each health check should return `{"status":"ok"}`.

**Both databases start empty** — no seeded users. See "First user" below.

### See it in aaPanel

Once both have deployed at least once: Docker plugin → Compose (or "Container Manage" /
"Compose Manage") → Import, pointing at `~/apps/crm-production/docker-compose.yml` (and
the staging one separately). This just gives you a UI over the same containers/logs/
restart controls — it doesn't change how they got deployed.

---

## 5. First user

Unlike a system that needs a manually-inserted admin row, this app has a public
self-service registration endpoint that creates a brand-new tenant with its first user
(role `SENIOR_PARTNER`) in one step. Just open the deployed frontend
(`http://<VM_IP>:8030` for staging, `http://<VM_IP>:8040` for production) and register
through the UI — no SSH or SQL required. Do this once per environment with real
credentials; don't reuse the seed script's test accounts (`Password123!` etc.) anywhere
near production.

If you'd rather load the existing demo dataset (useful for staging only):
```bash
cd ~/apps/crm-staging
docker compose exec backend npx tsx prisma/seed_yash.ts
```

---

## 6. Later: domain + subdomains via aaPanel

When you have a domain, aaPanel's Website manager does the reverse proxy + SSL work
you'd otherwise hand-write in nginx:

1. Website → Add Site, for `crm.yourcompany.in`, no PHP/static root needed.
2. On that site, add a **Reverse Proxy** rule → target `http://127.0.0.1:8040`
   (production frontend; its own nginx already proxies `/api/` to the backend
   container, so this one rule covers the whole app).
3. SSL tab → Let's Encrypt → issue a free cert for it. aaPanel handles renewal.
4. Repeat for a staging subdomain (e.g. `staging.yourcompany.in`) pointing at
   `127.0.0.1:8030`, if you want staging reachable by domain too.

No changes to the app or containers needed for any of this.

---

## Note for whoever maintains the `production` branch

The `production` branch already has its own `docker-compose.yml` / `backend/Dockerfile`
/ `frontend/Dockerfile` from an earlier deployment attempt, and they have three bugs
worth fixing before relying on them:

1. `docker-compose.yml` published Postgres on host port `5432:5432` — exposes the
   database to the internet.
2. Each service had a pinned `container_name` (`crm_postgres`, `crm_backend`,
   `crm_frontend`) — if staging and production ever run on the same Docker host (as
   they will here), the second `docker compose up` would fail with a name collision.
3. `backend/Dockerfile`'s runner stage ran `npm ci --omit=dev`, which strips out the
   `prisma` CLI (a devDependency) — so the documented
   `docker compose exec backend npx prisma migrate deploy` step would fail at runtime
   with that image.

This branch's versions of those three files fix all three (no published DB port, no
pinned container names, and the backend image keeps its full `node_modules` so
`prisma migrate deploy` runs automatically on container start). When `development` next
merges into `production`, these fixed versions will replace the old ones — no action
needed beyond a normal merge.
