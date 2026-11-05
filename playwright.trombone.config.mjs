import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'trombone-cart.spec.mjs', workers: 1,
  reporter: 'list', outputDir: 'output/playwright/trombone-results',
  use: { baseURL: 'http://127.0.0.1:8022', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'python -m http.server 8022 --bind 127.0.0.1 --directory public', url: 'http://127.0.0.1:8022', reuseExistingServer: false }
});
