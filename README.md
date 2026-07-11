# Where Can I Watch It

**The streaming search tool that actually knows what's available in your country — including the platforms the big guys miss.**

🔗 **Live:** [wherecaniwatchit.info](https://wherecaniwatchit.info)

Search any movie or TV show and see exactly which streaming services carry it — by country, not guesswork. Built to fix a gap in tools like JustWatch, which routinely miss regional platforms outside the US/UK: this project treats Southeast Asian markets, starting with the Philippines (Vivamax, iWantTFC, Viu, WeTV), as first-class, not an afterthought.

---

## Features

- **Search any title** — movies and TV shows, matched against a live availability database.
- **Country-aware results** — availability is genuinely regional; results reflect your actual location, not a US-centric default.
- **Regional accuracy focus** — dedicated data checkers and a crowdsourced verification layer keep local-market platforms (especially PH) accurate where generic aggregators fall short.
- **Fast, responsive UI** — a modern, cache-backed search experience that works on mobile and desktop.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Caching | Upstash Redis |
| Styling / UI | Tailwind CSS + a custom design system |
| Testing | Vitest + Playwright (E2E) |
| Monitoring | Sentry (error & performance tracking) |
| CDN / DNS | Cloudflare |
| Hosting | Vercel |

## Architecture Notes

- **Typed end to end** — the codebase is ~96% TypeScript, with shared types across the client, data layer, and API routes.
- **Postgres-backed** — availability data is modeled and queried in Supabase/Postgres, with SQL migrations tracked in the repo.
- **Regional checkers** — dedicated jobs verify local-platform availability directly, rather than relying solely on a single aggregator's coverage.
- **Crowdsourced accuracy layer** — an internal review system lets contributors flag and correct availability data, with a confidence-tiered trust model backing every write.
- **Production hygiene** — Sentry instrumentation for server and edge runtimes, a full Vitest + Playwright test suite, and ESLint enforced in CI.
- **Design system** — reusable components live in a dedicated design-system workspace for consistency across the app.

## Getting Started

Clone the repo and install dependencies:

```bash
git clone https://github.com/allenmontellano/wherecaniwatchit.git
cd wherecaniwatchit
npm install
```

Copy the example environment file and add your own keys:

```bash
cp .env.local.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view it.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run test` | Run the Vitest test suite |
| `npm run lint` | Run ESLint |

## About

Designed, built, and deployed solo as an end-to-end product — data modeling, backend, UI, testing, monitoring, and deployment — using an AI-assisted development workflow.

Built by [Allen Montellano](https://www.linkedin.com/in/allen-montellano/).
