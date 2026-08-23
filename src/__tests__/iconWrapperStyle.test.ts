import { describe, it, expect } from 'vitest';
import { ICON_WRAPPER_STYLE } from '../theme/iconWrapperStyle';

describe('ICON_WRAPPER_STYLE', () => {
  it('clips a bare icon child to its own content instead of a fallback font\'s full line box', () => {
    expect(ICON_WRAPPER_STYLE).toEqual({
      display: 'inline-flex',
      alignItems: 'center',
      lineHeight: 1,
    });
  });
});
