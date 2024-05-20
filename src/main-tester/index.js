// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning') {
    if (/VM Modules/.test(warning.message)) {
      // Suppress this one, because we totally know we're using it, and it's
      // intentional, so the warning is pure noise.
      return;
    }
  }

  console.log('%s: %s\n', warning.name, warning.message);
});

// This works around a bug in Jest's wrapping of `process`: `process.emit` is
// normally inherited from `EventEmitter`, but `source-map-support` directly
// adds an `emit` binding to `process`. _Sometimes_ this happens when Jest is in
// the middle of creating a `SyntheticModule` wrapper for `process`, and if that
// happens at just the wrong time, Node will throw `ReferenceError: Export
// 'emit' is not defined in module`. By putting a direct binding of
// `process.emit` here, we avoid the race (though there is still arguably an
// underlying problem). See this issue in Jest:
// <https://github.com/jestjs/jest/issues/15077>
process.emit = process.emit; // eslint-disable-line no-self-assign
