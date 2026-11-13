import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slider } from '../components/Form/Slider';
import { RangeSlider } from '../components/Form/RangeSlider';
import { SliderThemeSlice, defaultSliderState, getSliderVariables } from '../components/Form/SliderSlice';
import { getSparseVariables } from '../theme/slice';

// Detent ticks are a repeating-linear-gradient on the track (the element that
// carries the track-height variable); find it from the thumb.
const trackOf = (thumb: HTMLElement) => thumb.closest('[style*="--ai-slider-track-height"]') as HTMLElement;
const trackBackground = (container: HTMLElement) => {
  const el = Array.from(container.querySelectorAll<HTMLElement>('[style]'))
    .find(n => n.style.flexGrow === '1');
  return el?.style.backgroundImage ?? '';
};

describe('SliderSlice thumbShape and detents', () => {
  it('defaults are unchanged: round thumb, no detents', () => {
    const vars = getSliderVariables(defaultSliderState);
    expect(vars['--ai-slider-thumb-radius']).toBe('50%');
    expect(vars['--ai-slider-thumb-width']).toBe('1.125rem');
    expect(vars['--ai-slider-thumb-height']).toBe('1.125rem');
    expect(vars['--ai-slider-thumb-face']).toBe('var(--ai-bg-surface, #ffffff)');
    expect(vars['--ai-slider-detents']).toBe('transparent');
  });

  it('cap emits a narrower, taller thumb with a centre line in rem', () => {
    const vars = getSliderVariables({ ...defaultSliderState, thumbShape: 'cap' });
    expect(vars['--ai-slider-thumb-width']).toBe('calc(1.125rem * 0.6)');
    expect(vars['--ai-slider-thumb-height']).toBe('calc(1.125rem * 1.2)');
    expect(vars['--ai-slider-thumb-face']).toContain('0.125rem');
    expect(vars['--ai-slider-thumb-face-vertical']).toContain('0.125rem');
    expect(JSON.stringify(vars)).not.toMatch(/\d(px)\b/);
  });

  it('detents on emits a tick colour', () => {
    const vars = getSliderVariables({ ...defaultSliderState, detents: true });
    expect(vars['--ai-slider-detents']).toContain('color-mix');
  });

  it('a partial override emits only the variables its field owns', () => {
    const sparse = getSparseVariables(SliderThemeSlice, { detents: true });
    expect(Object.keys(sparse)).toEqual(['--ai-slider-detents']);
  });
});

describe('Slider / RangeSlider orientation', () => {
  it('Slider is horizontal by default', () => {
    render(<Slider name="v" aria-label="V" value={5} min={0} max={10} onChange={vi.fn()} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('a vertical Slider gets aria-orientation=vertical and swapped axes', () => {
    const { container } = render(<Slider name="v" aria-label="V" orientation="vertical" value={5} min={0} max={10} onChange={vi.fn()} />);
    const thumb = screen.getByRole('slider');
    expect(thumb).toHaveAttribute('aria-orientation', 'vertical');
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.height).toBe('100%');
    expect(root.style.width).toBe('');
    const track = trackOf(thumb);
    expect(track.style.width).toBe('var(--ai-slider-track-height, 0.375rem)');
    expect(track.style.height).toBe('');
  });

  it('a vertical RangeSlider gets aria-orientation=vertical on both thumbs and swapped axes', () => {
    const { container } = render(<RangeSlider name="r" aria-label="R" orientation="vertical" value={[2, 8]} min={0} max={10} onChange={vi.fn()} />);
    const thumbs = screen.getAllByRole('slider');
    expect(thumbs).toHaveLength(2);
    thumbs.forEach(t => expect(t).toHaveAttribute('aria-orientation', 'vertical'));
    const root = Array.from(container.querySelectorAll<HTMLElement>('[style]')).find(n => n.style.opacity === '1')!;
    expect(root.style.height).toBe('100%');
    expect(trackOf(thumbs[0]).style.width).toBe('var(--ai-slider-track-height, 0.375rem)');
  });

  it('a RangeSlider is horizontal by default', () => {
    render(<RangeSlider name="r" aria-label="R" value={[2, 8]} onChange={vi.fn()} />);
    screen.getAllByRole('slider').forEach(t => expect(t).toHaveAttribute('aria-orientation', 'horizontal'));
  });
});

describe('Slider detent ticks', () => {
  it('draw no ticks by default (detents off draws transparent ticks only when asked)', () => {
    const { container } = render(<Slider name="v" aria-label="V" value={2} min={0} max={10} step={1} onChange={vi.fn()} />);
    // The gradient is present for a small range, but its colour var is transparent unless detents is on.
    expect(container.firstElementChild).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--ai-slider-detents')).toBe('');
  });

  it('with detents on and at most 32 steps, the track carries the tick gradient', () => {
    const { container } = render(<Slider name="v" aria-label="V" value={2} min={0} max={10} step={1} overrides={{ detents: true }} onChange={vi.fn()} />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--ai-slider-detents')).toContain('color-mix');
    expect(trackBackground(container)).toContain('repeating-linear-gradient');
    expect(trackBackground(container)).toContain('0.0625rem');
  });

  it('draws none above 32 steps', () => {
    const { container } = render(<Slider name="v" aria-label="V" value={2} min={0} max={100} step={1} overrides={{ detents: true }} onChange={vi.fn()} />);
    expect(trackBackground(container)).toBe('none');
  });

  it('toggling detents on a live slider swaps the image without React style warnings', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const props = { name: 'v', 'aria-label': 'V', value: 2, min: 0, max: 10, step: 1, onChange: vi.fn() } as const;
    const { container, rerender } = render(<Slider {...props} overrides={{ detents: true }} />);
    expect(trackBackground(container)).toContain('repeating-linear-gradient');
    rerender(<Slider {...props} overrides={{ detents: false }} max={100} />);
    expect(trackBackground(container)).toBe('none');
    rerender(<Slider {...props} overrides={{ detents: true }} />);
    expect(trackBackground(container)).toContain('repeating-linear-gradient');
    expect(error.mock.calls.filter(c => String(c[0]).includes('style property'))).toEqual([]);
    error.mockRestore();
  });

  it('exactly 32 steps still draws; 33 does not', () => {
    const a = render(<Slider name="v" aria-label="V" value={2} min={0} max={32} step={1} overrides={{ detents: true }} onChange={vi.fn()} />);
    expect(trackBackground(a.container)).toContain('repeating-linear-gradient');
    a.unmount();
    const b = render(<Slider name="v" aria-label="V" value={2} min={0} max={33} step={1} overrides={{ detents: true }} onChange={vi.fn()} />);
    expect(trackBackground(b.container)).toBe('none');
  });

  it('a vertical slider ticks upward, and RangeSlider shares the behaviour', () => {
    const v = render(<Slider name="v" aria-label="V" orientation="vertical" value={2} min={0} max={10} overrides={{ detents: true }} onChange={vi.fn()} />);
    expect(trackBackground(v.container)).toContain('to top');
    v.unmount();
    const r = render(<RangeSlider name="r" aria-label="R" value={[2, 8]} min={0} max={10} overrides={{ detents: true }} onChange={vi.fn()} />);
    expect(trackBackground(r.container)).toContain('repeating-linear-gradient');
  });
});
