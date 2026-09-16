import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../components/Pagination/Pagination';
import { UIGroup } from '../components/UIGroup/UIGroup';
import { LocaleProvider } from '../components/Locale/LocaleContext';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

describe('Pagination', () => {
  it('renders page number buttons and marks the current one with aria-current="page"', async () => {
    render(<Pagination totalItems={50} pageSize={10} />);

    const page1 = screen.getByLabelText('Page 1');
    expect(page1).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Page 2')).not.toHaveAttribute('aria-current');
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('disables Previous on the first page and Next on the last page', async () => {
    render(<Pagination totalItems={20} pageSize={10} />);

    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    // A "paging" control -- the last-page DOM (Next disabled, aria-current
    // moved) is genuinely different from page 1's.
    expect(await axe(document.body)).toHaveNoViolations();
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

  it('renders overridden strings from a LocaleProvider, including the templated page label', () => {
    render(
      <LocaleProvider strings={{ pagination: { nextPage: 'Volgende', page: (n) => `Pagina ${n}` } }}>
        <Pagination totalItems={50} pageSize={10} />
      </LocaleProvider>
    );

    expect(screen.getByLabelText('Volgende')).toBeInTheDocument();
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pagina 1')).toBeInTheDocument();
  });

  // Pagination renders its own internal <UIGroup> (Prev/page-numbers/Next),
  // which shadows an ambient UIGroupContext from a consumer's own outer
  // <UIGroup> -- see Pagination.tsx's own comment on why Prev/Next
  // explicitly re-read and forward the ambient value. These regression
  // tests prove that composition actually squares the right corners, not
  // just that the plumbing compiles -- same jsdom-observable-inline-style
  // convention as UIGroup.test.tsx's own "automatic corner-squaring via
  // context" suite (resolveSquareCorners emits real inline longhand corner
  // styles, so no real browser/CSS engine is needed to verify it here).
  describe('composes correctly inside an outer UIGroup', () => {
    it('squares Prev fully (both sides) when Pagination is the LAST member of an outer group', () => {
      render(
        <UIGroup>
          <button>Page size</button>
          <Pagination totalItems={50} pageSize={10} />
        </UIGroup>
      );

      // Pagination is the outer group's trailing/last member, so its own
      // ambient value is 'left' (square only the side touching the
      // sibling before it). Prev is Pagination's own leading element, so
      // it picks up BOTH its permanent local need (square its right side
      // against the page-number buttons) AND the ambient one (square its
      // left side against "Page size") -- all four corners squared.
      const prev = screen.getByLabelText('Previous page');
      expect(prev.style.borderTopLeftRadius).toBe('0px');
      expect(prev.style.borderBottomLeftRadius).toBe('0px');
      expect(prev.style.borderTopRightRadius).toBe('0px');
      expect(prev.style.borderBottomRightRadius).toBe('0px');

      // Next is Pagination's own trailing element and sits at the outer
      // group's real trailing edge -- unaffected by the ambient value,
      // its right side stays rounded exactly as it would standalone.
      const next = screen.getByLabelText('Next page');
      expect(next.style.borderTopLeftRadius).toBe('0px');
      expect(next.style.borderTopRightRadius).not.toBe('0px');
      expect(next.style.borderBottomRightRadius).not.toBe('0px');
    });

    it('squares Next fully (both sides) when Pagination is the FIRST member of an outer group', () => {
      render(
        <UIGroup>
          <Pagination totalItems={50} pageSize={10} />
          <button>Go</button>
        </UIGroup>
      );

      // Pagination is now the outer group's leading/first member, so its
      // ambient value is 'right'. Prev sits at the outer group's real
      // leading edge -- unaffected, its left side stays rounded.
      const prev = screen.getByLabelText('Previous page');
      expect(prev.style.borderTopRightRadius).toBe('0px');
      expect(prev.style.borderTopLeftRadius).not.toBe('0px');
      expect(prev.style.borderBottomLeftRadius).not.toBe('0px');

      // Next picks up both its permanent local need (square its left side
      // against the page-number buttons) and the ambient one (square its
      // right side against "Go") -- all four corners squared.
      const next = screen.getByLabelText('Next page');
      expect(next.style.borderTopLeftRadius).toBe('0px');
      expect(next.style.borderBottomLeftRadius).toBe('0px');
      expect(next.style.borderTopRightRadius).toBe('0px');
      expect(next.style.borderBottomRightRadius).toBe('0px');
    });
  });
});
