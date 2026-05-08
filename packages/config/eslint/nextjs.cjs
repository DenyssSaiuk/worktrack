/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [require.resolve('./react.cjs'), 'next/core-web-vitals'],
  rules: {
    // Next.js page/layout files require default exports.
    'import/no-default-export': 'off',
    // Next's bundled parser doesn't forward parserOptions.project to
    // typescript-eslint, so type-aware rules like consistent-type-imports
    // would crash. Next's own plugin enforces a similar set, so turn ours
    // off in the Next preset only.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
};
