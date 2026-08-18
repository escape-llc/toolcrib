import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../components/Pagination/Pagination';
import { aiBus } from '../eventBus/eventBus';

describe('Pagination', () => {
  it('renders page number buttons and marks the current one with aria-current="page"', () => {
    render(<Pagination totalItems={50} pageSize={10} />);

    const page1 = screen.getByLabelText('Page 1');
    expect(page1).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Page 2')).not.toHaveAttribute('aria-current');
  });

  it('disables Previous on the first page and Next on the last page', () => {
    render(<Pagination totalItems={20} pageSize={10} />);

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('collapses a large page range with an ellipsis around the current page', () => {
    render(<Pagination totalItems={500} pageSize={10} defaultPage={25} />);

    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 50')).toBeInTheDocument(); // last page
    expect(screen.getByLabelText('Page 25')).toHaveAttribute('aria-current', 'page');
    // Far-away pages (e.g. page 2) are collapsed behind the ellipsis, not individually rendered.
    expect(screen.queryByLabelText('Page 2')).not.toBeInTheDocument();
  });

  it('navigates via ArrowLeft/ArrowRight from anywhere inside the control', () => {
    render(<Pagination totalItems={50} pageSize={10} />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    fireEvent.keyDown(nav, { key: 'ArrowRight' });
    expect(screen.getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');

    fireEvent.keyDown(nav, { key: 'ArrowLeft' });
    expect(screen.getByLabelText('Page 1')).toHaveAttribute('aria-current', 'page');
  });

  it('supports a controlled page, calling onPageChange instead of managing its own state', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Pagination totalItems={50} pageSize={10} page={2} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
    // Still showing page 2 — the parent hasn't re-rendered with the new page yet.
    expect(screen.getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');

    rerender(<Pagination totalItems={50} pageSize={10} page={3} onPageChange={onPageChange} />);
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
  });

  it('emits pagination:changed on every page change', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('pagination:changed', changedFn);

    render(<Pagination id="my-pagination" totalItems={50} pageSize={10} />);
    fireEvent.click(screen.getByLabelText('Page 2'));

    expect(changedFn).toHaveBeenLastCalledWith({ id: 'my-pagination', page: 2, pageSize: 10 });
    unsub();
  });
});
