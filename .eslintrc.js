module.exports = {
  root: true,
  extends: ['universe/native', 'plugin:@typescript-eslint/recommended'],
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
};

