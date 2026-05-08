module.exports = {
  root: true,
  extends: [require.resolve('@worktrack/config/eslint/base')],
  env: { browser: true, webextensions: true },
  globals: { chrome: 'readonly', browser: 'readonly' },
  ignorePatterns: ['dist-chrome', 'dist-firefox'],
};
