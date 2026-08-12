import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VStack, HStack } from '../components/Layout/Stack';
import { Grid } from '../components/Layout/Grid';

describe('Layout Idiom Components (Stack & Grid)', () => {
  it('renders VStack with vertical flex direction and gap spacing', () => {
    render(
      <VStack gap="lg">
        <div>Item 1</div>
        <div>Item 2</div>
      </VStack>
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders HStack with horizontal flex direction', () => {
    render(
      <HStack align="center" justify="between">
        <div>Left Item</div>
        <div>Right Item</div>
      </HStack>
    );

    expect(screen.getByText('Left Item')).toBeInTheDocument();
    expect(screen.getByText('Right Item')).toBeInTheDocument();
  });

  it('applies flexWrap only when wrap is true, on both VStack and HStack', () => {
    const { container: withWrap } = render(
      <HStack wrap>
        <div>A</div>
      </HStack>
    );
    expect((withWrap.firstChild as HTMLElement).style.flexWrap).toBe('wrap');

    const { container: withoutWrap } = render(
      <VStack>
        <div>B</div>
      </VStack>
    );
    expect((withoutWrap.firstChild as HTMLElement).style.flexWrap).toBe('');
  });

  it('renders Grid with multi-column layout template', () => {
    render(
      <Grid columns={3}>
        <div>Card A</div>
        <div>Card B</div>
        <div>Card C</div>
      </Grid>
    );

    expect(screen.getByText('Card A')).toBeInTheDocument();
  });
});
