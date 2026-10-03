import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Presence } from '../components/shared/Presence';

// toolcrib's own Presence (#703). jsdom
// runs no animations and has no Element.getAnimations, so the exit path is
// driven by a stubbed getAnimations whose `finished` promise the test settles.
const anim = (finished: Promise<void>, endTime = 200, playState = 'running') =>
  ({ finished, playState, effect: { getComputedTiming: () => ({ endTime }) } }) as unknown as Animation;
describe('Presence', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
  });

  it('mounts its child while present and unmounts it at once when nothing is animating', () => {
    const { rerender } = render(<Presence present><div data-testid="child" /></Presence>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    rerender(<Presence present={false}><div data-testid="child" /></Presence>);
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('renders nothing while not present, and mounts in the same commit it becomes present', () => {
    const { rerender } = render(<Presence present={false}><div data-testid="child" /></Presence>);
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    rerender(<Presence present><div data-testid="child" /></Presence>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('keeps the child mounted through a running exit animation, then unmounts it', async () => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const getAnimations = vi.fn(() => [anim(finished)]);
    const { rerender } = render(<Presence present><div data-testid="child" /></Presence>);
    (HTMLElement.prototype as { getAnimations?: () => Animation[] }).getAnimations = getAnimations;

    rerender(<Presence present={false}><div data-testid="child" /></Presence>);
    expect(getAnimations).toHaveBeenCalled();
    expect(screen.getByTestId('child')).toBeInTheDocument();

    await act(async () => {
      finish();
      await finished;
    });
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('stays mounted when present turns back on before the exit animation ends', async () => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const { rerender } = render(<Presence present><div data-testid="child" /></Presence>);
    (HTMLElement.prototype as { getAnimations?: () => Animation[] }).getAnimations = () => [anim(finished)];

    rerender(<Presence present={false}><div data-testid="child" /></Presence>);
    rerender(<Presence present><div data-testid="child" /></Presence>);
    await act(async () => {
      finish();
      await finished;
    });
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  // Gemini on #721: waiting on every animation meant an element with an
  // infinite (or paused) animation of its own never unmounted.
  it('does not wait on an infinite or paused animation', () => {
    const never = new Promise<void>(() => {});
    const { rerender } = render(<Presence present><div data-testid="child" /></Presence>);
    (HTMLElement.prototype as { getAnimations?: () => Animation[] }).getAnimations = () => [anim(never, Infinity), anim(never, 200, 'paused')];
    rerender(<Presence present={false}><div data-testid="child" /></Presence>);
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });
});
