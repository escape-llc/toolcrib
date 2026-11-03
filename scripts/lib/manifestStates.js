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
