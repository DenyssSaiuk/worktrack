module.exports = {
  root: true,
  extends: [require.resolve('@worktrack/config/eslint/node')],
  overrides: [
    {
      // Fastify plugins are conventionally default-exported.
      files: ['src/plugins/**/*.ts'],
      rules: { 'import/no-default-export': 'off' },
    },
    {
      // Process entry points are allowed to terminate the process.
      files: ['src/server.ts', 'src/workers/start.ts'],
      rules: { 'no-process-exit': 'off' },
    },
    {
      // Tooling configs require default exports.
      files: ['vitest.config.ts', 'vite.config.ts'],
      rules: { 'import/no-default-export': 'off' },
    },
  ],
  ignorePatterns: ['test/load/**'],
};
