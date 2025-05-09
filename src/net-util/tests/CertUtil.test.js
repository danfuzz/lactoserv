// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { CertUtil } from '@this/net-util';


describe('mustBeCertificateChain()', () => {
  const SOME_CERT =
    '-----BEGIN CERTIFICATE-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END CERTIFICATE-----\n';

  test('throws given a non-string', () => {
    expect(() => CertUtil.mustBeCertificateChain(12345)).toThrow();
  });

  test('throws given a string that is clearly not a certificate chain', () => {
    expect(() => CertUtil.mustBeCertificateChain('florp\nflop\n')).toThrow();
  });

  test('accepts a pretty minimal syntactically correct single-cert example', () => {
    expect(() => CertUtil.mustBeCertificateChain(SOME_CERT)).not.toThrow();
  });

  test('accepts a pretty minimal syntactically correct multi-cert example', () => {
    expect(() => CertUtil.mustBeCertificateChain(SOME_CERT + SOME_CERT)).not.toThrow();
    expect(() => CertUtil.mustBeCertificateChain(SOME_CERT + SOME_CERT + SOME_CERT)).not.toThrow();
  });
});

describe('mustBePrivateKey()', () => {
  const SOME_KEY =
    '-----BEGIN PRIVATE KEY-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END PRIVATE KEY-----\n';
  const SOME_RSA_KEY =
    '-----BEGIN RSA PRIVATE KEY-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END RSA PRIVATE KEY-----\n';
  const SOME_EC_KEY =
    '-----BEGIN EC PRIVATE KEY-----\n' +
    'ABCDEFG+/abcdefg1234567890=\n' +
    '-----END EC PRIVATE KEY-----\n';

  test('throws given a non-string', () => {
    expect(() => CertUtil.mustBePrivateKey(12345)).toThrow();
  });

  test('throws given a string that is clearly not a private key', () => {
    expect(() => CertUtil.mustBePrivateKey('florp\nflop\n')).toThrow();
  });

  test('accepts a pretty minimal syntactically correct regular key (PKCS#8)', () => {
    expect(() => CertUtil.mustBePrivateKey(SOME_KEY)).not.toThrow();
  });

  test('accepts a pretty minimal syntactically correct RSA key (PKCS#1)', () => {
    expect(() => CertUtil.mustBePrivateKey(SOME_RSA_KEY)).not.toThrow();
  });

  test('accepts a pretty minimal syntactically correct EC key (PKCS#1)', () => {
    expect(() => CertUtil.mustBePrivateKey(SOME_EC_KEY)).not.toThrow();
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

    expect(got).toContainAllKeys(['certificate', 'privateKey']);

    expect(() => CertUtil.mustBeCertificateChain(got.certificate)).not.toThrow();
    expect(() => CertUtil.mustBePrivateKey(got.privateKey)).not.toThrow();
  });
});
