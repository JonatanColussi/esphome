module.exports = {
  root: true,
  extends: ['@colussi/eslint-config'],
  // The two old UI files are removed in a later task; do not lint them meanwhile.
  ignorePatterns: ['.esphome', 'tanquinho-ui.js', 'test/ui-logic.test.js'],
};
