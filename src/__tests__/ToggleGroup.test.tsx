import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle, ToggleGroup } from '../components/ToggleGroup/ToggleGroup';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

// Radix's Toggle/ToggleGroup primitives use ResizeObserver internally —
// not implemented in jsdom. Same polyfill pattern already used in
// RadixPrimitives.test.tsx / RadioGroup.test.tsx for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('Toggle Component', () => {
  it('toggles pressed state and emits toggle:changed', async () => {
    const changedFn = vi.fn();
    const onPressedChange = vi.fn();
    const unsub = aiBus.on('toggle:changed', changedFn);

    render(
      <Toggle name="bold" onPressedChange={onPressedChange}>
        Bold
      </Toggle>
    );

    const btn = screen.getByRole('button', { name: 'Bold' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(onPressedChange).toHaveBeenCalledWith(true);
    expect(changedFn).toHaveBeenCalledWith({ name: 'bold', pressed: true });
    expect(await axe(document.body)).toHaveNoViolations();

    unsub();
  });
});

describe('ToggleGroup Component', () => {
  const options = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ];

  it('type="single": selecting one option deselects the previous one', async () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith('right');
    expect(screen.getByRole('radio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'false');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  // Regression: type="single" renders role="radiogroup", but Radix's own
  // underlying value model is still a plain toggle -- clicking the
  // currently-selected option calls its own onItemDeactivate, setting the
  // value to '' (fully deselected). Valid for type="multiple" (an
  // independent toggle CAN have none pressed) but a real WAI-ARIA
  // violation for type="single" (a radiogroup must always have exactly one
  // option checked once initialized) -- and, found via a real "Too many
  // re-renders" crash in a live consumer (DataTable's own density
  // selector), genuinely dangerous: an empty selected value cascading into
  // a downstream `Record<string, number>` lookup returning `undefined`,
  // then `NaN`, then an infinite render loop once a render-time state
  // guard's `!==` comparison can never stabilize (NaN !== NaN is always
  // true in JS). Re-clicking the already-selected option must be a no-op
  // that keeps it selected, not a deselect.
  it('type="single": clicking the already-selected option is a no-op, not a deselect (regression)', () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Left' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');
  });

  it('type="multiple": clicking the only pressed option DOES deselect it -- toggles, unlike single mode', () => {
    const onChange = vi.fn();
    render(<ToggleGroup name="format" type="multiple" defaultValue={['left']} options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Left' }));

    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'false');
  });

  // Regression: an interior choice separator (the theme/choiceSeparator.ts
  // ::before accent) used to sit on top of an identically-colored,
  // full-height border every item ALSO drew on every side -- reported
  // directly, after that fix shipped, as still barely visible ("had to
  // zoom in 4 times"). The actual fix is that an interior seam (the side
  // touching a neighbor) must draw NO real border at all -- only a
  // genuine outer edge (first item's left, last item's right, every
  // item's top/bottom) does -- so the accent is the only mark there. This
  // is exactly the shape a screenshot review can't easily catch again
  // (both "same color, full height" and "same color, half height,
  // nothing competing" look identical in a DOM/style dump unless you
  // specifically assert on transparency at the interior sides) -- so it's
  // asserted directly here, not just eyeballed.
  it('draws a real border only at the strip\'s true outer edges, transparent at interior seams', () => {
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={vi.fn()} />);

    const left = screen.getByRole('radio', { name: 'Left' }); // first item
    const center = screen.getByRole('radio', { name: 'Center' }); // middle item
    const right = screen.getByRole('radio', { name: 'Right' }); // last item

    // True outer edges: colored.
    expect(left.style.borderLeftColor).not.toBe('transparent');
    expect(right.style.borderRightColor).not.toBe('transparent');
    // Top/bottom are always a real outer edge, on every item.
    for (const item of [left, center, right]) {
      expect(item.style.borderTopColor).not.toBe('transparent');
      expect(item.style.borderBottomColor).not.toBe('transparent');
    }

    // Interior seams: transparent, so the ::before accent is the only mark.
    expect(left.style.borderRightColor).toBe('transparent');
    expect(center.style.borderLeftColor).toBe('transparent');
    expect(center.style.borderRightColor).toBe('transparent');
    expect(right.style.borderLeftColor).toBe('transparent');
  });

  // Regression: reported directly, with screenshots -- the choice
  // separator looked a different width at different seams, and "the
  // background is not uniformly excluding the separator, especially on
  // the left end." Root cause was two compounding issues in this
  // component's own per-item styles (not in choiceSeparator.ts's own
  // ::before rule): an interior item's left border still had a real WIDTH
  // (just a transparent color), which insets the ::before accent from the
  // item's own true edge (`left: 0` on an absolutely-positioned
  // pseudo-element resolves against the padding box, not the border box);
  // and a now-obsolete marginLeft/zIndex overlap trick -- left over from
  // when every side drew a real, full-color border that needed collapsing
  // with its neighbor's -- let a higher-z-index (selected) neighbor paint
  // clean over a lower-z-index item's own divider. Both are asserted
  // directly here so a future change can't silently reintroduce either
  // half of this regression.
  it('an interior item has zero left border WIDTH (not just a transparent color) and no negative overlap margin', () => {
    render(<ToggleGroup name="align" type="single" defaultValue="left" options={options} onChange={vi.fn()} />);

    const left = screen.getByRole('radio', { name: 'Left' }); // first item
    const center = screen.getByRole('radio', { name: 'Center' }); // middle item
    const right = screen.getByRole('radio', { name: 'Right' }); // last item

    // True outer edge (first item's own left side): a real border width.
    expect(left.style.borderLeftWidth).toBe('0.0625rem');

    // Interior left sides: zero width, not merely transparent -- this is
    // what makes `left: 0` on the ::before accent land exactly on the
    // item's true edge instead of inset by a still-present (if invisible)
    // border.
    expect(center.style.borderLeftWidth).toBe('0px');
    expect(right.style.borderLeftWidth).toBe('0px');

    // No item overlaps its neighbor anymore -- the old collapse trick
    // (isFirst ? 0 : '-0.0625rem') is gone; every item sits flush.
    for (const item of [left, center, right]) {
      expect(item.style.marginLeft).toBe('0px');
    }
  });

  it('type="multiple": options toggle independently and emits togglegroup:changed', () => {
    const changedFn = vi.fn();
    const onChange = vi.fn();
    const unsub = aiBus.on('togglegroup:changed', changedFn);

    render(<ToggleGroup name="format" type="multiple" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Left' }));
    expect(onChange).toHaveBeenCalledWith(['left']);
    expect(changedFn).toHaveBeenCalledWith({ name: 'format', value: ['left'] });

    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith(['left', 'right']);

    unsub();
  });
});
