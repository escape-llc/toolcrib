import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/Badge/Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders a neutral appearance with no subtheme', () => {
    render(<Badge>Neutral</Badge>);
    const badge = screen.getByText('Neutral');
    expect(badge.style.background).toBe('var(--ai-bg-container, #f3f4f6)');
  });

  it.each(['error', 'success', 'warning', 'info'] as const)(
    'resolves the %s subtheme via the shared resolveSubtheme() variable family, matching Toast/DataTable row treatment',
    subtheme => {
      render(<Badge subtheme={subtheme}>{subtheme}</Badge>);
      const badge = screen.getByText(subtheme);
      expect(badge.style.background).toBe(`var(--ai-subtheme-${subtheme}-bg)`);
      expect(badge.style.color).toBe(`var(--ai-subtheme-${subtheme}-text)`);
    }
  );

  it('renders an icon before the label', () => {
    render(<Badge icon={<span data-testid="badge-icon">★</span>}>Starred</Badge>);
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
    expect(screen.getByText('Starred')).toBeInTheDocument();
  });

  it('wraps the icon in a lineHeight:1 span, so a tall-glyph icon (e.g. a checkmark falling back to a different font) can\'t stretch the badge taller than an icon-less sibling (regression: "Verified" badge visibly taller than its size="md" siblings despite using size="sm")', () => {
    render(<Badge icon="✓">Verified</Badge>);
    const icon = screen.getByText('✓');
    expect(icon.tagName).toBe('SPAN');
    expect(icon.style.lineHeight).toBe('1');
  });
});
