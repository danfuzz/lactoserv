// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import js from '@eslint/js';
import stylisticPlugin from '@stylistic/eslint-plugin';
import jestPlugin from 'eslint-plugin-jest';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import globals from 'globals';


// "Stylistic" rules (indentation, semicolon hygiene, etc.).
const stylisticRules = {
  '@stylistic/arrow-parens': ['error', 'always'],
  '@stylistic/brace-style': [
    'error',
    '1tbs',
    {
      allowSingleLine: true
    }
  ],
  '@stylistic/comma-dangle': ['error', 'never'],
  '@stylistic/dot-location': ['error', 'property'],
  '@stylistic/eol-last': 'error',
  '@stylistic/indent': [
    'error',
    2,
    {
      FunctionDeclaration: { parameters: 2 },
      FunctionExpression:  { parameters: 2 },
      SwitchCase:          1,
      ignoredNodes:        ['TemplateLiteral *']
    }
  ],
  '@stylistic/indent-binary-ops': 'off',
  '@stylistic/key-spacing': [
    'error',
    {
      multiLine: {
        beforeColon: false,
        afterColon:  true,
        mode:        'minimum'
      },
      singleLine: {
        afterColon:  true,
        beforeColon: false,
        mode:        'strict'
      }
    }
  ],
  '@stylistic/keyword-spacing': 'error',
  '@stylistic/max-len': [
    'error',
    {
      code:                   120,
      comments:               80,
      ignoreRegExpLiterals:   true,
      ignoreStrings:          true,
      ignoreTemplateLiterals: true,
      ignoreUrls:             true,
      tabWidth:               8
    }
  ],
  '@stylistic/max-statements-per-line': 'off',
  '@stylistic/multiline-ternary': [
    'error',
    'always-multiline'
  ],
  '@stylistic/new-parens': 'error',
  '@stylistic/newline-per-chained-call': [
    'error',
    {
      ignoreChainWithDepth: 3
    }
  ],
  '@stylistic/no-extra-parens': 'off',
  '@stylistic/no-floating-decimal': 'error',
  '@stylistic/no-multi-spaces': 'off',
  '@stylistic/no-multiple-empty-lines': [
    'error',
    {
      max: 2,
      maxBOF: 0,
      maxEOF: 0
    }
  ],
  '@stylistic/no-trailing-spaces': 'error',
  '@stylistic/object-curly-spacing': ['error', 'always'],
  '@stylistic/operator-linebreak': 'off',
  '@stylistic/quotes': [
    'error',
    'single',
    {
      avoidEscape:           true,
      allowTemplateLiterals: true
    }
  ],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/space-before-blocks': ['error', 'always'],
  '@stylistic/space-before-function-paren': [
    'error',
    {
      anonymous:  'always',
      named:      'never',
      asyncArrow: 'always'
    }
  ],
  '@stylistic/space-in-parens': 'off',
  '@stylistic/space-infix-ops': 'off',
  '@stylistic/spaced-comment': 'off',
  '@stylistic/yield-star-spacing': [
    'error',
    {
      before: false,
      after:  true
    }
  ]
};

// Semantic rules, non-project-specific.
const semanticRules = {
  'eqeqeq': 'error',
  'consistent-return': 'error',
  'no-alert': 'warn',
  'no-array-constructor': 'error',
  'no-empty-function': 'error',
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-fallthrough': ['error', { commentPattern: 'fall ?through' }],
  'no-implied-eval': 'error',
  'no-nested-ternary': 'error',
  'no-new-func': 'error',
  'no-new-object': 'error',
  'no-regex-spaces': 'off',
  'no-self-assign': ['error', { props: true }],
  'no-shadow': 'error',
  'no-undef': 'error',
  'no-unsafe-negation': 'error',
  'no-unused-vars': [
    'error',
    {
      vars: 'all',
      args: 'all',
      varsIgnorePattern: '_unused$',
      argsIgnorePattern: '_unused$'
    }
  ],
  'no-var': 'error',
  'object-shorthand': ['error', 'always'],
  'prefer-const': 'error',
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  'symbol-description': 'error'
};

// Specific classes, methods, functions, etc. that we don't want to use in this
// project.

