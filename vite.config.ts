import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { port: 5173, strictPort: true },
  // Three.js (~550 kB) is split into the lazily loaded 3D preview chunk.
  build: { chunkSizeWarningLimit: 600 },
  define: {
    // vue-i18n feature flags: full install, no deprecated options API, no devtools in production.
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  test: { include: ['tests/**/*.test.ts'] },
});
