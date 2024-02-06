// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EtagGenerator } from '@this/net-util';


describe('constructor', () => {
  test.each`
  arg
  ${'sha1'}
  ${'sha256'}
  ${'sha512'}
  `('accepts algorithm $arg', ({ arg }) => {
    expect(() => new EtagGenerator({ hashAlgorithm: arg })).not.toThrow();
  });

  test.each`
  algorithm   | len
  ${'sha1'}   | ${null}
  ${'sha1'}   | ${8}
  ${'sha1'}   | ${27}
  ${'sha256'} | ${null}
  ${'sha256'} | ${8}
  ${'sha256'} | ${43}
  ${'sha512'} | ${null}
  ${'sha512'} | ${8}
  ${'sha512'} | ${86}
  ${'sha1'}   | ${{ strong: null }}
  ${'sha256'} | ${{ strong: 8 }}
  ${'sha512'} | ${{ strong: 16 }}
  ${'sha512'} | ${{ weak: null }}
  ${'sha256'} | ${{ weak: 8 }}
  ${'sha1'}   | ${{ weak: 22 }}
  ${'sha256'} | ${{ strong: 32, weak: 10 }}
  `('accepts hash length $len for $algorithm', ({ len, algorithm }) => {
    expect(() => new EtagGenerator({ hashAlgorithm: algorithm, hashLength: len })).not.toThrow();
  });

  test.each`
  arg
  ${'strong'}
  ${'vary'}
  ${'weak'}
  `('accepts tag form $arg', ({ arg }) => {
    expect(() => new EtagGenerator({ tagForm: arg })).not.toThrow();
  });
});

// Short-data hashes to verify that the expected algorithms and encoding are
// used. Handy command:
//
// `printf '...' | openssl dgst -binary -sha1 | base64`
describe.each`
algorithm | empty | data1 | data2
${'sha1'}
${'2jmj7l5rSw0yVb/vlWAYkK/YBwk'}
${'H4rBDyPFtbwRZ72oS4M+XAV6d9I'}
${'PHPSQsr4uCc74Vb6KXggU1r1dXU'}
--
${'sha256'}
${'47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU'}
${'vvV+x/U6bUC+tkCngKY5yDvCmsipgW8fxsXG3Nk8RyE'}
${'jCZW9q9qYqNGHJLB8BBQp1oIovTgZE9bsjt/ebY+uXQ'}
--
${'sha512'}
${'z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg'}
${'4y7xliPo7Z0mf2V6gZRLPQetu3aFGAaOiENXRVZOjUFQoKcDvip9iLYePTkMK7l+LUwxH9xp1rEmfwX1mqkg5w'}
${'4nMqeuEpUDGHCQgVXpJSUqVxDhkm9Od9RGlR0Sv/pvnLLV7ifJi06PekIuC8Oc0fcy7iMkimj38yBmzjRHICcw'}
`('for algorithm $algorithm', ({ algorithm, ...hashes }) => {
  describe.each`
  which      | data
  ${'empty'} | ${''}
  ${'data1'} | ${'abcdef'}
  ${'data2'} | ${'\u{1f680} \u{1f60e} \u{0ca0}_\u{0ca0}'}
  `('with value $which', ({ which, data }) => {
    test('works with string', async () => {
      const eg     = new EtagGenerator({ hashAlgorithm: algorithm, hashLength: null });
      const result = await eg.etagFromData(data);
      expect(result).toBe(`"${hashes[which]}"`);
    });

    test('works with buffer', async () => {
      const eg     = new EtagGenerator({ hashAlgorithm: algorithm, hashLength: null });
      const result = await eg.etagFromData(Buffer.from(data, 'utf8'));
      expect(result).toBe(`"${hashes[which]}"`);
    });
  });
});
