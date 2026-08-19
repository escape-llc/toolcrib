import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewerContent } from '../components/Viewer/ViewerContent';
import { aiBus } from '../eventBus/eventBus';

const items = [
  { id: 'a', src: '/a.jpg', alt: 'Photo A', caption: 'Caption A' },
  { id: 'b', src: '/b.jpg', alt: 'Photo B', caption: 'Caption B' },
  { id: 'c', src: '/c.jpg', alt: 'Photo C' },
];

describe('ViewerContent', () => {
  // The whole point of the content/shell split: this must work with no
  // Modal/overlay wrapper at all -- every test in this file renders it
  // standalone, not just this one, but this one names that explicitly.
  it('renders the active item standalone, with no host at all', () => {
    render(<ViewerContent items={items} defaultActiveIndex={0} />);
    expect(screen.getByAltText('Photo A')).toHaveAttribute('src', '/a.jpg');
    expect(screen.getByText('Caption A')).toBeInTheDocument();
  });

  it('hides the prev button at the first item', () => {
    render(<ViewerContent items={items} defaultActiveIndex={0} />);
    expect(screen.queryByLabelText('Previous item')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Next item')).toBeInTheDocument();
  });

  it('hides the next button at the last item', () => {
    render(<ViewerContent items={items} defaultActiveIndex={items.length - 1} />);
    expect(screen.getByLabelText('Previous item')).toBeInTheDocument();
    expect(screen.queryByLabelText('Next item')).not.toBeInTheDocument();
  });

  it('navigates via the next/prev buttons, calling onIndexChange and emitting viewer:item_changed', () => {
    const onIndexChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('viewer:item_changed', changedFn);

    render(<ViewerContent id="test-viewer" items={items} defaultActiveIndex={0} onIndexChange={onIndexChange} />);
    expect(changedFn).toHaveBeenCalledWith({ id: 'test-viewer', activeIndex: 0 });

    fireEvent.click(screen.getByLabelText('Next item'));
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(changedFn).toHaveBeenCalledWith({ id: 'test-viewer', activeIndex: 1 });
    expect(screen.getByAltText('Photo B')).toBeInTheDocument();

    unsub();
  });

  it('navigates via ArrowLeft/ArrowRight keyboard shortcuts', () => {
    render(<ViewerContent items={items} defaultActiveIndex={0} />);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByAltText('Photo B')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByAltText('Photo A')).toBeInTheDocument();
  });

  it('supports controlled activeIndex', () => {
    const { rerender } = render(<ViewerContent items={items} activeIndex={0} onIndexChange={() => {}} />);
    expect(screen.getByAltText('Photo A')).toBeInTheDocument();

    rerender(<ViewerContent items={items} activeIndex={2} onIndexChange={() => {}} />);
    expect(screen.getByAltText('Photo C')).toBeInTheDocument();
  });

  it('renders a close button only when onClose is provided', () => {
    const { rerender } = render(<ViewerContent items={items} />);
    expect(screen.queryByLabelText('Close viewer')).not.toBeInTheDocument();

    const onClose = vi.fn();
    rerender(<ViewerContent items={items} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close viewer'));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles zoom on image click', () => {
    render(<ViewerContent items={items} defaultActiveIndex={0} />);
    const img = screen.getByAltText('Photo A');
    expect(img).toHaveStyle({ cursor: 'zoom-in' });

    fireEvent.click(img);
    expect(img).toHaveStyle({ cursor: 'zoom-out' });

    fireEvent.click(img);
    expect(img).toHaveStyle({ cursor: 'zoom-in' });
  });
});
