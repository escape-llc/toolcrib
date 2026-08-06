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
});
