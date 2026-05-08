/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.cjs')],
  env: { node: true },
  rules: {
    'no-process-exit': 'error',
  },
};
