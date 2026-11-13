import type { Column, DataTableDataSource, DataTableQuery, DataTableResult, SortDescriptor } from '#toolcrib';

// A fake "server" for the data virtualization demo: 100,000 generated rows
// behind an async, 150ms-latency source that sorts and filters on its side
// and honors `signal`, the way a real fetch-backed source would.

export interface ServerRow {
  id: number;
  name: string;
  city: string;
  amount: number;
}

export const SERVER_ROW_COUNT = 100_000;
const LATENCY_MS = 150;
const CITIES = ['Oslo', 'Lima', 'Kyoto', 'Accra', 'Quito', 'Perth', 'Turin', 'Hanoi', 'Cork', 'Lagos'];

export interface DemoRequest {
  start: number;
  count: number;
  sortBy: SortDescriptor[];
  quickFilter: string;
}

declare global {
  interface Window {
    /**
     * TEST HOOK, read by e2e/datatable-data-virtualization.spec.ts: every
     * request the demo's fake server received, in order. Not demo content.
     */
    __dataTableDemoRequests?: DemoRequest[];
  }
}
if (typeof window !== 'undefined') window.__dataTableDemoRequests = [];

const allRows: ServerRow[] = Array.from({ length: SERVER_ROW_COUNT }, (_, i) => ({
  id: i + 1,
  name: `Customer ${i + 1}`,
  city: CITIES[(i * 7) % CITIES.length],
  amount: ((i * 7919) % 100_000) / 100,
}));

const compare = (a: ServerRow, b: ServerRow, { key, direction }: SortDescriptor): number => {
  const x = a[key as keyof ServerRow];
  const y = b[key as keyof ServerRow];
  const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
  return direction === 'desc' ? -result : result;
};

const cache = new Map<string, ServerRow[]>();
function matching({ sortBy, quickFilter }: Pick<DataTableQuery, 'sortBy' | 'quickFilter'>): ServerRow[] {
  const key = `${sortBy.map(s => `${s.key}:${s.direction}`).join(',')}|${quickFilter}`;
  let rows = cache.get(key);
  if (!rows) {
    const text = quickFilter.trim().toLowerCase();
    rows = text ? allRows.filter(r => r.name.toLowerCase().includes(text) || r.city.toLowerCase().includes(text)) : allRows;
    if (sortBy.length > 0) rows = [...rows].sort((a, b) => sortBy.reduce((acc, s) => acc || compare(a, b, s), 0) || a.id - b.id);
    cache.set(key, rows);
  }
  return rows;
}

export const serverColumns: Column<ServerRow>[] = [
  { key: 'id', title: 'ID', sortable: true, width: '6rem' },
  { key: 'name', title: 'Customer', sortable: true },
  { key: 'city', title: 'City' },
  { key: 'amount', title: 'Amount', sortable: true, render: ({ value }) => Number(value).toFixed(2) },
];

const abortError = () => new DOMException('The operation was aborted.', 'AbortError');

export const serverRowsSource: DataTableDataSource<ServerRow> = {
  getRows({ start, count, sortBy, quickFilter, signal }) {
    window.__dataTableDemoRequests?.push({ start, count, sortBy, quickFilter });
    return new Promise<DataTableResult<ServerRow>>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      const timer = setTimeout(() => {
        const rows = matching({ sortBy, quickFilter });
        resolve({ rows: rows.slice(start, start + count), totalCount: rows.length });
      }, LATENCY_MS);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true }
      );
    });
  },
};
