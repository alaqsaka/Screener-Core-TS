module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    env: { node: true, es2022: true },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parserOptions: { sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  };