// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // TypeScript handles @/ path alias resolution; ESLint's import resolver
      // doesn't support tsconfig paths without extra plugins
      'import/no-unresolved': 'off',
    },
  },
]);
