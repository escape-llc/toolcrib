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

  it('handles wildcard listener subscriptions via onAny', () => {
    const wildcardCallback = vi.fn();
    const unsubscribe = aiBus.onAny(wildcardCallback);

    aiBus.emit('form:validated', { formId: 'demo-form', isValid: true });
    expect(wildcardCallback).toHaveBeenCalledWith({
      type: 'form:validated',
      detail: { formId: 'demo-form', isValid: true },
    });

    unsubscribe();
    aiBus.emit('form:validated', { formId: 'demo-form', isValid: false });
    expect(wildcardCallback).toHaveBeenCalledTimes(1);
  });

  it('onAny sees every channel, not just one -- and a regular on() subscriber is unaffected by it', () => {
    const wildcardCallback = vi.fn();
    const typedCallback = vi.fn();
    const unsubscribeAny = aiBus.onAny(wildcardCallback);
    aiBus.on('modal:shown', typedCallback);

    aiBus.emit('modal:shown', { id: 'onany-test-modal' });
    aiBus.emit('drawer:shown', { id: 'onany-test-drawer' });

    expect(wildcardCallback).toHaveBeenCalledWith({ type: 'modal:shown', detail: { id: 'onany-test-modal' } });
    expect(wildcardCallback).toHaveBeenCalledWith({ type: 'drawer:shown', detail: { id: 'onany-test-drawer' } });
    expect(typedCallback).toHaveBeenCalledTimes(1);
    expect(typedCallback).toHaveBeenCalledWith({ id: 'onany-test-modal' });

    unsubscribeAny();
  });

  // `on('*' as any, cb)` (the old, internal-only way to reach the
  // wildcard stream before onAny existed) is deliberately NOT supported
  // any more, and deliberately not tested as a regression to guard --
  // see AGENTS.md's "Backward compatibility for existing consumer call
  // sites is not a goal" note. A prior version of this PR added on()/
  // off() routing to keep it working after a Gemini review flagged the
  // removal as a breaking change; the maintainer overturned that call.

  it('provides convenience trigger helpers', () => {
    const callback = vi.fn();
    aiBus.on('toast:shown', callback);

    aiBus.showToast('Test Toast', 'success');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Test Toast',
      type: 'success',
    }));
  });

  it('provides openPopup/closePopup helpers, matching the openModal/closeModal and openDrawer/closeDrawer pattern', () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    aiBus.on('popup:shown', shown);
    aiBus.on('popup:hidden', hidden);

    aiBus.openPopup('demo-popup', 'trigger-el', { foo: 'bar' });
    expect(shown).toHaveBeenCalledWith({ id: 'demo-popup', targetId: 'trigger-el', data: { foo: 'bar' } });

    aiBus.closePopup('demo-popup');
    expect(hidden).toHaveBeenCalledWith({ id: 'demo-popup' });
  });

  it('provides a requireAuth helper emitting auth:unauthorized', () => {
    const callback = vi.fn();
    aiBus.on('auth:unauthorized', callback);

    aiBus.requireAuth('token-expired');
    expect(callback).toHaveBeenCalledWith({ reason: 'token-expired' });
  });

  // The eight helpers below had zero direct test coverage before this pass
  // -- eventBusTraffic.test.tsx tests the other direction (a real component
  // emits correctly), not that aiBus's own convenience wrappers still emit
  // what they claim to. This is the exact "a hand-rolled substitute for the
  // event bus drifted out of sync with itself, with nothing enforcing it"
  // failure mode every competitor's own reinvented version hit (see
  // .plans/head2head/*.md) -- applied here to Toolcrib's own real bus,
  // not a hypothetical.

  it('provides openModal/closeModal helpers, matching the openPopup/closePopup pattern', () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    aiBus.on('modal:shown', shown);
    aiBus.on('modal:hidden', hidden);

    aiBus.openModal('demo-modal', { foo: 'bar' });
    expect(shown).toHaveBeenCalledWith({ id: 'demo-modal', data: { foo: 'bar' } });

    aiBus.closeModal('demo-modal');
    expect(hidden).toHaveBeenCalledWith({ id: 'demo-modal' });
  });

  it('provides openAlertDialog/closeAlertDialog helpers', () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    aiBus.on('alertdialog:shown', shown);
    aiBus.on('alertdialog:hidden', hidden);

    aiBus.openAlertDialog('confirm-delete', { recordId: 42 });
    expect(shown).toHaveBeenCalledWith({ id: 'confirm-delete', data: { recordId: 42 } });

    aiBus.closeAlertDialog('confirm-delete');
    expect(hidden).toHaveBeenCalledWith({ id: 'confirm-delete' });
  });

  it('provides openDrawer/closeDrawer helpers, defaulting position to "right"', () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    aiBus.on('drawer:shown', shown);
    aiBus.on('drawer:hidden', hidden);

    aiBus.openDrawer('demo-drawer');
    expect(shown).toHaveBeenCalledWith({ id: 'demo-drawer', position: 'right', data: undefined });

    aiBus.openDrawer('demo-drawer-left', 'left', { foo: 'bar' });
    expect(shown).toHaveBeenCalledWith({ id: 'demo-drawer-left', position: 'left', data: { foo: 'bar' } });

    aiBus.closeDrawer('demo-drawer');
    expect(hidden).toHaveBeenCalledWith({ id: 'demo-drawer' });
  });

  it('provides an openCommandPalette helper, with id optional', () => {
    const callback = vi.fn();
    aiBus.on('commandpalette:open', callback);

    aiBus.openCommandPalette('global-palette');
    expect(callback).toHaveBeenCalledWith({ id: 'global-palette' });

    aiBus.openCommandPalette();
    expect(callback).toHaveBeenCalledWith({ id: undefined });
  });

  it('provides a navigate helper emitting route:navigate', () => {
    const callback = vi.fn();
    aiBus.on('route:navigate', callback);

    aiBus.navigate('/settings');
    expect(callback).toHaveBeenCalledWith({ to: '/settings' });
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

    it('the real, current sticky event (tab:changed) never triggers the missing-id warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      aiBus.emit('tab:changed', { id: 'warn-control-check', activeId: 'a' });
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('warns (dev-only, once per event key) if a sticky event is emitted without a string id -- the exact drift a future sticky event could introduce with nothing else catching it', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // stickyDiscriminator is private -- reached directly here because the
      // one real sticky event today (tab:changed) always has an id, so this
      // exact branch can't be reached through the public on()/emit() API
      // without a real id-less sticky event existing yet. Testing the
      // method's own logic directly is the honest alternative to not
      // testing this defensive path at all.
      const bus = aiBus as unknown as { stickyDiscriminator<K extends string>(event: K, payload: unknown): string };

      const result = bus.stickyDiscriminator('tab:changed', { activeId: 'no-id-here' });
      expect(result).toBe('');
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain('tab:changed');

      // Deduped: a second missing-id payload for the same event key doesn't
      // warn again, so a real app hitting this repeatedly doesn't spam.
      bus.stickyDiscriminator('tab:changed', { activeId: 'still-no-id' });
      expect(warnSpy).toHaveBeenCalledOnce();

      warnSpy.mockRestore();
    });
  });
});
