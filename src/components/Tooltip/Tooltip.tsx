import React, { ReactNode, ReactElement, useState, useEffect } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { TooltipThemeSlice, TooltipSliceState } from './TooltipSlice';

const TOOLTIP_STYLE_ID = 'toolcrib-tooltip-animations';

// Radix's Tooltip.Content carries data-state="delayed-open" | "instant-open"
// (the two ways it can become visible — after the hover delay, or instantly
// via keyboard focus / a rapid re-hover within skipDelayDuration) or
// "closed". A real stylesheet, not a static inline `animation` string, is
// what lets the SAME persisting DOM node (Presence keeps Content mounted
// through its own close animation, unlike Toast — see that component's own
// comment on the one case where an ancestor removing it defeats this) play
// a genuinely different animation on the way in vs. the way out: an inline
// value that doesn't change between renders never restarts, so a static
// `animation: ai-fade-in` would only ever play once. Reuses the same
// shared ai-fade-in/ai-fade-out keyframes Modal's overlay uses — no new
// keyframes needed for a plain fade.
function injectTooltipAnimations(targetDocument?: Document): void {
  injectGlobalStyle(
    TOOLTIP_STYLE_ID,
    `
    .ai-tooltip-content[data-state="delayed-open"],
    .ai-tooltip-content[data-state="instant-open"] {
      animation: ai-fade-in var(--ai-transition-duration-fast, 120ms) var(--ai-transition-easing, ease);
    }
    .ai-tooltip-content[data-state="closed"] {
      animation: ai-fade-out var(--ai-transition-duration-fast, 120ms) var(--ai-transition-easing, ease) forwards;
    }
    `,
    targetDocument
  );
}

/**
 * Props for the `<Tooltip>` hover/focus information overlay.
 *
 * Wraps the `children` element and shows a tooltip on hover/focus.
 * Emits `tooltip:shown` / `tooltip:hidden` events on the event bus.
 */
export interface TooltipProps {
  /** Unique identifier for event bus targeting. */
  id?: string;
  /** Text or ReactNode rendered inside the tooltip bubble. */
  content: ReactNode;
  /**
   * The element that triggers the tooltip on hover/focus. A single element
   * (not text or a Fragment) — passed straight through to Radix's own
   * `asChild` with no wrapper of its own (see this component's own comment
   * on why), which requires exactly one ref-forwarding element to clone.
   * Every toolkit component (`Button`, `Input`, ...) already forwards refs;
   * a plain DOM element (`<span>`, `<div>`) always does too.
   */
  children: ReactElement;
  /**
   * Which side of the trigger the tooltip appears on.
   * @default 'top'
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Alignment along the tooltip's side axis.
   * @default 'center'
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Delay in milliseconds before the tooltip appears on hover.
   * @default 200
   */
  delayDuration?: number;
  /** Per-instance overrides for theme (dark/light/accent) and size. */
  overrides?: Partial<TooltipSliceState>;
}

/**
 * @manifest Hover/focus tooltip wrapping a child trigger element
 * @manifestCategory Overlays
 */
export const Tooltip: React.FC<TooltipProps> = ({
  id,
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  overrides,
}) => {
  const { vars } = useSliceOverrides(TooltipThemeSlice, overrides);
  const [isOpen, setIsOpen] = useState(false);
  const targetDocument = useTargetDocument();
  useEffect(() => {
    injectTooltipAnimations(targetDocument);
  }, [targetDocument]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      aiBus.emit('tooltip:shown', { id, content: String(content) });
    } else {
      aiBus.emit('tooltip:hidden', { id });
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={0}>
      <TooltipPrimitive.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        disableHoverableContent={true}
      >
        {/* No wrapper <span> — children passed straight through asChild.
            The previous version wrapped children in its own span (matching
            Modal/Popup/Drawer's own trigger-wrapper pattern) specifically
            to be a stretch-to-fill flex container for a height-constrained
            child; asChild removes the need for that entirely by making the
            child itself the *actual* rendered trigger element, with no
            extra DOM layer for a parent's `alignItems: 'stretch'` (a
            <UIGroup>, a taller sibling in a row) to reach through in the
            first place. That extra layer was also the reason a <UIGroup>
            wrapping a Tooltip-wrapped Button couldn't corner-square it:
            UIGroup's own CSS only reaches *direct* children, and the span
            — not the Button — was the one actually sitting there. Gone now,
            so both problems disappear at the root instead of needing a
            workaround (e.g. an explicit `squareCorners` prop) per instance. */}
        <TooltipPrimitive.Trigger
          asChild
          onClick={() => setIsOpen(false)}
          onPointerDown={() => setIsOpen(false)}
        >
          {children}
        </TooltipPrimitive.Trigger>

        <TooltipPrimitive.Portal container={targetDocument?.body}>
          {/* className, not an inline `animation` string — this component
              used to set `animation: 'ai-popup-fade 0.12s ease-out'`
              directly, a keyframe name never defined anywhere in the
              codebase, so Presence's wait-for-animationend never resolved
              and the content stayed mounted and fully visible forever
              (confirmed via a real browser run: animationstart/
              animationend/animationcancel listeners, computed-style
              inspection). Left off entirely after that fix — but an
              instant show/hide isn't the goal either, just the safe
              fallback; injectTooltipAnimations above is what now supplies
              a real, data-state-conditioned animation (see its own
              comment for why an inline string can't express "different
              animation on the way in vs. out" for a node that persists
              across the state change, unlike a freshly-mounted one). */}
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={5}
            className="ai-tooltip-content"
            style={{
              zIndex: Z_INDEX.TOOLTIP,
              // No maxWidth previously — a long `content` string (a full
              // sentence of help text, not just a short label) rendered as
              // one extremely wide, un-wrapped line instead of a normal
              // multi-line tooltip bubble, reported directly. Matches
              // Modal's own `maxWidth: '90vw'` in being a plain layout
              // constant rather than a theme color/spacing token.
              maxWidth: '20rem',
              padding: 'var(--ai-tooltip-padding, 0.375rem 0.75rem)',
              fontSize: 'var(--ai-tooltip-font-size, 0.75rem)',
              fontWeight: 'var(--ai-font-weight-semibold, 600)',
              borderRadius: 'var(--ai-tooltip-border-radius, var(--ai-radius-md, 0.375rem))',
              background: 'var(--ai-tooltip-bg, var(--ai-text-primary, #111827))',
              color: 'var(--ai-tooltip-color, var(--ai-bg-surface, #ffffff))',
              boxShadow: '0 0.25rem 0.75rem rgba(0,0,0,0.15)',
              userSelect: 'none',
              pointerEvents: 'none',
              // Verified empirically (Playwright screenshot test) before
              // applying here: `contain: paint` does not clip a descendant
              // — like `TooltipPrimitive.Arrow` below, positioned to poke
              // past this box's edge — as long as `overflow` stays
              // `visible` (the default, and what this element uses). It
              // only clips when `overflow` is already non-`visible`.
              contain: 'content',
              ...vars,
            }}
          >
            {content}
            <TooltipPrimitive.Arrow style={{ fill: 'var(--ai-text-primary, #111827)' }} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};
