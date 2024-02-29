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
