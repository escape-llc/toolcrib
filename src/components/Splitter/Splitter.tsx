'use client';

/* eslint-disable react-hooks/rules-of-hooks -- Splitter.Panel below is a real
   component (the documented Component.Slot = (props) => {...} pattern this
   repo's AGENTS.md manifest section describes for slot discovery), calling
   useCornerSquaring (a custom hook) internally. The lint rule's naming
   heuristic only recognizes a bare PascalCase identifier as a valid
   component/hook name, not a `Splitter.Panel =` assignment target, so it
   misreads this as a plain non-component function calling hooks illegally.
   Confirmed false positive, not a real bug -- this renders and tests
   correctly today. Scoped to just this one rule for this file; every other
   react-hooks rule (including exhaustive-deps, which has a real separate
   finding elsewhere in this file) still applies normally. */
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode, type ReactElement, isValidElement, cloneElement } from 'react';
import { Z_INDEX } from '../../theme/zIndex';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { LayoutDomainProvider, useCornerSquaring } from './LayoutDomainContext';
import { warnIfLegacyStyleProps } from '../../theme/safeProps';
import { useStableId } from '../shared/useStableId';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';

const CORNER_SQUARING_STYLE_ID = 'toolcrib-corner-squaring';

/**
 * Automatic corner-squaring for the two panels this Splitter renders,
 * expressed as attribute-selector CSS rather than the JS-computed inline
 * style `useCornerSquaring` (`LayoutDomainContext.tsx`) returns for
 * components that call it. Both exist because they cover different cases:
 * `useCornerSquaring` only reaches a component that explicitly calls the
 * hook (`Card`, `Content`, and — one level deep only — a plain DOM element
 * child of `Splitter.Panel` via its own `cloneElement` forwarding). It
 * does NOT reach a plain child passed directly to `<Splitter>` without
 * `<Splitter.Panel>` at all, a non-toolcrib React component child (opted
 * out of deliberately, see `Splitter.Panel`'s own comment), or anything
 * nested two or more levels deep — this CSS is the catch-all for exactly
 * those cases, keyed off the `data-ai-layout-orientation`/
 * `data-ai-layout-slot`/`data-ai-layout-auto` attributes rendered below
 * and on `Card`/`Content`. Used to live only in the demo app's own
 * index.css, which happened to cover the demo's own markup but left any
 * other consumer's plain/non-hook-calling children with square-less
 * corners butting up against the splitter handle.
 */
function injectCornerSquaringStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    CORNER_SQUARING_STYLE_ID,
    `
    [data-ai-layout-orientation="vertical"][data-ai-layout-slot="first"] [data-ai-layout-auto="true"],
    [data-ai-layout-orientation="vertical"][data-ai-layout-slot="first"] > :last-child,
    [data-ai-layout-orientation="vertical"][data-ai-layout-slot="first"] > :last-child > :last-child {
      border-bottom-left-radius: 0px !important;
      border-bottom-right-radius: 0px !important;
    }
    [data-ai-layout-orientation="vertical"][data-ai-layout-slot="second"] [data-ai-layout-auto="true"],
    [data-ai-layout-orientation="vertical"][data-ai-layout-slot="second"] > :first-child,
    [data-ai-layout-orientation="vertical"][data-ai-layout-slot="second"] > :first-child > :first-child {
      border-top-left-radius: 0px !important;
      border-top-right-radius: 0px !important;
    }
    [data-ai-layout-orientation="horizontal"][data-ai-layout-slot="first"] [data-ai-layout-auto="true"],
    [data-ai-layout-orientation="horizontal"][data-ai-layout-slot="first"] > :last-child,
    [data-ai-layout-orientation="horizontal"][data-ai-layout-slot="first"] > :last-child > :last-child {
      border-top-right-radius: 0px !important;
      border-bottom-right-radius: 0px !important;
    }
    [data-ai-layout-orientation="horizontal"][data-ai-layout-slot="second"] [data-ai-layout-auto="true"],
    [data-ai-layout-orientation="horizontal"][data-ai-layout-slot="second"] > :first-child,
    [data-ai-layout-orientation="horizontal"][data-ai-layout-slot="second"] > :first-child > :first-child {
      border-top-left-radius: 0px !important;
      border-bottom-left-radius: 0px !important;
    }
    `,
    targetDocument,
    nonce
  );
}

export type SplitterOrientation = 'horizontal' | 'vertical';

/**
 * Props for the `<Splitter>` resizable panel layout.
 *
 * Requires exactly 2 children (typically `<Splitter.Panel>` components).
 * Automatically creates a layout domain for corner-squaring adjacent children.
 */
