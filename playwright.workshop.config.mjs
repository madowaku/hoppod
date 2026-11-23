import { defineConfig } from '@playwright/test';
// Its own port, so these tests can never hit another checkout's server on 8000.
export default defineConfig({
  testDir: './tests/browser', testMatch: '**/browser/workshop*.spec.mjs', timeout: 240000, fullyParallel: false, workers: 1,
  reporter: [['list']], outputDir: 'output/playwright/workshop-results',
  use: { baseURL: 'http://127.0.0.1:8033', viewport: { width: 390, height: 844 }, screenshot: 'only-on-failure' },
  webServer: [{ command: 'python -m http.server 8033 --bind 127.0.0.1 --directory public', url: 'http://127.0.0.1:8033', reuseExistingServer: !process.env.CI }],
});
