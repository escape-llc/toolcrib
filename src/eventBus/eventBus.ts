/**
 * Toolcrib Strongly-Typed Event Bus
 * Facilitates cross-tree action dispatching without prop-drilling or component hierarchy restructuring.
 */
import { ThemeParameters, GeneratedPalette } from '../theme/harmonies';
import { SubthemeName } from '../theme/subtheme';

/** @barrelExport */
export interface AIEventMap {
  'theme:changed': {
    /** The full theme parameter state that produced this palette. */
    parameters: ThemeParameters;
    /** The generated HSV colour palette derived from the parameters. */
    palette: GeneratedPalette;
    /** The CSS custom properties map injected into `:root`. */
    cssVariables: Record<string, string>;
  };

  // Observer & Adaptive Sizing Events
  'element:resized': { id?: string; target: HTMLElement; width: number; height: number; contentHeight: number };
  'element:intersected': { id?: string; target: HTMLElement; isIntersecting: boolean; ratio: number };
  'viewport:resized': { width: number; height: number };
  'popup:shown': { id: string; targetId?: string; data?: any };
  'popup:hidden': { id: string };
  'drawer:shown': { id: string; position?: 'top' | 'right' | 'bottom' | 'left'; data?: any };
  'drawer:hidden': { id: string };
  'modal:shown': { id: string; data?: any };
  'modal:hidden': { id: string };
  'alertdialog:shown': { id: string; data?: any };
  'alertdialog:hidden': { id: string };
  'collapsible:opened': { id?: string };
  'collapsible:closed': { id?: string };
  'form:submitted': { formId?: string; values: Record<string, any> };
  'form:validated': { formId?: string; isValid: boolean };
  'form:errored': { formId?: string; errors: Record<string, string> };
  'toast:shown': { id: string; type: SubthemeName; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent' };
  'toast:added': { id: string; type: SubthemeName; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent' };
  'toast:expired': { id: string; message?: string; type?: string };
  'toast:dismissed': { id: string; message?: string; type?: string; reason?: 'user' | 'expired' | 'action' };
  'toast:action_clicked': { id: string; actionLabel: string; message?: string };
  'error:boundary': { componentName: string; error: string; stack?: string };
  'tooltip:shown': { id?: string; content: string };
  'tooltip:hidden': { id?: string };
  'hovercard:shown': { id?: string };
  'hovercard:hidden': { id?: string };
  'accordion:opened': { id?: string; itemValue: string };
  'accordion:closed': { id?: string; itemValue: string };
  'tree:expanded': { id?: string; itemId: string };
  'tree:collapsed': { id?: string; itemId: string };
  'menu:opened': { id?: string };
  'menu:closed': { id?: string };
  'menu:item_selected': { id?: string; itemValue: string };
  'select:changed': { name?: string; value: string };
  'combobox:changed': { name?: string; value: string | string[] };
  'fileupload:changed': { name?: string; fileCount: number };
  'slider:changed': { name?: string; value: number };
  'toggle:changed': { name?: string; pressed: boolean };
  'rating:changed': { name?: string; value: number };
  'datepicker:changed': { name?: string; value: string | null };
  'calendar:changed': { name?: string; value: string | null };
  'timefield:changed': { name?: string; value: string | null };
  'togglegroup:changed': { name?: string; value: string | string[] };
  'progress:changed': { id?: string; value: number; max: number };
  'tab:changed': { id?: string; activeId: string; previousId?: string };
  'stepper:changed': { id?: string; activeIndex: number; previousIndex?: number };
  'datatable:sorted': { id?: string; key: string | null; direction: 'asc' | 'desc' };
  'datatable:paginated': { id?: string; page: number; pageSize: number };
  'datatable:selection_changed': { id?: string; selectedKeys: string[] };
  'pagination:changed': { id?: string; page: number; pageSize: number };
  'datatable:row_clicked': { id?: string; index: number };
  'log:cleared': { timestamp: string };
  'layout:domain:created': { domainId: string; parentId: string; orientation: 'horizontal' | 'vertical' };
  'layout:corners:squared': {
    domainId: string;
    slot: 'first' | 'second';
    orientation: 'horizontal' | 'vertical';
    squaredCorners: {
      topLeft?: boolean;
      topRight?: boolean;
      bottomLeft?: boolean;
      bottomRight?: boolean;
    };
  };
}

export type EventKey = keyof AIEventMap;
export type EventCallback<K extends EventKey> = (event: AIEventMap[K]) => void;

/**
 * Events marked sticky replay their last-emitted payload(s) to a new
 * subscriber immediately upon `on()`, synchronously, before any future
 * event fires. This is for events broadcast from a component that may
 * mount/emit before an interested subscriber has attached — e.g.
 * `<TabStrip>` and `<TabStrip.Panel>` are independent, unrelated subtrees
 * with no DOM or effect-ordering guarantee between them, so a plain
 * pub/sub can permanently miss the initial broadcast depending on which
 * one happens to mount first. Designate an event sticky here, once, rather
 * than negotiating replay per subscription — the contract belongs to the
 * event, not to any particular publisher/subscriber pair.
 *
 * Replay is scoped per-entity: if the event payload has an `id` field
 * (most do — modal, popup, drawer, tab, toast, accordion, menu all key
 * off `id`), the last value is remembered separately for each `id`, and a
 * new subscriber is replayed the last value for *every* known `id`, same
 * as it would receive them as live events — its own filtering logic
 * (e.g. `event.id === groupId`) sorts out which one applies. Events
 * without an `id` field remember a single last value.
 */
const STICKY_EVENTS = new Set<EventKey>(['tab:changed']);

class AIEventBus {
  private listeners: { [K in EventKey]?: Set<EventCallback<K>> } = {};
  private stickyValues: { [K in EventKey]?: Map<string, AIEventMap[K]> } = {};

  private stickyDiscriminator<K extends EventKey>(payload: AIEventMap[K]): string {
    const id = (payload as any)?.id;
    return typeof id === 'string' ? id : '';
  }

  /**
   * Subscribe to a strongly-typed event. Returns an unsubscribe function.
   * For events in `STICKY_EVENTS`, immediately replays any already-known
   * last value(s) to `callback` before returning.
   */
  on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<EventCallback<K>>).add(callback);

    if (STICKY_EVENTS.has(event)) {
      const stored = this.stickyValues[event];
      if (stored) {
        stored.forEach(payload => callback(payload));
      }
    }

    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from a strongly-typed event.
   */
  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const set = this.listeners[event];
    if (set) {
      set.delete(callback as any);
    }
  }

