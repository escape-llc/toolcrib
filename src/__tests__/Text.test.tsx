import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from '../components/Text/Text';
import { getTextVariables } from '../components/Text/TextSlice';
import { Button } from '../components/Form/FormComponents';
import { StyleDomainProvider } from '../theme/StyleDomainContext';
import { axe } from './testUtils/axe';

describe('Text', () => {
  it('renders a paragraph by default and a span with as="span"', () => {
    const { container, rerender } = render(<Text>Hello</Text>);
    expect(container.firstElementChild?.tagName).toBe('P');
    rerender(<Text as="span">Hello</Text>);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('sets no margin, so stacks own the spacing', () => {
    render(<Text data-testid="t">x</Text>);
    expect(screen.getByTestId('t').style.margin).toBe('0px');
  });

  it('inherits size, color and weight when none is given', () => {
    render(<Text data-testid="t">x</Text>);
    const el = screen.getByTestId('t');
    expect(el.style.fontSize).toBe('');
    expect(el.style.color).toBe('');
    expect(el.style.fontWeight).toBe('');
  });

  it('resolves size, tone, weight and mono to theme tokens', () => {
    render(
      <Text data-testid="t" size="sm" tone="secondary" weight="semibold" mono>
        x
      </Text>
    );
    const el = screen.getByTestId('t');
    expect(el.style.fontSize).toBe('var(--ai-text-size-sm, 0.8125rem)');
    expect(el.style.color).toBe('var(--ai-text-secondary, #6b7280)');
    expect(el.style.fontWeight).toBe('var(--ai-font-weight-semibold, 600)');
    expect(el.style.fontFamily).toContain('var(--ai-text-font-mono');
  });

  it('colors text with a subtheme, which wins over tone', () => {
    render(<Text data-testid="t" subtheme="error" tone="secondary">x</Text>);
    expect(screen.getByTestId('t').style.color).toBe('var(--ai-subtheme-error-text)');
  });

  it('takes its subtheme from the nearest StyleDomainProvider', () => {
    render(
      <StyleDomainProvider subtheme="success">
        <Text data-testid="t">x</Text>
      </StyleDomainProvider>
    );
    expect(screen.getByTestId('t').style.color).toBe('var(--ai-subtheme-success-text)');
  });

  it('colors text with an identity variant', () => {
    render(<Text data-testid="t" variant="primary">x</Text>);
    expect(screen.getByTestId('t').style.color).toBe('var(--ai-color-primary-readable)');
  });

  it('applies a per-instance scale override as sparse size variables', () => {
    render(<Text data-testid="t" size="md" overrides={{ scale: 'large' }}>x</Text>);
    const el = screen.getByTestId('t');
    expect(el.style.getPropertyValue('--ai-text-size-md')).toBe(getTextVariables({ scale: 'large' })['--ai-text-size-md']);
    expect(el.style.getPropertyValue('--ai-text-font-mono')).toBe('');
  });

  it('scales the whole ramp together', () => {
    const normal = getTextVariables({ scale: 'normal' });
    const large = getTextVariables({ scale: 'large' });
    expect(normal['--ai-text-size-lg']).toBe('1rem');
    expect(large['--ai-text-size-lg']).toBe('1.125rem');
    expect(getTextVariables({ scale: 'compact' })['--ai-text-size-lg']).toBe('0.9rem');
  });

  // Compile-time contract: tsc fails this file if any of these becomes legal.
  it('rejects style/className and keeps `as` closed at compile time', () => {
    const cases = [
      // @ts-expect-error -- style is not a Text prop
      <Text style={{ color: 'hotpink' }}>x</Text>,
      // @ts-expect-error -- className is not a Text prop
      <Text className="x">x</Text>,
      // @ts-expect-error -- div is not a text-level element
      <Text as="div">x</Text>,
      // @ts-expect-error -- as takes no component
      <Text as={Button}>x</Text>,
      // @ts-expect-error -- as never unlocks element-specific props
      <Text as="span" href="/x">x</Text>,
      // @ts-expect-error -- no event handlers; Text is not interactive
      <Text onClick={() => {}}>x</Text>,
    ];
    expect(cases).toHaveLength(6);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        <Text>Body copy</Text>
        <Text size="sm" tone="secondary">Secondary copy</Text>
        <Text>
          Inline <Text as="span" weight="bold" subtheme="error">error</Text> text
        </Text>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
