import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toolbar } from '../components/Toolbar/Toolbar';

describe('Toolbar Component', () => {
  it('renders Toolbar with Left, Center, and Right slots', () => {
    render(
      <Toolbar>
        <Toolbar.Left>
          <span>Title Text</span>
        </Toolbar.Left>
        <Toolbar.Center>
          <span>Center Nav</span>
        </Toolbar.Center>
        <Toolbar.Right>
          <button>Action</button>
        </Toolbar.Right>
      </Toolbar>
    );

    expect(screen.getByText('Title Text')).toBeInTheDocument();
    expect(screen.getByText('Center Nav')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
