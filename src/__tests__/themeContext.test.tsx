import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from '../theme/themeContext';

describe('ThemeProvider targetDocument', () => {
  afterEach(() => {
    // Provider effects only ever set custom properties (--ai-*), never
    // remove them — clean the real document between tests so one test's
    // injected values can't leak into another's assertions.
    document.documentElement.removeAttribute('style');
  });

  it('injects CSS variables onto the global document by default', () => {
    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>
    );

    expect(document.documentElement.style.getPropertyValue('--ai-master-font-size')).not.toBe('');
  });

  // Regression: targetDocument didn't exist — the effect always wrote to
  // the bare global `document`, so a second ThemeProvider instance
  // portaled into a different Document (e.g. an <iframe>'s own
  // contentDocument, for a "live" embedded demo) would inject its CSS
  // variables onto the *outer* page's <html> instead of its own, fighting
  // with whichever ThemeProvider already owns that outer page.
  it('injects CSS variables onto targetDocument instead, leaving the global document untouched', () => {
    const otherDoc = document.implementation.createHTMLDocument('other');

    render(
      <ThemeProvider targetDocument={otherDoc}>
        <div>content</div>
      </ThemeProvider>
    );

    expect(otherDoc.documentElement.style.getPropertyValue('--ai-master-font-size')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--ai-master-font-size')).toBe('');
  });
});