export interface SplitterProps {
  /** Unique domain identifier for layout context, and the `id` a `splitter:split_changed` aiBus event must match to command this Splitter's split ratio externally. Auto-generated if omitted — pass an explicit value to target it predictably. */
  id?: string;
  /**
   * Split direction. `'vertical'` = top/bottom panels, `'horizontal'` = left/right panels.
   * @default 'vertical'
   */
  orientation?: SplitterOrientation;
  /**
   * Initial percentage allocated to the first (top/left) panel.
   * @default 70
   */
  initialSplit?: number;
  /**
   * Minimum percentage size for either panel to prevent collapsing.
   * @default 15
   */
  minSize?: number;
  /** Exactly two child elements representing the two panels. */
  children: [ReactNode, ReactNode];
}

/**
 * Props for `<Splitter.Panel>` wrapper. Squares off its own corners based
 * on its position in the splitter; a toolcrib component nested inside it
 * (e.g. `<Card>`, `<Content>`) squares its own corners independently via
 * `useCornerSquaring`/the ambient layout domain — Panel no longer forwards
 * a computed `style` into component children, only into plain DOM element
 * children, which have no other way to receive it (see `Splitter.Panel`'s
 * implementation).
 */
export interface SplitterPanelProps {
  children: ReactNode;
  /**
   * Which corners to square off. `'auto'` defers to the layout domain.
   * @default undefined
   */
  squareCorners?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'none';
}

/**
 * @manifest Resizable two-panel layout with automatic corner-squaring domain
 * @manifestConstraints Requires exactly 2 children
 * @manifestCategory Containers
 */
