import { createContext, useContext, useState, type ReactNode } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button, Tooltip, aiBus, useAnyAIEvent } from '#toolcrib';

// The live aiBus monitor's state, in its own provider rather than App's own
// state. Found for real in issue #624: once the Encyclopedia mounted every
// component demo at once, App owning the log meant EVERY bus event -- the
// burst of element:resized on load, each carousel tick, every hover and
// click -- re-rendered all ~70 demos, enough to push WebKit's CI e2e run
// from ~6 to 22 minutes and into timeouts. Here, a new event re-renders
// only this provider and its context consumers (the list and its two
// toolbar buttons); the page it wraps is passed in as `children`, which
// React leaves alone when only this component's own state changed.

// `toLocaleTimeString()` alone only ever resolves to whole-second
// precision -- direct feedback: several aiBus events can legitimately fire
// within the same second (a drag, a resize, a batched state update), and
// without milliseconds every one of them stamps identically in the event
// log, making it impossible to tell their real relative order apart.
//
// Gemini's PR #580 review, confirmed real: a first version built this by
// string-concatenating toLocaleTimeString() with getMilliseconds(), which
// silently produced a malformed result in any 12-hour locale (en-US's own
// default included) -- the AM/PM marker sits BEFORE where the appended
// fraction landed ("9:05:49 AM.149" instead of "9:05:49.149 AM"), visible
// in this very panel's own real output once actually looked at closely.
// `fractionalSecondDigits` is a real Intl.DateTimeFormat option (used here
// via toLocaleTimeString's own options argument) that places the fraction
// correctly relative to the meridiem marker in every locale, natively --
// no manual string surgery needed at all.
export function formatEventLogTimestamp(date: Date): string {
  // hour/minute/second must be given EXPLICITLY alongside
  // fractionalSecondDigits -- confirmed directly (not assumed): passing
  // an options object with only fractionalSecondDigits set makes
  // Intl.DateTimeFormat format ONLY that one requested component
  // ("744"), silently dropping the h:m:s toLocaleTimeString() shows by
  // default when called with no options at all.
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

// Direct feedback: a verbose event payload (theme:changed's full palette +
// CSS variable dump is the worst offender, easily 1000+ characters) made
// the log unreadable -- one entry could push everything above it off
// screen. 200 characters is roughly 2-3 wrapped lines in this panel's
// monospace font at its default size, long enough to show a real event's
// shape at a glance without one verbose entry dominating the whole panel.
const EVENT_LOG_PAYLOAD_ELIDE_LENGTH = 200;

type LogItem = { id: string; event: string; payload: string; time: string };

interface EventLogContextValue {
  logs: LogItem[];
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  clear: () => void;
}

const EventLogContext = createContext<EventLogContextValue | null>(null);

function useEventLog(): EventLogContextValue {
  const ctx = useContext(EventLogContext);
  if (!ctx) throw new Error('useEventLog must be used inside <EventLogProvider>');
  return ctx;
}

export function EventLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  // Which log entries currently show their full, un-elided payload --
  // per-item, since an eager reader wants to expand one specific verbose
  // entry (e.g. today's Loading/Apply for the Theme Editor) without every
  // other long payload also snapping open.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Subscribe to ALL aiBus events for the live event monitor
  useAnyAIEvent(event => {
    const logItem = {
      id: Math.random().toString(36).substring(2, 9),
      event: event.type,
      // Plain JSON.stringify throws on payloads containing a raw DOM node
      // (e.g. element:resized's `target: HTMLElement`, from useAdaptiveSize)
      // — a real "Converting circular structure to JSON" crash caught here
      // via a browser run, not visible from types or unit tests. Render DOM
      // nodes as a short tag description instead of failing the whole log
      // entry.
      //
      // `instanceof HTMLElement` alone isn't enough: it checks against
      // *this* document's HTMLElement constructor, but aiBus is a single
      // shared module-level singleton, so an element from a live wireframe
      // tile (a real component tree portaled into an <iframe>'s own,
      // separate document — see LiveIframe) is an HTMLElement from a
      // *different* realm, and cross-realm instanceof always fails even
      // though the object genuinely is one — the same "circular structure"
      // crash resurfaces from that direction instead. `nodeType === 1`
      // (Element) is realm-independent, confirmed via a real browser run
      // dragging a live tile's Splitter, which is exactly what triggers a
      // resize event with a foreign-realm target.
      payload: JSON.stringify(event.detail, (_key, value) =>
        value && typeof value === 'object' && value.nodeType === 1 ? `<${value.tagName.toLowerCase()}>` : value
      ),
      time: formatEventLogTimestamp(new Date()),
    };
    setLogs(prev => [logItem, ...prev.slice(0, 49)]);
  });

  const value: EventLogContextValue = {
    logs,
    expandedIds,
    toggleExpanded: id =>
      setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    clear: () => {
      setLogs([]);
      setExpandedIds(new Set());
      aiBus.emit('log:cleared', { timestamp: formatEventLogTimestamp(new Date()) });
    },
  };

  return <EventLogContext.Provider value={value}>{children}</EventLogContext.Provider>;
}

