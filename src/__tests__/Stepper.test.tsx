import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { z } from 'zod';
import { Stepper, type StepperStepData } from '../components/Stepper/Stepper';
import { Form } from '../components/Form/FormContext';
import { FormField, Input } from '../components/Form/FormComponents';
import { aiBus } from '../eventBus/eventBus';

describe('Stepper', () => {
  it('renders the first step active by default', () => {
    const steps: StepperStepData[] = [
      { id: 'a', label: 'Step A', content: <div>Content A</div> },
      { id: 'b', label: 'Step B', content: <div>Content B</div> },
    ];
    render(<Stepper steps={steps} />);
    expect(screen.getByText('Content A')).toBeVisible();
  });

  it('advances via the Next button for an ungated step', () => {
    const steps: StepperStepData[] = [
      { id: 'a', label: 'Step A', content: <div>Content A</div> },
      { id: 'b', label: 'Step B', content: <div>Content B</div> },
    ];
    render(<Stepper steps={steps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Content B')).toBeVisible();
  });

  it('cannot advance past a step containing an invalid Form', () => {
    const schema = z.object({ email: z.string().email('Invalid email') });
    const steps: StepperStepData[] = [
      {
        id: 'account',
        label: 'Account',
        formId: 'account-form',
        content: (
          <Form id="account-form" schema={schema}>
            <FormField name="email" label="Email">
              <Input name="email" />
            </FormField>
          </Form>
        ),
      },
      { id: 'review', label: 'Review', content: <div>Review content</div> },
    ];
    render(<Stepper steps={steps} />);

    // Untouched form -- no form:validated report yet, so still blocked.
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();

    // Invalid input.
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    expect(nextButton).toBeDisabled();

    // Valid input unblocks it.
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(screen.getByText('Review content')).toBeVisible();
  });

  it('blocks clicking directly on a step tab beyond the furthest reachable step', () => {
    const schema = z.object({ email: z.string().email('Invalid email') });
    const steps: StepperStepData[] = [
      {
        id: 'account',
        label: 'Account',
        formId: 'account-form-2',
        content: (
          <Form id="account-form-2" schema={schema}>
            <FormField name="email" label="Email">
              <Input name="email" />
            </FormField>
          </Form>
        ),
      },
      { id: 'review', label: 'Review', content: <div>Review content</div> },
    ];
    render(<Stepper steps={steps} />);

    fireEvent.click(screen.getByRole('tab', { name: /Review/ }));
    expect(screen.queryByText('Review content')).not.toBeInTheDocument();
  });

  it('sets aria-current="step" on the active step tab', () => {
    const steps: StepperStepData[] = [
      { id: 'a', label: 'Step A', content: <div>A</div> },
      { id: 'b', label: 'Step B', content: <div>B</div> },
    ];
    render(<Stepper steps={steps} />);
    expect(screen.getByRole('tab', { name: /Step A/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('tab', { name: /Step B/ })).not.toHaveAttribute('aria-current');
  });

  it('is built on real role="tab"/role="tabpanel" elements, inheriting TabStrip\'s keyboard operability from the same Radix Tabs primitive', () => {
    const steps: StepperStepData[] = [
      { id: 'a', label: 'Step A', content: <div>A</div> },
      { id: 'b', label: 'Step B', content: <div>B</div> },
    ];
    render(<Stepper steps={steps} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('supports a controlled activeIndex, calling onActiveIndexChange instead of managing its own state', () => {
    const onActiveIndexChange = vi.fn();
    const steps: StepperStepData[] = [
      { id: 'a', label: 'Step A', content: <div>Content A</div> },
      { id: 'b', label: 'Step B', content: <div>Content B</div> },
    ];
    const { rerender } = render(<Stepper steps={steps} activeIndex={0} onActiveIndexChange={onActiveIndexChange} />);

    fireEvent.click(screen.getByText('Next'));
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Content A')).toBeVisible();

    rerender(<Stepper steps={steps} activeIndex={1} onActiveIndexChange={onActiveIndexChange} />);
    expect(screen.getByText('Content B')).toBeVisible();
  });

  it('emits stepper:changed on navigation', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('stepper:changed', changedFn);
    const steps: StepperStepData[] = [
      { id: 'a', label: 'Step A', content: <div>A</div> },
      { id: 'b', label: 'Step B', content: <div>B</div> },
    ];
    render(<Stepper id="my-stepper" steps={steps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(changedFn).toHaveBeenLastCalledWith({ id: 'my-stepper', activeIndex: 1, previousIndex: 0 });
    unsub();
  });

  it('disables Back on the first step', () => {
    const steps: StepperStepData[] = [{ id: 'a', label: 'Step A', content: <div>A</div> }];
    render(<Stepper steps={steps} />);
    expect(screen.getByText('Back')).toBeDisabled();
  });
});
