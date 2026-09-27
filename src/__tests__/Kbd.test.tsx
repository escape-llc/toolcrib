import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from '../components/Kbd/Kbd';
import { getKbdVariables } from '../components/Kbd/KbdSlice';
import { axe } from './testUtils/axe';

describe('Kbd', () => {
  it('renders a single key as a semantic <kbd>', () => {
    render(<Kbd>Esc</Kbd>);
    const key = screen.getByText('Esc');
    expect(key.tagName).toBe('KBD');
    expect(key.style.fontFamily).toContain('var(--ai-text-font-mono');
    expect(key.style.borderWidth).toBe('0.0625rem 0.0625rem var(--ai-kbd-border-bottom-width, 0.125rem)');
  });

  it('renders a combination as nested <kbd>s joined by +', () => {
    const { container } = render(<Kbd keys={['Ctrl', 'Shift', 'K']} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.tagName).toBe('KBD');
    const inner = outer.querySelectorAll(':scope > kbd');
    expect([...inner].map(k => k.textContent)).toEqual(['Ctrl', 'Shift', 'K']);
    expect(outer.textContent).toBe('Ctrl+Shift+K');
  });

  it('keys wins over children', () => {
    const { container } = render(<Kbd keys={['⌘', 'S']}>ignored</Kbd>);
    expect(container.textContent).toBe('⌘+S');
  });

  it('sizes from the theme text ramp', () => {
    const { rerender } = render(<Kbd>K</Kbd>);
    expect(screen.getByText('K').style.fontSize).toBe('var(--ai-text-size-sm, 0.8125rem)');
    rerender(<Kbd size="sm">K</Kbd>);
    expect(screen.getByText('K').style.fontSize).toBe('var(--ai-text-size-xs, 0.75rem)');
  });

  it('applies a per-instance appearance override as a sparse variable', () => {
    render(<Kbd overrides={{ appearance: 'flat' }}>K</Kbd>);
    expect(screen.getByText('K').style.getPropertyValue('--ai-kbd-border-bottom-width')).toBe(getKbdVariables({ appearance: 'flat' })['--ai-kbd-border-bottom-width']);
  });

  it('passes ARIA attributes through', () => {
    render(<Kbd aria-label="Command K" keys={['⌘', 'K']} />);
    expect(screen.getByLabelText('Command K').tagName).toBe('KBD');
  });

  // Compile-time contract: tsc fails this file if any of these becomes legal.
  it('is display-only: no style, className or handlers', () => {
    const cases = [
      // @ts-expect-error -- style is not a Kbd prop
      <Kbd style={{ color: 'red' }}>K</Kbd>,
      // @ts-expect-error -- className is not a Kbd prop
      <Kbd className="x">K</Kbd>,
      // @ts-expect-error -- a key hint is not interactive
      <Kbd onClick={() => {}}>K</Kbd>,
    ];
    expect(cases).toHaveLength(3);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <p>
        Press <Kbd>Esc</Kbd> to close, or <Kbd keys={['Ctrl', 'K']} /> to search.
      </p>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
