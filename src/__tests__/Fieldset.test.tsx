import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { Fieldset } from '../components/Fieldset/Fieldset';
import { Form } from '../components/Form/FormContext';
import { FormField, Input, Textarea, Checkbox, Switch, SubmitButton } from '../components/Form/FormComponents';
import { Select } from '../components/Form/Select';
import { Combobox } from '../components/Form/Combobox';
import { RadioGroup } from '../components/Form/RadioGroup';
import { CheckboxGroup } from '../components/Form/CheckboxGroup';
import { Slider } from '../components/Form/Slider';
import { RangeSlider } from '../components/Form/RangeSlider';
import { FileUpload } from '../components/Form/FileUpload';
import { NumberField } from '../components/NumberField/NumberField';
import { OTPField } from '../components/OTPField/OTPField';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { TimeField } from '../components/DatePicker/TimeField';
import { DateRangePicker } from '../components/DatePicker/DateRangePicker';
import { ToggleGroup } from '../components/ToggleGroup/ToggleGroup';
import { axe } from './testUtils/axe';

const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];

// One of every control that takes a `disabled`, each needing nothing but a name.
const controls: Record<string, React.ReactElement> = {
  Input: <Input name="i" aria-label="i" />,
  Textarea: <Textarea name="t" aria-label="t" />,
  Checkbox: <Checkbox name="c" label="c" />,
  Switch: <Switch name="s" label="s" />,
  Select: <Select name="sel" aria-label="sel" options={options} />,
  Combobox: <Combobox name="cb" ariaLabel="cb" options={options} />,
  RadioGroup: <RadioGroup name="r" options={options} />,
  CheckboxGroup: <CheckboxGroup name="cg" options={options} />,
  Slider: <Slider name="sl" aria-label="sl" />,
  RangeSlider: <RangeSlider name="rs" aria-label="rs" />,
  FileUpload: <FileUpload name="f" onUpload={async () => {}} />,
  NumberField: <NumberField name="n" aria-label="n" />,
  OTPField: <OTPField name="o" length={4} aria-label="o" />,
  DatePicker: <DatePicker name="d" aria-label="d" />,
  TimeField: <TimeField name="tf" aria-label="tf" />,
  DateRangePicker: <DateRangePicker name="dr" aria-label="dr" />,
  ToggleGroup: <ToggleGroup type="single" options={options} aria-label="tg" />,
};

const INTERACTIVE =
  'button, input, textarea, select, [role=checkbox], [role=switch], [role=radio], [role=slider], [role=combobox], [role=spinbutton], [role=button]';
const isDisabled = (el: Element) =>
  el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled') || el.closest('[aria-disabled=true]') !== null;
