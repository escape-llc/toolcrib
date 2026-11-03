import { describe, it, expect } from 'vitest';
import { validateStates, validateGuarantees } from './manifestContracts.js';

describe('validateGuarantees (@manifestGuarantees)', () => {
  it('accepts form-contract on a control declaring the states it depends on', () => {
    expect(() => validateGuarantees([
      { name: 'Slider', states: ['default', 'focused', 'disabled', 'invalid'], guarantees: ['form-contract'] },
      { name: 'Card' },
    ])).not.toThrow();
  });

  it('rejects an unknown guarantee', () => {
    expect(() => validateGuarantees([{ name: 'X', guarantees: ['bulletproof'] }])).toThrow(/unknown guarantee 'bulletproof'/);
  });

  it('rejects form-contract without the states it depends on', () => {
    expect(() => validateGuarantees([{ name: 'Toggle', states: ['default'], guarantees: ['form-contract'] }]))
      .toThrow(/'Toggle' claims 'form-contract' but doesn't declare @manifestStates disabled, invalid/);
  });
});

const ownProps = (names) => Object.fromEntries(names.map(n => [n, { type: 'boolean' }]));

describe('validateStates (@manifestStates)', () => {
  it('accepts declared states the props can switch on', () => {
    expect(() => validateStates([
      { name: 'Slider', states: ['default', 'focused', 'disabled', 'invalid'], props: ownProps(['disabled', 'aria-invalid']) },
      { name: 'TimeField', states: ['default', 'disabled'], props: ownProps(['isDisabled']) },
      { name: 'Rating', states: ['default', 'read-only'], props: ownProps(['readOnly']) },
      { name: 'Card' },
    ])).not.toThrow();
  });

  it('rejects an unknown state', () => {
    expect(() => validateStates([{ name: 'X', states: ['default', 'hovered'] }])).toThrow(/unknown state 'hovered'/);
  });

  it('requires default', () => {
    expect(() => validateStates([{ name: 'X', states: ['disabled'], props: ownProps(['disabled']) }])).toThrow(/must include 'default'/);
  });

  it('rejects a state with no prop to switch it on', () => {
    expect(() => validateStates([{ name: 'Toggle', states: ['default', 'read-only'], props: ownProps(['disabled']) }]))
      .toThrow(/'Toggle' declares 'read-only' but has none of the props that switch it on: readOnly, isReadOnly/);
  });

  it('leaves a state an inherited HTML attribute provides to the render-time proof', () => {
    const input = { name: 'Input', states: ['default', 'disabled', 'read-only'], props: ownProps(['size']) };
    Object.defineProperty(input, 'inheritsHtmlAttributes', { value: true, enumerable: false });
    expect(() => validateStates([input])).not.toThrow();
  });
});
