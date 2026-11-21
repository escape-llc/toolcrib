import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Block } from '../components/Layout/Block';
import { StyleDomainProvider } from '../theme/StyleDomainContext';
import { axe } from './testUtils/axe';

describe('Block', () => {
  it('renders its children', async () => {
    render(<Block>Content</Block>);
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('defaults to a transparent background with no padding/radius/border', () => {
    render(<Block data-testid="block">Plain</Block>);
    const block = screen.getByTestId('block');
    expect(block.style.backgroundColor).toBe('transparent');
    expect(block.style.padding).toBe('');
    expect(block.style.borderRadius).toBe('');
    expect(block.style.borderTopWidth).toBe('');
    expect(block.style.borderInlineStartWidth).toBe('');
  });

  const BACKGROUND_TOKENS = {
    surface: 'var(--ai-bg-surface, #ffffff)',
    container: 'var(--ai-bg-container, #f3f4f6)',
    primary: 'var(--ai-bg-primary, #ffffff)',
  } as const;

  it.each(Object.keys(BACKGROUND_TOKENS) as (keyof typeof BACKGROUND_TOKENS)[])('resolves the %s background token', bg => {
    render(<Block data-testid="block" background={bg}>x</Block>);
    expect(screen.getByTestId('block').style.background).toBe(BACKGROUND_TOKENS[bg]);
  });

  it('applies padding/radius from the shared token scales when set', () => {
    render(<Block data-testid="block" padding="md" radius="md">x</Block>);
    const block = screen.getByTestId('block');
    expect(block.style.padding).not.toBe('');
    expect(block.style.borderRadius).not.toBe('');
  });

  it('only renders a border when border is true', () => {
    render(<Block data-testid="block" border>x</Block>);
    const block = screen.getByTestId('block');
    expect(block.style.borderTopWidth).toBe('0.0625rem');
    expect(block.style.borderInlineStartWidth).toBe('0.0625rem');
    expect(block.style.borderTopStyle).toBe('solid');
    expect(block.style.borderTopColor).toBe('var(--ai-border, #e5e7eb)');
  });

  // Issue #647: Block used to be the one exception to "no toolcrib component
  // takes style/className". It has none now, like every other component:
  // the props are type errors, and a style smuggled past the types (plain
  // JS, a cast) warns in dev and can't override the themed values.
  it('rejects style/className at compile time', () => {
    // The contract is compile-time: passing either is a type error, and the
    // caller fixes the call site. No runtime warning or stripping (the
    // maintainer's call: no legacy shims). tsc fails this file if either
    // line below stops being an error, i.e. if the props come back.
    // @ts-expect-error -- style is not a Block prop
    const withStyle = <Block style={{ background: 'hotpink' }}>x</Block>;
    // @ts-expect-error -- className is not a Block prop
    const withClassName = <Block className="my-class">x</Block>;
    expect([withStyle, withClassName]).toHaveLength(2);
  });

  it('resolves an instance subtheme, overriding background/border/text color', () => {
    render(
      <Block data-testid="block" subtheme="success" border>
        x
      </Block>
    );
    const block = screen.getByTestId('block');
    expect(block.style.background).toBe('var(--ai-subtheme-success-bg)');
    expect(block.style.color).toBe('var(--ai-subtheme-success-text)');
    expect(block.style.borderTopWidth).toBe('0.0625rem');
    expect(block.style.borderTopColor).toBe('var(--ai-subtheme-success-border)');
    expect(block.style.borderInlineStartColor).toBe('var(--ai-subtheme-success-border)');
  });

  it('does not color a border that was never requested, even with a subtheme resolved', () => {
    render(
      <Block data-testid="block" subtheme="error">
        x
      </Block>
    );
    const block = screen.getByTestId('block');
    expect(block.style.borderTopWidth).toBe('');
    expect(block.style.borderInlineStartWidth).toBe('');
  });

  describe('edge', () => {
    it('with a subtheme draws a thick inline-start edge in the subtheme colour, other sides none', () => {
      render(<Block data-testid="block" subtheme="warning" edge>x</Block>);
      const block = screen.getByTestId('block');
      expect(block.style.borderInlineStartWidth).toBe('0.25rem');
      expect(block.style.borderInlineStartStyle).toBe('solid');
      expect(block.style.borderInlineStartColor).toBe('var(--ai-subtheme-warning-border)');
      expect(block.style.borderTopWidth).toBe('0px');
      expect(block.style.borderInlineEndWidth).toBe('0px');
    });

    it('with border: the start side is the thick edge, the other sides stay hairline', () => {
      render(<Block data-testid="block" subtheme="error" edge border>x</Block>);
      const block = screen.getByTestId('block');
      expect(block.style.borderInlineStartWidth).toBe('0.25rem');
      expect(block.style.borderTopWidth).toBe('0.0625rem');
      expect(block.style.borderBottomWidth).toBe('0.0625rem');
      expect(block.style.borderInlineEndWidth).toBe('0.0625rem');
      expect(block.style.borderTopColor).toBe('var(--ai-subtheme-error-border)');
    });

    it('without a resolved subtheme draws nothing', () => {
      render(<Block data-testid="block" edge>x</Block>);
      const block = screen.getByTestId('block');
      expect(block.style.borderInlineStartWidth).toBe('');
      expect(block.style.borderTopWidth).toBe('');
    });

    it('toggling edge and border across rerenders logs no React style warning', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const { rerender } = render(<Block data-testid="block" subtheme="info" border>x</Block>);
        rerender(<Block data-testid="block" subtheme="info" border edge>x</Block>);
        rerender(<Block data-testid="block" subtheme="info" edge>x</Block>);
        rerender(<Block data-testid="block" subtheme="info">x</Block>);
        rerender(<Block data-testid="block" subtheme="info" border>x</Block>);
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  it('falls back to the nearest StyleDomainProvider subtheme when no instance subtheme is set', () => {
    render(
      <StyleDomainProvider subtheme="warning">
        <Block data-testid="block">x</Block>
      </StyleDomainProvider>
    );
    expect(screen.getByTestId('block').style.background).toBe('var(--ai-subtheme-warning-bg)');
  });

  it('instance subtheme wins over the style domain', () => {
    render(
      <StyleDomainProvider subtheme="warning">
        <Block data-testid="block" subtheme="error">x</Block>
      </StyleDomainProvider>
    );
    expect(screen.getByTestId('block').style.background).toBe('var(--ai-subtheme-error-bg)');
  });

  it('appearance="solid" fills the block instead of the default soft tint', () => {
    render(
      <Block data-testid="block" subtheme="info" appearance="solid">
        x
      </Block>
    );
    const block = screen.getByTestId('block');
    expect(block.style.background).toBe('var(--ai-subtheme-info)');
    expect(block.style.color).toBe('var(--ai-subtheme-info-on-main)');
  });
});
