module.exports = {
  root: true,
  extends: ['@colussi/eslint-config'],
  // No React in this project; a fixed version stops eslint-plugin-react from warning about detection.
  settings: { react: { version: '18.3' } },
  ignorePatterns: ['.esphome'],
};
