// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // "@/…" is the project-root alias from jsconfig.json. Metro resolves it
      // (and `npm run export` fails if an import is wrong); the lint resolver
      // only reads tsconfig files, so it is told not to second-guess the alias.
      'import/no-unresolved': ['error', { ignore: ['^@/'] }],
    },
  },
  {
    // tests/ runs in Node against a test API, not in the app.
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'tests/*'],
  },
]);