const allNodeCoreModules = [
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
  'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream',
  'string_decoder', 'timers', 'tls', 'trace_events', 'tty', 'url',
  'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
];
const disallowedFunctionality = {
  'no-restricted-globals': [
    'error',
    {
      name:    'setImmediate',
      message: 'Use `setImmediate()` in `node:timers` or `node:timers/promises`.'
    },
    {
      name:    'setInterval',
      message: 'Use `clocks.WallClock` (or a different time source if appropriate).'
    },
    {
      name:    'setTimeout',
      message: 'Use `clocks.WallClock` (or a different time source if appropriate).'
    },
    {
      name:    'timers',
      message: 'Use `clocks` module from this project.'
    }
  ],
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name:        'node:process',
          importNames: ['hrtime'],
          message:     'Use module `clocks` from this project.'
        },
        {
          name:        'node:timers',
          importNames: ['clearTimeout', 'clearInterval', 'setTimeout', 'setInterval'],
          message:     'Use module `clocks` from this project.'
        },
        {
          name:        'node:timers/promises',
          importNames: ['setTimeout', 'setInterval', 'scheduler'],
          message:     'Use module `clocks` from this project.'
        }
      ],
      patterns: [
        ...allNodeCoreModules.map((name) => {
          return {
            group: [`^${name}$`, `^${name}/`],
            message: 'Use `node:` prefix on core Node module imports.'
          };
        })
      ]
    }
  ],
  'no-restricted-properties': [
    'error',
    {
      object:   'Date',
      property: 'now',
      message:  'Use module `clocks` from this project.'
    }
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'NewExpression[callee.name=\'Date\'][arguments.length!=1]',
      message:  'Use module `clocks` or class `data-values.Moment`.'
    }
  ]
};

// Handy links:
//
// * JSDoc plugin for ESLint: <https://github.com/gajus/eslint-plugin-jsdoc>
// * JSDoc: <https://jsdoc.app/>
// * The Closure type system:
//   <https://github.com/google/closure-compiler/wiki/Types-in-the-Closure-Type-System>
const jsdocRules = {
  'jsdoc/no-multi-asterisks': [
    'error',
    {
      allowWhitespace: true
    }
  ],
  'jsdoc/require-jsdoc': [
    'warn',
    {
      require: {
        ArrowFunctionExpression: false,
        ClassDeclaration: true,
        ClassExpression: false,
        FunctionDeclaration: false,
        FunctionExpression: false,
        MethodDefinition: true
      }
    }
  ],
  'jsdoc/require-property': [
    'off'
  ],
  'jsdoc/tag-lines': [
    'warn',
    'any',
    {
      startLines: 1
    }
  ]
};

export default [
  // Overall config.
  js.configs.recommended,
  jsdocPlugin.configs['flat/recommended'],
  stylisticPlugin.configs['disable-legacy'],
  stylisticPlugin.configs['recommended-flat'],
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.node,
        ...globals.es2024
      }
    },
    plugins: {
      'jsdoc':      jsdocPlugin,
      '@stylistic': stylisticPlugin
    },
    rules: {
      ...stylisticRules,
      ...semanticRules,
      ...disallowedFunctionality,
      ...jsdocRules
    },
    settings: {
      jsdoc: {
        mode: 'jsdoc'
      }
    }
  },

  // Normal source files.
  {
    files:   ['**/*.{js,mjs,cjs}'],
    ignores: [
      '**/tests/**/*.test.{js,mjs,cjs}',
      '**/*.config.{js,mjs,cjs}'
    ]
  },

  // Config files.
  {
    files: ['**/*.config.{js,mjs,cjs}'],
    rules: {
      '@stylistic/max-len': [
        'error',
        {
          ...stylisticRules['@stylistic/max-len'][1],
          comments: 120
        }
      ]
    }
  },

  // Testing files.
  {
    files: ['**/tests/**/*.test.{js,mjs,cjs}'],
    ...jestPlugin.configs['flat/recommended'],
    plugins: {
      jest: jestPlugin
    },
    languageOptions: {
      globals: globals.jest
    },
    rules: {
      'jsdoc/require-jsdoc':    'off',
      'jest/no-disabled-tests': 'error'
    }
  }
];
