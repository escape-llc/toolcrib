import { cloneElement, type ReactElement } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { z } from 'zod';
import { Form } from '../components/Form/FormContext';
import { FormField, SubmitButton, Checkbox, Switch } from '../components/Form/FormComponents';
import { CheckboxGroup } from '../components/Form/CheckboxGroup';
import { RadioGroup } from '../components/Form/RadioGroup';
import { Slider } from '../components/Form/Slider';
import { RangeSlider } from '../components/Form/RangeSlider';
import { FileUpload } from '../components/Form/FileUpload';
import { Rating } from '../components/Rating/Rating';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { DateRangePicker } from '../components/DatePicker/DateRangePicker';
import { TimeField } from '../components/DatePicker/TimeField';

// Invalid state is derived once (useFieldInvalid: touched && schema error) and
// shared by every control. These pin that each one actually reflects it, both
// from a failing Form and from an explicit aria-invalid.
const failing = z.object({ field: z.custom(() => false, 'Required') });
const OPTIONS = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }];

const CONTROLS: Record<string, () => ReactElement<Record<string, unknown>>> = {
  Checkbox: () => <Checkbox label="c" />,
  Switch: () => <Switch label="s" />,
  CheckboxGroup: () => <CheckboxGroup label="g" options={OPTIONS} />,
  RadioGroup: () => <RadioGroup aria-label="r" options={OPTIONS} />,
  Slider: () => <Slider aria-label="sl" defaultValue={10} />,
  RangeSlider: () => <RangeSlider aria-label="rs" defaultValue={[10, 20]} />,
  FileUpload: () => <FileUpload aria-label="f" />,
  Rating: () => <Rating aria-label="rt" defaultValue={2} />,
  DatePicker: () => <DatePicker aria-label="d" />,
  DateRangePicker: () => <DateRangePicker aria-label="dr" />,
  TimeField: () => <TimeField aria-label="t" />,
};

describe('invalid state on every Form control', () => {
  for (const [name, make] of Object.entries(CONTROLS)) {
    it(`${name} is aria-invalid once its field is touched and fails the schema`, async () => {
      const { container } = render(
        <Form schema={failing} initialValues={{ field: name === 'DatePicker' ? null : '' }}>
          <FormField name="field">{make()}</FormField>
          <SubmitButton>Go</SubmitButton>
        </Form>,
      );
      expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
      fireEvent.click(screen.getByText('Go'));
      await waitFor(() => expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull());
      await act(async () => {});
    });

    it(`${name} honors an explicit aria-invalid outside any Form`, async () => {
      const el = make();
      const { container } = render(cloneElement(el, { 'aria-invalid': true }));
      await act(async () => {});
      expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull();
    });

    it(`${name} is not invalid by default`, async () => {
      const { container } = render(make());
      await act(async () => {});
      expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
    });
  }
});