export const Splitter: React.FC<SplitterProps> & {
  Panel: React.FC<SplitterPanelProps>;
} = ({
  id: propId,
  orientation = 'vertical',
  initialSplit = 70,
  minSize = 15,
  children,
  ...props
}) => {
  warnIfLegacyStyleProps(props, 'Splitter');
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectCornerSquaringStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);
  // useStableId (React's useId() under the hood) rather than the previous
  // Math.random()-in-a-useRef: domainId is rendered directly into
  // `data-ai-layout-domain` below, on both panel wrappers, so a value that
  // differs between the server's render and the client's first render
  // fails hydration for anyone server-rendering — see useStableId's own
  // comment for the full mechanism. Splitter is the one caller of this
  // pattern that actually renders its id, which is what made this a live
  // bug rather than a theoretical one.
  const domainId = useStableId(propId, 'splitter-domain');

  // Validation: Splitter requires exactly 2 children
  const childCount = React.Children.count(children);
  if (childCount !== 2) {
    console.error(
      `[toolcrib] <Splitter> requires exactly 2 children (got ${childCount}). ` +
      `Wrap each panel's content in a <Splitter.Panel> or any single element.`
    );
  }

  const [split, setSplit] = useState<number>(initialSplit);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestSplitRef = useRef<number>(initialSplit);

  const isVertical = orientation === 'vertical'; // vertical split = top/bottom panels

  // Splitter has no controlled/ref prop for `split` — a consumer button
  // ("collapse this panel", "reset the layout") drives it the same way a
  // drag, an arrow key, or the handle's own dblclick-to-reset already do:
  // over `aiBus`, matched by this Splitter's own `domainId` (already used
  // to target it for `layout:domain:created`/`layout:corners:squared`
  // above, so this reuses an id a consumer may already have on hand rather
  // than introducing a second identifier). `fromBus` mirrors Collapsible's
  // own `handleOpenChange(open, fromBus)` guard: a change that arrived
  // FROM the bus doesn't re-emit, so two Splitters (or a Splitter and an
  // external listener) commanding each other can't loop.
  // useCallback, not a plain function -- the pointer-drag effect below
  // needs a stable reference to add as a real dependency (otherwise it
  // would either capture a stale closure over minSize/domainId for the
  // lifetime of one drag, or -- if added to deps without memoizing --
  // re-run on every render, tearing down and reattaching window-level
  // pointer listeners mid-drag).
  const commitSplit = useCallback(
    (value: number, fromBus = false) => {
      const clamped = Math.max(minSize, Math.min(100 - minSize, value));
      latestSplitRef.current = clamped;
      setSplit(clamped);
      if (!fromBus) {
        aiBus.emit('splitter:split_changed', { id: domainId, split: clamped });
      }
    },
    [minSize, domainId]
  );

  useAIEvent('splitter:split_changed', e => {
    if (e.id === domainId) commitSplit(e.split, true);
  });

  useEffect(() => {
    aiBus.emit('layout:domain:created', {
      domainId,
      parentId: domainId,
      orientation,
    });

    const firstSquared = isVertical
      ? { bottomLeft: true, bottomRight: true }
      : { topRight: true, bottomRight: true };

    const secondSquared = isVertical
      ? { topLeft: true, topRight: true }
      : { topLeft: true, bottomLeft: true };

    aiBus.emit('layout:corners:squared', {
      domainId,
      slot: 'first',
      orientation,
      squaredCorners: firstSquared,
    });

    aiBus.emit('layout:corners:squared', {
      domainId,
      slot: 'second',
      orientation,
      squaredCorners: secondSquared,
    });
  }, [domainId, orientation, isVertical]);

  // useLayoutEffect, not useEffect — these window-level move/up listeners
  // must be attached synchronously within the same commit as isDragging
  // becoming true, not deferred until after paint. Same bug class found
  // and fixed for Drawer's Escape-key listener this session: a fast
  // enough drag gesture's first pointermove could otherwise fire before a
  // useEffect version had attached, dropping that first tick.
  useLayoutEffect(() => {
    if (!isDragging) return;
    if (!containerRef.current) return;

    // The bare global `window` is always the window this module was first
    // loaded into — for a Splitter whose whole tree is portaled into a
    // *different* document (e.g. a live demo tile rendered inside an
    // <iframe> via ReactDOM.createPortal), that's the outer page's window,
    // not the iframe's own. Mouse/pointer events firing while dragging
    // inside the iframe are scoped to the iframe's own document and never
    // bubble out to the outer page's window at all, so listeners bound
    // there silently never run — confirmed via a real browser run: the
    // handle picked up mousedown fine (React's per-root delegation reaches
    // it correctly) but every subsequent drag move did nothing, because
    // handlePointerMove below was listening on the wrong window entirely.
    // Deriving the window from this Splitter's own rendered node (already
    // held in containerRef) is correct in both the single-document case
    // (the overwhelmingly common one — ownerDocument.defaultView is just
    // the same window) and the portaled-into-another-document case, with
    // no new prop or opt-in required either way.
    const ownerWindow = containerRef.current.ownerDocument.defaultView ?? window;

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      let newPercentage = 50;
      if (isVertical) {
        const offset = e.clientY - rect.top;
        newPercentage = (offset / rect.height) * 100;
      } else {
        const offset = e.clientX - rect.left;
        newPercentage = (offset / rect.width) * 100;
      }

      const clamped = Math.max(minSize, Math.min(100 - minSize, newPercentage));
      // setSplit directly, not commitSplit -- this fires on every
      // mousemove tick during a drag, and broadcasting each one over
      // aiBus would flood it. The final position still gets announced,
      // via commitSplit on pointer-up below.
      latestSplitRef.current = clamped;
      setSplit(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      commitSplit(latestSplitRef.current);
    };

    ownerWindow.addEventListener('mousemove', handlePointerMove);
    ownerWindow.addEventListener('mouseup', handlePointerUp);
    ownerWindow.addEventListener('pointermove', handlePointerMove);
    ownerWindow.addEventListener('pointerup', handlePointerUp);

    return () => {
      ownerWindow.removeEventListener('mousemove', handlePointerMove);
      ownerWindow.removeEventListener('mouseup', handlePointerUp);
      ownerWindow.removeEventListener('pointermove', handlePointerMove);
      ownerWindow.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isVertical, minSize, commitSplit]);

  const onHandleDown = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const [firstPanel, secondPanel] = React.Children.toArray(children);

  const getFirstPanelCornerStyle = (): React.CSSProperties => {
    return isVertical
      ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
      : { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
  };

  const getSecondPanelCornerStyle = (): React.CSSProperties => {
    return isVertical
      ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
      : { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* First / Top / Left Panel Container */}
      <LayoutDomainProvider domainId={domainId} slot="first" orientation={orientation}>
        <div
          data-ai-layout-domain={domainId}
          data-ai-layout-slot="first"
          data-ai-layout-orientation={orientation}
          style={{
            flex: `0 0 ${split}%`,
            width: '100%',
            height: isVertical ? undefined : '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            ...(isVertical ? {
              '--ai-layout-border-bottom-left-radius': '0rem',
              '--ai-layout-border-bottom-right-radius': '0rem',
            } : {
              '--ai-layout-border-top-right-radius': '0rem',
              '--ai-layout-border-bottom-right-radius': '0rem',
            }) as any,
            ...getFirstPanelCornerStyle(),
          }}
        >
          {firstPanel}
        </div>
      </LayoutDomainProvider>

      {/* Resizable Gutter / Handle */}
      <div
        role="separator"
        aria-orientation={orientation}
        aria-valuenow={Math.round(split)}
        aria-valuemin={minSize}
        aria-valuemax={100 - minSize}
        aria-label={isVertical ? 'Resize panels vertically' : 'Resize panels horizontally'}
        tabIndex={0}
        onMouseDown={onHandleDown}
        onPointerDown={onHandleDown}
        onDoubleClick={() => commitSplit(initialSplit)}
        onKeyDown={e => {
          const step = e.shiftKey ? 10 : 2;
          const forwardKey = isVertical ? 'ArrowDown' : 'ArrowRight';
          const backwardKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
          if (e.key === forwardKey) {
            e.preventDefault();
            commitSplit(split + step);
          } else if (e.key === backwardKey) {
            e.preventDefault();
            commitSplit(split - step);
          } else if (e.key === 'Home') {
            e.preventDefault();
            commitSplit(minSize);
          } else if (e.key === 'End') {
            e.preventDefault();
            commitSplit(100 - minSize);
          }
        }}
        className="ai-focus-ring"
        style={{
          flex: '0 0 0.625rem',
          background: isDragging ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #e5e7eb)',
          cursor: isVertical ? 'row-resize' : 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
          zIndex: Z_INDEX.SPLITTER,
          touchAction: 'none',
          userSelect: 'none',
          alignSelf: 'stretch',
        }}
      >
        <div
          style={{
            width: isVertical ? '2.5rem' : '0.125rem',
            height: isVertical ? '0.125rem' : '2.5rem',
            background: 'var(--ai-text-secondary, #9ca3af)',
            borderRadius: 'var(--ai-radius-sm, 0.125rem)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Second / Bottom / Right Panel Container */}
      <LayoutDomainProvider domainId={domainId} slot="second" orientation={orientation}>
        <div
          data-ai-layout-domain={domainId}
          data-ai-layout-slot="second"
          data-ai-layout-orientation={orientation}
          style={{
            flex: `1 1 ${100 - split}%`,
            width: '100%',
            height: isVertical ? undefined : '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            ...(isVertical ? {
              '--ai-layout-border-top-left-radius': '0rem',
              '--ai-layout-border-top-right-radius': '0rem',
            } : {
              '--ai-layout-border-top-left-radius': '0rem',
              '--ai-layout-border-bottom-left-radius': '0rem',
            }) as any,
            ...getSecondPanelCornerStyle(),
          }}
        >
          {secondPanel}
        </div>
      </LayoutDomainProvider>
    </div>
  );
};

