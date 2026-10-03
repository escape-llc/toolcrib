// Table-driven tests for ../../eslint-rules/prefer-toolcrib-component.js,
// using ESLint's own RuleTester -- same rationale as the sibling
// *.rule-check.mjs files (plain `node`, not Vitest; root has no `eslint`
// dependency). Parsed with espree only (no typescript-eslint) to prove the
// rule needs no TypeScript tooling, the bar every vendored rule meets.

import { RuleTester } from 'eslint';
import { preferToolcribComponent } from '../../eslint-rules/prefer-toolcrib-component.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const suggests = replacement => ({ message: new RegExp(`use Toolcrib's ${escapeRegExp(replacement)} instead`) });

ruleTester.run('prefer-toolcrib-component', preferToolcribComponent, {
  valid: [
    // Toolcrib components themselves.
    '<Button onClick={go}>Save</Button>',
    '<Input name="email" />',
    // Hidden inputs carry form data, not UI.
    '<input type="hidden" name="csrf" value={token} />',
    // A dynamic type can't be mapped to one component.
    '<input type={kind} />',
    // A named anchor, not a link.
    '<a id="section-2" />',
    // Static tables are legitimate markup; off by default.
    '<table><tbody><tr><td>1</td></tr></tbody></table>',
    // Elements with no Toolcrib counterpart.
    '<div><span>x</span><p>y</p></div>',
    // A consumer can switch an entry off.
    { code: '<button>x</button>', options: [{ elements: { button: false } }] },
  ],
  invalid: [
    { code: '<button onClick={go}>Save</button>', errors: [suggests('Button')] },
    { code: '<input name="email" />', errors: [suggests('Input')] },
    { code: '<input type="email" />', errors: [suggests('Input')] },
    { code: '<input type="checkbox" />', errors: [suggests('Checkbox or Switch')] },
    { code: "<input type={'radio'} />", errors: [suggests('RadioGroup')] },
    { code: '<input type="range" />', errors: [suggests('Slider or RangeSlider')] },
    { code: '<input type="date" />', errors: [suggests('DatePicker')] },
    { code: '<input type="file" />', errors: [suggests('FileUpload')] },
    { code: '<input type="submit" />', errors: [suggests('SubmitButton (inside a Form) or Button')] },
    { code: '<select><option>a</option></select>', errors: [suggests('Select or Combobox')] },
    { code: '<textarea rows={3} />', errors: [suggests('Textarea')] },
    { code: '<dialog open>Hi</dialog>', errors: [suggests('Modal, AlertDialog or Drawer')] },
    { code: '<a href="/settings">Settings</a>', errors: [suggests('Link')] },
    { code: '<kbd>Esc</kbd>', errors: [suggests('Kbd')] },
    { code: '<meter value={0.6} />', errors: [suggests('Meter')] },
    { code: '<a href="https://example.com" target="_blank">x</a>', errors: [suggests('Link')] },
    { code: '<a href={url}>x</a>', errors: [suggests('Link')] },
    // Opting in to the off-by-default table entry.
    { code: '<table />', options: [{ elements: { table: 'DataTable' } }], errors: [suggests('DataTable')] },
    // A consumer's own addition.
    { code: '<progress value={3} max={10} />', options: [{ elements: { progress: 'Progress' } }], errors: [suggests('Progress')] },
  ],
});

console.log('prefer-toolcrib-component: all RuleTester cases passed');
