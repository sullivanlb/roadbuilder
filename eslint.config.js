import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

/** Files linted with full type information. */
const typedFiles = ['src/**/*.ts', 'src/**/*.vue', 'tests/**/*.ts', 'vite.config.ts'];

/** Architecture guards: each layer may only import from lower layers. */
const layerGuards = [
  {
    files: ['src/domain/**/*.ts'],
    forbidden: ['components', 'composables', 'export', 'rendering', 'i18n'],
    message: 'The domain is the pure core: it must not import from upper layers.',
  },
  {
    files: ['src/export/**/*.ts'],
    forbidden: ['components', 'composables', 'rendering'],
    message: 'The export layer may only depend on the domain and shared libraries.',
  },
  {
    files: ['src/rendering/**/*.ts'],
    forbidden: ['components', 'composables', 'export'],
    message: 'The rendering layer may only depend on the domain and shared libraries.',
  },
  {
    files: ['src/composables/**/*.ts'],
    forbidden: ['components'],
    message: 'Composables must not import UI components.',
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

  ...layerGuards.map(({ files, forbidden, message }) => ({
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: forbidden.map((layer) => ({ group: [`**/${layer}/**`], message })) },
      ],
    },
  })),

  prettier,
];
