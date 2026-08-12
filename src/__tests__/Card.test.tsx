import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '../components/Card/Card';

describe('Card Component & layout="auto" Bounding Box Integration', () => {
  it('renders standard Card with header, content, footer and actions', () => {
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
});
