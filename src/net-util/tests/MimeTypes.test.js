// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MimeTypes } from '@this/net-util';


describe('charSetFromType()', () => {
  // Failure cases: Wrong argument type.
  test.each`
  arg
  ${null}
  ${undefined}
  ${false}
  ${123}
  ${['.x']}
  ${{ a: 10 }}
  ${new Map()}
  `('throws given $arg', ({ arg }) => {
    expect(() => MimeTypes.charSetFromType(arg)).toThrow();
  });

  test.each`
  arg                                        | expected
  ${''}                                      | ${null}
  ${'text/plain'}                            | ${null}
  ${'text/plain; charset=abc'}               | ${'abc'}
  ${'text/plain;charset=abc'}                | ${'abc'}
  ${'application/json; charset=abc-123-xyz'} | ${'abc-123-xyz'}
  ${'x/y'}                                   | ${null}
  ${'x/y; a=z'}                              | ${null}
  ${'x/y; charset=z9z'}                      | ${'z9z'}
  ${'x/y; charset=z9z; b=c'}                 | ${'z9z'}
  ${'x/y; charset=z9z ; b=c'}                | ${'z9z'}
  ${'x/y; charset=z9z ;b=c'}                 | ${'z9z'}
  ${'x/y; b=c; charset=z9z'}                 | ${'z9z'}
  ${'x/y; b=c; charset=z9z; d=e'}            | ${'z9z'}
  ${'x/y; xcharset=z'}                       | ${null}
  ${'x/y; charset=boop; xcharset=z'}         | ${'boop'}
  ${'x/y; charsetx=z'}                       | ${null}
  ${'x/y; charsetx=z; charset=beep'}         | ${'beep'}
  ${'w/eird; charset=-~_\'`!#$%&+^{}'}       | ${'-~_\'`!#$%&+^{}'} // All the allowed special chars.
  ${'w/eird; charset=x@y'}                   | ${null} // Disallowed special char.
  ${'w/eird; charset="xy"'}                  | ${null} // Ditto.
  ${'w/eird; charset=(xy)'}                  | ${null} // Ditto.
  ${'w/eird; charset=[xy]'}                  | ${null} // Ditto.
  `('returns `$expected` given `$arg`', ({ arg, expected }) => {
    expect(MimeTypes.charSetFromType(arg)).toBe(expected);
  });
});

describe('typeFromExtensionOrType()', () => {
  // Failure cases: Wrong argument type.
  test.each`
  arg
  ${null}
  ${undefined}
  ${false}
  ${123}
  ${['.x']}
  ${{ a: 10 }}
  ${new Map()}
  `('throws given $arg', ({ arg }) => {
    expect(() => MimeTypes.typeFromExtensionOrType(arg)).toThrow();
  });

  // Failure cases: Incorrect syntax.
  test.each`
  arg
  ${''}
  ${'txt'}               // Extensions are supposed to start with a dot.
  ${'/application/json'} // MIME types don't start with a slash.
  `('throws given $arg', ({ arg }) => {
    expect(() => MimeTypes.typeFromExtensionOrType(arg)).toThrow(/^Invalid syntax/);
  });

  describe('with no config argument', () => {
    test('throws if given an unknown MIME type', () => {
      expect(() => MimeTypes.typeFromExtensionOrType('text/florp')).toThrow(/^Unknown MIME type/);
    });

    test('confirms the existence of a given MIME type', () => {
      const theType = 'image/jpeg';
      expect(MimeTypes.typeFromExtensionOrType(theType)).toBe(theType);
    });

    test('finds the MIME type of a known extension', () => {
      expect(MimeTypes.typeFromExtensionOrType('.png')).toBe('image/png');
    });

    test('defaults to `application/octet-stream` given an unknown extension', () => {
      expect(MimeTypes.typeFromExtensionOrType('.abcdefgXYZ')).toBe('application/octet-stream');
    });

    test('preserves a charset if given', () => {
      const theType = 'text/plain; charset=utf-8';
      expect(MimeTypes.typeFromExtensionOrType(theType)).toBe(theType);
    });
  });

  describe('with config `{ charSet: \'florp\' }`', () => {
    const config = { charSet: 'florp' };

    test('alters a text MIME type', () => {
      const theType  = 'text/plain';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(expected);
    });

    test('does not alter a non-text MIME type', () => {
      const theType = 'image/jpeg';
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(theType);
    });

    test('finds the MIME type of a known non-text extension, as-is', () => {
      expect(MimeTypes.typeFromExtensionOrType('.png', config)).toBe('image/png');
    });

    test('finds the MIME type of a known text extension, and adds the charset', () => {
      const theType  = 'text/javascript';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType('.js', config)).toBe(expected);
    });

    test('defaults to `application/octet-stream` given an unknown extension', () => {
      expect(MimeTypes.typeFromExtensionOrType('.abcdefgXYZ', config)).toBe('application/octet-stream');
    });

    test('preserves a charset if given', () => {
      const theType = 'text/plain; charset=utf-8';
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(theType);
    });
  });

  describe('with config `{ isText: true }`', () => {
    const config = { isText: true };

    test('does not alter a text MIME type', () => {
      const theType  = 'text/plain';
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(theType);
    });

    test('does not alter a non-text MIME type', () => {
      const theType = 'image/jpeg';
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(theType);
    });

    test('finds the MIME type of a known non-text extension, as-is', () => {
      expect(MimeTypes.typeFromExtensionOrType('.png', config)).toBe('image/png');
    });

    test('finds the MIME type of a known text extension, as-is', () => {
      expect(MimeTypes.typeFromExtensionOrType('.js', config)).toBe('text/javascript');
    });

    test('defaults to `text/plain` given an unknown extension', () => {
      expect(MimeTypes.typeFromExtensionOrType('.abcdefgXYZ', config)).toBe('text/plain');
    });

    test('preserves a charset if given', () => {
      const theType = 'text/plain; charset=utf-8';
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(theType);
    });
  });

  describe('with config `{ charSet: \'boop\', isText: true }`', () => {
    const config = { charSet: 'boop', isText: true };

    test('alters a text MIME type', () => {
      const theType  = 'text/plain';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(expected);
    });

    test('alters a non-text MIME type', () => {
      const theType = 'image/jpeg';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(expected);
    });

    test('finds the MIME type of a known non-text extension, and alters it', () => {
      const theType = 'image/png';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType('.png', config)).toBe(expected);
    });

    test('finds the MIME type of a known text extension, and alters it', () => {
      const theType  = 'text/javascript';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType('.js', config)).toBe(expected);
    });

    test('defaults to `text/plain` with the charset given an unknown extension', () => {
      const theType  = 'text/plain';
      const expected = `${theType}; charset=${config.charSet}`;
      expect(MimeTypes.typeFromExtensionOrType('.abcdefgXYZ', config)).toBe(expected);
    });

    test('preserves a charset if given', () => {
      const theType = 'text/plain; charset=utf-8';
      expect(MimeTypes.typeFromExtensionOrType(theType, config)).toBe(theType);
    });
  });
});

