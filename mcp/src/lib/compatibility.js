import semver from 'semver';

/**
 * The toolcrib version range this release of toolcrib-mcp has actually been
 * built and verified against (its ai-docs shape read directly, tests run
 * against real content of that version) — not a guess at forward
 * compatibility.
 *
 * A single `>=LOW <HIGH` bound, not stacked `^x.y.0 || ^x.y.0 || ...`
 * clauses — this project ships 0.x releases at high velocity (a new minor
 * every few days is common), and under semver's caret rules a 0.x minor
 * bump is treated as breaking, so `^0.12.0` alone excludes 0.13.0 the
 * moment it ships. Stacking one more `|| ^0.x.0` per release keeps working
 * but the clause list only grows forever. A plain range bound lets a
 * release just widen the single upper number instead.
 *
 * To verify and widen after a new release: confirm
 * mcp/src/lib/{manifestIndex,coreDoc,examples}.js still parse the new
 * ai-docs shape correctly (see AGENTS.md's standing check), then bump only
 * the upper bound to just past the new version (e.g. shipping 0.14.0 ->
 * bump `<0.14.0` to `<0.15.0`). Only raise LOW if an older version in the
 * range is confirmed actually broken against the current server code —
 * don't narrow it preemptively.
 *
 * LOW is 0.1.0 (this project's first release), not narrower — verified
 * empirically, not assumed: every one of v0.1.0 through v0.13.0's real,
 * git-tagged `ai-docs/` content (release.yml builds each release directly
 * from its tag, so the tag *is* the shipped content) was fed through this
 * server's actual manifestIndex/coreDoc/examples loaders and produced no
 * errors, with every field these loaders read (components[].name/category/
 * description, eventBus.channels/helperMethods, themeSystem, zIndexScale)
 * present and stable across all 13 releases. The only schema additions in
 * that span ($defs at v0.3.0, manifestSplit at v0.5.0, a transient
 * constraints field at v0.3.0) are fields this server never reads.
 */
export const COMPATIBLE_RANGE = '>=0.1.0 <0.14.0';

/**
 * Compares a vendored install's version against COMPATIBLE_RANGE. Returns
 * `null` when compatible (or when the version couldn't be determined at all
 * — that's `get_install_info`'s `version: null` case, a separate concern
 * from a version *mismatch*), or a one-line warning string otherwise. A
 * mismatch is a warning, not a startup failure: an ai-docs shape change is
 * often additive, so an untested newer version may well still work fine —
 * failing hard would be a worse default than telling the caller to verify.
 */
export function checkCompatibility(version) {
  if (!version || !semver.valid(version)) return null;
  if (semver.satisfies(version, COMPATIBLE_RANGE)) return null;
  return `toolcrib-mcp has only been verified against toolcrib ${COMPATIBLE_RANGE}; this project has ${version} vendored. Results may be inaccurate if the ai-docs shape changed since then.`;
}
