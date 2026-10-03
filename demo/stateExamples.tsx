import React, { useEffect, useRef, type ReactNode } from 'react';
import { z } from 'zod';
import {
  Button,
  Checkbox,
  Combobox,
  DatePicker,
  Form,
  FormField,
  Input,
  NumberField,
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
 * A field that is already touched and failing: a Form with a required field,
 * submitted once on mount, which touches every field and validates them (a
 * field alone only shows an error after an edit or a submit).
 */
const Invalid: React.FC<{ children: ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('form')?.requestSubmit();
  }, []);
  return (
    <div ref={ref}>
      <Form schema={z.object({ field: z.string().min(1, 'This field is required') })} initialValues={{ field: '' }}>
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
  ],
  Combobox: [
    { state: 'default', node: <Combobox ariaLabel="Default" placeholder="Search..." options={COUNTRIES} /> },
    { state: 'focused', node: <Focused><Combobox ariaLabel="Focused" placeholder="Search..." options={COUNTRIES} /></Focused> },
    { state: 'disabled', node: <Combobox ariaLabel="Disabled" placeholder="Search..." options={COUNTRIES} disabled /> },
  ],
  NumberField: [
    { state: 'default', node: <NumberField label="Default" defaultValue={1} /> },
    { state: 'focused', node: <Focused><NumberField label="Focused" defaultValue={1} /></Focused> },
    { state: 'disabled', node: <NumberField label="Disabled" defaultValue={1} isDisabled /> },
  ],
  DatePicker: [
    { state: 'default', node: <DatePicker aria-label="Default" /> },
    { state: 'focused', node: <Focused><DatePicker aria-label="Focused" /></Focused> },
    { state: 'disabled', node: <DatePicker aria-label="Disabled" isDisabled /> },
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
  Button: [
    { state: 'default', node: <Button>Default</Button> },
    { state: 'focused', node: <Focused><Button>Focused</Button></Focused> },
    { state: 'disabled', node: <Button disabled>Disabled</Button> },
  ],
};
