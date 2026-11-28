import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import * as p from '@clack/prompts';
import {
  isSignedRelease,
  verifyProvenance,
  loadTrustMaterial,
  loadBundledTrustMaterial,
  resetTrustMaterialCache,
  PROVENANCE_ASSET_NAME,
  SIGNED_SINCE,
} from '../src/lib/provenance.js';

// Real cryptographic verification of the real v0.17.0 release bundle
// against the Sigstore trusted root snapshot bundled with the CLI. Nothing
// here touches the network. The checks that run after the cryptographic one
// (payload/predicate type) can't be reached with a tampered real bundle,
// since any edit breaks the signature first; provenance.checks.test.js covers
// those with the signature step stubbed.

const FIXTURE = new URL('./fixtures/toolcrib-v0.17.0.sigstore.json', import.meta.url);
const CORE_DIGEST = '3678268ebaee0c2a911643b32241c4421ab341487b8e9d255fae293b1e62d4d0';
const TESTS_DIGEST = '0652d6932e6700bb6a9694393040f3ff96722c462c53ba99c9698b19e7545d37';

const loadBundle = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

describe('isSignedRelease', () => {
  it('is false before the first signed release and true from it onward', () => {
    expect(SIGNED_SINCE).toBe('0.17.0');
    expect(isSignedRelease('0.16.9')).toBe(false);
    expect(isSignedRelease('0.17.0')).toBe(true);
    expect(isSignedRelease('1.0.0')).toBe(true);
  });

  it('treats a prerelease of the first signed version as unsigned, by semver ordering', () => {
    expect(isSignedRelease('0.17.0-beta.1')).toBe(false);
  });
});

describe('verifyProvenance (real bundle, bundled trust root)', () => {
  const trustMaterial = loadBundledTrustMaterial();
  const base = { bundleJson: loadBundle(), version: '0.17.0', trustMaterial, trustSource: 'bundled' };

  it('names the bundle asset as the release publishes it', () => {
    expect(PROVENANCE_ASSET_NAME).toBe('toolcrib-release.sigstore.json');
  });

  it('accepts toolcrib.zip with its real digest', () => {
    expect(() => verifyProvenance({ ...base, assetName: 'toolcrib.zip', digestHex: CORE_DIGEST })).not.toThrow();
  });

  it('accepts toolcrib-tests.zip with its real digest from the same bundle', () => {
    expect(() => verifyProvenance({ ...base, assetName: 'toolcrib-tests.zip', digestHex: TESTS_DIGEST })).not.toThrow();
  });

  it('rejects a digest the bundle did not sign', () => {
    expect(() => verifyProvenance({ ...base, assetName: 'toolcrib.zip', digestHex: 'a'.repeat(64) })).toThrow(
      /signed SHA-256 for toolcrib\.zip is 3678.*download hashes to a{64}.*Refusing to install/s
    );
  });

  it('rejects a correct digest presented under the wrong asset name', () => {
    expect(() => verifyProvenance({ ...base, assetName: 'toolcrib.zip', digestHex: TESTS_DIGEST })).toThrow(
      /signed SHA-256 for toolcrib\.zip is 3678/
    );
    expect(() => verifyProvenance({ ...base, assetName: 'other.zip', digestHex: CORE_DIGEST })).toThrow(
      /no subject named other\.zip/
    );
  });

  it('rejects another version, so a newer release cannot be swapped for an older validly signed one', () => {
    expect(() => verifyProvenance({ ...base, version: '0.18.0', assetName: 'toolcrib.zip', digestHex: CORE_DIGEST })).toThrow(
      /signed by https:\/\/github\.com\/escape-llc\/toolcrib\/\.github\/workflows\/release\.yml@refs\/tags\/v0\.17\.0, expected .*@refs\/tags\/v0\.18\.0/
    );
  });

  it('rejects a payload tampered with after signing', () => {
    const bundleJson = loadBundle();
    const statement = JSON.parse(Buffer.from(bundleJson.dsseEnvelope.payload, 'base64').toString('utf8'));
    statement.subject[0].digest.sha256 = 'b'.repeat(64);
    bundleJson.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64');

    expect(() => verifyProvenance({ ...base, bundleJson, assetName: 'toolcrib.zip', digestHex: 'b'.repeat(64) })).toThrow(
      /Sigstore signature did not verify/
    );
  });

  it('tells the user to update the CLI when a failure came from the bundled trust root', () => {
    const bundleJson = loadBundle();
    bundleJson.dsseEnvelope.payloadType = 'text/plain';
    const args = { ...base, bundleJson, assetName: 'toolcrib.zip', digestHex: CORE_DIGEST };

    expect(() => verifyProvenance(args)).toThrow(/bundled with this CLI may be out of date.*update the toolcrib CLI/);
    expect(() => verifyProvenance({ ...args, trustSource: 'tuf' })).toThrow(/did not verify/);
    expect(() => verifyProvenance({ ...args, trustSource: 'tuf' })).not.toThrow(/out of date/);
  });
});

describe('loadTrustMaterial', () => {
  let warnSpy;

  beforeEach(() => {
    resetTrustMaterialCache();
    warnSpy = vi.spyOn(p.log, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    resetTrustMaterialCache();
  });

  it('falls back to the bundled root, with a note naming the reason, when the TUF fetch fails', async () => {
    const fetchTrustedRoot = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND tuf-repo-cdn.sigstore.dev'));

    const { trustMaterial, source } = await loadTrustMaterial({ fetchTrustedRoot });

    expect(source).toBe('bundled');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/TUF repository.*ENOTFOUND.*bundled with this CLI/);
    // The fallback is real trust material: it verifies the real bundle.
    expect(() =>
      verifyProvenance({
        bundleJson: loadBundle(),
        assetName: 'toolcrib.zip',
        digestHex: CORE_DIGEST,
        version: '0.17.0',
        trustMaterial,
      })
    ).not.toThrow();
  });

  it('passes a bounded timeout to the TUF fetch', async () => {
    const fetchTrustedRoot = vi.fn().mockRejectedValue(new Error('x'));
    await loadTrustMaterial({ fetchTrustedRoot });
    expect(fetchTrustedRoot).toHaveBeenCalledWith(expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it('uses the TUF root when it is reachable, without a note', async () => {
    const root = JSON.parse(fs.readFileSync(new URL('../src/lib/sigstore-trusted-root.json', import.meta.url), 'utf8'));
    const { TrustedRoot } = await import('@sigstore/protobuf-specs');
    const fetchTrustedRoot = vi.fn().mockResolvedValue(TrustedRoot.fromJSON(root));

    const { source } = await loadTrustMaterial({ fetchTrustedRoot });

    expect(source).toBe('tuf');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('loads once per process', async () => {
    const fetchTrustedRoot = vi.fn().mockRejectedValue(new Error('x'));
    await Promise.all([loadTrustMaterial({ fetchTrustedRoot }), loadTrustMaterial({ fetchTrustedRoot })]);
    await loadTrustMaterial({ fetchTrustedRoot });
    expect(fetchTrustedRoot).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
