import { describe, it, expect, afterEach } from 'vitest';
import { computeServerThemeCSS } from '../theme/serverThemeCSS';
import { globalThemeSliceRegistry } from '../theme/slice';

describe('computeServerThemeCSS -- rootVariablesCSS is safe to render into a <style> tag (#831)', () => {
  afterEach(() => {
    (globalThemeSliceRegistry as unknown as { slices: Map<string, unknown> }).slices.delete('hostile-test');
  });

  const registerHostile = (vars: Record<string, string>) =>
    globalThemeSliceRegistry.register({
      id: 'hostile-test',
      name: 'Hostile',
      category: 'Global' as never,
      defaultState: {},
      getCSSVariables: () => vars,
    });

  it('drops a declaration whose value could close the style tag or the rule', () => {
    registerHostile({
      '--ai-evil-tag': 'red</style><script>alert(1)</script>',
      '--ai-evil-rule': 'red; } body { display: none',
      '--ai-fine': '0.5rem',
    });
    const css = computeServerThemeCSS().rootVariablesCSS;
    expect(css).not.toContain('</style>');
    expect(css).not.toContain('<script>');
    expect(css).not.toContain('--ai-evil-tag');
    expect(css).not.toContain('--ai-evil-rule');
    expect(css).toContain('--ai-fine: 0.5rem;');
  });

  it('drops a declaration whose name is not a custom property', () => {
    registerHostile({ 'color: red; --x': '1', '--ai-ok': '1' });
    const css = computeServerThemeCSS().rootVariablesCSS;
    expect(css).not.toContain('color: red');
    expect(css).toContain('--ai-ok: 1;');
  });

  it('leaves every generated default declaration in place', () => {
    const css = computeServerThemeCSS().rootVariablesCSS;
    expect(css).toContain('--ai-color-primary:');
    expect(css).toContain('--ai-font-family:');
    expect(css.split('\n').filter((l) => l.trim().startsWith('--')).length).toBeGreaterThan(200);
  });
});
