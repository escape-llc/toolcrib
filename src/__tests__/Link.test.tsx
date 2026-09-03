import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Link } from '../components/Link/Link';

describe('Link', () => {
  it('renders its children as a real <a>, with href passed through', () => {
    render(<Link href="/docs">Docs</Link>);
    const link = screen.getByText('Docs');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/docs');
  });

  it('applies the ai-link/ai-focus-ring classes so the ambient link-color and focus-ring rules both apply', () => {
    render(<Link href="/docs">Docs</Link>);
    const link = screen.getByText('Docs');
    expect(link.className).toContain('ai-link');
    expect(link.className).toContain('ai-focus-ring');
  });

  it('sets no --ai-link-color override for the default "primary" variant — relies on TOOLCRIB_LINK_CSS\'s own fallback chain', () => {
    render(<Link href="/docs">Docs</Link>);
    const link = screen.getByText('Docs');
    expect(link.style.getPropertyValue('--ai-link-color')).toBe('');
    expect(link.style.getPropertyValue('--ai-link-visited-color')).toBe('');
  });

  it('variant="secondary" overrides both link and visited color via CSS custom properties, not the color property directly (a plain color write would permanently defeat the :visited rule)', () => {
    render(
      <Link href="/docs" variant="secondary">
        Docs
      </Link>
    );
    const link = screen.getByText('Docs');
    expect(link.style.getPropertyValue('--ai-link-color')).toBe('var(--ai-color-secondary-readable)');
    expect(link.style.getPropertyValue('--ai-link-visited-color')).toBe('var(--ai-color-primary-readable)');
    expect(link.style.color).toBe('');
  });

  it('subtheme uses the same resolved color for both link and visited state, since a status color\'s meaning shouldn\'t change once visited', () => {
    render(
      <Link href="/danger" subtheme="error">
        Delete account
      </Link>
    );
    const link = screen.getByText('Delete account');
    expect(link.style.getPropertyValue('--ai-link-color')).toBe('var(--ai-subtheme-error-text)');
    expect(link.style.getPropertyValue('--ai-link-visited-color')).toBe('var(--ai-subtheme-error-text)');
  });

  it('subtheme wins over variant when both are set', () => {
    render(
      <Link href="/danger" subtheme="error" variant="secondary">
        Delete account
      </Link>
    );
    const link = screen.getByText('Delete account');
    expect(link.style.getPropertyValue('--ai-link-color')).toBe('var(--ai-subtheme-error-text)');
  });

  it('auto-applies rel="noopener noreferrer" for target="_blank" (reverse-tabnabbing protection) when the caller sets no rel of their own', () => {
    render(
      <Link href="https://example.com" target="_blank">
        External
      </Link>
    );
    const link = screen.getByText('External');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('leaves an explicit rel untouched even for target="_blank"', () => {
    render(
      <Link href="https://example.com" target="_blank" rel="nofollow">
        External
      </Link>
    );
    const link = screen.getByText('External');
    expect(link.getAttribute('rel')).toBe('nofollow');
  });

  it('does not add a rel when target is not "_blank"', () => {
    render(<Link href="/docs">Docs</Link>);
    const link = screen.getByText('Docs');
    expect(link.getAttribute('rel')).toBeNull();
  });
});
