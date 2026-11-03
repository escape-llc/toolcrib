import { type ReactElement, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { z } from 'zod';
import { CalendarDate, Time } from '@internationalized/date';
import manifest from '../../ai-docs/component-manifest.json';
import { Form, useFormContext } from '../components/Form/FormContext';
import { FormField, SubmitButton, Input, Textarea, Checkbox, Switch } from '../components/Form/FormComponents';
import { Select } from '../components/Form/Select';
import { Combobox } from '../components/Form/Combobox';
import { RadioGroup } from '../components/Form/RadioGroup';
import { CheckboxGroup } from '../components/Form/CheckboxGroup';
import { Slider } from '../components/Form/Slider';
import { RangeSlider } from '../components/Form/RangeSlider';
import { FileUpload } from '../components/Form/FileUpload';
import { NumberField } from '../components/NumberField/NumberField';
import { OTPField } from '../components/OTPField/OTPField';
import { Rating } from '../components/Rating/Rating';
import { DatePicker } from '../components/DatePicker/DatePicker';
import { DateRangePicker } from '../components/DatePicker/DateRangePicker';
import { TimeField } from '../components/DatePicker/TimeField';
import { Listbox } from '../components/Listbox/Listbox';
import { ToggleGroup, Toggle } from '../components/ToggleGroup/ToggleGroup';
import { Fieldset } from '../components/Fieldset/Fieldset';
import { Calendar } from '../components/DatePicker/Calendar';
import { RangeCalendar } from '../components/DatePicker/RangeCalendar';
import { declaredStates, stateExample, STATE_BASE, STATE_LABEL } from '../../demo/stateExamples';
import { FORM_CONTRACT_CHECKS as CHECK } from '../../scripts/lib/manifestContracts.js';

// The Form contract, checked on every value control at once. Each control
// takes its name from the surrounding <FormField>, and must:
//   - register: its starting value is in the submitted data untouched
//   - write: a user interaction changes the submitted value
//   - touch on change: an invalid value shows its error before any submit
//   - be named by the FormField label
//   - come back to its starting value on resetForm
// Disabled (Fieldset.test.tsx) and invalid styling (invalidState.test.tsx)
// are swept there. A new Form Control in the manifest must join CONTROLS or
// EXEMPT below, or the completeness check fails.

const OPTIONS = [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }];
const date = new CalendarDate(2026, 3, 15);

interface Contract {
  /** The control, with no name (it inherits "field" from FormField). */
  el: () => ReactElement;
  /** What an untouched control submits. */
  start: unknown;
  /** One user interaction that changes the value. */
  interact: () => void | Promise<void>;
  /** Why this control can't take its value from Form initialValues, if it can't. */
  noSeed?: string;
}

const typeAndLeave = (el: HTMLElement) => { fireEvent.change(el, { target: { value: 'x' } }); fireEvent.blur(el); };
const focusKey = (el: HTMLElement, key: string) => act(() => { el.focus(); fireEvent.keyDown(el, { key }); });

