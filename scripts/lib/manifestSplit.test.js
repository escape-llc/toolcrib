import { describe, it, expect } from 'vitest';
import { splitByCategory } from './manifestSplit.js';

const VALID_CATEGORIES = ['Widgets', 'Gadgets'];
const CATEGORY_SLUGS = { Widgets: 'widgets', Gadgets: 'gadgets' };
const describeCategory = (category) => `fixture description for ${category}`;
const SCHEMA_URL = 'https://example.com/schema';

describe('splitByCategory (generate-manifest.js internal, issue #435)', () => {
  it('includes a $def referenced directly by a category component (baseline, single-hop)', () => {
    const manifest = {
      name: 'fixture',
      version: '0.0.0',
      components: [{ name: 'Thing', category: 'Widgets', props: { data: { type: 'WidgetData' } } }],
      $defs: { WidgetData: { value: { type: 'string' } } },
    };
    const result = splitByCategory(manifest, VALID_CATEGORIES, CATEGORY_SLUGS, describeCategory, SCHEMA_URL);
    expect(result.widgets.$defs).toEqual({ WidgetData: { value: { type: 'string' } } });
  });

  it('does not include a $def unrelated to any component in the category', () => {
    const manifest = {
      name: 'fixture',
      version: '0.0.0',
      components: [{ name: 'Thing', category: 'Widgets', props: { data: { type: 'WidgetData' } } }],
      $defs: { WidgetData: { value: { type: 'string' } }, UnrelatedThing: { foo: { type: 'string' } } },
    };
    const result = splitByCategory(manifest, VALID_CATEGORIES, CATEGORY_SLUGS, describeCategory, SCHEMA_URL);
    expect(result.widgets.$defs).toEqual({ WidgetData: { value: { type: 'string' } } });
  });

  // Regression for a real Gemini-caught defect (issue #435): the previous
  // single-pass version only checked defs referenced directly by a
  // category's own COMPONENTS, never a def referenced only from INSIDE
  // another def's own body -- WidgetData here has a field typed
  // 'WidgetMeta', a SECOND named type nothing in `components` mentions at
  // all. Missing WidgetMeta would ship a category split whose own
  // WidgetData entry references a type that split never actually defines.
  it('transitively includes a $def referenced only from inside another already-included $def', () => {
    const manifest = {
      name: 'fixture',
      version: '0.0.0',
      components: [{ name: 'Thing', category: 'Widgets', props: { data: { type: 'WidgetData' } } }],
      $defs: {
        WidgetData: { value: { type: 'string' }, meta: { type: 'WidgetMeta' } },
        WidgetMeta: { createdAt: { type: 'string' } },
      },
    };
    const result = splitByCategory(manifest, VALID_CATEGORIES, CATEGORY_SLUGS, describeCategory, SCHEMA_URL);
    expect(Object.keys(result.widgets.$defs).sort()).toEqual(['WidgetData', 'WidgetMeta']);
  });

  it('resolves a multi-hop transitive chain (A -> B -> C), not just one level deep', () => {
    const manifest = {
      name: 'fixture',
      version: '0.0.0',
      components: [{ name: 'Thing', category: 'Widgets', props: { data: { type: 'TypeA' } } }],
      $defs: {
        TypeA: { b: { type: 'TypeB' } },
        TypeB: { c: { type: 'TypeC' } },
        TypeC: { value: { type: 'string' } },
        Unrelated: { value: { type: 'string' } },
      },
    };
    const result = splitByCategory(manifest, VALID_CATEGORIES, CATEGORY_SLUGS, describeCategory, SCHEMA_URL);
    expect(Object.keys(result.widgets.$defs).sort()).toEqual(['TypeA', 'TypeB', 'TypeC']);
  });

  it('omits $defs entirely for a category with no matching defs', () => {
    const manifest = {
      name: 'fixture',
      version: '0.0.0',
      components: [{ name: 'Thing', category: 'Gadgets', props: {} }],
      $defs: { WidgetData: { value: { type: 'string' } } },
    };
    const result = splitByCategory(manifest, VALID_CATEGORIES, CATEGORY_SLUGS, describeCategory, SCHEMA_URL);
    expect(result.gadgets.$defs).toBeUndefined();
  });

  it('keeps each category scoped to its own components and carries through name/version/schema', () => {
    const manifest = {
      name: 'fixture',
      version: '1.2.3',
      components: [
        { name: 'Thing', category: 'Widgets', props: {} },
        { name: 'Other', category: 'Gadgets', props: {} },
      ],
    };
    const result = splitByCategory(manifest, VALID_CATEGORIES, CATEGORY_SLUGS, describeCategory, SCHEMA_URL);
    expect(result.widgets.components).toEqual([{ name: 'Thing', category: 'Widgets', props: {} }]);
    expect(result.gadgets.components).toEqual([{ name: 'Other', category: 'Gadgets', props: {} }]);
    expect(result.widgets.name).toBe('fixture');
    expect(result.widgets.version).toBe('1.2.3');
    expect(result.widgets.$schema).toBe(SCHEMA_URL);
    expect(result.widgets.description).toBe('fixture description for Widgets');
  });
});
