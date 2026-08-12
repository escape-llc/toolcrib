import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../components/Tooltip/Tooltip';
import { Accordion } from '../components/Accordion/Accordion';
import { DropdownMenu } from '../components/DropdownMenu/DropdownMenu';
import { Select } from '../components/Form/Select';
import { Slider } from '../components/Form/Slider';
import { aiBus } from '../eventBus/eventBus';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

describe('Radix Primitives Subsystem', () => {
  it('renders Accordion and handles item expansion', () => {
    const openedFn = vi.fn();
    const unsub = aiBus.on('accordion:opened', openedFn);

    render(
      <Accordion
        id="test-accordion"
        items={[
          { value: 'item-1', title: 'Header 1', content: 'Content 1' },
          { value: 'item-2', title: 'Header 2', content: 'Content 2' },
        ]}
      />
    );

    expect(screen.getByText('Header 1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Header 1'));

    expect(openedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-accordion',
        itemValue: 'item-1',
      })
    );

    unsub();
  });

  it('renders Slider and handles value changes', () => {
    const sliderChangedFn = vi.fn();
    const unsub = aiBus.on('slider:changed', sliderChangedFn);

    const handleChange = vi.fn();

    render(<Slider name="volume" value={40} onChange={handleChange} />);

    const sliderThumb = screen.getByRole('slider');
    expect(sliderThumb).toHaveAttribute('aria-valuenow', '40');

    unsub();
  });

  it('renders DropdownMenu and handles item selection', () => {
    const menuSelectedFn = vi.fn();
    const unsub = aiBus.on('menu:item_selected', menuSelectedFn);
    const itemAction = vi.fn();

    render(
      <DropdownMenu
        id="test-menu"
        trigger={<button>Options</button>}
        items={[
          { value: 'edit', label: 'Edit Record', onClick: itemAction },
          { value: 'delete', label: 'Delete Record' },
        ]}
      />
    );

    expect(screen.getByText('Options')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Options'));

    unsub();
  });

  it('renders Tooltip wrapper', () => {
    render(
      <Tooltip id="test-tooltip" content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('renders Select component with Radix UI options', () => {
    const handleChange = vi.fn();

    render(
      <Select
        placeholder="Select role..."
        value="editor"
        onChange={handleChange}
        options={[
          { label: 'Admin', value: 'admin' },
          { label: 'Editor', value: 'editor' },
        ]}
      />
    );

    expect(screen.getByText('Editor')).toBeInTheDocument();
  });
});