Splitter.Panel = ({ children, squareCorners }) => {
  // Deriving "am I first or second, what orientation" straight from the
  // ambient layout domain (same mechanism Card/Content use) replaces a
  // previous relay where Splitter injected a computed style *into* Panel's
  // own `style` prop, and Panel then read its own border-radius values
  // back out to infer its position — a real, if convoluted, use of the
  // now-removed cloneElement forwarding, exercised by Splitter.test.tsx's
  // "no explicit squareCorners" cases. Only triggers when the caller
  // hasn't given an explicit edge (or asked for 'auto' explicitly).
  const { style: domainCornerStyle } = useCornerSquaring(squareCorners === undefined || squareCorners === 'auto');
  const childArray = React.Children.toArray(children);

  const getExplicitSquareStyle = (): React.CSSProperties => {
    if (squareCorners === 'top') return { borderTopLeftRadius: 0, borderTopRightRadius: 0 };
    if (squareCorners === 'bottom') return { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 };
    if (squareCorners === 'left') return { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
    if (squareCorners === 'right') return { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
    if (squareCorners === 'none') return {};
    return domainCornerStyle;
  };

  const radiusOverride = getExplicitSquareStyle();
  const hasRadiusOverride = Object.keys(radiusOverride).length > 0;

  // Only plain DOM element children (e.g. a raw <div>) get their corner
  // radius injected directly — they have no way to call
  // useCornerSquaring()/useLayoutDomain() themselves, unlike a toolcrib
  // component (Card, Content, ...), which now consults the ambient layout
  // domain on its own and no longer accepts an injected `style` prop at
  // all. "Single-level" is intentional: matches how deep useCornerSquaring
  // itself reaches (immediate domain, not arbitrary descendants).
  const processDirectChild = (child: ReactNode): ReactNode => {
    if (!isValidElement(child)) return child;
    const typedChild = child as ReactElement<any>;
    const isReactComponent = typeof typedChild.type !== 'string';
    if (isReactComponent) return child;

    const childStyle = typedChild.props.style || {};
    return cloneElement(typedChild, {
      style: {
        width: '100%',
        boxSizing: 'border-box',
        ...childStyle,
        ...radiusOverride,
      },
    });
  };

  const renderedContent = hasRadiusOverride
    ? childArray.map(child => processDirectChild(child))
    : children;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...radiusOverride,
      }}
    >
      {renderedContent}
    </div>
  );
};

Splitter.Panel.displayName = 'Splitter.Panel';
