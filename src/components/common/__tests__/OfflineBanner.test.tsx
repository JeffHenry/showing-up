import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '@/components/common/OfflineBanner';

function goOffline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

function goOnline() {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

describe('OfflineBanner', () => {
  it('stays empty while online', () => {
    render(<OfflineBanner />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('announces when the connection drops and clears when it returns', () => {
    render(<OfflineBanner />);

    goOffline();
    expect(screen.getByRole('status')).toHaveTextContent("You're offline.");

    goOnline();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
