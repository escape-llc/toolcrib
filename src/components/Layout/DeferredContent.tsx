import React, { type ReactNode, useEffect, useRef } from 'react';
import { type StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';

/** @barrelExport */
export interface ContentVisibilityState {
  /** True when the browser just stopped rendering this content (off-screen); false when it just resumed. */
  skipped: boolean;
}

/**
 * Props for `<DeferredContent>`.
 *
 * Wraps a scoped `HTMLElement.addEventListener('contentvisibilityautostatechange', ...)`
 * subscription, not `aiBus` — this is a rendering-pipeline detail (did the
 * browser decide to skip painting this), not application state, and the
 * event bus already exposes viewport-intersection as an app-level concern
 * via `element:intersected` (`observerManager`/`useAdaptiveSize`) for
 * anything that actually needs to react to visibility.
 */
export interface DeferredContentProps extends StyleFreeAttributes<HTMLDivElement> {
  /** Content to defer rendering of while off-screen. */
  children: ReactNode;
  /**
   * Estimated height in pixels to reserve while this content's real size is
   * unknown — before it's ever been rendered, or while the browser is
   * currently skipping it. Only needs to be roughly right: browsers
   * remember the actual last-rendered height and reuse it for every future
   * skip (that's what the native `auto` keyword this component always
   * passes to `contain-intrinsic-height` does), so a wrong guess here only
   * costs one approximate layout, on this element's very first render.
   */
  estimatedHeight: number;
  /**
   * Called when this content's rendering is skipped or resumed by the
   * browser — e.g. to pause/resume an expensive child (a video, a live
   * chart, a canvas animation) while it's off-screen. Optional: most
   * children don't do continuous work and don't need this.
   */
  onVisibilityChange?: (state: ContentVisibilityState) => void;
}

/**
 * @manifest Defers layout/paint of off-screen content via native content-visibility, for long lists/grids of many repeated items (e.g. many <Card>s, a long <Accordion>) — not for flex `1 1 0px` fill panels like Splitter.Panel/TabStrip.Panel, which are already always-visible and get no benefit from this
 * @manifestCategory Containers
 */
export const DeferredContent: React.FC<DeferredContentProps> = ({
  children,
  estimatedHeight,
  onVisibilityChange,
  ...props
}) => {
  warnIfLegacyStyleProps(props, 'DeferredContent');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onVisibilityChange) return;

    const handler = (e: Event) => {
      onVisibilityChange({ skipped: (e as Event & { skipped: boolean }).skipped });
    };

    el.addEventListener('contentvisibilityautostatechange', handler);
    return () => el.removeEventListener('contentvisibilityautostatechange', handler);
  }, [onVisibilityChange]);

  return (
    <div
      ref={ref}
      {...props}
      style={{
        contentVisibility: 'auto',
        // Longhand, not the `contain-intrinsic-size` shorthand: a single
        // shorthand value applies to *both* width and height, which would
        // wrongly constrain this element's width too. Width already sizes
        // normally (a block element fills its container's width regardless
        // of whether its content is currently being skipped) — only height
        // needs a stand-in while the real content isn't being measured.
        containIntrinsicHeight: `auto ${estimatedHeight}px`,
      }}
    >
      {children}
    </div>
  );
};
