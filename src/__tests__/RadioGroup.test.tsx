import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadioGroup } from '../components/Form/RadioGroup';

describe('RadioGroup Component', () => {
  const options = [
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
    { label: 'Option C', value: 'c' },
  ];

  it('renders radio options and handles selection change', () => {
    const handleChange = vi.fn();

    render(<RadioGroup options={options} value="a" onChange={handleChange} />);

    const radioA = screen.getByRole('radio', { name: 'Option A' });
    const radioB = screen.getByRole('radio', { name: 'Option B' });

    expect(radioA).toHaveAttribute('aria-checked', 'true');
    expect(radioB).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(radioB);
    expect(handleChange).toHaveBeenCalledWith('b');
  });

  it('renders with compound RadioGroup.Option elements', () => {
    const handleChange = vi.fn();

    render(
      <RadioGroup value="b" onChange={handleChange}>
        <RadioGroup.Option value="a" label="Item A" />
        <RadioGroup.Option value="b" label="Item B" />
      </RadioGroup>
    );

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();

    const radioB = screen.getByRole('radio', { name: 'Item B' });
    expect(radioB).toHaveAttribute('aria-checked', 'true');
  });
});
