/**
 * Pure, dependency-free split of a generated manifest's `components`/`$defs`
 * into one manifest-shaped object per @manifestCategory (ai-docs/manifest/
 * <slug>.json) -- extracted out of generate-manifest.js itself specifically
 * so it can be imported directly by manifestSplit.test.js. generate-manifest.js
 * (and everything it imports from ./extract.js) resolves a ROOT path via
 * `new URL('..', import.meta.url)` at module load time, which throws ("The
 * URL must be of scheme file") under Vitest's Vite-based transform -- the
 * same documented cross-tool quirk extract.test.js/buildGraph.test.js/
 * toon.test.js already work around by reading committed output files
 * instead of importing extract.js's own functions. This module takes
 * `validCategories`/`categorySlugs`/`describeCategory` as parameters
 * instead of importing them from extract.js, so it has no such import at
 * all and can be tested directly with plain fixture data.
 */

/**
 * Filter a manifest's `components`/`$defs` down to one manifest-shaped
 * object per category. A `$defs` entry is included in a category's file if
 * its name appears anywhere (whole-word) in that category's own filtered
 * components' serialized JSON, OR transitively -- inside another `$defs`
 * entry ALREADY included for this category (one named type with a field
 * typed as a second named type). The transitive case was a real gap found
 * by a Gemini codebase audit (issue #435): the original single-pass version
 * only checked references from components directly, so a def referenced
 * only from inside another def's own body would be silently omitted --
 * shipping a per-category manifest split with a `$defs` reference that
 * doesn't actually resolve within that file. Iterates to a fixed point (at
 * most `Object.keys(defs).length` passes) rather than a single pass, so a
 * chain of any real depth resolves fully.
 *
 * @param {{name: string, version: string, components: any[], $defs?: Record<string, any>}} manifest
 * @param {string[]} validCategories
 * @param {Record<string, string>} categorySlugs - category name -> filename slug
 * @param {(category: string) => string} describeCategory
 * @param {string} schemaUrl - passed through rather than duplicated as a
 *   second hardcoded literal here -- generate-manifest.js's own SCHEMA_URL
 *   constant stays the single source of truth for this value.
 * @returns {Record<string, any>} slug -> category-scoped manifest object
 */
export function splitByCategory(manifest, validCategories, categorySlugs, describeCategory, schemaUrl) {
  const defs = manifest.$defs ?? {};
  const result = {};
  for (const category of validCategories) {
    const categoryComponents = manifest.components.filter((c) => c.category === category);
    const categoryText = JSON.stringify(categoryComponents);
    const categoryDefs = {};
    let addedInLastPass = true;
    while (addedInLastPass) {
      addedInLastPass = false;
      const searchText = categoryText + JSON.stringify(categoryDefs);
      for (const [defName, defBody] of Object.entries(defs)) {
        if (defName in categoryDefs) continue;
        if (new RegExp(`\\b${defName}\\b`).test(searchText)) {
          categoryDefs[defName] = defBody;
          addedInLastPass = true;
        }
      }
    }
    result[categorySlugs[category]] = {
      $schema: schemaUrl,
      name: manifest.name,
      version: manifest.version,
      description: describeCategory(category),
      category,
      components: categoryComponents,
      ...(Object.keys(categoryDefs).length > 0 ? { $defs: categoryDefs } : {}),
    };
  }
  return result;
}
