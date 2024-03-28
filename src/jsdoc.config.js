// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

// See <https://jsdoc.app/about-configuring-jsdoc>.

// Note: As of JSDoc v4.0.2, it only accepts CJS-style JavaScript configs, not
// modern modules.
//
// Also note: As of the same version, JSDoc has trouble with private property
// defintions and inner classes.
// * <https://github.com/jsdoc/jsdoc/issues/1516>
// * <https://github.com/jsdoc/jsdoc/issues/2091>

const THIS_DIR = module.path;

module.exports = {
  opts: {
    destination: '../../out/lactoserv/api-docs',
    recurse:     true
  },
  plugins: ['plugins/markdown'],
  templates: {
    cleverLinks: true
  },

  source: {
    include: [THIS_DIR],
    includePattern: /.+[.]js(doc)?$/,
    excludePattern: /[/]tests[/]/
  }
};
