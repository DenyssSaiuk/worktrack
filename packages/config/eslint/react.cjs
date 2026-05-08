/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    require.resolve('./base.cjs'),
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  env: { browser: true, es2023: true },
  settings: { react: { version: 'detect' } },
  rules: {
    'react/prop-types': 'off',
    'react/self-closing-comp': 'error',
  },
};
