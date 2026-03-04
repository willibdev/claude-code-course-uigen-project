# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

UIGen — an AI-powered React component generator. Users chat with Claude to generate, iterate on, and preview React components in real time. Components are built in a virtual in-memory filesystem and rendered live in an iframe.

## Commands

```bash
npm run setup          # Install deps, generate Prisma client, run migrations
npm run dev            # Dev server with Turbopack (requires node-compat.cjs)
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Vitest (all tests)
npx vitest run src/path/to/test.ts  # Run a single test file
npm run db:reset       # Reset SQLite database (destructive)
```

## Architecture

**Next.js 15 App Router** with React 19, TypeScript, Tailwind CSS v4.

### Core Flow
1. User sends a chat message describing a component
2. `/src/app/api/chat/route.ts` streams the request to Claude (Haiku 4.5 via Vercel AI SDK)
3. Claude uses two tools to build components in a **VirtualFileSystem** (in-memory):
   - `str_replace_editor` — create/edit/view files (`/src/lib/tools/str-replace.ts`)
   - `file_manager` — rename/move/delete files (`/src/lib/tools/file-manager.ts`)
4. JSX transformer (`/src/lib/transform/jsx-transformer.ts`) converts virtual FS to browser-runnable HTML via Babel standalone + blob URL import maps
5. `PreviewFrame` renders the result in a sandboxed iframe

### State Management
React Context (no external state library):
- `ChatContext` (`/src/lib/contexts/chat-context.tsx`) — messages, streaming, AI interaction
- `FileSystemContext` (`/src/lib/contexts/file-system-context.tsx`) — virtual FS, selected file

### Auth
JWT-based with bcrypt password hashing. Anonymous users can work without signing in; their work (stored in localStorage via `anon-work-tracker.ts`) is promoted to a database project on sign-in.

### Data Layer
SQLite via Prisma. Always reference `/prisma/schema.prisma` to understand the database structure. Two models: `User` and `Project`. Projects store chat messages and file system state as JSON strings. Prisma client generates to `/src/generated/prisma`.

### AI/LLM
- Provider config: `/src/lib/provider.ts` — uses `claude-haiku-4-5`, falls back to a mock model when `ANTHROPIC_API_KEY` is unset
- System prompt: `/src/lib/prompts/generation.tsx` — instructs Claude to create React+Tailwind components with `/App.jsx` as root entry point, using `@/` import alias

## Key Conventions

- Path alias: `@/*` maps to `./src/*`
- UI components: Shadcn (new-york style) in `/src/components/ui/`
- Styling: Tailwind classes via `cn()` utility (clsx + tailwind-merge)
- Server Actions in `/src/actions/`
- Tests co-located in `__tests__/` directories, using Vitest + Testing Library (jsdom)
- Virtual FS paths are always normalized with a leading `/`
- Use comments sparingly — only comment complex, non-obvious code

## Environment

`ANTHROPIC_API_KEY` in `.env` (optional — mock model used if absent). `JWT_SECRET` defaults to a dev value and must be set in production.
