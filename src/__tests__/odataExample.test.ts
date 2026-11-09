import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The OData worked example (ai-docs/examples/datatable-odata.md) ships a
// query builder an AI is expected to copy. Run the code in the GENERATED
// file, not a copy of it, so the documented builder can't drift from what's
// asserted here.

type Query = { start: number; count: number; sortBy: { key: string; direction: 'asc' | 'desc' }[]; quickFilter: string };
type Build = (query: Query, options: { fields: string[] }) => string;

function loadBuilder(): Build {
  const md = readFileSync(join(__dirname, '..', '..', 'ai-docs', 'examples', 'datatable-odata.md'), 'utf8');
  const marker = '<!-- tested: buildODataQuery -->';
  const at = md.indexOf(marker);
  if (at === -1) throw new Error(`marker ${marker} not found in datatable-odata.md`);
  const fence = /```js\r?\n([\s\S]*?)```/.exec(md.slice(at + marker.length));
  if (!fence) throw new Error('no ```js block after the marker');
  return new Function(`${fence[1]}; return buildODataQuery;`)() as Build;
}

describe('datatable-odata example: buildODataQuery', () => {
  const buildODataQuery = loadBuilder();
  const fields = ['name', 'email'];

  it('paging only', () => {
    expect(buildODataQuery({ start: 20, count: 10, sortBy: [], quickFilter: '' }, { fields })).toBe('$skip=20&$top=10&$count=true');
  });

  it('multi-column sort, in priority order', () => {
    expect(
      buildODataQuery(
        {
          start: 0,
          count: 25,
          sortBy: [
            { key: 'name', direction: 'desc' },
            { key: 'age', direction: 'asc' },
          ],
          quickFilter: '',
        },
        { fields }
      )
    ).toBe('$skip=0&$top=25&$count=true&$orderby=name%20desc%2Cage%20asc');
  });

  it('quick filter with an apostrophe and a space: escaped, lower-cased and URL-encoded', () => {
    expect(buildODataQuery({ start: 0, count: 10, sortBy: [], quickFilter: "O'Brien Smith" }, { fields })).toBe(
      "$skip=0&$top=10&$count=true&$filter=contains(tolower(name)%2C'o''brien%20smith')%20or%20contains(tolower(email)%2C'o''brien%20smith')"
    );
  });

  it('omits $orderby and $filter when sort and filter are empty (a blank filter counts as empty)', () => {
    const url = buildODataQuery({ start: 5, count: 5, sortBy: [], quickFilter: '   ' }, { fields });
    expect(url).toBe('$skip=5&$top=5&$count=true');
    expect(url).not.toContain('$orderby');
    expect(url).not.toContain('$filter');
  });

  it('sort and filter together', () => {
    expect(buildODataQuery({ start: 0, count: 10, sortBy: [{ key: 'name', direction: 'asc' }], quickFilter: 'x' }, { fields: ['name'] })).toBe(
      "$skip=0&$top=10&$count=true&$orderby=name%20asc&$filter=contains(tolower(name)%2C'x')"
    );
  });
});
