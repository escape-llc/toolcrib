import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Carousel } from '../components/Carousel/Carousel';
import { aiBus } from '../eventBus/eventBus';

// embla-carousel's real behavior (drag physics, loop index math, snap-point
// computation from measured slide widths) fundamentally depends on real
// layout -- jsdom reports 0 for every width/height, so the library can't
// produce meaningful snap points or scroll state here at all (confirmed
// directly: even a 3-slide, non-looping carousel collapsed to a single
// scroll snap under real jsdom measurement). That's exactly why the doc's
// own acceptance criterion for this component points at the e2e harness
// for drag/swipe/loop/resize correctness, not unit tests.
//
// What unit tests *can* verify, and should: that this wrapper calls the
// right embla API methods in response to the right UI interactions, wires
// its select/reInit subscriptions correctly, and emits the right toolcrib
// events -- i.e. this component's own logic, independent of embla's real
// measurement engine. Mocking the hook with a small controllable fake
// isolates exactly that.
const mocks = vi.hoisted(() => {
  const state = {
    selectedIndex: 0,
    canScrollPrev: false,
    canScrollNext: true,
    scrollSnaps: [0, 1, 2],
  };
  const listeners: Record<string, Array<() => void>> = {};
  const emit = (evt: string) => (listeners[evt] || []).forEach(cb => cb());

  const scrollTo = vi.fn((index: number) => {
    state.selectedIndex = index;
    state.canScrollPrev = index > 0;
    state.canScrollNext = index < state.scrollSnaps.length - 1;
    emit('select');
  });
  const scrollNext = vi.fn(() => scrollTo(Math.min(state.selectedIndex + 1, state.scrollSnaps.length - 1)));
  const scrollPrev = vi.fn(() => scrollTo(Math.max(state.selectedIndex - 1, 0)));

  const emblaApi = {
    selectedScrollSnap: () => state.selectedIndex,
    canScrollPrev: () => state.canScrollPrev,
    canScrollNext: () => state.canScrollNext,
    scrollSnapList: () => state.scrollSnaps,
    scrollNext,
    scrollPrev,
    scrollTo,
    on: (evt: string, cb: () => void) => {
      (listeners[evt] ||= []).push(cb);
    },
    off: (evt: string, cb: () => void) => {
      listeners[evt] = (listeners[evt] || []).filter(fn => fn !== cb);
    },
  };

  return { state, emblaApi, scrollTo, scrollNext, scrollPrev };
});

vi.mock('embla-carousel-react', () => ({
  default: () => [() => {}, mocks.emblaApi],
}));

describe('Carousel', () => {
  beforeEach(() => {
    mocks.state.selectedIndex = 0;
    mocks.state.canScrollPrev = false;
    mocks.state.canScrollNext = true;
    mocks.state.scrollSnaps = [0, 1, 2];
    mocks.scrollTo.mockClear();
    mocks.scrollNext.mockClear();
    mocks.scrollPrev.mockClear();
  });

  const slides = [
    { id: 's1', content: <span>Slide 1</span> },
    { id: 's2', content: <span>Slide 2</span> },
    { id: 's3', content: <span>Slide 3</span> },
  ];

  it('renders every slide\'s content', () => {
    render(<Carousel slides={slides} />);
    expect(screen.getByText('Slide 1')).toBeInTheDocument();
    expect(screen.getByText('Slide 2')).toBeInTheDocument();
    expect(screen.getByText('Slide 3')).toBeInTheDocument();
  });

  it('renders one dot per scroll snap, with the current one marked active', async () => {
    render(<Carousel slides={slides} />);
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));
    expect(screen.getByLabelText('Go to slide 1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Go to slide 2')).toHaveAttribute('aria-selected', 'false');
  });

  it('shows only the arrow(s) embla reports as scrollable (prev hidden at the start)', async () => {
    render(<Carousel slides={slides} />);
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));
    expect(screen.queryByLabelText('Previous slide')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Next slide')).toBeInTheDocument();
  });

  it('clicking the next arrow calls embla\'s scrollNext', async () => {
    render(<Carousel slides={slides} />);
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));

    fireEvent.click(screen.getByLabelText('Next slide'));
    expect(mocks.scrollNext).toHaveBeenCalledTimes(1);
  });

  it('clicking a dot calls embla\'s scrollTo with that index', async () => {
    render(<Carousel slides={slides} />);
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));

    fireEvent.click(screen.getByLabelText('Go to slide 3'));
    expect(mocks.scrollTo).toHaveBeenCalledWith(2);
  });

  it('reacts to embla\'s own "select" event: updates the active dot, calls onSlideChange, and emits carousel:changed', async () => {
    const onSlideChange = vi.fn();
    const changedFn = vi.fn();
    const unsub = aiBus.on('carousel:changed', changedFn);

    render(<Carousel id="test-carousel" slides={slides} onSlideChange={onSlideChange} />);
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));
    expect(changedFn).toHaveBeenCalledWith({ id: 'test-carousel', activeIndex: 0, previousIndex: undefined });

    fireEvent.click(screen.getByLabelText('Go to slide 2'));

    await waitFor(() => expect(screen.getByLabelText('Go to slide 2')).toHaveAttribute('aria-selected', 'true'));
    expect(onSlideChange).toHaveBeenCalledWith(1);
    expect(changedFn).toHaveBeenCalledWith({ id: 'test-carousel', activeIndex: 1, previousIndex: 0 });

    unsub();
  });

  it('advances automatically via embla\'s scrollNext when autoplay is set', async () => {
    vi.useFakeTimers();
    try {
      render(<Carousel slides={slides} autoplay={{ delayMs: 1000 }} />);
      await vi.waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));

      // The autoplay interval's callback calls the mocked scrollNext, which
      // synchronously emits 'select' -> Carousel's onSelect -> several real
      // setState calls — act() is what's needed around the fake-timer
      // advance itself, not just an await afterward, since nothing else
      // here is wrapping those updates.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mocks.scrollNext).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not autoplay when the prop is omitted', async () => {
    vi.useFakeTimers();
    try {
      render(<Carousel slides={slides} />);
      await vi.waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(3));

      vi.advanceTimersByTime(5000);
      expect(mocks.scrollNext).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
