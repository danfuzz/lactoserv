const plugins = [
  "jsdoc"
];

const extendsList = [
  "eslint:recommended",
  "plugin:jsdoc/recommended"
];

const env = {
  "es2020": true,
  "node": true
};

const parserOptions = {
  "sourceType": "module",
  "ecmaVersion": "2022"
}

module.exports = {
  plugins,
  extends: extendsList,
  env,
  parserOptions,

  "rules" : {
    "array-bracket-spacing": "error",
    "arrow-parens": ["error", "as-needed", { "requireForBlockBody": true }],
    "consistent-return": "error",
    "eol-last": "error",
    "eqeqeq": "error",
    "indent": [
      "error",
      2,
      {
        "FunctionDeclaration": { "parameters": 2 },
        "FunctionExpression": { "parameters": 2 },
        "SwitchCase": 1
      }
    ],
    "keyword-spacing": "error",
    "max-len": [
      "error",
      {
        "code": 120,
        "comments": 80,
        "ignoreRegExpLiterals": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true,
        "ignoreUrls": true,
        "tabWidth": 8
      }
    ],
    "new-parens": "error",
    "no-alert": "warn",
    "no-array-constructor": "error",
    "no-empty-function": "error",
    "no-eval": "error",
    "no-extend-native": "error",
    "no-fallthrough": ["error", { "commentPattern": "fallthrough" }],
    "no-floating-decimal": "error",
    "no-implied-eval": "error",
    "no-nested-ternary": "error",
    "no-new-func": "error",
    "no-new-object": "error",
    "no-regex-spaces": "off",
    "no-self-assign": ["error", { "props": true }],
    "no-shadow": "error",
    "no-trailing-spaces": "error",
    "no-undef": "error",
    "no-unsafe-negation": "error",
    "no-unused-vars": [
      "error",
      {
        "vars": "all",
        "args": "all",
        "varsIgnorePattern": "_unused$",
        "argsIgnorePattern": "_unused$"
      }
    ],
    "no-var": "error",
    "object-curly-spacing": ["error", "always"],
    "object-shorthand": ["error", "always"],
    "prefer-const": "error",
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "quotes": [
      "error",
      "single",
      {
        "avoidEscape": true,
        "allowTemplateLiterals": true
      }
    ],
    "semi": ["error", "always"],
    "space-before-blocks": ["error", "always"],
    "space-before-function-paren": [
      "error",
      {
        "anonymous": "always",
        "named": "never",
        "asyncArrow": "always"
      }
    ],
    "symbol-description": "error"
  }
}
