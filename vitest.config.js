import { defineConfig } from 'vitest/config'

// Separat fil (inte ett `test`-fält i vite.config.js) så att vite.config.js
// slipper importera vitest/config i produktionsbygget — de delar ändå samma
// plugins där det behövs, men just nu behöver testerna (ren funktionslogik,
// inga komponenter) ingen React-plugin alls.
export default defineConfig({
  test: {
    environment: 'node',
    // api/ ligger med sedan datastädningen (api/cron/_dataRetention.js):
    // den bestämmer VILKA konton som raderas, och den sortens logik ska
    // testas lika hårt som räknemotorerna i src/ — inte lämnas otestad för
    // att den råkar bo i en annan mapp.
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
  },
})
