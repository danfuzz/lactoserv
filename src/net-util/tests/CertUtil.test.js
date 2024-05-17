// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { CertUtil } from '@this/net-util';


describe('checkCertificateChain()', () => {
  test('throws given a non-string', () => {
    expect(() => CertUtil.checkCertificateChain(12345)).toThrow();
  });
});

describe('checkPrivateKey()', () => {
  test('throws given a non-string', () => {
    expect(() => CertUtil.checkPrivateKey(12345)).toThrow();
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

    expect(() => CertUtil.checkCertificateChain(got.certificate)).not.toThrow();
    expect(() => CertUtil.checkPrivateKey(got.privateKey)).not.toThrow();
  });
});
