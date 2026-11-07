---
title: "Title bar: Back and Forward arrows"
description: "Two arrows beside the Kaipu logo move through the window's in-app navigation history, as most desktop apps do."
---

# Title bar: Back and Forward arrows

> **Status: 🟢 Ready to validate (prod review pending)** — ticket
> [NIW2-671](https://linear.app/niway/issue/NIW2-671). Follows the unified title bar
> ([NIW2-621](https://linear.app/niway/issue/NIW2-621)).

## What

Two ghost icon buttons sit after the logo and before "Kaipu Record": Back and Forward through
the pages this window visited. Back lights up once a previous in-app page exists; Forward once
the window has gone back from a further page. Both dim at the ends of the history.

## How it works

- The buttons call React Router's `navigate(-1)` and `navigate(1)`, so they are a navigation
  like any other: an editor's unsaved-edit guard (`useBlocker`) intercepts them exactly as it
  intercepts a sidebar click.
- React Router's hash history numbers every entry it creates in `history.state.idx`. "Can go
  back" is `idx > 0`. The browser never says how many entries lie ahead, so
  `use-history-position.ts` remembers the furthest index this window reached: a PUSH drops what
  was ahead, a POP moves within what exists, a REPLACE keeps the position.
- Legacy redirects (`/prepare`, `/screenshot-editor`, `/settings`) navigate with `replace`, so
  they leave no entry to land on when going back.
- Hidden on the sign-in page, under the onboarding takeover and on screens without a router
  (the title bar also draws there so the window keeps a drag handle).

## Not in this change

- Keyboard shortcuts (Cmd+[ / Cmd+]) and the mouse's side buttons.
- Electron's own `webContents` history: the arrows read only the router's history.

## UI map

Area `shell.historyArrows`, states `atStart` and `canGoBack` (catalog entries `shell/home` and
`shell/history-back`).