describe('typeFromPathExtension()', () => {
  // Failure cases: Wrong argument type.
  test.each`
  arg
  ${null}
  ${undefined}
  ${false}
  ${123}
  ${['.x']}
  ${{ a: 10 }}
  ${new Map()}
  `('throws given $arg', ({ arg }) => {
    expect(() => MimeTypes.typeFromPathExtension(arg)).toThrow();
  });

  // Failure cases: Incorrect syntax (not an absolute path).
  test.each`
  arg
  ${''}
  ${'txt'}
  ${'.txt'}
  ${'foo.txt'}
  ${'foo/bar.txt'}
  ${'//foo.txt'}
  ${'/foo//bar.txt'}
  ${'/foo/./bar.txt'}
  ${'/foo/../bar.txt'}
  ${'/foo/bar.txt/'}
  `('throws given $arg', ({ arg }) => {
    expect(() => MimeTypes.typeFromPathExtension(arg)).toThrow(/^Not an absolute path/);
  });

  describe('with no config argument', () => {
    test('finds the type given a zero-directory absolute path', () => {
      expect(MimeTypes.typeFromPathExtension('/boop.tar')).toBe('application/x-tar');
    });

    test('finds the type given a one-directory absolute path', () => {
      expect(MimeTypes.typeFromPathExtension('/x/blonk.json')).toBe('application/json');
    });

    test('finds the type given a zero-directory absolute path with a dot-file', () => {
      expect(MimeTypes.typeFromPathExtension('/.boop.tar')).toBe('application/x-tar');
    });

    test('finds the type given a one-directory absolute path with a dot-file', () => {
      expect(MimeTypes.typeFromPathExtension('/x/.blonk.json')).toBe('application/json');
    });

    test('defaults to `application/octet-stream`', () => {
      expect(MimeTypes.typeFromPathExtension('/abc.abcdefgXYZ')).toBe('application/octet-stream');
    });

    test('returns a value with `charset=utf-8` given a text type', () => {
      expect(MimeTypes.typeFromPathExtension('/a/b/c.html')).toBe('text/html; charset=utf-8');
    });
  });

  describe('with config `{ charSet: null }`', () => {
    const config = { charSet: null };

    test('does not impact a non-text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/foo.gif', config)).toBe('image/gif');
    });

    test('does not include a `charset` in the result from a text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/bar.text', config)).toBe('text/plain');
    });

    test('defaults to `application/octet-stream`', () => {
      expect(MimeTypes.typeFromPathExtension('/florp.abcdefgXYZ', config)).toBe('application/octet-stream');
    });
  });

  describe('with config `{ charSet: \'florp\' }`', () => {
    const config = { charSet: 'florp' };

    test('does not impact a non-text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/foo.gif', config)).toBe('image/gif');
    });

    test('alters the result from a text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/bar.text', config)).toBe('text/plain; charset=florp');
    });

    test('defaults to `application/octet-stream`', () => {
      expect(MimeTypes.typeFromPathExtension('/florp.abcdefgXYZ', config)).toBe('application/octet-stream');
    });
  });

  describe('with config `{ isText: true }`', () => {
    const config = { isText: true };

    test('alters an otherwise non-text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/a/b.gif', config)).toBe('image/gif; charset=utf-8');
    });

    test('does not impact a text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/c/d/e.text', config)).toBe('text/plain; charset=utf-8');
    });

    test('defaults to `text/plain`', () => {
      expect(MimeTypes.typeFromPathExtension('/bonk/.abcdefgXYZ', config)).toBe('text/plain; charset=utf-8');
    });
  });

  describe('with config `{ charSet: \'boop\', isText: true }`', () => {
    const config = { charSet: 'boop', isText: true };

    test('alters the result from a non-text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/a.png', config)).toBe('image/png; charset=boop');
    });

    test('alters the result from a text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/bb.text', config)).toBe('text/plain; charset=boop');
    });

    test('defaults to `text/plain` with the configured charset', () => {
      expect(MimeTypes.typeFromPathExtension('/cc.abcdefgXYZ', config)).toBe('text/plain; charset=boop');
    });
  });
});
