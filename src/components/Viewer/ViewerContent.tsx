import React, { useEffect, useRef, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { ViewerThemeSlice, type ViewerSliceState } from './ViewerSlice';

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
  const { vars } = useSliceOverrides(ViewerThemeSlice, overrides);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(activeIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(activeIndex + 1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setIsZoomed(true);
      } else if (e.key === '-') {
        e.preventDefault();
        setIsZoomed(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, items.length]);

  if (!activeItem) return null;

  return (
    <div
      ref={containerRef}
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
          aria-label="Close viewer"
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: isZoomed ? 'auto' : 'hidden',
        }}
      >
        {canGoPrev && (
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous item"
            className="ai-btn"
            style={{
              position: 'absolute',
              left: '0.75rem',
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
              boxShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.15)',
              ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
            }}
          >
            ◀
          </button>
        )}

        <img
          src={activeItem.src}
          alt={activeItem.alt ?? ''}
          onClick={() => setIsZoomed(z => !z)}
          style={{
            maxWidth: isZoomed ? 'none' : '100%',
            maxHeight: isZoomed ? 'none' : '100%',
            objectFit: 'contain',
            cursor: isZoomed ? 'zoom-out' : 'zoom-in',
            userSelect: 'none',
          }}
        />

        {canGoNext && (
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next item"
            className="ai-btn"
            style={{
              position: 'absolute',
              right: '0.75rem',
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
              boxShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.15)',
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
