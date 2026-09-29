'use client';

import React, { type ReactNode, useEffect, useRef } from 'react';
import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { AccordionThemeSlice, type AccordionSliceState } from './AccordionSlice';
import { useStableId } from '../shared/useStableId';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';

const ACCORDION_STYLE_ID = 'toolcrib-accordion-styles';

// Same rationale as Toast's injectToastAnimations(): the expand/collapse
// animation needs to play a *different* keyframe depending on the panel's
// state (Base UI: `[data-open]` while open, `[data-ending-style]` through
// the close, #702), which an inline `style.animation` can't
// express (its value doesn't change between renders just because a
// data-attribute did, so the browser never restarts it) — only a real
// stylesheet rule can react to the attribute change. This used to live
// only in the demo app's own index.css, which worked for the demo but left
// any other consumer with an Accordion whose content panel never actually
// animated (no @keyframes anywhere) and no hover/chevron-rotation styling
// either.
function injectAccordionStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    ACCORDION_STYLE_ID,
    `
    @keyframes ai-accordion-slide-down {
      from { height: 0; opacity: 0; transform: translateY(-0.25rem); }
      to { height: var(--accordion-panel-height); opacity: 1; transform: translateY(0); }
    }
    @keyframes ai-accordion-slide-up {
      from { height: var(--accordion-panel-height); opacity: 1; transform: translateY(0); }
      to { height: 0; opacity: 0; transform: translateY(-0.25rem); }
    }
    .ai-accordion-content {
      overflow: hidden;
    }
    .ai-accordion-content[data-open] {
      animation: var(--ai-accordion-animation, ai-accordion-slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1));
    }
    .ai-accordion-content[data-ending-style] {
      animation: var(--ai-accordion-close-animation, ai-accordion-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1));
    }
    .ai-accordion-trigger:hover {
      background: var(--ai-bg-surface, #ffffff) !important;
      color: var(--ai-color-primary, #3b82f6) !important;
    }
    .ai-accordion-chevron {
      transition: transform var(--ai-transition-duration-normal, 0.22s) var(--ai-transition-easing, cubic-bezier(0.16, 1, 0.3, 1));
      display: inline-block;
    }
    .ai-accordion-trigger[data-panel-open] .ai-accordion-chevron {
      transform: rotate(180deg);
      color: var(--ai-color-primary, #3b82f6);
    }
    `,
    targetDocument,
    nonce
  );
}

/** Data shape for each item in a data-driven `<Accordion>`. */
export interface AccordionItemData {
  /** Unique string key identifying this item (used for expand/collapse tracking). */
  value: string;
  /** Content rendered in the clickable header trigger. */
  title: ReactNode;
  /** Content rendered in the collapsible body panel. */
  content: ReactNode;
  /** If true, the item cannot be expanded or collapsed. */
  disabled?: boolean;
}

/**
 * Props for the `<Accordion>` collapsible panel group.
 *
 * Data-driven: pass an `items` array and the component renders all panels.
 * Emits `accordion:opened` / `accordion:closed` events on the event bus.
 */
export interface AccordionProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of items to render as accordion panels. */
  items: AccordionItemData[];
  /**
   * `'single'` allows only one panel open at a time. `'multiple'` allows any combination.
   * @default 'single'
   */
  type?: 'single' | 'multiple';
  /** Value of the initially expanded panel (for `type='single'`). */
  defaultValue?: string;
  /** Per-instance overrides for header padding, item gap, variant, and panel animation. */
  overrides?: Partial<AccordionSliceState>;
}

/**
 * @manifest Data-driven collapsible panel group with animations
 * @manifestConstraints For a long list of many items, wrap each item's `content` value in `<DeferredContent estimatedHeight={...}>` to defer off-screen ones (each item is content-sized, not flex-fill, so this is safe)
 * @manifestCategory Data Display
 */
