/**
 * A vendored, standalone ESLint rule flagging a raw HTML element where a
 * Toolcrib component already does the same job (`<button>` -> `<Button>`,
 * `<select>` -> `<Select>`, `<dialog>` -> `<Modal>`, ...), naming the
 * replacement. Zero imports, no TypeScript dependency: plain ESTree/JSX
 * nodes only, the same bar as `no-unexplained-zindex.js`.
 *
 * Why it exists: Toolcrib's type system keeps its own components in theme
 * (no `style`/`className`, CORE.md principle 7), but it can't see a raw
 * `<button>` in your code at all. A hand-rolled control silently skips the
 * theme, the accessibility wiring, Form binding and the event bus that the
 * Toolcrib component brings for free. Lint is the one channel that sees it.
 *
 * Configurable: pass `{ elements: { ... } }` to add, rename or switch off
 * entries (`false` disables one). Keys are element names, or
 * `input[type=<type>]` for a specific input type, which wins over plain
 * `input`. See README.md in this directory.
 */

/**
 * Default map. `false` means "leave it alone". `<table>` is off by default:
 * a static table is legitimate markup, and `DataTable` is for data grids;
 * opt in with `{ elements: { table: 'DataTable' } }`.
 */
export const DEFAULT_TOOLCRIB_ELEMENTS = {
  button: 'Button',
  input: 'Input',
  'input[type=hidden]': false,
  'input[type=checkbox]': 'Checkbox or Switch',
  'input[type=radio]': 'RadioGroup',
  'input[type=range]': 'Slider or RangeSlider',
  'input[type=date]': 'DatePicker',
  'input[type=time]': 'TimeField',
  'input[type=file]': 'FileUpload',
  'input[type=submit]': 'SubmitButton (inside a Form) or Button',
  'input[type=button]': 'Button',
  'input[type=reset]': 'Button',
  select: 'Select or Combobox',
  textarea: 'Textarea',
  dialog: 'Modal, AlertDialog or Drawer',
  a: 'Link',
  kbd: 'Kbd',
  table: false,
};


function attr(opening, name) {
  return opening.attributes.find(a => a.type === 'JSXAttribute' && a.name && a.name.name === name);
}

/** The attribute's value when it's a plain string (`type="checkbox"` or `type={'checkbox'}`), else undefined. */
function literalValue(attribute) {
  if (!attribute || !attribute.value) return undefined;
  const v = attribute.value;
  if (v.type === 'Literal' && typeof v.value === 'string') return v.value;
  if (v.type === 'JSXExpressionContainer' && v.expression.type === 'Literal' && typeof v.expression.value === 'string') return v.expression.value;
  if (v.type === 'JSXExpressionContainer' && v.expression.type === 'TemplateLiteral' && v.expression.expressions.length === 0) return v.expression.quasis[0].value.cooked;
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
export const preferToolcribComponent = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer the Toolcrib component over a raw HTML element that does the same job (button, input, select, textarea, dialog, links).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          elements: {
            type: 'object',
            additionalProperties: { anyOf: [{ type: 'string' }, { enum: [false] }] },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const map = { ...DEFAULT_TOOLCRIB_ELEMENTS, ...(options.elements || {}) };

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const tag = node.name.name;
        // Components start upper-case; only intrinsic elements are raw.
        if (tag[0] !== tag[0].toLowerCase()) return;

        let replacement = map[tag];
        let label = `<${tag}>`;

        if (tag === 'input') {
          const typeAttr = attr(node, 'type');
          const type = typeAttr ? literalValue(typeAttr) : 'text';
          // A dynamic type (`type={kind}`) can't be mapped to one component.
          if (type === undefined) return;
          const key = `input[type=${type.toLowerCase()}]`;
          if (key in map) replacement = map[key];
          if (typeAttr) label = `<input type="${type}">`;
        }

        // An <a> with no href is a named anchor, not a link. Link covers
        // external links too (it adds rel="noopener noreferrer" for _blank).
        if (tag === 'a' && !attr(node, 'href')) return;

        if (!replacement) return;

        context.report({
          node,
          message:
            `Raw ${label}: use Toolcrib's ${replacement} instead. It comes themed (no style needed) and accessible, and form controls are wired to Form and the event bus; ` +
            `a raw element skips all of that. See ai-docs/CORE.md's Component Reference. If a raw element is genuinely required here, disable this line with a comment saying why.`,
        });
      },
    };
  },
};