  /**
   * Emit an event payload to all active subscribers.
   */
  emit<K extends EventKey>(event: K, payload: AIEventMap[K]): void {
    if (STICKY_EVENTS.has(event)) {
      if (!this.stickyValues[event]) {
        this.stickyValues[event] = new Map() as any;
      }
      (this.stickyValues[event] as Map<string, AIEventMap[K]>).set(this.stickyDiscriminator(payload), payload);
    }

    const set = this.listeners[event];
    if (set) {
      set.forEach(callback => {
        try {
          callback(payload);
        } catch (err) {
          console.error(`Error in AIEventBus subscriber for "${event}":`, err);
        }
      });
    }

    // Notify wildcard subscribers (e.g. for event monitoring)
    const wildcardSet = (this.listeners as any)['*'];
    if (wildcardSet) {
      wildcardSet.forEach((callback: any) => {
        try {
          callback({ type: event, detail: payload });
        } catch (err) {
          console.error(`Error in AIEventBus wildcard subscriber for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Remove a single sticky entry for `event`/`id` (or the whole event's
   * sticky map if `id` is omitted). `stickyValues` otherwise only ever
   * grows — every distinct id ever emitted for a sticky event stays
   * remembered for the app's lifetime, which is fine for statically-known,
   * finite ids but a real leak if an id is ever generated per dynamic
   * instance (e.g. one `<TabStrip>` per row in a list that gets created and
   * destroyed repeatedly). The component that owns the id is what knows
   * when it's genuinely done with it — this just gives it a way to say so
   * on unmount rather than the bus guessing.
   */
  clearSticky<K extends EventKey>(event: K, id?: string): void {
    const stored = this.stickyValues[event];
    if (!stored) return;
    if (id === undefined) {
      delete this.stickyValues[event];
    } else {
      stored.delete(id);
    }
  }

  /**
   * Helper methods for AI convenience to trigger common global actions
   */
  openModal(id: string, data?: any) {
    this.emit('modal:shown', { id, data });
  }

  closeModal(id: string) {
    this.emit('modal:hidden', { id });
  }

  openAlertDialog(id: string, data?: any) {
    this.emit('alertdialog:shown', { id, data });
  }

  closeAlertDialog(id: string) {
    this.emit('alertdialog:hidden', { id });
  }

  openDrawer(id: string, position: 'top' | 'right' | 'bottom' | 'left' = 'right', data?: any) {
    this.emit('drawer:shown', { id, position, data });
  }

  closeDrawer(id: string) {
    this.emit('drawer:hidden', { id });
  }

  openPopup(id: string, targetId?: string, data?: any) {
    this.emit('popup:shown', { id, targetId, data });
  }

  closePopup(id: string) {
    this.emit('popup:hidden', { id });
  }

  /** @manifestReturns string (toast id) */
  showToast(message: string, type: SubthemeName = 'info', priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.emit('toast:shown', { id, type, message, priority });
    return id;
  }
}

export const aiBus = new AIEventBus();
