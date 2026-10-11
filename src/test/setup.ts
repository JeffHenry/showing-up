import '@testing-library/jest-dom/vitest';
// Auto-cleanup only registers when `afterEach` is a global; Vitest globals are off in this project.
// eslint-disable-next-line testing-library/no-manual-cleanup
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './msw/server';

expect.extend(toHaveNoViolations);

beforeAll(() => {
  // A request without a matching handler fails the test, so tests never reach a real network.
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