const CONTROLS: Record<string, Contract> = {
  // Text fields mark touched on blur, so typing doesn't flash errors.
  Input: { el: () => <Input />, start: '', interact: () => typeAndLeave(screen.getByRole('textbox')) },
  Textarea: { el: () => <Textarea />, start: '', interact: () => typeAndLeave(screen.getByRole('textbox')) },
  Checkbox: { el: () => <Checkbox label="c" />, start: false, interact: () => { fireEvent.click(screen.getByRole('checkbox')); } },
  Switch: { el: () => <Switch label="s" />, start: false, interact: () => { fireEvent.click(screen.getByRole('switch')); } },
  CheckboxGroup: { el: () => <CheckboxGroup options={OPTIONS} />, start: [], interact: () => { fireEvent.click(screen.getAllByRole('checkbox')[0]); } },
  RadioGroup: { el: () => <RadioGroup options={OPTIONS} />, start: '', interact: () => { fireEvent.click(screen.getAllByRole('radio')[1]); } },
  Select: {
    el: () => <Select options={OPTIONS} />,
    start: '',
    interact: async () => {
      fireEvent.click(screen.getByRole('combobox'));
      fireEvent.click(await screen.findByRole('option', { name: 'Two' }));
    },
  },
  Combobox: {
    el: () => <Combobox options={OPTIONS} />,
    start: '',
    interact: async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Tw' } });
      fireEvent.click(await screen.findByRole('option', { name: 'Two' }));
    },
  },
  NumberField: {
    el: () => <NumberField />,
    start: null,
    interact: () => {
      const input = screen.getByRole('textbox');
      act(() => { input.focus(); });
      fireEvent.change(input, { target: { value: '5' } });
      act(() => { input.blur(); });
    },
  },
  OTPField: { el: () => <OTPField length={2} />, start: '', interact: () => { fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '1' } }); } },
  FileUpload: {
    noSeed: 'a browser cannot prefill a file picker, so the list starts empty',
    el: () => <FileUpload />,
    start: [],
    interact: () => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['a'], 'a.txt', { type: 'text/plain' })] } });
    },
  },
  Slider: { el: () => <Slider defaultValue={10} />, start: 10, interact: () => focusKey(screen.getByRole('slider'), 'ArrowRight') },
  RangeSlider: { el: () => <RangeSlider defaultValue={[10, 20]} />, start: [10, 20], interact: () => focusKey(screen.getAllByRole('slider')[0], 'ArrowRight') },
  Rating: { el: () => <Rating defaultValue={2} />, start: 2, interact: () => { fireEvent.click(screen.getAllByRole('radio')[3]); } },
  DatePicker: { el: () => <DatePicker defaultValue={date} />, start: date, interact: () => focusKey(screen.getAllByRole('spinbutton')[0], 'ArrowUp') },
  DateRangePicker: {
    el: () => <DateRangePicker defaultValue={{ start: date, end: date.add({ days: 2 }) }} />,
    start: { start: date, end: date.add({ days: 2 }) },
    interact: () => focusKey(screen.getAllByRole('spinbutton')[0], 'ArrowUp'),
  },
  TimeField: { el: () => <TimeField defaultValue={new Time(9, 0)} />, start: new Time(9, 0), interact: () => focusKey(screen.getAllByRole('spinbutton')[0], 'ArrowUp') },
  Listbox: { el: () => <Listbox id="lb" options={OPTIONS} />, start: '', interact: () => { fireEvent.click(screen.getAllByRole('option')[1]); } },
  ToggleGroup: { el: () => <ToggleGroup type="single" options={OPTIONS} />, start: '', interact: () => { fireEvent.click(screen.getByRole('radio', { name: 'Two' })); } },
  Toggle: { el: () => <Toggle>t</Toggle>, start: false, interact: () => { fireEvent.click(screen.getByRole('button', { name: 'Field' })); } },
  // A day cell is named by its full date.
  Calendar: { el: () => <Calendar defaultValue={date} />, start: date, interact: () => { fireEvent.click(screen.getByRole('button', { name: /March 18, 2026/ })); } },
  RangeCalendar: {
    el: () => <RangeCalendar defaultValue={{ start: date, end: date.add({ days: 2 }) }} />,
    start: { start: date, end: date.add({ days: 2 }) },
    interact: () => {
      fireEvent.click(screen.getByRole('button', { name: /March 20, 2026/ }));
      fireEvent.click(screen.getByRole('button', { name: /March 22, 2026/ }));
    },
  },
};

/** Form Controls that hold no field value of their own, with why. */
const EXEMPT: Record<string, string> = {
  Button: 'an action, not a value',
  SubmitButton: 'an action, not a value',
  Form: 'the container under test',
  FormField: 'supplies the name and label under test',
  FormError: 'displays form-level errors',
  Label: 'names a control',
  Fieldset: 'groups controls; swept in Fieldset.test.tsx',
  Pagination: 'navigation, not a submitted value',
  ThemeEditor: 'edits the theme, not a form',
};

const same = (a: unknown, b: unknown) => expect(JSON.stringify(a)).toBe(JSON.stringify(b));

const Reset = () => {
  const { resetForm } = useFormContext();
  return <button type="button" onClick={resetForm}>Reset</button>;
};

const failing = z.object({ field: z.custom(() => false, 'Nope') });

