// Pure, no fs or import.meta, so Vitest can load it (extract.js can't be:
// see extract.test.js's header).
/**
 * The states `@manifestStates` can declare, and for the ones a prop switches
 * on, the props that can (either is enough). The Catalog renders each declared
 * state mechanically from one base example (demo/stateExamples.tsx), and
 * formControlContract.test.tsx proves each one really renders in that state.
 * `focused` and `invalid` need no prop of their own: the ring is drawn by the
 * shared focus-ring class, and invalid comes from the Form.
 */
export const STATE_PROPS = {
  default: null,
  focused: null,
  disabled: ['disabled', 'isDisabled'],
  invalid: null,
  'read-only': ['readOnly', 'isReadOnly'],
};

/**
 * A declared `@manifestStates` state must be one of STATE_PROPS, list
 * `default`, and, when the component's own props are known, have a prop that
 * switches it on. A component whose props come only from inherited HTML
 * attributes (Input's `disabled`, `readOnly`) has none listed, so its states
 * are proven by rendering instead (formControlContract.test.tsx).
 */
export function validateStates(components) {
  const problems = [];
  for (const c of components) {
    if (!c.states) continue;
    if (!c.states.includes('default')) problems.push(`'${c.name}' @manifestStates must include 'default'`);
    for (const state of c.states) {
      if (!(state in STATE_PROPS)) {
        problems.push(`'${c.name}' declares unknown state '${state}' (one of: ${Object.keys(STATE_PROPS).join(', ')})`);
        continue;
      }
      const needs = STATE_PROPS[state];
      const props = c.props ? Object.keys(c.props) : [];
      if (needs && props.length > 0 && !needs.some((p) => props.includes(p)) && !c.inheritsHtmlAttributes) {
        problems.push(`'${c.name}' declares '${state}' but has none of the props that switch it on: ${needs.join(', ')}`);
      }
    }
  }
  if (problems.length > 0) throw new Error(`Invalid @manifestStates: ${problems.join('; ')}.`);
}

/**
 * The checks every Form control passes, in order. They're the literal test
 * titles in src/__tests__/formControlContract.test.tsx, which takes them from
 * here, so what the docs list is exactly what CI runs on every push.
 */
export const FORM_CONTRACT_CHECKS = [
  'registers its starting value',
  'writes an interaction into the Form',
  'marks itself touched on change, so its error shows before submit',
  'is named by the FormField label',
  'returns to its starting value on resetForm',
  'shows its starting state again after resetForm',
  'clears its error on resetForm',
  'shows and submits a Form initialValue like the same value entered by hand',
  'is disabled inside a disabled Fieldset',
  'is aria-invalid and points at its error once it fails',
  'is seen by a submit in the same tick it mounts',
];

/**
 * The guarantees `@manifestGuarantees` can declare. Each one names the test
 * that enforces it; the test checks the declaration both ways (everything it
 * covers declares the guarantee, and everything declaring it is covered), so
 * a guarantee in the manifest can't outlive the check behind it.
 */
export const GUARANTEES = {
  'form-contract': {
    summary: 'Binds to its `<Form>` with no glue, and meets every Form-contract check',
    enforcedBy: 'src/__tests__/formControlContract.test.tsx',
    checks: FORM_CONTRACT_CHECKS,
    requiresStates: ['default', 'disabled', 'invalid'],
  },
};

/**
 * A declared guarantee must be one of GUARANTEES, and a component claiming one
 * must also declare the states that guarantee depends on.
 */
export function validateGuarantees(components) {
  const problems = [];
  for (const c of components) {
    for (const g of c.guarantees ?? []) {
      const def = GUARANTEES[g];
      if (!def) {
        problems.push(`'${c.name}' declares unknown guarantee '${g}' (one of: ${Object.keys(GUARANTEES).join(', ')})`);
        continue;
      }
      const missing = (def.requiresStates ?? []).filter((s) => !(c.states ?? []).includes(s));
      if (missing.length > 0) problems.push(`'${c.name}' claims '${g}' but doesn't declare @manifestStates ${missing.join(', ')}`);
    }
  }
  if (problems.length > 0) throw new Error(`Invalid @manifestGuarantees: ${problems.join('; ')}.`);
}
