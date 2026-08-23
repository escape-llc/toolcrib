import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Block } from '../components/Layout/Block';
import { StyleDomainProvider } from '../theme/StyleDomainContext';

describe('Block', () => {
  it('renders its children', () => {
    render(<Block>Content</Block>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('defaults to a transparent background with no padding/radius/border', () => {
    render(<Block data-testid="block">Plain</Block>);
    const block = screen.getByTestId('block');
    expect(block.style.background).toBe('transparent');
    expect(block.style.padding).toBe('');
    expect(block.style.borderRadius).toBe('');
    expect(block.style.border).toBe('');
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
    expect(screen.getByTestId('block').style.border).toBe('0.0625rem solid var(--ai-border, #e5e7eb)');
  });

  it('lets a consumer style/className win over the themed defaults, spread last on purpose', () => {
    render(
      <Block data-testid="block" background="surface" style={{ background: 'hotpink' }} className="my-class">
        x
      </Block>
    );
    const block = screen.getByTestId('block');
    expect(block.style.background).toBe('hotpink');
    expect(block.className).toBe('my-class');
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
    expect(block.style.border).toBe('0.0625rem solid var(--ai-subtheme-success-border)');
  });

  it('does not color a border that was never requested, even with a subtheme resolved', () => {
    render(
      <Block data-testid="block" subtheme="error">
        x
      </Block>
    );
    expect(screen.getByTestId('block').style.border).toBe('');
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
