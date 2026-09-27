// Table-driven tests for ../../eslint-rules/no-literal-style-values.js,
// using ESLint's own RuleTester -- same rationale as the sibling
// *.rule-check.mjs files. Parsed with espree only (no typescript-eslint):
// the rule needs no TypeScript tooling.

import assert from 'node:assert/strict';
import { RuleTester } from 'eslint';
import { noLiteralStyleValues, stripVars, findLiteralColor, findPixelLength } from '../../eslint-rules/no-literal-style-values.js';

// The pure helpers first: var() stripping has to handle nested parens in a fallback.
assert.equal(stripVars('var(--ai-x, rgb(0, 0, 0))').trim(), '');
assert.equal(stripVars('0.0625rem solid var(--ai-border, #e5e7eb)').trim(), '0.0625rem solid');
assert.equal(findLiteralColor('var(--ai-text-primary, #111827)'), undefined);
assert.equal(findLiteralColor('color-mix(in srgb, var(--ai-color-primary) 12%, transparent)'), undefined);
assert.equal(findLiteralColor('1px solid #ccc'), '#ccc');
assert.equal(findLiteralColor('rgba(0, 0, 0, 0.5)'), 'rgba()');
assert.equal(findLiteralColor('0.0625rem solid red'), 'red');
// A color word inside a url() path is not a color (Gemini, PR #658).
assert.equal(findLiteralColor('url(/assets/gold-icon.png) no-repeat'), undefined);
assert.equal(findLiteralColor("url('/a(1).png') red"), 'red');
assert.equal(findPixelLength('0px'), undefined);
assert.equal(findPixelLength('0.5rem 12px'), '12px');
assert.equal(findPixelLength('var(--ai-padding-md, 12px)'), undefined);
// Negative offsets too (Gemini, PR #658).
assert.equal(findPixelLength('-12px'), '-12px');
assert.equal(findPixelLength('0 -4px'), '-4px');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const color = /uses the literal color/;
const length = /literal length|renders as/;

ruleTester.run('no-literal-style-values', noLiteralStyleValues, {
  valid: [
    "<div style={{ color: 'var(--ai-text-secondary)', padding: 'var(--ai-padding-md)' }} />",
    // A literal only as a var() fallback is fine.
    "<div style={{ background: 'var(--ai-bg-container, #f3f4f6)', border: '0.0625rem solid var(--ai-border, #e5e7eb)' }} />",
    // rem, em, %, 0, auto and keywords.
    "<div style={{ margin: '0 auto', padding: '0.5rem 1em', gap: '2%', fontSize: '0.875rem', color: 'inherit', background: 'transparent' }} />",
    "<div style={{ margin: 0, color: 'currentColor' }} />",
    // Unitless / non-token properties are out of scope.
    "<div style={{ lineHeight: 1.5, flex: 1, zIndex: 2, width: 56, height: '120px' }} />",
    // Toolcrib components take no style at all (a type error), so they're not this rule's concern.
    "<Card style={{ color: '#fff' }} />",
    // A style object passed by name is out of reach of a syntactic check.
    '<div style={boxStyle} />',
    // An expression we can't read statically.
    '<div style={{ color: someColor }} />',
  ],
  invalid: [
    { code: "<div style={{ color: '#fff' }} />", errors: [{ message: color }] },
    { code: "<div style={{ background: 'rgba(239, 68, 68, 0.15)' }} />", errors: [{ message: color }] },
    { code: "<span style={{ color: 'red' }} />", errors: [{ message: color }] },
    { code: "<div style={{ border: '1px solid #ccc' }} />", errors: [{ message: color }] },
    { code: "<div style={{ borderBottom: '1px solid var(--ai-border)' }} />", errors: [{ message: length }] },
    { code: "<div style={{ padding: '12px' }} />", errors: [{ message: length }] },
    { code: '<div style={{ padding: 12 }} />', errors: [{ message: length }] },
    { code: "<div style={{ marginTop: '-4px' }} />", errors: [{ message: length }] },
    { code: '<div style={{ marginLeft: -12 }} />', errors: [{ message: length }] },
    { code: "<div style={{ fontSize: '14px' }} />", errors: [{ message: length }] },
    { code: "<div style={{ borderRadius: '8px' }} />", errors: [{ message: length }] },
    // Both arms of a ternary are checked.
    { code: "<div style={{ color: active ? 'var(--ai-color-primary)' : '#999' }} />", errors: [{ message: color }] },
    // Template text is checked; interpolations are skipped.
    { code: '<div style={{ boxShadow: `0 0 0 2px ${ring}, 0 1px 2px #0003` }} />', errors: [{ message: color }] },
  ],
});

console.log('no-literal-style-values: all RuleTester cases passed');