export function EventLogExportButton() {
  const { logs } = useEventLog();
  return (
    <Tooltip content="Download the captured events below as newline-delimited JSON — boilerplate for the telemetry-forwarding pattern this panel and the error:boundary toast above both demonstrate live in-browser: swap this Blob download for a fetch()/fs.appendFile() call and the same shape ships events to a real backend instead">
      <Button
        size="sm"
        variant="outline"
        aria-label="Export JSONL"
        icon={<Download size="1em" />}
        disabled={logs.length === 0}
        onClick={() => {
          // One JSON object per line, oldest first (logs is newest-first
          // for display) — the standard JSONL convention so a consumer can
          // append-only stream this to a file/log pipeline. `log.payload` is
          // already a JSON string (built by JSON.stringify above), so it's
          // spliced in directly rather than re-stringified, avoiding
          // double-encoding it.
          const lines = [...logs].reverse().map(
            log => `{"time":${JSON.stringify(log.time)},"event":${JSON.stringify(log.event)},"payload":${log.payload}}`
          );
          const blob = new Blob([lines.join('\n')], { type: 'application/x-ndjson' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `aibus-events-${Date.now()}.jsonl`;
          a.click();
          URL.revokeObjectURL(url);
        }}
      />
    </Tooltip>
  );
}

export function EventLogClearButton() {
  const { clear } = useEventLog();
  return (
    <Tooltip content="Clear all recorded event log items from stream">
      <Button size="sm" variant="outline" aria-label="Clear Log" icon={<Trash2 size="1em" />} onClick={clear} />
    </Tooltip>
  );
}

/** The log's scrollable body. `collapsed` only affects its tab stop -- see the comment on tabIndex. */
export function EventLogList({ collapsed }: { collapsed: boolean }) {
  const { logs, expandedIds, toggleExpanded } = useEventLog();
  return (
    // tabIndex 0 -- a keyboard-only user needs a way to reach and scroll
    // this region directly (axe: scrollable-region-focusable); its content
    // is plain text, no other focusable descendant. -1 while collapsed,
    // confirmed by a Gemini PR review: this content is always mounted (never
    // conditionally omitted), so a collapsed panel leaves only a sliver of
    // real height visible -- without this, that sliver would still be a real
    // Tab stop, landing a keyboard user on a scrollable region they can
    // barely see. Removing it from the tab order for exactly that state (not
    // permanently -- it's back at 0 the moment the panel isn't collapsed) is
    // the fix, not removing tabIndex outright, since the region genuinely
    // does need to be reachable whenever it's actually usable.
    <div tabIndex={collapsed ? -1 : 0} style={{ background: 'var(--ai-bg-container)', color: 'var(--ai-text-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--ai-radius-md, 0.375rem)', fontFamily: 'monospace', fontSize: '0.8rem', height: '100%', overflowY: 'auto' }}>
      {logs.length === 0 ? (
        <div style={{ color: 'var(--ai-text-secondary)' }}>Listening for events on aiBus... (Drag the separator bar to resize)</div>
      ) : (
        logs.map(log => {
          const isLongPayload = log.payload.length > EVENT_LOG_PAYLOAD_ELIDE_LENGTH;
          const isExpanded = expandedIds.has(log.id);
          const shownPayload = isLongPayload && !isExpanded ? `${log.payload.slice(0, EVENT_LOG_PAYLOAD_ELIDE_LENGTH)}…` : log.payload;
          return (
            <div key={log.id} style={{ marginBottom: '0.2rem' }}>
              <span style={{ color: 'var(--ai-text-secondary)' }}>[{log.time}]</span>{' '}
              {/* --ai-color-primary-readable, not --ai-color-primary -- this
                  text sits on the log panel's near-neutral background, and
                  the raw hue measures under AA contrast there (axe:
                  color-contrast); same fix/reasoning as TabSlice.tsx's own
                  activeTextColor (see its comment for why a plain
                  harmonies.ts-generated var, not color-mix()). */}
              <span style={{ color: 'var(--ai-color-primary-readable)', fontWeight: 'bold' }}>{log.event}</span>:{' '}
              <span style={{ color: 'var(--ai-text-primary)' }}>{shownPayload}</span>
              {/* A real <button>, not a styled span -- this is the only way to
                  reveal a verbose payload (theme:changed's full CSS variable
                  dump, e.g.), so it needs to be a genuine keyboard/screen-
                  reader-operable control, not just a visual affordance. Inline
                  text link styling (no border/background) so it reads as part
                  of the log line rather than a separate UI chrome element. */}
              {isLongPayload && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(log.id)}
                  // Gemini's PR #580 review, confirmed real: with several
                  // verbose entries in the log at once, a screen-reader user
                  // tabbing through gets a run of identically-announced
                  // "[expand]" buttons with no way to tell which entry each
                  // one controls -- aria-label names the specific event;
                  // aria-expanded reports this specific disclosure's own
                  // state, per the WAI-ARIA disclosure pattern (WCAG 4.1.2).
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} payload for ${log.event}`}
                  className="ai-focus-ring"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    marginLeft: '0.375rem',
                    font: 'inherit',
                    fontWeight: 'bold',
                    color: 'var(--ai-color-secondary-readable, var(--ai-color-primary-readable))',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  [{isExpanded ? 'collapse' : 'expand'}]
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
