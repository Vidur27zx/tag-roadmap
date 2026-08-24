# Tag Roadmap

A shared client checklist and team roadmap for GI-Market. Task status, milestones, progress, and editor attribution stay synchronized for everyone using the deployed link.

[![Import into Vercel](https://vercel.com/button)](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2FVidur27zx%2Ftag-roadmap)

## Features

- **Client view** presents a clear phase-by-phase checklist.
- **Team view** includes the complete roadmap and a kanban board.
- Task status updates show who made each change.
- Adding, renaming, and deleting tasks or milestones requires the team password.
- Conflict-safe updates prevent simultaneous editors from overwriting one another.

## Deploy to Vercel

1. Import this GitHub repository into Vercel. Vercel detects it as Next.js.
2. Add a Postgres database from the Vercel Marketplace. Neon Postgres is supported.
3. Configure these environment variables for Production, Preview, and Development:
   - `DATABASE_URL`: pooled Postgres connection URL supplied by the database integration.
   - `EDIT_PASSWORD`: the shared team edit password.
4. Deploy. The tracker table and its initial board are created automatically on first use.

Vercel's production URL is detected automatically for social previews. `NEXT_PUBLIC_SITE_URL` remains available only as an optional custom-domain override.

The included `vercel.json` selects the Next.js framework and standard production build.

## Local Vercel development

Copy `.env.example` to `.env.local`, fill in the values, then run:

```bash
npm install
npm run dev
```

Validate the same production build Vercel runs with:

```bash
npm run build
```

## Existing Sites deployment

The current hosted version remains supported by the Cloudflare D1 adapter. Its local commands are:

```bash
npm run dev:sites
npm run build:sites
```

The platform-specific storage adapters share the same mutation validation, password check, and conflict-handling logic.
