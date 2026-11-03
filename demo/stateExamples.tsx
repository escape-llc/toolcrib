import React, { cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { z } from 'zod';
import { CalendarDate } from '@internationalized/date';
import manifest from '../ai-docs/component-manifest.json';
import {
  Button,
  Calendar,
  Checkbox,
  CheckboxGroup,
  Combobox,
  DatePicker,
  DateRangePicker,
  FileUpload,
  RangeCalendar,
  Form,
  FormField,
  Input,
  NumberField,
  OTPField,
  RadioGroup,
  RangeSlider,
  Select,
  Slider,
  Switch,
  TimeField,
  Textarea,
  Rating,
  Listbox,
  ToggleGroup,
  Toggle,
} from '#toolcrib';

/**
 * The states a control renders in, side by side, so each can be checked by eye
 * against the rest (the Catalog's "States" taxonomy).
 *
 * Nothing here is written per state. Each component declares the states it
 * supports with `@manifestStates` on its own source (the manifest's `states`),
 * and every card is derived from one base example below by the same rule:
 * `disabled`/`read-only` set the component's own prop for it, `invalid` puts it
 * in a failing Form, `focused` draws the ring. A state shows up on the page
 * exactly when the component declares it, and formControlContract.test.tsx
 * renders each declared state through this same function and checks it really
 * is in that state.
 */
export type ControlState = 'default' | 'focused' | 'disabled' | 'invalid' | 'read-only';

/** The order the States card shows them in. */
const STATE_ORDER: ControlState[] = ['default', 'focused', 'disabled', 'invalid', 'read-only'];

/** One line on what each state means, shown under its label. */
export const STATE_NOTES: Record<ControlState, string> = {
  default: 'At rest.',
  focused: 'Keyboard focus ring (shown here without moving real focus).',
  disabled: 'Dimmed, not-allowed cursor, ignores input.',
  invalid: 'Touched and failing its schema.',
  'read-only': 'Shows the value, refuses edits.',
};

/** The accessible name each state's example carries, so a test can find it. */
export const STATE_LABEL: Record<ControlState, string> = {
  default: 'Default',
  focused: 'Focused',
  disabled: 'Disabled',
  invalid: 'Invalid',
  'read-only': 'Read-only',
};

/**
 * Draws the focus ring on whatever focus-ring element is inside it, without
 * taking focus (only one element on a page can have it). The matching rule is
 * in demo/index.css.
 */
const Focused: React.FC<{ children: ReactNode }> = ({ children }) => <div data-demo-state="focused">{children}</div>;

/**
 * A field that is already touched and failing: a Form whose one field can
 * never pass, submitted once on mount, which touches every field and validates
 * them. The schema fails whatever the value type is, and every control seeds
 * its own starting value, so one wrapper serves every control.
 */
const Invalid: React.FC<{ children: ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('form')?.requestSubmit();
  }, []);
  return (
    <div ref={ref}>
      <Form schema={z.object({ field: z.custom(() => false, 'This field is required') })}>
        <FormField name="field">{children}</FormField>
      </Form>
    </div>
  );
};

const COUNTRIES = [
  { label: 'United States', value: 'us' },
  { label: 'United Kingdom', value: 'uk' },
];
const DAY = new CalendarDate(2026, 3, 15);

/**
 * One example per component, at rest. Its name goes on whichever of `label`,
 * `aria-label` or text children it has, and each state's card replaces it with
 * that state's label.
 */
export const STATE_BASE: Record<string, ReactElement<Record<string, unknown>>> = {
  Input: <Input aria-label="" defaultValue="Ada Lovelace" />,
  Textarea: <Textarea aria-label="" defaultValue="Some notes" />,
  Select: <Select aria-label="" options={COUNTRIES} />,
  Combobox: <Combobox aria-label="" placeholder="Search..." options={COUNTRIES} />,
  NumberField: <NumberField label="" defaultValue={1} />,
  DatePicker: <DatePicker aria-label="" />,
  DateRangePicker: <DateRangePicker aria-label="" />,
  TimeField: <TimeField aria-label="" />,
  Calendar: <Calendar aria-label="" defaultValue={DAY} />,
  RangeCalendar: <RangeCalendar aria-label="" defaultValue={{ start: new CalendarDate(2026, 3, 10), end: new CalendarDate(2026, 3, 14) }} />,
  Checkbox: <Checkbox label="" />,
  CheckboxGroup: <CheckboxGroup label="" options={COUNTRIES} />,
  RadioGroup: <RadioGroup aria-label="" options={COUNTRIES} />,
  Switch: <Switch label="" />,
  Slider: <Slider aria-label="" defaultValue={40} />,
  RangeSlider: <RangeSlider aria-label="" defaultValue={[20, 60]} />,
  OTPField: <OTPField aria-label="" length={4} />,
  FileUpload: <FileUpload aria-label="" />,
  Rating: <Rating aria-label="" defaultValue={2} />,
  Listbox: <Listbox id="" aria-label="" options={COUNTRIES} />,
  ToggleGroup: <ToggleGroup aria-label="" type="single" options={COUNTRIES} />,
  Toggle: <Toggle>{''}</Toggle>,
  Button: <Button>{''}</Button>,
};

type ManifestEntry = { name: string; states?: string[]; props?: Record<string, unknown> };
const ENTRIES = new Map((manifest as { components: ManifestEntry[] }).components.map(c => [c.name, c]));

/** The states a component declares with `@manifestStates`, in display order. */
export function declaredStates(name: string): ControlState[] {
  const declared = ENTRIES.get(name)?.states ?? [];
  return STATE_ORDER.filter(s => declared.includes(s));
}

/** Which of a component's props switches a state on: its own if it lists one, else the HTML attribute. */
function stateProp(name: string, html: string, own: string): string {
  return ENTRIES.get(name)?.props && own in ENTRIES.get(name)!.props! ? own : html;
}

/** The base example, named for the state it shows. */
function named(name: string, base: ReactElement<Record<string, unknown>>, state: ControlState): ReactElement<Record<string, unknown>> {
  const label = STATE_LABEL[state];
  const extra: Record<string, unknown> = {};
  if ('id' in base.props) extra.id = `${name}-${state}`;
  if ('label' in base.props) return cloneElement(base, { ...extra, label });
  if ('aria-label' in base.props) return cloneElement(base, { ...extra, 'aria-label': label });
  return cloneElement(base, extra, label);
}

/** One state's example for a component, derived from its base by the rule above. */
export function stateExample(name: string, state: ControlState): ReactNode {
  const base = STATE_BASE[name];
  if (!isValidElement(base)) return null;
  const el = named(name, base, state);
  switch (state) {
    case 'default': return el;
    case 'focused': return <Focused>{el}</Focused>;
    case 'disabled': return cloneElement(el, { [stateProp(name, 'disabled', 'isDisabled')]: true });
    case 'read-only': return cloneElement(el, { [stateProp(name, 'readOnly', 'isReadOnly')]: true });
    case 'invalid': return <Invalid>{el}</Invalid>;
  }
}
