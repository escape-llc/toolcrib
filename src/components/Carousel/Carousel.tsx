import React, { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { CarouselThemeSlice, type CarouselSliceState } from './CarouselSlice';

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
  const { vars } = useSliceOverrides(CarouselThemeSlice, overrides);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const previousIndexRef = useRef<number | undefined>(undefined);

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

  return (
    <div style={{ position: 'relative', width: '100%', ...vars }}>
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
          aria-label="Previous slide"
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
          aria-label="Next slide"
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
          aria-label="Slides"
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
              type="button"
              role="tab"
              aria-selected={index === selectedIndex}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => emblaApi?.scrollTo(index)}
              className="ai-btn"
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
