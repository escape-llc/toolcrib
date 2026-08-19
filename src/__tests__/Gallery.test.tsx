import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Gallery } from '../components/Gallery/Gallery';

const items = [
  { id: 'a', thumbnailSrc: '/a-thumb.jpg', fullSrc: '/a-full.jpg', alt: 'Photo A', caption: 'Caption A' },
  { id: 'b', thumbnailSrc: '/b-thumb.jpg', fullSrc: '/b-full.jpg', alt: 'Photo B' },
  { id: 'c', thumbnailSrc: '/c-thumb.jpg', fullSrc: '/c-full.jpg', alt: 'Photo C' },
];

describe('Gallery', () => {
  it('renders every thumbnail, deferred, and no Viewer content until a thumbnail is clicked', () => {
    render(<Gallery items={items} />);
    expect(screen.getByAltText('Photo A')).toHaveAttribute('src', '/a-thumb.jpg');
    expect(screen.getByAltText('Photo B')).toHaveAttribute('src', '/b-thumb.jpg');
    expect(screen.getByAltText('Photo C')).toHaveAttribute('src', '/c-thumb.jpg');
    // Only the thumbnails' own <img> alt texts exist yet -- the internal
    // Viewer (which would render a *second* element with matching alt
    // text, the full-res image) hasn't opened.
    expect(screen.getAllByAltText('Photo A')).toHaveLength(1);
  });

  it('wraps each thumbnail in DeferredContent (content-visibility: auto) -- the actual lazy-render mechanism, not a second one', () => {
    render(<Gallery items={items} />);
    const thumb = screen.getByAltText('Photo A');
    // DeferredContent's own root is the <button>'s grandparent.
    const deferredRoot = thumb.closest('button')?.parentElement as HTMLElement;
    expect(deferredRoot.style.contentVisibility).toBe('auto');
  });

  it('clicking a thumbnail opens the internal Viewer at that item\'s index', () => {
    render(<Gallery items={items} />);
    fireEvent.click(screen.getByLabelText('Photo B'));

    // Now both the thumbnail (small, in Grid) and the Viewer's full-res
    // <img> share the same alt text, so there are two.
    const matches = screen.getAllByAltText('Photo B');
    expect(matches).toHaveLength(2);
    expect(matches.some(el => el.getAttribute('src') === '/b-full.jpg')).toBe(true);
  });

  it('calls a custom onItemClick instead of opening the Viewer, when provided', () => {
    const onItemClick = vi.fn();
    render(<Gallery items={items} onItemClick={onItemClick} />);
    fireEvent.click(screen.getByLabelText('Photo A'));

    expect(onItemClick).toHaveBeenCalledWith(items[0], 0);
    // Viewer never opened -- still only one "Photo A" element (the thumbnail).
    expect(screen.getAllByAltText('Photo A')).toHaveLength(1);
  });

  it('closing the Viewer (its own close button) returns to just the thumbnail grid', () => {
    render(<Gallery items={items} />);
    fireEvent.click(screen.getByLabelText('Photo A'));
    expect(screen.getAllByAltText('Photo A')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Close viewer'));
    expect(screen.getAllByAltText('Photo A')).toHaveLength(1);
  });

  it('navigating next inside the open Viewer advances to the next Gallery item', () => {
    render(<Gallery items={items} />);
    fireEvent.click(screen.getByLabelText('Photo A'));

    fireEvent.click(screen.getByLabelText('Next item'));

    const matches = screen.getAllByAltText('Photo B');
    expect(matches.some(el => el.getAttribute('src') === '/b-full.jpg')).toBe(true);
  });
});
