// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MimeTypes } from '@this/net-util';


describe('typeFromExtension()', () => {
  test('finds the type given an extension without a dot', () => {
    expect(MimeTypes.typeFromExtension('png')).toBe('image/png');
  });

  test('finds the type given an extension with a dot', () => {
    expect(MimeTypes.typeFromExtension('.gif')).toBe('image/gif');
  });

  test('finds the type given a simple file name', () => {
    expect(MimeTypes.typeFromExtension('florp.txt')).toBe('text/plain');
  });

  test('finds the type given a zero-directory absolute path', () => {
    expect(MimeTypes.typeFromExtension('/boop.tar')).toBe('application/x-tar');
  });

  test('finds the type given a one-directory relative path', () => {
    expect(MimeTypes.typeFromExtension('boop/zorch.jpg')).toBe('image/jpeg');
  });

  test('finds the type given a one-directory absolute path', () => {
    expect(MimeTypes.typeFromExtension('/x/blonk.json')).toBe('application/json');
  });

  test('defaults to `application/octet-stream`', () => {
    expect(MimeTypes.typeFromExtension('.abcdefgXYZ')).toBe('application/octet-stream');
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
