import { describe, it, expect, afterEach } from 'vitest';
import { injectInteractionStyles } from '../theme/interactionStyles';

const STYLE_ID = 'toolcrib-interaction-styles';

describe('interactionStyles — shared .ai-btn/.ai-tab-trigger/.ai-focus-ring transition rule', () => {
  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  // Issue #411: the base rule's own `transition` used to be
  // `outline-color` ONLY -- a shorthand `!important` declaration, which
  // wins the whole transition-property/-duration/-timing-function set for
  // any element carrying one of these three classes (cascade never merges
  // two competing `transition` declarations across rules). That silently
  // discarded 14 real components' own inline transitions outright, not
  // just shortened them -- confirmed via direct code read, not assumed.
  // These assertions pin the fixed content directly: jsdom has no real CSS
  // parser/cascade engine (confirmed repeatedly elsewhere in this repo,
  // e.g. themeContext.test.tsx's own SSR notes), so this can only ever
  // check the injected CSS *text* is correct -- not that the cascade
  // actually resolves it a particular way in a real browser. See
  // e2e/interaction-transitions.spec.ts for the real-browser half of this
  // regression coverage.
  it('extends transition-property beyond outline-color to the real visual properties components need', () => {
    injectInteractionStyles(document);
    const css = document.getElementById(STYLE_ID)!.textContent!;

    // The base rule block (immediately after the :focus-visible/outline
    // longhand-form comment) -- isolate it so an unrelated `outline-color`
    // mention elsewhere in the file (e.g. the :focus-visible rule below
    // it) can't produce a false pass.
    const baseRuleMatch = css.match(/\.ai-btn,\s*\.ai-tab-trigger,\s*\.ai-focus-ring\s*\{([^}]+)\}/);
    expect(baseRuleMatch).not.toBeNull();
    const baseRule = baseRuleMatch![1];

    expect(baseRule).toContain('transition-property:');
    expect(baseRule).toContain('var(--ai-theme-transition-properties');
    expect(baseRule).toContain('background-color');
    expect(baseRule).toContain('border-color');
    expect(baseRule).toContain('color');
    expect(baseRule).toContain('box-shadow');
    expect(baseRule).toContain('outline-color');
    // Appended as fixed literals (issue #411's own reasoning: functional
    // requirements for THIS shared class specifically -- Combobox's
    // corner-squaring morph, :active's press-scale -- not general ambient
    // color theming a consumer might reasonably trim from
    // --ai-theme-transition-properties).
    expect(baseRule).toContain('border-radius');
    expect(baseRule).toContain('transform');
    // Still !important -- this is the ONE place that needs to win over a
    // component's own inline style (e.g. Collapsible/Checkbox/RadioGroup/
    // Rating's `all: 'unset'`), not spread onto every consumer individually.
    expect(baseRule).toMatch(/transition-property:[^;]+!important/);
    expect(baseRule).toMatch(/transition-duration:\s*var\(--ai-transition-duration-normal,\s*0\.2s\)\s*!important/);
    expect(baseRule).toMatch(/transition-timing-function:\s*var\(--ai-transition-easing,\s*ease\)\s*!important/);
  });

  it('does not regress the pre-existing outline/outline-offset declarations', () => {
    injectInteractionStyles(document);
    const css = document.getElementById(STYLE_ID)!.textContent!;

    expect(css).toContain('outline: var(--ai-focus-ring-width, 0.125rem) solid transparent !important;');
    expect(css).toContain('outline-offset: var(--ai-focus-ring-offset, 0.125rem);');
    expect(css).toMatch(/\.ai-btn:focus-visible,[\s\S]*?outline-color: var\(--ai-focus-ring, #3b82f6\) !important;/);
  });

  it('leaves the :active press-scale and .ai-menu-item hover rules untouched', () => {
    injectInteractionStyles(document);
    const css = document.getElementById(STYLE_ID)!.textContent!;

    expect(css).toContain('transform: var(--ai-active-transform, scale(0.98));');
    expect(css).toContain('.ai-menu-item[data-highlighted]');
  });
});
