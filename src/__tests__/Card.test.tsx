import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../components/Card/Card';
import { CardSimple } from '../components/Card/CardSimple';
import { axe } from './testUtils/axe';

describe('Card Component & layout="auto" Bounding Box Integration', () => {
  it('renders standard Card with header, content, footer and actions', async () => {
    render(
      <Card>
        <Card.Header>Header Title</Card.Header>
        <Card.Content>Card Body</Card.Content>
        <Card.Footer>
          <span>Status</span>
          <Card.Actions>
            <button>Action</button>
          </Card.Actions>
        </Card.Footer>
      </Card>
    );

    expect(screen.getByText('Header Title')).toBeInTheDocument();
    expect(screen.getByText('Card Body')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('applies auto layout flex styles when layout="auto" is passed to Card and Card.Content', () => {
    render(
      <Card layout="auto" data-testid="card-container">
        <Card.Header>Auto Header</Card.Header>
        <Card.Content layout="auto" data-testid="card-content">
          <div>Auto Body</div>
        </Card.Content>
      </Card>
    );

    const container = screen.getByTestId('card-container');
    const content = screen.getByTestId('card-content');

    expect(container.style.height).toBe('100%');
    expect(container.style.width).toBe('100%');
    expect(container.style.flex).toBe('1 1 0px');

    expect(content.style.display).toBe('flex');
    expect(content.style.flexDirection).toBe('column');
    expect(content.style.overflow).toBe('hidden');
  });

  // #860: title and subtitle were both direct children of Card.Header's
  // space-between flex row, which pushed the subtitle to the far edge.
  it('regression: CardSimple keeps the subtitle beside the title, not across the header (#860)', () => {
    render(<CardSimple title="Users" subtitle="Manage team members">Body</CardSimple>);
    const title = screen.getByText('Users');
    const subtitle = screen.getByText('Manage team members');
    expect(title.parentElement).toBe(subtitle.parentElement);
    expect(title.parentElement!.parentElement!.children).toHaveLength(1);
  });

  describe('regression: squareCorners toggling mixed a shorthand with sparse longhands (#860)', () => {
    // The root set borderRadius (shorthand) every render and only sometimes
    // a corner longhand, so toggling squareCorners made React warn
    // "Removing a style property during rerender".
    it('keeps all four corner longhands and warns nothing as squareCorners toggles', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { rerender } = render(<Card data-testid="card">Body</Card>);
      rerender(<Card data-testid="card" squareCorners="top">Body</Card>);
      const card = screen.getByTestId('card');
      expect(card.style.borderTopLeftRadius).toBe('0px');
      expect(card.style.borderBottomLeftRadius).toBe('var(--ai-radius-lg, 0.75rem)');
      rerender(<Card data-testid="card">Body</Card>);
      expect(card.style.borderTopLeftRadius).toBe('var(--ai-radius-lg, 0.75rem)');

      const styleWarnings = errorSpy.mock.calls.filter(args => String(args[0]).includes('style property'));
      errorSpy.mockRestore();
      expect(styleWarnings).toEqual([]);
    });
  });
});
