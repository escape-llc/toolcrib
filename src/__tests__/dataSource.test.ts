import { describe, it, expect } from 'vitest';
import type { Column } from '../components/DataTable/DataTable';
import { createArrayDataSource, isArrayDataSource, isDataSource, type DataTableQuery } from '../components/DataTable/dataSource';
import { filterRows, sortRows } from '../components/DataTable/tableQuery';

interface Person {
  id: number;
  name: string;
  age: number | null;
}

const people: Person[] = [
  { id: 1, name: 'Cara', age: 30 },
  { id: 2, name: 'alan', age: 25 },
  { id: 3, name: 'Bea', age: null },
  { id: 4, name: 'Dan', age: 25 },
];

const columns: Column<Person>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
];

const query = (overrides: Partial<DataTableQuery> = {}): DataTableQuery => ({
  start: 0,
  count: 10,
  sortBy: [],
  quickFilter: '',
  signal: new AbortController().signal,
  ...overrides,
});

describe('sortRows', () => {
  it('returns the same array when unsorted', () => {
    expect(sortRows(people, columns, [])).toBe(people);
  });

  it('sorts by priority, case-insensitively, with absent values last in either direction', () => {
    expect(sortRows(people, columns, [{ key: 'name', direction: 'asc' }]).map(p => p.name)).toEqual(['alan', 'Bea', 'Cara', 'Dan']);
    expect(sortRows(people, columns, [{ key: 'age', direction: 'asc' }, { key: 'name', direction: 'desc' }]).map(p => p.id)).toEqual([4, 2, 1, 3]);
    expect(sortRows(people, columns, [{ key: 'age', direction: 'desc' }]).map(p => p.id)).toEqual([1, 2, 4, 3]);
  });

  it('does not mutate its input, and uses accessorFn when a column has one', () => {
    const copy = [...people];
    const withAccessor: Column<Person>[] = [{ key: 'computed', title: 'X', accessorFn: p => -p.id }];
    expect(sortRows(people, withAccessor, [{ key: 'computed', direction: 'asc' }]).map(p => p.id)).toEqual([4, 3, 2, 1]);
    expect(people).toEqual(copy);
  });

  it('treats a sort on an unknown column as a tie instead of throwing', () => {
    expect(sortRows(people, columns, [{ key: 'gone', direction: 'asc' }]).map(p => p.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('filterRows', () => {
  it('returns the same array for a blank filter', () => {
    expect(filterRows(people, columns, undefined, '')).toBe(people);
    expect(filterRows(people, columns, undefined, '   ')).toBe(people);
  });

  it('matches a case-insensitive substring against every column by default', () => {
    expect(filterRows(people, columns, undefined, 'AN').map(p => p.id)).toEqual([2, 4]);
    expect(filterRows(people, columns, undefined, '25').map(p => p.id)).toEqual([2, 4]);
  });

  it('can be restricted to named fields', () => {
    expect(filterRows(people, columns, ['name'], '25')).toEqual([]);
    expect(filterRows(people, columns, ['age'], '25').map(p => p.id)).toEqual([2, 4]);
  });
});

describe('createArrayDataSource', () => {
  it('answers synchronously with a plain object, not a Promise', () => {
    const result = createArrayDataSource(people, { columns }).getRows(query());
    expect(typeof (result as { then?: unknown }).then).toBe('undefined');
    expect(result).toEqual({ rows: people, totalCount: 4 });
  });

  it('filters, then sorts, then slices; totalCount is the filtered count, not the page', () => {
    const source = createArrayDataSource(people, { columns });
    const result = source.getRows(query({ quickFilter: 'a', sortBy: [{ key: 'name', direction: 'desc' }], start: 1, count: 2 }));
    // Matches 'a': alan, Bea, Cara, Dan -> desc: Dan, Cara, Bea, alan -> slice(1, 3).
    expect(result).toEqual({ rows: [people[0], people[2]], totalCount: 4 });
    expect(source.getRows(query({ quickFilter: 'cara' }))).toEqual({ rows: [people[0]], totalCount: 1 });
  });

  it('honours quickFilterFields', () => {
    const source = createArrayDataSource(people, { columns, quickFilterFields: ['name'] });
    expect(source.getRows(query({ quickFilter: '25' }))).toEqual({ rows: [], totalCount: 0 });
  });

  it('handles an unbounded count and a start past the end', () => {
    const source = createArrayDataSource(people, { columns });
    expect(source.getRows(query({ count: Infinity })).rows).toHaveLength(4);
    expect(source.getRows(query({ start: 10 }))).toEqual({ rows: [], totalCount: 4 });
  });

  it('reuses the sorted result across pages (does not re-sort per page)', () => {
    let accessorCalls = 0;
    const counting: Column<Person>[] = [
      {
        key: 'name',
        title: 'Name',
        accessorFn: p => {
          accessorCalls++;
          return p.name;
        },
      },
    ];
    const source = createArrayDataSource(people, { columns: counting });
    const sortBy = [{ key: 'name', direction: 'asc' as const }];
    source.getRows(query({ sortBy, start: 0, count: 2 }));
    const after = accessorCalls;
    source.getRows(query({ sortBy, start: 2, count: 2 }));
    expect(accessorCalls).toBe(after);
  });

  it('exportRows returns every matching row in order, ignoring paging', () => {
    const source = createArrayDataSource(people, { columns });
    expect(source.exportRows!({ sortBy: [{ key: 'name', direction: 'asc' }], quickFilter: 'a', signal: new AbortController().signal }).map(p => p.id)).toEqual([2, 3, 1, 4]);
  });

  it('getAllKeys returns every matching key (rowKey, else position in the result)', () => {
    const signal = new AbortController().signal;
    expect(createArrayDataSource(people, { columns, rowKey: p => p.id }).getAllKeys!({ sortBy: [{ key: 'name', direction: 'asc' }], quickFilter: '', signal })).toEqual([
      '2',
      '3',
      '1',
      '4',
    ]);
    expect(createArrayDataSource(people, { columns }).getAllKeys!({ sortBy: [], quickFilter: 'a', signal })).toEqual(['0', '1', '2', '3']);
  });
});

describe('isArrayDataSource', () => {
  it('brands only the built-in array source, and the brand does not survive a spread', () => {
    const source = createArrayDataSource(people, { columns });
    expect(isArrayDataSource(source)).toBe(true);
    expect(Object.keys(source)).toEqual(['getRows', 'exportRows', 'getAllKeys']);
    expect(isArrayDataSource({ ...source })).toBe(false);
    expect(isArrayDataSource({ getRows: () => ({ rows: [], totalCount: 0 }) })).toBe(false);
  });
});

describe('isDataSource', () => {
  it('tells a source from an array', () => {
    expect(isDataSource(people)).toBe(false);
    expect(isDataSource(createArrayDataSource(people, { columns }))).toBe(true);
    expect(isDataSource({ getRows: () => ({ rows: [], totalCount: 0 }) })).toBe(true);
  });
});
