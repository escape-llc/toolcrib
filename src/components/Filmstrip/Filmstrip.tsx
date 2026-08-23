import React, { useRef, useState, useEffect, type ReactNode } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useScrollOverflow } from '../shared/useScrollOverflow';
import { useStableId } from '../shared/useStableId';
import { TabThemeSlice, type TabSliceState } from '../TabStrip/TabSlice';

/** Data shape for each thumbnail in a `<Filmstrip>`. */
export interface FilmstripItem {
  /** Unique identifier for this item — used in `activeId` and `onChange`. */
  id: string;
  /** Thumbnail content rendered in the strip, e.g. an `<img>`. */
  content: ReactNode;
  /** Accessible label for this item, e.g. `"Photo 3 of 12"`. */
  label?: string;
  /** If true, the item cannot be selected. */
  disabled?: boolean;
}

/**
 * Props for the `<Filmstrip>` horizontally-scrollable media strip.
 *
 * Same shape as `<TabStrip>`'s own filmstrip-overflow scrolling (they now
 * share the extracted `useScrollOverflow` hook), applied to thumbnails
 * instead of tab labels — the same controlled/uncontrolled `activeId`/
 * `defaultActiveId`/`onChange` convention, no compositional panel side.
 */
export interface FilmstripProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of thumbnail definitions to render. */
  items: FilmstripItem[];
  /** Controlled active item id. Omit to let `<Filmstrip>` manage its own state internally. */
  activeId?: string;
  /** Initial active item when uncontrolled. @default items[0]?.id */
  defaultActiveId?: string;
  /** Change callback fired whenever the active item changes, controlled or not. */
  onChange?: (id: string) => void;
  /**
   * Width/height of each thumbnail slot.
   * @default '4rem'
   */
  thumbnailSize?: string;
  /**
   * Per-instance overrides for the active-item indicator. Reuses
   * `<TabStrip>`'s own registered `ThemeSlice` (its active-indicator
   * tokens — `variant`/`size` are ignored here) rather than a second,
   * parallel slice, so a filmstrip's active-thumbnail ring always matches
   * the app's tab styling.
   */
  overrides?: Partial<TabSliceState>;
}

/**
 * @manifest Horizontally-scrollable thumbnail strip with an active-item indicator, reusing TabStrip's own overflow scroll detection
 * @manifestCategory Data Display
 */
export const Filmstrip: React.FC<FilmstripProps> = ({
  id: propId,
  items,
  activeId: controlledActiveId,
  defaultActiveId,
  onChange,
  thumbnailSize = '4rem',
  overrides,
}) => {
  const id = useStableId(propId, 'filmstrip');
  const { vars } = useSliceOverrides(TabThemeSlice, overrides);
  useInjectInteractionStyles();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight, scrollBy } = useScrollOverflow(scrollContainerRef, [items]);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [internalActiveId, setInternalActiveId] = useState(defaultActiveId ?? items[0]?.id ?? '');
  const isControlled = controlledActiveId !== undefined;
  const activeId = isControlled ? controlledActiveId : internalActiveId;
  // Roving tabindex per the WAI-ARIA APG Listbox pattern: exactly one
  // option is ever in the Tab order at a time (Arrow keys move among them
  // instead), not every thumbnail individually — previously every <button>
  // used its default tabIndex, so a keyboard user had to Tab through each
  // one in turn instead of arrowing directly to the one they wanted, and
  // no Arrow key handling existed at all. Falls back to the first enabled
  // item if activeId doesn't match any current item (e.g. it was removed),
  // so the strip is never entirely untabbable.
  const rovingTabIndexId = items.some(it => it.id === activeId) ? activeId : items.find(it => !it.disabled)?.id;

  const previousIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    aiBus.emit('filmstrip:changed', { id, activeId, previousId: undefined });
    previousIdRef.current = activeId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (nextId: string) => {
    if (!isControlled) setInternalActiveId(nextId);
    onChange?.(nextId);
    if (nextId !== previousIdRef.current) {
      aiBus.emit('filmstrip:changed', { id, activeId: nextId, previousId: previousIdRef.current });
      previousIdRef.current = nextId;
    }
  };

  // Selection-follows-focus, matching RadioGroup's own arrow-key model
  // (the common pattern for a single-select roving-tabindex widget) rather
  // than a separate "move focus, then confirm" step — Arrow moves both the
  // active item and real DOM focus together. Doesn't wrap past either end
  // (an optional behavior per the APG pattern, not a required one) and
  // skips disabled items so focus can never land on one.
  const moveTo = (nextId: string) => {
    handleChange(nextId);
    itemRefs.current.get(nextId)?.focus();
  };

  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const enabledIndices = items.reduce<number[]>((acc, it, i) => { if (!it.disabled) acc.push(i); return acc; }, []);
    const posInEnabled = enabledIndices.indexOf(currentIndex);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = enabledIndices[Math.min(posInEnabled + 1, enabledIndices.length - 1)];
      if (next !== undefined) moveTo(items[next].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = enabledIndices[Math.max(posInEnabled - 1, 0)];
      if (prev !== undefined) moveTo(items[prev].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = enabledIndices[0];
      if (first !== undefined) moveTo(items[first].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = enabledIndices[enabledIndices.length - 1];
      if (last !== undefined) moveTo(items[last].id);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        maxWidth: '100%',
        ...vars,
      }}
    >
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-180)}
          aria-label="Scroll filmstrip left"
          className="ai-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.05)',
            flexShrink: 0,
            zIndex: 2,
            ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
          }}
        >
          ◀
        </button>
      )}

      <div
        ref={scrollContainerRef}
        role="listbox"
        aria-label="Filmstrip"
        className="ai-focus-ring"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flex: 1,
          outline: 'none',
        }}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={el => {
                if (el) itemRefs.current.set(item.id, el);
                else itemRefs.current.delete(item.id);
              }}
              type="button"
              role="option"
              aria-selected={isActive}
              aria-label={item.label}
              disabled={item.disabled}
              tabIndex={item.id === rovingTabIndexId ? 0 : -1}
              onClick={() => !item.disabled && handleChange(item.id)}
              onKeyDown={e => handleItemKeyDown(e, index)}
              className="ai-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: thumbnailSize,
                height: thumbnailSize,
                padding: 0,
                overflow: 'hidden',
                flexShrink: 0,
                borderRadius: 'var(--ai-tab-border-radius, var(--ai-radius-md, 0.375rem))',
                border: isActive
                  ? `0.125rem solid var(--ai-tab-active-color, var(--ai-color-primary, #3b82f6))`
                  : '0.0625rem solid var(--ai-border, #d1d5db)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                transition: 'var(--ai-transition-fast, all 0.15s ease)',
                ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
              }}
            >
              {item.content}
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scrollBy(180)}
          aria-label="Scroll filmstrip right"
          className="ai-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.05)',
            flexShrink: 0,
            zIndex: 2,
            ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
          }}
        >
          ▶
        </button>
      )}
    </div>
  );
};
