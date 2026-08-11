import { describe, it, expect, vi, afterEach } from 'vitest';
import { warnIfLegacyStyleProps } from '../theme/safeProps';

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
