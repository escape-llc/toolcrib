/**
 * A vendored, standalone ESLint rule for the last rung of CORE.md
 * principle 7: when code does go "off the board" with a raw element and
 * `style`, the values still come from the theme. It flags a literal color
 * (hex, `rgb()`/`hsl()`/..., a named color) or a pixel length in a raw
 * element's inline `style` object, and points at the `var(--ai-*)` family
 * to use instead. Zero imports, no TypeScript dependency: plain ESTree/JSX
 * nodes only, the same bar as `no-unexplained-zindex.js`.
 *
 * Why it exists: a literal value never follows the Theme Editor, dark mode
 * or a subtheme, so it drifts from everything around it the moment the
 * theme changes, with nothing to say so. `var(--ai-x, #fallback)` is fine:
 * the fallback only applies outside a mounted theme.
 *
 * Scope: only a `style={{ ... }}` object literal written directly on an
 * intrinsic (lower-case) element. Toolcrib components take no `style` at
 * all (a type error), and a style object built elsewhere and passed by
 * name is out of reach of a syntactic check.
 */

// Color-bearing properties. Border/outline shorthands carry a color too.
const COLOR_PROPS = new Set([
  'color', 'background', 'backgroundColor', 'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
  'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outline', 'outlineColor',
  'fill', 'stroke', 'boxShadow', 'textShadow', 'caretColor', 'accentColor', 'textDecorationColor', 'columnRuleColor',
]);

// Length properties with a theme token scale: spacing, radius, font size.
const LENGTH_PROPS = new Set([
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingInline', 'paddingBlock',
  'paddingInlineStart', 'paddingInlineEnd', 'paddingBlockStart', 'paddingBlockEnd',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginInline', 'marginBlock',
  'marginInlineStart', 'marginInlineEnd', 'marginBlockStart', 'marginBlockEnd',
  'gap', 'rowGap', 'columnGap',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'fontSize',
]);

// CSS named colors (plus the few keywords that aren't theme bypasses are
// handled by simply not being in this list: transparent, currentColor,
// inherit, initial, unset, none).
const NAMED_COLORS = new Set(
  ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue ' +
    'chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
    'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray ' +
    'darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen ' +
    'fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen ' +
    'lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime ' +
    'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive ' +
    'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver ' +
    'skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen').split(' ')
);

const COLOR_FUNCTION = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /#[0-9a-f]{3,8}\b/i;
// The sign is part of the capture so a negative offset ('-12px') is caught too.
const PX = /(^|[^\w.-])(-?\d*\.?\d+)px\b/;

/**
 * Removes every `var(...)` (fallback included) and `url(...)` (a path can
 * contain a color word: `url(/gold-icon.png)`) so only literal text is left
 * to inspect.
 */
export function stripVars(value) {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const fn = value.startsWith('var(', i) ? 'var(' : value.startsWith('url(', i) ? 'url(' : null;
    if (fn) {
      let depth = 0;
      let j = i + fn.length - 1;
      for (; j < value.length; j++) {
        if (value[j] === '(') depth++;
        else if (value[j] === ')' && --depth === 0) break;
      }
      out += ' ';
      i = j + 1;
    } else {
      out += value[i++];
    }
  }
  return out;
}

/** The literal color in a value, if any. */
export function findLiteralColor(value) {
  const text = stripVars(value);
  const hex = HEX.exec(text);
  if (hex) return hex[0];
  const fn = COLOR_FUNCTION.exec(text);
  if (fn) return `${fn[1]}()`;
  const named = text.toLowerCase().match(/[a-z]+/g)?.find(w => NAMED_COLORS.has(w));
  return named;
}

/** The first non-zero pixel length in a value, if any. */
export function findPixelLength(value) {
  const m = PX.exec(stripVars(value));
  return m && parseFloat(m[2]) !== 0 ? `${m[2]}px` : undefined;
}

const COLOR_HINT = 'a palette variable: var(--ai-text-primary)/var(--ai-text-secondary), var(--ai-bg-surface)/var(--ai-bg-container), var(--ai-border), var(--ai-color-primary), or var(--ai-subtheme-<name>-*)';
const HINT_FOR = prop =>
  /^(padding)/.test(prop) ? 'var(--ai-padding-*) or rem'
    : /^(margin|gap|rowGap|columnGap)/.test(prop) ? 'var(--ai-margin-*) or rem'
      : /Radius$/.test(prop) ? 'var(--ai-radius-*)'
        : 'rem (or a <Text size> step)';

/** String pieces of a style value we can read statically: literals, template text, both arms of a ternary. */
function literalPieces(node) {
  if (!node) return [];
  if (node.type === 'Literal') return [node];
  if (node.type === 'TemplateLiteral') return [node];
  if (node.type === 'ConditionalExpression') return [...literalPieces(node.consequent), ...literalPieces(node.alternate)];
  if (node.type === 'LogicalExpression') return [...literalPieces(node.left), ...literalPieces(node.right)];
  return [];
}

/** @type {import('eslint').Rule.RuleModule} */
export const noLiteralStyleValues = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "A raw element's inline style must take colors and spacing/radius/font-size lengths from the theme's CSS variables (var(--ai-*)) or rem, not literal colors or px.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'style') return;
        const opening = node.parent;
        if (!opening || opening.type !== 'JSXOpeningElement' || opening.name.type !== 'JSXIdentifier') return;
        const tag = opening.name.name;
        if (tag[0] !== tag[0].toLowerCase()) return;
        const expr = node.value && node.value.type === 'JSXExpressionContainer' ? node.value.expression : null;
        if (!expr || expr.type !== 'ObjectExpression') return;

        for (const prop of expr.properties) {
          if (prop.type !== 'Property' || prop.computed) continue;
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : null;
          if (!key) continue;
          const isColor = COLOR_PROPS.has(key);
          const isLength = LENGTH_PROPS.has(key);
          if (!isColor && !isLength) continue;

          // A bare number on a length property becomes px in React.
          // A bare number (or a negated one: `-12` is a unary expression) on a length property becomes px in React.
          const v = prop.value;
          const num = v.type === 'Literal' && typeof v.value === 'number' ? v.value
            : v.type === 'UnaryExpression' && v.operator === '-' && v.argument.type === 'Literal' && typeof v.argument.value === 'number' ? -v.argument.value
              : undefined;
          if (isLength && num !== undefined && num !== 0) {
            context.report({ node: v, message: `${key}: ${num} renders as ${num}px, a literal length the theme can't scale. Use ${HINT_FOR(key)}.` });
            continue;
          }

          for (const piece of literalPieces(prop.value)) {
            const text = piece.type === 'Literal' ? (typeof piece.value === 'string' ? piece.value : '') : piece.quasis.map(q => q.value.cooked).join(' ');
            if (!text) continue;
            const color = isColor ? findLiteralColor(text) : undefined;
            if (color) {
              context.report({ node: piece, message: `${key} uses the literal color ${color}, which won't follow the theme, dark mode or subthemes. Use ${COLOR_HINT} (a literal is fine only as a var() fallback).` });
              continue;
            }
            const px = findPixelLength(text);
            if (px && (isLength || /^border|^outline/.test(key))) {
              context.report({ node: piece, message: `${key} uses the literal length ${px}, which the theme can't scale. Use ${isLength ? HINT_FOR(key) : 'rem (0.0625rem for a hairline)'}.` });
            }
          }
        }
      },
    };
  },
};
