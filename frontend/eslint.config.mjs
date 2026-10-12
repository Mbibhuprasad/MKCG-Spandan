import js from '@eslint/js';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// Composed directly from the individual plugins (rather than eslint-config-next)
// so this JavaScript-only project needs no TypeScript toolchain to lint.
const config = [
  { ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**'] },
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Media comes from Cloudinary, which already resizes and optimises it. Private
      // (signed) assets must not pass through the public next/image optimiser cache.
      '@next/next/no-img-element': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Autofocus is used deliberately on the first field of the login form only.
      'jsx-a11y/no-autofocus': 'off',
    },
  },
];

export default config;
