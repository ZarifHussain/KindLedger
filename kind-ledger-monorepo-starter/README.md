
# Kind Ledger — Full-stack TypeScript Monorepo (Starter)

Includes:
- Next.js 14 web (Tailwind, minimal UI)
- Express API + Prisma + Postgres
- BullMQ + Redis (stubs)
- OAuth stubs for Xero/QBO
- CSV import stub
- Multi-tenant Prisma schema + seed
- TurboRepo + pnpm, Docker Compose for DB/cache

## Quick start
```bash
# 0) Tools
node -v || (curl https://get.volta.sh | bash && source ~/.zshrc && volta install node@20)
corepack enable && corepack prepare pnpm@9 --activate
docker compose up -d

# 1) Install
pnpm i

# 2) Env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3) DB schema + seed
pnpm generate
pnpm migrate
pnpm seed

# 4) Run
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:4001  (health: /health)
```
