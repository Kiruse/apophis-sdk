const importPlugin = require('eslint-plugin-import');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['packages/*/src/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'import/extensions': ['error', 'always', { ignorePackages: true }],
    },
  },
];
