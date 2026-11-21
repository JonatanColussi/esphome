module.exports = {
  root: true,
  extends: ['@colussi/eslint-config'],
  // No React in this project; a fixed version stops eslint-plugin-react from warning about detection.
  settings: { react: { version: '18.3' } },
  // The two old UI files are removed in a later task; do not lint them meanwhile.
  ignorePatterns: ['.esphome', 'tanquinho-ui.js', 'test/ui-logic.test.js'],
};
