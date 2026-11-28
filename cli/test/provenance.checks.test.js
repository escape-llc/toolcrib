import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';

// verifyProvenance's checks that run after the cryptographic one. Editing a
// real bundle's payload type or predicate type breaks its signature, so the
// signature step is stubbed here to report the real signer identity and let
// the statement checks run on modified copies. The real cryptographic step
// is covered in provenance.test.js.
vi.mock('@sigstore/verify', async (importOriginal) => ({
  ...(await importOriginal()),
  Verifier: class {
    verify() {
      return {
        identity: {
          subjectAlternativeName: 'https://github.com/escape-llc/toolcrib/.github/workflows/release.yml@refs/tags/v0.17.0',
        },
      };
    }
  },
}));

const { verifyProvenance } = await import('../src/lib/provenance.js');

const CORE_DIGEST = '3678268ebaee0c2a911643b32241c4421ab341487b8e9d255fae293b1e62d4d0';

function bundleWith(edit) {
  const bundleJson = JSON.parse(
    fs.readFileSync(new URL('./fixtures/toolcrib-v0.17.0.sigstore.json', import.meta.url), 'utf8')
  );
  const statement = JSON.parse(Buffer.from(bundleJson.dsseEnvelope.payload, 'base64').toString('utf8'));
  edit(bundleJson, statement);
  if (bundleJson.dsseEnvelope) bundleJson.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64');
  return bundleJson;
}

const verify = (bundleJson) =>
  verifyProvenance({ bundleJson, assetName: 'toolcrib.zip', digestHex: CORE_DIGEST, version: '0.17.0', trustMaterial: {} });

describe('verifyProvenance statement checks', () => {
  it('passes an unmodified bundle (control)', () => {
    expect(() => verify(bundleWith(() => {}))).not.toThrow();
  });

  it('rejects a payloadType other than in-toto', () => {
    expect(() => verify(bundleWith((b) => (b.dsseEnvelope.payloadType = 'text/plain')))).toThrow(
      /payload type is text\/plain, expected application\/vnd\.in-toto\+json.*Refusing to install/s
    );
  });

  it('rejects a predicateType other than SLSA provenance v1', () => {
    expect(() => verify(bundleWith((b, s) => (s.predicateType = 'https://example.com/other')))).toThrow(
      /predicate type is https:\/\/example\.com\/other, expected https:\/\/slsa\.dev\/provenance\/v1/
    );
  });

  it('rejects a bundle with no DSSE envelope', () => {
    // A bare-signature bundle is a valid Sigstore bundle with no in-toto statement in it.
    const bundleJson = bundleWith((b) => {
      delete b.dsseEnvelope;
      b.messageSignature = { messageDigest: { algorithm: 'SHA2_256', digest: 'AAAA' }, signature: 'AAAA' };
    });
    expect(() => verify(bundleJson)).toThrow(/no DSSE envelope/);
  });

  it('compares digests case-insensitively', () => {
    expect(() =>
      verifyProvenance({
        bundleJson: bundleWith(() => {}),
        assetName: 'toolcrib.zip',
        digestHex: CORE_DIGEST.toUpperCase(),
        version: '0.17.0',
        trustMaterial: {},
      })
    ).not.toThrow();
  });
});
