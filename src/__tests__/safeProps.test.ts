import { describe, it, expect, vi, afterEach } from 'vitest';
import { warnIfLegacyStyleProps, resolveIsDev } from '../theme/safeProps';

describe('warnIfLegacyStyleProps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when a style prop is present', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfLegacyStyleProps({ style: { color: 'red' } }, 'Card');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('<Card>'));
  });

  it('warns when a className prop is present', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfLegacyStyleProps({ className: 'foo' }, 'Card');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not warn when neither prop is present', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfLegacyStyleProps({ children: 'hi' }, 'Card');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('resolveIsDev', () => {
  it('trusts import.meta.env.DEV when it is a real boolean, even false', () => {
    expect(resolveIsDev(true, 'production')).toBe(true);
    expect(resolveIsDev(false, 'development')).toBe(false);
  });

  it('falls back to process.env.NODE_ENV when the DEV signal is absent', () => {
    expect(resolveIsDev(undefined, 'development')).toBe(true);
    expect(resolveIsDev(undefined, 'production')).toBe(false);
  });

  it('defaults to true (warn) when neither signal is available', () => {
    expect(resolveIsDev(undefined, undefined)).toBe(true);
  });
});
