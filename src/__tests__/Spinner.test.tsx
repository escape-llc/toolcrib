import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../components/Spinner/Spinner';

describe('Spinner', () => {
  it('renders with a status role and accessible label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('defaults to the theme primary colour with no subtheme', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner.style.borderTopColor).toBe('var(--ai-color-primary, #3b82f6)');
  });

  it.each(['error', 'success', 'warning', 'info'] as const)(
    'resolves the %s subtheme, matching <Progress>\'s own colouring mechanism',
    subtheme => {
      render(<Spinner subtheme={subtheme} />);
      const spinner = screen.getByRole('status');
      expect(spinner.style.borderTopColor).toBe(`var(--ai-subtheme-${subtheme})`);
    }
  );

  it('sizes the diameter via the size prop', () => {
    render(<Spinner size="lg" />);
    const spinner = screen.getByRole('status');
    expect(spinner.style.width).toBe('2.25rem');
    expect(spinner.style.height).toBe('2.25rem');
  });

  it('uses the shared ai-spin keyframe', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner.style.animation).toContain('ai-spin');
  });
});
