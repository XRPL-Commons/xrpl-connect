import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    cache: {
      scripts: true,
      tasks: true,
    },
  },
  lint: {
    ignorePatterns: ['docs/**', 'examples/**', '**/tests/**', '**/*.test.ts'],
    plugins: ['typescript'],
    categories: {
      correctness: 'error',
    },
    env: {
      browser: true,
      node: true,
      es2020: true,
    },
    rules: {
      'typescript/no-explicit-any': 'warn',
      'typescript/explicit-module-boundary-types': 'off',
      'typescript/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['packages/ui/src/**/*.ts'],
        rules: {
          'typescript/no-explicit-any': 'error',
        },
      },
    ],
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
  fmt: {
    ignorePatterns: ['docs/0.8.2/**'],
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    sortPackageJson: false,
  },
});
