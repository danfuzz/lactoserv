const THIS_DIR        = new URL('.', import.meta.url).pathname;
const OUT_DIR         = new URL('../out', import.meta.url).pathname;
const TESTER_DIR      = `${OUT_DIR}/tester`;
const OUT_PROJECT_DIR = `${OUT_DIR}/lactoserv`;

/**
 * Find documentation for all the possible properties here:
 * * <https://jestjs.io/docs/configuration>
 */
export default {
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: false,

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    '**/code/node_modules/**',
    '!**/*.test.*'
  ],

  // The directory where Jest should output its coverage files
  coverageDirectory: `${OUT_DIR}/coverage`,

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [],

  // Indicates which provider should be used to instrument code for coverage
  //coverageProvider: 'babel',
  coverageProvider: 'v8',

  // A list of reporter names that Jest uses when writing coverage reports
  // coverageReporters: [
  //   "json",
  //   "text",
  //   "lcov",
  //   "clover"
  // ],

  // An object that configures minimum threshold enforcement for coverage results
  // coverageThreshold: undefined,

  // Make calling deprecated APIs throw helpful error messages
  // errorOnDeprecated: false,

  // Force coverage collection from ignored files using an array of glob patterns
  forceCoverageMatch: ['**/@this/**'],

  // A path to a module which exports an async function that is triggered once before all test suites
  // globalSetup: undefined,

  // A path to a module which exports an async function that is triggered once after all test suites
  // globalTeardown: undefined,

  // Without this, there is a "secret" ignore pattern which prevents any files
  // under a `node_modules` directory from being found.
  haste: {
    retainAllFiles: true
  },

  // An array of directory names to be searched recursively up from the requiring module's location
  // moduleDirectories: [
  //   "node_modules"
  // ],

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  // moduleNameMapper: {},

  // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
  // modulePathIgnorePatterns: [],

  // A path to a custom resolver
  // resolver: undefined,

  // The root directory that Jest should scan for tests and modules within
  rootDir: TESTER_DIR,

  // A list of paths to directories that Jest should use to search for files in
  roots: [
     '<rootDir>',
     `${OUT_DIR}/lactoserv/lib`
  ],

  // The paths to modules that run some code to configure or set up the testing environment before each test
  setupFiles: [
    // Uncomment this only temporarily, when debugging issues with unhandled
    // promise rejections. Reason: When this is used, there are enough oddball
    // changes to / hooks into the underlying system that it can't truly be
    // trusted to be an accurate representation of what's going on when _not_
    // doing testing.
    //"../tester/node_modules/trace-unhandled/register"
  ],

  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  setupFilesAfterEnv: [
    `${TESTER_DIR}/lib/node_modules/jest-extended/all`,
    `${TESTER_DIR}/lib/code/node_modules/@this/main-tester`
  ],

  // Glob patterns that match all test files.
  testMatch: [
    '**/code/node_modules/**/tests/**/*.test.{js,cjs,mjs}'
  ],

  // Without explicitly setting this to an empty array, `**/node_modules/**`
  // would be ignored (which is exactly where all our tests are).
  testPathIgnorePatterns: []
};
