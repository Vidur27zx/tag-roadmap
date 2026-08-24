# GI-Market Project Tracker

A shared client checklist and team project board for GI-Market. It keeps task status, milestone structure, progress, and editor attribution synchronized for everyone using the live link.

## Views

- **Client view** presents a clear phase-by-phase checklist.
- **Team view** includes the full roadmap and a kanban board.
- Task status updates are attributed to the person who made them.
- Structural changes are protected by the team edit password and verified on the server.

## Development

Copy the required environment values into `.env.local`, then run:

```bash
npm install
npm run dev
```

The production build is created with `npm run build`.
