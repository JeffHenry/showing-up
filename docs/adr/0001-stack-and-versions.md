# 0001: Stack and version baseline

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The project starts from an empty repository, so it can adopt current major versions. The original
specification named React 18 and React Router 6, which are now a generation behind. The current
shadcn/ui CLI targets Tailwind CSS 4 and React 19.

Not every tool has caught up with the newest majors. Peer dependency ranges checked at project
start showed:

- `typescript-eslint` supports TypeScript `>=4.8.4 <6.1.0`, so TypeScript 7 can't be linted with
  type information yet.
- `eslint-plugin-jsx-a11y` (last released 6.10.2) declares support up to ESLint 9.
- Vitest 5's `@vitest/mocker` declares an optional peer of `msw@^2.4.9`, so MSW 3 (released
  2026-09-28) is not yet compatible with the test runner. _(Added in Phase 0.2.)_

## Decision

Adopt the latest mutually compatible versions:

| Area       | Version                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------- |
| Runtime    | Node 24 (`.nvmrc`, `engines`)                                                                |
| Build      | Vite 8, `@vitejs/plugin-react` 6                                                             |
| UI runtime | React 19                                                                                     |
| Language   | TypeScript **6.0** (not 7)                                                                   |
| Routing    | React Router 8, data router mode                                                             |
| Styling    | Tailwind CSS 4, shadcn/ui (Radix base)                                                       |
| Linting    | ESLint **9** (not 10), typescript-eslint 8 strict type-checked, jsx-a11y strict, react-hooks |
| Formatting | Prettier 3 with Tailwind class sorting                                                       |
| Dates      | date-fns 4 + `@date-fns/tz` (replaces `date-fns-tz`)                                         |
| Testing    | Vitest 5, React Testing Library 16, **MSW 2** (not 3), jest-axe                              |

shadcn/ui components in `src/components/ui/` are treated as vendored code: kept close to upstream
(including file names such as `button.tsx` and helper exports such as `buttonVariants`) so future
`shadcn add` commands remain compatible.

## Consequences

- Accessibility lint rules run on every file, which was judged more valuable than being one ESLint
  major ahead.
- TypeScript 7's faster native compiler is deferred until typescript-eslint supports it.
- Three pinned-back majors must be revisited. Dependabot (Phase 0.3) will surface new releases;
  revisit when typescript-eslint widens its TypeScript range, jsx-a11y declares ESLint 10, and
  Vitest's mocker accepts MSW 3.
