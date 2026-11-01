import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', {outputFile:'output/playwright/results.json'}]],
  outputDir: 'output/playwright/test-results',
  use: {baseURL:'http://127.0.0.1:8000', viewport:{width:390,height:844}, screenshot:'only-on-failure', trace:'retain-on-failure'},
  webServer: [
    {command:'python -m http.server 8000 --bind 127.0.0.1 --directory public',url:'http://127.0.0.1:8000',reuseExistingServer:!process.env.CI},
    // This pinned workerd supports Oct 30. Override only the LOCAL asset test;
    // the production config remains Oct 31 and is checked by deploy --dry-run.
    {command:'npm run preview:assets',url:'http://127.0.0.1:8011',reuseExistingServer:!process.env.CI,env:{WRANGLER_SEND_METRICS:'false'},timeout:60000},
  ],
});
