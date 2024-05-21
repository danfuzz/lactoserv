// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process';

import { CertUtil } from '@this/net-util';


describe('checkCertificateChain()', () => {
  const SOME_CERT =
    '-----BEGIN CERTIFICATE-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END CERTIFICATE-----\n';

  test('throws given a non-string', () => {
    expect(() => CertUtil.checkCertificateChain(12345)).toThrow();
  });

  test('throws given a string that is clearly not a certificate chain', () => {
    expect(() => CertUtil.checkCertificateChain('florp\nflop\n')).toThrow();
  });

  test('accepts a pretty minimal syntactically correct single-cert example', () => {
    expect(() => CertUtil.checkCertificateChain(SOME_CERT)).not.toThrow();
  });

  test('accepts a pretty minimal syntactically correct multi-cert example', () => {
    expect(() => CertUtil.checkCertificateChain(SOME_CERT + SOME_CERT)).not.toThrow();
    expect(() => CertUtil.checkCertificateChain(SOME_CERT + SOME_CERT + SOME_CERT)).not.toThrow();
  });
});

describe('checkPrivateKey()', () => {
  const SOME_KEY =
    '-----BEGIN PRIVATE KEY-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END PRIVATE KEY-----\n';
  const SOME_RSA_KEY =
    '-----BEGIN RSA PRIVATE KEY-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END RSA PRIVATE KEY-----\n';

  test('throws given a non-string', () => {
    expect(() => CertUtil.checkPrivateKey(12345)).toThrow();
  });

  test('throws given a string that is clearly not a private key', () => {
    expect(() => CertUtil.checkPrivateKey('florp\nflop\n')).toThrow();
  });

  test('accepts a pretty minimal syntactically correct regular key (PKCS#8)', () => {
    expect(() => CertUtil.checkPrivateKey(SOME_KEY)).not.toThrow();
  });

  test('accepts a pretty minimal syntactically correct RSA key (PKCS#1)', () => {
    expect(() => CertUtil.checkPrivateKey(SOME_RSA_KEY)).not.toThrow();
  });
});

describe('makeSelfSignedPair()', () => {
  test('throws given an empty array', async () => {
    await expect(CertUtil.makeSelfSignedPair([])).toReject();
  });

  test('throws given an array of something other than strings', async () => {
    await expect(CertUtil.makeSelfSignedPair(['foo.bar', 123, 'bar.baz'])).toReject();
  });

  test('produces a valid-looking result, given valid arguments', async () => {
    const got = await CertUtil.makeSelfSignedPair(['localhost', '127.0.0.1', '::1', '*.foo.bar']);

    // ...and also, doesn't try to override `process.emit` as inherited in
    // `process` from `EventEmitter`. See
    // <https://github.com/Dexus/pem/issues/389> and
    // <https://github.com/jestjs/jest/issues/15077>.
    const processEmit = process.emit;
    expect(Object.hasOwn(process, 'emit')).toBeFalse();

    expect(got).toContainAllKeys(['certificate', 'privateKey']);

    expect(() => CertUtil.checkCertificateChain(got.certificate)).not.toThrow();
    expect(() => CertUtil.checkPrivateKey(got.privateKey)).not.toThrow();

    // See above.
    expect(process.emit).toBe(processEmit);
    expect(Object.hasOwn(process, 'emit')).toBeFalse();
  });
});
