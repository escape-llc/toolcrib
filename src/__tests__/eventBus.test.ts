import { describe, it, expect, vi } from 'vitest';
import { aiBus } from '../eventBus/eventBus';

describe('Strongly-Typed EventBus', () => {
  it('subscribes and emits typed events', () => {
    const callback = vi.fn();
    const unsubscribe = aiBus.on('modal:shown', callback);

    aiBus.emit('modal:shown', { id: 'test-modal', data: { foo: 'bar' } });
    expect(callback).toHaveBeenCalledWith({ id: 'test-modal', data: { foo: 'bar' } });

    unsubscribe();
    aiBus.emit('modal:shown', { id: 'test-modal' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles wildcard listener subscriptions (*)', () => {
    const wildcardCallback = vi.fn();
    const unsubscribe = aiBus.on('*' as any, wildcardCallback);

    aiBus.emit('form:validated', { formId: 'demo-form', isValid: true });
    expect(wildcardCallback).toHaveBeenCalledWith({
      type: 'form:validated',
      detail: { formId: 'demo-form', isValid: true },
    });

    unsubscribe();
  });

  it('provides convenience trigger helpers', () => {
    const callback = vi.fn();
    aiBus.on('toast:shown', callback);

    aiBus.showToast('Test Toast', 'success');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Test Toast',
      type: 'success',
    }));
  });

  it('provides openPopup/closePopup helpers, matching the openModal/closeModal and openSlideOut/closeSlideOut pattern', () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    aiBus.on('popup:shown', shown);
    aiBus.on('popup:hidden', hidden);

    aiBus.openPopup('demo-popup', 'trigger-el', { foo: 'bar' });
    expect(shown).toHaveBeenCalledWith({ id: 'demo-popup', targetId: 'trigger-el', data: { foo: 'bar' } });

    aiBus.closePopup('demo-popup');
    expect(hidden).toHaveBeenCalledWith({ id: 'demo-popup' });
  });

  describe('sticky events', () => {
    it('replays the last value for a given id to a new subscriber', () => {
      aiBus.emit('tab:changed', { id: 'sticky-test-group', activeId: 'tab-1' });

      const callback = vi.fn();
      aiBus.on('tab:changed', callback);

      expect(callback).toHaveBeenCalledWith({ id: 'sticky-test-group', activeId: 'tab-1' });
    });

    it('clearSticky(event, id) evicts one id without affecting others (regression: unbounded sticky map)', () => {
      aiBus.emit('tab:changed', { id: 'sticky-clear-a', activeId: 'a1' });
      aiBus.emit('tab:changed', { id: 'sticky-clear-b', activeId: 'b1' });

      aiBus.clearSticky('tab:changed', 'sticky-clear-a');

      const callback = vi.fn();
      aiBus.on('tab:changed', callback);

      // Evicted id: no replay.
      expect(callback).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'sticky-clear-a' }));
      // Untouched id: still replays normally.
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'sticky-clear-b' }));
    });

    it('clearSticky(event) with no id clears every entry for that event', () => {
      aiBus.emit('tab:changed', { id: 'sticky-clear-all-1', activeId: 'x' });
      aiBus.emit('tab:changed', { id: 'sticky-clear-all-2', activeId: 'y' });

      aiBus.clearSticky('tab:changed');

      const callback = vi.fn();
      aiBus.on('tab:changed', callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('clearSticky is a no-op for an event/id with nothing stored', () => {
      expect(() => aiBus.clearSticky('tab:changed', 'never-emitted')).not.toThrow();
      expect(() => aiBus.clearSticky('modal:shown')).not.toThrow();
    });
  });
});