function renderInForm(c: Contract, { schema, initialValues, disabled }: { schema?: z.ZodTypeAny; initialValues?: Record<string, unknown>; disabled?: boolean } = {}) {
  const onSubmit = vi.fn();
  const field = <FormField name="field" label="Field">{c.el()}</FormField>;
  const { unmount } = render(
    <Form id="contract" schema={schema as never} initialValues={initialValues} onSubmit={onSubmit}>
      <div data-testid="field-host">
        {disabled ? <Fieldset legend="Group" disabled>{field}</Fieldset> : field}
      </div>
      <SubmitButton>Go</SubmitButton>
      <Reset />
    </Form>,
  );
  const submitted = async () => {
    onSubmit.mockClear();
    fireEvent.click(screen.getByText('Go'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    return onSubmit.mock.calls[0][0] as Record<string, unknown>;
  };
  return { submitted, unmount };
}

const INTERACTIVE =
  'button, input, textarea, select, [role=checkbox], [role=switch], [role=radio], [role=slider], [role=combobox], [role=spinbutton], [role=button], [role=option]';
const isDisabled = (el: Element) =>
  el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled') || el.closest('[aria-disabled=true]') !== null;

/**
 * What a user perceives of the field: its text, every control's value and
 * checked/pressed/selected/slider state, and which elements take Tab.
 * Markup bookkeeping (data-* state mirrors, generated ids) is left out.
 */
const shown = (withTabOrder = true) => {
  act(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
  const host = screen.getByTestId('field-host');
  const parts = [host.textContent ?? ''];
  host.querySelectorAll<HTMLElement>('*').forEach(el => {
    const v = (el as HTMLInputElement).value;
    const attrs = ['aria-checked', 'aria-pressed', 'aria-selected', 'aria-valuenow', 'aria-valuetext', ...(withTabOrder ? ['tabindex'] : [])]
      .map(a => el.getAttribute(a)).join('|');
    parts.push(`${el.tagName}:${typeof v === 'string' && el.tagName !== 'BUTTON' ? v : ''}:${attrs}`);
  });
  return parts.join('\n');
};

describe('Form control contract', () => {
  it('covers every Form Control in the manifest', () => {
    const formControls = (manifest as { components: { name: string; category: string }[] }).components
      .filter(c => c.category === 'Form Controls')
      .map(c => c.name);
    const unaccounted = formControls.filter(n => !(n in CONTROLS) && !(n in EXEMPT));
    expect(unaccounted).toEqual([]);
    expect([...Object.keys(CONTROLS), ...Object.keys(EXEMPT)].filter(n => !formControls.includes(n))).toEqual([]);
  });

  // The manifest's form-contract guarantee is exactly this list: everything
  // checked here declares it, and nothing else does.
  it('the form-contract guarantee is declared by exactly the controls checked here', () => {
    const declared = (manifest as { components: { name: string; guarantees?: string[] }[] }).components
      .filter(c => c.guarantees?.includes('form-contract'))
      .map(c => c.name)
      .sort();
    expect(declared).toEqual(Object.keys(CONTROLS).sort());
  });

  describe.each(Object.entries(CONTROLS))('%s', (_name, c) => {
    it(CHECK[0], async () => {
      const { submitted } = renderInForm(c);
      const data = await submitted();
      expect(data).toHaveProperty('field');
      same(data.field, c.start);
    });

    it(CHECK[1], async () => {
      const { submitted } = renderInForm(c);
      await c.interact();
      const data = await submitted();
      expect(data).toHaveProperty('field');
      expect(JSON.stringify(data.field)).not.toBe(JSON.stringify(c.start));
    });

    it(CHECK[2], async () => {
      renderInForm(c, { schema: failing });
      await c.interact();
      await waitFor(() => expect(screen.getByText('Nope')).toBeInTheDocument());
    });

    it(CHECK[3], async () => {
      renderInForm(c);
      const label = screen.getByText('Field');
      const byId = label.getAttribute('for') ? document.getElementById(label.getAttribute('for')!) : null;
      const labelled = label.id ? document.querySelector(`[aria-labelledby~="${label.id}"]`) : null;
      expect(byId ?? labelled).not.toBeNull();
      await act(async () => {});
    });

    it(CHECK[4], async () => {
      const { submitted } = renderInForm(c);
      await c.interact();
      fireEvent.click(screen.getByText('Reset'));
      const data = await submitted();
      expect(data).toHaveProperty('field');
      same(data.field, c.start);
    });

    it(CHECK[5], async () => {
      renderInForm(c);
      await act(async () => {});
      const before = shown();
      await c.interact();
      act(() => { fireEvent.click(screen.getByText('Reset')); });
      await act(async () => {});
      expect(shown()).toBe(before);
    });

    it(CHECK[6], async () => {
      renderInForm(c, { schema: failing });
      await c.interact();
      await waitFor(() => expect(screen.getByText('Nope')).toBeInTheDocument());
      act(() => { fireEvent.click(screen.getByText('Reset')); });
      await act(async () => {});
      // The text stays for the collapse animation; the region is what closes.
      expect(screen.getByTestId('form-field-error-region-field')).toHaveAttribute('aria-hidden', 'true');
    });

    // Tab order is left out: a jsdom click doesn't focus, so a clicked radio
    // keeps the old tab stop, which a real browser moves on the click.
    it.skipIf(!!c.noSeed)(CHECK[7], async () => {
      const typed = renderInForm(c);
      await c.interact();
      const entered = (await typed.submitted()).field;
      const enteredShown = shown(false);
      typed.unmount();

      const seeded = renderInForm(c, { initialValues: { field: entered } });
      await act(async () => {});
      expect(shown(false)).toBe(enteredShown);
      same((await seeded.submitted()).field, entered);
    });

    it(CHECK[8], async () => {
      renderInForm(c, { disabled: true });
      await act(async () => {});
      const controls = Array.from(screen.getByTestId('field-host').querySelectorAll<HTMLInputElement>(INTERACTIVE))
        .filter(el => !el.hidden && el.type !== 'hidden' && !el.closest('legend'));
      expect(controls.length).toBeGreaterThan(0);
      expect(controls.filter(el => !isDisabled(el)).map(el => el.outerHTML.slice(0, 80))).toEqual([]);
    });

    it(CHECK[9], async () => {
      renderInForm(c, { schema: failing });
      const host = screen.getByTestId('field-host');
      expect(host.querySelector('[aria-invalid="true"]')).toBeNull();
      fireEvent.click(screen.getByText('Go'));
      await waitFor(() => expect(screen.getByText('Nope')).toBeInTheDocument());
      await act(async () => {});
      expect(host.querySelector('[aria-invalid="true"]')).not.toBeNull();
      expect(host.querySelector('[aria-describedby~="field-error"]')).not.toBeNull();
    });
  });
});

// A submit in the same tick the controls mount (before their registration
// has re-rendered the Form) still validates, submits and touches every one:
// the demo's invalid examples submit exactly like this.
describe('submit on mount', () => {
  const SubmitOnMount = () => {
    const { handleSubmit } = useFormContext();
    useEffect(() => { handleSubmit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  };
  it.each(Object.entries(CONTROLS))(`%s ${CHECK[10]}`, async (_name, c) => {
    const onSubmit = vi.fn();
    const { unmount } = render(
      <Form schema={failing} onSubmit={onSubmit}>
        <FormField name="field" label="Field">{c.el()}</FormField>
        <SubmitOnMount />
      </Form>,
    );
    await waitFor(() => expect(screen.getByText('Nope')).toBeInTheDocument());
    unmount();
    const ok = vi.fn();
    render(
      <Form onSubmit={ok}>
        <FormField name="field" label="Field">{c.el()}</FormField>
        <SubmitOnMount />
      </Form>,
    );
    await waitFor(() => expect(ok).toHaveBeenCalled());
    same(ok.mock.calls[0][0].field, c.start);
  });
});

// The Catalog's States card renders whatever a component declares with
// @manifestStates, mechanically (demo/stateExamples.tsx). These render each
// declared state through that same function and check it really is in it.
describe('declared states', () => {
  const withStates = (manifest as { components: { name: string; states?: string[] }[] }).components.filter(c => c.states);

  it('every Form control declares default, disabled and invalid, and has a base example', () => {
    const missing = Object.keys(CONTROLS).flatMap(n => {
      const s = declaredStates(n);
      return [...['default', 'disabled', 'invalid'].filter(x => !s.includes(x as never)).map(x => `${n}: ${x}`), ...(n in STATE_BASE ? [] : [`${n}: no base example`])];
    });
    expect(missing).toEqual([]);
    expect(withStates.map(c => c.name).filter(n => !(n in STATE_BASE))).toEqual([]);
  });

  const cases = withStates.flatMap(c => declaredStates(c.name).map(state => [c.name, state] as const));
  it.each(cases)('%s renders its %s state', async (name, state) => {
    const { container } = render(<>{stateExample(name, state)}</>);
    await act(async () => {});
    const label = STATE_LABEL[state];
    const controls = () => Array.from(container.querySelectorAll<HTMLInputElement>(INTERACTIVE)).filter(el => !el.hidden && el.type !== 'hidden');
    switch (state) {
      case 'default':
        expect(container.textContent + container.innerHTML).toContain(label);
        expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
        break;
      case 'focused':
        // The same elements demo/index.css draws the ring on.
        expect(container.querySelector('[data-demo-state="focused"] .ai-focus-ring, [data-demo-state="focused"] .ai-btn')).not.toBeNull();
        break;
      case 'disabled':
        expect(controls().length).toBeGreaterThan(0);
        expect(controls().filter(el => !isDisabled(el)).map(el => el.outerHTML.slice(0, 80))).toEqual([]);
        break;
      case 'read-only':
        expect(container.querySelector('[readonly], [aria-readonly="true"], [role="img"]')).not.toBeNull();
        break;
      case 'invalid': {
        // The example submits itself with requestSubmit(), which jsdom lacks.
        fireEvent.submit(container.querySelector('form')!);
        await waitFor(() => expect(screen.getByText('This field is required')).toBeInTheDocument());
        await act(async () => {});
        expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull();
        // It must look invalid too, not only say so: some part of the control
        // itself (not the error message below it) is painted in the error color.
        const painted = Array.from(container.querySelectorAll<HTMLElement>('[style]'))
          .filter(el => !el.closest('[data-testid^="form-field-error-region"]'))
          .some(el => el.getAttribute('style')!.includes('--ai-subtheme-error'));
        expect(painted).toBe(true);
        break;
      }
    }
  });
});
