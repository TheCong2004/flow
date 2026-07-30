module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:markdown/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:prettier/recommended'
    ],
    settings: {
        react: {
            version: 'detect'
        }
    },
    parser: '@typescript-eslint/parser',
    ignorePatterns: ['**/node_modules', '**/dist', '**/build', '**/coverage', '**/package-lock.json'],
    plugins: ['unused-imports'],
    rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'warn',
        'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
        'no-undef': 'off',
        'no-console': [process.env.CI ? 'error' : 'warn', { allow: ['warn', 'error', 'info'] }],
        'prettier/prettier': 'error',
        'no-control-regex': 0
    },
    overrides: [
        {
            // Vendored Infinite Canvas uses non-native canvas interactions that
            // do not map cleanly to jsx-a11y's DOM interaction model.
            files: ['**/infinite-canvas-source/**/*.{js,jsx,ts,tsx}', '**/infiniteCanvasSource/**/*.{js,jsx,ts,tsx}'],
            rules: {
                'jsx-a11y/click-events-have-key-events': 'off',
                'jsx-a11y/label-has-associated-control': 'off',
                'jsx-a11y/media-has-caption': 'off',
                'jsx-a11y/no-autofocus': 'off',
                'jsx-a11y/no-noninteractive-element-interactions': 'off',
                'jsx-a11y/no-noninteractive-element-to-interactive-role': 'off',
                'jsx-a11y/no-static-element-interactions': 'off',
                'no-empty': 'off'
            }
        }
    ]
}
