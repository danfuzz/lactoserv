const THIS_DIR        = new URL('.', import.meta.url).pathname;
const OUT_DIR         = new URL('../out', import.meta.url).pathname;
const TESTER_DIR      = `${OUT_DIR}/tester`;
const OUT_PROJECT_DIR = `${OUT_DIR}/lactoserv`;

/**
 * Find documentation for all the possible properties here:
 * * <https://jestjs.io/docs/configuration>
 */
export default {
  // All imported modules in your tests should be mocked automatically
  // automock: false,

  // Stop running tests after `n` failures
  // bail: 0,

  // The directory where Jest should store its cached dependency information
  // cacheDirectory: "/private/var/folders/dk/s7gg5pt56c7fzkgzhs7_8zyc0000gn/T/jest_dx",

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

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

  // A path to a custom dependency extractor
  // dependencyExtractor: undefined,

  // Make calling deprecated APIs throw helpful error messages
  // errorOnDeprecated: false,

  // The default configuration for fake timers
  // fakeTimers: {
  //   "enableGlobally": false
  // },

  // Force coverage collection from ignored files using an array of glob patterns
  forceCoverageMatch: ['**/@this/**'],

  // A path to a module which exports an async function that is triggered once before all test suites
  // globalSetup: undefined,

  // A path to a module which exports an async function that is triggered once after all test suites
  // globalTeardown: undefined,

  // A set of global variables that need to be available in all test environments
  // globals: {},

  // Without this, there is a "secret" ignore pattern which prevents any files
  // under a `node_modules` directory from being found.
  haste: {
    retainAllFiles: true
  },

  // The maximum amount of workers used to run your tests. Can be specified as % or a number. E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum worker number. maxWorkers: 2 will use a maximum of 2 workers.
  // maxWorkers: "50%",

  // An array of directory names to be searched recursively up from the requiring module's location
  // moduleDirectories: [
  //   "node_modules"
  // ],

  // An array of file extensions your modules use
  // moduleFileExtensions: [
  //   "js",
  //   "mjs",
  //   "cjs",
  //   "jsx",
  //   "ts",
  //   "tsx",
  //   "json",
  //   "node"
  // ],

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  // moduleNameMapper: {},

  modulePaths: [

  ],

  // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
  // modulePathIgnorePatterns: [],

  // Activates notifications for test results
  // notify: false,

  // An enum that specifies notification mode. Requires { notify: true }
  // notifyMode: "failure-change",

  // A preset that is used as a base for Jest's configuration
  // preset: undefined,

  // Run tests from one or more projects
  // projects: undefined,

  // Use this configuration option to add custom reporters to Jest
  // reporters: undefined,

  // Automatically reset mock state before every test
  // resetMocks: false,

  // Reset the module registry before running each individual test
  // resetModules: false,

  // A path to a custom resolver
  // resolver: undefined,

  // Automatically restore mock state and implementation before every test
  // restoreMocks: false,

  // The root directory that Jest should scan for tests and modules within
  rootDir: TESTER_DIR,

  // A list of paths to directories that Jest should use to search for files in
  roots: [
     '<rootDir>',
     `${OUT_DIR}/lactoserv/lib`
  ],

  // Allows you to use a custom runner instead of Jest's default test runner
  //runner: "jest-light-runner",

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

  // The number of seconds after which a test is considered as slow and reported as such in the results.
  // slowTestThreshold: 5,

  // A list of paths to snapshot serializer modules Jest should use for snapshot testing
  // snapshotSerializers: [],

  // The test environment that will be used for testing
  // testEnvironment: "jest-environment-node",

  // Options that will be passed to the testEnvironment
  // testEnvironmentOptions: {},

  // Adds a location field to test results
  // testLocationInResults: false,

  // Glob patterns that match all test files.
  testMatch: [
    '**/code/node_modules/**/tests/**/*.test.{js,cjs,mjs}'
  ],

  // Without explicitly setting this to an empty array, `**/node_modules/**`
  // would be ignored (which is exactly where all our tests are).
  testPathIgnorePatterns: [],

  // This option allows the use of a custom results processor
  // testResultsProcessor: undefined,

  // This option allows use of a custom test runner
  // testRunner: "jest-circus/runner",

  // A map from regular expressions to paths to transformers
  // transform: undefined,

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  // transformIgnorePatterns: [
  //   "/node_modules/",
  //   "\\.pnp\\.[^\\/]+$"
  // ],

  // An array of regexp pattern strings that are matched against all modules before the module loader will automatically return a mock for them
  // unmockedModulePathPatterns: undefined,

  // Indicates whether each individual test should be reported during the run
  // verbose: undefined,

  // An array of regexp patterns that are matched against all source file paths before re-running tests in watch mode
  // watchPathIgnorePatterns: [],

  // Whether to use watchman for file crawling
  // watchman: true,
};
