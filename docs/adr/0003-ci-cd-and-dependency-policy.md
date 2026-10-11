# 0003: CI/CD pipeline and dependency vulnerability policy

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

Until Phase 0.3, quality checks ran only on a developer's machine and `main` accepted direct
pushes. A portfolio project still needs the guardrails a team would expect: nothing reaches
`main` without passing automated checks, deployments are reproducible, and dependency risk is
handled by policy rather than by whoever notices an `npm audit` warning.

At adoption time, `npm audit` reported one high-severity advisory,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (`braces` ≤3.0.3,
stack-exhaustion DoS from deeply nested glob patterns, no patched release). It is reachable only
through the dev-only `shadcn` CLI. `npm audit --omit=dev` is clean.

## Decision

**CI (GitHub Actions, `.github/workflows/ci.yml`)** runs on every PR to `main` and every push to
`main`, as two parallel jobs:

- `Quality`: `npm ci` → `format:check` → `lint` → `typecheck` → `test:coverage` (80% line gate
  enforced by Vitest) → `build`. Coverage is uploaded to Codecov via OIDC (no stored token) for
  reporting only; Codecov status checks are informational.
- `Audit`: `npm audit --omit=dev --audit-level=high`.

Workflows run with read-only tokens by default, cancel superseded runs, and pin third-party
actions to commit SHAs.

**Branch protection** is a repository ruleset on the default branch, versioned in
`.github/rulesets/main-protection.json`: PRs only, `Quality` and `Audit` must pass from the
GitHub Actions app on an up-to-date branch, review threads resolved, squash merge only, linear
history, no force-push or deletion, and **no bypass actors**. Required approvals are 0 because
GitHub does not allow approving your own PR; the automated checks are the gate.

**Deployment (Vercel):** every PR gets a preview deployment; merges to `main` deploy to
production. Because `main` only accepts PRs that passed CI, production only receives verified
commits.

**Dependency vulnerability policy:**

| Where the advisory is                     | Severity      | Action                                                       |
| ----------------------------------------- | ------------- | ------------------------------------------------------------ |
| Production dependency (ships to browsers) | High/critical | **Blocks merge** (CI `Audit` job). Fix, upgrade, or replace. |
| Production dependency                     | Low/moderate  | Dependabot alert; fix within the next dependency cycle.      |
| Development-only dependency               | Any           | Dependabot alert; triage, and record any accepted risk here. |

Dependabot opens grouped weekly PRs for npm and GitHub Actions, ignoring major upgrades that ADR
0001 deliberately holds back. Secret scanning with push protection and CodeQL default setup are
enabled on the repository.

### Accepted risks

| Advisory            | Package         | Path                                  | Why accepted                                                                                | Revisit                      |
| ------------------- | --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| GHSA-vfj7-8cjw-p6xm | `braces` ≤3.0.3 | `shadcn` → `fast-glob` → `micromatch` | Dev-only CLI; exploiting it requires attacker-controlled glob input on a developer machine. | When a patched release ships |

## Consequences

- Broken formatting, lint, types, tests, coverage, or builds cannot reach `main`, including from
  the repository owner.
- Dev-only advisories don't block work, but they are visible (Dependabot) and documented (above).
- Never run `npm audit fix --force` to clear the `braces` advisory: npm's suggested "fix"
  downgrades `shadcn` to 1.0.0.
- End-to-end tests (Playwright against preview URLs) are not yet part of CI; an `e2e` job will be
  added with the first user flow in the MVP phase.
