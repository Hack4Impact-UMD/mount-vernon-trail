// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'coverage/*'] },
  {
    // Jest globals are injected by the runner, and test files legitimately
    // need require() for isolated module reloading.
    files: ['**/__tests__/**', '**/*.test.*', 'jest.setup.js', 'test-utils/**'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
    },
  },
  {
    // eslint-config-expo 57 enables the React Compiler's hooks rules. The code
    // predates them, so they are warnings here to keep the SDK bump on its own;
    // the next layer fixes every hit and makes them errors again.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
