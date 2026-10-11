## Summary

<!-- What changes, and why? Link the roadmap phase (e.g. "Phase 0.3: CI/CD"). -->

## Verification

<!-- CI runs these automatically; tick what you also checked locally. -->

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run build`
- [ ] Checked in the browser / preview deployment (if UI changed)

## Definition of Done

<!-- Mark items that don't apply to this change as N/A. -->

- [ ] Strict types: no `any`, no `@ts-ignore` without an explanation
- [ ] Data access protected by RLS/RPC, not only UI checks
- [ ] Loading, error, empty, and success states handled
- [ ] Responsive at 375px and 1280px
- [ ] Keyboard accessible; page tests include an axe check
- [ ] Tests written alongside the change
- [ ] README updated (project status and any affected sections)

## Notes for reviewers

<!-- Trade-offs, follow-ups, or anything that needs a closer look. -->
