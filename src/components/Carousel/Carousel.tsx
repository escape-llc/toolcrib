'use client';

import React, { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { VisuallyHidden } from '../Layout/VisuallyHidden';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { CarouselThemeSlice, type CarouselSliceState } from './CarouselSlice';
import { useLocaleStrings } from '../Locale/LocaleContext';

/** Data shape for each slide in a `<Carousel>`. */
export interface CarouselSlideItem {
  /** Unique identifier for this slide. */
  id: string;
  /** Slide content — any renderable element (an image, a card, arbitrary markup). */
  content: ReactNode;
}

/**
 * Props for the `<Carousel>` swipeable slide viewport.
 *
 * Wraps `embla-carousel-react`'s `useEmblaCarousel` hook — Embla owns the
 * drag/swipe/loop physics, this component owns the slide markup and theming.
 */
export interface CarouselProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of slides to render. */
  slides: CarouselSlideItem[];
  /**
   * Whether the carousel wraps from the last slide back to the first (and
   * vice versa) instead of stopping at the ends.
   * @default false
   */
  loop?: boolean;
  /** When provided, automatically advances to the next slide every `delayMs`. Omit for no autoplay. */
  autoplay?: { delayMs: number };
  /** Change callback fired whenever the active slide changes, from drag, arrow click, dot click, or autoplay. */
  onSlideChange?: (index: number) => void;
  /** Per-instance overrides for arrow size, dot size/colour, and slide gap. */
  overrides?: Partial<CarouselSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Swipeable slide carousel with drag/loop physics via embla-carousel-react, plus themed nav arrows and dot indicators
 * @manifestCategory Data Display
 * @manifestAntiPatternAvoid Hand-roll swipe/drag physics, loop index math, or a `setInterval`-only slideshow for a slide viewport
 * @manifestAntiPatternInstead Use `<Carousel>` — `embla-carousel-react` owns the drag/swipe/loop math; nav arrows and dot indicators are already themed and wired to it
 */
export const Carousel: React.FC<CarouselProps> = ({
  id: propId,
  slides,
  loop = false,
  autoplay,
  onSlideChange,
  overrides,
}) => {
  const id = useStableId(propId, 'carousel');
  const strings = useLocaleStrings().carousel;
  const { vars } = useSliceOverrides(CarouselThemeSlice, overrides);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const previousIndexRef = useRef<number | undefined>(undefined);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const nextIndex = emblaApi.selectedScrollSnap();
    setSelectedIndex(nextIndex);
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    if (nextIndex !== previousIndexRef.current) {
      onSlideChange?.(nextIndex);
      aiBus.emit('carousel:changed', { id, activeIndex: nextIndex, previousIndex: previousIndexRef.current });
      previousIndexRef.current = nextIndex;
    }
  }, [emblaApi, id, onSlideChange]);

  useEffect(() => {
    if (!emblaApi) return;
    // Resize can change how many snap points exist (e.g. a responsive
    // slidesToScroll) -- reInit fires after Embla recalculates, so the dot
    // list and canScroll flags stay correct instead of desyncing from
    // what's actually visible.
    const onReInit = () => {
      setScrollSnaps(emblaApi.scrollSnapList());
      onSelect();
    };
    // Legitimate "read an external system's current state once, then
    // subscribe for future changes" pattern (React's own docs explicitly
    // sanction this shape) -- emblaApi is Embla's own instance, not
    // something React renders, so its initial snap-list/selection can only
    // be read once this effect actually runs, not during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onReInit);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onReInit);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi || !autoplay) return;
    const interval = setInterval(() => emblaApi.scrollNext(), autoplay.delayMs);
    return () => clearInterval(interval);
  }, [emblaApi, autoplay]);

  // Hand-rolled roving tabindex + arrow-key nav for the dot tablist: unlike
  // TabStrip/Stepper (real Radix TabsPrimitive), the dots drive Embla's own
  // scroll-snap position rather than a Radix Tabs `value`/Content pairing,
  // so there's no primitive to inherit this from — the WAI-ARIA APG Tablist
  // pattern (one Tab stop, Left/Right/Home/End moves + activates) has to be
  // implemented directly, same as Tree's hand-rolled keydown handling.
  const onDotKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = scrollSnaps.length - 1;
      let nextIndex: number | undefined;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = index < lastIndex ? index + 1 : loop ? 0 : index;
          break;
        case 'ArrowLeft':
          nextIndex = index > 0 ? index - 1 : loop ? lastIndex : index;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = lastIndex;
          break;
        default:
          return;
      }
      event.preventDefault();
      if (nextIndex === index) return;
      emblaApi?.scrollTo(nextIndex);
      dotRefs.current[nextIndex]?.focus();
    },
    [emblaApi, loop, scrollSnaps.length]
  );

  return (
    <div style={{ position: 'relative', width: '100%', ...vars }}>
      {/* Autoplay/drag/dot-click all change the visible slide with no
          corresponding focus move -- this is the only announcement a
          screen-reader user gets that anything changed at all. */}
      <div aria-live="polite" aria-atomic="true">
        <VisuallyHidden>{strings.currentSlide(selectedIndex + 1, slides.length)}</VisuallyHidden>
      </div>
      <div ref={emblaRef} style={{ overflow: 'hidden', width: '100%' }}>
        <div style={{ display: 'flex', gap: 'var(--ai-carousel-slide-gap, 1rem)' }}>
          {slides.map(slide => (
            <div key={slide.id} style={{ flex: '0 0 100%', minWidth: 0 }}>
              {slide.content}
            </div>
          ))}
        </div>
      </div>

      {canScrollPrev && (
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label={strings.previousSlide}
          className="ai-btn"
          style={{
            position: 'absolute',
            top: '50%',
            left: '0.75rem',
            transform: 'translateY(-50%)',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--ai-carousel-arrow-size, 2.75rem)',
            height: 'var(--ai-carousel-arrow-size, 2.75rem)',
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

      {canScrollNext && (
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          aria-label={strings.nextSlide}
          className="ai-btn"
          style={{
            position: 'absolute',
            top: '50%',
            right: '0.75rem',
            transform: 'translateY(-50%)',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'var(--ai-carousel-arrow-size, 2.75rem)',
            height: 'var(--ai-carousel-arrow-size, 2.75rem)',
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

      {scrollSnaps.length > 1 && (
        <div
          role="tablist"
          aria-label={strings.slidesTablist}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '0.75rem',
          }}
        >
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              ref={el => {
                dotRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              tabIndex={index === selectedIndex ? 0 : -1}
              aria-selected={index === selectedIndex}
              aria-label={strings.goToSlide(index + 1)}
              onClick={() => emblaApi?.scrollTo(index)}
              onKeyDown={event => onDotKeyDown(event, index)}
              className="ai-btn ai-focus-ring"
              style={{
                width: 'var(--ai-carousel-dot-size, 0.5rem)',
                height: 'var(--ai-carousel-dot-size, 0.5rem)',
                padding: 0,
                borderRadius: '50%',
                border: 'none',
                background:
                  index === selectedIndex
                    ? 'var(--ai-carousel-dot-active-color, var(--ai-color-primary, #3b82f6))'
                    : 'var(--ai-border, #d1d5db)',
                cursor: 'pointer',
                ['--ai-btn-bg' as string]:
                  index === selectedIndex
                    ? 'var(--ai-carousel-dot-active-color, var(--ai-color-primary, #3b82f6))'
                    : 'var(--ai-border, #d1d5db)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
