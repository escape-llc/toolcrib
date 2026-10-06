import React, { useEffect, useRef, type ReactNode } from 'react';
import { z } from 'zod';
import { CalendarDate } from '@internationalized/date';
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
} from '#toolcrib';

/**
 * The states a control renders in, side by side, so each can be checked by eye
 * against the rest (the Catalog's "States" taxonomy). Not every control has
 * every state: the list per control is what it actually supports.
 */
export type ControlState = 'default' | 'focused' | 'disabled' | 'invalid' | 'read-only';

export interface StateExample {
  state: ControlState;
  node: ReactNode;
}

/** One line on what each state means, shown under its label. */
export const STATE_NOTES: Record<ControlState, string> = {
  default: 'At rest.',
  focused: 'Keyboard focus ring (shown here without moving real focus).',
  disabled: 'Dimmed, not-allowed cursor, ignores input.',
  invalid: 'Touched and failing its schema.',
  'read-only': 'Shows the value, refuses edits.',
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
 * them (a field alone only shows an error after an edit or a submit). The
 * schema always fails whatever the control's value type is (text, a boolean, a
 * number, a list), so one wrapper serves every control.
 */
const Invalid: React.FC<{ children: ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('form')?.requestSubmit();
  }, []);
  return (
    <div ref={ref}>
      <Form schema={z.object({ field: z.custom(() => false, 'This field is required') })} initialValues={{ field: '' }}>
        <FormField name="field">{children}</FormField>
      </Form>
    </div>
  );
};

const COUNTRIES = [
  { label: 'United States', value: 'us' },
  { label: 'United Kingdom', value: 'uk' },
];

