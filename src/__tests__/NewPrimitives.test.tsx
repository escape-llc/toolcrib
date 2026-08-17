import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisuallyHidden } from '../components/Layout/VisuallyHidden';
import { AccessibleIcon } from '../components/Layout/AccessibleIcon';
import { Label } from '../components/Form/Label';
import { Checkbox, Switch } from '../components/Form/FormComponents';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';

// ScrollArea's internal ResizeObserver-driven size tracking has no effect on
// whether its DOM nodes render (see ScrollArea.tsx's own review notes) but
// Radix still constructs one on mount — same polyfill as RadixPrimitives.test.tsx.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('VisuallyHidden Component', () => {
  it('keeps content queryable (announced to assistive tech) while rendering it', () => {
    render(<VisuallyHidden>Screen-reader-only text</VisuallyHidden>);
    expect(screen.getByText('Screen-reader-only text')).toBeInTheDocument();
  });
});

describe('AccessibleIcon Component', () => {
  it('marks the wrapped icon aria-hidden and exposes the label as hidden text', () => {
    render(
      <AccessibleIcon label="Close">
        <svg data-testid="icon" />
      </AccessibleIcon>
    );
    expect(screen.getByTestId('icon')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});

describe('Label Component', () => {
  it('associates with a control via htmlFor, same as a native label', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" />
      </>
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('emits no weight custom property when no override is given', () => {
    render(<Label htmlFor="name">Name</Label>);
    expect(screen.getByText('Name').style.getPropertyValue('--ai-label-weight')).toBe('');
  });

  it('applies a per-instance weight override as a scoped CSS custom property', () => {
    render(
      <Label htmlFor="name" overrides={{ weight: 'semibold' }}>
        Name
      </Label>
    );
    expect(screen.getByText('Name').style.getPropertyValue('--ai-label-weight')).toContain('600');
  });

  it('applies a per-instance gap override as a scoped CSS custom property', () => {
    render(
      <Label htmlFor="name" overrides={{ gap: 'spacious' }}>
        Name
      </Label>
    );
    expect(screen.getByText('Name').style.getPropertyValue('--ai-label-gap')).toContain('0.625rem');
  });

  // Regression: Checkbox and Switch both render their wrapping label through
  // this shared <Label> now, but they historically used two different hand-
  // rolled gaps (Checkbox 0.5rem, Switch 0.625rem, a deliberate difference,
  // not an oversight). Label's default alone can't reproduce both at once —
  // Switch must opt into the wider gap explicitly via overrides, which this
  // guards against silently regressing back to a single shared value.
  it("preserves Checkbox's and Switch's historically different label gaps", () => {
    render(
      <>
        <Checkbox name="cb" label="Checkbox label" />
        <Switch name="sw" label="Switch label" />
      </>
    );
    const checkboxLabel = screen.getByText('Checkbox label').closest('label') as HTMLElement;
    const switchLabel = screen.getByText('Switch label').closest('label') as HTMLElement;

    expect(checkboxLabel.style.getPropertyValue('--ai-label-gap')).toBe('');
    expect(switchLabel.style.getPropertyValue('--ai-label-gap')).toContain('0.625rem');
  });
});

describe('ScrollArea Component', () => {
  it('renders its children inside the scrollable viewport', () => {
    render(
      <ScrollArea>
        <div>Scrollable content</div>
      </ScrollArea>
    );
    expect(screen.getByText('Scrollable content')).toBeInTheDocument();
  });

  it('renders a vertical scrollbar by default and a horizontal one only for orientation="both"', () => {
    // type="always" forces the scrollbar to mount unconditionally — the
    // default 'hover' type gates it behind Radix's own Presence/pointer
    // tracking, which never fires without real pointer events.
    const { container, rerender } = render(
      <ScrollArea type="always">
        <div>content</div>
      </ScrollArea>
    );
    expect(container.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
    expect(container.querySelector('[data-orientation="horizontal"]')).not.toBeInTheDocument();

    rerender(
      <ScrollArea type="always" orientation="both">
        <div>content</div>
      </ScrollArea>
    );
    expect(container.querySelector('[data-orientation="vertical"]')).toBeInTheDocument();
    expect(container.querySelector('[data-orientation="horizontal"]')).toBeInTheDocument();
  });

  it('applies a thumbWidth override as a scoped CSS custom property', () => {
    const { container } = render(
      <ScrollArea overrides={{ thumbWidth: 'thick' }}>
        <div>content</div>
      </ScrollArea>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--ai-scrollarea-thumb-size')).toBe('0.75rem');
  });

  it('applies maxHeight to the root, falling back to 100% when omitted', () => {
    const { container: withMax } = render(
      <ScrollArea maxHeight="8rem">
        <div>content</div>
      </ScrollArea>
    );
    const { container: withoutMax } = render(
      <ScrollArea>
        <div>content</div>
      </ScrollArea>
    );
    expect((withMax.firstElementChild as HTMLElement).style.height).toBe('8rem');
    expect((withoutMax.firstElementChild as HTMLElement).style.height).toBe('100%');
  });
});
