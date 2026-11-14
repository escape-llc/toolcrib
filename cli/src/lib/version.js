// A version string reaching a release download URL (`.../download/v${version}/...`)
// or a `v${version}` tag must be plain semver. Anything else (e.g. a lock file
// containing `1/../../x`) could redirect the download to another repository,
// whose zip and .sha256 would both be attacker-controlled and so pass the
// checksum. One helper, called at every boundary where a version enters the
// CLI (lock file, managed-block attribute, --version flag, GitHub API) and
// again inside the URL builder, so no URL is built from an unvalidated string.
const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function isValidVersion(version) {
  return typeof version === 'string' && SEMVER_RE.test(version);
}

/**
 * Returns `version` unchanged if it is strict semver; otherwise throws an error
 * that names where the bad value came from (`source`, e.g. "toolcrib/.toolcrib-lock.json").
 */
export function assertValidVersion(version, source) {
  if (!isValidVersion(version)) {
    throw new Error(
      `Invalid version ${JSON.stringify(version)} from ${source}: expected a semver version like 1.2.3 ` +
        `(optionally with a -prerelease suffix). Refusing to build a release URL from it.`
    );
  }
  return version;
}
