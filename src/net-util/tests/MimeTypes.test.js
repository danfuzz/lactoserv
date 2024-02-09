// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MimeTypes } from '@this/net-util';


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

    test('does not impact a non-text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/a/b.gif', config)).toBe('image/gif');
    });

    test('does not impact a text extension', () => {
      expect(MimeTypes.typeFromPathExtension('/c/d/e.text', config)).toBe('text/plain');
    });

    test('defaults to `text/plain`', () => {
      expect(MimeTypes.typeFromPathExtension('/bonk/.abcdefgXYZ', config)).toBe('text/plain');
    });
  });

  describe('with config `{ charSet: \'boop\', isText: true }`', () => {
    const config = { charSet: 'boop', isText: true };

    test('alters the result from a non0text extension', () => {
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

  test('throws if given an unknown MIME type', () => {
    expect(() => MimeTypes.typeFromExtensionOrType('text/florp')).toThrow(/^Unknown MIME type/);
  });

  test('confirms the existence of a given MIME type', () => {
    const theType = 'image/jpeg';
    expect(MimeTypes.typeFromExtensionOrType(theType)).toBe(theType);
  });

  test('defaults to `application/octet-stream` given an unknown extension', () => {
    expect(MimeTypes.typeFromExtensionOrType('.abcdefgXYZ')).toBe('application/octet-stream');
  });

  test('preserves a charset if given', () => {
    const theType = 'text/plain; charset=utf-8';
    expect(MimeTypes.typeFromExtensionOrType(theType)).toBe(theType);
  });
});
