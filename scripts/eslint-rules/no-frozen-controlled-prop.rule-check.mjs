// Table-driven tests for ../../eslint-rules/no-frozen-controlled-prop.js,
// using ESLint's own built-in RuleTester -- same rationale as
// no-missing-use-client.rule-check.mjs (plain `node`, not Vitest; root has
// no `eslint` dependency; `.rule-check.mjs`, not `.test.mjs`, to avoid
// Vitest's own include glob picking it up a second, accidental way).
//
// The invalid cases below are deliberately the *real*, historical shapes
// this rule was built from -- not synthetic examples. Each one is a
// simplified but structurally faithful reproduction of the actual bug found
// live in Toolcrib's own DatePicker/TimeField/Select/RadioGroup (see
// AGENTS.md and each component's own comment), confirmed by real, targeted
// regression tests (a `git stash` of just the fix, rerun against the
// strengthened test, real failure, `git stash pop`) before this rule
// existed at all -- this file is the mechanical, standing version of that
// same confirmation, not a first attempt at guessing what the bug looked
// like.

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { noFrozenControlledProp } from '../../eslint-rules/no-frozen-controlled-prop.js';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

function expectFrozen(attrName, expectedDefaultName) {
  return {
    message:
      `'${attrName}' is computed from a fallback chain that bottoms out at the raw '${expectedDefaultName}' prop, with no useState/useReducer anywhere in that chain. This looks controlled from this component's very first render (a non-undefined '${attrName}' every render) but nothing ever feeds it an updated value afterward -- the child's own internal change on '${attrName}' is silently discarded, and it stays pinned to the original '${expectedDefaultName}' forever. ` +
      `Either only pass '${attrName}' when there's a genuinely live source (an explicit controlled prop, or real ancestor-owned state) and pass '${expectedDefaultName}' itself to the child otherwise, or track a local useState seeded from '${expectedDefaultName}' and feed that back through '${attrName}' on every render.`,
  };
}

ruleTester.run('no-frozen-controlled-prop', noFrozenControlledProp, {
  valid: [
    // Genuinely controlled: `value` traces back to the component's own
    // `value` prop (renamed via destructuring), never `defaultValue` --
    // the ordinary, correct controlled-component shape.
    `function Field({ value: externalValue }) {
       return <input value={externalValue} />;
     }`,

    // Calendar.tsx's own real, correct pattern: `value` and `defaultValue`
    // passed through to two SEPARATE attributes on the child, never
    // folded into one -- the child manages its own controlled/uncontrolled
    // split internally.
    `function Calendar({ value: externalValue, defaultValue }) {
       return <AriaCalendar value={externalValue ?? undefined} defaultValue={defaultValue ?? undefined} />;
     }`,

    // ToggleGroup.tsx's own real, correct pattern: the fallback bottoms
    // out at useState's own live getter, not the bare prop -- the useState
    // call is seeded from defaultValue, which is the correct, intended use
    // of the prop, not the bug.
    `function ToggleGroup({ value: externalValue, defaultValue }) {
       const [internalValue] = useState(defaultValue);
       const currentValue = externalValue !== undefined ? externalValue : internalValue;
       return <Root value={currentValue} />;
     }`,

    // A locally-shadowed 'defaultValue' (not actually this component's own
    // prop) is correctly left alone -- it never resolves to the real prop
    // at all.
    `function Widget({ value: externalValue }) {
       function helper() {
         const defaultValue = computeSomethingUnrelated();
         return defaultValue;
       }
       return <input value={externalValue ?? helper()} />;
     }`,

    // A renamed destructure ({ defaultValue: dv }) binds the name 'dv', not
    // 'defaultValue' -- correctly not matched (documented limitation, same
    // "structural, not semantic" bar the other rules hold themselves to).
    `function Field({ value: externalValue, defaultValue: dv }) {
       const resolved = externalValue !== undefined ? externalValue : dv;
       return <input value={resolved} />;
     }`,
  ],

  invalid: [
    // Real shape 1: DatePicker.tsx / TimeField.tsx (pre-fix). A three-way
    // ternary (external -> form -> defaultValue) collapsed into one `value`
    // prop, with a trailing `?? undefined`.
    {
      code: `function DatePicker({ value: externalValue, defaultValue, name }) {
        const formValue = name && formContext ? formContext.values[name] : undefined;
        const resolvedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;
        return <AriaDatePicker value={resolvedValue ?? undefined} />;
      }`,
      errors: [expectFrozen('value', 'defaultValue')],
    },

    // Real shape 2: Select.tsx (pre-fix). Same ternary shape, no trailing
    // '?? undefined' this time -- passed straight through.
    {
      code: `function Select({ value: externalValue, defaultValue, name }) {
        const formValue = name && formContext ? formContext.values[name] : undefined;
        const selectedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? String(formValue) : defaultValue;
        return <SelectPrimitive.Root value={selectedValue} />;
      }`,
      errors: [expectFrozen('value', 'defaultValue')],
    },

    // Real shape 3: RadioGroup.tsx (pre-fix). Two hops of local-const
    // indirection (stringVal -> selectedValue -> defaultValue), with a
    // wrapping String(...) call in between -- the shape that specifically
    // required recursing into a CallExpression's own arguments, not just
    // following bare identifiers.
    {
      code: `function RadioGroup({ value: externalValue, defaultValue, name }) {
        const formValue = name && formContext ? formContext.values[name] ?? '' : undefined;
        const selectedValue = externalValue !== undefined ? externalValue : formValue !== undefined ? formValue : defaultValue;
        const stringVal = selectedValue !== undefined ? String(selectedValue) : undefined;
        return <RadioGroupPrimitive.Root value={stringVal} />;
      }`,
      errors: [expectFrozen('value', 'defaultValue')],
    },

    // The identical shape generalizes beyond `value` -- any controlled/
    // uncontrolled pair following React's own default<Name> convention,
    // e.g. open/defaultOpen on a Popover-style component.
    {
      code: `function Popover({ open: externalOpen, defaultOpen }) {
        const isOpen = externalOpen !== undefined ? externalOpen : defaultOpen;
        return <PopoverPrimitive.Root open={isOpen} />;
      }`,
      errors: [expectFrozen('open', 'defaultOpen')],
    },

    // The direct, no-indirection-at-all case: defaultValue referenced
    // straight in the attribute expression itself, no intermediate const.
    {
      code: `function Field({ value: externalValue, defaultValue }) {
        return <input value={externalValue !== undefined ? externalValue : defaultValue} />;
      }`,
      errors: [expectFrozen('value', 'defaultValue')],
    },
  ],
});

console.log('no-frozen-controlled-prop: all RuleTester cases passed.');
