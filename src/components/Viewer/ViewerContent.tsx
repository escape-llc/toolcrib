'use client';

import React, { useEffect, useRef, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { ViewerThemeSlice, type ViewerSliceState } from './ViewerSlice';
import { useLocaleStrings } from '../Locale/LocaleContext';

/** Data shape for each media item in a `<ViewerContent>`/`<Viewer>`. */
export interface ViewerItem {
  /** Unique identifier for this item. */
  id: string;
  /** Full-resolution image source. */
  src: string;
  /** Alt text for the image. */
  alt?: string;
  /** Optional caption rendered below (or over, per `overrides.captionPosition`) the media. */
  caption?: React.ReactNode;
}

/**
 * Props for `<ViewerContent>` — the reusable media-viewing primitive.
 *
 * Has zero opinion about how it's hosted: no portal, no backdrop, no
 * focus-trap, no Escape-to-close logic of its own. Renders and functions
 * identically whether embedded inline, inside `<Modal>` (see `<Viewer>`),
 * `<Drawer>`, `<Popup>`, or anything else.
 */
export interface ViewerContentProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of media items to display. */
  items: ViewerItem[];
  /** Controlled active item index. Omit to let `<ViewerContent>` manage its own state internally. */
  activeIndex?: number;
  /** Initial active index when uncontrolled. @default 0 */
  defaultActiveIndex?: number;
  /** Change callback fired whenever the active item changes, controlled or not. */
  onIndexChange?: (index: number) => void;
  /**
   * When provided, renders a close affordance (an in-content close button)
   * that calls this on click. Omit entirely for a standalone/inline embed
   * with nothing to close. `<Viewer>` wires this to `<Modal>`'s own
   * `onOpenChange`; `ViewerContent` itself never listens for Escape — that's
   * the host's job, not content's.
   */
  onClose?: () => void;
  /** Per-instance overrides for nav button size and caption placement. */
  overrides?: Partial<ViewerSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Media viewer content — zoom/pan and prev/next navigation, no overlay chrome of its own; host it inside a `<Modal>` (see `<Viewer>`), `<Drawer>`, `<Popup>`, or directly inline, of your choosing
 * @manifestCategory Overlays
 * @manifestAntiPatternAvoid Weld a media viewer's zoom/pan/nav content directly to one specific overlay component
 * @manifestAntiPatternInstead Use `<ViewerContent>` on its own — zero overlay chrome of its own, host it inside `<Modal>` (`<Viewer>`), `<Drawer>`, `<Popup>`, or directly inline
 */
export const ViewerContent: React.FC<ViewerContentProps> = ({
  id: propId,
  items,
  activeIndex: controlledIndex,
  defaultActiveIndex = 0,
  onIndexChange,
  onClose,
  overrides,
}) => {
  const id = useStableId(propId, 'viewer');
  const strings = useLocaleStrings().viewer;
  const { vars } = useSliceOverrides(ViewerThemeSlice, overrides);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLayerRef = useRef<HTMLDivElement>(null);

  const [internalIndex, setInternalIndex] = useState(defaultActiveIndex);
  const isControlled = controlledIndex !== undefined;
  const activeIndex = isControlled ? controlledIndex : internalIndex;
  const activeItem = items[activeIndex];

  const [isZoomed, setIsZoomed] = useState(false);

  const previousIndexRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    aiBus.emit('viewer:item_changed', { id, activeIndex });
    previousIndexRef.current = activeIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= items.length || nextIndex === activeIndex) return;
    if (!isControlled) setInternalIndex(nextIndex);
    setIsZoomed(false);
    onIndexChange?.(nextIndex);
    aiBus.emit('viewer:item_changed', { id, activeIndex: nextIndex });
    previousIndexRef.current = nextIndex;
  };

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < items.length - 1;

  // Scoped to this subtree, not the document: an inline viewer must not
  // swallow arrow/+/- keys typed anywhere else on the page (#852). Inside
  // <Viewer>'s Modal, initial focus lands on the close button, which is in
  // here. Modifier chords (Ctrl/Cmd +/-, the browser's own zoom) pass through.
  // While zoomed, arrows pan the zoomed image instead (the prev/next buttons
  // still navigate). Done here, not left to the browser: WebKit doesn't
  // scroll an ancestor when the focused element is a button.
  const PAN_STEP = 40;
  const PAN: Record<string, [number, number]> = {
    ArrowLeft: [-PAN_STEP, 0], ArrowRight: [PAN_STEP, 0], ArrowUp: [0, -PAN_STEP], ArrowDown: [0, PAN_STEP],
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isZoomed && PAN[e.key]) {
      e.preventDefault();
      const [left, top] = PAN[e.key];
      scrollLayerRef.current?.scrollBy({ left, top });
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(activeIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(activeIndex + 1);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setIsZoomed(true);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setIsZoomed(false);
    }
  };

  if (!activeItem) return null;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        // `flex` (not `height: '100%'`) so this fills a flex-column host
        // like `<Modal>`'s content wrapper, which has no explicit height of
        // its own (only a `maxHeight`) — a `height: '100%'` descendant of
        // an auto-height parent resolves against no percentage basis at
        // all and silently collapses. See `TabStrip.tsx`'s `TabPanel` for
        // the same fix, found the same way (a real browser run). Harmless
        // no-op when `<ViewerContent>` isn't inside a flex parent at all
        // (the standalone/inline case) — a fixed-height wrapper is then the
        // host's own responsibility, same as any other inline content.
        flex: '1 1 0px',
        minHeight: 0,
        position: 'relative',
        background: 'var(--ai-bg-surface, #ffffff)',
        ...vars,
      }}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.closeViewer}
          className="ai-btn"
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2rem',
            height: '2rem',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-container, #f9fafb)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            ['--ai-btn-bg' as string]: 'var(--ai-bg-container, #f9fafb)',
          }}
        >
          ✕
        </button>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {canGoPrev && (
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            aria-label={strings.previousItem}
            className="ai-btn"
            style={{
              position: 'absolute',
              left: '0.75rem',
              // Vertically centred: fixed height + top/bottom 0 + auto margin
              // (not a transform, which .ai-btn's :active press uses).
              top: 0,
              bottom: 0,
              margin: 'auto 0',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--ai-viewer-nav-button-size, 2.75rem)',
              height: 'var(--ai-viewer-nav-button-size, 2.75rem)',
              borderRadius: '50%',
              background: 'var(--ai-bg-surface, #ffffff)',
              border: '0.0625rem solid var(--ai-border, #d1d5db)',
              color: 'var(--ai-text-primary, #111827)',
              cursor: 'pointer',
              boxShadow: 'var(--ai-shadow-sm, 0 0.0625rem 0.25rem rgba(0,0,0,0.15))',
              ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
            }}
          >
            ◀
          </button>
        )}

        {/* The scroll layer sits under the nav buttons, so they stay put
            while a zoomed image scrolls. `margin: auto` centres the image
            (justify/align `center` would push overflow past the top/left
            edge, out of scroll reach), and zoomed, nothing clamps the
            button: before #852 its 100% max size held the image at the
            stage's height, so zoom did nothing visible. */}
        <div
          ref={scrollLayerRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            overflow: isZoomed ? 'auto' : 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setIsZoomed(z => !z)}
            aria-label={isZoomed ? strings.zoomOut : strings.zoomIn}
            aria-pressed={isZoomed}
            className="ai-btn"
            style={{
              all: 'unset',
              cursor: isZoomed ? 'zoom-out' : 'zoom-in',
              margin: 'auto',
              maxWidth: isZoomed ? 'none' : '100%',
              maxHeight: isZoomed ? 'none' : '100%',
              flexShrink: 0,
              display: 'flex',
            }}
          >
            <img
              src={activeItem.src}
              alt={activeItem.alt ?? ''}
              style={{
                maxWidth: isZoomed ? 'none' : '100%',
                maxHeight: isZoomed ? 'none' : '100%',
                objectFit: 'contain',
                userSelect: 'none',
              }}
            />
          </button>
        </div>

        {canGoNext && (
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            aria-label={strings.nextItem}
            className="ai-btn"
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: 0,
              bottom: 0,
              margin: 'auto 0',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--ai-viewer-nav-button-size, 2.75rem)',
              height: 'var(--ai-viewer-nav-button-size, 2.75rem)',
              borderRadius: '50%',
              background: 'var(--ai-bg-surface, #ffffff)',
              border: '0.0625rem solid var(--ai-border, #d1d5db)',
              color: 'var(--ai-text-primary, #111827)',
              cursor: 'pointer',
              boxShadow: 'var(--ai-shadow-sm, 0 0.0625rem 0.25rem rgba(0,0,0,0.15))',
              ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
            }}
          >
            ▶
          </button>
        )}
      </div>

      {activeItem.caption && (
        <div
          style={{
            padding: 'var(--ai-padding-md, 0.75rem 1rem)',
            background: 'var(--ai-viewer-caption-bg, transparent)',
            color: 'var(--ai-viewer-caption-color, var(--ai-text-primary, #111827))',
            fontSize: '0.875rem',
            textAlign: 'center',
          }}
        >
          {activeItem.caption}
        </div>
      )}
    </div>
  );
};
