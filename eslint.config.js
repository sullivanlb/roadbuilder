import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

/** Files linted with full type information. */
const typedFiles = ['src/**/*.ts', 'src/**/*.vue', 'tests/**/*.ts', 'vite.config.ts'];

/** Architecture guards: each layer may only import from the layers below it. */
const layerGuards = [
  {
    files: ['src/core/**/*.ts'],
    forbidden: ['app', 'components', 'editor', 'export', 'i18n', 'platform', 'rendering', 'stores'],
    packages: ['vue', 'pinia', '@vueuse/*', 'three', 'three/*'],
    message: 'The core is the pure domain: no framework and no upper layer.',
  },
  {
    files: ['src/export/**/*.ts'],
    forbidden: ['app', 'components', 'editor', 'i18n', 'platform', 'rendering', 'stores'],
    packages: ['vue', 'pinia', '@vueuse/*'],
    message: 'The export layer only depends on the core; texts are passed in.',
  },
  {
    files: ['src/rendering/**/*.ts'],
    forbidden: ['app', 'components', 'editor', 'export', 'i18n', 'platform', 'stores'],
    packages: ['vue', 'pinia'],
    message: 'Rendering draws what it is given: it only depends on the core.',
  },
  {
    files: ['src/platform/**/*.ts'],
    forbidden: ['app', 'components', 'core', 'editor', 'export', 'i18n', 'rendering', 'stores'],
    packages: [],
    message: 'The platform port knows nothing of the editor.',
  },
  {
    files: ['src/stores/**/*.ts', 'src/editor/**/*.ts', 'src/i18n/**/*.ts'],
    forbidden: ['app', 'components'],
    packages: [],
    message: 'State and behaviour must not depend on UI components.',
  },
];

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.husky/**', 'package-lock.json'],
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files: typedFiles })),

  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      'vue/component-api-style': ['error', ['script-setup']],
    },
  },

  {
    files: ['src/**/*.ts', 'src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['tests/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      parserOptions: { project: './tsconfig.node.json', tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    files: typedFiles,
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },

  ...layerGuards.map(({ files, forbidden, packages, message }) => ({
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbidden.map((layer) => ({ group: [`**/${layer}/**`], message })),
            ...(packages.length ? [{ group: packages, message }] : []),
          ],
        },
      ],
    },
  })),

  prettier,
];
