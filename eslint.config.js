export default [
  {
    files: ['src/**/*.js', 'build/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly', history: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly', fetch: 'readonly', Response: 'readonly', indexedDB: 'readonly', crypto: 'readonly', caches: 'readonly', self: 'readonly',
        console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', requestAnimationFrame: 'readonly',
        matchMedia: 'readonly', getComputedStyle: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly', Image: 'readonly', Event: 'readonly', Notification: 'readonly',
        TextEncoder: 'readonly', TextDecoder: 'readonly', atob: 'readonly', btoa: 'readonly', globalThis: 'readonly',
        process: 'readonly', File: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
    }
  }
];
