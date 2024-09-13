// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Base64Url } from '@this/net-util';

const CASES = [
  { label: 'empty', buf: '',             encoded: ''         },
  { label: 'rfc1',  buf: '66',           encoded: 'Zg'       },
  { label: 'rfc2',  buf: '666f',         encoded: 'Zm8'      },
  { label: 'rfc3',  buf: '666f6f',       encoded: 'Zm9v'     },
  { label: 'rfc4',  buf: '666f6f62',     encoded: 'Zm9vYg'   },
  { label: 'rfc5',  buf: '666f6f6261',   encoded: 'Zm9vYmE'  },
  { label: 'rfc6',  buf: '666f6f626172', encoded: 'Zm9vYmFy' },
];

for (const c of CASES) {
  if (typeof c.buf === 'string') {
    c.buf = Buffer.from(c.buf, 'hex');
  }
}

function addCase(buf) {
  const hex     = buf.toString('hex');
  const encoded = buf.toString('base64url');

  const label = (hex.length < 20)
    ? hex
    : `${hex.slice(0, 20)}... (length ${hex.length})`;

  CASES.push({ label, buf, encoded });
}

for (let i = 0; i < 256; i++) {
  addCase(Buffer.from([i]));
  addCase(Buffer.from([0, i]));
  addCase(Buffer.from([i, 0]));
  addCase(Buffer.from([i, i, i]));
}

for (let i = 4; i < 100; i++) {
  addCase(Buffer.alloc(i).fill(0));
  addCase(Buffer.alloc(i).fill(123));
  addCase(Buffer.alloc(i).fill(255));
}

describe('decode()', () => {
  for (const { label, buf, encoded } of CASES) {
    test(`decodes ${label} as expected`, () => {
      const got = Base64Url.decode(encoded);
      expect(got).toEqual(new Uint8Array(buf));
    });
  }
});

describe('encode()', () => {
  for (const { label, buf, encoded } of CASES) {
    test(`encodes ${label} as expected`, () => {
      const got = Base64Url.encode(buf);
      expect(got).toBe(encoded);
    });
  }
});