/** Examples keyed by component name; only controls with real states are listed. */
export const STATE_EXAMPLES: Record<string, StateExample[]> = {
  Input: [
    { state: 'default', node: <Input aria-label="Default" placeholder="Name" /> },
    { state: 'focused', node: <Focused><Input aria-label="Focused" placeholder="Name" /></Focused> },
    { state: 'disabled', node: <Input aria-label="Disabled" placeholder="Name" disabled /> },
    { state: 'invalid', node: <Invalid><Input aria-label="Invalid" placeholder="Name" /></Invalid> },
    { state: 'read-only', node: <Input aria-label="Read-only" defaultValue="Ada Lovelace" readOnly /> },
  ],
  Textarea: [
    { state: 'default', node: <Textarea aria-label="Default" placeholder="Notes" /> },
    { state: 'focused', node: <Focused><Textarea aria-label="Focused" placeholder="Notes" /></Focused> },
    { state: 'disabled', node: <Textarea aria-label="Disabled" placeholder="Notes" disabled /> },
    { state: 'invalid', node: <Invalid><Textarea aria-label="Invalid" placeholder="Notes" /></Invalid> },
    { state: 'read-only', node: <Textarea aria-label="Read-only" defaultValue="Locked text" readOnly /> },
  ],
  Select: [
    { state: 'default', node: <Select aria-label="Default" options={COUNTRIES} /> },
    { state: 'focused', node: <Focused><Select aria-label="Focused" options={COUNTRIES} /></Focused> },
    { state: 'disabled', node: <Select aria-label="Disabled" options={COUNTRIES} disabled /> },
    { state: 'invalid', node: <Invalid><Select aria-label="Invalid" options={COUNTRIES} /></Invalid> },
  ],
  Combobox: [
    { state: 'default', node: <Combobox ariaLabel="Default" placeholder="Search..." options={COUNTRIES} /> },
    { state: 'focused', node: <Focused><Combobox ariaLabel="Focused" placeholder="Search..." options={COUNTRIES} /></Focused> },
    { state: 'disabled', node: <Combobox ariaLabel="Disabled" placeholder="Search..." options={COUNTRIES} disabled /> },
    { state: 'invalid', node: <Invalid><Combobox ariaLabel="Invalid" placeholder="Search..." options={COUNTRIES} /></Invalid> },
  ],
  NumberField: [
    { state: 'default', node: <NumberField label="Default" defaultValue={1} /> },
    { state: 'focused', node: <Focused><NumberField label="Focused" defaultValue={1} /></Focused> },
    { state: 'disabled', node: <NumberField label="Disabled" defaultValue={1} isDisabled /> },
    { state: 'invalid', node: <Invalid><NumberField label="Invalid" /></Invalid> },
  ],
  DatePicker: [
    { state: 'default', node: <DatePicker aria-label="Default" /> },
    { state: 'focused', node: <Focused><DatePicker aria-label="Focused" /></Focused> },
    { state: 'disabled', node: <DatePicker aria-label="Disabled" isDisabled /> },
  ],
  DateRangePicker: [
    { state: 'default', node: <DateRangePicker aria-label="Default" /> },
    { state: 'focused', node: <Focused><DateRangePicker aria-label="Focused" /></Focused> },
    { state: 'disabled', node: <DateRangePicker aria-label="Disabled" isDisabled /> },
  ],
  // The calendars have no single focusable surface to force a ring on (focus
  // sits on one day cell and moves with the arrow keys), so no `focused` here;
  // e2e/catalog-states.spec.ts checks it with real keyboard focus. Nor an
  // `invalid`: a calendar always holds a valid month.
  Calendar: [
    { state: 'default', node: <Calendar aria-label="Default" defaultValue={new CalendarDate(2026, 3, 15)} /> },
    { state: 'disabled', node: <Calendar aria-label="Disabled" defaultValue={new CalendarDate(2026, 3, 15)} isDisabled /> },
  ],
  RangeCalendar: [
    { state: 'default', node: <RangeCalendar aria-label="Default" defaultValue={{ start: new CalendarDate(2026, 3, 10), end: new CalendarDate(2026, 3, 14) }} /> },
    { state: 'disabled', node: <RangeCalendar aria-label="Disabled" defaultValue={{ start: new CalendarDate(2026, 3, 10), end: new CalendarDate(2026, 3, 14) }} isDisabled /> },
  ],
  TimeField: [
    { state: 'default', node: <TimeField aria-label="Default" /> },
    { state: 'focused', node: <Focused><TimeField aria-label="Focused" /></Focused> },
    { state: 'disabled', node: <TimeField aria-label="Disabled" isDisabled /> },
  ],
  Checkbox: [
    { state: 'default', node: <Checkbox label="Default" /> },
    { state: 'focused', node: <Focused><Checkbox label="Focused" /></Focused> },
    { state: 'disabled', node: <Checkbox label="Disabled" disabled /> },
  ],
  CheckboxGroup: [
    { state: 'default', node: <CheckboxGroup label="Default" options={COUNTRIES} /> },
    { state: 'focused', node: <Focused><CheckboxGroup label="Focused" options={COUNTRIES} /></Focused> },
    { state: 'disabled', node: <CheckboxGroup label="Disabled" options={COUNTRIES} disabled /> },
  ],
  RadioGroup: [
    { state: 'default', node: <RadioGroup options={COUNTRIES} /> },
    { state: 'focused', node: <Focused><RadioGroup options={COUNTRIES} /></Focused> },
    { state: 'disabled', node: <RadioGroup options={COUNTRIES} disabled /> },
  ],
  Switch: [
    { state: 'default', node: <Switch label="Default" /> },
    { state: 'focused', node: <Focused><Switch label="Focused" /></Focused> },
    { state: 'disabled', node: <Switch label="Disabled" disabled /> },
  ],
  Slider: [
    { state: 'default', node: <Slider ariaLabel="Default" defaultValue={40} /> },
    { state: 'focused', node: <Focused><Slider ariaLabel="Focused" defaultValue={40} /></Focused> },
    { state: 'disabled', node: <Slider ariaLabel="Disabled" defaultValue={40} disabled /> },
  ],
  RangeSlider: [
    { state: 'default', node: <RangeSlider ariaLabel="Default" defaultValue={[20, 60]} /> },
    { state: 'focused', node: <Focused><RangeSlider ariaLabel="Focused" defaultValue={[20, 60]} /></Focused> },
    { state: 'disabled', node: <RangeSlider ariaLabel="Disabled" defaultValue={[20, 60]} disabled /> },
  ],
  OTPField: [
    { state: 'default', node: <OTPField aria-label="Default" length={4} /> },
    { state: 'focused', node: <Focused><OTPField aria-label="Focused" length={4} /></Focused> },
    { state: 'disabled', node: <OTPField aria-label="Disabled" length={4} disabled /> },
    { state: 'invalid', node: <Invalid><OTPField aria-label="Invalid" length={4} /></Invalid> },
  ],
  FileUpload: [
    { state: 'default', node: <FileUpload /> },
    { state: 'focused', node: <Focused><FileUpload /></Focused> },
    { state: 'disabled', node: <FileUpload disabled /> },
  ],
  Button: [
    { state: 'default', node: <Button>Default</Button> },
    { state: 'focused', node: <Focused><Button>Focused</Button></Focused> },
    { state: 'disabled', node: <Button disabled>Disabled</Button> },
  ],
};
