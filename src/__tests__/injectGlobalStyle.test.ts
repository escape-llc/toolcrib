import { describe, it, expect } from 'vitest';
import { injectGlobalStyle, upsertGlobalStyle, removeGlobalStyle } from '../theme/injectGlobalStyle';

// No dedicated test file existed for this module before -- 62.96% statement
// coverage, all from other components' own tests calling it indirectly
// along whichever code paths they happen to exercise. Tests each function's
// real behavior directly instead, including upsertGlobalStyle's own
// create-new-tag branch (lines 67-71), which nothing had ever exercised.

describe('injectGlobalStyle', () => {
  it('creates a <style> tag with the given id and CSS text', () => {
    injectGlobalStyle('test-inject-1', '.foo { color: red; }');
    const el = document.getElementById('test-inject-1');
    expect(el?.tagName).toBe('STYLE');
    expect(el?.textContent).toBe('.foo { color: red; }');
  });

  it('is a no-op on a second call with the same id -- create-once, never-update', () => {
    injectGlobalStyle('test-inject-2', '.foo { color: red; }');
    injectGlobalStyle('test-inject-2', '.foo { color: blue; }');
    const els = document.querySelectorAll('#test-inject-2');
    expect(els).toHaveLength(1);
    expect(els[0].textContent).toBe('.foo { color: red; }');
  });

  it('sets nonce via the IDL property, not setAttribute', () => {
    injectGlobalStyle('test-inject-3', '.foo {}', undefined, 'abc123');
    const el = document.getElementById('test-inject-3') as HTMLStyleElement;
    expect(el.nonce).toBe('abc123');
  });

  it('injects into a custom targetDocument instead of the global document', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument!;
    injectGlobalStyle('test-inject-iframe', '.foo {}', iframeDoc);
    expect(iframeDoc.getElementById('test-inject-iframe')).not.toBeNull();
    expect(document.getElementById('test-inject-iframe')).toBeNull();
    iframe.remove();
  });
});

describe('upsertGlobalStyle', () => {
  it('creates a new <style> tag when none exists yet', () => {
    upsertGlobalStyle('test-upsert-1', '.bar { color: green; }');
    const el = document.getElementById('test-upsert-1');
    expect(el?.tagName).toBe('STYLE');
    expect(el?.textContent).toBe('.bar { color: green; }');
  });

  it('sets nonce via the IDL property on the creation path', () => {
    upsertGlobalStyle('test-upsert-2', '.bar {}', undefined, 'xyz789');
    const el = document.getElementById('test-upsert-2') as HTMLStyleElement;
    expect(el.nonce).toBe('xyz789');
  });

  it('updates an existing tag\'s content in place, unlike injectGlobalStyle', () => {
    upsertGlobalStyle('test-upsert-3', '.bar { color: green; }');
    upsertGlobalStyle('test-upsert-3', '.bar { color: purple; }');
    const els = document.querySelectorAll('#test-upsert-3');
    expect(els).toHaveLength(1);
    expect(els[0].textContent).toBe('.bar { color: purple; }');
  });

  it('does not touch textContent when the new CSS is identical to the existing content', () => {
    upsertGlobalStyle('test-upsert-4', '.bar { color: green; }');
    const el = document.getElementById('test-upsert-4') as HTMLStyleElement;
    const before = el.textContent;
    upsertGlobalStyle('test-upsert-4', '.bar { color: green; }');
    expect(el.textContent).toBe(before);
  });
});

describe('removeGlobalStyle', () => {
  it('removes a previously injected tag', () => {
    injectGlobalStyle('test-remove-1', '.baz {}');
    expect(document.getElementById('test-remove-1')).not.toBeNull();
    removeGlobalStyle('test-remove-1');
    expect(document.getElementById('test-remove-1')).toBeNull();
  });

  it('is a no-op when no tag with that id exists', () => {
    expect(() => removeGlobalStyle('test-remove-nonexistent')).not.toThrow();
  });
});
