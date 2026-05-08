/**
 * Root ESLint config — minimal Phase 0 baseline.
 *
 * Phase 1 replaces this with a real shared config under
 * `packages/config/eslint/`. Each workspace will then extend that package.
 * Until then, this root config exists only so editors and `pnpm lint`
 * have a valid starting point.
 */
module.exports = {
  root: true,
  env: {
    es2023: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.turbo',
    'out',
    'coverage',
    'target',
    '**/src-tauri/target',
    'pnpm-lock.yaml',
  ],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    eqeqeq: ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
  },
};
