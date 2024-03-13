// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import jestPlugin from 'eslint-plugin-jest';
import js from '@eslint/js';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import stylisticPlugin from '@stylistic/eslint-plugin';

const mainRules = {
  'array-bracket-spacing': 'error',
  'arrow-parens': 'error',
  'consistent-return': 'error',
  'eol-last': 'error',
  'eqeqeq': 'error',
  'indent': [
    'error',
    2,
    {
      'FunctionDeclaration': { 'parameters': 2 },
      'FunctionExpression':  { 'parameters': 2 },
      'SwitchCase':          1,
      'ignoredNodes':        ['TemplateLiteral *']
    }
  ],
  'keyword-spacing': 'error',
  'max-len': [
    'error',
    {
      'code': 120,
      'comments': 80,
      'ignoreRegExpLiterals': true,
      'ignoreStrings': true,
      'ignoreTemplateLiterals': true,
      'ignoreUrls': true,
      'tabWidth': 8
    }
  ],
  'new-parens': 'error',
  'no-alert': 'warn',
  'no-array-constructor': 'error',
  'no-empty-function': 'error',
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-fallthrough': ['error', { 'commentPattern': 'fall ?through' }],
  'no-floating-decimal': 'error',
  'no-implied-eval': 'error',
  'no-nested-ternary': 'error',
  'no-new-func': 'error',
  'no-new-object': 'error',
  'no-regex-spaces': 'off',
  'no-self-assign': ['error', { 'props': true }],
  'no-shadow': 'error',
  'no-trailing-spaces': 'error',
  'no-undef': 'error',
  'no-unsafe-negation': 'error',
  'no-unused-vars': [
    'error',
    {
      'vars': 'all',
      'args': 'all',
      'varsIgnorePattern': '_unused$',
      'argsIgnorePattern': '_unused$'
    }
  ],
  'no-var': 'error',
  'object-curly-spacing': ['error', 'always'],
  'object-shorthand': ['error', 'always'],
  'prefer-const': 'error',
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  'quotes': [
    'error',
    'single',
    {
      'avoidEscape':           true,
      'allowTemplateLiterals': true
    }
  ],
  'semi': ['error', 'always'],
  'space-before-blocks': ['error', 'always'],
  'space-before-function-paren': [
    'error',
    {
      'anonymous':  'always',
      'named':      'never',
      'asyncArrow': 'always'
    }
  ],
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
        },
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

// Overrides for testing files.
const testOverrides = {
  files: ['**/tests/*.test.js'],
  plugins: ['jest'],
  env: {
    'jest/globals': true
  },
  rules: {
    'jsdoc/require-jsdoc': ['off']
  }
};

export default [
  // Overall config.
  js.configs.recommended,
  jsdocPlugin.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2024
    },
    plugins: {
      jsdoc:        jsdocPlugin,
      '@stylistic': stylisticPlugin
    },
    rules: {
      ...mainRules,
      ...jsdocRules,
      ...disallowedFunctionality
    },
    settings: {
      jsdoc: {
        mode: 'jsdoc'
      }
    }
  },

  // Exempt files.
  {
    ignores: ['**/jest.config.mjs']
  },

  // Non-testing files.
  {
    files:   ['**/*.{js,mjs,cjs}'],
    ignores: ['**/tests/**/*.test.{js,mjs,cjs}']
  },

  // Testing files.
  {
    files: ['**/tests/**/*.test.{js,mjs,cjs}'],
    plugins: {
      jest: jestPlugin
    },
    languageOptions: {
      globals: {
        beforeAll: 'readonly',
        describe:  'readonly',
        expect:    'readonly',
        test:      'readonly'
      }
    },
    rules: {
      'jsdoc/require-jsdoc': ['off']
    }
  }
];
