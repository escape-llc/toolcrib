import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { useTableColumnResize } from '../components/DataTable/useTableColumnResize';
import type { Column } from '../components/DataTable/DataTable';

const column = { key: 'name', title: 'Name' } as Column<any>;

/**
 * DataTable takes its "lock the auto columns in" snapshot from a layout effect
 * that runs once per RENDER (latestAutoColumnWidthsRef). This harness does the
 * same: `renderedWidth` is whatever the last render saw, and `getLockInWidths`
 * reports it, exactly as DataTable's getter reports its per-render snapshot.
 */
function Harness({ onChange, onReady }: { onChange: (w: Record<string, number>) => void; onReady: (start: (x: number) => void) => void }) {
  const resize = useTableColumnResize({ onColumnWidthsChange: onChange });
  const renderedWidth = resize.getColumnWidth(column);
  const snapshot = React.useRef<number>(0);
  // Once per render, like DataTable's latestAutoColumnWidthsRef layout effect.
  React.useLayoutEffect(() => {
    snapshot.current = Number(renderedWidth);
  });
  React.useEffect(() => {
    onReady((clientX: number) => {
      const cell = document.createElement('th');
      cell.getBoundingClientRect = () => ({ width: 200 }) as DOMRect;
      resize.startResize(column, cell, clientX, () => ({ sibling: snapshot.current }));
    });
  });
  return null;
}

const usesPointer = () => 'PointerEvent' in window;
const move = (x: number) => window.dispatchEvent(new MouseEvent(usesPointer() ? 'pointermove' : 'mousemove', { clientX: x }));
const up = () => window.dispatchEvent(new MouseEvent(usesPointer() ? 'pointerup' : 'mouseup'));

describe('useTableColumnResize', () => {
  // Issue #709. pointermove is a continuous event, so React schedules the
  // updates it causes instead of rendering them. A fast drag releases a few
  // ms after its last move, and the lock-in snapshot (taken at commit, from
  // the last render) still held an EARLIER move's value. DataTable then locked
  // the neighbouring auto column at that stale width instead of the one the
  // final drag position gave it: a real fast drag lost most of its effect in
  // WebKit (the e2e saw 90px / 228px where the column's floor, 40px, was
  // right). jsdom can't lay anything out, but it shows the same ordering: the
  // events below arrive inside one act(), so nothing renders between them
  // unless the hook forces the final preview to.
  it('renders the final drag position before taking the lock-in snapshot', () => {
    const onChange = vi.fn();
    let start!: (x: number) => void;
    render(<Harness onChange={onChange} onReady={s => { start = s; }} />);

    act(() => start(100));
    act(() => {
      move(150);
      move(300);
      move(400); // the final move: 200 (start width) + 300 of travel
      up();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ name: 500, sibling: 500 });
  });

  it('still commits once per drag, with the clamped width', () => {
    const onChange = vi.fn();
    let start!: (x: number) => void;
    render(<Harness onChange={onChange} onReady={s => { start = s; }} />);

    act(() => start(100));
    act(() => {
      move(-5000); // far past the left edge: clamps to the column's min width
      up();
      up(); // the compatibility mouseup/pointerup pair must not commit twice
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].name).toBe(40);
  });
});
