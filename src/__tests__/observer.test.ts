import { describe, it, expect, vi } from 'vitest';
import { observerManager } from '../observer/observerManager';
import { aiBus } from '../eventBus/eventBus';

describe('GlobalObserverManager & Adaptive Sizing Engine', () => {
  it('registers elements with observerManager without crashing', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    expect(() => observerManager.observe(div)).not.toThrow();
    expect(() => observerManager.unobserve(div)).not.toThrow();

    document.body.removeChild(div);
  });

  it('dispatches element:resized events on aiBus', async () => {
    const listener = vi.fn();
    const unsubscribe = aiBus.on('element:resized', listener);

    const targetDiv = document.createElement('div');
    aiBus.emit('element:resized', {
      id: 'test-el',
      target: targetDiv,
      width: 500,
      height: 400,
      contentHeight: 1200,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-el',
        width: 500,
        height: 400,
        contentHeight: 1200,
      })
    );

    unsubscribe();
  });
});
