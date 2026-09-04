import semver from 'semver';

/**
 * The toolcrib version range this release of toolcrib-mcp has actually been
 * built and verified against (its ai-docs shape read directly, tests run
 * against real content of that version) — not a guess at forward
 * compatibility. Update this after checking mcp/src/lib/{manifestIndex,
 * coreDoc,examples}.js still parse a newer ai-docs shape correctly (see
 * AGENTS.md's standing check), then widen the range to include it.
 */
export const COMPATIBLE_RANGE = '^0.12.0';

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
