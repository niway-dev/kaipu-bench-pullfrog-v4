---
title: Console on admin-kit and Labs — design
description: The Console mounts @niway/admin-kit's panel and authorizes through the kit's access policies; feature flags are a typed registry in code with their state in Kaipu's API through the kit's features add-on; Settings gains a Labs section where a signed-in user opts into experiments the owner made available; PostHog keeps analytics only; Cloudflare Access goes in front at deploy time.
---

# Console on admin-kit and Labs — design

**Status: 🔵 Proposed · 2026-11-05.** Decisions approved by Cristian in chat on 2026-11-05;
implementation not started. ADRs: [0048](/architecture/decisions/0048-console-is-the-admin-kit-panel-authorized-by-its-policies/)
and [0049](/architecture/decisions/0049-flags-are-a-typed-registry-with-state-in-our-api-labs-is-user-opt-in/).
Linear: [NIW2-657](https://linear.app/niway/issue/NIW2-657/console-on-admin-kit-and-labs-typed-flags-labs-opt-in-in-settings).
Depends on admin-kit [NIW2-653](https://linear.app/niway/issue/NIW2-653) (access policies),
[NIW2-654](https://linear.app/niway/issue/NIW2-654) (features add-on) and
[NIW2-656](https://linear.app/niway/issue/NIW2-656) (public npm), and on the kit's early-access
add-on ([NIW2-248](https://linear.app/niway/issue/NIW2-248)) merging first.

## Summary (one minute)

The Console never ran until 2026-11-05 and its users table, auth proxy and allowlist are code
nobody else can reuse. The owner's admin product is `@niway/admin-kit`, so the Console becomes
the place where that kit is dogfooded: it mounts the kit's panel, and "who is an admin" is a
policy chain the kit evaluates (the current comma-separated user-id allowlist is one policy;
`adminSince` on the owner's user row is the default). Feature flags stop being PostHog's: the
desktop app keeps its typed registry in code, the state (on, off, targeted, granted, opt-in) lives
in Kaipu's API through the kit's `features` add-on, the desktop reads one endpoint with its
session and drops every key it does not know, and a new Labs section in Settings lets a signed-in
user opt into experiments the owner made available from the Console. PostHog keeps analytics.
Release flags (NIW2-603) migrate later. Cloudflare Access is added in front of console.kaipu.app
only when the Console is deployed, as an outer door; the kit's session stays the inner one.

| #   | Decision                                                                                                                                                          | Why                                                                                                   | ADR         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| 1   | `apps/console` stays a separate Worker and mounts `<AdminPanel>` from `@niway/admin-kit/admin`; its hand-written users table stays until the kit has a users section | The owner wants the Console to be admin-kit; a separate Worker keeps the operator surface off kaipu.app | 0048 (new)  |
| 2   | The kit's add-ons install in `infra-auth` (Better Auth plugins), so admin logic lives in the API; the Console's own auth proxy and allowlist code are deleted         | The kit is a Better Auth plugin set; the Console becomes a shell over the API                          | 0048 (new)  |
| 3   | Admin authorization is the kit's policy chain: `adminSince()` by default, plus `users(CONSOLE_ADMIN_USER_IDS)` during the transition                                 | One mechanism, declared in the backend; the allowlist survives as a policy                              | 0048 (new)  |
| 4   | Flags: typed registry in code (`packages/domain`, pinned in `src/shared/analytics.ts` by a test), state in the API via the kit's `features` add-on                   | The server never sends code; only booleans for keys the app already compiled against                    | 0049 (new)  |
| 5   | The desktop reads `GET /api/v1/me/flags` (proxy to the kit's `features/me`) with its bearer session on launch and on sign-in; caches the last map; offline uses defaults | Same shape as `/me/entitlements`; offline-first                                                       | 0049 (new)  |
| 6   | Labs: a Settings child `/settings/labs`, visible only when signed in, listing registry keys with `labs: true` whose remote availability is on; a toggle per key writes `features/opt-in` | The user chooses; the owner controls availability; release flags never appear                          | 0049 (new)  |
| 7   | PostHog keeps analytics and exception capture; `useFlag` reads the new map; release flags (NIW2-603) migrate in a later amendment                                      | "Después" (owner); one migration at a time                                                            | —           |
| 8   | Cloudflare Access in front of console.kaipu.app at deploy time, policy "email is the owner's"; the Worker verifies the JWT `aud`                                       | Outer door against bots and stolen credentials; not part of local development                           | —           |
| 9   | Supersedes the Console spec's "no new admin REST API on server-hono"                                                                                                   | The kit's endpoints are that API                                                                        | 0048 (new)  |

## Open questions

- **Signed-out desktop users and global kill switches.** admin-kit's spec recommends `features/me`
  answering for signed-out callers with modes and defaults only. Default: adopt it, so a kill
  switch reaches every install. (Kaipu side has nothing to decide beyond consuming it.)
- **Where the Labs copy lives.** Default: in `packages/i18n` under `settings.labs.<key>`, not in
  the registry; the kit recommends clients own the copy.
- **The first Labs experiment.** Default: `native-cursor-capture` (currently off behind the flag).

## Out of scope

Deploying the Console (its own ticket, after the kit lands); percentage rollouts; an MCP server over
the flags (later, in admin-kit); migrating `bypass-login` and the NIW2-603 release-flag workflow;
making all of Settings require sign-in (only Labs does).

## Failures this must protect against

- The API returns a key the desktop does not know and the renderer evaluates or crashes on it.
- A user enables an experiment the owner has not made available (opt-in without `optInAllowed`).
- The desktop treats an unreachable API as "everything on".
- A release flag (owner-only) appears in Labs because its registry entry gained `labs` by mistake.
- The Console's old allowlist path is deleted before the kit's policy grants the owner.
- The preload bundle takes a value import from `@kaipu/domain` for the registry (CLAUDE.md rule).

## Acceptance criteria

- [ ] `bun run --filter console test` passes with the kit's panel mounted and the old auth proxy,
      `auth-client.ts` and `access.ts` removed.
- [ ] Signing in to the Console with the owner's account shows the kit's panel; a non-admin sees the
      kit's 403 with the policy reason.
- [ ] `GET /api/v1/me/flags` returns only registry keys; a unit test proves the desktop drops an
      unknown key and keeps its default.
- [ ] `/settings/labs` is absent when signed out and lists only `labs` keys whose availability is on;
      toggling writes the opt-in and the effective value changes on the next read.
- [ ] `ui-map.ts` declares `settingsLabs` with `gatedBy: [{ account: "signed-in" }]`; the catalog
      coverage test passes.
- [ ] A test in `src/shared/` pins the literal registry against `@kaipu/domain`'s export.
- [ ] Docs: this spec, the two ADRs, the Console spec's status line, and a `features/labs` page
      once validated.

## Detail

### Console

- `apps/console/src/routes/index.tsx` renders `<AdminPanel client={createAdminKitClient({ baseURL: window.location.origin })} branding={{ appName: "Kaipu Console" }} />`.
- The existing `/api/auth/$` proxy stays as a generic proxy to the API (the kit's endpoints live
  under `/api/auth/*`), with the allowlist of paths replaced by the kit's path prefixes
  (`/waitlist`, `/early-access`, `/features`, `/admin-kit`) plus `sign-in/email`, `sign-out`,
  `get-session`.
- `requireConsoleAdmin` and `access.ts` are deleted; the users table calls the API instead of the
  database once the kit has a users section (until then it stays as is, behind the kit's 403).
- `infra-auth`: `plugins: [bearer(), adminKit({ access: { policies: [adminSince(), users(env.CONSOLE_ADMIN_USER_IDS)] } }), earlyAccess({ features }), features({ registry })]`.
- `db:push` adds `user.admin_since`, `ak_feature_state`, `ak_feature_grant`, `early_access`.

### Desktop

- `packages/domain/src/flags.ts`: `FLAG_REGISTRY` typed; `apps/kaipu-record/src/shared/analytics.ts`
  keeps `FLAG_NAMES`/`FLAG_DEFAULTS` as literals and a test asserts equality with the domain export.
- `src/main/flags/`: fetch on launch and on sign-in with the bearer session, cache in `userData`,
  IPC to the renderer; `useFlag` reads it; `KAIPU_FLAG_OVERRIDES` keeps working in dev.
- `pages/settings/labs-settings.tsx`: list from the registry filtered by `labs` and by the remote
  availability map; toggles call the opt-in endpoint; copy in `packages/i18n`.
- `ui-map.ts`: `settingsLabs` route and areas (`page`, `experiment` with states `off`, `on`,
  `unavailable`).

### Local Console today

Documented in the Console spec (2026-11-05): run the API first, add both `:3002` origins to the
API's `CORS_ORIGIN`, set `CONSOLE_ADMIN_USER_IDS` to the owner's user id.

## Sources and unverified claims

- Owner's design thread with Claude, 2026-11-05 (console failing locally, Labs like T3 Code, Access
  vs Better Auth, admin-kit as the heart of the Console).
- admin-kit repository and PRs #4 to #17 (handoff `NIW2-347`), read 2026-11-05.
- Unverified: whether the dev `DATABASE_URL` in Infisical is the production Neon database (52
  users on 2026-11-05). The Console is read-only today; `db:push` for the kit's tables must not run
  against it until that is known.
