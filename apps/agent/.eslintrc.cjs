module.exports = {
  root: true,
  extends: [require.resolve('@worktrack/config/eslint/react')],
  overrides: [
    {
      files: ['vite.config.ts', 'tailwind.config.ts'],
      rules: { 'import/no-default-export': 'off' },
    },
  ],
  ignorePatterns: ['src-tauri', 'dist'],
};
