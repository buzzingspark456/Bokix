import { defineConfig } from 'vitest/config'

// Separat fil (inte ett `test`-fält i vite.config.js) så att vite.config.js
// slipper importera vitest/config i produktionsbygget — de delar ändå samma
// plugins där det behövs, men just nu behöver testerna (ren funktionslogik,
// inga komponenter) ingen React-plugin alls.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
