import semver from 'semver';

/**
 * Compare a control file's required peerDependencies against what's
 * already declared in the consumer's package.json, using real semver
 * range intersection rather than string equality.
 *
 * Three buckets:
 *  - toAdd:      not present at all, safe to add
 *  - compatible: present and overlaps the required range, leave alone
 *  - conflicts:  present but no overlap (or an unrecognized specifier
 *                like "workspace:*" or a git URL) — needs a human decision
 */
export function resolveDependencyDecisions(userPkg, requiredDeps) {
  const userDeps = { ...(userPkg.dependencies || {}), ...(userPkg.devDependencies || {}) };

  const decisions = { toAdd: [], compatible: [], conflicts: [] };

  for (const [name, requiredRange] of Object.entries(requiredDeps)) {
    const userRange = userDeps[name];

    if (!userRange) {
      decisions.toAdd.push({ name, range: requiredRange });
      continue;
    }

    if (!semver.validRange(userRange)) {
      decisions.conflicts.push({
        name,
        userRange,
        requiredRange,
        reason: 'unrecognized version specifier — cannot verify automatically',
      });
      continue;
    }

    if (semver.intersects(userRange, requiredRange)) {
      decisions.compatible.push({ name, userRange, requiredRange });
    } else {
      decisions.conflicts.push({ name, userRange, requiredRange, reason: 'version range mismatch' });
    }
  }

  return decisions;
}

/**
 * Produce the proposed package.json content (as an object) reflecting
 * toAdd only. `depsField` defaults to "dependencies" (core toolkit
 * peerDependencies); init.js's --with-tests path passes "devDependencies"
 * instead, since the test suite's own peer deps (vitest, testing-library,
 * jsdom — see toolcrib-tests.config.json) are dev tooling, not something a
 * consumer's production bundle should carry.
 */
export function buildProposedPackageJson(userPkg, toAdd, depsField = 'dependencies') {
  const proposed = structuredClone(userPkg);
  proposed[depsField] ??= {};
  for (const { name, range } of toAdd) {
    proposed[depsField][name] = range;
  }
  return proposed;
}

/**
 * Merge toolcrib's package.json "imports" subpath entry (e.g. `#toolcrib` ->
 * `./toolcrib/index.ts`) into a package.json object, leaving any other
 * "imports" entries the consumer already declared untouched.
 *
 * Returns `{ pkg, changed }` — `changed` is false when every entry is
 * already present with the exact value expected, so callers (init/merge)
 * can skip proposing a no-op patch.
 */
export function mergeImportsField(pkg, entry) {
  const current = pkg.imports || {};
  const alreadySet = Object.entries(entry).every(([key, value]) => current[key] === value);
  if (alreadySet) return { pkg, changed: false };

  const proposed = structuredClone(pkg);
  proposed.imports = { ...current, ...entry };
  return { pkg: proposed, changed: true };
}
