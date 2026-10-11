// jest-axe ships no types, and @types/jest-axe pulls in Jest's global types, which clash with
// Vitest's. This declares only the API the tests use.
declare module 'jest-axe' {
  interface AxeResults {
    violations: unknown[];
  }

  interface MatcherResult {
    actual: unknown;
    message: () => string;
    pass: boolean;
  }

  export function axe(
    html: Element | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>;
  export function configureAxe(options?: Record<string, unknown>): typeof axe;
  export const toHaveNoViolations: {
    toHaveNoViolations: (results: AxeResults) => MatcherResult;
  };
}
