const OUT_DIR         = new URL('../out', import.meta.url).pathname;
const TESTER_DIR      = `${OUT_DIR}/tester`;
const OUT_PROJECT_DIR = `${OUT_DIR}/lactoserv`;

/**
 * Find documentation for all the possible properties here:
 * * <https://jestjs.io/docs/configuration>
 */
export default {
  // Coverage-related options.
  ...{
    collectCoverage: false,
    collectCoverageFrom: [
      '**/code/node_modules/**',
      '!**/*.test.*'
    ],
    coverageDirectory: `${OUT_DIR}/coverage`,
    coveragePathIgnorePatterns: [],
    coverageProvider: 'v8' /* or 'babel' */,
    // coverageReporters: [...],
    // coverageThreshold: { ... },
  },

  // Test-finding options.
  ...{
    testMatch: [
      '**/code/node_modules/**/tests/**/*.test.{js,cjs,mjs}'
    ],

    // Without explicitly setting this to an empty array, `**/node_modules/**`
    // would be ignored (which is exactly where all our tests are).
    testPathIgnorePatterns: []
  },

  // Directory-setup options.
  ...{
    // Without this, there is a "secret" ignore pattern which prevents any files
    // under a `node_modules` directory from being found.
    haste: {
      retainAllFiles: true
    },

    // This allows Jest to find the Jest-related modules that are used in the
    // testing environment (e.g., `jest-extended`).
    modulePaths: [
      `${TESTER_DIR}/lib/node_modules`
    ],

    // That is, point at the built code, which includes external dependencies.
    rootDir: `${OUT_PROJECT_DIR}/lib`,

    // This has needed adjustment in the past.
    // roots: ['<rootDir>']
  },

  // Make calling deprecated APIs throw helpful error messages
  // errorOnDeprecated: false,

  // A path to a module which exports an async function that is triggered once before all test suites
  // globalSetup: undefined,

  // A path to a module which exports an async function that is triggered once after all test suites
  // globalTeardown: undefined,

  // The paths to modules that run some code to configure or set up the testing environment before each test
  setupFiles: [
    // Uncomment this only temporarily, when debugging issues with unhandled
    // promise rejections. Reason: When this is used, there are enough oddball
    // changes to / hooks into the underlying system that it can't truly be
    // trusted to be an accurate representation of what's going on when _not_
    // doing testing.
    // `${TESTER_DIR}/lib/node_modules/trace-unhandled/register`
  ],

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: [
    `${TESTER_DIR}/lib/node_modules/jest-extended/all`,
    `${TESTER_DIR}/lib/code/node_modules/@this/main-tester`
  ]
};
