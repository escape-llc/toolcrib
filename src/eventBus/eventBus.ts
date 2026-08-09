/**
 * Toolcrib Strongly-Typed Event Bus
 * Facilitates cross-tree action dispatching without prop-drilling or component hierarchy restructuring.
 */
import { ThemeParameters, GeneratedPalette } from '../theme/harmonies';

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
  'slideout:shown': { id: string; position?: 'top' | 'right' | 'bottom' | 'left'; data?: any };
  'slideout:hidden': { id: string };
  'modal:shown': { id: string; data?: any };
  'modal:hidden': { id: string };
  'form:submitted': { formId?: string; values: Record<string, any> };
  'form:validated': { formId?: string; isValid: boolean };
  'form:errored': { formId?: string; errors: Record<string, string> };
  'toast:shown': { id: string; type: 'info' | 'success' | 'warning' | 'error'; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent' };
  'toast:added': { id: string; type: 'info' | 'success' | 'warning' | 'error'; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent' };
  'toast:expired': { id: string; message?: string; type?: string };
  'toast:dismissed': { id: string; message?: string; type?: string; reason?: 'user' | 'expired' | 'action' };
  'toast:action_clicked': { id: string; actionLabel: string; message?: string };
  'error:boundary': { componentName: string; error: string; stack?: string };
  'tooltip:shown': { id?: string; content: string };
  'tooltip:hidden': { id?: string };
  'accordion:opened': { id?: string; itemValue: string };
  'accordion:closed': { id?: string; itemValue: string };
  'menu:opened': { id?: string };
  'menu:closed': { id?: string };
  'menu:item_selected': { id?: string; itemValue: string };
  'select:changed': { name?: string; value: string };
  'slider:changed': { name?: string; value: number };
  'tab:changed': { activeId: string; previousId?: string };
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

class AIEventBus {
  private listeners: { [K in EventKey]?: Set<EventCallback<K>> } = {};

  /**
   * Subscribe to a strongly-typed event. Returns an unsubscribe function.
   */
  on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<EventCallback<K>>).add(callback);

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
   * Helper methods for AI convenience to trigger common global actions
   */
  openModal(id: string, data?: any) {
    this.emit('modal:shown', { id, data });
  }

  closeModal(id: string) {
    this.emit('modal:hidden', { id });
  }

  openSlideOut(id: string, position: 'top' | 'right' | 'bottom' | 'left' = 'right', data?: any) {
    this.emit('slideout:shown', { id, position, data });
  }

  closeSlideOut(id: string) {
    this.emit('slideout:hidden', { id });
  }

  /** @manifestReturns string (toast id) */
  showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.emit('toast:shown', { id, type, message, priority });
    return id;
  }
}

export const aiBus = new AIEventBus();
