# Workspace

## Overview

**Nexus Builder** — AI Website Builder full-stack web app. Users register/log in, describe a website, choose between OpenAI GPT-5.2 or Claude Sonnet 4.6, and get a live preview of a generated HTML landing page with hero/features/pricing/CTA sections.

- **Auth**: Session-based login/register (bcrypt passwords, connect-pg-simple sessions)
- **Plans**: Free (3 generations), PRO (unlimited, $9.99 one-time via Stripe)
- **Generation**: Async job queue — POST returns `taskId`, frontend polls `/api/status/:taskId` every 2s
- **Caching**: Checks DB for identical (prompt+userId) before generating
- **Rate limiting**: 10 generations/minute per user (express-rate-limit)
- **Stripe**: Sandbox integrated via Replit connection API. Pro Plan seeded with `src/scripts/seed-products.ts`
- **Project URLs**: Each site saved to DB and viewable at `/api/project/:id`
- **AI providers**: OpenAI GPT-5.2 and Anthropic Claude Sonnet 4.6 via Replit AI Integrations

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Sessions**: express-session + connect-pg-simple (PostgreSQL session store)
- **Auth**: bcrypt password hashing
- **Payments**: Stripe (stripe + stripe-replit-sync via Replit connection)
- **Rate limiting**: express-rate-limit
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Wouter router + TanStack Query

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── ai-builder/              # React + Vite frontend (port from $PORT)
│   │   └── src/
│   │       ├── pages/           # Home, Login, Register, Dashboard
│   │       ├── components/      # Sidebar, PromptSection, BrowserPreview
│   │       └── hooks/           # use-auth, use-builder
│   └── api-server/              # Express API server
│       └── src/
│           ├── routes/          # auth.ts, generate.ts, stripe.ts, health.ts
│           ├── scripts/         # seed-products.ts (Stripe Pro Plan)
│           ├── stripeClient.ts  # Replit connection API Stripe client
│           ├── storage.ts       # Stripe data queries (stripe.* schema)
│           ├── stripeService.ts # Stripe API write operations
│           └── webhookHandlers.ts
├── lib/
│   ├── api-spec/                # OpenAPI spec + Orval codegen config
│   ├── api-client-react/        # Generated React Query hooks
│   ├── api-zod/                 # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           ├── users.ts         # users table (id, email, password, plan, stripe IDs)
│           └── generations.ts   # generations table (id, userId FK, prompt, html)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## DB Schema

### `users`
- `id` serial PK
- `email` text unique
- `password` text (bcrypt hashed)
- `plan` text default 'free' ('free' | 'pro')
- `stripe_customer_id` text nullable
- `stripe_subscription_id` text nullable
- `created_at` timestamp

### `generations`
- `id` serial PK
- `user_id` integer FK → users.id (nullable for legacy rows)
- `prompt` text
- `html` text
- `created_at` timestamp

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Create account |
| POST | /api/auth/login | — | Login |
| POST | /api/auth/logout | ✓ | Logout |
| GET | /api/auth/me | ✓ | Get current user |
| POST | /api/generate | ✓ | Start async generation → `{taskId}` |
| GET | /api/status/:taskId | ✓ | Poll task status → `{status, id, html, prompt}` |
| GET | /api/generations | ✓ | List user's generations |
| GET | /api/project/:id | — | Serve raw HTML of a generation |
| GET | /api/stripe/products | — | List Stripe products+prices |
| POST | /api/stripe/checkout | ✓ | Create Stripe checkout session → `{url}` |
| POST | /api/stripe/webhook | — | Stripe webhook (raw body, before JSON middleware) |

## Generation Flow (Async)

1. Frontend POSTs to `/api/generate` → receives `{taskId}`
2. Server starts background AI generation (fire-and-forget)
3. Frontend polls `/api/status/:taskId` every 2 seconds
4. When `status === "done"`, frontend shows preview and saves to history
5. Rate limit: 10/minute per user. Free plan limit: 3 total.
6. Cache: identical prompt+user returns existing generation instantly

## Stripe Setup

- Stripe connected via Replit integration (Sandbox mode in dev, Production in deploy)
- `stripe-replit-sync` handles webhook setup + Stripe schema (`stripe.*`) in PostgreSQL
- Pro Plan product seeded via: `pnpm --filter @workspace/api-server exec tsx src/scripts/seed-products.ts`
- On payment success, Stripe checkout redirects to `/dashboard?upgraded=1`
- Plan upgrade is handled by the webhook and `/api/stripe/success-webhook` route

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **emitDeclarationOnly** — only `.d.ts` files during typecheck; JS bundling by esbuild/tsx/vite
- **Project references** — when package A depends on B, A's `tsconfig.json` must list B in `references`

## Root Scripts

- `pnpm run build` — typecheck + recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React hooks + Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — sync Drizzle schema to DB
