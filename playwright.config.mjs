import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', {outputFile:'output/playwright/results.json'}]],
  outputDir: 'output/playwright/test-results',
  use: {baseURL:'http://127.0.0.1:8000', viewport:{width:390,height:844}, screenshot:'only-on-failure', trace:'retain-on-failure'},
  webServer: {command:'python -m http.server 8000 --bind 127.0.0.1 --directory public',url:'http://127.0.0.1:8000',reuseExistingServer:!process.env.CI},
});
