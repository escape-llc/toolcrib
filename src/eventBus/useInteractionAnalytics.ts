'use client';

import { useEffect, useRef } from 'react';
import { aiBus, type EventKey } from './eventBus';

/**
 * Static identifier fields considered safe to report by default -- never a
 * real end-user value. `id`/`formId`/`name` cover the vast majority of
 * event payloads (every `*:shown`/`*:hidden`/`*:changed`/`*:opened`/
 * `*:closed` channel keys off one of these); `componentName` is
 * `error:boundary`'s own equivalent (see its own note below). Deliberately
 * a short, fixed allowlist rather than a per-event blocklist -- a blocklist
 * silently stops protecting anything the moment a new event with a new
 * sensitive field lands (`AIEventMap` has grown by a dozen-plus fields in a
 * matter of days at points in this project's history), while an allowlist
 * fails safe: an unrecognized field is simply never reported, not
 * accidentally leaked.
 *
 * This is also what keeps two categories safe without needing a special
 * case apiece: `element:resized`/`element:intersected`'s raw `target:
 * HTMLElement` and `error:boundary`'s own `error`/`stack` strings (which
 * can embed file paths or interpolated values) are excluded automatically
 * by not being on the list, the same as every other non-identifier field --
 * nothing here has to know either event exists.
 */
const DEFAULT_ALLOWED_FIELDS = ['id', 'formId', 'name', 'componentName'] as const;

/** @barrelExport */
export interface InteractionAnalyticsEvent {
  /** The event-bus channel name (e.g. `'form:submitted'`, `'toast:shown'`). */
  type: EventKey;
  /** Sanitized fields extracted from the event's real payload -- never the raw payload itself. */
  detail: Record<string, unknown>;
}

/**
 * Extracts whatever fields from a raw event-bus payload are safe to report.
 * Receives the channel name and its *unsanitized* payload -- returns
 * exactly what should be reported, so a custom sanitizer takes on full
 * responsibility for privacy rather than the default allowlist being
 * merged in underneath it.
 */
/** @barrelExport */
export type InteractionAnalyticsSanitizer = (type: EventKey, payload: unknown) => Record<string, unknown>;

/**
 * The default sanitizer: keeps only `DEFAULT_ALLOWED_FIELDS` (`id`,
 * `formId`, `name`, `componentName`), and only where the value is itself a
 * string -- never anything else from the payload. Exported so a custom
 * `sanitize` can call this first and layer a few more fields on top,
 * rather than having to reimplement the safe default from scratch.
 */
/** @barrelExport */
export function defaultInteractionAnalyticsSanitizer(_type: EventKey, payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== 'object') return {};
  const result: Record<string, unknown> = {};
  for (const field of DEFAULT_ALLOWED_FIELDS) {
    const value = (payload as Record<string, unknown>)[field];
    if (typeof value === 'string') {
      result[field] = value;
    }
  }
  return result;
}

/** @barrelExport */
export interface UseInteractionAnalyticsOptions {
  /**
   * Overrides the default allowlist sanitizer entirely -- receives the
   * channel name and its raw, unsanitized payload for every event-bus
   * channel, and must return whatever's safe to report. Supplying this
   * hands you full responsibility for privacy; call
   * `defaultInteractionAnalyticsSanitizer(type, payload)` yourself first if
   * you want the safe default plus a few more fields, rather than starting
   * from scratch.
   * @default defaultInteractionAnalyticsSanitizer
   */
  sanitize?: InteractionAnalyticsSanitizer;
}

/**
 * Reports every event-bus channel to `report`, sanitized first: event type
 * plus whatever fields `sanitize` says are safe (default: a fixed
 * identifier allowlist -- see `defaultInteractionAnalyticsSanitizer`).
 * `report`'s destination is always something *you* supply (your own
 * analytics SDK, a `fetch` call, `console.log`) -- toolcrib itself is never
 * in the loop, so there's no transmission-security question on this half
 * at all. Mount once, typically near the app root.
 *
 * @example
 * useInteractionAnalytics(event => myAnalytics.track(event.type, event.detail));
 *
 * @example
 * // Custom sanitizer, built on top of the safe default:
 * useInteractionAnalytics(
 *   event => myAnalytics.track(event.type, event.detail),
 *   { sanitize: (type, payload) => ({
 *       ...defaultInteractionAnalyticsSanitizer(type, payload),
 *       ...(type === 'datatable:sorted' ? { direction: (payload as any).direction } : {}),
 *     }) }
 * );
 */
/** @barrelExport */
export function useInteractionAnalytics(
  report: (event: InteractionAnalyticsEvent) => void,
  options?: UseInteractionAnalyticsOptions
): void {
  const savedReport = useRef(report);
  const savedSanitize = useRef<InteractionAnalyticsSanitizer>(options?.sanitize ?? defaultInteractionAnalyticsSanitizer);

  useEffect(() => {
    savedReport.current = report;
    savedSanitize.current = options?.sanitize ?? defaultInteractionAnalyticsSanitizer;
  }, [report, options?.sanitize]);

  useEffect(() => {
    const unsubscribe = aiBus.onAny(({ type, detail }) => {
      savedReport.current({ type, detail: savedSanitize.current(type, detail) });
    });
    return () => {
      unsubscribe();
    };
  }, []);
}
