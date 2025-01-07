// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { inspect } from 'node:util';


process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') {
    if (/VM Modules/.test(warning.message)) {
      // Suppress this one, because we totally know we're using it, and it's
      // intentional, so the warning is pure noise.
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.log('%s: %s\n', warning.name, warning.message);
});

// This extends Jest's equality checks to deal reasonably with a few more cases
// than it does by default, by leaning on common patterns in this codebase.

function lactoservEquals(a, b, customTesters) {
  // Note: `return undefined` means, "The comparison is not handled by this
  // tester."

  if ((typeof a !== 'object') || (typeof b !== 'object')) {
    return undefined;
  } else if ((a === null) || (b === null)) {
    return undefined;
  } else if (Array.isArray(a) || Array.isArray(b)) {
    return undefined;
  }

  const aProto = Reflect.getPrototypeOf(a);
  const bProto = Reflect.getPrototypeOf(b);

  if ((aProto === null) || (aProto !== bProto)) {
    return undefined;
  }

  // At this point, we're looking at two non-array objects of the same class
  // (that is, with the same prototype).

  if (typeof aProto.deconstruct === 'function') {
    // They (effectively) implement `IntfDeconstructable`. Note: There is no
    // need to check the `functor` of the deconstructed result, since it's
    // going to be `aProto` (which is also `bProto`).
    const aDecon = a.deconstruct(true).args;
    const bDecon = b.deconstruct(true).args;
    return this.equals(aDecon, bDecon, customTesters);
  } else if (typeof aProto[inspect.custom] === 'function') {
    // They have a custom inspector.
    return this.equals(inspect(a), inspect(b));
  } else if (typeof aProto.toJSON === 'function') {
    // They have a custom JSON encoder. This is the least-preferable option
    // because it's the most likely to end up losing information.
    return this.equals(a.toJSON(), b.toJSON(), customTesters);
  }

  return undefined;
}

// The linter doesn't realize this file is loaded in the context of testing, so
// it would complain that `expect` is undefined without the disable directive.
expect.addEqualityTesters([lactoservEquals]); // eslint-disable-line no-undef
