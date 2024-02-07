// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { EtagGenerator } from '@this/net-util';


describe.each`
label                | isConstructor
${'constructor'}     | ${true}
${'expandOptions()'} | ${false}
`('$label', ({ isConstructor }) => {
  const doCall = (options) => {
    if (isConstructor) {
      return new EtagGenerator(options);
    } else {
      return EtagGenerator.expandOptions(options);
    }
  };

  test('does not throw if not passed any options', () => {
    expect(() => doCall()).not.toThrow();
  });

  test('does not throw if passed `null`', () => {
    expect(() => doCall(null)).not.toThrow();
  });

  test.each`
  arg
  ${false}
  ${true}
  `('accepts `dataOnly` as $arg', ({ arg }) => {
    expect(() => doCall({ dataOnly: arg })).not.toThrow();
  });

  test.each`
  arg
  ${'sha1'}
  ${'sha256'}
  ${'sha512'}
  `('accepts algorithm $arg', ({ arg }) => {
    expect(() => doCall({ hashAlgorithm: arg })).not.toThrow();
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
    expect(() => doCall({ hashAlgorithm: algorithm, hashLength: len })).not.toThrow();
  });

  test.each`
  arg
  ${'strong'}
  ${'vary'}
  ${'weak'}
  `('accepts tag form $arg', ({ arg }) => {
    expect(() => doCall({ tagForm: arg })).not.toThrow();
  });
});

describe('etagFromData()', () => {
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

  test('honors overall length', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha256', hashLength: 10 });
    const result = await eg.etagFromData('');
    expect(result).toBe('"47DEQpj8HB"');
  });

  test('honors strong length', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha256', hashLength: { strong: 8 } });
    const result = await eg.etagFromData('');
    expect(result).toBe('"47DEQpj8"');
  });

  test('honors weak form', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', tagForm: 'weak' });
    const result = await eg.etagFromData('');
    expect(result).toBe('W/"2jmj7l5rSw0yVb/v"');
  });

  test('honors weak length with weak form', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', hashLength: { weak: 12 }, tagForm: 'weak' });
    const result = await eg.etagFromData('');
    expect(result).toBe('W/"2jmj7l5rSw0y"');
  });
});

describe('etagFromFile()', () => {
  const shortFilePath = new URL('fixtures/short-file.txt', import.meta.url).pathname;

  test('uses `etagFromFileStats()` when configured as `dataOnly: false`', async () => {
    const eg       = new EtagGenerator({ dataOnly: false });
    const expected = await eg.etagFromFileStats(shortFilePath);
    const result   = await eg.etagFromFile(shortFilePath);

    expect(result).toBe(expected);
  });

  test('uses `etagFromFileData()` when configured as `dataOnly: true`', async () => {
    const eg = new EtagGenerator({ dataOnly: true });
    const expected = await eg.etagFromFileData(shortFilePath);
    const result   = await eg.etagFromFile(shortFilePath);

    expect(result).toBe(expected);
  });
});

describe('etagFromFileData()', () => {
  const shortFilePath = new URL('fixtures/short-file.txt', import.meta.url).pathname;
  const longFilePath  = new URL('fixtures/long-file.txt', import.meta.url).pathname;

  // Make the long file.
  beforeAll(async () => {
    const buffer = Buffer.alloc(999123); // _Not_ going to be the read size.

    for (let i = 0, v = 33; i < buffer.length; i++) {
      if ((i % 75) === 0) {
        buffer[i] = '\n'.charCodeAt(0);
      } else {
        buffer[i] = v;
        v++;
        if (v === 127) {
          v = 33;
        }
      }
    }

    buffer[buffer.length - 1] = '\n'.charCodeAt(0);

    const fh = await fs.open(longFilePath, 'w');
    for (let i = 0; i < 10; i++) {
      await fh.write(buffer);
    }
    await fh.close();
  });

  afterAll(async () => {
    await fs.unlink(longFilePath);
  });

  test('works on a short file', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha256' });
    const result = await eg.etagFromFileData(shortFilePath);
    expect(result).toBe('"56N/bC8zkXo0ikXQMMs9eNGAzFIRKyH4gTp52cDsIFk"');
  });

  test('works on a long file', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha256' });
    const result = await eg.etagFromFileData(longFilePath);
    expect(result).toBe('"6xm8E7ciSk9pXBJRsIOsX2ifTCpWL4nMriZf8UYoWSk"');
  });

  test('honors overall length', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha256', hashLength: 12 });
    const result = await eg.etagFromFileData(shortFilePath);
    expect(result).toBe('"56N/bC8zkXo0"');
  });

  test('honors strong length', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha256', hashLength: { strong: 12 } });
    const result = await eg.etagFromFileData(shortFilePath);
    expect(result).toBe('"56N/bC8zkXo0"');
  });

  test('honors weak form', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', tagForm: 'weak' });
    const result = await eg.etagFromFileData(shortFilePath);
    expect(result).toBe('W/"aZtirMkeaJFgxHEd"');
  });

  test('honors weak length with weak form', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', hashLength: { weak: null }, tagForm: 'weak' });
    const result = await eg.etagFromFileData(shortFilePath);
    expect(result).toBe('W/"aZtirMkeaJFgxHEdUuy+RVb64ck"');
  });
});

describe('etagFromFileStats()', () => {
  const shortFilePath = new URL('fixtures/short-file.txt', import.meta.url).pathname;

  // This is a bit icky, but instead of trying to mock out the FS call, we just
  // redo the hash calculation here, and the tests are mostly about making sure
  // the real code does the same thing and also honors form and length, etc.
  let fullHash;
  beforeAll(async () => {
    const hex = (num) => {
      return (typeof num === 'number')
        ? Math.floor(num).toString(16)
        : num.toString(16);
    };

    const stats = await fs.stat(shortFilePath, true);
    const mtime = stats.mtimeMs;
    const size  = stats.size;

    const toBeHashed = `${shortFilePath}|${hex(mtime)}|${hex(size)}`;

    fullHash = crypto.createHash('sha1').update(toBeHashed).digest('base64');
    fullHash = fullHash.slice(0, 27);
  });

  test('generates the full hash in the expected way', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', hashLength: { weak: null } });
    const result = await eg.etagFromFileStats(shortFilePath);
    expect(result).toBe(`W/"${fullHash}"`);
  });

  test('honors overall length', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', hashLength: 8 });
    const result = await eg.etagFromFileStats(shortFilePath);
    expect(result).toBe(`W/"${fullHash.slice(0, 8)}"`);
  });

  test('honors strong form', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', tagForm: 'strong' });
    const result = await eg.etagFromFileStats(shortFilePath);
    expect(result).toBe(`"${fullHash}"`);
  });

  test('honors strong length with strong form', async () => {
    const eg     = new EtagGenerator({ hashAlgorithm: 'sha1', hashLength: { strong: 15 }, tagForm: 'strong' });
    const result = await eg.etagFromFileStats(shortFilePath);
    expect(result).toBe(`"${fullHash.slice(0, 15)}"`);
  });

  test('fails when the instance is configured as data-only', async () => {
    const eg = new EtagGenerator({ dataOnly: true });

    await expect(eg.etagFromFileStats(shortFilePath)).toReject();
  });
});
