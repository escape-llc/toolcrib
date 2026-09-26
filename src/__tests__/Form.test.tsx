import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { z } from 'zod';
import { Form, useFormContext } from '../components/Form/FormContext';
import { FormField, Input, Textarea, Checkbox, Switch, FormError, SubmitButton, Button } from '../components/Form/FormComponents';
import { UIGroup } from '../components/UIGroup/UIGroup';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// Switch (Radix Switch) uses react-use-size internally, which relies on
// ResizeObserver — not implemented in jsdom. Same polyfill pattern already
// used in RadixPrimitives.test.tsx and elsewhere for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

const testSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 chars'),
  email: z.string().email('Invalid email address'),
});

describe('Form & Zod Validation Engine', () => {
  it('validates schema on submit and emits form:errored to EventBus', async () => {
    const handleSubmit = vi.fn();
    const validatedSpy = vi.fn();
    const erroredSpy = vi.fn();

    aiBus.on('form:validated', validatedSpy);
    aiBus.on('form:errored', erroredSpy);

    render(
      <Form id="test-form" schema={testSchema} onSubmit={handleSubmit}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
        <FormField name="email" label="Email">
          <Input placeholder="Email" />
        </FormField>
        <FormError />
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    // Clean/untouched-state scan: no aria-invalid, no aria-describedby, no
    // error text yet -- genuinely different DOM from the errored state
    // scanned below.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });

    // Errored-state scan: aria-invalid + aria-describedby now wired up on
    // both inputs, plus the visible error text itself.
    expect(await axe(document.body)).toHaveNoViolations();

    expect(validatedSpy).toHaveBeenCalledWith({ formId: 'test-form', isValid: false });
    expect(erroredSpy).toHaveBeenCalledWith({
      formId: 'test-form',
      errors: {
        username: 'Username must be at least 3 chars',
        email: 'Invalid email address',
      },
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits successfully and emits form:submitted to EventBus', async () => {
    const handleSubmit = vi.fn();
    const submittedSpy = vi.fn();

    aiBus.on('form:submitted', submittedSpy);

    render(
      <Form id="test-form" schema={testSchema} onSubmit={handleSubmit}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
        <FormField name="email" label="Email">
          <Input placeholder="Email" />
        </FormField>
        <SubmitButton>Submit</SubmitButton>
      </Form>
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ username: 'alice', email: 'alice@example.com' });
    });

    expect(submittedSpy).toHaveBeenCalledWith({
      formId: 'test-form',
      values: { username: 'alice', email: 'alice@example.com' },
    });
  });

  describe("regression: onSubmit receives the schema's parsed output, not raw field strings", () => {
    // Every field control (Input included) always stores a raw string in
    // Form's own `values` state — that's what a <Form> with no schema at
    // all correctly hands onSubmit unchanged. But a schema using
    // z.coerce.number()/`.transform()` previously validated that string
    // correctly (schema.safeParse ran fine) and then handed onSubmit the
    // SAME raw string back anyway, discarding safeParse's own `result.data`
    // — so `onSubmit`'s declared type (`z.infer<typeof schema>`, a real
    // `number` here) didn't match what actually arrived at runtime. Found
    // for real in a consumer app (Founder's Desk): a `.toFixed()` call on
    // what the schema's type said was already a `number` crashed, because
    // it was still the submitted string.
    it('a z.coerce.number() field arrives at onSubmit as a real number, not the raw input string', async () => {
      const amountSchema = z.object({ amount: z.coerce.number().positive('Enter a positive amount') });
      const handleSubmit = vi.fn();

      render(
        <Form id="amount-form" schema={amountSchema} onSubmit={handleSubmit}>
          <FormField name="amount" label="Amount">
            <Input placeholder="Amount" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '123.45' } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ amount: 123.45 });
      });
      // The live field itself still displays the raw string -- coercion
      // only applies to onSubmit's payload, not to Form's own `values`
      // state (which is what a bound <Input> reads back).
      expect(screen.getByPlaceholderText('Amount')).toHaveValue('123.45');
    });

    it('form:submitted on the event bus also carries the parsed output, matching onSubmit', async () => {
      const amountSchema = z.object({ amount: z.coerce.number() });
      const submittedSpy = vi.fn();
      const unsub = aiBus.on('form:submitted', submittedSpy);

      render(
        <Form id="amount-form-2" schema={amountSchema}>
          <FormField name="amount" label="Amount">
            <Input placeholder="Amount" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '10' } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(submittedSpy).toHaveBeenCalledWith({ formId: 'amount-form-2', values: { amount: 10 } });
      });
      unsub();
    });

    it('a form with no schema still passes onSubmit the raw string, since there is nothing to parse it into', async () => {
      const handleSubmit = vi.fn();
      render(
        <Form id="no-schema-amount-form" onSubmit={handleSubmit}>
          <FormField name="amount" label="Amount">
            <Input placeholder="Amount" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '10' } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ amount: '10' });
      });
    });
  });

  it('stays disabled while submitting even when the consumer passes their own disabled prop (regression)', async () => {
    // Reproduces a real bug: SubmitButton spread {...props} *after* its
    // computed disabled={isSubmitting || props.disabled}, so passing any
    // explicit `disabled` at all — even `disabled={false}`, as a consumer
    // gating submission on form validity naturally would — silently
    // re-applied that original value via the trailing spread and discarded
    // the isSubmitting guard entirely.
    let resolveSubmit: () => void;
    const handleSubmit = vi.fn(
      () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    render(
      <Form id="test-form" schema={testSchema} onSubmit={handleSubmit}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
        <FormField name="email" label="Email">
          <Input placeholder="Email" />
        </FormField>
        <SubmitButton disabled={false}>Submit</SubmitButton>
      </Form>
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'alice@example.com' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });

    resolveSubmit!();
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('emits live form:validated on field change', () => {
    const validatedSpy = vi.fn();
    aiBus.on('form:validated', validatedSpy);

    render(
      <Form id="test-form" schema={testSchema}>
        <FormField name="username" label="Username">
          <Input placeholder="Username" />
        </FormField>
      </Form>
    );

    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'bo' } });

    expect(validatedSpy).toHaveBeenCalledWith({ formId: 'test-form', isValid: false });
  });

  describe('regression: validation errors were computed but never exposed via ARIA', () => {
    // Input/Textarea already computed `isError` for border-color styling but
    // never set aria-invalid/aria-describedby, and FormField's error <span>
    // had no id for aria-describedby to point at — a screen reader user got
    // no indication a field had failed validation at all.
    it('sets aria-invalid and a resolving aria-describedby on Input once touched and invalid', async () => {
      render(
        <Form id="test-form" schema={testSchema} onSubmit={vi.fn()}>
          <FormField name="username" label="Username">
            <Input placeholder="Username" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Username');
        expect(input).toHaveAttribute('aria-invalid', 'true');
        const describedBy = input.getAttribute('aria-describedby');
        expect(describedBy).toBe('username-error');
        expect(document.getElementById(describedBy!)).toHaveTextContent('Username must be at least 3 chars');
      });
    });

    it('sets aria-invalid and a resolving aria-describedby on Textarea once touched and invalid', async () => {
      const bioSchema = z.object({ bio: z.string().min(5, 'Bio is too short') });
      render(
        <Form id="bio-form" schema={bioSchema} onSubmit={vi.fn()}>
          <FormField name="bio" label="Bio">
            <Textarea placeholder="Bio" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('Bio');
        expect(textarea).toHaveAttribute('aria-invalid', 'true');
        const describedBy = textarea.getAttribute('aria-describedby');
        expect(describedBy).toBe('bio-error');
        expect(document.getElementById(describedBy!)).toHaveTextContent('Bio is too short');
      });
    });
  });

  describe('regression coverage: schema-less forms, resetForm, validateField, useFormContext, onSubmit errors', () => {
    it('a Form with no schema submits directly without ever computing validation errors', async () => {
      const handleSubmit = vi.fn();
      render(
        <Form id="no-schema-form" onSubmit={handleSubmit}>
          <FormField name="note" label="Note">
            <Input placeholder="Note" />
          </FormField>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Note'), { target: { value: 'hello' } });
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ note: 'hello' });
      });
    });

    it('logs a console error but still clears isSubmitting when onSubmit throws', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handleSubmit = vi.fn(() => { throw new Error('boom'); });

      render(
        <Form id="throwing-form" onSubmit={handleSubmit}>
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Error in Form onSubmit:', expect.any(Error));
      });
      await waitFor(() => {
        expect(screen.getByText('Submit')).not.toBeDisabled();
      });

      consoleError.mockRestore();
    });

    it('resetForm (via useFormContext, the named hook) restores initial values/errors/touched', async () => {
      const ResetButton = () => {
        const { resetForm } = useFormContext();
        return <button type="button" onClick={resetForm}>Reset</button>;
      };

      render(
        <Form id="reset-form" schema={testSchema} initialValues={{ username: 'seed', email: '' }}>
          <FormField name="username" label="Username">
            <Input placeholder="Username" />
          </FormField>
          <ResetButton />
        </Form>
      );

      fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'changed' } });
      expect(screen.getByPlaceholderText('Username')).toHaveValue('changed');

      fireEvent.click(screen.getByText('Reset'));
      expect(screen.getByPlaceholderText('Username')).toHaveValue('seed');
    });

    it('validateField (via useFormContext) validates a single field on demand and returns its validity', () => {
      let lastResult: boolean | undefined;
      const ValidateButton = () => {
        const { validateField } = useFormContext();
        return (
          <button type="button" onClick={() => { lastResult = validateField('username', 'ab'); }}>
            Validate
          </button>
        );
      };

      const erroredSpy = vi.fn();
      const unsub = aiBus.on('form:errored', erroredSpy);

      render(
        <Form id="validate-field-form" schema={testSchema}>
          <ValidateButton />
        </Form>
      );

      fireEvent.click(screen.getByText('Validate'));
      // validateField doesn't mark the field touched itself (that's a
      // separate concern from field controls' own onBlur) — the emitted
      // event is what proves the schema actually ran against the supplied
      // value, independent of whether anything's currently displayed.
      expect(lastResult).toBe(false);
      expect(erroredSpy).toHaveBeenCalledWith(
        expect.objectContaining({ errors: expect.objectContaining({ username: 'Username must be at least 3 chars' }) })
      );

      unsub();
    });

    it('useFormContext throws when called outside a <Form>', () => {
      const Orphan = () => {
        useFormContext();
        return null;
      };
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<Orphan />)).toThrow('Form controls must be rendered within a <Form> component');
      consoleError.mockRestore();
    });
  });

  describe('regression coverage: FormError with an explicit field name', () => {
    // Was `expect(container.querySelector('div')).toBeNull()` -- issue #503
    // deliberately changed this: FormError now always renders its own
    // outer grid wrapper (collapsed to 0fr height when there's nothing to
    // show) instead of returning null, specifically so the transition from
    // "nothing" to "an error" is a real CSS animation (grid-template-rows)
    // on an already-existing node, not a freshly-inserted one -- a
    // transition can't animate a node's very first paint. The real,
    // current behavior to assert is "no error text," not "no div at all."
    it('renders no error text for a field with no error, or one not yet touched', () => {
      render(
        <Form id="field-error-form" schema={testSchema}>
          <FormError name="username" />
        </Form>
      );
      expect(screen.queryByText(/must be at least/i)).not.toBeInTheDocument();
    });

    it('renders the field-specific message once that field is touched and invalid', async () => {
      render(
        <Form id="field-error-form-2" schema={testSchema}>
          {/* A bare Input (no FormField wrapper, so no built-in error span
              of its own) inside FieldContext directly — isolates the
              assertion to FormError's own rendering, rather than also
              matching FormField's separate error span for the same text. */}
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
          <FormError name="username" />
          <SubmitButton>Submit</SubmitButton>
        </Form>
      );

      fireEvent.click(screen.getByText('Submit'));
      await waitFor(() => {
        expect(screen.getAllByText('Username must be at least 3 chars').length).toBeGreaterThan(0);
      });
    });

    it('renders nothing when rendered outside any <Form>', () => {
      const { container } = render(<FormError name="anything" />);
      expect(container.firstChild).toBeNull();
    });
  });

  // Regression coverage for issue #503: validation error messages used to
  // slam open/closed (a plain conditional render, no transition at all).
  // jsdom has no real layout engine (can't observe an actual animated
  // pixel height, per this repo's own established limitation -- see
  // AGENTS.md's "CSS/real-layout invisibility" entry), so these assert the
  // one thing jsdom *can* see: the collapsed/expanded `grid-template-rows`
  // value is applied on the correct render, for both FormField's own error
  // span and both FormError variants. A real Playwright e2e test covers
  // the actual visual transition (e2e/form-validation-transition.spec.ts).
  describe('regression coverage: validation error messages slide via grid-template-rows, not a plain conditional render (issue #503)', () => {
    // Queries by the inline style itself (present on every render,
    // collapsed or expanded) rather than by ancestor-walking from the
    // error/helper text -- that text doesn't exist in the DOM at all in
    // the "before" (collapsed, nothing to show) case, so there's nothing
    // to walk up FROM at that point. Scoped to `container` since the grid
    // wrapper is a *sibling* of the field's own control, not its ancestor.
    function gridWrapperRows(container: HTMLElement, nth = 0): string | undefined {
      const wrappers = Array.from(container.querySelectorAll<HTMLElement>('[style*="grid-template-rows"]'));
      return wrappers[nth]?.style.gridTemplateRows;
    }

    it('FormField: collapses to 0fr with no error and no helperText, expands to 1fr once touched and invalid', async () => {
      const { container } = render(
        <Form id="slide-form-field" schema={testSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );
      expect(gridWrapperRows(container)).toBe('0fr');

      // onChange computes the error silently; onBlur is what actually
      // reveals it (see "Input onBlur reveals an error already computed
      // by a prior change" below) -- blur alone, with nothing ever
      // computed, has no error to reveal.
      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();
        expect(gridWrapperRows(container)).toBe('1fr');
      });
    });

    it('FormField: helperText alone (no error) also expands the same wrapper to 1fr', () => {
      const { container } = render(
        <Form id="slide-form-field-helper" schema={testSchema}>
          <FormField name="username" helperText="Pick anything you like">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );
      expect(screen.getByText('Pick anything you like')).toBeInTheDocument();
      expect(gridWrapperRows(container)).toBe('1fr');
    });

    it('FormError (named): collapses to 0fr with no error, expands to 1fr once touched and invalid', async () => {
      const { container } = render(
        <Form id="slide-form-error-named" schema={testSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
          <FormError name="username" />
        </Form>
      );
      // Index 1: FormField's own error-region wrapper is index 0 (always
      // present, per the test above), FormError's own is the second.
      expect(gridWrapperRows(container, 1)).toBe('0fr');

      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      // Polls only the grid state, not text presence -- the error TEXT
      // node itself is still conditionally rendered here (`{error}` as
      // children, empty when undefined), so a text-based gate would be
      // meaningful for this specific case, but the summary variant right
      // below has no such gate available (see its own comment) and this
      // stays consistent with it rather than relying on a distinction
      // that's true for one FormError variant and not the other.
      await waitFor(() => {
        expect(gridWrapperRows(container, 1)).toBe('1fr');
      });
      expect(screen.getAllByText('Username must be at least 3 chars').length).toBeGreaterThan(0);
    });

    it('FormError (summary): collapses to 0fr with no errors, expands to 1fr once any field is touched and invalid', async () => {
      const { container } = render(
        <Form id="slide-form-error-summary" schema={testSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
          <FormError />
        </Form>
      );
      expect(gridWrapperRows(container, 1)).toBe('0fr');

      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      // The banner's own text ("Please correct the errors...") is a
      // static string, unconditionally rendered regardless of hasErrors --
      // only the wrapper's own grid-template-rows reflects real state, so
      // that's the only thing worth polling here. Gating on text presence
      // instead would be a no-op race: the text is already in the DOM on
      // the very first render, before this blur's own state update lands.
      await waitFor(() => {
        expect(gridWrapperRows(container, 1)).toBe('1fr');
      });
    });

    // Regression coverage for a real finding from review (Gemini, PR
    // #506): `overflow: hidden` + `grid-template-rows: 0fr` clips content
    // to zero *visible* area, but isn't guaranteed to read as "hidden" to
    // every screen reader's own visibility heuristic -- most load-bearing
    // for FormError's summary variant specifically, whose own banner text
    // is a *static* string always present in the DOM regardless of
    // hasErrors (unlike FormField's error span, or the named FormError
    // variant's inner div, both of which have no text content at all
    // while collapsed -- nothing to leak either way, but aria-hidden is
    // applied uniformly across all three for defense-in-depth/consistency).
    it('all three wrappers are aria-hidden while collapsed, and not aria-hidden once expanded', async () => {
      const { container } = render(
        <Form id="slide-aria-hidden" schema={testSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
          <FormError name="username" />
          <FormError />
        </Form>
      );
      const wrappersBefore = Array.from(container.querySelectorAll<HTMLElement>('[style*="grid-template-rows"]'));
      expect(wrappersBefore.map(w => w.getAttribute('aria-hidden'))).toEqual(['true', 'true', 'true']);

      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      await waitFor(() => {
        const wrappersAfter = Array.from(container.querySelectorAll<HTMLElement>('[style*="grid-template-rows"]'));
        expect(wrappersAfter.map(w => w.getAttribute('aria-hidden'))).toEqual(['false', 'false', 'false']);
      });
    });
  });

  // Regression coverage for issue #507: a plain `{condition && <span>...}`
  // unmounts the error/helperText the instant the underlying condition
  // goes false -- before the wrapper's own grid-template-rows collapse
  // transition has actually run, so the collapse used to animate an
  // already-empty region instead of the text visibly sliding away with
  // it. useDeferredCollapseContent holds the last-shown content until a
  // real transitionend fires for the wrapper's own collapsing property --
  // simulated here via fireEvent.transitionEnd (jsdom has no real CSS
  // transition engine to fire this on its own).
  describe('regression coverage: validation text stays rendered through the collapse, not unmounted instantly (issue #507)', () => {
    const singleFieldSchema = z.object({ username: z.string().min(3, 'Username must be at least 3 chars') });

    function gridWrapper(container: HTMLElement, nth = 0): HTMLElement {
      return Array.from(container.querySelectorAll<HTMLElement>('[style*="grid-template-rows"]'))[nth];
    }

    it('FormField: keeps the error text rendered after it clears, until transitionend fires on the collapsing wrapper', async () => {
      const { container } = render(
        <Form id="deferred-collapse-field" schema={singleFieldSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );

      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      await waitFor(() => expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument());

      const wrapper = gridWrapper(container);
      expect(wrapper.style.gridTemplateRows).toBe('1fr');

      // Fixing the field clears the error -- the wrapper starts
      // collapsing immediately (real state, drives the actual CSS
      // transition), but the text itself must still be in the DOM right
      // up until the transition genuinely finishes.
      fireEvent.change(input, { target: { value: 'abc' } });
      await waitFor(() => expect(wrapper.style.gridTemplateRows).toBe('0fr'));
      expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();

      // The real completion signal -- only once this fires does the held
      // text actually unmount.
      fireEvent.transitionEnd(wrapper, { propertyName: 'grid-template-rows' });
      expect(screen.queryByText('Username must be at least 3 chars')).not.toBeInTheDocument();
    });

    // Regression coverage for a real finding from review (Gemini, PR
    // #511): an EXPAND transition (0fr -> 1fr, e.g. when the error first
    // appears) also fires its own grid-template-rows transitionend on
    // this same wrapper -- an earlier version cleared the held state
    // unconditionally on ANY transitionend regardless of direction,
    // which is harmless to what's actually displayed (display already
    // ignores the held value whenever content is non-empty) but caused
    // two redundant re-renders on every single expansion. Fixed by only
    // clearing when the transition that just finished was genuinely a
    // collapse (content empty at the time it fires) -- this test
    // confirms the FIX side directly: firing transitionend WHILE the
    // error is still present must not clear anything the error text
    // still needs.
    it('FormField: a transitionend firing while the error is still present (the expand direction) does not clear the held text', async () => {
      const { container } = render(
        <Form id="deferred-collapse-field-expand-transitionend" schema={singleFieldSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );

      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      await waitFor(() => expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument());

      const wrapper = gridWrapper(container);
      expect(wrapper.style.gridTemplateRows).toBe('1fr');

      // Simulates the real expand transition's own transitionend --
      // must be a no-op while the error is still genuinely present.
      fireEvent.transitionEnd(wrapper, { propertyName: 'grid-template-rows' });
      expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();

      // The field is still invalid and untouched-error-cleared-yet --
      // confirms the wrapper itself wasn't affected either.
      expect(wrapper.style.gridTemplateRows).toBe('1fr');
    });

    // Regression coverage for a second real finding from the same review
    // (Gemini, PR #511): an earlier version derived its comparison key
    // via `String(helperText)`, which collapses EVERY distinct JSX
    // element to the identical literal "[object Object]" -- so swapping
    // from one JSX helperText value to a different one went undetected,
    // and a later collapse would hold onto the FIRST JSX value ever
    // shown, not the most recently displayed one. Fixed by comparing the
    // raw `helperText` prop directly instead of a stringified stand-in.
    it('FormField: swapping helperText between two different JSX values is detected, so a later collapse holds the most recent one, not the first', () => {
      const { rerender, container } = render(
        <Form id="deferred-collapse-jsx-helper" schema={singleFieldSchema}>
          <FormField name="username" helperText={<em>First hint</em>}>
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );
      expect(screen.getByText('First hint')).toBeInTheDocument();

      rerender(
        <Form id="deferred-collapse-jsx-helper" schema={singleFieldSchema}>
          <FormField name="username" helperText={<em>Second hint</em>}>
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );
      expect(screen.getByText('Second hint')).toBeInTheDocument();
      expect(screen.queryByText('First hint')).not.toBeInTheDocument();

      // helperText removed entirely -- the wrapper starts collapsing,
      // but the HELD content must be "Second hint" (the most recent),
      // never "First hint" (the stale value a String()-based key would
      // have wrongly stuck on, since both stringify identically).
      rerender(
        <Form id="deferred-collapse-jsx-helper" schema={singleFieldSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );
      expect(screen.getByText('Second hint')).toBeInTheDocument();
      expect(screen.queryByText('First hint')).not.toBeInTheDocument();

      const wrapper = gridWrapper(container);
      fireEvent.transitionEnd(wrapper, { propertyName: 'grid-template-rows' });
      expect(screen.queryByText('Second hint')).not.toBeInTheDocument();
    });

    it('FormField: swapping from error text to helperText updates immediately, with no held/stale content', async () => {
      const { container } = render(
        <Form id="deferred-collapse-field-swap" schema={singleFieldSchema}>
          <FormField name="username" helperText="Pick anything you like">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );

      const input = screen.getByPlaceholderText('Username');
      expect(screen.getByText('Pick anything you like')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      await waitFor(() => expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument());
      expect(screen.queryByText('Pick anything you like')).not.toBeInTheDocument();

      // Swapping back to valid reveals helperText again -- immediately,
      // not deferred (the wrapper never collapses here at all; there's
      // nothing to hold onto a stale value for).
      fireEvent.change(input, { target: { value: 'abc' } });
      await waitFor(() => expect(screen.getByText('Pick anything you like')).toBeInTheDocument());
      expect(screen.queryByText('Username must be at least 3 chars')).not.toBeInTheDocument();
      expect(gridWrapper(container).style.gridTemplateRows).toBe('1fr');
    });

    it('FormError (named): keeps the error text rendered after it clears, until transitionend fires', async () => {
      const { container } = render(
        <Form id="deferred-collapse-named-error" schema={singleFieldSchema}>
          <FormField name="username">
            <Input placeholder="Username" />
          </FormField>
          <FormError name="username" />
        </Form>
      );

      const input = screen.getByPlaceholderText('Username');
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.blur(input);
      await waitFor(() => expect(screen.getAllByText('Username must be at least 3 chars').length).toBeGreaterThan(0));

      // Index 1: FormField's own error-region wrapper is index 0, this
      // FormError's own is the second (same convention as the #503
      // regression block above).
      const wrapper = gridWrapper(container, 1);
      expect(wrapper.style.gridTemplateRows).toBe('1fr');

      fireEvent.change(input, { target: { value: 'abc' } });
      await waitFor(() => expect(wrapper.style.gridTemplateRows).toBe('0fr'));
      // Still present (held) right after the collapse starts -- scoped
      // to this specific wrapper via `within`, since FormField's own
      // separate error span (a different component instance, its own
      // independent hold) is unaffected by this wrapper's own
      // transitionend and stays held until its OWN fires -- not what
      // this test is checking.
      expect(within(wrapper).getByText('Username must be at least 3 chars')).toBeInTheDocument();

      fireEvent.transitionEnd(wrapper, { propertyName: 'grid-template-rows' });
      expect(within(wrapper).queryByText('Username must be at least 3 chars')).not.toBeInTheDocument();
    });
  });

  describe('regression coverage: blur marks a field touched (Input, Textarea, Checkbox, Switch)', () => {
    it('Input onBlur reveals an error already computed by a prior change (blur itself only touches, it does not re-validate)', async () => {
      render(
        <Form id="blur-input-form" schema={testSchema}>
          <FormField name="username" label="Username">
            <Input placeholder="Username" />
          </FormField>
        </Form>
      );

      const input = screen.getByPlaceholderText('Username');
      // onChange already computes+stores the error silently (see "emits
      // live form:validated on field change" above); FormField only
      // *displays* it once touched, which onBlur is what actually flips.
      fireEvent.change(input, { target: { value: 'ab' } });
      expect(screen.queryByText('Username must be at least 3 chars')).not.toBeInTheDocument();

      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 chars')).toBeInTheDocument();
      });
    });

    it('Textarea onBlur reveals an error already computed by a prior change', async () => {
      const bioSchema = z.object({ bio: z.string().min(5, 'Bio is too short') });
      render(
        <Form id="blur-textarea-form" schema={bioSchema}>
          <FormField name="bio" label="Bio">
            <Textarea placeholder="Bio" />
          </FormField>
        </Form>
      );

      const textarea = screen.getByPlaceholderText('Bio');
      fireEvent.change(textarea, { target: { value: 'hi' } });
      expect(screen.queryByText('Bio is too short')).not.toBeInTheDocument();

      fireEvent.blur(textarea);
      await waitFor(() => {
        expect(screen.getByText('Bio is too short')).toBeInTheDocument();
      });
    });

    it('Checkbox toggling sets both its value and touched state', () => {
      const acceptSchema = z.object({ accept: z.literal(true, { message: 'You must accept' }) });
      render(
        <Form id="checkbox-form" schema={acceptSchema}>
          <FormField name="accept">
            <Checkbox label="I accept" />
          </FormField>
        </Form>
      );

      fireEvent.click(screen.getByText('I accept'));
      // Toggled true then... clicking again toggles back false, which is
      // touched+invalid, surfacing the schema error — the concrete,
      // observable proof that both setFieldValue and setFieldTouched ran.
      fireEvent.click(screen.getByText('I accept'));
      expect(screen.getByText('You must accept')).toBeInTheDocument();
    });

    it('Switch toggling sets both its value and touched state', () => {
      const acceptSchema = z.object({ enabled: z.literal(true, { message: 'Must be enabled' }) });
      render(
        <Form id="switch-form" schema={acceptSchema}>
          <FormField name="enabled">
            <Switch label="Enable" />
          </FormField>
        </Form>
      );

      fireEvent.click(screen.getByText('Enable'));
      fireEvent.click(screen.getByText('Enable'));
      expect(screen.getByText('Must be enabled')).toBeInTheDocument();
    });
  });

  describe('regression coverage: Button variant/size branches', () => {
    it('renders the secondary variant styling', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const btn = screen.getByText('Secondary');
      expect(btn.style.background).toBe('var(--ai-color-secondary, #64748b)');
    });

    it('renders the lg size styling', () => {
      render(<Button size="lg">Large</Button>);
      expect(screen.getByText('Large').style.fontSize).toBe('var(--ai-control-font-size-lg, 1rem)');
    });
  });

  // Issue #428.
  describe('Input clearable', () => {
    it('renders no clear button by default, even with a value', () => {
      render(<Input value="hello" onChange={vi.fn()} clearable={false} />);
      expect(screen.queryByLabelText('Clear')).not.toBeInTheDocument();
    });

    it('shows the clear button only once the value is non-empty', () => {
      const { rerender } = render(<Input value="" onChange={vi.fn()} clearable />);
      expect(screen.queryByLabelText('Clear')).not.toBeInTheDocument();

      rerender(<Input value="hello" onChange={vi.fn()} clearable />);
      expect(screen.getByLabelText('Clear')).toBeInTheDocument();
    });

    it('clears an externally-controlled value through the same onChange a keystroke would use', () => {
      const onChange = vi.fn();
      render(<Input value="hello" onChange={onChange} clearable />);

      fireEvent.click(screen.getByLabelText('Clear'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: '' }) }));
    });

    it('clears a Form-bound value through formContext.setFieldValue, and calls the extra onClear side effect', () => {
      const onClear = vi.fn();
      render(
        <Form schema={z.object({ q: z.string() })} onSubmit={vi.fn()} initialValues={{ q: 'typed text' }}>
          <Input name="q" clearable onClear={onClear} />
        </Form>
      );
      const input = screen.getByDisplayValue('typed text') as HTMLInputElement;

      fireEvent.click(screen.getByLabelText('Clear'));
      expect(input.value).toBe('');
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('does not render the clear button while disabled, even with a value', () => {
      render(<Input value="hello" onChange={vi.fn()} clearable disabled />);
      expect(screen.queryByLabelText('Clear')).not.toBeInTheDocument();
    });

    it('returns focus to the input after clearing', () => {
      render(<Input value="hello" onChange={vi.fn()} clearable />);
      const input = screen.getByDisplayValue('hello');

      fireEvent.click(screen.getByLabelText('Clear'));
      expect(input).toHaveFocus();
    });

    // Regression for Gemini's PR #430 review, finding 3: `!!value` hides
    // the button for a real, valid numeric value of exactly 0.
    it('shows the clear button for a numeric value of 0, not just a truthy value', () => {
      render(<Input type="number" value={0} onChange={vi.fn()} clearable />);
      expect(screen.getByLabelText('Clear')).toBeInTheDocument();
    });

    // Regression for Gemini's PR #430 review, finding 2: the clear button
    // must not offer to modify a read-only field.
    it('does not render the clear button while read-only, even with a value', () => {
      render(<Input value="hello" onChange={vi.fn()} clearable readOnly />);
      expect(screen.queryByLabelText('Clear')).not.toBeInTheDocument();
    });

    // Regression for Gemini's PR #430 review, finding 1: standard typing
    // must forward the real SyntheticEvent (so a consumer's own
    // e.stopPropagation()/e.target.name reads keep working), not a
    // synthesized stand-in -- that's only used by the clear button itself,
    // which has no real DOM event to forward.
    it('forwards the real SyntheticEvent to onChange for standard typing, with stopPropagation intact', () => {
      const onChange = vi.fn((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
      });
      render(<Input name="q" value="" onChange={onChange} clearable />);
      const input = screen.getByRole('textbox');

      expect(() => fireEvent.change(input, { target: { value: 'typed' } })).not.toThrow();
      expect(onChange).toHaveBeenCalledTimes(1);
      const receivedEvent = onChange.mock.calls[0][0];
      expect(receivedEvent.target.name).toBe('q');
      expect(typeof receivedEvent.stopPropagation).toBe('function');
    });

    // Regression for Gemini's PR #430 review, finding 4: the clear
    // button's own synthesized event should still carry name/id, so a
    // generic multi-input handler keyed on e.target.name doesn't break
    // just because the change came from the clear button.
    it('includes name on the clear button\'s own synthesized onChange event', () => {
      const onChange = vi.fn();
      render(<Input name="q" value="hello" onChange={onChange} clearable />);

      fireEvent.click(screen.getByLabelText('Clear'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: '', name: 'q' }) }));
    });

    // Regression for a Gemini PR #430 follow-up finding: a generic handler
    // that unconditionally calls e.stopPropagation()/e.preventDefault(), or
    // destructures from e.currentTarget, must not crash against the clear
    // button's synthesized event.
    it('does not throw when onChange calls stopPropagation/preventDefault or reads currentTarget', () => {
      const onChange = vi.fn((e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        e.preventDefault();
        const { name } = e.currentTarget;
        expect(name).toBe('q');
      });
      render(<Input name="q" value="hello" onChange={onChange} clearable />);

      expect(() => fireEvent.click(screen.getByLabelText('Clear'))).not.toThrow();
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input sections and password reveal (issue #606)', () => {
    const group = (container: HTMLElement) => container.querySelector('[data-input-group]') as HTMLElement | null;

    it('keeps the bare <input> DOM shape when no section/password toggle is present', () => {
      const { container } = render(<Input value="x" onChange={vi.fn()} />);
      expect(group(container)).toBeNull();
      expect(container.firstElementChild?.tagName).toBe('INPUT');
      expect(screen.getByRole('textbox').className).toContain('ai-focus-ring');
    });

    it('renders string sections as affix text inside a group that owns the border and focus ring', () => {
      const { container } = render(<Input aria-label="Price" leadingSection="$" trailingSection="USD" value="" onChange={vi.fn()} />);
      const g = group(container)!;
      expect(g).not.toBeNull();
      expect(g.className).toContain('ai-focus-ring');
      expect(g.style.border).toContain('solid');
      const input = screen.getByRole('textbox', { name: 'Price' });
      expect(input.className).not.toContain('ai-focus-ring');
      expect(input.style.borderStyle).toBe('none');
      expect(g.querySelector('[data-input-section="leading"]')?.textContent).toBe('$');
      expect(g.querySelector('[data-input-section="trailing"]')?.textContent).toBe('USD');
      // Section order in the DOM: leading, input, trailing.
      expect(Array.from(g.children).map(c => c.getAttribute('data-input-section') ?? c.tagName)).toEqual(['leading', 'INPUT', 'trailing']);
    });

    it('passes a node section through and focuses the input when a non-interactive section is pressed', () => {
      const { container } = render(<Input aria-label="Search" leadingSection={<svg data-testid="search-icon" />} value="" onChange={vi.fn()} />);
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
      fireEvent.mouseDown(container.querySelector('[data-input-section="leading"]')!);
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
    });

    it('does not steal focus from an interactive control inside a section', () => {
      render(<Input aria-label="Site" trailingSection={<button type="button">Go</button>} value="" onChange={vi.fn()} />);
      const go = screen.getByRole('button', { name: 'Go' });
      const evt = fireEvent.mouseDown(go);
      // fireEvent returns false when preventDefault was called.
      expect(evt).toBe(true);
    });

    it('shows the clear button alongside a trailing section, after it', () => {
      const { container } = render(<Input aria-label="Domain" trailingSection=".com" value="acme" onChange={vi.fn()} clearable />);
      const g = group(container)!;
      const clear = screen.getByLabelText('Clear');
      expect(g.contains(clear)).toBe(true);
      expect(clear.style.position).toBe('');
      expect(g.querySelector('[data-input-section="trailing"]')!.compareDocumentPosition(clear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('password inputs get a reveal toggle that flips the type and reports aria-pressed, with a fixed name', () => {
      const { container } = render(<Input aria-label="Password" type="password" value="hunter2" onChange={vi.fn()} />);
      const input = container.querySelector('input')!;
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(input.type).toBe('password');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(toggle);
      expect(input.type).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Show password' })).toBe(toggle);

      fireEvent.click(toggle);
      expect(input.type).toBe('password');
    });

    it('a mouse press on the reveal toggle keeps focus in the input', () => {
      render(<Input aria-label="Password" type="password" value="" onChange={vi.fn()} />);
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(fireEvent.mouseDown(toggle)).toBe(false);
    });

    it('revealable={false} opts out, keeping the bare input', () => {
      const { container } = render(<Input aria-label="Password" type="password" revealable={false} value="" onChange={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Show password' })).not.toBeInTheDocument();
      expect(group(container)).toBeNull();
    });

    it('disables the reveal toggle with the input', () => {
      render(<Input aria-label="Password" type="password" disabled value="" onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
    });

    it('squares the group, not the inner input, as a UIGroup member', () => {
      const { container } = render(
        <UIGroup>
          <Input aria-label="Amount" leadingSection="$" value="" onChange={vi.fn()} />
          <Button>Pay</Button>
        </UIGroup>
      );
      const g = group(container)!;
      expect(g.style.borderTopRightRadius).toBe('0px');
      expect(g.style.borderBottomRightRadius).toBe('0px');
      expect(screen.getByRole('textbox', { name: 'Amount' }).style.borderRadius).toBe('0px');
    });

    it('binds to Form context and reports errors on the group border', async () => {
      const schema = z.object({ amount: z.string().min(1, 'Required') });
      render(
        <Form schema={schema} onSubmit={vi.fn()}>
          <FormField name="amount" label="Amount">
            <Input leadingSection="$" />
          </FormField>
          <SubmitButton />
        </Form>
      );
      const input = screen.getByLabelText('Amount');
      fireEvent.change(input, { target: { value: '5' } });
      expect((input as HTMLInputElement).value).toBe('5');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
      expect(input.closest('[data-input-group]')!.getAttribute('style')).toContain('var(--ai-subtheme-error');
    });

    it('has no axe violations with sections and a password toggle', async () => {
      const { container } = render(
        <div>
          <Input aria-label="Price" leadingSection="$" trailingSection="USD" value="" onChange={vi.fn()} />
          <Input aria-label="Password" type="password" value="" onChange={vi.fn()} />
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  // "components should integrate seamlessly inside ui group with outer
  // border squaring" -- same jsdom-observable-inline-style convention as
  // UIGroup.test.tsx's own "automatic corner-squaring via context" suite.
  describe('Checkbox/Switch UIGroup awareness', () => {
    it('squares Checkbox corners as an ambient UIGroup member', () => {
      render(
        <UIGroup>
          <Checkbox label="I accept" />
          <button>Go</button>
        </UIGroup>
      );
      const checkbox = screen.getByRole('checkbox');
      // First/leading member -- squares its own trailing (right) side only.
      expect(checkbox.style.borderTopRightRadius).toBe('0px');
      expect(checkbox.style.borderBottomRightRadius).toBe('0px');
      expect(checkbox.style.borderTopLeftRadius).not.toBe('0px');
    });

    it('lets an explicit squareCorners prop win over the automatic UIGroup value for Checkbox', () => {
      render(<Checkbox label="I accept" squareCorners="all" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox.style.borderTopLeftRadius).toBe('0px');
      expect(checkbox.style.borderTopRightRadius).toBe('0px');
    });

    it('squares Switch corners as an ambient UIGroup member', () => {
      render(
        <UIGroup>
          <button>Go</button>
          <Switch label="Enable" />
        </UIGroup>
      );
      const toggle = screen.getByRole('switch');
      // Last/trailing member -- squares its own leading (left) side only.
      expect(toggle.style.borderTopLeftRadius).toBe('0px');
      expect(toggle.style.borderBottomLeftRadius).toBe('0px');
      expect(toggle.style.borderTopRightRadius).not.toBe('0px');
    });

    it('lets an explicit squareCorners prop win over the automatic UIGroup value for Switch', () => {
      render(<Switch label="Enable" squareCorners="all" />);
      const toggle = screen.getByRole('switch');
      expect(toggle.style.borderTopLeftRadius).toBe('0px');
      expect(toggle.style.borderTopRightRadius).toBe('0px');
    });
  });
});
