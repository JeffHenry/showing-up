import 'vitest';

declare module 'vitest' {
  // Type parameters must match Vitest's declaration exactly for interface merging, so `T` stays.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    /** Asserts that a `jest-axe` audit found no accessibility violations. */
    toHaveNoViolations: () => R;
  }
}
