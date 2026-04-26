# Punchi Pal — Frontend TODO

Tracks remaining work on the `frontend/figma` branch. Grouped by category.

## Backend wiring
- [ ] `app/page.tsx` — replace splash timeout with real auth check (session → `/feed`, else → `/welcome`)
- [ ] `app/login/page.tsx` — POST credentials to `/api/auth/login`, handle errors
- [ ] `app/signup/page.tsx` — POST to `/api/auth/signup`, handle validation errors
- [ ] `app/create/new/page.tsx` — POST canvas data to `/api/client/image` as multipart on save
- [ ] `lib/mock-data.ts` — replace all mock arrays with calls to `NEXT_PUBLIC_ORCHESTRATOR_URL`
- [ ] Add real Auth0 env vars to `.env.local` (see `lib/auth0.ts`)
- [ ] Set `NEXT_PUBLIC_ORCHESTRATOR_URL` in `next.config.mjs` rewrites
- [ ] Auth0 device pairing UI for the Pi (show `user_code` + `verification_uri_complete`)

## UI polish (per plan.md)
- [ ] Feed: confirm "infinite loop within same day" once real entries exist
- [ ] Feed: daily reset behavior (UI signal that yesterday is archived)
- [ ] Create editor: implement actual drawing (currently click-to-place stub)
- [ ] Create editor: image upload + clip into stamp shape
- [ ] Create editor: drag, resize, rotate, layer for placed images
- [ ] Create editor: undo/redo
- [ ] Profile: weekly summary collage of selected stamps (currently placeholder rows)
- [ ] Profile: link rows to past entries
- [ ] Settings page (`/settings` route — gear icon currently routes there but page is missing)
- [ ] Forgot password page (`/forgot` route — link exists, page missing)
- [ ] "Summarize My Day" button (UI only) — not yet placed anywhere
- [ ] People list: real friend names instead of "Friend Name" placeholder

## Components / structure
- [ ] Replace placeholder avatar glyph (`⌒`) with actual avatar component
- [ ] Replace toolbar emoji icons (`✎ ☺ T ⌷`) with proper SVG icons
- [ ] Settings gear, like heart, back arrows — swap for icon set (lucide-react or similar)
- [ ] Extract repeated styles (field input, pill button) into shared style modules
- [ ] Add desktop sidebar variant per plan.md (currently mobile-only nav)

## Animation / interaction
- [ ] Feed swipe: add velocity-based momentum (currently snaps on threshold only)
- [ ] Modal flip-in: tune timing curve per Figma intent
- [ ] Loading + error + success states for all async actions

## Tech debt
- [ ] Move inline styles to CSS modules for better caching
- [ ] Add proper TypeScript types for all event handlers
- [ ] Lighthouse pass — verify Raspberry Pi performance target
- [ ] Replace `crypto.randomUUID()` calls with SSR-safe ID generation if needed
