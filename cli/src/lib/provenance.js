import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import * as p from '@clack/prompts';
import { bundleFromJSON } from '@sigstore/bundle';
import { Verifier, toSignedEntity, toTrustMaterial } from '@sigstore/verify';
import { getTrustedRoot } from '@sigstore/tuf';
import { TrustedRoot } from '@sigstore/protobuf-specs';

// Sigstore provenance verification for release downloads (#961).
//
// A release's `.sha256` sibling lives in the same GitHub release as the zip,
// so anyone able to replace release assets can replace both. The Sigstore
// bundle is different: it carries a signature from a short-lived certificate
// that Fulcio issued to release.yml's own GitHub Actions identity, plus a
// Rekor transparency-log entry, so replacing the zip means forging a
// signature, not just uploading a file. See cli/README.md.

export const PROVENANCE_ASSET_NAME = 'toolcrib-release.sigstore.json';

// First toolkit release whose release.yml published PROVENANCE_ASSET_NAME.
// Anything older has no bundle to fetch and is verified by SHA-256 only.
export const SIGNED_SINCE = '0.17.0';

const REPO = 'escape-llc/toolcrib';
const OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const PAYLOAD_TYPE = 'application/vnd.in-toto+json';
const PREDICATE_TYPE = 'https://slsa.dev/provenance/v1';

// Bounded so a blocked network fails over to the bundled root quickly
// instead of hanging `init`/`merge`/`doctor` on a TUF fetch.
const TUF_TIMEOUT_MS = 10_000;
const TUF_RETRIES = 1;

const BUNDLED_ROOT_PATH = fileURLToPath(new URL('./sigstore-trusted-root.json', import.meta.url));

/**
 * Whether `version`'s release is expected to carry a Sigstore bundle. Pure
 * semver comparison, so a prerelease of SIGNED_SINCE itself
 * (`0.17.0-beta.1`) sorts below it and counts as unsigned.
 */
export function isSignedRelease(version) {
  return semver.gte(version, SIGNED_SINCE);
}

/** The Sigstore public-good trusted root snapshot that ships inside this CLI. */
export function loadBundledTrustMaterial() {
  const root = TrustedRoot.fromJSON(JSON.parse(fs.readFileSync(BUNDLED_ROOT_PATH, 'utf8')));
  return toTrustMaterial(root);
}

// One trust-material load per process: `merge` verifies up to four assets
// (two versions, core + tests), and each shouldn't repeat a TUF round trip.
let trustMaterialPromise = null;

/** Test seam: forget the cached trust material. */
export function resetTrustMaterialCache() {
  trustMaterialPromise = null;
}

/**
 * Load the trust material verification needs: Sigstore's trusted root,
 * fetched over TUF (https://tuf-repo-cdn.sigstore.dev) so key rotations
 * reach this CLI without a release of it. If that fetch fails (offline, a
 * firewall blocking the host), fall back to the snapshot bundled with this
 * CLI and say so, rather than failing every install on a network the
 * release download itself got through.
 *
 * `fetchTrustedRoot` is a test seam so tests never touch the network.
 * Resolves to `{ trustMaterial, source }` where source is 'tuf' or 'bundled'.
 */
export function loadTrustMaterial({ fetchTrustedRoot = getTrustedRoot } = {}) {
  if (!trustMaterialPromise) {
    trustMaterialPromise = (async () => {
      try {
        const root = await fetchTrustedRoot({ timeout: TUF_TIMEOUT_MS, retry: TUF_RETRIES });
        return { trustMaterial: toTrustMaterial(root), source: 'tuf' };
      } catch (err) {
        p.log.warn(
          `Couldn't reach Sigstore's TUF repository (${err.message}); ` +
            `verifying against the trust root bundled with this CLI instead.`
        );
        return { trustMaterial: loadBundledTrustMaterial(), source: 'bundled' };
      }
    })();
  }
  return trustMaterialPromise;
}

function decodeStatement(bundleJson) {
  const envelope = bundleJson?.dsseEnvelope;
  if (!envelope) {
    throw new Error('the bundle has no DSSE envelope');
  }
  return { envelope, statement: JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8')) };
}

/**
 * Verify that `bundleJson` (a Sigstore bundle) proves `assetName`, whose
 * SHA-256 is `digestHex`, was built by this repo's release.yml for tag
 * `v${version}`. Throws a specific Error on the first check that fails.
 *
 * `trustMaterial` comes from loadTrustMaterial(); `trustSource` ('tuf' or
 * 'bundled') only shapes the error message.
 */
export function verifyProvenance({ bundleJson, assetName, digestHex, version, trustMaterial, trustSource }) {
  const refuse = (reason) =>
    new Error(`Provenance check failed for ${assetName} v${version}: ${reason}. Refusing to install an unverified download.`);

  // (a) Cryptographic: the DSSE signature, the certificate chain to Fulcio,
  // the Rekor inclusion proof, and that the certificate was issued to a
  // GitHub Actions OIDC identity. Throws if the payload was altered.
  let signer;
  try {
    signer = new Verifier(trustMaterial).verify(toSignedEntity(bundleFromJSON(bundleJson)), {
      extensions: { issuer: OIDC_ISSUER },
    });
  } catch (err) {
    const stale =
      trustSource === 'bundled'
        ? '; the trust root bundled with this CLI may be out of date, so update the toolcrib CLI'
        : '';
    throw refuse(`the Sigstore signature did not verify (${err.message})${stale}`);
  }

  // (b) The signer must be release.yml running for THIS version's own tag,
  // not any `refs/tags/v*`. A looser match would allow a downgrade: an
  // attacker who can replace release assets could serve an older release's
  // zip together with that older release's (validly signed) bundle in place
  // of the requested version's, and every signature check would still pass.
  const expectedSan = `https://github.com/${REPO}/.github/workflows/release.yml@refs/tags/v${version}`;
  const actualSan = signer.identity?.subjectAlternativeName;
  if (actualSan !== expectedSan) {
    throw refuse(`the bundle was signed by ${actualSan ?? 'an unknown identity'}, expected ${expectedSan}`);
  }

  // (c) Shape of what was signed.
  let envelope, statement;
  try {
    ({ envelope, statement } = decodeStatement(bundleJson));
  } catch (err) {
    throw refuse(`couldn't read the signed statement (${err.message})`);
  }
  if (envelope.payloadType !== PAYLOAD_TYPE) {
    throw refuse(`payload type is ${envelope.payloadType}, expected ${PAYLOAD_TYPE}`);
  }
  if (statement.predicateType !== PREDICATE_TYPE) {
    throw refuse(`predicate type is ${statement.predicateType}, expected ${PREDICATE_TYPE}`);
  }

  // (d) The signed statement must name exactly this asset, with exactly the
  // bytes we downloaded.
  const subject = (statement.subject ?? []).find((s) => s.name === assetName);
  if (!subject) {
    throw refuse(`the signed statement has no subject named ${assetName}`);
  }
  const signedDigest = subject.digest?.sha256;
  if (signedDigest?.toLowerCase() !== digestHex.toLowerCase()) {
    throw refuse(`the signed SHA-256 for ${assetName} is ${signedDigest}, but the download hashes to ${digestHex}`);
  }
}
