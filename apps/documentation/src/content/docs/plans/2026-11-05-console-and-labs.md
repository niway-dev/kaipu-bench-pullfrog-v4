---
title: "Plan — Console on admin-kit and Labs"
description: "Working document for NIW2-657: the units of work in Kaipu once admin-kit's policies, features add-on and public npm land. The shipping PR deletes this file."
---

# Plan — Console on admin-kit and Labs

Working document for [NIW2-657](https://linear.app/niway/issue/NIW2-657). Spec:
[Console on admin-kit and Labs — design](/specs/2026-11-05-console-on-admin-kit-and-labs-design/).
The PR that ships the last unit deletes this file; git keeps it.

## Order and dependencies

```
admin-kit  #4 early access (merge) → AK-16 policies → AK-17 features → AK-19 public npm (publish)
Kaipu      unit 0 (local run, done 2026-11-05)
           unit 1 registry + desktop reader      (needs nothing from the kit: contract only)
           unit 2 infra-auth plugins + db        (needs AK-16, AK-17 published)
           unit 3 Console mounts the panel       (needs unit 2)
           unit 4 Labs in Settings               (needs unit 1; needs unit 2 to be live)
```

Unit 1 can start now against the documented JSON contract of `GET /features/me`; the main-process
reader is written against a fake until unit 2 exists.

## Units (one PR each, Sonnet medium unless noted)

### Unit 1 — registry and desktop reader

- `packages/domain/src/flags.ts`: `FLAG_REGISTRY` (`native-cursor-capture: { default: false, labs: true }`, `bypass-login: { default: true }`), `FlagKey`, `FLAG_DEFAULTS` derived.
- `src/shared/analytics.ts` keeps the literals; `analytics.test.ts` asserts they equal the domain export (preload rule, CLAUDE.md).
- `src/main/flags/flag-store.ts`: fetch `GET /api/v1/me/flags` with the bearer session on launch and on sign-in; cache in `userData/flags.json`; drop unknown keys; defaults offline; IPC `flags:get`; `KAIPU_FLAG_OVERRIDES` still wins in unpackaged builds.
- `useFlag` reads the IPC map instead of PostHog for registry keys (PostHog stays for analytics).
- Tests: unknown key dropped; offline default; override precedence; sign-in triggers a re-read.

### Unit 2 — API: kit plugins and tables

- `packages/infra-auth`: `adminKit({ access: { policies: [adminSince(), users(CONSOLE_ADMIN_USER_IDS)] } })`, `earlyAccess({ features: [...] })`, `features({ registry })`.
- `apps/server-hono`: `/api/v1/me/flags` contract route proxying the kit's `features/me` (or documenting the direct `/api/auth/features/me` path if Eden Treaty can call it).
- `packages/infra-db`: schema for `user.admin_since`, `ak_feature_state`, `ak_feature_grant`, `early_access`; `db:push` only on a known database (spec: unverified whether dev is production).
- Tests: policy denies a non-admin; the owner's id grants; `features/me` returns registry keys only.

### Unit 3 — Console mounts the panel

- `apps/console`: `<AdminPanel>` from `@niway/admin-kit/admin`; proxy forwards the kit's path prefixes; delete `access.ts`, `session.server.ts`'s allowlist path, `auth-client.ts`; keep the users table behind the kit's 403 until the kit has a users section.
- Console spec status line updated; "How to test it yourself" with the owner's account.

### Unit 4 — Labs in Settings

- `pages/settings/labs-settings.tsx`, route `/settings/labs`, sidebar entry only when signed in (`account: "signed-in"` gate), copy in `packages/i18n` (`settings.labs.*`), toggle per `labs` key whose availability is on; writes `features/opt-in` through the API.
- `ui-map.ts`: `settingsLabs` with areas `page`, `experiment` (`off`, `on`, `unavailable`); catalog state per area (ADR 0046).
- Before code: HTML mock of the page at the owner's window size, approved in chat (memory: mock before code).
- Tests: hidden when signed out; a non-labs key never renders; toggle calls the endpoint and updates the map.

## Owner actions

- Set `CONSOLE_ADMIN_USER_IDS` and the two `:3002` origins in Infisical dev (unit 0).
- Merge admin-kit #4 and decide the NIW2-308 questions.
- Confirm which database the dev `DATABASE_URL` is before unit 2 runs `db:push`.