export const Accordion: React.FC<AccordionProps> = ({
  id: propId,
  items,
  type = 'single',
  defaultValue,
  overrides,
}) => {
  const id = useStableId(propId, 'accordion');
  const { vars } = useSliceOverrides(AccordionThemeSlice, overrides);
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectAccordionStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);

  // Tracks which item values are currently open so onValueChange can emit
  // one accordion:opened/closed per item that actually changed state —
  // onValueChange only reports the new open values, not a diff, so it
  // can't tell which item closed when switching between single-mode panels
  // or toggling one item in multi-mode while others stay open.
  const previousOpenRef = useRef<Set<string>>(new Set(defaultValue ? [defaultValue] : []));

  return (
    <BaseAccordion.Root
      multiple={type === 'multiple'}
      defaultValue={defaultValue ? [defaultValue] : undefined}
      onValueChange={(val) => {
        const nextOpen = new Set<string>(val as string[]);
        const previousOpen = previousOpenRef.current;

        for (const itemValue of nextOpen) {
          if (!previousOpen.has(itemValue)) {
            aiBus.emit('accordion:opened', { id, itemValue });
          }
        }
        for (const itemValue of previousOpen) {
          if (!nextOpen.has(itemValue)) {
            aiBus.emit('accordion:closed', { id, itemValue });
          }
        }

        previousOpenRef.current = nextOpen;
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ai-accordion-item-gap, 0.375rem)',
        width: '100%',
        ...vars,
      }}
    >
      {items.map((item) => (
        <BaseAccordion.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          style={{
            borderRadius: 'var(--ai-accordion-border-radius, var(--ai-radius-md, 0.375rem))',
            border: 'var(--ai-accordion-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
            background: 'var(--ai-bg-surface, #ffffff)',
            overflow: 'hidden',
          }}
        >
          <BaseAccordion.Header style={{ margin: 0 }}>
            <BaseAccordion.Trigger
              className="ai-accordion-trigger"
              style={{
                all: 'unset',
                width: '100%',
                boxSizing: 'border-box',
                padding: 'var(--ai-accordion-header-padding, 0.875rem 1.125rem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 'var(--ai-font-weight-semibold, 600)',
                fontSize: '0.9rem',
                color: 'var(--ai-text-primary, #111827)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                background: 'var(--ai-bg-container, #f9fafb)',
                transition: 'background var(--ai-transition-duration-fast, 0.15s) var(--ai-transition-easing, ease), color var(--ai-transition-duration-fast, 0.15s) var(--ai-transition-easing, ease)',
              }}
            >
              <span>{item.title}</span>
              <span className="ai-accordion-chevron" style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)' }}>▼</span>
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>

          <BaseAccordion.Panel
            className="ai-accordion-content"
            data-testid={`accordion-content-${item.value}`}
            style={{
              // No padding/border/font styling here — this is the element
              // whose `height` the injected keyframes above actually
              // animate, and CSS floors a box's rendered height at its own
              // padding+border sum regardless of box-sizing (the spec-
              // defined "used height" clamp). With padding living here,
              // the close animation visibly stalled at ~33px (its own
              // padding+border-top) for the remainder of its 200ms
              // duration, then snapped to a true 0 only when the node was
              // unmounted on animationend — a discrete,
              // non-animated jump, not part of the animation at all.
              // Confirmed via a real per-frame height trace, not just
              // reasoning about the CSS. Moving padding/border to the
              // inner div below means THIS element has none of its own,
              // so height:0 has no floor to stall on — it reaches a true
              // 0 smoothly, by the time the animation itself ends.
              // Isolates each panel's content reflow from its sibling
              // panels during expand/collapse. Not `size` (that axis is
              // left alone), so the height-driving CSS var/animation for
              // this panel is unaffected.
              contain: 'content',
            }}
          >
            <div
              style={{
                padding: 'var(--ai-padding-xl, 1rem 1.125rem)',
                fontSize: '0.875rem',
                color: 'var(--ai-text-primary, #111827)',
                borderTop: '0.0625rem solid var(--ai-border, #e5e7eb)',
              }}
            >
              {item.content}
            </div>
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
};
