/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./react.cjs'), 'next/core-web-vitals'],
  rules: {
    // Next.js page/layout files require default exports.
    'import/no-default-export': 'off',
  },
};
