import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../components/EmptyState/EmptyState';

describe('EmptyState', () => {
  it('renders sensibly with only Title provided', () => {
    render(
      <EmptyState>
        <EmptyState.Title>No results found</EmptyState.Title>
      </EmptyState>
    );
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders the full slot set together', () => {
    render(
      <EmptyState>
        <EmptyState.Icon>📭</EmptyState.Icon>
        <EmptyState.Title>Nothing here yet</EmptyState.Title>
        <EmptyState.Description>Try adjusting your filters.</EmptyState.Description>
        <EmptyState.Action>
          <button>Clear filters</button>
        </EmptyState.Action>
      </EmptyState>
    );
    expect(screen.getByText('📭')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
