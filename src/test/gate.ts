/**
 * A promise the test opens when it's ready. Use it to hold a mocked response so the test can
 * check a pending state (a disabled button, a spinner) without racing a timer.
 *
 * @example
 * const gate = createGate();
 * server.use(http.post(url, async () => { await gate.opened; return HttpResponse.json({}); }));
 * // ...submit, assert the pending state...
 * gate.open();
 */
export function createGate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}
