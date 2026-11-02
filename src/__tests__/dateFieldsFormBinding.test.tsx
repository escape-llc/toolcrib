import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { z } from 'zod';
import { CalendarDate, Time } from '@internationalized/date';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton } from '../components/Form/FormComponents';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { DateRangePicker } from '../components/DatePicker/DateRangePicker';
import { TimeField } from '../components/DatePicker/TimeField';

// #880: the three React Aria date controls never registered with their Form
// and ignored <FormField>'s label, unlike every other Form control.
const date = new CalendarDate(2026, 3, 15);
const cases: { name: string; control: React.ReactElement; value: unknown }[] = [
  { name: 'DatePicker', control: <DatePicker defaultValue={date} />, value: date },
  { name: 'TimeField', control: <TimeField defaultValue={new Time(9, 30)} />, value: new Time(9, 30) },
  {
    name: 'DateRangePicker',
    control: <DateRangePicker defaultValue={{ start: date, end: date.add({ days: 2 }) }} />,
    value: { start: date, end: date.add({ days: 2 }) },
  },
];
const bare: Record<string, React.ReactElement> = {
  DatePicker: <DatePicker />,
  TimeField: <TimeField />,
  DateRangePicker: <DateRangePicker />,
};

const required = z.object({ when: z.any().refine(v => v != null, 'Pick a value') });

describe('date fields inside a Form (#880)', () => {
  it.each(cases)('$name submits its untouched defaultValue', async ({ control, value }) => {
    const onSubmit = vi.fn();
    render(
      <Form id="f" schema={required} onSubmit={onSubmit}>
        <FormField name="when" label="When">{control}</FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(onSubmit.mock.calls[0][0].when)).toBe(JSON.stringify(value));
  });

  it.each(Object.keys(bare))('%s shows a required error on submit when left empty', async name => {
    const onSubmit = vi.fn();
    render(
      <Form id="f" schema={required} onSubmit={onSubmit}>
        <FormField name="when" label="When">{bare[name]}</FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(screen.getByText('Pick a value')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(Object.keys(bare))('%s is named by the surrounding FormField label', async name => {
    render(
      <Form id="f" onSubmit={vi.fn()}>
        <FormField name="when" label="When">{bare[name]}</FormField>
      </Form>
    );
    const label = screen.getByText('When');
    expect(label.id).toBeTruthy();
    const named = document.querySelectorAll(`[aria-labelledby~="${label.id}"]`);
    expect(named.length).toBeGreaterThan(0);
    // React Aria's own follow-up effects (see AGENTS.md's act() section, case 2).
    await act(async () => {});
  });
});
