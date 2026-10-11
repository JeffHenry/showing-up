# 0002: Vitest instead of Jest for unit/integration tests

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The original specification named Jest. Jest has the largest installed base in enterprise
codebases, but running it in a Vite project requires a second, separate toolchain:

- a TypeScript/JSX transform (`ts-jest`, `babel-jest`, or `@swc/jest`) that differs from the one
  Vite uses for the real build;
- a workaround for `import.meta.env`, which Jest does not support;
- duplicated path-alias configuration;
- extra jsdom polyfills for MSW's fetch interception.

The only mainstream framework with first-class Jest integration is Next.js, which would replace
the SPA + React Router architecture. That is too large a change to justify for a test runner.

## Decision

Use **Vitest** with jsdom, React Testing Library, MSW, and `jest-axe` (whose matcher works under
Vitest via `expect.extend`).

## Consequences

- Tests reuse `vite.config.ts`: same transforms, aliases, and environment handling as production.
- The API is effectively Jest's (`describe`, `it`, `expect`, `vi.fn()` in place of `jest.fn()`),
  so the patterns transfer directly to Jest codebases.
- The parts of the stack most relevant to enterprise teams (Testing Library, MSW, axe,
  Playwright) are unchanged.
- `vitest-axe` was not chosen because it is unmaintained; `jest-axe` is actively maintained.