const interactive = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLInputElement>(INTERACTIVE)).filter(el => !el.hidden && el.type !== 'hidden');
/** Elements still enabled, described so a failure names which control leaked. */
const enabledOnes = (container: HTMLElement) =>
  interactive(container).filter(el => !isDisabled(el)).map(el => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}`);

describe('Fieldset', () => {
  it('is a real fieldset named by its legend', async () => {
    render(
      <Fieldset legend="Shipping address">
        <Input name="street" aria-label="Street" />
      </Fieldset>
    );
    // A <fieldset> is role="group"; its legend is the accessible name.
    expect(screen.getByRole('group', { name: 'Shipping address' }).tagName).toBe('FIELDSET');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  describe('disabled', () => {
    // The native fieldset attribute already stops native inputs and buttons.
    // These are the ones it can't: span-based Checkbox/Switch/Radio and the
    // React Aria date fields. Found by rendering every control in a disabled
    // fieldset and listing what stayed enabled; this table keeps it that way.
    it.each(Object.keys(controls))('disables %s inside it', name => {
      const { container } = render(<Fieldset legend="x" disabled>{controls[name]}</Fieldset>);
      expect(interactive(container).length).toBeGreaterThan(0);
      expect(enabledOnes(container)).toEqual([]);
    });

    it.each(Object.keys(controls))('leaves %s enabled when the fieldset is not disabled', name => {
      const { container } = render(<Fieldset legend="x">{controls[name]}</Fieldset>);
      expect(enabledOnes(container).length).toBeGreaterThan(0);
    });

    it('reaches a control however deeply it is nested', () => {
      const { container } = render(
        <Fieldset legend="x" disabled>
          <div>
            <div>
              <Checkbox name="deep" label="deep" />
            </div>
          </div>
        </Fieldset>
      );
      expect(enabledOnes(container)).toEqual([]);
    });

    it('is inherited by a nested fieldset, which cannot re-enable it', () => {
      const { container } = render(
        <Fieldset legend="outer" disabled>
          <Fieldset legend="inner" disabled={false}>
            <Switch name="n" label="n" />
            <Input name="in" aria-label="in" />
          </Fieldset>
        </Fieldset>
      );
      expect(enabledOnes(container)).toEqual([]);
    });

    // AGENTS.md: a value computed from context that must win over what a
    // consumer passes under the same name is applied after the spread, and
    // gets a test proving it.
    it('stays disabled when the control itself passes disabled={false}', () => {
      const { container } = render(
        <Fieldset legend="x" disabled>
          <Input name="a" aria-label="a" disabled={false} />
          <Textarea name="b" aria-label="b" disabled={false} />
          <Checkbox name="c" label="c" disabled={false} />
        </Fieldset>
      );
      expect(enabledOnes(container)).toEqual([]);
    });

    it("does not disable controls outside it", () => {
      render(
        <>
          <Fieldset legend="x" disabled>
            <Input name="in" aria-label="inside" />
          </Fieldset>
          <Input name="out" aria-label="outside" />
        </>
      );
      expect(screen.getByLabelText('inside')).toBeDisabled();
      expect(screen.getByLabelText('outside')).toBeEnabled();
    });

    it('renders a native disabled fieldset', () => {
      render(<Fieldset legend="Billing" disabled><Input name="in" aria-label="in" /></Fieldset>);
      expect(screen.getByRole('group', { name: 'Billing' })).toBeDisabled();
    });
  });

  describe('looks disabled, not just behaves disabled', () => {
    it('dims a plain Input and shows the not-allowed cursor', () => {
      render(<Fieldset legend="g" disabled><Input name="a" aria-label="a" /></Fieldset>);
      expect(screen.getByLabelText('a')).toHaveStyle({ opacity: '0.6', cursor: 'not-allowed' });
    });

    it('dims the Checkbox and Switch labels along with the control', () => {
      render(<Fieldset legend="g" disabled><Checkbox name="c" label="Gift" /><Switch name="s" label="Notify" /></Fieldset>);
      expect(screen.getByText('Gift')).toHaveStyle({ opacity: '0.6', cursor: 'not-allowed' });
      expect(screen.getByText('Notify')).toHaveStyle({ opacity: '0.6', cursor: 'not-allowed' });
    });

    it('leaves an enabled Input undimmed', () => {
      render(<Input name="a" aria-label="a" />);
      expect(screen.getByLabelText('a').style.opacity).toBe('');
    });
  });

  describe('Checkbox and Switch take their own disabled prop', () => {
    it('ignores a click when disabled, with no Fieldset involved', () => {
      const onChange = vi.fn();
      render(<><Checkbox name="c" label="Agree" disabled onChange={onChange} /><Switch name="s" label="Notify" disabled onChange={onChange} /></>);
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('switch'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('inside a Form', () => {
    const schema = z.object({ street: z.string().min(1), newsletter: z.boolean().optional() });

    it("leaves field binding alone: values reach onSubmit as without a Fieldset", async () => {
      const onSubmit = vi.fn();
      render(
        <Form id="ship" schema={schema} onSubmit={onSubmit}>
          <Fieldset legend="Shipping address">
            <FormField name="street" label="Street">
              <Input />
            </FormField>
            <FormField name="newsletter">
              <Checkbox label="Newsletter" />
            </FormField>
          </Fieldset>
          <SubmitButton>Save</SubmitButton>
        </Form>
      );
      fireEvent.change(screen.getByLabelText('Street'), { target: { value: '1 Main St' } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ street: '1 Main St', newsletter: true }));
    });

    it('a disabled Fieldset blocks editing but a SubmitButton outside it still works', async () => {
      const onSubmit = vi.fn();
      render(
        <Form id="ship2" schema={z.object({ street: z.string() })} onSubmit={onSubmit}>
          <Fieldset legend="Shipping address" disabled>
            <FormField name="street" label="Street">
              <Input defaultValue="prefilled" />
            </FormField>
          </Fieldset>
          <SubmitButton>Save</SubmitButton>
        </Form>
      );
      expect(screen.getByLabelText('Street')).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    });
  });
});
