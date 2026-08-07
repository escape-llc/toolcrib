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

/** Produce the proposed package.json content (as an object) reflecting toAdd only. */
export function buildProposedPackageJson(userPkg, toAdd) {
  const proposed = structuredClone(userPkg);
  proposed.dependencies ??= {};
  for (const { name, range } of toAdd) {
    proposed.dependencies[name] = range;
  }
  return proposed;
}
